"use client";
import { useEffect, useState } from "react";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge, Kpi } from "@/components/ui";
import { fmtTime, todayISO } from "@/lib/dates";

export default function AttendancePage() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => { api("/api/analytics").then((d) => setMe(d.role)).catch(() => {}); }, []);
  if (!me) return <Spinner />;
  return me === "employee" ? <MyAttendance /> : <AttendanceBoard />;
}

/** Admin/HR: daily attendance board. */
function AttendanceBoard() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    api(`/api/attendance?date=${date}`).then(setData).catch((e) => setErr(e.message));
  }, [date]);

  return (
    <div>
      <PageHeader title="Attendance board" sub="Daily records across the company">
        <input type="date" className="input max-w-[170px]" value={date} onChange={(e) => setDate(e.target.value)} />
      </PageHeader>
      <ErrorNote message={err} />
      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Kpi label="Present" value={data.totals.present} tone="emerald" />
            <Kpi label="Late" value={data.totals.late} tone="amber" />
            <Kpi label="Half day" value={data.totals.half_day} tone="amber" />
            <Kpi label="On leave" value={data.totals.on_leave} tone="slate" />
            <Kpi label="Absent" value={data.totals.absent} tone="rose" />
            <Kpi label="No checkout" value={data.totals.missing_checkout} tone="rose" />
          </div>
          {!data.working_day && (
            <p className="text-sm text-slate-500 bg-slate-100 rounded-lg px-3 py-2 mb-3">{date} is a weekend or public holiday.</p>
          )}
          {data.rows.length === 0 ? <Empty title="No active employees on this date" /> : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Employee</th><th className="th">Department</th><th className="th">In</th><th className="th">Out</th><th className="th">Hours</th><th className="th">Status</th><th className="th">Source</th></tr></thead>
                <tbody>
                  {data.rows.map((r: any) => (
                    <tr key={r.employee_id}>
                      <td className="td font-medium text-slate-800">{r.name} <span className="text-xs text-slate-400">{r.code}</span></td>
                      <td className="td">{r.department ?? "—"}</td>
                      <td className="td">{fmtTime(r.check_in_at)}</td>
                      <td className="td">{fmtTime(r.check_out_at)}</td>
                      <td className="td">{r.hours_worked ?? "—"}</td>
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td text-xs text-slate-400">{r.source ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Employee: own month calendar + correction requests. */
function MyAttendance() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [days, setDays] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [cf, setCf] = useState({ work_date: todayISO(), requested_check_in: "", requested_check_out: "", reason: "" });
  const [msg, setMsg] = useState("");

  const load = () => Promise.all([
    api<{ days: any[] }>(`/api/attendance?month=${month}`),
    api<{ corrections: any[] }>("/api/attendance/corrections"),
  ]).then(([a, c]) => { setDays(a.days); setCorrections(c.corrections); });

  useEffect(() => { load().catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, [month]);

  const color = (s: string) =>
    s === "present" ? "bg-emerald-500" : s === "late" ? "bg-amber-500" : s === "half_day" ? "bg-orange-400" :
    s === "missing_checkout" ? "bg-yellow-500" : s === "absent" ? "bg-rose-500" :
    s === "on_leave" ? "bg-sky-500" : s === "upcoming" ? "bg-slate-100 text-slate-400" : "bg-slate-200";

  return (
    <div>
      <PageHeader title="My attendance" sub="Your monthly calendar and correction requests">
        <input type="month" className="input max-w-[170px]" value={month} onChange={(e) => setMonth(e.target.value)} />
      </PageHeader>
      <ErrorNote message={err} />
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <button key={d.date} onClick={() => { setCf({ ...cf, work_date: d.date }); setShowForm(true); }}
              title={`${d.date}: ${d.status}${d.hours_worked ? ` (${d.hours_worked}h)` : ""}`}
              className={`aspect-square rounded-lg ${color(d.status)} flex flex-col items-center justify-center text-white transition hover:opacity-80`}>
              <span className="text-xs font-bold">{d.date.slice(8)}</span>
              {d.hours_worked && <span className="text-[9px]">{d.hours_worked}h</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Tap a day to request a correction.</p>
      </div>

      {showForm && (
        <form className="card p-4 mb-4 space-y-3 max-w-lg" onSubmit={async (e) => {
          e.preventDefault(); setErr(""); setMsg("");
          try {
            await post("/api/attendance/corrections", {
              ...cf,
              requested_check_in: cf.requested_check_in || null,
              requested_check_out: cf.requested_check_out || null,
            });
            setMsg("Correction request submitted for HR approval.");
            setShowForm(false); load();
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
        }}>
          <p className="text-sm font-semibold text-slate-700">Request correction for {cf.work_date}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Correct check-in</label>
              <input className="input" type="time" value={cf.requested_check_in} onChange={(e) => setCf({ ...cf, requested_check_in: e.target.value })} /></div>
            <div><label className="label">Correct check-out</label>
              <input className="input" type="time" value={cf.requested_check_out} onChange={(e) => setCf({ ...cf, requested_check_out: e.target.value })} /></div>
          </div>
          <div><label className="label">Reason *</label>
            <input className="input" required minLength={3} value={cf.reason} onChange={(e) => setCf({ ...cf, reason: e.target.value })} placeholder="e.g. Forgot to check out" /></div>
          <div className="flex gap-2">
            <button className="btn-primary">Submit request</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      {msg && <p className="text-sm text-emerald-600 mb-3">{msg}</p>}

      <p className="text-sm font-semibold text-slate-700 mb-2">My correction requests</p>
      {corrections.length === 0 ? <Empty title="No correction requests" /> : (
        <div className="card divide-y divide-slate-100 max-w-2xl">
          {corrections.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-700">{c.work_date}</p>
                <p className="text-xs text-slate-500">{c.reason}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
