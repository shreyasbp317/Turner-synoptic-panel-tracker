import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-full flex-1 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[var(--navy)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#3a6fd6]/30 blur-3xl" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">Turner · RPL</p>
          <h2 className="mt-6 max-w-md text-4xl font-extrabold leading-tight">
            Synoptic status for every hall, skid, and yard.
          </h2>
        </div>
        <p className="max-w-sm text-sm text-white/60">
          Track delivery, pad-ready, and set-in-place progress across RPL 1–5 with live floor
          plans and ROJ dates.
        </p>
      </section>
      <section className="flex items-center justify-center bg-[var(--navy-deep)] p-6 sm:p-10">
        <LoginForm />
      </section>
    </main>
  );
}
