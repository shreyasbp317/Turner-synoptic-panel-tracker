import { getFileStorage } from "@/lib/storage";
import { parseFloorPlanFile } from "@/lib/parsers";
import { prisma } from "@/lib/db";
import type { FloorPlanEquipment } from "@/components/FloorPlanCanvas";

export async function loadFloorPlanBackground(storagePath: string, originalFilename: string) {
  const storage = getFileStorage();
  const content = await storage.readText(storagePath);
  try {
    const parsed = parseFloorPlanFile(originalFilename, content);
    return {
      backgroundSvg: parsed.backgroundSvg,
      viewBox: parsed.viewBox ?? null,
      canvasWidth: parsed.canvasWidth ?? null,
      canvasHeight: parsed.canvasHeight ?? null,
    };
  } catch {
    // Fall back to raw content if re-parse fails (still usable for SVG backgrounds)
    return {
      backgroundSvg: content,
      viewBox: null as string | null,
      canvasWidth: null as number | null,
      canvasHeight: null as number | null,
    };
  }
}

export async function getFloorPlanViewerData(floorPlanId: string) {
  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    include: {
      equipment: {
        include: {
          currentStatusOption: true,
          updatedBy: { select: { name: true } },
        },
        orderBy: { shapeKey: "asc" },
      },
      zone: {
        include: {
          system: {
            include: {
              building: true,
              statusSet: { include: { options: { orderBy: { sortOrder: "asc" } } } },
              zones: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      system: {
        include: {
          building: true,
          statusSet: { include: { options: { orderBy: { sortOrder: "asc" } } } },
          zones: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!floorPlan) return null;

  const system = floorPlan.zone?.system ?? floorPlan.system;
  if (!system) return null;
  const zoneName = floorPlan.zone?.name ?? null;

  // Avoid inlining multi‑MB SVG backgrounds into RSC HTML; clients fetch via API.
  const bgMeta = {
    viewBox: floorPlan.viewBox,
    canvasWidth: floorPlan.canvasWidth,
    canvasHeight: floorPlan.canvasHeight,
  };

  const equipment: FloorPlanEquipment[] = floorPlan.equipment.map((eq) => ({
    id: eq.id,
    shapeKey: eq.shapeKey,
    shapeType: eq.shapeType,
    x: eq.x,
    y: eq.y,
    width: eq.width,
    height: eq.height,
    rawShapeData: eq.rawShapeData,
    equipmentTag: eq.equipmentTag,
    equipmentName: eq.equipmentName,
    equipmentType: eq.equipmentType,
    layer: eq.layer,
    currentStatus: {
      id: eq.currentStatusOption.id,
      label: eq.currentStatusOption.label,
      colorHex: eq.currentStatusOption.colorHex,
    },
    updatedAt: eq.updatedAt.toISOString(),
    updatedByName: eq.updatedBy?.name ?? null,
  }));

  const mappingEquipment = floorPlan.equipment.map((eq) => ({
    id: eq.id,
    shapeKey: eq.shapeKey,
    shapeType: eq.shapeType,
    x: eq.x,
    y: eq.y,
    width: eq.width,
    height: eq.height,
    rawShapeData: eq.rawShapeData,
    equipmentTag: eq.equipmentTag,
    equipmentName: eq.equipmentName,
    equipmentType: eq.equipmentType,
    layer: eq.layer,
    scheduleId: eq.scheduleId,
    scheduleActivity: eq.scheduleActivity,
    currentStatus: {
      id: eq.currentStatusOption.id,
      label: eq.currentStatusOption.label,
      colorHex: eq.currentStatusOption.colorHex,
    },
  }));

  const parseWarnings: { shapeKey?: string; message: string }[] = [];
  if (floorPlan.parseWarnings) {
    try {
      const parsed = JSON.parse(floorPlan.parseWarnings) as {
        shapeKey?: string;
        message: string;
      }[];
      if (Array.isArray(parsed)) parseWarnings.push(...parsed);
    } catch {
      /* ignore */
    }
  }

  return {
    floorPlan,
    system,
    building: system.building,
    zoneName,
    zones: "zones" in system ? system.zones : [],
    backgroundUrl: `/api/floor-plans/${floorPlan.id}/background`,
    viewBox: bgMeta.viewBox,
    canvasWidth: bgMeta.canvasWidth,
    canvasHeight: bgMeta.canvasHeight,
    equipment,
    mappingEquipment,
    statusOptions: system.statusSet.options.map((o) => ({
      id: o.id,
      label: o.label,
      colorHex: o.colorHex,
      sortOrder: o.sortOrder,
    })),
    parseWarnings,
  };
}
