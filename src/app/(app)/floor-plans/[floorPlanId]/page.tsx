import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { requireUser } from "@/lib/auth/session";
import { canEditStatus, canExport, canMapEquipment } from "@/lib/auth/types";
import { getFloorPlanViewerData } from "@/lib/floor-plan-view";
import { formatScopeSubtitle, formatZoneTabLabel } from "@/lib/labels";

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ floorPlanId: string }>;
}) {
  const user = await requireUser();
  const { floorPlanId } = await params;
  const data = await getFloorPlanViewerData(floorPlanId);
  if (!data) notFound();

  const { floorPlan, system, building, equipment, statusOptions, zones } = data;

  const zoneTabs =
    floorPlan.zoneId && zones.length > 0
      ? zones.map((z) => ({
          id: z.id,
          name: formatZoneTabLabel(building.name, z.name),
          href: `/zones/${z.id}`,
          active: z.id === floorPlan.zoneId,
        }))
      : undefined;

  const backHref = floorPlan.zoneId
    ? `/systems/${system.id}`
    : `/buildings/${building.id}`;

  const subtitle = formatScopeSubtitle(building.name, system.displayName);

  return (
    <FloorPlanViewer
      subtitle={subtitle}
      backHref={backHref}
      zones={zoneTabs}
      user={{ name: user.name, role: user.role }}
      floorPlanId={floorPlan.id}
      backgroundUrl={data.backgroundUrl}
      viewBox={data.viewBox}
      canvasWidth={data.canvasWidth}
      canvasHeight={data.canvasHeight}
      equipment={equipment}
      statusOptions={statusOptions}
      sourceFileLastUpdated={floorPlan.sourceFileLastUpdated}
      lastRefreshAt={floorPlan.lastRefreshAt}
      canEdit={canEditStatus(user.role)}
      canMap={canMapEquipment(user.role)}
      canExport={canExport(user.role)}
    />
  );
}
