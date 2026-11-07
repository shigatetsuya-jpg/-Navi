/* 観光プランナー サンプルデータ
 * 本番では Google Places API 等から取得し、利用規約で保存が許される範囲のみ保持する想定。
 * open/close は「0時からの分」。fee は大人1人の入場料（円）、food は飲食の目安（円/人）。
 * crowd: popular / normal / quiet（混雑目安のサンプル推定に使用）
 */
window.TP_CITIES = {
  kyoto: {
    name: '京都', center: [35.0030, 135.7680], base: [34.9858, 135.7588], baseName: '京都駅',
    transitFare: [230, 260], hotel: [5000, 12000],
    origins: { same: [0, 0], tokyo: [8000, 28200], nagoya: [5000, 11400], osaka: [1200, 3000], fukuoka: [12000, 32000], sapporo: [20000, 60000], sendai: [14000, 42000] }
  },
  tokyo: {
    name: '東京', center: [35.6900, 139.7550], base: [35.6812, 139.7671], baseName: '東京駅',
    transitFare: [180, 320], hotel: [6000, 14000],
    origins: { same: [0, 0], kyoto: [8000, 28200], nagoya: [5000, 22000], osaka: [8000, 29000], fukuoka: [12000, 46000], sapporo: [15000, 50000], sendai: [6000, 23000] }
  }
};

window.TP_ORIGINS = { same: '目的地と同じ都市', tokyo: '東京', kyoto: '京都', nagoya: '名古屋', osaka: '大阪', fukuoka: '福岡', sapporo: '札幌', sendai: '仙台' };

window.TP_CATS = {
  gourmet: { label: 'グルメ', icon: '🍜' },
  temple: { label: '寺社', icon: '⛩️' },
  nature: { label: '自然', icon: '🌿' },
  shopping: { label: '買い物', icon: '🛍️' },
  cafe: { label: 'カフェ', icon: '☕' },
  night: { label: '夜景', icon: '🌃' },
  museum: { label: '博物館・屋内', icon: '🏛️' }
};

