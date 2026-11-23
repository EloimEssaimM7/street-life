/* ============================================================
 * 烟火气层 —— 让这条街活起来
 * 行人、蒸汽、灯笼、猫、麻雀、市声，以及点击互动的对话
 * 依赖 index.html 里暴露的 window.__street
 * 只读主场景，不改动原有逻辑，出问题随时可以摘掉这个文件
 * ============================================================ */
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';

/* ---------- 等主场景就绪 ---------- */
function whenReady() {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      if (window.__street && window.__street.scene) return resolve(window.__street);
      if (++tries > 400) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

/* ---------- 小工具 ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/* 清晨 05:00–12:00 的背景乐（自备音频，文件名含空格与中文，这里用编码后的路径） */
const MORNING_BGM = 'audio/Moon%20in%20One%27s%20Cup%20%E6%9D%AF%E4%B8%AD%E6%98%8E%E6%9C%88.m4a';
const MORNING_BGM_END = 12;
const CALLS = {
  '包子铺': '笼屉刚掀，热包子皮薄馅大，咬一口汤直往外冒。',
  '面馆': '牛骨汤从后半夜熬到现在，面现下锅，葱油自家熬。',
  '理发店': '您里边坐，咱师傅剪发手艺老道，保准给您收拾得精神体面。',
  '杂货店': '要点啥您尽管挑，柴米油盐零碎物件咱这都齐全。',
  '鲜果铺': '桃子西瓜都是今早到的，挑甜的，不甜再放回去。',
  '奶茶店': '珍珠现煮，糖多冰少您说一声，一杯也给做。',
  '炸串摊': '油锅正热，鸡柳土豆都串好了，撒把辣面，香半条街。',
  '烧烤车': '两瓶冰啤镇在桶里，肉串滋滋冒油，坐这儿慢慢吃。',
  '糕点铺': '桃酥刚出炉，甜的咸的各来一块尝尝，不买不碍事。',
  '古玩店': '老瓷片、旧铜锁摆了一桌子，看着喜欢就拿起来细琢磨。',
  '照相馆': '您这边坐，先翻翻样册，想拍啥样子都好商量。',
  '书店': '旧书五块一本，墙角有板凳，翻到天黑也没人催。',
  '中药铺': '抓药代煎都成，方子搁下，老秤一味一味称给您看。',
  '卤肉铺': '老汤卤了一整夜，肥瘦您挑，切好再给浇勺卤汁。',
  '茶馆': '水刚开，今年新茶，坐哪张桌都成，续水不要钱。',
  '烟酒副食店': '烟酒糖茶、酱油醋，柜台后头都有，零钱我给您备着。'
};
const REPLIES = ['哎，来一份。', '先看看。', '闻着就香。'];

/* 一小团白汽：不是规整的圆，是几坨小汽凑在一起，边缘虚掉 */
function makePuffTexture(seed) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const blobs = 9 + Math.floor(rand() * 6);
  for (let i = 0; i < blobs; i++) {
    const cx = S / 2 + (rand() - 0.5) * S * 0.42;
    const cy = S / 2 + (rand() - 0.5) * S * 0.42;
    const r = S * (0.08 + rand() * 0.16);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.80)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.34)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const PUFF_TEX = [makePuffTexture(1), makePuffTexture(7), makePuffTexture(13)];

/* 布料 / 皮子的细微颗粒：灰度噪声，用 color 乘上去，打破"塑料感" */
function noiseTexture(level = 235, spread = 16, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, level + (Math.random() - 0.5) * spread * 2));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}
const CLOTH_TEX = noiseTexture(232, 13, 128);
const PANTS_TEX = noiseTexture(224, 11, 128);
const SKIN_TEX = noiseTexture(240, 7, 64);

/* 暖色的光晕 */
function glowTexture(inner = 'rgba(255,196,120,0.85)', outer = 'rgba(255,150,60,0)') {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

/* ---------- 共享几何体（所有人共用，省显存） ---------- */
const GEO = {
  /* 人体：上臂/前臂/大腿/小腿用胶囊，躯干收腰，肩和胯各一段 */
  thigh: new THREE.CapsuleGeometry(0.086, 0.23, 6, 12),
  belt: new THREE.CylinderGeometry(0.168, 0.168, 0.035, 14, 1),
  shin: new THREE.CapsuleGeometry(0.069, 0.25, 6, 12),
  shoe: new THREE.BoxGeometry(0.105, 0.072, 0.245),
  upperArm: new THREE.CapsuleGeometry(0.055, 0.17, 4, 8),
  forearm: new THREE.CapsuleGeometry(0.048, 0.17, 4, 8),
  hand: new THREE.SphereGeometry(0.045, 8, 6),
  torso: new THREE.CylinderGeometry(0.195, 0.162, 0.46, 14, 1),
  hips: new THREE.CylinderGeometry(0.158, 0.148, 0.16, 12, 1),
  shoulder: new THREE.SphereGeometry(0.062, 8, 6),
  collar: new THREE.CylinderGeometry(0.088, 0.098, 0.05, 12, 1),
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8),
  head: new THREE.SphereGeometry(0.102, 16, 14),
  hair: new THREE.SphereGeometry(0.107, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
  hairLong: new THREE.CapsuleGeometry(0.093, 0.12, 4, 10),
  nose: new THREE.SphereGeometry(0.016, 6, 6),
  brow: new THREE.BoxGeometry(0.042, 0.011, 0.012),
  mouth: new THREE.BoxGeometry(0.045, 0.010, 0.012),
  fringe: new THREE.BoxGeometry(0.155, 0.05, 0.03),
  eye: new THREE.SphereGeometry(0.0135, 6, 6),
  sclera: new THREE.SphereGeometry(0.017, 8, 6),
  cap: new THREE.CylinderGeometry(0.108, 0.112, 0.062, 14, 1),
  capBrim: new THREE.BoxGeometry(0.13, 0.012, 0.09),
  scarf: new THREE.TorusGeometry(0.058, 0.026, 6, 12),
  lantern: new THREE.CylinderGeometry(0.17, 0.14, 0.34, 10),
  lanternCap: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8),
  catBody: new THREE.CapsuleGeometry(0.09, 0.24, 4, 8),
  catHead: new THREE.SphereGeometry(0.085, 10, 8),
  catEar: new THREE.ConeGeometry(0.035, 0.075, 4),
  catTail: new THREE.CylinderGeometry(0.018, 0.012, 0.28, 6),
  birdBody: new THREE.SphereGeometry(0.065, 8, 6),
  birdTail: new THREE.BoxGeometry(0.02, 0.02, 0.09),
  birdBeak: new THREE.ConeGeometry(0.015, 0.045, 4),
};

const SKINS = [0xd8ac86, 0xc99a75, 0xe2bb95, 0xb98a66];
const HAIRS = [0x241d1a, 0x3a2a20, 0x1b1512, 0x5a4636, 0x2b2b2b];
const CLOTHES = [0x38506b, 0x6b4a3a, 0x4a5a46, 0x7a3f3a, 0x555561, 0x8a6a45, 0x2f4a52, 0x6d5a7a, 0x8c5a4a, 0x3f5a63];
const PANTS = [0x2e3440, 0x3a3630, 0x24303c, 0x4a4038, 0x2a2a2e];
const SHOES = [0x1c1a18, 0x2a241f, 0x33291e];

/* 街坊邻居会说的话 */
const LINES = [
  '吃了没？', '今儿天不错啊', '刚出锅的，热乎着呢', '慢点儿走，地滑',
  '这包子闻着真香', '又降温了，多穿件', '进来坐坐？', '下班啦？',
  '来点啥？', '哎，是你啊', '这条街晚上才热闹', '锅里的水快开了',
];

/* ============================================================ */
class Life {
  constructor(S) {
    this.S = S;
    this.scene = S.scene;
    this.camera = S.camera;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.people = [];
    this.steamEmitters = [];
    this.steamPool = [];
    this.lanterns = [];
    this.doorGlows = [];
    this.birds = [];
    this.cat = null;
    this.litCount = 0;
    this.callout = 0; this.calloutAt = 0;
    this.catFollowUntil = 0;
    this.helpCount = 0;
    this.nearCart = null; this.cartTimer = 0;
    this.nearShop = null; this.zone = ''; this.zoneTimer = 0;
    this.rainOn = false; this.rain = null;
    this.anchor = new THREE.Object3D();
    this.root.add(this.anchor);
    this.clock = 0;
    this.night = 0;
    this.bubbleTimer = 0;
    this.bubbleTarget = null;

    this.glowTex = glowTexture();
    this.puffTex = PUFF_TEX;

    this.collectShops();
    this.buildPeople();
    this.buildLanterns();
    this.buildDoorGlows();

    this.buildGroundShadows();

    this.buildFlags();

    this.buildSteam();
    this.buildCat();
    this.buildBirds();
    this.buildLeaves();
    this.buildBubble();
    this.buildSoundButton();
    this.buildAmbience();
    this.bindClicks();
  }

