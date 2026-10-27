// ==============================================================================
// HealthWatch AI: Citizen Complaints & Grievance Redressal Routes
// Public submission form; Admin review and status updates.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * POST /api/complaints
 * Public: Anyone can submit a health/sanitation grievance
 */
router.post('/', async (req, res) => {
  try {
    const { city, description } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Description cannot be empty.'
      });
    }

    const [result] = await db.query(
      'INSERT INTO Complaints (city, description, status) VALUES (?, ?, "new")',
      [city ? city.trim() : null, description.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully. Authorities will review shortly.',
      complaint_id: result.insertId
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit complaint.'
    });
  }
});

/**
 * GET /api/complaints
 * Admin only: Review citizen grievances
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, city } = req.query;

    let sql = 'SELECT * FROM Complaints WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve complaints.'
    });
  }
});

/**
 * PUT /api/complaints/:id
 * Admin only: Update complaint status (new -> reviewed -> closed)
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const validStatuses = ['new', 'reviewed', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const [existing] = await db.query('SELECT * FROM Complaints WHERE complaint_id = ?', [complaintId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found.'
      });
    }

    await db.query('UPDATE Complaints SET status = ? WHERE complaint_id = ?', [status, complaintId]);

    await logAudit(
      req.session.user.user_id,
      'UPDATE',
      'Complaints',
      complaintId,
      `Updated complaint #${complaintId} status to "${status}"`
    );

    return res.json({
      success: true,
      message: `Complaint status updated to "${status}".`
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update complaint status.'
    });
  }
});

/**
 * DELETE /api/complaints/:id
 * Admin only: Delete a complaint record
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT * FROM Complaints WHERE complaint_id = ?', [complaintId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found.'
      });
    }

    await db.query('DELETE FROM Complaints WHERE complaint_id = ?', [complaintId]);

    await logAudit(
      req.session.user.user_id,
      'DELETE',
      'Complaints',
      complaintId,
      `Deleted complaint #${complaintId} (${existing[0].city})`
    );

    return res.json({
      success: true,
      message: `Complaint #${complaintId} deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete complaint.'
    });
  }
});

module.exports = router;
