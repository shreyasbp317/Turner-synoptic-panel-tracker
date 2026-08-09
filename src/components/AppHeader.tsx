import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export type AppHeaderZone = {
  id: string;
  name: string;
  href: string;
  active?: boolean;
};

export type AppHeaderUser = {
  name: string;
  role: string;
};

export type AppHeaderProps = {
  title?: string;
  subtitle: string;
  backHref?: string;
  zones?: AppHeaderZone[];
  user?: AppHeaderUser;
};

export function AppHeader({
  title = "RPL-10X",
  subtitle,
  backHref,
  zones,
  user,
}: AppHeaderProps) {
  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="border-b border-[#d0d0d0] bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#0B2A5B]/30 bg-[#F0F0F0] text-[var(--navy)] hover:bg-[#E0E0E0]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)] sm:text-3xl">
              <Link href="/" className="hover:underline">
                {title}
              </Link>
            </h1>
            <p className="mt-0.5 text-base font-semibold text-[var(--accent)] sm:text-lg">
              {subtitle}
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-[var(--navy)]">
            {isAdmin ? (
              <nav className="flex flex-wrap items-center gap-2" aria-label="Admin">
                <Link
                  href="/upload"
                  className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Upload
                </Link>
                <Link
                  href="/users"
                  className="rounded-md border border-[#0B2A5B]/25 bg-[#F0F0F0] px-3 py-1.5 text-sm font-medium hover:bg-[#E0E0E0]"
                >
                  Users
                </Link>
                <Link
                  href="/admin/status-sets"
                  className="rounded-md border border-[#0B2A5B]/25 bg-[#F0F0F0] px-3 py-1.5 text-sm font-medium hover:bg-[#E0E0E0]"
                >
                  Status sets
                </Link>
              </nav>
            ) : null}
            <div className="text-right">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs uppercase tracking-wide text-[#666]">
                {user.role}
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-[#0B2A5B]/25 bg-[#F0F0F0] px-3 py-1.5 text-sm font-medium hover:bg-[#E0E0E0]"
              >
                Logout
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {zones && zones.length > 0 ? (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Zones">
          {zones.map((z) => (
            <Link
              key={z.id}
              href={z.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                z.active
                  ? "bg-[var(--navy)] text-white"
                  : "bg-[#D8DEE8] text-[var(--navy)] hover:bg-[#C8D0DC]"
              }`}
            >
              {z.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
