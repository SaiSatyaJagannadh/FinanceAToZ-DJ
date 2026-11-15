"""
Public endpoints (no login): free stock check, symbol search and the chat assistant.

POST /check {"symbol": "INFY", "exchange": "IN"|"NSE"|"BSE"|"US"}   ("IN" tries NSE, then BSE)
    FinAI's five scoring engines (engine/, from github.com/SaiSatyaJagannadh/FinAI):
    yfinance + Screener.in/FinViz data, scored by the Node runner, blended into BUY/HOLD/SELL,
    plus FinAI's projection/moat/sector outlook and Yahoo analyst ratings, events and news.
POST /search {"query": "apple"} -> [{"symbol": "AAPL", "name": "Apple Inc.", "exchange": "US", ...}]
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
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor

ENGINE = Path(__file__).parent / "engine"
sys.path.insert(0, str(ENGINE))
from stockDataService import fetch_stock_data  # noqa: E402
from screenerService import fetch_company  # noqa: E402
from finvizService import fetch_finviz  # noqa: E402

BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
bedrock = boto3.client("bedrock-runtime", region_name=os.getenv("BEDROCK_REGION", "us-west-2"))

# ponytail: per-request caps only; add a per-IP rate limit (e.g. DynamoDB counter) if the free chat gets abused
MAX_TURNS, MAX_CHARS = 12, 1000

CHAT_SYSTEM = """You are Finora, a friendly AI financial guide inside the Finora portfolio app.
Answer investing questions in plain language: concepts, ETFs, funds, stocks, diversification,
retirement and long-term growth. Keep answers short (under 180 words) with bullets where useful.
If a stock check result is provided, use its scores to explain that stock.
When it helps, mention what Finora can do: free stock checks on the home page, and after signing in,
portfolio tracking, a FIRE calculator and risk profile, a chat that knows your portfolio, and a full analysis by six AI agents (planner, report writer, chart maker,
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


def run_node(script: str, payload: dict) -> dict:
    out = subprocess.run(["node", str(ENGINE / script)], input=json.dumps(payload, default=str),
                         capture_output=True, text=True, timeout=30)
    result = json.loads(out.stdout)
    if "error" in result:
        raise RuntimeError(result["error"])
    return result


def _safe(fn, default):
    try:
        return fn()
    except Exception as e:
        print(f"market intel skipped: {e!r}")
        return default


def market_intel(yahoo_symbol: str) -> dict:
    """Analyst ratings, recent upgrades/downgrades, price targets, upcoming events and news (yfinance)."""
    t = yf.Ticker(yahoo_symbol)

    def ratings():
        row = t.recommendations_summary.iloc[0]
        return {k: int(row[k]) for k in ("strongBuy", "buy", "hold", "sell", "strongSell")}

    def actions():
        df = t.upgrades_downgrades.head(10).reset_index()
        return [{
            "date": str(r["GradeDate"])[:10], "firm": r["Firm"], "action": r["Action"],
            "from": r["FromGrade"], "to": r["ToGrade"],
            "priceTarget": float(r.get("currentPriceTarget") or 0),
        } for _, r in df.iterrows()]

    def events():
        cal = t.calendar or {}
        out = []
        for key in ("Earnings Date", "Ex-Dividend Date", "Dividend Date"):
            v = cal.get(key)
            if v:
                out.append({"event": key, "date": str(v[0] if isinstance(v, list) else v)})
        if cal.get("Earnings Average"):
            out.append({"event": "Expected EPS (consensus)", "date": f"{cal['Earnings Average']:.2f}"})
        return out

    def news():
        items = []
        for n in t.news[:8]:
            c = n.get("content") or {}
            link = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url")
            if c.get("title") and link:
                items.append({
                    "title": c["title"],
                    "publisher": (c.get("provider") or {}).get("displayName", ""),
                    "date": (c.get("pubDate") or "")[:10],
                    "summary": (c.get("summary") or "")[:280],
                    "url": link,
                })
        return items

    return {
        "analystRatings": _safe(ratings, None),
        "analystActions": _safe(actions, []),
        "priceTargets": _safe(lambda: dict(t.analyst_price_targets), None),
        "events": _safe(events, []),
        "news": _safe(news, []),
    }


def source_links(symbol: str, exchange: str, yahoo_symbol: str) -> dict:
    links = {"Yahoo Finance": f"https://finance.yahoo.com/quote/{yahoo_symbol}"}
    if exchange in ("NSE", "BSE"):
        links["Screener.in"] = f"https://www.screener.in/company/{symbol}/consolidated/"
        links["NSE quote"] = f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}"
    else:
        links["FinViz"] = f"https://finviz.com/quote.ashx?t={symbol}"
        links["SEC filings"] = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={symbol}&type=10-K"
    return links


