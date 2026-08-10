import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadFloorPlanBackground } from "@/lib/floor-plan-view";
import { getFileStorage } from "@/lib/storage";

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
      select: {
        storagePath: true,
        backgroundAssetPath: true,
        originalFilename: true,
      },
    });
    if (!floorPlan) return jsonError("Floor plan not found.", 404);

    if (
      floorPlan.backgroundAssetPath &&
      /^https?:\/\//i.test(floorPlan.backgroundAssetPath)
    ) {
      return Response.redirect(floorPlan.backgroundAssetPath, 302);
    }

    if (floorPlan.backgroundAssetPath) {
      const storage = getFileStorage();
      const svg = await storage.readText(floorPlan.backgroundAssetPath);
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const bg = await loadFloorPlanBackground(
      floorPlan.storagePath,
      floorPlan.originalFilename
    );
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
