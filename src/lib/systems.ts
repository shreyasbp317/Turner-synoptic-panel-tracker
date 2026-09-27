import type { SystemType } from "@prisma/client";

/** TWMS lives on the MES/FCM drawing — do not show it as its own system. */
export const HIDDEN_SYSTEM_TYPES: SystemType[] = ["TWMS"];

export function isVisibleSystem(systemType: SystemType): boolean {
  return !HIDDEN_SYSTEM_TYPES.includes(systemType);
}
