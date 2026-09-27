export function normalizeEquipmentTag(value: string): string {
  return value
    .replace(/^_+/, "")
    .replace(/_x([0-9A-Fa-f]{2})_/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .trim()
    .toUpperCase();
}

export function hallFromTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const m = tag.match(/DH([ABCD])/i);
  if (!m) return null;
  return `Data Hall ${m[1].toUpperCase()}`;
}
