import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { and, asc, eq } from "drizzle-orm";
import { brandKitSchema, fixtureVoiceDurationMs, giftAssetKeysFixture, resolveSceneTiming, ttsTextForScene, validateVideoPlan, type VideoPlan } from "@shortfactory/contracts";
import { createDb, assets, brands, generationJobs, videoOutputs, videos } from "@shortfactory/db";
import { FixtureVoiceProvider, parseWavDurationMs } from "@shortfactory/providers";
import { LocalStorageProvider } from "@shortfactory/storage";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPOSITION_ID, VIDEO_HEIGHT, VIDEO_WIDTH, type YuruAnimeProps } from "../src/props";

const here = path.dirname(fileURLToPath(import.meta.url));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const MAX_RENDER_ATTEMPTS = 3;
const cwd = process.cwd();
const storageBaseDir = existsSync(path.resolve(cwd, "pnpm-workspace.yaml")) ? cwd : existsSync(path.resolve(cwd, "../..", "pnpm-workspace.yaml")) ? path.resolve(cwd, "../..") : cwd;
const storage = new LocalStorageProvider(path.resolve(storageBaseDir, process.env.SHORTFACTORY_STORAGE_ROOT ?? "storage"));
const { db, pool } = createDb();

async function runOnce(): Promise<boolean> {
  const [candidate] = await db.select({ job: generationJobs, video: videos, brand: brands })
    .from(generationJobs)
    .innerJoin(videos, eq(generationJobs.videoId, videos.id))
    .innerJoin(brands, eq(videos.brandId, brands.id))
    .where(and(eq(generationJobs.status, "queued"), eq(generationJobs.type, "render")))
    .orderBy(asc(generationJobs.createdAt)).limit(1);
  if (!candidate) return false;
  const [job] = await db.update(generationJobs).set({ status: "running", step: "rendering", attempts: candidate.job.attempts + 1 })
    .where(and(eq(generationJobs.id, candidate.job.id), eq(generationJobs.status, "queued"))).returning();
  if (!job) return true;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "shortfactory-render-"));
  try {
    const brand = brandKitSchema.parse(candidate.brand.kitJson);
    const assetRows = await db.select().from(assets).where(eq(assets.brandId, candidate.video.brandId));
    const availableAssetKeys = new Set([...giftAssetKeysFixture, ...assetRows.map((asset) => asset.key)]);
    const validation = validateVideoPlan(candidate.video.planJson, { brand, availableAssetKeys });
    if (!validation.ok) throw new Error(`plan_invalid:${validation.issues.map((issue) => issue.code).join(",")}`);
    const plan: VideoPlan = validation.plan;
    const voiceProvider = new FixtureVoiceProvider();
    const ttsAssets = assetRows.filter((asset) => asset.kind === "tts");
    const voiceDurations = await Promise.all(plan.scenes.map(async (scene) => {
      const sceneTts = ttsAssets.filter((asset) => asset.key.startsWith(`tts_${scene.id.toLowerCase()}_`)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (sceneTts) {
        const bytes = await storage.get(sceneTts.storageKey);
        return { audio: { bytes, durationMs: parseWavDurationMs(bytes), contentType: "audio/wav" as const }, durationMs: parseWavDurationMs(bytes) };
      }
      const audio = await voiceProvider.synthesize({ text: ttsTextForScene(scene, brand.readingDict), voiceId: brand.voice.voiceId });
      return { audio, durationMs: audio.durationMs };
    }));
    const timing = resolveSceneTiming(plan.scenes.map((scene) => ({ scene, narrationMs: fixtureVoiceDurationMs(scene.narration) })), plan.fps);
    if (timing.outOfRange) throw new Error("plan_duration_out_of_range");
    const resolvedAssets: Record<string, string> = {};
    await Promise.all(assetRows.map(async (asset) => {
      const bytes = await storage.get(asset.storageKey);
      resolvedAssets[asset.key] = `data:${asset.contentType};base64,${Buffer.from(bytes).toString("base64")}`;
    }));
    const props: YuruAnimeProps = {
      plan, brand, sceneFrames: timing.sceneFrames, assets: resolvedAssets,
      sceneAudio: voiceDurations.map(({ audio }) => `data:${audio.contentType};base64,${Buffer.from(audio.bytes).toString("base64")}`),
      bgmUrl: null, showSafeZone: false,
    };
    const serveUrl = await bundle({ entryPoint: path.resolve(here, "../src/remotion-entry.ts"), publicDir: path.resolve(here, "../public") });
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: props, browserExecutable });
    const outputPath = path.join(tempDir, "output.mp4");
    await renderMedia({ composition, serveUrl, codec: "h264", audioCodec: "aac", enforceAudioTrack: true, inputProps: props, outputLocation: outputPath, browserExecutable });
    const outputBytes = new Uint8Array(await readFile(outputPath));
    const storageKey = `outputs/${candidate.video.id}/v${candidate.video.version}.mp4`;
    await storage.put(storageKey, outputBytes, "video/mp4");
    await db.insert(videoOutputs).values({ videoId: candidate.video.id, videoVersion: candidate.video.version, storageKey, durationMs: timing.totalMs, width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
    await db.update(videos).set({ status: "ready" }).where(eq(videos.id, candidate.video.id));
    await db.update(generationJobs).set({ status: "succeeded", step: "completed", leaseUntil: null }).where(eq(generationJobs.id, job.id));
    console.log(`render succeeded job=${job.id} video=${candidate.video.id} storageKey=${storageKey}`);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 200) : "render_failed";
    const retry = job.attempts < MAX_RENDER_ATTEMPTS;
    await db.update(generationJobs).set({ status: retry ? "queued" : "failed", step: retry ? "retry_pending" : "failed", errorCode, leaseUntil: null }).where(eq(generationJobs.id, job.id));
    console.error(`render ${retry ? "retry scheduled" : "failed"} job=${job.id} attempt=${job.attempts}/${MAX_RENDER_ATTEMPTS}: ${errorCode}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return true;
}

try {
  const watch = process.argv.includes("--watch");
  do {
    const processed = await runOnce();
    if (!processed) console.log(watch ? "no queued render jobs; waiting" : "no queued render jobs");
    if (watch) await new Promise((resolve) => setTimeout(resolve, 5_000));
    else break;
  } while (watch);
} finally {
  await pool.end();
}
