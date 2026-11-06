# wasecirclenavi.com 取得と接続の計画

2026年11月7日。ユーザーはこの名前で調査・準備を進めることを了承。購入は別途承認待ち。

## 購入画面で確認できた情報
Cloudflareの公開検索画面をブラウザで開き、wasecirclenavi.comがBuy now付きで表示されることを確認。初年度$11.17、Renews at $11.17/year。購入・カートへの追加・登録者情報の送信は行っていない。未確保のため取得可否は変わる。
URL：https://www.cloudflare.com/domains/search?q=wasecirclenavi.com
Porkbunは自動閲覧を拒否したため、その購入画面の確認は完了していない。再試行で回避しない。

料金は年払い。1ドル158円の仮換算で約1,765円。税・為替・カード手数料等を含む決済額はログイン後の支払画面で最終確認する。Cloudflareの有料Webプランや有料メールボックスを追加する案ではない。将来の更新価格は固定保証ではない。

## 購入の承認に含める条件
対象wasecirclenavi.com、1年、表示年額$11.17。更新も現在の表示$11.17/年。支払時にこれと異なる価格・追加サービスが出たら確定しない。自動更新の設定と次回の請求条件を確認する。アカウント・登録者情報と決済はユーザーの管理下で扱い、個人情報・決済情報をGitHubやチャットへ保存しない。

## 承認・取得後の接続案
1. DNSを管理するCloudflareゾーンで、既存レコードと登録状態を確認。
2. Renderの既存-Naviサービスへwasecirclenavi.comをカスタムドメインとして追加。新規Webサービスは作らない。Renderのドメイン枠・追加料金を確認し、増額があれば承認前に止める。
3. Cloudflareの@をCNAMEでnavi-qzh7.onrender.comへ向ける（apex flattening）。wwwも同じ接続先へCNAME。初期設定はDNS onlyとし、Renderが実際に返した指示で最終確認する。別用途のレコードを消さない。
4. RenderでドメインとTLSの検証を確認。既存URLは新ドメインの動作確認まで維持する。
5. PUBLIC_SITE_URL=https://wasecirclenavi.com を設定。検索向けcanonical・サイトマップ・確認メールの遷移先を点検。切替後は別ホストになるためログインし直しが必要になる場合がある。
6. Search Consoleに新ドメインの所有権を確認し、サイトマップを送信する。所有権情報の追加や公開接続は承認範囲を確認して実施する。

## 通知メールは別のDNS設定
サイトのCNAMEだけでは通知メールを送れるようにならない。送信専用サブドメイン（例：notify.wasecirclenavi.com）をResendへ登録し、Resendが返すDKIM/SPF等を確認してから設定する。DNS値や秘密キーを推測して作らない。送信元案は「ワセサークルナビ <no-reply@notify.wasecirclenavi.com>」。本人の非公開メールをReply-Toへ設定しない。
送信元・受信先・本文を示して実送信の承認を得た後に本人宛てから確認する。契約・取得と実メール送信の承認は分ける。
