// ==============================================================================
// Rural Care Connect: ASHA Worker Operations Routes
// Role: 'asha' & 'admin'
// Tables: ASHA_Worker, ASHA_Request, Village, PHC, Patient_Cases, Vaccination_Drive
// Grassroots rural healthcare workflows: reporting village cases,
// monitoring maternal/infant drives, and sending emergency requests to PHCs.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdminOrAsha, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/asha/profile
 * Get profile and village assignment for current logged-in ASHA worker
 */
router.get('/profile', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    let [rows] = await db.query(
      `SELECT 
        aw.asha_id,
        aw.name,
        aw.phone,
        aw.assigned_area,
        v.village_id,
        v.name AS village_name,
        v.population AS village_population,
        b.name AS block_name,
        d.name AS district_name,
        s.name AS state_name,
        p.phc_id,
        p.name AS phc_name,
        p.facility_type,
        p.phone AS phc_phone,
        p.ambulance_available
      FROM ASHA_Worker aw
      JOIN Village v ON v.village_id = aw.village_id
      JOIN Block b ON b.block_id = v.block_id
      JOIN District d ON d.district_id = b.district_id
      JOIN State s ON s.state_id = d.state_id
      JOIN PHC p ON p.phc_id = aw.phc_id
      WHERE aw.user_id = ?`,
      [userId]
    );

    // If no direct link by user_id, fall back to first ASHA profile for demo convenience
    if (rows.length === 0) {
      const [fallback] = await db.query(
        `SELECT 
          aw.asha_id,
          aw.name,
          aw.phone,
          aw.assigned_area,
          v.village_id,
          v.name AS village_name,
          v.population AS village_population,
          b.name AS block_name,
          d.name AS district_name,
          s.name AS state_name,
          p.phc_id,
          p.name AS phc_name,
          p.facility_type,
          p.phone AS phc_phone,
          p.ambulance_available
        FROM ASHA_Worker aw
        JOIN Village v ON v.village_id = aw.village_id
        JOIN Block b ON b.block_id = v.block_id
        JOIN District d ON d.district_id = b.district_id
        JOIN State s ON s.state_id = d.state_id
        JOIN PHC p ON p.phc_id = aw.phc_id
        LIMIT 1`
      );
      rows = fallback;
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'ASHA profile not found.' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching ASHA profile:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve ASHA profile.' });
  }
});

/**
 * GET /api/asha/dashboard
 * Aggregated metrics for ASHA worker's village & PHC
 */
router.get('/dashboard', requireAdminOrAsha, async (req, res) => {
  try {
    // Determine village & PHC
    let villageId = 1;
    let phcId = 1;

    const [profile] = await db.query('SELECT village_id, phc_id FROM ASHA_Worker WHERE user_id = ?', [req.session.user.user_id]);
    if (profile.length > 0) {
      villageId = profile[0].village_id;
      phcId = profile[0].phc_id;
    }

    // 1. Village info
    const [villageRows] = await db.query(
      `SELECT v.*, b.name AS block_name, d.name AS district_name 
       FROM Village v 
       JOIN Block b ON b.block_id = v.block_id 
       JOIN District d ON d.district_id = b.district_id 
       WHERE v.village_id = ?`,
      [villageId]
    );

    // 2. Active cases in village
    const [cases] = await db.query(
      `SELECT pc.*, d.name AS disease_name, d.category 
       FROM Patient_Cases pc 
       JOIN Disease d ON d.disease_id = pc.disease_id 
       WHERE pc.village_id = ? 
       ORDER BY pc.admitted_on DESC LIMIT 10`,
      [villageId]
    );

    // 3. Upcoming vaccination drives in village
    const [drives] = await db.query(
      `SELECT * FROM vw_upcoming_drives WHERE village_id = ? ORDER BY drive_date ASC`,
      [villageId]
    );

    // 4. Low stock medicines at assigned PHC
    const [lowMeds] = await db.query(
      `SELECT * FROM vw_low_stock WHERE phc_id = ?`,
      [phcId]
    );

    // 5. Active area alerts
    const [alerts] = await db.query(
      `SELECT a.*, d.name AS disease_name 
       FROM Alerts a 
       JOIN Disease d ON d.disease_id = a.disease_id 
       WHERE a.status = "active" 
       ORDER BY a.created_at DESC LIMIT 5`
    );

    // 6. Recent ASHA requests
    const [requests] = await db.query(
      `SELECT ar.*, p.name AS phc_name, p.phone AS phc_phone 
       FROM ASHA_Request ar 
       JOIN PHC p ON p.phc_id = ar.phc_id 
       ORDER BY ar.created_at DESC LIMIT 10`
    );

    return res.json({
      success: true,
      village: villageRows[0] || null,
      stats: {
        village_population: villageRows[0] ? villageRows[0].population : 0,
        active_village_cases: cases.filter(c => c.status === 'admitted').length,
        upcoming_drives_count: drives.length,
        phc_low_stock_count: lowMeds.length,
        active_alerts_count: alerts.length
      },
      cases,
      drives,
      low_stock_medicines: lowMeds,
      alerts,
      requests
    });
  } catch (error) {
    console.error('Error fetching ASHA dashboard:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve ASHA dashboard metrics.' });
  }
});

