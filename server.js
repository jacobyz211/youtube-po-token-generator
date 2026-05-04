const http = require('http');
const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = (parseInt(process.env.TOKEN_TTL_HOURS || '6', 10)) * 60 * 60 * 1000;

let cache = null;
let cacheTime = 0;
let generating = false;
let waiters = [];

async function generateToken() {
  // Use bgutils-js CLI if available, otherwise fall back to our lib
  const { generate } = require('./index.js');
  return generate();
}

async function getToken() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL_MS) return cache;

  // Deduplicate concurrent requests
  if (generating) {
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }

  generating = true;
  cache = null;

  try {
    const result = await generateToken();
    cache = result;
    cacheTime = Date.now();
    waiters.forEach(w => w.resolve(result));
    return result;
  } catch (e) {
    waiters.forEach(w => w.reject(e));
    throw e;
  } finally {
    generating = false;
    waiters = [];
    if (global.gc) global.gc();
  }
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', cached: !!cache }));
  }

  if (url !== '/token') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use GET /token' }));
  }

  try {
    const { visitorData, poToken } = await getToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ visitorData, poToken }));
  } catch (e) {
    console.error('[poToken] generation failed:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => {
  console.log(`[poToken] server listening on :${PORT}`);
  // Pre-warm token on startup so first user request is instant
  getToken().then(() => console.log('[poToken] initial token cached')).catch(e => console.error('[poToken] pre-warm failed:', e.message));
});
