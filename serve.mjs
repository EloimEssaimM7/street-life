/* 这条街的小服务器：双击 start.cmd 就会跑起来
 * 1) 静态资源：本地模块必须走服务器（file:// 会被浏览器拦）
 * 2) 一点点"后台"：记录到访人数、手账笔数，存成 JSON —— 不联网、不上传任何东西 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8756);
const dataDir = path.join(root, 'data');
const statsFile = path.join(dataDir, 'stats.json');
const journalFile = path.join(dataDir, 'journal.jsonl');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

function ensureData() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(statsFile)) fs.writeFileSync(statsFile, JSON.stringify({ visits: 0, days: {} }, null, 2));
}
function today() { return new Date().toISOString().slice(0, 10); }
function readStats() {
  ensureData();
  try { return JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch { return { visits: 0, days: {} }; }
}
function bump(kind) {
  const s = readStats();
  const d = today();
  s.days[d] = s.days[d] || { visits: 0, journal: 0 };
  if (kind === 'visit') { s.visits = (s.visits || 0) + 1; s.days[d].visits += 1; }
  if (kind === 'journal') { s.days[d].journal = (s.days[d].journal || 0) + 1; }
  fs.writeFileSync(statsFile, JSON.stringify(s, null, 2));
  return s;
}
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); resolve(null); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

function api(req, res, url) {
  if (url === '/api/stats' && req.method === 'GET') {
    const s = readStats();
    const d = s.days[today()] || { visits: 0, journal: 0 };
    return send(res, 200, { today: d, total: { visits: s.visits || 0 } });
  }
  if (url === '/api/visit' && req.method === 'POST') {
    const s = bump('visit');
    const d = s.days[today()] || { visits: 0, journal: 0 };
    return send(res, 200, { ok: true, today: d });
  }
  if (url === '/api/journal' && req.method === 'POST') {
    readBody(req).then((raw) => {
      if (!raw) return send(res, 400, { ok: false });
      let entry;
      try { entry = JSON.parse(raw); } catch { return send(res, 400, { ok: false }); }
      const kind = String(entry.kind || '').slice(0, 10);
      const name = String(entry.name || '').slice(0, 40);
      if (!kind || !name) return send(res, 400, { ok: false });
      ensureData();
      fs.appendFileSync(journalFile, JSON.stringify({ t: Date.now(), kind, name }) + '\n');
      const s = bump('journal');
      const d = s.days[today()] || { visits: 0, journal: 0 };
      return send(res, 200, { ok: true, today: d });
    });
    return;
  }
  send(res, 404, { ok: false, error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url.startsWith('/api/')) return api(req, res, url);

  const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (!file.startsWith(root)) return send(res, 403, 'forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found', 'text/plain; charset=utf-8');
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache, must-revalidate' });
    res.end(buf);
  });
});

// 端口被占（多半是已经双击过一次了）：直接把浏览器指过去，别丢一堆报错
server.on('error', (err) => {
  const target = `http://127.0.0.1:${port}/`;
  if (err.code === 'EADDRINUSE') {
    console.log(`端口 ${port} 上已经有一条街在跑了：${target}`);
    console.log('直接看那条就行，这个黑窗口可以关掉。');
    if (!process.env.NOOPEN) exec(`start "" "${target}"`);
    setTimeout(() => process.exit(0), 900);
    return;
  }
  console.error('小服务器没能起来：' + err.message);
  console.error('换个端口试试，比如：set PORT=8760 && node serve.mjs');
  setTimeout(() => process.exit(1), 900);
});

server.listen(port, '127.0.0.1', () => {
  const target = `http://127.0.0.1:${port}/`;
  console.log(`老街开张了：${target}`);
  console.log('关掉这个黑窗口，街就散了。');
  if (!process.env.NOOPEN) exec(`start "" "${target}"`);
});
