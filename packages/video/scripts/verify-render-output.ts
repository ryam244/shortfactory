import { and, desc, eq } from "drizzle-orm";
import { brandKitSchema, fixtureVoiceDurationMs, giftAssetKeysFixture, resolveSceneTiming, validateVideoPlan } from "@shortfactory/contracts";
import { assets, brands, createDb, videoOutputs, videos } from "@shortfactory/db";
import { parseWavDurationMs } from "@shortfactory/providers";
import { LocalStorageProvider } from "@shortfactory/storage";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ffprobeJson } from "./lib/evaluation";

const videoId = process.env.SHORTFACTORY_VIDEO_ID;
if (!videoId) throw new Error("SHORTFACTORY_VIDEO_ID is required");
const { db, pool } = createDb();
const cwd = process.cwd();
const workspaceRoot = existsSync(path.resolve(cwd, "pnpm-workspace.yaml")) ? cwd : existsSync(path.resolve(cwd, "../..", "pnpm-workspace.yaml")) ? path.resolve(cwd, "../..") : cwd;
const storageBaseDir = path.resolve(workspaceRoot, process.env.SHORTFACTORY_STORAGE_ROOT ?? "storage");
const storage = new LocalStorageProvider(storageBaseDir);
const tempDir = await mkdtemp(path.join(os.tmpdir(), "shortfactory-verify-"));

try {
  const [row] = await db.select({ video: videos, brand: brands }).from(videos)
    .innerJoin(brands, eq(videos.brandId, brands.id)).where(eq(videos.id, videoId)).limit(1);
  if (!row || !row.video.planJson) throw new Error("video or plan not found");
  const brand = brandKitSchema.parse(row.brand.kitJson);
  const assetRows = await db.select().from(assets).where(eq(assets.brandId, row.video.brandId));
  const validation = validateVideoPlan(row.video.planJson, { brand, availableAssetKeys: new Set([...giftAssetKeysFixture, ...assetRows.map((asset) => asset.key)]) });
  if (!validation.ok) throw new Error(`plan_invalid:${validation.issues.map((issue) => issue.code).join(",")}`);
  const [output] = await db.select().from(videoOutputs).where(eq(videoOutputs.videoId, videoId)).orderBy(desc(videoOutputs.createdAt)).limit(1);
  if (!output) throw new Error("video output not found");
  const outputPath = path.join(tempDir, "output.mp4");
  await writeFile(outputPath, await storage.get(output.storageKey));
  const probe = await ffprobeJson<{ format?: { duration?: string }; streams?: Array<Record<string, string>> }>(["-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate", outputPath]);
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");
  const ttsAssets = assetRows.filter((asset) => asset.kind === "tts");
  const sceneInputs = await Promise.all(validation.plan.scenes.map(async (scene) => {
    const tts = ttsAssets.filter((asset) => asset.key.startsWith(`tts_${scene.id.toLowerCase()}_`)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!tts) return { scene, narrationMs: fixtureVoiceDurationMs(scene.narration) };
    return { scene, narrationMs: parseWavDurationMs(await storage.get(tts.storageKey)) };
  }));
  const timing = resolveSceneTiming(sceneInputs, validation.plan.fps);
  const actualDurationMs = Math.round(Number(probe.format?.duration ?? 0) * 1000);
  const checks = {
    resolution: Number(videoStream?.width) === 1080 && Number(videoStream?.height) === 1920,
    videoCodec: videoStream?.codec_name === "h264",
    audioTrack: audioStream?.codec_name === "aac",
    fps: videoStream?.r_frame_rate === "30/1",
    duration: Math.abs(actualDurationMs - timing.totalMs) <= 150,
  };
  const report = { videoId, outputId: output.id, actualDurationMs, expectedDurationMs: timing.totalMs, durationDeltaMs: actualDurationMs - timing.totalMs, checks };
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
} finally {
  await rm(tempDir, { recursive: true, force: true });
  await pool.end();
}
