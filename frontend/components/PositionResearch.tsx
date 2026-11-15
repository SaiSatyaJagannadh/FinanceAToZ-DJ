import { useEffect, useState } from "react";
import Link from "next/link";
import { STOCKCHECK_URL } from "../lib/config";
import type { StockResult } from "./StockCheck";

// How long each FinAI horizon usually means, and when to reconsider
const HORIZON_PLAN: Record<string, string> = {
  "LONG-TERM": "Long-term hold: plan for 3–5+ years and review once or twice a year.",
  "MEDIUM-TERM": "Medium-term: plan for roughly 6–18 months, then review against the target.",
  "SHORT-TERM": "Short-term trade: weeks to a few months; be strict with the stop-loss.",
};

export default function PositionResearch({ symbol, quantity }: { symbol: string; quantity: number }) {
  const [data, setData] = useState<StockResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${STOCKCHECK_URL}/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symbol, exchange: "US" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Research failed");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Research failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (error) return <p className="text-sm text-error">Couldn&apos;t research {symbol}: {error}</p>;
  if (!data) return <p className="text-sm text-gray-500 animate-pulse">Researching {symbol}: live data, five scoring engines, analyst views…</p>;

  const rec = data.recommendation;
  const money = (n: number) => `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const value = data.price * quantity;
  const upside = ((rec.targetPrice / data.price - 1) * 100).toFixed(1);
  const downside = ((rec.stopLoss / data.price - 1) * 100).toFixed(1);
  const ratings = data.analystRatings;
  // Nearest support level below today's price (the engine lists several)
  const below = ((data.details?.technical?.supportResistance?.support as number[]) || []).filter((s) => s < data.price);
  const support = below.length ? Math.max(...below) : undefined;
  // FinAI's target equals today's price on HOLD, so fall back to the next resistance, then the analyst mean target
  const above = ((data.details?.technical?.supportResistance?.resistance as number[]) || []).filter((s) => s > data.price * 1.005);
  const [shortTarget, targetSource] =
    rec.targetPrice > data.price * 1.005 ? [rec.targetPrice, "engine target"]
    : above.length ? [Math.min(...above), "next resistance"]
    : data.priceTargets?.mean && data.priceTargets.mean > data.price ? [data.priceTargets.mean, "analyst mean target"]
    : [data.price * 1.08, "+8% rule of thumb"];
  const rsiSignal =(data.details?.technical?.rsi?.signal || "").replace(/_/g, " ").toLowerCase();
  const longTermOk = data.scores.fundamental >= 60 && data.scores.growth >= 55;
  const nextEarnings = data.events?.find((e) => e.event === "Earnings Date")?.date;

  const plan = {
    BUY: [
      `Buy / add: the engines score ${symbol} ${rec.score}/100 (${rec.confidence.toLowerCase()} confidence).`,
      `Take profit near ${money(rec.targetPrice)} (${upside}% from today).`,
      `Exit if it closes below ${money(rec.stopLoss)} (${downside}%) to limit losses.`,
    ],
    HOLD: [
      `Hold what you have: ${rec.score}/100 is neither a clear buy nor a sell.`,
      support ? `Consider adding only on dips toward support around ${money(support)}.` : "Add only on meaningful dips.",
      `Reconsider if it falls below ${money(rec.stopLoss)} (${downside}%).`,
    ],
    SELL: [
      `Consider trimming: the engines score it ${rec.score}/100.`,
      `If you keep it, exit below ${money(rec.stopLoss)} (${downside}%).`,
      `Expected path points toward ${money(rec.targetPrice)} (${upside}%).`,
    ],
  }[rec.action];

  return (
    <div className="grid md:grid-cols-3 gap-4 text-sm">
      <div>
        <p className="text-xs text-gray-500">{data.name}</p>
        <p className="mt-1">
          <span className={`inline-block px-2.5 py-1 rounded font-bold ${rec.action === "BUY" ? "bg-success text-white" : rec.action === "SELL" ? "bg-error text-white" : "bg-accent text-dark"}`}>
            {rec.action}
          </span>{" "}
          <span className="text-gray-600">score {rec.score}/100</span>
        </p>
        <p className="mt-2 text-gray-600">Live price {money(data.price)} · your holding {money(value)}</p>
        {ratings && (
          <p className="mt-1 text-gray-600">
            Analysts: {ratings.strongBuy + ratings.buy} buy · {ratings.hold} hold · {ratings.sell + ratings.strongSell} sell
          </p>
        )}
      </div>
      <div className="md:col-span-2">
        <p className="font-medium text-dark">If you invest: plan</p>
        <ul className="mt-1 list-disc ml-5 space-y-0.5 text-gray-700">
          {plan.map((p) => <li key={p}>{p}</li>)}
          <li>{HORIZON_PLAN[rec.investmentHorizon] || HORIZON_PLAN["MEDIUM-TERM"]}</li>
        </ul>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white border border-gray-200">
            <p className="font-medium text-dark">⚡ If you trade it short-term</p>
            <ul className="mt-1 list-disc ml-5 space-y-0.5 text-gray-700">
              <li>Entry: {rec.action === "SELL" ? "wait; the trend is against you" : support ? `near ${money(data.price)}, or better on a dip to ${money(support)}` : `near ${money(data.price)}`}</li>
              <li>Take profit: {money(shortTarget)} (+{((shortTarget / data.price - 1) * 100).toFixed(1)}%, {targetSource})</li>
              <li>Stop-loss: {money(rec.stopLoss)} ({downside}%), exit with no second-guessing</li>
              <li>Window: weeks to ~3 months{rsiSignal ? `; RSI says ${rsiSignal}` : ""}</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-white border border-gray-200">
            <p className="font-medium text-dark">🌱 If you invest long-term</p>
            <ul className="mt-1 list-disc ml-5 space-y-0.5 text-gray-700">
              <li>{longTermOk
                ? `Quality and growth look solid (fundamentals ${data.scores.fundamental}, growth ${data.scores.growth}): hold 3–5+ years.`
                : `Fundamentals ${data.scores.fundamental} / growth ${data.scores.growth} are not strong: keep it a small position.`}</li>
              <li>Add gradually (e.g. monthly) rather than all at once.</li>
              <li>Review every quarter after earnings{nextEarnings ? ` (next: ${nextEarnings})` : ""}.</li>
              <li>Exit if the score falls into SELL territory (below 50) or the business case breaks, not because of short-term dips.</li>
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Mechanical scores, not advice. <Link href={`/stock-check?symbol=${symbol}`} className="text-primary hover:underline">See full research →</Link>
        </p>
      </div>
    </div>
  );
}
