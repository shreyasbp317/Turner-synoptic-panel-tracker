/**
 * Production boot: apply Prisma migrations, then start Next.js.
 * Railway injects PORT and DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

console.log("Applying database migrations...");
run("npx", ["prisma", "migrate", "deploy"]);

const port = process.env.PORT || "3000";
console.log(`Starting Next.js on 0.0.0.0:${port}`);
run("npx", ["next", "start", "-H", "0.0.0.0", "-p", String(port)]);
