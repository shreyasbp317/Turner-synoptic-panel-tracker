import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { getEquipmentHistory } from "@/lib/services/equipment";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const exists = await prisma.equipment.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return jsonError("Equipment not found.", 404);
    const history = await getEquipmentHistory(id);
    return NextResponse.json({ history });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to load history.", 500);
  }
}
