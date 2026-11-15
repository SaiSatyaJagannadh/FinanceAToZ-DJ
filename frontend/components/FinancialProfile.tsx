import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { API_URL } from "../lib/config";
import { showToast } from "./Toast";

export interface FireInputs {
  currentAge: number;
  annualExpenses: number;
  annualSavings: number;
  expectedReturn: number; // % per year, after inflation
  withdrawalRate: number; // % per year
}

export interface Profile {
  fire?: FireInputs & { fireNumber: number; yearsToFire: number | null; fireAge: number | null };
  risk_answers?: number[];
  risk_score?: number;
  risk_profile?: string;
  investor_type?: string;
}

const DEFAULT_FIRE: FireInputs = { currentAge: 30, annualExpenses: 50000, annualSavings: 20000, expectedReturn: 6, withdrawalRate: 4 };

const QUESTIONS: { q: string; options: string[] }[] = [
  { q: "When will you need most of this money?", options: ["Within 3 years", "3–7 years", "7–15 years", "15+ years"] },
  { q: "Your portfolio drops 25% in a month. What do you do?", options: ["Sell everything", "Sell some", "Hold and wait", "Buy more"] },
  { q: "What's your main investing goal?", options: ["Protect what I have", "Steady income", "Balanced growth", "Maximum growth"] },
  { q: "How much investing experience do you have?", options: ["None", "Some funds / ETFs", "I pick stocks regularly", "Active trading / options"] },
  { q: "How big is your emergency fund?", options: ["None", "Under 3 months", "3–6 months", "6+ months"] },
  { q: "How much of your yearly income could you lose without changing your lifestyle?", options: ["Under 5%", "5–10%", "10–25%", "Over 25%"] },
];

// [max score, profile, investor type, description, suggested equity %]
const PROFILES: [number, string, string, string, number][] = [
  [10, "Conservative", "Cautious Saver", "You value safety over growth. Losses would worry you, so keep most money in bonds and cash.", 30],
  [13, "Moderately Conservative", "Careful Planner", "You accept small ups and downs for modest growth, with a bond-heavy mix.", 45],
  [17, "Moderate", "Balanced Investor", "You're comfortable with market swings for long-term growth, with a balanced stock/bond mix.", 60],
  [21, "Aggressive", "Growth Seeker", "You chase long-term growth and can ride out big drops. Mostly stocks.", 80],
  [24, "Very Aggressive", "High-Risk Taker", "You aim for maximum growth and see crashes as buying chances. Nearly all stocks, incl. thematic bets.", 90],
];

export function assessRisk(answers: number[]) {
  const score = answers.reduce((s, a) => s + a + 1, 0);
  const [, profile, type, desc, equity] = PROFILES.find(([max]) => score <= max) || PROFILES[PROFILES.length - 1];
  return { score, profile, type, desc, equity };
}

