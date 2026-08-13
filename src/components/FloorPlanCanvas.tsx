"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { ChevronDown, Minus, Pencil, Plus, X } from "lucide-react";
import { formatUiDate } from "@/lib/format";
import { useToast } from "@/components/Toast";

export type FloorPlanEquipment = {
  id: string;
  shapeKey: string;
  shapeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rawShapeData?: string | null;
  equipmentTag?: string | null;
  equipmentName?: string | null;
  equipmentType?: string | null;
  layer?: string | null;
  currentStatus: { id: string; label: string; colorHex: string };
  updatedAt?: string | null;
  updatedByName?: string | null;
  /** Placeholder until real ROJ dates are loaded. */
  rojDate?: string | null;
  /** Placeholder until each unit has its own submittal file. */
  submittalUrl?: string | null;
};

export type FloorPlanStatusOption = {
  id: string;
  label: string;
  colorHex: string;
  sortOrder: number;
};

export type FloorPlanCanvasProps = {
  floorPlanId: string;
  backgroundUrl: string;
  viewBox?: string | null;
  canvasWidth?: number | null;
  canvasHeight?: number | null;
  equipment: FloorPlanEquipment[];
  statusOptions: FloorPlanStatusOption[];
  canEdit: boolean;
  canMap: boolean;
  canExport: boolean;
  nameFilter: string;
  statusFilter: string;
  onEquipmentUpdated: (
    equipmentId: string,
    status: { id: string; label: string; colorHex: string }
  ) => void;
};

type HistoryRow = {
  id: string;
  changedAt: string;
  note?: string | null;
  statusOption?: { label: string; colorHex: string };
  changedBy?: { name: string };
};

type ContextMenuState = {
  x: number;
  y: number;
  equipmentId: string;
};

type TooltipState = {
  x: number;
  y: number;
  equipment: FloorPlanEquipment;
};

function parseViewBox(
  viewBox: string | null | undefined,
  canvasWidth: number | null | undefined,
  canvasHeight: number | null | undefined,
  equipment: FloorPlanEquipment[]
): string {
  if (viewBox) return viewBox;
  if (canvasWidth && canvasHeight) return `0 0 ${canvasWidth} ${canvasHeight}`;
  if (equipment.length === 0) return "0 0 1000 800";
  let maxX = 0;
  let maxY = 0;
  for (const e of equipment) {
    maxX = Math.max(maxX, e.x + e.width);
    maxY = Math.max(maxY, e.y + e.height);
  }
  return `0 0 ${Math.ceil(maxX + 40)} ${Math.ceil(maxY + 40)}`;
}

function matchesFilters(
  eq: FloorPlanEquipment,
  nameFilter: string,
  statusFilter: string
): boolean {
  const nameOk =
    nameFilter === "all" ||
    eq.equipmentTag === nameFilter ||
    eq.equipmentName === nameFilter ||
    eq.id === nameFilter;
  const statusOk = statusFilter === "all" || eq.currentStatus.id === statusFilter;
  return nameOk && statusOk;
}

function ShapeElement({
  eq,
  dimmed,
  selected,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
}: {
  eq: FloorPlanEquipment;
  dimmed: boolean;
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent<SVGElement>) => void;
  onPointerEnter: (e: ReactPointerEvent<SVGElement>) => void;
  onPointerLeave: () => void;
  onContextMenu: (e: ReactMouseEvent<SVGElement>) => void;
}) {
  const unmapped = !eq.equipmentTag;
  const colourless = dimmed;
  const fill = colourless ? "none" : eq.currentStatus.colorHex;
  const opacity = colourless ? 0 : 0.55;
  const stroke = colourless
    ? "none"
    : selected
      ? "#0B2A5B"
      : unmapped
        ? "#666666"
        : eq.currentStatus.colorHex;
  const strokeWidth = colourless ? 0 : selected ? 2.5 : 1.25;
  const dash = colourless ? undefined : unmapped ? "4 3" : undefined;

  let transform: string | undefined;
  let rawObj: Record<string, unknown> | null = null;
  const raw = eq.rawShapeData?.trim() ?? "";
  if (raw.startsWith("{")) {
    try {
      rawObj = JSON.parse(raw) as Record<string, unknown>;
      if (typeof rawObj.transform === "string") transform = rawObj.transform;
    } catch {
      rawObj = null;
    }
  }

  const common = {
    fill,
    fillOpacity: opacity,
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    transform,
    style: {
      cursor: colourless ? "default" : "pointer",
      touchAction: "none" as const,
      pointerEvents: colourless ? ("none" as const) : ("auto" as const),
    },
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    onContextMenu,
  };

  if (eq.shapeType === "CIRCLE") {
    if (rawObj && rawObj.cx != null && rawObj.cy != null && rawObj.r != null) {
      return (
        <circle
          cx={Number(rawObj.cx)}
          cy={Number(rawObj.cy)}
          r={Number(rawObj.r)}
          {...common}
        />
      );
    }
    return (
      <ellipse
        cx={eq.x + eq.width / 2}
        cy={eq.y + eq.height / 2}
        rx={eq.width / 2}
        ry={eq.height / 2}
        {...common}
      />
    );
  }

  if (eq.shapeType === "POLYGON") {
    const points =
      (rawObj && typeof rawObj.points === "string" && rawObj.points) ||
      (!raw.startsWith("{") ? raw : "");
    if (points) return <polygon points={points} {...common} />;
  }

  if (eq.shapeType === "PATH") {
    const d =
      (rawObj && typeof rawObj.d === "string" && rawObj.d) ||
      (!raw.startsWith("{") ? raw : "");
    if (d) return <path d={d} {...common} />;
  }

  if (eq.shapeType === "RECT") {
    if (
      rawObj &&
      rawObj.x != null &&
      rawObj.y != null &&
      rawObj.width != null &&
      rawObj.height != null
    ) {
      return (
        <rect
          x={Number(rawObj.x)}
          y={Number(rawObj.y)}
          width={Number(rawObj.width)}
          height={Number(rawObj.height)}
          {...common}
        />
      );
    }
  }

  return <rect x={eq.x} y={eq.y} width={eq.width} height={eq.height} {...common} />;
}

