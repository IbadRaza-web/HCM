"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api, post } from "@/lib/client";
import { Kpi, PageHeader, Spinner, Empty, StatusBadge, ErrorNote } from "@/components/ui";
import { fmtMoney, fmtDate, monthStart, todayISO } from "@/lib/dates";

interface Analytics { role: string; kpis: any }
interface Announcement { id: string; title: string; body: string; created_at: string }
interface DashboardFilters { from: string; to: string; departmentId: string }

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const today = todayISO();
    return { from: monthStart(today), to: today, departmentId: "" };
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ announcements: Announcement[] }>("/api/announcements")
      .then((an) => setAnnouncements(an.announcements ?? []))
      .catch((e) => setError(e.message));
    api<{ departments: { id: string; name: string }[] }>("/api/org/departments")
      .then((d) => setDepartments(d.departments ?? []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.departmentId) params.set("department_id", filters.departmentId);
    setLoading(true);
    api<Analytics>(`/api/analytics?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function updateFilters(patch: Partial<DashboardFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setError("");
  }

  if (error) return <ErrorNote message={error} />;
  if (loading || !data) return <Spinner />;

  const isManager = data.role === "admin" || data.role === "hr";
  return (
    <>
      {isManager && <AnalyticsFilters filters={filters} departments={departments} onChange={updateFilters} />}
      {data.role === "admin"
        ? <AdminDashboard kpis={data.kpis} announcements={announcements} filters={filters} />
        : data.role === "hr"
          ? <HrDashboard kpis={data.kpis} announcements={announcements} filters={filters} />
          : <EmployeeDashboard kpis={data.kpis} announcements={announcements} />}
    </>
  );
}

function AnalyticsFilters({ filters, departments, onChange }: {
  filters: DashboardFilters;
  departments: { id: string; name: string }[];
  onChange: (patch: Partial<DashboardFilters>) => void;
}) {
  return (
    <section className="card p-4 mb-5 flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="analytics-from">From</label>
        <input id="analytics-from" className="input" type="date" value={filters.from}
          max={filters.to} onChange={(e) => onChange({ from: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="analytics-to">To</label>
        <input id="analytics-to" className="input" type="date" value={filters.to}
          min={filters.from} max={todayISO()} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="analytics-department">Department</label>
        <select id="analytics-department" className="input min-w-44" value={filters.departmentId}
          onChange={(e) => onChange({ departmentId: e.target.value })}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <p className="text-xs text-slate-500 pb-2">Dashboard metrics use the selected dates and department.</p>
    </section>
  );
}

function SummaryQuery(filters: DashboardFilters) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.departmentId) params.set("department_id", filters.departmentId);
  return `/api/ai/summarize?${params}`;
}

function Summarize({ filters }: { filters: DashboardFilters }) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button className="btn-primary" disabled={busy}
        onClick={async () => {
          setBusy(true); setError("");
          try {
            const r = await post<{ bullets: string[] }>(SummaryQuery(filters));
            setBullets(r.bullets);
          } catch (e) { setError(e instanceof Error ? e.message : "Summary failed"); }
          finally { setBusy(false); }
        }}>
        {busy ? "Summarizing…" : "✨ AI summary"}
      </button>
      {error && <ErrorNote message={error} />}
      {bullets.length > 0 && (
        <div className="card p-4 mt-4 border-indigo-200 bg-indigo-50/50">
          <p className="text-xs font-semibold uppercase text-indigo-500 mb-2">AI-generated insights</p>
          <ul className="space-y-1.5 text-sm text-slate-700 list-disc list-inside">
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function WorkspaceWelcome({ role, description, actions }: {
  role: "admin" | "hr" | "employee";
  description: string;
  actions: { href: string; label: string }[];
}) {
  const styles = {
    admin: "border-indigo-200 bg-indigo-50/70 text-indigo-950",
    hr: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
    employee: "border-sky-200 bg-sky-50/70 text-sky-950",
  };
  const titles = {
    admin: "Company command center",
    hr: "People operations workspace",
    employee: "Your workday, in one place",
  };
  return (
    <section className={`card mb-5 flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between ${styles[role]}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{role} workspace</p>
        <h2 className="mt-1 text-lg font-bold">{titles[role]}</h2>
        <p className="mt-1 max-w-xl text-sm opacity-80">{description}</p>
      </div>
      <nav aria-label={`${role} quick actions`} className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link key={action.href} className="btn-ghost bg-white/80 text-sm" href={action.href}>
            {action.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function AdminDashboard({ kpis, announcements, filters }: {
  kpis: any; announcements: Announcement[]; filters: DashboardFilters;
}) {
  return (
    <div>
      <PageHeader title="Company dashboard" sub={`${fmtDate(filters.from)} – ${fmtDate(filters.to)}`} />
      <WorkspaceWelcome role="admin"
        description="Review company-wide performance, manage access and keep organization settings under control."
        actions={[
          { href: "/org", label: "Organization settings" },
          { href: "/users", label: "Manage users" },
          { href: "/audit", label: "Review audit log" },
        ]} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Headcount" value={kpis.headcount} sub="active + probation at period end" />
        <Kpi label="Attrition (selected range)" value={`${kpis.attritionYtd}%`} sub={`${kpis.exitsYtd} exit(s)`} tone="amber" />
        <Kpi label="Payroll cost (finalized)" value={fmtMoney(kpis.payrollCostMonth)} sub="net total for selected months" tone="emerald" />
        <Kpi label="Avg basic salary" value={fmtMoney(kpis.avgBasicSalary)} tone="slate" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Headcount by department</p>
          {kpis.headcountByDept.length === 0 ? <Empty title="No departments yet" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={kpis.headcountByDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Gender & exits</p>
          <div className="grid grid-cols-3 gap-3 text-center py-4">
            <div><p className="text-2xl font-bold text-indigo-600">{kpis.gender.male}</p><p className="text-xs text-slate-500">Male</p></div>
            <div><p className="text-2xl font-bold text-indigo-600">{kpis.gender.female}</p><p className="text-xs text-slate-500">Female</p></div>
            <div><p className="text-2xl font-bold text-indigo-600">{kpis.gender.other}</p><p className="text-xs text-slate-500">Other</p></div>
          </div>
          <p className="text-xs text-slate-400">Exits in selected range: {kpis.exitsYtd}</p>
        </div>
      </div>
      <div className="mt-5"><Summarize filters={filters} /></div>
      <Announcements announcements={announcements} />
    </div>
  );
}

function HrDashboard({ kpis, announcements, filters }: {
  kpis: any; announcements: Announcement[]; filters: DashboardFilters;
}) {
  const t = kpis.today;
  const period = `${fmtDate(kpis.month.from)} – ${fmtDate(kpis.month.to)}`;
  return (
    <div>
      <PageHeader title="HR dashboard" sub={`Attendance and leave · ${period}`} />
      <WorkspaceWelcome role="hr"
        description="Keep daily people operations moving: onboard employees, resolve approvals and prepare payroll."
        actions={[
          { href: "/employees/new", label: "Register employee" },
          { href: "/leave", label: "Review approvals" },
          { href: "/payroll", label: "Prepare payroll" },
        ]} />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label={`Present · ${fmtDate(filters.to)}`} value={t.present} tone="emerald" />
        <Kpi label="Late" value={t.late} tone="amber" />
        <Kpi label="On leave" value={t.on_leave} tone="slate" />
        <Kpi label="Half day" value={t.half_day} tone="amber" />
        <Kpi label="Absent" value={t.absent} tone="rose" />
        <Kpi label="Pending approvals" value={kpis.pendingApprovals.leave + kpis.pendingApprovals.corrections} sub={`${kpis.pendingApprovals.leave} leave · ${kpis.pendingApprovals.corrections} corrections`} tone="indigo" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Attendance trend · selected range</p>
          {kpis.month.trend.length === 0 ? <Empty title="No attendance data yet" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={kpis.month.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip labelFormatter={(v) => fmtDate(String(v))} />
                <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2} name="Attendance %" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Attendance rate by department</p>
          {kpis.month.byDept.length === 0 ? <Empty title="No data yet" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={kpis.month.byDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendanceRate" fill="#10b981" name="Attendance %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absenteeism" fill="#f43f5e" name="Absenteeism %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Top 5 late-comers · selected range</p>
          {kpis.month.topLate.length === 0 ? <p className="text-sm text-slate-400">No late arrivals recorded.</p> : (
            <ul className="divide-y divide-slate-100">
              {kpis.month.topLate.map((r: { name: string; lates: number }, i: number) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-700">{i + 1}. {r.name}</span>
                  <span className="font-medium text-amber-600">{r.lates} late</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Leave days by type · selected range</p>
          {kpis.month.leaveByType.length === 0 ? <p className="text-sm text-slate-400">No approved leave in this period.</p> : (
            <ul className="divide-y divide-slate-100">
              {kpis.month.leaveByType.map((r: { type: string; days: number }, i: number) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-700">{r.type}</span>
                  <span className="font-medium text-sky-600">{r.days} day(s)</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-5"><Summarize filters={filters} /></div>
      <Announcements announcements={announcements} />
    </div>
  );
}

function EmployeeDashboard({ kpis, announcements }: { kpis: any; announcements: Announcement[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const today = kpis.todayAttendance as { status: string; check_in_at: string; check_out_at: string } | null;

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true); setMsg("");
    try {
      const r = await post<{ time?: string; status?: string; hours?: number }>(`/api/attendance/${kind}`);
      setMsg(kind === "check-in" ? `Checked in at ${r.time} (${r.status})` : `Checked out at ${fmtTimeLocal(r.time ?? "")} · ${r.hours}h (${r.status})`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  return (
    <div>
      <PageHeader title="My dashboard" />
      <WorkspaceWelcome role="employee"
        description="Check your attendance, request time off and find your personal pay information."
        actions={[
          { href: "/attendance", label: "My attendance" },
          { href: "/leave", label: "Request leave" },
          { href: "/payslips", label: "View payslips" },
        ]} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1">
          <p className="text-sm font-semibold text-slate-700 mb-3">Attendance today</p>
          {today ? (
            <div className="space-y-1 text-sm text-slate-600">
              <p>Status: <StatusBadge status={today.status} /></p>
              <p>In: {fmtTimeLocal(today.check_in_at)} · Out: {fmtTimeLocal(today.check_out_at)}</p>
            </div>
          ) : <p className="text-sm text-slate-400">Not checked in yet.</p>}
          <div className="flex gap-2 mt-4">
            {!today?.check_in_at && <button className="btn-primary flex-1" disabled={busy} onClick={() => punch("check-in")}>Check in</button>}
            {today?.check_in_at && !today?.check_out_at && <button className="btn-primary flex-1" disabled={busy} onClick={() => punch("check-out")}>Check out</button>}
          </div>
          {msg && <p className="text-xs text-slate-500 mt-2">{msg}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4 content-start">
          <Kpi label="Hours this week" value={kpis.weekHours} sub={`target ${kpis.weekTarget}h`} tone="indigo" />
          <Kpi label="Late this month" value={kpis.lateCountMonth} tone={kpis.lateCountMonth > 0 ? "amber" : "emerald"} />
          {kpis.lastPayslip && (
            <div className="col-span-2 card p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Last payslip · {fmtMonthLocal(kpis.lastPayslip.payroll_runs?.period_month)}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xl font-bold text-emerald-600">{fmtMoney(kpis.lastPayslip.net)}</p>
                <a className="btn-ghost text-xs" href={`/api/payslips/${kpis.lastPayslip.id}/pdf`}>Download PDF</a>
              </div>
            </div>
          )}
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Leave balance</p>
          {kpis.balances?.length ? (
            <ul className="space-y-2">
              {kpis.balances.map((b: { id: string; label: string; used: number; remaining: number | null }) => (
                <li key={b.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{b.label}</span>
                  <span className="font-medium">{b.remaining == null ? `${b.used} used · unlimited` : `${b.remaining} left of ${b.used + b.remaining}`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No leave types configured.</p>}
        </div>
      </div>
      <Announcements announcements={announcements} />
    </div>
  );
}

function Announcements({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-slate-700 mb-2">Announcements</p>
      <div className="space-y-2">
        {announcements.slice(0, 3).map((a) => (
          <div key={a.id} className="card p-4">
            <p className="text-sm font-medium text-slate-800">{a.title}</p>
            <p className="text-sm text-slate-600 mt-0.5">{a.body}</p>
            <p className="text-[11px] text-slate-400 mt-1">{fmtDate(a.created_at.slice(0, 10))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtTimeLocal(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtMonthLocal(m?: string) {
  if (!m) return "—";
  return new Date(m + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
