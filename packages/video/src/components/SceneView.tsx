import type { BrandKit, Motion, Scene } from "@shortfactory/contracts";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  type SpringConfig,
} from "remotion";
import { SAFE_ZONE } from "../props";
import { Caption } from "./Caption";
import { KineticTextScene } from "./KineticTextScene";
import { PlaceholderBackground, PlaceholderCharacter, PlaceholderObject } from "./Placeholders";

interface SceneViewProps {
  scene: Scene;
  brand: BrandKit;
  assets: Record<string, string>;
  /** 先頭シーン以外はフェードインする。 */
  fadeIn: boolean;
  sceneDurationInFrames: number;
  fullSceneMode?: boolean;
  kineticTextMode?: boolean;
}

/**
 * キャラクターを置く範囲。上は小物の列の下、下は字幕の上まで。
 * 字幕（Caption）は安全域の下端から40px上に、最大2行で置く前提。
 */
const CHARACTER_AREA = {
  top: SAFE_ZONE.top + 140,
  bottom: SAFE_ZONE.bottom + 240,
  left: SAFE_ZONE.left + 20,
  right: SAFE_ZONE.right + 20,
} as const;
const BOUNCE: Partial<SpringConfig> = { damping: 8, stiffness: 160, mass: 0.8 };

export const SceneView: React.FC<SceneViewProps> = ({ scene, brand, assets, fadeIn: _fadeIn, sceneDurationInFrames, fullSceneMode = false, kineticTextMode = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors } = brand;
  const { characterKey, expressionKey, backgroundKey, objectKeys } = scene.visual;

  const progress = interpolate(frame, [0, Math.max(1, sceneDurationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  // シーン間で黒く点滅すると視線が途切れるため、暗転フェードは使わない。
  // 動きは背景パン・文字の登場・小さなスケール変化に限定する。
  const opacity = 1;

  if (kineticTextMode) {
    return <KineticTextScene scene={scene} brand={brand} />;
  }

  const backgroundUrl = fullSceneMode ? assets[`full_scene/${scene.id}`] ?? assets.full_scene : assets[backgroundKey];
  const characterUrl = (expressionKey && assets[`${characterKey}/${expressionKey}`]) || assets[characterKey];

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: cameraTransform(scene.motion, progress) }}>
        {backgroundUrl ? (
          <Img
            src={backgroundUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.84) brightness(0.9)" }}
          />
        ) : (
          <PlaceholderBackground assetKey={backgroundKey} base={colors.background} accent={colors.accent} />
        )}
        <AbsoluteFill style={{ background: "rgba(28, 35, 32, 0.08)" }} />
      </AbsoluteFill>

      {!fullSceneMode ? <div
        style={{
          position: "absolute",
          ...CHARACTER_AREA,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          transform: `${characterTransform(scene.motion, frame, fps)} translateY(${Math.sin(frame / fps * 2) * 4}px)`,
          transformOrigin: "50% 100%",
          filter: "drop-shadow(0 12px 14px rgba(30, 25, 20, 0.18))",
        }}
      >
        {characterUrl ? (
          <Img src={characterUrl} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
        ) : (
          <PlaceholderCharacter
            characterKey={characterKey}
            expressionKey={expressionKey}
            color={colors.primary}
            ink={colors.text}
          />
        )}
      </div> : null}

      {!fullSceneMode && objectKeys.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: SAFE_ZONE.top + 20,
            left: SAFE_ZONE.left,
            right: SAFE_ZONE.right,
            display: "flex",
            justifyContent: "center",
            gap: 18,
          }}
        >
          {objectKeys.map((key, i) => {
            const pop = spring({ frame: frame - 8 - i * 5, fps, config: BOUNCE });
            const url = assets[key];
            return (
              <div key={key} style={{ transform: `scale(${pop})` }}>
                {url ? (
                    <Img src={url} style={{ width: 140, height: 140, objectFit: "contain" }} />
                ) : (
                  <PlaceholderObject assetKey={key} color={colors.captionBackground} ink={colors.accent} />
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      <Caption
        text={scene.caption}
        color={colors.text}
        background={colors.captionBackground}
        accent={colors.primary}
        centered={fullSceneMode}
      />
    </AbsoluteFill>
  );
};

/** 背景全体の動き。パンは端が見えないよう少し拡大してから動かす。 */
function cameraTransform(motion: Motion, progress: number): string {
  switch (motion) {
    case "slow_zoom":
      return `scale(${1 + 0.08 * progress})`;
    case "pan_left":
      return `scale(1.1) translateX(${interpolate(progress, [0, 1], [30, -30])}px)`;
    case "pan_right":
      return `scale(1.1) translateX(${interpolate(progress, [0, 1], [-30, 30])}px)`;
    case "slide_up":
    case "bounce":
    case "none":
      return "none";
  }
}

/** キャラクターの登場の動き。 */
function characterTransform(motion: Motion, frame: number, fps: number): string {
  switch (motion) {
    case "slide_up": {
      const enter = spring({ frame, fps, config: { damping: 16 } });
      return `translateY(${interpolate(enter, [0, 1], [240, 0])}px)`;
    }
    case "bounce": {
      const enter = spring({ frame, fps, config: BOUNCE });
      return `scale(${interpolate(enter, [0, 1], [0.6, 1])})`;
    }
    default:
      return "translateY(0px)";
  }
}
