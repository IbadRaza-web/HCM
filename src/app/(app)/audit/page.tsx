"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PageHeader, Spinner, ErrorNote, Empty } from "@/components/ui";

export default function AuditPage() {
  const [data, setData] = useState<{ logs: any[]; total: number; page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/api/audit?page=${page}`).then(setData).catch((e) => setErr(e.message));
  }, [page]);

  return (
    <div>
      <PageHeader title="Audit log" sub="Append-only record of every important action · Admin only" />
      <ErrorNote message={err} />
      {!data ? <Spinner /> : data.logs.length === 0 ? <Empty title="No audit entries yet" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">When</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Details</th></tr></thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="td text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</td>
                    <td className="td">{l.profiles?.full_name ?? "system"}</td>
                    <td className="td font-mono text-xs text-indigo-700">{l.action}</td>
                    <td className="td text-xs">{l.entity_type}</td>
                    <td className="td max-w-xs truncate text-xs text-slate-400" title={JSON.stringify(l.after_json ?? l.before_json ?? {})}>
                      {JSON.stringify(l.after_json ?? l.before_json ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="text-sm text-slate-500 self-center">Page {data.page} of {Math.ceil(data.total / 50)}</span>
              <button className="btn-ghost" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
