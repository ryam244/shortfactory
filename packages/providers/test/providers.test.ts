import { describe, expect, it } from "vitest";
import { giftPlanFixture } from "@shortfactory/contracts";
import { createGiftFixtureProviders, JsonTextProvider } from "../src/index";

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
