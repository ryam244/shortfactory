import type { BrandKit, VideoPlan } from "@shortfactory/contracts";

export const COMPOSITION_ID = "yuru-anime-v1";
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** トーンと登録済み素材から、安全に選べる描画モードを決める。 */
export function fullSceneModeForTone(plan: VideoPlan, assets: Record<string, string>): boolean {
  if (plan.toneProfile === "ip-character") return false;
  return Boolean(assets.full_scene || plan.scenes.some((scene) => assets[`full_scene/${scene.id}`]));
}

/**
 * テンプレートに渡す値。URLはワーカー（またはPlayerを置く画面）が
 * StorageProviderで解決して渡す。LLMの出力にURLは含めない。
 */
export interface YuruAnimeProps {
  plan: VideoPlan;
  brand: BrandKit;
  /** resolveSceneTiming の結果。plan.scenes と同じ長さ。 */
  sceneFrames: number[];
  /**
   * 素材キー → URL。キャラクターの表情差分は `${characterKey}/${expressionKey}` で引く。
   * 見つからない素材は仮の図形で描く。
   */
  assets: Record<string, string>;
  /** シーンごとのナレーション音声URL。TTS前は null。 */
  sceneAudio: (string | null)[];
  bgmUrl: string | null;
  /** 完成シーン画像を背景として使い、人物・小物レイヤーを省略するバッチモード。 */
  fullSceneMode?: boolean;
  /** キャラクターを使わず、字幕と図形の動きだけで訴求するモード。 */
  kineticTextMode?: boolean;
  /** SNSのUIに隠れる範囲を重ねて表示する（確認用）。 */
  showSafeZone: boolean;
  // Remotionの入力propsはインデックスシグネチャを要求する
  [key: string]: unknown;
}

/**
 * TikTok・リール・ショートのUIに隠れる範囲（1080×1920基準のpx）。
 * 3つのSNSで最も広い値を採用した目安。実機の表示で調整する。
 */
export const SAFE_ZONE = {
  top: 220,
  bottom: 480,
  left: 60,
  right: 180,
} as const;
