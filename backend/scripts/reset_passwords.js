// ==============================================================================
// HealthWatch AI: Reset Passwords Script
// Generates fresh bcrypt hashes using the backend's bcryptjs library and
// updates the passwords for 'admin' (admin123) and 'viewer' (viewer123).
// Safety Rule: Uses UPDATE / INSERT ... ON DUPLICATE KEY UPDATE.
//              Never drops, deletes, or truncates any table or database.
// ==============================================================================
const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env from backend directory with absolute path
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Optional: allow passing password via CLI argument without printing it
if (process.argv[2] !== undefined && process.argv[2] !== '') {
  process.env.DB_PASSWORD = process.argv[2];
}

const bcrypt = require('bcryptjs');
const db = require('../db');

async function resetPasswords() {
  console.log('====================================================');
  console.log(' Resetting Passwords for HealthWatch AI Users       ');
  console.log('====================================================\n');

  const pwLen = (process.env.DB_PASSWORD || '').length;
  console.log(`Loaded environment from: ${envPath}`);
  console.log(`DB_USER: ${process.env.DB_USER || 'root'}, DB_NAME: ${process.env.DB_NAME || 'healthwatch'}`);
  console.log(`DB_PASSWORD status: ${pwLen > 0 ? `Set (${pwLen} characters)` : 'NOT SET / EMPTY in .env'}\n`);

  try {
    const adminPass = 'admin123';
    const viewerPass = 'viewer123';

    // Generate fresh salts and hashes with bcryptjs (10 rounds)
    const saltAdmin = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync(adminPass, saltAdmin);

    const saltViewer = bcrypt.genSaltSync(10);
    const viewerHash = bcrypt.hashSync(viewerPass, saltViewer);

    // Self-verification check
    const adminValid = bcrypt.compareSync(adminPass, adminHash);
    const viewerValid = bcrypt.compareSync(viewerPass, viewerHash);

    if (!adminValid || !viewerValid) {
      throw new Error('Self-test failed: generated hash did not match plaintext password.');
    }

    console.log('Generated bcryptjs hashes successfully:');
    console.log(`- admin:  ${adminHash}`);
    console.log(`- viewer: ${viewerHash}\n`);

    // Verify DB connectivity
    const test = await db.testConnection();
    if (!test.ok) {
      console.error('Failed to connect to MySQL database.');
      console.error(`Error details: ${test.error}`);
      console.error('\nPlease check that MySQL is running and backend/.env contains the correct DB_PASSWORD.');
      process.exit(1);
    }

    console.log(`Connected to database '${test.database}' (MySQL ${test.version}).\n`);

    // Update or insert 'admin' user safely
    await db.query(
      `INSERT INTO Users (username, password_hash, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
      ['admin', adminHash, 'admin']
    );
    console.log("[OK] User 'admin' updated with password 'admin123' (role: admin).");

    // Update or insert 'viewer' user safely
    await db.query(
      `INSERT INTO Users (username, password_hash, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
      ['viewer', viewerHash, 'public']
    );
    console.log("[OK] User 'viewer' updated with password 'viewer123' (role: public).\n");

    // Verification check directly against database
    const [rows] = await db.query(
      'SELECT username, password_hash, role FROM Users WHERE username IN (?, ?)',
      ['admin', 'viewer']
    );

    console.log('Database verification:');
    for (const row of rows) {
      const plain = row.username === 'admin' ? adminPass : viewerPass;
      const isMatch = bcrypt.compareSync(plain, row.password_hash);
      console.log(`  - ${row.username} (role: ${row.role}): Password verification = ${isMatch ? 'PASS' : 'FAIL'}`);
    }

    console.log('\n====================================================');
    console.log(' Password reset complete!');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('Error during password reset:', error);
    process.exit(1);
  }
}

resetPasswords();
