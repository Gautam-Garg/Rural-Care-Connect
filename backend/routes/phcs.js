// ==============================================================================
// Rural Care Connect: Primary Health Centre (PHC) Management Routes
// Uses vw_bed_availability for reads; protects writes with requireAdmin.
// Supports Haversine nearest-facility finder via sp_nearest_phc stored procedure.
// Supports facility types: PHC, CHC, Sub-centre
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

/**
 * GET /api/phcs/nearest
 * Finds nearest PHCs/CHCs using MySQL Haversine stored procedure sp_nearest_phc
 * Query params: lat, lng, radius (default 50 km)
 */
router.get('/nearest', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 50.0;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'Valid numeric latitude (lat) and longitude (lng) parameters are required.'
      });
    }

    // Call Haversine stored procedure
    const [results] = await db.query('CALL sp_nearest_phc(?, ?, ?)', [lat, lng, radius]);
    const phcs = (results && results[0]) ? results[0] : [];

    return res.json({
      success: true,
      count: phcs.length,
      origin: { lat, lng },
      radius_km: radius,
      data: phcs
    });
  } catch (error) {
    console.error('Error executing sp_nearest_phc:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to find nearest Primary Health Centres.'
    });
  }
});

/**
 * GET /api/phcs
 * Query view vw_bed_availability with search and filtering
 */
router.get('/', async (req, res) => {
  try {
    const { city, state, district, facility_type, doctor, ambulance, q } = req.query;
    let sql = 'SELECT * FROM vw_bed_availability WHERE 1=1';
    const params = [];

    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }

    if (state) {
      sql += ' AND state = ?';
      params.push(state);
    }

    if (district) {
      sql += ' AND (district_name = ? OR city = ?)';
      params.push(district, district);
    }

    if (facility_type) {
      sql += ' AND facility_type = ?';
      params.push(facility_type);
    }

    if (doctor !== undefined) {
      sql += ' AND doctor_available = ?';
      params.push(doctor === 'true' || doctor === '1' ? 1 : 0);
    }

    if (ambulance !== undefined) {
      sql += ' AND ambulance_available = ?';
      params.push(ambulance === 'true' || ambulance === '1' ? 1 : 0);
    }

    if (q) {
      sql += ' AND (name LIKE ? OR city LIKE ? OR state LIKE ? OR district_name LIKE ? OR village_name LIKE ?)';
      const queryPattern = `%${q}%`;
      params.push(queryPattern, queryPattern, queryPattern, queryPattern, queryPattern);
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching PHCs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve Primary Health Centre data.'
    });
  }
});

/**
 * GET /api/phcs/:id
 * Retrieve a specific PHC by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const phcId = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      'SELECT * FROM vw_bed_availability WHERE phc_id = ?',
      [phcId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Primary Health Centre not found.'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching PHC by ID:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve PHC.'
    });
  }
});

/**
 * GET /api/phcs/:id/medicines
 * Returns medicine pharmacy stock for a given PHC facility
 */
router.get('/:id/medicines', async (req, res) => {
  try {
    const phcId = parseInt(req.params.id, 10);
    const [rows] = await db.query(
      `SELECT m.medicine_id, m.name, m.stock, m.reorder_level,
              mi.salt_composition, mi.strength, mi.jan_aushadhi_available
       FROM Medicine m
       LEFT JOIN Medicine_Info mi ON mi.name = m.name
       WHERE m.hospital_id = ?
       ORDER BY m.stock ASC, m.name ASC`,
      [phcId]
    );
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching medicines for PHC:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve medicines for this facility.'
    });
  }
});

