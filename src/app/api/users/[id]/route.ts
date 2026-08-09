import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
      email?: string;
      role?: UserRole;
      active?: boolean;
      password?: string;
    };

    if (body.role && !Object.values(UserRole).includes(body.role)) {
      return jsonError("Invalid role.");
    }

    if (id === actor.id && body.active === false) {
      return jsonError("You cannot deactivate your own account.");
    }

    if (body.password != null && body.password.length < 8) {
      return jsonError("Password must be at least 8 characters.");
    }

    const data: {
      name?: string;
      email?: string;
      role?: UserRole;
      active?: boolean;
      passwordHash?: string;
    } = {
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.email != null ? { email: body.email.toLowerCase().trim() } : {}),
      ...(body.role != null ? { role: body.role } : {}),
      ...(body.active != null ? { active: body.active } : {}),
    };

    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user.";
    if (message.includes("Unique constraint")) {
      return jsonError("A user with that email already exists.", 409);
    }
    return jsonError(message, 400);
  }
}
