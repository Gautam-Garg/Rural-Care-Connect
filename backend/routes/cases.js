// ==============================================================================
// Rural Care Connect: Patient Cases & Admissions Routes
// DBMS Concepts: Calling Stored Procedures (sp_admit_patient, sp_close_case),
//                ACID Transactions, Triggers fired on INSERT, Multi-Table JOINs
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin, requireAdminOrAsha } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/cases
 * Search and filter patient admissions
 * Query parameters: disease, city, hospital_id, phc_id, village_id, status, from, to, page, limit
 */
router.get('/', requireLogin, async (req, res) => {
  try {
    const { disease, city, hospital_id, phc_id, village_id, status, from, to, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT 
        pc.case_id,
        pc.disease_id,
        d.name AS disease_name,
        d.category AS disease_category,
        pc.hospital_id,
        pc.hospital_id AS phc_id,
        p.name AS hospital_name,
        p.name AS phc_name,
        p.facility_type,
        p.city,
        p.state,
        pc.village_id,
        v.name AS village_name,
        pc.age_group,
        pc.gender,
        pc.icu_required,
        pc.status,
        pc.admitted_on,
        pc.closed_on
      FROM Patient_Cases pc
      JOIN Disease d ON d.disease_id = pc.disease_id
      JOIN PHC p ON p.phc_id = pc.hospital_id
      LEFT JOIN Village v ON v.village_id = pc.village_id
      WHERE 1=1
    `;

    const params = [];

    if (disease) {
      if (!isNaN(disease)) {
        sql += ' AND pc.disease_id = ?';
        params.push(parseInt(disease, 10));
      } else {
        sql += ' AND d.name LIKE ?';
        params.push(`%${disease}%`);
      }
    }

    if (city) {
      sql += ' AND p.city = ?';
      params.push(city);
    }

    const facilityId = phc_id || hospital_id;
    if (facilityId) {
      sql += ' AND pc.hospital_id = ?';
      params.push(parseInt(facilityId, 10));
    }

    if (village_id) {
      sql += ' AND pc.village_id = ?';
      params.push(parseInt(village_id, 10));
    }

    if (status) {
      sql += ' AND pc.status = ?';
      params.push(status);
    }

    if (from) {
      sql += ' AND pc.admitted_on >= ?';
      params.push(from);
    }

    if (to) {
      sql += ' AND pc.admitted_on <= ?';
      params.push(to);
    }

    sql += ' ORDER BY pc.admitted_on DESC, pc.case_id DESC';

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageLimit = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * pageLimit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(pageLimit, offset);

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      page: pageNum,
      limit: pageLimit,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching patient cases:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve patient cases.'
    });
  }
});

/**
 * GET /api/cases/:id
 * Retrieve single case details
 */
router.get('/:id', requireLogin, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      `SELECT 
        pc.case_id,
        pc.disease_id,
        d.name AS disease_name,
        d.category AS disease_category,
        pc.hospital_id,
        pc.hospital_id AS phc_id,
        p.name AS hospital_name,
        p.name AS phc_name,
        p.facility_type,
        p.city,
        p.state,
        pc.village_id,
        v.name AS village_name,
        pc.age_group,
        pc.gender,
        pc.icu_required,
        pc.status,
        pc.admitted_on,
        pc.closed_on
      FROM Patient_Cases pc
      JOIN Disease d ON d.disease_id = pc.disease_id
      JOIN PHC p ON p.phc_id = pc.hospital_id
      LEFT JOIN Village v ON v.village_id = pc.village_id
      WHERE pc.case_id = ?`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Case not found.'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching case by ID:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve case.'
    });
  }
});

/**
 * POST /api/cases
 * Admin or ASHA: Admit patient by calling stored procedure sp_admit_patient
 * Demonstrates: Transaction execution, bed count decrement, and trigger trg_case_alert
 */
router.post('/', requireAdminOrAsha, async (req, res) => {
  try {
    const { disease_id, hospital_id, phc_id, village_id, age_group, gender, icu_required = false } = req.body;
    const targetFacility = phc_id || hospital_id;

    if (!disease_id || !targetFacility || !age_group || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required admission fields (disease_id, phc_id / hospital_id, age_group, gender).'
      });
    }

    const validAgeGroups = ['0-14', '15-30', '31-45', '46-60', '60+'];
    if (!validAgeGroups.includes(age_group)) {
      return res.status(400).json({
        success: false,
        error: `Age group must be one of: ${validAgeGroups.join(', ')}`
      });
    }

    const validGenders = ['M', 'F', 'O'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        error: `Gender must be one of: ${validGenders.join(', ')}`
      });
    }

    // Call stored procedure sp_admit_patient
    const [result] = await db.query(
      'CALL sp_admit_patient(?, ?, ?, ?, ?)',
      [parseInt(disease_id, 10), parseInt(targetFacility, 10), age_group, gender, Boolean(icu_required)]
    );

    const newCaseId = result && result[0] && result[0][0] ? result[0][0].case_id : null;

    // If village_id provided, update it on the case
    if (newCaseId && village_id) {
      await db.query('UPDATE Patient_Cases SET village_id = ? WHERE case_id = ?', [parseInt(village_id, 10), newCaseId]);
    }

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'ADMIT',
        'Patient_Cases',
        newCaseId || 0,
        `Admitted patient: Disease #${disease_id}, PHC #${targetFacility}, Village: ${village_id || 'N/A'}`
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Patient admitted successfully. Bed inventory updated and outbreak triggers checked.',
      case_id: newCaseId
    });
  } catch (error) {
    console.error('Error admitting patient via sp_admit_patient:', error);
    if (error.sqlState === '45000' || (error.message && error.message.includes('No bed available'))) {
      return res.status(400).json({
        success: false,
        error: error.message || 'No bed available at this Primary Health Centre.'
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to admit patient.'
    });
  }
});

/**
 * PUT /api/cases/:id/close
 * Admin only: Close case (recovered/deceased) by calling stored procedure sp_close_case
 * Restores bed count to PHC inventory.
 */
router.put('/:id/close', requireAdmin, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!status || !['recovered', 'deceased'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "recovered" or "deceased".'
      });
    }

    // Call stored procedure sp_close_case
    await db.query('CALL sp_close_case(?, ?)', [caseId, status]);

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'CLOSE',
        'Patient_Cases',
        caseId,
        `Closed case #${caseId} with status "${status}" (PHC bed restored)`
      );
    }

    return res.json({
      success: true,
      message: `Case #${caseId} closed as "${status}". Bed released back to PHC.`
    });
  } catch (error) {
    console.error('Error closing case via sp_close_case:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to close patient case.'
    });
  }
});

module.exports = router;
