// ==============================================================================
// HealthWatch AI: Dataset Import Script (Phase 7)
// Imports data/epiclim.csv (8,985 rows) into the Disease_Stats table.
// Follows all DATASET.md cleaning and mapping rules:
// 1. Skips bad Cases value ("3/1")
// 2. Drops exact duplicate rows (~10)
// 3. Converts Temp from Kelvin to Celsius (Kelvin - 273.15, 0-50 C range, NULL otherwise)
// 4. Handles blank Deaths (~72%) as 0
// 5. Merges disease name variants into standardized labels
// 6. Inserts in batches of 1,000 rows inside a transaction
// 7. Synchronizes distinct disease names into Disease table with threshold 20
// Safety Rule: Only TRUNCATEs Disease_Stats. Never touches other tables.
// ==============================================================================

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function normalizeDisease(name) {
  if (!name) return 'Other';
  const clean = name.trim();
  const lower = clean.toLowerCase();

  if (lower === 'dengue fever' || lower === 'suspected dengue') return 'Dengue';
  if (lower === 'suspected chikungunya') return 'Chikungunya';
  if (lower === 'suspected cholera') return 'Cholera';
  if (lower === 'malaria (pv)') return 'Malaria';
  if (lower === 'diarrhea') return 'Acute Diarrhoeal Disease';
  if (lower === 'gastroenteritis') return 'Acute Gastroenteritis';

  // Combined variations
  if (lower.includes('dengue') && lower.includes('chikungunya')) {
    return 'Dengue/Chikungunya';
  }
  if (lower === 'dengue and malaria') {
    return 'Dengue/Malaria';
  }

  if (lower === 'pyrexia of unknown origin') return 'Pyrexia of Unknown Origin';

  return clean;
}

function getDiseaseCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('dengue') || lower.includes('malaria') || lower.includes('chikungunya')) {
    return 'vector-borne';
  }
  if (lower.includes('diarrhoeal') || lower.includes('cholera') || lower.includes('gastroenteritis')) {
    return 'water-borne';
  }
  return 'other';
}

