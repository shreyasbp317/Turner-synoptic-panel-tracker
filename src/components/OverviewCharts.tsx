"use client";

import { useMemo, useRef, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Download, Expand, X } from "lucide-react";

export type OverviewSlice = {
  label: string;
  count: number;
  colorHex: string;
};

export type OverviewGroup = {
  title: string;
  slices: OverviewSlice[];
};

export type OverviewChartsProps = {
  groups: OverviewGroup[];
  legendStatuses?: { label: string; colorHex: string }[];
};

function slicePercent(percent: number | undefined): number {
  if (percent == null || Number.isNaN(percent)) return 0;
  const value = percent <= 1 ? percent * 100 : percent;
  return Math.round(value);
}

function DonutChart({
  title,
  slices,
  legendStatuses,
  size = 280,
}: {
  title: string;
  slices: OverviewSlice[];
  legendStatuses?: { label: string; colorHex: string }[];
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const data = slices
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.label,
      value: s.count,
      colorHex: s.colorHex,
      sharePct: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }));

  const legend = legendStatuses?.length
    ? legendStatuses
    : slices.map((s) => ({ label: s.label, colorHex: s.colorHex }));

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 text-center text-[15px] font-bold tracking-tight text-[var(--navy-mid)] underline decoration-[var(--navy-mid)] decoration-2 underline-offset-[6px]">
        {title}
      </h3>
      <div className="relative mx-auto w-full" style={{ height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="42%"
              outerRadius="74%"
              paddingAngle={1.2}
              label={({ name, value, percent }) =>
                `${name} ${value} (${slicePercent(percent)}%)`
              }
              labelLine={{ stroke: "#061433", strokeWidth: 1 }}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colorHex} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, item) => {
                const pct = (item?.payload as { sharePct?: number } | undefined)?.sharePct ?? 0;
                return [`${value} (${pct}%)`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="stat-value text-2xl font-extrabold text-[var(--navy)]">{total}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            units
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[#333]">
        {legend.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
              style={{ backgroundColor: entry.colorHex }}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OverviewCharts({ groups, legendStatuses }: OverviewChartsProps) {
  const [expandGroup, setExpandGroup] = useState<OverviewGroup | null>(null);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visibleGroups = useMemo(() => groups.filter((g) => g.slices.some((s) => s.count > 0)), [groups]);

  async function exportChartImage(title: string) {
    const el = chartRefs.current[title];
    if (!el) return;
    const svg = el.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const rect = svg.getBoundingClientRect();
    const width = Math.max(rect.width, 400);
    const height = Math.max(rect.height, 400);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load chart image"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.png`;
    a.click();
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="dash-card px-4 py-8 text-center text-sm text-[var(--muted)]">
        No overview data for the current filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        {visibleGroups.map((group) => (
          <div
            key={group.title}
            className="dash-card relative p-5"
            ref={(node) => {
              chartRefs.current[group.title] = node;
            }}
          >
            <div className="absolute right-3 top-3 z-10 flex gap-1">
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] bg-white p-1.5 text-[var(--navy-mid)] shadow-sm hover:bg-[#F4F7FB]"
                title="Expand"
                onClick={() => setExpandGroup(group)}
              >
                <Expand className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] bg-white p-1.5 text-[var(--navy-mid)] shadow-sm hover:bg-[#F4F7FB]"
                title="Export image"
                onClick={() => void exportChartImage(group.title)}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            <DonutChart title={group.title} slices={group.slices} legendStatuses={legendStatuses} />
          </div>
        ))}
      </div>

      {expandGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061433]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--navy)]">{expandGroup.title}</h3>
              <button type="button" onClick={() => setExpandGroup(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DonutChart
              title={expandGroup.title}
              slices={expandGroup.slices}
              legendStatuses={legendStatuses}
              size={440}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
