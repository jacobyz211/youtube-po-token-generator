const { generate } = require('./index.js');
const { createServer } = require('http');

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null;
let cacheTime = 0;

async function getToken() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL_MS) return cache;
  cache = null;
  const result = await generate();
  cache = result;
  cacheTime = now;
  if (global.gc) global.gc();
  return cache;
}

createServer(async (req, res) => {
  if (req.url !== '/token') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found. Use GET /token' }));
  }
  try {
    const { visitorData, poToken } = await getToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ visitorData, poToken }));
  } catch (e) {
    console.error('[poToken] generation failed:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log(`[poToken] server listening on :${PORT}`));
