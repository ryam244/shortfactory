import { PLAN_LIMITS, type Scene } from "./video-plan";

/** 音声の前後に入れる余白。 */
export const DEFAULT_SCENE_PADDING_MS = 400;

/**
 * TTS前の仮の尺。日本語ナレーションを1文字あたり約130msで見積もる。
 * Phase 0aでTTSの実測値に置き換える。
 */
export function estimateNarrationMs(text: string): number {
  const chars = [...text.replace(/\s/g, "")].length;
  return Math.round(chars * 130);
}

/** FixtureVoiceProviderとPreviewが共有する、決定的な音声尺。 */
export function fixtureVoiceDurationMs(text: string): number {
  return Math.max(400, estimateNarrationMs(text));
}

export interface SceneTimingInput {
  scene: Pick<Scene, "minDurationMs" | "maxDurationMs">;
  /** TTSの実測尺（なければ見積もり）。 */
  narrationMs: number;
}

export interface ResolvedTiming {
  /** シーンごとのフレーム数。合計は totalFrames と必ず一致する。 */
  sceneFrames: number[];
  sceneMs: number[];
  totalFrames: number;
  totalMs: number;
  /** 総尺が許容範囲（24〜35秒）から外れている。 */
  outOfRange: boolean;
  /** 音声が maxDurationMs を超えて切り詰めが必要なシーンの添字。 */
  overflowingScenes: number[];
}

/**
 * 各シーンの表示時間を決め、最後に一度だけフレームへ換算する。
 * 累積時間の境界を丸めることで、シーン単位の丸め誤差が合計に溜まらないようにする。
 */
export function resolveSceneTiming(
  inputs: readonly SceneTimingInput[],
  fps: number,
  paddingMs: number = DEFAULT_SCENE_PADDING_MS,
): ResolvedTiming {
  const overflowingScenes: number[] = [];
  const sceneMs = inputs.map(({ scene, narrationMs }, i) => {
    const wanted = narrationMs + paddingMs;
    if (narrationMs > scene.maxDurationMs) overflowingScenes.push(i);
    return Math.min(Math.max(wanted, scene.minDurationMs), Math.max(scene.maxDurationMs, narrationMs));
  });

  const sceneFrames: number[] = [];
  let cumulativeMs = 0;
  let prevBoundary = 0;
  for (const ms of sceneMs) {
    cumulativeMs += ms;
    const boundary = Math.round((cumulativeMs * fps) / 1000);
    sceneFrames.push(boundary - prevBoundary);
    prevBoundary = boundary;
  }

  const totalMs = cumulativeMs;
  return {
    sceneFrames,
    sceneMs,
    totalFrames: prevBoundary,
    totalMs,
    outOfRange: totalMs < PLAN_LIMITS.minTotalMs || totalMs > PLAN_LIMITS.maxTotalMs,
    overflowingScenes,
  };
}
