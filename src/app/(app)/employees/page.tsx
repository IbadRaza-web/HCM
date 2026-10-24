"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";
import { fmtMoney } from "@/lib/dates";

export default function EmployeesPage() {
  const [data, setData] = useState<{ rows: any[]; total: number; page: number; per: number } | null>(null);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [depts, setDepts] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => { api<{ departments: any[] }>("/api/org/departments").then((d) => setDepts(d.departments)).catch(() => {}); }, []);
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

  return (
    <div>
      <PageHeader title="Employee directory" sub={`${data?.total ?? "…"} employees`}>
        <a className="btn-ghost" href="/api/employees/export">Export CSV</a>
        <Link className="btn-primary" href="/employees/new">+ Register employee</Link>
      </PageHeader>
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
