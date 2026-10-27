// ==============================================================================
// HealthWatch AI: Weather Telemetry & Environmental Risk Routes
// Fetches live telemetry from Open-Meteo API and caches in MySQL Weather table.
// ==============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

// Fallback coordinate map for Indian metropolitan centers
const CITY_COORDINATES = {
  'Delhi': { lat: 28.6139, lon: 77.2090 },
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Bengaluru': { lat: 12.9716, lon: 77.5946 },
  'Chennai': { lat: 13.0827, lon: 80.2707 },
  'Kolkata': { lat: 22.5726, lon: 88.3639 },
  'Hyderabad': { lat: 17.3850, lon: 78.4867 },
  'Pune': { lat: 18.5204, lon: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'Jaipur': { lat: 26.9124, lon: 75.7873 },
  'Lucknow': { lat: 26.8467, lon: 80.9462 }
};

/**
 * GET /api/weather?city=Delhi
 * Queries Open-Meteo, updates Weather table, and returns environmental metrics
 */
router.get('/', requireLogin, async (req, res) => {
  const targetCity = (req.query.city || 'Delhi').trim();

  try {
    // 1. Locate coordinates from Hospital table or fallback map
    let lat = 28.6139;
    let lon = 77.2090;

    const [hospRows] = await db.query(
      'SELECT latitude, longitude FROM Hospital WHERE city = ? LIMIT 1',
      [targetCity]
    );

    if (hospRows.length > 0 && hospRows[0].latitude) {
      lat = parseFloat(hospRows[0].latitude);
      lon = parseFloat(hospRows[0].longitude);
    } else if (CITY_COORDINATES[targetCity]) {
      lat = CITY_COORDINATES[targetCity].lat;
      lon = CITY_COORDINATES[targetCity].lon;
    }

    let temp = null;
    let humidity = null;
    let rainfall = null;

    // 2. Fetch from Open-Meteo API
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation`;
      const response = await fetch(weatherUrl, { timeout: 4000 });

      if (response.ok) {
        const data = await response.json();
        if (data.current) {
          temp = data.current.temperature_2m;
          humidity = data.current.relative_humidity_2m;
          rainfall = data.current.precipitation;

          // Cache into Weather table using safe ON DUPLICATE KEY UPDATE
          await db.query(
            `INSERT INTO Weather (city, record_date, temperature, humidity, rainfall)
             VALUES (?, CURDATE(), ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               temperature = VALUES(temperature),
               humidity = VALUES(humidity),
               rainfall = VALUES(rainfall)`,
            [targetCity, temp, humidity, rainfall]
          );
        }
      }
    } catch (apiErr) {
      console.warn('Open-Meteo live API notice:', apiErr.message);
    }

    // 3. If live call didn't get values, read from Weather cache
    if (temp === null) {
      const [cached] = await db.query(
        'SELECT temperature, humidity, rainfall, record_date FROM Weather WHERE city = ? ORDER BY record_date DESC LIMIT 1',
        [targetCity]
      );
      if (cached.length > 0) {
        temp = parseFloat(cached[0].temperature) || 28.0;
        humidity = parseFloat(cached[0].humidity) || 65.0;
        rainfall = parseFloat(cached[0].rainfall) || 0.0;
      } else {
        temp = 28.5;
        humidity = 68.0;
        rainfall = 0.0;
      }
    }

    // 4. Calculate Vector-Borne Environmental Risk Index (0 - 100)
    // Formula based on epidemiological vector ecology (Aedes / Anopheles):
    // - Baseline ambient urban score: 10 pts
    // - Temperature window (24°C - 34°C): up to 30 pts (optimal mosquito development)
    // - High relative humidity (> 65%): up to 25 pts (adult mosquito survival)
    // - Precipitation / rainfall (standing water for breeding): up to 35 pts
    let vectorRisk = 10;

    // Temperature score (max 30)
    if (temp >= 24 && temp <= 34) {
      vectorRisk += 30; // Optimal vector reproduction & virus incubation
    } else if ((temp >= 20 && temp < 24) || (temp > 34 && temp <= 38)) {
      vectorRisk += 15; // Moderate reproduction
    } else {
      vectorRisk += 5;  // Extreme cold (<20C) or extreme heat (>38C) inhibits larvae
    }

    // Humidity score (max 25) - requires >65% for high humidity threshold
    if (humidity > 65) {
      vectorRisk += 25; // High humidity prolongs mosquito lifespan
    } else if (humidity >= 50 && humidity <= 65) {
      vectorRisk += 10; // Moderate humidity
    } else {
      vectorRisk += 0;  // Dry air drastically reduces vector survival
    }

    // Precipitation / Rainfall score (max 35) - critical for stagnant breeding pools
    if (rainfall >= 10) {
      vectorRisk += 35; // Heavy rain creating widespread stagnant water pools
    } else if (rainfall >= 3) {
      vectorRisk += 25; // Moderate rain
    } else if (rainfall > 0) {
      vectorRisk += 10; // Light rain/drizzle
    } else {
      vectorRisk += 0;  // Zero rain: no fresh surface breeding water
    }

    vectorRisk = Math.min(100, Math.max(10, vectorRisk));

    return res.json({
      success: true,
      city: targetCity,
      coordinates: { latitude: lat, longitude: lon },
      telemetry: {
        temperature_c: temp,
        relative_humidity_pct: humidity,
        rainfall_mm: rainfall
      },
      vector_risk_score: vectorRisk,
      risk_level: vectorRisk >= 75 ? 'High Risk' : vectorRisk >= 45 ? 'Moderate Risk' : 'Low Risk'
    });
  } catch (error) {
    console.error('Weather route error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve weather data.'
    });
  }
});

module.exports = router;
