"use client";
import { useEffect, useState } from "react";
import { api, post, put } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OrgPage() {
  const [tab, setTab] = useState<"settings" | "departments" | "designations" | "leave" | "holidays">("settings");
  const tabs = [["settings", "Settings"], ["departments", "Departments"], ["designations", "Designations"], ["leave", "Leave types"], ["holidays", "Holidays"]] as const;
  return (
    <div>
      <PageHeader title="Organization" sub="Company settings, departments and leave rules" />
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === k ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "settings" && <SettingsTab />}
      {tab === "departments" && <DepartmentsTab />}
      {tab === "designations" && <DesignationsTab />}
      {tab === "leave" && <LeaveTypesTab />}
      {tab === "holidays" && <HolidaysTab />}
    </div>
  );
}

function SettingsTab() {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/org/settings").then((d) => setS(d.settings)).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorNote message={err} />;
  if (!s) return <Spinner />;
  const set = (k: string, v: unknown) => setS((x: any) => ({ ...x, [k]: v }));
  return (
    <form className="card p-5 max-w-2xl space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(""); setMsg("");
      try {
        await put("/api/org/settings", {
          company_name: s.company_name, office_start: String(s.office_start).slice(0, 5),
          grace_minutes: Number(s.grace_minutes), half_day_hours: Number(s.half_day_hours),
          weekend_days: s.weekend_days, office_lat: s.office_lat ? Number(s.office_lat) : null,
          office_lng: s.office_lng ? Number(s.office_lng) : null, radius_m: Number(s.radius_m),
        });
        setMsg("Settings saved. New attendance records will use these values.");
      } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
      setBusy(false);
    }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Company name</label>
          <input className="input" value={s.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
        <div><label className="label">Office start</label>
          <input className="input" type="time" value={String(s.office_start).slice(0, 5)} onChange={(e) => set("office_start", e.target.value)} /></div>
        <div><label className="label">Grace minutes (late after)</label>
          <input className="input" type="number" value={s.grace_minutes} onChange={(e) => set("grace_minutes", e.target.value)} /></div>
        <div><label className="label">Half-day threshold (hours)</label>
          <input className="input" type="number" step="0.5" value={s.half_day_hours} onChange={(e) => set("half_day_hours", e.target.value)} /></div>
        <div><label className="label">Office radius (m)</label>
          <input className="input" type="number" value={s.radius_m} onChange={(e) => set("radius_m", e.target.value)} /></div>
        <div><label className="label">Office latitude</label>
          <input className="input" value={s.office_lat ?? ""} onChange={(e) => set("office_lat", e.target.value)} /></div>
        <div><label className="label">Office longitude</label>
          <input className="input" value={s.office_lng ?? ""} onChange={(e) => set("office_lng", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">Weekend days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d, i) => (
              <button type="button" key={d}
                onClick={() => set("weekend_days", s.weekend_days.includes(i) ? s.weekend_days.filter((x: number) => x !== i) : [...s.weekend_days, i].sort())}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${s.weekend_days.includes(i) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300"}`}>
                {d}
              </button>
            ))}
          </div></div>
      </div>
      {err && <ErrorNote message={err} />}
      {msg && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      <button className="btn-primary" disabled={busy}>Save settings</button>
    </form>
  );
}

function DepartmentsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState(""); const [err, setErr] = useState("");
  const load = () => api<{ departments: any[] }>("/api/org/departments").then((d) => setRows(d.departments));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);
  return (
    <div className="max-w-xl">
      <form className="flex gap-2 mb-4" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        try { await post("/api/org/departments", { name }); setName(""); load(); }
        catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
      }}>
        <input className="input flex-1" placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary">Add</button>
      </form>
      <ErrorNote message={err} />
      {rows.length === 0 ? <Empty title="No departments yet" sub="Add your first department above" /> : (
        <div className="card divide-y divide-slate-100">
          {rows.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-700">{d.name}</span>
              <button className="btn-danger" onClick={async () => {
                try { await api(`/api/org/departments/${d.id}`, { method: "DELETE" }); load(); }
                catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DesignationsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [dept, setDept] = useState(""); const [err, setErr] = useState("");
  const load = async () => {
    const [d1, d2] = await Promise.all([api<{ designations: any[] }>("/api/org/designations"), api<{ departments: any[] }>("/api/org/departments")]);
    setRows(d1.designations); setDepts(d2.departments); if (!dept && d2.departments[0]) setDept(d2.departments[0].id);
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, []);
  return (
    <div className="max-w-xl">
      <form className="flex gap-2 mb-4" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        try { await post("/api/org/designations", { title, department_id: dept }); setTitle(""); load(); }
        catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
      }}>
        <input className="input flex-1" placeholder="Title e.g. Manager" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input w-48" value={dept} onChange={(e) => setDept(e.target.value)}>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn-primary">Add</button>
      </form>
      <ErrorNote message={err} />
      {rows.length === 0 ? <Empty title="No designations yet" /> : (
        <div className="card divide-y divide-slate-100">
          {rows.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-slate-700">{d.title} <span className="text-slate-400">· {d.departments?.name ?? "—"}</span></span>
              <button className="btn-danger" onClick={async () => {
                try { await api(`/api/org/designations?id=${d.id}`, { method: "DELETE" }); load(); }
                catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeaveTypesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ code: "", label: "", yearly_quota: "", paid: true });
  const [err, setErr] = useState("");
  const load = () => api<{ leave_types: any[] }>("/api/org/leave-types").then((d) => setRows(d.leave_types));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);
  return (
    <div className="max-w-2xl">
      <form className="card p-4 mb-4 grid sm:grid-cols-5 gap-2 items-end" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        try {
          await post("/api/org/leave-types", {
            code: f.code, label: f.label,
            yearly_quota: f.yearly_quota === "" ? null : Number(f.yearly_quota), paid: f.paid,
          });
          setF({ code: "", label: "", yearly_quota: "", paid: true }); load();
        } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
      }}>
        <div><label className="label">Code</label><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="annual" /></div>
        <div><label className="label">Label</label><input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Annual" /></div>
        <div><label className="label">Quota/yr</label><input className="input" type="number" value={f.yearly_quota} onChange={(e) => setF({ ...f, yearly_quota: e.target.value })} placeholder="empty = unlimited" /></div>
        <div><label className="label">Paid</label>
          <select className="input" value={String(f.paid)} onChange={(e) => setF({ ...f, paid: e.target.value === "true" })}>
            <option value="true">Paid</option><option value="false">Unpaid</option>
          </select></div>
        <button className="btn-primary">Add</button>
      </form>
      <ErrorNote message={err} />
      {rows.length === 0 ? <Empty title="No leave types yet" /> : (
        <div className="card divide-y divide-slate-100">
          {rows.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-slate-700">{t.label} <span className="text-slate-400">({t.code})</span></span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{t.yearly_quota == null ? "Unlimited" : `${t.yearly_quota}/yr`} · {t.paid ? "Paid" : "Unpaid"}</span>
                <button className="btn-danger" onClick={async () => {
                  try { await api(`/api/org/leave-types?id=${t.id}`, { method: "DELETE" }); load(); }
                  catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
                }}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HolidaysTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ holiday_date: "", name: "" }); const [err, setErr] = useState("");
  const load = () => api<{ holidays: any[] }>("/api/org/holidays").then((d) => setRows(d.holidays));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);
  return (
    <div className="max-w-xl">
      <form className="flex gap-2 mb-4 items-end" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        try { await post("/api/org/holidays", f); setF({ holiday_date: "", name: "" }); load(); }
        catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
      }}>
        <div><label className="label">Date</label><input className="input" type="date" value={f.holiday_date} onChange={(e) => setF({ ...f, holiday_date: e.target.value })} /></div>
        <div className="flex-1"><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Independence Day" /></div>
        <button className="btn-primary">Add</button>
      </form>
      <ErrorNote message={err} />
      {rows.length === 0 ? <Empty title="No public holidays yet" /> : (
        <div className="card divide-y divide-slate-100">
          {rows.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-slate-700">{h.holiday_date} — {h.name}</span>
              <button className="btn-danger" onClick={async () => {
                await api(`/api/org/holidays?id=${h.id}`, { method: "DELETE" }); load();
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
