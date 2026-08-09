import { prisma } from "@/lib/db";
import { getFileStorage } from "@/lib/storage";
import { formatStatusHistoryExport } from "@/lib/services/equipment";
import Papa from "papaparse";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shapeFillOverlay(
  shapes: Array<{
    shapeKey: string;
    shapeType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rawShapeData: string | null;
    colorHex: string;
  }>
): string {
  const parts = shapes.map((s) => {
    const fill = s.colorHex;
    const opacity = "0.55";
    const stroke = "#333333";
    if (s.shapeType === "RECT") {
      return `<rect id="${escapeXml(s.shapeKey)}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1"/>`;
    }
    if (s.shapeType === "CIRCLE" && s.rawShapeData) {
      try {
        const p = JSON.parse(s.rawShapeData) as { cx: number; cy: number; r: number };
        return `<circle id="${escapeXml(s.shapeKey)}" cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1"/>`;
      } catch {
        /* fall through */
      }
    }
    if (s.shapeType === "PATH" && s.rawShapeData) {
      return `<path id="${escapeXml(s.shapeKey)}" d="${escapeXml(s.rawShapeData)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1"/>`;
    }
    if (s.shapeType === "POLYGON" && s.rawShapeData) {
      return `<polygon id="${escapeXml(s.shapeKey)}" points="${escapeXml(s.rawShapeData)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1"/>`;
    }
    return `<rect id="${escapeXml(s.shapeKey)}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1"/>`;
  });
  return `<g id="rpl10x-status-overlay">${parts.join("")}</g>`;
}

export async function exportFloorPlanFile(floorPlanId: string): Promise<{
  filename: string;
  contentType: string;
  body: string;
}> {
  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    include: {
      equipment: { include: { currentStatusOption: true } },
    },
  });
  if (!floorPlan) throw new Error("Floor plan not found.");

  const storage = getFileStorage();
  const original = await storage.readText(floorPlan.storagePath);

  if (floorPlan.sourceFormat === "JSVG") {
    const doc = JSON.parse(original) as {
      dataMapping?: { areas?: Record<string, unknown> };
      rects?: Record<string, unknown>;
      svg?: string;
      [key: string]: unknown;
    };

    const areas: Record<string, unknown> = { ...(doc.dataMapping?.areas || {}) };
    for (const eq of floorPlan.equipment) {
      areas[eq.shapeKey] = {
        equipmentTag: eq.equipmentTag,
        equipmentName: eq.equipmentName,
        equipmentType: eq.equipmentType,
        layer: eq.layer,
        status: eq.currentStatusOption.label,
        color: eq.currentStatusOption.colorHex,
      };
    }
    doc.dataMapping = { ...(doc.dataMapping || {}), areas };

    // Colorize matching rect elements inside embedded svg if present
    let svg = doc.svg || "";
    for (const eq of floorPlan.equipment) {
      const re = new RegExp(
        `(<(?:rect|path|polygon|circle)\\b[^>]*\\bid=["']${eq.shapeKey}["'][^>]*)(/?>)`,
        "i"
      );
      svg = svg.replace(re, (full, start: string, end: string) => {
        let next = start
          .replace(/\sfill=["'][^"']*["']/i, "")
          .replace(/\sfill-opacity=["'][^"']*["']/i, "");
        next += ` fill="${eq.currentStatusOption.colorHex}" fill-opacity="0.55"`;
        return `${next}${end}`;
      });
    }
    // Also append overlay group for safety
    if (svg.includes("</svg>")) {
      const overlay = shapeFillOverlay(
        floorPlan.equipment.map((eq) => ({
          shapeKey: eq.shapeKey,
          shapeType: eq.shapeType,
          x: eq.x,
          y: eq.y,
          width: eq.width,
          height: eq.height,
          rawShapeData: eq.rawShapeData,
          colorHex: eq.currentStatusOption.colorHex,
        }))
      );
      svg = svg.replace("</svg>", `${overlay}</svg>`);
    }
    doc.svg = svg;
    if (doc.meta && typeof doc.meta === "object") {
      (doc.meta as { updated?: string }).updated = new Date().toISOString();
    }

    return {
      filename: floorPlan.originalFilename.replace(/\.jsvg$/i, "") + "-updated.jsvg",
      contentType: "application/json",
      body: JSON.stringify(doc, null, 2),
    };
  }

  // Plain SVG
  let svg = original;
  for (const eq of floorPlan.equipment) {
    const re = new RegExp(
      `(<(?:rect|path|polygon|circle)\\b[^>]*\\bid=["']${eq.shapeKey}["'][^>]*)(/?>)`,
      "i"
    );
    svg = svg.replace(re, (full, start: string, end: string) => {
      let next = start
        .replace(/\sfill=["'][^"']*["']/i, "")
        .replace(/\sfill-opacity=["'][^"']*["']/i, "");
      next += ` fill="${eq.currentStatusOption.colorHex}" fill-opacity="0.55"`;
      return `${next}${end}`;
    });
  }
  if (svg.includes("</svg>")) {
    const overlay = shapeFillOverlay(
      floorPlan.equipment.map((eq) => ({
        shapeKey: eq.shapeKey,
        shapeType: eq.shapeType,
        x: eq.x,
        y: eq.y,
        width: eq.width,
        height: eq.height,
        rawShapeData: eq.rawShapeData,
        colorHex: eq.currentStatusOption.colorHex,
      }))
    );
    svg = svg.replace("</svg>", `${overlay}</svg>`);
  }

  return {
    filename: floorPlan.originalFilename.replace(/\.svg$/i, "") + "-updated.svg",
    contentType: "image/svg+xml",
    body: svg,
  };
}

export async function exportFloorPlanCsv(floorPlanId: string): Promise<{
  filename: string;
  body: string;
}> {
  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    include: {
      equipment: {
        include: {
          currentStatusOption: true,
          history: {
            include: {
              statusOption: true,
              changedBy: { select: { name: true } },
            },
            orderBy: { changedAt: "asc" },
          },
        },
        orderBy: [{ y: "asc" }, { x: "asc" }],
      },
    },
  });
  if (!floorPlan) throw new Error("Floor plan not found.");

  const rows = floorPlan.equipment.map((eq) => ({
    "Equipment Tag": eq.equipmentTag || "",
    "Equipment Name": eq.equipmentName || "",
    Layer: eq.layer || "",
    "Current Status": eq.currentStatusOption.label,
    "Status History": formatStatusHistoryExport(
      eq.history.map((h) => ({
        statusLabel: h.statusOption.label,
        changedByName: h.changedBy.name,
        changedAt: h.changedAt,
      }))
    ),
    "Shape Key": eq.shapeKey,
    "Equipment Type": eq.equipmentType || "",
    "Schedule ID": eq.scheduleId || "",
    "Schedule Activity": eq.scheduleActivity || "",
  }));

  return {
    filename: `${floorPlan.name || "floor-plan"}-status.csv`,
    body: Papa.unparse(rows),
  };
}
