"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";
import { fmtMonth, fmtMoney } from "@/lib/dates";

export default function PayrollPage() {
  const [role, setRole] = useState("");
  const [runs, setRuns] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  const load = () => api<{ runs: any[] }>("/api/payroll/runs").then((d) => setRuns(d.runs));
  useEffect(() => {
    api("/api/analytics").then((d) => setRole(d.role)).catch(() => {});
    load().catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <PageHeader title="Payroll" sub="Monthly runs, deductions and payslips" />
      <ErrorNote message={err} />
      {msg && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{msg}</p>}
      {role === "hr" && (
        <form className="card p-4 mb-5 flex flex-wrap gap-2 items-end max-w-xl" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr(""); setMsg("");
          try {
            const r = await post<{ payslips: number }>("/api/payroll/runs", { month });
            setMsg(`Draft ready for ${fmtMonth(month)} — ${r.payslips} payslip(s) computed from attendance and approved leave.`);
            load();
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
          setBusy(false);
        }}>
          <div><label className="label">Payroll month</label>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <button className="btn-primary" disabled={busy}>{busy ? "Computing…" : "Create / refresh draft"}</button>
        </form>
      )}
      {runs.length === 0 ? <Empty title="No payroll runs yet" sub={role === "hr" ? "Create the first draft above" : "HR creates payroll drafts here"} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Month</th><th className="th">Status</th><th className="th">Payslips</th><th className="th">Created</th><th className="th">Finalized</th><th className="th"></th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium text-slate-800">{fmtMonth(r.period_month)}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td">{r.payslips?.[0]?.count ?? 0}</td>
                  <td className="td text-xs text-slate-500">{r.created_at?.slice(0, 10)}</td>
                  <td className="td text-xs text-slate-500">{r.finalized_at?.slice(0, 10) ?? "—"}</td>
                  <td className="td"><Link className="text-indigo-600 text-sm hover:underline" href={`/payroll/${r.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
