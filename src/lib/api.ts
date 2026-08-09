import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";
import type { UserRole } from "@prisma/client";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);
  return user;
}

export async function requireApiRole(
  roles: UserRole[]
): Promise<SessionUser | NextResponse> {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!roles.includes(user.role)) return jsonError("Forbidden", 403);
  return user;
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
