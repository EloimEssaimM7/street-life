/* ============================================================
   烟火人间 · 界面层
   时辰牌 / 今日手账 / 拍照 / 移动端摇杆
   ============================================================ */

const STORE_KEY = 'yanhuo.journal.v1';

const TIME_TABLE = [
  { at: 7, shichen: '辰时', clock: '07:00', verdict: '蒸笼刚上气' },
  { at: 12, shichen: '午时', clock: '12:00', verdict: '日头正毒，摊子缩进檐下' },
  { at: 18, shichen: '酉时', clock: '18:00', verdict: '灯一盏一盏亮起来' },
  { at: 21, shichen: '戌时', clock: '21:00', verdict: '夜市正热闹' },
];

const $ = (id) => document.getElementById(id);
const body = document.body;

/* ---------------- 时辰牌 ---------------- */
const shichenEl = $('shichen');
const clockEl = $('clock');
const verdictEl = $('verdict');

function nearestTime(t) {
  let best = TIME_TABLE[0];
  let bd = 1e9;
  for (const row of TIME_TABLE) {
    const d = Math.abs(row.at - t);
    if (d < bd) { bd = d; best = row; }
  }
  return best;
}

function paintTime(t, animate = true) {
  const row = nearestTime(t);
  if (!shichenEl || !row) return;
  const apply = () => {
    shichenEl.textContent = row.shichen;
    clockEl.textContent = row.clock;
    verdictEl.textContent = row.verdict;
    const dateEl = $('j-date');
    if (dateEl) dateEl.textContent = '青石巷 · ' + row.shichen;
  };
  if (animate) {
    shichenEl.style.opacity = '0';
    clockEl.style.opacity = '0';
    verdictEl.style.opacity = '0';
    setTimeout(() => {
      apply();
      shichenEl.style.opacity = '1';
      clockEl.style.opacity = '1';
      verdictEl.style.opacity = '1';
    }, 180);
  } else {
    apply();
  }
}

for (const el of [shichenEl, clockEl, verdictEl]) {
  if (el) el.style.transition = 'opacity 0.18s ease';
}

paintTime(7, false);

document.querySelectorAll('.time-btn').forEach((btn) => {
  btn.addEventListener('click', () => paintTime(Number(btn.dataset.time)));
});

/* ---------------- 今日手账 ---------------- */
const journalEl = $('journal');
const jBody = $('j-body');
const jBadge = $('jBadge');
const jCount = $('j-count');

/* 手账按「自然日」保存：同一天刷新、关掉浏览器再打开都还在；
   跨天自动换一本新的。页面里落款、离街小票、烟火印都从同一个键读，
   所以历史只在这里恢复，别的模块不用各写一套。 */
const JOURNAL_DAY_KEY = 'yanhuo.journal.day.v1';
const WRAP_KEY = 'yanhuo.wrap.v1';

function dayOf(ts = Date.now()) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function readSameDayJournal() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const today = dayOf();
  return list
    .filter((e) => e && e.kind && typeof e.t === 'number' && dayOf(e.t) === today)
    .slice(-60);
}

const TODAY_KEY = dayOf();
let entries = readSameDayJournal();

try {
  const lastVisitDay = localStorage.getItem(JOURNAL_DAY_KEY);
  let onlyOld = false;
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    onlyOld = Array.isArray(raw) && raw.length > 0 && entries.length === 0;
  } catch {}
  /* 换了一天：昨天的「小结」也一起收起来，今天重新攒 */
  if ((lastVisitDay && lastVisitDay !== TODAY_KEY) || onlyOld) localStorage.removeItem(WRAP_KEY);
  localStorage.setItem(JOURNAL_DAY_KEY, TODAY_KEY);
  if (entries.length) localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  else localStorage.removeItem(STORE_KEY);
} catch {}

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entries.slice(-60))); } catch {}
}

function renderJournal() {
  if (!jBody) return;
  if (!entries.length) {
    jBody.innerHTML = '<p class="j-empty">还没记下什么。<br>进店看看菜单，或者跟路上的人说句话。<br><span class="j-keep">同一天关掉再打开，手账还在</span></p>';
  } else {
    jBody.innerHTML = entries.map((e) => `
      <div class="j-item">
        <div class="j-kind">${e.kind}</div>
        <div class="j-name">${e.name}</div>
        ${e.note ? `<div class="j-note">${e.note}</div>` : ''}
      </div>`).join('');
    jBody.scrollTop = jBody.scrollHeight;
  }
  if (jCount) jCount.textContent = `共 ${entries.length} 笔`;
  if (jBadge) {
    jBadge.textContent = entries.length > 99 ? '99+' : String(entries.length);
    jBadge.classList.toggle('show', entries.length > 0);
  }
}

const STAMP_CHAR = { '吃了': '吃', '喝了': '饮', '拍了': '影', '路过': '过', '遇见': '记', '摇柠檬': '摇', '做题': '卷', '买了': '买' };

function stampPop(kind) {
  const btn = $('btnJournal');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'stamp-pop';
  el.textContent = STAMP_CHAR[kind] || '记';
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1050);
}
function addEntry(kind, name, note = '') {
  if (!name) return;
  const last = entries[entries.length - 1];
  /* 同一个观察者偶尔会连着触发两次，只拦 2.5 秒内的重复；
     过了这个窗口，同一件事再做一次仍然照记（刷新后也不会被上一条挡住） */
  if (last && last.kind === kind && last.name === name && Date.now() - last.t < 2500) return;
  entries.push({ kind, name, note, t: Date.now() });
  persist();
  renderJournal();
  api('/api/journal', { kind, name, note }).then((r) => { if (r && r.today) { todayStats = r.today; renderStats(); } }).catch(() => {});
  jBadge?.classList.remove('show');
  const jb = btnJournal;
  if (jb) {
    jb.classList.remove('stamp-flash');
    void jb.offsetWidth;
    jb.classList.add('stamp-flash');
    setTimeout(() => jb.classList.remove('stamp-flash'), 950);
  }
  requestAnimationFrame(() => jBadge?.classList.add('show'));
}

renderJournal();
/* 手账恢复完再放行 seals.js：免得它先把空列表当成初始状态 */
window.__journalReady = true;

/* ---------------- 一点点后台：今日到访 / 手账统计 ---------------- */
const jStatsEl = $('j-stats');
let todayStats = null;

function renderStats() {
  if (!jStatsEl || !todayStats) return;
  const visits = todayStats.visits || 0;
  const notes = todayStats.journal || 0;
  jStatsEl.textContent = visits ? `今日 ${visits} 人走过 · ${notes} 笔手账` : '';
}

async function api(path, body) {
  const opt = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(path, opt);
  if (!res.ok) throw new Error('api ' + res.status);
  return res.json();
}

(async () => {
  try {
    const s = await api('/api/stats');
    todayStats = s.today || null;
    renderStats();
    if (!sessionStorage.getItem('yanhuo.visited')) {
      sessionStorage.setItem('yanhuo.visited', '1');
      const v = await api('/api/visit', { at: Date.now() });
      if (v && v.today) { todayStats = v.today; renderStats(); }
    }
  } catch {
    /* 直接开 index.html 或没起服务器时，安静降级，不报错 */
  }
})();

function setJournal(open) {
  journalEl?.classList.toggle('show', open);
  journalEl?.setAttribute('aria-hidden', open ? 'false' : 'true');
  body.classList.toggle('journal-open', open);
  if (!photoMode) hideHud(open);
}

$('btnJournal')?.addEventListener('click', () => setJournal(!journalEl?.classList.contains('show')));
journalEl?.addEventListener('click', (e) => {
  if (e.target === journalEl) setJournal(false);
});
$('j-close')?.addEventListener('click', (e) => { e.stopPropagation(); setJournal(false); });
$('j-clear')?.addEventListener('click', () => {
  entries = [];
  try {
    localStorage.removeItem(STORE_KEY);
    /* 擦掉重写，也让「小结」有机会再出现一次 */
    localStorage.removeItem(WRAP_KEY);
  } catch {}
  renderJournal();
});

/* 点菜 → 记一笔 */
const dishName = $('dish-name');
const dishView = $('dish-view');
if (dishName) {
  new MutationObserver(() => {
    const name = (dishName.textContent || '').trim();
    const visible = dishView && getComputedStyle(dishView).opacity > 0.1;
    if (name && visible) addEntry('吃了', name, '在青石巷拐角的小店里');
  }).observe(dishName, { childList: true, characterData: true, subtree: true });
}

