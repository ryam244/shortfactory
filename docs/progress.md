# Short Factory 進行表

最終更新：2026-09-24 20:29 JST
基準文書：[master-plan.md](./master-plan.md)

## 現在地

**Phase 3の素材アップロード基盤まで進行。Phase 0aの品質判定、Phase 0bのWeb/Worker統合、Phase 3の音声UI・原価制御は未完了。**

JSON台本・登録素材・VOICEVOX音声を組み合わせて、ローカルPC上で1080×1920のMP4を1コマンド生成できる。現在のテストデータは動作確認用であり、実ブランドの品質合格とは扱わない。

## フェーズ別進行

| フェーズ | 状態 | 完了した範囲 | 残りの完了条件／次の作業 |
| --- | --- | --- | --- |
| 前提：素材準備 | 未完了 | asset key、ローカル素材マニフェストの契約 | 実ブランドのキャラ・表情・背景・小物・BGMと利用権情報を揃える |
| 0a：品質検証 | 配線完了・品質判定待ち | `VideoPlan`、fixture、JSON台本、VOICEVOX、Storage、Remotion、技術検証 | 実台本＋実素材で5本生成し、人手評価4/5以上。TTS候補と合成方式を決定 |
| 0b：環境確定 | 未着手 | VOICEVOX単体Docker運用を確認 | Postgres・VOICEVOX・WorkerのCompose化、Text API・単価・規約の記録 |
| 1：基盤 | 一部完了 | Next.jsのログイン画面、DBユーザー認証、署名セッション、未ログイン拒否、Workspace作成、所有者確認付きブランド一覧・登録API、ブランド設定画面、冪等な初期ユーザー／Workspace seed | CI、日次バックアップ、初回ユーザー作成の実機確認 |
| 2：台本 | 一部完了 | `VideoPlan`、JSON台本Provider、読み辞書・検証、動画作成API、fixture Directorによる台本生成・保存API、version照合付き台本編集API、最小台本編集画面 | 外部Director接続、UIの実機操作確認、ジョブ化 |
| 3：素材・音声 | 一部完了 | `StorageProvider`、`AssetProvider`、VOICEVOX、尺計算、素材メタデータ登録・一覧API、ローカルStorageへのファイルアップロード・所有者付き配信API、アップロードMIMEタイプ保存・配信、素材検索・種類フィルター・権利情報表示UI、画像生成Provider前のブランド別上限ガード、生成ジョブ・見積原価の記録と動画単位集計、VOICEVOX試聴API・台本画面接続、シーン単位の部分再生成API・UI、TTS音声のStorage永続保存と素材登録 | Provider別単価・実費確定 |
| 4：動画 | 一部完了 | Remotionテンプレート、MP4、ffprobe技術検証、安全域、Web Studio内Remotion Playerプレビュー、所有者確認付きrenderジョブ登録・状態API、ローカルrender Workerの1件処理・MP4 Storage保存・`video_outputs`登録 | Worker常駐化・再試行、WebからのMP4ダウンロード、プレビューとMP4の一致確認 |
| 5：運用 | 未着手 | なし | 再試行、失敗回復、ダウンロード、保持期限、30本評価 |
| 6：クラウド | 保留 | なし | 30本評価合格後に必要性を判断 |

## 検証済みの事実

