// ==============================================================================
// HealthWatch AI: Phase 3 Automated Verification Test Suite
// Tests Core APIs:
//   - Hospitals (CRUD & Views)
//   - Diseases (CRUD & Thresholds)
//   - Patient Cases (sp_admit_patient transaction & sp_close_case bed release)
//   - Outbreak Alerts (Trigger & manual resolution)
//   - Medicines (Inventory & vw_low_stock view)
//   - Vaccination (Coverage tracking)
//   - Complaints (Public submission & admin review)
//   - Audit Log (Security trail)
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
  console.log(' Starting HealthWatch AI Phase 3 Core API Tests     ');
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

  try {
    // 1. Authenticate Sessions
    console.log('--- 1. Authenticating Demo Sessions ---');
    const viewerLogin = await makeRequest(server, { method: 'POST', path: '/api/login' }, {
      username: 'viewer',
      password: 'viewer123'
    });
    const viewerCookie = viewerLogin.setCookie;
    assert(viewerLogin.statusCode === 200 && viewerLogin.body.role === 'public', 'Viewer authenticated as public');

    const adminLogin = await makeRequest(server, { method: 'POST', path: '/api/login' }, {
      username: 'admin',
      password: 'admin123'
    });
    const adminCookie = adminLogin.setCookie;
    assert(adminLogin.statusCode === 200 && adminLogin.body.role === 'admin', 'Admin authenticated as admin');

    // 2. Diseases API
    console.log('\n--- 2. Disease API Tests ---');
    const getDiseases = await makeRequest(server, { method: 'GET', path: '/api/diseases' }, null, viewerCookie);
    assert(getDiseases.statusCode === 200 && Array.isArray(getDiseases.body.data), 'Public user can read diseases');

    const postDiseaseViewer = await makeRequest(server, { method: 'POST', path: '/api/diseases' }, {
      name: 'Nipah Virus Test',
      category: 'air-borne',
      alert_threshold: 5
    }, viewerCookie);
    assert(postDiseaseViewer.statusCode === 403, 'Public user cannot create disease (403 Forbidden)');

    const postDiseaseAdmin = await makeRequest(server, { method: 'POST', path: '/api/diseases' }, {
      name: `Zika Test ${Date.now()}`,
      category: 'vector-borne',
      alert_threshold: 8
    }, adminCookie);
    assert(postDiseaseAdmin.statusCode === 201, 'Admin can create disease (201 Created)');
    const createdDiseaseId = postDiseaseAdmin.body.disease_id;

    // 3. Hospitals API (vw_bed_availability)
    console.log('\n--- 3. Hospital API Tests ---');
    const getHospitals = await makeRequest(server, { method: 'GET', path: '/api/hospitals?city=Delhi' }, null, viewerCookie);
    assert(getHospitals.statusCode === 200 && getHospitals.body.data.length > 0, 'Hospital search using vw_bed_availability returns data');

    const postHospitalAdmin = await makeRequest(server, { method: 'POST', path: '/api/hospitals' }, {
      name: `Emergency Care Unit ${Date.now()}`,
      city: 'Pune',
      state: 'Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
      total_beds: 50,
      available_beds: 10,
      total_icu: 10,
      available_icu: 2,
      ventilators: 5
    }, adminCookie);
    assert(postHospitalAdmin.statusCode === 201, 'Admin can create hospital facility');
    const createdHospId = postHospitalAdmin.body.hospital_id;

    // 4. Patient Cases (Stored Procedures: sp_admit_patient and sp_close_case)
    console.log('\n--- 4. Patient Cases & Stored Procedures Tests ---');
    // Admit patient
    const admitCase = await makeRequest(server, { method: 'POST', path: '/api/cases' }, {
      disease_id: createdDiseaseId || 1,
      hospital_id: createdHospId,
      age_group: '31-45',
      gender: 'M',
      icu_required: false
    }, adminCookie);
    assert(admitCase.statusCode === 201, 'Patient admitted via sp_admit_patient stored procedure');
    const newCaseId = admitCase.body.case_id;

    // Verify bed decremented in Hospital
    const checkHospAfterAdmit = await makeRequest(server, { method: 'GET', path: `/api/hospitals/${createdHospId}` }, null, adminCookie);
    assert(checkHospAfterAdmit.body.data.available_beds === 9, 'Hospital available_beds decremented from 10 to 9');

    // Close case
    const closeCase = await makeRequest(server, { method: 'PUT', path: `/api/cases/${newCaseId}/close` }, {
      status: 'recovered'
    }, adminCookie);
    assert(closeCase.statusCode === 200, 'Case closed via sp_close_case stored procedure');

    // Verify bed released back
    const checkHospAfterClose = await makeRequest(server, { method: 'GET', path: `/api/hospitals/${createdHospId}` }, null, adminCookie);
    assert(checkHospAfterClose.body.data.available_beds === 10, 'Hospital available_beds restored back to 10');

    // 5. Outbreak Alerts API
    console.log('\n--- 5. Outbreak Alerts API Tests ---');
    const getAlerts = await makeRequest(server, { method: 'GET', path: '/api/alerts' }, null, viewerCookie);
    assert(getAlerts.statusCode === 200, 'Viewer can retrieve alerts list');

    const postAlert = await makeRequest(server, { method: 'POST', path: '/api/alerts' }, {
      disease_id: 1,
      city: 'Pune',
      level: 'warning',
      message: 'Sudden spike in viral fever cases detected in Pune East zone'
    }, adminCookie);
    assert(postAlert.statusCode === 201, 'Admin can manually create outbreak alert');
    const newAlertId = postAlert.body.alert_id;

    const resolveAlert = await makeRequest(server, { method: 'PUT', path: `/api/alerts/${newAlertId}/resolve` }, null, adminCookie);
    assert(resolveAlert.statusCode === 200, 'Admin can resolve an outbreak alert');

    // 6. Medicine Inventory & Low Stock View
    console.log('\n--- 6. Medicine Inventory & vw_low_stock Tests ---');
    const getLowStock = await makeRequest(server, { method: 'GET', path: '/api/medicines/low-stock' }, null, viewerCookie);
    assert(getLowStock.statusCode === 200 && Array.isArray(getLowStock.body.data), 'Query vw_low_stock view returns low stock items');

    const postMed = await makeRequest(server, { method: 'POST', path: '/api/medicines' }, {
      hospital_id: createdHospId,
      name: 'Amoxicillin 500mg',
      stock: 20,
      reorder_level: 50
    }, adminCookie);
    assert(postMed.statusCode === 201, 'Admin can add medicine inventory');

    // 7. Vaccination Tracking
    console.log('\n--- 7. Vaccination Tracking Tests ---');
    const getVaccine = await makeRequest(server, { method: 'GET', path: '/api/vaccination' }, null, viewerCookie);
    assert(getVaccine.statusCode === 200 && getVaccine.body.data.length > 0, 'Vaccination coverage queried with computed percentages');

    const postVaccine = await makeRequest(server, { method: 'POST', path: '/api/vaccination' }, {
      disease_id: 1,
      state: 'Goa',
      doses_given: 120000,
      target_population: 150000
    }, adminCookie);
    assert(postVaccine.statusCode === 201, 'Admin can record vaccination progress');

    // 8. Complaints (Public Submit & Admin Review)
    console.log('\n--- 8. Grievance Complaints Tests ---');
    const postComplaint = await makeRequest(server, { method: 'POST', path: '/api/complaints' }, {
      city: 'Pune',
      description: 'Water accumulation in public park attracting mosquitoes.'
    });
    assert(postComplaint.statusCode === 201, 'Public user can submit health grievance without login');
    const complaintId = postComplaint.body.complaint_id;

    const getComplaintsViewer = await makeRequest(server, { method: 'GET', path: '/api/complaints' }, null, viewerCookie);
    assert(getComplaintsViewer.statusCode === 403, 'Public user cannot view admin complaints list (403 Forbidden)');

    const getComplaintsAdmin = await makeRequest(server, { method: 'GET', path: '/api/complaints' }, null, adminCookie);
    assert(getComplaintsAdmin.statusCode === 200, 'Admin can view and review complaints');

    const updateComplaint = await makeRequest(server, { method: 'PUT', path: `/api/complaints/${complaintId}` }, {
      status: 'reviewed'
    }, adminCookie);
    assert(updateComplaint.statusCode === 200, 'Admin can update complaint status to "reviewed"');

    // 9. Audit Log
    console.log('\n--- 9. Audit Log Tests ---');
    const getAuditViewer = await makeRequest(server, { method: 'GET', path: '/api/audit' }, null, viewerCookie);
    assert(getAuditViewer.statusCode === 403, 'Public user cannot access Audit Log (403 Forbidden)');

    const getAuditAdmin = await makeRequest(server, { method: 'GET', path: '/api/audit' }, null, adminCookie);
    assert(getAuditAdmin.statusCode === 200 && getAuditAdmin.body.data.length > 0, 'Admin can view Audit Log trail');

    // 10. Automatic Cleanup of Test Data
    console.log('\n--- 10. Automatic Cleanup of Test Records ---');
    const db = require('./db');
    if (newCaseId) await db.query('DELETE FROM Patient_Cases WHERE case_id = ?', [newCaseId]);
    if (postMed.body && postMed.body.medicine_id) await db.query('DELETE FROM Medicine WHERE medicine_id = ?', [postMed.body.medicine_id]);
    if (createdHospId) await db.query('DELETE FROM Hospital WHERE hospital_id = ?', [createdHospId]);
    if (createdDiseaseId) await db.query('DELETE FROM Disease WHERE disease_id = ?', [createdDiseaseId]);
    if (newAlertId) await db.query('DELETE FROM Alerts WHERE alert_id = ?', [newAlertId]);
    if (postVaccine.body && postVaccine.body.vaccination_id) await db.query('DELETE FROM Vaccination WHERE vaccination_id = ?', [postVaccine.body.vaccination_id]);
    if (complaintId) await db.query('DELETE FROM Complaints WHERE complaint_id = ?', [complaintId]);
    console.log('[CLEANUP] Successfully cleaned up all test entities created during test_phase3.js.');

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
