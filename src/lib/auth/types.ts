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

/**
 * All invited/authenticated users have full access (upload, status edits,
 * mapping, export, user admin). Role enum is kept for DB compatibility only.
 */
export function canEditStatus(_role?: UserRole): boolean {
  return true;
}

export function canUpload(_role?: UserRole): boolean {
  return true;
}

export function canManageUsers(_role?: UserRole): boolean {
  return true;
}

export function canMapEquipment(_role?: UserRole): boolean {
  return true;
}

export function canExport(_role?: UserRole): boolean {
  return true;
}

export function canEditStatusSets(_role?: UserRole): boolean {
  return true;
}
