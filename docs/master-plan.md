# Short Factory v0.1 開発マスタープラン（改訂版）

作成日：2026-09-24（初版） / 改訂：2026-09-24
文書状態：実装開始用の基準案
対象：自社向け縦型ショート動画制作ツールのMVP

### 初版からの主な変更点

| # | 変更 | 理由 |
| --- | --- | --- |
| 1 | Phase 0を「0a 品質検証（CLI）」と「0b 環境確定」に分割 | 最大のリスクは基盤ではなく動画品質。画面・DBより先に検証する |
| 2 | `VideoPlan`に`narrationReading`、ブランドに読み辞書を追加 | 日本語TTSの固有名詞・地名の読み間違い対策。後付けは影響範囲が大きい |
| 3 | 素材の事前準備を明記 | 素材ゼロではDirectorが選べるキーがない |
| 4 | 原価の予約方式をv0.2へ延期し、事前チェック方式に簡素化 | 同時実行1件・1本15〜60円規模では過剰 |
| 5 | 基盤をSupabaseからRailway（Postgres・Web・ワーカー）＋Cloudflare R2へ変更 | 単一利用者ではRLS・大規模認証が不要。無料枠1GB・7日停止・バックアップなしを回避 |
| 6 | 字幕改行（BudouX）、SNS UIの安全域、BGM方針、TTS候補の比較を追加 | 投稿品質に直結する抜けの補完 |

## 1. 目標と完成形

Short Factoryは、ブランドとテーマを指定すると、台本・シーン設計・素材・ナレーションを組み合わせ、縦型MP4を作る制作基盤である。最初の用途は自社SNSと自社アプリの集客。顧客向け制作とSaaS化は、制作品質を実測してから判断する。

**v0.1の主要な操作：** ログイン → ブランド登録 → テーマ入力 → 生成開始 → 台本とシーンの確認・修正 → プレビュー → MP4生成・ダウンロード。

**完成の定義：** 1ブランドにつき日本語の24〜35秒、1080×1920、30fps、H.264/AACの動画を生成できる。ジョブの失敗が画面から分かり、再試行できる。生成原価が記録され、上限に達したら追加の有料API呼び出しを止める。

### v0.1に含めるもの

| 領域 | 実装する範囲 |
| --- | --- |
| ブランド | 名前、テーマ、色・フォント、文体、禁止事項、CTA、音声設定、**読み辞書** |
| 制作 | テーマ入力、Directorによる構造化台本、シーン単位のテキスト・**読み**修正 |
| 素材 | 登録済み素材の選択、足りない素材だけ画像生成、利用権情報の保存 |
| 音声 | 日本語TTS、出力音声の尺を計測しシーン時間を調整 |
| 動画 | Yuru Animeテンプレート1種、固定BGM1曲（任意でオフ）、RemotionプレビューとMP4書き出し |
| 運用 | 生成ジョブの状態表示、再試行、基本的な原価記録、ダウンロード |

### v0.1の対象外

自動投稿、投稿予約、分析の自動取得、トレンド調査、Planner、Reviewer AIによる自動承認、AI動画生成、複数テンプレート、BGMの自動選曲、顧客課金、複数人での共同編集、原価の予約方式は実装しない。将来を想定したテーブルや抽象化を先に大量追加しない。

## 2. 最初の利用シナリオ

1. 「北海道旅行」「ギフト」「雑学」からブランドを登録し、淡い手描き風などのスタイル、CTA、読み辞書を指定する。
2. テーマ「冬の北海道旅行で注意すること3選」と狙う視聴者を入力する。
3. Directorが5〜8シーンの`VideoPlan`を返す。文字数・禁止事項・総尺を検証し、必要なら一度だけ修正する。読み辞書を`narrationReading`へ自動適用する。
4. 既存素材を優先して使用し、不足分だけ生成する。新規画像は標準設定で最大3枚。
5. TTSを生成して実測尺に合わせてシーンを確定する。内容や読みを修正した場合は該当シーンの音声だけ再生成する。
6. ブラウザで確認して字幕・台本・読みを直し、別ジョブとして書き出す。MP4は非公開の保存領域から短命URLでダウンロードする。

## 3. 技術構成と責任の境界

