"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Invalid email or password");
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-soft)]">
          Equipment tracker
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-white">RPL-10X</h1>
        <p className="mt-2 text-sm text-white/70">Sign in to continue to the synoptic dashboard.</p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/60">
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-[var(--accent-soft)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/60">
          Password
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-white outline-none focus:border-[var(--accent-soft)]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-soft)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
