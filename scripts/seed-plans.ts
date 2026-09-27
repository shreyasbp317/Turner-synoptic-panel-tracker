/**
 * Seeds bundled SVG floor plans and applies Excel equipment mapping.
 * Run: npx tsx --env-file=.env scripts/seed-plans.ts [rpl3|rpl5]
 *
 * MES/FCM and Electrical share the same Main drawing on every RPL.
 * When you add RPL 1/2 (or another building), register the Main SVG once via
 * mainAndElectrical(...) — Electrical is cloned and Excel rows are split
 * with sharedMainExcelFilter().
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, type SystemType } from "@prisma/client";
import { uploadFloorPlan } from "../src/lib/services/floor-plans";
import {
  applyExcelMapping,
  loadRplSheet,
  sharedMainExcelFilter,
  type ExcelEquipmentRow,
  type ExcelMappingFilter,
} from "../src/lib/rpl-excel";

const prisma = new PrismaClient();

type BundledPlan = {
  file: string;
  building: string;
  systemType: SystemType;
  zone?: string;
  name: string;
  excelFilter?: ExcelMappingFilter;
};

function mainAndElectrical(opts: {
  file: string;
  building: string;
  zone: string;
  mesName: string;
}): BundledPlan[] {
  return [
    {
      file: opts.file,
      building: opts.building,
      systemType: "MES_FCM",
      zone: opts.zone,
      name: opts.mesName,
      excelFilter: { ...sharedMainExcelFilter("mes"), synopticIncludes: ["Main", "MES-FCM"] },
    },
    {
      file: opts.file,
      building: opts.building,
      systemType: "ELECTRICAL_YARD",
      name: "Electrical",
      excelFilter: sharedMainExcelFilter("electrical"),
    },
  ];
}

const RPL3: BundledPlan[] = [
  {
    file: "plans/rpl3/Mech_RPL_3.svg",
    building: "RPL 3",
    systemType: "MECHANICAL_YARD",
    name: "Mechanical Yard",
    excelFilter: { synopticIncludes: "Mechanical" },
  },
  ...mainAndElectrical({
    file: "plans/rpl3/MES_and_Elec-RPL3.svg",
    building: "RPL 3",
    zone: "Data Hall A",
    mesName: "MES & FCMs",
  }),
  {
    file: "plans/rpl3/HAC_RPL3.svg",
    building: "RPL 3",
    systemType: "HAC",
    zone: "Data Hall A",
    name: "HAC",
    excelFilter: { synopticIncludes: "HAC" },
  },
];

const RPL5: BundledPlan[] = [
  {
    file: "plans/rpl5/RPL_5_Mech.svg",
    building: "RPL 5",
    systemType: "MECHANICAL_YARD",
    name: "Mechanical Yard",
    excelFilter: { synopticIncludes: "Mechanical" },
  },
  ...mainAndElectrical({
    file: "plans/rpl5/RPL_5_All_Blocks.svg",
    building: "RPL 5",
    zone: "Data Hall A",
    mesName: "All Blocks A–D",
  }),
  {
    file: "plans/rpl5/RPL_5_HAC.svg",
    building: "RPL 5",
    systemType: "HAC",
    zone: "Data Hall A",
    name: "HAC A–D",
    excelFilter: { synopticIncludes: "HAC" },
  },
];

/** Add future buildings here: [...mainAndElectrical({ file, building, zone, mesName }), ...] */
const BUNDLES: Record<string, { plans: BundledPlan[]; sheet: string }> = {
  rpl3: { plans: RPL3, sheet: "RPL 3" },
  rpl5: { plans: RPL5, sheet: "RPL 5" },
};

async function adminUser() {
  const admin =
    (await prisma.user.findFirst({ where: { email: "shreyasbp317@gmail.com" } })) ||
    (await prisma.user.findFirst({ where: { role: "ADMIN" } }));
  if (!admin) throw new Error("No admin user — run npm run db:seed first");
  return admin;
}