/* 搭话 → 记一笔 */
const bubble = $('life-bubble');
if (bubble) {
  let lastText = '';
  new MutationObserver(() => {
    const text = (bubble.textContent || '').trim();
    const SYS = new Set(['汽还差一口气。', '快了，盖子开始响了。', '掀盖了，热气扑脸。', '亮了。', '这一排，都亮了。', '呼噜…呼噜…']);
    if (text && text !== lastText && bubble.classList.contains('show') && !SYS.has(text)) {
      lastText = text;
      addEntry('遇见', '有人说了句', `「${text}」`);
    }
  }).observe(bubble, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

/* 菊花茶 */
const teaCard = $('tea-card');
if (teaCard) {
  new MutationObserver(() => {
    if (teaCard.classList.contains('show')) addEntry('喝了', '菊花茶', '老药铺的粗瓷碗，杭白菊冲开，清苦回甘');
  }).observe(teaCard, { attributes: true, attributeFilter: ['class'] });
}

/* ---------------- 拍照 ---------------- */
const photoUI = $('photo-ui');
let photoMode = false;
/* 拍照默认是锁着的：去照相馆解锁，记在本地 */
const PHOTO_KEY = 'yh_photo_unlocked_v2';
// 拍照每开一次页面都要重新解锁：只在本页有效，不写 localStorage
let photoUnlocked = false;
try { localStorage.removeItem(PHOTO_KEY); } catch {}
function applyPhotoLock() { document.body.classList.toggle('photo-locked', !photoUnlocked); }
function unlockPhoto() {
  photoUnlocked = true;
  applyPhotoLock();

  if (typeof say === 'function') say('相机拿出来了。');
}
applyPhotoLock();

function renderScene() {
  const s = window.__street;
  if (s?.renderer && s?.scene && s?.camera) {
    try { s.renderer.render(s.scene, s.camera); } catch {}
  }
}

function polaroid(rawUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const padW = Math.round(img.width * 0.055);
      const padB = Math.round(img.width * 0.14);
      const W = img.width + padW * 2;
      const H = img.height + padW + padB;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#f7f1e3'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 1600; i += 1) {
        g.fillStyle = 'rgba(120,100,70,' + (0.02 + Math.random() * 0.03) + ')';
        g.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2);
      }
      g.drawImage(img, padW, padW, img.width, img.height);
      g.strokeStyle = 'rgba(90,74,52,0.22)'; g.lineWidth = 1;
      g.strokeRect(padW + 0.5, padW + 0.5, img.width - 1, img.height - 1);
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      const when = d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + '  ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(36,29,23,0.66)';
      g.font = '22px "KaiTi","STKaiti","Microsoft YaHei",serif';
      g.fillText('烟火人间 · 青石巷', padW + 4, H - padB * 0.62);
      g.fillStyle = 'rgba(36,29,23,0.42)';
      g.font = '17px "KaiTi","STKaiti",serif';
      const meters = Math.round((window.__life && window.__life.walked) || 0);
      g.fillText(when + '   ·   第 ' + meters + ' 米', padW + 4, H - padB * 0.26);
      const sq = Math.round(padB * 0.56);
      const sx = W - padW - sq, sy = H - padB + (padB - sq) / 2;
      g.fillStyle = '#b23a2f'; g.fillRect(sx, sy, sq, sq);
      g.fillStyle = '#fff3e2'; g.textAlign = 'center';
      g.font = Math.round(sq * 0.5) + 'px "KaiTi",serif';
      g.fillText('烟', sx + sq / 2, sy + sq / 2 + 1);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(rawUrl);
    img.src = rawUrl;
  });
}

async function takeShot() {
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  renderScene();
  let url = '';
  try { url = canvas.toDataURL('image/png'); } catch { return; }
  url = await polaroid(url);
  const stamp = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `烟火人间-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.png`;
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  addEntry('拍了', '一张街景', name.replace('.png', ''));
  updatePhotoMeta();
  critiqueShot();
}

function flash() {
  const el = document.createElement('div');
  el.id = 'flash';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('go'));
  setTimeout(() => el.remove(), 520);
}

const HUD_IDS = ['hud-tag', 'time-ui', 'hud-tools', 'life-sound', 'pad', 'speed-panel', 'btnTurn', 'hint', 'stick', 'scene-hint'];

function hideHud(on) {
  for (const id of HUD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.opacity = on ? '0' : '';
    el.style.pointerEvents = on ? 'none' : '';
    el.style.display = on ? 'none' : '';
  }
}

function updatePhotoMeta() {
  const el = document.getElementById('photo-meta');
  if (!el) return;
  const meters = Math.round((window.__life && window.__life.walked) || 0);
  const shichen = (document.getElementById('shichen') || {}).textContent || '';
  el.textContent = shichen + ' · 第 ' + meters + ' 米';
}
function setPhotoMode(on) {
  photoMode = on;
  if (on) updatePhotoMeta();
  photoUI?.classList.toggle('on', on);
  photoUI?.setAttribute('aria-hidden', on ? 'false' : 'true');
  body.classList.toggle('photo-mode', on);
  hideHud(on);
  if (!on && journalEl?.classList.contains('show')) hideHud(true);
}

$('btnPhoto')?.addEventListener('click', () => setPhotoMode(!photoMode));
$('shutter')?.addEventListener('click', () => {
  if (!photoMode) return;
  flash();
  setTimeout(takeShot, 90);
});
  $('ph-exit')?.addEventListener('click', () => setPhotoMode(false));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (photoMode) setPhotoMode(false);
    else if (journalEl?.classList.contains('show')) setJournal(false);
  }
  if (e.key === ' ' && photoMode) { e.preventDefault(); flash(); setTimeout(takeShot, 90); }
});

/* 深链：?shop=照相馆 直接进取景 */
try {
  const q = new URLSearchParams(location.search).get('shop');
  if (q === '照相馆' && photoUnlocked) setTimeout(function () { setPhotoMode(true); }, 1600);
} catch (err) { /* ignore */ }

/* ---------------- 提示语淡出 ---------------- */
const hintEl = $('hint');
let hintTimer = null;
function fadeHint(delay = 9000) {
  if (!hintEl || hintTimer) return;
  hintTimer = setTimeout(() => hintEl.classList.add('fade'), delay);
}

/* ---------------- 移动端摇杆 ---------------- */
const stick = $('stick');
const knob = stick?.querySelector('.knob');
if (stick && knob) {
  let active = null;
  let cx = 0, cy = 0;
  const radius = 38;
  const keys = { fwd: false, back: false, left: false, right: false };

  const press = (code, down) => {
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true });
    window.dispatchEvent(ev);
  };

  const release = () => {
    if (keys.fwd) { press('KeyW', false); keys.fwd = false; }
    if (keys.back) { press('KeyS', false); keys.back = false; }
    if (keys.left) { press('KeyA', false); keys.left = false; }
    if (keys.right) { press('KeyD', false); keys.right = false; }
    knob.style.transform = 'translate(0px, 0px)';
  };

  const move = (dx, dy) => {
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / radius);
    const nx = (dx / len) * radius * k;
    const ny = (dy / len) * radius * k;
    knob.style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;

    const wantFwd = dy < -radius * 0.35;
    const wantBack = dy > radius * 0.35;
    const wantLeft = dx < -radius * 0.35;
    const wantRight = dx > radius * 0.35;

    if (wantFwd !== keys.fwd) { press('KeyW', wantFwd); keys.fwd = wantFwd; }
    if (wantBack !== keys.back) { press('KeyS', wantBack); keys.back = wantBack; }
    if (wantLeft !== keys.left) { press('KeyA', wantLeft); keys.left = wantLeft; }
    if (wantRight !== keys.right) { press('KeyD', wantRight); keys.right = wantRight; }
    if (wantFwd || wantBack || wantLeft || wantRight) fadeHint(400);
  };

  stick.addEventListener('pointerdown', (e) => {
    active = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e.clientX - cx, e.clientY - cy);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (active !== e.pointerId) return;
    move(e.clientX - cx, e.clientY - cy);
    e.preventDefault();
  });
  const end = (e) => {
    if (active !== e.pointerId) return;
    active = null;
    release();
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  stick.addEventListener('lostpointercapture', end);
}

/* ---------------- 开场 ---------------- */
body.classList.add('is-intro');

const intro = $('intro');
const startBtn = $('startBtn');
const guideEl = $('guide');
function showGuide() {
  if (!guideEl || localStorage.getItem('yanhuo.guide.v1')) return;
  setTimeout(() => guideEl.classList.add('show'), 900);
  const close = () => {
    guideEl.classList.remove('show');
    localStorage.setItem('yanhuo.guide.v1', '1');
  };
  $('guideOk')?.addEventListener('click', close, { once: true });
  setTimeout(close, 16000);
}

startBtn?.addEventListener('click', () => {
  body.classList.remove('is-intro');
  fadeHint(11000);
  /* 推门之后先把「怎么逛这条街」摊开，收起时再让左下角那张小提示露个脸 */
  setTimeout(() => {
    if (!openHelpCard()) showGuide();
  }, 720);
});

const helpPanelEl = document.getElementById('help-panel');
function openHelpCard() {
  if (!helpPanelEl || typeof window.__toggleHelp !== 'function') return false;
  window.__toggleHelp(true);
  return true;
}
if (helpPanelEl) {
  new MutationObserver(() => {
    if (!helpPanelEl.classList.contains('show')) showGuide();
  }).observe(helpPanelEl, { attributes: true, attributeFilter: ['class'] });
}

const startWatch = new MutationObserver(() => {
  if (!document.getElementById('intro')) {
    body.classList.remove('is-intro');
    startWatch.disconnect();
  }
});
startWatch.observe(document.body, { childList: true });

addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    fadeHint(400);
  }
});

/* 进店时把市声压低一点，像门一关 */
function duckAmbience(f) {
  try { window.__life?.duckAmbience?.(f); } catch { /* 没加载完就算了 */ }
}

const interiorEl = $('interior-view');
if (interiorEl) {
  new MutationObserver(() => {
    duckAmbience(interiorEl.classList.contains('show') ? 0.22 : 1);
  }).observe(interiorEl, { attributes: true, attributeFilter: ['class'] });
}
/* 手账里能看到今天走过的地方：进店也记一笔 */
const shopModal = $('shop-modal');
const modalName = $('modal-shop-name');
if (shopModal && modalName) {
  new MutationObserver(() => {
    const open = shopModal.classList.contains('show');
    const name = (modalName.textContent || '').trim();
    duckAmbience(open ? 0.42 : 1);
    if (open && name) addEntry('路过', name, '门口探了一眼');
    if (open) syncShopAction();
  }).observe(shopModal, { attributes: true, attributeFilter: ['class'] });
}

