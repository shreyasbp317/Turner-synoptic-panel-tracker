/**
 * Re-seed only the RPL 3 Mechanical Yard plan (after SVG transform parser fix).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { uploadFloorPlan } from "../src/lib/services/floor-plans";

const prisma = new PrismaClient();

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { email: "shreyasbp317@gmail.com" } })) ||
    (await prisma.user.findFirst({ where: { role: "ADMIN" } }));
  if (!admin) throw new Error("No admin user");

  const building = await prisma.building.findUnique({ where: { name: "RPL 3" } });
  if (!building) throw new Error("RPL 3 missing");
  const system = await prisma.system.findFirst({
    where: { buildingId: building.id, systemType: "MECHANICAL_YARD" },
  });
  if (!system) throw new Error("MECHANICAL_YARD missing");

  const existing = await prisma.floorPlan.findMany({
    where: { systemId: system.id },
    select: { id: true, storagePath: true, backgroundAssetPath: true },
  });
  const planIds = existing.map((p) => p.id);
  const paths = [
    ...new Set(
      existing.flatMap((p) => [p.storagePath, p.backgroundAssetPath].filter(Boolean) as string[])
    ),
  ];
  if (planIds.length) {
    await prisma.statusHistory.deleteMany({
      where: { equipment: { floorPlanId: { in: planIds } } },
    });
    await prisma.equipment.deleteMany({ where: { floorPlanId: { in: planIds } } });
    await prisma.floorPlan.deleteMany({ where: { id: { in: planIds } } });
    if (paths.length) {
      await prisma.storedFile.deleteMany({ where: { relativePath: { in: paths } } });
    }
    console.log(`Removed ${planIds.length} old mechanical plan(s)`);
  }

  const file = path.join(process.cwd(), "plans/rpl3/Mech_RPL_3.svg");
  const content = fs.readFileSync(file, "utf8");
  const result = await uploadFloorPlan({
    target: { buildingId: building.id, systemId: system.id, name: "Mechanical Yard" },
    filename: "Mech_RPL_3.svg",
    content,
    uploadedById: admin.id,
  });
  console.log(`Seeded Mechanical Yard → ${result.floorPlanId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
