"""
Local check of the portfolio-aware chat and profile update, as test_user_001
(the user backend/test_full.py creates). Bypasses Clerk with a dependency override.

    uv run test_portfolio_chat.py
"""

from fastapi.testclient import TestClient

from main import app, get_current_user_id, portfolio_context

USER = "test_user_001"
app.dependency_overrides[get_current_user_id] = lambda: USER
client = TestClient(app)

context = portfolio_context(USER)
assert "Accounts and holdings" in context and "Total portfolio value" in context
print(context[:600], "...\n")

r = client.put("/api/user", json={"profile": {"risk_profile": "Moderate", "current_age": 35}})
assert r.status_code == 200, r.text
assert r.json()["profile"]["risk_profile"] == "Moderate"
print("✅ profile saved")

r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "Which funds do I hold and what did the growth agent suggest? One line each."}]})
assert r.status_code == 200, r.text
print("✅ chat:", r.json()["reply"][:500])