function resetPhotoLock() { photoUnlocked = false; try { localStorage.removeItem(PHOTO_KEY); } catch {} applyPhotoLock(); }

window.__ui = { resetPhotoLock, addEntry, setJournal, setPhotoMode, polaroid, drawReceipt, takeReceipt, receiptRows, unlockPhoto, photoUnlocked: () => photoUnlocked };

// 时间自己走：每 0.35 秒收到一次当前时刻，换算成时辰与分钟
const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHICHEN_VERDICT = {
  子: '街还醒着', 丑: '最静的时辰', 寅: '天将亮未亮', 卯: '第一笼包子',
  辰: '蒸笼刚上气', 巳: '街面最热闹', 午: '日头正毒', 未: '摊子缩进檐下',
  申: '日头偏西', 酉: '灯一盏一盏亮起来', 戌: '夜市正热闹', 亥: '收摊的推车声'
};

function paintLiveTime(t) {
  const idx = Math.floor(((t + 1) % 24) / 2) % 12;
  const bare = SHICHEN_NAMES[idx];
  const name = bare + '时';
  const hh = String(Math.floor(t)).padStart(2, '0');
  const mm = String(Math.floor((t % 1) * 60)).padStart(2, '0');
  if (shichenEl) shichenEl.textContent = name;
  if (clockEl) clockEl.textContent = hh + ':' + mm;
  if (verdictEl) verdictEl.textContent = SHICHEN_VERDICT[bare] || '';
  const jd = document.getElementById('j-date');
  if (jd) jd.textContent = '青石巷 · ' + name;
}

window.addEventListener('yanhuo:time', (e) => {
  paintLiveTime(e.detail);
  try {
    const a = window.__life && window.__life.ambience;
    if (a && a.enabled) {
      const want = a.bedForHour(e.detail);
      if (want !== a.bedUrl) a.setBed(want, a.bedVolume ? a.bedVolume(want) : 0.5);
    }
  } catch {}
});
/* ---------- 互动：吆喝、点灯、帮衬、落雨、今日一页 ---------- */

const promptEl = document.getElementById('action-hint');
function setPrompt(text) {
  if (!promptEl) return;
  const t = text || '';
  if (promptEl.dataset.text === t) return;
  promptEl.dataset.text = t;
  promptEl.textContent = t;
  promptEl.classList.toggle('show', !!t);
}
window.__ui = window.__ui || {};
window.__ui.setPrompt = setPrompt;

/* ---------- 走近场景时的一张操作小纸片 ----------
   第一次引导只讲主干；E / G / 空格 / 长按 / 拖杯子这些，
   等人真的走到猫、推车、奶茶店、包子铺跟前再递一句。
   提示只在本页跟着位置走，不写 localStorage，也不打扰内景与纸面页。 */
const sceneHintEl = document.getElementById('scene-hint');
const shPlaceEl = document.getElementById('sh-place');
const shLineEl = document.getElementById('sh-line');
let lemonUsed = false;
let sceneHintKey = '';

function sceneOpen(id) {
  const el = document.getElementById(id);
  return !!(el && el.classList.contains('show'));
}

function sceneHintBlocked() {
  if (body.classList.contains('is-intro') || body.classList.contains('photo-mode') ||
      body.classList.contains('reading') || body.classList.contains('journal-open')) return true;
  return sceneOpen('shop-modal') || sceneOpen('interior-view') || sceneOpen('dish-view') ||
    sceneOpen('help-panel') || sceneOpen('guide') || sceneOpen('talk-box') ||
    sceneOpen('tea-house') || sceneOpen('qianli-read') || sceneOpen('rhythm') ||
    sceneOpen('cup-hint') || sceneOpen('gate-ui');
}

function hideSceneHint() {
  if (!sceneHintEl || !sceneHintKey) return;
  sceneHintKey = '';
  sceneHintEl.classList.remove('show');
  sceneHintEl.setAttribute('aria-hidden', 'true');
}

function showSceneHint(key, place, line) {
  if (!sceneHintEl || !shPlaceEl || !shLineEl) return;
  if (sceneHintKey === key) return;
  sceneHintKey = key;
  shPlaceEl.textContent = place;
  shLineEl.innerHTML = line;
  sceneHintEl.classList.add('show');
  sceneHintEl.setAttribute('aria-hidden', 'false');
}

const journalHas = (kind) => entries.some((e) => e.kind === kind);

function pickSceneHint() {
  const L = window.__life;
  if (!L || !L.camera) return null;

  /* 夜市推车：走近后按空格帮老板翻串 */
  if (L.nearCart && !journalHas('帮衬')) {
    return { key: 'cart', place: '夜市推车', line: '按<b>空格</b>，帮老板翻串' };
  }

  /* 猫：它跟着你走的时候不提示，免得挡路；顺过毛也不再提 */
  if (L.cat && !(L.catFollowUntil > L.clock) && !journalHas('顺毛')) {
    const cam = L.camera.position;
    const dx = L.cat.position.x - cam.x;
    const dz = L.cat.position.z - cam.z;
    if (dx * dx + dz * dz < 14) {
      return { key: 'cat', place: '脚边的猫', line: '<b>长按</b>猫咪，给它顺顺毛' };
    }
  }

  const shop = L.nearShop;
  if (!shop) return null;

  if (shop.name === '奶茶店' && !lemonUsed) {
    const cup = window.__lemonCup && typeof window.__lemonCup.state === 'function'
      ? window.__lemonCup.state() : null;
    if (cup && cup.exists && !cup.done) {
      return { key: 'naicha-cup', place: '奶茶店 · 门口', line: '按住门口那杯，上下拖<b>四次</b>' };
    }
    return { key: 'naicha', place: '奶茶店', line: '进店点「摇一杯柠檬水」，门口按住杯子拖<b>四次</b>' };
  }

  if (shop.name === '包子铺' && !journalHas('守候')) {
    return { key: 'baozi', place: '包子铺 · 门口', line: '在门口站一会儿，等<b>第一笼</b>包子' };
  }

  return { key: 'talk:' + shop.name, place: shop.name + ' · 摊前', line: '按<b>E</b>，与老板搭话' };
}

function tickSceneHint() {
  if (sceneHintBlocked()) { hideSceneHint(); return; }
  const next = pickSceneHint();
  if (!next) { hideSceneHint(); return; }
  showSceneHint(next.key, next.place, next.line);
}

setInterval(tickSceneHint, 360);

window.addEventListener('yanhuo:journal', (e) => {
  const d = e.detail || {};
  if (!d.kind) return;
  addEntry(d.kind, d.name || '', d.note || '');
  checkWrapup();
});

const wrapEl = document.getElementById('wrapup');
function checkWrapup() {
  if (!wrapEl) return;
  if (localStorage.getItem(WRAP_KEY)) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (err) { return; }
  if (list.length < 5) return;
  localStorage.setItem(WRAP_KEY, '1');
  const kinds = list.map((it) => it.kind).filter(Boolean);
  const uniq = Array.from(new Set(kinds)).slice(0, 4).join('、');
  document.getElementById('wu-count').textContent = list.length + ' 件';
  document.getElementById('wu-note').textContent = uniq ? ('这一趟：' + uniq + '。') : '这一趟，街上有了你的脚印。';
  wrapEl.classList.add('show');
  wrapEl.setAttribute('aria-hidden', 'false');
}
const wuClose = document.getElementById('wuClose');
if (wuClose) {
  wuClose.addEventListener('click', () => {
    wrapEl.classList.remove('show');
    wrapEl.setAttribute('aria-hidden', 'true');
  });
}
window.__ui.checkWrapup = checkWrapup;

const rainBtn = document.getElementById('btnRain');
if (rainBtn) {
  rainBtn.addEventListener('click', () => {
    const on = !(window.__life && window.__life.rainOn);
    if (window.__life && window.__life.setRain) window.__life.setRain(on);
    rainBtn.classList.toggle('on', on);
    setPrompt(on ? '' : '');
  });
}

/* 点菜：手账记一笔，行上冒一下热气 */
document.addEventListener('click', (ev) => {
  const row = ev.target.closest && ev.target.closest('.mp-row');
  if (!row) return;
  const name = (row.querySelector('.mp-name') || {}).textContent || '';
  addEntry('点了', name.trim(), '烫，先吹吹');
  row.classList.add('hot');
  setTimeout(() => row.classList.remove('hot'), 1500);
});

/* 街尾小票 */
const receiptBtn = document.getElementById('btnReceipt');
if (receiptBtn) receiptBtn.addEventListener('click', takeReceipt);

