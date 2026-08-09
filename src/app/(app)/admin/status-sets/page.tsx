import { AppHeader } from "@/components/AppHeader";
import { StatusSetsAdminClient } from "@/components/StatusSetsAdminClient";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function StatusSetsPage() {
  const user = await requireUser();
  const sets = await prisma.statusSet.findMany({
    orderBy: { key: "asc" },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle="Status sets"
        backHref="/"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        <StatusSetsAdminClient
          initialSets={sets.map((s) => ({
            id: s.id,
            key: s.key,
            options: s.options.map((o) => ({
              id: o.id,
              key: o.key,
              label: o.label,
              colorHex: o.colorHex,
              sortOrder: o.sortOrder,
              isDefault: o.isDefault,
            })),
          }))}
        />
      </main>
    </div>
  );
}
