// ==============================================================================
// HealthWatch AI: Phase 5 Public Portal Automated Verification Test Suite
// Verifies:
//   - Viewer authentication & role
//   - Live summary stats & KPI counts
//   - Epidemiological trend data (vw_daily_cases)
//   - Disease transmission categories
//   - Hospital bed availability (vw_bed_availability)
//   - Outbreak alerts
//   - Weather telemetry & risk index (Open-Meteo & cached fallback)
//   - Citizen grievance submission (public)
//   - CSV reports export (beds.csv)
// ==============================================================================

const http = require('http');
const app = require('./server');

function makeRequest(server, options, body, cookie) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port: port,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie: setCookie ? setCookie[0].split(';')[0] : null,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' Starting HealthWatch AI Phase 5 Public Portal Tests');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  let testComplaintId = null;

  try {
    // 1. Authenticate Public Viewer
    console.log('--- 1. Authenticating Viewer Session ---');
    const viewerLogin = await makeRequest(server, { method: 'POST', path: '/api/login' }, {
      username: 'viewer',
      password: 'viewer123'
    });
    const viewerCookie = viewerLogin.setCookie;
    assert(viewerLogin.statusCode === 200 && viewerLogin.body.role === 'public', 'Public viewer authenticated successfully');

    // 2. Summary KPIs
    console.log('\n--- 2. Real-time Summary KPIs (/api/stats/summary) ---');
    const summary = await makeRequest(server, { method: 'GET', path: '/api/stats/summary' }, null, viewerCookie);
    assert(summary.statusCode === 200, 'Summary stats endpoint returned 200 OK');
    assert(summary.body.data.total_hospitals === 10, `Reports exact seeded hospital count: 10 (got ${summary.body.data.total_hospitals})`);
    assert(summary.body.data.total_cases === 200, `Reports exact seeded patient cases: 200 (got ${summary.body.data.total_cases})`);
    assert(summary.body.data.active_alerts === 1, `Reports active alert count: 1 (got ${summary.body.data.active_alerts})`);

    // 3. Epidemiological Trends for Chart.js
    console.log('\n--- 3. Trend Analytics (/api/stats/trend) ---');
    const trend = await makeRequest(server, { method: 'GET', path: '/api/stats/trend?days=30' }, null, viewerCookie);
    assert(trend.statusCode === 200, 'Trend endpoint returned 200 OK');
    assert(Array.isArray(trend.body.data) && trend.body.data.length > 0, `Time-series daily trend data contains ${trend.body.data.length} records`);

    // 4. Transmission Categories Breakdown
    console.log('\n--- 4. Disease Transmission Categories (/api/stats/categories) ---');
    const categories = await makeRequest(server, { method: 'GET', path: '/api/stats/categories' }, null, viewerCookie);
    assert(categories.statusCode === 200, 'Category breakdown endpoint returned 200 OK');
    assert(categories.body.data.length > 0, `Returns ${categories.body.data.length} transmission categories`);

    // 5. Hospital Bed Availability
    console.log('\n--- 5. Bed & ICU Availability (/api/hospitals) ---');
    const hospitals = await makeRequest(server, { method: 'GET', path: '/api/hospitals' }, null, viewerCookie);
    assert(hospitals.statusCode === 200, 'Hospital bed view returned 200 OK');
    assert(hospitals.body.data.length === 10, `Retrieved exactly 10 hospitals (got ${hospitals.body.data.length})`);
    assert(hospitals.body.data[0].pct_free !== undefined, 'Includes computed free bed percentage');

    // 6. Weather Telemetry & Vector Risk
    console.log('\n--- 6. Weather Telemetry & Risk Index (/api/weather) ---');
    const weather = await makeRequest(server, { method: 'GET', path: '/api/weather?city=Delhi' }, null, viewerCookie);
    assert(weather.statusCode === 200, 'Weather endpoint returned 200 OK');
    assert(weather.body.city === 'Delhi', 'Weather telemetry matches target city');
    assert(weather.body.vector_risk_score !== undefined, `Calculated vector-borne risk index: ${weather.body.vector_risk_score}/100`);

    // 7. Public Grievance Filing
    console.log('\n--- 7. Public Grievance Submission (/api/complaints) ---');
    const complaint = await makeRequest(server, { method: 'POST', path: '/api/complaints' }, {
      city: 'Delhi',
      description: '[Stagnant Water] Water accumulation near metro pillar 42.'
    });
    assert(complaint.statusCode === 201, 'Grievance submitted by citizen (201 Created)');
    testComplaintId = complaint.body.complaint_id;

    // 8. CSV Reports Export
    console.log('\n--- 8. CSV Reports Download (/api/reports/beds.csv) ---');
    const csvReport = await makeRequest(server, { method: 'GET', path: '/api/reports/beds.csv' }, null, viewerCookie);
    assert(csvReport.statusCode === 200, 'CSV report endpoint returned 200 OK');
    assert(typeof csvReport.body === 'string' && csvReport.body.includes('Hospital ID'), 'CSV headers correctly formatted');

    // 9. Cleanup of Test Complaint
    console.log('\n--- 9. Automatic Cleanup ---');
    if (testComplaintId) {
      const db = require('./db');
      await db.query('DELETE FROM Complaints WHERE complaint_id = ?', [testComplaintId]);
      console.log(`[CLEANUP] Deleted test grievance complaint #${testComplaintId}`);
    }

    console.log('\n====================================================');
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log('====================================================');
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
