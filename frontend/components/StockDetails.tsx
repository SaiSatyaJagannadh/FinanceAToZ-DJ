/* eslint-disable @typescript-eslint/no-explicit-any */
// Full FinAI breakdown for a stock check: the tabs FinAI's Streamlit app shows, plus analysts and news.
import { useState } from "react";
import type { StockResult } from "./StockCheck";

const TABS = ["Projection", "Analysts & News", "Fundamentals", "Technicals", "Growth", "Conviction", "Risk", "Moat & Sector"] as const;
type Tab = (typeof TABS)[number];

const num = (v: any, d = 2) => {
  const n = typeof v === "object" && v !== null ? v.value : v;
  return typeof n === "number" && isFinite(n) ? n.toFixed(d) : "–";
};
const label = (s: string) => (s || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-50">
      <p className="text-xs text-gray-500">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b">{head.map((h) => <th key={h} className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100">{r.map((c, j) => <td key={j} className="py-2 pr-4 whitespace-nowrap">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StockDetails({ r }: { r: StockResult }) {
  const [tab, setTab] = useState<Tab>("Projection");
  const cur = r.currency === "INR" ? "₹" : "$";
  const money = (n: number) => `${cur}${Math.round(n ?? 0).toLocaleString()}`;
  const d: any = r.details || {};
  const f = d.fundamental || {}, t = d.technical || {}, g = d.growth || {}, mf = d.mutualFund || {}, rk = d.risk || {};

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${tab === x ? "bg-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {x}
          </button>
        ))}
      </div>

      <div className="mt-3 text-sm">
        {tab === "Projection" && (r.projection ? (
          <>
            <p className="text-gray-600 mb-2">If each growth rate holds (constant P/E), the price in…</p>
            <Table
              head={["Scenario", "Growth/yr", ...r.projection.years.map((y: number) => `${y}Y`)]}
              rows={r.projection.scenarios.map((s: any) => [s.label, `${s.growthPct > 0 ? "+" : ""}${s.growthPct}%`, ...s.prices.map(money)])}
            />
            <p className="mt-2 text-xs text-gray-400">Mechanical extrapolation of {money(r.projection.currentPrice)} today, not a forecast.</p>
          </>
        ) : <p className="text-gray-500">Not enough growth data to project a price path.</p>)}

        {tab === "Analysts & News" && (
          <div className="space-y-5">
            {r.analystRatings && (() => {
              const a = r.analystRatings;
              const total = a.strongBuy + a.buy + a.hold + a.sell + a.strongSell || 1;
              const seg: [string, number, string][] = [
                ["Strong buy", a.strongBuy, "bg-emerald-600"], ["Buy", a.buy, "bg-success"], ["Hold", a.hold, "bg-accent"],
                ["Sell", a.sell, "bg-orange-500"], ["Strong sell", a.strongSell, "bg-error"],
              ];
              return (
                <div>
                  <p className="font-medium">Analyst ratings ({total} analysts)</p>
                  <div className="mt-2 flex h-3 rounded-full overflow-hidden">
                    {seg.map(([k, v, c]) => v > 0 && <div key={k} className={c} style={{ width: `${(v / total) * 100}%` }} title={`${k}: ${v}`} />)}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{seg.map(([k, v]) => `${k} ${v}`).join(" · ")}</p>
                </div>
              );
            })()}
            {r.priceTargets?.mean && (
              <div className="grid grid-cols-3 gap-2">
                <Metric k="Low target" v={money(r.priceTargets.low)} />
                <Metric k="Mean target" v={money(r.priceTargets.mean)} />
                <Metric k="High target" v={money(r.priceTargets.high)} />
              </div>
            )}
            {(r.analystActions?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium mb-1">Recent analyst buy / sell calls</p>
                <Table head={["Date", "Firm", "Action", "Rating", "Target"]}
                  rows={(r.analystActions || []).map((x: any) => [x.date, x.firm, label(x.action === "up" ? "upgrade" : x.action === "down" ? "downgrade" : x.action === "main" ? "maintains" : x.action),
                    x.from && x.from !== x.to ? `${x.from} → ${x.to}` : x.to, x.priceTarget ? money(x.priceTarget) : "–"])} />
              </div>
            )}
            {(r.events?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium mb-1">Upcoming announcements</p>
                <ul className="space-y-1">{(r.events || []).map((e: any) => <li key={e.event} className="flex justify-between gap-4"><span className="text-gray-600">{e.event}</span><span className="font-medium">{e.date}</span></li>)}</ul>
              </div>
            )}
            <div>
              <p className="font-medium mb-1">Latest news</p>
              {r.news?.length ? (
                <ul className="space-y-3">
                  {r.news.map((n: any) => (
                    <li key={n.url}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{n.title}</a>
                      <p className="text-xs text-gray-400">{n.publisher} · {n.date}</p>
                      {n.summary && <p className="text-gray-600 text-xs mt-0.5">{n.summary}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-500">No recent news found.</p>}
            </div>
          </div>
        )}

        {tab === "Fundamentals" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric k="P/E" v={num(f.peRatio?.trailing ?? f.peRatio, 1)} />
              <Metric k="PEG" v={num(f.pegRatio)} />
              <Metric k="P/B" v={num(f.priceToBook)} />
              <Metric k="Debt/Equity" v={num(f.debtToEquity)} />
              <Metric k="ROE %" v={num(f.roe, 1)} />
              <Metric k="ROA %" v={num(f.roa, 1)} />
              <Metric k="Profit margin %" v={num(f.profitMargin, 1)} />
              <Metric k="Current ratio" v={num(f.currentRatio)} />
            </div>
            {f.industryComparison?.peRatio && (
              <p className="mt-3 text-gray-600">
                vs. {label(f.industryComparison.sector || "sector")}: P/E {num(f.industryComparison.peRatio.value, 1)} against a sector norm of{" "}
                {(f.industryComparison.peRatio.sectorRange || []).join("–")} ({label(f.industryComparison.peRatio.verdict || "")}).
              </p>
            )}
            {f.scores && <p className="mt-2 text-xs text-gray-500">Sub-scores: valuation {f.scores.valuation} · profitability {f.scores.profitability} · financial health {f.scores.financialHealth} · growth {f.scores.growth}</p>}
          </>
        )}

        {tab === "Technicals" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric k="RSI (14)" v={`${num(t.rsi, 1)} ${t.rsi?.signal ? `· ${label(t.rsi.signal)}` : ""}`} />
              <Metric k="MACD histogram" v={num(t.macd?.histogram)} />
              <Metric k="Trend" v={label(t.movingAverages?.trend || "neutral")} />
              <Metric k="Technical score" v={`${t.overallScore ?? "–"}/100`} />
              <Metric k="SMA 50" v={money(t.movingAverages?.sma50)} />
              <Metric k="SMA 200" v={money(t.movingAverages?.sma200)} />
              <Metric k="EMA 20" v={money(t.movingAverages?.ema20)} />
              <Metric k="EMA 50" v={money(t.movingAverages?.ema50)} />
            </div>
            {(t.supportResistance?.support?.length > 0 || t.supportResistance?.resistance?.length > 0) && (
              <p className="mt-3 text-gray-600">
                Support: {(t.supportResistance.support || []).slice(0, 3).map(money).join(", ") || "–"} · Resistance:{" "}
                {(t.supportResistance.resistance || []).slice(0, 3).map(money).join(", ") || "–"}
              </p>
            )}
          </>
        )}

        {tab === "Growth" && (
          <>
            <Table head={["Metric", "vs. last year", "vs. last quarter", "Trend"]}
              rows={[["revenueGrowth", "Revenue"], ["profitGrowth", "Profit"], ["epsGrowth", "EPS"], ["bookValueGrowth", "Book value"],
                ["dividendGrowth", "Dividend"], ["operatingProfitGrowth", "Operating profit"]]
                .map(([k, l]) => [l, `${num(g[k]?.yoy, 1)}%`, `${num(g[k]?.qoq, 1)}%`, label(g[k]?.trend || "–")])} />
            {g.quarterly?.sales?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">Last {g.quarterly.sales.length} quarters</p>
                <Table head={["Quarter", "Sales", "Net profit"]}
                  rows={g.quarterly.sales.map((s: number, i: number) => [g.quarterly.labels?.[i] || `Q${i + 1}`, s, g.quarterly.netProfit?.[i] ?? "–"])} />
              </div>
            )}
          </>
        )}

        {tab === "Conviction" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric k="Conviction score" v={`${mf.score ?? "–"}/100`} />
              <Metric k="Sentiment" v={label(mf.sentiment || "neutral")} />
              <Metric k="Holding percentile" v={`${mf.holdingPercentile ?? "–"}`} />
            </div>
            {r.shareholding && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Shareholding (%)</p>
                <Table head={Object.keys(r.shareholding).map(label)} rows={[Object.values(r.shareholding).map((v: any) => num(v, 1))]} />
              </div>
            )}
            {mf.topHolders?.length > 0 && (
              <div className="mt-3">
                <Table head={["Holder", "Holding %", "QoQ change"]}
                  rows={mf.topHolders.map((h: any) => [h.fundName, num(h.holdingPercentage, 2), num(h.changeLastQuarter, 2)])} />
              </div>
            )}
          </>
        )}

        {tab === "Risk" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Metric k="Risk category" v={label(rk.riskCategory || "moderate")} />
            <Metric k="Beta" v={num(rk.marketRisk?.beta)} />
            <Metric k="Volatility %" v={num(rk.marketRisk?.volatility, 1)} />
            <Metric k="Safety score" v={`${rk.overallScore ?? "–"}/100`} />
            <Metric k="Debt/Equity" v={num(rk.creditRisk?.debtToEquity)} />
            <Metric k="Current ratio" v={num(rk.creditRisk?.currentRatio)} />
            <Metric k="Geopolitical risk" v={`${rk.geopoliticalRisk?.score ?? "–"}`} />
            <Metric k="Disruption risk" v={`${rk.disruptionRisk?.score ?? "–"}`} />
          </div>
        )}

        {tab === "Moat & Sector" && (
          <div className="space-y-4">
            {r.moat && (
              <div>
                <p className="font-medium">Economic moat: {r.moat.verdict} ({r.moat.passed}/{r.moat.total} checks)</p>
                <ul className="mt-1 space-y-1">
                  {r.moat.checks.map((c: any) => <li key={c.text} className="flex gap-2"><span>{c.pass ? "✅" : "❌"}</span><span className="text-gray-700">{c.text}</span></li>)}
                </ul>
              </div>
            )}
            {r.sectorOutlook && (
              <p className="text-gray-700">
                <strong>{label(r.sectorOutlook.sector)}</strong> sector is expected to grow {r.sectorOutlook.cagr} a year, driven by {r.sectorOutlook.driver}.{" "}
                <a href={r.sectorOutlook.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Source</a>
              </p>
            )}
            {r.sources && (
              <div>
                <p className="font-medium mb-1">Research it yourself</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(r.sources).map(([k, url]) => (
                    <a key={k} href={url as string} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs">{k} ↗</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
