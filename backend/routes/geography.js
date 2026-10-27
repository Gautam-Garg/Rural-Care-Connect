// ==============================================================================
// Rural Care Connect: Geographic Hierarchy Routes
// Hierarchy: State > District > Block > Village (3NF Normalization)
// Enables village-level drill-down for maps, vaccination drives, and alerts.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/geography/hierarchy and GET /api/geography/tree
 * Returns the full hierarchy tree (States with Districts, Blocks, and Villages)
 */
async function getHierarchyTree(req, res) {
  try {
    const [states] = await db.query('SELECT state_id, name, code FROM State ORDER BY name ASC');
    const [districts] = await db.query('SELECT district_id, state_id, name, latitude, longitude FROM District ORDER BY name ASC');
    const [blocks] = await db.query('SELECT block_id, district_id, name FROM Block ORDER BY name ASC');
    const [villages] = await db.query('SELECT village_id, block_id, name, population, latitude, longitude FROM Village ORDER BY name ASC');

    const tree = states.map(s => {
      const stateDistricts = districts.filter(d => d.state_id === s.state_id).map(d => {
        const districtBlocks = blocks.filter(b => b.district_id === d.district_id).map(b => {
          const blockVillages = villages.filter(v => v.block_id === b.block_id);
          return {
            ...b,
            villages: blockVillages
          };
        });
        return {
          ...d,
          blocks: districtBlocks
        };
      });
      return {
        ...s,
        districts: stateDistricts
      };
    });

    return res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('Error fetching geographic hierarchy:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve geographic hierarchy.'
    });
  }
}

router.get('/hierarchy', getHierarchyTree);
router.get('/tree', getHierarchyTree);

/**
 * GET /api/geography/states
 */
router.get('/states', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT state_id, name, code FROM State ORDER BY name ASC');
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch states.' });
  }
});

/**
 * GET /api/geography/districts
 * Optional query: state_id
 */
router.get('/districts', async (req, res) => {
  try {
    const { state_id } = req.query;
    let sql = 'SELECT district_id, state_id, name, latitude, longitude FROM District WHERE 1=1';
    const params = [];
    if (state_id) {
      sql += ' AND state_id = ?';
      params.push(parseInt(state_id, 10));
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch districts.' });
  }
});

/**
 * GET /api/geography/blocks
 * Optional query: district_id
 */
router.get('/blocks', async (req, res) => {
  try {
    const { district_id } = req.query;
    let sql = 'SELECT block_id, district_id, name FROM Block WHERE 1=1';
    const params = [];
    if (district_id) {
      sql += ' AND district_id = ?';
      params.push(parseInt(district_id, 10));
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch blocks.' });
  }
});

/**
 * GET /api/geography/villages
 * Optional query: block_id
 */
router.get('/villages', async (req, res) => {
  try {
    const { block_id } = req.query;
    let sql = 'SELECT village_id, block_id, name, population, latitude, longitude FROM Village WHERE 1=1';
    const params = [];
    if (block_id) {
      sql += ' AND block_id = ?';
      params.push(parseInt(block_id, 10));
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch villages.' });
  }
});

module.exports = router;
