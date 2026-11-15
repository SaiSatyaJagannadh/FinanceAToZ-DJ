"""
Local check of the public endpoints (needs node on PATH and AWS credentials for /chat).

    uv run test_local.py [SYMBOL] [EXCHANGE]
"""

import json
import sys

from dotenv import load_dotenv

load_dotenv("../../.env", override=True)

from handler import lambda_handler  # noqa: E402


def call(path: str, body: dict) -> dict:
    event = {"rawPath": path, "requestContext": {"http": {"method": "POST"}}, "body": json.dumps(body)}
    res = lambda_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
exchange = sys.argv[2] if len(sys.argv) > 2 else "US"

status, result = call("/check", {"symbol": symbol, "exchange": exchange})
assert status == 200, result
assert result["recommendation"]["action"] in ("BUY", "HOLD", "SELL"), result
assert set(result["scores"]) == {"fundamental", "growth", "technical", "conviction", "risk"}
print(f"✅ /check {symbol}: {result['recommendation']['action']} score {result['recommendation']['score']} {result['scores']}")

status, bad = call("/check", {"symbol": "", "exchange": "US"})
assert status == 400, bad
print("✅ /check rejects an empty symbol")

status, reply = call("/chat", {"messages": [{"role": "user", "content": f"In one sentence, what does the score mean for {symbol}?"}], "context": result})
assert status == 200, reply
print(f"✅ /chat: {reply['reply'][:200]}")