async function clearBuildingPlans(buildingName: string) {
  const building = await prisma.building.findUnique({ where: { name: buildingName } });
  if (!building) throw new Error(`Building ${buildingName} not found`);

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
    console.log(`No existing ${buildingName} floor plans to remove`);
    return;
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
  console.log(`Removed ${planIds.length} ${buildingName} floor plan(s)`);
}

async function clearSystemPlans(buildingName: string, systemType: SystemType) {
  const building = await prisma.building.findUnique({ where: { name: buildingName } });
  if (!building) throw new Error(`Building ${buildingName} not found`);
  const system = await prisma.system.findFirst({
    where: { buildingId: building.id, systemType },
    select: { id: true },
  });
  if (!system) return;

  const plans = await prisma.floorPlan.findMany({
    where: { OR: [{ systemId: system.id }, { zone: { systemId: system.id } }] },
    select: { id: true, storagePath: true, backgroundAssetPath: true },
  });
  if (plans.length === 0) return;

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
  console.log(`Removed ${planIds.length} ${buildingName} ${systemType} plan(s)`);
}

async function uploadAndMap(
  item: BundledPlan,
  excelRows: ExcelEquipmentRow[],
  uploadedById: string
) {
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

  const result = await uploadFloorPlan({
    target: {
      buildingId: building.id,
      systemId: system.id,
      zoneId,
      name: item.name,
    },
    filename: path.basename(item.file),
    content: fs.readFileSync(full, "utf8"),
    uploadedById,
  });
  console.log(
    `Seeded ${item.name} → ${result.floorPlanId} (${item.systemType}${item.zone ? ` / ${item.zone}` : ""})`
  );

  if (excelRows.length) {
    const mapped = await applyExcelMapping({
      prisma,
      floorPlanId: result.floorPlanId,
      rows: excelRows,
      filter: item.excelFilter,
    });
    console.log(`  mapped ${mapped.matched} tags (${mapped.unmatched} unmatched)`);
  }
}

async function seedBundle(items: BundledPlan[], excelSheet?: string) {
  const admin = await adminUser();
  const excelPath = path.join(process.cwd(), "plans/rpl-data.xlsx");
  const excelRows = excelSheet && fs.existsSync(excelPath) ? loadRplSheet(excelPath, excelSheet) : [];
  const buildingName = items[0]?.building;
  if (!buildingName) return;

  await clearBuildingPlans(buildingName);
  for (const item of items) {
    await uploadAndMap(item, excelRows, admin.id);
  }
}

/**
 * Attach Electrical to the shared Main SVG without wiping HAC / Mechanical.
 * Remaps existing MES/FCM equipment so electrical units are not counted twice.
 */
async function syncSharedElectrical(items: BundledPlan[], excelSheet: string) {
  const admin = await adminUser();
  const excelPath = path.join(process.cwd(), "plans/rpl-data.xlsx");
  const excelRows = fs.existsSync(excelPath) ? loadRplSheet(excelPath, excelSheet) : [];
  const buildingName = items[0]?.building;
  if (!buildingName) return;

  const mesItem = items.find((i) => i.systemType === "MES_FCM");
  const elecItem = items.find((i) => i.systemType === "ELECTRICAL_YARD");
  if (!mesItem || !elecItem) {
    console.log(`No shared MES/Electrical SVG configured for ${buildingName}`);
    return;
  }

  const building = await prisma.building.findUnique({ where: { name: buildingName } });
  if (!building) throw new Error(`Building ${buildingName} not found`);
  const mesSystem = await prisma.system.findFirst({
    where: { buildingId: building.id, systemType: "MES_FCM" },
  });
  const mesPlan = await prisma.floorPlan.findFirst({
    where: {
      active: true,
      OR: [{ systemId: mesSystem?.id }, { zone: { systemId: mesSystem?.id } }],
    },
    orderBy: { uploadedAt: "desc" },
  });

  if (!mesPlan) {
    console.log(`No MES plan on ${buildingName} — seeding full bundle`);
    await seedBundle(items, excelSheet);
    return;
  }

  if (excelRows.length) {
    const mapped = await applyExcelMapping({
      prisma,
      floorPlanId: mesPlan.id,
      rows: excelRows,
      filter: mesItem.excelFilter,
    });
    console.log(
      `Remapped ${buildingName} MES ${mesPlan.id}: ${mapped.matched} matched, ${mapped.unmatched} unmatched`
    );
  }

  await clearSystemPlans(buildingName, "ELECTRICAL_YARD");
  await uploadAndMap(elecItem, excelRows, admin.id);
}