def fetch_listing(symbol: str, exchange: str) -> tuple[dict, str]:
    """'IN' means India: try NSE first, then BSE (most stocks list on both)."""
    for exch in (("NSE", "BSE") if exchange == "IN" else (exchange,)):
        data = fetch_stock_data(symbol, exch, "1y")
        if data.get("success"):
            return data, exch
    raise LookupError(data.get("error") or f"No data found for {symbol}")


def check_stock(symbol: str, exchange: str) -> dict:
    data, exchange = fetch_listing(symbol, exchange)
    india = exchange in ("NSE", "BSE")
    yahoo_symbol = data.get("yahooSymbol") or symbol

    # Screener.in covers Indian listings, FinViz US ones; news/analysts come from Yahoo for both
    with ThreadPoolExecutor(max_workers=3) as pool:
        sc_f = pool.submit(fetch_company, symbol) if india else None
        fv_f = pool.submit(fetch_finviz, symbol) if not india else None
        intel_f = pool.submit(market_intel, yahoo_symbol)
        sc = _safe(sc_f.result, {}) if sc_f else {}
        fv = _safe(fv_f.result, {}) if fv_f else {}
        intel = intel_f.result()

    if sc.get("success", True):
        merge_screener(data, sc)
    shareholding = sc.get("shareholding")

    analysis = run_node("analysisRunner.js", {"stockData": data, "screenerShareholding": shareholding, "symbol": symbol})
    extras = run_node("extrasRunner.js", {"stockData": data, "finviz": fv or None, "shareholding": shareholding})

    price, fund = data.get("priceData", {}), data.get("fundamental", {})
    overall = analysis["overall"]
    return {
        "symbol": symbol,
        "exchange": exchange,
        "name": data.get("name") or symbol,
        "sector": data.get("sector") or "",
        "currency": "INR" if india else "USD",
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
        "details": {k: analysis[k] for k in ("fundamental", "technical", "growth", "mutualFund", "risk")},
        "projection": extras["projection"],
        "moat": extras["moat"],
        "sectorOutlook": extras["sectorOutlook"],
        "shareholding": (shareholding or {}).get("percentages"),
        "finviz": fv if fv.get("success") else None,
        **intel,
        "sources": source_links(symbol, exchange, yahoo_symbol),
        "priceHistory": [p.get("close") for p in (data.get("priceHistory") or [])][-250:],
    }


def search(query: str) -> list:
    """Name or ticker -> listings, e.g. 'apple' -> AAPL. Stocks and ETFs on US and Indian exchanges only."""
    exch_map = {"NSI": "NSE", "BSE": "BSE", "BOM": "BSE"}
    results = []
    for q in yf.Search(query, max_results=10, news_count=0).quotes:
        if q.get("quoteType") not in ("EQUITY", "ETF"):
            continue
        sym = q.get("symbol", "")
        exch = exch_map.get(q.get("exchange"), "US" if "." not in sym else None)
        if not exch:
            continue
        results.append({
            "symbol": sym.split(".")[0],
            "name": q.get("longname") or q.get("shortname") or sym,
            "exchange": exch,
            "type": q.get("quoteType").lower(),
        })
    return results[:8]


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
            if not symbol or len(symbol) > 20 or exchange not in ("IN", "NSE", "BSE", "US"):
                return respond(400, {"error": "Enter a stock symbol and pick US or India"})
            return respond(200, check_stock(symbol, exchange))
        if path.endswith("/search"):
            query = str(body.get("query", "")).strip()
            if not query or len(query) > 50:
                return respond(400, {"error": "Type a company name or symbol"})
            return respond(200, {"results": search(query)})
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
