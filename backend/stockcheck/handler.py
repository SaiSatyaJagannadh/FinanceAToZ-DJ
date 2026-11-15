"""
Alex public endpoints (no login): free stock check and the chat assistant.

POST /check {"symbol": "INFY", "exchange": "NSE"|"BSE"|"US"}
    FinAI's five scoring engines (engine/, from github.com/SaiSatyaJagannadh/FinAI):
    yfinance + Screener.in data, scored by the Node runner, blended into BUY/HOLD/SELL.
POST /chat {"messages": [{"role": "user"|"assistant", "content": "..."}], "context": {...}}
    Nova Pro on Bedrock, optionally grounded in a stock check result.

Served by a Lambda function URL; CORS is configured on the URL in terraform/9_stockcheck.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# yfinance caches under $HOME; only /tmp is writable on Lambda
os.environ.setdefault("HOME", "/tmp")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp/.cache")

import boto3

ENGINE = Path(__file__).parent / "engine"
sys.path.insert(0, str(ENGINE))
from stockDataService import fetch_stock_data  # noqa: E402
from screenerService import fetch_company  # noqa: E402

BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
bedrock = boto3.client("bedrock-runtime", region_name=os.getenv("BEDROCK_REGION", "us-west-2"))

# ponytail: per-request caps only; add a per-IP rate limit (e.g. DynamoDB counter) if the free chat gets abused
MAX_TURNS, MAX_CHARS = 12, 1000

CHAT_SYSTEM = """You are Alex, a friendly AI financial guide inside the Alex portfolio app.
Answer investing questions in plain language: concepts, ETFs, funds, stocks, diversification,
retirement and long-term growth. Keep answers short (under 180 words) with bullets where useful.
If a stock check result is provided, use its scores to explain that stock.
When it helps, mention what Alex can do: free stock checks on the home page, and after signing in,
portfolio tracking plus a full analysis by six AI agents (planner, report writer, chart maker,
retirement specialist, high growth scout, instrument tagger).
You give general education, not personal financial advice; say so when asked what to buy."""


def merge_screener(data: dict, sc: dict) -> None:
    """Screener.in wins over yfinance when it has a value (same merge as FinAI's analysisRoutes.js)."""
    fund = data.setdefault("fundamental", {})
    for k in ("peRatio", "pbRatio", "dividendYield", "eps", "bookValue"):
        if (sc.get("fundamental") or {}).get(k):
            fund[k] = sc["fundamental"][k]
    for k in ("roe", "roa", "roce", "profitMargin", "operatingMargin", "debtToEquity", "currentRatio", "revenue"):
        if sc.get(k):
            data[k] = sc[k]
    for k in ("revenueGrowth", "profitGrowth", "epsGrowth", "bookValueGrowth",
              "dividendGrowth", "operatingProfitGrowth", "pbtGrowth"):
        g = sc.get(k)
        if g and (g.get("yoy") or g.get("qoq")):
            data[k] = g
    for k in ("quarterly", "efficiency", "name", "sector"):
        if sc.get(k):
            data[k] = sc[k]


def check_stock(symbol: str, exchange: str) -> dict:
    data = fetch_stock_data(symbol, exchange, "1y")
    if not data.get("success"):
        raise LookupError(data.get("error") or f"No data found for {symbol} on {exchange}")

    # Screener.in only covers Indian listings
    sc = fetch_company(symbol) if exchange in ("NSE", "BSE") else {}
    if sc.get("success", True):
        merge_screener(data, sc)
    shareholding = sc.get("shareholding")

    out = subprocess.run(
        ["node", str(ENGINE / "analysisRunner.js")],
        input=json.dumps({"stockData": data, "screenerShareholding": shareholding, "symbol": symbol}),
        capture_output=True, text=True, timeout=30,
    )
    analysis = json.loads(out.stdout)
    if "error" in analysis:
        raise RuntimeError(analysis["error"])

    price, fund = data.get("priceData", {}), data.get("fundamental", {})
    overall = analysis["overall"]
    return {
        "symbol": symbol,
        "exchange": exchange,
        "name": data.get("name") or symbol,
        "sector": data.get("sector") or "",
        "currency": "INR" if exchange in ("NSE", "BSE") else "USD",
        "price": price.get("current"),
        "change": (price.get("current") or 0) - (price.get("previousClose") or 0),
        "marketCap": price.get("marketCap"),
        "fiftyTwoWeekHigh": data.get("fiftyTwoWeekHigh"),
        "fiftyTwoWeekLow": data.get("fiftyTwoWeekLow"),
        "metrics": {
            "pe": fund.get("peRatio"),
            "pb": fund.get("pbRatio"),
            "roe": data.get("roe"),
            "debtToEquity": data.get("debtToEquity"),
            "dividendYield": fund.get("dividendYield"),
        },
        "scores": {
            "fundamental": overall["fundamentalScore"],
            "growth": overall["growthScore"],
            "technical": overall["technicalScore"],
            "conviction": overall["convictionScore"],
            "risk": overall["riskScore"],
        },
        "recommendation": overall["recommendation"],
        "priceHistory": [p.get("close") for p in (data.get("priceHistory") or [])][-120:],
    }


def chat(messages: list, context: dict | None) -> str:
    turns = [m for m in messages if m.get("role") in ("user", "assistant") and m.get("content")][-MAX_TURNS:]
    # Bedrock needs the conversation to start with a user turn
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    if not turns:
        raise ValueError("Ask a question first")

    system = CHAT_SYSTEM
    if context:
        system += "\n\nStock check result the user is looking at:\n" + json.dumps(context)[:4000]

    resp = bedrock.converse(
        modelId=BEDROCK_MODEL_ID,
        system=[{"text": system}],
        messages=[{"role": m["role"], "content": [{"text": str(m["content"])[:MAX_CHARS]}]} for m in turns],
        inferenceConfig={"maxTokens": 600, "temperature": 0.4},
    )
    return resp["output"]["message"]["content"][0]["text"]


def respond(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"}, "body": json.dumps(body, default=str)}


def lambda_handler(event, context):
    path = event.get("rawPath", "/")
    if event.get("requestContext", {}).get("http", {}).get("method") != "POST":
        return respond(200, {"status": "ok", "endpoints": ["/check", "/chat"]})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return respond(400, {"error": "Invalid JSON"})

    try:
        if path.endswith("/check"):
            symbol = str(body.get("symbol", "")).strip().upper()
            exchange = str(body.get("exchange", "US")).strip().upper()
            if not symbol or len(symbol) > 20 or exchange not in ("NSE", "BSE", "US"):
                return respond(400, {"error": "Enter a stock symbol and pick NSE, BSE or US"})
            return respond(200, check_stock(symbol, exchange))
        if path.endswith("/chat"):
            return respond(200, {"reply": chat(body.get("messages") or [], body.get("context"))})
        return respond(404, {"error": "Not found"})
    except LookupError as e:
        return respond(404, {"error": str(e)})
    except ValueError as e:
        return respond(400, {"error": str(e)})
    except Exception as e:
        print(f"ERROR {path}: {e!r}")
        return respond(500, {"error": "Something went wrong. Please try again."})
