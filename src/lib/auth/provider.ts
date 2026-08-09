import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { AuthProvider, SessionUser } from "./types";

function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  role: SessionUser["role"];
  active: boolean;
}): SessionUser | null {
  if (!user.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export class InviteOnlyPasswordAuth implements AuthProvider {
  async validateCredentials(email: string, password: string): Promise<SessionUser | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !user.active) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return toSessionUser(user);
  }

  async getUserById(id: string): Promise<SessionUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return toSessionUser(user);
  }
}

let authProvider: AuthProvider | null = null;

/** Swap this factory for Azure AD / Entra ID SSO later without rewriting callers. */
export function getAuthProvider(): AuthProvider {
  if (!authProvider) {
    authProvider = new InviteOnlyPasswordAuth();
  }
  return authProvider;
}
