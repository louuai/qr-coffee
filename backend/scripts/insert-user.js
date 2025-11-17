const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();
(async ()=>{
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const db = process.env.DB_NAME || 'rasops_qr';
  const conn = await mysql.createConnection({host, port, user, password: pass, database: db});
  try{
    const pw = await bcrypt.hash('password123',10);
    const [r] = await conn.query('INSERT INTO users (name,email,passwordHash,role) VALUES (?,?,?,?)',['T','test123456789@example.com',pw,'admin']);
    console.log('inserted id', r.insertId);
  }catch(err){
    console.error('insert err', err && err.message ? err.message : err);
  } finally{ await conn.end(); }
})();