/**
 * POST /api/phcs
 * Admin only: Create new PHC facility
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      facility_type = 'PHC',
      district_id,
      block_id,
      village_id,
      city,
      state,
      latitude,
      longitude,
      total_beds,
      available_beds,
      total_icu = 0,
      available_icu = 0,
      ventilators = 0,
      doctor_available = true,
      ambulance_available = true,
      open_hours = '24x7',
      phone = '108'
    } = req.body;

    if (!name || !city || !state || latitude === undefined || longitude === undefined || total_beds === undefined || available_beds === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (name, city, state, latitude, longitude, total_beds, available_beds).'
      });
    }

    const tBeds = parseInt(total_beds, 10);
    const aBeds = parseInt(available_beds, 10);
    const tIcu = parseInt(total_icu, 10);
    const aIcu = parseInt(available_icu, 10);
    const vents = parseInt(ventilators, 10);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (aBeds > tBeds || aBeds < 0 || tBeds < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bed numbers: available beds must be between 0 and total beds.'
      });
    }

    const [result] = await db.query(
      `INSERT INTO PHC (
        name, facility_type, district_id, block_id, village_id, city, state, latitude, longitude,
        total_beds, available_beds, total_icu, available_icu, ventilators,
        doctor_available, ambulance_available, open_hours, phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        facility_type,
        district_id || null,
        block_id || null,
        village_id || null,
        city.trim(),
        state.trim(),
        lat,
        lng,
        tBeds,
        aBeds,
        tIcu,
        aIcu,
        vents,
        doctor_available ? 1 : 0,
        ambulance_available ? 1 : 0,
        open_hours,
        phone
      ]
    );

    const newId = result.insertId;

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'INSERT',
        'PHC',
        newId,
        `Created ${facility_type} "${name}" in ${city}, ${state}`
      );
    }

    const [createdRows] = await db.query(
      'SELECT * FROM vw_bed_availability WHERE phc_id = ?',
      [newId]
    );

    return res.status(201).json({
      success: true,
      message: `${facility_type} created successfully.`,
      data: createdRows[0]
    });
  } catch (error) {
    console.error('Error creating PHC:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create Primary Health Centre.'
    });
  }
});

/**
 * PUT /api/phcs/:id
 * Admin only: Update PHC facility
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const phcId = parseInt(req.params.id, 10);
    const {
      name,
      facility_type,
      district_id,
      block_id,
      village_id,
      city,
      state,
      latitude,
      longitude,
      total_beds,
      available_beds,
      total_icu,
      available_icu,
      ventilators,
      doctor_available,
      ambulance_available,
      open_hours,
      phone
    } = req.body;

    const [existing] = await db.query('SELECT * FROM PHC WHERE phc_id = ?', [phcId]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Primary Health Centre not found.'
      });
    }

    const current = existing[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newType = facility_type !== undefined ? facility_type : current.facility_type;
    const newCity = city !== undefined ? city.trim() : current.city;
    const newState = state !== undefined ? state.trim() : current.state;
    const newLat = latitude !== undefined ? parseFloat(latitude) : current.latitude;
    const newLng = longitude !== undefined ? parseFloat(longitude) : current.longitude;
    const newTBeds = total_beds !== undefined ? parseInt(total_beds, 10) : current.total_beds;
    const newABeds = available_beds !== undefined ? parseInt(available_beds, 10) : current.available_beds;
    const newTIcu = total_icu !== undefined ? parseInt(total_icu, 10) : current.total_icu;
    const newAIcu = available_icu !== undefined ? parseInt(available_icu, 10) : current.available_icu;
    const newVents = ventilators !== undefined ? parseInt(ventilators, 10) : current.ventilators;
    const newDoc = doctor_available !== undefined ? (doctor_available ? 1 : 0) : current.doctor_available;
    const newAmb = ambulance_available !== undefined ? (ambulance_available ? 1 : 0) : current.ambulance_available;
    const newHours = open_hours !== undefined ? open_hours : current.open_hours;
    const newPhone = phone !== undefined ? phone : current.phone;
    const newDist = district_id !== undefined ? district_id : current.district_id;
    const newBlk = block_id !== undefined ? block_id : current.block_id;
    const newVil = village_id !== undefined ? village_id : current.village_id;

    if (newABeds > newTBeds || newABeds < 0 || newTBeds < 0) {
      return res.status(400).json({
        success: false,
        error: 'Available beds cannot exceed total beds or be negative.'
      });
    }

    await db.query(
      `UPDATE PHC SET
        name = ?, facility_type = ?, district_id = ?, block_id = ?, village_id = ?,
        city = ?, state = ?, latitude = ?, longitude = ?,
        total_beds = ?, available_beds = ?, total_icu = ?, available_icu = ?, ventilators = ?,
        doctor_available = ?, ambulance_available = ?, open_hours = ?, phone = ?
      WHERE phc_id = ?`,
      [
        newName, newType, newDist, newBlk, newVil,
        newCity, newState, newLat, newLng,
        newTBeds, newABeds, newTIcu, newAIcu, newVents,
        newDoc, newAmb, newHours, newPhone,
        phcId
      ]
    );

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'UPDATE',
        'PHC',
        phcId,
        `Updated ${newType} "${newName}" (Beds: ${newABeds}/${newTBeds}, Doctor: ${newDoc}, Ambulance: ${newAmb})`
      );
    }

    const [updatedRows] = await db.query(
      'SELECT * FROM vw_bed_availability WHERE phc_id = ?',
      [phcId]
    );

    return res.json({
      success: true,
      message: 'PHC facility updated successfully.',
      data: updatedRows[0]
    });
  } catch (error) {
    console.error('Error updating PHC:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update Primary Health Centre.'
    });
  }
});

/**
 * DELETE /api/phcs/:id
 * Admin only: Delete PHC facility
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const phcId = parseInt(req.params.id, 10);
    const [existing] = await db.query('SELECT * FROM PHC WHERE phc_id = ?', [phcId]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Primary Health Centre not found.'
      });
    }

    await db.query('DELETE FROM PHC WHERE phc_id = ?', [phcId]);

    if (req.session && req.session.user) {
      await logAudit(
        req.session.user.user_id,
        'DELETE',
        'PHC',
        phcId,
        `Deleted PHC facility "${existing[0].name}"`
      );
    }

    return res.json({
      success: true,
      message: 'PHC facility deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting PHC:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete PHC facility.'
    });
  }
});

module.exports = router;
