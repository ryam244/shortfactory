# Short Factory 進行表

最終更新：2026-09-24 17:00 JST
基準文書：[master-plan.md](./master-plan.md)

## 現在地

**Phase 0aのローカル配線テストまで完了。品質判定は未完了。**

JSON台本・登録素材・VOICEVOX音声を組み合わせて、ローカルPC上で1080×1920のMP4を1コマンド生成できる。現在のテストデータは動作確認用であり、実ブランドの品質合格とは扱わない。

## フェーズ別進行

| フェーズ | 状態 | 完了した範囲 | 残りの完了条件／次の作業 |
| --- | --- | --- | --- |
| 前提：素材準備 | 未完了 | asset key、ローカル素材マニフェストの契約 | 実ブランドのキャラ・表情・背景・小物・BGMと利用権情報を揃える |
| 0a：品質検証 | 配線完了・品質判定待ち | `VideoPlan`、fixture、JSON台本、VOICEVOX、Storage、Remotion、技術検証 | 実台本＋実素材で5本生成し、人手評価4/5以上。TTS候補と合成方式を決定 |
| 0b：環境確定 | 未着手 | VOICEVOX単体Docker運用を確認 | Postgres・VOICEVOX・WorkerのCompose化、Text API・単価・規約の記録 |
| 1：基盤 | 未着手 | なし | Web、認証、DB、ブランド登録、CI、バックアップ |
| 2：台本 | 一部完了 | `VideoPlan`、JSON台本Provider、読み辞書・検証 | Director API、台本保存API、編集画面 |
| 3：素材・音声 | 一部完了 | `StorageProvider`、`AssetProvider`、VOICEVOX、尺計算 | 素材登録・検索、権利情報、原価上限、部分再生成 |
| 4：動画 | CLI完了・アプリ未着手 | Remotionテンプレート、MP4、ffprobe技術検証、安全域 | Remotion Player、Workerジョブ、プレビューとMP4の一致確認 |
| 5：運用 | 未着手 | なし | 再試行、失敗回復、ダウンロード、保持期限、30本評価 |
| 6：クラウド | 保留 | なし | 30本評価合格後に必要性を判断 |

## 検証済みの事実

- `pnpm test`：contracts 11件、providers 6件、storage 3件、assets 2件が成功
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
- `apps/web`にNext.js最小画面とlogin/logout/session APIを追加。管理者環境変数接続まで実装（レート制限・DBユーザー照合・画面フォームは未実装）
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