(function () {
  const H = (h, m) => h * 60 + (m || 0);
  const ALL = [0, 1440];
  const k = (id, name, lat, lng, cats, fee, open, stay, o) => Object.assign(
    { id, city: 'kyoto', name, lat, lng, cats, fee, open, stay, indoor: false, queue: false, crowd: 'normal', food: 0, pop: 2, desc: '' }, o);
  const t = (id, name, lat, lng, cats, fee, open, stay, o) => Object.assign(k(id, name, lat, lng, cats, fee, open, stay, o), { city: o && o.city || 'tokyo' });

  window.TP_SPOTS = [
    // ---------- 京都 ----------
    k('ky-kiyomizu', '清水寺', 34.9949, 135.7850, ['temple'], 400, [H(6), H(18)], 60, { crowd: 'popular', queue: true, pop: 3, desc: '「清水の舞台」で有名。朝早い時間が狙い目。' }),
    k('ky-inari', '伏見稲荷大社', 34.9671, 135.7727, ['temple', 'nature'], 0, ALL, 90, { crowd: 'popular', pop: 3, desc: '千本鳥居。山頂まで歩くと約2時間。' }),
    k('ky-kinkaku', '金閣寺（鹿苑寺）', 35.0394, 135.7292, ['temple'], 500, [H(9), H(17)], 45, { crowd: 'popular', queue: true, pop: 3, desc: '金色に輝く舎利殿と鏡湖池。' }),
    k('ky-ginkaku', '銀閣寺（慈照寺）', 35.0270, 135.7982, ['temple'], 500, [H(8, 30), H(17)], 45, { pop: 2, desc: '侘び寂びの庭園。哲学の道の起点。' }),
    k('ky-tetsugaku', '哲学の道', 35.0236, 135.7943, ['nature'], 0, ALL, 40, { crowd: 'quiet', pop: 2, desc: '疎水沿いの約2kmの散歩道。' }),
    k('ky-nanzen', '南禅寺・水路閣', 35.0113, 135.7932, ['temple', 'nature'], 0, [H(8, 40), H(17)], 45, { pop: 2, desc: 'レンガ造りの水路閣が人気の撮影スポット。' }),
    k('ky-keage', '蹴上インクライン', 35.0103, 135.7905, ['nature'], 0, ALL, 20, { crowd: 'quiet', pop: 1, desc: '線路跡を歩ける桜の名所。' }),
    k('ky-heian', '平安神宮', 35.0160, 135.7824, ['temple'], 0, [H(6), H(17)], 30, { pop: 2, desc: '朱塗りの大鳥居と社殿。' }),
    k('ky-yasaka', '八坂神社', 35.0037, 135.7785, ['temple', 'night'], 0, ALL, 30, { pop: 2, desc: '祇園の中心。夜のライトアップも◎。' }),
    k('ky-hanami', '祇園・花見小路', 35.0029, 135.7751, ['shopping', 'night'], 0, ALL, 40, { crowd: 'popular', pop: 3, desc: '石畳とお茶屋が並ぶ京都らしい通り。' }),
    k('ky-sannen', '産寧坂・二年坂', 34.9961, 135.7810, ['shopping', 'gourmet'], 0, [H(9), H(18)], 45, { crowd: 'popular', food: 800, pop: 3, desc: '食べ歩きとお土産探しに。' }),
    k('ky-arabica', '% ARABICA 京都東山', 34.9983, 135.7797, ['cafe'], 0, [H(9), H(18)], 30, { queue: true, food: 600, pop: 2, desc: '行列のできるラテが人気。' }),
    k('ky-nishiki', '錦市場', 35.0050, 135.7650, ['gourmet', 'shopping'], 0, [H(10), H(17)], 60, { crowd: 'popular', food: 1500, pop: 3, indoor: true, desc: '「京の台所」。アーケードで雨でもOK。' }),
    k('ky-ponto', '先斗町', 35.0055, 135.7710, ['gourmet', 'night'], 0, [H(17), H(23)], 90, { food: 4000, pop: 2, desc: '鴨川沿いの細い路地に飲食店が並ぶ。' }),
    k('ky-arashi-bamboo', '嵐山 竹林の小径', 35.0170, 135.6713, ['nature'], 0, ALL, 40, { crowd: 'popular', pop: 3, desc: '朝の時間帯は人が少なく幻想的。' }),
    k('ky-tenryu', '天龍寺', 35.0158, 135.6738, ['temple'], 500, [H(8, 30), H(17)], 45, { pop: 2, desc: '世界遺産。曹源池庭園が見どころ。' }),
    k('ky-togetsu', '渡月橋', 35.0129, 135.6777, ['nature'], 0, ALL, 20, { pop: 2, desc: '嵐山のシンボル。' }),
    k('ky-nijo', '二条城', 35.0142, 135.7481, ['temple', 'museum'], 1300, [H(8, 45), H(16)], 75, { indoor: true, pop: 2, desc: '徳川家の城。二の丸御殿は屋内見学。' }),
    k('ky-gosho', '京都御所', 35.0254, 135.7621, ['nature', 'museum'], 0, [H(9), H(16)], 60, { crowd: 'quiet', pop: 1, desc: '予約不要で通年公開。' }),
    k('ky-shimogamo', '下鴨神社・糺の森', 35.0390, 135.7729, ['temple', 'nature'], 0, [H(6, 30), H(17)], 40, { crowd: 'quiet', pop: 2, desc: '原生林に囲まれた世界遺産。' }),
    k('ky-tofuku', '東福寺', 34.9767, 135.7739, ['temple'], 600, [H(9), H(16)], 45, { pop: 2, desc: '通天橋の紅葉で有名。' }),
    k('ky-museum', '京都国立博物館', 34.9899, 135.7732, ['museum'], 700, [H(9, 30), H(17)], 90, { indoor: true, crowd: 'quiet', pop: 1, desc: '雨の日にもおすすめ。' }),
    k('ky-manga', '京都国際マンガミュージアム', 35.0117, 135.7591, ['museum'], 1200, [H(10), H(17, 30)], 90, { indoor: true, crowd: 'quiet', pop: 1, desc: '約5万冊を自由に読める。' }),
    k('ky-aquarium', '京都水族館', 34.9876, 135.7464, ['museum'], 2400, [H(10), H(18)], 90, { indoor: true, pop: 2, desc: '梅小路公園内。屋内中心。' }),
    k('ky-tower', '京都タワー展望室', 34.9875, 135.7593, ['night'], 900, [H(10), H(21)], 40, { indoor: true, crowd: 'quiet', pop: 1, desc: '京都市街を360度見渡せる。' }),
    k('ky-station', '京都駅ビル 大階段・スカイウェイ', 34.9858, 135.7588, ['night', 'shopping'], 0, [H(7), H(23)], 30, { indoor: true, crowd: 'quiet', pop: 1, desc: '無料で楽しめる夜景スポット。' }),

    // ---------- 東京 ----------
    t('tk-sensoji', '浅草寺', 35.7148, 139.7967, ['temple'], 0, [H(6), H(17)], 60, { crowd: 'popular', pop: 3, desc: '雷門と五重塔。東京最古の寺。' }),
    t('tk-nakamise', '仲見世通り', 35.7118, 139.7964, ['shopping', 'gourmet'], 0, [H(9), H(19)], 40, { crowd: 'popular', food: 800, pop: 3, desc: '人形焼・揚げまんじゅうの食べ歩き。' }),
    t('tk-skytree', '東京スカイツリー', 35.7101, 139.8107, ['night'], 2100, [H(10), H(22)], 90, { indoor: true, crowd: 'popular', queue: true, pop: 3, desc: '天望デッキ350m。夕方〜夜がおすすめ。' }),
    t('tk-ueno', '上野恩賜公園', 35.7156, 139.7745, ['nature'], 0, [H(5), H(23)], 60, { pop: 2, desc: '美術館・動物園が集まる公園。' }),
    t('tk-tnm', '東京国立博物館', 35.7188, 139.7765, ['museum'], 1000, [H(9, 30), H(17)], 90, { indoor: true, crowd: 'quiet', pop: 2, desc: '日本最古の博物館。雨の日に。' }),
    t('tk-ameyoko', 'アメ横商店街', 35.7101, 139.7745, ['gourmet', 'shopping'], 0, [H(10), H(20)], 45, { crowd: 'popular', food: 1200, pop: 2, desc: '海鮮丼や食べ歩きグルメ。' }),
    t('tk-yanaka', '谷中銀座', 35.7275, 139.7660, ['gourmet', 'shopping'], 0, [H(10), H(18)], 60, { crowd: 'quiet', food: 1000, pop: 2, desc: '下町情緒あふれる商店街。' }),
    t('tk-meiji', '明治神宮', 35.6764, 139.6993, ['temple', 'nature'], 0, [H(6), H(17)], 60, { pop: 3, desc: '都心の大きな森。' }),
    t('tk-takeshita', '竹下通り', 35.6716, 139.7031, ['shopping', 'gourmet'], 0, [H(10), H(20)], 45, { crowd: 'popular', food: 800, pop: 2, desc: '原宿のトレンド発信地。' }),
    t('tk-scramble', '渋谷スクランブル交差点', 35.6595, 139.7005, ['night'], 0, ALL, 20, { crowd: 'popular', pop: 2, desc: '世界一有名な交差点。' }),
    t('tk-shibuyasky', 'SHIBUYA SKY', 35.6585, 139.7023, ['night'], 2500, [H(10), H(22, 30)], 60, { queue: true, crowd: 'popular', pop: 3, desc: '屋上展望。夕暮れ時は要予約。' }),
    t('tk-gyoen', '新宿御苑', 35.6852, 139.7101, ['nature'], 500, [H(9), H(17, 30)], 60, { pop: 2, desc: '芝生でのんびりできる庭園。' }),
    t('tk-tocho', '東京都庁 展望室', 35.6896, 139.6922, ['night'], 0, [H(9, 30), H(22)], 40, { indoor: true, crowd: 'quiet', pop: 1, desc: '無料の展望室。夜景も◎。' }),
    t('tk-omoide', '思い出横丁', 35.6930, 139.6995, ['gourmet', 'night'], 0, [H(17), H(24)], 90, { food: 3000, pop: 2, desc: '昭和レトロな飲み屋街。' }),
    t('tk-tsukiji', '築地場外市場', 35.6654, 139.7707, ['gourmet'], 0, [H(6), H(14)], 60, { crowd: 'popular', food: 2000, pop: 3, desc: '朝ごはんに海鮮を。午前中が勝負。' }),
    t('tk-higashigyoen', '皇居東御苑', 35.6852, 139.7553, ['nature'], 0, [H(9), H(16, 30)], 60, { crowd: 'quiet', pop: 1, desc: '江戸城跡の庭園。入園無料。' }),
    t('tk-marunouchi', '東京駅 丸の内駅舎', 35.6812, 139.7671, ['shopping', 'night'], 0, ALL, 30, { pop: 2, desc: '赤レンガ駅舎。夜のライトアップも。' }),
    t('tk-ginza', '銀座', 35.6717, 139.7650, ['shopping'], 0, [H(11), H(20)], 60, { pop: 2, indoor: true, desc: '百貨店巡りなら雨でも快適。' }),
    t('tk-kiyosumi', '清澄白河のカフェ街', 35.6808, 139.7990, ['cafe'], 0, [H(10), H(18)], 45, { crowd: 'quiet', food: 700, pop: 2, desc: 'ロースタリー系カフェが集まる街。' }),
    t('tk-roppongi', '六本木ヒルズ 東京シティビュー', 35.6604, 139.7292, ['night', 'museum'], 2000, [H(10), H(22)], 90, { indoor: true, pop: 2, desc: '美術館と展望台がセット。' })
  ];
})();
