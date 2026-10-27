// ==============================================================================
// HealthWatch AI: MySQL Database Connection Pool
// DBMS Concepts: Connection Pooling, Parameterized Prepared Statements
// Safety Rule: Only connects to 'healthwatch' database. Never touches others.
// ==============================================================================

const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'healthwatch',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection helper
pool.testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT DATABASE() AS current_db, VERSION() AS version');
    connection.release();
    return { ok: true, database: rows[0].current_db, version: rows[0].version };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

module.exports = pool;