/* 街尾落款：把今天的手账画成一张纸 */
const sealBtn = document.getElementById('btnSealToday');
function exportToday() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (err) { list = []; }
  const W = 900, H = 1240;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6edda'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(36,29,23,.22)'; g.lineWidth = 2; g.strokeRect(46, 46, W - 92, H - 92);
  g.textAlign = 'center';
  g.fillStyle = '#241d17'; g.font = '600 46px serif';
  g.fillText('今 日 手 账', W / 2, 152);
  const shi = document.getElementById('shichen');
  g.font = '20px serif'; g.fillStyle = 'rgba(36,29,23,.55)';
  g.fillText('青石巷 · ' + (shi ? shi.textContent : ''), W / 2, 192);
  g.strokeStyle = 'rgba(36,29,23,.16)'; g.beginPath(); g.moveTo(150, 226); g.lineTo(W - 150, 226); g.stroke();
  g.textAlign = 'left';
  let y = 300;
  list.slice(0, 11).forEach((it) => {
    g.fillStyle = '#b23a2f'; g.font = '16px sans-serif';
    g.fillText(it.kind || '', 112, y);
    g.fillStyle = '#241d17'; g.font = '600 26px serif';
    g.fillText(it.name || '', 112, y + 34);
    if (it.note) {
      g.fillStyle = 'rgba(36,29,23,.6)'; g.font = '18px serif';
      g.fillText(it.note, 112, y + 62);
    }
    y += 92;
  });
  g.fillStyle = '#b23a2f'; g.fillRect(W - 196, H - 176, 98, 98);
  g.fillStyle = '#fff3e2'; g.font = '42px serif'; g.textAlign = 'center';
  g.fillText('烟', W - 147, H - 112);
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = '今日手账-' + new Date().toISOString().slice(0, 10) + '.png';
  a.click();
  addEntry('落款', '今日一页', '');
}
if (sealBtn) sealBtn.addEventListener('click', exportToday);
window.__ui.exportToday = exportToday;
/* ---------- 手机：在画面上左右拖 = 转头 ---------- */
const sceneEl = document.getElementById('scene');
let lookFromX = 0;
let lookDragging = false;
if (sceneEl) {
  sceneEl.style.touchAction = 'none';
  sceneEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    lookDragging = true;
    lookFromX = e.clientX;
  });
  sceneEl.addEventListener('pointermove', (e) => {
    if (!lookDragging) return;
    const dx = e.clientX - lookFromX;
    if (Math.abs(dx) < 26) return;
    const code = dx > 0 ? 'KeyD' : 'KeyA';
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), 130);
    lookFromX = e.clientX;
  });
  const stop = () => { lookDragging = false; };
  sceneEl.addEventListener('pointerup', stop);
  sceneEl.addEventListener('pointercancel', stop);
  sceneEl.addEventListener('pointerleave', stop);
}
/* ---------- 打字搭话 ---------- */
const talkBox = document.getElementById('talk-box');
const talkInput = document.getElementById('tb-input');
let talkReply = null;
function openTalk(who, onReply) {
  if (!talkBox || !talkInput) return;
  talkReply = onReply;
  document.getElementById('tb-who').textContent = who || '摊主';
  talkInput.value = '';
  talkBox.classList.add('show');
  talkBox.setAttribute('aria-hidden', 'false');
  setTimeout(() => talkInput.focus(), 60);
}
function closeTalk(text) {
  if (!talkBox) return;
  talkBox.classList.remove('show');
  talkBox.setAttribute('aria-hidden', 'true');
  talkInput.blur();
  const cb = talkReply;
  talkReply = null;
  if (cb) cb(text);
}
if (talkInput) {
  talkInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); closeTalk(talkInput.value); }
    else if (ev.key === 'Escape') { ev.preventDefault(); closeTalk(null); }
    ev.stopPropagation();
  });
}

/* ---------- 长按圆环 ---------- */
const holdEl = document.getElementById('hold-ring');
const holdFill = document.getElementById('hr-fill');
function holdRing(show, x, y, p) {
  if (!holdEl) return;
  holdEl.classList.toggle('show', !!show);
  if (!show) return;
  holdEl.style.left = x + 'px';
  holdEl.style.top = y + 'px';
  const deg = Math.round(Math.min(1, p) * 360);
  holdFill.style.background = 'conic-gradient(rgba(246,237,218,.85) ' + deg + 'deg, rgba(246,237,218,.15) ' + deg + 'deg)';
}

/* ---------- 打更：跟着拍子敲空格 ---------- */
const rhythmEl = document.getElementById('rhythm');
const rhythmDots = document.getElementById('rh-dots');
const rhythmTip = document.getElementById('rh-tip');
let rhythm = null;
const BEAT_MS = 900;
const HIT_WINDOW = 260;

function startRhythm() {
  if (!rhythmEl || rhythm) return;
  rhythmDots.innerHTML = '';
  for (let i = 0; i < 6; i += 1) {
    const d = document.createElement('i');
    rhythmDots.appendChild(d);
  }
  rhythmTip.textContent = '跟着亮起的格子敲空格';
  rhythmEl.classList.add('show');
  rhythmEl.setAttribute('aria-hidden', 'false');
  rhythm = { i: -1, hits: 0, t0: performance.now(), done: false };
  requestAnimationFrame(rhythmTick);
}

function rhythmTick(now) {
  if (!rhythm) return;
  const step = Math.floor((now - rhythm.t0) / BEAT_MS);
  if (step > rhythm.i && !rhythm.done) {
    if (step >= 6) { finishRhythm(); return; }
    rhythm.i = step;
    Array.from(rhythmDots.children).forEach((d, k) => d.classList.toggle('on', k === step));
  }
  requestAnimationFrame(rhythmTick);
}

function hitRhythm(now) {
  if (!rhythm || rhythm.done) return;
  const dt = Math.abs(now - (rhythm.t0 + (rhythm.i + 0.5) * BEAT_MS));
  if (dt > HIT_WINDOW) return;
  const dot = rhythmDots.children[rhythm.i];
  if (dot && !dot.classList.contains('hit')) {
    dot.classList.add('hit');
    rhythm.hits += 1;
  }
}

function finishRhythm() {
  rhythm.done = true;
  rhythmTip.textContent = '命中了 ' + rhythm.hits + ' / 6 更';
  addEntry('打更', '夜里敲了六下', '梆子声传出去老远');
  setTimeout(() => {
    rhythmEl.classList.remove('show');
    rhythmEl.setAttribute('aria-hidden', 'true');
    rhythm = null;
  }, 1600);
}

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyG' && !talkReply) startRhythm();
  else if (ev.code === 'Space' && rhythm) { ev.preventDefault(); hitRhythm(performance.now()); }
});

window.__ui = window.__ui || {};
window.__ui.openTalk = openTalk;
window.__ui.holdRing = holdRing;
window.__ui.startRhythm = startRhythm;
/* ---------------- 拍完给一句评价 ---------------- */
function showNote(text) {
  const el = document.createElement('div');
  el.id = 'photo-note';
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  }, 2400);
}

function critiqueShot() {
  let line = '稳当的一张。';
  const L = window.__life;
  if (L && L.camera) {
    const cam = L.camera;
    const V = cam.position.constructor;
    let ppl = 0;
    for (const p of L.people) {
      const v = new V();
      p.getWorldPosition(v);
      if (v.distanceTo(cam.position) < 15) ppl += 1;
    }
    const night = (L.night || 0) > 0.5;
    if (ppl >= 3 && night) line = '人多，灯也亮，这张有味道。';
    else if (ppl >= 3) line = '画面里三个人，热闹。';
    else if (night) line = '只有灯，安静，也挺好。';
    else if (ppl === 0) line = '空街一张，留个念想。';
    else line = '一个人走过，正好。';
  }
  showNote(line);
}

/* ---------------- 讨价还价 ---------------- */
/* 有些铺子不谈价：点「能便宜点吗」，老板把话写在柜台的照片上（一句完整的回绝） */
const BARGAIN_MOMENTS = {
  '书店': {
    img: 'images/interior/ershoushu.jpg',
    line: { who: '老板', text: '旧书都按标价，概不还价，您多担待。', x: 52, y: 18 }
  },
  // 烟酒副食店：这里不谈价，进门买两样，老板顺手把一句劝摆在相片旁边
  '烟酒副食店': {
    img: 'images/interior/yanjiu.jpg',
    note: {
      who: '老板的话',
      text: '烟伤肺，酒伤肝，这话我得说在前头。买归买，少抽一口、少喝一杯，家里人还等着你回去。'
    },
    kind: '买烟酒', journal: '少抽一口，少喝一杯'
  },
  // 奶茶店：不谈价，进门排队——柜台那张铺满屏幕，等 4 秒，再等 2 秒，茶就端上来了
  '奶茶店': {
    frames: [
      {
        src: 'images/interior/naichadian.png', big: true, hold: 4000,
        line: { who: '店员', text: '请稍作等待，前方有4杯正在制作中……', x: 80, y: 37 }
      },
      { src: 'images/interior/naichadiandan.png', hold: 2000, caption: '终于轮到制作你点的奶茶了。' },
      { src: 'images/interior/naicha.jpg', caption: '奶香先冒头，茶味随后到；吸管一插到底，珍珠还带着余温。' }
    ],
    kind: '等奶茶', journal: '前面还有四杯'
  }
};
const bargainBtn = document.getElementById('bargain-btn');
const bargainLine = document.getElementById('bargain-line');
const bargained = new Set();
if (bargainBtn && bargainLine) {
  bargainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = (document.getElementById('modal-shop-name') || {}).textContent || '这家';
    const key = name + new Date().toDateString();
    const moment = BARGAIN_MOMENTS[name];
    if (moment && typeof window.__shopMoment === 'function') {
      try { window.__shopMoment(moment); } catch (err) { /* 灯箱不可用时退回一句话 */ }
      bargainLine.textContent = '';
      if (!bargained.has(key)) { bargained.add(key); addEntry(moment.kind || '砍价', name, moment.journal || '概不还价'); }
      return;
    }
    if (bargained.has(key)) {
      bargainLine.textContent = '老板：刚说过了，真不能再让。';
      return;
    }
    bargained.add(key);
    const roll = Math.random();
    const txt = roll < 0.34
      ? '老板：抹个零吧，下回还来。'
      : roll < 0.68
        ? '老板：给你多添一勺，价不还。'
        : '老板笑了：这价，已经是街坊价。';
    bargainLine.textContent = txt;
    addEntry('砍价', name, txt.replace('老板：', '').slice(0, 16));
  });
}
/* ---------- 顶部导航与三张纸面 ---------- */
const navEl = document.getElementById('nav');
const pagesEl = document.getElementById('pages');
const pageEls = {
  about: document.getElementById('page-about'),
  shops: document.getElementById('page-shops'),
  today: document.getElementById('page-today')
};

