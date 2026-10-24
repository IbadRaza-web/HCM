"use client";
import type { ReactNode } from "react";

export function Kpi({ label, value, sub, tone = "indigo" }: {
  label: string; value: ReactNode; sub?: string; tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    indigo: "text-indigo-600", emerald: "text-emerald-600", amber: "text-amber-600",
    rose: "text-rose-600", slate: "text-slate-700",
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  half_day: "bg-orange-50 text-orange-700 border-orange-200",
  missing_checkout: "bg-yellow-50 text-yellow-700 border-yellow-200",
  absent: "bg-rose-50 text-rose-700 border-rose-200",
  on_leave: "bg-sky-50 text-sky-700 border-sky-200",
  non_working: "bg-slate-50 text-slate-500 border-slate-200",
  upcoming: "bg-slate-50 text-slate-400 border-slate-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  finalized: "bg-indigo-50 text-indigo-700 border-indigo-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  probation: "bg-sky-50 text-sky-700 border-sky-200",
  exited: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{message}</p>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-400">
      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label}
    </div>
  );
}
