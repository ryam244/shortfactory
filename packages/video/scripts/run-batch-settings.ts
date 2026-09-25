import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { brandKitSchema, giftBrandFixture, giftPlanFixture, resolveSceneTiming, type VideoPlan } from '@shortfactory/contracts';
import { parseWavDurationMs } from '@shortfactory/providers';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPOSITION_ID, VIDEO_HEIGHT, VIDEO_WIDTH, type YuruAnimeProps } from '../src/props';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sceneImage = path.resolve(process.env.SHORTFACTORY_BATCH_SCENE ?? path.join(root, 'work/batch-test/full-scene.png'));
const sceneDir = process.env.SHORTFACTORY_BATCH_SCENE_DIR ? path.resolve(process.env.SHORTFACTORY_BATCH_SCENE_DIR) : null;
const audioDir = path.resolve(process.env.SHORTFACTORY_BATCH_AUDIO_DIR ?? path.join(root, 'storage/audio/18703cec-569f-4fec-8b26-06fb0bfef836'));
const bgmFile = process.env.SHORTFACTORY_BATCH_BGM ?? path.join(audioDir, 'bgm_cozy_gift_shop.wav');
const output = path.resolve(process.env.SHORTFACTORY_BATCH_OUTPUT ?? path.join(root, 'outputs/batch-settings-remotion-v1.mp4'));
const videoMode = process.env.SHORTFACTORY_VIDEO_MODE ?? 'full_scene';
if (!['full_scene', 'kinetic_text'].includes(videoMode)) throw new Error(`Unsupported SHORTFACTORY_VIDEO_MODE: ${videoMode}`);

const dataUrl = (bytes: Uint8Array, contentType: string) => `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;

const sceneAudioPaths = giftPlanFixture.scenes.map((scene) => path.join(audioDir, `tts_${scene.id.toLowerCase()}_editorial.wav`));
const sceneAudio = await Promise.all(sceneAudioPaths.map(async (file) => {
  const bytes = new Uint8Array(await readFile(file));
  return { bytes, durationMs: parseWavDurationMs(bytes), url: dataUrl(bytes, 'audio/wav') };
}));
const timing = resolveSceneTiming(giftPlanFixture.scenes.map((scene, i) => ({ scene, narrationMs: sceneAudio[i]!.durationMs })), giftPlanFixture.fps);
const plan = { ...giftPlanFixture, bgm: { enabled: true, assetKey: 'batch_bgm', volume: 0.07 } } as VideoPlan;
const brand = brandKitSchema.parse(giftBrandFixture);
const props: YuruAnimeProps = {
  plan,
  brand,
  sceneFrames: timing.sceneFrames,
  assets: {
    full_scene: dataUrl(new Uint8Array(await readFile(sceneImage)), 'image/png'),
    batch_bgm: dataUrl(new Uint8Array(await readFile(bgmFile)), 'audio/wav'),
  },
  sceneAudio: sceneAudio.map((item) => item.url),
  bgmUrl: dataUrl(new Uint8Array(await readFile(bgmFile)), 'audio/wav'),
  fullSceneMode: videoMode === 'full_scene',
  kineticTextMode: videoMode === 'kinetic_text',
  showSafeZone: false,
};
if (sceneDir) {
  for (const scene of plan.scenes) {
    const scenePath = path.join(sceneDir, `${scene.id}.png`);
    if (existsSync(scenePath)) props.assets[`full_scene/${scene.id}`] = dataUrl(new Uint8Array(await readFile(scenePath)), 'image/png');
  }
}

await mkdir(path.dirname(output), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve(here, '../src/remotion-entry.ts'), publicDir: path.resolve(here, '../public') });
const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: props, browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null });
await renderMedia({ composition, serveUrl, codec: 'h264', audioCodec: 'aac', enforceAudioTrack: true, inputProps: props, outputLocation: output, browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null });
console.log(JSON.stringify({ output, width: VIDEO_WIDTH, height: VIDEO_HEIGHT, durationMs: timing.totalMs, scenes: plan.scenes.length }, null, 2));
