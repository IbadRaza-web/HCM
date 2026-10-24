"use client";
import { useState, useRef, useEffect } from "react";

interface Msg { role: "user" | "assistant"; content: string; tools?: string[] }

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput(""); setError(""); setBusy(true);
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The assistant is unavailable right now.");
      setMessages((m) => [...m, { role: "assistant", content: data.answer, tools: data.tools }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="AI assistant"
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition flex items-center justify-center text-sm font-bold">
        {open ? "×" : "AI"}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[92vw] max-w-sm card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-indigo-600 text-white">
            <p className="text-sm font-semibold">AI Assistant</p>
            <p className="text-[11px] text-indigo-100">Answers from your real data · role-scoped</p>
          </div>
          <div className="h-80 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-xs text-slate-500 space-y-2 p-2">
                <p>Try asking:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Who is on leave today?", "How many employees do we have?", "Who came late most often this month?", "How many sick leaves do I have left?"].map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] text-indigo-700 hover:bg-indigo-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
                  {m.content}
                  {m.role === "assistant" && (
                    <span className="mt-1 block text-[10px] text-slate-400">
                      AI-generated{m.tools?.length ? ` · tools: ${m.tools.join(", ")}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400 px-2">Thinking…</div>}
            {error && <div className="text-xs text-red-500 px-2">{error}</div>}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 p-3 border-t border-slate-100">
            <input className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about attendance, leave, payroll…" maxLength={1000} />
            <button className="btn-primary px-3" disabled={busy || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