| レイヤー | v0.1の選択 | 担当すること |
| --- | --- | --- |
| Web | Next.js、TypeScript、Tailwind CSS（Railway上で実行） | 管理画面、認証済みAPI、ジョブ状態表示 |
| 認証 | 単一管理者のパスワードログイン（ハッシュ化した資格情報を環境変数に保持、HttpOnly署名Cookieのセッション） | v0.1は利用者1名。複数人化の際にAuth.js等へ置き換える |
| DB | PostgreSQL（Railway）、Drizzle ORM、Drizzleのマイグレーション | ユーザー、ブランド、動画、ジョブ、原価 |
| ファイル保存 | Cloudflare R2（非公開バケット、署名付き短命URL） | ブランド素材、音声、MP4 |
| 動画UI | Remotion Player | 同じ動画コンポーネントをブラウザで確認 |
| 動画実行 | 独立したNode.jsワーカー、Remotion renderer（Railway上、Chromium・FFmpeg入りコンテナ） | 外部API呼び出しと動画書き出し |
| 追加処理 | FFmpeg/ffprobe | 音声・完成動画の長さ、形式検査と必要な変換 |
| AI | Text / Image / Voiceのプロバイダーアダプター | Director、画像、TTS。鍵はサーバー側だけに置く |

Webのリクエストはジョブ作成後に返す。レンダリングは長時間・高負荷になり得るためワーカーで行う。ブラウザはDBとR2へ直接アクセスしない。すべてNext.jsのAPIを経由し、APIとワーカーが`workspace_id`による所有者確認を行う。

**構成：** ブラウザ → Next.js API → PostgreSQLの`generation_jobs` → ワーカー（`SELECT … FOR UPDATE SKIP LOCKED`で取得） → AI/素材 → Remotion → R2 → 認証済み画面。まずは単一ワーカー・同時実行1件。ジョブ状態は画面から2秒間隔で取得する（v0.1ではリアルタイム配信を使わない）。規模が増えたら専用キューへ移行する。

**移行性：** DBアクセスはDrizzle経由、ファイル操作は`StorageProvider`インターフェース（`put / get / delete / signedUrl`）経由に限定する。実装はR2用とローカルファイル用の2つを用意し、Phase 0aとCIはローカル実装で動かす。将来Supabase等へ移る場合もこの2か所の差し替えで済むようにする。

**バックアップ：** Postgresは日次で`pg_dump`を取りR2の別プレフィックスへ保存する（最低7世代）。R2上の素材原本は削除せず、古い版のMP4と中間音声のみ保持期限を設けて削除する。

### 推奨リポジトリ構成

```text
apps/web/                 Next.jsの画面とAPI
apps/worker/              ジョブ処理とレンダリング（Phase 0aではCLIとして実行）
packages/contracts/       Zodスキーマと共通型
packages/db/              Drizzleスキーマとマイグレーション
packages/storage/         StorageProvider（R2・ローカル）
packages/video/           RemotionのテンプレートとPlayer共通部品
packages/providers/       Text・Image・Voiceのアダプター
docs/                     仕様と運用手順
```

Node.jsと各ライブラリのバージョンはPhase 0bで実機動作を確認して固定する。採用したプロバイダー名、モデルID、単価、利用条件は設定に記録し、料金をこの文書の固定値として扱わない。

## 4. 主要なデータ契約

`VideoPlan`はモデルの自由文をそのままレンダラーに渡さず、スキーマ検証を通す。LLMは画像ファイルのURLを決めない。素材は`assetId`で後から解決する。

```json
{
  "schemaVersion": 1,
  "template": "yuru_anime_v1",
  "brandId": "uuid",
  "title": "冬の北海道旅行で注意すること3選",
  "fps": 30,
  "bgm": { "enabled": true, "assetKey": "bgm_calm_01", "volume": 0.15 },
  "scenes": [
    {
      "id": "scene-01",
      "role": "hook",
      "narration": "冬の倶知安、服装で困らないために。",
      "narrationReading": "ふゆのくっちゃん、ふくそうでこまらないために。",
      "caption": "冬の北海道旅行・注意3選",
      "visual": {
        "characterKey": "girl_01",
        "expressionKey": "smile",
        "backgroundKey": "snow_city",
        "objectKeys": ["suitcase"]
      },
      "motion": "slow_zoom",
      "needsFactCheck": false,
      "minDurationMs": 2500,
      "maxDurationMs": 5000
    }
  ],
  "cta": "旅行前に保存してね"
}
```

このJSONは形を示す短縮例。実際は5〜8シーンを要求し、`hook`・本文・`cta`を含める。

