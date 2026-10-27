const router = require('express').Router();
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;

// GET /api/medicine-fallback?phcId=2&medicineId=15&lat=19.99&lng=73.78
// lat and lng are optional; if missing, the PHC's own location is used.
router.get('/', async (req, res) => {
  const phcId = parseInt(req.query.phcId, 10);
  const medicineId = parseInt(req.query.medicineId, 10);
  if (!phcId || !medicineId) {
    return res.status(400).json({ error: 'phcId and medicineId are required' });
  }
  const lat = req.query.lat !== undefined && req.query.lat !== '' ? Number(req.query.lat) : null;
  const lng = req.query.lng !== undefined && req.query.lng !== '' ? Number(req.query.lng) : null;
  if ((lat !== null && !isFinite(lat)) || (lng !== null && !isFinite(lng))) {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  try {
    const [sets] = await pool.query('CALL sp_medicine_fallback(?,?,?,?,?)',
      [phcId, medicineId, lat, lng, 3]);

    const [[med]] = await pool.query(
      'SELECT name FROM Medicine WHERE medicine_id = ?', [medicineId]);
    if (med && med.name) {
      await pool.query(
        'INSERT INTO Medicine_Demand_Log (phc_id, medicine_name) VALUES (?, ?)',
        [phcId, med.name]);
    }

    res.json({
      medicine: med ? med.name : '',
      otherPhcs: sets[0] || [],
      sameCentreAlternatives: sets[1] || [],
      janAushadhi: sets[2] || [],
      safetyNote: 'Ask the doctor or pharmacist before changing any medicine.'
    });
  } catch (e) {
    if (e.sqlState === '45000') return res.status(404).json({ error: e.sqlMessage });
    console.error(e);
    res.status(500).json({ error: 'Could not find alternatives' });
  }
});

module.exports = router;
