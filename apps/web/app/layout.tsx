import type { Metadata } from "next";

export const metadata: Metadata = { title: "Short Factory", description: "縦型ショート動画制作ツール" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body style={{ fontFamily: "system-ui, sans-serif", margin: 24, maxWidth: 900 }}>{children}</body></html>;
}
