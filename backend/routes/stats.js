// ==============================================================================
// HealthWatch AI: Surveillance Statistics & KPI Summary Routes
// Aggregates real-time metrics across Hospital, Patient_Cases, Alerts, & Stocks
// DBMS Concepts: Relational Views (vw_daily_cases, vw_low_stock), GROUP BY
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

/**
 * GET /api/stats/summary
 * Provides live KPI counts for both Public and Admin dashboards
 */
router.get('/summary', requireLogin, async (req, res) => {
  try {
    const [hospRows] = await db.query(
      'SELECT COUNT(*) AS total_hospitals, COALESCE(SUM(available_beds), 0) AS total_available_beds, COALESCE(SUM(total_beds), 0) AS total_beds, COALESCE(SUM(available_icu), 0) AS available_icu, COALESCE(SUM(total_icu), 0) AS total_icu, COALESCE(SUM(ventilators), 0) AS ventilators FROM Hospital'
    );
    const [caseRows] = await db.query(
      `SELECT 
        COUNT(*) AS total_cases,
        COALESCE(SUM(status = 'admitted'), 0) AS active_admissions,
        COALESCE(SUM(status = 'recovered'), 0) AS recovered_cases,
        COALESCE(SUM(status = 'deceased'), 0) AS deceased_cases,
        COALESCE(SUM(status = 'admitted' AND icu_required = 1), 0) AS icu_cases
       FROM Patient_Cases`
    );
    const [alertRows] = await db.query(
      'SELECT COUNT(*) AS total_alerts, COALESCE(SUM(status = "active"), 0) AS active_alerts FROM Alerts'
    );
    const [diseaseRows] = await db.query(
      'SELECT COUNT(*) AS total_diseases FROM Disease'
    );
    const [stockRows] = await db.query(
      'SELECT COUNT(*) AS low_stock_count FROM vw_low_stock'
    );
    const [complaintRows] = await db.query(
      `SELECT 
        COUNT(*) AS total_complaints,
        COALESCE(SUM(status = 'new'), 0) AS pending_complaints
       FROM Complaints`
    );
    const [userRows] = await db.query(
      'SELECT COUNT(*) AS total_users FROM Users'
    );

    return res.json({
      success: true,
      data: {
        total_hospitals: parseInt(hospRows[0].total_hospitals, 10),
        total_available_beds: parseInt(hospRows[0].total_available_beds, 10),
        total_beds: parseInt(hospRows[0].total_beds, 10),
        available_icu: parseInt(hospRows[0].available_icu, 10),
        total_icu: parseInt(hospRows[0].total_icu, 10),
        ventilators: parseInt(hospRows[0].ventilators, 10),
        total_cases: parseInt(caseRows[0].total_cases, 10),
        active_admissions: parseInt(caseRows[0].active_admissions, 10),
        recovered_cases: parseInt(caseRows[0].recovered_cases, 10),
        deceased_cases: parseInt(caseRows[0].deceased_cases, 10),
        icu_cases: parseInt(caseRows[0].icu_cases, 10),
        active_alerts: parseInt(alertRows[0].active_alerts, 10),
        total_alerts: parseInt(alertRows[0].total_alerts, 10),
        total_diseases: parseInt(diseaseRows[0].total_diseases, 10),
        low_stock_medicines: parseInt(stockRows[0].low_stock_count, 10),
        pending_complaints: parseInt(complaintRows[0].pending_complaints, 10),
        total_complaints: parseInt(complaintRows[0].total_complaints, 10),
        total_users: parseInt(userRows[0].total_users, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary statistics.'
    });
  }
});

/**
 * GET /api/stats/trend
 * Daily cases, deaths, and recoveries for Chart.js trend graphs
 * Parameters: days (default 30), disease, city
 */
router.get('/trend', requireLogin, async (req, res) => {
  try {
    const { days = 30, disease, city } = req.query;
    const intervalDays = Math.max(7, Math.min(180, parseInt(days, 10) || 30));

    let sql = `
      SELECT 
        DATE_FORMAT(day, '%Y-%m-%d') AS date,
        SUM(cases) AS cases,
        SUM(deaths) AS deaths,
        SUM(recoveries) AS recoveries,
        SUM(active_admissions) AS active_admissions
      FROM vw_daily_cases
      WHERE day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const params = [intervalDays];

    if (disease) {
      if (!isNaN(disease)) {
        sql += ' AND disease_id = ?';
        params.push(parseInt(disease, 10));
      } else {
        sql += ' AND disease LIKE ?';
        params.push(`%${disease}%`);
      }
    }

    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }

    sql += ' GROUP BY day ORDER BY day ASC';

    const [rows] = await db.query(sql, params);
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching trend stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve trend statistics.'
    });
  }
});

/**
 * GET /api/stats/categories
 * Case distribution by disease transmission category
 */
router.get('/categories', requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.category,
        COUNT(pc.case_id) AS total_cases,
        ROUND(100.0 * COUNT(pc.case_id) / NULLIF((SELECT COUNT(*) FROM Patient_Cases), 0), 1) AS percentage
      FROM Patient_Cases pc
      JOIN Disease d ON d.disease_id = pc.disease_id
      GROUP BY d.category
      ORDER BY total_cases DESC
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category statistics.'
    });
  }
});

/**
 * GET /api/stats/epiclim-filters
 * Returns distinct available years, diseases, and states from Disease_Stats
 */
router.get('/epiclim-filters', requireLogin, async (req, res) => {
  try {
    const [years] = await db.query('SELECT DISTINCT year FROM Disease_Stats ORDER BY year DESC');
    const [diseases] = await db.query('SELECT DISTINCT disease_name FROM Disease_Stats ORDER BY disease_name ASC');
    const [states] = await db.query('SELECT DISTINCT state FROM Disease_Stats ORDER BY state ASC');

    return res.json({
      success: true,
      data: {
        years: years.map(r => r.year),
        diseases: diseases.map(r => r.disease_name),
        states: states.map(r => r.state)
      }
    });
  } catch (error) {
    console.error('Error fetching epiclim filters:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve filter options.'
    });
  }
});

/**
 * GET /api/stats/heatmap
 * Retrieves geospatial aggregated outbreak records from Disease_Stats
 * Query parameters: disease, year, state
 */
router.get('/heatmap', requireLogin, async (req, res) => {
  try {
    const { disease, year, state } = req.query;

    let sql = `
      SELECT 
        state,
        district,
        latitude,
        longitude,
        SUM(cases) AS total_cases,
        SUM(deaths) AS total_deaths,
        ROUND(AVG(temperature), 1) AS avg_temp,
        ROUND(AVG(preci), 2) AS avg_preci,
        COUNT(*) AS outbreak_events,
        GROUP_CONCAT(DISTINCT disease_name ORDER BY disease_name SEPARATOR ', ') AS diseases_list
      FROM Disease_Stats
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `;
    const params = [];

    if (disease && disease !== 'all') {
      sql += ' AND disease_name = ?';
      params.push(disease);
    }

    if (year && year !== 'all') {
      sql += ' AND year = ?';
      params.push(parseInt(year, 10));
    }

    if (state && state !== 'all') {
      sql += ' AND state = ?';
      params.push(state);
    }

    sql += ' GROUP BY state, district, latitude, longitude ORDER BY total_cases DESC LIMIT 1500';

    const [rows] = await db.query(sql, params);

    // Compute summary totals for current selection
    let totalCases = 0;
    let totalDeaths = 0;
    let totalOutbreaks = 0;

    rows.forEach(r => {
      totalCases += parseInt(r.total_cases, 10) || 0;
      totalDeaths += parseInt(r.total_deaths, 10) || 0;
      totalOutbreaks += parseInt(r.outbreak_events, 10) || 0;
    });

    const mappedRows = rows.map(r => ({
      ...r,
      lat: r.latitude,
      lng: r.longitude,
      cases: parseInt(r.total_cases, 10) || 0,
      deaths: parseInt(r.total_deaths, 10) || 0,
      events: parseInt(r.outbreak_events, 10) || 0,
      avg_temp_c: r.avg_temp,
      avg_rainfall_mm: r.avg_preci
    }));

    return res.json({
      success: true,
      count: mappedRows.length,
      summary: {
        total_cases: totalCases,
        total_deaths: totalDeaths,
        total_outbreak_events: totalOutbreaks,
        outbreak_events: totalOutbreaks,
        districts_affected: rows.length
      },
      data: mappedRows
    });
  } catch (error) {
    console.error('Error fetching heatmap stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve outbreak heatmap data.'
    });
  }
});

/**
 * GET /api/stats/weather-cases
 * Correlates reported outbreak cases with temperature and precipitation from Disease_Stats
 * Query parameters: disease, year, state
 */
router.get('/weather-cases', requireLogin, async (req, res) => {
  try {
    const { disease, year, state } = req.query;

    // 1. Time-series aggregation (by month/year)
    let timelineSql = `
      SELECT 
        year,
        DATE_FORMAT(report_date, '%Y-%m') AS period,
        SUM(cases) AS cases,
        SUM(deaths) AS deaths,
        ROUND(AVG(temperature), 1) AS avg_temp,
        ROUND(AVG(preci), 2) AS avg_rainfall,
        COUNT(*) AS outbreak_events
      FROM Disease_Stats
      WHERE report_date IS NOT NULL
    `;
    const params = [];

    if (disease && disease !== 'all') {
      timelineSql += ' AND disease_name = ?';
      params.push(disease);
    }

    if (year && year !== 'all') {
      timelineSql += ' AND year = ?';
      params.push(parseInt(year, 10));
    }

    if (state && state !== 'all') {
      timelineSql += ' AND state = ?';
      params.push(state);
    }

    timelineSql += ' GROUP BY year, period ORDER BY period ASC';
    const [timelineRows] = await db.query(timelineSql, params);

    // 2. Temperature Brackets Analysis (0-50°C in 5°C intervals)
    let tempBucketsSql = `
      SELECT 
        FLOOR(temperature / 5) * 5 AS temp_min,
        CONCAT(FLOOR(temperature / 5) * 5, '°C–', FLOOR(temperature / 5) * 5 + 5, '°C') AS temp_range,
        SUM(cases) AS cases,
        COUNT(*) AS outbreaks,
        ROUND(AVG(cases), 1) AS avg_cases_per_outbreak
      FROM Disease_Stats
      WHERE temperature IS NOT NULL
    `;
    const tempParams = [];

    if (disease && disease !== 'all') {
      tempBucketsSql += ' AND disease_name = ?';
      tempParams.push(disease);
    }

    if (year && year !== 'all') {
      tempBucketsSql += ' AND year = ?';
      tempParams.push(parseInt(year, 10));
    }

    tempBucketsSql += `
      GROUP BY temp_min, temp_range 
      HAVING temp_min >= 0 AND temp_min <= 50
      ORDER BY temp_min ASC
    `;
    const [bucketRows] = await db.query(tempBucketsSql, tempParams);

    const mappedBuckets = bucketRows.map(b => ({
      ...b,
      bracket: b.temp_range,
      total_cases: parseInt(b.cases, 10) || 0,
      outbreak_events: parseInt(b.outbreaks, 10) || 0,
      avg_cases: b.avg_cases_per_outbreak
    }));

    const mappedTimeline = timelineRows.map(t => ({
      ...t,
      avg_rain: t.avg_rainfall
    }));

    return res.json({
      success: true,
      timeline: mappedTimeline,
      buckets: mappedBuckets,
      temp_correlation: mappedBuckets
    });
  } catch (error) {
    console.error('Error fetching weather-vs-cases stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve weather vs cases correlation.'
    });
  }
});

/**
 * GET /api/stats/historical
 * Serves raw paginated records from Disease_Stats (EpiClim dataset: 8,974 records)
 */
router.get('/historical', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const { disease, state, year } = req.query;

    let sql = 'SELECT * FROM Disease_Stats WHERE 1=1';
    const params = [];

    if (disease && disease !== 'all') {
      sql += ' AND disease_name = ?';
      params.push(disease);
    }
    if (state && state !== 'all') {
      sql += ' AND state = ?';
      params.push(state);
    }
    if (year && year !== 'all') {
      sql += ' AND year = ?';
      params.push(parseInt(year, 10));
    }

    sql += ' ORDER BY year DESC, stat_id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM Disease_Stats');

    return res.json({
      success: true,
      total: countRows[0].total,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching historical stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve historical epidemiology records.'
    });
  }
});

module.exports = router;