async function remapSharedMain(items: BundledPlan[], excelSheet: string) {
  const excelPath = path.join(process.cwd(), "plans/rpl-data.xlsx");
  const excelRows = fs.existsSync(excelPath) ? loadRplSheet(excelPath, excelSheet) : [];
  const buildingName = items[0]?.building;
  if (!buildingName || !excelRows.length) return;

  const mesItem = items.find((i) => i.systemType === "MES_FCM");
  const elecItem = items.find((i) => i.systemType === "ELECTRICAL_YARD");
  const building = await prisma.building.findUnique({ where: { name: buildingName } });
  if (!building || !mesItem || !elecItem) return;

  await prisma.system.updateMany({
    where: { buildingId: building.id, systemType: "MES_FCM" },
    data: { displayName: "MES & FCMs" },
  });

  const mesSystem = await prisma.system.findFirst({
    where: { buildingId: building.id, systemType: "MES_FCM" },
  });
  const elecSystem = await prisma.system.findFirst({
    where: { buildingId: building.id, systemType: "ELECTRICAL_YARD" },
  });

  const mesPlan = await prisma.floorPlan.findFirst({
    where: {
      active: true,
      OR: [{ systemId: mesSystem?.id }, { zone: { systemId: mesSystem?.id } }],
    },
    orderBy: { uploadedAt: "desc" },
  });
  const elecPlan = await prisma.floorPlan.findFirst({
    where: { active: true, systemId: elecSystem?.id },
    orderBy: { uploadedAt: "desc" },
  });

  if (mesPlan) {
    const mapped = await applyExcelMapping({
      prisma,
      floorPlanId: mesPlan.id,
      rows: excelRows,
      filter: mesItem.excelFilter,
    });
    console.log(`Remapped ${buildingName} MES: ${mapped.matched} matched, ${mapped.unmatched} unmatched`);
  }
  if (elecPlan) {
    const mapped = await applyExcelMapping({
      prisma,
      floorPlanId: elecPlan.id,
      rows: excelRows,
      filter: elecItem.excelFilter,
    });
    console.log(`Remapped ${buildingName} Electrical: ${mapped.matched} matched, ${mapped.unmatched} unmatched`);
  } else {
    const admin = await adminUser();
    await uploadAndMap(elecItem, excelRows, admin.id);
  }
}

async function main() {
  const only = process.argv[2];
  if (only === "remap") {
    await remapSharedMain(BUNDLES.rpl3.plans, BUNDLES.rpl3.sheet);
    await remapSharedMain(BUNDLES.rpl5.plans, BUNDLES.rpl5.sheet);
    return;
  }
  if (!only || only === "rpl3") {
    if (only === "rpl3") {
      await syncSharedElectrical(BUNDLES.rpl3.plans, BUNDLES.rpl3.sheet);
    } else {
      const building = await prisma.building.findUnique({
        where: { name: "RPL 3" },
        include: { systems: { include: { floorPlans: { where: { active: true }, take: 1 } } } },
      });
      const hasPlans = building?.systems.some((s) => s.floorPlans.length > 0);
      if (!hasPlans) await seedBundle(RPL3, "RPL 3");
      else console.log("RPL 3 already has plans — skipping full seed (run with rpl3 to sync Electrical)");
    }
  }
  if (!only || only === "rpl5") {
    if (only === "rpl5") await seedBundle(RPL5, "RPL 5");
    else {
      const building = await prisma.building.findUnique({
        where: { name: "RPL 5" },
        include: { systems: { include: { floorPlans: { where: { active: true }, take: 1 } } } },
      });
      const hasPlans = building?.systems.some((s) => s.floorPlans.length > 0);
      if (!hasPlans) await seedBundle(RPL5, "RPL 5");
      else console.log("RPL 5 already has plans — skipping full seed");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
