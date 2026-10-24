"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    admin_name: "",
    email: "",
    password: "",
    office_start: "09:00",
    grace_minutes: 15,
    office_lat: "",
    office_lng: "",
    seed_leave_types: true,
  });
  const [weekend, setWeekend] = useState<number[]>([6, 0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) =>
    setWeekend((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        office_lat: form.office_lat ? Number(form.office_lat) : null,
        office_lng: form.office_lng ? Number(form.office_lng) : null,
        weekend_days: weekend,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Setup failed");
      setBusy(false);
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Company name</label>
          <input className="input" required minLength={2} value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)} placeholder="Saylani Technologies" />
        </div>
        <div>
          <label className="label">Admin full name</label>
          <input className="input" required value={form.admin_name}
            onChange={(e) => set("admin_name", e.target.value)} placeholder="Admin name" />
        </div>
        <div>
          <label className="label">Admin email (login)</label>
          <input className="input" required type="email" value={form.email}
            onChange={(e) => set("email", e.target.value)} placeholder="admin@company.com" />
        </div>
        <div>
          <label className="label">Admin password (min 8 chars)</label>
          <input className="input" required type="password" minLength={8} value={form.password}
            onChange={(e) => set("password", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Office start</label>
            <input className="input" type="time" value={form.office_start}
              onChange={(e) => set("office_start", e.target.value)} />
          </div>
          <div>
            <label className="label">Grace (min)</label>
            <input className="input" type="number" min={0} max={240} value={form.grace_minutes}
              onChange={(e) => set("grace_minutes", Number(e.target.value))} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Weekend days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d, i) => (
              <button type="button" key={d} onClick={() => toggleDay(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  weekend.includes(i)
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Office latitude (optional)</label>
          <input className="input" value={form.office_lat} onChange={(e) => set("office_lat", e.target.value)}
            placeholder="24.8607" />
        </div>
        <div>
          <label className="label">Office longitude (optional)</label>
          <input className="input" value={form.office_lng} onChange={(e) => set("office_lng", e.target.value)}
            placeholder="67.0011" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.seed_leave_types}
          onChange={(e) => set("seed_leave_types", e.target.checked)} className="rounded" />
        Create standard leave types (Annual 14, Sick 8, Casual 10, Unlimited unpaid)
      </label>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create company & Admin"}</button>
    </form>
  );
}
