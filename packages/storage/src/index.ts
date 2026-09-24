import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresInSec: number): Promise<string>;
}

export interface LocalStoredObject {
  contentType: string;
  size: number;
}

interface StoredMetadata extends LocalStoredObject {
  key: string;
}

/**
 * CLI/ワーカー用のローカルStorageProvider。
 * signedUrlはローカル検証用のfile:// URLであり、公開配信用ではない。
 */
export class LocalStorageProvider implements StorageProvider {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const paths = this.pathsFor(key);
    await mkdir(dirname(paths.objectPath), { recursive: true });

    const temporaryPath = `${paths.objectPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, body);
      await rename(temporaryPath, paths.objectPath);
      await writeFile(
        paths.metadataPath,
        JSON.stringify({ key, contentType, size: body.byteLength } satisfies StoredMetadata),
        "utf8",
      );
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const { objectPath } = this.pathsFor(key);
    return new Uint8Array(await readFile(objectPath));
  }

  async delete(key: string): Promise<void> {
    const paths = this.pathsFor(key);
    await Promise.all([
      rm(paths.objectPath, { force: true }),
      rm(paths.metadataPath, { force: true }),
    ]);
  }

  async signedUrl(key: string, expiresInSec: number): Promise<string> {
    if (!Number.isFinite(expiresInSec) || expiresInSec <= 0) {
      throw new Error("expiresInSec must be a positive finite number");
    }
    const { objectPath } = this.pathsFor(key);
    return pathToFileURL(objectPath).toString();
  }

  private pathsFor(key: string): { objectPath: string; metadataPath: string } {
    validateKey(key);
    const objectPath = resolve(this.rootDir, key);
    const relativePath = relative(this.rootDir, objectPath);
    if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("storage key escapes the storage root");
    }
    return { objectPath, metadataPath: `${objectPath}.meta.json` };
  }
}

export async function readLocalMetadata(
  provider: LocalStorageProvider,
  key: string,
): Promise<LocalStoredObject> {
  validateKey(key);
  const metadataPath = `${resolve(provider.rootDir, key)}.meta.json`;
  return JSON.parse(await readFile(metadataPath, "utf8")) as LocalStoredObject;
}

function validateKey(key: string): void {
  if (!key || key.includes("\0") || isAbsolute(key)) {
    throw new Error("storage key must be a non-empty relative path");
  }
  const normalized = normalize(key);
  if (normalized === "." || normalized.startsWith("..") || normalized.includes(`${".."}/`)) {
    throw new Error("storage key must not contain parent traversal");
  }
}
