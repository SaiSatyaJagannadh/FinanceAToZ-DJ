import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Head from "next/head";
import StockCheck from "../components/StockCheck";

const features = [
  {
    icon: "🔎",
    title: "Check any stock in seconds",
    desc: "Type a US or Indian stock by name or ticker. FinFreedom AI pulls live prices and financials, scores five pillars and gives a BUY / HOLD / SELL call with a target price.",
    free: true,
  },
  {
    icon: "💬",
    title: "Ask FinFreedom AI anything",
    desc: "A chat assistant that explains your stock check, investing terms and what to look at next, in plain language.",
    free: true,
  },
  {
    icon: "📊",
    title: "Full portfolio analysis",
    desc: "Add your accounts and six AI agents review your holdings: a written report, charts, a retirement projection and growth ideas.",
    free: false,
  },
];

const agents = [
  { name: "Financial Planner", role: "Orchestrator", color: "bg-ai-accent", desc: "Reads your portfolio and decides which specialists to call." },
  { name: "Portfolio Analyst", role: "Reporter", color: "bg-primary", desc: "Writes a clear report on holdings, diversification, fees and risk." },
  { name: "Chart Specialist", role: "Charter", color: "bg-success", desc: "Charts your allocation by asset class, region and sector." },
  { name: "Retirement Planner", role: "Retirement", color: "bg-accent", desc: "Monte Carlo simulations to test whether you're on track." },
  { name: "High Growth Scout", role: "Growth", color: "bg-emerald-600", desc: "Suggests long-term funds and stocks in trending growth themes." },
  { name: "Instrument Tagger", role: "Tagger", color: "bg-gray-500", desc: "Classifies new ETFs and stocks so every analysis is accurate." },
];

const steps = [
  { n: "01", title: "Try a free stock check", desc: "No account needed. See the five-pillar score for any stock." },
  { n: "02", title: "Sign up and add your accounts", desc: "Enter the ETFs and stocks you hold in each account. Takes two minutes." },
  { n: "03", title: "Run your AI analysis", desc: "Six agents work in parallel and deliver a report, charts, retirement and growth plan in about a minute." },
];

const compare: [string, boolean, boolean][] = [
  ["Stock checks (5-pillar score + BUY/HOLD/SELL)", true, true],
  ["Ask FinFreedom AI chat assistant", true, true],
  ["Unlimited checks and questions", false, true],
  ["Track your accounts and positions", false, true],
  ["Portfolio report, charts and retirement projection", false, true],
  ["High Growth long-term fund and stock ideas", false, true],
  ["FIRE calculator and investor risk profile", false, true],
  ["Chat that knows your portfolio and agent results", false, true],
  ["Research each holding: when to buy, hold or exit", false, true],
];

