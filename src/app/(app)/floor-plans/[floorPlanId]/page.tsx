import { notFound } from "next/navigation";
import { FloorPlanViewer } from "@/components/FloorPlanViewer";
import { requireUser } from "@/lib/auth/session";
import { getFloorPlanViewerData } from "@/lib/floor-plan-view";
import { formatScopeSubtitle } from "@/lib/labels";

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ floorPlanId: string }>;
}) {
  const user = await requireUser();
  const { floorPlanId } = await params;
  const data = await getFloorPlanViewerData(floorPlanId);
  if (!data) notFound();

  const { floorPlan, system, building, equipment, statusOptions } = data;

  const backHref = `/buildings/${building.id}`;

  const subtitle = formatScopeSubtitle(building.name, system.displayName);

  return (
    <FloorPlanViewer
      subtitle={subtitle}
      backHref={backHref}
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
      canEdit
      canMap
      canExport
    />
  );
}
