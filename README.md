# 新歓ナビ

スマートフォン対応のサークル検索サイトと、管理者認証付きの運営画面です。旧版の画面イメージに合わせ、淡いピンクベージュ、赤橙色のアクセント、上部検索、時間割表、カテゴリ別カード、比較導線、FAQを配置しています。団体情報は登録されたデータだけを表示します。Node.js 24 の標準機能だけで動作し、DB は SQLite です。

## 起動

```powershell
$env:ADMIN_SETUP_TOKEN = "十分に長いランダムな初回設定キー"
node server.mjs
```

`http://localhost:3000` を開きます。初回は `/admin.html` で初期設定キー、管理者メール、12文字以上のパスワードを登録します。セットアップ後は初回キーを環境から外して構いません。初回管理者が登録されると、公開経路から追加の管理者登録はできません。

自動テストは Node.js 24 で `node --test` を実行します。外部サービスを使わず、使い捨てSQLite DBで公開・管理APIを確認します。

Windowsでキーを作る例:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

本番では必ずHTTPSを使い、`ADMIN_SETUP_TOKEN` は初回セットアップ時だけ設定してください。`DB_PATH` は永続ディスク内に指定します。既定は `./data/shinkanavi.sqlite` です。

## 機能

- 公開団体の複合検索、詳細、情報確認状況、更新日表示
- キャンパスは早稲田・西早稲田・所沢・戸山を標準候補として表示。登録データに別名がある場合も選択肢に追加
- 時間割をブラウザの localStorage に保存し、空き曜日・時限と活動時間を照合
- お気に入りをブラウザに保存（アカウント不要、端末間同期なし）
- 2〜4団体の条件比較、確認状況や更新日を考慮したおすすめ順／新着順
- 管理画面で新規登録、編集、複製、公開切替、非公開化
- CSV/JSONのプレビュー、必須項目検証、大学名＋団体名による重複候補照合、行単位のエラーと再試行、CSV出力
- SQLite保存、管理API認証、scryptパスワードハッシュ、HttpOnly/SameSiteセッションCookie

活動時間が不明な情報は登録済みの値だけで照合します。未確認・未登録は画面に表示されます。架空のサンプルは `public/sample.csv` と `public/sample.json` にあり、非公開として用意しています。

## 一括登録

管理画面の「一括登録」から `public/sample.csv` または `public/sample.json` の形式で読み込みます。CSVの先頭行は項目名です。必須項目は `name`（団体名）と `university`（大学名）。同一大学の同一団体名が登録済みなら重複候補となり、新規登録モードではスキップされます。更新モードでは一致した行だけを更新し、異なる名前の行は新規追加します。エラー一覧から失敗行のみ再試行できます。

管理画面で新規登録する場合、大学名は「早稲田大学」、キャンパスは早稲田・西早稲田・所沢・戸山から選択済みで始まります。必要に応じて大学名やキャンパスを変更でき、一括登録の既存データに含まれる別のキャンパス名も保持されます。

## 本番デプロイ（Render）

`render.yaml` はBlueprintとして使えます。Node.js 24.22.1のWebサービス、シンガポールリージョン、`/health` ヘルスチェック、1GB永続ディスク（SQLite用）、HTTPS付き `onrender.com` URLを設定しています。

1. このプロジェクトは `shigatetsuya-jpg/-Navi` リポジトリの `shinkanavi-render` ブランチに登録します。旧版はGitの履歴に残しつつ、新版のファイル一式でこのブランチを置き換えます。
2. Render Dashboardで「New」→「Blueprint」を選び、`shigatetsuya-jpg/-Navi` を接続して、デプロイ対象ブランチを `shinkanavi-render` に指定し、`render.yaml` を読み込みます。
3. `ADMIN_SETUP_TOKEN` を入力してBlueprintを適用します。これは初回管理者登録専用の秘密値です。初期設定が終わったらRenderのEnvironmentから削除します。
4. Renderが表示する料金と構成を確認してから、デプロイを確定します。Freeサービスではディスクが永続化されないため、この構成は有料の最小Webプランを指定しています。
5. 発行された `onrender.com` URLを開き、`/admin.html` から管理者を登録して、確認済みの実データを登録します。

2026-10-29時点の概算は、Webサービスが月7米ドル、1GBディスクが月0.25米ドルで、**合計月7.25米ドルから**（税・追加使用量・為替手数料別）です。Hobby workspace自体は無料ですが、永続ディスクを使うWebサービスは有料プランが必要です。ディスク利用中は一度に1インスタンスで動作し、再デプロイ時に数秒の停止があり得ます。料金は確定前にRender画面で再確認してください。

参照: [Render Blueprint](https://render.com/docs/blueprint-spec)、[永続ディスク](https://render.com/docs/disks)、[料金](https://render.com/pricing)、[Node.jsバージョン設定](https://render.com/docs/node-version)。Renderの本番サービスは未作成のため、公開URLは未発行です。旧GitHub PagesはRenderの公開先が確定してから新版へ転送します。

## 仕様上の注意

- `updated_at` はDBのUTC時刻です。画面では日付部分を表示します。
- アプリ内申込や個人情報の収集は行わず、登録された公式フォーム/SNSへ案内します。
- 初回DB構築は `migrations/001-init.sql` で行い、適用版を `schema_migrations` に記録します。将来の列変更には連番マイグレーションを追加してください。
- 公開前に運営問い合わせ先、利用規約、プライバシー情報を用意してください。現状は未設定と表示します。
