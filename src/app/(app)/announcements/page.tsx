"use client";
import { useEffect, useState } from "react";
import { api, post } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/dates";

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [role, setRole] = useState("");
  const [f, setF] = useState({ title: "", body: "" });
  const [err, setErr] = useState("");

  const load = () => api<{ announcements: any[] }>("/api/announcements").then((d) => setRows(d.announcements));
  useEffect(() => {
    api("/api/analytics").then((d) => setRole(d.role)).catch(() => {});
    load().catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <PageHeader title="Announcements" sub="Company-wide posts from Admin and HR" />
      <ErrorNote message={err} />
      {role === "admin" || role === "hr" ? (
        <form className="card p-4 mb-5 space-y-3 max-w-xl" onSubmit={async (e) => {
          e.preventDefault(); setErr("");
          try { await post("/api/announcements", f); setF({ title: "", body: "" }); load(); }
          catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
        }}>
          <div><label className="label">Title</label>
            <input className="input" required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className="label">Body</label>
            <textarea className="input" required rows={2} minLength={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <button className="btn-primary">Post announcement</button>
        </form>
      ) : null}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty title="No announcements yet" /> : (
        <div className="space-y-3 max-w-2xl">
          {rows.map((a) => (
            <div key={a.id} className="card p-4">
              <p className="font-medium text-slate-800">{a.title}</p>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
              <p className="text-[11px] text-slate-400 mt-2">{a.profiles?.full_name ?? "—"} · {fmtDate(a.created_at.slice(0, 10))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
