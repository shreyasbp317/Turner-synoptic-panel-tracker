import { prisma } from "@/lib/db";
import { format } from "date-fns";

export async function updateEquipmentStatus(opts: {
  equipmentId: string;
  statusOptionId: string;
  userId: string;
}) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: opts.equipmentId },
    include: {
      floorPlan: {
        include: {
          zone: { include: { system: true } },
          system: true,
        },
      },
      currentStatusOption: true,
    },
  });

  if (!equipment) {
    throw new Error("Equipment not found.");
  }

  const system = equipment.floorPlan.zone?.system ?? equipment.floorPlan.system;
  if (!system) {
    throw new Error("Equipment is not linked to a system.");
  }

  const option = await prisma.statusSetOption.findUnique({
    where: { id: opts.statusOptionId },
  });

  if (!option || option.statusSetId !== system.statusSetId) {
    throw new Error("Selected status is not valid for this equipment's system.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const eq = await tx.equipment.update({
      where: { id: equipment.id },
      data: {
        currentStatusOptionId: option.id,
        updatedById: opts.userId,
      },
      include: {
        currentStatusOption: true,
        updatedBy: { select: { name: true } },
      },
    });

    await tx.statusHistory.create({
      data: {
        equipmentId: equipment.id,
        statusOptionId: option.id,
        changedById: opts.userId,
      },
    });

    await tx.floorPlan.update({
      where: { id: equipment.floorPlanId },
      data: { lastRefreshAt: new Date() },
    });

    return eq;
  });

  return {
    id: updated.id,
    currentStatus: {
      id: updated.currentStatusOption.id,
      label: updated.currentStatusOption.label,
      colorHex: updated.currentStatusOption.colorHex,
    },
    updatedAt: updated.updatedAt.toISOString(),
    updatedByName: updated.updatedBy?.name ?? null,
  };
}

export async function getEquipmentHistory(equipmentId: string) {
  const rows = await prisma.statusHistory.findMany({
    where: { equipmentId },
    include: {
      statusOption: true,
      changedBy: { select: { name: true, email: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    statusOption: {
      id: r.statusOption.id,
      label: r.statusOption.label,
      colorHex: r.statusOption.colorHex,
    },
    changedAt: r.changedAt.toISOString(),
    changedBy: {
      name: r.changedBy.name,
      email: r.changedBy.email,
    },
    note: r.note,
  }));
}

/** Bluebeam-style: oldest → newest, pipe-delimited */
export function formatStatusHistoryExport(
  rows: Array<{
    statusLabel: string;
    changedByName: string;
    changedAt: Date;
  }>
): string {
  return rows
    .slice()
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
    .map((r) => {
      const date = format(r.changedAt, "M/d/yyyy");
      const time = format(r.changedAt, "h:mm:ss a");
      return `${r.statusLabel}_ set by ${r.changedByName} on ${date} at ${time}`;
    })
    .join("|");
}
