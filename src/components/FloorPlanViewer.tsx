"use client";

import { useMemo, useState } from "react";
import { AppHeader, type AppHeaderZone } from "@/components/AppHeader";
import { InfoFilterRow } from "@/components/InfoFilterRow";
import { OverviewCharts, type OverviewGroup } from "@/components/OverviewCharts";
import {
  FloorPlanCanvas,
  type FloorPlanEquipment,
  type FloorPlanStatusOption,
} from "@/components/FloorPlanCanvas";

export type FloorPlanViewerProps = {
  subtitle: string;
  backHref?: string;
  zones?: AppHeaderZone[];
  user: { name: string; role: string };
  floorPlanId: string;
  backgroundUrl: string;
  viewBox?: string | null;
  canvasWidth?: number | null;
  canvasHeight?: number | null;
  equipment: FloorPlanEquipment[];
  statusOptions: FloorPlanStatusOption[];
  sourceFileLastUpdated?: string | Date | null;
  lastRefreshAt?: string | Date | null;
  canEdit: boolean;
  canMap: boolean;
  canExport: boolean;
};

function buildOverviewGroups(
  equipment: FloorPlanEquipment[],
  nameFilter: string,
  statusFilter: string
): OverviewGroup[] {
  const filtered = equipment.filter((eq) => {
    const nameOk =
      nameFilter === "all" ||
      eq.equipmentTag === nameFilter ||
      eq.equipmentName === nameFilter ||
      eq.id === nameFilter;
    const statusOk = statusFilter === "all" || eq.currentStatus.id === statusFilter;
    return nameOk && statusOk;
  });

  const byGroup = new Map<string, FloorPlanEquipment[]>();
  for (const eq of filtered) {
    const key = eq.equipmentType || eq.layer || "Overview";
    const list = byGroup.get(key) ?? [];
    list.push(eq);
    byGroup.set(key, list);
  }

  return [...byGroup.entries()].map(([group, items]) => {
    const counts = new Map<string, { label: string; count: number; colorHex: string }>();
    for (const eq of items) {
      const existing = counts.get(eq.currentStatus.id);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(eq.currentStatus.id, {
          label: eq.currentStatus.label,
          count: 1,
          colorHex: eq.currentStatus.colorHex,
        });
      }
    }
    return {
      title: `${group} Overview`,
      slices: [...counts.values()],
    };
  });
}

export function FloorPlanViewer({
  subtitle,
  backHref,
  zones,
  user,
  floorPlanId,
  backgroundUrl,
  viewBox,
  canvasWidth,
  canvasHeight,
  equipment: initialEquipment,
  statusOptions,
  sourceFileLastUpdated,
  lastRefreshAt,
  canEdit,
  canMap,
  canExport,
}: FloorPlanViewerProps) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [nameFilter, setNameFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const eq of equipment) {
      const value = eq.equipmentTag || eq.equipmentName;
      if (!value || seen.has(value)) continue;
      seen.add(value);
      opts.push({ value, label: value });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [equipment]);

  const statusFilterOptions = useMemo(
    () =>
      [...statusOptions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ value: s.id, label: s.label, colorHex: s.colorHex })),
    [statusOptions]
  );

  const groups = useMemo(
    () => buildOverviewGroups(equipment, nameFilter, statusFilter),
    [equipment, nameFilter, statusFilter]
  );

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="RPL-10X" subtitle={subtitle} backHref={backHref} zones={zones} user={user} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <InfoFilterRow
          sourceFileLastUpdated={sourceFileLastUpdated}
          lastRefreshAt={lastRefreshAt}
          nameOptions={nameOptions}
          statusOptions={statusFilterOptions}
          nameFilter={nameFilter}
          statusFilter={statusFilter}
          onNameChange={setNameFilter}
          onStatusChange={setStatusFilter}
        />
        <OverviewCharts groups={groups} />
        <FloorPlanCanvas
          floorPlanId={floorPlanId}
          backgroundUrl={backgroundUrl}
          viewBox={viewBox}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          equipment={equipment}
          statusOptions={statusOptions}
          canEdit={canEdit}
          canMap={canMap}
          canExport={canExport}
          nameFilter={nameFilter}
          statusFilter={statusFilter}
          onEquipmentUpdated={(equipmentId, status) => {
            setEquipment((prev) =>
              prev.map((eq) =>
                eq.id === equipmentId ? { ...eq, currentStatus: status } : eq
              )
            );
          }}
        />
      </div>
    </div>
  );
}
