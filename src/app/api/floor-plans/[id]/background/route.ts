import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadFloorPlanBackground } from "@/lib/floor-plan-view";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const floorPlan = await prisma.floorPlan.findUnique({
      where: { id },
      select: { storagePath: true, originalFilename: true },
    });
    if (!floorPlan) return jsonError("Floor plan not found.", 404);

    const bg = await loadFloorPlanBackground(floorPlan.storagePath, floorPlan.originalFilename);
    return new Response(bg.backgroundSvg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to load background.", 500);
  }
}
