/** 5本の生成物について、音声・計画・MP4の機械的整合を確認する。 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSceneTiming, type VideoPlan } from "@shortfactory/contracts";

const here = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.resolve(here, "../out", process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-batch");
const manifestPath = path.join(batchDir, "evaluation-manifest.json");
const outputPath = path.join(batchDir, "technical-evaluation.json");

interface Manifest {
  items: Array<{ id: string; video: { durationMs: number; width: number; height: number }; planPath: string; voiceDirectory: string }>;
}

interface WavProbe {
  durationMs: number;
  codec: string;
  sampleRate: number;
  channels: number;
}

function probeWav(filePath: string): WavProbe {
  const raw = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", filePath],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(raw) as { format?: { duration?: string }; streams?: Array<Record<string, string>> };
  const stream = parsed.streams?.[0] ?? {};
  return {
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    codec: stream.codec_name ?? "",
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const items = await Promise.all(manifest.items.map(async (item) => {
  const plan = JSON.parse(await readFile(path.join(batchDir, item.planPath), "utf8")) as VideoPlan;
  const wavs = plan.scenes.map((scene, index) => {
    const filePath = path.join(batchDir, item.voiceDirectory, `scene-${String(index + 1).padStart(2, "0")}.wav`);
    return { sceneId: scene.id, ...probeWav(filePath) };
  });
  const timing = resolveSceneTiming(
    plan.scenes.map((scene, index) => ({ scene, narrationMs: wavs[index]!.durationMs })),
    plan.fps,
  );
  const audioValid = wavs.every((wav) => wav.codec === "pcm_s16le" && wav.sampleRate > 0 && wav.channels > 0 && wav.durationMs > 0);
  const durationDeltaMs = Math.abs(item.video.durationMs - timing.totalMs);
  return {
    id: item.id,
    video: item.video,
    sceneCount: plan.scenes.length,
    wavCount: wavs.length,
    audioValid,
    durationDeltaMs,
    pass: item.video.width === 1080 && item.video.height === 1920 && audioValid && durationDeltaMs <= 150,
    wavs,
  };
}));

await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), items }, null, 2)}\n`, "utf8");
console.log(`技術検証レポート: ${outputPath}`);
console.log(`合格: ${items.filter((item) => item.pass).length}/${items.length}`);
if (items.some((item) => !item.pass)) process.exitCode = 1;
