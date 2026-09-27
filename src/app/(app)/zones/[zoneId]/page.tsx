import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function ZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  await requireUser();
  const { zoneId } = await params;

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: {
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

  const siblingPlan = await prisma.floorPlan.findFirst({
    where: {
      active: true,
      zone: { systemId: zone.systemId },
    },
    orderBy: { uploadedAt: "desc" },
  });
  if (siblingPlan) {
    redirect(`/floor-plans/${siblingPlan.id}`);
  }

  redirect(`/systems/${zone.systemId}`);
}
