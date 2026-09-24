"use client";

import { Player } from "@remotion/player";
import { fixtureVoiceDurationMs, resolveSceneTiming, type BrandKit, type VideoPlan } from "@shortfactory/contracts";
import { YuruAnimeV1, type YuruAnimeProps } from "@shortfactory/video";

export function PreviewPlayer({ plan, brand, sceneAudio, sceneAudioDurations }: { plan: VideoPlan; brand: BrandKit; sceneAudio?: Record<string, string>; sceneAudioDurations?: Record<string, number> }) {
  const timing = resolveSceneTiming(plan.scenes.map((scene) => ({ scene, narrationMs: sceneAudioDurations?.[scene.id] ?? fixtureVoiceDurationMs(scene.narration) })), plan.fps);
  const props: YuruAnimeProps = {
    plan,
    brand,
    sceneFrames: timing.sceneFrames,
    assets: {},
    sceneAudio: plan.scenes.map((scene) => sceneAudio?.[scene.id] ?? null),
    bgmUrl: null,
    showSafeZone: false,
  };
  return <Player component={YuruAnimeV1} inputProps={props} durationInFrames={timing.totalFrames} fps={plan.fps} compositionWidth={1080} compositionHeight={1920} controls style={{ width: "100%", maxWidth: 360, aspectRatio: "9 / 16" }} />;
}
