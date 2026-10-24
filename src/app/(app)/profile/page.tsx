"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, put } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote } from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [f, setF] = useState({ phone: "", address: "" });
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");

  useEffect(() => {
    fetch("/api/me").then(async (r) => {
      const d = await r.json();
      setMe(d);
      setF({ phone: d.employee?.phone ?? "", address: d.employee?.address ?? "" });
    }).catch((e) => setErr(e.message));
  }, []);

  if (!me) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="My profile" />
      <ErrorNote message={err} />
      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Account</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium">{me.name}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{me.email}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Role</dt><dd className="font-medium capitalize">{me.role}</dd></div>
          {me.employee && (
            <>
              <div className="flex justify-between"><dt className="text-slate-500">Employee code</dt><dd className="font-mono text-xs">{me.employee.employee_code}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Department</dt><dd className="font-medium">{me.employee.departments?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Joined</dt><dd className="font-medium">{me.employee.join_date}</dd></div>
            </>
          )}
        </dl>
      </div>

      {me.role === "employee" && (
        <form className="card p-5 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setErr(""); setMsg("");
          try {
            await put(`/api/employees/${me.employee.id}`, { phone: f.phone, address: f.address });
            setMsg("Contact details saved.");
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
        }}>
          <p className="text-sm font-semibold text-slate-700">Contact details (editable)</p>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label">Address</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <button className="btn-primary">Save</button>
        </form>
      )}

      <form className="card p-5 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setPwErr("");
        if (pw.password !== pw.confirm) { setPwErr("Passwords do not match"); return; }
        const res = await fetch("/api/auth/change-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw.password }),
        });
        const d = await res.json();
        if (!res.ok) { setPwErr(d.error || "Failed"); return; }
        setPw({ password: "", confirm: "" });
        alert("Password changed.");
      }}>
        <p className="text-sm font-semibold text-slate-700">Change password</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">New password (min 8)</label>
            <input className="input" type="password" minLength={8} required value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
          <div><label className="label">Confirm</label>
            <input className="input" type="password" minLength={8} required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
        </div>
        <ErrorNote message={pwErr} />
        <button className="btn-primary">Update password</button>
      </form>
    </div>
  );
}
