/**
 * 素材・台本を自動準備して、登録素材を使うローカルテスト動画を1本生成する。
 * 既定はfixture音声。VOICEVOXを使う場合はSHORTFACTORY_VOICE_PROVIDER=voicevoxを指定する。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { giftPlanFixture } from "@shortfactory/contracts";
import type { LocalAssetManifest } from "@shortfactory/assets";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, "../out/local-test");
const assetRoot = path.join(outputDir, "assets");
const manifestPath = path.join(outputDir, "assets.json");
const planPath = path.join(outputDir, "plan.json");

const assets = [
  ["gift_girl", "#F2A7A0"],
  ["gift_girl/think", "#F2A7A0"],
  ["gift_girl/smile", "#E98F8A"],
  ["gift_girl/surprise", "#F7C66A"],
  ["shop_shelf", "#DDEFE8"],
  ["room_warm", "#FFF0D8"],
  ["desk", "#E5D8C8"],
  ["gift_box", "#8CC7B8"],
  ["cookie", "#D9A066"],
  ["card", "#FFFFFF"],
] as const;

const manifest: LocalAssetManifest = {};
await mkdir(assetRoot, { recursive: true });
for (const [key, color] of assets) {
  const filename = `${key.replace("/", "__")}.svg`;
  const relativePath = filename;
  const label = key.replace("/", " ");
  await writeFile(
    path.join(assetRoot, filename),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${color}"/><circle cx="540" cy="760" r="260" fill="#ffffff" fill-opacity=".55"/><text x="540" y="1040" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#4A3B36">${label}</text></svg>\n`,
    "utf8",
  );
  manifest[key] = { path: relativePath, contentType: "image/svg+xml" };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(planPath, `${JSON.stringify(giftPlanFixture, null, 2)}\n`, "utf8");

const command = process.env.npm_execpath ?? "pnpm";
const result = spawnSync(command, ["exec", "tsx", path.join(here, "run-fixture-pipeline.ts"), "--", "ローカルテスト"], {
  stdio: "inherit",
  env: {
    ...process.env,
    SHORTFACTORY_OUTPUT_DIR: "local-test",
    SHORTFACTORY_OUTPUT_NAME: "local-gift",
    SHORTFACTORY_PLAN_FILE: planPath,
    SHORTFACTORY_ASSET_MANIFEST: manifestPath,
    SHORTFACTORY_ASSET_ROOT: assetRoot,
    SHORTFACTORY_VOICE_PROVIDER: process.env.SHORTFACTORY_VOICE_PROVIDER ?? "fixture",
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`テスト素材: ${assetRoot}`);
console.log(`テスト台本: ${planPath}`);
console.log(`テスト動画: ${path.join(outputDir, "local-gift.mp4")}`);
