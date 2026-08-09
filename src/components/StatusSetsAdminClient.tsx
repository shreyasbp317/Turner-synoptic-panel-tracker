"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

type StatusOption = {
  id: string;
  key: string;
  label: string;
  colorHex: string;
  sortOrder: number;
  isDefault: boolean;
};

type StatusSetRow = {
  id: string;
  key: string;
  options: StatusOption[];
};

export function StatusSetsAdminClient({ initialSets }: { initialSets: StatusSetRow[] }) {
  const toast = useToast();
  const [sets, setSets] = useState(initialSets);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setSets(initialSets);
  }, [initialSets]);

  function updateLocal(optionId: string, patch: Partial<StatusOption>) {
    setSets((prev) =>
      prev.map((set) => ({
        ...set,
        options: set.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
      }))
    );
  }

  async function saveOption(option: StatusOption) {
    setSavingId(option.id);
    try {
      const res = await fetch(`/api/status-sets/options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: option.label,
          colorHex: option.colorHex,
          sortOrder: option.sortOrder,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to save status option");
      }
      const updated = (await res.json()) as StatusOption;
      updateLocal(option.id, updated);
      toast.success("Status option saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save status option");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {sets.map((set) => (
        <section key={set.id} className="rounded-xl bg-[var(--card-bg)] p-4">
          <h2 className="text-lg font-bold text-[var(--navy)]">{set.key}</h2>
          <div className="mt-3 space-y-3">
            {set.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((opt) => (
                <div
                  key={opt.id}
                  className="grid items-end gap-3 rounded-lg bg-white p-3 sm:grid-cols-[1fr_8rem_6rem_auto]"
                >
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">
                      Label {opt.isDefault ? "(default)" : ""}
                    </span>
                    <input
                      className="w-full rounded-md border border-[#ccc] px-2 py-1.5"
                      value={opt.label}
                      onChange={(e) => updateLocal(opt.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">
                      Color
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-12 cursor-pointer rounded border border-[#ccc]"
                        value={opt.colorHex}
                        onChange={(e) => updateLocal(opt.id, { colorHex: e.target.value })}
                      />
                      <input
                        className="w-full rounded-md border border-[#ccc] px-2 py-1.5 font-mono text-xs"
                        value={opt.colorHex}
                        onChange={(e) => updateLocal(opt.id, { colorHex: e.target.value })}
                      />
                    </div>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase text-[#666]">
                      Order
                    </span>
                    <input
                      type="number"
                      className="w-full rounded-md border border-[#ccc] px-2 py-1.5"
                      value={opt.sortOrder}
                      onChange={(e) =>
                        updateLocal(opt.id, { sortOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingId === opt.id}
                    className="rounded-md bg-[var(--navy)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    onClick={() => void saveOption(opt)}
                  >
                    {savingId === opt.id ? "Saving…" : "Save"}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
