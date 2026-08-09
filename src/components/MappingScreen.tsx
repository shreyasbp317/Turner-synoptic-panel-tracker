"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useToast } from "@/components/Toast";

export type MappingEquipment = {
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
  scheduleId?: string | null;
  scheduleActivity?: string | null;
  isNew?: boolean;
  isMissing?: boolean;
  currentStatus?: { id: string; label: string; colorHex: string };
};

export type MappingScreenProps = {
  floorPlanId: string;
  backgroundUrl: string;
  viewBox?: string | null;
  canvasWidth?: number | null;
  canvasHeight?: number | null;
  equipment: MappingEquipment[];
  parseWarnings?: { shapeKey?: string; message: string }[];
};

type MappingForm = {
  equipmentTag: string;
  equipmentName: string;
  equipmentType: string;
  layer: string;
  scheduleId: string;
  scheduleActivity: string;
};

type PreviewRow = {
  shapeKey?: string;
  equipmentTag?: string;
  equipmentName?: string;
  equipmentType?: string;
  layer?: string;
  scheduleId?: string;
  scheduleActivity?: string;
  [key: string]: unknown;
};

function emptyForm(): MappingForm {
  return {
    equipmentTag: "",
    equipmentName: "",
    equipmentType: "",
    layer: "",
    scheduleId: "",
    scheduleActivity: "",
  };
}

function formFromEquipment(eq: MappingEquipment): MappingForm {
  return {
    equipmentTag: eq.equipmentTag ?? "",
    equipmentName: eq.equipmentName ?? "",
    equipmentType: eq.equipmentType ?? "",
    layer: eq.layer ?? "",
    scheduleId: eq.scheduleId ?? "",
    scheduleActivity: eq.scheduleActivity ?? "",
  };
}

