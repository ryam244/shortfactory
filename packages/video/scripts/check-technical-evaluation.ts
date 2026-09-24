/** 5本の生成物について、音声・計画・MP4の機械的整合を確認する。 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveSceneTiming, type VideoPlan } from "@shortfactory/contracts";
import { batchDirFromEnv, ffprobeJson } from "./lib/evaluation";

const batchDir = batchDirFromEnv();
const manifestPath = path.join(batchDir, "evaluation-manifest.json");
const outputPath = path.join(batchDir, "technical-evaluation.json");

/** マスタープラン§1の完成の定義。 */
const SPEC = { width: 1080, height: 1920, fps: 30, videoCodec: "h264", audioCodec: "aac", maxDurationDeltaMs: 150 } as const;

interface Manifest {
  items: Array<{
    id: string;
    video: {
      durationMs: number;
      width: number;
      height: number;
      videoCodec?: string;
      audioCodec?: string | null;
      fps?: number;
      hasAudio: boolean;
    };
    planPath: string;
    voiceDirectory: string;
  }>;
}

interface WavProbe {
  durationMs: number;
  codec: string;
  sampleRate: number;
  channels: number;
}

async function probeWav(filePath: string): Promise<WavProbe> {
  const parsed = await ffprobeJson<{ format?: { duration?: string }; streams?: Array<Record<string, string>> }>([
    "-show_entries",
    "format=duration:stream=codec_name,sample_rate,channels",
    filePath,
  ]);
  const stream = parsed.streams?.[0] ?? {};
  return {
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    codec: stream.codec_name ?? "",
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const items = await Promise.all(
  manifest.items.map(async (item) => {
    const plan = JSON.parse(await readFile(path.join(batchDir, item.planPath), "utf8")) as VideoPlan;
    const wavs = await Promise.all(
      plan.scenes.map(async (scene, index) => {
        const filePath = path.join(batchDir, item.voiceDirectory, `scene-${String(index + 1).padStart(2, "0")}.wav`);
        return { sceneId: scene.id, ...(await probeWav(filePath)) };
      }),
    );
    const timing = resolveSceneTiming(
      plan.scenes.map((scene, index) => ({ scene, narrationMs: wavs[index]!.durationMs })),
      plan.fps,
    );
    const audioValid = wavs.every(
      (wav) => wav.codec === "pcm_s16le" && wav.sampleRate > 0 && wav.channels > 0 && wav.durationMs > 0,
    );
    const durationDeltaMs = Math.abs(item.video.durationMs - timing.totalMs);

    const checks = {
      resolution: item.video.width === SPEC.width && item.video.height === SPEC.height,
      fps: item.video.fps === SPEC.fps,
      videoCodec: item.video.videoCodec === SPEC.videoCodec,
      audioTrack: item.video.hasAudio && item.video.audioCodec === SPEC.audioCodec,
      sceneAudio: audioValid,
      duration: durationDeltaMs <= SPEC.maxDurationDeltaMs,
    };
    const failed = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);

    return {
      id: item.id,
      video: item.video,
      sceneCount: plan.scenes.length,
      wavCount: wavs.length,
      durationDeltaMs,
      checks,
      failed,
      pass: failed.length === 0,
      wavs,
    };
  }),
);

await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), spec: SPEC, items }, null, 2)}\n`,
  "utf8",
);
console.log(`技術検証レポート: ${outputPath}`);
console.log(`合格: ${items.filter((item) => item.pass).length}/${items.length}`);
for (const item of items.filter((i) => !i.pass)) {
  console.log(`  ${item.id} 不合格: ${item.failed.join(", ")}（manifest作成前の古い動画情報の場合は evaluation:manifest を再実行）`);
}
if (items.some((item) => !item.pass)) process.exitCode = 1;
