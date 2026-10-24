import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/org";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">HC</div>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">First-run setup</h1>
          <p className="text-sm text-slate-500">Create your company and the first Admin account. This can be done only once.</p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
