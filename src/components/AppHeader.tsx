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
  return (
    <header className="sticky top-0 z-30 bg-[var(--navy)] px-4 py-2.5 text-white shadow-lg shadow-[var(--navy)]/20 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              <Link href="/" className="hover:opacity-90">
                {title}
              </Link>
            </h1>
            <p className="text-sm font-semibold text-[var(--accent-soft)] sm:text-base">
              {subtitle}
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <nav className="flex flex-wrap items-center gap-2" aria-label="App">
              <Link
                href="/users"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
              >
                Users
              </Link>
              <Link
                href="/admin/status-sets"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
              >
                Status sets
              </Link>
            </nav>
            <div className="px-1 text-right text-white/80">
              <div className="font-semibold text-white">{user.name}</div>
              <div className="text-[11px] uppercase tracking-wide text-white/50">{user.role}</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-soft)]"
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
                  ? "bg-white text-[var(--navy)] shadow-sm"
                  : "bg-white/10 text-white/85 hover:bg-white/20"
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
