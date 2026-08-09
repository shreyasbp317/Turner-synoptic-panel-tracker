import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { isErrorResponse, jsonError, requireApiRole } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await requireApiRole(["ADMIN"]);
  if (isErrorResponse(actor)) return actor;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      role?: UserRole;
      active?: boolean;
    };

    if (body.role && !Object.values(UserRole).includes(body.role)) {
      return jsonError("Invalid role.");
    }

    if (id === actor.id && body.active === false) {
      return jsonError("You cannot deactivate your own account.");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.role != null ? { role: body.role } : {}),
        ...(body.active != null ? { active: body.active } : {}),
      },
      select: { id: true, name: true, email: true, role: true, active: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update user.", 400);
  }
}
