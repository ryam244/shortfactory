/** 生成済みfixture動画を人手評価へ渡すためのマニフェストを作る。 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.resolve(here, "../out", process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-batch");
const outputPath = path.join(batchDir, "evaluation-manifest.json");
const topics = ["春の手土産", "職場へのお菓子", "引っ越し祝い", "北海道のおみやげ", "誕生日ギフト"];

interface EvaluationItem {
  id: string;
  topic: string;
  video: { path: string; durationMs: number; width: number; height: number; hasAudio: boolean };
  planPath: string;
  voiceDirectory: string;
  review: {
    hook: "pending" | "pass" | "revise" | "fail";
    factualAccuracy: "pending" | "pass" | "revise" | "fail";
    characterConsistency: "pending" | "pass" | "revise" | "fail";
    captionReadability: "pending" | "pass" | "revise" | "fail";
    readingErrors: number | null;
    audioSync: "pending" | "pass" | "revise" | "fail";
    cta: "pending" | "pass" | "revise" | "fail";
    editMinutes: number | null;
    verdict: "pending" | "postable_with_minor_edits" | "not_postable";
    notes: string;
  };
}

function probeVideo(videoPath: string): EvaluationItem["video"] {
  const raw = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", videoPath],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(raw) as { format?: { duration?: string }; streams?: Array<Record<string, string | number>> };
  const streams = parsed.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  return {
    path: path.relative(batchDir, videoPath),
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    hasAudio: streams.some((stream) => stream.codec_type === "audio"),
  };
}

const items: EvaluationItem[] = topics.map((topic, index) => {
  const id = `gift-${String(index + 1).padStart(2, "0")}`;
  const videoPath = path.join(batchDir, `${id}.mp4`);
  return {
    id,
    topic,
    video: probeVideo(videoPath),
    planPath: `storage/${id}/plans/${id}.json`,
    voiceDirectory: `storage/${id}/voice`,
    review: {
      hook: "pending",
      factualAccuracy: "pending",
      characterConsistency: "pending",
      captionReadability: "pending",
      readingErrors: null,
      audioSync: "pending",
      cta: "pending",
      editMinutes: null,
      verdict: "pending",
      notes: "",
    },
  };
});

await mkdir(batchDir, { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), criteria: {
    minorEdit: "字幕・表現・読みの修正のみ",
    notPostable: "事実の全面修正・素材の大幅な作り直し",
  }, items }, null, 2)}\n`,
  "utf8",
);
await readFile(outputPath);
console.log(`評価マニフェスト: ${outputPath}`);
console.log(`対象: ${items.length}本 / 全動画に音声トラックあり: ${items.every((item) => item.video.hasAudio)}`);
