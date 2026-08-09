export type StoredObject = {
  relativePath: string;
  absolutePath: string;
  size: number;
};

export interface FileStorage {
  save(relativePath: string, data: Buffer | string): Promise<StoredObject>;
  read(relativePath: string): Promise<Buffer>;
  readText(relativePath: string): Promise<string>;
  exists(relativePath: string): Promise<boolean>;
  delete(relativePath: string): Promise<void>;
}
