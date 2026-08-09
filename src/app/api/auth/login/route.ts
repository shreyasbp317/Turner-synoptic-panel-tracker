import { NextResponse } from "next/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { createSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return jsonError("Email and password are required.");
    }
    const user = await getAuthProvider().validateCredentials(body.email, body.password);
    if (!user) {
      return jsonError("Invalid email or password.", 401);
    }
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Login failed.", 500);
  }
}
