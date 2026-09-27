"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InfoFilterRow } from "@/components/InfoFilterRow";
import { OverviewCharts, type OverviewGroup } from "@/components/OverviewCharts";
import {
  FloorPlanCanvas,
  type FloorPlanEquipment,
  type FloorPlanStatusOption,
} from "@/components/FloorPlanCanvas";
import { hallFromTag } from "@/lib/tags";

export type FloorPlanViewerProps = {
  subtitle: string;
  backHref?: string;
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

function isTracked(eq: FloorPlanEquipment): boolean {
  return eq.layer !== "background";
}

function equipmentHall(eq: FloorPlanEquipment): string | null {
  if (eq.layer && /^Data Hall [ABCD]$/i.test(eq.layer)) return eq.layer;
  return hallFromTag(eq.equipmentTag || eq.shapeKey);
}

function buildOverviewGroups(
  equipment: FloorPlanEquipment[],
  nameFilter: string,
  statusFilter: string,
  hallFilter: string,
  statusOptions: FloorPlanStatusOption[]
): OverviewGroup[] {
  const filtered = equipment.filter((eq) => {
    if (!isTracked(eq)) return false;
    const nameOk =
      nameFilter === "all" ||
      eq.equipmentTag === nameFilter ||
      eq.equipmentName === nameFilter ||
      eq.id === nameFilter;
    const statusOk = statusFilter === "all" || eq.currentStatus.id === statusFilter;
    const hall = equipmentHall(eq);
    const hallOk = hallFilter === "all" || hall === hallFilter;
    return nameOk && statusOk && hallOk;
  });

  const byGroup = new Map<string, FloorPlanEquipment[]>();
  for (const eq of filtered) {
    const key = eq.equipmentType || eq.layer || "Equipment";
    const list = byGroup.get(key) ?? [];
    list.push(eq);
    byGroup.set(key, list);
  }

  return [...byGroup.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([group, items]) => {
      const counts = new Map<string, { label: string; count: number; colorHex: string }>();
      for (const opt of statusOptions) {
        counts.set(opt.id, { label: opt.label, count: 0, colorHex: opt.colorHex });
      }
      for (const eq of items) {
        const existing = counts.get(eq.currentStatus.id);
        if (existing) existing.count += 1;
        else {
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
  const [hallFilter, setHallFilter] = useState("all");

  const trackedEquipment = useMemo(() => equipment.filter(isTracked), [equipment]);

  const halls = useMemo(() => {
    const set = new Set<string>();
    for (const eq of trackedEquipment) {
      const hall = equipmentHall(eq);
      if (hall) set.add(hall);
    }
    return [...set].sort();
  }, [trackedEquipment]);

  const nameOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const eq of trackedEquipment) {
      const value = eq.equipmentName || eq.equipmentTag;
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const label =
        eq.equipmentName && eq.equipmentTag && eq.equipmentName !== eq.equipmentTag
          ? `${eq.equipmentName} (${eq.equipmentTag})`
          : value;
      opts.push({ value, label });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [trackedEquipment]);

  const statusFilterOptions = useMemo(
    () =>
      [...statusOptions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ value: s.id, label: s.label, colorHex: s.colorHex })),
    [statusOptions]
  );

  const visibleEquipment = useMemo(() => {
    const background = equipment.filter((eq) => !isTracked(eq));
    const tracked =
      hallFilter === "all"
        ? trackedEquipment
        : trackedEquipment.filter((eq) => equipmentHall(eq) === hallFilter);
    return [...tracked, ...background];
  }, [equipment, trackedEquipment, hallFilter]);

  const groups = useMemo(
    () => buildOverviewGroups(equipment, nameFilter, statusFilter, hallFilter, statusOptions),
    [equipment, nameFilter, statusFilter, hallFilter, statusOptions]
  );

  const totals = useMemo(() => {
    const scoped = visibleEquipment.filter(isTracked);
    const total = scoped.length;
    const pending = scoped.filter((eq) => /pending/i.test(eq.currentStatus.label)).length;
    return { total, pending, progressed: total - pending };
  }, [visibleEquipment]);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="RPL-10X" subtitle={subtitle} backHref={backHref} user={user} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="dash-card px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Units on plan
            </div>
            <div className="stat-value mt-1 text-3xl font-extrabold text-[var(--navy)]">{totals.total}</div>
          </div>
          <div className="dash-card px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Pending delivery
            </div>
            <div className="stat-value mt-1 text-3xl font-extrabold text-[var(--navy-mid)]">{totals.pending}</div>
          </div>
          <div className="dash-card relative overflow-hidden px-4 py-3.5">
            <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Status changed
            </div>
            <div className="stat-value mt-1 text-3xl font-extrabold text-[var(--accent)]">{totals.progressed}</div>
          </div>
        </div>

        <InfoFilterRow
          sourceFileLastUpdated={sourceFileLastUpdated}
          lastRefreshAt={lastRefreshAt}
          nameOptions={nameOptions}
          statusOptions={statusFilterOptions}
          nameFilter={nameFilter}
          statusFilter={statusFilter}
          onNameChange={setNameFilter}
          onStatusChange={setStatusFilter}
          halls={halls}
          hallFilter={hallFilter}
          onHallChange={setHallFilter}
        />
        <OverviewCharts
          groups={groups}
          legendStatuses={statusOptions.map((s) => ({ label: s.label, colorHex: s.colorHex }))}
        />
        <FloorPlanCanvas
          floorPlanId={floorPlanId}
          backgroundUrl={backgroundUrl}
          viewBox={viewBox}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          equipment={visibleEquipment}
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
