/** 実素材・VOICEVOX・Suno BGMを使った、冒頭違い5本の評価用バッチ。 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const titles = ["高いほうなら、安心？", "相手が困らない手土産は？", "好きなもの、覚えてる？", "迷ったら、値段を見ない", "渡したあとまで、考える"];
for (const [index, title] of titles.entries()) {
  const result = spawnSync("pnpm", ["exec", "tsx", path.join(here, "create-editorial-sample.ts")], {
    stdio: "inherit",
    env: { ...process.env, SHORTFACTORY_EDITORIAL_VARIANT: String(index + 1), SHORTFACTORY_EDITORIAL_TITLE: title },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
