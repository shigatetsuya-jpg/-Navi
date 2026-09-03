/* =========================================================
   新歓ナビ — Supabase 連携版
   index.html / kanri-console-8f42a9c1.html の両方から読み込まれます。
   ========================================================= */

const NAVI = (() => {

  const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

  const PERIODS = [
    { id: "p1",    label: "1限",   time: "8:50-10:30" },
    { id: "p2",    label: "2限",   time: "10:40-12:20" },
    { id: "lunch", label: "昼休み", time: "12:20-13:10" },
    { id: "p3",    label: "3限",   time: "13:10-14:50" },
    { id: "p4",    label: "4限",   time: "15:05-16:45" },
    { id: "p5",    label: "5限",   time: "17:00-18:40" },
    { id: "after", label: "放課後", time: "18:40-" },
  ];

  const CAMPUSES = ["早稲田", "戸山", "西早稲田", "所沢"];

  const CATEGORIES = {
    "体育会": ["バスケットボール", "サッカー", "テニス", "バドミントン", "ラグビー", "スキー"],
    "文化系": ["軽音・バンド", "ダンス", "演劇", "写真", "イラスト", "茶道"],
    "学術系": ["プログラミング", "ロボット", "将棋"],
    "その他": ["ボランティア"],
  };

  const CAT_STYLE = {
    "体育会": { color: "#1e8a4c", bg: "#e5f6ec", emoji: "🏅" },
    "文化系": { color: "#d13c6c", bg: "#fde8ef", emoji: "🎭" },
    "学術系": { color: "#2a5fc4", bg: "#e7eefc", emoji: "📚" },
    "その他": { color: "#c77414", bg: "#fdf0dd", emoji: "🌱" },
  };

  /* slot = { d: 曜日index(0=月), p: 時限id } */
  const SEED_CLUBS = [
    {
      id: "sakura-sounds", name: "軽音サークル「サクラサウンズ」",
      cat: "文化系", sub: "軽音・バンド", campus: "戸山", emoji: "🎸",
      appeal: "未経験から100人ライブまで。週1の自由参加でゆるく音楽を楽しもう。",
      desc: "学年・経験不問の軽音サークル。バンドは自由に組めて、機材・練習スタジオはサークルでレンタルできます。年2回の大型ライブと合宿が名物。",
      members: 120, costJoin: 1000, costYear: 3000,
      slots: [{ d: 5, p: "p3" }, { d: 5, p: "p4" }],
      tags: ["未経験歓迎", "機材レンタル可", "学園祭ステージ"],
      youtube: "",
      obog: ["大手レコード会社", "広告代理店", "IT企業（企画職）"],
      reviews: [
        { id: "sakura-sounds-r1", author: "2年・法学部", text: "初心者でも先輩が丁寧に教えてくれます。ライブが最高！" },
        { id: "sakura-sounds-r2", author: "3年・文学部", text: "掛け持ちしやすい自由な雰囲気です。" },
      ],
      official: true,
    },
    {
      id: "aoba-tennis", name: "硬式テニス部「アオバテニスクラブ」",
      cat: "体育会", sub: "テニス", campus: "早稲田", emoji: "🎾",
      appeal: "関東リーグ昇格を狙う本気組と、楽しく続けたい初心者組の2部制。",
      desc: "本気で上を目指す選手コースと、週1から参加できるエンジョイコースを併設。コートは早稲田キャンパス至近で授業後すぐ行けます。",
      members: 85, costJoin: 3000, costYear: 12000,
      slots: [{ d: 0, p: "p5" }, { d: 2, p: "p5" }, { d: 4, p: "p5" }],
      tags: ["2部制", "初心者コースあり", "関東リーグ"],
      youtube: "",
      obog: ["総合商社", "スポーツメーカー", "地方公務員"],
      reviews: [
        { id: "aoba-tennis-r1", author: "2年・商学部", text: "エンジョイコースは本当に気楽。ガチ勢と交流できるのも面白い。" },
      ],
      official: true,
    },
    {
      id: "nextcode", name: "プログラミング研究会「NextCode」",
      cat: "学術系", sub: "プログラミング", campus: "西早稲田", emoji: "💻",
      appeal: "ハッカソン常連。Web・AI・ゲームをチームでガチで作る学術系サークル。",
      desc: "週1のもくもく会＋月1のミニハッカソン。未経験向けの入門講座を春に開講。企業スポンサー付きコンテストへのチーム参加も。",
      members: 64, costJoin: 0, costYear: 2000,
      slots: [{ d: 2, p: "p5" }, { d: 4, p: "after" }],
      tags: ["未経験OK", "ハッカソン常連", "メンター先輩が担当"],
      youtube: "",
      obog: ["外資系IT", "メガベンチャー", "大学院進学（情報系）"],
      reviews: [
        { id: "nextcode-r1", author: "1年・基幹理工", text: "入門講座のおかげで半年でアプリを出せました。" },
      ],
      official: true,
    },
    {
      id: "west-hoop", name: "バスケットボールサークル「West Hoop」",
      cat: "体育会", sub: "バスケットボール", campus: "早稲田", emoji: "🏀",
      appeal: "西早稲田でバスケを楽しむ、初心者から競技者まで歓迎の中規模サークル。",
      desc: "レベル別に分かれて練習するので初心者でも安心。年3回のサークル対抗戦、夏合宿あり。体育館は抽選で毎週確保しています。",
      members: 58, costJoin: 1000, costYear: 6000,
      slots: [{ d: 0, p: "after" }, { d: 3, p: "after" }],
      tags: ["レベル別練習", "週2ゆるめ", "室内コート"],
      youtube: "",
      obog: ["金融（銀行）", "教員", "不動産デベロッパー"],
      reviews: [
        { id: "west-hoop-r1", author: "2年・社会科学部", text: "経験者と初心者でコートを分けてくれるのが良い。" },
      ],
      official: true,
    },
    {
      id: "n3d", name: "ダンスサークル「N3D」",
      cat: "文化系", sub: "ダンス", campus: "戸山", emoji: "🕺",
      appeal: "HipHop・Jazz・K-POPまで全ジャンル。戸山で踊れる、初心者比率6割。",
      desc: "ジャンル別レッスン制で好きなスタイルだけ選べます。新歓公演・学祭・冬の単独公演がメインイベント。",
      members: 140, costJoin: 2000, costYear: 8000,
      slots: [{ d: 1, p: "after" }, { d: 5, p: "p3" }, { d: 6, p: "p3" }],
      tags: ["オールジャンル", "ステージ多数", "スタジオ練習"],
      youtube: "",
      obog: ["エンタメ事務所", "アパレル", "総合広告"],
      reviews: [
        { id: "n3d-r1", author: "2年・文化構想", text: "初心者クラスから始めて1年で公演に出られました！" },
      ],
      official: true,
    },
    {
      id: "west-gear", name: "ロボット研究会「West Gear」",
      cat: "学術系", sub: "ロボット", campus: "西早稲田", emoji: "🤖",
      appeal: "NHKロボコン出場チーム。機械設計から回路・制御まで、モノづくりの全工程を学べる。",
      desc: "1年目は先輩とペアで小型ロボットを製作。工作機械と部室は24時間使用可。ロボコン・学会発表の実績多数。",
      members: 42, costJoin: 0, costYear: 5000,
      slots: [{ d: 1, p: "p5" }, { d: 3, p: "p5" }, { d: 5, p: "p2" }],
      tags: ["NHKロボコン", "設計〜制御", "部室24時間"],
      youtube: "",
      obog: ["重工メーカー", "自動車メーカー", "大学院進学（機械系）"],
      reviews: [
        { id: "west-gear-r1", author: "3年・創造理工", text: "手を動かして学べる環境。就活でも語れるネタが増える。" },
      ],
      official: true,
    },
    {
      id: "fc-waseda", name: "サッカーサークル「FC早稲田」",
      cat: "体育会", sub: "サッカー", campus: "所沢", emoji: "⚽",
      appeal: "関東学生リーグ出場チーム。選抜練習でも、サッカーで最高の仲間と出会える。",
      desc: "所沢の人工芝グラウンドで週3練習。選抜チームとエンジョイチームの2軸運営。OBとの定期交流戦あり。",
      members: 95, costJoin: 2000, costYear: 10000,
      slots: [{ d: 1, p: "after" }, { d: 5, p: "p1" }, { d: 6, p: "p1" }],
      tags: ["関東学生リーグ", "初心者歓迎", "合宿年2回"],
      youtube: "",
      obog: ["総合商社", "スポーツ系企業", "コンサルティング"],
      reviews: [
        { id: "fc-waseda-r1", author: "2年・スポーツ科学部", text: "グラウンドが綺麗で練習環境は最高です。" },
      ],
      official: true,
    },
    {
      id: "shuttle", name: "バドミントンサークル「Shuttle」",
      cat: "体育会", sub: "バドミントン", campus: "戸山", emoji: "🏸",
      appeal: "週2回の練習で上達も交流も。初心者から関東大会常連まで、幅広く活動中。",
      desc: "毎回レベル別コート制。ラケットの貸出があるので手ぶらで体験OK。夏合宿と冬の交流大会が人気。",
      members: 66, costJoin: 1000, costYear: 5000,
      slots: [{ d: 2, p: "after" }, { d: 4, p: "p5" }],
      tags: ["初心者歓迎", "ラケット貸出", "関東大会出場"],
      youtube: "",
      obog: ["保険会社", "公務員", "メーカー営業"],
      reviews: [
        { id: "shuttle-r1", author: "1年・教育学部", text: "手ぶら体験に行ってそのまま入りました。雰囲気が良い！" },
      ],
      official: true,
    },
    {
      id: "aoba-theater", name: "演劇サークル「劇団あおば」",
      cat: "文化系", sub: "演劇", campus: "戸山", emoji: "🎭",
      appeal: "年2回の公演と週2回の稽古が中心。役者・スタッフ・脚本まで全員参加で作る舞台。",
      desc: "未経験者が半数以上。演技だけでなく照明・音響・美術など裏方から関わることもできます。",
      members: 45, costJoin: 0, costYear: 4000,
      slots: [{ d: 1, p: "after" }, { d: 3, p: "after" }, { d: 5, p: "p3" }],
      tags: ["年2回公演", "役者・スタッフ・脚本", "脚本挑戦OK"],
      youtube: "",
      obog: ["放送局", "出版社", "劇団・芸能"],
      reviews: [
        { id: "aoba-theater-r1", author: "2年・文学部", text: "裏方で入って今は役者。どちらも経験できるのが魅力。" },
      ],
      official: true,
    },
    {
      id: "focus", name: "写真サークル「Focus」",
      cat: "文化系", sub: "写真", campus: "戸山", emoji: "📷",
      appeal: "月2回の撮影会と写真展。カメラを持っていなくても部内貸出でOK。",
      desc: "土曜のゆる撮影散歩がメイン。フィルムから最新ミラーレスまで機材貸出あり。春秋の学内写真展に出展できます。",
      members: 38, costJoin: 0, costYear: 2000,
      slots: [{ d: 5, p: "p2" }],
      tags: ["カメラ貸出", "写真展", "撮影会は月2回"],
      youtube: "",
      obog: ["出版・メディア", "Web制作会社", "メーカー広報"],
      reviews: [
        { id: "focus-r1", author: "3年・国際教養", text: "月2回だけなのでバイトとも両立しやすい。" },
      ],
      official: true,
    },
    {
      id: "waseda-heart", name: "ボランティアサークル「Waseda Heart」",
      cat: "その他", sub: "ボランティア", campus: "早稲田", emoji: "🤝",
      appeal: "子ども支援・福祉施設・環境活動。週1回の活動で社会貢献。",
      desc: "地域の学習支援・環境美化・災害支援募金など複数プロジェクトから選んで参加。活動証明書の発行も可能です。",
      members: 72, costJoin: 0, costYear: 0,
      slots: [{ d: 5, p: "p1" }, { d: 6, p: "p2" }],
      tags: ["子ども支援", "参加は週1でOK", "社会貢献"],
      youtube: "",
      obog: ["NPO・国際機関", "教員", "公務員（福祉職）"],
      reviews: [
        { id: "waseda-heart-r1", author: "2年・人間科学部", text: "無理のないペースで続けられて、視野が広がります。" },
      ],
      official: true,
    },
    {
      id: "palette", name: "イラストサークル「Palette」",
      cat: "文化系", sub: "イラスト", campus: "西早稲田", emoji: "🎨",
      appeal: "デジタル・アナログ両方OK。週1回の部会で作品を共有・批評。",
      desc: "液タブ・スキャナなど機材が部室に完備。合同誌の制作とコミケ出展が年間の目標です。",
      members: 50, costJoin: 0, costYear: 3000,
      slots: [{ d: 4, p: "after" }],
      tags: ["デジタルOK", "タブレット貸出", "作品展あり"],
      youtube: "",
      obog: ["ゲーム会社", "デザイン事務所", "Web系企業"],
      reviews: [
        { id: "palette-r1", author: "1年・文化構想", text: "上手い人の添削がもらえるのがありがたい。" },
      ],
      official: true,
    },
    {
      id: "ohte", name: "将棋サークル「王手」",
      cat: "学術系", sub: "将棋", campus: "早稲田", emoji: "♟️",
      appeal: "週1回の対局会。初心者から有段者まで対戦、棋譜研究も。",
      desc: "昼休みのゆる対局と金曜の研究会の2本立て。学生大会の団体戦にも出場しています。",
      members: 22, costJoin: 0, costYear: 1000,
      slots: [{ d: 1, p: "lunch" }, { d: 4, p: "p5" }],
      tags: ["初心者歓迎", "有段者在籍", "詰将棋研究"],
      youtube: "",
      obog: ["金融（証券）", "SIer", "大学院進学"],
      reviews: [
        { id: "ohte-r1", author: "4年・政治経済", text: "昼休みにふらっと指せるのが最高です。" },
      ],
      official: true,
    },
    {
      id: "snow-peak", name: "スキーサークル「Snow Peak」",
      cat: "体育会", sub: "スキー", campus: "所沢", emoji: "🎿",
      appeal: "冬はスキー、夏は登山。年2回の合宿で仲間と最高の景色を。",
      desc: "オフシーズンはトレーニングとハイキング。12月と2月の長期合宿がメインイベント。レンタル装備の割引あり。",
      members: 55, costJoin: 2000, costYear: 6000,
      slots: [{ d: 3, p: "after" }, { d: 5, p: "p4" }],
      tags: ["スキー合宿", "登山", "初心者歓迎"],
      youtube: "",
      obog: ["旅行会社", "アウトドアメーカー", "地方銀行"],
      reviews: [
        { id: "snow-peak-r1", author: "2年・スポーツ科学部", text: "合宿の一体感がすごい。滑れなくても教えてもらえます。" },
      ],
      official: true,
    },
    {
      id: "senka", name: "茶道サークル「千家」",
      cat: "文化系", sub: "茶道", campus: "戸山", emoji: "🍵",
      appeal: "季節のお点前を学ぶ。週1回のお稽古で、日本の心を体験。",
      desc: "師範の先生をお招きした本格的なお稽古。浴衣での夏茶会、学祭でのお茶席が恒例です。正座が苦手でも椅子席あり。",
      members: 30, costJoin: 1000, costYear: 4000,
      slots: [{ d: 2, p: "p4" }, { d: 5, p: "p3" }],
      tags: ["茶道", "季節行事", "礼儀作法"],
      youtube: "",
      obog: ["ホテル業界", "航空（CA）", "老舗企業"],
      reviews: [
        { id: "senka-r1", author: "3年・文学部", text: "所作が身につくし、和菓子が毎回楽しみ。" },
      ],
      official: true,
    },
    {
      id: "waseda-rfc", name: "ラグビー部「Waseda RFC」",
      cat: "体育会", sub: "ラグビー", campus: "所沢", emoji: "🏉",
      appeal: "関東大学リーグ出場。週4回の練習で、ラグビーで日本一を目指す。",
      desc: "本気でラグビーに打ち込みたい人向けの体育会。朝練＋週末試合のハードな環境ですが、その分得られるものは大きい。",
      members: 65, costJoin: 5000, costYear: 15000,
      slots: [{ d: 1, p: "p1" }, { d: 3, p: "p1" }, { d: 5, p: "p1" }, { d: 6, p: "p1" }],
      tags: ["関東大学リーグ", "初心者歓迎", "週4練習"],
      youtube: "",
      obog: ["社会人ラグビーチーム", "総合商社", "警察・消防"],
      reviews: [
        { id: "waseda-rfc-r1", author: "2年・スポーツ科学部", text: "厳しいけど本気でやりたいなら間違いなくここ。" },
      ],
      official: true,
    },
    {
      id: "buzzer-beaters", name: "バスケ同好会「Buzzer Beaters」",
      cat: "体育会", sub: "バスケットボール", campus: "戸山", emoji: "🏀",
      appeal: "週1ゆるバスケ。試合よりエンジョイ重視、他大との合同練習も。",
      desc: "出欠自由・レベル不問のエンジョイ系バスケサークル。West Hoopより練習頻度は少なめで、掛け持ち率が高いのが特徴。",
      members: 40, costJoin: 0, costYear: 3000,
      slots: [{ d: 4, p: "after" }, { d: 6, p: "p3" }],
      tags: ["週1ゆるめ", "出欠自由", "掛け持ちOK"],
      youtube: "",
      obog: ["IT企業", "メーカー", "広告"],
      reviews: [
        { id: "buzzer-beaters-r1", author: "3年・商学部", text: "行ける日だけ行けばいいので気楽。初心者ばかりです。" },
      ],
      official: true,
    },
  ];

  /* localStorage keys (ブラウザローカル設定用) */
  const K = {
    busy: "navi_busy_slots",           // ユーザーの時間割設定（ローカルのみ）
    busyFilter: "navi_busy_filter_on",
    bookmarks: "navi_bookmarks",
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  let supabaseClient = null;

  /* Supabaseクライアント初期化 */
  async function initSupabase() {
    if (window.supabase) {
      const { createClient } = window.supabase;
      supabaseClient = createClient(
        'https://guhguwgjazldcufmwzzi.supabase.co',
        'sb_publishable_sN5BEO25vmByiN-5JpkIDQ_YDHccpg4'
      );
      console.log('Supabase initialized');
      await loadSeedToSupabase();
    }
  }

  /* テストデータをSupabaseにロード（初回のみ） */
  async function loadSeedToSupabase() {
    if (!supabaseClient) return;
    const { data: existing } = await supabaseClient.from('clubs').select('count', { count: 'exact' });
    if (existing && existing.length > 0) return; // 既にロードされている

    for (const club of SEED_CLUBS) {
      const slots = club.slots.map(s => `${s.d}-${s.p}`);
      const { error } = await supabaseClient.from('clubs').insert({
        name: club.name,
        category: club.cat,
        subcategory: club.sub,
        campus: club.campus,
        emoji: club.emoji,
        appeal: club.appeal,
        description: club.desc,
        member_count: club.members,
        costs: `入会: ${club.costJoin}円 / 年: ${club.costYear}円`,
        slots: slots,
        tags: club.tags,
        youtube_url: club.youtube,
        obog: club.obog,
        is_demo: true,
      });
      if (error) console.error('Error loading seed club:', error);
    }
  }

  /* Supabaseから公開クラブを取得 */
  async function getClubsFromSupabase() {
    if (!supabaseClient) {
      console.warn('Supabase not initialized, returning seed clubs');
      return SEED_CLUBS;
    }
    const { data: clubs, error } = await supabaseClient.from('clubs').select('*');
    if (error) {
      console.error('Error fetching clubs:', error);
      return SEED_CLUBS;
    }
    return (clubs || []).map(c => ({
      id: c.id || c.name.toLowerCase(),
      name: c.name,
      cat: c.category,
      sub: c.subcategory,
      campus: c.campus,
      emoji: c.emoji,
      appeal: c.appeal,
      desc: c.description,
      members: c.member_count,
      costJoin: 0, costYear: 0,
      slots: (c.slots || []).map(s => {
        const [d, p] = s.split('-');
        return { d: parseInt(d), p };
      }),
      tags: c.tags || [],
      youtube: c.youtube_url,
      obog: c.obog || [],
      reviews: [],
      official: true,
    }));
  }

  /* 同期的getClubs（Demo用にSeedを返す） */
  function getClubs() {
    return SEED_CLUBS;
  }

  return {
    DAYS, PERIODS, CAMPUSES, CATEGORIES, CAT_STYLE, SEED_CLUBS, K,
    load, save, getClubs, getClubsFromSupabase, initSupabase
  };
})();

// Supabase初期化（エラーは無視して続行）
(async () => {
  try {
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    if (typeof NAVI !== 'undefined' && NAVI.initSupabase) {
      await NAVI.initSupabase();
    }
  } catch (e) {
    console.warn('Supabase initialization failed, continuing without it:', e);
  }
})();
