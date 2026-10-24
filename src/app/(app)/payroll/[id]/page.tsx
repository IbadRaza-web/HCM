"use client";
import { use, useEffect, useState } from "react";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, StatusBadge } from "@/components/ui";
import { fmtMonth, fmtMoney } from "@/lib/dates";

export default function PayrunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [role, setRole] = useState("");
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");

  const load = () => api(`/api/payroll/runs/${id}`).then(setData);
  useEffect(() => {
    api("/api/analytics").then((d) => setRole(d.role)).catch(() => {});
    load().catch((e) => setErr(e.message));
  }, [id]);

  if (err && !data) return <ErrorNote message={err} />;
  if (!data) return <Spinner />;
  const run = data.run;
  const totals = data.payslips.reduce((a: any, p: any) => ({
    gross: a.gross + Number(p.gross), deduction: a.deduction + Number(p.deduction),
    tax: a.tax + Number(p.tax), net: a.net + Number(p.net),
  }), { gross: 0, deduction: 0, tax: 0, net: 0 });

  return (
    <div>
      <PageHeader title={`Payroll — ${fmtMonth(run.period_month)}`} sub="Draft amounts recompute on refresh; finalized runs are locked">
        <StatusBadge status={run.status} />
        {role === "admin" && run.status === "draft" && (
          <button className="btn-primary" onClick={async () => {
            setErr(""); setMsg("");
            try { await post(`/api/payroll/runs/${id}/finalize`); setMsg("Payroll finalized and locked. Employees were notified."); load(); }
            catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
          }}>Finalize (lock month)</button>
        )}
      </PageHeader>
      <ErrorNote message={err} />
      {msg && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">{msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Sum label="Total gross" v={totals.gross} />
        <Sum label="Deductions" v={totals.deduction} />
        <Sum label="Tax" v={totals.tax} />
        <Sum label="Total net" v={totals.net} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Employee</th><th className="th">Basic</th><th className="th">Gross</th>
            <th className="th">Eligible</th><th className="th">Absent/Unpaid/Half</th><th className="th">Deduction</th>
            <th className="th">Tax</th><th className="th">Net</th><th className="th">Payslip</th>
          </tr></thead>
          <tbody>
            {data.payslips.map((p: any) => (
              <tr key={p.id}>
                <td className="td font-medium text-slate-800">{p.employees?.full_name} <span className="text-xs text-slate-400">{p.employees?.employee_code}</span></td>
                <td className="td">{fmtMoney(Number(p.basic))}</td>
                <td className="td">{fmtMoney(Number(p.gross))}</td>
                <td className="td">{p.eligible_days}/{p.working_days}</td>
                <td className="td text-xs">{p.absent_days}/{p.unpaid_days}/{p.half_days}</td>
                <td className="td text-rose-600">-{fmtMoney(Number(p.deduction))}</td>
                <td className="td text-amber-600">-{fmtMoney(Number(p.tax))}</td>
                <td className="td font-bold text-emerald-700">{fmtMoney(Number(p.net))}</td>
                <td className="td"><a className="text-indigo-600 text-sm hover:underline" href={`/api/payslips/${p.id}/pdf`}>PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Formula: gross = 1.5 × basic · daily rate = gross ÷ working days · deduction = absent + unpaid + 0.5 × half days · tax = progressive annual slab (gross × 12) ÷ 12.
      </p>
    </div>
  );
}

function Sum({ label, v }: { label: string; v: number }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-800">{fmtMoney(v)}</p>
    </div>
  );
}
