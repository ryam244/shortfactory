import { AbsoluteFill, Audio, Sequence } from "remotion";
import { fontFamilyFor } from "./fonts";
import { SAFE_ZONE, type YuruAnimeProps } from "./props";
import { SceneView } from "./components/SceneView";

export const YuruAnimeV1: React.FC<YuruAnimeProps> = ({
  plan,
  brand,
  sceneFrames,
  assets,
  sceneAudio,
  bgmUrl,
  fullSceneMode = false,
  showSafeZone,
}) => {
  const starts = sceneFrames.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + sceneFrames[i - 1]!);
    return acc;
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: brand.colors.background, fontFamily: fontFamilyFor(brand.font) }}>
      {plan.scenes.map((scene, i) => {
        const audio = sceneAudio[i];
        return (
          <Sequence key={scene.id} name={scene.id} from={starts[i]} durationInFrames={sceneFrames[i]}>
            <SceneView scene={scene} brand={brand} assets={assets} fadeIn={i > 0} sceneDurationInFrames={sceneFrames[i]!} fullSceneMode={fullSceneMode} />
            {audio ? <Audio src={audio} /> : null}
          </Sequence>
        );
      })}
      {bgmUrl && plan.bgm?.enabled ? <Audio src={bgmUrl} volume={plan.bgm.volume} loop /> : null}
      {showSafeZone ? <SafeZoneOverlay /> : null}
    </AbsoluteFill>
  );
};

const SafeZoneOverlay: React.FC = () => {
  const shade = "rgba(255, 0, 80, 0.25)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: SAFE_ZONE.top, background: shade }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: SAFE_ZONE.bottom, background: shade }} />
      <div style={{ position: "absolute", top: SAFE_ZONE.top, bottom: SAFE_ZONE.bottom, left: 0, width: SAFE_ZONE.left, background: shade }} />
      <div style={{ position: "absolute", top: SAFE_ZONE.top, bottom: SAFE_ZONE.bottom, right: 0, width: SAFE_ZONE.right, background: shade }} />
    </AbsoluteFill>
  );
};
