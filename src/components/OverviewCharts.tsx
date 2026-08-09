"use client";

import { useMemo, useRef, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Download, Expand, Filter, X } from "lucide-react";

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
};

function DonutChart({
  title,
  slices,
  size = 220,
}: {
  title: string;
  slices: OverviewSlice[];
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const data = slices.map((s) => ({
    name: s.label,
    value: s.count,
    colorHex: s.colorHex,
    percent: total > 0 ? Math.round((s.count / total) * 100) : 0,
  }));

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 text-center text-sm font-bold text-[var(--navy)]">
        {title}
      </h3>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={1}
              label={({ name, value, percent }) =>
                `${name}: ${value} (${Math.round((percent ?? 0) * 100)}%)`
              }
              labelLine
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.colorHex} stroke="#fff" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, item) => {
                const pct = (item?.payload as { percent?: number } | undefined)?.percent ?? 0;
                return [`${value} (${pct}%)`, String(name)];
              }}
            />
            <Legend
              verticalAlign="bottom"
              content={({ payload }) => (
                <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-[#333]">
                  {(payload ?? []).map((entry) => (
                    <li key={String(entry.value)} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: String(entry.color) }}
                      />
                      {entry.value}
                    </li>
                  ))}
                </ul>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--navy)]">{total}</div>
            <div className="text-[10px] uppercase tracking-wide text-[#666]">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverviewCharts({ groups }: OverviewChartsProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandGroup, setExpandGroup] = useState<OverviewGroup | null>(null);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visibleGroups = useMemo(() => groups.filter((g) => g.slices.length > 0), [groups]);

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
      <div className="rounded-lg bg-[var(--card-bg)] px-4 py-8 text-center text-sm text-[#666]">
        No overview data for the current filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleGroups.map((group) => (
          <div
            key={group.title}
            className="relative rounded-lg bg-[var(--card-bg)] p-3"
            ref={(node) => {
              chartRefs.current[group.title] = node;
            }}
          >
            <div className="absolute right-2 top-2 z-10 flex gap-1">
              <button
                type="button"
                className="rounded bg-white/80 p-1 text-[var(--navy)] hover:bg-white"
                title="Filter"
                onClick={() => setFilterOpen(true)}
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded bg-white/80 p-1 text-[var(--navy)] hover:bg-white"
                title="Expand"
                onClick={() => setExpandGroup(group)}
              >
                <Expand className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded bg-white/80 p-1 text-[var(--navy)] hover:bg-white"
                title="Export image"
                onClick={() => void exportChartImage(group.title)}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            <DonutChart title={group.title} slices={group.slices} />
          </div>
        ))}
      </div>

      {filterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--navy)]">Chart filters</h3>
              <button type="button" onClick={() => setFilterOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-[#555]">
              Use the Name and Status filters above the charts to refine overview slices. Additional
              chart-level filters can be added here later.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white"
              onClick={() => setFilterOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {expandGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--navy)]">{expandGroup.title}</h3>
              <button type="button" onClick={() => setExpandGroup(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <DonutChart title={expandGroup.title} slices={expandGroup.slices} size={420} />
          </div>
        </div>
      ) : null}
    </>
  );
}
