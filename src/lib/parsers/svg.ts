import { XMLParser } from "fast-xml-parser";
import type { ParsedFloorPlan, ParsedShape, ParseWarning } from "./types";

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

/** SVG matrix as [a, b, c, d, e, f] (column-major affine). */
type Mat = [number, number, number, number, number, number];

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function multiply(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMat(m: Mat, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function isIdentity(m: Mat): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

/** Parse SVG transform list (matrix/translate/scale/rotate) left-to-right. */
export function parseSvgTransform(transform: string | undefined): Mat {
  if (!transform?.trim()) return IDENTITY;
  let m = IDENTITY;
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(transform))) {
    const kind = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let next: Mat = IDENTITY;
    if (kind === "matrix" && args.length >= 6) {
      next = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (kind === "translate") {
      next = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
    } else if (kind === "scale") {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (kind === "rotate") {
      const angle = ((args[0] || 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cx = args[1] || 0;
      const cy = args[2] || 0;
      next = multiply(
        multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
        [1, 0, 0, 1, -cx, -cy]
      );
    }
    m = multiply(m, next);
  }
  return m;
}

function transformBBox(
  box: { x: number; y: number; width: number; height: number },
  transform: string | undefined
): { x: number; y: number; width: number; height: number } {
  const m = parseSvgTransform(transform);
  if (isIdentity(m)) return box;
  const corners = [
    applyMat(m, box.x, box.y),
    applyMat(m, box.x + box.width, box.y),
    applyMat(m, box.x, box.y + box.height),
    applyMat(m, box.x + box.width, box.y + box.height),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function tagFromId(id: string): string | undefined {
  if (/^(rect|path|polygon|circle)\d+$/i.test(id)) return undefined;
  // Synoptic Designer prefixes equipment ids with "_"
  return id.replace(/^_+/, "") || undefined;
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
  const transform = a.transform;

  const tryShape = (
    shapeType: ParsedShape["shapeType"],
    localBox: { x: number; y: number; width: number; height: number } | null,
    rawPayload: Record<string, unknown>
  ) => {
    if (!id || !looksLikeEquipmentId(id)) return;
    if (!localBox) {
      warnings.push({
        shapeKey: id,
        message: `Could not compute bounding box for <${shapeType.toLowerCase()} id="${id}">.`,
      });
      return;
    }
    const box = transformBBox(localBox, transform);
    const tag =
      a["data-equipment-tag"] ||
      a["data-tag"] ||
      a["data-name"] ||
      (a.title && !/^rect\d+$/i.test(a.title) ? a.title.replace(/^_+/, "") : undefined) ||
      tagFromId(id);

    if (transform) rawPayload.transform = transform;

    shapes.push({
      shapeKey: id,
      shapeType,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rawShapeData: JSON.stringify(rawPayload),
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
      tryShape("RECT", { x, y, width, height }, { x, y, width, height });
    }
  } else if (localName === "circle" && id) {
    const cx = num(a.cx) ?? 0;
    const cy = num(a.cy) ?? 0;
    const r = num(a.r) ?? 0;
    tryShape("CIRCLE", { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, { cx, cy, r });
  } else if (localName === "polygon" && id) {
    const points = a.points || "";
    tryShape("POLYGON", bboxFromPoints(points), { points });
  } else if (localName === "path" && id) {
    const d = a.d || "";
    tryShape("PATH", bboxFromPath(d), { d });
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
