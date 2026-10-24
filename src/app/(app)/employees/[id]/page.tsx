"use client";
import { use, useEffect, useState } from "react";
import { api, put } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, StatusBadge } from "@/components/ui";
import { fmtMoney, fmtDate } from "@/lib/dates";

export default function Employee360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [depts, setDepts] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => api(`/api/employees/${id}`).then((d: any) => {
    setData(d);
    setForm({
      full_name: d.employee.full_name, phone: d.employee.phone, address: d.employee.address,
      department_id: d.employee.department_id ?? "", designation_id: d.employee.designation_id ?? "",
      basic_salary: String(d.employee.basic_salary), status: d.employee.status, exit_date: d.employee.exit_date ?? "",
    });
  });
  useEffect(() => { load().catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    api<{ departments: any[] }>("/api/org/departments").then((d) => setDepts(d.departments)).catch(() => {});
    api<{ designations: any[] }>("/api/org/designations").then((d) => setDesignations(d.designations)).catch(() => {});
  }, []);

  if (err && !data) return <ErrorNote message={err} />;
  if (!data) return <Spinner />;
  const e = data.employee;

  async function save() {
    setErr(""); setMsg("");
    try {
      await put(`/api/employees/${id}`, {
        ...form,
        basic_salary: Number(form.basic_salary),
        department_id: form.department_id || null,
        designation_id: form.designation_id || null,
        exit_date: form.exit_date || null,
      });
      setEditing(false); setMsg("Saved"); load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
  }

  return (
    <div>
      <PageHeader title={e.full_name} sub={`${e.employee_code} · ${e.departments?.name ?? "No department"}`}>
        <StatusBadge status={e.status} />
        <button className="btn-ghost" onClick={() => setEditing((x) => !x)}>{editing ? "Cancel" : "Edit"}</button>
      </PageHeader>
      {msg && <p className="text-sm text-emerald-600 mb-3">{msg}</p>}
      <ErrorNote message={err} />

      {editing && (
        <div className="card p-5 mb-5 grid sm:grid-cols-2 gap-4">
          <div><label className="label">Full name</label><input className="input" value={form.full_name} onChange={(ev) => setForm({ ...form, full_name: ev.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} /></div>
          <div><label className="label">Department</label>
            <select className="input" value={form.department_id} onChange={(ev) => setForm({ ...form, department_id: ev.target.value })}>
              <option value="">—</option>{depts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">Designation</label>
            <select className="input" value={form.designation_id} onChange={(ev) => setForm({ ...form, designation_id: ev.target.value })}>
              <option value="">—</option>{designations.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select></div>
          <div><label className="label">Basic salary (PKR)</label><input className="input" type="number" value={form.basic_salary} onChange={(ev) => setForm({ ...form, basic_salary: ev.target.value })} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}>
              <option value="active">Active</option><option value="probation">Probation</option><option value="exited">Exited</option>
            </select></div>
          <div><label className="label">Exit date (if exited)</label><input className="input" type="date" value={form.exit_date} onChange={(ev) => setForm({ ...form, exit_date: ev.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={(ev) => setForm({ ...form, address: ev.target.value })} /></div>
          <div className="sm:col-span-2"><button className="btn-primary" onClick={save}>Save changes</button></div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Profile</p>
          <dl className="space-y-2 text-sm">
            {[["Email", e.email], ["Phone", e.phone || "—"], ["Address", e.address || "—"],
              ["Designation", e.designations?.title ?? "—"], ["Joined", fmtDate(e.join_date)],
              ["Basic salary", fmtMoney(Number(e.basic_salary))], ["Gender", e.gender ?? "—"]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-700 text-right">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Leave balances</p>
          {data.balances.length === 0 ? <p className="text-sm text-slate-400">No leave types.</p> : (
            <ul className="space-y-2 text-sm">
              {data.balances.map((b: any) => (
                <li key={b.id} className="flex justify-between">
                  <span className="text-slate-600">{b.label}</span>
                  <span className="font-medium">{b.remaining == null ? `${b.used} used` : `${b.remaining} left`}</span>
                </li>
              ))}
            </ul>
          )}
          {data.lastPayslip && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">Last payslip · {data.lastPayslip.payroll_runs?.period_month?.slice(0, 7)}</p>
              <div className="flex justify-between items-center mt-1">
                <p className="font-bold text-emerald-600">{fmtMoney(Number(data.lastPayslip.net))}</p>
                <a className="btn-ghost text-xs" href={`/api/payslips/${data.lastPayslip.id}/pdf`}>PDF</a>
              </div>
            </div>
          )}
        </div>
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Recent leave requests</p>
          {data.leaves.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
            <ul className="space-y-2 text-sm">
              {data.leaves.map((l: any) => (
                <li key={l.id} className="flex justify-between items-center">
                  <span className="text-slate-600">{l.leave_types?.label} · {l.start_date}→{l.end_date}</span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">Attendance (last 30 days)</p>
          <div className="flex flex-wrap gap-1">
            {data.attendance.length === 0 && <p className="text-sm text-slate-400">No records.</p>}
            {data.attendance.map((a: any) => (
              <span key={a.id} title={`${a.work_date}: ${a.status}`}
                className={`h-6 w-6 rounded text-[9px] flex items-center justify-center font-bold text-white ${
                  a.status === "present" ? "bg-emerald-500" : a.status === "late" ? "bg-amber-500" :
                  a.status === "half_day" ? "bg-orange-400" : a.status === "absent" ? "bg-rose-500" : "bg-slate-300"}`}>
                {a.work_date.slice(8)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
