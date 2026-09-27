import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PlanSelect } from "@/components/PlanSelect";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isVisibleSystem } from "@/lib/systems";

const SYSTEM_TINT: Record<string, string> = {
  MES_FCM: "from-[#0b2a5b] to-[#3a6fd6]",
  TWMS: "from-[#0b2a5b] to-[#1ea7a0]",
  HAC: "from-[#0b2a5b] to-[#d414c8]",
  ELECTRICAL_YARD: "from-[#0b2a5b] to-[#f0b429]",
  MECHANICAL_YARD: "from-[#0b2a5b] to-[#1f8a4c]",
};

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const user = await requireUser();
  const { buildingId } = await params;

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: {
      systems: {
        orderBy: { sortOrder: "asc" },
        include: {
          zones: {
            orderBy: { sortOrder: "asc" },
            include: {
              floorPlans: { where: { active: true }, orderBy: { name: "asc" } },
            },
          },
          floorPlans: {
            where: { active: true, zoneId: null },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });
  if (!building) notFound();

  const visibleSystems = building.systems.filter((sys) => isVisibleSystem(sys.systemType));
  const plans = visibleSystems.flatMap((sys) => {
    const zonePlans = sys.zones.flatMap((z) =>
      z.floorPlans.map((fp) => ({
        id: fp.id,
        name: fp.name,
        label: `${sys.displayName} · ${z.name} · ${fp.name}`,
      }))
    );
    const systemPlans = sys.floorPlans.map((fp) => ({
      id: fp.id,
      name: fp.name,
      label: `${sys.displayName} · ${fp.name}`,
    }));
    return [...zonePlans, ...systemPlans];
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        subtitle={building.name}
        backHref="/"
        user={{ name: user.name, role: user.role }}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="dash-card p-4">
          <PlanSelect plans={plans} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSystems.map((sys) => {
            const planCount =
              sys.floorPlans.length + sys.zones.reduce((n, z) => n + z.floorPlans.length, 0);
            return (
              <Link
                key={sys.id}
                href={`/systems/${sys.id}`}
                className="dash-card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`h-1.5 bg-gradient-to-r ${SYSTEM_TINT[sys.systemType] || "from-[var(--navy)] to-[var(--accent)]"}`} />
                <div className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <div className="text-lg font-bold text-[var(--navy)]">{sys.displayName}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {planCount} floor plan{planCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 text-[var(--muted)] group-hover:text-[var(--accent)]" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
