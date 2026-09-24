import type { z } from "zod";
import type { BrandKit } from "./brand-kit";
import { videoPlanSchema, type VideoPlan } from "./video-plan";

export type PlanIssueCode =
  | "schema"
  | "banned_word"
  | "first_scene_not_hook"
  | "last_scene_not_cta"
  | "caption_too_long"
  | "unknown_asset";

export interface PlanIssue {
  code: PlanIssueCode;
  /** 問題の場所（例: scenes.2.caption）。 */
  path: string;
  message: string;
}

export type PlanValidationResult =
  | { ok: true; plan: VideoPlan; issues: [] }
  | { ok: false; plan?: VideoPlan; issues: PlanIssue[] };

export interface PlanValidationContext {
  brand: Pick<BrandKit, "bannedWords" | "captionMaxChars">;
  /** 登録済みの素材キー。指定した場合のみ存在確認を行う。 */
  availableAssetKeys?: ReadonlySet<string>;
}

/**
 * LLM出力などの未検証データを、スキーマと内容の両面で検証する。
 * 失敗理由はDirectorの自動修正プロンプトと画面表示の両方に使う。
 */
export function validateVideoPlan(input: unknown, ctx: PlanValidationContext): PlanValidationResult {
  const parsed = videoPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(schemaIssue) };
  }
  const plan = parsed.data;
  const issues: PlanIssue[] = [];

  const first = plan.scenes[0];
  const last = plan.scenes[plan.scenes.length - 1];
  if (first?.role !== "hook") {
    issues.push({ code: "first_scene_not_hook", path: "scenes.0.role", message: "最初のシーンは hook にする" });
  }
  if (last?.role !== "cta") {
    issues.push({
      code: "last_scene_not_cta",
      path: `scenes.${plan.scenes.length - 1}.role`,
      message: "最後のシーンは cta にする",
    });
  }

  const checkBanned = (text: string, path: string) => {
    for (const word of ctx.brand.bannedWords) {
      if (text.includes(word)) {
        issues.push({ code: "banned_word", path, message: `禁止語「${word}」を含む` });
      }
    }
  };
  checkBanned(plan.title, "title");
  checkBanned(plan.cta, "cta");

  plan.scenes.forEach((scene, i) => {
    checkBanned(scene.narration, `scenes.${i}.narration`);
    checkBanned(scene.caption, `scenes.${i}.caption`);

    const captionChars = [...scene.caption].length;
    if (captionChars > ctx.brand.captionMaxChars) {
      issues.push({
        code: "caption_too_long",
        path: `scenes.${i}.caption`,
        message: `字幕が${captionChars}文字（上限${ctx.brand.captionMaxChars}文字）`,
      });
    }

    if (ctx.availableAssetKeys) {
      const { characterKey, backgroundKey, objectKeys } = scene.visual;
      for (const [key, field] of [
        [characterKey, "characterKey"],
        [backgroundKey, "backgroundKey"],
        ...objectKeys.map((k, j) => [k, `objectKeys.${j}`] as const),
      ] as const) {
        if (!ctx.availableAssetKeys.has(key)) {
          issues.push({
            code: "unknown_asset",
            path: `scenes.${i}.visual.${field}`,
            message: `未登録の素材キー「${key}」`,
          });
        }
      }
    }
  });

  return issues.length === 0 ? { ok: true, plan, issues: [] } : { ok: false, plan, issues };
}

function schemaIssue(issue: z.core.$ZodIssue): PlanIssue {
  return { code: "schema", path: issue.path.join("."), message: issue.message };
}
