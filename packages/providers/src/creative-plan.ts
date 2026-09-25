import {
  validateVideoPlan,
  type BrandKit,
  type VideoPlan,
  type VideoPlanInput,
} from "@shortfactory/contracts";

export interface CreativeBriefInput {
  audience: string;
  pain: string;
  solution: string;
  proof: string;
  cta: string;
  hookStyle?: HookStyle;
  /** ブランド固有の素材を指定したい場合だけ上書きする。 */
  assets?: {
    characterKey?: string;
    backgrounds?: string[];
    objects?: string[];
  };
}

export type HookStyle = "question" | "empathy" | "promise";

export interface CreativePlanContext {
  brand: BrandKit;
  availableAssetKeys: ReadonlySet<string>;
}

/**
 * 5段構成を決定的にVideoPlanへ変換する初期版。
 * LLMに丸投げせず、フック→悩み→解決→証拠→CTAの順序を必ず保証する。
 */
export function composeCreativePlan(brief: CreativeBriefInput, context: CreativePlanContext): VideoPlan {
  const maxCaption = context.brand.captionMaxChars;
  const text = normalizeBrief(brief);
  const hookStyle = brief.hookStyle ?? "empathy";
  const characterKey = pickAsset(context.availableAssetKeys, brief.assets?.characterKey, ["gift_girl", "character", "girl"]);
  const backgrounds = [
    pickAsset(context.availableAssetKeys, brief.assets?.backgrounds?.[0], ["shop_shelf", "background", "room_warm"]),
    pickAsset(context.availableAssetKeys, brief.assets?.backgrounds?.[1], ["desk", "room_warm", "background"]),
  ];
  const objectKeys = [
    pickAsset(context.availableAssetKeys, brief.assets?.objects?.[0], ["gift_box", "object"]),
    pickAsset(context.availableAssetKeys, brief.assets?.objects?.[1], ["cookie", "card", "object"]),
  ];

  const scenes: VideoPlanInput["scenes"] = [
    scene("scene-01", "hook", hookNarration(hookStyle, text.audience, text.pain), hookCaption(hookStyle, text.pain, maxCaption), characterKey, backgrounds[0]!, objectKeys[0]!, "slow_zoom", 4_500),
    scene("scene-02", "body", `悩みは、${text.pain}。頑張って選んでも、相手に合わないと困ります。`, shorten(text.pain, maxCaption), characterKey, backgrounds[0]!, objectKeys[1]!, "pan_right", 4_500),
    scene("scene-03", "body", `そこで、${text.solution}。迷うポイントを先に絞ります。`, captionFor("解決", text.solution, maxCaption), characterKey, backgrounds[1]!, objectKeys[1]!, "slow_zoom", 4_500),
    scene("scene-04", "body", `理由は、${text.proof}。選ぶ基準がぶれにくくなります。`, captionFor("理由", text.proof, maxCaption), characterKey, backgrounds[1]!, objectKeys[0]!, "slide_up", 4_500),
    scene("scene-05", "cta", `${text.cta}。`, shorten(text.cta, maxCaption), characterKey, backgrounds[1]!, objectKeys[0]!, "bounce", 4_500),
  ];
  const raw: VideoPlanInput = {
    schemaVersion: 1,
    template: "yuru_anime_v1",
    brandId: context.brand.name,
    title: shorten(`${text.solution}｜${text.audience}`, 60),
    fps: 30,
    cta: shorten(text.cta, 40),
    scenes,
  };
  const result = validateVideoPlan(raw, { brand: context.brand, availableAssetKeys: context.availableAssetKeys });
  if (!result.ok) throw new Error(`Creative brief is invalid: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join(" / ")}`);
  return result.plan;
}

/** 同じブリーフから、冒頭の訴求だけを変えた比較用プランを作る。 */
export function composeCreativePlanVariants(brief: CreativeBriefInput, context: CreativePlanContext): Record<HookStyle, VideoPlan> {
  return Object.fromEntries(((["question", "empathy", "promise"] as const).map((hookStyle) => [
    hookStyle,
    composeCreativePlan({ ...brief, hookStyle }, context),
  ]))) as Record<HookStyle, VideoPlan>;
}

function scene(
  id: `scene-${string}`,
  role: "hook" | "body" | "cta",
  narration: string,
  caption: string,
  characterKey: string,
  backgroundKey: string,
  objectKey: string,
  motion: "slow_zoom" | "pan_right" | "slide_up" | "bounce",
  minDurationMs: number,
): VideoPlanInput["scenes"][number] {
  return {
    id,
    role,
    narration: shorten(narration, 80),
    caption: shorten(caption, 40),
    visual: {
      characterKey,
      expressionKey: role === "hook" ? "think" : role === "cta" ? "smile" : "surprise",
      backgroundKey,
      objectKeys: [objectKey],
    },
    motion,
    minDurationMs,
    maxDurationMs: minDurationMs + 1_500,
  };
}

function normalizeBrief(brief: CreativeBriefInput) {
  const values = [brief.audience, brief.pain, brief.solution, brief.proof, brief.cta];
  if (values.some((value) => !value?.trim())) throw new Error("audience, pain, solution, proof, cta are required");
  const keys = ["audience", "pain", "solution", "proof", "cta"] as const;
  return Object.fromEntries(values.map((value, index) => [keys[index]!, value.trim()])) as Record<(typeof keys)[number], string>;
}

function shorten(value: string, max: number): string {
  const chars = [...value.trim()];
  return chars.length <= max ? value.trim() : `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}

function captionFor(label: string, value: string, max: number): string {
  const prefix = `${label}：`;
  const firstClause = value.split(/[、。！？]/u)[0]!.trim();
  return shorten(`${prefix}${firstClause}`, max);
}

function hookNarration(style: HookStyle, audience: string, pain: string): string {
  if (style === "question") return `${audience}なら、まだ「${pain}」で迷ってる？まずはこれ。`;
  if (style === "promise") return `${audience}向け。${pain}を短く整理する方法を紹介します。`;
  return `${audience}で「${pain}」と感じたら、まずこれを試して。`;
}

function hookCaption(style: HookStyle, pain: string, max: number): string {
  if (style === "question") return shorten(`まだ${pain}？`, max);
  if (style === "promise") return shorten(`${pain}を整理`, max);
  return shorten(`それ、${pain}`, max);
}

function pickAsset(available: ReadonlySet<string>, preferred: string | undefined, candidates: string[]): string {
  if (preferred && available.has(preferred)) return preferred;
  for (const candidate of candidates) {
    if (available.has(candidate)) return candidate;
    const fuzzy = [...available].find((key) => key.includes(candidate));
    if (fuzzy) return fuzzy;
  }
  const first = [...available][0];
  if (!first) throw new Error("Creative brief requires at least one registered asset");
  return first;
}
