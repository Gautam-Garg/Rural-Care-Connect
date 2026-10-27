// ==============================================================================
// Rural Care Connect: ASHA Worker Dashboard Controller
// Role: 'asha' & 'admin'
// Manages:
//   - Village case reporting & admission
//   - Transmitting emergency ambulance/medicine requests to linked PHC
//   - Village vaccination roster
//   - Area alert review & symptom triage aid
// ==============================================================================

const AshaState = {
  profile: null,
  dashboard: null,
  diseases: [],
  phcs: []
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard check: ensures user is logged in
  const auth = await API.checkAuth();
  if (!auth) return;

  // 2. Initialize Navigation
  initAshaNavigation();

  // 3. Load Profile & Dashboard Data
  await loadAshaProfile();
  await loadAshaDashboard();
  await loadDiseasesAndPHCs();

  // 4. Setup Form Listeners
  initAshaForms();
  initAshaTriage();
});

function initAshaNavigation() {
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
  const sections = document.querySelectorAll('.portal-section');
  const sidebar = document.getElementById('sidebar');
  const btnToggle = document.getElementById('btn-toggle-sidebar');

  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await API.logout();
      } finally {
        window.location.href = '/login.html';
      }
    });
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-section');
      sections.forEach(s => s.classList.add('d-none'));
      const activeSection = document.getElementById(`section-${targetId}`);
      if (activeSection) {
        activeSection.classList.remove('d-none');
      }

      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      if (sidebar) sidebar.classList.remove('show');
    });
  });
}

async function loadAshaProfile() {
  try {
    const res = await API.getAshaProfile();
    if (res.success && res.data) {
      AshaState.profile = res.data;
      const p = res.data;

      const elName = document.getElementById('asha-worker-name');
      const elArea = document.getElementById('asha-assigned-area');
      const elPhc = document.getElementById('asha-phc-name');
      const elCall = document.getElementById('asha-phc-call');
      const elPop = document.getElementById('kpi-asha-population');
      const elSub = document.getElementById('asha-village-subtitle');

      if (elName) elName.textContent = p.name;
      if (elArea) elArea.textContent = `${p.assigned_area || p.village_name} • ${p.block_name} Block, ${p.district_name}`;
      if (elPhc) elPhc.textContent = `${p.phc_name} (${p.facility_type})`;
      if (elCall && p.phc_phone) elCall.href = `tel:${p.phc_phone.replace(/[^0-9]/g, '')}`;
      if (elPop) elPop.textContent = p.village_population ? p.village_population.toLocaleString() : '4,500';
      if (elSub) elSub.textContent = `Assigned: ${p.village_name} Village (${p.district_name})`;
    }
  } catch (err) {
    console.error('Failed to load ASHA profile:', err);
  }
}

async function loadAshaDashboard() {
  try {
    const res = await API.getAshaDashboard();
    if (res.success) {
      AshaState.dashboard = res;
      const d = res;

      // Update KPIs
      const elCases = document.getElementById('kpi-asha-cases');
      const elDrives = document.getElementById('kpi-asha-drives');
      const elReq = document.getElementById('kpi-asha-pending-req');

      if (elCases) elCases.textContent = d.stats.active_village_cases || 0;
      if (elDrives) elDrives.textContent = d.stats.upcoming_drives_count || 0;
      if (elReq) elReq.textContent = d.requests.filter(r => r.status === 'pending').length;

      // Render alerts
      renderAshaAlerts(d.alerts || []);

      // Render requests
      renderAshaRequests(d.requests || []);

      // Render drives
      renderAshaDrives(d.drives || []);
    }
  } catch (err) {
    console.error('Failed to load ASHA dashboard:', err);
  }
}

