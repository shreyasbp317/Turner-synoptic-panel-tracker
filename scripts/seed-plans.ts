/**
 * Seeds bundled SVG floor plans into the DB (no UI upload required).
 * Run: npx tsx --env-file=.env scripts/seed-plans.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { uploadFloorPlan } from "../src/lib/services/floor-plans";

const prisma = new PrismaClient();

const BUNDLED = [
  {
    file: "plans/rpl3/Completed-RPL3-1.svg",
    building: "RPL 3",
    systemType: "MES_FCM" as const,
    zone: "Data Hall A",
    name: "Completed-RPL3-1",
  },
  {
    file: "plans/rpl3/Completed-RPL3-2.svg",
    building: "RPL 3",
    systemType: "MES_FCM" as const,
    zone: "Data Hall B",
    name: "Completed-RPL3-2",
  },
];

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { email: "shreyasbp317@gmail.com" } })) ||
    (await prisma.user.findFirst({ where: { role: "ADMIN" } }));
  if (!admin) throw new Error("No admin user — run npm run db:seed first");

  for (const item of BUNDLED) {
    const full = path.join(process.cwd(), item.file);
    if (!fs.existsSync(full)) throw new Error(`Missing ${item.file}`);

    const building = await prisma.building.findUnique({ where: { name: item.building } });
    if (!building) throw new Error(`Building ${item.building} not found`);

    const system = await prisma.system.findFirst({
      where: { buildingId: building.id, systemType: item.systemType },
    });
    if (!system) throw new Error(`System ${item.systemType} missing under ${item.building}`);

    const zone = await prisma.zone.findFirst({
      where: { systemId: system.id, name: item.zone },
    });
    if (!zone) throw new Error(`Zone ${item.zone} missing`);

    const content = fs.readFileSync(full, "utf8");
    const result = await uploadFloorPlan({
      target: {
        buildingId: building.id,
        systemId: system.id,
        zoneId: zone.id,
        name: item.name,
      },
      filename: path.basename(item.file),
      content,
      uploadedById: admin.id,
    });
    console.log(`Seeded ${item.name} → ${result.floorPlanId} (${item.zone})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
