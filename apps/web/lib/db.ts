import { createDb, createIdentityRepository, type ShortFactoryDb } from "@shortfactory/db";

const globalForShortFactory = globalThis as typeof globalThis & { shortFactoryDb?: ShortFactoryDb };

export function getDb(): ShortFactoryDb {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URLが必要です");
  globalForShortFactory.shortFactoryDb ??= createDb(process.env.DATABASE_URL).db;
  return globalForShortFactory.shortFactoryDb;
}

export function getIdentityRepository() {
  return createIdentityRepository(getDb());
}