  /* ---------- 从主场景的店铺锚点里取位置 ---------- */
  collectShops() {
    const S = this.S;
    const list = S.interactiveShops || S.allSpawnedModels || [];
    this.shops = [];
    for (const m of list) {
      if (!m || !m.userData) continue;
      const name = m.userData.name || m.userData.shopName || m.userData.label || '';
      const u = typeof m.userData.u === 'number' ? m.userData.u : null;
      if (u === null) continue;
      const pos = new THREE.Vector3();
      m.getWorldPosition(pos);
      const tan = new THREE.Vector3(1, 0, 0);
      const perp = new THREE.Vector3(0, 0, 1);
      if (m.userData.tan) tan.copy(m.userData.tan);
      if (m.userData.perp) perp.copy(m.userData.perp);
      const side = m.userData.side || 1;
      this.shops.push({ name: String(name), u, d: u * this.S.streetLen, pos, tan, perp, side, w: m.userData.w || 5.4 });
    }
    // 兜底：主场景没给出锚点时，用街道采样自己铺
    if (!this.shops.length) {
      const left = ['包子铺', '奶茶店', '杂货店', '理发店', '照相馆', '茶馆', '中药铺'];
      const right = ['鲜果铺', '糕点铺', '面馆', '卤肉铺', '书店', '古玩店', '烟酒副食店'];
      const steamTypes = new Set(['包子铺', '面馆', '卤肉铺', '糕点铺', '茶馆', '中药铺']);
      const layout = [[left, -1], [right, 1]];
      for (const [names, sd] of layout) {
        names.forEach((nm, i) => {
          const u = 0.1 + (i / 6) * 0.8;
          const p = S.poseAt(u * S.streetLen, sd, S.CONFIG.sidewalkOuter + S.CONFIG.buildingHalfDepth);
          this.shops.push({
            name: nm, u, d: u * S.streetLen, pos: p.pos.clone(), tan: p.tan.clone(), perp: p.tan.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(),
            side: sd, steam: steamTypes.has(nm),
          });
        });
      }
    }
  }

  /* ---------- 行人 ----------
   * 关节化的人：胯-大腿-膝-小腿-鞋，肩-上臂-肘-前臂-手，
   * 走起来膝盖会弯、胳膊会甩，站着的时候有呼吸和东张西望。 */
  makePerson(opts = {}) {
    const cold = !!opts.cold;
    const female = !!opts.female;

    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);

    const skinMat = new THREE.MeshStandardMaterial({ color: pick(SKINS), map: SKIN_TEX, roughness: 0.86 });
    const hairMat = new THREE.MeshStandardMaterial({ color: pick(HAIRS), roughness: 0.9 });
    const clothMat = new THREE.MeshStandardMaterial({ color: pick(CLOTHES), map: CLOTH_TEX, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pick(PANTS), map: PANTS_TEX, roughness: 0.94 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: pick(SHOES), roughness: 0.75 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x191411, roughness: 0.35 });

    /* 胯与躯干 */
    const hips = new THREE.Mesh(GEO.hips, pantsMat);
    hips.position.y = 0.9;
    body.add(hips);

    const torso = new THREE.Mesh(GEO.torso, clothMat);
    torso.position.y = 1.18;
    torso.scale.set(female ? 0.94 : 1, 1, female ? 0.72 : 0.78);
    if (cold) torso.scale.multiplyScalar(1.06);
    body.add(torso);

    const collar = new THREE.Mesh(GEO.collar, clothMat);
    collar.position.y = 1.405;
    collar.scale.set(1, 1, 0.82);
    body.add(collar);

    const belt = new THREE.Mesh(GEO.belt, new THREE.MeshStandardMaterial({ color: 0x2a231d, roughness: 0.8 }));
    belt.position.y = 0.965;
    belt.scale.set(female ? 0.94 : 1, 1, female ? 0.75 : 0.8);
    body.add(belt);

