import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!body.name || !body.email || !body.password) {
      return jsonError("name, email, and password are required.");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const created = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.toLowerCase().trim(),
        passwordHash,
        role: UserRole.ADMIN,
        active: true,
      },
      select: { id: true, name: true, email: true, role: true, active: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user.";
    if (message.includes("Unique constraint")) {
      return jsonError("A user with that email already exists.", 409);
    }
    return jsonError(message, 400);
  }
}
