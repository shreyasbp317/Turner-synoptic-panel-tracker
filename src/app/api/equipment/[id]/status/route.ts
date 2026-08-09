import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiRole } from "@/lib/api";
import { updateEquipmentStatus } from "@/lib/services/equipment";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiRole(["ADMIN", "EDITOR"]);
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { statusOptionId?: string };
    if (!body.statusOptionId) return jsonError("statusOptionId is required.");

    const result = await updateEquipmentStatus({
      equipmentId: id,
      statusOptionId: body.statusOptionId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Status update failed.", 400);
  }
}
