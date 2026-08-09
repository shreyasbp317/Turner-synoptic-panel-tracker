/**
 * Smoke test: parse fixture + upload via service layer (no HTTP).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseFloorPlanFile } from "../src/lib/parsers";
import { uploadFloorPlan } from "../src/lib/services/floor-plans";

async function main() {
  const fixture = path.join(process.cwd(), "fixtures", "RPL-3_Mech.jsvg");
  const content = fs.readFileSync(fixture, "utf8");
  const parsed = parseFloorPlanFile("RPL-3_Mech.jsvg", content);
  console.log("Parsed shapes:", parsed.shapes.length, "warnings:", parsed.warnings.length);

  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user — run db:seed");

  const building = await prisma.building.findUnique({ where: { name: "RPL 3" } });
  const system = await prisma.system.findFirst({
    where: { buildingId: building!.id, systemType: "MECHANICAL_YARD" },
  });
  if (!building || !system) throw new Error("Missing RPL 3 Mechanical Yard seed");

  const result = await uploadFloorPlan({
    target: { buildingId: building.id, systemId: system.id, name: "RPL-3 Mechanical Yard" },
    filename: "RPL-3_Mech.jsvg",
    content,
    uploadedById: admin.id,
  });

  console.log("Uploaded floorPlanId:", result.floorPlanId);
  console.log("Carry forward:", result.mappingCarryForward);

  const count = await prisma.equipment.count({ where: { floorPlanId: result.floorPlanId } });
  const pending = await prisma.equipment.count({
    where: {
      floorPlanId: result.floorPlanId,
      currentStatusOption: { key: "pending_delivery" },
    },
  });
  console.log("Equipment rows:", count, "pending:", pending);

  const sample = await prisma.equipment.findFirst({
    where: { floorPlanId: result.floorPlanId },
    include: { currentStatusOption: true },
  });
  console.log("Sample status color:", sample?.currentStatusOption.colorHex);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
