/** Phase 0a用の固定fixtureを5テーマ分生成する。 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const topics = ["春の手土産", "職場へのお菓子", "引っ越し祝い", "北海道のおみやげ", "誕生日ギフト"];

for (const [index, topic] of topics.entries()) {
  const name = `gift-${String(index + 1).padStart(2, "0")}`;
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

console.log(`\n完了: ${topics.length}本を packages/video/out/fixture-batch/ に保存しました`);
