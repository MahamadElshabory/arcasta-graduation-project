require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  console.log('Trying:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    db: process.env.DB_NAME,
    port: process.env.DB_PORT
  });
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    console.log('Connected OK');
    await conn.end();
  } catch (e) {
    console.error('Connect failed:', e.code, e.sqlMessage || e.message);
  }
})();
