import {
  brandKitSchema,
  estimateNarrationMs,
  giftAssetKeysFixture,
  giftBrandFixture,
  giftPlanFixture,
  resolveSceneTiming,
  validateVideoPlan,
  type ResolvedTiming,
} from "@shortfactory/contracts";
import type { YuruAnimeProps } from "./props";

/**
 * ギフトのfixtureから、TTS前の見積もり尺で描画用propsを作る。
 * 素材URLは空なので、すべて仮の図形で描かれる。
 */
export function buildSampleProps(options: { showSafeZone?: boolean } = {}): {
  props: YuruAnimeProps;
  timing: ResolvedTiming;
} {
  const brand = brandKitSchema.parse(giftBrandFixture);
  const result = validateVideoPlan(giftPlanFixture, {
    brand,
    availableAssetKeys: new Set(giftAssetKeysFixture),
  });
  if (!result.ok) {
    throw new Error(`サンプル計画が無効: ${result.issues.map((i) => `${i.path} ${i.message}`).join(" / ")}`);
  }
  const { plan } = result;
  const timing = resolveSceneTiming(
    plan.scenes.map((scene) => ({ scene, narrationMs: estimateNarrationMs(scene.narration) })),
    plan.fps,
  );

  return {
    props: {
      plan,
      brand,
      sceneFrames: timing.sceneFrames,
      assets: {},
      sceneAudio: plan.scenes.map(() => null),
      bgmUrl: null,
      showSafeZone: options.showSafeZone ?? false,
    },
    timing,
  };
}
