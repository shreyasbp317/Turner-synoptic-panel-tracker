import fs from "fs/promises";
import path from "path";
import type { FileStorage, StoredObject } from "./types";

const UPLOADS_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

function resolveUploadPath(relativePath: string): string {
  const absolutePath = path.join(/*turbopackIgnore: true*/ UPLOADS_ROOT, relativePath);
  if (!absolutePath.startsWith(UPLOADS_ROOT)) {
    throw new Error("Invalid storage path.");
  }
  return absolutePath;
}

export class LocalFileStorage implements FileStorage {
  async save(relativePath: string, data: Buffer | string): Promise<StoredObject> {
    const absolutePath = resolveUploadPath(relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    await fs.writeFile(absolutePath, buffer);
    return { relativePath, absolutePath, size: buffer.length };
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFile(resolveUploadPath(relativePath));
  }

  async readText(relativePath: string): Promise<string> {
    return fs.readFile(resolveUploadPath(relativePath), "utf8");
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(resolveUploadPath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<void> {
    try {
      await fs.unlink(resolveUploadPath(relativePath));
    } catch {
      /* ignore missing */
    }
  }
}

let storage: FileStorage | null = null;

/** Swap this factory to use Azure Blob / S3 later without touching business logic. */
export function getFileStorage(): FileStorage {
  if (!storage) {
    storage = new LocalFileStorage();
  }
  return storage;
}