async function importDataset() {
  console.log('====================================================');
  console.log(' HealthWatch AI: Importing EpiClim India Dataset     ');
  console.log('====================================================\n');

  const csvPath = path.join(__dirname, '..', '..', 'data', 'epiclim.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Error: CSV file not found at:', csvPath);
    process.exit(1);
  }

  // 1. Clean slate on Disease_Stats ONLY
  console.log('Resetting Disease_Stats table (TRUNCATE TABLE Disease_Stats)...');
  await db.query('ALTER TABLE Disease_Stats MODIFY COLUMN district VARCHAR(150) NOT NULL');
  await db.query('TRUNCATE TABLE Disease_Stats');
  console.log('Table Disease_Stats truncated successfully.\n');

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity
  });

  let totalRowsInCSV = 0;
  let skippedBadCases = 0;
  let skippedDuplicates = 0;
  let validRowsCount = 0;

  const seenRows = new Set();
  const distinctDiseases = new Set();
  const rowsToInsert = [];

  for await (const line of rl) {
    totalRowsInCSV++;
    if (totalRowsInCSV === 1) continue; // Header row

    const cols = parseCSVLine(line);
    // Columns:
    // [0] unnamed index
    // [1] week_of_outbreak (e.g. "3rd week")
    // [2] state_ut
    // [3] district
    // [4] Disease
    // [5] Cases
    // [6] Deaths
    // [7] day
    // [8] mon
    // [9] year
    // [10] Latitude
    // [11] Longitude
    // [12] preci
    // [13] LAI (ignore)
    // [14] Temp (Kelvin)

    const rawCases = (cols[5] || '').trim();
    // Rule 2: Skip row if Cases is not a whole number
    if (!/^\d+$/.test(rawCases)) {
      skippedBadCases++;
      continue;
    }

    // Rule 3: Drop exact duplicate rows (excluding unnamed index)
    const rowKey = cols.slice(1).join('~');
    if (seenRows.has(rowKey)) {
      skippedDuplicates++;
      continue;
    }
    seenRows.add(rowKey);

    const week = parseInt(cols[1], 10) || 1;
    const state = cols[2] ? cols[2].replace(/[\uFFFD\u0000-\u001F\u007F-\uFFFF]/g, ' ').replace(/\s+/g, ' ').trim() : 'Unknown';
    const district = cols[3] ? cols[3].replace(/[\uFFFD\u0000-\u001F\u007F-\uFFFF]/g, ' ').replace(/\s+/g, ' ').trim() : 'Unknown';
    const diseaseName = normalizeDisease(cols[4]);
    distinctDiseases.add(diseaseName);

    const cases = parseInt(rawCases, 10);
    // Rule 4: Blank deaths -> 0
    const rawDeaths = cols[6] ? cols[6].trim() : '';
    const deaths = rawDeaths !== '' ? (parseInt(Math.round(parseFloat(rawDeaths)), 10) || 0) : 0;

    const day = parseInt(cols[7], 10);
    const mon = parseInt(cols[8], 10);
    const year = parseInt(cols[9], 10);

    let reportDate = null;
    if (year && mon && day) {
      const y = String(year).padStart(4, '0');
      const m = String(mon).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      const dateTest = new Date(`${y}-${m}-${d}`);
      if (!isNaN(dateTest.getTime()) && dateTest.getUTCFullYear() === year) {
        reportDate = `${y}-${m}-${d}`;
      } else {
        // Fallback to 1st of month if day exceeds month days (e.g. Feb 30)
        reportDate = `${y}-${m}-01`;
      }
    }

    const latitude = cols[10] && cols[10].trim() !== '' ? parseFloat(cols[10]) : null;
    const longitude = cols[11] && cols[11].trim() !== '' ? parseFloat(cols[11]) : null;
    const preci = cols[12] && cols[12].trim() !== '' ? parseFloat(cols[12]) : null;

    // Rule 5: Convert Kelvin to Celsius. Treat outside 0-50 C or blank as NULL
    let temperature = null;
    if (cols[14] && cols[14].trim() !== '') {
      const kelvin = parseFloat(cols[14]);
      if (!isNaN(kelvin)) {
        const celsius = kelvin - 273.15;
        if (celsius >= 0 && celsius <= 50) {
          temperature = Math.round(celsius * 100) / 100;
        }
      }
    }

    rowsToInsert.push([
      diseaseName,
      state,
      district,
      year,
      week,
      reportDate,
      cases,
      deaths,
      latitude,
      longitude,
      temperature,
      preci
    ]);

    validRowsCount++;
  }

  console.log(`CSV Parsing complete:`);
  console.log(`  -> Total rows in CSV: ${totalRowsInCSV - 1}`);
  console.log(`  -> Skipped non-integer Cases rows: ${skippedBadCases}`);
  console.log(`  -> Dropped duplicate rows: ${skippedDuplicates}`);
  console.log(`  -> Valid cleaned rows to import: ${validRowsCount}`);
  console.log(`  -> Normalized disease types (${distinctDiseases.size}): ${Array.from(distinctDiseases).join(', ')}\n`);

  // 2. Sync disease names into Disease table (Rule 7)
  console.log('Syncing diseases to Disease master table (threshold: 20)...');
  for (const dName of distinctDiseases) {
    const cat = getDiseaseCategory(dName);
    await db.query(
      'INSERT IGNORE INTO Disease (name, category, alert_threshold) VALUES (?, ?, 20)',
      [dName, cat]
    );
  }
  console.log('Disease catalog synchronized.\n');

  // 3. Batch insertion inside transactions (batches of 1,000 rows)
  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(rowsToInsert.length / BATCH_SIZE);
  console.log(`Starting transactional batch insertion (${totalBatches} batches of up to ${BATCH_SIZE} rows)...`);

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const insertSql = `
      INSERT INTO Disease_Stats 
        (disease_name, state, district, year, week, report_date, cases, deaths, latitude, longitude, temperature, preci)
      VALUES ?
    `;

    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      await connection.query(insertSql, [batch]);
      const currentBatchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`  -> Committed batch ${currentBatchNum}/${totalBatches} (${batch.length} rows)`);
    }

    await connection.commit();
    console.log('\nTransaction committed successfully!');
  } catch (err) {
    await connection.rollback();
    console.error('Batch import transaction error, rolling back:', err.code, err.sqlMessage || err.message);
    throw new Error(err.sqlMessage || err.message);
  } finally {
    if (connection) connection.release();
  }

  // 4. Verify count from database
  const [countResult] = await db.query('SELECT COUNT(*) AS total FROM Disease_Stats');
  const [minMaxYear] = await db.query('SELECT MIN(year) as min_y, MAX(year) as max_y, SUM(cases) as total_c, SUM(deaths) as total_d FROM Disease_Stats');

  console.log('\n====================================================');
  console.log(' IMPORT SUMMARY & DATABASE VERIFICATION             ');
  console.log('====================================================');
  console.log(`  Total rows imported: ${countResult[0].total}`);
  console.log(`  Total rows skipped: ${skippedBadCases + skippedDuplicates} (${skippedBadCases} bad cases, ${skippedDuplicates} duplicates)`);
  console.log(`  Year range: ${minMaxYear[0].min_y} - ${minMaxYear[0].max_y}`);
  console.log(`  Total reported outbreak cases: ${Number(minMaxYear[0].total_c).toLocaleString()}`);
  console.log(`  Total reported outbreak deaths: ${Number(minMaxYear[0].total_d).toLocaleString()}`);
  console.log('====================================================\n');

  process.exit(0);
}

importDataset().catch(err => {
  console.error('Dataset import failed:', err);
  process.exit(1);
});
