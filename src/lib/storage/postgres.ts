import { prisma } from "@/lib/db";
import type { FileStorage, StoredObject } from "./types";

/** Stores file bytes in Postgres — usable when Blob isn't configured. */
export class PostgresFileStorage implements FileStorage {
  async save(relativePath: string, data: Buffer | string): Promise<StoredObject> {
    const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const bytes = new Uint8Array(buffer);
    await prisma.storedFile.upsert({
      where: { relativePath },
      create: { relativePath, content: bytes },
      update: { content: bytes },
    });
    return {
      relativePath,
      absolutePath: `postgres://${relativePath}`,
      size: buffer.length,
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    const row = await prisma.storedFile.findUnique({ where: { relativePath } });
    if (!row) throw new Error(`File not found in database storage: ${relativePath}`);
    return Buffer.from(row.content);
  }

  async readText(relativePath: string): Promise<string> {
    return (await this.read(relativePath)).toString("utf8");
  }

  async exists(relativePath: string): Promise<boolean> {
    const row = await prisma.storedFile.findUnique({
      where: { relativePath },
      select: { id: true },
    });
    return Boolean(row);
  }

  async delete(relativePath: string): Promise<void> {
    try {
      await prisma.storedFile.delete({ where: { relativePath } });
    } catch {
      /* ignore */
    }
  }
}
