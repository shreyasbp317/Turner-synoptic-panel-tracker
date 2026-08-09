import Papa from "papaparse";
import { prisma } from "@/lib/db";

export type MappingPreviewRow = {
  shapeKey: string;
  equipmentId: string;
  equipmentTag: string | null;
  equipmentName: string | null;
  equipmentType: string | null;
  layer: string | null;
  scheduleId: string | null;
  scheduleActivity: string | null;
  matchMethod: "shape_key" | "row_order";
  csvRowIndex: number;
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function pick(row: Record<string, string>, aliases: string[]): string | null {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const want = normHeader(alias);
    const found = entries.find(([k]) => normHeader(k) === want);
    if (found && found[1]?.trim()) return found[1].trim();
  }
  return null;
}

export function previewCsvMapping(opts: {
  csvText: string;
  equipment: Array<{
    id: string;
    shapeKey: string;
    x: number;
    y: number;
    equipmentTag: string | null;
    equipmentName: string | null;
    equipmentType: string | null;
    layer: string | null;
    scheduleId: string | null;
    scheduleActivity: string | null;
  }>;
}): { rows: MappingPreviewRow[]; warnings: string[] } {
  const parsed = Papa.parse<Record<string, string>>(opts.csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row ?? "?"})`);
  }

  const data = parsed.data;
  if (data.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  const headers = Object.keys(data[0] || {}).map(normHeader);
  const hasTag = headers.some((h) => h === "equipment tag" || h === "tag");
  if (!hasTag) {
    throw new Error('CSV must include an "Equipment Tag" column.');
  }

  const sorted = [...opts.equipment].sort((a, b) => a.y - b.y || a.x - b.x);
  const byKey = new Map(opts.equipment.map((e) => [e.shapeKey, e]));
  const warnings: string[] = [];
  const rows: MappingPreviewRow[] = [];
  const usedIds = new Set<string>();

  data.forEach((raw, index) => {
    const equipmentTag = pick(raw, ["Equipment Tag", "Tag", "equipment_tag"]);
    if (!equipmentTag) {
      warnings.push(`Row ${index + 2}: missing Equipment Tag — skipped.`);
      return;
    }

    const shapeKeyCol = pick(raw, ["shape_key", "Shape Key", "shapeKey", "Shape ID", "id"]);
    let target = shapeKeyCol ? byKey.get(shapeKeyCol) : undefined;
    let matchMethod: MappingPreviewRow["matchMethod"] = "shape_key";

    if (!target) {
      target = sorted[index];
      matchMethod = "row_order";
      if (shapeKeyCol) {
        warnings.push(
          `Row ${index + 2}: shape_key "${shapeKeyCol}" not found — falling back to row order.`
        );
      }
    }

    if (!target) {
      warnings.push(`Row ${index + 2}: no matching shape for tag "${equipmentTag}".`);
      return;
    }

    if (usedIds.has(target.id)) {
      warnings.push(
        `Row ${index + 2}: shape ${target.shapeKey} already paired — duplicate assignment.`
      );
    }
    usedIds.add(target.id);

    rows.push({
      shapeKey: target.shapeKey,
      equipmentId: target.id,
      equipmentTag,
      equipmentName:
        pick(raw, ["Equipment Name", "Name", "equipment_name", "Subject"]) || equipmentTag,
      equipmentType: pick(raw, ["Equipment Type", "Type", "equipment_type"]),
      layer: pick(raw, ["Layer", "layer"]),
      scheduleId: pick(raw, ["Schedule ID", "Schedule Id", "schedule_id"]),
      scheduleActivity: pick(raw, ["Schedule Activity", "schedule_activity"]),
      matchMethod,
      csvRowIndex: index + 2,
    });
  });

  if (data.length > opts.equipment.length) {
    warnings.push(
      `CSV has ${data.length} rows but floor plan has ${opts.equipment.length} shapes.`
    );
  } else if (data.length < opts.equipment.length) {
    warnings.push(
      `CSV has ${data.length} rows; ${opts.equipment.length - data.length} shapes will remain unchanged.`
    );
  }

  return { rows, warnings };
}

export async function commitCsvMapping(
  floorPlanId: string,
  rows: Array<{
    equipmentId?: string;
    shapeKey?: string;
    equipmentTag?: string | null;
    equipmentName?: string | null;
    equipmentType?: string | null;
    layer?: string | null;
    scheduleId?: string | null;
    scheduleActivity?: string | null;
  }>
) {
  const equipment = await prisma.equipment.findMany({
    where: { floorPlanId },
    include: { currentStatusOption: true },
  });
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const byKey = new Map(equipment.map((e) => [e.shapeKey, e]));

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const target =
        (row.equipmentId && byId.get(row.equipmentId)) ||
        (row.shapeKey && byKey.get(row.shapeKey)) ||
        null;
      if (!target) continue;

      await tx.equipment.update({
        where: { id: target.id },
        data: {
          equipmentTag: row.equipmentTag ?? target.equipmentTag,
          equipmentName: row.equipmentName ?? target.equipmentName,
          equipmentType: row.equipmentType ?? target.equipmentType,
          layer: row.layer ?? target.layer,
          scheduleId: row.scheduleId ?? target.scheduleId,
          scheduleActivity: row.scheduleActivity ?? target.scheduleActivity,
        },
      });
    }

    await tx.floorPlan.update({
      where: { id: floorPlanId },
      data: { lastRefreshAt: new Date() },
    });
  });

  const refreshed = await prisma.equipment.findMany({
    where: { floorPlanId },
    include: { currentStatusOption: true },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });

  return refreshed.map((eq) => ({
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
}
