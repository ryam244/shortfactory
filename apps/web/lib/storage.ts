import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { LocalStorageProvider } from "@shortfactory/storage";

const globalForShortFactory = globalThis as typeof globalThis & { shortFactoryStorage?: LocalStorageProvider };

export function getStorage() {
  const cwd = process.cwd();
  const baseDir = existsSync(resolve(cwd, "pnpm-workspace.yaml")) ? cwd : existsSync(resolve(cwd, "../..", "pnpm-workspace.yaml")) ? resolve(cwd, "../..") : cwd;
  const rootDir = resolve(baseDir, process.env.SHORTFACTORY_STORAGE_ROOT ?? "storage");
  globalForShortFactory.shortFactoryStorage ??= new LocalStorageProvider(rootDir);
  return globalForShortFactory.shortFactoryStorage;
}
