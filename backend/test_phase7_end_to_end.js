// Test Phase 7 End-to-End Functionality (Root of backend/)
const http = require('http');
const db = require('./db');

let sessionCookie = '';

function login(username, password) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username, password });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          sessionCookie = cookies[0].split(';')[0];
        }
        let json = {};
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, json, cookie: sessionCookie });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (sessionCookie) headers['Cookie'] = sessionCookie;

    http.get(`http://localhost:3000${urlPath}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- Phase 7 End-to-End Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    const loginRes = await login('viewer', 'viewer123');
    assert(loginRes.status === 200 && sessionCookie, 'Citizen login successful and cookie acquired');

    // 1. Database table verification
    const [statsCount] = await db.query('SELECT COUNT(*) as cnt FROM Disease_Stats');
    assert(statsCount[0].cnt === 8974, `Disease_Stats has 8,974 records (actual: ${statsCount[0].cnt})`);

    const [disRows] = await db.query('SELECT COUNT(DISTINCT disease_name) as disCnt, MIN(year) as minYr, MAX(year) as maxYr FROM Disease_Stats');
    assert(disRows[0].minYr === 2009 && disRows[0].maxYr === 2022, `Year range spans 2009 to 2022 (actual: ${disRows[0].minYr}-${disRows[0].maxYr})`);

    // 2. /api/stats/epiclim-filters
    const fRes = await fetchJson('/api/stats/epiclim-filters');
    assert(fRes.status === 200 && fRes.json.success, '/api/stats/epiclim-filters responds 200');
    assert(fRes.json.data.years.length === 14, `Filters returns 14 years (2022 to 2009)`);
    assert(fRes.json.data.diseases.includes('Dengue'), `Filters includes normalized Dengue`);
    assert(fRes.json.data.diseases.includes('Malaria'), `Filters includes normalized Malaria`);
    assert(fRes.json.data.diseases.includes('Chikungunya'), `Filters includes normalized Chikungunya`);

    // 3. /api/stats/heatmap (cumulative)
    const hmAll = await fetchJson('/api/stats/heatmap?disease=all&year=all');
    assert(hmAll.status === 200 && hmAll.json.success, '/api/stats/heatmap responds 200 for all');
    assert(hmAll.json.summary.total_cases > 700000, `Heatmap cumulative cases > 700k (actual: ${hmAll.json.summary.total_cases})`);
    assert(hmAll.json.data.length > 50, `Heatmap has coordinates for > 50 districts (actual: ${hmAll.json.data.length})`);
    const samplePoint = hmAll.json.data[0];
    assert(samplePoint.lat && samplePoint.lng && samplePoint.cases, `Heatmap point has valid lat, lng, cases`);

    // 4. /api/stats/heatmap (filtered)
    const hmDengue = await fetchJson('/api/stats/heatmap?disease=Dengue&year=2019');
    assert(hmDengue.status === 200 && hmDengue.json.success, '/api/stats/heatmap responds 200 for Dengue 2019');
    assert(hmDengue.json.summary.total_cases > 0, `Dengue 2019 has recorded cases: ${hmDengue.json.summary.total_cases}`);

    // 5. /api/stats/weather-cases (timeline & buckets)
    const wcRes = await fetchJson('/api/stats/weather-cases?disease=Dengue&year=all');
    assert(wcRes.status === 200 && wcRes.json.success, '/api/stats/weather-cases responds 200 for Dengue');
    assert(wcRes.json.buckets && wcRes.json.buckets.length > 0, `Temperature brackets present (${wcRes.json.buckets?.length} brackets)`);
    assert(wcRes.json.timeline[0].avg_temp !== undefined, 'Timeline points contain avg_temp');
    assert(wcRes.json.timeline[0].avg_rain !== undefined, 'Timeline points contain avg_rain');

    console.log(`\nVerification Summary: ${passed} passed, ${failed} failed`);
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    process.exit(failed === 0 ? 0 : 1);
  }
}

runTests();