- `narration`は表示・台本用、`narrationReading`はTTS用。`narrationReading`が省略された場合は、`narration`にブランドの読み辞書を適用した文をTTSに渡す。
- TTSの再利用判定は「実際にTTSへ渡した文字列＋音声設定＋プロバイダー・モデル」のハッシュで行う。
- `motion`は許可リストから選ぶ。テーマや字幕にブランドの禁止語が含まれる場合は停止する。
- 総尺24〜35秒、空字幕なし、文字数と必要な素材数の上限を検証する。
- 各シーンの表示秒数はTTS生成後の実測値と余白から決め、合計が許容範囲から外れたら編集を促す。フレーム換算は最後に一度行い、合計フレーム数を一致させる。
- 事実確認が必要な主張を含むシーンは`needsFactCheck: true`とし、画面で目立たせる。

### DBの最小構成

| テーブル | 主な列 | 要点 |
| --- | --- | --- |
| `users` | `id`, `email`, `created_at` | v0.1は管理者1名 |
| `workspaces` | `id`, `owner_user_id`, `name` | v0.1は所有者1名。後からメンバー追加可能 |
| `brands` | `id`, `workspace_id`, `name`, `kit_json`, `reading_dict_json`, `created_at` | `kit_json`と読み辞書をスキーマ検証する |
| `videos` | `id`, `workspace_id`, `brand_id`, `topic`, `status`, `plan_json`, `version`, `created_at` | 編集時に`version`を増やし、古いジョブ結果の上書きを防ぐ |
| `assets` | `id`, `workspace_id`, `brand_id`, `key`, `kind`, `storage_key`, `parent_asset_id`, `rights_note`, `source`, `created_at` | 画像・BGMの利用範囲と出所を記録。原画と派生を関連付ける |
| `generation_jobs` | `id`, `video_id`, `video_version`, `type`, `status`, `step`, `attempts`, `lease_until`, `error_code`, `created_at` | `queued/running/succeeded/failed/cancelled`。再試行と回収に使用 |
| `generation_costs` | `id`, `job_id`, `provider`, `model`, `unit`, `quantity`, `estimated_jpy`, `actual_jpy`, `created_at` | 見積と確定額を区別 |
| `video_outputs` | `id`, `video_id`, `video_version`, `storage_key`, `duration_ms`, `width`, `height`, `created_at` | 完成MP4と検査値 |

APIとワーカーは`workspace_id`で必ず所有者を検証する（RLSは使わない）。R2はブランド素材・音声・MP4ごとに非公開のキーへ保存し、ブラウザには署名付き短命URLのみ渡す。API鍵・DB接続情報・R2の資格情報はブラウザに渡さない。DB制約（外部キー、一意制約、CHECK）を設定し、ワーカー側もジョブ・動画・ブランドの所属関係を再確認する。

### v0.1 API

| 操作 | 入出力 |
| --- | --- |
| `POST /api/auth/login` / `POST /api/auth/logout` | 管理者ログイン・ログアウト。試行回数を制限 |
| `POST /api/brands` | ブランド設定を検証・保存 |
| `GET /api/brands` | 自分のブランド一覧 |
| `POST /api/videos` | ブランドID・テーマから動画レコード作成 |
| `POST /api/videos/:id/generate-plan` | Directorジョブを作成し`jobId`を返す |
| `PATCH /api/videos/:id/plan` | 検証済みの台本修正。`version`を照合 |
| `POST /api/videos/:id/render` | 対象バージョンの生成ジョブを作成 |
| `GET /api/jobs/:id` | 状態、段階、失敗理由、使用量を返す |
| `GET /api/videos/:id` | 計画、素材、完成動画情報を返す |
| `GET /api/videos/:id/download` | 所有者確認後に短命のダウンロードURLを返す |
| `GET /api/assets/:id/url` | プレビュー用の短命URLを返す |

更新系は認証、入力制限、重複リクエスト防止を行う。同一の`video_id + version + job type`の実行中ジョブを二重登録しない（部分一意インデックスで保証する）。

## 5. ワーカーの処理仕様

1. DBのジョブを`FOR UPDATE SKIP LOCKED`で排他的に取得し、`lease_until`と`attempts`を更新する。異常終了したジョブはリース期限後に回収する。
2. `generate-plan`：ブランド設定と入力テーマを渡し、JSONを受け取り、スキーマ・尺・表現を検証する。検証失敗は1回だけ自動修正を試み、以降は理由を表示する。読み辞書を適用する。
3. `render`：対象の`video_version`を固定。素材を検索し、権利情報を確認。足りない画像を予算内で生成して保存する。
4. 各シーンのTTSを作成し実測尺を記録する。同一入力の成果物があれば再利用する。
5. Remotionで出力し、ffprobeで形式・縦横・尺・音声トラックを検査してからR2へ保存する。
6. 使用量と費用を記録しジョブを完了する。失敗時は`step`、安全なエラーコード、再試行可否を残す。

