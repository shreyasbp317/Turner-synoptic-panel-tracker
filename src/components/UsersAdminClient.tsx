"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/Toast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  active: boolean;
};

export function UsersAdminClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRow["role"]>("VIEWER");
  const [saving, setSaving] = useState(false);
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({});

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to create user");
      }
      const created = (await res.json()) as UserRow;
      setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setEmail("");
      setPassword("");
      setRole("VIEWER");
      toast.success("User created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "role" | "active" | "name" | "email">> & { password?: string }
  ) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to update user");
      }
      const updated = (await res.json()) as UserRow;
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      if (patch.password) {
        setResetPasswordById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast.success("Password updated");
      } else {
        toast.success("User updated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={createUser}
        className="grid gap-3 rounded-xl bg-[var(--card-bg)] p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          required
          placeholder="Name"
          className="rounded-md border border-[#ccc] bg-white px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          required
          type="email"
          placeholder="Email"
          className="rounded-md border border-[#ccc] bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          type="password"
          placeholder="Temporary password"
          className="rounded-md border border-[#ccc] bg-white px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          className="rounded-md border border-[#ccc] bg-white px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRow["role"])}
        >
          <option value="VIEWER">VIEWER</option>
          <option value="EDITOR">EDITOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[var(--navy)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Creating…" : "Add user"}
        </button>
      </form>

      <div className="overflow-auto rounded-xl border border-[#ddd] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--card-bg)] text-xs uppercase tracking-wide text-[#666]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[#eee]">
                <td className="px-3 py-2 font-medium text-[var(--navy)]">{u.name}</td>
                <td className="px-3 py-2">
                  <input
                    type="email"
                    className="w-full min-w-[12rem] rounded border border-[#ccc] bg-white px-2 py-1"
                    defaultValue={u.email}
                    onBlur={(e) => {
                      const next = e.target.value.trim().toLowerCase();
                      if (next && next !== u.email) {
                        void updateUser(u.id, { email: next });
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-[#ccc] bg-white px-2 py-1"
                    value={u.role}
                    onChange={(e) =>
                      void updateUser(u.id, { role: e.target.value as UserRow["role"] })
                    }
                  >
                    <option value="VIEWER">VIEWER</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={u.active}
                    onChange={(e) => void updateUser(u.id, { active: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex min-w-[14rem] items-center gap-2">
                    <input
                      type="password"
                      placeholder="New password"
                      className="w-full rounded border border-[#ccc] bg-white px-2 py-1"
                      value={resetPasswordById[u.id] ?? ""}
                      onChange={(e) =>
                        setResetPasswordById((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-md bg-[var(--navy)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      disabled={!resetPasswordById[u.id] || resetPasswordById[u.id].length < 8}
                      onClick={() =>
                        void updateUser(u.id, { password: resetPasswordById[u.id] })
                      }
                    >
                      Save
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
