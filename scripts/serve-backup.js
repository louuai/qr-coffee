// Minimal static server with SPA fallback for frontend-backup
// Usage: node scripts/serve-backup.js [port]

const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', 'frontend-backup');
const port = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, data, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(data);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const safePath = urlPath.replace(/(\.\.\/?)+/g, ''); // basic path traversal guard
  let filePath = path.join(root, safePath);

  // If path is a directory, try index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    // Fallback SPA: always serve index.html for unknown routes
    filePath = path.join(root, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Read error', err);
      return send(res, 500, 'Internal Server Error');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    send(res, 200, data, type);
  });
});

server.listen(port, () => {
  console.log(`Serving frontend-backup at http://localhost:${port}`);
  console.log('SPA fallback active: /menu/:slug etc. will return index.html');
});
