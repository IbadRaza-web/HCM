# HCM Lite

HCM Lite is an AI-assisted Human Capital Management web application built for the Saylani Hackathon. It has separate Admin, HR, and Employee experiences and starts with no company or employee data.

## Stack

- Next.js 16, TypeScript, Tailwind CSS
- Supabase Auth and PostgreSQL
- Server-side business rules and role/data-scope authorization
- OpenAI-compatible tool-calling assistant
- pdf-lib payslip generation

## Core capabilities

- First-run company and Admin setup
- Role-based access for Admin, HR, and Employee
- Separate workspaces: Admin manages company access and controls, HR handles people operations and approvals, and Employees use self-service for their own records
- Organization setup, employee registration, directory, CSV dry-run/import, and CSV export
- Web attendance, corrections, leave balances, approvals, and notifications
- Monthly payroll drafts, deductions, progressive tax, Admin finalization, and PDF payslips
- Role-scoped dashboards, announcements, audit log, and AI assistant

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the values from Supabase and your AI provider. Do not commit `.env.local`.

3. In the Supabase Dashboard, open **SQL Editor**, paste the complete contents of `supabase/migrations/0001_init.sql`, and run it once. This creates an empty database; it does not seed company or employee data.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Visit `http://localhost:3000/setup`, create the company and first Admin user, then sign in.

## Quality checks

```bash
npm test
npm run build
```

The test suite covers CSV parsing, working-day calculations, progressive tax brackets, payroll proration, and attendance/leave deductions.

## Deploy to Vercel

Import this repository into Vercel and add the same environment variables from `.env.local`. Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `AI_API_KEY` to the browser; neither variable may use the `NEXT_PUBLIC_` prefix.

## Demo flow

1. Complete first-run setup as Admin.
2. Add a department and designation, then create an HR user.
3. Sign in as HR and register an employee.
4. Sign in as the employee to check in, request leave, and view their dashboard.
5. Return as HR to approve the request and create a payroll draft.
6. Return as Admin to finalize payroll and download a payslip.
7. Use the AI assistant for a role-scoped dashboard question or smart leave request.
