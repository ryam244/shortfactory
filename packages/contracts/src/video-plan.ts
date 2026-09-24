import { z } from "zod";

/** テンプレートが実装しているモーションの許可リスト。 */
export const MOTIONS = ["none", "slow_zoom", "pan_left", "pan_right", "slide_up", "bounce"] as const;
export const motionSchema = z.enum(MOTIONS);
export type Motion = z.infer<typeof motionSchema>;

export const SCENE_ROLES = ["hook", "body", "cta"] as const;
export const sceneRoleSchema = z.enum(SCENE_ROLES);
export type SceneRole = z.infer<typeof sceneRoleSchema>;

export const PLAN_LIMITS = {
  minScenes: 5,
  maxScenes: 8,
  minTotalMs: 24_000,
  maxTotalMs: 35_000,
  maxObjectsPerScene: 3,
  maxNarrationChars: 80,
} as const;

/** 素材キー。LLMはURLではなくこのキーだけを指定する。 */
const assetKeySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_]*$/, "素材キーは英小文字・数字・_のみ");

export const sceneVisualSchema = z.object({
  characterKey: assetKeySchema,
  expressionKey: assetKeySchema.optional(),
  backgroundKey: assetKeySchema,
  objectKeys: z.array(assetKeySchema).max(PLAN_LIMITS.maxObjectsPerScene).default([]),
});
export type SceneVisual = z.infer<typeof sceneVisualSchema>;

export const sceneSchema = z
  .object({
    id: z.string().regex(/^scene-\d{2}$/, "idは scene-01 の形式"),
    role: sceneRoleSchema,
    /** 字幕・台本として表示する文（漢字を含む）。 */
    narration: z.string().trim().min(1).max(PLAN_LIMITS.maxNarrationChars),
    /** TTSに渡す読み（かな）。省略時は narration にブランドの読み辞書を適用する。 */
    narrationReading: z.string().trim().min(1).optional(),
    caption: z.string().trim().min(1, "空の字幕は不可"),
    visual: sceneVisualSchema,
    motion: motionSchema,
    needsFactCheck: z.boolean().default(false),
    minDurationMs: z.number().int().min(1_000),
    maxDurationMs: z.number().int().max(10_000),
  })
  .refine((s) => s.minDurationMs <= s.maxDurationMs, {
    message: "minDurationMs は maxDurationMs 以下",
    path: ["minDurationMs"],
  });
export type Scene = z.infer<typeof sceneSchema>;

export const bgmSchema = z.object({
  enabled: z.boolean(),
  assetKey: assetKeySchema,
  volume: z.number().min(0).max(1).default(0.15),
});

export const videoPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    template: z.literal("yuru_anime_v1"),
    brandId: z.string().min(1),
    title: z.string().trim().min(1).max(60),
    fps: z.literal(30),
    bgm: bgmSchema.optional(),
    scenes: z.array(sceneSchema).min(PLAN_LIMITS.minScenes).max(PLAN_LIMITS.maxScenes),
    cta: z.string().trim().min(1).max(40),
  })
  .refine((p) => new Set(p.scenes.map((s) => s.id)).size === p.scenes.length, {
    message: "シーンidが重複している",
    path: ["scenes"],
  });

/** 検証前の入力（LLM出力など）の型。 */
export type VideoPlanInput = z.input<typeof videoPlanSchema>;
/** 検証・既定値適用済みの型。 */
export type VideoPlan = z.output<typeof videoPlanSchema>;
