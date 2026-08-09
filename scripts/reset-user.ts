/**
 * One-off: update an existing user's email/password from env or CLI args.
 *
 * Usage:
 *   npx tsx scripts/reset-user.ts --email admin@turner.local --password "NewPass123!"
 *   npx tsx scripts/reset-user.ts --email admin@turner.local --new-email you@company.com --password "NewPass123!"
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = (arg("email") || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const newEmail = (arg("new-email") || "").toLowerCase().trim() || undefined;
  const password = arg("password") || process.env.ADMIN_PASSWORD;

  if (!email) {
    throw new Error("Provide --email or ADMIN_EMAIL");
  }
  if (!password || password.length < 8) {
    throw new Error("Provide --password (min 8 chars) or ADMIN_PASSWORD");
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found with email ${email}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      ...(newEmail ? { email: newEmail } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  console.log("Updated user:", updated);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
