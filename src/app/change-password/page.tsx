"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || "Could not change password"); setBusy(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Change your password</h1>
          <p className="text-sm text-slate-500 mt-1">Your account uses a temporary password. Choose a new one to continue.</p>
        </div>
        <div>
          <label className="label">New password (min 8 chars)</label>
          <input className="input" type="password" minLength={8} required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" minLength={8} required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
      </form>
    </main>
  );
}
