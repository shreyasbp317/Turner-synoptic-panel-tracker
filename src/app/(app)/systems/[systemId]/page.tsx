import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { systemHasZones } from "@/lib/services/floor-plans";

export default async function SystemPage({
  params,
}: {
  params: Promise<{ systemId: string }>;
}) {
  const user = await requireUser();
  const { systemId } = await params;

  const system = await prisma.system.findUnique({
    where: { id: systemId },
    include: {
      building: true,
      zones: { orderBy: { sortOrder: "asc" } },
      floorPlans: {
        where: { active: true, zoneId: null },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!system) notFound();

  const hasZones = systemHasZones(system.systemType);
  const subtitle = `${system.building.name} · ${system.displayName}`;

  if (hasZones) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader
          subtitle={subtitle}
          backHref={`/buildings/${system.buildingId}`}
          user={{ name: user.name, role: user.role }}
        />
        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#666]">
              Data Halls
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {system.zones.map((zone) => (
                <Link
                  key={zone.id}
                  href={`/zones/${zone.id}`}
                  className="rounded-xl bg-[var(--card-bg)] p-4 font-semibold text-[var(--navy)] hover:bg-[var(--card-bg-soft)]"
                >
                  {zone.name}
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  const activePlan = system.floorPlans[0];
  if (activePlan) {
    redirect(`/floor-plans/${activePlan.id}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={subtitle}
        backHref={`/buildings/${system.buildingId}`}
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[#555]">No active floor plan for this system yet.</p>
        <Link
          href="/upload"
          className="rounded-md bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white"
        >
          Upload floor plan
        </Link>
      </main>
    </div>
  );
}
