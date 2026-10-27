// ==============================================================================
// HealthWatch AI: Audit Trail Routes
// Admin only: Review system and administrative modification history.
// DBMS Concepts: Security Logging, Database Triggers, Foreign Key Joins
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

/**
 * GET /api/audit
 * Admin only: Retrieve audit logs with user information
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { action, table_name, limit = 100 } = req.query;

    let sql = `
      SELECT 
        a.log_id,
        a.user_id,
        u.username,
        u.role AS user_role,
        a.action,
        a.table_name,
        a.record_id,
        a.details,
        a.logged_at
      FROM Audit_Log a
      LEFT JOIN Users u ON u.user_id = a.user_id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    if (table_name) {
      sql += ' AND a.table_name = ?';
      params.push(table_name);
    }

    sql += ' ORDER BY a.logged_at DESC, a.log_id DESC';

    const maxLimit = Math.min(500, Math.max(1, parseInt(limit, 10)));
    sql += ' LIMIT ?';
    params.push(maxLimit);

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit log.'
    });
  }
});

module.exports = router;
