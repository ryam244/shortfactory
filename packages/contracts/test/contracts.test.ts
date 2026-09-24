import { describe, expect, it } from "vitest";
import {
  applyReadingDict,
  assertGenerationBudget,
  brandKitSchema,
  estimateNarrationMs,
  giftAssetKeysFixture,
  giftBrandFixture,
  giftPlanFixture,
  resolveSceneTiming,
  ttsTextForScene,
  validateVideoPlan,
  type VideoPlanInput,
} from "../src";

const brand = brandKitSchema.parse(giftBrandFixture);
const ctx = { brand, availableAssetKeys: new Set<string>(giftAssetKeysFixture) };

function clonePlan(): VideoPlanInput {
  return structuredClone(giftPlanFixture);
}

describe("validateVideoPlan", () => {
  it("ギフトのfixtureは有効", () => {
    const result = validateVideoPlan(giftPlanFixture, ctx);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("シーン数が4以下・9以上ならスキーマエラー", () => {
    const few = clonePlan();
    few.scenes = few.scenes.slice(0, 4);
    expect(validateVideoPlan(few, ctx).issues[0]?.code).toBe("schema");

    const many = clonePlan();
    many.scenes = [...many.scenes, ...many.scenes.slice(0, 2)].map((s, i) => ({
      ...s,
      id: `scene-${String(i + 1).padStart(2, "0")}`,
    }));
    expect(validateVideoPlan(many, ctx).issues[0]?.code).toBe("schema");
  });

  it("空字幕と未知のmotionはスキーマエラー", () => {
    const plan = clonePlan();
    plan.scenes[1]!.caption = "  ";
    (plan.scenes[2] as { motion: string }).motion = "spin";
    const result = validateVideoPlan(plan, ctx);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(["scenes.1.caption", "scenes.2.motion"]),
    );
  });

  it("シーンidの重複を拒否する", () => {
    const plan = clonePlan();
    plan.scenes[1]!.id = "scene-01";
    expect(validateVideoPlan(plan, ctx).ok).toBe(false);
  });

  it("禁止語・先頭と末尾の役割・字幕の長さ・未登録素材を検出する", () => {
    const plan = clonePlan();
    plan.scenes[0]!.role = "body";
    plan.scenes[6]!.role = "body";
    plan.scenes[2]!.narration = "これは絶対に外さない";
    plan.scenes[3]!.caption = "とても長い字幕になってしまった例です";
    plan.scenes[4]!.visual.backgroundKey = "beach";

    const result = validateVideoPlan(plan, ctx);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code).sort()).toEqual(
      ["banned_word", "caption_too_long", "first_scene_not_hook", "last_scene_not_cta", "unknown_asset"].sort(),
    );
  });

  it("素材キー一覧を渡さない場合は存在確認をしない", () => {
    const plan = clonePlan();
    plan.scenes[4]!.visual.backgroundKey = "beach";
    expect(validateVideoPlan(plan, { brand }).ok).toBe(true);
  });
});

describe("assertGenerationBudget", () => {
  it("設定上限以内の画像生成を許可する", () => {
    expect(() => assertGenerationBudget({ budget: { maxGeneratedImages: 2 } }, 2)).not.toThrow();
  });

  it("設定上限を超える画像生成をProvider前に拒否する", () => {
    expect(() => assertGenerationBudget({ budget: { maxGeneratedImages: 0 } }, 1)).toThrow(/上限 0/);
  });
});

describe("読み辞書", () => {
  it("長い表記から先に置き換える", () => {
    const dict = { 札幌: "さっぽろ", 札幌駅: "さっぽろえき" };
    expect(applyReadingDict("札幌駅から札幌ドームへ", dict)).toBe("さっぽろえきからさっぽろドームへ");
  });

  it("narrationReadingがあればそれを優先する", () => {
    expect(ttsTextForScene({ narration: "手土産", narrationReading: "おみやげ" }, brand.readingDict)).toBe("おみやげ");
    expect(ttsTextForScene({ narration: "手土産を個包装で" }, brand.readingDict)).toBe("てみやげをこほうそうで");
  });
});

describe("resolveSceneTiming", () => {
  it("フレーム合計が総尺と一致し、丸め誤差が溜まらない", () => {
    const scene = { minDurationMs: 1_000, maxDurationMs: 10_000 };
    // 1シーン1033msは30fpsで30.99フレーム。単純に丸めると合計がずれる。
    const inputs = Array.from({ length: 7 }, () => ({ scene, narrationMs: 633 }));
    const t = resolveSceneTiming(inputs, 30);
    expect(t.sceneFrames.reduce((a, b) => a + b, 0)).toBe(t.totalFrames);
    expect(t.totalFrames).toBe(Math.round((t.totalMs * 30) / 1000));
  });

  it("最小尺に満たない場合は伸ばし、最大尺を超える音声は切らずに警告する", () => {
    const t = resolveSceneTiming(
      [
        { scene: { minDurationMs: 3_000, maxDurationMs: 5_000 }, narrationMs: 1_000 },
        { scene: { minDurationMs: 3_000, maxDurationMs: 5_000 }, narrationMs: 6_000 },
      ],
      30,
    );
    expect(t.sceneMs).toEqual([3_000, 6_000]);
    expect(t.overflowingScenes).toEqual([1]);
    expect(t.outOfRange).toBe(true);
  });

  it("ギフトのfixtureは見積もり尺で24〜35秒に収まる", () => {
    const plan = validateVideoPlan(giftPlanFixture, ctx);
    if (!plan.ok) throw new Error("fixture invalid");
    const t = resolveSceneTiming(
      plan.plan.scenes.map((scene) => ({ scene, narrationMs: estimateNarrationMs(scene.narration) })),
      plan.plan.fps,
    );
    expect(t.outOfRange).toBe(false);
  });
});
