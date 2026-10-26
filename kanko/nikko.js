/* =========================================================
   めぐりナビ — 観光地データ：日光
   料金・所要時間はすべて「目安」です。最新の情報は各公式サイトで確認してください。
   別の観光地を追加するときは、同じ形のデータを MEGURI_DEST.<id> に足します。
   ========================================================= */

window.MEGURI_DEST = window.MEGURI_DEST || {};

window.MEGURI_DEST.nikko = {
  name: "日光",
  hub: "S", // 駅（すべての移動の起点）

  /* エリア。lunch はそのエリアで食べる昼食の例、park は車の駐車料金（1回） */
  areas: {
    S: { name: "日光駅周辺", short: "駅", lunch: "駅前の食堂でランチ", park: 0, inner: 8, stay: 9000 },
    W: { name: "二社一寺（世界遺産）", short: "世界遺産", lunch: "名物の湯波（ゆば）料理", park: 600, inner: 8, stay: 12000 },
    C: { name: "中禅寺湖", short: "中禅寺湖", lunch: "湖畔でヒメマス料理", park: 0, inner: 10, stay: 15000 },
    O: { name: "奥日光", short: "奥日光", lunch: "湯元温泉の食堂", park: 0, inner: 10, stay: 14000 },
    K: { name: "鬼怒川温泉", short: "鬼怒川", lunch: "鬼怒川温泉街でランチ", park: 0, inner: 10, stay: 13000 },
    R: { name: "霧降高原", short: "霧降", lunch: "大笹牧場のジンギスカン", park: 0, inner: 10, stay: 11000 },
  },

  /* エリア間の移動（双方向）。bus/car は分、fare は大人片道の円。
     iroha: いろは坂など紅葉シーズンに大渋滞する区間 */
  edges: [
    { id: "S-W", a: "S", b: "W", bus: 8,  fare: 200,  car: 5,  line: "世界遺産めぐりバス" },
    { id: "W-C", a: "W", b: "C", bus: 40, fare: 1150, car: 30, line: "東武バス（いろは坂経由）", iroha: true },
    { id: "C-O", a: "C", b: "O", bus: 30, fare: 900,  car: 20, line: "東武バス（湯元温泉行）", iroha: true },
    { id: "S-K", a: "S", b: "K", bus: 35, fare: 320,  car: 30, line: "東武線（下今市で乗換）" },
    { id: "S-R", a: "S", b: "R", bus: 15, fare: 330,  car: 15, line: "東武バス（霧降高原行）" },
  ],
  /* 奥日光の中はスポットが離れているのでバスで移動（O-in） */
  innerBus: { O: { id: "O-in", bus: 10, fare: 300, line: "東武バス（奥日光内）" } },

  /* 東京方面からのアクセス。fee は特急料金。to はどの駅に着くか */
  origins: {
    asakusa: {
      name: "浅草", to: "東武日光駅", tobu: true,
      train: {
        fast: { name: "東武 特急スペーシアX", min: 110, fare: 1400, fee: 1940 },
        cheap: { name: "東武線 快速・普通乗継", min: 150, fare: 1400, fee: 0 },
      },
    },
    tokyo: {
      name: "東京駅", to: "JR日光駅", tobu: false,
      train: {
        fast: { name: "東北新幹線＋JR日光線（宇都宮乗換）", min: 105, fare: 2640, fee: 2860 },
        cheap: { name: "JR宇都宮線・日光線 普通", min: 170, fare: 2640, fee: 0 },
      },
    },
    shinjuku: {
      name: "新宿", to: "JR日光駅", tobu: false,
      train: {
        fast: { name: "埼京線＋東北新幹線（大宮・宇都宮乗換）", min: 125, fare: 2640, fee: 2400 },
        cheap: { name: "湘南新宿ライン・JR日光線 普通", min: 170, fare: 2640, fee: 0 },
      },
    },
  },
  car: { min: 140, toll: 3700, gas: 2500, label: "東北道・日光宇都宮道路（日光IC）" },

  /* フリーパス。access: 東京方面との往復を含むか（東武の出発地のみ）。covers: 乗り放題の区間 */
  passes: [
    { id: "wh", name: "東武 NIKKO PASS（世界遺産エリア）", a: 2120, c: 610, access: "tobu", covers: ["S-W"],
      note: "浅草・北千住からの往復運賃＋世界遺産エリアのバス乗り放題（特急料金は別）" },
    { id: "all", name: "東武 NIKKO PASS（全エリア）", a: 4780, c: 1430, access: "tobu", covers: ["S-W", "W-C", "C-O", "O-in", "S-K", "S-R"],
      note: "往復運賃＋中禅寺湖・奥日光・鬼怒川・霧降のバスと電車が乗り放題（特急料金は別）" },
    { id: "chu", name: "中禅寺温泉フリーパス", a: 2300, c: 1150, access: null, covers: ["S-W", "W-C"],
      note: "日光駅〜中禅寺温泉のバスが2日間乗り放題" },
    { id: "yu", name: "湯元温泉フリーパス", a: 3500, c: 1750, access: null, covers: ["S-W", "W-C", "C-O", "O-in"],
      note: "日光駅〜湯元温泉のバスが2日間乗り放題" },
  ],

  /* スポット。stay=滞在分、a/c=大人/子どもの料金、score=おすすめ度(1-10)、fam=家族向け度(0-3)
     open/close=分（0時起点）、rain=雨でも楽しめる、heavy=歩く距離が長い、walk=エリア内の追加移動分
     off=営業しない季節、carOnly=バスがほぼ無く車向き */
  spots: [
    { id: "shinkyo", area: "W", name: "神橋", stay: 15, a: 300, c: 100, score: 6, fam: 1, open: 510, close: 1020, rain: false,
      note: "大谷川にかかる朱塗りの橋。日光の玄関口で写真映えする" },
    { id: "toshogu", area: "W", name: "日光東照宮", stay: 75, a: 1600, c: 550, score: 10, fam: 2, open: 540, close: 1020, rain: true,
      note: "陽明門・眠り猫・三猿。日光に来たらまずここ" },
    { id: "rinnoji", area: "W", name: "輪王寺 三仏堂", stay: 30, a: 400, c: 200, score: 6, fam: 1, open: 480, close: 1020, rain: true,
      note: "高さ8mの金色の三体仏が並ぶ本堂" },
    { id: "futarasan", area: "W", name: "日光二荒山神社", stay: 25, a: 0, c: 0, score: 6, fam: 1, open: 480, close: 1020, rain: false,
      note: "縁結びの御神木で知られる。本社の参拝は無料" },
    { id: "taiyuin", area: "W", name: "輪王寺 大猷院", stay: 35, a: 550, c: 250, score: 7, fam: 1, open: 480, close: 1020, rain: true,
      note: "三代将軍家光の廟所。東照宮より落ち着いた金と黒の世界" },
    { id: "kanman", area: "W", name: "憾満ヶ淵（並び地蔵）", stay: 30, a: 0, c: 0, score: 5, fam: 1, open: 480, close: 1050, rain: false, walk: 15,
      note: "川沿いに約70体の地蔵が並ぶ静かな散策路" },
    { id: "tamozawa", area: "W", name: "日光田母沢御用邸記念公園", stay: 50, a: 600, c: 300, score: 6, fam: 1, open: 540, close: 1020, rain: true, walk: 15,
      note: "大正天皇の御用邸。雨の日にも向く屋内見学" },

    { id: "akechi", area: "C", name: "明智平ロープウェイ", stay: 35, a: 1000, c: 500, score: 6, fam: 2, open: 540, close: 960, rain: false,
      note: "いろは坂の途中。展望台から華厳の滝と中禅寺湖を一望" },
    { id: "kegon", area: "C", name: "華厳の滝（観瀑台）", stay: 30, a: 570, c: 340, score: 9, fam: 3, open: 480, close: 1020, rain: true,
      note: "落差97mの日本三名瀑。エレベーターで滝つぼ近くの観瀑台へ" },
    { id: "chugushi", area: "C", name: "二荒山神社 中宮祠", stay: 20, a: 0, c: 0, score: 4, fam: 1, open: 480, close: 1020, rain: false,
      note: "男体山の登拝口。湖畔の鳥居が美しい" },
    { id: "cruise", area: "C", name: "中禅寺湖 遊覧船（一周）", stay: 60, a: 1680, c: 840, score: 7, fam: 3, open: 570, close: 960, rain: true, off: ["winter"],
      note: "約55分で湖を一周。子どもも飽きにくい" },
    { id: "tachiki", area: "C", name: "中禅寺 立木観音", stay: 30, a: 500, c: 200, score: 5, fam: 1, open: 480, close: 960, rain: true, walk: 10,
      note: "一本の桂の立木から彫られた十一面観音" },
    { id: "embassy", area: "C", name: "英国・イタリア大使館別荘記念公園", stay: 50, a: 450, c: 220, score: 6, fam: 1, open: 540, close: 990, rain: true, walk: 20, off: ["winter"],
      note: "湖畔の外国大使館の別荘。2館共通券の料金" },

    { id: "ryuzu", area: "O", name: "竜頭の滝", stay: 25, a: 0, c: 0, score: 7, fam: 2, open: 420, close: 1080, rain: false,
      note: "滝つぼが竜の頭に見える。紅葉の名所" },
    { id: "senjo", area: "O", name: "戦場ヶ原 自然研究路", stay: 90, a: 0, c: 0, score: 7, fam: 1, open: 420, close: 1020, rain: false, heavy: true,
      note: "湿原の木道を歩く約2時間コースの一部。歩きやすい靴で" },
    { id: "yudaki", area: "O", name: "湯滝", stay: 20, a: 0, c: 0, score: 6, fam: 2, open: 420, close: 1080, rain: false,
      note: "湯ノ湖から流れ落ちる落差70mの滝" },
    { id: "yumoto", area: "O", name: "湯元温泉 日帰り入浴", stay: 60, a: 800, c: 500, score: 6, fam: 2, open: 600, close: 1080, rain: true,
      note: "白濁の硫黄泉。歩いた後のしめに" },

    { id: "tateiwa", area: "K", name: "鬼怒楯岩大吊橋", stay: 25, a: 0, c: 0, score: 5, fam: 2, open: 480, close: 1080, rain: false,
      note: "長さ140mの歩行者専用の吊り橋" },
    { id: "linekudari", area: "K", name: "鬼怒川ライン下り", stay: 50, a: 3000, c: 2100, score: 6, fam: 3, open: 540, close: 960, rain: false, off: ["winter"],
      note: "船頭さんの案内で渓谷を約40分下る" },
    { id: "world", area: "K", name: "東武ワールドスクウェア", stay: 100, a: 2800, c: 1400, score: 7, fam: 3, open: 540, close: 1020, rain: false, walk: 10,
      note: "世界の建築を1/25で再現。子ども連れに人気" },
    { id: "edo", area: "K", name: "江戸ワンダーランド 日光江戸村", stay: 150, a: 5800, c: 3000, score: 6, fam: 3, open: 540, close: 1020, rain: true, walk: 15,
      note: "江戸の町並みで忍者ショーや花魁道中" },

    { id: "kirifuri", area: "R", name: "霧降の滝", stay: 30, a: 0, c: 0, score: 5, fam: 2, open: 480, close: 1020, rain: false,
      note: "二段に落ちる日本の滝百選" },
    { id: "osasa", area: "R", name: "日光霧降高原 大笹牧場", stay: 60, a: 0, c: 0, score: 5, fam: 3, open: 540, close: 1020, rain: false, walk: 25, carOnly: true,
      note: "ソフトクリームと動物ふれあい。路線バスはほぼ無いので車向き" },
  ],

  /* 季節。jam: いろは坂区間の渋滞倍率、closeShift: 閉館時刻のずれ（分） */
  seasons: {
    spring: { name: "春（4〜5月）", jam: 1.0, closeShift: 0 },
    summer: { name: "夏（6〜9月）", jam: 1.1, closeShift: 0 },
    autumn: { name: "紅葉（10〜11月）", jam: 1.8, closeShift: 0,
      tip: "紅葉の時期はいろは坂が大渋滞します。中禅寺湖・奥日光へは朝早く上がるのが鉄則です。" },
    winter: { name: "冬（12〜3月）", jam: 1.0, closeShift: -60,
      tip: "冬は多くの施設が1時間ほど早く閉まり、奥日光は雪道になります。車ならスタッドレスタイヤ必須です。" },
  },
};
