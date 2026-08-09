import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export interface AuthProvider {
  validateCredentials(email: string, password: string): Promise<SessionUser | null>;
  getUserById(id: string): Promise<SessionUser | null>;
}

export function canEditStatus(role: UserRole): boolean {
  return role === "ADMIN" || role === "EDITOR";
}

export function canUpload(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canMapEquipment(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canExport(role: UserRole): boolean {
  return role === "ADMIN" || role === "EDITOR";
}

export function canEditStatusSets(role: UserRole): boolean {
  return role === "ADMIN";
}
