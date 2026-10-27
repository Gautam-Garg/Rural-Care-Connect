const router = require('express').Router();
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;

// GET /api/cost/modes
router.get('/modes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT mode_code, label_en FROM Travel_Mode ORDER BY mode_id');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load travel modes' });
  }
});

// GET /api/cost/compare?lat=19.99&lng=73.78&category=Consultation&mode=bus&wage=300
router.get('/compare', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const { category, mode = 'bus' } = req.query;
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  if (!category) return res.status(400).json({ error: 'category is required' });

  try {
    let wage = Number(req.query.wage);
    if (!wage || wage < 0 || wage > 3000) {
      const [r] = await pool.query(
        "SELECT value_num FROM Cost_Assumption WHERE key_name = 'default_daily_wage'");
      wage = r.length ? Number(r[0].value_num) : 300;
    }
    const [sets] = await pool.query('CALL sp_total_cost_of_care(?,?,?,?,?,?)',
      [lat, lng, category, mode, wage, 5]);

    res.json({
      government: sets[0] || [],
      privateOption: (sets[1] && sets[1][0]) ? sets[1][0] : null,
      note: 'Estimates based on adjustable sample assumptions. Not an official price list.'
    });
  } catch (e) {
    if (e.sqlState === '45000') return res.status(400).json({ error: e.sqlMessage });
    console.error(e);
    res.status(500).json({ error: 'Could not calculate cost' });
  }
});

module.exports = router;
