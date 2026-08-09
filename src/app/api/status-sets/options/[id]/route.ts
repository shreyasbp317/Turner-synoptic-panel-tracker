import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      label?: string;
      colorHex?: string;
      sortOrder?: number;
    };

    if (body.colorHex && !/^#[0-9A-Fa-f]{6}$/.test(body.colorHex)) {
      return jsonError("colorHex must be a #RRGGBB value.");
    }

    const updated = await prisma.statusSetOption.update({
      where: { id },
      data: {
        ...(body.label != null ? { label: body.label } : {}),
        ...(body.colorHex != null ? { colorHex: body.colorHex.toUpperCase() } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      key: updated.key,
      label: updated.label,
      colorHex: updated.colorHex,
      sortOrder: updated.sortOrder,
      isDefault: updated.isDefault,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update status option.", 400);
  }
}
