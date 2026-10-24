-- ============================================================
-- HCM Lite — initial schema (Saylani Hackathon)
-- Run this once in the Supabase SQL Editor.
-- The app starts EMPTY: no companies, employees or records are seeded.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Organization ----------
create table public.company_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null,
  office_start time not null default '09:00',
  grace_minutes int not null default 15,
  half_day_hours numeric(4,2) not null default 5,
  weekend_days int[] not null default '{6,0}',   -- 0=Sun .. 6=Sat
  office_lat numeric(10,7),
  office_lng numeric(10,7),
  radius_m int not null default 150,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid references public.departments(id) on delete cascade,
  unique (title, department_id)
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  yearly_quota int,            -- null = unlimited
  paid boolean not null default true,
  active boolean not null default true
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null
);

-- ---------- People ----------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  email text not null unique,
  phone text not null default '',
  address text not null default '',
  gender text check (gender in ('male','female','other')),
  department_id uuid references public.departments(id) on delete set null,
  designation_id uuid references public.designations(id) on delete set null,
  join_date date not null,
  exit_date date,
  status text not null default 'active' check (status in ('active','probation','exited')),
  basic_salary numeric(12,2) not null check (basic_salary > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.employees (department_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','hr','employee')),
  employee_id uuid unique references public.employees(id) on delete set null,
  full_name text not null default '',
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Attendance ----------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  hours_worked numeric(5,2),
  status text not null check (status in ('present','late','half_day','missing_checkout','absent','on_leave')),
  source text not null default 'web' check (source in ('web','camera','correction')),
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);
create index on public.attendance (work_date);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decision_comment text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------- Leave ----------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  working_days numeric(4,1) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references public.profiles(id),
  decision_comment text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on public.leave_requests (employee_id, status);
create index on public.leave_requests (status);

-- ---------- Payroll ----------
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,      -- always the 1st of the month
  status text not null default 'draft' check (status in ('draft','finalized')),
  created_by uuid references public.profiles(id),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  basic numeric(12,2) not null,
  hra numeric(12,2) not null,
  medical numeric(12,2) not null,
  gross numeric(12,2) not null,
  working_days int not null,
  eligible_days numeric(5,1) not null,
  absent_days numeric(5,1) not null default 0,
  unpaid_days numeric(5,1) not null default 0,
  half_days numeric(5,1) not null default 0,
  deduction numeric(12,2) not null default 0,
  taxable_annual numeric(14,2) not null default 0,
  tax numeric(12,2) not null default 0,
  net numeric(12,2) not null,
  details jsonb,
  unique (payroll_run_id, employee_id)
);

-- ---------- Comms & audit ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  posted_by uuid references public.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (recipient_id, read_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);

create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  request_summary text,
  tools_called jsonb,
  status text,
  duration_ms int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Security: RLS enabled everywhere with no public policies.
-- The Supabase Data API (anon/authenticated) can read NOTHING;
-- all access goes through the app's server routes, which use the
-- service role key AND enforce role + data-scope checks in code.
-- ============================================================
alter table public.company_settings   enable row level security;
alter table public.departments        enable row level security;
alter table public.designations       enable row level security;
alter table public.leave_types        enable row level security;
alter table public.holidays           enable row level security;
alter table public.employees          enable row level security;
alter table public.profiles           enable row level security;
alter table public.attendance         enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.leave_requests     enable row level security;
alter table public.payroll_runs       enable row level security;
alter table public.payslips           enable row level security;
alter table public.announcements      enable row level security;
alter table public.notifications      enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.ai_logs            enable row level security;

-- audit log is append-only
revoke update, delete on public.audit_logs from anon, authenticated;

-- ============================================================
-- Dev helper (guarded): lets the build tool apply later schema
-- migrations through the service-role key. Removed before submit.
-- ============================================================
create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  execute sql;
end;
$$;
revoke all on function public.exec_sql(text) from anon, authenticated;
