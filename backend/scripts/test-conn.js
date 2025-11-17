const mysql = require('mysql2/promise');
require('dotenv').config();
(async ()=>{
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const db = process.env.DB_NAME || 'rasops_qr';
  try{
    console.log('Trying connection to database', db);
    const conn = await mysql.createConnection({host, port, user, password: pass, database: db});
    const [rows] = await conn.query('SELECT 1+1 AS result');
    console.log('Query result:', rows);
    await conn.end();
    process.exit(0);
  }catch(err){
    console.error('Connection failed:', err.message || err);
    process.exit(2);
  }
})();
