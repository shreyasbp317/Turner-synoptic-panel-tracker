import { notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MappingScreen } from "@/components/MappingScreen";
import { requireUser } from "@/lib/auth/session";
import { getFloorPlanViewerData } from "@/lib/floor-plan-view";
import { formatScopeSubtitle } from "@/lib/labels";

export default async function FloorPlanMapPage({
  params,
}: {
  params: Promise<{ floorPlanId: string }>;
}) {
  const user = await requireUser();
  const { floorPlanId } = await params;
  const data = await getFloorPlanViewerData(floorPlanId);
  if (!data) notFound();

  const { floorPlan, system, building, parseWarnings } = data;
  const subtitle = `${formatScopeSubtitle(building.name, system.displayName)} — Mapping`;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={subtitle}
        backHref={`/floor-plans/${floorPlanId}`}
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#555]">
            Click shapes to map equipment tags and metadata. Use CSV for bulk updates.
          </p>
          <Link
            href={`/floor-plans/${floorPlanId}`}
            className="text-sm font-medium text-[var(--navy)] hover:underline"
          >
            Back to viewer
          </Link>
        </div>
        <MappingScreen
          floorPlanId={floorPlan.id}
          backgroundUrl={data.backgroundUrl}
          viewBox={data.viewBox}
          canvasWidth={data.canvasWidth}
          canvasHeight={data.canvasHeight}
          equipment={data.mappingEquipment}
          parseWarnings={parseWarnings}
        />
      </main>
    </div>
  );
}
