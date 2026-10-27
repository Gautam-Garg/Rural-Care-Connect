// backend/scripts/migrate_addons.js
// Run with:  npm run migrate:addons     (from the backend folder)

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Tables and columns the add-ons depend on (taken from DB_SCHEMA.md)
const REQUIRED = {
  PHC: ['phc_id', 'village_id', 'name', 'facility_type', 'doctor_on_duty',
        'operating_hours', 'contact_phone', 'latitude', 'longitude'],
  Village: ['village_id', 'name', 'latitude', 'longitude'],
  Service_Cost: ['service_id', 'phc_id', 'service_name', 'category',
                 'cost_inr', 'is_free', 'scheme_name'],
  Medicine: ['medicine_id', 'hospital_id', 'name', 'stock', 'reorder_level']
};

// Splits a .sql file into statements. Understands DELIMITER lines,
// so the same file also works in MySQL Workbench.
function splitStatements(sql) {
  const out = [];
  let delim = ';';
  let buf = [];
  for (const line of sql.split(/\r?\n/)) {
    const m = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (m) { delim = m[1]; continue; }
    if (/^\s*--/.test(line)) continue;            // skip full-line comments
    buf.push(line);
    const joined = buf.join('\n').trimEnd();
    if (joined.endsWith(delim)) {
      const stmt = joined.slice(0, -delim.length).trim();
      if (stmt) out.push(stmt);
      buf = [];
    }
  }
  const rest = buf.join('\n').trim();
  if (rest) out.push(rest);
  return out;
}

async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName) throw new Error('DB_NAME is missing in backend/.env');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName
  });
  console.log(`Connected to database "${dbName}" on ${process.env.DB_HOST || 'localhost'}`);

  // 1. MySQL version
  const [[ver]] = await conn.query('SELECT VERSION() AS v');
  if (parseInt(ver.v, 10) < 8) throw new Error(`MySQL 8 or newer needed, found ${ver.v}`);

  // Ensure PHC compatibility columns exist if base columns are present
  const [phcCols] = await conn.query(
    `SELECT LOWER(COLUMN_NAME) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = 'phc'`, [dbName]);
  const phcColSet = new Set(phcCols.map(r => r.c));
  if (phcColSet.has('doctor_available') && !phcColSet.has('doctor_on_duty')) {
    await conn.query('ALTER TABLE PHC ADD COLUMN doctor_on_duty TINYINT(1) GENERATED ALWAYS AS (doctor_available) VIRTUAL');
  }
  if (phcColSet.has('open_hours') && !phcColSet.has('operating_hours')) {
    await conn.query('ALTER TABLE PHC ADD COLUMN operating_hours VARCHAR(100) GENERATED ALWAYS AS (open_hours) VIRTUAL');
  }
  if (phcColSet.has('phone') && !phcColSet.has('contact_phone')) {
    await conn.query('ALTER TABLE PHC ADD COLUMN contact_phone VARCHAR(30) GENERATED ALWAYS AS (phone) VIRTUAL');
  }

  // 2. Check required tables and columns
  const problems = [];
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const [rows] = await conn.query(
      `SELECT LOWER(COLUMN_NAME) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)`, [dbName, table]);
    if (!rows.length) { problems.push(`Table missing: ${table}`); continue; }
    const have = new Set(rows.map(r => r.c));
    const missing = cols.filter(c => !have.has(c.toLowerCase()));
    if (missing.length) problems.push(`Table ${table} is missing columns: ${missing.join(', ')}`);
  }
  if (problems.length) {
    console.error('\nThe database does not match DB_SCHEMA.md:\n - ' + problems.join('\n - '));
    console.error('\nNothing was changed. Fix the names above (or tell me what your tables look like) and run again.');
    await conn.end();
    process.exit(1);
  }
  console.log('Schema check passed.');

  // 3. Add Medicine.updated_at only if missing
  const [col] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = 'medicine' AND COLUMN_NAME = 'updated_at'`, [dbName]);
  if (!col.length) {
    await conn.query(
      `ALTER TABLE Medicine ADD COLUMN updated_at TIMESTAMP NOT NULL
       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    console.log('Added Medicine.updated_at');
  }

  // 4. Run the SQL file
  const file = path.join(__dirname, '..', '..', 'database', 'addons_migration.sql');
  const statements = splitStatements(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const s of statements) {
    try { await conn.query(s); n++; }
    catch (e) {
      console.error(`\nFailed on statement #${n + 1}:\n${s.slice(0, 300)}...\n\n${e.message}`);
      await conn.end();
      process.exit(1);
    }
  }
  console.log(`Ran ${n} statements.`);

  // 5. Summary
  const [t] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?
     AND TABLE_NAME IN ('Travel_Mode','Cost_Assumption','Private_Benchmark','Medicine_Info',
       'Jan_Aushadhi_Kendra','Medicine_Demand_Log','Visit_Feedback','Feedback_Alert')`, [dbName]);
  const [r] = await conn.query(
    `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?
     AND ROUTINE_NAME IN ('fn_distance_km','sp_total_cost_of_care','sp_medicine_fallback')`, [dbName]);
  console.log(`\nNew tables found: ${t.length} of 8`);
  console.log(`New routines found: ${r.length} of 3`);
  console.log('Done.');
  await conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
