import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers, canUpload, canEditStatusSets } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

export default async function BuildingsPage() {
  const user = await requireUser();
  const buildings = await prisma.building.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { systems: true } } },
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle="Select a building"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        {(canUpload(user.role) || canManageUsers(user.role) || canEditStatusSets(user.role)) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {canUpload(user.role) ? (
              <Link
                href="/upload"
                className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Upload floor plan
              </Link>
            ) : null}
            {canManageUsers(user.role) ? (
              <Link
                href="/users"
                className="rounded-md border border-[#0B2A5B]/30 bg-white px-3 py-1.5 text-sm font-medium text-[var(--navy)]"
              >
                Users
              </Link>
            ) : null}
            {canEditStatusSets(user.role) ? (
              <Link
                href="/admin/status-sets"
                className="rounded-md border border-[#0B2A5B]/30 bg-white px-3 py-1.5 text-sm font-medium text-[var(--navy)]"
              >
                Status sets
              </Link>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {buildings.map((b) => (
            <Link
              key={b.id}
              href={`/buildings/${b.id}`}
              className="rounded-xl bg-[var(--card-bg)] p-5 transition hover:bg-[var(--card-bg-soft)]"
            >
              <div className="text-xl font-bold text-[var(--navy)]">{b.name}</div>
              <div className="mt-1 text-sm text-[#666]">
                {b._count.systems} system{b._count.systems === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
