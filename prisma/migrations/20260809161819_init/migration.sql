-- CreateEnum
CREATE TYPE "SystemType" AS ENUM ('MES_FCM', 'TWMS', 'HAC', 'ELECTRICAL_YARD', 'MECHANICAL_YARD');

-- CreateEnum
CREATE TYPE "SourceFormat" AS ENUM ('SVG', 'JSVG');

-- CreateEnum
CREATE TYPE "ShapeType" AS ENUM ('RECT', 'PATH', 'POLYGON', 'CIRCLE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "systems" (
    "id" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "system_type" "SystemType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status_set_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT,
    "system_id" TEXT,
    "name" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "source_format" "SourceFormat" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "background_asset_path" TEXT,
    "viewBox" TEXT,
    "canvas_width" DOUBLE PRECISION,
    "canvas_height" DOUBLE PRECISION,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_file_last_updated" TIMESTAMP(3),
    "last_refresh_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parse_warnings" TEXT,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "floor_plan_id" TEXT NOT NULL,
    "shape_key" TEXT NOT NULL,
    "shape_type" "ShapeType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "raw_shape_data" TEXT,
    "equipment_tag" TEXT,
    "equipment_name" TEXT,
    "equipment_type" TEXT,
    "layer" TEXT,
    "notes" TEXT,
    "schedule_id" TEXT,
    "schedule_activity" TEXT,
    "current_status_option_id" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_sets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "status_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_set_options" (
    "id" TEXT NOT NULL,
    "status_set_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "status_set_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "status_option_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "buildings_name_key" ON "buildings"("name");

-- CreateIndex
CREATE UNIQUE INDEX "systems_building_id_system_type_key" ON "systems"("building_id", "system_type");

-- CreateIndex
CREATE UNIQUE INDEX "zones_system_id_name_key" ON "zones"("system_id", "name");

-- CreateIndex
CREATE INDEX "equipment_floor_plan_id_idx" ON "equipment"("floor_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_floor_plan_id_shape_key_key" ON "equipment"("floor_plan_id", "shape_key");

-- CreateIndex
CREATE UNIQUE INDEX "status_sets_key_key" ON "status_sets"("key");

-- CreateIndex
CREATE UNIQUE INDEX "status_set_options_status_set_id_key_key" ON "status_set_options"("status_set_id", "key");

-- CreateIndex
CREATE INDEX "status_history_equipment_id_changed_at_idx" ON "status_history"("equipment_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "systems" ADD CONSTRAINT "systems_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "systems" ADD CONSTRAINT "systems_status_set_id_fkey" FOREIGN KEY ("status_set_id") REFERENCES "status_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_current_status_option_id_fkey" FOREIGN KEY ("current_status_option_id") REFERENCES "status_set_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_set_options" ADD CONSTRAINT "status_set_options_status_set_id_fkey" FOREIGN KEY ("status_set_id") REFERENCES "status_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_status_option_id_fkey" FOREIGN KEY ("status_option_id") REFERENCES "status_set_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
