"use client";
import { useEffect, useState } from "react";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";
import { fmtMonth, fmtMoney } from "@/lib/dates";

/** Employee's own payslip list (scoped server-side to own employee_id). */
export default function PayslipsPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/payslips/mine").then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setRows(d.payslips);
    }).catch((e) => setErr(e.message));
  }, []);
  return (
    <div>
      <PageHeader title="My payslips" sub="Finalized and draft payslips assigned to you" />
      <ErrorNote message={err} />
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Empty title="No payslips yet" sub="Payslips appear after HR runs payroll and Admin finalizes it" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between px-4 py-3 gap-2">
              <div>
                <p className="font-medium text-slate-800">{fmtMonth(p.payroll_runs?.period_month)}</p>
                <p className="text-xs text-slate-500">Net {fmtMoney(Number(p.net))} · Gross {fmtMoney(Number(p.gross))} · Tax {fmtMoney(Number(p.tax))}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.payroll_runs?.status} />
                <a className="btn-ghost text-xs" href={`/api/payslips/${p.id}/pdf`}>Download PDF</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
