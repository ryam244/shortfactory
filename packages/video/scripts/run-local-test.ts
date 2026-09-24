/**
 * 素材・台本・検証用BGMを自動準備して、登録素材を使うローカルテスト動画を1本生成する。
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
const bgmPath = path.join(assetRoot, "bgm-test.wav");

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
  const isBackground = ["shop_shelf", "room_warm", "desk"].includes(key);
  const artwork = isBackground
    ? `<rect width="1080" height="1920" fill="${color}"/><circle cx="540" cy="900" r="420" fill="#ffffff" fill-opacity=".55"/>`
    : key === "gift_girl" || key.startsWith("gift_girl/")
      ? `<rect x="360" y="430" width="360" height="760" rx="180" fill="${color}"/><circle cx="540" cy="360" r="150" fill="#FFE0D2"/>`
      : `<rect x="390" y="700" width="300" height="260" rx="28" fill="${color}" stroke="#4A3B36" stroke-width="12"/>`;
  await writeFile(
    path.join(assetRoot, filename),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">${artwork}<text x="540" y="1280" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#4A3B36">${label}</text></svg>\n`,
    "utf8",
  );
  manifest[key] = {
    path: relativePath,
    contentType: "image/svg+xml",
    source: "shortfactory-local-test",
    rightsNote: "テスト運用専用の自動生成SVG。公開・商用利用の素材判定には使わない",
  };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const plan = structuredClone(giftPlanFixture);
plan.bgm = { enabled: true, assetKey: "bgm_test", volume: 0.08 };
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(bgmPath, createTestBgmWav());
manifest.bgm_test = {
  path: "bgm-test.wav",
  contentType: "audio/wav",
  source: "shortfactory-local-test",
  rightsNote: "テスト運用専用の合成音。公開・商用利用の素材判定には使わない",
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

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
    SHORTFACTORY_TEST_MODE: "1",
    SHORTFACTORY_VOICE_PROVIDER: process.env.SHORTFACTORY_VOICE_PROVIDER ?? "fixture",
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`テスト素材: ${assetRoot}`);
console.log(`テスト台本: ${planPath}`);
console.log(`テスト動画: ${path.join(outputDir, "local-gift.mp4")}`);

function createTestBgmWav(): Uint8Array {
  const sampleRate = 16_000;
  const durationSec = 2;
  const dataSize = sampleRate * durationSec * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, value: string) => {
    [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < sampleRate * durationSec; i += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 900);
    view.setInt16(44 + i * 2, sample, true);
  }
  return bytes;
}
