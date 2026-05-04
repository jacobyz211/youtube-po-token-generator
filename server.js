import { generate } from './index.js';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;

createServer(async (req, res) => {
  if (req.url !== '/token') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found. Use GET /token' }));
  }
  try {
    const { visitorData, poToken } = await generate();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ visitorData, poToken }));
  } catch (e) {
    console.error('[poToken] generation failed:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log(`[poToken] server listening on :${PORT}`));
