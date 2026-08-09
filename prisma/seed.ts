import "dotenv/config";
import { PrismaClient, SystemType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STATUS_SETS = {
  full_delivery_install: [
    { key: "pending_delivery", label: "Pending Delivery", colorHex: "#F0E098", sortOrder: 1, isDefault: true },
    { key: "just_in_time_delivery", label: "Just In Time Delivery", colorHex: "#F800F8", sortOrder: 2, isDefault: false },
    { key: "delivered_to_tent", label: "Delivered to Tent", colorHex: "#0080F8", sortOrder: 3, isDefault: false },
    { key: "installed", label: "Installed", colorHex: "#008000", sortOrder: 4, isDefault: false },
  ],
  hac_delivery_install: [
    { key: "pending_delivery", label: "Pending Delivery", colorHex: "#F0E098", sortOrder: 1, isDefault: true },
    { key: "delivered_to_tent", label: "Delivered to Tent", colorHex: "#0080F8", sortOrder: 2, isDefault: false },
    { key: "installed", label: "Installed", colorHex: "#008000", sortOrder: 3, isDefault: false },
  ],
  yard_status: [
    { key: "pending_delivery", label: "Pending Delivery", colorHex: "#F0E098", sortOrder: 1, isDefault: true },
    { key: "pad_ready", label: "Pad Ready", colorHex: "#F800F8", sortOrder: 2, isDefault: false },
    { key: "delivered", label: "Delivered", colorHex: "#0080F8", sortOrder: 3, isDefault: false },
    { key: "set_in_place", label: "Set in Place", colorHex: "#008000", sortOrder: 4, isDefault: false },
  ],
} as const;

const BUILDINGS = ["RPL 1", "RPL 2", "RPL 3", "RPL 5"];

const SYSTEMS: Array<{
  systemType: SystemType;
  displayName: string;
  statusSetKey: keyof typeof STATUS_SETS;
  sortOrder: number;
  hasZones: boolean;
}> = [
  { systemType: SystemType.MES_FCM, displayName: "MES, TWMS, & FCMs", statusSetKey: "full_delivery_install", sortOrder: 1, hasZones: true },
  { systemType: SystemType.TWMS, displayName: "TWMS", statusSetKey: "full_delivery_install", sortOrder: 2, hasZones: true },
  { systemType: SystemType.HAC, displayName: "HACs", statusSetKey: "hac_delivery_install", sortOrder: 3, hasZones: true },
  { systemType: SystemType.ELECTRICAL_YARD, displayName: "Electrical", statusSetKey: "yard_status", sortOrder: 4, hasZones: false },
  { systemType: SystemType.MECHANICAL_YARD, displayName: "Mechanical Yard", statusSetKey: "yard_status", sortOrder: 5, hasZones: false },
];

const ZONES = ["Data Hall A", "Data Hall B", "Data Hall C", "Data Hall D"];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Admin";

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the initial admin user.");
  }

  for (const [key, options] of Object.entries(STATUS_SETS)) {
    const statusSet = await prisma.statusSet.upsert({
      where: { key },
      update: {},
      create: { key },
    });

    for (const option of options) {
      await prisma.statusSetOption.upsert({
        where: {
          statusSetId_key: { statusSetId: statusSet.id, key: option.key },
        },
        update: {
          label: option.label,
          colorHex: option.colorHex,
          sortOrder: option.sortOrder,
          isDefault: option.isDefault,
        },
        create: {
          statusSetId: statusSet.id,
          key: option.key,
          label: option.label,
          colorHex: option.colorHex,
          sortOrder: option.sortOrder,
          isDefault: option.isDefault,
        },
      });
    }
  }

  const statusSets = await prisma.statusSet.findMany();
  const statusSetByKey = Object.fromEntries(statusSets.map((s) => [s.key, s]));

  for (let i = 0; i < BUILDINGS.length; i++) {
    const building = await prisma.building.upsert({
      where: { name: BUILDINGS[i] },
      update: { sortOrder: i + 1 },
      create: { name: BUILDINGS[i], sortOrder: i + 1 },
    });

    for (const sys of SYSTEMS) {
      const system = await prisma.system.upsert({
        where: {
          buildingId_systemType: {
            buildingId: building.id,
            systemType: sys.systemType,
          },
        },
        update: {
          displayName: sys.displayName,
          statusSetId: statusSetByKey[sys.statusSetKey].id,
          sortOrder: sys.sortOrder,
        },
        create: {
          buildingId: building.id,
          systemType: sys.systemType,
          displayName: sys.displayName,
          statusSetId: statusSetByKey[sys.statusSetKey].id,
          sortOrder: sys.sortOrder,
        },
      });

      if (sys.hasZones) {
        for (let z = 0; z < ZONES.length; z++) {
          await prisma.zone.upsert({
            where: {
              systemId_name: { systemId: system.id, name: ZONES[z] },
            },
            update: { sortOrder: z + 1 },
            create: {
              systemId: system.id,
              name: ZONES[z],
              sortOrder: z + 1,
            },
          });
        }
      }
    }
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: adminName,
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
    create: {
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  console.log("Seed complete.");
  console.log(`Admin user: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
