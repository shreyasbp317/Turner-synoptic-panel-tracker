import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { commitCsvMapping } from "@/lib/services/mapping";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { rows?: unknown[] };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return jsonError("rows array is required.");
    }

    const equipment = await commitCsvMapping(id, body.rows as Parameters<typeof commitCsvMapping>[1]);
    return NextResponse.json({ equipment });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Commit failed.", 400);
  }
}
