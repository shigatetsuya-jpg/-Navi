/* たびナビ（観光プランナー）デモ版
 * - 旅程生成：サンプルデータ＋ローカルのスコアリング（本番は Places API → LLM → Routes API に差し替え）
 * - 地図：Leaflet + OpenStreetMap（APIキー不要）
 * - 保存：localStorage、共有：URL ハッシュにエンコード
 */
(function () {
  'use strict';

  const CITIES = window.TP_CITIES, SPOTS = window.TP_SPOTS, CATS = window.TP_CATS, ORIGINS = window.TP_ORIGINS;
  const SPOT = Object.fromEntries(SPOTS.map(s => [s.id, s]));
  const DAY_COLORS = ['#e8442e', '#1f6feb', '#1e8a4c', '#9b51e0', '#f2994a', '#00a3a3', '#c0407a'];
  const MODES = { walk: { label: '徒歩', icon: '🚶', gmaps: 'walking' }, transit: { label: '公共交通', icon: '🚃', gmaps: 'transit' }, car: { label: '車', icon: '🚗', gmaps: 'driving' } };
  const PACE = { relaxed: { max: 4, stay: 1.25, label: 'ゆったり' }, normal: { max: 6, stay: 1, label: '普通' }, packed: { max: 8, stay: 0.8, label: '詰め込み' } };
  const CROWD_LABEL = ['空いている', 'やや混雑', '混雑'];
  const CROWD_COLOR = ['#34c77b', '#f2b33d', '#e8442e'];
  const CROWD_SOURCE = 'サンプル推定（曜日・時間帯モデル／データ時点 2026年11月）';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
  const yenR = (a, b) => Math.round(a / 100) * 100 === Math.round(b / 100) * 100 ? yen(Math.round(a / 100) * 100) : `${yen(Math.round(a / 100) * 100)}〜${yen(Math.round(b / 100) * 100)}`;
  const hm = m => { m = Math.round(m); const h = Math.floor(m / 60), mm = m % 60; return `${h}:${String(mm).padStart(2, '0')}`; };
  const parseHM = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const dur = m => m < 60 ? `${Math.round(m)}分` : `${Math.floor(m / 60)}時間${Math.round(m % 60) ? Math.round(m % 60) + '分' : ''}`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 容量超過・プライベートモード等 */ } }
  };

  /* ---------- 距離・移動時間（推定） ---------- */
  function km(a, b) {
    const R = 6371, toR = x => x * Math.PI / 180;
    const dLat = toR(b[0] - a[0]), dLng = toR(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // 直線距離 × 迂回係数から推定。本番は Routes API の結果で置き換える。
  function travelMin(a, b, mode) {
    const d = km(a, b) * 1.3;
    if (d < 0.05) return 0;
    if (mode === 'walk') return d / 4.5 * 60;
    if (mode === 'car') return 6 + d / 22 * 60 + (d > 0.5 ? 5 : 0);
    // 公共交通：近距離は徒歩の方が速い
    const walk = d / 4.5 * 60;
    const transit = 10 + d / 18 * 60;
    return Math.min(walk, transit);
  }
  const ll = s => [s.lat, s.lng];

  /* ---------- 混雑目安（サンプル推定） ---------- */
  function crowdLevel(s, wd, hour) {
    const weekend = wd === 0 || wd === 6;
    let v = { popular: 2, normal: 1, quiet: 0 }[s.crowd];
    const nightSpot = s.cats.includes('night') || s.open[0] >= 17 * 60;
    if (nightSpot) { if (hour >= 18 && hour <= 21) v += 1; else if (hour < 15) v -= 1; }
    else { if (hour >= 11 && hour <= 15) v += 1; else if (hour < 9 || hour >= 17) v -= 1; }
    if (weekend) v += 1;
    return v >= 3 ? 2 : v >= 2 ? 1 : 0;
  }
  const isOpenAt = (s, min) => min >= s.open[0] && min < s.open[1];
  const openText = s => s.open[0] === 0 && s.open[1] === 1440 ? '24時間' : `${hm(s.open[0])}〜${hm(s.open[1])}`;
  const thumbBg = s => { const c = { gourmet: '#ffe1cc', temple: '#ffd9d3', nature: '#d6f2dd', shopping: '#ffe6f2', cafe: '#efe2d3', night: '#d9def7', museum: '#e3e8ef' }; return c[s.cats[0]] || '#eee'; };
  const spotIcon = s => CATS[s.cats[0]].icon;

  /* ---------- 状態 ---------- */
  const S = {
    trip: null,
    activeDay: 0,
    favs: new Set(store.get('tp_favs', [])),
    me: null,             // {lat, lng, demo, acc}
    follow: true,
    heading: null,
    local: { within: 0, open: false, cat: '', budget: '', quiet: false, fav: false, view: 'map', detail: null, routeMode: null },
    sharedFrom: false
  };

  /* ================================================================
   * 旅程生成
   * ================================================================ */
  function readForm() {
    const val = id => $('#' + id).value;
    return {
      city: val('fCity'), origin: val('fOrigin'), date: val('fDate'),
      days: +val('fDays'), start: parseHM(val('fStart')), end: parseHM(val('fEnd')),
      people: Math.max(1, Math.min(20, +val('fPeople') || 1)), budget: Math.max(0, +val('fBudget') || 0),
      transport: $('#fTransport .on').dataset.v, pace: $('#fPace .on').dataset.v,
      interests: $$('#fInterests .chip.on').map(b => b.dataset.v),
      excl: $$('#fExcl .chip.on').map(b => b.dataset.v)
    };
  }

  function candidatePool(cond) {
    let pool = SPOTS.filter(s => s.city === cond.city);
    const warn = [];
    if (cond.excl.includes('queue')) pool = pool.filter(s => !s.queue);
    if (cond.excl.includes('paid')) pool = pool.filter(s => s.fee === 0);
    if (cond.excl.includes('rain')) {
      const indoor = pool.filter(s => s.indoor);
      if (indoor.length >= cond.days * 3) pool = indoor;
      else { pool = pool.sort((a, b) => b.indoor - a.indoor); warn.push('屋内スポットが少ないため、一部屋外スポットを含めています。'); }
    }
    return { pool, warn };
  }

  function baseScore(s, cond) {
    const match = s.cats.filter(c => cond.interests.includes(c)).length;
    let v = s.pop + (cond.interests.length ? match * 3 - (match ? 0 : 1.5) : 0);
    if (cond.excl.includes('rain') && s.indoor) v += 2;
    if (S.favs.has(s.id)) v += 2;
    return v;
  }

  function generate(cond) {
    const city = CITIES[cond.city];
    const { pool, warn } = candidatePool(cond);
    const pace = PACE[cond.pace];
    const used = new Set();
    const plan = [];
    for (let d = 0; d < cond.days; d++) {
      let t = cond.start, pos = city.base;
      const day = [];
      let hadLunch = false, hadDinner = false;
      while (day.length < pace.max) {
        let best = null, bestV = -Infinity;
        for (const s of pool) {
          if (used.has(s.id)) continue;
          const tr = travelMin(pos, ll(s), cond.transport);
          const arrive = t + tr;
          const begin = Math.max(arrive, s.open[0]);
          const wait = begin - arrive;
          const stay = Math.round(s.stay * pace.stay);
          const leave = begin + stay;
          if (wait > 90 || leave > s.open[1] || leave + travelMin(ll(s), city.base, cond.transport) > cond.end) continue;
          let v = baseScore(s, cond) - tr / 12 - wait / 20;
          const isFood = s.cats.includes('gourmet');
          const isNight = s.cats.includes('night');
          if (isFood && !hadLunch && arrive >= 11 * 60 && arrive <= 13.5 * 60) v += 4;
          if (isFood && !hadDinner && arrive >= 17.5 * 60) v += 4;
          if (isFood && (hadLunch && arrive < 17 * 60 || hadDinner)) v -= 3;
          if (isNight) v += arrive >= 17 * 60 ? 3 : -2;
          if (v > bestV) { bestV = v; best = { s, leave, arrive }; }
        }
        if (!best) break;
        used.add(best.s.id);
        day.push(best.s.id);
        if (best.s.cats.includes('gourmet')) { if (best.arrive < 16 * 60) hadLunch = true; else hadDinner = true; }
        t = best.leave; pos = ll(best.s);
      }
      plan.push(day);
    }
    if (plan.some(d => d.length === 0)) warn.push('条件に合うスポットが足りない日があります。除外条件や時間帯を見直してください。');
    return {
      id: 't' + Date.now().toString(36),
      name: `${city.name} ${cond.days === 1 ? '日帰り' : `${cond.days - 1}泊${cond.days}日`}の旅`,
      cond, plan, stays: {}, warn, createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  // 1日分のタイムラインを計算（並べ替え・追加・削除のたびに呼ぶ＝後続時刻の自動再計算）
  function computeDay(trip, d) {
    const c = trip.cond, city = CITIES[c.city], pace = PACE[c.pace];
    let t = c.start, pos = city.base, moveTotal = 0;
    const stops = trip.plan[d].map(id => {
      const s = SPOT[id];
      const tr = travelMin(pos, ll(s), c.transport);
      const arrive = t + tr;
      const begin = Math.max(arrive, s.open[0]);
      const stay = trip.stays[id] || Math.round(s.stay * pace.stay / 5) * 5;
      const leave = begin + stay;
      const warns = [];
      if (arrive < s.open[0]) warns.push(`開門前に到着（${hm(s.open[0])}開始・${dur(s.open[0] - arrive)}待ち）`);
      if (leave > s.open[1]) warns.push(`営業時間外にかかります（${hm(s.open[1])}まで）`);
      moveTotal += tr; t = leave; pos = ll(s);
      return { s, travel: tr, arrive, begin, stay, leave, warns };
    });
    const back = travelMin(pos, city.base, c.transport);
    moveTotal += back;
    const finish = t + back;
    return { stops, back, finish, moveTotal, over: finish > c.end };
  }

  /* ================================================================
   * 費用見積もり
   * ================================================================ */
  function estimateCost(trip) {
    const c = trip.cond, city = CITIES[c.city];
    const nights = c.days - 1;
    const days = trip.plan.map((_, d) => computeDay(trip, d));
    const allStops = days.flatMap(d => d.stops);
    const items = [];

    // 交通費（往復＋現地）
    const ow = city.origins[c.origin] || [0, 0];
    let localMin = 0, localMax = 0, localSrc;
    if (c.transport === 'transit') {
      const legs = days.reduce((n, d) => n + d.stops.length + 1, 0);
      localMin = legs * city.transitFare[0] * 0.7; localMax = legs * city.transitFare[1]; // 一部は徒歩移動になるため下限を割り引く
      localSrc = `推定：${legs}区間 × ${city.transitFare[0]}〜${city.transitFare[1]}円（バス・地下鉄の目安）`;
    } else if (c.transport === 'car') {
      const distKm = days.reduce((n, d, i) => {
        let p = city.base, sum = 0;
        d.stops.forEach(x => { sum += km(p, ll(x.s)) * 1.3; p = ll(x.s); });
        return n + sum + km(p, city.base) * 1.3;
      }, 0);
      localMin = (6000 * c.days + distKm * 12 + 1000 * c.days) / c.people;
      localMax = (10000 * c.days + distKm * 18 + 3000 * c.days) / c.people;
      localSrc = `推定：レンタカー・ガソリン（約${Math.round(distKm)}km）・駐車場を${c.people}人で割り勘`;
    } else { localSrc = '徒歩のため0円'; }
    items.push({ key: 'transport', label: '🚃 交通費', min: ow[0] + localMin, max: ow[1] + localMax,
      src: `${ow[1] ? `往復（${ORIGINS[c.origin]}⇄${city.name}）：${yenR(ow[0], ow[1])}　推定：高速バス〜新幹線・飛行機の目安` : '往復交通費なし'}／現地：${localSrc}` });

    // 宿泊費
    items.push({ key: 'hotel', label: '🏨 宿泊費', min: city.hotel[0] * nights, max: city.hotel[1] * nights,
      src: nights ? `推定：${nights}泊 × ${yenR(city.hotel[0], city.hotel[1])}／人（ビジネスホテル〜中級ホテルの相場）` : '日帰りのため0円' });

    // 食費
    const foodSpots = allStops.reduce((n, x) => n + x.s.food, 0);
    items.push({ key: 'food', label: '🍜 食費', min: 2000 * c.days + foodSpots * 0.8, max: 3500 * c.days + foodSpots * 1.3,
      src: `推定：食事 2,000〜3,500円/日${foodSpots ? ` ＋ 旅程内の飲食スポット（目安 ${yen(foodSpots)}）` : ''}` });

    // 入場料
    const fees = allStops.filter(x => x.s.fee > 0);
    const feeSum = fees.reduce((n, x) => n + x.s.fee, 0);
    items.push({ key: 'fee', label: '🎫 入場料', min: feeSum, max: feeSum,
      src: fees.length ? `取得元：サンプルデータの大人料金（${fees.map(x => `${x.s.name} ${yen(x.s.fee)}`).join('・')}）` : '旅程内に有料スポットなし' });

    // その他
    items.push({ key: 'other', label: '🛍️ その他', min: 500 * c.days, max: 2000 * c.days, src: '推定：お土産・飲み物など 500〜2,000円/日' });

    const min = items.reduce((n, i) => n + i.min, 0), max = items.reduce((n, i) => n + i.max, 0);
    return { items, min, max };
  }

  /* ================================================================
   * 画面切り替え
   * ================================================================ */
  let currentView = 'plan';
  function show(view) {
    currentView = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    window.scrollTo(0, 0);
    if (view === 'trip') renderTrip();
    if (view === 'cost') renderCost();
    if (view === 'local') openLocal();
    if (view === 'mine') renderMine();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function setTrip(trip, opts) {
    S.trip = trip;
    S.activeDay = 0;
    store.set('tp_current', trip);
    if (!(opts && opts.silent)) show('trip');
  }
  function touchTrip() {
    S.trip.updatedAt = Date.now();
    store.set('tp_current', S.trip);
    const saved = store.get('tp_trips', []);
    const i = saved.findIndex(t => t.id === S.trip.id);
    if (i >= 0) { saved[i] = S.trip; store.set('tp_trips', saved); }
  }

  /* ================================================================
   * 1. 計画フォーム
   * ================================================================ */
  function initForm() {
    const fillOrigins = () => {
      const city = $('#fCity').value, sel = $('#fOrigin'), prev = sel.value;
      sel.innerHTML = Object.keys(CITIES[city].origins).map(k => `<option value="${k}">${ORIGINS[k]}</option>`).join('');
      sel.value = CITIES[city].origins[prev] ? prev : (city === 'kyoto' ? 'tokyo' : 'osaka');
    };
    $('#fCity').addEventListener('change', fillOrigins);
    fillOrigins();
    const d = new Date(); d.setDate(d.getDate() + 7);
    $('#fDate').value = d.toISOString().slice(0, 10);
    $('#fInterests').innerHTML = Object.entries(CATS).map(([k, c]) =>
      `<button type="button" class="chip${['temple', 'gourmet'].includes(k) ? ' on' : ''}" data-v="${k}">${c.icon} ${c.label}</button>`).join('');
    $$('#fInterests .chip, #fExcl .chip').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
    $$('#fTransport, #fPace').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
    }));
    $('#planForm').addEventListener('submit', e => {
      e.preventDefault();
      const cond = readForm();
      if (cond.end - cond.start < 120) { toast('観光時間は2時間以上にしてください'); return; }
      const trip = generate(cond);
      setTrip(trip);
      if (trip.warn.length) setTimeout(() => toast(trip.warn[0]), 400);
    });
  }

  /* ================================================================
   * 2. 旅程結果
   * ================================================================ */
  let tripMap, tripLayer;
  function renderTrip() {
    const wrap = $('#tripWrap');
    if (!S.trip) {
      $('#tripTitle').textContent = '旅程';
      wrap.dataset.empty = '1';
      $('#timeline').innerHTML = `<div class="empty"><div class="big">🗓️</div><p>まだ旅程がありません。</p><p><button class="btn btn-pri" data-go="plan">条件を入れて旅程をつくる</button></p></div>`;
      $('#dayTabs').innerHTML = ''; $('#daySummary').innerHTML = '';
      if (tripLayer) tripLayer.clearLayers();
      return;
    }
    const trip = S.trip, c = trip.cond;
    $('#tripTitle').textContent = trip.name;
    if (S.activeDay >= trip.plan.length) S.activeDay = 0;
    const date0 = c.date ? new Date(c.date + 'T00:00') : null;
    $('#dayTabs').innerHTML = trip.plan.map((_, d) => {
      const dt = date0 ? new Date(date0.getTime() + d * 864e5) : null;
      const lbl = dt ? `${dt.getMonth() + 1}/${dt.getDate()}(${'日月火水木金土'[dt.getDay()]})` : '';
      return `<button class="chip${d === S.activeDay ? ' on' : ''}" data-day="${d}" style="${d === S.activeDay ? `background:${DAY_COLORS[d]};border-color:${DAY_COLORS[d]}` : ''}">${d + 1}日目 ${lbl}</button>`;
    }).join('');

    const d = S.activeDay, day = computeDay(trip, d), color = DAY_COLORS[d % DAY_COLORS.length];
    const city = CITIES[c.city];
    $('#daySummary').innerHTML = `<span>${MODES[c.transport].icon} ${MODES[c.transport].label}</span><span>スポット <b>${day.stops.length}</b></span><span>移動 <b>${dur(day.moveTotal)}</b></span><span>${city.baseName}着 <b style="${day.over ? 'color:var(--ng)' : ''}">${hm(day.finish)}</b>${day.over ? '（終了時刻超過）' : ''}</span>`;

    let html = `<div class="tl-endpoint"><span class="dot">🏁</span><span><b>${hm(c.start)}</b> ${esc(city.baseName)}を出発</span></div>`;
    day.stops.forEach((x, i) => {
      const cl = crowdLevel(x.s, date0 ? new Date(date0.getTime() + d * 864e5).getDay() : 6, Math.floor(x.begin / 60));
      html += `<div class="tl-move">${MODES[c.transport].icon} ${x.travel < 1 ? 'すぐ' : `約${Math.max(1, Math.round(x.travel))}分`}</div>
      <div class="tl-stop">
        <div class="tl-num" style="background:${color}">${i + 1}</div>
        <div class="tl-body">
          <div class="tl-time">${hm(x.arrive)} 着${x.begin > x.arrive ? `（${hm(x.begin)} 入場）` : ''} ・ 滞在 ${dur(x.stay)} ・ ${hm(x.leave)} 発</div>
          <div class="tl-name" data-detail="${x.s.id}">${spotIcon(x.s)} ${esc(x.s.name)}</div>
          <div class="muted">${x.s.fee ? yen(x.s.fee) : '無料'} ・ <span class="badge lv${cl}">${CROWD_LABEL[cl]}</span></div>
          ${x.warns.map(w => `<div class="tl-warn">⚠ ${esc(w)}</div>`).join('')}
          <div class="tl-btns">
            <button class="btn btn-sm btn-ghost" data-swap="${i}">差し替え</button>
            <button class="btn btn-sm btn-ghost" data-stay="${i}">滞在時間</button>
            <button class="btn btn-sm btn-ghost" data-del="${i}" style="color:var(--ng)">削除</button>
          </div>
        </div>
        <div class="tl-actions">
          <button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上へ">▲</button>
          <button data-down="${i}" ${i === day.stops.length - 1 ? 'disabled' : ''} aria-label="下へ">▼</button>
        </div>
      </div>`;
    });
    if (!day.stops.length) html += `<div class="empty" style="padding:20px"><p>この日の予定はまだありません。</p></div>`;
    html += `<div class="tl-move">${MODES[c.transport].icon} 約${Math.max(1, Math.round(day.back))}分</div>
      <div class="tl-endpoint"><span class="dot">🏨</span><span><b>${hm(day.finish)}</b> ${esc(city.baseName)}に到着</span></div>
      <div class="row" style="margin-top:10px"><button class="btn" data-addspot>＋ スポットを追加</button><button class="btn btn-ghost" data-go="local">現地モードで探す</button></div>`;
    if (trip.warn && trip.warn.length) html += trip.warn.map(w => `<p class="note" style="color:var(--warn)">⚠ ${esc(w)}</p>`).join('');
    if (S.sharedFrom) html += `<p class="note">🔗 共有リンクから読み込んだ旅程です。編集内容はこの端末に保存されます。</p>`;
    $('#timeline').innerHTML = html;
    drawTripMap();
  }

  function drawTripMap() {
    if (!window.L) { $('#tripMap').innerHTML = '<div class="empty">地図を読み込めませんでした（オフライン）。</div>'; return; }
    if (!tripMap) {
      tripMap = L.map('tripMap', { zoomControl: true });
      tileLayer().addTo(tripMap);
      tripLayer = L.layerGroup().addTo(tripMap);
    }
    tripLayer.clearLayers();
    if (!S.trip) return;
    const c = S.trip.cond, city = CITIES[c.city];
    const bounds = [city.base];
    L.marker(city.base, { icon: L.divIcon({ className: '', html: '<div class="pin" style="background:#1f2328"><span>🏨</span></div>', iconSize: [28, 28], iconAnchor: [14, 28] }) })
      .bindTooltip(city.baseName).addTo(tripLayer);
    S.trip.plan.forEach((ids, d) => {
      const active = d === S.activeDay, color = DAY_COLORS[d % DAY_COLORS.length];
      const pts = [city.base, ...ids.map(id => ll(SPOT[id])), city.base];
      L.polyline(pts, { color, weight: active ? 5 : 3, opacity: active ? 0.9 : 0.35, dashArray: c.transport === 'walk' ? '1 8' : null, lineCap: 'round' }).addTo(tripLayer);
      ids.forEach((id, i) => {
        const s = SPOT[id];
        const m = L.marker(ll(s), { icon: L.divIcon({ className: '', html: `<div class="pin" style="background:${color};opacity:${active ? 1 : .55}"><span>${i + 1}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] }), zIndexOffset: active ? 500 : 0 });
        m.on('click', () => openSpotModal(s.id));
        m.bindTooltip(`${d + 1}日目-${i + 1} ${s.name}`).addTo(tripLayer);
        if (active) bounds.push(ll(s));
      });
    });
    setTimeout(() => { tripMap.invalidateSize(); tripMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }); }, 50);
  }

  function initTrip() {
    $('#tripSubtabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#tripSubtabs button').forEach(x => x.classList.toggle('on', x === b));
      $$('.trip-pane').forEach(p => p.style.display = p.dataset.pane === b.dataset.v ? '' : 'none');
      if (b.dataset.v === 'map' && tripMap) setTimeout(() => drawTripMap(), 30);
    });
    $('#dayTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-day]'); if (!b) return;
      S.activeDay = +b.dataset.day; renderTrip();
    });
    $('#timeline').addEventListener('click', e => {
      const t = e.target.closest('button, [data-detail]'); if (!t || !S.trip) return;
      const day = S.trip.plan[S.activeDay];
      const ds = t.dataset;
      if (ds.detail) return openSpotModal(ds.detail);
      if (ds.up != null) { const i = +ds.up; [day[i - 1], day[i]] = [day[i], day[i - 1]]; touchTrip(); renderTrip(); toast('並べ替えて時刻を再計算しました'); }
      else if (ds.down != null) { const i = +ds.down; [day[i + 1], day[i]] = [day[i], day[i + 1]]; touchTrip(); renderTrip(); toast('並べ替えて時刻を再計算しました'); }
      else if (ds.del != null) { const s = SPOT[day[+ds.del]]; day.splice(+ds.del, 1); touchTrip(); renderTrip(); toast(`${s.name} を削除しました`); }
      else if (ds.swap != null) openSwapModal(+ds.swap);
      else if (ds.stay != null) openStayModal(+ds.stay);
      else if ('addspot' in ds) openSwapModal(-1);
    });
    $('#btnSave').addEventListener('click', () => {
      if (!S.trip) return toast('保存する旅程がありません');
      const saved = store.get('tp_trips', []);
      const i = saved.findIndex(t => t.id === S.trip.id);
      if (i >= 0) saved[i] = S.trip; else saved.unshift(S.trip);
      store.set('tp_trips', saved.slice(0, 30));
      toast('マイ旅程に保存しました');
    });
    $('#btnShare').addEventListener('click', shareTrip);
  }

  /* ---------- モーダル ---------- */
  function openModal(html) { $('#modal').innerHTML = `<button class="icon-btn modal-close" data-close aria-label="閉じる">✕</button>` + html; $('#modalBg').classList.add('show'); }
  function closeModal() { $('#modalBg').classList.remove('show'); }
  $('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg' || e.target.closest('[data-close]')) closeModal(); });

  function openSpotModal(id) {
    openModal(spotDetailHTML(SPOT[id], { from: null }));
    bindDetail($('#modal'), SPOT[id]);
  }

  // 差し替え（idx >= 0）または追加（idx = -1）の候補
  function openSwapModal(idx) {
    const trip = S.trip, day = trip.plan[S.activeDay];
    const used = new Set(trip.plan.flat());
    const ref = idx >= 0 ? SPOT[day[idx]] : (day.length ? SPOT[day[day.length - 1]] : null);
    const refPt = ref ? ll(ref) : CITIES[trip.cond.city].base;
    const cands = SPOTS.filter(s => s.city === trip.cond.city && !used.has(s.id))
      .map(s => ({ s, d: km(refPt, ll(s)), sc: baseScore(s, trip.cond) }))
      .sort((a, b) => (a.d - a.sc * 0.4) - (b.d - b.sc * 0.4)).slice(0, 8);
    openModal(`<h3 style="margin-bottom:4px">${idx >= 0 ? `「${esc(ref.name)}」を差し替え` : 'スポットを追加'}</h3>
      <p class="muted" style="margin-bottom:10px">${idx >= 0 ? '近くにあるおすすめ候補です' : '最後のスポット付近の候補です（追加後は最適な位置に挿入します）'}</p>
      ${cands.map(c => spotCardHTML(c.s, `${c.d.toFixed(1)}km先`)).join('') || '<p class="empty">候補がありません</p>'}`);
    $$('#modal .spot-card').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('.fav-btn')) return;
      const id = el.dataset.id;
      if (idx >= 0) { day[idx] = id; toast(`${SPOT[id].name} に差し替えました`); }
      else { insertBest(day, id); toast(`${SPOT[id].name} を追加しました`); }
      touchTrip(); closeModal(); renderTrip();
    }));
  }

  function openStayModal(idx) {
    const day = S.trip.plan[S.activeDay], id = day[idx], s = SPOT[id];
    const cur = computeDay(S.trip, S.activeDay).stops[idx].stay;
    const opts = [15, 30, 45, 60, 90, 120, 180];
    openModal(`<h3>滞在時間：${esc(s.name)}</h3><p class="muted">現在 ${dur(cur)}。変更すると後続の時刻を再計算します。</p>
      <div class="chips" style="margin-top:12px">${opts.map(m => `<button class="chip${m === cur ? ' on' : ''}" data-m="${m}">${dur(m)}</button>`).join('')}</div>`);
    $$('#modal [data-m]').forEach(b => b.addEventListener('click', () => {
      S.trip.stays[id] = +b.dataset.m; touchTrip(); closeModal(); renderTrip(); toast('滞在時間を変更しました');
    }));
  }

  // 移動距離の増加が最小になる位置に挿入
  function insertBest(day, id) {
    const base = CITIES[S.trip.cond.city].base, p = ll(SPOT[id]);
    const pts = [base, ...day.map(x => ll(SPOT[x])), base];
    let bestI = day.length, bestAdd = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const add = km(pts[i], p) + km(p, pts[i + 1]) - km(pts[i], pts[i + 1]);
      if (add < bestAdd) { bestAdd = add; bestI = i; }
    }
    day.splice(bestI, 0, id);
    return bestI;
  }

  /* ---------- 共有 ---------- */
  function encodeTrip(t) {
    const payload = { v: 1, n: t.name, c: t.cond, p: t.plan, s: t.stays };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeTrip(str) {
    try {
      const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
      if (!o || o.v !== 1 || !o.c || !CITIES[o.c.city] || !Array.isArray(o.p)) return null;
      const num = (v, lo, hi, d) => (typeof v === 'number' && v >= lo && v <= hi) ? v : d;
      const c = o.c;
      const cond = {
        city: c.city, origin: CITIES[c.city].origins[c.origin] ? c.origin : 'same',
        date: /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : '',
        days: num(c.days, 1, 7, o.p.length), start: num(c.start, 0, 1440, 540), end: num(c.end, 0, 1440, 1200),
        people: num(c.people, 1, 20, 1), budget: num(c.budget, 0, 1e7, 0),
        transport: MODES[c.transport] ? c.transport : 'transit', pace: PACE[c.pace] ? c.pace : 'normal',
        interests: (c.interests || []).filter(k => CATS[k]), excl: (c.excl || []).filter(k => ['queue', 'rain', 'paid'].includes(k))
      };
      const plan = o.p.slice(0, 7).map(d => (Array.isArray(d) ? d : []).filter(id => SPOT[id] && SPOT[id].city === cond.city).slice(0, 12));
      cond.days = plan.length;
      const stays = {};
      Object.entries(o.s || {}).forEach(([k, v]) => { if (SPOT[k]) stays[k] = num(v, 5, 600, 60); });
      return { id: 't' + Date.now().toString(36), name: String(o.n || '共有された旅程').slice(0, 60), cond, plan, stays, warn: [], createdAt: Date.now(), updatedAt: Date.now() };
    } catch (e) { return null; }
  }
  async function shareTrip() {
    if (!S.trip) return toast('共有する旅程がありません');
    const url = location.href.split('#')[0] + '#trip=' + encodeTrip(S.trip);
    if (navigator.share) {
      try { await navigator.share({ title: S.trip.name, text: `旅程「${S.trip.name}」`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('共有リンクをコピーしました。同行者に送ると旅程を開けます'); }
    catch (e) { openModal(`<h3>共有リンク</h3><p class="muted">下のリンクをコピーして送ってください。</p><textarea class="inp" rows="4" readonly style="margin-top:8px;font-size:12px">${esc(url)}</textarea>`); }
  }

  /* ================================================================
   * 3. 費用
   * ================================================================ */
  function renderCost() {
    const w = $('#costWrap');
    if (!S.trip) { w.innerHTML = `<div class="empty"><div class="big">💴</div><p>旅程を作ると概算費用が表示されます。</p><p><button class="btn btn-pri" data-go="plan">旅程をつくる</button></p></div>`; return; }
    const c = S.trip.cond, est = estimateCost(S.trip);
    est.min = Math.round(est.min / 100) * 100; est.max = Math.round(est.max / 100) * 100;
    const budget = c.budget;
    let status = '', cls = 'lv0';
    if (budget) {
      if (est.max <= budget) { status = `予算内です（最大でも残り ${yen(budget - est.max)}）`; cls = 'lv0'; }
      else if (est.min <= budget) { status = `予算を超える可能性があります（最大 ${yen(est.max - budget)} オーバー）`; cls = 'lv1'; }
      else { status = `予算オーバーの見込みです（最低でも ${yen(est.min - budget)} 超過）`; cls = 'lv2'; }
    }
    const scale = Math.max(est.max, budget) * 1.1 || 1;
    w.innerHTML = `
      <div class="card">
        <div class="muted">1人あたりの合計（目安）</div>
        <div class="cost-total">${yenR(est.min, est.max)}</div>
        <div class="muted">${c.people}人の合計：${yenR(est.min * c.people, est.max * c.people)}</div>
        ${budget ? `<div class="budget-bar"><div class="rng" style="left:${est.min / scale * 100}%;width:${Math.max(1, (est.max - est.min) / scale * 100)}%"></div><div class="bud" style="left:${budget / scale * 100}%"></div></div>
        <div class="muted">▮ 予算 ${yen(budget)}／人</div>
        <p style="margin-top:8px"><span class="badge ${cls}">${status}</span></p>` : '<p class="note">予算を入力すると差額を表示します。</p>'}
      </div>
      <div class="card">
        <h2>内訳（1人あたり）</h2>
        ${est.items.map(i => `<div class="cost-row"><div><div class="lbl">${i.label}</div><div class="src">${esc(i.src)}</div></div><div class="amt">${yenR(i.min, i.max)}</div></div>`).join('')}
      </div>
      <div class="card">
        <h2>予約について</h2>
        <p class="muted">宿泊・交通の予約は外部サイトで行ってください（本アプリでは手配・販売は行いません）。</p>
        <div class="row" style="margin-top:10px">
          <a class="btn btn-ghost" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/travel/hotels/${encodeURIComponent(CITIES[c.city].name)}">🏨 宿を探す</a>
          <a class="btn btn-ghost" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CITIES[c.city].baseName)}&travelmode=transit">🚄 行き方</a>
        </div>
      </div>
      <p class="note">※ 費用はあくまで目安です。実際の料金は時期・プラン・為替等により変わります。「推定」は相場からの概算、「取得元」はデータに基づく金額です。</p>`;
  }

  /* ================================================================
   * 4. 現地モード（地図＋ボトムシート）
   * ================================================================ */
  let localMap, localLayer, meMarker, routeLine, markers = {};
  let watchId = null;

  function localCity() { return S.trip ? S.trip.cond.city : $('#fCity').value; }

  function openLocal() {
    if (!window.L) { $('#sheetBody').innerHTML = '<div class="empty">地図を読み込めませんでした。電波の良い場所で再度お試しください。<br>旅程はオフラインでも「旅程」タブで確認できます。</div>'; return; }
    if (!localMap) {
      localMap = L.map('localMap', { zoomControl: false, attributionControl: true, tap: true });
      tileLayer().addTo(localMap);
      localLayer = L.layerGroup().addTo(localMap);
      localMap.on('dragstart', () => setFollow(false));
      localMap.on('rotate', () => {});
      const city = CITIES[localCity()];
      localMap.setView(city.center, 14);
      initSheet();
    }
    setTimeout(() => localMap.invalidateSize(), 30);
    startGeo();
    renderLocal(true);
  }

  function startGeo() {
    const city = CITIES[localCity()];
    const demo = () => {
      if (S.me && !S.me.demo) return;
      S.me = { lat: city.center[0], lng: city.center[1], demo: true };
      $('#demoBanner').style.display = '';
      $('#demoBanner').textContent = `📍 デモ位置（${city.name}中心）を表示中`;
      updateMe();
    };
    if (!S.me || (S.me.demo && km([S.me.lat, S.me.lng], city.center) > 1)) demo();
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(p => {
      const pt = [p.coords.latitude, p.coords.longitude];
      if (km(pt, CITIES[localCity()].center) > 40) { // 目的地から遠い＝出発前。デモ位置で表示
        $('#demoBanner').style.display = '';
        $('#demoBanner').textContent = `📍 ${CITIES[localCity()].name}から離れているため、デモ位置を表示中`;
        return;
      }
      S.me = { lat: pt[0], lng: pt[1], demo: false, acc: p.coords.accuracy };
      $('#demoBanner').style.display = 'none';
      updateMe();
      renderLocal(false);
    }, () => { /* 拒否・取得失敗：デモ位置のまま */ }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });

    // 方位（対応端末のみ）
    const onOri = e => {
      const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
      if (h == null) return;
      S.heading = h;
      const cone = $('.me-dot .cone');
      if (cone) { cone.style.display = 'block'; cone.style.transform = `rotate(${h}deg)`; }
      $('#compass span').style.transform = `rotate(${-h}deg)`;
    };
    window.addEventListener('deviceorientationabsolute', onOri);
    window.addEventListener('deviceorientation', onOri);
  }

  function updateMe() {
    if (!localMap || !S.me) return;
    const pt = [S.me.lat, S.me.lng];
    if (!meMarker) {
      meMarker = L.marker(pt, { icon: L.divIcon({ className: '', html: '<div class="me-dot"><div class="cone"></div></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 2000, interactive: false }).addTo(localMap);
    } else meMarker.setLatLng(pt);
    if (S.follow && !S.local.detail) localMap.panTo(pt, { animate: true });
  }

  function setFollow(on) {
    S.follow = on;
    $('#btnFollow').classList.toggle('on', on);
    if (on && S.me) localMap.setView([S.me.lat, S.me.lng], Math.max(localMap.getZoom(), 15), { animate: true });
  }

  function filteredSpots() {
    const f = S.local, now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const mode = S.trip ? S.trip.cond.transport : 'walk';
    const me = S.me ? [S.me.lat, S.me.lng] : CITIES[localCity()].center;
    return SPOTS.filter(s => s.city === localCity()).map(s => ({ s, t: travelMin(me, ll(s), mode), cl: crowdLevel(s, now.getDay(), now.getHours()), open: isOpenAt(s, nowMin) }))
      .filter(x => (!f.within || x.t <= f.within) && (!f.open || x.open) && (!f.cat || x.s.cats.includes(f.cat))
        && (f.budget === '' || (x.s.fee + x.s.food) <= +f.budget) && (!f.quiet || x.cl === 0) && (!f.fav || S.favs.has(x.s.id)))
      .sort((a, b) => a.t - b.t);
  }

  function spotCardHTML(s, meta, extra) {
    const inTrip = S.trip && S.trip.plan.some(d => d.includes(s.id));
    return `<div class="spot-card" data-id="${s.id}">
      <div class="spot-thumb" style="background:${thumbBg(s)}">${spotIcon(s)}</div>
      <div class="spot-info"><div class="nm">${esc(s.name)}${inTrip ? ' <span class="badge lv0">旅程</span>' : ''}</div>
        <div class="meta">${meta || ''}${extra || ''}</div>
        <div class="meta">${s.cats.map(c => CATS[c].label).join('・')} ・ ${s.fee ? yen(s.fee) : '入場無料'}</div></div>
      <button class="fav-btn" data-fav="${s.id}" aria-label="お気に入り">${S.favs.has(s.id) ? '★' : '☆'}</button>
    </div>`;
  }

  function renderLocal(fit) {
    if (!localMap) return;
    if (S.local.detail) return renderDetailInSheet();
    const list = filteredSpots();
    const mode = S.trip ? S.trip.cond.transport : 'walk';
    $('#sheetTitle').textContent = `周辺のスポット ${list.length}件`;
    $('#sheetBody').innerHTML = list.length ? list.map(x => spotCardHTML(x.s,
      `${MODES[mode].icon} ${x.t < 1 ? 'すぐ' : '約' + Math.round(x.t) + '分'} ・ <span style="color:${x.open ? 'var(--ok)' : 'var(--ng)'}">${x.open ? '営業中' : '営業時間外'}</span> ・ `,
      `<span class="badge lv${x.cl}">${CROWD_LABEL[x.cl]}</span>`)).join('') + `<p class="note">混雑：${CROWD_SOURCE}</p>`
      : `<div class="empty"><div class="big">🔍</div><p>条件に合うスポットがありません。<br>絞り込みをゆるめてみてください。</p></div>`;
    // ピン
    localLayer.clearLayers(); markers = {};
    if (routeLine) { routeLine.remove(); routeLine = null; }
    list.forEach(x => {
      const html = `<div class="pin sm" style="background:${CROWD_COLOR[x.cl]}"><span>${spotIcon(x.s)}</span></div>`;
      const m = L.marker(ll(x.s), { icon: L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 28] }) });
      m.on('click', () => { highlight(x.s.id, 'map'); });
      m.addTo(localLayer); markers[x.s.id] = m;
    });
    if (fit && list.length && S.local.within) {
      const b = L.latLngBounds(list.map(x => ll(x.s))); if (S.me) b.extend([S.me.lat, S.me.lng]);
      localMap.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
    }
    observeCards();
  }

  let hlId = null;
  function highlight(id, from) {
    if (hlId && markers[hlId]) { const el = markers[hlId].getElement(); el && el.firstChild && el.firstChild.classList.remove('hl'); }
    $$('#sheetBody .spot-card.hl').forEach(c => c.classList.remove('hl'));
    hlId = id;
    const m = markers[id];
    if (m) { const el = m.getElement(); el && el.firstChild && el.firstChild.classList.add('hl'); m.setZIndexOffset(1000); }
    const card = $(`#sheetBody .spot-card[data-id="${id}"]`);
    if (card) card.classList.add('hl');
    if (from === 'map') {
      // 地図 → リスト：シートを半分まで出して該当カードへスクロール
      if (sheetState === 'min') snapSheet('half');
      if (card) { suppressObserve = true; card.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => suppressObserve = false, 700); }
    } else if (from === 'list' && m) {
      // リスト → 地図：該当ピンへ移動（シートで隠れない位置に）
      setFollow(false);
      panVisible(m.getLatLng());
    }
  }
  function panVisible(latlng) {
    const sheetH = sheetVisibleH();
    const mapH = $('#localMap').clientHeight;
    const target = localMap.latLngToContainerPoint(latlng);
    const desiredY = (mapH - sheetH) / 2 + 40;
    const dx = target.x - localMap.getSize().x / 2, dy = target.y - desiredY;
    localMap.panBy([dx, dy], { animate: true, duration: 0.35 });
  }

  // リストのスクロールに合わせて地図のピンを移動（地図とリストの同期）
  let io, suppressObserve = false, ioTimer;
  function observeCards() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(entries => {
      if (suppressObserve || sheetState !== 'half') return;
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!vis) return;
      clearTimeout(ioTimer);
      ioTimer = setTimeout(() => highlight(vis.target.dataset.id, 'list'), 120);
    }, { root: $('#sheetBody'), rootMargin: '0px 0px -70% 0px', threshold: 0 });
    $$('#sheetBody .spot-card').forEach(c => io.observe(c));
  }

  /* ---------- スポット詳細（シート内で表示：全画面遷移しない） ---------- */
  function spotDetailHTML(s, opts) {
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const cl = crowdLevel(s, now.getDay(), now.getHours());
    const bars = []; for (let h = 7; h <= 22; h++) bars.push(h);
    const me = S.me ? [S.me.lat, S.me.lng] : null;
    const times = me ? Object.keys(MODES).map(k => ({ k, t: travelMin(me, ll(s), k) })) : [];
    const open = isOpenAt(s, nowMin);
    return `<div class="detail">
      ${opts && opts.back ? '<button class="btn btn-sm btn-ghost" data-back style="margin-bottom:8px">‹ 一覧へ戻る</button>' : ''}
      <div class="detail-photo" style="background:${thumbBg(s)}">${spotIcon(s)}<span class="cap">写真は本番で Places API から表示</span></div>
      <h3>${esc(s.name)} <button class="fav-btn" data-fav="${s.id}" aria-label="お気に入り">${S.favs.has(s.id) ? '★' : '☆'}</button></h3>
      <p class="muted">${esc(s.desc)}</p>
      <dl class="kv">
        <dt>営業時間</dt><dd>${openText(s)} <span style="color:${open ? 'var(--ok)' : 'var(--ng)'};font-weight:700">${open ? '営業中' : '営業時間外'}</span></dd>
        <dt>料金</dt><dd>${s.fee ? `入場 ${yen(s.fee)}` : '入場無料'}${s.food ? `・飲食の目安 ${yen(s.food)}` : ''}</dd>
        <dt>滞在目安</dt><dd>${dur(s.stay)}</dd>
        <dt>屋内/屋外</dt><dd>${s.indoor ? '屋内（雨でもOK）' : '屋外中心'}${s.queue ? '・行列ができやすい' : ''}</dd>
        <dt>混雑目安</dt><dd><span class="badge lv${cl}">今：${CROWD_LABEL[cl]}</span></dd>
      </dl>
      <div class="crowd-chart">${bars.map(h => { const l = crowdLevel(s, now.getDay(), h); return `<div class="${h === now.getHours() ? 'now' : ''}" style="height:${(l + 1) * 33}%;background:${CROWD_COLOR[l]}" title="${h}時：${CROWD_LABEL[l]}"></div>`; }).join('')}</div>
      <div class="crowd-axis"><span>7時</span><span>12時</span><span>17時</span><span>22時</span></div>
      <p class="note">混雑は${CROWD_SOURCE}です。あくまで目安としてご利用ください。</p>
      ${me ? `<h4 style="margin-top:12px;font-size:14px">ここへの行き方（${S.me.demo ? 'デモ位置' : '現在地'}から）</h4>
      <div class="route-cmp">${times.map(x => `<button data-route="${x.k}" class="${S.local.routeMode === x.k && S.local.detail === s.id ? 'on' : ''}">${MODES[x.k].icon} ${MODES[x.k].label}<b>${x.t < 1 ? 'すぐ' : dur(x.t)}</b></button>`).join('')}</div>` : ''}
      <div class="detail-actions">
        <a class="btn btn-pri" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" data-gmaps href="${gmapsURL(s, S.local.routeMode || (S.trip ? S.trip.cond.transport : 'walk'))}">ここへ行く（Googleマップ）</a>
        <button class="btn" data-addtrip="${s.id}">${S.trip && S.trip.plan.some(d => d.includes(s.id)) ? '旅程に追加済み' : '＋ 旅程に追加'}</button>
      </div>
    </div>`;
  }
  const gmapsURL = (s, mode) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=${MODES[mode].gmaps}`;

  function bindDetail(root, s) {
    $$('[data-route]', root).forEach(b => b.addEventListener('click', () => {
      S.local.routeMode = b.dataset.route;
      $$('[data-route]', root).forEach(x => x.classList.toggle('on', x === b));
      const a = $('[data-gmaps]', root); if (a) a.href = gmapsURL(s, b.dataset.route);
      if (localMap && root.id === 'sheetBody') drawRouteLine(s);
    }));
    const add = $('[data-addtrip]', root);
    if (add) add.addEventListener('click', () => addToTrip(s.id, root));
  }

  function drawRouteLine(s) {
    if (routeLine) routeLine.remove();
    if (!S.me) return;
    routeLine = L.polyline([[S.me.lat, S.me.lng], ll(s)], { color: '#1f6feb', weight: 4, dashArray: '6 8', opacity: 0.85 }).addTo(localMap);
  }

  function renderDetailInSheet() {
    const s = SPOT[S.local.detail];
    $('#sheetTitle').textContent = s.name;
    $('#sheetBody').innerHTML = spotDetailHTML(s, { back: true });
    $('#sheetBody').scrollTop = 0;
    bindDetail($('#sheetBody'), s);
    // 選んだスポット以外のピンを薄く
    Object.entries(markers).forEach(([id, m]) => { const el = m.getElement(); if (el) el.style.opacity = id === s.id ? 1 : 0.35; });
    if (!markers[s.id]) {
      markers[s.id] = L.marker(ll(s), { icon: L.divIcon({ className: '', html: `<div class="pin sm hl" style="background:var(--pri)"><span>${spotIcon(s)}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] }) }).addTo(localLayer);
    }
    if (S.local.routeMode) drawRouteLine(s);
    setFollow(false);
    panVisible(L.latLng(ll(s)));
  }

  function openDetail(id) {
    S.local.detail = id;
    if (sheetState === 'min') snapSheet('half');
    renderDetailInSheet();
  }
  function closeDetail() {
    S.local.detail = null; S.local.routeMode = null;
    if (routeLine) { routeLine.remove(); routeLine = null; }
    renderLocal(false);
  }

  function addToTrip(id, root) {
    const s = SPOT[id];
    if (S.trip && S.trip.plan.some(d => d.includes(id))) return toast('すでに旅程に入っています');
    if (!S.trip || S.trip.cond.city !== s.city) {
      // 旅程が無ければ、その場で「今日」の1日旅程をつくる
      const now = new Date();
      const cond = { city: s.city, origin: 'same', date: now.toISOString().slice(0, 10), days: 1, start: Math.max(now.getHours() * 60 + now.getMinutes(), 0), end: 21 * 60, people: 1, budget: 0, transport: 'walk', pace: 'normal', interests: [], excl: [] };
      cond.start = Math.round(cond.start / 15) * 15;
      if (cond.end - cond.start < 120) cond.end = Math.min(1440, cond.start + 240);
      S.trip = { id: 't' + Date.now().toString(36), name: `${CITIES[s.city].name} 今日の予定`, cond, plan: [[]], stays: {}, warn: [], createdAt: Date.now(), updatedAt: Date.now() };
      S.activeDay = 0;
    }
    const day = S.trip.plan[S.activeDay];
    const before = computeDay(S.trip, S.activeDay);
    const pos = insertBest(day, id);
    const after = computeDay(S.trip, S.activeDay);
    touchTrip();
    const shift = Math.round(after.finish - before.finish);
    toast(`${S.activeDay + 1}日目の${pos + 1}番目に追加。${day.length > pos + 1 ? `後続の予定は約${shift}分後ろにずれます` : `${hm(after.stops[pos].arrive)}頃に到着予定`}`);
    if (root) { const b = $('[data-addtrip]', root); if (b) b.textContent = '旅程に追加済み'; }
  }

  /* ---------- ボトムシート（3段階スワイプ） ---------- */
  let sheetState = 'half';
  const SHEET_MIN = 92;
  function sheetHeights() {
    const H = $('#view-local').clientHeight;
    return { min: SHEET_MIN, half: Math.round(H * 0.45), full: H - 8 };
  }
  function sheetVisibleH() { return sheetHeights()[sheetState]; }
  function applySheet(visible, anim) {
    const sh = $('#sheet'), H = sheetHeights();
    sh.style.height = H.full + 'px';
    sh.classList.toggle('anim', !!anim);
    sh.style.transform = `translateY(${H.full - visible}px)`;
    $('#mapFabs').style.bottom = (Math.min(visible, H.half) + 12) + 'px';
  }
  // シートは常に全画面の高さで translateY するため、隠れている分だけ下に余白を付けて最後までスクロールできるようにする
  function padSheetBody() {
    const H = sheetHeights();
    $('#sheetBody').style.paddingBottom = (H.full - H[sheetState] + 16) + 'px';
  }
  function snapSheet(state) {
    sheetState = state;
    applySheet(sheetHeights()[state], true);
    padSheetBody();
    $$('#localViewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === (state === 'full' ? 'list' : 'map')));
    if (state === 'full') setFollow(false);
  }
  function initSheet() {
    const handle = $('#sheetHandle'), body = $('#sheetBody');
    let startY = 0, startVis = 0, dragging = false, lastY = 0, lastT = 0, vel = 0, fromBody = false;
    const begin = (y, isBody) => { dragging = true; fromBody = isBody; startY = lastY = y; lastT = performance.now(); startVis = sheetVisibleH(); vel = 0; $('#sheet').classList.remove('anim'); };
    const move = y => {
      if (!dragging) return;
      const H = sheetHeights();
      const now = performance.now();
      vel = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
      const vis = Math.max(H.min, Math.min(H.full, startVis - (y - startY)));
      applySheet(vis, false);
    };
    const end = () => {
      if (!dragging) return; dragging = false;
      const H = sheetHeights();
      const vis = startVis - (lastY - startY);
      let target;
      if (Math.abs(vel) > 0.5) { // フリック
        const order = ['min', 'half', 'full'], i = order.indexOf(sheetState);
        target = vel < 0 ? order[Math.min(2, i + 1)] : order[Math.max(0, i - 1)];
      } else {
        target = Object.keys(H).reduce((a, k) => Math.abs(H[k] - vis) < Math.abs(H[a] - vis) ? k : a, 'half');
      }
      snapSheet(target);
    };
    handle.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; begin(e.clientY, false); handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', e => move(e.clientY));
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    // リスト先頭で下に引っぱった時・半分表示で上に引っぱった時はシート自体を動かす
    let tStartY = 0, tMode = null;
    body.addEventListener('touchstart', e => { tStartY = e.touches[0].clientY; tMode = null; }, { passive: true });
    body.addEventListener('touchmove', e => {
      const y = e.touches[0].clientY, dy = y - tStartY;
      if (tMode === null && Math.abs(dy) > 6) {
        if ((dy > 0 && body.scrollTop <= 0) || (dy < 0 && sheetState !== 'full')) { tMode = 'sheet'; begin(tStartY, true); }
        else tMode = 'scroll';
      }
      if (tMode === 'sheet') { e.preventDefault(); move(y); }
    }, { passive: false });
    body.addEventListener('touchend', () => { if (tMode === 'sheet') end(); tMode = null; });
    window.addEventListener('resize', () => { applySheet(sheetVisibleH(), false); padSheetBody(); });
    applySheet(sheetHeights().half, false); padSheetBody();

    body.addEventListener('click', e => {
      const fav = e.target.closest('[data-fav]');
      if (fav) return toggleFav(fav.dataset.fav, fav);
      if (e.target.closest('[data-back]')) return closeDetail();
      const card = e.target.closest('.spot-card');
      if (card) openDetail(card.dataset.id);
    });
    $('#localViewSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      snapSheet(b.dataset.v === 'list' ? 'full' : 'half');
    });
  }

  function toggleFav(id, btn) {
    if (S.favs.has(id)) S.favs.delete(id); else S.favs.add(id);
    store.set('tp_favs', [...S.favs]);
    $$(`[data-fav="${id}"]`).forEach(b => b.textContent = S.favs.has(id) ? '★' : '☆');
    toast(S.favs.has(id) ? 'お気に入りに追加しました' : 'お気に入りから外しました');
    if (S.local.fav && currentView === 'local' && !S.local.detail) renderLocal(false);
  }

  function initLocal() {
    $('#flCat').innerHTML = '<option value="">ジャンル</option>' + Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join('');
    const sync = () => {
      $('#flWithin').classList.toggle('on', !!S.local.within);
      $('#flCat').classList.toggle('on', !!S.local.cat);
      $('#flBudget').classList.toggle('on', S.local.budget !== '');
      $('#flOpen').classList.toggle('on', S.local.open);
      $('#flQuiet').classList.toggle('on', S.local.quiet);
      $('#flFav').classList.toggle('on', S.local.fav);
      S.local.detail = null;
      renderLocal(true);
    };
    $('#flWithin').addEventListener('change', e => { S.local.within = +e.target.value; sync(); });
    $('#flCat').addEventListener('change', e => { S.local.cat = e.target.value; sync(); });
    $('#flBudget').addEventListener('change', e => { S.local.budget = e.target.value; sync(); });
    $('#flOpen').addEventListener('click', () => { S.local.open = !S.local.open; sync(); });
    $('#flQuiet').addEventListener('click', () => { S.local.quiet = !S.local.quiet; sync(); });
    $('#flFav').addEventListener('click', () => { S.local.fav = !S.local.fav; sync(); });
    $('#btnFollow').addEventListener('click', () => setFollow(!S.follow));
    $('#compass').addEventListener('click', () => { if (S.me) setFollow(true); toast(S.heading == null ? '地図は常に北が上です' : `向いている方角：${Math.round(S.heading)}°`); });
  }

  /* ================================================================
   * 6. マイ旅程
   * ================================================================ */
  function renderMine() {
    const saved = store.get('tp_trips', []);
    const favs = SPOTS.filter(s => S.favs.has(s.id));
    $('#mineWrap').innerHTML = `
      <div class="card"><h2>保存した旅程</h2>
        ${saved.length ? saved.map(t => `<div class="trip-item cost-row">
          <div class="ti" data-open="${esc(t.id)}"><b>${esc(t.name)}</b><span class="muted">${t.cond.date ? esc(t.cond.date) + ' ・ ' : ''}${t.plan.flat().length}スポット ・ 更新 ${new Date(t.updatedAt).toLocaleDateString('ja-JP')}</span></div>
          <button class="btn btn-sm btn-ghost" data-rename="${esc(t.id)}">名前</button>
          <button class="btn btn-sm btn-ghost" data-remove="${esc(t.id)}" style="color:var(--ng)">削除</button></div>`).join('')
        : '<p class="muted">旅程画面の「保存」でここに保存されます（この端末のみ）。</p>'}
      </div>
      <div class="card"><h2>★ お気に入りスポット</h2>
        ${favs.length ? favs.map(s => spotCardHTML(s, CITIES[s.city].name + ' ・ ')).join('') : '<p class="muted">スポット詳細の ☆ をタップすると追加されます。</p>'}
      </div>
      <div class="card"><h2>このアプリについて</h2>
        <p class="muted">デモ版のため、データはこの端末（ブラウザ）にのみ保存されます。ログインして複数端末で同期する機能は今後対応予定です。位置情報は周辺スポットの表示にのみ使い、保存・送信はしません。</p>
        <p class="note">地図データ © OpenStreetMap contributors／地図ライブラリ Leaflet</p>
      </div>`;
  }
  function initMine() {
    $('#mineWrap').addEventListener('click', e => {
      const t = e.target.closest('[data-open],[data-remove],[data-rename],[data-fav],.spot-card'); if (!t) return;
      const saved = store.get('tp_trips', []);
      if (t.dataset.fav) return toggleFav(t.dataset.fav, t), renderMine();
      if (t.classList.contains('spot-card')) return openSpotModal(t.dataset.id);
      const id = t.dataset.open || t.dataset.remove || t.dataset.rename;
      const i = saved.findIndex(x => x.id === id); if (i < 0) return;
      if (t.dataset.open) { S.sharedFrom = false; setTrip(saved[i]); }
      else if (t.dataset.remove) { if (confirm(`「${saved[i].name}」を削除しますか？`)) { saved.splice(i, 1); store.set('tp_trips', saved); renderMine(); } }
      else if (t.dataset.rename) {
        const n = prompt('旅程の名前', saved[i].name);
        if (n && n.trim()) { saved[i].name = n.trim().slice(0, 60); store.set('tp_trips', saved); if (S.trip && S.trip.id === id) S.trip.name = saved[i].name; renderMine(); }
      }
    });
    // 旅程モーダル内のお気に入り（共通）
    $('#modal').addEventListener('click', e => { const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); toggleFav(f.dataset.fav, f); } });
  }

  /* ---------- 地図タイル ---------- */
  function tileLayer() {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    });
  }

  /* ================================================================
   * 起動
   * ================================================================ */
  function init() {
    initForm(); initTrip(); initLocal(); initMine();
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.view); });
    document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { closeModal(); show(g.dataset.go); } });

    const m = location.hash.match(/#trip=([A-Za-z0-9_-]+)/);
    const shared = m && decodeTrip(m[1]);
    if (shared) {
      S.sharedFrom = true;
      history.replaceState(null, '', location.pathname + location.search);
      setTrip(shared);
      toast('共有された旅程を開きました');
    } else {
      const cur = store.get('tp_current', null);
      if (cur && cur.plan && cur.cond && CITIES[cur.cond.city]) {
        cur.plan = cur.plan.map(d => d.filter(id => SPOT[id]));
        S.trip = cur;
      }
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  init();
})();
