# ショート動画の制作ベース

調査・制作日：2026-09-25。目的は生成の成功から、人が見続けられる一本への移行。

## 参照した公開情報

- [YouTube公式：Shorts deep dive（2025-01-28）](https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/)：冒頭1秒の引き込み、短い物語という制作者の考え方。成功を保証する公式アルゴリズム仕様ではない。
- [YouTube公式：編集機能の更新（2025-04-03）](https://blog.youtube/news-and-events/new-creation-tools-youtube-shorts-2025/)：クリップと文字のタイミングを細かく調整する制作環境。
- [そろ谷のアニメっち・公開動画一覧](https://digitalcreators.jp/channel/ja/UCLqv4vhAFj140bSh4W3EDDA/popular-videos/)：2026-04-07の17秒作、2026-05-01の33秒作など。短い状況設定と意外性がタイトルでわかる事例。第三者集計値を因果や品質の証明にはしない。
- [マリマリマリー・公開動画一覧](https://digitalcreators.jp/channel/UCOnA15zQ7OafLsnN8J-CMvg/videos/)：2026年7月の21秒・38秒の公開作など。状況を一文で想像できる見出しの参考。

調査範囲は記事・公開メタデータ。上記の個別動画を通しで視聴した秒単位の演出分析は未実施。以下は資料からの示唆と今回独自に設計した仮説。キャラクター、台詞、画風のコピーはしない。

## 今回採用する基本形

| 時間の目安 | 視聴者の気持ち | 映像・台詞の役割 |
| --- | --- | --- |
| 0〜3.5秒 | 自分にもある | 「高いほうなら、安心？」。迷った顔とギフトを最初から示す |
| 3.5〜7秒 | そう、決まらない | 選択肢が増えて困る。説明を足すより具体的な悩みを示す |
| 7〜11.5秒 | あ、それでいいのか | 「クッキーが好きって言ってた」。驚きの顔へ切り替える |
| 11.5〜19秒 | できそう | 好きを覚えていた、カードに一言。行動は一つだけ |
| 19〜24秒 | 少し気が楽 | 値段より相手を思い出した気持ち、という小さな着地 |
| 24〜28.5秒 | 次も使えそう | 次に迷った日に思い出して、と一つだけ促す |

「日持ち・個包装・カード」の説明を並べる従来のfixtureとは別に、今回の一本は共感→迷い→気づき→行動→安心の流れを試す。価格の高低や贈り物の正解を断定しない。

## 素材と編集のルール

- オリジナルSVG：同一キャラの考え顔・笑顔・驚き顔、背景3点、小物3点、基本キャラの計10点。背景は全面、キャラと小物は透過・専用viewBoxで配置する。実素材候補の写実寄り背景は人物と画風が合わなかったため、採用版ではこの統一ベクター背景を使う。
- キャラは表情で意味を変える。小物は台詞に関係があるものだけ出す。呼吸程度の上下動を加える。
- カメラ進行率は動画全体の尺でなく各シーンの尺で計算する。
- 字幕は1場面1メッセージ、最大16文字。スマホ表示サイズで読めるか確認し、1文字だけの折り返しを避ける。
- 字幕は白い大きなカードにせず、半透明の暗色帯＋明るい文字＋控えめな影で映像に馴染ませる。背景と人物の顔を隠さない。
- 音声はVOICEVOX:ずんだもん、全7場面を実合成。無音のfixtureを完成音声と扱わない。公開時のクレジット文：`VOICEVOX:ずんだもん`。
- 実素材サンプルではSuno生成BGMを音量0.07で使用。声の明瞭さを優先し、公開前にSunoのプラン・利用規約・商用利用条件を確認する。

## 再現方法

DBとVOICEVOX、render Workerを起動して、リポジトリ直下で実行する。

```sh
pnpm --filter @shortfactory/video exec tsx scripts/create-editorial-sample.ts
```

Midjourney背景とSuno WAVを使う実素材版は、次のように入力ファイルを指定する。

```sh
SHORTFACTORY_MJ_BACKGROUND=/path/to/background.png \
SHORTFACTORY_BGM_FILE="/path/to/Cozy Gift Shop.wav" \
pnpm --filter @shortfactory/video exec tsx scripts/create-editorial-sample.ts
```

背景側に人物を合わせる比較版では、透過PNGの人物3ポーズも指定する。Midjourney背景は全場面へ適用される。

```sh
SHORTFACTORY_MJ_BACKGROUND=/path/to/background.png \
SHORTFACTORY_PAINTED_CHARACTER_THINK=/path/to/character-think.png \
SHORTFACTORY_PAINTED_CHARACTER_SMILE=/path/to/character-smile.png \
SHORTFACTORY_PAINTED_CHARACTER_SURPRISE=/path/to/character-surprise.png \
SHORTFACTORY_BGM_FILE="/path/to/Cozy Gift Shop.wav" \
pnpm --filter @shortfactory/video exec tsx scripts/create-editorial-sample.ts
```

完成シーン画像を使う設定駆動テストは、設定JSONと画像・音声素材を指定して再現できる。

```sh
SHORTFACTORY_BATCH_SCENE=/path/to/full-scene.png \
SHORTFACTORY_BATCH_SCENE_DIR=/path/to/scenes \
SHORTFACTORY_BATCH_AUDIO_DIR=/path/to/audio \
SHORTFACTORY_BATCH_BGM=/path/to/bgm.wav \
pnpm --filter @shortfactory/video batch:settings
```

この入口は人物と背景の自然な一体感を優先し、Remotionで字幕・ナレーション・BGMを後合成する。`SHORTFACTORY_BATCH_SCENE_DIR` に `scene-01.png` のような画像があれば場面ごとに切り替え、未指定の場面は `SHORTFACTORY_BATCH_SCENE` を使う。

`DATABASE_URL`が必須。`SHORTFACTORY_ADMIN_EMAIL`（既定local-admin@example.com）、`VOICEVOX_URL`、`SHORTFACTORY_STORAGE_ROOT`で環境を指定できる。実行ごとに別ブランド・動画を作成するため、以前の素材・動画は上書きしない。完成後、Webを再読み込みすると最新動画を復元し、完成MP4を直接再生する。

## 品質判定と残り

技術検証：1080×1920 / 30fps / H.264 / AAC音声 / 24〜35秒 / ナレーション切れなし。画風調整後の統一ベクター版と、背景合わせ比較版はいずれも28.33秒で全項目に合格。書き出しフレームで表情、字幕、配置を確認する。

## 視聴しやすさの基本基準

- 1画面の主役は人物1人。人物の頭・表情が小物や字幕に重ならないことを優先する。
- 背景は情報量を下げ、彩度と明るさを少し落として、人物の輪郭と字幕を先に見せる。
- 人物は縦動画の中央〜下寄りで画面高の約40%以上を目安にする。小さすぎる全身配置は避ける。
- 小物は上段に小さく固定し、人物の顔から十分な間隔を空ける。1場面の小物は台詞に必要なものだけにする。
- 字幕は下部のSNS安全域内に固定し、1画面1メッセージ、2行以内、60px前後から実機で確認する。
- 最後は「背景→人物→字幕」の順に視線が流れるかを、音なし・小さい画面でも確認する。

人手評価：最初の2秒で悩みが伝わるか、最後まで見たいか、声が自然か、共感か押し付けか、保存したいかを未説明の視聴者に聞く。公開後は冒頭離脱・平均視聴時間・完視聴・保存を別々に測る。今回は人手評価・公開実績・需要検証は未完了。

この台本は手作業で設計した一本。通常の「動画を作成して台本生成」はまだfixture Directorであり、任意テーマを同品質に自動変換する実装は別途必要。次は冒頭を変えた比較版と実視聴のフィードバックで基準を調整する。
