import { loadFont } from "@remotion/fonts";
import type { BrandKit } from "@shortfactory/contracts";
import { staticFile } from "remotion";

// フォントはリポジトリに同梱し、Playerと書き出しで同じファイルを使う（マスタープラン§6）。
// Zen Maru Gothic は SIL Open Font License（public/fonts/OFL.txt）。
const ZEN_MARU_GOTHIC = "Zen Maru Gothic";

loadFont({
  family: ZEN_MARU_GOTHIC,
  url: staticFile("fonts/ZenMaruGothic-Bold.ttf"),
  weight: "700",
  format: "truetype",
}).catch((err: unknown) => {
  console.error("フォントの読み込みに失敗", err);
});

export function fontFamilyFor(font: BrandKit["font"]): string {
  switch (font) {
    case "zen_maru_gothic":
      return `"${ZEN_MARU_GOTHIC}", sans-serif`;
  }
}