export function calcFire(f: FireInputs, portfolioValue: number) {
  const fireNumber = f.annualExpenses / (f.withdrawalRate / 100);
  const r = f.expectedReturn / 100;
  let value = portfolioValue;
  let years: number | null = 0;
  while (value < fireNumber) {
    value = value * (1 + r) + f.annualSavings;
    years += 1;
    if (years > 70) {
      years = null;
      break;
    }
  }
  const coastNeededNow = fireNumber / Math.pow(1 + r, Math.max(0, 65 - f.currentAge));
  return {
    fireNumber,
    yearsToFire: years,
    fireAge: years === null ? null : f.currentAge + years,
    progress: Math.min(100, (portfolioValue / fireNumber) * 100),
    coastNeededNow,
  };
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

interface Props {
  profile: Profile | null | undefined;
  portfolioValue: number;
  onSaved: (user: Record<string, unknown>) => void;
}

export default function FinancialProfile({ profile, portfolioValue, onSaved }: Props) {
  const { getToken } = useAuth();
  const [fire, setFire] = useState<FireInputs>({ ...DEFAULT_FIRE, ...(profile?.fire || {}) });
  const [answers, setAnswers] = useState<(number | null)[]>(profile?.risk_answers || QUESTIONS.map(() => null));
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => calcFire(fire, portfolioValue), [fire, portfolioValue]);
  const complete = answers.every((a) => a !== null);
  const risk = complete ? assessRisk(answers as number[]) : null;

  const set = (k: keyof FireInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFire({ ...fire, [k]: Number(e.target.value) || 0 });

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        profile: {
          fire: { ...fire, fireNumber: result.fireNumber, yearsToFire: result.yearsToFire, fireAge: result.fireAge },
          ...(risk && {
            risk_answers: answers,
            risk_score: risk.score,
            risk_profile: risk.profile,
            investor_type: risk.type,
          }),
        },
        // The retirement and growth agents read these
        target_retirement_income: fire.annualExpenses,
        ...(result.yearsToFire !== null && { years_until_retirement: Math.min(50, result.yearsToFire) }),
        ...(risk && { asset_class_targets: { equity: risk.equity, fixed_income: 100 - risk.equity } }),
      };
      const res = await fetch(`${API_URL}/api/user`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      onSaved(await res.json());
      showToast("success", "Your FIRE plan and risk profile are saved. The AI agents will use them in your next analysis.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, k: keyof FireInputs, hint?: string) => (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type="number" value={fire[k]} onChange={set(k)} min={0}
        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      {/* FIRE calculator */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-dark">🔥 When can you retire? (FIRE)</h2>
        <p className="text-sm text-gray-500 mt-1">Financial Independence, Retire Early: how long until your investments cover your expenses.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Your age", "currentAge")}
          {field("Yearly expenses ($)", "annualExpenses", "What you spend per year")}
          {field("Yearly savings ($)", "annualSavings", "What you invest per year")}
          {field("Expected return (%)", "expectedReturn", "After inflation; 5–7% is typical")}
          {field("Withdrawal rate (%)", "withdrawalRate", "4% is the classic safe rate")}
          <div className="text-sm">
            <span className="font-medium text-gray-700">Invested today</span>
            <p className="mt-2 text-lg font-semibold">{money(portfolioValue)}</p>
            <span className="text-xs text-gray-400">From your accounts</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-primary/10">
            <p className="text-xs text-gray-500">FIRE number</p>
            <p className="font-bold text-primary">{money(result.fireNumber)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success/10">
            <p className="text-xs text-gray-500">Retire at age</p>
            <p className="font-bold text-success">{result.fireAge ?? "70+"}</p>
          </div>
          <div className="p-3 rounded-lg bg-ai-accent/10">
            <p className="text-xs text-gray-500">Years to go</p>
            <p className="font-bold text-ai-accent">{result.yearsToFire ?? "70+"}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500"><span>Progress to FIRE</span><span>{result.progress.toFixed(1)}%</span></div>
          <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-success" style={{ width: `${result.progress}%` }} /></div>
          <p className="mt-2 text-xs text-gray-500">
            Coast FIRE: with {money(result.coastNeededNow)} invested now you could stop saving and still reach your FIRE number by 65.
          </p>
        </div>
      </div>

      {/* Risk assessment */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-dark">🧭 What kind of investor are you?</h2>
        <p className="text-sm text-gray-500 mt-1">Six quick questions about how you behave with money. The agents tailor advice to your answer.</p>
        <ol className="mt-4 space-y-4">
          {QUESTIONS.map((item, qi) => (
            <li key={qi}>
              <p className="text-sm font-medium text-gray-700">{qi + 1}. {item.q}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {item.options.map((opt, oi) => (
                  <button key={oi} type="button"
                    onClick={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      answers[qi] === oi ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-300 hover:border-primary"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
        {risk ? (
          <div className="mt-5 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-ai-accent/10">
            <p className="text-xs text-gray-500">Your investor profile ({risk.score}/24)</p>
            <p className="text-lg font-bold text-dark">{risk.type} · {risk.profile}</p>
            <p className="text-sm text-gray-700 mt-1">{risk.desc}</p>
            <p className="text-sm mt-2">Suggested mix: <strong>{risk.equity}% stocks / {100 - risk.equity}% bonds</strong></p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-gray-400">Answer all six to see your profile.</p>
        )}
      </div>

      <div className="lg:col-span-2 flex items-center gap-4">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:brightness-95 disabled:opacity-50">
          {saving ? "Saving…" : "Save my FIRE plan & risk profile"}
        </button>
        <p className="text-xs text-gray-500">Also updates your retirement settings{risk ? " and target stock/bond mix" : ""} below.</p>
      </div>
    </div>
  );
}
