import { join } from "node:path";
import { LocalStorageProvider } from "@shortfactory/storage";

const globalForShortFactory = globalThis as typeof globalThis & { shortFactoryStorage?: LocalStorageProvider };

export function getStorage() {
  const rootDir = process.env.SHORTFACTORY_STORAGE_ROOT ?? join(process.cwd(), "storage");
  globalForShortFactory.shortFactoryStorage ??= new LocalStorageProvider(rootDir);
  return globalForShortFactory.shortFactoryStorage;
}
