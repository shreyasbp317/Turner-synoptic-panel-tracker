import EmbeddedPostgres from "embedded-postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const databaseDir = path.join(root, "data", "embedded-pg");
const port = 54329;
const user = "postgres";
const password = "password";
const dbName = "rpl10x";

async function main() {
  fs.mkdirSync(databaseDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
  });

  const alreadyInit = fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  if (!alreadyInit) {
    console.log("Initializing embedded PostgreSQL cluster...");
    await pg.initialise();
  }

  console.log(`Starting embedded PostgreSQL on port ${port}...`);
  try {
    await pg.start();
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes("already running") || msg.includes("Address already in use")) {
      console.log("Embedded PostgreSQL appears to already be running.");
    } else {
      throw err;
    }
  }

  try {
    await pg.createDatabase(dbName);
    console.log(`Created database ${dbName}`);
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes("already exists")) {
      console.log(`Database ${dbName} already exists`);
    } else {
      // createDatabase may fail if server was already up from a prior process
      console.log("createDatabase note:", msg);
    }
  }

  console.log(`DATABASE_URL=postgresql://${user}:${password}@127.0.0.1:${port}/${dbName}`);
  console.log("Embedded PostgreSQL is ready. Leave this process running.");

  const shutdown = async () => {
    console.log("Stopping embedded PostgreSQL...");
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
