/** Format a date for UI display as MM-DD-YYYY. */
export function formatUiDate(d: Date | string | null | undefined): string {
  if (d == null || d === "") return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
}

/**
 * Stable placeholder ROJ date from an equipment id.
 * Same id always returns the same date so hover/panel stay consistent until real ROJ data exists.
 */
export function placeholderRojDate(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const start = Date.UTC(2026, 0, 1);
  const dayOffset = Math.abs(hash) % 365;
  return new Date(start + dayOffset * 86_400_000).toISOString();
}

/** Temporary shared sample until each equipment has its own file. */
export const SAMPLE_SUBMITTAL_URL = "/docs/sample-submittal.pdf";
