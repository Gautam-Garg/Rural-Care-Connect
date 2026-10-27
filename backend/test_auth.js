// ==============================================================================
// HealthWatch AI: Phase 2 Verification & Test Script
// Verifies:
//  1. Unauthenticated request to /api/me returns 401
//  2. Login with 'viewer' returns role: 'public'
//  3. Public user calling POST /api/hospitals returns 403 Forbidden
//  4. Logout works properly
//  5. Login with 'admin' returns role: 'admin'
//  6. Admin user calling POST /api/hospitals passes authorization
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
      res.on('data', chunk => { data += chunk; });
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
  console.log(' Starting HealthWatch AI Phase 2 Auth & RBAC Tests  ');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));

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

  try {
    // Test 1: GET /api/me without login
    console.log('--- Test 1: Unauthenticated request to /api/me ---');
    const res1 = await makeRequest(server, { method: 'GET', path: '/api/me' });
    assert(res1.statusCode === 401, `Status code is 401 (got ${res1.statusCode})`);
    assert(res1.body.authenticated === false, 'Body reports authenticated: false');

    // Test 2: Login as viewer
    console.log('\n--- Test 2: Login as viewer (viewer/viewer123) ---');
    const res2 = await makeRequest(server, { method: 'POST', path: '/api/login' }, {
      username: 'viewer',
      password: 'viewer123'
    });
    assert(res2.statusCode === 200, `Login status code is 200 (got ${res2.statusCode})`);
    if (res2.statusCode !== 200) console.log('  -> Login failure details:', res2.body);
    assert(res2.body.role === 'public', `Returned role is 'public' (got '${res2.body.role}')`);
    assert(Boolean(res2.setCookie), 'Session cookie received');
    const viewerCookie = res2.setCookie;

    // Test 3: Public user attempts POST /api/hospitals
    console.log('\n--- Test 3: Public user calling POST /api/hospitals (RBAC Check) ---');
    const res3 = await makeRequest(server, { method: 'POST', path: '/api/hospitals' }, {
      name: 'Unauthorized Hospital Test',
      city: 'Delhi',
      state: 'Delhi',
      latitude: 28.6,
      longitude: 77.2,
      total_beds: 100
    }, viewerCookie);
    assert(res3.statusCode === 403, `Public user receives 403 Forbidden on POST /api/hospitals (got ${res3.statusCode})`);
    assert(res3.body.error && res3.body.error.includes('Forbidden'), 'Response body contains Forbidden message');

    // Test 4: Logout
    console.log('\n--- Test 4: Logout viewer session ---');
    const res4 = await makeRequest(server, { method: 'POST', path: '/api/logout' }, null, viewerCookie);
    assert(res4.statusCode === 200, `Logout status code is 200 (got ${res4.statusCode})`);

    // Test 5: Login as admin
    console.log('\n--- Test 5: Login as admin (admin/admin123) ---');
    const res5 = await makeRequest(server, { method: 'POST', path: '/api/login' }, {
      username: 'admin',
      password: 'admin123'
    });
    assert(res5.statusCode === 200, `Login status code is 200 (got ${res5.statusCode})`);
    if (res5.statusCode !== 200) console.log('  -> Login failure details:', res5.body);
    assert(res5.body.role === 'admin', `Returned role is 'admin' (got '${res5.body.role}')`);
    const adminCookie = res5.setCookie;

    // Test 6: Admin user attempts POST /api/hospitals
    console.log('\n--- Test 6: Admin user calling POST /api/hospitals (Authorization Check) ---');
    const res6 = await makeRequest(server, { method: 'POST', path: '/api/hospitals' }, {
      name: 'AIIMS Test Wing',
      city: 'Delhi',
      state: 'Delhi',
      latitude: 28.5672,
      longitude: 77.21,
      total_beds: 150
    }, adminCookie);
    assert(res6.statusCode === 201 || (res6.statusCode !== 401 && res6.statusCode !== 403), 
      `Admin is NOT rejected with 401/403 on POST /api/hospitals (got ${res6.statusCode})`);

    // Automatic Cleanup of Test Data
    if (res6.body && res6.body.hospital_id) {
      await makeRequest(server, { method: 'DELETE', path: `/api/hospitals/${res6.body.hospital_id}` }, null, adminCookie);
      console.log(`[CLEANUP] Deleted test hospital #${res6.body.hospital_id}`);
    }

    console.log('\n====================================================');
    console.log(` Summary: ${passed}/${total} assertions passed`);
    console.log('====================================================');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
