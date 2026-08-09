import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";
import { canUpload } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

export default async function ZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const user = await requireUser();
  const { zoneId } = await params;

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: {
      system: {
        include: {
          building: true,
          zones: { orderBy: { sortOrder: "asc" } },
        },
      },
      floorPlans: {
        where: { active: true },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!zone) notFound();

  const activePlan = zone.floorPlans[0];
  if (activePlan) {
    redirect(`/floor-plans/${activePlan.id}`);
  }

  const zones = zone.system.zones.map((z) => ({
    id: z.id,
    name: z.name,
    href: `/zones/${z.id}`,
    active: z.id === zone.id,
  }));

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={`${zone.system.building.name} · ${zone.system.displayName}`}
        backHref={`/systems/${zone.systemId}`}
        zones={zones}
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-[var(--navy)]">{zone.name}</p>
        <p className="text-[#555]">No active floor plan for this zone yet.</p>
        {canUpload(user.role) ? (
          <Link
            href="/upload"
            className="rounded-md bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white"
          >
            Upload floor plan
          </Link>
        ) : null}
      </main>
    </div>
  );
}