function pad2(n) { return String(n).padStart(2, '0'); }

function buildShopList() {
  const list = document.getElementById('shop-list');
  if (!list || list.dataset.built === '1') return;
  const info = window.__shopInfo || {};
  const sig = window.__shopSignature || {};
  const order = window.__shopOrder || Object.keys(info);
  const names = order.concat(Object.keys(info).filter(function (n) { return order.indexOf(n) === -1; }));
  for (const name of names) {
    const cfg = info[name] || {};
    const card = document.createElement('article');
    card.className = 'shop-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const s = sig[name] || [];
    const hours = (cfg.open != null && cfg.close != null)
      ? pad2(cfg.open) + ':00 — ' + pad2(cfg.close) + ':00'
      : '天黑才出摊';
    card.innerHTML = '<h3>' + name + '</h3>'
      + '<p>' + (s.length ? s[0] + '　' + s[1] : '街边小店') + '</p>'
      + '<small>' + hours + '</small>';
    const go = function () { gotoShop(name); };
    card.addEventListener('click', go);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    list.appendChild(card);
  }
  list.dataset.built = '1';
}

function gotoShop(name) {
  showView('street');
  setTimeout(function () {
    try { window.showShopModal(name); } catch (err) { /* 店铺未就绪 */ }
  }, 380);
}

/* 手账里只写到「时辰 时:分」，别把毫秒时间戳直接摆出来 */
function entryClock(t) {
  const d = t ? new Date(t) : null;
  if (!d || isNaN(d.getTime())) return '';
  const h = d.getHours();
  const name = SHICHEN_NAMES[Math.floor(((h + 1) % 24) / 2) % 12];
  return name + '时 ' + String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function renderToday() {
  const list = document.getElementById('today-list');
  const stats = document.getElementById('today-stats');
  if (!list || !stats) return;
  const entries = (function () {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  })();
  list.innerHTML = '';
  if (!entries.length) {
    list.innerHTML = '<li><b>空</b><span>今天还没记下什么。</span></li>';
  } else {
    entries.slice(-11).forEach(function (it) {
      const li = document.createElement('li');
      li.innerHTML = '<b>' + (it.kind || '记') + '</b><span>' + (it.name || '') + '</span><em>' + entryClock(it.t) + '</em>';
      list.appendChild(li);
    });
  }
  const kinds = {};
  entries.forEach(function (it) { kinds[it.kind] = (kinds[it.kind] || 0) + 1; });
  const rows = [
    ['记下', entries.length + ' 笔'],
    ['吃过', (kinds['吃了'] || 0) + ' 样'],
    ['喝过', (kinds['喝了'] || 0) + ' 杯'],
    ['搭话', (kinds['搭话'] || kinds['遇见'] || 0) + ' 次'],
    ['点灯', (kinds['点亮'] || 0) + ' 回'],
    ['答卷', (kinds['做题'] || 0) + ' 回'],
    ['帮衬', (kinds['帮衬'] || 0) + ' 次']
  ];
  stats.innerHTML = rows.map(function (r) {
    return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
  }).join('');
}

function showView(name) {
  const onPage = name !== 'street';
  const wasReading = !!(pagesEl && pagesEl.classList.contains('show'));
  document.body.classList.toggle('reading', onPage);
  if (pagesEl) {
    pagesEl.classList.toggle('show', onPage);
    /* 纸→纸翻页要垫一层底纸（新页淡入时别露出街）；从街面第一次进来不垫，保留原来的淡入 */
    pagesEl.classList.toggle('under', onPage && wasReading);
  }
  Object.keys(pageEls).forEach(function (k) {
    if (pageEls[k]) pageEls[k].classList.toggle('on', k === name);
  });
  if (navEl) {
    navEl.querySelectorAll('button[data-view]').forEach(function (b) {
      if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }
  if (typeof window.setStreetPaused === 'function') window.setStreetPaused(onPage);
  if (onPage && typeof setJournal === 'function') setJournal(false);
  if (name === 'shops') buildShopList();
  if (name === 'today') renderToday();
}

if (navEl) {
  navEl.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-view]');
    if (b) showView(b.dataset.view);
  });
}
document.querySelectorAll('.page-btn[data-view]').forEach(function (b) {
  b.addEventListener('click', function () { showView(b.dataset.view); });
});
const todaySealBtn = document.getElementById('today-seal');
if (todaySealBtn) {
  todaySealBtn.addEventListener('click', function () {
    if (window.__ui && typeof window.__ui.exportToday === 'function') window.__ui.exportToday();
  });
}
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && document.body.classList.contains('reading')) showView('street');
});

window.__ui = window.__ui || {};
window.__ui.showView = showView;
window.__ui.gotoShop = gotoShop;

/* ---------- 街尾离街小票 ---------- */
function readJournal() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}

function receiptRows() {
  const entries = readJournal();
  const has = (k) => entries.filter((e) => e.kind === k).length;
  const rows = [
    ['掀笼 / 点菜', has('吃了') + has('点了') + has('守候')],
    ['喝过', has('喝了')],
    ['等过一杯奶茶', has('等奶茶')],
    ['摇过柠檬水', has('摇柠檬')],
    ['说过话', has('搭话') + has('遇见')],
    ['拍过照片', has('拍了')],
    ['点过灯笼', has('点亮')],
    ['帮过摊子', has('帮衬')],
    ['砍过价', has('砍价')],
    ['买过果子', has('买了')],
    ['进画卷做题', has('做题')]
  ].filter((r) => r[1] > 0);
  return { entries, rows };
}

function drawReceipt() {
  const { entries, rows } = receiptRows();
  const walked = Math.round((window.__life && window.__life.walked) || 0);

  const W = 560;
  const H = 176 + rows.length * 34 + 6 + 40 + 30 + 34 + 54 + 30 + 76;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#f4ead4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2200; i += 1) {
    g.fillStyle = 'rgba(120,96,60,' + (0.015 + Math.random() * 0.03) + ')';
    g.fillRect(Math.random() * W, Math.random() * H, 1.3, 1.3);
  }

  // 顶部撕口
  g.fillStyle = '#22201c';
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x < W; x += 20) g.lineTo(x + 10, 12), g.lineTo(x + 20, 0);
  g.lineTo(W, 0); g.closePath(); g.fill();

  g.textAlign = 'center';
  g.fillStyle = 'rgba(36,29,23,0.85)';
  g.font = '26px "KaiTi","STKaiti",serif';
  g.fillText('青 石 巷 · 离 街 小 票', W / 2, 78);
  g.font = '14px "KaiTi",serif';
  g.fillStyle = 'rgba(36,29,23,0.5)';
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  g.fillText(d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + '  ' + p2(d.getHours()) + ':' + p2(d.getMinutes()), W / 2, 108);

  g.strokeStyle = 'rgba(36,29,23,0.35)';
  g.setLineDash([4, 6]);
  g.beginPath(); g.moveTo(46, 132); g.lineTo(W - 46, 132); g.stroke();
  g.setLineDash([]);

  g.textAlign = 'left';
  g.font = '17px "KaiTi",serif';
  g.fillStyle = 'rgba(36,29,23,0.78)';
  let y = 176;
  for (const r of rows) {
    g.fillText(r[0], 60, y);
    g.textAlign = 'right';
    g.fillText(String(r[1]), W - 60, y);
    g.textAlign = 'left';
    y += 34;
  }
  if (!rows.length) {
    g.fillStyle = 'rgba(36,29,23,0.45)';
    g.fillText('这一趟还什么都没做，只是走了一遍。', 60, y);
    y += 34;
  }

  y += 6;
  g.strokeStyle = 'rgba(36,29,23,0.3)';
  g.setLineDash([4, 6]);
  g.beginPath(); g.moveTo(46, y); g.lineTo(W - 46, y); g.stroke();
  g.setLineDash([]);
  y += 40;
  g.font = '16px "KaiTi",serif';
  g.fillStyle = 'rgba(36,29,23,0.62)';
  g.textAlign = 'left';
  g.fillText('走过 ' + walked + ' 米', 60, y);
  y += 30;
  g.fillText('一共 ' + entries.length + ' 件小事', 60, y);
  y += 34;
  g.fillStyle = 'rgba(36,29,23,0.55)';
  g.font = '15px "KaiTi",serif';
  g.fillText('今天走到头了，明天还来吗？', 60, y);

  y += 54;
  g.textAlign = 'left';
  g.font = '15px "KaiTi",serif';
  g.fillStyle = 'rgba(36,29,23,0.42)';
  g.fillText('凭此票再入街，摊子还认得你', 56, y);
  g.font = '13px "KaiTi",serif';
  g.fillText('—— 烟火人间 · 一条老街的十二时辰', 56, y + 30);

  // 朱砂章
  const sq = 84;
  const sx = W - 46 - sq, sy = H - 46 - sq;
  g.save();
  g.translate(sx + sq / 2, sy + sq / 2);
  g.rotate(-0.06);
  g.fillStyle = 'rgba(178,58,47,0.92)';
  g.fillRect(-sq / 2, -sq / 2, sq, sq);
  g.fillStyle = '#fff3e2';
  g.font = '34px "KaiTi",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('来', 0, -20);
  g.fillText('过', 0, 20);
  g.restore();

  return c.toDataURL('image/png');
}

