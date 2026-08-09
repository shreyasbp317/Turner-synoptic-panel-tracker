import { prisma } from "@/lib/db";
import { getFileStorage } from "@/lib/storage";
import { parseFloorPlanFile, type ParsedFloorPlan } from "@/lib/parsers";
import type { SourceFormat, SystemType } from "@prisma/client";
import path from "path";
import { randomUUID } from "crypto";

export function systemHasZones(systemType: SystemType): boolean {
  return (
    systemType === "MES_FCM" ||
    systemType === "TWMS" ||
    systemType === "HAC"
  );
}

export async function getDefaultStatusOptionId(statusSetId: string): Promise<string> {
  const option = await prisma.statusSetOption.findFirst({
    where: { statusSetId, isDefault: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!option) {
    throw new Error("Status set has no default option configured.");
  }
  return option.id;
}

export type UploadTarget = {
  buildingId: string;
  systemId: string;
  zoneId?: string | null;
  name?: string;
};

export type UploadResult = {
  floorPlanId: string;
  warnings: { shapeKey?: string; message: string }[];
  mappingCarryForward: {
    matched: number;
    newShapes: string[];
    missingShapes: string[];
  };
};

async function resolveParent(target: UploadTarget) {
  const system = await prisma.system.findUnique({
    where: { id: target.systemId },
    include: { building: true, statusSet: true },
  });
  if (!system || system.buildingId !== target.buildingId) {
    throw new Error("Invalid building/system selection.");
  }

  const hasZones = systemHasZones(system.systemType);
  if (hasZones) {
    if (!target.zoneId) throw new Error("A Data Hall (zone) is required for this system.");
    const zone = await prisma.zone.findUnique({ where: { id: target.zoneId } });
    if (!zone || zone.systemId !== system.id) {
      throw new Error("Invalid zone for the selected system.");
    }
    return { system, zone, hasZones };
  }

  if (target.zoneId) {
    throw new Error("This system does not use zones; omit zoneId.");
  }
  return { system, zone: null, hasZones };
}

export async function uploadFloorPlan(opts: {
  target: UploadTarget;
  filename: string;
  content: Buffer | string;
  uploadedById: string;
}): Promise<UploadResult> {
  const text = typeof opts.content === "string" ? opts.content : opts.content.toString("utf8");
  let parsed: ParsedFloorPlan;
  try {
    parsed = parseFloorPlanFile(opts.filename, text);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to parse floor plan file.");
  }

  const { system, zone, hasZones } = await resolveParent(opts.target);
  const defaultStatusId = await getDefaultStatusOptionId(system.statusSetId);
  const storage = getFileStorage();
  const id = randomUUID();
  const ext = parsed.format === "JSVG" ? "jsvg" : "svg";
  const storagePath = path.posix.join(
    "floor-plans",
    system.buildingId,
    system.id,
    zone?.id || "system",
    `${id}.${ext}`
  );

  await storage.save(storagePath, text);

  const previous = await prisma.floorPlan.findFirst({
    where: hasZones
      ? { zoneId: zone!.id, active: true }
      : { systemId: system.id, zoneId: null, active: true },
    include: { equipment: true },
  });

  const previousByKey = new Map(previous?.equipment.map((e) => [e.shapeKey, e]) ?? []);
  const newShapeKeys: string[] = [];
  const matchedKeys = new Set<string>();

  const floorPlan = await prisma.$transaction(async (tx) => {
    if (previous) {
      await tx.floorPlan.update({
        where: { id: previous.id },
        data: { active: false },
      });
    }

    const created = await tx.floorPlan.create({
      data: {
        zoneId: zone?.id ?? null,
        systemId: hasZones ? null : system.id,
        name: opts.target.name || parsed.name,
        originalFilename: opts.filename,
        sourceFormat: parsed.format as SourceFormat,
        storagePath,
        backgroundAssetPath: null,
        viewBox: parsed.viewBox ?? null,
        canvasWidth: parsed.canvasWidth ?? null,
        canvasHeight: parsed.canvasHeight ?? null,
        uploadedById: opts.uploadedById,
        sourceFileLastUpdated: parsed.sourceFileLastUpdated ?? null,
        lastRefreshAt: new Date(),
        active: true,
        parseWarnings:
          parsed.warnings.length > 0 ? JSON.stringify(parsed.warnings) : null,
      },
    });

    for (const shape of parsed.shapes) {
      const prior = previousByKey.get(shape.shapeKey);
      if (prior) matchedKeys.add(shape.shapeKey);
      else newShapeKeys.push(shape.shapeKey);

      await tx.equipment.create({
        data: {
          floorPlanId: created.id,
          shapeKey: shape.shapeKey,
          shapeType: shape.shapeType,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rawShapeData: shape.rawShapeData ?? null,
          equipmentTag: shape.equipmentTag ?? prior?.equipmentTag ?? null,
          equipmentName: shape.equipmentName ?? prior?.equipmentName ?? null,
          equipmentType: shape.equipmentType ?? prior?.equipmentType ?? null,
          layer: shape.layer ?? prior?.layer ?? null,
          notes: prior?.notes ?? null,
          scheduleId: prior?.scheduleId ?? null,
          scheduleActivity: prior?.scheduleActivity ?? null,
          currentStatusOptionId: prior?.currentStatusOptionId ?? defaultStatusId,
          updatedById: opts.uploadedById,
        },
      });
    }

    // Seed history for brand-new equipment only
    const createdEquipment = await tx.equipment.findMany({
      where: { floorPlanId: created.id },
      select: { id: true, shapeKey: true, currentStatusOptionId: true },
    });

    for (const eq of createdEquipment) {
      if (!previousByKey.has(eq.shapeKey)) {
        await tx.statusHistory.create({
          data: {
            equipmentId: eq.id,
            statusOptionId: eq.currentStatusOptionId,
            changedById: opts.uploadedById,
            note: "Initial status on upload",
          },
        });
      } else {
        // Carry forward history conceptually by copying recent history rows
        const prior = previousByKey.get(eq.shapeKey)!;
        const hist = await tx.statusHistory.findMany({
          where: { equipmentId: prior.id },
          orderBy: { changedAt: "asc" },
        });
        for (const h of hist) {
          await tx.statusHistory.create({
            data: {
              equipmentId: eq.id,
              statusOptionId: h.statusOptionId,
              changedById: h.changedById,
              changedAt: h.changedAt,
              note: h.note,
            },
          });
        }
      }
    }

    return created;
  });

  const missingShapes = [...previousByKey.keys()].filter((k) => !matchedKeys.has(k) && !parsed.shapes.some((s) => s.shapeKey === k));

  return {
    floorPlanId: floorPlan.id,
    warnings: parsed.warnings,
    mappingCarryForward: {
      matched: matchedKeys.size,
      newShapes: newShapeKeys,
      missingShapes,
    },
  };
}
