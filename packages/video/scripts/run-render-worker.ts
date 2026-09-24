import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { and, asc, eq } from "drizzle-orm";
import { brandKitSchema, giftAssetKeysFixture, resolveSceneTiming, ttsTextForScene, validateVideoPlan, type VideoPlan } from "@shortfactory/contracts";
import { createDb, assets, brands, generationJobs, videoOutputs, videos } from "@shortfactory/db";
import { FixtureVoiceProvider } from "@shortfactory/providers";
import { LocalStorageProvider } from "@shortfactory/storage";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPOSITION_ID, VIDEO_HEIGHT, VIDEO_WIDTH, type YuruAnimeProps } from "../src/props";

const here = path.dirname(fileURLToPath(import.meta.url));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const storage = new LocalStorageProvider(process.env.SHORTFACTORY_STORAGE_ROOT ?? path.resolve(process.cwd(), "storage"));
const { db, pool } = createDb();

async function runOnce(): Promise<boolean> {
  const [candidate] = await db.select({ job: generationJobs, video: videos, brand: brands })
    .from(generationJobs)
    .innerJoin(videos, eq(generationJobs.videoId, videos.id))
    .innerJoin(brands, eq(videos.brandId, brands.id))
    .where(eq(generationJobs.status, "queued"))
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
    const voiceDurations = await Promise.all(plan.scenes.map(async (scene) => {
      const audio = await voiceProvider.synthesize({ text: ttsTextForScene(scene, brand.readingDict), voiceId: brand.voice.voiceId });
      return { audio, durationMs: audio.durationMs };
    }));
    const timing = resolveSceneTiming(plan.scenes.map((scene, index) => ({ scene, narrationMs: voiceDurations[index]!.durationMs })), plan.fps);
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
    await db.update(generationJobs).set({ status: "failed", step: "failed", errorCode, leaseUntil: null }).where(eq(generationJobs.id, job.id));
    console.error(`render failed job=${job.id}: ${errorCode}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return true;
}

try {
  const processed = await runOnce();
  console.log(processed ? "render worker finished one job" : "no queued render jobs");
} finally {
  await pool.end();
}
