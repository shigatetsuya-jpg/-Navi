(function () {
  var cfg = window.SITE_CONFIG || {};

  // 季節のキャッチコピーを反映（設定がなければ HTML に書かれた通年版のまま）
  var copy = cfg.catchCopies && cfg.catchCopies[cfg.season];
  if (copy) {
    var main = document.getElementById("catch-main");
    var lead = document.getElementById("catch-lead");
    if (main && copy.main) main.innerHTML = copy.main;
    if (lead && copy.lead) lead.innerHTML = copy.lead;
  }

  // LINEボタンのURLを設定ファイルの値にそろえる
  if (cfg.lineUrl) {
    document.querySelectorAll(".js-line").forEach(function (a) { a.href = cfg.lineUrl; });
  }

  // ヒーローのボタンやページ末尾のCTAが見えている間は、下部固定ボタンを隠す（ボタンの重複を避ける）
  var fixed = document.getElementById("fixed-cta");
  var targets = ["hero-cta", "contact"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (fixed && targets.length && "IntersectionObserver" in window) {
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      fixed.classList.toggle("is-hidden", Object.keys(visible).some(function (k) { return visible[k]; }));
    }, { threshold: 0.2 });
    targets.forEach(function (t) { io.observe(t); });
  }
})();
