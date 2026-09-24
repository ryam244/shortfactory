import type { Scene } from "./video-plan";

/**
 * 読み辞書を適用する。長い表記から先に置き換え、
 * 「札幌駅」と「札幌」が両方ある場合に短い方が先に当たらないようにする。
 */
export function applyReadingDict(text: string, dict: Readonly<Record<string, string>>): string {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return text;
  const pattern = new RegExp(keys.map(escapeRegExp).join("|"), "g");
  return text.replace(pattern, (match) => dict[match] ?? match);
}

/** TTSに実際に渡す文字列。再利用判定のハッシュもこの値を基準にする。 */
export function ttsTextForScene(
  scene: Pick<Scene, "narration" | "narrationReading">,
  dict: Readonly<Record<string, string>>,
): string {
  return scene.narrationReading ?? applyReadingDict(scene.narration, dict);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
