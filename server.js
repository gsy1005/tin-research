/* 本地预览与每日填报：npm run dev -- --host 127.0.0.1 --port 7100 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
function argVal(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const HOST = argVal('host', '127.0.0.1');
const PORT = parseInt(argVal('port', '7100'), 10);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function dailyUpdate(req, res) {
  const chunks = [];
  let size = 0, tooLarge = false;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > 64 * 1024) { tooLarge = true; return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) return sendJson(res, 413, { ok: false, error: '填报内容超过 64KB' });
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch (_) { return sendJson(res, 400, { ok: false, error: '填报内容不是有效 JSON' }); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) {
      return sendJson(res, 400, { ok: false, error: '请填写有效日期' });
    }
    const env = { IN_DATE: body.date };
    const numbers = { trx: 'IN_TRX', trt: 'IN_TRT', shfe: 'IN_SHFE', yx: 'IN_YX', sox: 'IN_SOX', idn: 'IN_IDN' };
    const dates = body.dates || {};
    for (const [key, name] of Object.entries(numbers)) {
      const value = String(body[key] == null ? '' : body[key]).trim();
      if (!value) continue;
      if (!Number.isFinite(Number(value))) return sendJson(res, 400, { ok: false, error: key + ' 不是有效数值' });
      const valueDate = String(dates[key] || body.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) return sendJson(res, 400, { ok: false, error: key + ' 的数据日期无效' });
      env[name] = value;
      env[name + '_DATE'] = valueDate;
    }
    const texts = {
      macroToday: 'IN_MACRO_TODAY', macroWatch: 'IN_MACRO_WATCH', ai: 'IN_AI',
      fundamentals: 'IN_FUNDAMENTALS', mine: 'IN_MINE', lme: 'IN_LME_NOTE',
      spot: 'IN_SPOT_NOTE', other: 'IN_OTHER', spread: 'IN_SPREAD',
      demand: 'IN_DEMAND', position: 'IN_POSITION', risk: 'IN_RISK',
      sentiment: 'IN_SENTIMENT', strategy: 'IN_STRATEGY'
    };
    for (const [key, name] of Object.entries(texts)) env[name] = String(body[key] || '');
    const signals = body.signals || {};
    const allowedSignals = new Set(['强多', '利多', '结构多', '中性略偏多', '中性', '双向', '中性略偏空', '偏空', '强空']);
    for (const key of ['macro', 'ai', 'inventory', 'spot']) {
      const value = String(signals[key] || '');
      if (value && !allowedSignals.has(value)) return sendJson(res, 400, { ok: false, error: '评分信号无效' });
      env['IN_SIGNAL_' + key.toUpperCase()] = value;
    }
    const run = spawnSync(process.env.PYTHON || 'python', ['tools/apply_manual_inputs.py'], {
      cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120000,
      windowsHide: true, maxBuffer: 4 * 1024 * 1024
    });
    if (run.error) return sendJson(res, 500, { ok: false, error: '更新程序启动失败：' + run.error.message });
    if (run.status !== 0) return sendJson(res, 500, { ok: false, error: (run.stderr || run.stdout || '更新程序执行失败').trim().slice(-3000) });
    try { sendJson(res, 200, JSON.parse(run.stdout.trim())); }
    catch (_) { sendJson(res, 500, { ok: false, error: '更新程序未返回有效结果' }); }
  });
  req.on('error', () => { if (!res.headersSent) sendJson(res, 400, { ok: false, error: '读取填报内容失败' }); });
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); }
  catch (_) { res.writeHead(400); return res.end('bad request'); }
  if (req.method === 'POST' && p === '/api/daily-update') return dailyUpdate(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('method not allowed'); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const noCache = /db_data\.js|cu_db_data\.js|data\.js|cu_data\.js|sheet\.js|summary_note\.js|daily_overrides\.js|daily_strategy\.js|daily_input\.html/.test(p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                         ...(noCache ? { 'Cache-Control': 'no-store' } : {}) });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(PORT, HOST, () => console.log(`tin-research preview: http://${HOST}:${PORT}/`));
