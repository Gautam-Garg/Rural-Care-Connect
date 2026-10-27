const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  console.log('--- Running Rural Care Connect Database Migration ---');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'healthwatch',
    multipleStatements: true
  });

  try {
    console.log('1. Reading database/migration_rural_care_connect.sql...');
    const migrationSqlPath = path.join(__dirname, '..', '..', 'database', 'migration_rural_care_connect.sql');
    let migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

    // Remove DELIMITER commands for mysql2 driver compatibility
    migrationSql = migrationSql
      .replace(/DELIMITER \$\$/g, '')
      .replace(/DELIMITER ;/g, '')
      .replace(/\$\$/g, ';');

    console.log('Executing migration script...');
    await connection.query(migrationSql);
    console.log('[SUCCESS] Migration applied successfully!');

    console.log('2. Reading database/seed_rural_data.sql...');
    const seedSqlPath = path.join(__dirname, '..', '..', 'database', 'seed_rural_data.sql');
    let seedSql = fs.readFileSync(seedSqlPath, 'utf8');

    console.log('Executing seed data script...');
    await connection.query(seedSql);
    console.log('[SUCCESS] Rural seed data applied successfully!');

    // Verification queries
    console.log('\n--- Verification ---');
    const [phcCount] = await connection.query('SELECT COUNT(*) as count FROM PHC');
    console.log(`PHC count: ${phcCount[0].count}`);

    const [villageCount] = await connection.query('SELECT COUNT(*) as count FROM Village');
    console.log(`Village count: ${villageCount[0].count}`);

    const [serviceCount] = await connection.query('SELECT COUNT(*) as count FROM Service_Cost');
    console.log(`Service Cost count: ${serviceCount[0].count}`);

    const [driveCount] = await connection.query('SELECT COUNT(*) as count FROM Vaccination_Drive');
    console.log(`Vaccination Drive count: ${driveCount[0].count}`);

    const [alertCount] = await connection.query('SELECT COUNT(*) as count FROM Alerts');
    console.log(`Alert count: ${alertCount[0].count}`);

    const [userCount] = await connection.query('SELECT username, role FROM Users');
    console.log('Users:', userCount);

    const [statsCount] = await connection.query('SELECT COUNT(*) as count FROM Disease_Stats');
    console.log(`Preserved Disease_Stats count: ${statsCount[0].count}`);

  } catch (err) {
    console.error('[ERROR] Failed executing migration/seed:', err.code, err.sqlMessage || err.message);
    if (err.sql) console.error('SQL chunk snippet:', err.sql.slice(0, 300));
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
