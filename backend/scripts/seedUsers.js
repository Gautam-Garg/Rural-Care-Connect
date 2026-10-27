// ==============================================================================
// HealthWatch AI: Demo User Seeding Script
// Seeds or updates demo admin and viewer accounts using bcrypt.
// Safety Rule: Uses INSERT ... ON DUPLICATE KEY UPDATE.
//              Never drops, deletes, or truncates any table or database.
// ==============================================================================

const bcrypt = require('bcryptjs');
const db = require('../db');

async function seedUsers() {
  try {
    console.log('Connecting to healthwatch database...');
    
    const adminPass = 'admin123';
    const viewerPass = 'viewer123';

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(adminPass, salt);
    const viewerHash = await bcrypt.hash(viewerPass, salt);

    const users = [
      { username: 'admin', hash: adminHash, role: 'admin' },
      { username: 'viewer', hash: viewerHash, role: 'public' }
    ];

    for (const u of users) {
      await db.query(
        `INSERT INTO Users (username, password_hash, role)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)`,
        [u.username, u.hash, u.role]
      );
      console.log(`User '${u.username}' ensured with role '${u.role}'.`);
    }

    console.log('Seed users completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
