"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import AiChat from "./AiChat";

type Role = "admin" | "hr" | "employee";

interface MenuGroup {
  label: string;
  links: { href: string; label: string }[];
}

const ROLE_PRESENTATION: Record<Role, { title: string; description: string; accent: string; badge: string }> = {
  admin: {
    title: "Company administration",
    description: "Organization-wide control",
    accent: "border-indigo-500",
    badge: "bg-indigo-100 text-indigo-700",
  },
  hr: {
    title: "People operations",
    description: "Workforce and approvals",
    accent: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
  employee: {
    title: "Employee self-service",
    description: "Your work and benefits",
    accent: "border-sky-500",
    badge: "bg-sky-100 text-sky-700",
  },
};

const MENUS: Record<Role, MenuGroup[]> = {
  admin: [
    { label: "Overview", links: [{ href: "/dashboard", label: "Company dashboard" }] },
    { label: "People", links: [
      { href: "/users", label: "User access" },
      { href: "/employees", label: "Employee directory" },
    ] },
    { label: "Company controls", links: [
      { href: "/org", label: "Organization settings" },
      { href: "/payroll", label: "Payroll oversight" },
      { href: "/audit", label: "Audit log" },
    ] },
    { label: "Workforce", links: [
      { href: "/attendance", label: "Attendance" },
      { href: "/leave", label: "Leave records" },
    ] },
    { label: "Company", links: [{ href: "/announcements", label: "Announcements" }] },
    { label: "Account", links: [{ href: "/profile", label: "My profile" }] },
  ],
  hr: [
    { label: "Overview", links: [{ href: "/dashboard", label: "HR dashboard" }] },
    { label: "People operations", links: [
      { href: "/employees", label: "Employee directory" },
      { href: "/attendance", label: "Attendance board" },
      { href: "/leave", label: "Approval inbox" },
      { href: "/payroll", label: "Payroll drafts" },
    ] },
    { label: "Company", links: [{ href: "/announcements", label: "Announcements" }] },
    { label: "Account", links: [{ href: "/profile", label: "My profile" }] },
  ],
  employee: [
    { label: "My workspace", links: [{ href: "/dashboard", label: "Personal dashboard" }] },
    { label: "Time & benefits", links: [
      { href: "/attendance", label: "My attendance" },
      { href: "/leave", label: "My leave" },
      { href: "/payslips", label: "My payslips" },
    ] },
    { label: "Company", links: [{ href: "/announcements", label: "Announcements" }] },
    { label: "Account", links: [{ href: "/profile", label: "My profile" }] },
  ],
};

interface Notification { id: string; title: string; body: string; read_at: string | null; created_at: string }

export default function AppShell({ user, children }: {
  user: { name: string; role: Role; email: string };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [openBell, setOpenBell] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadNotifs() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 30_000);
    return () => clearInterval(t);
  }, [pathname]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST", body: "{}" });
    loadNotifs();
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menu = MENUS[user.role];
  const presentation = ROLE_PRESENTATION[user.role];
  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <div className={`min-h-screen border-t-4 bg-slate-50 lg:flex ${presentation.accent}`} data-role={user.role}>
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 bg-slate-900 text-slate-300 transform transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">HC</div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">HCM Lite</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{presentation.title}</p>
          </div>
        </div>
        <nav className="p-3 space-y-4">
          {menu.map((group) => (
            <section key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
              <div className="space-y-0.5">
                {group.links.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm transition ${
                        active ? "bg-indigo-600 text-white font-medium" : "hover:bg-slate-800 hover:text-white"}`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <button className="lg:hidden btn-ghost px-2" onClick={() => setSidebarOpen(true)} aria-label="Menu">☰</button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500">
              Welcome back, <span className="font-medium text-slate-700">{user.name}</span>
            </p>
            <p className="text-[11px] text-slate-400">{presentation.description}</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <button className="relative btn-ghost px-3" onClick={() => { setOpenBell((o) => !o); if (!openBell && unread) markAllRead(); }} aria-label="Notifications">
              🔔
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center px-1">{unread}</span>
              )}
            </button>
            {openBell && (
              <div className="absolute right-0 top-12 w-80 card p-2 z-30 max-h-96 overflow-y-auto">
                <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Notifications</p>
                {notifs.length === 0 && <p className="px-2 py-3 text-sm text-slate-400">Nothing yet.</p>}
                {notifs.map((n) => (
                  <div key={n.id} className={`px-2 py-2 rounded-lg ${!n.read_at ? "bg-indigo-50" : ""}`}>
                    <p className="text-sm font-medium text-slate-700">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
            <span className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${presentation.badge}`}>
              {user.role}
            </span>
            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">{initials}</div>
            <button onClick={logout} className="btn-ghost px-3">Sign out</button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
      <AiChat />
    </div>
  );
}
