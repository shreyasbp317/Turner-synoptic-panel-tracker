import fs from "fs/promises";
import path from "path";
import type { FileStorage, StoredObject } from "./types";
import { BlobFileStorage } from "./blob";
import { PostgresFileStorage } from "./postgres";

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

/** Reads http(s) URLs directly; otherwise delegates to an inner storage. */
export class HybridFileStorage implements FileStorage {
  constructor(private inner: FileStorage) {}

  private isRemote(p: string) {
    return /^https?:\/\//i.test(p);
  }

  async save(relativePath: string, data: Buffer | string): Promise<StoredObject> {
    return this.inner.save(relativePath, data);
  }

  async read(relativePath: string): Promise<Buffer> {
    if (this.isRemote(relativePath)) {
      const res = await fetch(relativePath);
      if (!res.ok) throw new Error(`Failed to fetch remote file (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    return this.inner.read(relativePath);
  }

  async readText(relativePath: string): Promise<string> {
    return (await this.read(relativePath)).toString("utf8");
  }

  async exists(relativePath: string): Promise<boolean> {
    if (this.isRemote(relativePath)) {
      try {
        const res = await fetch(relativePath, { method: "HEAD" });
        return res.ok;
      } catch {
        return false;
      }
    }
    return this.inner.exists(relativePath);
  }

  async delete(relativePath: string): Promise<void> {
    if (this.isRemote(relativePath)) {
      // Blob URLs are deleted via BlobFileStorage when that driver is active.
      if (this.inner instanceof BlobFileStorage) {
        await this.inner.delete(relativePath);
      }
      return;
    }
    return this.inner.delete(relativePath);
  }
}

let storage: FileStorage | null = null;

export function resolveStorageDriver(): "local" | "postgres" | "blob" {
  const explicit = (process.env.STORAGE_DRIVER || "").toLowerCase();
  if (explicit === "blob" || explicit === "postgres" || explicit === "local") {
    return explicit;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) return "postgres";
  return "local";
}

/** Swap this factory to use Azure Blob / S3 later without touching business logic. */
export function getFileStorage(): FileStorage {
  if (!storage) {
    const driver = resolveStorageDriver();
    const inner =
      driver === "blob"
        ? new BlobFileStorage()
        : driver === "postgres"
          ? new PostgresFileStorage()
          : new LocalFileStorage();
    storage = new HybridFileStorage(inner);
  }
  return storage;
}

export function useClientBlobUpload(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_BLOB_UPLOAD === "1" ||
    resolveStorageDriver() === "blob" ||
    Boolean(process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN)
  );
}
