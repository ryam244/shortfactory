import { describe, expect, it } from "vitest";
import { giftPlanFixture } from "@shortfactory/contracts";
import { composeCreativePlan, composeCreativePlanVariants, createGiftFixtureProviders, JsonTextProvider } from "../src/index";

describe("fixture providers", () => {
  it("テーマから検証済みVideoPlanを返す", async () => {
    const providers = createGiftFixtureProviders();
    const plan = await providers.text.generatePlan({
      topic: "春の手土産",
      brand: providers.brand,
      availableAssetKeys: providers.assetKeys,
    });

    expect(plan.brandId).toBe(providers.brand.name);
    expect(plan.title).toBe("春の手土産");
    expect(plan.scenes).toHaveLength(7);
  });

  it("VoiceProviderは同じ入力から決定的な尺を返す", async () => {
    const providers = createGiftFixtureProviders();
    const first = await providers.voice.synthesize({ text: "個包装のギフト", voiceId: "fixture" });
    const second = await providers.voice.synthesize({ text: "個包装のギフト", voiceId: "fixture" });

    expect(first.durationMs).toBe(second.durationMs);
    expect(first.contentType).toBe("audio/wav");
    expect(first.bytes.byteLength).toBeGreaterThan(44);
    expect(first.bytes).toEqual(second.bytes);
  });
});

describe("JsonTextProvider", () => {
  it("validates a plan loaded from JSON before returning it", async () => {
    const fixture = createGiftFixtureProviders();
    const provider = new JsonTextProvider(giftPlanFixture);
    const plan = await provider.generatePlan({
      topic: "ignored",
      brand: fixture.brand,
      availableAssetKeys: fixture.assetKeys,
    });
    expect(plan.scenes).toHaveLength(7);
  });

  it("rejects an invalid plan instead of rendering it", async () => {
    const fixture = createGiftFixtureProviders();
    const raw = structuredClone(giftPlanFixture);
    raw.scenes[0]!.visual.backgroundKey = "missing";
    const provider = new JsonTextProvider(raw);
    await expect(provider.generatePlan({
      topic: "ignored",
      brand: fixture.brand,
      availableAssetKeys: fixture.assetKeys,
    })).rejects.toThrow("未登録の素材キー");
  });
});

describe("composeCreativePlan", () => {
  it("briefからフック→悩み→解決→証拠→CTAを固定順で作る", () => {
    const fixture = createGiftFixtureProviders();
    const plan = composeCreativePlan({
      audience: "職場に手土産を持っていく人",
      pain: "何を選べばいいか迷う",
      solution: "日持ちと個包装で絞る",
      proof: "配りやすく、すぐ食べなくても困らない",
      cta: "保存して次に使う",
    }, { brand: fixture.brand, availableAssetKeys: fixture.assetKeys });

    expect(plan.scenes.map((scene) => scene.role)).toEqual(["hook", "body", "body", "body", "cta"]);
    expect(plan.scenes[0]!.caption).toContain("迷う");
    expect(plan.scenes[2]!.caption).toContain("解決");
    expect(plan.scenes[3]!.caption).toContain("理由");
    expect(plan.scenes[4]!.caption).toContain("保存");
  });

  it("同じブリーフから3種類のフックを比較生成できる", () => {
    const fixture = createGiftFixtureProviders();
    const variants = composeCreativePlanVariants({
      audience: "職場に手土産を持っていく人",
      pain: "何を選べばいいか迷う",
      solution: "日持ちと個包装で絞る",
      proof: "配りやすくて安心",
      cta: "保存して次に使う",
    }, { brand: fixture.brand, availableAssetKeys: fixture.assetKeys });

    expect(Object.keys(variants)).toEqual(["question", "empathy", "promise"]);
    expect(variants.question.scenes[0]!.caption).toContain("？");
    expect(variants.empathy.scenes[0]!.caption).toContain("それ");
    expect(variants.promise.scenes[0]!.caption).toContain("整理");
    expect(variants.question.scenes.slice(1).map((scene) => scene.caption)).toEqual(variants.promise.scenes.slice(1).map((scene) => scene.caption));
  });
});
