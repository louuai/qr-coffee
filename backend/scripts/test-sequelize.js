const { Sequelize } = require('sequelize');
require('dotenv').config();
(async ()=>{
  const db = process.env.DB_NAME || 'rasops_qr';
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 3306;
  const sequelize = new Sequelize(db, user, pass, { host, port, dialect: 'mysql', logging: false });
  try{
    await sequelize.authenticate();
    console.log('Sequelize connected');
    process.exit(0);
  }catch(err){
    console.error('Sequelize failed:', err.message || err);
    process.exit(2);
  }
})();
