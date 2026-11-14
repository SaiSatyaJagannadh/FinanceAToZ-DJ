import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Head from "next/head";

const agents = [
  { name: "Financial Planner", role: "Orchestrator", color: "bg-ai-accent", desc: "Reads your portfolio, decides which specialists to call, and assembles the final picture." },
  { name: "Portfolio Analyst", role: "Reporter", color: "bg-primary", desc: "Writes a clear report on holdings, diversification, fees and risk." },
  { name: "Chart Specialist", role: "Charter", color: "bg-success", desc: "Turns allocations by asset class, region and sector into charts." },
  { name: "Retirement Planner", role: "Retirement", color: "bg-accent", desc: "Runs Monte Carlo simulations to test if you're on track for your goal." },
];

const steps = [
  { n: "01", title: "Add your accounts", desc: "Enter the ETFs and stocks you hold in each account." },
  { n: "02", title: "Run an analysis", desc: "The planner tags new instruments, refreshes prices and briefs the team." },
  { n: "03", title: "Read the results", desc: "A written report, charts and a retirement projection, in about a minute." },
];

const allocation = [
  { label: "US equity", pct: 48, color: "bg-primary" },
  { label: "International", pct: 22, color: "bg-ai-accent" },
  { label: "Bonds", pct: 20, color: "bg-accent" },
  { label: "Cash", pct: 10, color: "bg-success" },
];

const primaryBtn = "px-6 py-3 bg-accent text-dark font-semibold rounded-lg hover:brightness-95 transition";

export default function Home() {
  return (
    <>
      <Head>
        <title>Alex AI Financial Advisor - Intelligent Portfolio Management</title>
      </Head>
      <div className="min-h-screen bg-white text-dark">
        {/* Hero */}
        <header className="relative overflow-hidden bg-dark text-white">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#209DD7_0,transparent_45%),radial-gradient(circle_at_85%_30%,#753991_0,transparent_40%)]" />
          <nav className="relative max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span className="w-8 h-8 rounded-lg bg-primary grid place-items-center font-bold">A</span>
              Alex
            </div>
            <div className="flex items-center gap-3">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm text-white/80 hover:text-white transition">Sign in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 text-sm bg-white text-dark font-medium rounded-lg hover:bg-white/90 transition">Get started</button>
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

          <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-20 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="inline-block mb-5 px-3 py-1 text-xs font-medium rounded-full bg-white/10 text-white/80">
                Five AI agents · one portfolio review
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
                A team of AI analysts for your <span className="text-accent">investments</span>
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-xl">
                Alex reviews your holdings, charts your allocation and projects your retirement, with specialist agents working in parallel.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Show when="signed-out">
                  <SignUpButton mode="modal">
                    <button className={primaryBtn}>Start your analysis</button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <Link href="/dashboard" className={primaryBtn}>Open dashboard</Link>
                </Show>
                <a href="#how" className="px-6 py-3 rounded-lg border border-white/25 text-white/90 hover:bg-white/10 transition">
                  How it works
                </a>
              </div>
            </div>

            {/* Product preview */}
            <div className="bg-white text-dark rounded-2xl shadow-2xl p-6">
              <div className="flex justify-between items-baseline">
                <p className="text-sm text-gray-500">Portfolio value</p>
                <p className="text-xs font-medium text-success">Analysis complete</p>
              </div>
              <p className="text-3xl font-bold mt-1">$248,310</p>
              <div className="mt-6 flex h-3 rounded-full overflow-hidden">
                {allocation.map((a) => (
                  <div key={a.label} className={a.color} style={{ width: `${a.pct}%` }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {allocation.map((a) => (
                  <li key={a.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${a.color}`} />
                    <span className="text-gray-600">{a.label}</span>
                    <span className="ml-auto font-medium">{a.pct}%</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 p-4 rounded-xl bg-gray-50">
                <p className="text-xs text-gray-500">Retirement readiness</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-ai-accent" style={{ width: "78%" }} />
                  </div>
                  <span className="text-sm font-semibold">78%</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">Example data</p>
            </div>
          </div>
        </header>

        {/* Agents */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Meet your advisory team</h2>
          <p className="mt-3 text-gray-600 max-w-2xl">Each agent has one job. The planner coordinates them and combines their work.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {agents.map((a) => (
              <div key={a.name} className="p-6 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition">
                <span className={`block w-10 h-1.5 rounded-full ${a.color}`} />
                <h3 className="mt-5 font-semibold">{a.name}</h3>
                <p className="text-xs uppercase tracking-wide text-gray-400 mt-1">{a.role}</p>
                <p className="mt-3 text-sm text-gray-600">{a.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-20">
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
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="rounded-2xl bg-gradient-to-r from-primary to-ai-accent p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold">See what your portfolio is telling you</h2>
              <p className="mt-2 text-white/80">Free to try. Add an account and run your first analysis.</p>
            </div>
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="px-6 py-3 bg-white text-dark font-semibold rounded-lg hover:bg-white/90 transition">Get started</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" className="px-6 py-3 bg-white text-dark font-semibold rounded-lg hover:bg-white/90 transition">
                Open dashboard
              </Link>
            </Show>
          </div>
        </section>

        <footer className="border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-500 space-y-2">
            <p>© 2025 Alex AI Financial Advisor.</p>
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
