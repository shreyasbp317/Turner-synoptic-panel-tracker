import Link from "next/link";
import { Building2, Map, PanelsTopLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isVisibleSystem } from "@/lib/systems";

export default async function BuildingsPage() {
  const user = await requireUser();
  const buildings = await prisma.building.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      systems: {
        include: {
          floorPlans: { where: { active: true }, select: { id: true } },
          zones: { include: { floorPlans: { where: { active: true }, select: { id: true } } } },
        },
      },
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle="Synoptic operations dashboard"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 p-4 sm:p-6">
        <section className="dash-card mb-6 overflow-hidden p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                RPL-10X tracker
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-[var(--navy)] sm:text-3xl">
                Select a building
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
                Open a building, pick a system, then click equipment to update status, view
                submittals, and review ROJ dates.
              </p>
            </div>
            <div className="flex gap-3 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2f9] px-3 py-1">
                <Building2 className="h-3.5 w-3.5" /> {buildings.length} buildings
              </span>
            </div>
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {buildings.map((b) => {
            const visibleSystems = b.systems.filter((s) => isVisibleSystem(s.systemType));
            const planCount = visibleSystems.reduce(
              (n, s) =>
                n +
                s.floorPlans.length +
                s.zones.reduce((z, zone) => z + zone.floorPlans.length, 0),
              0
            );
            const ready = planCount > 0;
            return (
              <Link
                key={b.id}
                href={`/buildings/${b.id}`}
                className="dash-card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="h-1.5 bg-gradient-to-r from-[var(--navy)] via-[#3a6fd6] to-[var(--accent)]" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-2xl font-extrabold text-[var(--navy)]">{b.name}</div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        ready ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {ready ? "Live" : "Empty"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-[#f4f7fb] px-3 py-2">
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                        <PanelsTopLeft className="h-3 w-3" /> Systems
                      </div>
                      <div className="stat-value text-lg font-bold text-[var(--navy)]">
                        {visibleSystems.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f4f7fb] px-3 py-2">
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                        <Map className="h-3 w-3" /> Plans
                      </div>
                      <div className="stat-value text-lg font-bold text-[var(--navy)]">{planCount}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Open dashboard →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
