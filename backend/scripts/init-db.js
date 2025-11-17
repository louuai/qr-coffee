// Simple DB initializer using mysql2
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main(){
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const db = process.env.DB_NAME || 'rasops_qr';

  console.log(`Connecting to MySQL ${host}:${port} as ${user}`);
  try{
    const conn = await mysql.createConnection({host, port, user, password: pass});
    console.log('Connected. Creating database if not exists...');
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\`;`);
    console.log(`Database ${db} is ready.`);
    await conn.end();
    process.exit(0);
  }catch(err){
    console.error('Failed to create database:', err.message || err);
    process.exit(2);
  }
}

main();
