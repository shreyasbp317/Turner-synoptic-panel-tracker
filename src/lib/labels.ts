/** Display helpers for Power BI-style labels. */

export function formatBuildingLabel(name: string): string {
  // "RPL 1" → "RPL-1"
  return name.replace(/^RPL\s+/i, "RPL-");
}

export function formatScopeSubtitle(buildingName: string, systemDisplayName: string): string {
  return `${formatBuildingLabel(buildingName)} ${systemDisplayName}`;
}

/** "Data Hall A" → `RPL-1 Data Hall "A"` */
export function formatZoneTabLabel(buildingName: string, zoneName: string): string {
  const letterMatch = zoneName.match(/Data Hall\s+([A-D])/i);
  if (letterMatch) {
    return `${formatBuildingLabel(buildingName)} Data Hall "${letterMatch[1].toUpperCase()}"`;
  }
  return `${formatBuildingLabel(buildingName)} ${zoneName}`;
}
