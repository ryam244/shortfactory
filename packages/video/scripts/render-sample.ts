/**
 * ギフトのサンプル計画を仮素材でMP4に書き出す（Phase 0aの動作確認用）。
 *
 *   pnpm render:sample
 *
 * REMOTION_BROWSER_EXECUTABLE を指定すると、そのChromiumで書き出す。
 * 未指定ならRemotionが自動でダウンロードしたものを使う（Macではこちらでよい）。
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPOSITION_ID } from "../src/props";
import { buildSampleProps } from "../src/sample";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../out");
const outputLocation = path.join(outDir, "gift-sample.mp4");
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;

const { props, timing } = buildSampleProps();
console.log(
  `シーン尺(ms): ${timing.sceneMs.join(", ")} / 合計 ${(timing.totalMs / 1000).toFixed(1)}秒 / ${timing.totalFrames}フレーム`,
);
if (timing.outOfRange) console.warn("警告: 総尺が24〜35秒の範囲外");

const serveUrl = await bundle({
  entryPoint: path.resolve(here, "../src/remotion-entry.ts"),
  publicDir: path.resolve(here, "../public"),
});
const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: props, browserExecutable });

mkdirSync(outDir, { recursive: true });
let lastLogged = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  // TTS前でも音声トラックを必ず含め、完成形式（H.264/AAC）を揃える
  enforceAudioTrack: true,
  inputProps: props,
  outputLocation,
  browserExecutable,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== lastLogged) {
      lastLogged = pct;
      console.log(`書き出し中 ${pct}%`);
    }
  },
});

console.log(`完了: ${outputLocation}`);
