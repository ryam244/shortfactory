"use client";

import { Player } from "@remotion/player";
import { fixtureVoiceDurationMs, resolveSceneTiming, type BrandKit, type VideoPlan } from "@shortfactory/contracts";
import { YuruAnimeV1, type YuruAnimeProps } from "@shortfactory/video";

export function PreviewPlayer({ plan, brand }: { plan: VideoPlan; brand: BrandKit }) {
  const timing = resolveSceneTiming(plan.scenes.map((scene) => ({ scene, narrationMs: fixtureVoiceDurationMs(scene.narration) })), plan.fps);
  const props: YuruAnimeProps = {
    plan,
    brand,
    sceneFrames: timing.sceneFrames,
    assets: {},
    sceneAudio: plan.scenes.map(() => null),
    bgmUrl: null,
    showSafeZone: false,
  };
  return <Player component={YuruAnimeV1} inputProps={props} durationInFrames={timing.totalFrames} fps={plan.fps} compositionWidth={1080} compositionHeight={1920} controls style={{ width: "100%", maxWidth: 360, aspectRatio: "9 / 16" }} />;
}
