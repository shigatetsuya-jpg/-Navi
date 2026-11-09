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

## 旧Render URLからの移転

ユーザー提示の検索結果は旧navi-qzh7.onrender.comに「Render」「新歓ナビ」の旧表示が残っていた。旧ホストも200を返していたため、新ホストへの恒久転送を追加した。

PUBLIC_SITE_URLが設定されている場合、旧ホストのGET/HEADを同じパス・クエリの新ホストへ301転送する。新ホストやローカルを転送元にしない。監視の/health、既存API、Google所有権確認ファイル、証明書確認用/.well-known/は対象外。旧ホストでのログインCookieや端末保存は新ホストと別なので、利用者は新ホストでログインし直す必要がある場合がある。

旧URLのSearch Consoleプロパティに「設定 → アドレス変更」が表示される場合、新ドメインへの移転を申請できる。利用には旧・新両方の所有者権限等が必要で、こちらからの申請はまだ実施していない。新サイトマップ送信はユーザー画面で成功を確認済み。インデックス登録リクエストの実施は未確認。

301転送後もGoogleが再取得・処理するまで以前のURL・サイト名・アイコンが検索結果に残る場合がある。反映の即時性は保証しない。

参照：https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

旧・新プロパティを別のGoogleアカウントで管理している場合、アドレス変更ツールを使うには同じアカウントへ両方の所有者権限を付与する必要がある。古いRenderサブドメインは301を返すため維持し、単に無効化して404へ変えない。

PR #10（8d553e2）が本番liveとなり、旧トップ・団体パス/クエリ・faviconの301と新URLへのLocation、新トップ200、旧health/API/所有権ファイル200を外部確認済み。
