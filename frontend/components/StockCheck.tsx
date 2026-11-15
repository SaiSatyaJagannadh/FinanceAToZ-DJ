/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { SignUpButton } from "@clerk/nextjs";
import { STOCKCHECK_URL } from "../lib/config";
import StockDetails from "./StockDetails";

export interface StockResult {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  currency: "INR" | "USD";
  price: number;
  change: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  metrics: { pe: number; pb: number; roe: number; debtToEquity: number; dividendYield: number };
  scores: Record<"fundamental" | "growth" | "technical" | "conviction" | "risk", number>;
  recommendation: {
    action: "BUY" | "HOLD" | "SELL";
    confidence: string;
    score: number;
    targetPrice: number;
    stopLoss: number;
    investmentHorizon: string;
  };
  priceHistory: number[];
  // Full FinAI breakdown + Yahoo market intel (shapes come from the engine; see StockDetails)
  details?: Record<"fundamental" | "technical" | "growth" | "mutualFund" | "risk", any>;
  projection?: any;
  moat?: any;
  sectorOutlook?: any;
  shareholding?: Record<string, number> | null;
  analystRatings?: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  analystActions?: any[];
  priceTargets?: { current: number; high: number; low: number; mean: number; median: number } | null;
  events?: { event: string; date: string }[];
  news?: { title: string; publisher: string; date: string; summary: string; url: string }[];
  sources?: Record<string, string>;
}

// Compact version saved for the chat assistant's context
export function summarizeForChat(r: StockResult) {
  return {
    symbol: r.symbol, exchange: r.exchange, name: r.name, sector: r.sector, price: r.price,
    scores: r.scores, recommendation: r.recommendation, metrics: r.metrics,
    analystRatings: r.analystRatings, priceTargets: r.priceTargets,
    moat: r.moat?.verdict, events: r.events, headlines: (r.news || []).slice(0, 4).map((n) => n.title),
  };
}

const PILLARS: { key: keyof StockResult["scores"]; label: string; help: string }[] = [
  { key: "fundamental", label: "Fundamentals", help: "Valuation, profitability and debt vs. its sector" },
  { key: "growth", label: "Growth", help: "Revenue, profit and EPS growth trends" },
  { key: "technical", label: "Technicals", help: "Price trend, momentum (RSI, MACD) and volume" },
  { key: "conviction", label: "Big-money conviction", help: "Whether institutions are buying or selling" },
  { key: "risk", label: "Safety", help: "Volatility, leverage and liquidity (higher = safer)" },
];

// Quick picks per market: US shows only US stocks, India only Indian ones (NSE/BSE handled as one)
const QUICK_PICKS: Record<string, string[]> = {
  US: ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "TSLA"],
  IN: ["RELIANCE", "INFY", "TCS", "HDFCBANK", "ICICIBANK", "ITC"],
};

const ACTION_STYLE = {
  BUY: "bg-success text-white",
  HOLD: "bg-accent text-dark",
  SELL: "bg-error text-white",
};

// Signed-out visitors get a few free checks, then we ask them to create an account
export const FREE_CHECKS = 3;
const COUNT_KEY = "alex:freeChecks";
export const LAST_CHECK_KEY = "alex:lastCheck";

function readCount(): number {
  try {
    return Number(localStorage.getItem(COUNT_KEY) || 0);
  } catch {
    return 0;
  }
}

const scoreColor = (s: number) => (s >= 65 ? "bg-success" : s >= 50 ? "bg-accent" : "bg-error");

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${30 - ((p - min) / (max - min || 1)) * 28 - 1}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-14" aria-label="Price over the last year">
      <polyline points={d} fill="none" strokeWidth="1.2" vectorEffect="non-scaling-stroke"
        className={up ? "stroke-success" : "stroke-error"} />
    </svg>
  );
}

interface Props {
  gated?: boolean;
  initialSymbol?: string;
  initialMarket?: "US" | "IN";
}

