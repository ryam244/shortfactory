/** Phase 0aの生成・評価スクリプトで共有する設定と処理。 */
import { RenderInternals } from "@remotion/renderer";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** 評価で使うテーマ。件数を増やしても生成とマニフェストが同じ一覧を参照する。 */
const BASE_EVALUATION_TOPICS = ["春の手土産", "職場へのお菓子", "引っ越し祝い", "北海道のおみやげ", "誕生日ギフト"] as const;
const evaluationCount = Number(process.env.SHORTFACTORY_EVALUATION_COUNT ?? BASE_EVALUATION_TOPICS.length);
if (!Number.isInteger(evaluationCount) || evaluationCount < 1) throw new Error("SHORTFACTORY_EVALUATION_COUNT must be a positive integer");
export const EVALUATION_TOPICS = Array.from({ length: evaluationCount }, (_, index) => {
  const base = BASE_EVALUATION_TOPICS[index % BASE_EVALUATION_TOPICS.length]!;
  return index < BASE_EVALUATION_TOPICS.length ? base : `${base}（評価${index + 1}）`;
});

export function evaluationItemId(index: number): string {
  return `gift-${String(index + 1).padStart(2, "0")}`;
}

export function batchDirFromEnv(): string {
  return path.resolve(here, "../../out", process.env.SHORTFACTORY_OUTPUT_DIR ?? "fixture-batch");
}

/**
 * 生成に使った実装の記録。fixtureや仮素材で作った動画は配線の確認用で、
 * Phase 0aの品質判定（マスタープラン§9）には使えない。
 */
export interface GenerationSources {
  text: "fixture" | "test" | string;
  voice: "fixture" | "test" | "voicevox" | string;
  voiceId: string;
  assets: "placeholder" | "test" | "registered";
}

/** Phase 0aの品質判定に使えるか。台本・音声・素材のすべてが実物である必要がある。 */
export function isQualityEvaluable(sources: GenerationSources): boolean {
  return ![sources.text, sources.voice, sources.assets].includes("fixture")
    && ![sources.text, sources.voice, sources.assets].includes("test")
    && sources.assets !== "placeholder";
}

export const FIXTURE_SOURCES: GenerationSources = { text: "fixture", voice: "fixture", voiceId: "fixture", assets: "placeholder" };

let systemFfprobe: boolean | undefined;

/**
 * ffprobeをJSON出力で実行する。システムのffprobeがあればそれを使い、
 * なければRemotionに同梱されたffprobeを使う（追加インストール不要）。
 */
export async function ffprobeJson<T>(args: string[]): Promise<T> {
  const fullArgs = ["-v", "error", ...args, "-of", "json"];
  systemFfprobe ??= spawnSync("ffprobe", ["-version"], { stdio: "ignore" }).status === 0;
  if (systemFfprobe) {
    return JSON.parse(execFileSync("ffprobe", fullArgs, { encoding: "utf8" })) as T;
  }
  const { stdout } = await RenderInternals.callFf({
    bin: "ffprobe",
    args: fullArgs,
    indent: false,
    logLevel: "error",
    binariesDirectory: null,
    cancelSignal: undefined,
  });
  return JSON.parse(stdout) as T;
}
