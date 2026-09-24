import { describe, expect, it } from "vitest";
import { createGiftFixtureProviders } from "../src/index";

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
