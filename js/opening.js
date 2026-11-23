/* ============================================================
   开场 · 卷轴
   ------------------------------------------------------------
   · 纸的展开 / 印章 / 写字 / 远山 / 绫边 / 落款 全部由 CSS 动画完成，
     本文件的起点与 CSS 对齐（window.__OD2_T0 由 index.html 的 head 记下）
   · 这里只管三件事：进度条（带假卡顿）、等真实模型加载、收卷退场
   · 回退：删掉本文件 + css/opening.css + index.html 里三处引用
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  if (docEl.classList.contains('is-file-protocol')) return;   // 说明纸接管

  var root = document.getElementById('od2');
  if (!root) { docEl.classList.remove('is-opening'); return; }
  window.__OD2_READY = true;

  var fill   = document.getElementById('od2Fill');
  var tip    = document.getElementById('od2Tip');
  var skipEl = document.getElementById('od2Skip');

  /* ------------------------------------------------------------
     时间基准：直接读卷轴纸那条 CSS 动画的时钟。
     这样 CSS 里的 2s 落印 / 2.4s 写字 / 4.15s 进度条，和这里的毫秒
     是同一把尺，不会因为页面解析慢而错开。
     ------------------------------------------------------------ */
  var clock = null, clockTries = 0;

  function findClock() {
    if (clock || clockTries > 600) return clock;
    clockTries++;
    var paper = root.querySelector('.od2-paper');
    if (!paper || !paper.getAnimations) return null;
    var as = paper.getAnimations();
    for (var i = 0; i < as.length; i++) {
      var n = as[i].animationName;
      if (n === 'od2UnrollX' || n === 'od2UnrollY') { clock = as[i]; return clock; }
    }
    if (as.length) clock = as[0];
    return clock;
  }

  function now() { return performance.now(); }

  /* 正确的时间基准：document.timeline.currentTime - 动画 startTime。
     这就是 CSS 动画自己用的那把尺（页面首帧有 1s+ 卡顿时，它也照样准），
     而且动画跑完后时间轴仍在走，不会停表。 */
  var clockStart = null;
  function elapsed() {
    if (clockStart === null) {
      var c = findClock();
      if (c && typeof c.startTime === 'number') clockStart = c.startTime;
    }
    var tl = (document.timeline && typeof document.timeline.currentTime === 'number')
      ? document.timeline.currentTime : now();
    if (clockStart !== null) return Math.max(0, tl - clockStart);
    var T0 = (typeof window.__OD2_T0 === 'number') ? window.__OD2_T0 : 0;
    return now() - T0;
  }

  var TIPS = [
    '正在扫街，准备开门…',
    '正在挑灯笼…',
    '正在生炉子…',
    '正在摆摊…',
    '掌柜的快出来了…'
  ];

  /* 进度表：[绝对毫秒, 百分比]；中间的"平台"就是卡一下 */
  var SCHED = [
    [4150, 0],
    [4390, 10], [4485, 10],
    [4850, 34], [4970, 34],
    [5330, 60], [5420, 60],
    [5760, 84], [5850, 84],
    [6000, 96]
  ];
  var BAR_END = SCHED[SCHED.length - 1][0];

  var timers = [];
  var raf = 0;
  var rolled = false;
  var skipped = false;
  var finished = false;

  function at(ms, fn) {
    var d = ms - elapsed();
    if (d > 0) timers.push(setTimeout(fn, d));
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
  }
  function setPct(p) { fill.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function tipFor(p) {
    var k = p < 20 ? 0 : p < 40 ? 1 : p < 60 ? 2 : p < 80 ? 3 : 4;
    return TIPS[k] + '　' + Math.round(p) + '%';
  }

  /* ------------------------------------------------------------
     音效：WebAudio 现场合成（没拿到播放权限就静音，不弹提示）
     ------------------------------------------------------------ */
  var Sfx = (function () {
    var ctx = null, enabled = true;

    function ac() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        try { ctx = new C(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    function noise(c, dur) {
      var len = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }
    function run(fn) {
      if (!enabled) return;
      var c = ac();
      if (!c) return;
      try { fn(c); } catch (e) {}
    }

    return {
      /* 展开：一段纸面摩擦，带缓慢起伏 */
      unroll: function (dur) {
        run(function (c) {
          var t = c.currentTime;
          var n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
          var lfo = c.createOscillator(), lg = c.createGain();
          n.buffer = noise(c, dur);
          bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.6;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.07, t + 0.35);
          g.gain.setValueAtTime(0.07, t + dur * 0.78);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          lfo.frequency.value = 0.7;
          lg.gain.value = 0.018;
          lfo.connect(lg); lg.connect(g.gain);
          n.connect(bp); bp.connect(g); g.connect(c.destination);
          lfo.start(t); lfo.stop(t + dur);
          n.start(t);
        });
      },
      /* 轴头那一下木质轻响 */
      clack: function () {
        run(function (c) {
          var t = c.currentTime;
          var n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
          n.buffer = noise(c, 0.09);
          bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.4;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          n.connect(bp); bp.connect(g); g.connect(c.destination);
          n.start(t);
        });
      },
      /* 落印 */
      thud: function () {
        run(function (c) {
          var t = c.currentTime;
          var o = c.createOscillator(), g = c.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(128, t);
          o.frequency.exponentialRampToValueAtTime(46, t + 0.22);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.34, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + 0.4);

          var n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
          n.buffer = noise(c, 0.2);
          bp.type = 'bandpass'; bp.frequency.value = 880; bp.Q.value = 0.7;
          ng.gain.setValueAtTime(0.0001, t);
          ng.gain.exponentialRampToValueAtTime(0.14, t + 0.004);
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
          n.connect(bp); bp.connect(ng); ng.connect(c.destination);
          n.start(t);
        });
      },
      /* 收卷 */
      rollUp: function () {
        run(function (c) {
          var t = c.currentTime;
          var n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
          n.buffer = noise(c, 1.15);
          bp.type = 'bandpass'; bp.Q.value = 0.9;
          bp.frequency.setValueAtTime(900, t);
          bp.frequency.exponentialRampToValueAtTime(4200, t + 0.55);
          bp.frequency.exponentialRampToValueAtTime(1500, t + 1.05);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.13, t + 0.16);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
          n.connect(bp); bp.connect(g); g.connect(c.destination);
          n.start(t);
        });
      },
      unlock: function () { ac(); }
    };
  })();

  /* ------------------------------------------------------------
     进度条：SCHED 里的平台就是"卡一下"；走到 96% 停下等真实加载
     ------------------------------------------------------------ */
  function pctAt(ms) {
    if (ms <= SCHED[0][0]) return 0;
    for (var i = 1; i < SCHED.length; i++) {
      var a = SCHED[i - 1], b = SCHED[i];
      if (ms <= b[0]) {
        if (b[0] === a[0]) return b[1];
        var k = (ms - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return 96;
  }

  /* 街在纸后面空转也没意义，先让它停；等揭纸再恢复 */
  var pausedStreet = false;
  function pauseStreet() {
    if (pausedStreet || !window.setStreetPaused) return;
    try { window.setStreetPaused(true); pausedStreet = true; } catch (e) {}
  }

  /* 真实加载看这几个信号：纸被摘掉 / 带 hide / 进度 100 / 文案"开门了" */
  function isLoaded() {
    /* 街没搭起来（模型还没挂上）就不算加载完，哪怕开机纸已经 100% */
    if (!window.__streetBuilt) return false;
    var boot = document.getElementById('boot');
    if (!boot) return true;
    if (boot.classList.contains('hide')) return true;
    var line = document.getElementById('boot-line');
    if (line && line.textContent === '开门了') return true;
    var f = document.getElementById('boot-bar-fill');
    if (f && parseFloat(f.style.width) >= 100) return true;
    return false;
  }

  /* 没加载完就等；最多等 12 秒，和页面原有的兜底对齐 */
  function whenLoaded(cb) {
    var t0 = now();
    (function poll() {
      if (isLoaded()) { timers.push(setTimeout(cb, 180)); return; }
      if (now() - t0 > 20000) { timers.push(setTimeout(cb, 0)); return; }
      var waited = now() - t0;
      if (waited > 900) {
        if (waited > 3200) tip.textContent = '正在生火，桌椅马上摆好…';
        else tip.textContent = '正在扫街，准备开门…　96%';
      }
      timers.push(setTimeout(poll, 120));
    })();
  }

  /* 96% → 100% → 收卷 */
  function finishBar() {
    var t0 = now();
    (function step() {
      var k = Math.min(1, (now() - t0) / 320);
      var p = 96 + 4 * k;
      setPct(p);
      tip.textContent = TIPS[4] + '　' + Math.round(p) + '%';
      if (k < 1) { raf = requestAnimationFrame(step); return; }
      tip.textContent = '开门了';
      timers.push(setTimeout(roll, 160));
    })();
  }

  function runBar() {
    pauseStreet();
    var e = elapsed();
    if (e < BAR_END) {
      var p = pctAt(e);
      setPct(p);
      tip.textContent = tipFor(p);
      raf = requestAnimationFrame(runBar);
      return;
    }
    setPct(96);
    tip.textContent = TIPS[4] + '　96%';
    whenLoaded(finishBar);
  }

  /* ------------------------------------------------------------
     收卷与退场
     ------------------------------------------------------------ */
  function roll() {
    if (rolled) return;
    rolled = true;
    cancelAnimationFrame(raf);
    docEl.classList.add('od2-reveal');    // 先把封面垫在纸下面
    root.classList.add('od2-roll');       // 纸带着轴一起卷走
    Sfx.rollUp();
    timers.push(setTimeout(finish, 1200));
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimers();
    cancelAnimationFrame(raf);
    if (root.parentNode) root.parentNode.removeChild(root);
    docEl.classList.remove('is-opening', 'od2-reveal');
    if (pausedStreet && window.setStreetPaused) {
      try { window.setStreetPaused(false); } catch (e) {}
    }
    var boot = document.getElementById('boot');
    if (boot) {
      boot.style.display = 'none';
      try { window.bootDone && window.bootDone(); } catch (e) {}
    }
  }

  /* 跳过：落墨一把补齐、进度拉满，但仍等真实加载完再卷走（不硬切） */
  function skip() {
    if (rolled || skipped) return;
    skipped = true;
    cancelAnimationFrame(raf);
    pauseStreet();
    root.classList.add('od2-fast');
    setPct(100);
    tip.textContent = '开门了';
    whenLoaded(function () { timers.push(setTimeout(roll, 160)); });
  }

  /* ------------------------------------------------------------
     事件：跳过 / 解锁声音
     ------------------------------------------------------------ */
  skipEl.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    Sfx.unlock();
    skip();
  });

  /* 0.8 秒后（跳过按钮出现），点画面任意处也能跳 */
  root.addEventListener('click', function () {
    if (elapsed() >= 800) { Sfx.unlock(); skip(); }
  });

  document.addEventListener('pointerdown', function () { Sfx.unlock(); }, { passive: true });

  /* 捕获阶段先拦下来，免得空格被街上的"帮衬/快门"吃掉 */
  document.addEventListener('keydown', function (e) {
    if (rolled) return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      Sfx.unlock();
      skip();
    }
  }, true);

  /* 给自动化留个口子（正式版可以删） */
  window.__od2 = {
    skip: skip,
    get state() {
      return {
        rolled: rolled, skipped: skipped, finished: finished,
        pct: fill.style.width, tip: tip.textContent,
        loaded: isLoaded(), elapsed: Math.round(elapsed())
      };
    }
  };

  /* ------------------------------------------------------------
     起跑
     ------------------------------------------------------------ */
  if (window.setStreetPaused) { try { window.setStreetPaused(true); pausedStreet = true; } catch (e) {} }
  timers.push(setTimeout(pauseStreet, 1200));   // 模块稍后才定义，补一次

  var started = elapsed();
  if (started < 1400) {                       // 脚本来得早，纸声从头放
    Sfx.clack();
    Sfx.unroll(Math.max(0.8, (4000 - started) / 1000));
  }
  at(2000, function () { Sfx.thud(); });      // 落印

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    /* 减弱动效：CSS 已经让卷轴瞬间展开，这里只等加载，然后卷走 */
    setPct(100);
    tip.textContent = '开门了';
    whenLoaded(function () { timers.push(setTimeout(roll, 200)); });
  } else if (started >= BAR_END) {
    /* 脚本来得太晚（主线程被占住），直接接上末段 */
    setPct(96);
    tip.textContent = TIPS[4] + '　96%';
    whenLoaded(finishBar);
  } else {
    raf = requestAnimationFrame(runBar);
  }
})();