export function FloorPlanCanvas({
  floorPlanId,
  backgroundUrl,
  viewBox,
  canvasWidth,
  canvasHeight,
  equipment,
  statusOptions,
  canEdit,
  canMap,
  canExport,
  nameFilter,
  statusFilter,
  onEquipmentUpdated,
}: FloorPlanCanvasProps) {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const [backgroundSvg, setBackgroundSvg] = useState<string>("");
  const [bgLoading, setBgLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBgLoading(true);
    fetch(backgroundUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load background");
        return res.text();
      })
      .then((svg) => {
        if (!cancelled) setBackgroundSvg(svg);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load floor plan background");
      })
      .finally(() => {
        if (!cancelled) setBgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl, toast]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [localEquipment, setLocalEquipment] = useState(equipment);

  const holdTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    setLocalEquipment(equipment);
  }, [equipment]);

  const vb = useMemo(
    () => parseViewBox(viewBox, canvasWidth, canvasHeight, localEquipment),
    [viewBox, canvasWidth, canvasHeight, localEquipment]
  );

  const sortedStatuses = useMemo(
    () => [...statusOptions].sort((a, b) => a.sortOrder - b.sortOrder),
    [statusOptions]
  );

  const selected = localEquipment.find((e) => e.id === selectedId) ?? null;
  const filtersActive = nameFilter !== "all" || statusFilter !== "all";

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/equipment/${selectedId}/history`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json() as Promise<{ history?: HistoryRow[] } | HistoryRow[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data.history ?? []);
        setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
          toast.error("Could not load equipment history");
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, toast]);

  const clearHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    setScale((prev) => {
      const next = Math.min(8, Math.max(0.25, prev * factor));
      if (cx != null && cy != null && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const ox = cx - rect.left;
        const oy = cy - rect.top;
        setPan((p) => ({
          x: ox - ((ox - p.x) * next) / prev,
          y: oy - ((oy - p.y) * next) / prev,
        }));
      }
      return next;
    });
  }, []);

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomBy(factor, e.clientX, e.clientY);
  };

  const openContextMenu = (equipmentId: string, clientX: number, clientY: number) => {
    setContextMenu({ x: clientX, y: clientY, equipmentId });
  };

  const applyStatus = async (equipmentId: string, statusOptionId: string) => {
    const eq = localEquipment.find((e) => e.id === equipmentId);
    const option = sortedStatuses.find((s) => s.id === statusOptionId);
    if (!eq || !option) return;

    if (!canEdit) {
      toast.error("You do not have permission to change status");
      return;
    }

    const previous = eq.currentStatus;
    const next = { id: option.id, label: option.label, colorHex: option.colorHex };
    setLocalEquipment((prev) =>
      prev.map((item) => (item.id === equipmentId ? { ...item, currentStatus: next } : item))
    );
    onEquipmentUpdated(equipmentId, next);
    setContextMenu(null);

    try {
      const res = await fetch(`/api/equipment/${equipmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOptionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Status update failed");
      }
      toast.success(`Status updated to ${option.label}`);
      if (selectedId === equipmentId) {
        setHistoryLoading(true);
        const histRes = await fetch(`/api/equipment/${equipmentId}/history`);
        if (histRes.ok) {
          const data = (await histRes.json()) as { history?: HistoryRow[] } | HistoryRow[];
          setHistory(Array.isArray(data) ? data : (data.history ?? []));
        }
        setHistoryLoading(false);
      }
    } catch (err) {
      setLocalEquipment((prev) =>
        prev.map((item) =>
          item.id === equipmentId ? { ...item, currentStatus: previous } : item
        )
      );
      onEquipmentUpdated(equipmentId, previous);
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const onShapePointerDown = (eq: FloorPlanEquipment, e: ReactPointerEvent<SVGElement>) => {
    if (e.button === 2) return;
    e.stopPropagation();
    holdTriggered.current = false;
    clearHold();
    const { clientX, clientY } = e;
    holdTimer.current = window.setTimeout(() => {
      holdTriggered.current = true;
      openContextMenu(eq.id, clientX, clientY);
    }, 500);

    const onUp = (ev: PointerEvent) => {
      clearHold();
      window.removeEventListener("pointerup", onUp);
      if (holdTriggered.current) {
        ev.preventDefault();
        return;
      }
      if (ev.button === 0 || ev.pointerType === "touch") {
        setSelectedId(eq.id);
        setContextMenu(null);
      }
    };
    window.addEventListener("pointerup", onUp);
  };

  const onContainerPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, scale };
      setPanning(false);
      return;
    }
    if (e.button === 0 || e.pointerType === "touch") {
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const onContainerPointerMove = (e: ReactPointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const next = Math.min(
        8,
        Math.max(0.25, pinchStart.current.scale * (dist / pinchStart.current.dist))
      );
      setScale(next);
      return;
    }
    if (panning && panStart.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };

  const onContainerPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    setPanning(false);
    panStart.current = null;
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-lg border border-[#d0d0d0] bg-[#FAFAFA]">
        <div className="absolute left-2 top-2 z-20 flex gap-1">
          <button
            type="button"
            className="rounded bg-white p-1.5 shadow border border-[#ddd] text-[var(--navy)]"
            onClick={() => zoomBy(1.2)}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded bg-white p-1.5 shadow border border-[#ddd] text-[var(--navy)]"
            onClick={() => zoomBy(1 / 1.2)}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded bg-white px-2 py-1.5 text-xs font-medium shadow border border-[#ddd] text-[var(--navy)]"
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
        </div>

        {canExport ? (
          <div className="absolute right-2 top-2 z-20">
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-white px-2 py-1.5 text-xs font-medium shadow border border-[#ddd] text-[var(--navy)]"
              onClick={(e) => {
                e.stopPropagation();
                setExportOpen((v) => !v);
              }}
            >
              Export <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {exportOpen ? (
              <div className="absolute right-0 mt-1 w-48 rounded-md border border-[#ddd] bg-white py-1 text-sm shadow-lg">
                <a
                  className="block px-3 py-2 hover:bg-[#F0F0F0]"
                  href={`/api/floor-plans/${floorPlanId}/export/file`}
                  onClick={() => setExportOpen(false)}
                >
                  Export updated file
                </a>
                <a
                  className="block px-3 py-2 hover:bg-[#F0F0F0]"
                  href={`/api/floor-plans/${floorPlanId}/export/csv`}
                  onClick={() => setExportOpen(false)}
                >
                  Export CSV
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="h-[min(70vh,640px)] w-full touch-none overflow-hidden"
          onWheel={onWheel}
          onPointerDown={onContainerPointerDown}
          onPointerMove={onContainerPointerMove}
          onPointerUp={onContainerPointerUp}
          onPointerCancel={onContainerPointerUp}
          onClick={() => {
            setSelectedId(null);
            setExportOpen(false);
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {bgLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[#666]">
                Loading floor plan…
              </div>
            ) : (
              <div
                className="pointer-events-none absolute inset-0 opacity-90 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: backgroundSvg }}
                aria-hidden
              />
            )}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={vb}
              preserveAspectRatio="xMidYMid meet"
              onClick={(e) => e.stopPropagation()}
            >
              {localEquipment.map((eq) => {
                const match = matchesFilters(eq, nameFilter, statusFilter);
                return (
                  <ShapeElement
                    key={eq.id}
                    eq={eq}
                    dimmed={filtersActive && !match}
                    selected={selectedId === eq.id}
                    onPointerDown={(e) => onShapePointerDown(eq, e)}
                    onPointerEnter={(e) =>
                      setTooltip({ x: e.clientX, y: e.clientY, equipment: eq })
                    }
                    onPointerLeave={() => setTooltip(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearHold();
                      openContextMenu(eq.id, e.clientX, e.clientY);
                    }}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {tooltip ? (
          <div
            className="pointer-events-none fixed z-40 max-w-xs rounded-md bg-[#1a1a1a] px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          >
            <div className="font-semibold">
              {tooltip.equipment.equipmentTag || tooltip.equipment.equipmentName || tooltip.equipment.shapeKey}
            </div>
            {!tooltip.equipment.equipmentTag ? (
              <div className="mt-0.5 italic text-amber-300">unmapped</div>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tooltip.equipment.currentStatus.colorHex }}
              />
              {tooltip.equipment.currentStatus.label}
            </div>
            <div className="mt-1 text-white/70">
              ROJ {formatUiDate(tooltip.equipment.rojDate)}
            </div>
            <div className="mt-1 text-white/70">
              Updated {formatUiDate(tooltip.equipment.updatedAt)}
              {tooltip.equipment.updatedByName ? ` by ${tooltip.equipment.updatedByName}` : ""}
            </div>
          </div>
        ) : null}

        {contextMenu ? (
          <div
            className="fixed z-50 min-w-[12rem] rounded-md border border-[#ccc] bg-white py-1 text-sm shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="border-b border-[#eee] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#666]">
              Set status
            </div>
            {sortedStatuses.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!canEdit}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={() => void applyStatus(contextMenu.equipmentId, opt.id)}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: opt.colorHex }}
                />
                {opt.label}
              </button>
            ))}
            {!canEdit ? (
              <div className="border-t border-[#eee] px-3 py-2 text-xs text-[#888]">
                View only — status changes disabled
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--card-bg)] px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#666]">Legend</span>
        {sortedStatuses.map((opt) => (
          <span key={opt.id} className="flex items-center gap-1.5 text-sm text-[#333]">
            <span
              className="inline-block h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: opt.colorHex }}
            />
            {opt.label}
          </span>
        ))}
        {canMap ? (
          <Link
            href={`/floor-plans/${floorPlanId}/map`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--navy)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> Map equipment
          </Link>
        ) : null}
      </div>

      {selected ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-h-[55vh] overflow-y-auto border-t border-[#ccc] bg-white p-4 shadow-2xl md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[22rem] md:border-l md:border-t-0"
          role="dialog"
          aria-label="Equipment detail"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-[var(--navy)]">
                {selected.equipmentTag || selected.equipmentName || selected.shapeKey}
              </h3>
              {!selected.equipmentTag ? (
                <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Unmapped
                </span>
              ) : null}
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close panel">
              <X className="h-5 w-5 text-[#555]" />
            </button>
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">Name</dt>
              <dd>{selected.equipmentName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">Type</dt>
              <dd>{selected.equipmentType || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">Layer</dt>
              <dd>{selected.layer || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">Status</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: selected.currentStatus.colorHex }}
                />
                {selected.currentStatus.label}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">ROJ date</dt>
              <dd>{formatUiDate(selected.rojDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-[#666]">Updated</dt>
              <dd>
                {formatUiDate(selected.updatedAt)}
                {selected.updatedByName ? ` · ${selected.updatedByName}` : ""}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#666]">
              Submittal
            </h4>
            {selected.submittalUrl ? (
              <div className="overflow-hidden rounded-md border border-[#ddd]">
                <iframe
                  title={`Submittal for ${selected.equipmentTag || selected.equipmentName || selected.shapeKey}`}
                  src={`${selected.submittalUrl}#toolbar=0`}
                  className="h-72 w-full bg-[#f5f5f5]"
                />
                <a
                  href={selected.submittalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-t border-[#eee] px-3 py-2 text-xs font-medium text-[var(--navy)] hover:underline"
                >
                  Open sample submittal PDF
                </a>
              </div>
            ) : (
              <p className="text-sm text-[#888]">No submittal attached.</p>
            )}
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#666]">
              History
            </h4>
            {historyLoading ? (
              <p className="text-sm text-[#888]">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-[#888]">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md bg-[var(--card-bg)] px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      {h.statusOption ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: h.statusOption.colorHex }}
                        />
                      ) : null}
                      {h.statusOption?.label ?? "Status change"}
                    </div>
                    <div className="mt-0.5 text-xs text-[#666]">
                      {formatUiDate(h.changedAt)}
                      {h.changedBy?.name ? ` · ${h.changedBy.name}` : ""}
                    </div>
                    {h.note ? <div className="mt-1 text-xs text-[#555]">{h.note}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit ? (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#666]">
                Change status
              </h4>
              <div className="flex flex-wrap gap-2">
                {sortedStatuses.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#ccc] bg-white px-3 py-1 text-xs hover:bg-[#F0F0F0]"
                    onClick={() => void applyStatus(selected.id, opt.id)}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