function takeReceipt() {
  const url = drawReceipt();
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const name = '青石巷-离街小票-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.png';
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  showNote('小票收好了，凭它下回还来。');
}
/* ---------- 一键搭把手 ---------- */
/* 「进店看看」独占按钮的铺子：不再给「推两下」，只留一个进门的入口 */
const VISIT_ONLY_SHOPS = new Set(['理发店']);
const SHOP_ACTIONS = {
  '奶茶店': {
    label: '摇一杯柠檬水', sfx: 'audio/sfx/sfx_tea_pour.mp3',
    line: '柠檬在杯壁上撞了四下，冰也化了一半。', kind: '摇柠檬', cup: true
  },
  // 卤肉铺：点一下先看柜台（3 秒），再换到摊前，老板的话落在画面上
  '卤肉铺': {
    label: '称一斤', sfx: 'audio/sfx/sfx_cash_register.mp3', line: '秤砣一压，老板报了个数。', kind: '称肉',
    moment: {
      frames: [
        { src: 'images/interior/luroupu.png.jpg', hold: 3000 },
        { src: 'images/interior/luroupu.png', line: { who: '老板', text: '今早现卤的，您想吃什么，自己挑。', x: 60, y: 17 } }
      ]
    }
  },
  '书店': {
    label: '翻一本', sfx: 'audio/sfx/sfx_pipa_riff.mp3', line: '书页一翻，灰尘在光里飘。', kind: '翻书',
    moment: {
      img: 'images/interior/shu.jpg',
      quote: {
        text: '一盏和一盏路灯相距很远，一段段明亮与明亮之间是一段段黑暗与黑暗，我的影子时而在明亮中显现，时而在黑暗中隐没。凭空而来的风一浪一浪地掀动斑斓的落叶，如同掀动着生命给我的印象。我感觉自己就像是这空空的来风，只在脱落下和旋卷起斑斓的落叶之时，才能捕捉到自己的存在。',
        source: '——史铁生《务虚笔记》'
      }
    }
  },
  '理发店': { label: '推两下', sfx: 'audio/sfx/sfx_notify_klick.mp3', line: '推子贴着后颈走了一圈。', kind: '理发' },
  '杂货店': {
    label: '进店翻找', sfx: 'audio/sfx/sfx_cash_register.mp3', line: '从柜子底下翻出一把旧铜锁，擦掉锈，还能用。', kind: '翻找',
    moment: {
      img: 'images/interior/zahuodian.jpg',
      note: {
        who: '老板的话',
        text: '别看铺子小，麻雀虽小五脏俱全；您要什么，我这儿都翻得出来。'
      }
    }
  },
  '糕点铺': {
    label: '包一盒', sfx: 'audio/sfx/sfx_cutlery_drawer.mp3', line: '油纸一裹，绳子打个十字。', kind: '包点心',
    moment: {
      img: 'images/interior/gaodian.jpg',
      line: { who: '老板', text: '好嘞，您看中哪样，我给您包上。', x: 50, y: 14 }
    }
  },
  '面馆': { label: '下一碗', sfx: 'audio/sfx/sfx_wok_sizzling.mp3', line: '面下进去，汤滚了一滚。', kind: '下面', noodle: true },
  // 照相馆：只保留“解锁拍照”这一件事
  '照相馆': { label: '租借相机', sfx: 'audio/sfx/sfx_notify_klick.mp3', line: '把相机借出来了。', kind: '借相机', unlock: true },
  '茶馆': { label: '沏一壶', sfx: 'audio/sfx/sfx_tea_pour.mp3', line: '提梁壶一倾，茶汤落进碗里。', kind: '沏茶', tea: true },
  '鲜果铺': {
    label: '挑一袋', sfx: 'audio/sfx/sfx_notify_klick.mp3', line: '手指按了按，软硬正好。', kind: '挑果子', fruit: true
  },
  // 古玩店：不谈价，只「掂一掂」；一张摊面照，柜台上的字条立在旁边
  '古玩店': {
    label: '掂一掂', sfx: 'audio/sfx/sfx_pipa_riff.mp3', line: '铜锁在掌心压了一下，沉。', kind: '看旧物',
    moment: {
      img: 'images/interior/guwan.png',
      note: {
        who: '柜台上的字条',
        text: '自己上手挑，凭眼力说话；看走眼不退货，顺走一件，十倍赔钱。'
      },
      journal: '凭眼力说话'
    }
  },
};

const actionBtn = document.getElementById('action-btn');
const MILK = { max: Infinity, tip: '今天的量到了', say: '手打柠檬水一天三杯也够了，冰的喝多了伤胃，留点给明天。' };
function dayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function readMilk() {
  try {
    const all = JSON.parse(localStorage.getItem('yanhuo.milk') || '{}');
    return all[dayKey()] || 0;
  } catch (err) { return 0; }
}
function bumpMilk() {
  try {
    const all = JSON.parse(localStorage.getItem('yanhuo.milk') || '{}');
    all[dayKey()] = (all[dayKey()] || 0) + 1;
    localStorage.setItem('yanhuo.milk', JSON.stringify(all));
    return all[dayKey()];
  } catch (err) { return 1; }
}

/* 门口那杯摇好了：手账记一笔新的动作，再按「一天三杯」的规矩数着 */
window.addEventListener('yanhuo:lemon', function (e) {
  const strokes = (e && e.detail && e.detail.strokes) || 4;
  lemonUsed = true;
  addEntry('摇柠檬', '奶茶店', '在门口自己摇的，摇了 ' + strokes + ' 下，气也顺了。');
  // 普通的“摇好了”交给杯子上那条提示，这里只在到量时多说一句
  if (bumpMilk() >= MILK.max) showNote(MILK.say);
});

function runAction() {
  const name = (document.getElementById('modal-shop-name') || {}).textContent || '';
  const act = SHOP_ACTIONS[name];
  if (!act) return;
  if (name === '奶茶店' && readMilk() >= MILK.max) {
    showNote(MILK.say);
    actionBtn.classList.add('warn');
    setTimeout(function () { actionBtn.classList.remove('warn'); }, 3400);
    return;
  }
  const amb = window.__life && window.__life.ambience;
  if (amb && amb.oneShot) amb.oneShot(act.sfx, 0.5);
  // 奶茶店：不在弹窗里给一句话，而是在店门口摆一杯，让人自己上下摇
  if (act.cup && window.__lemonCup && typeof window.__lemonCup.spawn === 'function') {
    const spawned = window.__lemonCup.spawn();
    try {
      if (typeof window.closeShopModal === 'function') window.closeShopModal();
    } catch (err) {}
    if (spawned === 'ok') {
      setTimeout(function () {
        if (window.__focusCup && !window.__focusCup()) showNote('门口台阶上摆了一杯，走过去按住它上下摇。');
      }, 260);
    } else {
      showNote('杯子还在门口，摇完它再说。');
    }
    const cupCard = document.querySelector('#shop-modal .shop-card');
    if (cupCard) {
      cupCard.classList.remove('acting'); void cupCard.offsetWidth;
      cupCard.classList.add('acting');
      setTimeout(function () { cupCard.classList.remove('acting'); }, 520);
    }
    return;   // 手账等摇完再记
  }
  // 鲜果铺：把摊子铺开，让人自己挑
  if (act.fruit && typeof window.__openFruitPicker === 'function') {
      if (window.__life && window.__life.clink) window.__life.clink();
      window.__openFruitPicker();
      return;
  }
  // 面馆：下一碗 → 打开菜单，选面、加料、下单都在里面
  if (act.noodle && typeof window.__openNoodleShop === 'function') {
      try {
        if (typeof window.closeShopModal === 'function') window.closeShopModal();
      } catch (err) {}
      setTimeout(function () { window.__openNoodleShop(); }, 180);
      return;
  }
  if (act.unlock && typeof window.__photoUnlock === 'function') {
    try {
      if (typeof window.closeShopModal === 'function') window.closeShopModal();
      setTimeout(function () { window.__photoUnlock(); }, 220);
      addEntry(act.kind || '拍', name, act.line);
      actionBtn.disabled = true; setTimeout(function () { actionBtn.disabled = false; }, 1200);
      return;
    } catch (err) {}
  }
  // 照相馆：只有一个功能——解锁拍照
  if (name === '照相馆' && typeof window.__photoUnlock === 'function') {
    try {
      if (typeof window.closeShopModal === 'function') window.closeShopModal();
      setTimeout(function () { window.__photoUnlock(); }, 200);
      addEntry(act.kind || '拍', name, '把相机借出来了');
      actionBtn.disabled = true; setTimeout(function () { actionBtn.disabled = false; }, 1200);
      return;
    } catch (err) {}
  }
  // 茶馆：沏一壶 → 直接进那间茶棚（旁白 + 三张内景轮播）
  if (name === '茶馆' && window.__tea && typeof window.__tea.open === 'function') {
    try {
      addEntry(act.kind, name, act.line);
      if (typeof window.closeShopModal === 'function') window.closeShopModal();
      setTimeout(function () { window.__tea.open(); }, 220);
      actionBtn.disabled = true; setTimeout(function () { actionBtn.disabled = false; }, 1200);
      return;
    } catch (err) {}
  }
  let momentShown = false;
  if (act.moment && typeof window.__shopMoment === 'function') {
    try { window.__shopMoment(act.moment); momentShown = true; } catch (err) { momentShown = false; }
  }
  if (!momentShown) showNote(act.line);
  addEntry(act.kind, name, act.line);
  const card = document.querySelector('#shop-modal .shop-card');
  if (card) {
    card.classList.remove('acting');
    void card.offsetWidth;
    card.classList.add('acting');
    setTimeout(function () { card.classList.remove('acting'); }, 520);
  }
  if (name === '奶茶店' && bumpMilk() >= MILK.max) {
    setTimeout(function () {
      showNote(MILK.say);
      if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = MILK.tip; }
    }, 1400);
  } else {
    actionBtn.disabled = true;
    setTimeout(function () { actionBtn.disabled = false; }, 1200);
  }
}

