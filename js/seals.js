/* 六枚烟火印：吃了 / 喝了 / 遇见 / 路过 / 拍了 / 搭话
 * 六类各记满一条 → 街尾那盏灯自己亮，浮出「今日已圆满」。
 * 只读 #j-body 的渲染结果，不改动 ui.js 的任何逻辑。
 */
(function () {
  var KINDS = [`吃了`, `喝了`, `遇见`, `路过`, `拍了`, `搭话`];
  var panel = document.getElementById(`seal-reward`);
  var meter = document.getElementById(`seal-meter`);
  var closeBtn = document.getElementById(`sr-close`);
  var unlocked = false;
  var seen = {};
  /* 手账现在会跨刷新保留：页面刚打开时先把已有的类别记成“已看过”，
     不再为旧记录一枚枚弹提示，也不在开机时突然盖一张「今日已圆满」。 */
  var primed = false;

  function currentKinds() {
    var have = {};
    var jb = document.getElementById(`j-body`);
    if (!jb) return have;
    var nodes = jb.querySelectorAll(`.j-kind`);
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || ``).trim();
      if (KINDS.indexOf(t) >= 0) have[t] = 1;
    }
    return have;
  }

  function toast(msg) {
    var el = document.createElement(`div`);
    el.className = `seal-toast`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.className = `seal-toast out`; }, 1900);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
  }

  function paint() {
    /* 等 ui.js 把手账恢复并渲染完，否则会把“空手账”当成初始状态 */
    if (!window.__journalReady) return;
    var have = currentKinds();
    var n = 0;
    var miss = [];
    for (var i = 0; i < KINDS.length; i++) {
      if (have[KINDS[i]]) n++;
      else miss.push(KINDS[i]);
    }
    for (var j = 0; j < KINDS.length; j++) {
      var k = KINDS[j];
      if (have[k] && !seen[k]) {
        seen[k] = 1;
        /* 第一遍只是把页面打开前就有的手账“认下来”，不重复弹印 */
        if (primed) toast(`得到一枚「` + k + `」印 · ` + n + ` / 6`);
      }
    }
    if (meter) {
      meter.textContent = `烟火印 · ` + n + ` / 6` + (n >= KINDS.length ? `　齐了` : `　还差：` + miss.join(`、`));
    }
    var seals = document.querySelectorAll(`.sr-seal`);
    for (var s = 0; s < seals.length; s++) {
      var kind = seals[s].getAttribute(`data-kind`);
      seals[s].classList.toggle(`on`, !!have[kind]);
    }
    if (primed && n >= KINDS.length && !unlocked) { unlocked = true; openPanel(); }
    if (!primed) { unlocked = n >= KINDS.length; primed = true; }
    return n;
  }

  function openPanel() {
    if (!panel) return;
    panel.classList.add(`show`);
    panel.setAttribute(`aria-hidden`, `false`);
    document.body.classList.add(`all-seals`);
    toast(`六枚烟火印，齐了。街尾的灯亮了。`);
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove(`show`);
    panel.setAttribute(`aria-hidden`, `true`);
  }

  function boot() {
    var body = document.getElementById(`j-body`);
    if (body && window.MutationObserver) {
      new MutationObserver(paint).observe(body, { childList: true, subtree: true });
    }
    if (closeBtn) closeBtn.addEventListener(`click`, closePanel);
    if (panel) {
      panel.addEventListener(`click`, function (e) { if (e.target === panel) closePanel(); });
      document.addEventListener(`keydown`, function (e) {
        if (e.key === `Escape` && panel.classList.contains(`show`)) closePanel();
      });
    }
    /* ui.js 是 module，可能比这个 defer 脚本晚一步；等它把手账渲染完再认第一遍 */
    var tries = 0;
    (function waitJournal() {
      if (window.__journalReady || tries++ > 80) {
        window.__journalReady = true;
        paint();
        setInterval(paint, 1500);
        return;
      }
      setTimeout(waitJournal, 50);
    })();
  }

  if (document.readyState === `loading`) document.addEventListener(`DOMContentLoaded`, boot);
  else boot();
})();