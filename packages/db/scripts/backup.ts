import { execFile } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const backupDir = path.resolve(process.env.SHORTFACTORY_BACKUP_DIR ?? "backups/postgres");
const retention = Number(process.env.SHORTFACTORY_BACKUP_GENERATIONS ?? 7);

if (!Number.isInteger(retention) || retention < 1) {
  throw new Error("SHORTFACTORY_BACKUP_GENERATIONS must be a positive integer");
}

await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const outputPath = path.join(backupDir, `shortfactory-${stamp}.dump`);
const databaseArgs = databaseUrl ? [databaseUrl] : [];

try {
  await execFileAsync("pg_dump", ["--format=custom", "--no-owner", "--file", outputPath, ...databaseArgs], {
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
} catch (error) {
  await rm(outputPath, { force: true });
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`pg_dump failed: ${detail}`);
}

const backups = (await readdir(backupDir))
  .filter((entry) => /^shortfactory-.*\.dump$/.test(entry))
  .sort()
  .reverse();
for (const oldBackup of backups.slice(retention)) {
  await rm(path.join(backupDir, oldBackup));
}

console.log(`Postgres backup: ${outputPath}`);
console.log(`保持世代数: ${Math.min(backups.length, retention)}`);
