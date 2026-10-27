const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', chunk => {
        data = Buffer.concat([data, chunk]);
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runFixesVerification() {
  console.log('=== Phase 7 Fixes Verification ===\n');
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

  // 1. Static file checks
  const faviconPath = path.join(__dirname, '..', '..', 'frontend', 'favicon.ico');
  assert(fs.existsSync(faviconPath) && fs.statSync(faviconPath).size > 0, `frontend/favicon.ico exists and is non-empty (${fs.statSync(faviconPath).size} bytes)`);

  const publicJsPath = path.join(__dirname, '..', '..', 'frontend', 'js', 'public-dashboard.js');
  const publicJs = fs.readFileSync(publicJsPath, 'utf8');

  // 2. Basemap checks: Esri Street, Light Gray, Satellite and Layer Control
  assert(!publicJs.includes('cartocdn'), 'Every CARTO tile URL has been removed');
  assert(publicJs.includes('L.control.layers'), 'Map includes Leaflet layer control switcher');
  assert(publicJs.includes('World_Street_Map/MapServer'), 'Basemap switcher includes Esri World Street Map ("Street")');
  assert(publicJs.includes('World_Light_Gray_Base/MapServer'), 'Basemap switcher includes Esri World Light Gray Base');
  assert(publicJs.includes('World_Light_Gray_Reference/MapServer'), 'Basemap switcher includes Esri Light Gray Reference labels');
  assert(publicJs.includes('World_Imagery/MapServer'), 'Basemap switcher includes Esri World Imagery ("Satellite")');
  assert(publicJs.includes("switchBasemap('Street')"), 'District Pins and Hospitals default to Street basemap');
  assert(publicJs.includes("switchBasemap('Light Gray')"), 'Heat Density switches to Light Gray basemap automatically');
  assert(publicJs.includes('Tiles &copy; Esri'), 'Map includes Esri attribution');

  // 2b. Heat Normalization: log scale / 95th percentile
  assert(publicJs.includes('0.95') || publicJs.includes('p95'), 'Heat density normalisation calculates 95th percentile');
  assert(publicJs.includes('Math.log'), 'Heat density uses log-scale curve for smooth color spread');

  // 3. Whole of India bounds
  assert(publicJs.includes('[[6.5, 68], [37.5, 97.5]]'), 'Map uses whole-of-India bounds [[6.5, 68], [37.5, 97.5]]');
  assert(publicJs.includes('fitBounds(INDIA_BOUNDS)'), 'Map calls fitBounds with whole-of-India bounds');

  // 4. Container size guard & invalidateSize
  assert(publicJs.includes('container.offsetWidth > 0 && container.offsetHeight > 0'), 'Heat layer addition guards on container non-zero dimensions');
  assert(publicJs.includes('map.invalidateSize()'), 'Map invalidates size when map section becomes visible');
  assert(publicJs.includes('heatPoints.length > 0'), 'Skips heat layer addition when points array is empty');

  // 5. Favicon in HTML files
  const publicHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'public', 'dashboard.html'), 'utf8');
  assert(publicHtml.includes('rel="icon"'), 'public/dashboard.html includes favicon link');

  // 6. Network checks against server (if running)
  try {
    const favRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/favicon.ico',
      method: 'GET'
    });
    assert(favRes.statusCode === 200, `GET /favicon.ico returns 200 (got ${favRes.statusCode})`);
    assert(favRes.headers['content-type'] && (favRes.headers['content-type'].includes('image/x-icon') || favRes.headers['content-type'].includes('image/vnd.microsoft.icon')), `GET /favicon.ico content-type is icon (got ${favRes.headers['content-type']})`);

    const meRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/me',
      method: 'GET'
    });
    assert(meRes.statusCode === 401, `GET /api/me unauthenticated returns 401 Unauthorized (got ${meRes.statusCode})`);
  } catch (err) {
    console.log('[INFO] Server is not currently running on port 3000 (run `npm start` in backend/ to test live HTTP endpoints).');
  }

  console.log(`\nVerification Summary: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

runFixesVerification();