外部APIへの同一処理の重複課金を減らすため、呼び出し前後に生成物のキーを記録する。再試行は全工程を繰り返さず、正常な中間成果物を使う。鍵やプロンプト中の個人情報をログに出さない。

## 6. AIと素材の設計

### Provider契約

```ts
interface TextProvider {
  generatePlan(input: DirectorInput): Promise<VideoPlan>;
}
interface ImageProvider {
  generateImage(input: ImageRequest): Promise<GeneratedAsset>;
}
interface VoiceProvider {
  synthesize(input: VoiceRequest): Promise<GeneratedAudio>;
}
interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresInSec: number): Promise<string>;
}
```

各インターフェースに本番用1実装と、APIを使わず同じ手順を再現できるfixture/mockを用意する。Text・Imageの採用先はPhase 0bで料金・日本語品質・API利用条件を比較して1社ずつ確定する。動画AIのアダプターは実装しない。

**TTSの選定：** ElevenLabs、Gemini TTS、VOICEVOXをPhase 0aで比較する。評価項目は、固有名詞・地名・数字の読みの正確さ、`narrationReading`（かな入力）を与えたときの自然さ、シーン単位で合成したときのつながり、費用、商用利用条件（VOICEVOXはキャラクターごとの規約とクレジット表記）。あわせて「シーン単位で合成」と「全文を合成してタイムスタンプで分割」のどちらにするかを聞き比べて決める。

**Directorの入力：** ブランド設定、テーマ、視聴者、想定尺、使える素材キー、字幕文字数、禁止事項、CTA、読み辞書。**出力：** 検証可能な`VideoPlan`のみ。旅行・商品・医療など事実確認が必要な主張には`needsFactCheck`を付け、v0.1では人が公開前に確認する。

### 素材の事前準備（Phase 0aの前提作業）

Phase 0aの前に、対象ブランドごとに以下を用意し、制作ツール・作成者・利用権を`assets`に記録する。

- 基本キャラクター1体 × 表情3〜5種（通常、笑顔、驚き、困り顔など）
- 汎用背景5〜10枚（題材に合わせる）
- 小物5〜10点（任意）
- BGM 1曲（商用利用可能なもの。利用条件を記録）

キャラクター、背景、小物は別素材として登録し、原画と派生を`parent_asset_id`で関連付ける。同じキャラを場面ごとに新規生成しない。画像生成時はブランドのスタイル規則と参照素材を渡す。生成画像の再利用権と商用利用条件は採用先ごとに記録する。

### アニメーションと字幕

- パン、ゆっくりズーム、スライド、軽いバウンス、まばたきなどをテンプレートで制御する。口パクは音量連動の簡易表現に限定し、未対応のキャラでは無効にする。
- 字幕の改行位置はBudouXで決め、単語の途中で改行しない。
- 字幕と重要な要素は、TikTok・Instagramリール・YouTubeショートのUIに隠れる範囲（画面の下部と右端）を避けて配置する。テンプレートに安全域を定義する。
- 日本語フォントはファイルとしてリポジトリに同梱し、PlayerとワーカーでMP4を書き出す際に同じファイルを読み込む。
- BGMはナレーション中に自動で音量を下げる。

## 7. 原価の上限

ブランド別に「1本の上限」「月間上限」「画像生成枚数」を設定する。初期値の案はSTANDARD：画像最大3枚、動画AI 0秒、月間上限は管理者が入力。円換算は設定した為替レートと見積単価に基づく参考値とし、利用量と提供元の請求額を後から照合する。

**v0.1の方式（事前チェック）：** 有料呼び出しの直前に「今月の確定額＋実行中ジョブの見積額＋今回の見積額」を計算し、上限を超える場合は呼び出さずに理由を画面に表示する。同時実行は1件のため競合は起きない。単価不明、または上限未設定のときも有料呼び出しを止める。

**二重の安全策：** 各プロバイダーの管理画面で月間の利用上限・通知を設定する。

**v0.2以降：** 複数ワーカーや複数利用者に対応するときに、DBトランザクション内での予約方式へ移行する。ダッシュボードでは「見積」と「確定」を分けて表示する。

## 8. 画面構成とUX方針

