import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { exportFloorPlanFile } from "@/lib/services/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const file = await exportFloorPlanFile(id);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Export failed.", 400);
  }
}
