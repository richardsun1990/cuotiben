const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8787);
const DATA_FILE = process.env.DATA_FILE || '/data/sync.json';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.resolve(__dirname, '..');
const SYNC_TOKEN = process.env.DUDU_SYNC_TOKEN || process.env.SYNC_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  });
  res.end(payload);
}

function corsHeaders(req) {
  const origin = req.headers.origin || '';
  const allowOrigin = ALLOWED_ORIGINS.includes('*') || !origin || ALLOWED_ORIGINS.includes(origin) ? (origin || '*') : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-sync-token',
    'access-control-max-age': '86400'
  };
}

function isAuthed(req) {
  if (!SYNC_TOKEN) return true;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-sync-token'] || '');
  return token === SYNC_TOKEN;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        reject(new Error('请求数据过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON 格式不正确'));
      }
    });
    req.on('error', reject);
  });
}

function emptyStore() {
  return { app: 'dudu-cuotuiben', version: 1, updatedAt: 0, updatedBy: '', data: {} };
}

function readStore() {
  try {
    const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!store || typeof store !== 'object' || store.app !== 'dudu-cuotuiben') return emptyStore();
    return { ...emptyStore(), ...store, data: store.data && typeof store.data === 'object' ? store.data : {} };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('同步数据格式不正确');
  const out = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (typeof key !== 'string' || key.length > 120) return;
    if (value === null || typeof value === 'string') out[key] = value;
  });
  return out;
}

async function handleApi(req, res, pathname) {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return send(res, 204, '', headers);
  if (!isAuthed(req)) return send(res, 401, { error: '同步口令不正确' }, headers);

  if (pathname === '/api/sync' && req.method === 'GET') {
    return send(res, 200, readStore(), headers);
  }

  if (pathname === '/api/sync' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const current = readStore();
      const baseUpdatedAt = Number(body.baseUpdatedAt || 0);
      if (!body.force && current.updatedAt && baseUpdatedAt && baseUpdatedAt < current.updatedAt) {
        return send(res, 409, { error: '飞牛上已有更新，请先拉取再同步', remote: current }, headers);
      }
      const next = {
        ...emptyStore(),
        updatedAt: Date.now(),
        updatedBy: String(body.deviceId || 'unknown').slice(0, 80),
        data: normalizeData(body.data)
      };
      writeStore(next);
      return send(res, 200, next, headers);
    } catch (error) {
      return send(res, 400, { error: error.message || '同步失败' }, headers);
    }
  }

  return send(res, 404, { error: 'Not found' }, headers);
}

function safePublicPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const clean = decoded === '/' ? '/index.html' : decoded;
  const filePath = path.resolve(PUBLIC_DIR, `.${clean}`);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) return null;
  return filePath;
}

function handleStatic(req, res, pathname) {
  const filePath = safePublicPath(pathname);
  if (!filePath) return send(res, 403, 'Forbidden');
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') return send(res, 200, { ok: true, app: 'dudu-cuotuiben-sync' });
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname);
  return handleStatic(req, res, url.pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dudu Cuotiben server listening on http://0.0.0.0:${PORT}`);
  console.log(`Serving static files from ${PUBLIC_DIR}`);
  console.log(`Sync data file: ${DATA_FILE}`);
  console.log(SYNC_TOKEN ? 'Sync token enabled' : 'Warning: sync token is disabled');
});
