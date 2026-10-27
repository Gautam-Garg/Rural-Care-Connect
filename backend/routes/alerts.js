// ==============================================================================
// Rural Care Connect: Area-Based Outbreak Alerts Management Routes
// Supports area targeting: state, district, block, or village level.
// Handles both automated trigger-generated alerts and manual administrative alerts.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/alerts
 * List outbreak alerts with area filtering (state, district, block, village, status)
 */
router.get('/', async (req, res) => {
  try {
    const { status, disease_id, city, area_level, area_id, area_name } = req.query;

    let sql = `
      SELECT 
        a.alert_id,
        a.disease_id,
        d.name AS disease_name,
        d.category AS disease_category,
        a.city,
        a.area_level,
        a.area_id,
        a.area_name,
        a.level,
        a.message,
        a.status,
        a.created_at,
        a.resolved_at
      FROM Alerts a
      JOIN Disease d ON d.disease_id = a.disease_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    if (disease_id) {
      sql += ' AND a.disease_id = ?';
      params.push(parseInt(disease_id, 10));
    }

    if (area_level) {
      sql += ' AND a.area_level = ?';
      params.push(area_level);
    }

    if (area_id) {
      sql += ' AND a.area_id = ?';
      params.push(parseInt(area_id, 10));
    }

    if (city || area_name) {
      const term = city || area_name;
      sql += ' AND (a.city LIKE ? OR a.area_name LIKE ?)';
      params.push(`%${term}%`, `%${term}%`);
    }

    sql += ' ORDER BY (a.status = "active") DESC, a.created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts.'
    });
  }
});

/**
 * POST /api/alerts
 * Admin only: Manually create an area-targeted outbreak alert
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      disease_id,
      city,
      area_level = 'district',
      area_id = null,
      area_name = null,
      level,
      message
    } = req.body;

    if (!disease_id || !level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required alert fields (disease_id, level, message).'
      });
    }

    const validLevels = ['warning', 'high', 'critical'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        error: `Alert level must be one of: ${validLevels.join(', ')}`
      });
    }

    const validAreaLevels = ['national', 'state', 'district', 'block', 'village'];
    if (!validAreaLevels.includes(area_level)) {
      return res.status(400).json({
        success: false,
        error: `Area level must be one of: ${validAreaLevels.join(', ')}`
      });
    }

    const cityName = city || area_name || 'General';

    const [result] = await db.query(
      `INSERT INTO Alerts (disease_id, city, area_level, area_id, area_name, level, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        parseInt(disease_id, 10),
        cityName.trim(),
        area_level,
        area_id ? parseInt(area_id, 10) : null,
        area_name ? area_name.trim() : cityName.trim(),
        level,
        message.trim()
      ]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'INSERT',
        'Alerts',
        result.insertId,
        `Raised [${level.toUpperCase()}] alert for ${area_level} "${cityName}": ${message}`
      );
    }

    const [createdRows] = await db.query(
      `SELECT a.*, d.name AS disease_name 
       FROM Alerts a 
       JOIN Disease d ON d.disease_id = a.disease_id 
       WHERE a.alert_id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Outbreak alert created successfully.',
      data: createdRows[0]
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create outbreak alert.'
    });
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * Admin only: Mark alert as resolved
 */
router.put('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);

    const [existing] = await db.query('SELECT * FROM Alerts WHERE alert_id = ?', [alertId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found.'
      });
    }

    await db.query(
      'UPDATE Alerts SET status = "resolved", resolved_at = NOW() WHERE alert_id = ?',
      [alertId]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'UPDATE',
        'Alerts',
        alertId,
        `Resolved alert #${alertId} for ${existing[0].city}`
      );
    }

    return res.json({
      success: true,
      message: 'Alert resolved successfully.'
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve alert.'
    });
  }
});

module.exports = router;
