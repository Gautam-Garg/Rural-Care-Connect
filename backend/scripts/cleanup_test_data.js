// ==============================================================================
// HealthWatch AI: Cleanup Test Data Script
// Safely removes extra rows generated during test runs while preserving
// all 10 original seeded hospitals and base dataset.
// ==============================================================================

const db = require('../db');

async function cleanupTestData() {
  console.log('Connecting to healthwatch database for cleanup...');

  try {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    const [r1] = await conn.query('DELETE FROM Patient_Cases WHERE hospital_id > 10 OR case_id > 200');
    console.log(`Deleted extra Patient_Cases: ${r1.affectedRows}`);

    const [r2] = await conn.query('DELETE FROM Medicine WHERE hospital_id > 10');
    console.log(`Deleted extra Medicine: ${r2.affectedRows}`);

    const [r3] = await conn.query('DELETE FROM Hospital WHERE hospital_id > 10');
    console.log(`Deleted extra Hospital: ${r3.affectedRows}`);

    const [r4] = await conn.query('DELETE FROM Disease WHERE disease_id > 8');
    console.log(`Deleted extra Disease: ${r4.affectedRows}`);

    const [r5] = await conn.query('DELETE FROM Alerts WHERE alert_id > 2');
    console.log(`Deleted extra Alerts: ${r5.affectedRows}`);

    const [r6] = await conn.query('DELETE FROM Vaccination WHERE state = "Goa"');
    console.log(`Deleted extra Vaccination: ${r6.affectedRows}`);

    const [r7] = await conn.query('DELETE FROM Complaints WHERE complaint_id > 6');
    console.log(`Deleted extra Complaints: ${r7.affectedRows}`);

    await conn.commit();
    conn.release();
    console.log('\n[SUCCESS] Cleanup transaction committed.\n');

    // Final Counts
    const [h] = await db.query('SELECT COUNT(*) AS total_hospitals FROM Hospital');
    const [c] = await db.query('SELECT COUNT(*) AS total_cases FROM Patient_Cases');
    const [a] = await db.query('SELECT COUNT(*) AS total_alerts, SUM(status = "active") AS active_alerts FROM Alerts');
    const [d] = await db.query('SELECT COUNT(*) AS total_diseases FROM Disease');
    const [m] = await db.query('SELECT COUNT(*) AS total_medicines FROM Medicine');

    console.log('Final Database Counts:');
    console.log(`  - Hospitals:     ${h[0].total_hospitals}`);
    console.log(`  - Patient Cases: ${c[0].total_cases}`);
    console.log(`  - Total Alerts:  ${a[0].total_alerts} (Active: ${a[0].active_alerts})`);
    console.log(`  - Diseases:      ${d[0].total_diseases}`);
    console.log(`  - Medicines:     ${m[0].total_medicines}`);

    process.exit(0);
  } catch (error) {
    console.error('Error during test data cleanup:', error);
    process.exit(1);
  }
}

cleanupTestData();
