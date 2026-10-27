// ==============================================================================
// HealthWatch AI: Disease Management Routes
// DBMS Concepts: Parameterized Queries, Master Table CRUD, Audit Trail
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/diseases
 * List all tracked diseases
 */
router.get('/', requireLogin, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM Disease';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching diseases:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve diseases.'
    });
  }
});

/**
 * GET /api/diseases/:id
 * Retrieve a single disease
 */
router.get('/:id', requireLogin, async (req, res) => {
  try {
    const diseaseId = parseInt(req.params.id, 10);
    const [rows] = await db.query('SELECT * FROM Disease WHERE disease_id = ?', [diseaseId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Disease not found.'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching disease by ID:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve disease.'
    });
  }
});

/**
 * POST /api/diseases
 * Admin only: Add new disease and set outbreak alert threshold
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, category, alert_threshold } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Name and category are required.'
      });
    }

    const validCategories = ['vector-borne', 'water-borne', 'air-borne', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    const threshold = alert_threshold !== undefined ? parseInt(alert_threshold, 10) : 20;

    const [result] = await db.query(
      'INSERT INTO Disease (name, category, alert_threshold) VALUES (?, ?, ?)',
      [name.trim(), category, threshold]
    );

    const newId = result.insertId;
    await logAudit(
      req.session.user.user_id,
      'INSERT',
      'Disease',
      newId,
      `Created disease "${name}" (Category: ${category}, Threshold: ${threshold})`
    );

    return res.status(201).json({
      success: true,
      message: 'Disease created successfully.',
      disease_id: newId
    });
  } catch (error) {
    console.error('Error creating disease:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'A disease with this name already exists.'
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create disease.'
    });
  }
});

/**
 * PUT /api/diseases/:id
 * Admin only: Update disease details and alert thresholds
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const diseaseId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT * FROM Disease WHERE disease_id = ?', [diseaseId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Disease not found.'
      });
    }

    const curr = existing[0];
    const name = req.body.name !== undefined ? req.body.name.trim() : curr.name;
    const category = req.body.category !== undefined ? req.body.category : curr.category;
    const alert_threshold = req.body.alert_threshold !== undefined ? parseInt(req.body.alert_threshold, 10) : curr.alert_threshold;

    await db.query(
      'UPDATE Disease SET name = ?, category = ?, alert_threshold = ? WHERE disease_id = ?',
      [name, category, alert_threshold, diseaseId]
    );

    await logAudit(
      req.session.user.user_id,
      'UPDATE',
      'Disease',
      diseaseId,
      `Updated disease "${name}" (Category: ${category}, Threshold: ${alert_threshold})`
    );

    return res.json({
      success: true,
      message: 'Disease updated successfully.'
    });
  } catch (error) {
    console.error('Error updating disease:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update disease.'
    });
  }
});

/**
 * DELETE /api/diseases/:id
 * Admin only: Delete disease
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const diseaseId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT name FROM Disease WHERE disease_id = ?', [diseaseId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Disease not found.'
      });
    }

    const diseaseName = existing[0].name;
    await db.query('DELETE FROM Disease WHERE disease_id = ?', [diseaseId]);

    await logAudit(
      req.session.user.user_id,
      'DELETE',
      'Disease',
      diseaseId,
      `Deleted disease "${diseaseName}"`
    );

    return res.json({
      success: true,
      message: `Disease "${diseaseName}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting disease:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete disease.'
    });
  }
});

module.exports = router;