    /* 肩、脖子、头 */
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(GEO.shoulder, clothMat);
      sh.position.set(sx * (female ? 0.168 : 0.185), 1.36, 0);
      sh.scale.set(1, 0.9, 0.9);
      body.add(sh);
    }
    const neck = new THREE.Mesh(GEO.neck, skinMat);
    neck.position.y = 1.425;
    body.add(neck);

    const head = new THREE.Group();
    head.position.y = 1.55;
    const skull = new THREE.Mesh(GEO.head, skinMat);
    skull.scale.set(0.94, 1.1, 0.98);
    head.add(skull);
    const hairMesh = new THREE.Mesh(GEO.hair, hairMat);
    hairMesh.scale.set(1.0, female ? 1.18 : 0.95, 1.02);
    hairMesh.position.y = 0.004;
    head.add(hairMesh);
    for (const dx of [-0.033, 0.033]) {
      const sc = new THREE.Mesh(GEO.sclera, new THREE.MeshStandardMaterial({ color: 0xf3ece2, roughness: 0.5 }));
      sc.position.set(dx, 0.006, 0.086);
      sc.scale.set(1, 0.82, 0.7);
      head.add(sc);
      const eye = new THREE.Mesh(GEO.eye, eyeMat);
      eye.position.set(dx, 0.005, 0.097);
      eye.scale.set(1, 1.05, 0.7);
      head.add(eye);
    }
    if (Math.random() < 0.32) {
      const cap = new THREE.Mesh(GEO.cap, new THREE.MeshStandardMaterial({ color: pick([0x2c3238, 0x3d3a30, 0x4a3a2c, 0x24303c]), map: CLOTH_TEX, roughness: 0.9 }));
      cap.position.y = 0.052;
      head.add(cap);
      const brim = new THREE.Mesh(GEO.capBrim, cap.material);
      brim.position.set(0, 0.03, 0.1);
      brim.rotation.x = -0.08;
      head.add(brim);
    }
    const nose = new THREE.Mesh(GEO.nose, skinMat);
    nose.position.set(0, -0.018, 0.098);
    nose.scale.set(0.9, 1.3, 1.1);
    head.add(nose);
    for (const dx of [-0.036, 0.036]) {
      const brow = new THREE.Mesh(GEO.brow, hairMat);
      brow.position.set(dx, 0.043, 0.093);
      brow.rotation.z = dx > 0 ? -0.12 : 0.12;
      head.add(brow);
    }
    const mouth = new THREE.Mesh(GEO.mouth, new THREE.MeshStandardMaterial({ color: 0x6b3b34, roughness: 0.8 }));
    mouth.position.set(0, -0.055, 0.092);
    mouth.scale.set(1, 0.8, 1);
    head.add(mouth);
    const fringe = new THREE.Mesh(GEO.fringe, hairMat);
    fringe.position.set(0, 0.062, 0.072);
    fringe.rotation.x = -0.22;
    head.add(fringe);
    if (female) {
      const back = new THREE.Mesh(GEO.hairLong, hairMat);
      back.position.set(0, -0.05, -0.035);
      back.scale.set(1, 1.15, 0.72);
      head.add(back);
    }
    if (Math.random() < 0.35) {
      const scarf = new THREE.Mesh(GEO.scarf, new THREE.MeshStandardMaterial({ color: pick([0x9c3b30, 0x2f4a52, 0x8a6a2a, 0x4a4a5a]), roughness: 0.88 }));
      scarf.position.y = -0.02;
      scarf.rotation.x = Math.PI / 2;
      scarf.scale.set(1.15, 1.15, 0.8);
      head.add(scarf);
    }
    body.add(head);

    /* 手臂：肩 → 上臂 → 肘 → 前臂 → 手 */
    const arms = {};
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'L' : 'R';
      const arm = new THREE.Group();
      arm.position.set(side * 0.215, 1.345, 0);
      arm.rotation.z = side * 0.06;

      const upper = new THREE.Mesh(GEO.upperArm, cold ? clothMat : clothMat);
      upper.position.y = -0.115;
      arm.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.235;
      arm.add(elbow);
      const fore = new THREE.Mesh(GEO.forearm, cold ? clothMat : skinMat);
      fore.position.y = -0.105;
      elbow.add(fore);
      const hand = new THREE.Mesh(GEO.hand, skinMat);
      hand.position.y = -0.215;
      hand.scale.set(1, 1.15, 0.9);
      elbow.add(hand);

      body.add(arm);
      arms['arm' + key] = arm;
      arms['elbow' + key] = elbow;
    }

    /* 腿：胯 → 大腿 → 膝 → 小腿 → 鞋 */
    const legs = {};
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'L' : 'R';
      const leg = new THREE.Group();
      leg.position.set(side * 0.082, 0.88, 0);

      const thigh = new THREE.Mesh(GEO.thigh, pantsMat);
      thigh.position.y = -0.19;
      leg.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.375;
      leg.add(knee);
      const shin = new THREE.Mesh(GEO.shin, pantsMat);
      shin.position.y = -0.185;
      knee.add(shin);
      const shoe = new THREE.Mesh(GEO.shoe, shoeMat);
      shoe.position.set(0, -0.385, 0.033);
      knee.add(shoe);

      body.add(leg);
      legs['leg' + key] = leg;
      legs['knee' + key] = knee;
    }

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

    /* 让脚底正好踩在地面 y=0 上 */
    const box = new THREE.Box3().setFromObject(body);
    body.position.y = -box.min.y;

    const s = rnd(0.94, 1.04) * (female ? 0.95 : 1) * (cold ? 1.07 : 1);
    g.scale.setScalar(s);

    /* 雨伞：平时收着，落雨才撑开 */
    const umb = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.30, 12), new THREE.MeshStandardMaterial({ color: pick([0x2f3b46, 0x5a3b33, 0x3d4a3a, 0x4a3f52]), roughness: 0.92 }));
    canopy.position.y = 0.16;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x33302b, roughness: 0.9 }));
    pole.position.y = -0.34;
    umb.add(canopy, pole);
    umb.position.set(0.16, 1.82, 0.02);
    umb.rotation.z = 0.07;
    umb.visible = false;
    g.add(umb);
    g.userData.umb = umb;
    g.userData.hasUmb = Math.random() < 0.72;

    g.userData.rig = { ...legs, ...arms, head, torso, body, hips, baseY: body.position.y };
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.height = 1.66 * s;
    return g;
  }

  buildPeople() {
    const len = this.S.streetLen;
    for (let i = 0; i < 7; i++) {
      const person = this.makePerson({ cold: Math.random() < 0.4, female: Math.random() < 0.5 });
      const side = i % 2 === 0 ? 1 : -1;
      person.userData.walk = {
        d: rnd(6, len - 6), side, offset: rnd(2.85, 3.7),
        dir: Math.random() < 0.5 ? 1 : -1, speed: rnd(0.55, 1.05), idle: false, idleUntil: 0,
      };
      this.root.add(person);
      this.people.push(person);
    }

    // 两个站在店门口闲聊的人，面对面
    for (let i = 0; i < 2; i++) {
      const person = this.makePerson({ cold: true, female: i === 1 });
      const shop = this.shops[(i * 5 + 3) % this.shops.length];
      const d = shop.u * len + rnd(-1, 1);
      const offset = rnd(2.9, 3.4);
      person.position.set(
        shop.pos.x + shop.perp.x * shop.side * (offset - 4.0),
        0,
        shop.pos.z + shop.perp.z * shop.side * (offset - 4.0)
      );
      person.rotation.y = Math.atan2(-shop.tan.x, -shop.tan.z) + rnd(-0.5, 0.5);
      person.userData.walk = { d, side: shop.side, offset, dir: 1, speed: 0, idle: true, idleUntil: Infinity };
      this.root.add(person);
      this.people.push(person);
    }
  }

  /* ---------- 灯笼 ---------- */
  buildLanterns() {
    const matCap = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 });
    for (const shop of this.shops) {
      const spShop = this.S.sampleStreet(shop.u);
      const anchor = this.S.poseAt(shop.d, shop.side, this.S.CONFIG.sidewalkOuter + 0.75).pos;
      const barY = 3.96;
      // 檐下横杆：两只灯笼都挂在这根杆上，不悬空
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.7, 5), matCap);
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spShop.tan.clone().normalize());
      bar.position.set(anchor.x, barY, anchor.z);
      this.root.add(bar);
      for (const dx of [-0.95, 0.95]) {
        const g = new THREE.Group();
        const matRed = new THREE.MeshStandardMaterial({
          color: 0xd93b2b, emissive: 0xff5a2a, emissiveIntensity: 0.2, roughness: 0.7,
        });
        const body = new THREE.Mesh(GEO.lantern, matRed);
        body.scale.y = rnd(0.9, 1.1);
        const capT = new THREE.Mesh(GEO.lanternCap, matCap);
        capT.position.y = 0.19;
        const capB = new THREE.Mesh(GEO.lanternCap, matCap);
        capB.position.y = -0.19;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color: 0xffa865, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }));
        glow.scale.set(1.5, 1.5, 1);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.05, 5), matCap);
        cord.position.y = 0.19 + 0.525;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 5, 12), matCap);
        ring.position.y = 0.19 + 1.05;
        ring.rotation.x = Math.PI / 2;
        body.userData.pickCore = true;
        capT.userData.pickCore = true;
        capB.userData.pickCore = true;
        glow.userData.noPick = true;
        cord.userData.noPick = true;
        ring.userData.noPick = true;
        g.add(body, capT, capB, glow, cord, ring);
        g.position.set(
          this.S.poseAt(shop.d + dx, shop.side, this.S.CONFIG.sidewalkOuter + 0.75).pos.x,
          2.72,
          this.S.poseAt(shop.d + dx, shop.side, this.S.CONFIG.sidewalkOuter + 0.75).pos.z
        );
        g.userData = { body, glow, phase: Math.random() * Math.PI * 2 };
        this.root.add(g);
        this.lanterns.push(g);
      }
    }
  }

  /* ---------- 店门口的暖光 ---------- */
  buildGroundShadows() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.72 });
    for (const shop of this.shops) {
      const w = Math.max(4, (shop.w || 5.4) * 0.92);
      const geo = new THREE.PlaneGeometry(w, 2.6);
      const mesh = new THREE.Mesh(geo, mat);
      const p = this.S.poseAt(shop.d, shop.side, this.S.CONFIG.sidewalkOuter + 0.35).pos;
      mesh.position.set(p.x, 0.13, p.z);
      mesh.rotation.x = -Math.PI / 2;
      this.root.add(mesh);
    }
  }
  buildFlags() {
    const S = this.S;
    const palette = ['#b23a2f', '#2f4a6b', '#5f6b3a', '#7a4a2a'];
    this.flags = [];
    this.shops.forEach((shop, idx) => {
      if (shop.d < 12) return;
      const sp = S.sampleStreet(shop.u);
      const yaw = Math.atan2(sp.tan.x, sp.tan.z);
      for (let k = 0; k < 2; k += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 384;
        const g = canvas.getContext('2d');
        const base = palette[(idx + k) % palette.length];
        g.fillStyle = base; g.fillRect(0, 0, 128, 384);
        g.fillStyle = 'rgba(0,0,0,0.14)';
        g.fillRect(0, 0, 128, 18); g.fillRect(0, 348, 128, 36);
        g.fillStyle = '#f5e7ca';
        g.font = 'bold 84px KaiTi, STKaiti, Microsoft YaHei, serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const ch = shop.name.slice(k, k + 1) || shop.name.slice(0, 1);
        g.fillText(ch, 64, 170);
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.52, 1.56),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false })
        );
        const off = (k === 0 ? -1.35 : 1.35);
        const p = S.poseAt(shop.d + off, shop.side, S.CONFIG.sidewalkOuter + 1.5).pos;
        mesh.position.set(p.x, 2.55, p.z);
        mesh.rotation.y = yaw;
        mesh.userData.phase = Math.random() * Math.PI * 2;
        this.root.add(mesh);
        this.flags.push(mesh);
      }
    });
  }
  buildDoorGlows() {
    for (const shop of this.shops) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xffb066, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      sprite.scale.set(3.4, 2.6, 1);
      const front = this.S.poseAt(shop.d, shop.side, this.S.CONFIG.sidewalkOuter + 0.12);
      sprite.position.set(front.pos.x, 1.45, front.pos.z);
      this.root.add(sprite);
      this.doorGlows.push(sprite);
    }
  }

  /* ---------- 蒸汽 / 热气 ---------- */
  buildSteam() {
    // 只有这两家真的在冒气，而且要冒在东西上面：
    // 包子铺是那摞蒸笼的笼口，面馆是门口那口锅的锅沿
    const STEAM = {
      '包子铺': { off: 5.25, r: 4.9, y: 1.86, rate: 0.46, strength: 1.05 },
      '面馆': { off: -1.15, r: 4.75, y: 1.58, rate: 0.5, strength: 0.9 },
    };
    for (const shop of this.shops) {
      const cfg = STEAM[shop.name];
      if (!cfg) continue;
      const p = this.S.poseAt(shop.d + cfg.off, shop.side, cfg.r).pos;
      this.addEmitter(new THREE.Vector3(p.x, cfg.y, p.z), cfg.rate, cfg.strength);
    }
  }

  addEmitter(pos, rate, strength) {
    for (const old of this.steamEmitters) {
      if (old.pos.distanceToSquared(pos) < 0.2) return old;
    }
    const em = { pos: pos.clone(), rate, strength, t: Math.random() * rate, puffs: [] };
    this.steamEmitters.push(em);
    return em;
  }

  spawnPuff(emitter) {
    const map = PUFF_TEX[(Math.random() * PUFF_TEX.length) | 0];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: 0xf4f2ee, transparent: true, opacity: 0,
      depthWrite: false, fog: true,
    }));
    sprite.position.copy(emitter.pos).add(new THREE.Vector3(rnd(-0.14, 0.14), rnd(0, 0.12), rnd(-0.14, 0.14)));
    const s = rnd(0.24, 0.40) * emitter.strength * (this.rainOn ? 0.62 : 1);
    sprite.scale.set(s, s, 1);
    sprite.material.rotation = rnd(0, Math.PI * 2);
    sprite.userData = {
      life: 0, max: rnd(1.4, 2.2),
      vy: rnd(0.45, 0.8), drift: rnd(-0.09, 0.09),
      sway: rnd(0, Math.PI * 2), spin: rnd(-0.5, 0.5),
      baseScale: s,
    };
    emitter.puffs.push(sprite);
    this.root.add(sprite);
  }

  /* ---------- 猫 ---------- */
  buildCat() {
    const g = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0xa4662f, roughness: 0.95 });
    const body = new THREE.Mesh(GEO.catBody, furMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.22;
    const head = new THREE.Mesh(GEO.catHead, furMat);
    head.position.set(0, 0.3, 0.19);
    const earL = new THREE.Mesh(GEO.catEar, darkMat);
    earL.position.set(-0.05, 0.37, 0.19);
    const earR = earL.clone();
    earR.position.x = 0.05;
    const tail = new THREE.Group();
    tail.position.set(0, 0.26, -0.19);
    const tailMesh = new THREE.Mesh(GEO.catTail, furMat);
    tailMesh.position.y = 0.1;
    tailMesh.rotation.x = 0.5;
    tail.add(tailMesh);
    g.add(body, head, earL, earR, tail);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData = {
      d: rnd(8, this.S.streetLen - 8), side: Math.random() < 0.5 ? 1 : -1,
      offset: rnd(3.9, 4.1), dir: 1, speed: 0.35,
      sitUntil: 0, tail, head, phase: Math.random() * 10,
    };
    this.root.add(g);
    this.cat = g;
    this.loadCatModel(g);
  }

  /* 换成 models/cat.glb（CC0 · Polinket barn-cat）；加载失败就继续用拼的这只 */
  loadCatModel(g) {
    new GLTFLoader().load('models/cat.glb', (gltf) => {
      const src = gltf.scene;
      const box = new THREE.Box3().setFromObject(src);
      const size = box.getSize(new THREE.Vector3());
      // 原始 0.5 米高，先放到 0.75（1.5 倍），用户又要再小一点，落到 0.62
      const k = 0.62 / Math.max(0.001, size.y);
      const holder = new THREE.Group();
      src.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      holder.add(src);
      holder.scale.setScalar(k);
      for (const ch of [...g.children]) g.remove(ch);
      g.add(holder);
      g.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.userData.pickCore = true; }
      });
      g.userData.tail = null;
      g.userData.head = null;
      g.userData.model = holder;
      g.userData.baseY = 0;
      window.__catModel = 'glb';
    }, undefined, () => { window.__catModel = 'fallback'; });
  }

  /* ---------- 麻雀（电线上的） ---------- */
  buildBirds() {
    const wireY = 4.35;
    const d0 = this.S.streetLen * 0.42;
    const poseA = this.S.poseAt(d0, 1, this.S.CONFIG.poleOffset);
    const poseB = this.S.poseAt(d0 + 9, 1, this.S.CONFIG.poleOffset);
    const a = poseA.pos.clone();
    const b = poseB.pos.clone();
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x6a5b50, roughness: 0.95 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0x3a3028 });
    for (let i = 0; i < 6; i++) {
      const t = 0.2 + i * 0.12;
      const perch = new THREE.Vector3().lerpVectors(a, b, t);
      perch.y = wireY;
      const g = new THREE.Group();
      const body = new THREE.Mesh(GEO.birdBody, birdMat);
      body.scale.set(1, 0.9, 1.25);
      const tail = new THREE.Mesh(GEO.birdTail, birdMat);
      tail.position.set(0, 0.02, -0.1);
      tail.rotation.x = 0.35;
      const beak = new THREE.Mesh(GEO.birdBeak, beakMat);
      beak.position.set(0, 0.01, 0.1);
      beak.rotation.x = Math.PI / 2;
      g.add(body, tail, beak);
      g.position.copy(perch);
      g.rotation.y = Math.random() * Math.PI * 2;
      g.userData = { perch: perch.clone(), state: 'perch', timer: 0, vel: new THREE.Vector3(), phase: Math.random() * 6 };
      this.root.add(g);
      this.birds.push(g);
    }
  }

  /* ---------- 对话气泡 ---------- */
  /* ---------- 落叶 ---------- */
  buildLeaves() {
    const makeTex = (c1, c2) => {
      const s = 64;
      const cv = document.createElement('canvas');
      cv.width = cv.height = s;
      const x = cv.getContext('2d');
      const g = x.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(s / 2, s / 2, s * 0.30, s * 0.15, Math.PI / 5, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = 'rgba(60,44,24,0.35)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(s * 0.22, s * 0.62); x.lineTo(s * 0.78, s * 0.38);
      x.stroke();
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    this.leafTex = [
      makeTex('#9db26a', '#6d8a3c'),
      makeTex('#c9a24f', '#8d6a2a'),
      makeTex('#b98f5e', '#7d5a33'),
    ];

    this.leaves = [];
    const COUNT = 26;
    for (let i = 0; i < COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.leafTex[i % this.leafTex.length],
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const sc = rnd(0.10, 0.20);
      sp.scale.set(sc, sc * 0.62, 1);
      sp.userData = { vy: rnd(0.30, 0.62), sway: rnd(0, 6.28), swayAmp: rnd(0.35, 0.9), spin: rnd(-1.6, 1.6), reset: true };
      this.scene.add(sp);
      this.leaves.push(sp);
    }
  }

  respawnLeaf(sp, cam) {
    const d = sp.userData;
    sp.position.set(cam.x + rnd(-9, 9), cam.y + rnd(1.4, 4.2), cam.z + rnd(-10, 5));
    d.sway = rnd(0, 6.28);
    d.vy = rnd(0.30, 0.62);
    d.spin = rnd(-1.6, 1.6);
    d.reset = false;
    sp.material.opacity = 0.92;
  }
  buildBubble() {
    const style = document.createElement('style');
    style.textContent = `
      #life-bubble { position: fixed; z-index: 12; transform: translate(-50%, -100%); padding: 7px 13px;
        border-radius: 12px; background: rgba(253,245,230,0.95); color: #6b3a12; font-size: 14px;
        font-family: "KaiTi", "STKaiti", serif; letter-spacing: 1.5px; white-space: nowrap;
        box-shadow: 0 8px 22px rgba(0,0,0,0.45); pointer-events: none; opacity: 0;
        transition: opacity .25s ease, transform .25s ease; }
      #life-bubble.show { opacity: 1; }
      #life-bubble::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px;
        margin-left: -5px; background: rgba(253,245,230,0.95); transform: rotate(45deg); }
      #life-sound { position: fixed; top: 20px; right: 20px; z-index: 21; padding: 8px 16px; border-radius: 999px;
        font-size: 13px; letter-spacing: 1px; color: rgba(255,255,255,0.78); cursor: pointer;
        background: rgba(0,0,0,0.42); border: 1px solid rgba(255,255,255,0.22); backdrop-filter: blur(8px);
        transition: all .25s ease; }
      #life-sound:hover { color: #fff; background: rgba(255,255,255,0.18); }
      #life-sound.on { color: #2a1c08; background: linear-gradient(180deg,#ffe0a8,#ffb45e); border-color: transparent; }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'life-bubble';
    document.body.appendChild(el);
    this.bubbleEl = el;
  }

  say(text, anchor, duration = 2.6) {
    this.bubbleEl.textContent = text;
    this.bubbleEl.classList.add('show');
    this.bubbleTarget = anchor;
    this.bubbleTimer = duration;
  }

  buildSoundButton() {
    const btn = document.createElement('button');
    btn.id = 'life-sound';
    btn.type = 'button';
    btn.textContent = '🔇 市声';
    document.body.appendChild(btn);
    this.soundBtn = btn;
    btn.addEventListener('click', () => {
      this.ambience.toggle();
      btn.classList.toggle('on', this.ambience.enabled);
      btn.textContent = this.ambience.enabled ? '🔊 市声' : '🔇 市声';
    });
  }

  /* ---------- 环境声（全合成，不加载任何音频文件） ---------- */
  buildAmbience() {
    this.ambience = {
      ctx: null,
      enabled: false,
      duckFactor: 1,
      master: null,
      noise: null,
      cricket: null,
      bellTimer: 12,
      toggle() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;
        this.enabled = !this.enabled;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.master.gain.setTargetAtTime(this.enabled ? 0.5 * this.duckFactor : 0, this.ctx.currentTime, 0.3);
        if (this.bedGain) this.bedGain.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.5);
        if (this.enabled) {
          const h = window.__street && typeof window.__street.time === 'number' ? window.__street.time : 8;
          this.setBed(this.bedForHour(h), this.bedVolume(this.bedForHour(h)));
        }
      },
      init() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);

        // 真实录音的环境床走这条总线，开关声音时一起淡入淡出
        this.bedGain = this.ctx.createGain();
        this.bedGain.gain.value = 0;
        this.bedGain.connect(this.master);

        // 远处车流：粉红噪声 + 低通
        const len = this.ctx.sampleRate * 4;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.0990460;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 620;
        const g = this.ctx.createGain();
        g.gain.value = 0.55;
        src.connect(lp).connect(g).connect(this.master);
        this.lp = lp;
        src.start();
        this.noise = g;

        // 夜里的一点虫鸣
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 4200;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 11;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain).connect(osc.frequency);
        const cg = this.ctx.createGain();
        cg.gain.value = 0;
        osc.connect(cg).connect(this.master);
        osc.start();
        lfo.start();
        this.cricket = cg;

        // 雨声：同一段噪声过一遍高通
        const rsrc = this.ctx.createBufferSource();
        rsrc.buffer = buf; rsrc.loop = true;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 1500;
        const rg = this.ctx.createGain(); rg.gain.value = 0;
        rsrc.connect(hp).connect(rg).connect(this.master);
        rsrc.start();
        this.rainGain = rg;
      },
      /* ---------- 环境床：队友素材（CC0 录音），按时段循环 ---------- */
      beds: {},
      bedUrl: '',
      bedSrc: null,
      bedNodeGain: null,
      bedForHour(h) {
        if (h >= 5 && h < MORNING_BGM_END) return MORNING_BGM;
        if (h >= MORNING_BGM_END && h < 17.5) return 'audio/loop/loop_street_day_45s.mp3';
        return 'audio/loop/loop_night_market_45s.mp3';
      },
      bedVolume(url) {
        return url === MORNING_BGM ? 0.42 : 0.5;
      },
      async loadClip(url) {
        if (!this.ctx) return null;
        if (this.clips && this.clips[url]) return this.clips[url];
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          if (!this.clips) this.clips = {};
          this.clips[url] = buf;
          return buf;
        } catch (e) { return null; }
      },
      async setBed(url, vol) {
        if (!this.ctx || !this.bedGain) return;
        if (this.bedUrl === url) return;
        const buf = await this.loadClip(url);
        if (!buf) return;
        const t = this.ctx.currentTime;
        if (this.bedSrc) {
          const oldSrc = this.bedSrc, oldGain = this.bedNodeGain;
          oldGain.gain.setTargetAtTime(0, t, 0.6);
          setTimeout(() => { try { oldSrc.stop(); } catch (e) {} }, 1600);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(g).connect(this.bedGain);
        src.start();
        g.gain.setTargetAtTime(vol || 0.55, t, 0.9);
        this.bedSrc = src; this.bedNodeGain = g; this.bedUrl = url;
      },
      async oneShot(url, vol) {
        if (!this.ctx) return;
        const buf = await this.loadClip(url);
        if (!buf) return;
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
        s.connect(g).connect(this.master);
        s.start();
      },
      step() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const dur = 0.16;
        const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const s = this.ctx.createBufferSource(); s.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 300 + Math.random() * 140;
        const g = this.ctx.createGain(); g.gain.value = 0.5;
        s.connect(lp).connect(g).connect(this.master); s.start(t);
      },
      creak() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(92, t + 0.42);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 430; bp.Q.value = 6;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.10, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(bp).connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
      },
      clink() {
        if (!this.enabled || !this.ctx) return;
        [2350, 3180].forEach((fr, i) => {
          const t = this.ctx.currentTime + i * 0.035;
          const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.25);
        });
      },      setRain(on) {
        if (!this.ctx || !this.rainGain) return;
        this.rainGain.gain.setTargetAtTime(on ? 0.26 : 0, this.ctx.currentTime, 0.6);
      },
      zone(name) {
        if (!this.ctx || !this.lp) return;
        const table = {
          '炸串摊': [1500, 0.78], '烧烤车': [1500, 0.78],
          '茶馆': [360, 0.5], '书店': [300, 0.36], '中药铺': [430, 0.45],
          '包子铺': [700, 0.6], '面馆': [760, 0.62]
        };
        const [f, g] = table[name] || [620, 0.55];
        this.zoneGain = g;
        this.lp.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.5);
        if (this.noise) this.noise.gain.setTargetAtTime(this.enabled ? g : 0, this.ctx.currentTime, 0.5);
      },
      duck(f) {
        this.duckFactor = f;
        if (this.master && this.ctx) {
          this.master.gain.setTargetAtTime(this.enabled ? 0.5 * f : 0, this.ctx.currentTime, 0.25);
        }
      },
      /* 偶尔一声自行车铃 */
      bell() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        for (const [f, d] of [[1180, 0], [1760, 0.06]]) {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t + d);
          g.gain.linearRampToValueAtTime(0.12, t + d + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.5);
          o.connect(g).connect(this.master);
          o.start(t + d);
          o.stop(t + d + 0.6);
        }
      },
      update(dt, night) {
        if (!this.ctx) return;
        // 虫鸣只在夜里明显
        if (this.cricket) this.cricket.gain.setTargetAtTime(this.enabled ? 0.03 * night : 0, this.ctx.currentTime, 0.6);
        if (this.noise) this.noise.gain.setTargetAtTime(this.enabled ? (this.zoneGain || 0.55) - night * 0.15 : 0, this.ctx.currentTime, 0.8);
        this.bellTimer -= dt;
        if (this.bellTimer <= 0) {
          this.bell();
          this.bellTimer = rnd(25, 70);
        }
      },
    };
  }

  /* ---------- 点击互动 ----------
   * 用捕获阶段，命中行人/猫/麻雀后就把事件吞掉，
   * 免得同时触发主场景的“点击店铺弹窗”。 */
  bindClicks() {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const targets = () => [...this.people, this.cat, ...this.birds, ...this.lanterns].filter(Boolean);
    // 只认实体：人物看躯干/头，灯笼看灯身；光晕、绳、铁圈不吃点击
    const pickHits = (ray, list) => {
      const self = this;
      return ray.intersectObjects(list, true).filter((h) => {
        if (h.object.isSprite) return false;
        let o = h.object;
        while (o && !list.includes(o)) {
          if (o.userData && o.userData.noPick) return false;
          if (o.userData && o.userData.pickCore) return true;
          o = o.parent;
        }
        if (!o) return false;
        return o === self.cat || self.birds.includes(o) || o.userData.pickCore === true;
      });
    };
    const canvasEl = (this.S.renderer && this.S.renderer.domElement) || document.querySelector('canvas');
    const setCursor = (v) => {
      document.body.style.cursor = v;
      if (canvasEl) canvasEl.style.cursor = v;
    };
    let downX = 0, downY = 0;
    let hoverAt = 0;

    window.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; }, true);
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
      if (e.code === 'KeyE') { if (this.tryTalk()) e.preventDefault(); }
      if (e.code === 'Space') { if (this.tryHelp()) e.preventDefault(); }
    }, true);

    // 鼠标移到人/猫/麻雀身上时给个手型，提示“这里能点”
    window.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - hoverAt < 120) return;
      hoverAt = now;
      if (e.target && e.target.closest && e.target.closest('button, #shop-modal, #interior-view, #dish-view')) {
        setCursor('');
        return;
      }
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(ndc, this.camera);
      const hits = pickHits(ray, targets());
      const near = hits.length && hits[0].distance <= 22;
      setCursor(near ? 'pointer' : '');
    }, true);

    window.addEventListener('click', (e) => {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 12) return;
      if (e.target && e.target.closest && e.target.closest('button, #shop-modal, #interior-view, #dish-view')) return;
      ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(ndc, this.camera);
      // 店铺弹窗若已开，这一下算店铺的，不再顺带跟人搭话
      const modalEl = document.getElementById('shop-modal');
      if (modalEl && modalEl.classList.contains('show')) return;
      const list = targets();
      const hits = pickHits(ray, list);
      if (!hits.length) return;
      if (hits[0].distance > 22) return;
      let obj = hits[0].object;
      while (obj && !list.includes(obj)) obj = obj.parent;
      if (!obj) return;

      if (obj === this.cat) {
        this.beginHold(obj, e);
      } else if (this.lanterns.includes(obj)) {
        this.toggleLantern(obj);
      } else if (this.birds.includes(obj)) {
        this.scareBird(obj);
      } else {
        this.say(pick(LINES), obj);
        obj.userData.walk.idleUntil = this.clock + 2.0;
      }
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);
  }

  scareBird(bird) {
    if (bird.userData.state === 'flying') return;
    bird.userData.state = 'flying';
    bird.userData.timer = rnd(9, 18);
    bird.userData.vel.set(rnd(-2.4, 2.4), rnd(2.6, 4.2), rnd(-2.4, 2.4));
    this.say('啾！', bird, 1.1);
  }

  /* ---------- 新加的几种互动 ---------- */

  toggleLantern(g) {
    if (!g) return;
    const d = g.userData;
    const nowOn = d.manual === true || (d.manual !== false && this.night > 0.25);
    d.manual = !nowOn;
    if (nowOn) {
      d.body.material.emissiveIntensity = 0.02;
      d.glow.material.opacity = 0;
      this.litCount = Math.max(0, this.litCount - 1);
    } else {
      d.body.material.emissiveIntensity = 2.0;
      d.glow.material.opacity = 0.85;
      this.litCount += 1;
      if (this.litCount === 6) {
        this.say('这一排，都亮了。', g, 2.6);
        window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '点亮', name: '一排灯笼' } }));
      }
    }
  }

  petCat(cat) {
    this.catFollowUntil = this.clock + 45;
    cat.userData.following = true;
    window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '招呼', name: '猫跟了一段' } }));
  }

  beginHold(cat, e) {
    this.hold = { t: 0, cat, x: e.clientX, y: e.clientY };
    const up = () => {
      window.removeEventListener('pointerup', up, true);
      const h = this.hold;
      this.hold = null;
      if (window.__ui && window.__ui.holdRing) window.__ui.holdRing(false);
      if (!h) return;
      if (h.t >= 1.15) this.petDeep(cat);
      else {
        this.say('喵～', cat, 1.4);
        cat.userData.sitUntil = this.clock + 2.6;
        cat.userData.following = true;
        this.catFollowUntil = this.clock + 20;
        this.catAlbum(cat);
      }
    };
    window.addEventListener('pointerup', up, true);
  }

  petDeep(cat) {
    cat.userData.following = false;
    cat.userData.sitUntil = this.clock + 6.5;
    this.catGiftAt = this.clock + rnd(20, 38);
    this.say('呼噜…呼噜…', cat, 2.6);
    window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '顺毛', name: '猫在脚边打了个滚' } }));
    this.catAlbum(cat);
  }

  /* 猫的两张实拍：点一下翻一张，末尾点掉 */
  catAlbum(cat) {
    if (typeof window.__shopMoment !== 'function') return;
    try {
      window.__shopMoment({ frames: [
        { src: 'images/cat/cat-pet.jpg', hold: 60000, caption: '手刚伸过去，它张嘴就叼住——不是咬，是讨摸。' },
        { src: 'images/cat/cat-sleep.jpg', hold: 60000, caption: '摸够了，它翻个身，四只爪朝天，尾巴尖还在轻轻打拍子。' }
      ] });
    } catch (err) { /* 灯箱不可用就当没这回事 */ }
  }

  replyTalk(text) {
    if (!text) return;
    const t = String(text).trim();
    if (!t) return;
    let line = '你说啥？街上吵，我没听清。';
    if (/多少|几块|价钱|怎么卖/.test(t)) line = '不贵，就这个价，天天有人来。';
    else if (/贵|便宜/.test(t)) line = '嫌贵？那给你添一勺。';
    else if (/好吃|香|味道|尝/.test(t)) line = '刚出锅的，趁热。';
    else if (/几点|收摊|打烊|晚/.test(t)) line = '早着呢，灯还亮着。';
    else if (/谢谢|多谢/.test(t)) line = '客气啥。';
    else if (/你|老板|哪/.test(t)) line = '守这摊十几年了，这条街我熟。';
    this.say(line, this.anchor, 3.4);
    window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '搭话', name: t.slice(0, 12) } }));
  }

  trackYield() {
    if (this.clock < (this.yieldAt || 0)) return;
    const cam = this.camera.position;
    for (const p of this.people) {
      const w = p.userData && p.userData.walk;
      if (!w || w.idleUntil > this.clock) continue;
      if (p.position.distanceTo(cam) < 1.7) {
        w.idleUntil = this.clock + 1.6;
        this.yieldAt = this.clock + 10;
        this.say('您先过。', p, 1.8);
        return;
      }
    }
  }
  trackWait(dt, shop, d2) {
    const near = shop && shop.name === '包子铺' && d2 < 34;
    this.waitT = near ? (this.waitT || 0) + dt : Math.max(0, (this.waitT || 0) - dt * 2);
    if (!near) { this.waitStage = 0; return; }
    if (!this.waitStage && this.waitT > 6) { this.waitStage = 1; this.say('汽还差一口气。', this.anchor, 2.2); }
    else if (this.waitStage === 1 && this.waitT > 15) { this.waitStage = 2; this.say('快了，盖子开始响了。', this.anchor, 2.2); }
    else if (this.waitStage === 2 && this.waitT > 25) {
      this.waitStage = 3;
      this.say('掀盖了，热气扑脸。', this.anchor, 3.4);
      window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '守候', name: '等到第一笼' } }));
    }
  }
  shopOnScreen(pos) {
    const v = pos.clone();
    v.y += 1.9;
    const cam = this.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const toPos = pos.clone().sub(cam.position);
    if (toPos.dot(dir) <= 0.5) return false;
    v.project(cam);
    if (v.z > 1) return false;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return x > 160 && x < window.innerWidth - 200 && y > 150 && y < window.innerHeight - 230;
  }

  vendorCallout() {
    const shop = this.nearShop;
    if (!shop) return;
    const cfg = (window.__shopInfo || {})[shop.name];
    if (cfg) {
      const h = this.S.time;
      const open = cfg.open < cfg.close ? (h >= cfg.open && h < cfg.close) : (h >= cfg.open || h < cfg.close);
      if (!open) { this.calloutAt = this.clock + 8; return; }
    }
    const p = this.S.poseAt(shop.d, shop.side, this.S.CONFIG.sidewalkOuter + 0.45).pos;
    if (!this.shopOnScreen(p)) { this.calloutAt = this.clock + 6; return; }
    this.anchor.position.set(p.x, 2.05, p.z);
    this.say(CALLS[shop.name] || pick(Object.values(CALLS)), this.anchor, 3.4);
    this.callout = this.clock + 3.4;
    this.calloutAt = this.clock + rnd(18, 30);
  }

  tryTalk() {
    if (this.clock > this.callout && !this.nearShop) return false;
    /* 吆喝过去了，站在店门口按 E 也能开口 */
    if (this.nearShop) {
      const p = this.S.poseAt(this.nearShop.d, this.nearShop.side, this.S.CONFIG.sidewalkOuter + 0.45).pos;
      this.anchor.position.set(p.x, 2.05, p.z);
    }
    this.callout = 0;
    const who = this.nearShop ? this.nearShop.name : '摊主';
    if (window.__ui && window.__ui.openTalk) {
      window.__ui.openTalk(who, (text) => this.replyTalk(text));
      return true;
    }
    this.say(pick(REPLIES), this.anchor, 2.6);
    return true;
  }

  tryHelp() {
    const cart = this.nearCart;
    if (!cart) return false;
    this.helpCount += 1;
    this.steamEmitters.push({ pos: cart.position.clone().setY(1.15), rate: 0.05, strength: 1.5, t: 0, puffs: [], temp: this.clock + 2.6 });
    if (this.helpCount % 3 === 0) this.say('哎，谢了啊。', cart, 2.2);
    if (this.helpCount === 6) {
      window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '帮衬', name: '翻了六串' } }));
    }
    return true;
  }

  /* ---------- 雨点打在地上的水花 ---------- */
  buildRipples() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.48);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.ripples = [];
    for (let i = 0; i < 40; i += 1) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.ripples.push({ mesh, life: 0, max: 1 });
    }
    this._rippleAt = 0;
  }

  updateRipples(dt) {
    if (!this.ripples) return;
    if (!this.rainOn) {
      for (const r of this.ripples) { if (r.mesh.visible) { r.mesh.visible = false; r.life = 0; } }
      return;
    }
    const cam = this.camera.position;
    this._rippleAt -= dt;
    if (this._rippleAt <= 0) {
      this._rippleAt = 0.045;
      const r = this.ripples.find((x) => !x.mesh.visible);
      if (r) {
        const a = rnd(0, Math.PI * 2);
        const d = rnd(0.8, 8);
        r.mesh.position.set(cam.x + Math.cos(a) * d, 0.035, cam.z + Math.sin(a) * d);
        r.mesh.scale.setScalar(0.28);
        r.mesh.visible = true;
        r.life = 0;
        r.max = rnd(0.55, 0.95);
        r.mesh.material.opacity = 0.72;
      }
    }
    for (const r of this.ripples) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      const k = Math.min(1, r.life / r.max);
      r.mesh.scale.setScalar(0.28 + k * 0.66);
      r.mesh.material.opacity = 0.72 * (1 - k);
      if (k >= 1) { r.mesh.visible = false; r.life = 0; }
    }
  }

  buildRain() {
    const COUNT = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 2 * 3);
    this.rainDrops = [];
    for (let i = 0; i < COUNT; i++) {
      const x = rnd(-26, 26), y = rnd(0, 18), z = rnd(-26, 26);
      this.rainDrops.push({ x, y, z, v: rnd(14, 22) });
      pos.set([x, y, z, x, y - 0.55, z], i * 6);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xbcd3e6, transparent: true, opacity: 0.34 });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.root.add(this.rain);
    return this.rain;
  }

  toggleRain(on) {
    this.rainOn = typeof on === 'boolean' ? on : !this.rainOn;
    if (!this.rain) this.buildRain();
    if (!this.ripples) this.buildRipples();
    this.rain.visible = this.rainOn;
    if (this.ambience && this.ambience.setRain) this.ambience.setRain(this.rainOn);
    if (this.rainOn) {
      window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '落雨', name: '在檐下站了会儿' } }));
    }
  }

  updateRain(dt) {
    if (!this.rain || !this.rainOn) return;
    const pos = this.rain.geometry.attributes.position;
    const cam = this.camera.position;
    // 脚步声：走出一米九就落一下
    if (!this._stepAt) this._stepAt = cam.clone();
    if (cam && this._stepAt) {
      if (this.camera.position.distanceToSquared(this._stepAt) > 3.6) {
        this._stepAt.copy(this.camera.position);
        if (this.ambience && this.ambience.step) this.ambience.step();
      }
    }
    for (let i = 0; i < this.rainDrops.length; i++) {
      const d = this.rainDrops[i];
      d.y -= d.v * dt;
      if (d.y < 0) { d.y = rnd(14, 18); d.x = rnd(-26, 26); d.z = rnd(-26, 26); }
      const bx = cam.x + d.x, bz = cam.z + d.z;
      const i6 = i * 6;
      pos.array[i6] = bx; pos.array[i6 + 1] = d.y; pos.array[i6 + 2] = bz;
      pos.array[i6 + 3] = bx; pos.array[i6 + 4] = d.y - 0.55; pos.array[i6 + 5] = bz;
    }
    pos.needsUpdate = true;
  }
  /* ---------- 每帧更新 ---------- */
  /* 声音：环境床按时段换、零星小声音随便撒 */
  tickAudio(dt) {
    const a = this.ambience;
    if (!a) return;
    const want = a.bedForHour(this.S.time);
    if (a.enabled && want !== a.bedUrl && !a.bedBusy) {
      a.bedBusy = true;
      Promise.resolve(a.setBed(want, a.bedVolume(want))).finally(() => { a.bedBusy = false; });
    }
    if (!a.enabled) return;
    // 清晨 BGM 时段不再叠随机市声，免得盖住曲子
    if (want === MORNING_BGM) return;
    this._shotT = (this._shotT === undefined ? 8 : this._shotT) - dt;
    if (this._shotT <= 0) {
      this._shotT = 12 + Math.random() * 14;
      const list = [
        ['audio/sfx/sfx_wok_sizzling.mp3', 0.18],
        ['audio/sfx/sfx_cash_register.mp3', 0.14],
        ['audio/sfx/sfx_notify_klick.mp3', 0.12],
        ['audio/sfx/sfx_pipa_riff.mp3', 0.12]
      ];
      const pick = list[Math.floor(Math.random() * list.length)];
      a.oneShot(pick[0], pick[1]);
    }
  }

  update(dt, now) {
    this.clock += dt;
    this.night = this.S.night;
    if (this.flags) {
      for (const fl of this.flags) fl.rotation.z = Math.sin(this.clock * 0.9 + fl.userData.phase) * 0.045;
    }
    const cam = this.camera.position;
    // 夜市推车是后来才生成的：隔两秒扫一次，给新出现的推车挂上气
    if (!this._cartScan || this.clock - this._cartScan > 2) {
      this._cartScan = this.clock;
      const models = (this.S && this.S.allSpawnedModels) || [];
      for (const m of models) {
        if (!m || !m.userData || !m.userData.isNight) continue;
        if (m.userData.__steamEmitter) continue;
        const p = m.getWorldPosition(new THREE.Vector3());
        const em = this.addEmitter(new THREE.Vector3(p.x, p.y + 1.05, p.z), 0.6, 1.15);
        em.cartModel = m;
        m.userData.__steamEmitter = em;
      }
    }
    // 脚步声：走出一米九就落一下
    if (!this._stepAt) this._stepAt = cam.clone();
    if (cam.distanceToSquared(this._stepAt) > 3.6) {
      this._stepAt.copy(cam);
      if (this.ambience && this.ambience.step) this.ambience.step();
    }
    this.tickAudio(dt);
    if (!this._prevPos) this._prevPos = cam.clone();
    else {
      const moved = cam.distanceTo(this._prevPos);
      if (moved < 3) this.walked = (this.walked || 0) + moved;
      this._prevPos.copy(cam);
    }
    const streetLen = this.S.streetLen;
    this.updateRain(dt);
    this.updateRipples(dt);
    /* 最近的铺子：用来吆喝、也用来换市声 */
    let nshop = null, nd = 1e9;
    for (const s of this.shops) {
      const p = this.S.poseAt(s.d, s.side, this.S.CONFIG.sidewalkOuter + 0.5).pos;
      const dd = (p.x - cam.x) * (p.x - cam.x) + (p.z - cam.z) * (p.z - cam.z);
      if (dd < nd) { nd = dd; nshop = s; }
    }
    // 6m 进、6.4m 出，避免在门口来回踩线时反复招呼
if (nshop && nd < 36) this._nearShop = nshop;
else if (!nshop || nd >= 41) this._nearShop = null;
this.nearShop = this._nearShop || null;
    this.trackWait(dt, this.nearShop, nd);
    this.trackYield();
    if (this.catGiftAt && this.clock > this.catGiftAt && this.cat) {
      this.catGiftAt = 0;
      this.say('猫叼来半截红线。', this.cat, 3.0);
      window.dispatchEvent(new CustomEvent('yanhuo:journal', { detail: { kind: '彩蛋', name: '猫的礼物' } }));
    }
    this.zoneTimer -= dt;
    if (this.zoneTimer <= 0) {
      this.zoneTimer = 0.8;
      const nm = this.nearShop ? (this.nearShop.name || '') : '';
      if (nm !== this.zone) { this.zone = nm; if (this.ambience && this.ambience.zone) this.ambience.zone(nm); }
    }
    if (this.clock > this.calloutAt && !this.bubbleTarget) this.vendorCallout();
    /* 夜里的推车 */
    this.cartTimer -= dt;
    if (this.cartTimer <= 0) {
      this.cartTimer = 0.5;
      let near = null, bd = 42;
      for (const m of this.S.allSpawnedModels) {
        if (!m.userData || !m.userData.isNight || !m.visible) continue;
        const dd = m.position.distanceToSquared(cam);
        if (dd < bd) { bd = dd; near = m; }
      }
      const changed = (!!near) !== (!!this.nearCart);
      this.nearCart = near;
      if (changed && window.__ui && window.__ui.setPrompt) {
        window.__ui.setPrompt(near ? '空格 · 帮摊主翻两下串' : '');
      }
    }

    /* 行人 */
    for (const p of this.people) {
      const w = p.userData.walk;
      const rig = p.userData.rig;
      if (p.userData.umb) p.userData.umb.visible = !!this.rainOn && !!p.userData.hasUmb;
      const idle = w.idle || this.clock < w.idleUntil;
      if (!idle && w.speed > 0) {
        const rush = this.rainOn && !p.userData.hasUmb ? 1.9 : 1;
        w.d += w.dir * w.speed * dt * (this.rainOn ? 1.4 : 1) * rush;
        if (w.d > streetLen - 5) { w.d = streetLen - 5; w.dir = -1; }
        if (w.d < 5) { w.d = 5; w.dir = 1; }
      }
      const u = w.d / streetLen;
      const sp = this.S.sampleStreet(clamp01(u));
      p.position.set(
        sp.pos.x + sp.perp.x * w.side * w.offset,
        0.12,
        sp.pos.z + sp.perp.z * w.side * w.offset
      );
      const faceX = sp.tan.x * w.dir;
      const faceZ = sp.tan.z * w.dir;
      p.rotation.y = Math.atan2(faceX, faceZ) + (idle ? Math.sin(this.clock * 0.6 + p.userData.phase) * 0.25 : 0);

      const moving = !idle;
      const stride = moving ? w.speed * 6.2 : 1.5;
      const phase = p.userData.phase + this.clock * stride;
      const sw = Math.sin(phase);
      const baseY = rig.baseY ?? 0;

      if (moving) {
        rig.legL.rotation.x = sw * 0.5;
        rig.legR.rotation.x = -sw * 0.5;
        // 膝盖只在腿往后收的时候弯
        rig.kneeL.rotation.x = -Math.max(0, Math.sin(phase + 2.4)) * 0.9;
        rig.kneeR.rotation.x = -Math.max(0, Math.sin(phase + 2.4 + Math.PI)) * 0.9;
        rig.armL.rotation.x = -sw * 0.4;
        rig.armR.rotation.x = sw * 0.4;
        rig.elbowL.rotation.x = -0.28 - Math.max(0, -sw) * 0.3;
        rig.elbowR.rotation.x = -0.28 - Math.max(0, sw) * 0.3;
        rig.body.position.y = baseY + Math.abs(Math.sin(phase)) * 0.016;
        rig.body.rotation.x = 0.05;
        rig.torso.rotation.z = sw * 0.026;
        rig.torso.rotation.y = -sw * 0.05;
        rig.hips.rotation.z = -sw * 0.03;
        if (this.rainOn && !p.userData.hasUmb) {
          rig.armL.rotation.x = -2.05 + sw * 0.09;
          rig.armR.rotation.x = -2.05 - sw * 0.09;
          rig.elbowL.rotation.x = -0.95;
          rig.elbowR.rotation.x = -0.95;
          rig.body.rotation.x = 0.16;
        }
      } else {
        // 站着的人：呼吸、微微换重心、东张西望
        rig.legL.rotation.x = 0.02;
        rig.legR.rotation.x = -0.02;
        rig.kneeL.rotation.x = 0;
        rig.kneeR.rotation.x = 0;
        rig.armL.rotation.x = Math.sin(this.clock * 1.1 + p.userData.phase) * 0.05;
        rig.armR.rotation.x = -Math.sin(this.clock * 1.1 + p.userData.phase) * 0.05;
        rig.elbowL.rotation.x = -0.32;
        rig.elbowR.rotation.x = -0.3;
        rig.body.position.y = baseY + Math.sin(this.clock * 1.6 + p.userData.phase) * 0.004;
        rig.body.rotation.x = 0;
        rig.torso.rotation.z = Math.sin(this.clock * 0.8 + p.userData.phase) * 0.012;
        rig.torso.rotation.y = 0;
        rig.hips.rotation.z = 0;
      }
      rig.head.rotation.y = Math.sin(this.clock * 0.6 + p.userData.phase) * (moving ? 0.22 : 0.45);
      rig.head.rotation.x = Math.sin(this.clock * 0.43 + p.userData.phase * 1.7) * 0.05;
      p.visible = p.position.distanceToSquared(cam) <= 70 * 70;
    }

    /* 猫 */
    if (this.cat) {
      const c = this.cat.userData;
      const following = this.catFollowUntil > this.clock;
      if (following) {
        const dx = cam.x - this.cat.position.x, dz = cam.z - this.cat.position.z;
        const dd = Math.hypot(dx, dz);
        const moving = dd > 1.25;
        if (moving) {
          this.cat.position.x += (dx / dd) * 1.15 * dt;
          this.cat.position.z += (dz / dd) * 1.15 * dt;
          this.cat.rotation.y = Math.atan2(dx, dz);
        }
        // 坐姿模型走路会"滑"，加一点蹦跳让它像在颠着走
        const hop = moving ? Math.abs(Math.sin(this.clock * 7.5 + c.phase)) * 0.055 : 0;
        this.cat.position.y = (c.baseY !== undefined ? c.baseY : 0.12) + hop;
        if (c.tail) c.tail.rotation.z = Math.sin(this.clock * 3.2 + c.phase) * 0.6;
        if (c.head) c.head.rotation.y = Math.sin(this.clock * 0.8 + c.phase) * 0.3;
      } else {
        const sit = this.clock < c.sitUntil;
        if (!sit) {
          c.d += c.dir * c.speed * dt;
          if (c.d > streetLen - 6) { c.d = streetLen - 6; c.dir = -1; }
          if (c.d < 6) { c.d = 6; c.dir = 1; }
        }
        const sp = this.S.poseAt(c.d, c.side, c.offset);
        const baseY = (c.baseY !== undefined ? c.baseY : 0.12);
        const bob = sit ? 0 : Math.abs(Math.sin(this.clock * 7.5 + c.phase)) * 0.03;
        this.cat.position.set(sp.pos.x, baseY - (sit ? 0.02 : 0) + bob, sp.pos.z);
        const fx = sp.tan.x * c.dir, fz = sp.tan.z * c.dir;
        this.cat.rotation.y = Math.atan2(fx, fz);
        if (c.tail) c.tail.rotation.z = Math.sin(this.clock * 2.2 + c.phase) * 0.5;
        if (c.head) c.head.rotation.y = Math.sin(this.clock * 0.5 + c.phase) * 0.4;
      }
    }
    /* 麻雀 */
    for (const b of this.birds) {
      const u = b.userData;
      if (u.state === 'perch') {
        if (b.position.distanceTo(cam) < 5.5) this.scareBird(b);
        else b.rotation.y += Math.sin(this.clock * 0.8 + u.phase) * 0.002;
      } else {
        u.timer -= dt;
        b.position.addScaledVector(u.vel, dt);
        u.vel.y -= 1.2 * dt;
        b.rotation.z = Math.sin(this.clock * 18) * 0.25;
        if (u.timer <= 0) {
          u.state = 'perch';
          b.position.copy(u.perch);
          b.rotation.set(0, Math.random() * Math.PI * 2, 0);
        }
      }
    }

    /* 蒸汽：一小团一小团往上飘，边飘边散（只给镜头附近的摊子冒） */
    for (const em of this.steamEmitters) {
      // 推车到点是把 scale 缩到 0.001 收摊的，不是 visible=false —— 这里两种都要认
      const cartHidden = em.cartModel && (!em.cartModel.visible || em.cartModel.scale.x < 0.05);
    if (cartHidden) {
      for (const s of em.puffs) { this.root.remove(s); s.material.dispose(); }
      em.puffs.length = 0;
    }
    if (!cartHidden && em.pos.distanceToSquared(cam) < 34 * 34) {
        em.t -= dt;
        if (em.t <= 0 && em.puffs.length < 15) {
          this.spawnPuff(em);
          em.t = rnd(0.06, 0.11) / Math.max(0.4, em.strength);
        }
      }
      for (let i = em.puffs.length - 1; i >= 0; i--) {
        const s = em.puffs[i];
        const u = s.userData;
        u.life += dt;
        const k = u.life / u.max;
        if (k >= 1) {
          this.root.remove(s);
          s.material.dispose();
          em.puffs.splice(i, 1);
          continue;
        }
        s.position.y += u.vy * (1 - k * 0.45) * dt;
        s.position.x += (u.drift + Math.sin(u.sway + this.clock * 1.7) * 0.11) * dt;
        s.position.z += Math.cos(u.sway + this.clock * 1.3) * 0.07 * dt;
        const grow = 1 + k * 2.6;
        s.scale.set(u.baseScale * grow * 1.1, u.baseScale * grow * 1.5, 1);
        s.material.rotation += u.spin * dt;
        const dCam = s.position.distanceTo(this.camera.position);
        const nearFade = Math.min(1, Math.max(0, (dCam - 1.6) / 2.4));
        s.material.opacity = 0.80 * Math.sin(Math.PI * Math.min(1, k * 1.02)) * (0.85 + this.night * 0.15) * nearFade;
      }
    }

    /* 落叶 */
    const camPos = this.camera.position;
    for (const lf of this.leaves) {
      const d = lf.userData;
      if (d.reset || lf.position.y < 0.12 || Math.abs(lf.position.x - camPos.x) > 26) {
        this.respawnLeaf(lf, camPos);
      }
      lf.position.y -= d.vy * dt;
      lf.position.x += Math.sin(this.clock * 0.9 + d.sway) * d.swayAmp * dt;
      lf.position.z += Math.cos(this.clock * 0.7 + d.sway) * 0.28 * dt;
      lf.material.rotation += d.spin * dt;
      if (lf.position.y < 1.2) lf.material.opacity = Math.max(0, (lf.position.y - 0.12) / 1.1) * 0.9;
    }
    this.steamEmitters = this.steamEmitters.filter(e => !e.temp || e.temp > this.clock);

    /* 灯笼 */
    const late = this.S.time >= 23 || this.S.time < 4.5;
    if (late !== this.__late) {
      this.__late = late;
      for (const m of this.S.allSpawnedModels || []) {
        if (m.userData && m.userData.isNight) m.scale.setScalar(late ? 0.001 : 1);
      }
    }
    const lanternEmissive = (0.04 + Math.pow(this.night, 1.4) * 1.9) * (late ? 0.45 : 1);
    for (const l of this.lanterns) {
      const d = l.userData;
      l.rotation.z = Math.sin(this.clock * 0.7 + d.phase) * 0.045;
      if (d.manual === false) {
        d.body.material.emissiveIntensity = 0.02;
        d.glow.material.opacity = 0;
      } else if (d.manual === true) {
        d.body.material.emissiveIntensity = 2.0;
        d.glow.material.opacity = 0.85 * (this.rainOn ? 0.72 : 1);
      } else {
        d.body.material.emissiveIntensity = lanternEmissive;
        d.glow.material.opacity = this.night * 0.55 * (this.rainOn ? 0.72 : 1);
      }
    }

    /* 雨棚展开 / 收起 */
    if (this.awnings) {
      const target = this.rainOn ? 1 : 0;
      for (const a of this.awnings) {
        const d = a.userData;
        d.grow += (target - d.grow) * Math.min(1, dt * 6);
        a.visible = d.grow > 0.02;
        a.scale.set(1, 1, 0.35 + 0.65 * d.grow);
        d.mat.opacity = Math.min(1, d.grow * 1.4);
        d.poleMat.opacity = Math.min(1, d.grow * 1.4);
      }
    }

    /* 夜里店铺门口的一点暖光 */
    for (const g of this.doorGlows) {
      g.material.opacity = this.night * 0.40;
    }

    /* 气泡跟随 */
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTarget) {
        const v = new THREE.Vector3();
        this.bubbleTarget.getWorldPosition(v);
        v.y += this.bubbleTarget === this.cat ? 0.95 : 2.05;
        v.project(this.camera);
        const marginX = 96;
        const rawX = (v.x * 0.5 + 0.5) * window.innerWidth;
        const rawY = (-v.y * 0.5 + 0.5) * window.innerHeight;
        const x = Math.max(marginX, Math.min(window.innerWidth - marginX, rawX));
        const y = Math.max(120, Math.min(window.innerHeight - 170, rawY));
        this.bubbleEl.style.left = x + 'px';
        this.bubbleEl.style.top = y + 'px';
        this.bubbleEl.style.display = v.z > 1 ? 'none' : 'block';
      }
      if (this.bubbleTimer <= 0) {
        this.bubbleEl.classList.remove('show');
        this.bubbleTarget = null;
        this.bubbleEl.style.display = 'none';
      }
    }

    /* 声音 */
    this.ambience.update(dt, this.night);

    /* 夜间摊位出现后补挂蒸汽 */
    const models = this.S.allSpawnedModels || [];
    for (const m of models) {
      if (!m.userData || !m.userData.isNight || !m.visible || m.userData.__steam) continue;
      m.userData.__steam = true;
      const pos = new THREE.Vector3();
      m.getWorldPosition(pos);
      const em = this.addEmitter(new THREE.Vector3(pos.x, 1.4, pos.z), 0.32, 1.2);
      em.cartModel = m;
    }
  }
}

/* ---------- 启动 ---------- */
whenReady().then((S) => {
  if (!S) return;
  window.__life = new Life(S);
  window.__life.duckAmbience = (f) => window.__life.ambience.duck(f);
  window.__life.setRain = (on) => window.__life.toggleRain(on);
  window.__life.creak = () => window.__life.ambience.creak();
  window.__life.clink = () => window.__life.ambience.clink();
}).catch((err) => {
  console.warn('[alive] 启动失败', err);
});
