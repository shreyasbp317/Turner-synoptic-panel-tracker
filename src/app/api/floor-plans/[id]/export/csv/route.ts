import { isErrorResponse, jsonError, requireApiRole } from "@/lib/api";
import { exportFloorPlanCsv } from "@/lib/services/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiRole(["ADMIN", "EDITOR"]);
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const file = await exportFloorPlanCsv(id);
    return new Response(file.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "CSV export failed.", 400);
  }
}
