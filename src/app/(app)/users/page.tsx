"use client";
import { useEffect, useState } from "react";
import { api, post, put } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty, StatusBadge } from "@/components/ui";

export default function UsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<{ email: string; temp: string } | null>(null);
  const [f, setF] = useState({ full_name: "", email: "", role: "hr" });

  const load = () => api<{ users: any[] }>("/api/hr-users").then((d) => setRows(d.users));
  useEffect(() => { load().catch((e) => setErr(e.message)).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Users" sub="Manage HR and employee logins" />
      <div className="grid lg:grid-cols-3 gap-5">
        <form className="card p-4 space-y-3 h-fit" onSubmit={async (e) => {
          e.preventDefault(); setErr(""); setCreated(null);
          try {
            const r = await post<{ id: string; temp_password: string }>("/api/hr-users", f);
            setCreated({ email: f.email, temp: r.temp_password });
            setF({ full_name: "", email: "", role: "hr" }); load();
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
        }}>
          <p className="text-sm font-semibold text-slate-700">Create an HR login</p>
          <div><label className="label">Full name</label>
            <input className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label">Email</label>
            <input className="input" required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <ErrorNote message={err} />
          <button className="btn-primary w-full">Create login</button>
          {created && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Login created for <b>{created.email}</b>. Temporary password:{" "}
              <code className="font-mono font-bold select-all">{created.temp}</code>
              <p className="mt-1">Share it now — it must be changed on first sign-in.</p>
            </div>
          )}
        </form>

        <div className="lg:col-span-2">
          {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No HR or employee users yet" /> : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td className="td font-medium text-slate-800">{u.full_name || u.employees?.full_name || "—"}</td>
                      <td className="td">{u.email}</td>
                      <td className="td capitalize">{u.role}</td>
                      <td className="td"><StatusBadge status={u.active ? "active" : "exited"} /></td>
                      <td className="td space-x-2">
                        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={async () => {
                          const r = await put<{ temp_password: string }>("/api/hr-users", { id: u.id, action: "reset_password" });
                          alert(`New temporary password: ${r.temp_password}`);
                        }}>Reset password</button>
                        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={async () => {
                          await put("/api/hr-users", { id: u.id, action: u.active ? "deactivate" : "activate" }); load();
                        }}>{u.active ? "Deactivate" : "Activate"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
