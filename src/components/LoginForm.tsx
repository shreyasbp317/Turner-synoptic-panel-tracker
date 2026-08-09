"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-xl bg-[var(--card-bg)] p-6 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-[var(--navy)]">RPL-10X</h1>
      <p className="mt-1 text-sm font-medium text-[var(--accent)]">Sign in to continue</p>

      <label className="mt-6 block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#666]">
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#666]">
          Password
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-md bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
