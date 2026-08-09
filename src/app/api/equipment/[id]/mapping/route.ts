import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiRole } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiRole(["ADMIN"]);
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      equipmentTag?: string | null;
      equipmentName?: string | null;
      equipmentType?: string | null;
      layer?: string | null;
      scheduleId?: string | null;
      scheduleActivity?: string | null;
      notes?: string | null;
    };

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        equipmentTag: body.equipmentTag ?? null,
        equipmentName: body.equipmentName ?? null,
        equipmentType: body.equipmentType ?? null,
        layer: body.layer ?? null,
        scheduleId: body.scheduleId ?? null,
        scheduleActivity: body.scheduleActivity ?? null,
        notes: body.notes ?? undefined,
        updatedById: user.id,
      },
      include: { currentStatusOption: true },
    });

    await prisma.floorPlan.update({
      where: { id: updated.floorPlanId },
      data: { lastRefreshAt: new Date() },
    });

    return NextResponse.json({
      id: updated.id,
      shapeKey: updated.shapeKey,
      equipmentTag: updated.equipmentTag,
      equipmentName: updated.equipmentName,
      equipmentType: updated.equipmentType,
      layer: updated.layer,
      scheduleId: updated.scheduleId,
      scheduleActivity: updated.scheduleActivity,
      currentStatus: {
        id: updated.currentStatusOption.id,
        label: updated.currentStatusOption.label,
        colorHex: updated.currentStatusOption.colorHex,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Mapping update failed.", 400);
  }
}
