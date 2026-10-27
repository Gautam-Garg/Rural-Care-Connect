// ==============================================================================
// Rural Care Connect: Village Vaccination Drives Routes
// Table: Vaccination_Drive | View: vw_upcoming_drives
// Trigger: trg_vaccine_drive_stockout (fires when doses_available reaches 0)
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin, requireAdminOrAsha } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/vaccination-drives
 * List upcoming vaccination drives in villages
 * Query params: village_id, district_id, state_id, phc_id, from_date, status
 */
router.get('/', async (req, res) => {
  try {
    const { village_id, block_id, district_id, state_id, phc_id, from_date, status } = req.query;
    let sql = 'SELECT * FROM vw_upcoming_drives WHERE 1=1';
    const params = [];

    if (village_id) {
      sql += ' AND village_id = ?';
      params.push(parseInt(village_id, 10));
    }

    if (district_id) {
      sql += ' AND district_name = (SELECT name FROM District WHERE district_id = ?)';
      params.push(parseInt(district_id, 10));
    }

    if (phc_id) {
      sql += ' AND phc_id = ?';
      params.push(parseInt(phc_id, 10));
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += ' AND status != "cancelled"';
    }

    if (from_date) {
      sql += ' AND drive_date >= ?';
      params.push(from_date);
    }

    sql += ' ORDER BY drive_date ASC, time ASC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching vaccination drives:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vaccination drives.'
    });
  }
});

/**
 * GET /api/vaccination-drives/upcoming
 * Direct alias for active upcoming drives
 */
router.get('/upcoming', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM vw_upcoming_drives WHERE status = "scheduled" ORDER BY drive_date ASC, time ASC'
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve upcoming drives.' });
  }
});

/**
 * GET /api/vaccination-drives/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const driveId = parseInt(req.params.id, 10);
    const [rows] = await db.query('SELECT * FROM vw_upcoming_drives WHERE drive_id = ?', [driveId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vaccination drive not found.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve drive.' });
  }
});

/**
 * POST /api/vaccination-drives
 * Admin or ASHA can schedule a village drive
 */
router.post('/', requireAdminOrAsha, async (req, res) => {
  try {
    const { phc_id, village_id, vaccine, drive_date, time, target_group, doses_available } = req.body;

    if (!phc_id || !village_id || !vaccine || !drive_date) {
      return res.status(400).json({
        success: false,
        error: 'phc_id, village_id, vaccine, and drive_date are required.'
      });
    }

    const doses = parseInt(doses_available, 10) || 50;

    const [result] = await db.query(
      `INSERT INTO Vaccination_Drive (phc_id, village_id, vaccine, drive_date, time, target_group, doses_available, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        phc_id,
        village_id,
        vaccine.trim(),
        drive_date,
        time || '09:00 AM - 02:00 PM',
        target_group || 'Infants & Mothers',
        doses
      ]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'INSERT',
        'Vaccination_Drive',
        result.insertId,
        `Scheduled drive for ${vaccine} in village #${village_id} on ${drive_date}`
      );
    }

    const [created] = await db.query('SELECT * FROM vw_upcoming_drives WHERE drive_id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Vaccination drive scheduled successfully.',
      data: created[0]
    });
  } catch (error) {
    console.error('Error creating vaccination drive:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to schedule vaccination drive.'
    });
  }
});

/**
 * PUT /api/vaccination-drives/:id
 * Admin or ASHA update drive (e.g., decrement doses, reschedule, or cancel)
 * When doses_available is set to 0, trigger trg_vaccine_drive_stockout automatically creates an alert!
 */
router.put('/:id', requireAdminOrAsha, async (req, res) => {
  try {
    const driveId = parseInt(req.params.id, 10);
    const { vaccine, drive_date, time, target_group, doses_available, status } = req.body;

    const [existing] = await db.query('SELECT * FROM Vaccination_Drive WHERE drive_id = ?', [driveId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Vaccination drive not found.' });
    }

    const cur = existing[0];
    const newVaccine = vaccine !== undefined ? vaccine.trim() : cur.vaccine;
    const newDate = drive_date !== undefined ? drive_date : cur.drive_date;
    const newTime = time !== undefined ? time : cur.time;
    const newTarget = target_group !== undefined ? target_group : cur.target_group;
    const newDoses = doses_available !== undefined ? parseInt(doses_available, 10) : cur.doses_available;
    const newStatus = status !== undefined ? status : cur.status;

    await db.query(
      `UPDATE Vaccination_Drive SET
        vaccine = ?, drive_date = ?, time = ?, target_group = ?, doses_available = ?, status = ?
       WHERE drive_id = ?`,
      [newVaccine, newDate, newTime, newTarget, newDoses, newStatus, driveId]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'UPDATE',
        'Vaccination_Drive',
        driveId,
        `Updated drive #${driveId} (Doses: ${cur.doses_available} -> ${newDoses}, Status: ${newStatus})`
      );
    }

    const [updated] = await db.query('SELECT * FROM vw_upcoming_drives WHERE drive_id = ?', [driveId]);

    return res.json({
      success: true,
      message: 'Vaccination drive updated successfully.',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating drive:', error);
    return res.status(500).json({ success: false, error: 'Failed to update vaccination drive.' });
  }
});

/**
 * DELETE /api/vaccination-drives/:id
 * Admin only: Delete drive
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const driveId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM Vaccination_Drive WHERE drive_id = ?', [driveId]);

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'DELETE',
        'Vaccination_Drive',
        driveId,
        `Deleted vaccination drive #${driveId}`
      );
    }

    return res.json({ success: true, message: 'Vaccination drive deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete drive.' });
  }
});

module.exports = router;