- `pnpm test`：全ワークスペースのテストが成功（contracts 11件、providers 6件、storage 3件、assets 3件、auth 4件、db 3件、web 2件）
- `pnpm typecheck`：全パッケージ成功
- VOICEVOX実音声5本の技術検証：5/5
- ローカルテストランナー：JSON台本＋登録SVG素材＋VOICEVOX＋Remotion MP4を成功
- `pipeline:test`の生成物は`text/voice/assets: test`として記録し、Phase 0aの品質判定から自動除外
- 素材マニフェストに`source`と`rightsNote`を必須化し、利用権情報なしの素材を拒否
- テスト動画を目視確認し、登録素材が透明背景のキャラ・小物として描画され、字幕が表示されることを確認
- `VideoPlan.bgm`の有効時にBGM素材を解決し、未登録なら書き出し前に停止する経路を追加
- `pipeline:test`で検証用BGMを登録し、BGM込みのMP4（H.264/AAC）を書き出せることを確認
- `evaluation:review`で、動画ごとの人手評価・読み間違い・修正時間をCLIから保存できるようにした
- Phase 0bの入口として、VOICEVOXとPostgresの`docker-compose.yml`を追加。Web/Worker/DBスキーマは未実装のため、Phase 0b完了とは扱わない
- Compose実起動を確認：Postgres `postgres:16-alpine` がhealthy、VOICEVOX `/version` が応答。Worker/Web/DBスキーマは未実装
- `packages/db`にDrizzleスキーマと初期マイグレーションを追加し、Postgresへ適用。8テーブルを確認
- Drizzle接続クライアントと、`BrandKit`を検証して保存するブランドRepositoryを追加
- ユーザー・ワークスペースRepositoryを追加。メール正規化とパスワードハッシュ必須の入口を実装（認証画面・セッションは未実装）
- `packages/auth`にscryptパスワードハッシュ、署名付きセッション、HttpOnly/SameSite/Secure Cookie属性を追加（ログインAPI・環境変数接続は未実装）
- `apps/web`にNext.jsログイン画面とlogin/logout/session APIを追加。`DATABASE_URL`設定時はDBユーザー照合、未設定時は開発用管理者環境変数へフォールバック（レート制限・ユーザー作成UIは未実装）
- 開発HTTPではセッションCookieの`Secure`属性を外し、本番`NODE_ENV=production`では`Secure`を維持する設定を追加
- `GET/POST /api/brands`を追加。ログイン必須、DBユーザーの所有Workspaceだけを対象にし、`brandKitSchema`検証後に保存する
- 起動済みNext.jsへ未ログインで`GET /api/brands`を実行し、`401 {"error":"unauthorized"}`を確認
- `apps/web`の認証ユニットテスト2件を追加し、全体テストで実行するよう変更
- ログイン後の画面にWorkspace作成、Workspace選択、ブランド設定登録、登録済みブランド一覧を追加
- `pnpm --filter @shortfactory/db db:seed`を追加。`SHORTFACTORY_ADMIN_PASSWORD`を受け取り、既存メールを重複作成せず、Workspaceがなければ1件作成する
- `POST /api/videos`で所有ブランドに動画レコードを作成し、`POST /api/videos/:id/generate-plan`でfixture Directorの検証済み台本を保存するAPIを追加（外部AI・非同期ジョブは未接続）
- `PATCH /api/videos/:id/plan`を追加。`version`を照合し、検証済み計画だけを保存して版を1つ進める（競合時409）
- ログイン後画面に動画テストStudioを追加。Workspace・ブランド・テーマからfixture台本を生成し、タイトル・ナレーション・字幕・CTAを編集して保存できる
- `POST/GET /api/assets`を追加。素材キー、種類、Storageキー、出所、利用権情報を必須にし、ブランド所有者だけが登録・一覧取得できる
- `POST /api/assets/upload`と`GET /api/assets/:id/content`を追加。10MB以下の画像・音声・動画をローカルStorageへ保存し、DB登録失敗時は保存ファイルを削除する
- assetsに`contentType`を保存するmigrationを追加。アップロードした画像・音声・動画を元のMIMEタイプで配信し、既存行は`application/octet-stream`で補完する
- ブランド設定画面に素材のキーワード検索、種類フィルター、MIMEタイプ、出所、利用権情報の表示を追加
- `assertGenerationBudget`を追加し、ブランドの`maxGeneratedImages`を超える要求をProvider呼び出し前に拒否。Web APIは`429 generation_budget_exceeded`と上限値を返す
- fixture台本生成の完了ジョブを`generation_jobs`へ、fixtureの見積原価0円を`generation_costs`へ記録。`GET /api/videos/:id/costs`とStudioの見積原価表示を追加
- `POST /api/voices/synthesize`を拡張。動画所有者を確認したうえで、VOICEVOX WAVをローカルStorageへ保存し、`tts`素材として登録して認証済みcontent APIから再生できる
- `@remotion/player`をWebへ追加し、Video Studioで保存済み台本を1080×1920のRemotion Playerとしてプレビューできるようにした（素材は現段階ではプレースホルダー）
- `POST/GET /api/videos/:id/render`を追加。保存済み台本から所有者確認付きrenderジョブを`queued`で登録・一覧取得できる（Worker未接続のため完成扱いにしない）
- `pnpm --filter @shortfactory/video worker:render`を追加。queuedジョブを1件claimし、RemotionでH.264/AAC MP4を書き出し、ローカルStorageと`video_outputs`へ保存して成功・失敗を更新する
- `POST /api/videos/:id/scenes/:sceneId/regenerate`を追加。versionを照合し、対象シーンだけをfixture Directorで差し替えて保存する
- 最終テスト動画：1080×1920、30fps、H.264、AAC、約28.5秒
- Phase 0a人手評価：0/5。実素材・実Directorが未接続のため、品質判定はまだ開始しない

## テスト運用

リポジトリ直下で以下を実行する。

```bash
pnpm install
pnpm --filter @shortfactory/video pipeline:test
```

上記はfixture音声で動作確認する。VOICEVOXを使う場合は、VOICEVOX Engineを起動した状態で以下を実行する。

```bash
SHORTFACTORY_VOICE_PROVIDER=voicevox \
VOICEVOX_SPEAKER=2 \
pnpm --filter @shortfactory/video pipeline:test
```

出力先は`packages/video/out/local-test/`。動画、生成記録、テスト素材、JSON台本が保存される。`run.json`で`text`、`voice`、`assets`の実装種別を確認できる。

実データで試す場合は、`SHORTFACTORY_PLAN_FILE`、`SHORTFACTORY_ASSET_MANIFEST`、`SHORTFACTORY_ASSET_ROOT`を指定して`pipeline:local`を使う。実素材・実台本でない生成物は品質評価の合格本数に数えない。

## 更新ルール

1. フェーズを進める前に、受け入れ条件をこの表で確認する。
2. 実装後はテスト・型チェック・手動確認の結果を「検証済みの事実」に追記する。
3. 完了条件を満たさない場合は、状態を「一部完了」または「品質判定待ち」に留める。
4. コミット・push時に、状態、証拠、次の作業をこのファイルへ反映する。
5. Phase 0aの品質合格、30本評価、公開、課金、売上はそれぞれ別の証拠として記録する。

## 今後の進め方

- 作業単位はマスタープランのフェーズと完了条件に合わせる。細かな実装を積み上げるだけで、次のPhaseへ先走らない。
- 計画内のテスト失敗・型エラー・設定不備は、原因を確認して自分で修正し、同じ受け入れ条件を再確認する。
- 実装・検証・進行表更新までを1つの区切りとし、終了時に必ずcommit・pushする。
- 当初の目的、採用技術、評価基準、Phaseの順番を変更する必要が出た場合は作業を止め、変更理由と選択肢を確認してから進める。
- 「技術的に動いた」と「品質判定・公開・課金・売上を達成した」は分けて記録する。