if (actionBtn) {
  let holdTimer = null;
  const currentAction = function () {
    const el = document.getElementById('modal-shop-name');
    const name = ((el && el.textContent) || '').trim();
    return SHOP_ACTIONS[name] || null;
  };
  actionBtn.addEventListener('pointerdown', function (e) {
    if (actionBtn.disabled) return;
    const act = currentAction();
    if (act && (act.moment || act.cup || act.fruit || act.tea || act.unlock || act.noodle)) return; // 下一碗 / 挑一袋 / 自制柠檬水：点一下就出，不用长按
    e.preventDefault();
    actionBtn.classList.add('holding');
    holdTimer = setTimeout(function () {
      actionBtn.classList.remove('holding');
      runAction();
    }, 520);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
    actionBtn.addEventListener(ev, function () {
      clearTimeout(holdTimer);
      actionBtn.classList.remove('holding');
    });
  });
  actionBtn.addEventListener('click', function () {
    const act = currentAction();
    if (!act || (!act.moment && !act.cup && !act.fruit && !act.tea && !act.unlock && !act.noodle)) return; // 其余店铺仍按住触发
    if (actionBtn.disabled || actionBtn.hidden) return;
    runAction();
  });
  actionBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runAction(); }
  });
}

function syncShopAction() {
  if (!actionBtn) return;
  const modal = document.getElementById('shop-modal');
  const name = (document.getElementById('modal-shop-name') || {}).textContent || '';
  const act = SHOP_ACTIONS[name];
  // 打烊时段（data-open="0"）不给动作按钮，和「能便宜点吗」一起收起来
  const openForAction = !modal || modal.dataset.open !== '0';
  if (!act || !openForAction || VISIT_ONLY_SHOPS.has(name)) {
    actionBtn.hidden = true; actionBtn.textContent = ''; actionBtn.disabled = false; return;
  }
  actionBtn.hidden = false;
  if (name === '奶茶店' && readMilk() >= MILK.max) {
    actionBtn.textContent = MILK.tip;
    actionBtn.disabled = true;
  } else {
    actionBtn.textContent = act.label;
    actionBtn.disabled = false;
  }
}
window.__syncShopAction = syncShopAction;

/* ---------- 画卷 ---------- */
const scrollView = document.getElementById('scroll-view');
const openScroll = document.getElementById('openScroll');
function showScroll(on) {
  if (!scrollView) return;
  scrollView.classList.toggle('show', !!on);
  scrollView.setAttribute('aria-hidden', on ? 'false' : 'true');
}
if (openScroll) {
  openScroll.addEventListener('click', function () { showScroll(true); });
  openScroll.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showScroll(true); }
  });
}
if (scrollView) {
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') showScroll(false); });
  scrollView.addEventListener('click', function (e) {
    if (e.target === scrollView) showScroll(false);
  });
  const strip = scrollView.querySelector('.scroll-strip');
  if (strip) {
    let down = false, startX = 0, startLeft = 0;
    strip.addEventListener('pointerdown', function (e) {
      down = true; startX = e.clientX; startLeft = strip.scrollLeft;
      strip.setPointerCapture(e.pointerId);
    });
    strip.addEventListener('pointermove', function (e) {
      if (!down) return;
      strip.scrollLeft = startLeft - (e.clientX - startX);
    });
    strip.addEventListener('pointerup', function () { down = false; });
    strip.addEventListener('pointercancel', function () { down = false; });
  }
}

/* ---------- 千里江山图 · 文字长卷（点街边山水打开） ---------- */
const qianliRead = document.getElementById('qianli-read');
const qianliClose = document.getElementById('qr-close');
const qianliSheet = qianliRead ? qianliRead.querySelector('.qr-sheet') : null;
let qianliReturnFocus = null;
const qrWar = document.getElementById('qr-war');
const qrExam = document.getElementById('qr-exam');
const qrResult = document.getElementById('qr-result');
const qrFail = document.getElementById('qr-fail');
const qrSubmit = document.getElementById('qr-submit');
const qrAgain = document.getElementById('qr-again');
const qrDone = document.getElementById('qr-done');
const qrLeave = document.getElementById('qr-leave');
const QR_INPUTS = ['qr-a1', 'qr-a2', 'qr-a3', 'qr-a4'];

function qrStage(name) {
  const map = { war: qrWar, exam: qrExam, result: qrResult, fail: qrFail };
  for (const key in map) {
    const el = map[key];
    if (!el) continue;
    el.hidden = key !== name;
    el.setAttribute('aria-hidden', key === name ? 'false' : 'true');
  }
}
function qrReset() {
  QR_INPUTS.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (qrWar) {
    if (qrWar._anim) qrWar._anim.forEach(function (n) { n.style.animation = 'none'; });
  }
}

function showQianliRead(on) {
  if (!qianliRead) return;
  if (on) {
    if (qianliRead.classList.contains('show')) return;
    qianliReturnFocus = document.activeElement;
    qianliRead.classList.add('show');
    qianliRead.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qianli-open');
    qrStage('war'); qrReset();
    /* 手账记一笔：进画卷做题（今日手账、今日页、落款纸与小票都从这份 entries 派生） */
    addEntry('做题', '千里江山图', '进画卷里坐了会儿');
    if (qianliSheet) {
      qianliSheet.scrollTop = 0;
      setTimeout(function () {
        try { qianliSheet.focus({ preventScroll: true }); } catch (err) { qianliSheet.focus(); }
      }, 80);
    }
  } else {
    if (!qianliRead.classList.contains('show')) return;
    qianliRead.classList.remove('show');
    qianliRead.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qianli-open');
    qrReset();
    if (qianliReturnFocus && typeof qianliReturnFocus.focus === 'function') {
      try { qianliReturnFocus.focus({ preventScroll: true }); } catch (err) {}
    }
    qianliReturnFocus = null;
  }
}
window.__ui = window.__ui || {};
window.__ui.showQianliRead = showQianliRead;

if (qianliRead) {
  if (qianliClose) qianliClose.addEventListener('click', function () { showQianliRead(false); });
  qianliRead.addEventListener('click', function (e) {
    if (e.target.closest('.qr-sheet') || e.target.closest('.qr-close') ||
        e.target.closest('.qr-answer') || e.target.closest('.qr-actions') ||
        e.target.closest('#qr-result') || e.target.closest('#qr-fail')) return;
    if (qrWar && !qrWar.hidden) { qrStage('exam'); return; }
    showQianliRead(false);
  });
  if (qrSubmit) {
    qrSubmit.addEventListener('click', function (e) {
      e.stopPropagation();
      const blank = QR_INPUTS.some(function (id) {
        const el = document.getElementById(id);
        return !el || !String(el.value || '').trim();
      });
      qrStage(blank ? 'fail' : 'result');
    });
  }
  if (qrAgain) {
    qrAgain.addEventListener('click', function (e) {
      e.stopPropagation();
      qrReset();
      qrStage('exam');
    });
  }
  if (qrDone) {
    qrDone.addEventListener('click', function (e) {
      e.stopPropagation();
      showQianliRead(false);
    });
  }
  if (qrLeave) {
    qrLeave.addEventListener('click', function (e) {
      e.stopPropagation();
      showQianliRead(false);
    });
  }
  // 阅读时把方向键/空格留给长图滚动，别让街景跟着走
  window.addEventListener('keydown', function (e) {
    if (!qianliRead.classList.contains('show')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      showQianliRead(false);
      return;
    }
    if (qrExam && qrExam.hidden) return;
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (scrollKeys.indexOf(e.key) !== -1) {
      const active = document.activeElement;
      const onButton = active && (active.tagName === 'BUTTON' || active.tagName === 'A');
      // 焦点在关闭钮上时，空格留给按钮；其余按键只滚长图
      if (e.key === ' ' && onButton) { e.stopPropagation(); return; }
      e.preventDefault();
      e.stopPropagation();
      if (!qianliSheet) return;
      const page = Math.max(240, qianliSheet.clientHeight * 0.85);
      if (e.key === 'ArrowDown') qianliSheet.scrollTop += 90;
      else if (e.key === 'ArrowUp') qianliSheet.scrollTop -= 90;
      else if (e.key === 'PageDown' || e.key === ' ') qianliSheet.scrollTop += page;
      else if (e.key === 'PageUp') qianliSheet.scrollTop -= page;
      else if (e.key === 'Home') qianliSheet.scrollTop = 0;
      else if (e.key === 'End') qianliSheet.scrollTop = qianliSheet.scrollHeight;
      return;
    }
    // 其余按键也不再传给街景（W/A/S/D、E、G 等），Tab 留给焦点
    if (e.key !== 'Tab') e.stopPropagation();
  }, true);
}

/* ===== 茶馆：开场旁白 + 三张内景轮播（取自队友版本） ===== */
const TEA_SLIDES = [
  {
    url: 'images/interior/chaguan1.png', from: 'tl', imageSpace: true,
    lines: [
      /* 第 1 张：x/y 是气泡位置，head 是人头所在位置，尾巴始终指向 head */
      { text: '这新泡的茶还挺香，你们快趁热喝两口。', x: 73, y: 70, head: 73 },
      { text: '是不错，配这桃酥正好，酥得直掉渣。', x: 21, y: 73, head: 21 },
    ],
  },
  {
    url: 'images/interior/chaguan2.webp', from: 'tr',
    lines: [
      { text: '对了，喝完茶你们还去广场遛弯不？', x: 86, y: 43 },
      { text: '去啊，正好消消食，凑凑热闹。', x: 74, y: 29 },
      { text: '我就不去了，回家得给老头子炖汤。', x: 61, y: 39 },
      { text: '行，那咱们明儿还这个点儿见。', x: 86, y: 43 },
    ],
  },
  {
    url: 'images/interior/chaguan4.png', from: 'cc', imageSpace: true,
    lines: [
      /* 第 3 张：三只气泡都收进画面里，head 分别对准绿衣大叔、白衣女士、右侧桌边的女士 */
      { text: '今儿这碧螺春，比上周那批鲜爽多了。', x: 82, y: 60, head: 72 },
      { text: '掌柜新收的明前茶，味儿正，回甘也足。', x: 40, y: 54, head: 52 },
      { text: '配这块现蒸茶糕，一口下去刚好。', x: 72, y: 76, head: 65 },
    ],
  },
];

