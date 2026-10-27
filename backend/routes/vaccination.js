// ==============================================================================
// HealthWatch AI: Vaccination Tracking Routes
// DBMS Concepts: Computed Columns (Coverage %), Foreign Key Relationships
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/vaccination
 * List vaccination coverage across states and target diseases
 */
router.get('/', requireLogin, async (req, res) => {
  try {
    const { state, disease_id } = req.query;

    let sql = `
      SELECT 
        v.vaccination_id,
        v.disease_id,
        d.name AS disease_name,
        v.state,
        v.doses_given,
        v.target_population,
        ROUND(100.0 * v.doses_given / NULLIF(v.target_population, 0), 2) AS coverage_pct,
        v.record_date
      FROM Vaccination v
      JOIN Disease d ON d.disease_id = v.disease_id
      WHERE 1=1
    `;
    const params = [];

    if (state) {
      sql += ' AND v.state = ?';
      params.push(state);
    }

    if (disease_id) {
      sql += ' AND v.disease_id = ?';
      params.push(parseInt(disease_id, 10));
    }

    sql += ' ORDER BY v.record_date DESC, coverage_pct DESC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching vaccination records:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vaccination records.'
    });
  }
});

/**
 * POST /api/vaccination
 * Admin only: Record new vaccination progress
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { disease_id, state, doses_given, target_population, record_date } = req.body;

    if (!disease_id || !state || doses_given === undefined || target_population === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required vaccination fields (disease_id, state, doses_given, target_population).'
      });
    }

    const recDate = record_date || new Date().toISOString().split('T')[0];

    const [result] = await db.query(
      `INSERT INTO Vaccination (disease_id, state, doses_given, target_population, record_date)
       VALUES (?, ?, ?, ?, ?)`,
      [parseInt(disease_id, 10), state.trim(), parseInt(doses_given, 10), parseInt(target_population, 10), recDate]
    );

    const newVacId = result.insertId;
    await logAudit(
      req.session.user.user_id,
      'INSERT',
      'Vaccination',
      newVacId,
      `Recorded vaccination in ${state}: ${doses_given} doses (Target: ${target_population})`
    );

    return res.status(201).json({
      success: true,
      message: 'Vaccination record added successfully.',
      vaccination_id: newVacId
    });
  } catch (error) {
    console.error('Error adding vaccination record:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add vaccination record.'
    });
  }
});

/**
 * PUT /api/vaccination/:id
 * Admin only: Update vaccination progress record
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const vacId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT * FROM Vaccination WHERE vaccination_id = ?', [vacId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vaccination record not found.'
      });
    }

    const curr = existing[0];
    const disease_id = req.body.disease_id !== undefined ? parseInt(req.body.disease_id, 10) : curr.disease_id;
    const state = req.body.state !== undefined ? req.body.state.trim() : curr.state;
    const doses_given = req.body.doses_given !== undefined ? parseInt(req.body.doses_given, 10) : curr.doses_given;
    const target_population = req.body.target_population !== undefined ? parseInt(req.body.target_population, 10) : curr.target_population;
    const record_date = req.body.record_date !== undefined ? req.body.record_date : curr.record_date;

    await db.query(
      'UPDATE Vaccination SET disease_id = ?, state = ?, doses_given = ?, target_population = ?, record_date = ? WHERE vaccination_id = ?',
      [disease_id, state, doses_given, target_population, record_date, vacId]
    );

    await logAudit(
      req.session.user.user_id,
      'UPDATE',
      'Vaccination',
      vacId,
      `Updated vaccination in ${state}: ${doses_given} doses (Target: ${target_population})`
    );

    return res.json({
      success: true,
      message: 'Vaccination record updated successfully.'
    });
  } catch (error) {
    console.error('Error updating vaccination record:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update vaccination record.'
    });
  }
});

/**
 * DELETE /api/vaccination/:id
 * Admin only: Delete vaccination record
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const vacId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT * FROM Vaccination WHERE vaccination_id = ?', [vacId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vaccination record not found.'
      });
    }

    await db.query('DELETE FROM Vaccination WHERE vaccination_id = ?', [vacId]);

    await logAudit(
      req.session.user.user_id,
      'DELETE',
      'Vaccination',
      vacId,
      `Deleted vaccination record #${vacId} (${existing[0].state})`
    );

    return res.json({
      success: true,
      message: 'Vaccination record deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting vaccination record:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete vaccination record.'
    });
  }
});

module.exports = router;