| 画面 | 主な操作 |
| --- | --- |
| ログイン | 管理者のパスワードでログイン |
| ホーム | サムネイル付きの動画一覧、状態の表示、ブランドでの絞り込み、「続きから」、失敗ジョブの確認 |
| ブランド設定 | 名前、色、文体、CTA、音声、禁止事項、読み辞書、予算を編集。字幕の見た目を見本の画面で確認できる |
| 新規動画 | ブランド、テーマ、視聴者、補足情報を入力 |
| 制作詳細 | 台本、シーン、素材、プレビュー、費用、MP4出力 |

### 制作詳細画面

- **3列構成：** 左にシーン一覧（尺に比例した幅の帯つき）、中央に9:16のプレビュー、右に選んだシーンの編集欄。スマホ幅ではタブで切り替える。
- **左右の連動：** シーンをクリックするとプレビューがその位置に飛び、再生中は今のシーンを自動で強調する。
- **編集：** 自動保存。ナレーションや読みを直したシーンには「音声が古い」印を付け、そのシーンだけ作り直せる。`needsFactCheck`のシーンは目立つ表示にする。
- **費用：** 有料の操作ボタンに見積額（例：約¥5）を添える。
- **進み具合：** 「台本 → 素材 → 音声 → 書き出し」の段階表示。画面を離れても処理は続き、完了時に通知する。
- **失敗時：** 分かる言葉で理由を出し、「再試行」と「台本を直す」を置く。
- **版：** 編集済みバージョンでは古いMP4を「旧版」と表示する。
- **表示補助：** 各SNSのUIに隠れる範囲を重ねて表示する切り替え。
- **キーボード：** スペースで再生、↑↓でシーン移動。

## 9. 実装順序と各ゲート

| Phase | 実装内容 | 完了条件 |
| --- | --- | --- |
| 前提 | 素材の事前準備（§6） | 1ブランド分のキャラ・表情・背景・BGMが登録用に揃い、利用権が記録されている |
| 0a. 品質検証 | 画面・DB・認証なしのCLIで、テーマ → Director → TTS → Remotion → MP4 を実行。`packages/contracts`・`video`・`providers`・`storage`（ローカル実装）を作る。TTS 3社の比較 | 1ブランド5本を生成し、4本以上が「軽微な修正で投稿可能」。キャラの一貫性、TTSの読み、字幕の同期を人が判定する。TTSの採用先と合成方式を決定 |
| 0b. 環境確定 | Railway（Postgres・Web・ワーカー）とR2の用意、Chromium・FFmpeg入りのワーカーコンテナ、Text・Imageの採用先と単価・規約の記録 | ワーカーコンテナで0aと同じMP4がRailway上で書き出せる。採用先・概算単価・規約を記録 |
| 1. 基盤 | monorepo、CI、ログイン、Drizzleのマイグレーション、所有者確認、ブランド画面、R2の`StorageProvider`、日次バックアップ | 未ログインでAPIにアクセスできない。ブランドの作成・更新ができる。バックアップから復元できる |
| 2. 台本 | Director、スキーマ検証、plan API、編集画面、読み辞書、fixture | テーマから5〜8シーンの修正可能な計画が保存される |
| 3. 素材・音声 | 素材登録、検索、画像生成、TTS、尺計算、原価の事前チェック | 不足素材のみ作成し、字幕・音声・計画尺を整合させる。上限超過で有料呼び出しが止まる |
| 4. 動画 | Player、ワーカーのジョブ処理とレンダリング、MP4検査 | ブラウザのプレビューと完成MP4の内容が一致する |
| 5. 運用 | ジョブ回復、部分的な再生成、ダウンロード、計測、保持期限による削除、手順書 | 失敗から復旧し、連続30本の評価に進める |

各Phaseは小さなPRに分け、型検査・lint・必要な自動テスト・手動の動作確認後にマージする。DB変更と画面変更は同じPRで互換性を確認する。Phase 0a・0b以外は鍵なしfixtureとローカルの`StorageProvider`でCIを通す。

### AIコーディングツールへの作業単位

各依頼には「対象Phase、触る範囲、参照する契約、受け入れ条件、確認コマンド、触れてはいけない既存動作」を明記する。例：「Phase 2の`VideoPlan`スキーマとDirector APIだけ実装。fixtureで有効・無効JSONを検証し、DBマイグレーションや動画出力は変更しない」。実装AIはClaude CodeまたはCodexのどちらでもよい。成果をPRで確認し、次Phaseへ進む。

## 10. 必要な検証と品質判定

