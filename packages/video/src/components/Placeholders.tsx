import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * 素材が登録されていないキーを仮の図形で描く。
 * 素材の事前準備が終わったら assets にURLが入り、使われなくなる。
 */

export const PlaceholderBackground: React.FC<{ assetKey: string; base: string; accent: string }> = ({
  assetKey,
  base,
  accent,
}) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${base} 0%, ${base} 55%, ${accent}55 100%)`,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 260,
        left: 80,
        fontSize: 32,
        color: `${accent}`,
        fontFamily: "monospace",
        opacity: 0.8,
      }}
    >
      bg: {assetKey}
    </div>
  </AbsoluteFill>
);

const EXPRESSION_MOUTH: Record<string, string> = {
  smile: "M -40 30 Q 0 70 40 30",
  surprise: "M -18 40 a 18 22 0 1 0 36 0 a 18 22 0 1 0 -36 0",
  think: "M -30 45 L 30 38",
};

/** 仮キャラクター。約3秒ごとにまばたきする。 */
export const PlaceholderCharacter: React.FC<{
  characterKey: string;
  expressionKey?: string;
  color: string;
  ink: string;
}> = ({ characterKey, expressionKey, color, ink }) => {
  const frame = useCurrentFrame();
  const blinking = frame % 90 >= 84;
  const mouth = EXPRESSION_MOUTH[expressionKey ?? "smile"] ?? EXPRESSION_MOUTH.smile;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={460} height={520} viewBox="-230 -260 460 520">
        <ellipse cx={0} cy={40} rx={200} ry={220} fill={color} stroke={ink} strokeWidth={10} />
        {[-70, 70].map((x) =>
          blinking ? (
            <line key={x} x1={x - 22} y1={-10} x2={x + 22} y2={-10} stroke={ink} strokeWidth={10} strokeLinecap="round" />
          ) : (
            <ellipse key={x} cx={x} cy={-10} rx={16} ry={24} fill={ink} />
          ),
        )}
        <ellipse cx={-120} cy={50} rx={28} ry={16} fill="#ffffff" opacity={0.5} />
        <ellipse cx={120} cy={50} rx={28} ry={16} fill="#ffffff" opacity={0.5} />
        <path d={mouth} transform="translate(0 20)" fill="none" stroke={ink} strokeWidth={10} strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 28, color: ink, fontFamily: "monospace", opacity: 0.7 }}>
        {characterKey}
        {expressionKey ? `/${expressionKey}` : ""}
      </div>
    </div>
  );
};

export const PlaceholderObject: React.FC<{ assetKey: string; color: string; ink: string }> = ({
  assetKey,
  color,
  ink,
}) => (
  <div
    style={{
      width: 200,
      height: 200,
      borderRadius: 32,
      background: color,
      border: `8px solid ${ink}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 26,
      color: ink,
      fontFamily: "monospace",
    }}
  >
    {assetKey}
  </div>
);
