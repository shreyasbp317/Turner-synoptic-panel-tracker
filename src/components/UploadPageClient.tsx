"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export type UploadPageClientProps = {
  buildings: { id: string; name: string }[];
  systems: { id: string; buildingId: string; displayName: string; hasZones: boolean }[];
  zones: { id: string; systemId: string; name: string }[];
  initialBuildingId?: string;
  initialSystemId?: string;
  initialZoneId?: string;
  initialName?: string;
  replaceMode?: boolean;
  replaceLabel?: string;
};

export function UploadPageClient({
  buildings,
  systems,
  zones,
  initialBuildingId = "",
  initialSystemId = "",
  initialZoneId = "",
  initialName = "",
  replaceMode = false,
  replaceLabel,
}: UploadPageClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [buildingId, setBuildingId] = useState(initialBuildingId);
  const [systemId, setSystemId] = useState(initialSystemId);
  const [zoneId, setZoneId] = useState(initialZoneId);
  const [name, setName] = useState(initialName);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const locked = Boolean(replaceMode && initialBuildingId && initialSystemId);

  const filteredSystems = useMemo(
    () => systems.filter((s) => s.buildingId === buildingId),
    [systems, buildingId]
  );
  const selectedSystem = filteredSystems.find((s) => s.id === systemId);
  const filteredZones = useMemo(
    () => zones.filter((z) => z.systemId === systemId),
    [zones, systemId]
  );

  function onFile(f: File | null) {
    if (!f) return;
    if (!/\.(svg|jsvg)$/i.test(f.name)) {
      toast.error("Please choose a .svg or .jsvg file");
      return;
    }
    setFile(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!buildingId || !systemId || !file) {
      toast.error("Building, system, and file are required");
      return;
    }
    if (selectedSystem?.hasZones && !zoneId) {
      toast.error("Select a Data Hall (zone) for this system");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("buildingId", buildingId);
      fd.append("systemId", systemId);
      if (zoneId) fd.append("zoneId", zoneId);
      if (name) fd.append("name", name);
      fd.append("file", file);

      const res = await fetch("/api/floor-plans/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Upload failed");
      }
      const data = (await res.json()) as {
        floorPlanId?: string;
        mapUrl?: string;
        mappingCarryForward?: {
          matched: number;
          newShapes: string[];
          missingShapes: string[];
        };
      };

      const carry = data.mappingCarryForward;
      if (replaceMode && carry) {
        toast.success(
          `Plan replaced. Kept ${carry.matched} mapped shapes` +
            (carry.newShapes.length ? `, ${carry.newShapes.length} new` : "") +
            (carry.missingShapes.length ? `, ${carry.missingShapes.length} missing from new file` : "") +
            "."
        );
      } else {
        toast.success(replaceMode ? "Floor plan replaced" : "Floor plan uploaded");
      }

      if (data.mapUrl) {
        router.push(data.mapUrl);
      } else if (data.floorPlanId) {
        router.push(`/floor-plans/${data.floorPlanId}/map`);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 rounded-xl bg-[var(--card-bg)] p-6">
      {replaceMode ? (
        <div className="rounded-lg border border-[#0B2A5B]/20 bg-white px-3 py-3 text-sm text-[var(--navy)]">
          <p className="font-semibold">Replace existing floor plan</p>
          <p className="mt-1 text-[#555]">
            {replaceLabel
              ? `Uploading a new .svg/.jsvg will replace the current plan for ${replaceLabel}.`
              : "Uploading a new .svg/.jsvg will replace the current plan in this location."}{" "}
            Matching shape keys keep their equipment tags and status history.
          </p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">Building</span>
        <select
          required
          disabled={locked}
          className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2 disabled:opacity-60"
          value={buildingId}
          onChange={(e) => {
            setBuildingId(e.target.value);
            setSystemId("");
            setZoneId("");
          }}
        >
          <option value="">Select building</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">System</span>
        <select
          required
          disabled={!buildingId || locked}
          className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2 disabled:opacity-60"
          value={systemId}
          onChange={(e) => {
            setSystemId(e.target.value);
            setZoneId("");
          }}
        >
          <option value="">Select system</option>
          {filteredSystems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </label>

      {selectedSystem?.hasZones ? (
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">
            Data Hall (zone)
          </span>
          <select
            required
            disabled={locked}
            className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2 disabled:opacity-60"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
          >
            <option value="">Select zone</option>
            {filteredZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">
          Display name (optional)
        </span>
        <input
          className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div
        className={`rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
          dragOver ? "border-[var(--accent)] bg-white" : "border-[#bbb] bg-white/60"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <p className="text-sm text-[#555]">Drag & drop a .svg or .jsvg file here</p>
        <label className="mt-3 inline-block cursor-pointer rounded-md bg-[var(--navy)] px-3 py-1.5 text-sm font-medium text-white">
          Browse files
          <input
            type="file"
            accept=".svg,.jsvg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? <p className="mt-3 text-sm font-medium text-[var(--navy)]">{file.name}</p> : null}
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="w-full rounded-md bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {uploading
          ? replaceMode
            ? "Replacing…"
            : "Uploading…"
          : replaceMode
            ? "Replace floor plan"
            : "Upload floor plan"}
      </button>
    </form>
  );
}
