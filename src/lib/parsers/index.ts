import { parseJsvg } from "./jsvg";
import { parseSvg } from "./svg";
import type { ParsedFloorPlan } from "./types";

export function detectFormat(filename: string, content: string): "SVG" | "JSVG" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jsvg")) return "JSVG";
  if (lower.endsWith(".svg")) return "SVG";

  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      if (json && typeof json === "object" && typeof json.svg === "string" && json.rects) {
        return "JSVG";
      }
    } catch {
      /* fall through */
    }
  }
  if (trimmed.includes("<svg") || trimmed.includes("<SVG")) return "SVG";
  return null;
}

export function parseFloorPlanFile(filename: string, content: string): ParsedFloorPlan {
  const format = detectFormat(filename, content);
  if (!format) {
    throw new Error(
      `Unsupported file type for "${filename}". Upload a valid .svg or .jsvg floor plan file.`
    );
  }
  if (format === "JSVG") return parseJsvg(content, filename);
  return parseSvg(content, filename);
}

export * from "./types";
