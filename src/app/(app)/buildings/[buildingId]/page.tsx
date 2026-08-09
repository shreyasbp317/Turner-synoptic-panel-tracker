import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const user = await requireUser();
  const { buildingId } = await params;

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: {
      systems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!building) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={building.name}
        backHref="/"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {building.systems.map((sys) => (
            <Link
              key={sys.id}
              href={`/systems/${sys.id}`}
              className="rounded-xl bg-[var(--card-bg)] p-5 transition hover:bg-[var(--card-bg-soft)]"
            >
              <div className="text-lg font-bold text-[var(--navy)]">{sys.displayName}</div>
              <div className="mt-1 text-sm text-[var(--accent)]">{sys.systemType}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
