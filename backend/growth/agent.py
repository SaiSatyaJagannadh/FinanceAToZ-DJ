"""
High Growth Value Scout Agent - suggests long-term growth funds and stocks.
"""

import json
import os
from typing import Dict, Any

from agents.extensions.models.litellm_model import LitellmModel

from templates import GROWTH_TASK_TEMPLATE


def _top(alloc: Dict[str, Any], n: int = 3) -> str:
    items = sorted((alloc or {}).items(), key=lambda kv: -float(kv[1]))[:n]
    return ", ".join(f"{k} {float(v):.0f}%" for k, v in items) or "unknown"


def summarize_holdings(portfolio_data: Dict[str, Any]) -> tuple[str, float]:
    """One line per position, plus the total portfolio value."""
    rows, total = [], 0.0
    for account in portfolio_data.get("accounts", []):
        total += float(account.get("cash_balance", 0))
        for p in account.get("positions", []):
            inst = p.get("instrument", {})
            value = float(p.get("quantity", 0)) * float(inst.get("current_price") or 0)
            total += value
            rows.append((p["symbol"], inst.get("name", ""), value, inst))

    lines = [
        f"- {sym} ({name}): ${value:,.0f}, {value / total * 100 if total else 0:.1f}%, "
        f"asset class: {_top(inst.get('allocation_asset_class'))}, sectors: {_top(inst.get('allocation_sectors'))}"
        for sym, name, value, inst in rows
    ]
    return "\n".join(lines) or "- No positions yet", total


def create_agent(job_id: str, portfolio_data: Dict[str, Any], db):
    """Create the model, tools and task for the growth agent."""
    model_id = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
    os.environ["AWS_REGION_NAME"] = os.getenv("BEDROCK_REGION", "us-west-2")
    model = LitellmModel(model=f"bedrock/{model_id}")

    holdings, total = summarize_holdings(portfolio_data)
    universe = ", ".join(f"{i['symbol']} ({i.get('name', '')})" for i in db.instruments.find_all()[:60])
    user = db.users.find_by_clerk_id(portfolio_data.get("user_id", "")) or {}
    profile = user.get("profile") or {}

    task = GROWTH_TASK_TEMPLATE.format(
        years_until_retirement=portfolio_data.get("years_until_retirement", 30),
        risk_profile=profile.get("risk_profile", "not assessed (assume Moderate)"),
        fire=json.dumps(profile.get("fire") or "not set"),
        total_value=total,
        holdings=holdings,
        universe=universe,
    )
    return model, [], task
