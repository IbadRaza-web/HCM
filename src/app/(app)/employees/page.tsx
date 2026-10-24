"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";
import { fmtMoney } from "@/lib/dates";

export default function EmployeesPage() {
  const [data, setData] = useState<{ rows: any[]; total: number; page: number; per: number } | null>(null);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [depts, setDepts] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [role, setRole] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvReport, setCsvReport] = useState<any>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  useEffect(() => { api<{ departments: any[] }>("/api/org/departments").then((d) => setDepts(d.departments)).catch(() => {}); }, []);
  useEffect(() => { api<{ role: string }>("/api/analytics").then((d) => setRole(d.role)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: "1" });
      if (search) params.set("search", search);
      if (dept) params.set("department_id", dept);
      if (status) params.set("status", status);
      api(`/api/employees?${params}`).then(setData).catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [search, dept, status]);

  function goPage(p: number) {
    const params = new URLSearchParams({ page: String(p) });
    if (search) params.set("search", search);
    if (dept) params.set("department_id", dept);
    if (status) params.set("status", status);
    api(`/api/employees?${params}`).then(setData).catch((e) => setErr(e.message));
  }

  async function runCsvImport(dry_run: boolean) {
    setCsvBusy(true); setErr("");
    try {
      const report = await post<any>("/api/employees/import", { csv: csvText, dry_run });
      setCsvReport(report);
      if (!dry_run) {
        const params = new URLSearchParams({ page: "1" });
        if (search) params.set("search", search);
        if (dept) params.set("department_id", dept);
        if (status) params.set("status", status);
        setData(await api(`/api/employees?${params}`));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "CSV import failed");
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Employee directory" sub={`${data?.total ?? "…"} employees`}>
        <a className="btn-ghost" href="/api/employees/export">Export CSV</a>
        {role === "hr" && <Link className="btn-primary" href="/employees/new">+ Register employee</Link>}
      </PageHeader>
      {role === "hr" && (
        <section className="card p-4 mb-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Import employees from CSV</h2>
            <p className="text-xs text-slate-500 mt-1">
              Required columns: code, name, email, department, join_date, basic_salary. Use Export CSV for a template.
            </p>
          </div>
          <input className="input max-w-md" type="file" accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setCsvReport(null);
              setCsvText(file ? await file.text() : "");
            }} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" disabled={!csvText || csvBusy}
              onClick={() => runCsvImport(true)}>{csvBusy ? "Checking…" : "Validate CSV"}</button>
            {csvReport?.dry_run && csvReport.valid > 0 && (
              <button className="btn-primary" disabled={csvBusy}
                onClick={() => runCsvImport(false)}>
                {csvBusy ? "Importing…" : `Import ${csvReport.valid} valid row(s)`}
              </button>
            )}
          </div>
          {csvReport && (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                {csvReport.dry_run
                  ? `Dry run: ${csvReport.valid} valid, ${csvReport.invalid} invalid of ${csvReport.total} row(s). No changes were made.`
                  : `Import complete: ${csvReport.imported} imported, ${csvReport.failed} failed.`}
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Status / errors</th><th className="px-3 py-2">Temporary password</th></tr></thead>
                  <tbody>{csvReport.rows.map((row: any) => (
                    <tr key={row.row} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2">{row.errors.length
                        ? row.errors.map((item: any) => `${item.field}: ${item.reason}`).join("; ")
                        : row.valid ? "Valid / imported" : "Not imported"}</td>
                      <td className="px-3 py-2 font-mono select-all">{row.temp_password ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {!csvReport.dry_run && csvReport.imported > 0 &&
                <p className="text-xs text-amber-700">Share the temporary passwords securely; employees must change them at first sign-in.</p>}
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="input max-w-xs" placeholder="Search name, code or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-[180px]" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input max-w-[150px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="exited">Exited</option>
        </select>
      </div>
      <ErrorNote message={err} />
      {!data ? <Spinner /> : data.rows.length === 0 ? (
        <Empty title="No employees found" sub="Register your first employee, or adjust the filters" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="th">Code</th><th className="th">Name</th><th className="th">Department</th>
                <th className="th">Designation</th><th className="th">Joined</th><th className="th">Basic salary</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {data.rows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="td font-mono text-xs">{e.employee_code}</td>
                    <td className="td">
                      <Link href={`/employees/${e.id}`} className="font-medium text-indigo-600 hover:underline">{e.full_name}</Link>
                      <p className="text-xs text-slate-400">{e.email}</p>
                    </td>
                    <td className="td">{e.departments?.name ?? "—"}</td>
                    <td className="td">{e.designations?.title ?? "—"}</td>
                    <td className="td">{e.join_date}</td>
                    <td className="td">{fmtMoney(Number(e.basic_salary))}</td>
                    <td className="td"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.per && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.ceil(data.total / data.per) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => goPage(p)}
                  className={`h-8 w-8 rounded-lg text-sm ${p === data.page ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
