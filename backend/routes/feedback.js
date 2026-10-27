const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;
const { requireAdmin } = require('../middleware/auth');

const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// POST /api/feedback   (public, no login)
router.post('/', limiter, async (req, res) => {
  const { phcId, villageId, visitDate, doctorPresent,
          medicineAvailable = 'NOT_NEEDED', deviceId } = req.body || {};

  if (!phcId || !deviceId || !['YES', 'NO'].includes(doctorPresent)) {
    return res.status(400).json({ error: 'phcId, deviceId and doctorPresent (YES or NO) are required' });
  }
  if (!['YES', 'PARTIAL', 'NO', 'NOT_NEEDED'].includes(medicineAvailable)) {
    return res.status(400).json({ error: 'Invalid medicine answer' });
  }
  const visit = new Date(visitDate);
  const daysAgo = (Date.now() - visit.getTime()) / 86400000;
  if (isNaN(visit.getTime()) || daysAgo < -1 || daysAgo > 7) {
    return res.status(400).json({ error: 'Visit date must be within the last 7 days' });
  }

  const salt = process.env.DEVICE_SALT || process.env.SESSION_SECRET || 'rcc';
  const deviceHash = crypto.createHash('sha256').update(String(deviceId) + salt).digest('hex');

  try {
    await pool.query(
      `INSERT INTO Visit_Feedback
         (phc_id, village_id, visit_date, doctor_present, medicine_available, device_hash)
       VALUES (?,?,?,?,?,?)`,
      [phcId, villageId || null, visitDate, doctorPresent, medicineAvailable, deviceHash]);
    res.status(201).json({ ok: true, message: 'Thank you for helping your village.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already sent a report for this visit today.' });
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Unknown PHC' });
    }
    console.error(e);
    res.status(500).json({ error: 'Could not save feedback' });
  }
});

// GET /api/feedback/summary/:phcId   (public)
router.get('/summary/:phcId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, p.doctor_on_duty
       FROM PHC p LEFT JOIN vw_phc_feedback_summary s ON s.phc_id = p.phc_id
       WHERE p.phc_id = ?`, [req.params.phcId]);
    if (!rows.length) return res.status(404).json({ error: 'PHC not found' });

    const s = rows[0];
    if (!s.reports_14d || s.reports_14d < 5) {
      return res.json({ enough: false, reports: s.reports_14d || 0 });
    }
    res.json({
      enough: true,
      reports: s.reports_14d,
      doctorPresentPct: s.doctor_present_pct,
      medicineYesPct: s.medicine_yes_pct,
      lastReportAt: s.last_report_at,
      conflict: s.doctor_on_duty === 1 && s.doctor_present_pct < 40
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load summary' });
  }
});

// GET /api/feedback/admin/flags   (admin only)
router.get('/admin/flags', requireAdmin, async (req, res) => {
  try {
    const [low] = await pool.query(
      `SELECT p.phc_id, p.name, s.reports_14d, s.doctor_present_pct, s.medicine_yes_pct
       FROM vw_phc_feedback_summary s JOIN PHC p ON p.phc_id = s.phc_id
       WHERE s.reports_14d >= 5 AND s.doctor_present_pct < 50
       ORDER BY s.doctor_present_pct ASC`);
    const [alerts] = await pool.query(
      `SELECT fa.*, p.name AS phc_name FROM Feedback_Alert fa
       JOIN PHC p ON p.phc_id = fa.phc_id
       WHERE fa.status = 'active' ORDER BY fa.created_at DESC LIMIT 20`);
    res.json({ lowDoctorPresence: low, activeAlerts: alerts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load flags' });
  }
});

module.exports = router;
