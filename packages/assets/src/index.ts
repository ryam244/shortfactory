import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export interface AssetProvider {
  resolve(keys: Iterable<string>): Promise<Record<string, string>>;
}

export interface LocalAssetDescriptor {
  path: string;
  contentType: string;
  source: string;
  rightsNote: string;
}

export type LocalAssetManifest = Record<string, LocalAssetDescriptor>;

/**
 * ローカル素材をRemotionがそのまま読めるdata URLへ解決する。
 * LLMのVideoPlanにはURLを入れず、asset keyだけを保存する前提。
 */
export class LocalAssetProvider implements AssetProvider {
  readonly rootDir: string;
  readonly manifest: LocalAssetManifest;

  constructor(rootDir: string, manifest: LocalAssetManifest) {
    this.rootDir = resolve(rootDir);
    this.manifest = manifest;
  }

  async resolve(keys: Iterable<string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const key of new Set(keys)) {
      const descriptor = this.manifest[key];
      if (!descriptor) throw new Error(`asset is not registered: ${key}`);
      const filePath = resolve(this.rootDir, descriptor.path);
      const relativePath = relative(this.rootDir, filePath);
      if (!descriptor.path || isAbsolute(descriptor.path) || relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new Error(`asset path escapes the asset root: ${key}`);
      }
      if (!descriptor.contentType || descriptor.contentType.includes("\n") || descriptor.contentType.includes("\r")) {
        throw new Error(`invalid asset content type: ${key}`);
      }
      if (!descriptor.source.trim() || !descriptor.rightsNote.trim()) {
        throw new Error(`asset rights metadata is required: ${key}`);
      }
      const bytes = await readFile(filePath);
      result[key] = `data:${descriptor.contentType};base64,${bytes.toString("base64")}`;
    }
    return result;
  }
}
