import { useEffect, useRef, useState } from "react";
import { SignUpButton, useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_URL, STOCKCHECK_URL } from "../lib/config";
import { LAST_CHECK_KEY } from "./StockCheck";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Signed-out visitors can ask a few questions before we ask them to sign up
const FREE_QUESTIONS = 5;

const PUBLIC_SUGGESTIONS = [
  "What can FinFreedom AI do for me?",
  "Explain my last stock check",
  "What is an index fund?",
  "How much should I invest for long-term growth?",
];

// Signed-in chat goes to /api/chat, which sees the user's portfolio and latest agent analysis
const PORTFOLIO_SUGGESTIONS = [
  "How is my portfolio doing?",
  "What did the agents find in my last analysis?",
  "Am I on track to retire?",
  "Which high growth picks fit my risk profile?",
];
const RUN_AGENTS = "🤖 Run all agents on my portfolio now";

export default function ChatWidget() {
  const { isSignedIn, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const asked = messages.filter((m) => m.role === "user").length;
  const limitHit = !isSignedIn && asked >= FREE_QUESTIONS;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Start a full multi-agent analysis (same as the Advisor Team button)
  const runAgents = async () => {
    setMessages((m) => [...m, { role: "user", content: RUN_AGENTS }]);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ analysis_type: "portfolio", options: {} }),
      });
      const data = await res.json();
      setMessages((m) => [...m, {
        role: "assistant",
        content: res.ok
          ? `Started! The Planner, Reporter, Charter, Retirement and High Growth agents are analyzing your portfolio (about a minute). Follow along on [Advisor Team](/advisor-team), then [see the results](/analysis?job_id=${data.job_id}). Ask me about it once it's done.`
          : data.detail || "Couldn't start the analysis.",
      }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't start the analysis. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async (text: string) => {
    if (text === RUN_AGENTS) return runAgents();
    if (!text.trim() || loading || limitHit) return;
    const next: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);

    let context = null;
    try {
      context = JSON.parse(sessionStorage.getItem(LAST_CHECK_KEY) || "null");
    } catch {
      /* no stock check yet */
    }

    try {
      let res: Response;
      if (isSignedIn) {
        const token = await getToken();
        res = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: next, context }),
        });
      } else {
        res = await fetch(`${STOCKCHECK_URL}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next, context }),
        });
      }
      const data = await res.json();
      const reply = res.ok ? data.reply : data.detail || data.error || "Sorry, something went wrong.";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "I couldn't reach the server. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Ask FinFreedom AI a question"}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-ai-accent text-white font-semibold shadow-xl hover:brightness-110 transition"
      >
        {open ? "✕" : "💬"} <span className="hidden sm:inline">{open ? "Close" : "Ask FinFreedom AI"}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ask FinFreedom AI"
          className="fixed z-50 bottom-20 right-4 left-4 sm:left-auto sm:w-96 h-[min(32rem,calc(100dvh-7rem))] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-3 bg-dark text-white">
            <p className="font-semibold">Ask FinFreedom AI</p>
            <p className="text-xs text-white/70">
              {isSignedIn ? "Connected to your portfolio and your agents' latest analysis" : "Investing questions, stock checks explained, how FinFreedom AI works"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-gray-600">
                  {isSignedIn
                    ? "Hi! I can see your accounts, holdings, FIRE plan and your agents' latest analysis. Ask me anything:"
                    : "Hi! I'm FinFreedom AI. Ask me anything about investing, or tap a suggestion:"}
                </p>
                {(isSignedIn ? [...PORTFOLIO_SUGGESTIONS, RUN_AGENTS] : PUBLIC_SUGGESTIONS).map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl ${m.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-800"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:mb-2 [&_p:last-child]:mb-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-gray-400" aria-live="polite">FinFreedom AI is typing…</div>}
            {limitHit && (
              <div className="p-3 rounded-xl bg-ai-accent/10 text-center">
                <p className="font-medium">Want to keep chatting?</p>
                <p className="text-xs text-gray-600 mt-1">Create a free account for unlimited questions and a full portfolio analysis.</p>
                <SignUpButton mode="modal">
                  <button className="mt-2 px-4 py-2 bg-ai-accent text-white rounded-lg font-medium">Sign up free</button>
                </SignUpButton>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-gray-100 flex gap-2"
          >
            <label className="sr-only" htmlFor="chat-input">Your question</label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitHit ? "Sign up to keep chatting" : "Type your question…"}
              disabled={limitHit}
              maxLength={1000}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-ai-accent disabled:bg-gray-50"
            />
            <button type="submit" disabled={loading || !input.trim() || limitHit}
              className="px-4 py-2 bg-ai-accent text-white rounded-lg font-medium disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