let thTimers = [];
function thClear() { thTimers.forEach((t) => clearTimeout(t)); thTimers = []; }

/* 状态机：点一下、弹一句（由玩家控制节奏，不再定时自动播放） */
let thState = { slide: 0, line: 0, intro: true, busy: false, done: false };
let thToken = 0;

function thBubble(layer, line, imageSpace) {
  const b = document.createElement('div');
  b.className = 'th-bub';
  b.textContent = line.text;
  if (imageSpace) {
    /* 第 1 / 3 张：气泡按“图片内坐标”摆，尾巴单独指向人头 */
    b.classList.add('img-anchored');
    b.dataset.bx = line.x;
    b.dataset.by = line.y;
    b.dataset.head = line.head == null ? line.x : line.head;
    layer.appendChild(b);
    thLayoutImageBubble(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on')));
    return b;
  }
  b.style.left = Math.min(92, Math.max(8, line.x)) + '%';
  b.style.top = line.y + '%';
  // 定位交给 CSS 变量，transform 留给弹出动效，避免互相覆盖
  b.style.setProperty('--tx', line.x > 70 ? '-100%' : '-50%');
  b.style.setProperty('--ty', '-50%');
  layer.appendChild(b);
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on')));
  return b;
}

/* 把气泡限制在图片范围内，再按 head（人头位置）让尾巴落在人头方向 */
function thLayoutImageBubble(b) {
  const chat = document.getElementById('th-chat');
  if (!chat || !b) return;
  const cw = chat.clientWidth, ch = chat.clientHeight;
  if (!cw || !ch) return;
  const pad = 10;
  b.style.maxWidth = Math.max(150, Math.min(cw - pad * 2, cw * 0.62)) + 'px';
  const bw = b.offsetWidth, bh = b.offsetHeight;
  const bx = Number(b.dataset.bx) || 50;
  const by = Number(b.dataset.by) || 50;
  const headX = b.dataset.head == null ? bx : Number(b.dataset.head);
  const left0 = cw * bx / 100 - bw / 2;
  const top0 = ch * by / 100 - bh - 5;
  const left = Math.max(pad, Math.min(left0, cw - pad - bw));
  const top = Math.max(pad, Math.min(top0, ch - pad - bh));
  b.style.left = left + 'px';
  b.style.top = top + 'px';
  b.style.setProperty('--tx', '0%');
  b.style.setProperty('--ty', '0%');
  /* 尾巴按“人头位置”算，不随气泡宽度变化；气泡被挤到边上时也尽量指回去 */
  const tailAbs = cw * headX / 100;
  const tail = Math.max(12, Math.min(88, ((tailAbs - left) / Math.max(1, bw)) * 100));
  b.style.setProperty('--tail-x', tail.toFixed(1) + '%');
}

/* #th-chat 默认铺满视口（第 2 张沿用旧坐标）；第 1 / 3 张把它缩到图片实际显示区域 */
function thSyncChat(slide) {
  const img = document.getElementById('th-img');
  const chat = document.getElementById('th-chat');
  if (!img || !chat) return;
  if (slide && slide.imageSpace) {
    const r = img.getBoundingClientRect();
    chat.classList.add('image-space');
    chat.style.left = r.left + 'px';
    chat.style.top = r.top + 'px';
    chat.style.width = r.width + 'px';
    chat.style.height = r.height + 'px';
  } else {
    chat.classList.remove('image-space');
    chat.style.left = '';
    chat.style.top = '';
    chat.style.width = '';
    chat.style.height = '';
  }
}

async function thShowSlide(i) {
  const img = document.getElementById('th-img');
  const chat = document.getElementById('th-chat');
  if (!img || !chat) { thState.busy = false; return; }
  const slide = TEA_SLIDES[i];
  const token = ++thToken;
  thState.busy = true;
  img.classList.remove('on');
  img.style.opacity = '0';
  chat.innerHTML = '';
  img.onerror = null;
  img.src = slide.url;
  let ok = false;
  try { await img.decode(); ok = true; } catch (err) { ok = false; }
  if (token !== thToken) return;
  thState.busy = false;
  if (!ok) { thNext(); return; }               // 图加载失败就跳过这张
  img.classList.add('on');
  img.style.opacity = '1';
  img.style.transform = 'scale(1)';
  thSyncChat(slide);
  thState.slide = i;
  thState.line = 0;
}

function thNext() {
  if (thState.done || thState.busy) return;
  if (thState.intro) {
    const house = document.getElementById('tea-house');
    const intro = document.getElementById('th-intro');
    if (!house || !intro) return;
    house.classList.remove('intro');
    intro.classList.add('hide');
    thState.intro = false;
    thShowSlide(0);
    return;
  }
  const slide = TEA_SLIDES[thState.slide];
  if (!slide) { thEnd(); return; }
  if (thState.line < slide.lines.length) {
    thBubble(document.getElementById('th-chat'), slide.lines[thState.line], !!slide.imageSpace);
    thState.line++;
    return;
  }
  if (thState.slide + 1 < TEA_SLIDES.length) {
    thShowSlide(thState.slide + 1);
  } else {
    thEnd();
  }
}

/* 窗口变化时把“图片内气泡”重新贴回图片 */
addEventListener('resize', () => {
  const house = document.getElementById('tea-house');
  if (!house || !house.classList.contains('show')) return;
  const slide = TEA_SLIDES[thState.slide];
  if (!slide || !slide.imageSpace) return;
  thSyncChat(slide);
  document.querySelectorAll('#th-chat .th-bub.img-anchored').forEach(thLayoutImageBubble);
});

function thClose() {
  thClear();
  thState.done = true;
  const house = document.getElementById('tea-house');
  if (house) { house.classList.remove('show'); house.setAttribute('aria-hidden', 'true'); }
}

function thEnd() {
  const house = document.getElementById('tea-house');
  const img = document.getElementById('th-img');
  const chat = document.getElementById('th-chat');
  thClear();
  if (chat) chat.innerHTML = '';
  if (img) { img.classList.remove('on'); img.removeAttribute('src'); }
  if (house) { house.classList.remove('show'); house.setAttribute('aria-hidden', 'true'); }
  thState.done = true;
  window.__ui?.addEntry?.('喝了', '茶馆里的一壶茶', '坐在窗边看了会儿人');
  const nightBtn = document.querySelector('.time-btn[data-time="21"]');
  if (nightBtn) nightBtn.click();
}

function openTeaHouse() {
  const house = document.getElementById('tea-house');
  const intro = document.getElementById('th-intro');
  const img = document.getElementById('th-img');
  const chat = document.getElementById('th-chat');
  if (!house) return;
  thClear();
  thState = { slide: 0, line: 0, intro: true, busy: false, done: false };
  thToken++;
  if (chat) chat.innerHTML = '';
  if (img) { img.classList.remove('on'); img.removeAttribute('src'); }
  if (intro) intro.classList.remove('hide');
  house.classList.add('show', 'intro');
  house.setAttribute('aria-hidden', 'false');
  house.onclick = thNext;
  const closeBtn = document.getElementById('th-close');
  if (closeBtn) closeBtn.onclick = (ev) => { ev.stopPropagation(); thClose(); };
}

document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('#menu-btn');
  if (!btn) return;
  const name = document.getElementById('modal-shop-name')?.textContent.trim();
  if (name !== '茶馆') return;
  e.preventDefault();
  e.stopPropagation();
  openTeaHouse();
}, true);

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const house = document.getElementById('tea-house');
  if (house && house.classList.contains('show')) thClose();
});

window.__tea = { open: openTeaHouse, end: thEnd, ver: 4 };

// 拍照提示条：点「知道了」就收起，本页不再打扰（重开页面会再提示一次）
function bindPhotoHint() {
  const hint = document.getElementById('photo-hint');
  const ok = document.getElementById('ph-hint-ok');
  if (!hint || !ok) return;
  try { if (sessionStorage.getItem('yh_photo_hint_ok') === '1') document.body.classList.add('ph-hint-off'); } catch {}
  ok.addEventListener('click', () => {
    document.body.classList.add('ph-hint-off');
    try { sessionStorage.setItem('yh_photo_hint_ok', '1'); } catch {}
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPhotoHint, { once: true });
else bindPhotoHint();

// 解锁后的提示：同一位置换一句话，告诉用户相机钮在哪、怎么用
function bindPhotoOnHint() {
  const ok = document.getElementById('po-hint-ok');
  if (!ok) return;
  try { if (sessionStorage.getItem('yh_photo_on_hint_ok') === '1') document.body.classList.add('ph-hint-off2'); } catch {}
  ok.addEventListener('click', () => {
    document.body.classList.add('ph-hint-off2');
    try { sessionStorage.setItem('yh_photo_on_hint_ok', '1'); } catch {}
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPhotoOnHint, { once: true });
else bindPhotoOnHint();
