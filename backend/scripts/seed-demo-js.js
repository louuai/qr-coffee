const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
require('dotenv').config();

(async ()=>{
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const db = process.env.DB_NAME || 'rasops_qr';
  const hostBase = process.env.HOST_BASE_URL || 'http://localhost:3000';

  const conn = await mysql.createConnection({host, port, user, password: pass, database: db});

  try{
    // create tables
    console.log('Creating schema...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS hotels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        address TEXT,
        tablesCount INT DEFAULT 0,
        onboardedAt DATETIME,
        ownerId INT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotelId INT NOT NULL,
        number INT NOT NULL,
        qrPath VARCHAR(512),
        status ENUM('idle','new','in_progress','served') DEFAULT 'idle',
        unreadOrders INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (hotelId) REFERENCES hotels(id) ON DELETE CASCADE
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotelId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(255),
        description TEXT,
        available BOOLEAN DEFAULT TRUE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (hotelId) REFERENCES hotels(id) ON DELETE CASCADE
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotelId INT NOT NULL,
        tableId INT,
        items JSON,
        total DECIMAL(10,2),
        status ENUM('new','preparing','served','cancelled') DEFAULT 'new',
        customerInfo JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        passwordHash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'admin',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Schema created. Inserting demo data...');

    // insert admin user
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('password', 10);
    await conn.query('INSERT IGNORE INTO users (name,email,passwordHash,role) VALUES (?, ?, ?, ?)', ['Admin','admin@example.com', passwordHash, 'admin']);
    const [userRows] = await conn.query('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
    const ownerRow = Array.isArray(userRows) ? userRows[0] : null;
    const ownerId = ownerRow ? ownerRow.id : null;
    if (!ownerId) {
      throw new Error('Unable to resolve admin user id');
    }

    // insert hotel
    const [res] = await conn.query('INSERT INTO hotels (name,slug,address,tablesCount,onboardedAt,ownerId) VALUES (?, ?, ?, ?, NOW(), ?)', ['Demo Coffee','demo-coffee','123 Demo St', 10, ownerId]);
    const hotelId = res.insertId;

    // ensure qrcodes folder
    const outDir = path.resolve(process.cwd(),'public','qrcodes');
    fs.mkdirSync(outDir, { recursive: true });

    // create tables and QR
    for(let i=1;i<=10;i++){
      const [r] = await conn.query('INSERT INTO tables (hotelId,number,qrPath) VALUES (?, ?, ?)', [hotelId, i, null]);
      const filename = `${hotelId}-table-${i}.png`;
      const url = `${hostBase}/menu/demo-coffee?table=${i}`;
      const outPath = path.join(outDir, filename);
      await qrcode.toFile(outPath, url, { margin:1, width:300 });
      const publicPath = `/public/qrcodes/${filename}`;
      await conn.query('UPDATE tables SET qrPath = ? WHERE id = ?', [publicPath, r.insertId]);
    }

    // menu items
    await conn.query('INSERT INTO menu_items (hotelId,name,price,category,description,available) VALUES ?',[ [
      [hotelId,'Espresso',2.50,'Coffee','Strong espresso',1],
      [hotelId,'Cappuccino',3.50,'Coffee','Frothed milk',1],
      [hotelId,'Blueberry Muffin',2.00,'Bakery','Fresh muffin',1]
    ]]);

    console.log('Demo seed complete.');
    await conn.end();
    process.exit(0);
  }catch(err){
    console.error('Seeder failed:', err.message || err);
    process.exit(2);
  }
})();
