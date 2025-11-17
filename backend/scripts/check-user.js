const mysql = require('mysql2/promise');
require('dotenv').config();
(async ()=>{
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const db = process.env.DB_NAME || 'rasops_qr';
  const conn = await mysql.createConnection({host, port, user, password: pass, database: db});
  const [rows] = await conn.query('SELECT id, email, name, createdAt FROM users WHERE email LIKE ?', ['%test123456789%']);
  console.log(rows);
  await conn.end();
})();