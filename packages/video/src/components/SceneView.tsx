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
import { PlaceholderBackground, PlaceholderCharacter, PlaceholderObject } from "./Placeholders";

interface SceneViewProps {
  scene: Scene;
  brand: BrandKit;
  assets: Record<string, string>;
  /** 先頭シーン以外はフェードインする。 */
  fadeIn: boolean;
  sceneDurationInFrames: number;
}

const FADE_FRAMES = 6;

/**
 * キャラクターを置く範囲。上は小物の列の下、下は字幕の上まで。
 * 字幕（Caption）は安全域の下端から40px上に、最大2行で置く前提。
 */
const CHARACTER_AREA = {
  top: SAFE_ZONE.top + 320,
  bottom: SAFE_ZONE.bottom + 320,
  left: SAFE_ZONE.left,
  right: SAFE_ZONE.right,
} as const;
const BOUNCE: Partial<SpringConfig> = { damping: 8, stiffness: 160, mass: 0.8 };

export const SceneView: React.FC<SceneViewProps> = ({ scene, brand, assets, fadeIn, sceneDurationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors } = brand;
  const { characterKey, expressionKey, backgroundKey, objectKeys } = scene.visual;

  const progress = interpolate(frame, [0, Math.max(1, sceneDurationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const opacity = fadeIn ? interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }) : 1;

  const backgroundUrl = assets[backgroundKey];
  const characterUrl = (expressionKey && assets[`${characterKey}/${expressionKey}`]) || assets[characterKey];

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: cameraTransform(scene.motion, progress) }}>
        {backgroundUrl ? (
          <Img src={backgroundUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <PlaceholderBackground assetKey={backgroundKey} base={colors.background} accent={colors.accent} />
        )}
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          ...CHARACTER_AREA,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          transform: `${characterTransform(scene.motion, frame, fps)} translateY(${Math.sin(frame / fps * 2) * 4}px)`,
          transformOrigin: "50% 100%",
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
      </div>

      {objectKeys.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: SAFE_ZONE.top + 80,
            left: SAFE_ZONE.left,
            right: SAFE_ZONE.right,
            display: "flex",
            justifyContent: "center",
            gap: 32,
          }}
        >
          {objectKeys.map((key, i) => {
            const pop = spring({ frame: frame - 8 - i * 5, fps, config: BOUNCE });
            const url = assets[key];
            return (
              <div key={key} style={{ transform: `scale(${pop})` }}>
                {url ? (
                  <Img src={url} style={{ width: 220, height: 220, objectFit: "contain" }} />
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
