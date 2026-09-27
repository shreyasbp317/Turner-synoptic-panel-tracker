"use client";

import { formatUiDate } from "@/lib/format";

export type InfoFilterRowProps = {
  sourceFileLastUpdated: Date | string | null | undefined;
  lastRefreshAt: Date | string | null | undefined;
  nameOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string; colorHex: string }[];
  nameFilter: string;
  statusFilter: string;
  onNameChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  halls?: string[];
  hallFilter?: string;
  onHallChange?: (value: string) => void;
};

export function InfoFilterRow({
  sourceFileLastUpdated,
  lastRefreshAt,
  nameOptions,
  statusOptions,
  nameFilter,
  statusFilter,
  onNameChange,
  onStatusChange,
  halls = [],
  hallFilter = "all",
  onHallChange,
}: InfoFilterRowProps) {
  return (
    <div className="dash-card space-y-3 px-4 py-3">
      {halls.length > 1 && onHallChange ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Data hall
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onHallChange("all")}
              className={`rounded-full px-3.5 py-1 text-sm font-semibold ${
                hallFilter === "all"
                  ? "bg-[var(--navy)] text-white"
                  : "bg-[#eef2f9] text-[var(--navy)] hover:bg-[#e0e8f4]"
              }`}
            >
              All halls
            </button>
            {halls.map((hall) => (
              <button
                key={hall}
                type="button"
                onClick={() => onHallChange(hall)}
                className={`rounded-full px-3.5 py-1 text-sm font-semibold ${
                  hallFilter === hall
                    ? "bg-[var(--navy)] text-white"
                    : "bg-[#eef2f9] text-[var(--navy)] hover:bg-[#e0e8f4]"
                }`}
              >
                {hall.replace("Data Hall ", "Hall ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[9rem] text-sm text-[#333]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Source file
          </div>
          <div className="mt-0.5 font-medium">{formatUiDate(sourceFileLastUpdated)}</div>
        </div>
        <div className="min-w-[9rem] text-sm text-[#333]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Last refresh
          </div>
          <div className="mt-0.5 font-medium">{formatUiDate(lastRefreshAt)}</div>
        </div>

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Equipment
          </span>
          <select
            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[var(--navy)]"
            value={nameFilter}
            onChange={(e) => onNameChange(e.target.value)}
          >
            <option value="all">All</option>
            {nameOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Status
          </span>
          <select
            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[var(--navy)]"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="all">All</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
