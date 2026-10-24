"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, post } from "@/lib/client";
import { PageHeader, ErrorNote } from "@/components/ui";

export default function NewEmployeePage() {
  const router = useRouter();
  const [depts, setDepts] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [f, setF] = useState({
    full_name: "", email: "", phone: "", address: "", gender: "",
    department_id: "", designation_id: "", join_date: "", basic_salary: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ code: string; temp: string } | null>(null);

  useEffect(() => {
    api<{ departments: any[] }>("/api/org/departments").then((d) => setDepts(d.departments)).catch(() => {});
    api<{ designations: any[] }>("/api/org/designations").then((d) => setDesignations(d.designations)).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (created) {
    return (
      <div className="max-w-lg mx-auto card p-6 text-center mt-10">
        <p className="text-emerald-600 text-3xl">✓</p>
        <h2 className="text-lg font-bold text-slate-900 mt-2">Employee registered</h2>
        <p className="text-sm text-slate-500 mt-1">Employee code: <b>{created.code}</b></p>
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <p className="font-semibold">Share the login credentials now:</p>
          <p className="mt-1">Email: <b>{f.email}</b></p>
          <p>Temporary password: <code className="font-mono font-bold select-all">{created.temp}</code></p>
          <p className="text-xs mt-2">They will be asked to change it on first sign-in.</p>
        </div>
        <div className="flex gap-2 justify-center mt-5">
          <button className="btn-ghost" onClick={() => { setCreated(null); setF({ full_name: "", email: "", phone: "", address: "", gender: "", department_id: "", designation_id: "", join_date: "", basic_salary: "" }); }}>
            Register another
          </button>
          <button className="btn-primary" onClick={() => router.push("/employees")}>Back to directory</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Register employee" sub="Creates the employee record and their login" />
      <form className="card p-5 space-y-4" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        try {
          const r = await post<{ employee: any; temp_password: string }>("/api/employees", {
            ...f,
            gender: f.gender || null,
            department_id: f.department_id || null,
            designation_id: f.designation_id || null,
            basic_salary: Number(f.basic_salary),
          });
          setCreated({ code: r.employee.employee_code, temp: r.temp_password });
        } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
        setBusy(false);
      }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="label">Full name *</label>
            <input className="input" required value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
          <div><label className="label">Email (login) *</label>
            <input className="input" required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className="label">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className="label">Department *</label>
            <select className="input" required value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">Choose…</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">Designation</label>
            <select className="input" value={f.designation_id} onChange={(e) => set("designation_id", e.target.value)}>
              <option value="">—</option>
              {designations.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.departments?.name})</option>)}
            </select></div>
          <div><label className="label">Join date *</label>
            <input className="input" required type="date" value={f.join_date} onChange={(e) => set("join_date", e.target.value)} /></div>
          <div><label className="label">Basic salary (PKR) *</label>
            <input className="input" required type="number" min="1" step="0.01" value={f.basic_salary} onChange={(e) => set("basic_salary", e.target.value)} /></div>
          <div><label className="label">Gender</label>
            <select className="input" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Prefer not to say</option><option value="male">Male</option>
              <option value="female">Female</option><option value="other">Other</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Address</label>
            <input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
        <ErrorNote message={err} />
        <button className="btn-primary" disabled={busy}>{busy ? "Registering…" : "Register employee"}</button>
      </form>
    </div>
  );
}