export default function StockCheck({ gated = false, initialSymbol, initialMarket = "US" }: Props) {
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState<string>(initialMarket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StockResult | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  // Deep link from the accounts page: /stock-check?symbol=AAPL
  useEffect(() => {
    if (initialSymbol) run(initialSymbol, initialMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol]);

  const run = async (sym: string, exch: string) => {
    if (!sym.trim()) return;
    if (gated && readCount() >= FREE_CHECKS) {
      setLimitHit(true);
      return;
    }
    setSymbol(sym.toUpperCase());
    setExchange(exch);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${STOCKCHECK_URL}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: sym.trim(), exchange: exch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setResult(data);
      try {
        sessionStorage.setItem(LAST_CHECK_KEY, JSON.stringify(summarizeForChat(data)));
        if (gated) localStorage.setItem(COUNT_KEY, String(readCount() + 1));
      } catch {
        /* storage blocked: the check still works */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setLoading(false);
    }
  };

  const cur = result?.currency === "INR" ? "₹" : "$";
  const money = (n: number) => `${cur}${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const remaining = Math.max(0, FREE_CHECKS - readCount());

  return (
    <div className="bg-white text-dark rounded-2xl shadow-2xl p-5 sm:p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(symbol, exchange);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <label className="sr-only" htmlFor="stock-symbol">Stock symbol</label>
        <input
          id="stock-symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder={exchange === "IN" ? "NSE/BSE symbol, e.g. RELIANCE" : "US symbol, e.g. AAPL"}
          className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={20}
        />
        <div className="flex gap-2">
          <div role="group" aria-label="Market" className="flex rounded-lg border border-gray-300 overflow-hidden">
            {[["US", "🇺🇸 US"], ["IN", "🇮🇳 India"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setExchange(v); setResult(null); }}
                aria-pressed={exchange === v}
                className={`px-3 py-3 text-sm whitespace-nowrap ${exchange === v ? "bg-dark text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                {l}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !symbol.trim()}
            className="px-5 py-3 bg-primary text-white font-semibold rounded-lg hover:brightness-95 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Try:</span>
        {(QUICK_PICKS[exchange] || QUICK_PICKS.US).map((s) => (
          <button key={s} onClick={() => run(s, exchange)} disabled={loading}
            className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition">
            {s}
          </button>
        ))}
      </div>

      {gated && !limitHit && (
        <p className="mt-2 text-xs text-gray-500">{remaining} free check{remaining === 1 ? "" : "s"} left · no account needed</p>
      )}

      {loading && (
        <div className="mt-6 space-y-3" aria-live="polite">
          <p className="text-sm text-gray-600">Fetching live prices and financials, then running 5 scoring engines… (about 10 seconds)</p>
          {[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}. Check the symbol and exchange (e.g. RELIANCE on NSE, AAPL on US).
        </p>
      )}

      {limitHit && (
        <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-primary/10 to-ai-accent/10 text-center">
          <p className="font-semibold">You&apos;ve used your {FREE_CHECKS} free checks</p>
          <p className="mt-1 text-sm text-gray-600">
            Create a free account for unlimited stock checks, portfolio tracking and a full analysis by six AI agents.
          </p>
          <SignUpButton mode="modal">
            <button className="mt-4 px-5 py-2.5 bg-ai-accent text-white font-semibold rounded-lg hover:brightness-95 transition">
              Create free account
            </button>
          </SignUpButton>
        </div>
      )}

      {result && !loading && !limitHit && (
        <div className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold truncate">{result.name}</p>
              <p className="text-sm text-gray-500">{result.symbol} · {result.exchange}{result.sector && result.sector !== "default" ? ` · ${result.sector.replace(/_/g, " ")}` : ""}</p>
              <p className="mt-1 text-2xl font-bold">
                {money(result.price)}{" "}
                <span className={`text-sm font-medium ${result.change >= 0 ? "text-success" : "text-error"}`}>
                  {result.change >= 0 ? "+" : ""}{result.change.toFixed(2)} today
                </span>
              </p>
            </div>
            <div className="text-center shrink-0">
              <span className={`inline-block px-4 py-1.5 rounded-lg font-bold ${ACTION_STYLE[result.recommendation.action]}`}>
                {result.recommendation.action}
              </span>
              <p className="mt-1 text-xs text-gray-500">Score {result.recommendation.score}/100</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">1-year price history</p>
          <Sparkline points={result.priceHistory} />

          <ul className="mt-2 space-y-2.5">
            {PILLARS.map((p) => (
              <li key={p.key}>
                <div className="flex justify-between text-sm">
                  <span title={p.help}>{p.label}</span>
                  <span className="font-medium">{result.scores[p.key]}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${scoreColor(result.scores[p.key])}`} style={{ width: `${result.scores[p.key]}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{p.help}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {[
              ["Target", money(result.recommendation.targetPrice)],
              ["Stop-loss", money(result.recommendation.stopLoss)],
              ["Horizon", result.recommendation.investmentHorizon.toLowerCase()],
              ["Confidence", result.recommendation.confidence.toLowerCase()],
              ["Market cap", result.currency === "INR"
                ? `₹${Math.round((result.marketCap || 0) / 1e7).toLocaleString()} Cr`
                : `$${((result.marketCap || 0) / 1e9).toFixed(1)} B`],
              ["P/E", result.metrics.pe ? result.metrics.pe.toFixed(1) : "–"],
              ["P/B", result.metrics.pb ? result.metrics.pb.toFixed(2) : "–"],
              ["ROE", result.metrics.roe ? `${result.metrics.roe.toFixed(1)}%` : "–"],
              ["Dividend yield", result.metrics.dividendYield ? `${result.metrics.dividendYield.toFixed(2)}%` : "–"],
              ["Debt/Equity", result.metrics.debtToEquity ? result.metrics.debtToEquity.toFixed(2) : "–"],
              ["52-week low", money(result.fiftyTwoWeekLow)],
              ["52-week high", money(result.fiftyTwoWeekHigh)],
            ].map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium capitalize">{v}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Mechanical scores from live data, not investment advice. Ask Finora (chat, bottom right) to explain this result.
          </p>

          <StockDetails r={result} />
        </div>
      )}
    </div>
  );
}
