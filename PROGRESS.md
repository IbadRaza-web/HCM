# HCM Lite Feature Checklist

This checklist maps the implemented project surface to the hackathon brief. It is intentionally a guide for final smoke testing, not a claim that production credentials or deployment are complete.

| Module | Included in project | Final smoke test |
| --- | --- | --- |
| Auth and access | Supabase sign-in, Admin bootstrap, password change, role guards | Set up Admin, HR, Employee; confirm cross-role access is denied |
| Organization | Company settings, departments, designations, leave types, holidays | Configure each from the Admin/HR interface |
| Employees | Registration, edit, directory/search, profile view, CSV dry-run/import and export | Create employee and sign in using temporary password; test CSV duplicate/invalid rows |
| Attendance | Check-in/out, daily board, status rules, corrections | Confirm duplicate check-in rejects and late/half-day state is correct |
| Leave | Balances, working-day validation, overlap prevention, approval/cancel | Submit and approve/reject a request |
| Payroll | Draft, tax and deduction rules, finalization lock, PDF payslip | Generate one month and confirm finalized run cannot change |
| Dashboards | Role-specific KPIs and charts | Compare a dashboard number with its underlying record |
| AI | Chat, role-scoped data tools, dashboard summary, smart leave | Ask for allowed data and verify another employee salary is refused |
| Comms and audit | Announcements, notifications, audit records | Post announcement and inspect the affected audit entry |

## Scope note

The mobile camera/geofence bonus is not implemented. The web attendance flow and CSV import/export are included.
