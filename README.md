# Short Factory

ブランドとテーマから縦型ショート動画（1080×1920 / 30fps / H.264・AAC）を作る自社向け制作ツール。
計画と進め方は [docs/master-plan.md](docs/master-plan.md) を参照。

## 現在の状態：Phase 0a（品質検証）の骨組み

| パッケージ | 内容 |
| --- | --- |
| `packages/contracts` | `VideoPlan`・`BrandKit`のZodスキーマ、内容検証（禁止語・役割・字幕長・素材キー）、読み辞書、尺とフレームの計算、ギフトブランドのfixture |
| `packages/video` | Remotionの`yuru_anime_v1`テンプレート（仮素材で描画）、サンプル書き出しスクリプト |

素材・TTS・Directorはまだ接続していない。素材がないキーは仮の図形で描き、尺は文字数からの見積もりを使う。

## Mac miniでの実行

前提：Node.js 22以上、pnpm 10以上（`corepack enable` で有効化できる）。

```bash
pnpm install
pnpm test            # 契約のテスト
pnpm typecheck       # 型検査
pnpm studio          # Remotion Studioでプレビュー（ブラウザが開く。SNSのUIに隠れる範囲を赤で表示）
pnpm render:sample   # packages/video/out/gift-sample.mp4 に書き出し
```

初回の書き出しでは、RemotionがChrome Headless Shellを自動でダウンロードする。
別のChromiumを使う場合は `REMOTION_BROWSER_EXECUTABLE` にパスを指定する。

## フォント

字幕フォントは Zen Maru Gothic Bold を `packages/video/public/fonts/` に同梱している（SIL Open Font License、同フォルダの`OFL.txt`）。
