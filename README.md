# Short Factory

ブランドとテーマから縦型ショート動画（1080×1920 / 30fps / H.264・AAC）を作る自社向け制作ツール。
計画と進め方は [docs/master-plan.md](docs/master-plan.md) を参照。

## 現在の状態：Phase 0a（品質検証）の骨組み

| パッケージ | 内容 |
| --- | --- |
| `packages/contracts` | `VideoPlan`・`BrandKit`のZodスキーマ、内容検証（禁止語・役割・字幕長・素材キー）、読み辞書、尺とフレームの計算、ギフトブランドのfixture |
| `packages/providers` | 外部APIなしでDirector/Voiceの入出力契約を確認するfixtureプロバイダー（実TTSは未接続） |
| `packages/assets` | asset keyをローカル素材ファイルからRemotion用data URLへ解決する実装 |
| `packages/storage` | CLI/ワーカー向けのローカル保存実装。キー検証、原子的保存、取得・削除、content typeメタデータ、ローカルURL |
| `packages/video` | Remotionの`yuru_anime_v1`テンプレート（仮素材で描画）、サンプル書き出しスクリプト |

実素材・実TTS・実Directorはまだ接続していない。素材がないキーは仮の図形で描き、尺は文字数からの見積もりを使う。fixtureプロバイダーで、テーマから検証済み`VideoPlan`を返す契約だけ確認できる。

`pipeline:fixture` は外部APIを使わず、fixtureのVoiceProviderから得た尺と決定的な無音WAVで計画を確定し、計画・音声メタデータ・WAVをローカルStorageへ保存してからMP4を書き出す。音声経路の検証用で、自然音声の品質評価には使わない。

安全域オーバーレイは既定でMP4に含めない。プレビュー確認用には`SHORTFACTORY_SHOW_SAFE_ZONE=1`を指定する。

VOICEVOX Engineを起動した環境では、`SHORTFACTORY_VOICE_PROVIDER=voicevox VOICEVOX_SPEAKER=3 pnpm --filter @shortfactory/video pipeline:fixture -- "春の手土産"` で実音声を取得できる。音声はローカルStorageにシーン単位のWAVとして保存し、RemotionのMP4にも組み込む。

`pipeline:fixture:batch` はPhase 0aの5本評価用に、テーマごとに別MP4・計画JSON・音声メタデータを生成する。固定fixtureの通過確認であり、自然音声や実素材の品質評価ではない。

ローカル素材を登録して描画する場合は、asset keyをキーにしたJSONマニフェストを用意し、`SHORTFACTORY_ASSET_MANIFEST=/path/assets.json SHORTFACTORY_ASSET_ROOT=/path/assets pnpm --filter @shortfactory/video pipeline:fixture -- "春の手土産"` を実行する。各値は `{ "path": "相対パス", "contentType": "image/png" }` 形式で、パスはAssetProviderのroot外へ出られない。素材が登録されると、生成記録の`assets`が`registered`になる。

生成時に使った台本・音声・素材の種類を `storage/<id>/run.json` に記録する。`evaluation:summary` は、台本・音声・素材がすべて実物の動画だけをPhase 0aの判定対象にし、fixtureや仮素材を含む場合は「判定対象外（配線の確認のみ）」と表示する。合格には、判定対象の5本で技術検証が全件合格し、人手評価で4本以上が `postable_with_minor_edits` であることが必要。

`evaluation:manifest` は再実行しても、記入済みの人手評価（`review`）を引き継ぐ。技術検証は解像度・30fps・H.264・AACの音声トラック・シーン音声・尺の誤差（150ms以内）を確認する。ffprobeはシステムにあればそれを使い、なければRemotion同梱のものを使うので、追加のインストールは不要。

実VOICEVOXで5本作る場合は、`SHORTFACTORY_OUTPUT_DIR=voicevox-batch SHORTFACTORY_VOICE_PROVIDER=voicevox VOICEVOX_SPEAKER=2 pnpm --filter @shortfactory/video pipeline:fixture:batch` を使う。評価コマンドにも同じ`SHORTFACTORY_OUTPUT_DIR=voicevox-batch`を指定する。

## Mac miniでの実行

前提：Node.js 22以上、pnpm 10以上（`corepack enable` で有効化できる）。

```bash
pnpm install
pnpm test            # 契約のテスト
pnpm typecheck       # 型検査
pnpm studio          # Remotion Studioでプレビュー（ブラウザが開く。SNSのUIに隠れる範囲を赤で表示）
pnpm render:sample   # packages/video/out/gift-sample.mp4 に書き出し
pnpm --filter @shortfactory/video pipeline:fixture -- "春の手土産"  # テーマ→保存→書き出し
pnpm --filter @shortfactory/video pipeline:fixture:batch              # 固定fixtureを5テーマ生成
pnpm --filter @shortfactory/video evaluation:manifest                 # 人手評価用マニフェストを作成
pnpm --filter @shortfactory/video evaluation:technical                # 音声・尺・MP4の機械検証
pnpm --filter @shortfactory/video evaluation:summary                  # Phase 0aの合格状態を集計
```

初回の書き出しでは、RemotionがChrome Headless Shellを自動でダウンロードする。
別のChromiumを使う場合は `REMOTION_BROWSER_EXECUTABLE` にパスを指定する。

## フォント

字幕フォントは Zen Maru Gothic Bold を `packages/video/public/fonts/` に同梱している（SIL Open Font License、同フォルダの`OFL.txt`）。