export default function Home() {
  return (
    <>
      <Head>
        <title>FinFreedom AI - Free stock checks and AI portfolio analysis</title>
        <meta name="description" content="Check any stock free in seconds, then let six AI agents analyze your whole portfolio: report, charts, retirement projection and long-term growth ideas." />
      </Head>
      <div className="min-h-screen bg-white text-dark">
        {/* Hero with the free stock check */}
        <header className="relative overflow-hidden bg-dark text-white">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#209DD7_0,transparent_45%),radial-gradient(circle_at_85%_30%,#753991_0,transparent_40%)]" />
          <nav className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 flex justify-between items-center">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="w-8 h-8 rounded-lg bg-primary grid place-items-center font-bold">F</span>
              FinFreedom AI
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <a href="#features" className="hidden md:inline px-3 py-2 text-sm text-white/80 hover:text-white">Features</a>
              <a href="#pricing" className="hidden md:inline px-3 py-2 text-sm text-white/80 hover:text-white">Free vs account</a>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="px-3 sm:px-4 py-2 text-sm text-white/80 hover:text-white transition">Sign in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-3 sm:px-4 py-2 text-sm bg-white text-dark font-medium rounded-lg hover:bg-white/90 transition">Sign up free</button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link href="/dashboard" className="px-4 py-2 text-sm bg-white text-dark font-medium rounded-lg hover:bg-white/90 transition">
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </div>
          </nav>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16 grid lg:grid-cols-2 gap-10 items-start">
            <div className="lg:pt-8">
              <p className="inline-block mb-5 px-3 py-1 text-xs font-medium rounded-full bg-white/10 text-white/80">
                Free to try · US and Indian stocks
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
                Know what to do with a stock <span className="text-accent">in seconds</span>
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-xl">
                FinFreedom AI scores any stock on fundamentals, growth, technicals, institutional conviction and safety, then tells you
                BUY, HOLD or SELL. Sign up and six AI agents analyze your whole portfolio.
              </p>
              <ul className="mt-6 space-y-2 text-white/85">
                {["Try 3 stock checks free, no account", "Ask the AI chat to explain any result", "Free account unlocks your full portfolio analysis"].map((t) => (
                  <li key={t} className="flex gap-2"><span className="text-accent">✓</span>{t}</li>
                ))}
              </ul>
              <Show when="signed-in">
                <Link href="/dashboard" className="mt-8 inline-block px-6 py-3 bg-accent text-dark font-semibold rounded-lg hover:brightness-95 transition">
                  Go to your dashboard
                </Link>
              </Show>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-white/80">Free stock check: type a company name or symbol and press Check</p>
              <Show when="signed-out"><StockCheck gated /></Show>
              <Show when="signed-in"><StockCheck /></Show>
            </div>
          </div>
        </header>

        {/* What FinFreedom AI does */}
        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight">What FinFreedom AI does</h2>
          <p className="mt-3 text-gray-600 max-w-2xl">Start free, no signup. Create an account when you want FinFreedom AI to look at your whole portfolio.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>{f.icon}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${f.free ? "bg-success/10 text-success" : "bg-ai-accent/10 text-ai-accent"}`}>
                    {f.free ? "Free, no signup" : "Free account"}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Agents */}
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight">Your AI advisory team</h2>
            <p className="mt-3 text-gray-600 max-w-2xl">Six agents, each with one job. The planner coordinates them and combines their work into one analysis.</p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.map((a) => (
                <div key={a.name} className="p-6 rounded-xl bg-white border border-gray-200">
                  <span className={`block w-10 h-1.5 rounded-full ${a.color}`} />
                  <h3 className="mt-5 font-semibold">{a.name}</h3>
                  <p className="text-xs uppercase tracking-wide text-gray-400 mt-1">{a.role}</p>
                  <p className="mt-3 text-sm text-gray-600">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.n}>
                <p className="text-sm font-mono text-primary">{s.n}</p>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Free vs account */}
        <section id="pricing" className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight text-center">Try free, then unlock everything</h2>
            <p className="mt-3 text-gray-600 text-center">Accounts are free. Sign up with email or Google.</p>
            <div className="mt-10 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 font-medium text-gray-500">Feature</th>
                    <th className="p-4 font-semibold whitespace-nowrap">No account</th>
                    <th className="p-4 font-semibold whitespace-nowrap text-ai-accent">Free account</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(([label, free, account]) => (
                    <tr key={label} className="border-b border-gray-100 last:border-0">
                      <td className="p-4">{label}</td>
                      <td className="p-4 text-center">{free ? <span className="text-success">✓</span> : <span className="text-gray-300">–</span>}</td>
                      <td className="p-4 text-center">{account ? <span className="text-success">✓</span> : <span className="text-gray-300">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="rounded-2xl bg-gradient-to-r from-primary to-ai-accent p-8 sm:p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">See what your whole portfolio is telling you</h2>
              <p className="mt-2 text-white/80">Free account. Add an account and run your first AI analysis in minutes.</p>
            </div>
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="px-6 py-3 bg-white text-dark font-semibold rounded-lg hover:bg-white/90 transition whitespace-nowrap">Create free account</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="px-6 py-3 bg-white text-dark font-semibold rounded-lg hover:bg-white/90 transition whitespace-nowrap">
                Open dashboard
              </Link>
            </Show>
          </div>
        </section>

        <footer className="border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24 text-sm text-gray-500 space-y-2">
            <p>© 2025 FinFreedom AI. Stock scoring engines from FinAI.</p>
            <p>
              This AI-generated advice has not been vetted by a qualified financial advisor and should not be used for trading decisions.
              For informational purposes only.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
