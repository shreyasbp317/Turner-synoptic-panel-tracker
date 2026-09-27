import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

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
      floorPlans: {
        where: { active: true, zoneId: null },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!system) notFound();

  const zonePlan = await prisma.floorPlan.findFirst({
    where: { active: true, zone: { systemId: system.id } },
    orderBy: { uploadedAt: "desc" },
  });
  const plan = system.floorPlans[0] ?? zonePlan;
  if (plan) {
    redirect(`/floor-plans/${plan.id}`);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6 text-center text-[var(--muted)]">
      No floor plan seeded for {system.building.name} · {system.displayName} yet.
    </div>
  );
}
