import { AppHeader } from "@/components/AppHeader";
import { UploadPageClient } from "@/components/UploadPageClient";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatScopeSubtitle } from "@/lib/labels";
import { systemHasZones } from "@/lib/services/floor-plans";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    buildingId?: string;
    systemId?: string;
    zoneId?: string;
    name?: string;
    replace?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const buildings = await prisma.building.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  const systems = await prisma.system.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      buildingId: true,
      displayName: true,
      systemType: true,
    },
  });
  const zones = await prisma.zone.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, systemId: true, name: true },
  });

  const replaceMode = params.replace === "1" || params.replace === "true";
  const building = buildings.find((b) => b.id === params.buildingId);
  const system = systems.find((s) => s.id === params.systemId);
  const zone = zones.find((z) => z.id === params.zoneId);

  let replaceLabel: string | undefined;
  if (building && system) {
    replaceLabel = formatScopeSubtitle(building.name, system.displayName);
    if (zone) replaceLabel += ` · ${zone.name}`;
  }

  const backHref =
    params.zoneId
      ? `/zones/${params.zoneId}`
      : params.systemId
        ? `/systems/${params.systemId}`
        : "/";

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={replaceMode ? "Replace floor plan" : "Upload floor plan"}
        backHref={backHref}
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        <UploadPageClient
          buildings={buildings}
          systems={systems.map((s) => ({
            id: s.id,
            buildingId: s.buildingId,
            displayName: s.displayName,
            hasZones: systemHasZones(s.systemType),
          }))}
          zones={zones}
          initialBuildingId={params.buildingId || ""}
          initialSystemId={params.systemId || ""}
          initialZoneId={params.zoneId || ""}
          initialName={params.name || ""}
          replaceMode={replaceMode}
          replaceLabel={replaceLabel}
        />
      </main>
    </div>
  );
}
