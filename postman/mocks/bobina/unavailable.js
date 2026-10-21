const http = require('node:http');
// @endpoint GET /api/health
http
  .createServer((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '5' });
    res.end(JSON.stringify({ error: 'Serviço temporariamente indisponível.' }));
  })
  .listen(process.env.PORT, '127.0.0.1');