function parseViewBox(
  viewBox: string | null | undefined,
  canvasWidth: number | null | undefined,
  canvasHeight: number | null | undefined,
  equipment: MappingEquipment[]
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

function OutlineShape({
  eq,
  selected,
  onClick,
}: {
  eq: MappingEquipment;
  selected: boolean;
  onClick: () => void;
}) {
  const stroke = selected ? "#C000C0" : eq.isMissing ? "#CC0000" : eq.isNew ? "#008000" : "#0B2A5B";
  const fill = selected ? "rgba(192,0,192,0.15)" : "rgba(11,42,91,0.06)";
  const common = {
    fill,
    stroke,
    strokeWidth: selected ? 2.5 : 1.25,
    strokeDasharray: eq.equipmentTag ? undefined : "4 3",
    style: { cursor: "pointer" as const },
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
  };
  const raw = eq.rawShapeData?.trim() ?? "";

  if (eq.shapeType === "CIRCLE") {
    try {
      const parsed = JSON.parse(raw) as { cx?: number; cy?: number; r?: number };
      if (parsed.cx != null && parsed.cy != null && parsed.r != null) {
        return <circle cx={parsed.cx} cy={parsed.cy} r={parsed.r} {...common} />;
      }
    } catch {
      /* fall through */
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
  if (eq.shapeType === "POLYGON" && raw) return <polygon points={raw} {...common} />;
  if (eq.shapeType === "PATH" && raw) return <path d={raw} {...common} />;
  if (eq.shapeType === "RECT") {
    try {
      const parsed = JSON.parse(raw) as {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };
      if (
        parsed.x != null &&
        parsed.y != null &&
        parsed.width != null &&
        parsed.height != null
      ) {
        return (
          <rect
            x={parsed.x}
            y={parsed.y}
            width={parsed.width}
            height={parsed.height}
            {...common}
          />
        );
      }
    } catch {
      /* fall through */
    }
  }
  return <rect x={eq.x} y={eq.y} width={eq.width} height={eq.height} {...common} />;
}

export function MappingScreen({
  floorPlanId,
  backgroundUrl,
  viewBox,
  canvasWidth,
  canvasHeight,
  equipment: initialEquipment,
  parseWarnings = [],
}: MappingScreenProps) {
  const toast = useToast();
  const [equipment, setEquipment] = useState(initialEquipment);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<MappingForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [backgroundSvg, setBackgroundSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl, toast]);

  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selected = equipment.find((e) => e.id === selectedId) ?? null;
  const vb = useMemo(
    () => parseViewBox(viewBox, canvasWidth, canvasHeight, equipment),
    [viewBox, canvasWidth, canvasHeight, equipment]
  );

  function selectEquipment(eq: MappingEquipment) {
    setSelectedId(eq.id);
    setForm(formFromEquipment(eq));
  }

  async function saveMapping() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/${selected.id}/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentTag: form.equipmentTag || null,
          equipmentName: form.equipmentName || null,
          equipmentType: form.equipmentType || null,
          layer: form.layer || null,
          scheduleId: form.scheduleId || null,
          scheduleActivity: form.scheduleActivity || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to save mapping");
      }
      const updated = (await res.json().catch(() => null)) as Partial<MappingEquipment> | null;
      setEquipment((prev) =>
        prev.map((e) =>
          e.id === selected.id
            ? {
                ...e,
                ...updated,
                equipmentTag: form.equipmentTag || null,
                equipmentName: form.equipmentName || null,
                equipmentType: form.equipmentType || null,
                layer: form.layer || null,
                scheduleId: form.scheduleId || null,
                scheduleActivity: form.scheduleActivity || null,
              }
            : e
        )
      );
      toast.success("Mapping saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  async function onCsvSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    setPreviewRows(null);
    setPreviewWarnings([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/floor-plans/${floorPlanId}/mapping/preview`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "CSV preview failed");
      }
      const data = (await res.json()) as {
        rows?: PreviewRow[];
        warnings?: string[] | { message: string }[];
      };
      setPreviewRows(data.rows ?? []);
      const warnings = (data.warnings ?? []).map((w) =>
        typeof w === "string" ? w : w.message
      );
      setPreviewWarnings(warnings);
      toast.success(`Preview ready (${data.rows?.length ?? 0} rows)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV preview failed");
    } finally {
      setUploading(false);
    }
  }

  async function commitPreview() {
    if (!previewRows || previewRows.length === 0) return;
    setCommitting(true);
    try {
      const res = await fetch(`/api/floor-plans/${floorPlanId}/mapping/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Commit failed");
      }
      const data = (await res.json().catch(() => null)) as {
        equipment?: MappingEquipment[];
      } | null;
      if (data?.equipment) {
        setEquipment(data.equipment);
      } else {
        // Optimistically merge by shapeKey
        setEquipment((prev) =>
          prev.map((e) => {
            const row = previewRows.find(
              (r) =>
                r.shapeKey === e.shapeKey ||
                (r.equipmentTag && r.equipmentTag === e.equipmentTag)
            );
            if (!row) return e;
            return {
              ...e,
              equipmentTag: (row.equipmentTag as string) ?? e.equipmentTag,
              equipmentName: (row.equipmentName as string) ?? e.equipmentName,
              equipmentType: (row.equipmentType as string) ?? e.equipmentType,
              layer: (row.layer as string) ?? e.layer,
              scheduleId: (row.scheduleId as string) ?? e.scheduleId,
              scheduleActivity: (row.scheduleActivity as string) ?? e.scheduleActivity,
            };
          })
        );
      }
      setPreviewRows(null);
      setPreviewWarnings([]);
      toast.success("Mapping committed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {parseWarnings.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Parse warnings</div>
            <ul className="mt-1 list-disc pl-5">
              {parseWarnings.map((w, i) => (
                <li key={`${w.shapeKey ?? "w"}-${i}`}>
                  {w.shapeKey ? `[${w.shapeKey}] ` : ""}
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-[#d0d0d0] bg-[#FAFAFA]">
          <div className="relative h-[min(65vh,560px)] w-full">
            <div
              className="pointer-events-none absolute inset-0 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: backgroundSvg }}
              aria-hidden
            />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={vb}
              preserveAspectRatio="xMidYMid meet"
              onClick={() => {
                setSelectedId(null);
                setForm(emptyForm());
              }}
            >
              {equipment.map((eq) => (
                <OutlineShape
                  key={eq.id}
                  eq={eq}
                  selected={selectedId === eq.id}
                  onClick={() => selectEquipment(eq)}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-[#555]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#008000]" /> New on reupload
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#CC0000]" /> Missing vs prior
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 border border-dashed border-[#0B2A5B]" /> Unmapped
          </span>
        </div>

        <div className="rounded-lg bg-[var(--card-bg)] p-4">
          <h3 className="text-sm font-bold text-[var(--navy)]">Bulk CSV mapping</h3>
          <p className="mt-1 text-xs text-[#666]">
            Upload a CSV to preview mappings, then commit confirmed rows.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-3 block w-full text-sm"
            disabled={uploading}
            onChange={(e) => void onCsvSelected(e.target.files?.[0] ?? null)}
          />
          {previewWarnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
              {previewWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          {previewRows ? (
            <div className="mt-3 space-y-2">
              <div className="max-h-48 overflow-auto rounded border border-[#ddd] bg-white">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F0F0F0]">
                    <tr>
                      <th className="px-2 py-1.5">Shape</th>
                      <th className="px-2 py-1.5">Tag</th>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Type</th>
                      <th className="px-2 py-1.5">Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-[#eee]">
                        <td className="px-2 py-1">{String(row.shapeKey ?? "")}</td>
                        <td className="px-2 py-1">{String(row.equipmentTag ?? "")}</td>
                        <td className="px-2 py-1">{String(row.equipmentName ?? "")}</td>
                        <td className="px-2 py-1">{String(row.equipmentType ?? "")}</td>
                        <td className="px-2 py-1">{String(row.layer ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={committing || previewRows.length === 0}
                  onClick={() => void commitPreview()}
                >
                  {committing ? "Committing…" : "Commit mapping"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#ccc] bg-white px-3 py-1.5 text-sm"
                  onClick={() => {
                    setPreviewRows(null);
                    setPreviewWarnings([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="rounded-lg bg-[var(--card-bg)] p-4">
        <h3 className="text-base font-bold text-[var(--navy)]">Equipment mapping</h3>
        {!selected ? (
          <p className="mt-2 text-sm text-[#666]">Click a shape on the floor plan to edit mapping.</p>
        ) : (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveMapping();
            }}
          >
            <div className="text-xs text-[#666]">
              Shape key: <span className="font-mono text-[#333]">{selected.shapeKey}</span>
              {selected.isNew ? (
                <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-green-800">New</span>
              ) : null}
              {selected.isMissing ? (
                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-red-800">Missing</span>
              ) : null}
            </div>
            {(
              [
                ["equipmentTag", "Equipment tag"],
                ["equipmentName", "Equipment name"],
                ["equipmentType", "Equipment type"],
                ["layer", "Layer"],
                ["scheduleId", "Schedule ID"],
                ["scheduleActivity", "Schedule activity"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#666]">
                  {label}
                </span>
                <input
                  className="w-full rounded-md border border-[#ccc] bg-white px-2 py-1.5"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-[var(--navy)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save mapping"}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
