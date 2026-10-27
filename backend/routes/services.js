// ==============================================================================
// Rural Care Connect: Affordable Care by Budget Routes
// Table: Service_Cost | View: v_affordable_services
// Allows villagers to enter available funds (₹) and medical need to find
// affordable/free care under schemes like Ayushman Bharat, JSY, PM Jan Aushadhi.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/services/affordable
 * Core budget query: searches v_affordable_services with WHERE cost_inr <= budget
 * Query params: budget, category, phc_id, lat, lng
 */
router.get(['/affordable', '/budget'], async (req, res) => {
  try {
    const { budget, maxCost, category, phc_id, lat, lng } = req.query;
    let sql = 'SELECT * FROM v_affordable_services WHERE 1=1';
    const params = [];

    const effectiveBudget = budget !== undefined && budget !== '' ? budget : maxCost;
    if (effectiveBudget !== undefined && effectiveBudget !== '') {
      const budgetVal = parseFloat(effectiveBudget);
      if (!isNaN(budgetVal)) {
        sql += ' AND cost_inr <= ?';
        params.push(budgetVal);
      }
    }

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (phc_id) {
      sql += ' AND phc_id = ?';
      params.push(parseInt(phc_id, 10));
    }

    // Sort order: Free services first (is_free DESC), then cheapest cost (cost_inr ASC)
    sql += ' ORDER BY is_free DESC, cost_inr ASC, phc_name ASC';

    const [rows] = await db.query(sql, params);

    // If user provided GPS coordinates, calculate client distances
    let dataWithDist = rows;
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      dataWithDist = rows.map(item => {
        let dist = null;
        if (item.latitude && item.longitude) {
          const R = 6371;
          const dLat = (item.latitude - userLat) * Math.PI / 180;
          const dLon = (item.longitude - userLng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(userLat * Math.PI / 180) * Math.cos(item.latitude * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          dist = Math.round(R * c * 10) / 10;
        }
        return {
          ...item,
          distance_km: dist
        };
      });

      // Sort by is_free DESC, then distance if available
      dataWithDist.sort((a, b) => {
        if (a.is_free !== b.is_free) return b.is_free - a.is_free;
        if (a.cost_inr !== b.cost_inr) return a.cost_inr - b.cost_inr;
        if (a.distance_km !== null && b.distance_km !== null) {
          return a.distance_km - b.distance_km;
        }
        return 0;
      });
    }

    return res.json({
      success: true,
      count: dataWithDist.length,
      budget: budget || 'unrestricted',
      category: category || 'all',
      data: dataWithDist
    });
  } catch (error) {
    console.error('Error fetching affordable services:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve affordable care options.'
    });
  }
});

/**
 * GET /api/services
 * List all services in catalog
 */
router.get('/', async (req, res) => {
  try {
    const { phc_id, category, is_free } = req.query;
    let sql = `
      SELECT sc.*, p.name AS phc_name, p.facility_type, p.city, p.state 
      FROM Service_Cost sc
      JOIN PHC p ON p.phc_id = sc.phc_id
      WHERE 1=1
    `;
    const params = [];

    if (phc_id) {
      sql += ' AND sc.phc_id = ?';
      params.push(parseInt(phc_id, 10));
    }
    if (category) {
      sql += ' AND sc.category = ?';
      params.push(category);
    }
    if (is_free !== undefined) {
      sql += ' AND sc.is_free = ?';
      params.push(is_free === 'true' || is_free === '1' ? 1 : 0);
    }

    sql += ' ORDER BY sc.category ASC, sc.cost_inr ASC';
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve services.' });
  }
});

/**
 * POST /api/services
 * Admin only: Add new service cost record
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { phc_id, service_name, category, cost_inr = 0, is_free = false, scheme_name, notes } = req.body;

    if (!phc_id || !service_name || !category) {
      return res.status(400).json({
        success: false,
        error: 'phc_id, service_name, and category are required.'
      });
    }

    const costVal = is_free ? 0.0 : parseFloat(cost_inr) || 0.0;

    const [result] = await db.query(
      `INSERT INTO Service_Cost (phc_id, service_name, category, cost_inr, is_free, scheme_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [phc_id, service_name.trim(), category, costVal, is_free ? 1 : 0, scheme_name || null, notes || null]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'INSERT',
        'Service_Cost',
        result.insertId,
        `Added service "${service_name}" at PHC #${phc_id} (₹${costVal})`
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Service cost entry created.',
      service_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({ success: false, error: 'Failed to create service cost.' });
  }
});

/**
 * PUT /api/services/:id
 * Admin only: Update service cost record
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id, 10);
    const { service_name, category, cost_inr, is_free, scheme_name, notes } = req.body;

    const [existing] = await db.query('SELECT * FROM Service_Cost WHERE service_id = ?', [serviceId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Service entry not found.' });
    }

    const current = existing[0];
    const sName = service_name !== undefined ? service_name.trim() : current.service_name;
    const cat = category !== undefined ? category : current.category;
    const free = is_free !== undefined ? (is_free ? 1 : 0) : current.is_free;
    const cost = free ? 0.0 : (cost_inr !== undefined ? parseFloat(cost_inr) : current.cost_inr);
    const scheme = scheme_name !== undefined ? scheme_name : current.scheme_name;
    const nts = notes !== undefined ? notes : current.notes;

    await db.query(
      `UPDATE Service_Cost SET 
        service_name = ?, category = ?, cost_inr = ?, is_free = ?, scheme_name = ?, notes = ?
       WHERE service_id = ?`,
      [sName, cat, cost, free, scheme, nts, serviceId]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'UPDATE',
        'Service_Cost',
        serviceId,
        `Updated service "${sName}" (₹${cost}, Free: ${free})`
      );
    }

    return res.json({ success: true, message: 'Service cost updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update service.' });
  }
});

/**
 * DELETE /api/services/:id
 * Admin only: Delete service cost record
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM Service_Cost WHERE service_id = ?', [serviceId]);

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'DELETE',
        'Service_Cost',
        serviceId,
        `Deleted service #${serviceId}`
      );
    }

    return res.json({ success: true, message: 'Service cost removed successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete service.' });
  }
});

module.exports = router;