/**
 * POST /api/asha/cases/report
 * Grassroots patient admission via stored procedure sp_admit_patient
 */
router.post('/cases/report', requireAdminOrAsha, async (req, res) => {
  try {
    const { disease_id, phc_id, age_group, gender, icu_required = false } = req.body;

    if (!disease_id || !phc_id || !age_group || !gender) {
      return res.status(400).json({
        success: false,
        error: 'disease_id, phc_id, age_group, and gender are required.'
      });
    }

    const [result] = await db.query(
      'CALL sp_admit_patient(?, ?, ?, ?, ?)',
      [parseInt(disease_id, 10), parseInt(phc_id, 10), age_group, gender, Boolean(icu_required)]
    );

    const newCaseId = result[0] && result[0][0] ? result[0][0].new_case_id : null;

    return res.status(201).json({
      success: true,
      message: 'Patient admitted via stored procedure sp_admit_patient.',
      case_id: newCaseId
    });
  } catch (error) {
    console.error('Error reporting case from ASHA:', error);
    return res.status(400).json({
      success: false,
      error: error.sqlMessage || error.message || 'Failed to report admission.'
    });
  }
});

/**
 * POST /api/asha/requests
 * ASHA worker sends emergency / medicine request to PHC
 */
router.post('/requests', requireAdminOrAsha, async (req, res) => {
  try {
    const { asha_id = 1, phc_id, request_type, urgency = 'normal', details } = req.body;

    if (!phc_id || !request_type || !details) {
      return res.status(400).json({
        success: false,
        error: 'phc_id, request_type, and details are required.'
      });
    }

    // Normalize request_type to match enum('emergency_transport','medicine_stock','doctor_visit','vaccine_supply','general')
    let normType = request_type.toLowerCase();
    if (normType.includes('ambulance') || normType.includes('emergency')) normType = 'emergency_transport';
    else if (normType.includes('medicine')) normType = 'medicine_stock';
    else if (normType.includes('doctor')) normType = 'doctor_visit';
    else if (normType.includes('vaccine')) normType = 'vaccine_supply';
    else if (!['emergency_transport', 'medicine_stock', 'doctor_visit', 'vaccine_supply', 'general'].includes(normType)) {
      normType = 'general';
    }

    // Normalize urgency to match enum('normal','urgent','critical')
    let normUrgency = urgency.toLowerCase();
    if (normUrgency === 'emergency') normUrgency = 'critical';
    else if (normUrgency === 'high') normUrgency = 'urgent';
    else if (!['normal', 'urgent', 'critical'].includes(normUrgency)) normUrgency = 'normal';

    const [result] = await db.query(
      `INSERT INTO ASHA_Request (asha_id, phc_id, request_type, urgency, details, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [parseInt(asha_id, 10), parseInt(phc_id, 10), normType, normUrgency, details.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Request submitted to Primary Health Centre.',
      request_id: result.insertId
    });
  } catch (error) {
    console.error('Error submitting ASHA request:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit request to PHC.' });
  }
});

/**
 * GET /api/asha/requests
 * List all ASHA requests
 */
router.get('/requests', requireAdminOrAsha, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        ar.*, 
        aw.name AS asha_name, 
        aw.phone AS asha_phone,
        v.name AS village_name,
        p.name AS phc_name, 
        p.phone AS phc_phone 
       FROM ASHA_Request ar
       JOIN ASHA_Worker aw ON aw.asha_id = ar.asha_id
       JOIN Village v ON v.village_id = aw.village_id
       JOIN PHC p ON p.phc_id = ar.phc_id
       ORDER BY (ar.status = 'pending') DESC, ar.created_at DESC`
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve requests.' });
  }
});

/**
 * PUT /api/asha/requests/:id
 * Update status of ASHA request (Admin or PHC staff)
 */
router.put('/requests/:id', requireAdminOrAsha, async (req, res) => {
  try {
    const reqId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (pending, in_progress, resolved) required.' });
    }

    await db.query('UPDATE ASHA_Request SET status = ? WHERE request_id = ?', [status, reqId]);
    return res.json({ success: true, message: `Request #${reqId} marked as ${status}.` });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update request status.' });
  }
});

module.exports = router;
