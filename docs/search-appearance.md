# 検索結果のサイト名・アイコン

2026-11-09。正式名称はワセサークルナビ、正式URLはhttps://wase-circle-navi.com/。

本番確認ではtitle/og:site_nameは新名称だったが、独自faviconとWebSite構造化データがなかった。検索結果のRender表示はユーザー報告であり、どのGoogle検索結果が何を表示していたかをこちらで直接確認できたわけではない。

サイトの既存の「ワ」マークを96px PNG、複数サイズICO、180px Apple用アイコンとして追加。全画面にリンクを設置し、適切なContent-Typeで配信する。トップにはGoogleへ希望するサイト名を伝えるWebSite構造化データを追加し、url/@idはPUBLIC_SITE_URLから正式ホストへ置換する。

本番向けの名前・アイコン修正だけを現行shinkanavi-renderから分離する。会員・通知等の未公開開発枝、掲載データ、料金、メール送信設定は変更しない。

## Google側の反映

表示名・アイコンはGoogleが再クロールして判断する。即時反映・必ず指定どおりになることは保証できない。公式説明では再クロール等に数日〜数週間かかる場合がある。

1. Search Consoleで新しいhttps://wase-circle-navi.com/のプロパティを選択する。旧onrender.comのプロパティとは別。未登録ならプロパティを追加してGoogleが示す方法で所有権確認する。DNS値は推測しない。
2. URL検査にhttps://wase-circle-navi.com/を入力し、公開URLをテストしてインデックス登録をリクエストする。
3. サイトマップhttps://wase-circle-navi.com/sitemap.xmlを送信する。
4. Googleの再取得・新ドメインへの表示更新を待つ。WebSiteのサイト名はリッチリザルトテストでは対応していないため、構文・実HTMLとSearch ConsoleのURL検査で確認する。

この変更の時点でGoogleへの再登録申請は行っていない。

参照：
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/favicon-in-search

## 検証

既存npm test成功。合成DBと390px ChromiumでWebSite JSONの解析、正式URLとの一致、PNG/ICO配信とMIME、全画面リンク、ブラウザ/CSPエラーなしを確認した。アイコンの生成スクリプトは開発用で、サーバー実行にPillowやフォントの追加は不要。