function renderAshaAlerts(alerts) {
  const container = document.getElementById('asha-alerts-container');
  if (!container) return;

  if (alerts.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-muted small">No active outbreak alerts in your block.</div>';
    return;
  }

  let html = '';
  alerts.forEach(a => {
    const badgeClass = a.level === 'critical' ? 'bg-danger text-white' : 'bg-warning text-dark';
    html += `
      <div class="p-3 mb-2 border rounded-3 bg-light shadow-sm">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="badge ${badgeClass} text-uppercase">${a.level} Alert</span>
          <span class="badge bg-secondary-subtle text-secondary">${a.area_level || 'District'}: ${a.area_name || a.city}</span>
        </div>
        <div class="fw-bold text-dark small mb-1">${a.message}</div>
        <div class="text-muted" style="font-size: 0.72rem;">Reported: ${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderAshaRequests(requests) {
  const container = document.getElementById('asha-requests-list');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-muted small">No requests submitted yet.</div>';
    return;
  }

  let html = '';
  requests.forEach(r => {
    const statusBadge = r.status === 'pending' ? '<span class="badge bg-warning text-dark">Pending</span>' :
                        r.status === 'in_progress' ? '<span class="badge bg-info text-white">In Progress</span>' :
                        '<span class="badge bg-success">Resolved</span>';
    const urgencyBadge = r.urgency === 'critical' ? 'border-danger' : r.urgency === 'urgent' ? 'border-warning' : '';

    html += `
      <div class="p-3 border rounded-3 bg-white shadow-sm ${urgencyBadge}">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <strong class="text-dark small text-capitalize">${r.request_type.replace('_', ' ')}</strong>
          ${statusBadge}
        </div>
        <p class="small text-muted mb-2">${r.details}</p>
        <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 0.72rem;">
          <span>Target PHC: ${r.phc_name}</span>
          <span>${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderAshaDrives(drives) {
  const container = document.getElementById('asha-drives-grid');
  if (!container) return;

  if (drives.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-4 text-muted small">No drives scheduled in your village this month.</div>';
    return;
  }

  let html = '';
  drives.forEach(d => {
    html += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 p-3 border rounded-3 shadow-sm">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge bg-primary">${d.vaccine}</span>
            <span class="badge bg-success font-monospace">${d.doses_available} Doses</span>
          </div>
          <h4 class="h6 fw-bold mb-1">${d.village_name} Village</h4>
          <div class="small text-muted mb-2">
            <div><i class="bi bi-calendar-event me-1"></i>${d.drive_date.split('T')[0]} • ${d.time}</div>
            <div><i class="bi bi-people me-1"></i>${d.target_group}</div>
          </div>
          <div class="mt-auto pt-2 border-top small text-success fw-bold">
            <i class="bi bi-check-circle-fill me-1"></i> Free UIP Drive
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function loadDiseasesAndPHCs() {
  try {
    const disRes = await API.getDiseases();
    const phcRes = await API.getPHCs();

    if (disRes.success && disRes.data) {
      AshaState.diseases = disRes.data;
      const selDis = document.getElementById('asha-case-disease');
      if (selDis) {
        selDis.innerHTML = '<option value="">Select Disease...</option>';
        disRes.data.forEach(d => {
          selDis.innerHTML += `<option value="${d.disease_id}">${d.name} (${d.category})</option>`;
        });
      }
    }

    if (phcRes.success && phcRes.data) {
      AshaState.phcs = phcRes.data;
      const selPhc = document.getElementById('asha-case-phc');
      if (selPhc) {
        selPhc.innerHTML = '<option value="">Select PHC Facility...</option>';
        phcRes.data.forEach(p => {
          selPhc.innerHTML += `<option value="${p.phc_id}">${p.name} (${p.city}, Beds: ${p.available_beds})</option>`;
        });
        if (AshaState.profile && AshaState.profile.phc_id) {
          selPhc.value = AshaState.profile.phc_id;
        }
      }
    }
  } catch (e) {}
}

function initAshaForms() {
  // Case admission form
  const caseForm = document.getElementById('asha-case-form');
  if (caseForm) {
    caseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const disease_id = document.getElementById('asha-case-disease').value;
      const phc_id = document.getElementById('asha-case-phc').value;
      const age_group = document.getElementById('asha-case-age').value;
      const gender = document.getElementById('asha-case-gender').value;
      const icu_required = document.getElementById('asha-case-icu').checked;
      const village_id = AshaState.profile ? AshaState.profile.village_id : 1;

      try {
        const res = await API.admitPatient({
          disease_id,
          phc_id,
          village_id,
          age_group,
          gender,
          icu_required
        });

        if (res.success) {
          showToast(`Patient admitted successfully (Case #${res.case_id}). PHC bed decremented!`, 'success');
          caseForm.reset();
          await loadAshaDashboard();
        }
      } catch (err) {
        showToast('Admission failed: ' + err.message, 'danger');
      }
    });
  }

  // Request form
  const reqForm = document.getElementById('asha-request-form');
  if (reqForm) {
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const request_type = document.getElementById('asha-req-type').value;
      const urgency = document.getElementById('asha-req-urgency').value;
      const details = document.getElementById('asha-req-details').value.trim();
      const asha_id = AshaState.profile ? AshaState.profile.asha_id : 1;
      const phc_id = AshaState.profile ? AshaState.profile.phc_id : 1;

      try {
        const res = await API.submitAshaRequest({
          asha_id,
          phc_id,
          request_type,
          urgency,
          details
        });

        if (res.success) {
          showToast('Operational request sent directly to PHC Medical Officer.', 'success');
          reqForm.reset();
          await loadAshaDashboard();
        }
      } catch (err) {
        showToast('Failed to send request: ' + err.message, 'danger');
      }
    });
  }
}

function initAshaTriage() {
  const btnTriage = document.getElementById('btn-asha-triage');
  const selTriage = document.getElementById('asha-triage-complaint');
  const outBox = document.getElementById('asha-triage-output');

  if (!btnTriage || !selTriage || !outBox) return;

  btnTriage.addEventListener('click', () => {
    const val = selTriage.value;
    let title = '';
    let action = '';
    let facility = '';

    if (val === 'snakebite') {
      title = 'SNAKEBITE EMERGENCY (सर्पदंश)';
      facility = 'Rush to CHC with Polyvalent Anti-Snake Venom';
      action = 'Strictly IMMOBILIZE bitten limb with splint. Do NOT apply tourniquet or incisions. Reassure patient. Call 108 immediately.';
    } else if (val === 'labor') {
      title = 'ACTIVE MATERNAL LABOR (प्रसव)';
      facility = '24x7 PHC / CHC Delivery Unit';
      action = 'Call 102 (Janani Express). Check ANC card. Prepare mother for institutional delivery under JSY (₹1400 cash incentive).';
    } else if (val === 'fever_severe') {
      title = 'SEVERE SUSPECTED OUTBREAK FEVER (गंभीर बुखार)';
      facility = 'PHC Outpatient Diagnostic Lab';
      action = 'Finger-prick blood smear for Malaria/Dengue. Administer Paracetamol. Monitor for signs of cerebral malaria.';
    } else if (val === 'diarrhea_severe') {
      title = 'DEHYDRATING DIARRHEA (गंभीर दस्त)';
      facility = 'Health Sub-centre OR PHC';
      action = 'Start immediate ORS rehydration (1 packet in 1L water). Provide Zinc tablets 20mg for children for 14 days.';
    } else if (val === 'dog_bite') {
      title = 'ANIMAL BITE / RABIES EXPOSURE (श्वान दंश)';
      facility = 'PHC with Anti-Rabies Vaccine (ARV)';
      action = 'Wash wound under running tap water with soap for 15 minutes. Administer TT injection and Day 0 ARV dose.';
    } else {
      title = 'CHRONIC COUGH > 2 WEEKS (टीबी जांच)';
      facility = 'PHC CBNAAT / Sputum Microscopy Centre';
      action = 'Collect 2 sputum samples. Prescribe cloth mask. Free anti-TB treatment under NTEP upon confirmation.';
    }

    outBox.innerHTML = `
      <div class="fw-bold text-danger mb-1">${title}</div>
      <div class="small fw-bold text-primary mb-2"><i class="bi bi-hospital me-1"></i>Destination: ${facility}</div>
      <div class="alert alert-warning py-2 px-3 small mb-0">
        <strong>Protocol:</strong> ${action}
      </div>
    `;
  });
}