**自動検証：** `VideoPlan`の境界値、読み辞書の適用、所有者確認、重複ジョブと再試行、原価の上限判定、バージョン更新時の古い結果、生成したMP4の縦横・尺・音声の有無。レンダラーは固定fixtureを使い、毎回有料APIを呼ばない。

**実地評価：** 北海道旅行10本、ギフト10本、雑学10本を生成し、動画ごとに冒頭、情報の正確さ、キャラの一貫性、字幕の読みやすさ、**読み間違いの件数**、音声同期、CTA、公開前修正時間を記録する。「軽微な修正で投稿可能」が24/30本以上を合格目安とする。判断基準の例：字幕・表現・読みの修正は軽微、事実の全面修正・素材の大幅な作り直しは不合格。

30本の評価には実際の有料生成費が発生するため、開始時に見積と予算上限を設定する。数値目標は品質の仮説であり、達成しない場合は不合格理由の頻度に基づきテンプレート・プロンプト・素材を改善する。

## 11. 開発開始前に決める項目とコストの目安

| 項目 | 現時点の推奨初期値・決め方 |
| --- | --- |
| 最初の題材 | ギフトまたは北海道旅行から1ブランドを選ぶ |
| 画像スタイル・素材 | 既存の縦型ゆるアニメ素材を参照候補とし、§6の事前準備で制作ツールと担当者を決める |
| Text / Image API | Phase 0bで現行料金・商用利用条件・品質を確認して決定 |
| Voice API | Phase 0aでElevenLabs / Gemini TTS / VOICEVOXを比較して決定 |
| 1本・月間予算 | 実際の見積を見て利用者が設定。上限未設定なら有料生成を開始しない |
| 配置先 | Railway（Postgres・Web・ワーカー）＋Cloudflare R2で確定。Vercelの無料プランは商用利用が禁止のため使わない |
| BGM | 商用利用可能な1曲を固定で使う。動画ごとにオフにできる |
| ファイル保持 | 素材原本は保持。古い版のMP4と中間音声は保持期限（例：30日）後に削除 |

### コストの目安（2026-09-24時点の調査、1ドル=150円換算）

料金は変わるため、採用時に必ず公式の最新値を設定へ記録する。

**1本あたりのAPI原価：約15〜60円**

| 処理 | 1本あたり |
| --- | --- |
| 台本（Director） | 約2〜8円 |
| 画像（0〜3枚） | 0〜30円 |
| 音声 | 約1〜9円 |

**月額（月60本の場合）：約5,000〜8,000円**

| 項目 | 月額 |
| --- | --- |
| Railway Hobby | 月5ドル（使用量5ドル分込み）。Postgres・Web・ワーカーの使用量次第で合計約10〜20ドル |
| Cloudflare R2 | 10GBまで無料、ダウンロードの転送料無料 |
| TTSの月額プラン | 0〜22ドル（採用先による） |
| API原価 | 約1,000〜3,600円 |

**Remotion：** 3人以下の会社は無料で商用利用できる。4人以上になるか、顧客向けにサーバーで書き出す段階では会社向けライセンスが必要（書き出し用途は最低月100ドル）。事業化判断の材料に含める。

## 12. 後続フェーズ

- **v0.2：** 共通Asset Library、Brand Kitの拡充、シーン画像や音声の部分再生成、バッチ生成、人によるレビュー、原価の予約方式。
- **v0.3：** 投稿カレンダーと、各SNSで許される範囲の投稿連携。APIの権限・審査・制約を接続時に調査。
- **v0.4：** 分析取得、Planner、投稿結果のフィードバック。指標の取得可否は各プラットフォームに合わせる。
- **複数人化・事業化判断：** 自社運用の制作時間、原価、公開品質、集客成果が見えたら、認証（Auth.js等またはSupabase Auth）、権限、顧客向け制作機能を設計する。

## 参考：技術選定に用いた公式資料

- [Remotion：サーバー側レンダリング](https://www.remotion.dev/docs/renderer)
- [Remotion：プログラムからの書き出し](https://www.remotion.dev/docs/renderer/render-media)
- [Remotion：Reactアプリ内でのプレビュー](https://www.remotion.dev/docs/player/)
- [Remotion：ライセンス](https://www.remotion.pro/license)
- [Next.js：Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Railway：料金](https://railway.com/pricing)
- [Cloudflare R2：料金](https://developers.cloudflare.com/r2/pricing/)
- [BudouX](https://github.com/google/budoux)
- [Vercel：Hobbyプランの商用利用制限](https://vercel.com/docs/limits/fair-use-guidelines)
