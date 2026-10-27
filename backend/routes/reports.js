// ==============================================================================
// HealthWatch AI: Data Reports & CSV Export Routes
// Generates live CSV downloads for bed inventory, clinical cases, and alerts.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

/**
 * GET /api/reports/beds.csv
 * Download hospital bed inventory as CSV
 */
router.get('/beds.csv', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_bed_availability ORDER BY city, name');

    let csv = 'Hospital ID,Hospital Name,City,State,Available Beds,Total Beds,Free Bed %,Available ICU,Total ICU,Ventilators\n';
    rows.forEach(r => {
      csv += `"${r.hospital_id}","${r.name.replace(/"/g, '""')}","${r.city}","${r.state}",${r.available_beds},${r.total_beds},${r.pct_free},${r.available_icu},${r.total_icu},${r.ventilators}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="healthwatch_beds.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Error generating beds CSV:', error);
    return res.status(500).send('Error generating report');
  }
});

/**
 * GET /api/reports/cases.csv
 * Download clinical cases report as CSV
 */
router.get('/cases.csv', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        pc.case_id, d.name AS disease, h.name AS hospital, h.city, h.state,
        pc.age_group, pc.gender, pc.icu_required, pc.status, pc.admitted_on, pc.closed_on
      FROM Patient_Cases pc
      JOIN Disease d ON d.disease_id = pc.disease_id
      JOIN Hospital h ON h.hospital_id = pc.hospital_id
      ORDER BY pc.admitted_on DESC
      LIMIT 1000
    `);

    let csv = 'Case ID,Disease,Hospital,City,State,Age Group,Gender,ICU Required,Status,Admitted On,Closed On\n';
    rows.forEach(r => {
      const closed = r.closed_on ? new Date(r.closed_on).toISOString().split('T')[0] : '';
      const admitted = new Date(r.admitted_on).toISOString().split('T')[0];
      csv += `"${r.case_id}","${r.disease}","${r.hospital.replace(/"/g, '""')}","${r.city}","${r.state}","${r.age_group}","${r.gender}",${r.icu_required ? 'YES' : 'NO'},"${r.status}","${admitted}","${closed}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="healthwatch_cases.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Error generating cases CSV:', error);
    return res.status(500).send('Error generating report');
  }
});

/**
 * GET /api/reports/alerts.csv
 * Download outbreak alerts history as CSV
 */
router.get('/alerts.csv', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.alert_id, d.name AS disease, a.city, a.level, a.message, a.status, a.created_at, a.resolved_at
      FROM Alerts a
      JOIN Disease d ON d.disease_id = a.disease_id
      ORDER BY a.created_at DESC
    `);

    let csv = 'Alert ID,Disease,City,Severity Level,Message,Status,Created At,Resolved At\n';
    rows.forEach(r => {
      csv += `"${r.alert_id}","${r.disease}","${r.city}","${r.level}","${r.message.replace(/"/g, '""')}","${r.status}","${r.created_at}","${r.resolved_at || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="healthwatch_alerts.csv"');
    return res.send(csv);
  } catch (error) {
    console.error('Error generating alerts CSV:', error);
    return res.status(500).send('Error generating report');
  }
});

module.exports = router;
