import type { BrandKit, Scene } from "@shortfactory/contracts";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SAFE_ZONE, VIDEO_WIDTH } from "../props";

interface KineticTextSceneProps {
  scene: Scene;
  brand: BrandKit;
}

/**
 * キャラクターなしの訴求パターン。
 * 暗転を使わず、背景色・短い文字列・アクセント形状の動きだけで視線を誘導する。
 */
export const KineticTextScene: React.FC<KineticTextSceneProps> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 170, mass: 0.7 } });
  const chunks = scene.caption.split(/(?<=[、。！？])|\s+/).filter(Boolean);
  const roleColor = scene.role === "hook" ? brand.colors.primary : scene.role === "cta" ? brand.colors.accent : brand.colors.text;
  const accentX = interpolate(enter, [0, 1], [-VIDEO_WIDTH * 0.45, VIDEO_WIDTH * 0.1]);
  const tilt = scene.role === "hook" ? -6 : scene.role === "cta" ? 4 : 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(145deg, ${brand.colors.background} 0%, #FFFDF8 58%, ${brand.colors.accent}22 100%)`,
        color: brand.colors.text,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: SAFE_ZONE.top - 30, left: accentX, width: 720, height: 34, borderRadius: 99, background: roleColor, transform: "rotate(-12deg)", opacity: 0.9 }} />
      <div style={{ position: "absolute", right: -120, top: 340, width: 420, height: 420, borderRadius: "50%", border: `34px solid ${brand.colors.primary}66`, transform: `rotate(${tilt}deg) scale(${interpolate(enter, [0, 1], [0.7, 1])})` }} />
      <div style={{ position: "absolute", left: SAFE_ZONE.left, right: SAFE_ZONE.right, top: SAFE_ZONE.top + 100, bottom: SAFE_ZONE.bottom + 100, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "0.16em", color: roleColor, opacity: 0.92, transform: `translateX(${interpolate(enter, [0, 1], [-50, 0])}px)` }}>
          {scene.role === "hook" ? "まず、ここだけ" : scene.role === "cta" ? "あとで見返す" : "覚えておくこと"}
        </div>
        <div style={{ fontSize: 78, lineHeight: 1.22, fontWeight: 800, letterSpacing: "0.02em", textShadow: "0 3px 0 rgba(255,255,255,0.72)" }}>
          {chunks.map((chunk, index) => {
            const chunkEnter = spring({ frame: frame - index * 4, fps, config: { damping: 14, stiffness: 190 } });
            return <span key={`${chunk}-${index}`} style={{ display: "inline-block", marginRight: 12, opacity: chunkEnter, transform: `translateY(${interpolate(chunkEnter, [0, 1], [28, 0])}px)`, color: index === 0 && scene.role === "hook" ? roleColor : brand.colors.text }}>{chunk}</span>;
          })}
        </div>
        <div style={{ width: 180, height: 12, borderRadius: 99, background: roleColor, transform: `scaleX(${enter})`, transformOrigin: "left" }} />
      </div>
      <div style={{ position: "absolute", left: SAFE_ZONE.left, bottom: SAFE_ZONE.bottom - 80, fontSize: 28, letterSpacing: "0.08em", color: brand.colors.text, opacity: 0.68 }}>SHORT NOTE / {String(scene.id).toUpperCase()}</div>
    </AbsoluteFill>
  );
};
