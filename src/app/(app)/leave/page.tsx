"use client";
import { useEffect, useState } from "react";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/dates";

export default function LeavePage() {
  const [role, setRole] = useState<string>("");
  useEffect(() => { api("/api/analytics").then((d) => setRole(d.role)).catch(() => {}); }, []);
  if (!role) return <Spinner />;
  return (
    <div>
      {role === "employee" ? <EmployeeLeave /> : role === "hr" ? <HrInbox /> : <AllLeaves />}
    </div>
  );
}

function EmployeeLeave() {
  const [types, setTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [smart, setSmart] = useState(""); const [smartBusy, setSmartBusy] = useState(false);

  const load = () => Promise.all([
    api<{ leave_types: any[]; balances: any[] }>("/api/leave/types"),
    api<{ requests: any[] }>("/api/leave"),
  ]).then(([t, r]) => { setTypes(t.leave_types); setBalances(t.balances ?? []); setRequests(r.requests); });

  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function smartParse() {
    if (!smart.trim()) return;
    setSmartBusy(true); setErr("");
    try {
      const r = await post<any>("/api/ai/smart-leave", { text: smart });
      setF({ leave_type_id: r.leave_type_id, start_date: r.start_date, end_date: r.end_date, reason: r.reason });
      setMsg(`Understood: ${r.type_label}, ${r.start_date} → ${r.end_date}. Review and submit.`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not understand that"); }
    setSmartBusy(false);
  }

  return (
    <div>
      <PageHeader title="Leave" sub="Apply, cancel and track your leave" />
      <ErrorNote message={err} />
      {msg && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{msg}</p>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">✨ Smart leave — just type it</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. I need next Monday and Tuesday off for a wedding"
                value={smart} onChange={(e) => setSmart(e.target.value)} maxLength={300} />
              <button className="btn-ghost" disabled={smartBusy} onClick={smartParse}>{smartBusy ? "…" : "Parse"}</button>
            </div>
          </div>

          <form className="card p-4 space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setErr(""); setMsg("");
            try {
              const r = await post<{ working_days: number }>("/api/leave", f);
              setMsg(`Leave requested (${r.working_days} working day(s)). Pending HR approval.`);
              setF({ leave_type_id: "", start_date: "", end_date: "", reason: "" }); load();
            } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
            setBusy(false);
          }}>
            <p className="text-sm font-semibold text-slate-700">Leave application</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><label className="label">Type</label>
                <select className="input" required value={f.leave_type_id} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select></div>
              <div><label className="label">From</label>
                <input className="input" required type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
              <div><label className="label">To</label>
                <input className="input" required type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
            </div>
            <div><label className="label">Reason</label>
              <textarea className="input" required rows={2} minLength={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
          </form>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">My requests</p>
            {requests.length === 0 ? <Empty title="No leave requests yet" /> : (
              <div className="card divide-y divide-slate-100">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-700">{r.leave_types?.label} · {fmtDate(r.start_date)} → {fmtDate(r.end_date)}</p>
                      <p className="text-xs text-slate-500">{r.working_days} working day(s) · {r.reason}</p>
                      {r.decision_comment && <p className="text-xs text-slate-400">HR: {r.decision_comment}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.status === "pending" && (
                        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={async () => {
                          await post(`/api/leave/${r.id}/cancel`); load();
                        }}>Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-4 h-fit">
          <p className="text-sm font-semibold text-slate-700 mb-3">Balance ({new Date().getFullYear()})</p>
          {balances.length === 0 ? <p className="text-sm text-slate-400">No leave types configured.</p> : (
            <ul className="space-y-3">
              {balances.map((b) => (
                <li key={b.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-medium">{b.remaining == null ? "∞" : `${b.remaining} left`}</span>
                  </div>
                  {b.yearly_quota != null && (
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (b.used / b.yearly_quota) * 100)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function HrInbox() {
  const [pending, setPending] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [comment, setComment] = useState<Record<string, string>>({});
  const load = () => api<{ requests: any[] }>("/api/leave?status=pending").then((d) => setPending(d.requests));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    setErr("");
    try { await post(`/api/leave/${id}/decision`, { decision, comment: comment[id] || undefined }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      <PageHeader title="Leave approvals" sub="Pending requests awaiting your decision" />
      <ErrorNote message={err} />
      {pending.length === 0 ? <Empty title="No pending leave requests" /> : (
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{r.employees?.full_name} <span className="text-xs text-slate-400">{r.employees?.employee_code} · {r.employees?.departments?.name ?? "—"}</span></p>
                  <p className="text-sm text-slate-600">{r.leave_types?.label} · {fmtDate(r.start_date)} → {fmtDate(r.end_date)} ({r.working_days} working day(s))</p>
                  <p className="text-sm text-slate-500 mt-1">Reason: {r.reason}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <input className="input max-w-xs text-sm" placeholder="Comment (optional)"
                  value={comment[r.id] ?? ""} onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })} />
                <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" onClick={() => decide(r.id, "approved")}>Approve</button>
                <button className="btn-danger" onClick={() => decide(r.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AllLeaves title="All leave history" />
    </div>
  );
}

function AllLeaves({ title = "All leave requests" }: { title?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<{ requests: any[] }>("/api/leave").then((d) => setRows(d.requests)).catch(() => {}); }, []);
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-700 mb-2">{title}</p>
      {rows.length === 0 ? <Empty title="No leave records" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Employee</th><th className="th">Type</th><th className="th">Dates</th><th className="th">Days</th><th className="th">Status</th><th className="th">Comment</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium text-slate-800">{r.employees?.full_name ?? "—"}</td>
                  <td className="td">{r.leave_types?.label}</td>
                  <td className="td">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</td>
                  <td className="td">{r.working_days}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td text-xs text-slate-500">{r.decision_comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
