import { AppHeader } from "@/components/AppHeader";
import { UploadPageClient } from "@/components/UploadPageClient";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { systemHasZones } from "@/lib/services/floor-plans";

export default async function UploadPage() {
  const user = await requireRole(["ADMIN"]);

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

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle="Upload floor plan"
        backHref="/"
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
        />
      </main>
    </div>
  );
}
