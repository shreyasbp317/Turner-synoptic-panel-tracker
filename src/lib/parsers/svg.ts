import { XMLParser } from "fast-xml-parser";
import type { ParsedFloorPlan, ParsedShape, ParseWarning } from "./types";

// Lightweight dependency-free-ish SVG parse using regex + DOM-like walk via fast-xml-parser.
// Install fast-xml-parser if needed.

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function attrs(node: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("@_") && v != null) out[k.slice(2)] = String(v);
  }
  return out;
}

function bboxFromPoints(points: string): { x: number; y: number; width: number; height: number } | null {
  const pairs = points
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (pairs.length < 4) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < pairs.length - 1; i += 2) {
    minX = Math.min(minX, pairs[i]);
    maxX = Math.max(maxX, pairs[i]);
    minY = Math.min(minY, pairs[i + 1]);
    maxY = Math.max(maxY, pairs[i + 1]);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function bboxFromPath(d: string): { x: number; y: number; width: number; height: number } | null {
  const nums = [...d.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((m) => Number(m[0]));
  if (nums.length < 2) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  // Approximate: treat numbers as interleaved x,y where possible (good enough for hit-testing).
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function looksLikeEquipmentId(id: string): boolean {
  if (!id) return false;
  if (id === "svgcontent" || id.toLowerCase().includes("background")) return false;
  return true;
}

function walk(
  node: unknown,
  shapes: ParsedShape[],
  warnings: ParseWarning[],
  tagNameHint?: string
) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, shapes, warnings, tagNameHint);
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const a = attrs(obj);
  const id = a.id;

  const tryShape = (
    shapeType: ParsedShape["shapeType"],
    box: { x: number; y: number; width: number; height: number } | null,
    raw?: string
  ) => {
    if (!id || !looksLikeEquipmentId(id)) return;
    if (!box) {
      warnings.push({ shapeKey: id, message: `Could not compute bounding box for <${shapeType.toLowerCase()} id="${id}">.` });
      return;
    }
    const tag =
      a["data-equipment-tag"] ||
      a["data-tag"] ||
      a["data-name"] ||
      (a.title && !/^rect\d+$/i.test(a.title) ? a.title : undefined) ||
      (!/^rect\d+$/i.test(id) && !/^path\d+$/i.test(id) && !/^polygon\d+$/i.test(id) && !/^circle\d+$/i.test(id)
        ? id
        : undefined);

    shapes.push({
      shapeKey: id,
      shapeType,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rawShapeData: raw,
      equipmentTag: tag,
      equipmentName: a["data-equipment-name"] || tag,
      equipmentType: a["data-equipment-type"],
      layer: a["data-layer"] || a.layer,
    });
  };

  const localName = tagNameHint?.toLowerCase();

  if (localName === "rect" && id) {
    const x = num(a.x) ?? 0;
    const y = num(a.y) ?? 0;
    const width = num(a.width);
    const height = num(a.height);
    if (width == null || height == null) {
      warnings.push({ shapeKey: id, message: `Rect "${id}" missing width/height.` });
    } else {
      tryShape("RECT", { x, y, width, height }, JSON.stringify({ x, y, width, height }));
    }
  } else if (localName === "circle" && id) {
    const cx = num(a.cx) ?? 0;
    const cy = num(a.cy) ?? 0;
    const r = num(a.r) ?? 0;
    tryShape("CIRCLE", { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, JSON.stringify({ cx, cy, r }));
  } else if (localName === "polygon" && id) {
    const points = a.points || "";
    tryShape("POLYGON", bboxFromPoints(points), points);
  } else if (localName === "path" && id) {
    const d = a.d || "";
    tryShape("PATH", bboxFromPath(d), d);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_") || key === "#text" || key === "#cdata") continue;
    walk(value, shapes, warnings, key);
  }
}

export function parseSvg(content: string, filename: string): ParsedFloorPlan {
  const trimmed = content.trim();
  if (!trimmed.includes("<svg") && !trimmed.includes("<SVG")) {
    throw new Error("Invalid .svg file: root <svg> element not found.");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: false,
    allowBooleanAttributes: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(trimmed);
  } catch {
    throw new Error("Invalid .svg file: XML parse failed.");
  }

  const svgNode = (parsed.svg || parsed.SVG) as Record<string, unknown> | undefined;
  if (!svgNode) {
    throw new Error("Invalid .svg file: could not locate <svg> root.");
  }

  const a = attrs(svgNode);
  const viewBox = a.viewBox;
  const canvasWidth = num(a.width) ?? undefined;
  const canvasHeight = num(a.height) ?? undefined;

  const shapes: ParsedShape[] = [];
  const warnings: ParseWarning[] = [];
  walk(svgNode, shapes, warnings);

  if (shapes.length === 0) {
    throw new Error(
      "Invalid .svg file: no equipment shapes found. Equipment shapes must be <rect>, <path>, <polygon>, or <circle> elements with an id attribute."
    );
  }

  return {
    format: "SVG",
    name: filename.replace(/\.svg$/i, ""),
    backgroundSvg: trimmed,
    viewBox,
    canvasWidth,
    canvasHeight,
    shapes,
    warnings,
    originalContent: content,
  };
}
