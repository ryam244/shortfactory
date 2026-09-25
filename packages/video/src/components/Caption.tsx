import { loadDefaultJapaneseParser } from "budoux";
import { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SAFE_ZONE, VIDEO_HEIGHT } from "../props";

const parser = loadDefaultJapaneseParser();

interface CaptionProps {
  text: string;
  color: string;
  background: string;
  accent: string;
}

/**
 * 字幕。BudouXで文節に分け、文節の途中では改行しない。
 * 位置はSNSのUIに隠れない範囲の下寄せ。
 */
export const Caption: React.FC<CaptionProps> = ({ text, color, background, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = useMemo(() => parser.parse(text), [text]);

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const translateY = interpolate(enter, [0, 1], [24, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_ZONE.left,
        right: SAFE_ZONE.right,
        bottom: SAFE_ZONE.bottom + 40,
        maxHeight: VIDEO_HEIGHT * 0.22,
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(31, 40, 35, 0.62)",
          color: "#FFF9EF",
          border: "1px solid rgba(255, 249, 239, 0.42)",
          borderRadius: 18,
          padding: "14px 28px",
          fontSize: 58,
          lineHeight: 1.3,
          textAlign: "center",
          textShadow: "0 3px 5px rgba(0, 0, 0, 0.32)",
          boxShadow: "0 5px 18px rgba(0, 0, 0, 0.16)",
        }}
      >
        {chunks.map((chunk, i) => (
          <span key={i} style={{ display: "inline-block" }}>
            {chunk}
          </span>
        ))}
      </div>
    </div>
  );
};
