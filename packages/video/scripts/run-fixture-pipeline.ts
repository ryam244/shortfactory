/**
 * 外部APIなしで、テーマから保存・書き出しまでを通すPhase 0a用CLI。
 *
 *   pnpm pipeline:fixture -- "春の手土産"
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { LocalAssetProvider, type LocalAssetManifest } from "@shortfactory/assets";
import { resolveSceneTiming, ttsTextForScene, type VideoPlanInput } from "@shortfactory/contracts";
import { createGiftFixtureProviders, JsonTextProvider, VoicevoxProvider, type CreativeBriefInput } from "@shortfactory/providers";
import { LocalStorageProvider } from "@shortfactory/storage";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPOSITION_ID, type YuruAnimeProps } from "../src/props";
import type { GenerationSources } from "./lib/evaluation";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, "../out", process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-pipeline");
const outputName = process.env.SHORTFACTORY_OUTPUT_NAME ?? "gift-sample";
const assetManifestPath = process.env.SHORTFACTORY_ASSET_MANIFEST;
const creativeBriefPath = process.env.SHORTFACTORY_CREATIVE_BRIEF_FILE;
const testMode = process.env.SHORTFACTORY_TEST_MODE === "1";
const assetManifest = assetManifestPath
  ? JSON.parse(await readFile(assetManifestPath, "utf8")) as LocalAssetManifest
  : null;
const outputLocation = path.join(outputDir, `${outputName}.mp4`);
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const cliArgs = process.argv.slice(2);
const topic = (cliArgs[0] === "--" ? cliArgs.slice(1) : cliArgs).join(" ").trim() || "手土産で迷わない3つのコツ";
let lastReportedProgress = -1;

const fixtureProviders = createGiftFixtureProviders();
const textProvider = process.env.SHORTFACTORY_PLAN_FILE
  ? new JsonTextProvider(JSON.parse(await readFile(process.env.SHORTFACTORY_PLAN_FILE, "utf8")) as VideoPlanInput)
  : fixtureProviders.text;
const voiceProvider = process.env.SHORTFACTORY_VOICE_PROVIDER === "voicevox"
  ? new VoicevoxProvider()
  : fixtureProviders.voice;
const voiceId = process.env.VOICEVOX_SPEAKER ?? fixtureProviders.brand.voice.voiceId;
const plan = await textProvider.generatePlan({
  topic,
  brand: fixtureProviders.brand,
  availableAssetKeys: assetManifest ? new Set(Object.keys(assetManifest)) : fixtureProviders.assetKeys,
  creativeBrief: creativeBriefPath ? JSON.parse(await readFile(creativeBriefPath, "utf8")) as CreativeBriefInput : undefined,
});
const voiceDurations = await Promise.all(
  plan.scenes.map(async (scene) => {
    const text = ttsTextForScene(scene, fixtureProviders.brand.readingDict);
    const audio = await voiceProvider.synthesize({ text, voiceId });
    return { text, durationMs: audio.durationMs, bytes: audio.bytes };
  }),
);
const timing = resolveSceneTiming(
  plan.scenes.map((scene, index) => ({ scene, narrationMs: voiceDurations[index]!.durationMs })),
  plan.fps,
);
if (timing.outOfRange) throw new Error(`生成計画の総尺が範囲外です: ${timing.totalMs}ms`);

const assetKeys = plan.scenes.flatMap((scene) => [
  scene.visual.backgroundKey,
  scene.visual.characterKey,
  ...(scene.visual.expressionKey ? [`${scene.visual.characterKey}/${scene.visual.expressionKey}`] : []),
  ...scene.visual.objectKeys,
]);
if (plan.bgm?.enabled) assetKeys.push(plan.bgm.assetKey);
const assets = assetManifestPath
  ? await new LocalAssetProvider(
      process.env.SHORTFACTORY_ASSET_ROOT ?? path.dirname(path.resolve(assetManifestPath)),
      assetManifest!,
    ).resolve(assetKeys)
  : {};
const bgmUrl = plan.bgm?.enabled ? assets[plan.bgm.assetKey] ?? null : null;
if (plan.bgm?.enabled && !bgmUrl) {
  throw new Error(`BGM素材が未登録です: ${plan.bgm.assetKey}`);
}

const storage = new LocalStorageProvider(path.join(outputDir, "storage", outputName));
await storage.put(`plans/${outputName}.json`, new TextEncoder().encode(JSON.stringify(plan, null, 2)), "application/json");
// 評価時に「何で作った動画か」を判別できるよう、使った実装を記録する
const sources: GenerationSources = {
  text: testMode ? "test" : process.env.SHORTFACTORY_PLAN_FILE ? "json" : "fixture",
  voice: testMode ? "test" : process.env.SHORTFACTORY_VOICE_PROVIDER === "voicevox" ? "voicevox" : "fixture",
  voiceId,
  assets: testMode ? "test" : assetManifestPath ? "registered" : "placeholder",
};
await storage.put("run.json", new TextEncoder().encode(JSON.stringify({ topic, sources }, null, 2)), "application/json");
await Promise.all(
  voiceDurations.map(async ({ text, durationMs, bytes }, index) => {
    const key = `voice/scene-${String(index + 1).padStart(2, "0")}`;
    await storage.put(`${key}.json`, new TextEncoder().encode(JSON.stringify({ text, durationMs }, null, 2)), "application/json");
    if (bytes.byteLength > 0) await storage.put(`${key}.wav`, bytes, "audio/wav");
  }),
);
const sceneAudio = await Promise.all(
  voiceDurations.map(async ({ bytes }) => {
    if (bytes.byteLength === 0) return null;
    // RemotionのCLIレンダラーはfile://を取得できないため、保存済みと同じWAV bytesをdata URLで渡す。
    return `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`;
  }),
);

const props: YuruAnimeProps = {
  plan,
  brand: fixtureProviders.brand,
  sceneFrames: timing.sceneFrames,
  assets,
  sceneAudio,
  bgmUrl,
  showSafeZone: process.env.SHORTFACTORY_SHOW_SAFE_ZONE === "1",
};
await mkdir(outputDir, { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.resolve(here, "../src/remotion-entry.ts"),
  publicDir: path.resolve(here, "../public"),
});
const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: props, browserExecutable });
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  enforceAudioTrack: true,
  inputProps: props,
  outputLocation,
  browserExecutable,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct % 20 === 0 && pct !== lastReportedProgress) {
      lastReportedProgress = pct;
      console.log(`書き出し中 ${pct}%`);
    }
  },
});

console.log(`テーマ: ${topic}`);
console.log(`総尺: ${(timing.totalMs / 1000).toFixed(1)}秒 / ${timing.totalFrames}フレーム`);
console.log(`保存先: ${path.join(outputDir, "storage", outputName)}`);
console.log(`動画: ${outputLocation}`);
