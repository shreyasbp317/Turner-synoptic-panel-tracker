import type { ParsedFloorPlan, ParsedShape, ParseWarning } from "./types";

type JsvgRect = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type JsvgDoc = {
  id?: string;
  name?: string;
  meta?: { created?: string; updated?: string };
  dataMapping?: {
    areas?: Record<
      string,
      | string
      | {
          name?: string;
          tag?: string;
          equipmentTag?: string;
          equipmentName?: string;
          equipmentType?: string;
          layer?: string;
          [key: string]: unknown;
        }
    >;
  };
  rects?: Record<string, JsvgRect>;
  svg?: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function extractViewBox(svg: string): {
  viewBox?: string;
  width?: number;
  height?: number;
} {
  const vb = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const width = num(svg.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1] ?? null) ?? undefined;
  const height = num(svg.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1] ?? null) ?? undefined;
  return { viewBox: vb, width, height };
}

type MappingAreaValue =
  | string
  | {
      name?: string;
      tag?: string;
      equipmentTag?: string;
      equipmentName?: string;
      equipmentType?: string;
      layer?: string;
      [key: string]: unknown;
    };

function mappingToFields(value: MappingAreaValue | null | undefined): Partial<ParsedShape> {
  if (value == null) return {};
  if (typeof value === "string") {
    return { equipmentTag: value, equipmentName: value };
  }
  const tag =
    (typeof value.equipmentTag === "string" && value.equipmentTag) ||
    (typeof value.tag === "string" && value.tag) ||
    (typeof value.name === "string" && value.name) ||
    undefined;
  return {
    equipmentTag: tag,
    equipmentName:
      (typeof value.equipmentName === "string" && value.equipmentName) ||
      (typeof value.name === "string" && value.name) ||
      tag,
    equipmentType: typeof value.equipmentType === "string" ? value.equipmentType : undefined,
    layer: typeof value.layer === "string" ? value.layer : undefined,
  };
}

export function parseJsvg(content: string, filename: string): ParsedFloorPlan {
  let doc: JsvgDoc;
  try {
    doc = JSON.parse(content) as JsvgDoc;
  } catch {
    throw new Error("Invalid .jsvg file: content is not valid JSON.");
  }

  if (!doc.svg || typeof doc.svg !== "string") {
    throw new Error('Invalid .jsvg file: missing required "svg" string field.');
  }
  if (!doc.rects || typeof doc.rects !== "object" || Array.isArray(doc.rects)) {
    throw new Error('Invalid .jsvg file: missing required "rects" object.');
  }

  const warnings: ParseWarning[] = [];
  const shapes: ParsedShape[] = [];
  const areas = doc.dataMapping?.areas ?? {};

  for (const [shapeKey, rect] of Object.entries(doc.rects)) {
    const x = num(rect?.x);
    const y = num(rect?.y);
    const width = num(rect?.width);
    const height = num(rect?.height);

    if (x == null || y == null || width == null || height == null) {
      warnings.push({
        shapeKey,
        message: `Shape "${shapeKey}" is missing x/y/width/height and was skipped.`,
      });
      continue;
    }

    const mapped = mappingToFields(areas[shapeKey]);
    shapes.push({
      shapeKey,
      shapeType: "RECT",
      x,
      y,
      width,
      height,
      rawShapeData: JSON.stringify({ x, y, width, height }),
      ...mapped,
    });
  }

  if (shapes.length === 0) {
    throw new Error("Invalid .jsvg file: no usable shapes found in \"rects\".");
  }

  const { viewBox, width, height } = extractViewBox(doc.svg);
  const updated = doc.meta?.updated ? new Date(doc.meta.updated) : undefined;

  return {
    format: "JSVG",
    name: doc.name || filename.replace(/\.jsvg$/i, ""),
    backgroundSvg: doc.svg,
    viewBox,
    canvasWidth: width,
    canvasHeight: height,
    sourceFileLastUpdated: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
    shapes,
    warnings,
    originalContent: content,
  };
}
