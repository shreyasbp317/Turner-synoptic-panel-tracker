import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { updateEquipmentStatus } from "../src/lib/services/equipment";
import { exportFloorPlanCsv, exportFloorPlanFile } from "../src/lib/services/export";
import { parseFloorPlanFile } from "../src/lib/parsers";
import fs from "fs";
import path from "path";

async function main() {
  const svg = fs.readFileSync(path.join(process.cwd(), "fixtures", "sample-equipment.svg"), "utf8");
  const parsed = parseFloorPlanFile("sample-equipment.svg", svg);
  console.log(
    "SVG shapes:",
    parsed.shapes.map((s) => `${s.shapeKey}:${s.shapeType}:${s.equipmentTag}`)
  );

  const prisma = new PrismaClient();
  const eq = await prisma.equipment.findFirst({
    where: { floorPlan: { active: true } },
    include: {
      floorPlan: { include: { system: true, zone: { include: { system: true } } } },
    },
  });
  if (!eq) throw new Error("No equipment");

  const system = eq.floorPlan.zone?.system ?? eq.floorPlan.system;
  if (!system) throw new Error("No system");

  const opt = await prisma.statusSetOption.findFirst({
    where: { statusSetId: system.statusSetId, key: "set_in_place" },
  });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!opt || !admin) throw new Error("Missing option/admin");

  const updated = await updateEquipmentStatus({
    equipmentId: eq.id,
    statusOptionId: opt.id,
    userId: admin.id,
  });
  console.log("Updated to", updated.currentStatus);

  const hist = await prisma.statusHistory.count({ where: { equipmentId: eq.id } });
  console.log("History rows:", hist);

  const csv = await exportFloorPlanCsv(eq.floorPlanId);
  console.log("CSV", csv.filename, "bytes", csv.body.length);
  console.log("CSV sample line:", csv.body.split("\n")[1]?.slice(0, 120));

  const file = await exportFloorPlanFile(eq.floorPlanId);
  console.log("File", file.filename, file.contentType, "bytes", file.body.length);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
