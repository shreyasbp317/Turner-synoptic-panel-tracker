import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { uploadFloorPlan } from "@/lib/services/floor-plans";

/**
 * Completes an upload after the browser sent the file directly to Vercel Blob
 * (bypasses the 4.5MB serverless request body limit).
 */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const body = (await request.json()) as {
      blobUrl?: string;
      filename?: string;
      buildingId?: string;
      systemId?: string;
      zoneId?: string | null;
      name?: string;
    };

    if (!body.blobUrl || !body.filename || !body.buildingId || !body.systemId) {
      return jsonError("blobUrl, filename, buildingId, and systemId are required.");
    }

    const res = await fetch(body.blobUrl);
    if (!res.ok) {
      return jsonError(`Could not download uploaded blob (${res.status}).`, 400);
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const result = await uploadFloorPlan({
      target: {
        buildingId: body.buildingId,
        systemId: body.systemId,
        zoneId: body.zoneId ?? null,
        name: body.name,
      },
      filename: body.filename,
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
