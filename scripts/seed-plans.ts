/**
 * Seeds bundled SVG floor plans into the DB (no UI upload required).
 * Clears existing RPL 3 plans first, then loads the three current plans.
 * Run: npx tsx --env-file=.env scripts/seed-plans.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, type SystemType } from "@prisma/client";
import { uploadFloorPlan } from "../src/lib/services/floor-plans";

const prisma = new PrismaClient();

type BundledPlan = {
  file: string;
  building: string;
  systemType: SystemType;
  zone?: string;
  name: string;
};

/** Three RPL 3 plans only — Mechanical Yard, MES and Electrical, HAC. */
const BUNDLED: BundledPlan[] = [
  {
    file: "plans/rpl3/Mech_RPL_3.svg",
    building: "RPL 3",
    systemType: "MECHANICAL_YARD",
    name: "Mechanical Yard",
  },
  {
    file: "plans/rpl3/MES_and_Elec-RPL3.svg",
    building: "RPL 3",
    systemType: "MES_FCM",
    zone: "Data Hall A",
    name: "MES and Electrical",
  },
  {
    file: "plans/rpl3/HAC_RPL3.svg",
    building: "RPL 3",
    systemType: "HAC",
    zone: "Data Hall A",
    name: "HAC",
  },
];

async function clearRpl3Plans() {
  const building = await prisma.building.findUnique({ where: { name: "RPL 3" } });
  if (!building) throw new Error("Building RPL 3 not found");

  const systems = await prisma.system.findMany({
    where: { buildingId: building.id },
    select: { id: true },
  });
  const systemIds = systems.map((s) => s.id);
  const zones = await prisma.zone.findMany({
    where: { systemId: { in: systemIds } },
    select: { id: true },
  });
  const zoneIds = zones.map((z) => z.id);

  const plans = await prisma.floorPlan.findMany({
    where: {
      OR: [{ systemId: { in: systemIds } }, { zoneId: { in: zoneIds } }],
    },
    select: { id: true, storagePath: true, backgroundAssetPath: true },
  });

  if (plans.length === 0) {
    console.log("No existing RPL 3 floor plans to remove");
    return building;
  }

  const planIds = plans.map((p) => p.id);
  const paths = [
    ...new Set(
      plans.flatMap((p) => [p.storagePath, p.backgroundAssetPath].filter(Boolean) as string[])
    ),
  ];

  await prisma.statusHistory.deleteMany({
    where: { equipment: { floorPlanId: { in: planIds } } },
  });
  await prisma.equipment.deleteMany({ where: { floorPlanId: { in: planIds } } });
  await prisma.floorPlan.deleteMany({ where: { id: { in: planIds } } });
  if (paths.length) {
    await prisma.storedFile.deleteMany({ where: { relativePath: { in: paths } } });
  }
  // Free Railway Postgres disk — old SVG blobs add up quickly
  const purged = await prisma.storedFile.deleteMany({});
  console.log(
    `Removed ${planIds.length} RPL 3 floor plan(s); purged ${purged.count} stored file(s)`
  );
  return building;
}

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { email: "shreyasbp317@gmail.com" } })) ||
    (await prisma.user.findFirst({ where: { role: "ADMIN" } }));
  if (!admin) throw new Error("No admin user — run npm run db:seed first");

  await clearRpl3Plans();

  for (const item of BUNDLED) {
    const full = path.join(process.cwd(), item.file);
    if (!fs.existsSync(full)) throw new Error(`Missing ${item.file}`);

    const building = await prisma.building.findUnique({ where: { name: item.building } });
    if (!building) throw new Error(`Building ${item.building} not found`);

    const system = await prisma.system.findFirst({
      where: { buildingId: building.id, systemType: item.systemType },
    });
    if (!system) throw new Error(`System ${item.systemType} missing under ${item.building}`);

    let zoneId: string | undefined;
    if (item.zone) {
      const zone = await prisma.zone.findFirst({
        where: { systemId: system.id, name: item.zone },
      });
      if (!zone) throw new Error(`Zone ${item.zone} missing under ${item.systemType}`);
      zoneId = zone.id;
    }

    const content = fs.readFileSync(full, "utf8");
    const result = await uploadFloorPlan({
      target: {
        buildingId: building.id,
        systemId: system.id,
        zoneId,
        name: item.name,
      },
      filename: path.basename(item.file),
      content,
      uploadedById: admin.id,
    });
    console.log(
      `Seeded ${item.name} → ${result.floorPlanId} (${item.systemType}${item.zone ? ` / ${item.zone}` : ""})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
