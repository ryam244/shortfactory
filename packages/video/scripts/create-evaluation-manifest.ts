/**
 * 生成済み動画を人手評価へ渡すためのマニフェストを作る。
 * 既存のマニフェストがあれば、動画情報だけ更新して人手評価の記入内容は残す。
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  batchDirFromEnv,
  EVALUATION_TOPICS,
  evaluationItemId,
  ffprobeJson,
  FIXTURE_SOURCES,
  isQualityEvaluable,
  type GenerationSources,
} from "./lib/evaluation";

const batchDir = batchDirFromEnv();
const outputPath = path.join(batchDir, "evaluation-manifest.json");

type Grade = "pending" | "pass" | "revise" | "fail";

interface EvaluationItem {
  id: string;
  topic: string;
  sources: GenerationSources;
  /** 台本・音声・素材がすべて実物で、Phase 0aの品質判定に使えるか。 */
  qualityEvaluable: boolean;
  video: {
    path: string;
    durationMs: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string | null;
    fps: number;
    hasAudio: boolean;
  };
  planPath: string;
  voiceDirectory: string;
  review: {
    hook: Grade;
    factualAccuracy: Grade;
    characterConsistency: Grade;
    captionReadability: Grade;
    readingErrors: number | null;
    audioSync: Grade;
    cta: Grade;
    editMinutes: number | null;
    verdict: "pending" | "postable_with_minor_edits" | "not_postable";
    notes: string;
  };
}

interface ProbeResult {
  format?: { duration?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
}

const EMPTY_REVIEW: EvaluationItem["review"] = {
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
};

async function probeVideo(videoPath: string): Promise<EvaluationItem["video"]> {
  const parsed = await ffprobeJson<ProbeResult>([
    "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
    videoPath,
  ]);
  const streams = parsed.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const [num, den] = (video?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    path: path.relative(batchDir, videoPath),
    durationMs: Math.round(Number(parsed.format?.duration ?? 0) * 1000),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    videoCodec: video?.codec_name ?? "",
    audioCodec: audio?.codec_name ?? null,
    fps: den ? num! / den : 0,
    hasAudio: audio !== undefined,
  };
}

async function readSources(id: string): Promise<GenerationSources> {
  const runPath = path.join(batchDir, "storage", id, "run.json");
  // run.json がない古い生成物は、fixtureで作ったものとして扱う
  if (!existsSync(runPath)) return FIXTURE_SOURCES;
  return (JSON.parse(await readFile(runPath, "utf8")) as { sources: GenerationSources }).sources;
}

async function readExistingReviews(): Promise<Map<string, EvaluationItem["review"]>> {
  if (!existsSync(outputPath)) return new Map();
  const existing = JSON.parse(await readFile(outputPath, "utf8")) as { items?: Array<Pick<EvaluationItem, "id" | "review">> };
  return new Map((existing.items ?? []).map((item) => [item.id, item.review]));
}

const existingReviews = await readExistingReviews();
const items: EvaluationItem[] = await Promise.all(
  EVALUATION_TOPICS.map(async (topic, index) => {
    const id = evaluationItemId(index);
    const sources = await readSources(id);
    return {
      id,
      topic,
      sources,
      qualityEvaluable: isQualityEvaluable(sources),
      video: await probeVideo(path.join(batchDir, `${id}.mp4`)),
      planPath: `storage/${id}/plans/${id}.json`,
      voiceDirectory: `storage/${id}/voice`,
      review: { ...EMPTY_REVIEW, ...existingReviews.get(id) },
    };
  }),
);

await mkdir(batchDir, { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      criteria: {
        minorEdit: "字幕・表現・読みの修正のみ",
        notPostable: "事実の全面修正・素材の大幅な作り直し",
        qualityEvaluable: "台本・音声・素材がすべて実物（fixture・仮素材ではない）の動画だけがPhase 0aの判定対象",
      },
      items,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const kept = items.filter((item) => existingReviews.has(item.id)).length;
console.log(`評価マニフェスト: ${outputPath}`);
console.log(`対象: ${items.length}本 / 全動画に音声トラックあり: ${items.every((item) => item.video.hasAudio)}`);
if (kept > 0) console.log(`既存の人手評価を引き継ぎ: ${kept}本`);
const fixtureCount = items.filter((item) => !item.qualityEvaluable).length;
if (fixtureCount > 0) {
  console.log(`注意: ${fixtureCount}本はfixtureまたは仮素材で作った動画のため、Phase 0aの品質判定には使えない（配線の確認用）`);
}
