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
}: InfoFilterRowProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg bg-[var(--card-bg)] px-4 py-3">
      <div className="min-w-[10rem] text-sm text-[#333]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#666]">
          Source file updated
        </div>
        <div className="mt-0.5 font-medium">{formatUiDate(sourceFileLastUpdated)}</div>
      </div>
      <div className="min-w-[10rem] text-sm text-[#333]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#666]">
          Last refresh
        </div>
        <div className="mt-0.5 font-medium">{formatUiDate(lastRefreshAt)}</div>
      </div>

      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#666]">
          Name
        </span>
        <select
          className="rounded-md border border-[#ccc] bg-white px-2 py-1.5 text-[var(--navy)]"
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
        <span className="text-xs font-semibold uppercase tracking-wide text-[#666]">
          Status
        </span>
        <select
          className="rounded-md border border-[#ccc] bg-white px-2 py-1.5 text-[var(--navy)]"
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
  );
}
