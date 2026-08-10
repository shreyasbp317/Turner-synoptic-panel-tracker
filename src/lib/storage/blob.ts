import { del, put } from "@vercel/blob";
import type { FileStorage, StoredObject } from "./types";

/**
 * Vercel Blob storage — required for durable uploads on Vercel.
 * Paths may be logical keys; after save(), relativePath becomes the public blob URL.
 */
export class BlobFileStorage implements FileStorage {
  async save(relativePath: string, data: Buffer | string): Promise<StoredObject> {
    const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const blob = await put(relativePath.replace(/\\/g, "/"), buffer, {
      access: "public",
      addRandomSuffix: true,
      allowOverwrite: false,
    });
    return {
      relativePath: blob.url,
      absolutePath: blob.url,
      size: buffer.length,
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    const res = await fetch(relativePath);
    if (!res.ok) {
      throw new Error(`Failed to read blob (${res.status}): ${relativePath}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async readText(relativePath: string): Promise<string> {
    return (await this.read(relativePath)).toString("utf8");
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      const res = await fetch(relativePath, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<void> {
    try {
      await del(relativePath);
    } catch {
      /* ignore */
    }
  }
}
