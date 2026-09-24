import { and, eq, lt } from "drizzle-orm";
import { createDb, videoOutputs } from "@shortfactory/db";
import { LocalStorageProvider } from "@shortfactory/storage";
import { existsSync } from "node:fs";
import path from "node:path";

const retentionDays = Number(process.env.SHORTFACTORY_OUTPUT_RETENTION_DAYS ?? 30);
if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error("SHORTFACTORY_OUTPUT_RETENTION_DAYS must be a positive integer");
const apply = process.argv.includes("--apply");
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
const { db, pool } = createDb();
const cwd = process.cwd();
const workspaceRoot = existsSync(path.resolve(cwd, "pnpm-workspace.yaml")) ? cwd : existsSync(path.resolve(cwd, "../..", "pnpm-workspace.yaml")) ? path.resolve(cwd, "../..") : cwd;
const storage = new LocalStorageProvider(path.resolve(workspaceRoot, process.env.SHORTFACTORY_STORAGE_ROOT ?? "storage"));

try {
  const outputs = await db.select().from(videoOutputs).where(lt(videoOutputs.createdAt, cutoff));
  console.log(`retention=${retentionDays}d cutoff=${cutoff} candidates=${outputs.length} mode=${apply ? "apply" : "dry-run"}`);
  for (const output of outputs) {
    console.log(`${output.id} ${output.storageKey}`);
    if (!apply) continue;
    await storage.delete(output.storageKey).catch((error) => console.warn(`storage delete skipped: ${output.storageKey}`, error));
    await db.delete(videoOutputs).where(and(eq(videoOutputs.id, output.id), eq(videoOutputs.storageKey, output.storageKey)));
  }
} finally {
  await pool.end();
}
