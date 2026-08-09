import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { uploadFloorPlan } from "@/lib/services/floor-plans";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const form = await request.formData();
    const buildingId = String(form.get("buildingId") || "");
    const systemId = String(form.get("systemId") || "");
    const zoneIdRaw = form.get("zoneId");
    const zoneId = zoneIdRaw ? String(zoneIdRaw) : null;
    const name = form.get("name") ? String(form.get("name")) : undefined;
    const file = form.get("file");

    if (!buildingId || !systemId || !(file instanceof File)) {
      return jsonError("buildingId, systemId, and file are required.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFloorPlan({
      target: { buildingId, systemId, zoneId, name },
      filename: file.name,
      content: buffer,
      uploadedById: user.id,
    });

    return NextResponse.json({
      floorPlanId: result.floorPlanId,
      warnings: result.warnings,
      mappingCarryForward: result.mappingCarryForward,
      mapUrl: `/floor-plans/${result.floorPlanId}/map`,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed.", 400);
  }
}
