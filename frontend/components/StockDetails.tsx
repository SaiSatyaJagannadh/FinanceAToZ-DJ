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
  const isUS = r.currency !== "INR";
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
            {(() => {
              const base = r.projection.scenarios[0];
              return (
                <>
                  <p className="text-gray-700 mb-2">
                    If growth averages <strong>{base.growthPct > 0 ? "+" : ""}{base.growthPct}%/yr</strong> (base case),{" "}
                    {money(r.projection.currentPrice)} becomes:
                  </p>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[1, 3, 5, 10].map((y) => {
                      const p = r.projection.currentPrice * Math.pow(1 + base.growthPct / 100, y);
                      return <Metric key={y} k={`In ${y} year${y > 1 ? "s" : ""}`} v={`${money(p)} (${((p / r.projection.currentPrice - 1) * 100).toFixed(0)}%)`} />;
                    })}
                  </div>
                </>
              );
            })()}
            <p className="text-gray-600 mb-2">Each scenario, year by year: if this growth rate holds, what&apos;s the price?</p>
            <Table
              head={["Scenario", "Growth/yr", ...r.projection.years.map((y: number) => `${y}Y`), "Source"]}
              rows={r.projection.scenarios.map((s: any) => [s.label, `${s.growthPct > 0 ? "+" : ""}${s.growthPct}%`, ...s.prices.map(money), s.source])}
            />
            {r.projection.scenarios.some((s: any) => s.growthPct < 0) && (
              <p className="mt-2 text-xs text-gray-500">⚠️ A negative growth row projects a declining price.</p>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-primary text-sm">What each scenario means</summary>
              <ul className="mt-2 list-disc ml-5 space-y-1 text-gray-600">
                {r.projection.scenarios.map((s: any) => <li key={s.label}><strong>{s.label}</strong> ({s.growthPct}%/yr): {s.why}</li>)}
              </ul>
            </details>
            {g.projections?.eps?.current ? (
              <p className="mt-2 text-xs text-gray-500">
                EPS path: {num(g.projections.eps.current)} now → {num(g.projections.eps.projected1Y)} in 1Y → {num(g.projections.eps.projected2Y)} in 2Y
                at {num(g.projections.eps.cagr, 1)}% CAGR.
              </p>
            ) : null}
            <details className="mt-2">
              <summary className="cursor-pointer text-primary text-sm">How these numbers are estimated</summary>
              <ul className="mt-2 list-disc ml-5 space-y-1 text-gray-600">
                <li>Projected price = current price × (1 + growth)^years, assuming the P/E multiple stays constant.</li>
                <li>Required growth for any target = (target / current)^(1/years) − 1.</li>
                <li>Growth drivers come from Screener.in (Indian filings), Yahoo Finance analyst targets and EPS estimates (US).</li>
              </ul>
            </details>
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
            {f.industryComparison && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">How it stacks up vs. the {label(f.industryComparison.sector || "sector")} sector</p>
                <Table head={["Metric", "This stock", "Sector norm", "Verdict"]} rows={[
                  ["P/E", num(f.industryComparison.peRatio?.value, 1), (f.industryComparison.peRatio?.sectorRange || []).join("–") || "–", label(f.industryComparison.peRatio?.verdict || "")],
                  ["PEG", num(f.industryComparison.pegRatio?.value), `≤ ${f.industryComparison.pegRatio?.sectorTarget ?? "–"}`, ""],
                  ["Debt/Equity", num(f.industryComparison.debtToEquity?.value), `≤ ${f.industryComparison.debtToEquity?.sectorMax ?? "–"}`, label(f.industryComparison.debtToEquity?.verdict || "")],
                ]} />
              </div>
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
                <Table head={["Quarter", "Sales", "Net profit", "OPM %"]}
                  rows={g.quarterly.sales.map((s: number, i: number) => [g.quarterly.labels?.[i] || `Q${i + 1}`, s, g.quarterly.netProfit?.[i] ?? "–", g.quarterly.opm?.[i] ?? "–"])} />
                {(g.quarterly.warnings || []).map((w: string) => <p key={w} className="mt-2 text-xs text-orange-600">⚠️ {w}</p>)}
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
            {r.shareholding && (() => {
              // US data maps insiders/funds/institutions onto FinAI's Indian categories; show US names
              const names: Record<string, string> = isUS
                ? { promoter: "Insiders", mf: "Top 10 mutual funds", dii: "Other institutions", others: "Public / retail" }
                : { promoter: "Promoters", fii: "FIIs", dii: "DIIs", mf: "Mutual funds", others: "Public / others" };
              const entries = Object.entries(r.shareholding).filter(([k, v]) => names[k] && (v || !isUS));
              return (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">
                    Who owns it (%){isUS && r.institutionsCount ? ` · ${r.institutionsCount.toLocaleString()} institutions hold shares` : ""}
                  </p>
                  <Table head={entries.map(([k]) => names[k])} rows={[entries.map(([, v]) => num(v, 1))]} />
                </div>
              );
            })()}
            {isUS && (r.holders?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Largest holders and their latest change</p>
                <Table head={["Holder", "Type", "Holding %", "Change", "Reported"]}
                  rows={(r.holders || []).slice(0, 10).map((h: any) => [h.holder, h.type, num(h.pctHeld, 2), `${h.pctChange > 0 ? "+" : ""}${num(h.pctChange, 2)}%`, h.reported])} />
              </div>
            )}
            {!isUS && mf.topHolders?.length > 0 && (
              <div className="mt-3">
                <Table head={["Holder", "Holding %", "QoQ change"]}
                  rows={mf.topHolders.map((h: any) => [h.fundName, num(h.holdingPercentage, 2), num(h.changeLastQuarter, 2)])} />
              </div>
            )}
            {mf.totalFundsHolding ? (
              <p className="mt-2 text-xs text-gray-500">
                {mf.totalFundsHolding} of {mf.totalFundsAnalyzed ?? 0} tracked holders own this stock · average holding {num(mf.averageHoldingPercentage, 1)}%
              </p>
            ) : null}
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
                <p className="mt-2 p-3 rounded-lg bg-primary/5 text-gray-700">
                  {r.moat.verdict === "WIDE" ? "Wide moat: most quality markers present." : r.moat.verdict === "NARROW" ? "Narrow moat: some durable advantages, not dominant." : "No clear moat: profits look competitive or cyclical."}{" "}
                  Numbers show the moat&apos;s effect; read the annual report (links below) for its cause: brand, network effects, switching costs, cost advantage or regulation.
                </p>
              </div>
            )}
            {r.sectorOutlook && (
              <p className="text-gray-700">
                <strong>{label(r.sectorOutlook.sector)}</strong> sector is expected to grow {r.sectorOutlook.cagr} a year, driven by {r.sectorOutlook.driver}.{" "}
                <a href={r.sectorOutlook.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Source</a>
              </p>
            )}
            <div>
              <p className="font-medium mb-1">How analysts actually analyze this stock</p>
              <ul className="list-disc ml-5 space-y-1 text-gray-600">
                <li><strong>Valuation</strong>: P/E and PEG vs. the sector range (Fundamentals tab), plus discounted cash flow for a fair value.</li>
                <li><strong>Quality</strong>: ROE/ROCE and margins sustained over years, not one good quarter.</li>
                <li><strong>Growth</strong>: revenue/EPS trajectory and management guidance (Growth and Projection tabs).</li>
                <li><strong>Ownership flows</strong>: promoter/FII/DII/fund stake changes each quarter (Conviction tab).</li>
                <li><strong>Technicals</strong>: RSI, MACD and moving-average trend for entry timing (Technicals tab).</li>
                <li><strong>Risk</strong>: beta, leverage and volatility to size the downside (Risk tab).</li>
              </ul>
              <p className="mt-1 text-xs text-gray-500">The score weights these as fundamental 25% · growth 25% · technical 20% · conviction 15% · risk 15%.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Primary documents &amp; deeper research</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries({
                  ...(r.currency === "INR"
                    ? {
                        "Annual reports, concalls & ratings (Screener.in)": `https://www.screener.in/company/${r.symbol}/consolidated/#documents`,
                        "Exchange filings (NSE)": `https://www.nseindia.com/get-quotes/equity?symbol=${r.symbol}`,
                        "Google Finance": `https://www.google.com/finance/quote/${r.symbol}:${r.exchange === "BSE" ? "BOM" : "NSE"}`,
                      }
                    : {
                        "SEC 10-K annual reports (EDGAR)": `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${r.symbol}&type=10-K&dateb=&owner=include&count=10`,
                        "FinViz snapshot & analyst ratings": `https://finviz.com/quote.ashx?t=${r.symbol}`,
                        "Financial statements (stockanalysis.com)": `https://stockanalysis.com/stocks/${r.symbol.toLowerCase()}/financials/`,
                      }),
                  ...(r.sources || {}),
                }).map(([k, url]) => (
                  <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs">{k} ↗</a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
