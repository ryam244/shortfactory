/** Phase 0a用の固定fixtureを5テーマ分生成する。 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { batchDirFromEnv, EVALUATION_TOPICS, evaluationItemId } from "./lib/evaluation";

const here = path.dirname(fileURLToPath(import.meta.url));

for (const [index, topic] of EVALUATION_TOPICS.entries()) {
  const name = evaluationItemId(index);
  console.log(`\n=== ${name}: ${topic} ===`);
  const result = spawnSync(
    process.env.npm_execpath ?? "pnpm",
    ["exec", "tsx", path.join(here, "run-fixture-pipeline.ts"), "--", topic],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        SHORTFACTORY_OUTPUT_DIR: process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-batch",
        SHORTFACTORY_OUTPUT_NAME: name,
        SHORTFACTORY_VOICE_PROVIDER: process.env.SHORTFACTORY_VOICE_PROVIDER ?? "fixture",
      },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n完了: ${EVALUATION_TOPICS.length}本を ${batchDirFromEnv()} に保存しました`);
