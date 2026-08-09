import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { previewCsvMapping } from "@/lib/services/mapping";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("CSV file is required.");

    const equipment = await prisma.equipment.findMany({
      where: { floorPlanId: id },
      select: {
        id: true,
        shapeKey: true,
        x: true,
        y: true,
        equipmentTag: true,
        equipmentName: true,
        equipmentType: true,
        layer: true,
        scheduleId: true,
        scheduleActivity: true,
      },
    });
    if (equipment.length === 0) return jsonError("Floor plan not found or has no equipment.", 404);

    const text = await file.text();
    const result = previewCsvMapping({ csvText: text, equipment });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "CSV preview failed.", 400);
  }
}
