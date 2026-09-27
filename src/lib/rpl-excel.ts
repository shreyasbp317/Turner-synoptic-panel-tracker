import XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hallFromTag, normalizeEquipmentTag } from "@/lib/tags";

const STATUS_LABEL_ALIASES: Record<string, string> = {
  "pending delivery": "Pending Delivery",
  "pad ready": "Pad Ready",
  delivered: "Delivered",
  "set in place": "Set in Place",
  "delivered to tent": "Delivered to Tent",
  installed: "Installed",
  "just in time delivery": "Just In Time Delivery",
  "jit delivered": "Just In Time Delivery",
};

function excelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export type ExcelEquipmentRow = {
  tag: string;
  name: string | null;
  category: string | null;
  equipmentCategory: string | null;
  synopticArea: string | null;
  statusLabel: string | null;
  rojDate: Date | null;
};

/** Electrical categories on the shared Main (MES/FCM) drawing. */
export const ELECTRICAL_EQUIPMENT_CATEGORIES = [
  "LV and MV Electrical Skid",
  "Core and Control UPS",
  "Interior Rooms",
  "GS Hut",
];

/**
 * Electrical vs MES/FCM on a shared Main drawing.
 * Perimeter SSB / GS IDF / MDF rooms are electrical. HAC Electrical stays on HAC.
 */
export function isElectricalRow(row: ExcelEquipmentRow): boolean {
  const area = (row.synopticArea || "").toLowerCase();
  const cat = (row.equipmentCategory || "").toLowerCase();
  const name = (row.name || "").toLowerCase();
  const tag = (row.tag || "").toLowerCase();
  if (area.includes("hac") || cat.startsWith("hac")) return false;
  if (cat === "fcm" || cat === "mes" || cat === "twms") return false;
  if (area.includes("electrical")) return true;
  if (ELECTRICAL_EQUIPMENT_CATEGORIES.some((c) => cat === c.toLowerCase())) return true;
  if (/\belectrical skid\b|\blv and mv\b|\bcore and control ups\b|\bcontrol ups\b|\binterior rooms\b|\bgs hut\b/.test(cat)) {
    return true;
  }
  if (/\belectrical\b|\bssb\b|\bgs\.?idf\b|\bgs\.?mdf\b/.test(`${name} ${tag}`)) return true;
  return false;
}

export type ExcelMappingFilter = {
  synopticIncludes?: string | string[];
  categories?: string[];
  excludeCategories?: string[];
  electricalOnly?: boolean;
  excludeElectrical?: boolean;
  hideUnmatched?: boolean;
};

export function sharedMainExcelFilter(
  side: "mes" | "electrical"
): ExcelMappingFilter {
  return side === "electrical"
    ? { electricalOnly: true, hideUnmatched: true }
    : { excludeElectrical: true, hideUnmatched: true };
}

function categoryMatches(value: string | null, list: string[]): boolean {
  const cat = (value || "").trim().toLowerCase();
  return list.some((item) => item.trim().toLowerCase() === cat);
}

function synopticMatches(area: string, includes: string | string[]): boolean {
  const needles = Array.isArray(includes) ? includes : [includes];
  const hay = area.toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

export function rowMatchesExcelFilter(row: ExcelEquipmentRow, filter?: ExcelMappingFilter): boolean {
  if (!filter) return true;
  if (filter.synopticIncludes && !synopticMatches(row.synopticArea || "", filter.synopticIncludes)) {
    return false;
  }
  if (filter.electricalOnly && !isElectricalRow(row)) return false;
  if (filter.excludeElectrical && isElectricalRow(row)) return false;
  if (filter.categories?.length && !categoryMatches(row.equipmentCategory, filter.categories)) {
    return false;
  }
  if (
    filter.excludeCategories?.length &&
    categoryMatches(row.equipmentCategory, filter.excludeCategories)
  ) {
    return false;
  }
  return true;
}

export function loadRplSheet(filePath: string, sheetName: string): ExcelEquipmentRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Workbook is missing sheet "${sheetName}"`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const out: ExcelEquipmentRow[] = [];
  for (const r of rows) {
    const tag = normalizeEquipmentTag(String(r["Equipment Tag"] ?? ""));
    if (!tag) continue;
    const statusRaw = String(r["Final Status"] || r["Status"] || "").trim();
    const aliased = STATUS_LABEL_ALIASES[statusRaw.toLowerCase()];
    out.push({
      tag,
      name: String(r["Name"] ?? "").trim() || null,
      category: String(r["Category"] ?? "").trim() || null,
      equipmentCategory: String(r["Equipment Category"] ?? "").trim() || null,
      synopticArea: String(r["Synoptic Area"] ?? "").trim() || null,
      statusLabel: aliased || statusRaw || null,
      rojDate: excelDate(r["Set/Need By Date (ROJ)"]),
    });
  }
  return out;
}

export async function applyExcelMapping(opts: {
  prisma: PrismaClient;
  floorPlanId: string;
  rows: ExcelEquipmentRow[];
  filter?: ExcelMappingFilter;
}): Promise<{ matched: number; unmatched: number }> {
  const equipment = await opts.prisma.equipment.findMany({
    where: { floorPlanId: opts.floorPlanId },
    include: {
      floorPlan: {
        include: {
          zone: { include: { system: { include: { statusSet: { include: { options: true } } } } } },
          system: { include: { statusSet: { include: { options: true } } } },
        },
      },
    },
  });

  const options =
    equipment[0]?.floorPlan.zone?.system.statusSet.options ??
    equipment[0]?.floorPlan.system?.statusSet.options ??
    [];
  const optionByLabel = new Map(options.map((o) => [o.label.toLowerCase(), o.id]));
  const scopedRows = opts.rows.filter((r) => rowMatchesExcelFilter(r, opts.filter));
  const byTag = new Map(scopedRows.map((r) => [r.tag, r]));

  let matched = 0;
  let unmatched = 0;
  const updates: Array<{ id: string; data: Prisma.EquipmentUpdateInput }> = [];
  for (const eq of equipment) {
    const row = byTag.get(normalizeEquipmentTag(eq.equipmentTag || eq.shapeKey));
    if (!row) {
      unmatched += 1;
      if (opts.filter?.hideUnmatched) {
        updates.push({
          id: eq.id,
          data: {
            equipmentTag: null,
            equipmentName: null,
            equipmentType: null,
            layer: "background",
            notes: null,
            rojDate: null,
          },
        });
      }
      continue;
    }
    matched += 1;
    const statusId = row.statusLabel
      ? optionByLabel.get(row.statusLabel.toLowerCase())
      : undefined;
    updates.push({
      id: eq.id,
      data: {
        equipmentTag: row.tag,
        equipmentName: row.name || eq.equipmentName || row.tag,
        equipmentType: row.equipmentCategory || eq.equipmentType,
        layer: hallFromTag(row.tag) ?? (eq.layer === "background" ? null : eq.layer),
        notes: row.category ?? eq.notes,
        rojDate: row.rojDate,
        ...(statusId ? { currentStatusOptionId: statusId } : {}),
      },
    });
  }

  const chunkSize = 80;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await opts.prisma.$transaction(
      chunk.map((u) => opts.prisma.equipment.update({ where: { id: u.id }, data: u.data }))
    );
  }
  return { matched, unmatched };
}
