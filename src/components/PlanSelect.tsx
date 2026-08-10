"use client";

import { useRouter } from "next/navigation";

export type PlanOption = { id: string; name: string; label: string };

export function PlanSelect({
  plans,
  currentId,
}: {
  plans: PlanOption[];
  currentId?: string;
}) {
  const router = useRouter();
  if (plans.length === 0) {
    return <p className="text-sm text-[#666]">No floor plans loaded for this building yet.</p>;
  }
  return (
    <label className="block max-w-md text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#666]">
        Floor plan
      </span>
      <select
        className="w-full rounded-md border border-[#ccc] bg-white px-3 py-2"
        value={currentId || ""}
        onChange={(e) => {
          if (e.target.value) router.push(`/floor-plans/${e.target.value}`);
        }}
      >
        <option value="">Select a plan…</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
