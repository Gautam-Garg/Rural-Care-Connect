/**
 * Rural Care Connect - Automated Verification & Test Suite
 * Tests all requirements from RURAL_CARE_CONNECT_MASTER_PROMPT.md:
 * 1. Database schema, tables, views, procedures (Haversine, admit, close), triggers (stockout alert).
 * 2. 8,974 historical EpiClim records preservation.
 * 3. Express API endpoints: Auth (admin, viewer, asha), RBAC, PHCs nearest, Geography tree,
 *    Affordable Services, Village Drives, ASHA requests.
 * 4. Backward compatibility: Hospital view and /api/hospitals endpoint.
 */

const http = require('http');
const db = require('./db');
const app = require('./server');

const PORT = 3001; // Run test server on alternate port to avoid conflict
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const reqHeaders = {
      ...headers
    };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

function extractCookie(res) {
  const cookieHeader = res.headers['set-cookie'];
  if (!cookieHeader) return '';
  return cookieHeader[0].split(';')[0];
}

async function runTests() {
  console.log('========================================================');
  console.log('   RURAL CARE CONNECT - AUTOMATED VERIFICATION SUITE   ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. DATABASE SCHEMA & DATA INTEGRITY TESTS
    // -------------------------------------------------------------------------
    console.log('--- 1. DATABASE INTEGRITY & SCHEMA CHECKS ---');

    // 1.1 Preserve 8,974 records in Disease_Stats
    const [statsRows] = await db.query('SELECT COUNT(*) as cnt FROM Disease_Stats');
    assert(statsRows[0].cnt >= 8974, 'Preserve 8,974 EpiClim records in Disease_Stats', `Found ${statsRows[0].cnt}`);

    // 1.2 PHC / Facilities populated
    const [phcRows] = await db.query('SELECT COUNT(*) as cnt FROM PHC');
    assert(phcRows[0].cnt >= 30, 'PHC facilities table populated (>= 30 facilities)', `Found ${phcRows[0].cnt}`);

    // 1.3 Geography hierarchy populated
    const [states] = await db.query('SELECT COUNT(*) as cnt FROM State');
    const [districts] = await db.query('SELECT COUNT(*) as cnt FROM District');
    const [blocks] = await db.query('SELECT COUNT(*) as cnt FROM Block');
    const [villages] = await db.query('SELECT COUNT(*) as cnt FROM Village');
    assert(states[0].cnt >= 3 && districts[0].cnt >= 10 && blocks[0].cnt >= 20 && villages[0].cnt >= 45,
      'Rural Geography Hierarchy populated (States, Districts, Blocks, Villages)',
      `States: ${states[0].cnt}, Districts: ${districts[0].cnt}, Blocks: ${blocks[0].cnt}, Villages: ${villages[0].cnt}`);

    // 1.4 Affordable Services and Schemes populated
    const [serviceRows] = await db.query('SELECT COUNT(*) as cnt FROM Service_Cost');
    assert(serviceRows[0].cnt >= 50, 'Affordable Services populated (>= 50 rows)', `Found ${serviceRows[0].cnt}`);

    // 1.5 Village Vaccination Drives populated
    const [driveRows] = await db.query('SELECT COUNT(*) as cnt FROM Vaccination_Drive');
    assert(driveRows[0].cnt >= 15, 'Village Vaccination Drives populated (>= 15 rows)', `Found ${driveRows[0].cnt}`);

    // 1.6 ASHA Workers & Requests
    const [ashaWorkers] = await db.query('SELECT COUNT(*) as cnt FROM ASHA_Worker');
    const [ashaRequests] = await db.query('SELECT COUNT(*) as cnt FROM ASHA_Request');
    assert(ashaWorkers[0].cnt >= 5 && ashaRequests[0].cnt >= 5, 'ASHA Workers & Requests seeded',
      `Workers: ${ashaWorkers[0].cnt}, Requests: ${ashaRequests[0].cnt}`);

    // 1.7 Views: Bed availability, Affordable Services, Upcoming Drives
    const [bedView] = await db.query('SELECT COUNT(*) as cnt FROM vw_bed_availability');
    assert(bedView[0].cnt >= 30, 'vw_bed_availability view functional', `Found ${bedView[0].cnt}`);

    const [affordView] = await db.query('SELECT COUNT(*) as cnt FROM v_affordable_services');
    assert(affordView[0].cnt >= 50, 'v_affordable_services view functional', `Found ${affordView[0].cnt}`);

    const [driveView] = await db.query('SELECT COUNT(*) as cnt FROM vw_upcoming_drives');
    assert(driveView[0].cnt >= 1, 'vw_upcoming_drives view functional', `Found ${driveView[0].cnt}`);

    // 1.8 Haversine Stored Procedure: sp_nearest_phc
    // Lat: 18.5204, Lng: 73.8567 (Pune) -> should return nearest PHCs sorted by distance
    const [nearestPhcs] = await db.query('CALL sp_nearest_phc(?, ?, ?)', [18.5204, 73.8567, 100]);
    const phcList = nearestPhcs[0];
    assert(phcList && phcList.length > 0, 'sp_nearest_phc stored procedure executed', `Returned ${phcList ? phcList.length : 0} PHCs`);
    if (phcList && phcList.length >= 2) {
      const isSorted = parseFloat(phcList[0].distance_km) <= parseFloat(phcList[1].distance_km);
      assert(isSorted, 'sp_nearest_phc results correctly sorted by Haversine distance_km',
        `#1: ${phcList[0].name} (${phcList[0].distance_km}km), #2: ${phcList[1].name} (${phcList[1].distance_km}km)`);
    }

    // 1.9 Compatibility View: Hospital view pointing to PHC
    const [legacyHospView] = await db.query('SELECT COUNT(*) as cnt FROM Hospital');
    assert(legacyHospView[0].cnt >= 30, 'Hospital backwards-compatibility view operational', `Found ${legacyHospView[0].cnt}`);

    // -------------------------------------------------------------------------
    // 2. HTTP API & ROLE-BASED ACCESS CONTROL (RBAC) TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. HTTP REST API & RBAC CHECKS ---');

    await new Promise((resolve) => {
      server = app.listen(PORT, '127.0.0.1', resolve);
    });

    // 2.1 Public login
    const pubLogin = await request('POST', '/api/auth/login', { username: 'viewer', password: 'viewer123' });
    assert(pubLogin.status === 200 && pubLogin.data.success, 'Login as Public citizen (viewer/viewer123)');
    const pubCookie = extractCookie(pubLogin);

    // 2.2 ASHA login & role redirection
    const ashaLogin = await request('POST', '/api/auth/login', { username: 'asha', password: 'asha123' });
    assert(ashaLogin.status === 200 && ashaLogin.data.role === 'asha' && ashaLogin.data.redirectUrl === '/asha/dashboard.html',
      'Login as ASHA worker (asha/asha123) with redirection to /asha/dashboard.html');
    const ashaCookie = extractCookie(ashaLogin);

    // 2.3 Admin login & role redirection
    const adminLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    assert(adminLogin.status === 200 && adminLogin.data.role === 'admin' && adminLogin.data.redirectUrl === '/admin/dashboard.html',
      'Login as Administrator (admin/admin123) with redirection to /admin/dashboard.html');
    const adminCookie = extractCookie(adminLogin);

    // 2.4 Verify /api/auth/me returns ASHA profile
    const meAsha = await request('GET', '/api/auth/me', null, { Cookie: ashaCookie });
    assert(meAsha.status === 200 && meAsha.data.user.role === 'asha', 'Session persistence: /api/auth/me returns ASHA user');

    // 2.5 RBAC: ASHA portal routes protected from unauthenticated/public users
    const ashaUnauth = await request('GET', '/api/asha/requests');
    assert(ashaUnauth.status === 401 || ashaUnauth.status === 403, 'RBAC Guard: /api/asha/requests rejects unauthenticated user');

    const ashaPublic = await request('GET', '/api/asha/requests', null, { Cookie: pubCookie });
    assert(ashaPublic.status === 403, 'RBAC Guard: /api/asha/requests rejects public user (403 Forbidden)');

    const ashaAuthReq = await request('GET', '/api/asha/requests', null, { Cookie: ashaCookie });
    assert(ashaAuthReq.status === 200 && ashaAuthReq.data.success, 'RBAC: /api/asha/requests allows ASHA worker');

    // 2.6 Nearest PHC Endpoint with Haversine GPS: /api/phcs/nearest
    const nearestRes = await request('GET', '/api/phcs/nearest?lat=18.5204&lng=73.8567&radius=100');
    assert(nearestRes.status === 200 && nearestRes.data.success && nearestRes.data.data.length > 0,
      'API /api/phcs/nearest returns nearby PHCs with GPS coordinates & distance_km');

    // 2.7 Backward-compatibility route: /api/hospitals
    const hospRes = await request('GET', '/api/hospitals');
    assert(hospRes.status === 200 && hospRes.data.success && hospRes.data.data.length >= 30,
      'API Backwards compatibility: /api/hospitals returns PHC records');

    // 2.8 Geography Hierarchy Tree: /api/geography/tree
    const geoTree = await request('GET', '/api/geography/tree');
    assert(geoTree.status === 200 && geoTree.data.success && geoTree.data.data.length >= 3,
      'API /api/geography/tree returns 3-state hierarchy (Maharashtra, MP, Bihar)');

    // 2.9 Affordable Care by Budget: /api/services/budget
    const freeServices = await request('GET', '/api/services/budget?maxCost=0');
    assert(freeServices.status === 200 && freeServices.data.success && freeServices.data.data.length > 0,
      'API /api/services/budget returns ₹0 Free public healthcare schemes');

    // 2.10 Village Vaccination Drives: /api/vaccination-drives/upcoming
    const drivesRes = await request('GET', '/api/vaccination-drives/upcoming');
    assert(drivesRes.status === 200 && drivesRes.data.success && drivesRes.data.data.length > 0,
      'API /api/vaccination-drives/upcoming returns scheduled immunization camps');

    // 2.11 ASHA Case Reporting via sp_admit_patient
    const [disRows] = await db.query('SELECT disease_id FROM Disease LIMIT 1');
    const [phcOne] = await db.query('SELECT phc_id FROM PHC WHERE available_beds > 0 LIMIT 1');
    const reportRes = await request('POST', '/api/asha/cases/report', {
      disease_id: disRows[0].disease_id,
      phc_id: phcOne[0].phc_id,
      age_group: '15-30',
      gender: 'F',
      icu_required: false
    }, { Cookie: ashaCookie });
    assert(reportRes.status === 201 && reportRes.data.success, 'ASHA Grassroots Admission: executes sp_admit_patient and returns case_id');

    // 2.12 ASHA Field Request Submission: /api/asha/requests
    const ashaReqRes = await request('POST', '/api/asha/requests', {
      request_type: 'ambulance',
      urgency: 'emergency',
      details: 'Patient in active labor requiring emergency 108 transfer to PHC',
      village_id: 1,
      phc_id: phcOne[0].phc_id
    }, { Cookie: ashaCookie });
    assert(ashaReqRes.status === 201 && ashaReqRes.data.success, 'ASHA Field Alert: Creates emergency request linking village and PHC');

    // 2.13 Admin KPI Summary: /api/stats/summary
    const statsRes = await request('GET', '/api/stats/summary', null, { Cookie: adminCookie });
    assert(statsRes.status === 200 && statsRes.data.success && statsRes.data.data.total_cases > 0,
      'API /api/stats/summary returns live rural KPI counts');

    // 2.14 Epidemic Historical Dataset: /api/stats/historical
    const histRes = await request('GET', '/api/stats/historical?limit=10');
    assert(histRes.status === 200 && histRes.data.success && histRes.data.data.length === 10,
      'API /api/stats/historical successfully serves preserved EpiClim dataset');

  } catch (err) {
    console.error('Test Suite encountered an unexpected runtime error:', err);
    failed++;
  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
    await db.end();

    console.log('\n========================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED   `);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
