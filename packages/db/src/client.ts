import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "postgresql://shortfactory:shortfactory-local-only@127.0.0.1:5433/shortfactory";

export function createDb(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), pool };
}

export type ShortFactoryDb = ReturnType<typeof createDb>["db"];
