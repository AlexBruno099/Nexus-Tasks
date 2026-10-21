const http = require('node:http');
// @endpoint GET /api/health
http
  .createServer((_req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '5' });
    res.end(JSON.stringify({ error: 'Limite de requisições excedido.' }));
  })
  .listen(process.env.PORT, '127.0.0.1');
