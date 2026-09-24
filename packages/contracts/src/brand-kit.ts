import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式");

export const brandKitSchema = z.object({
  name: z.string().trim().min(1),
  /** 画像スタイルの説明。画像生成とDirectorへの指示に使う。 */
  style: z.string().trim().min(1),
  colors: z.object({
    background: hexColor,
    primary: hexColor,
    accent: hexColor,
    text: hexColor,
    captionBackground: hexColor,
  }),
  /** 字幕フォント。v0.1のテンプレートが読み込めるものから選ぶ。 */
  font: z.enum(["zen_maru_gothic"]),
  /** 文体・トーンの指示。 */
  tone: z.string().trim().min(1),
  bannedWords: z.array(z.string().trim().min(1)).default([]),
  cta: z.string().trim().min(1).max(40),
  /** 読み辞書。キーは表記、値はかなの読み。 */
  readingDict: z.record(z.string().min(1), z.string().min(1)).default({}),
  captionMaxChars: z.number().int().min(8).max(40).default(24),
  voice: z.object({
    provider: z.enum(["voicevox", "gemini", "elevenlabs"]),
    voiceId: z.string().min(1),
  }),
  budget: z.object({
    /** 1本あたりの画像生成上限。v0.1の標準は0。 */
    maxGeneratedImages: z.number().int().min(0).max(3).default(0),
  }),
});

export type BrandKitInput = z.input<typeof brandKitSchema>;
export type BrandKit = z.output<typeof brandKitSchema>;
