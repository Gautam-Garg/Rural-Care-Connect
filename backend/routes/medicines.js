// ==============================================================================
// Rural Care Connect: Medicine & Pharmacy Inventory Routes
// Uses vw_low_stock for stockout prevention; protects CRUD with requireAdmin.
// DBMS Concepts: Supply-Chain Relational Views, Trigger Auditing, Inventory Control
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/medicines/low-stock
 * Query relational view vw_low_stock to identify medicines below reorder level
 */
router.get('/low-stock', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_low_stock ORDER BY deficit DESC');
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error querying vw_low_stock:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve low-stock medicines view.'
    });
  }
});

/**
 * GET /api/medicines
 * List medicines with optional PHC and name filtering
 */
router.get('/', requireLogin, async (req, res) => {
  try {
    const { hospital_id, phc_id, q, low_stock } = req.query;

    if (low_stock === 'true') {
      const [rows] = await db.query('SELECT * FROM vw_low_stock ORDER BY deficit DESC');
      return res.json({ success: true, count: rows.length, data: rows });
    }

    let sql = `
      SELECT 
        m.medicine_id,
        COALESCE(m.phc_id, m.hospital_id) AS phc_id,
        COALESCE(m.phc_id, m.hospital_id) AS hospital_id,
        p.name AS hospital_name,
        p.name AS phc_name,
        p.city,
        p.state,
        m.name,
        m.stock,
        m.reorder_level,
        (m.stock <= m.reorder_level) AS is_low_stock
      FROM Medicine m
      JOIN PHC p ON p.phc_id = COALESCE(m.phc_id, m.hospital_id)
      WHERE 1=1
    `;
    const params = [];

    const targetId = phc_id || hospital_id;
    if (targetId) {
      sql += ' AND COALESCE(m.phc_id, m.hospital_id) = ?';
      params.push(parseInt(targetId, 10));
    }

    if (q) {
      sql += ' AND (m.name LIKE ? OR p.name LIKE ? OR p.city LIKE ?)';
      const queryPattern = `%${q}%`;
      params.push(queryPattern, queryPattern, queryPattern);
    }

    sql += ' ORDER BY is_low_stock DESC, m.name ASC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve medicine inventory.'
    });
  }
});

/**
 * POST /api/medicines
 * Admin only: Add new medicine record to PHC
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { hospital_id, phc_id, name, stock = 0, reorder_level = 50 } = req.body;
    const targetFacility = phc_id || hospital_id;

    if (!targetFacility || !name) {
      return res.status(400).json({
        success: false,
        error: 'PHC facility ID and medicine name are required.'
      });
    }

    const stockVal = parseInt(stock, 10);
    const reorderVal = parseInt(reorder_level, 10);

    if (stockVal < 0 || reorderVal < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock and reorder level cannot be negative.'
      });
    }

    const [result] = await db.query(
      'INSERT INTO Medicine (hospital_id, phc_id, name, stock, reorder_level) VALUES (?, ?, ?, ?, ?)',
      [targetFacility, targetFacility, name.trim(), stockVal, reorderVal]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'INSERT',
        'Medicine',
        result.insertId,
        `Added medicine "${name}" to PHC #${targetFacility} (Stock: ${stockVal})`
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Medicine added successfully.',
      medicine_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating medicine:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create medicine record.'
    });
  }
});

/**
 * PUT /api/medicines/:id
 * Admin only: Update medicine stock
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id, 10);
    const { name, stock, reorder_level } = req.body;

    const [existing] = await db.query('SELECT * FROM Medicine WHERE medicine_id = ?', [medicineId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Medicine not found.'
      });
    }

    const current = existing[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newStock = stock !== undefined ? parseInt(stock, 10) : current.stock;
    const newReorder = reorder_level !== undefined ? parseInt(reorder_level, 10) : current.reorder_level;

    if (newStock < 0 || newReorder < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock and reorder level cannot be negative.'
      });
    }

    await db.query(
      'UPDATE Medicine SET name = ?, stock = ?, reorder_level = ? WHERE medicine_id = ?',
      [newName, newStock, newReorder, medicineId]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'UPDATE',
        'Medicine',
        medicineId,
        `Updated "${newName}" stock (${current.stock} -> ${newStock})`
      );
    }

    return res.json({
      success: true,
      message: 'Medicine inventory updated successfully.'
    });
  } catch (error) {
    console.error('Error updating medicine:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update medicine inventory.'
    });
  }
});

/**
 * DELETE /api/medicines/:id
 * Admin only: Remove medicine record
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM Medicine WHERE medicine_id = ?', [medicineId]);

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'DELETE',
        'Medicine',
        medicineId,
        `Deleted medicine #${medicineId}`
      );
    }

    return res.json({
      success: true,
      message: 'Medicine deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting medicine:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete medicine.'
    });
  }
});

module.exports = router;
