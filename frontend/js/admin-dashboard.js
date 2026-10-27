// ==============================================================================
// HealthWatch AI: Admin Portal Controller (Phase 6)
// Provides complete administrative control:
// - Real KPI counts from MySQL 8
// - Full CRUD for Hospitals, Cases, Diseases, Alerts, Medicines, Vaccines, Users
// - Stored procedure execution for sp_admit_patient & sp_close_case
// - Deletion confirmations, interactive modals, responsive data tables, audit trail
// ==============================================================================

const AdminState = {
  currentUser: null,
  activeSection: 'overview',
  summary: null,
  hospitals: [],
  services: [],
  villagedrives: [],
  asharequests: [],
  villages: [],
  cases: [],
  diseases: [],
  alerts: [],
  medicines: [],
  vaccination: [],
  complaints: [],
  users: [],
  auditLogs: [],
  deleteTarget: null
};

// Modals instances
let bsModals = {};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Route guard check: require 'admin' role
  const auth = await API.checkAuth('admin');
  if (!auth) return;
  AdminState.currentUser = auth.user;

  if (document.getElementById('admin-username')) {
    document.getElementById('admin-username').textContent = auth.user.username;
  }

  // 2. Initialize Bootstrap Modal instances
  initBootstrapModals();

  // 3. Setup Navigation & Mobile Sidebar
  initNavigation();

  // 4. Initial Data Load
  await refreshAllData();

  // 5. Setup Form Submit Listeners
  initFormSubmissions();

  // 6. Setup Table Search & Filter Handlers
  initFilters();
});

// ==============================================================================
// 1. Modal Instances Initialization
// ==============================================================================
function initBootstrapModals() {
  const modalIds = [
    'admitPatientModal',
    'closeCaseModal',
    'editCaseModal',
    'hospitalModal',
    'serviceModal',
    'villageDriveModal',
    'diseaseModal',
    'alertModal',
    'medicineModal',
    'vaccinationModal',
    'userModal',
    'deleteConfirmModal'
  ];

  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.bootstrap) {
      bsModals[id] = new bootstrap.Modal(el);
    }
  });
}

// ==============================================================================
// 2. Navigation & Sidebar
// ==============================================================================
function initNavigation() {
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
  const sections = document.querySelectorAll('.portal-section');
  const sidebar = document.getElementById('sidebar');
  const btnToggle = document.getElementById('btn-toggle-sidebar');

  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }

  // Logout handler
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

  function activateSection(sectionKey) {
    sidebarLinks.forEach(link => {
      if (link.getAttribute('data-section') === sectionKey) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    sections.forEach(sec => {
      if (sec.id === `section-${sectionKey}`) {
        sec.style.display = 'block';
      } else {
        sec.style.display = 'none';
      }
    });

    AdminState.activeSection = sectionKey;

    // Close mobile drawer on navigation
    if (sidebar && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
    }

    // Lazy load section data if needed
    if (sectionKey === 'hospitals') renderHospitalsTable();
    else if (sectionKey === 'services') renderServicesTable();
    else if (sectionKey === 'villagedrives') renderVillageDrivesTable();
    else if (sectionKey === 'ashareq') renderAshaRequestsTable();
    else if (sectionKey === 'cases') renderCasesTable();
    else if (sectionKey === 'diseases') renderDiseasesTable();
    else if (sectionKey === 'alerts') renderAlertsTable();
    else if (sectionKey === 'medicines') renderMedicinesTable();
    else if (sectionKey === 'vaccination') renderVaccinationTable();
    else if (sectionKey === 'complaints') renderComplaintsTable();
    else if (sectionKey === 'users') renderUsersTable();
    else if (sectionKey === 'audit') renderAuditTable();
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      if (target) {
        history.pushState(null, '', `#section-${target}`);
        activateSection(target);
      }
    });
  });

  // Handle URL hash on initial load
  const hash = window.location.hash.replace('#section-', '');
  if (hash && document.getElementById(`section-${hash}`)) {
    activateSection(hash);
  } else {
    activateSection('overview');
  }

  window.addEventListener('popstate', () => {
    const curHash = window.location.hash.replace('#section-', '') || 'overview';
    if (document.getElementById(`section-${curHash}`)) {
      activateSection(curHash);
    }
  });

  // Dashboard quick-action shortcuts
  document.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-quick-action');
      if (action === 'admit') openAdmitPatientModal();
      else if (action === 'hospital') openHospitalModal('create');
      else if (action === 'service') openServiceModal('create');
      else if (action === 'villagedrive') openVillageDriveModal('create');
      else if (action === 'alert') openAlertModal();
      else if (action === 'medicine') openMedicineModal('create');
      else if (action === 'user') openUserModal('create');
      else if (action === 'vaccination') openVaccinationModal('create');
      else if (action === 'disease') openDiseaseModal('create');
    });
  });
}

// ==============================================================================
// 3. Data Fetching & Sync
// ==============================================================================
async function refreshAllData() {
  await Promise.all([
    loadStatsSummary(),
    loadDiseases(),
    loadHospitals(),
    loadServices(),
    loadVillageDrives(),
    loadAshaRequests(),
    loadVillages(),
    loadCases(),
    loadAlerts(),
    loadMedicines(),
    loadVaccination(),
    loadComplaints(),
    loadUsers(),
    loadAuditLogs(),
    loadFeedbackAdminFlags()
  ]);

  renderOverviewDashboard();
}

async function loadStatsSummary() {
  try {
    const res = await API.getStatsSummary();
    if (res && res.data) {
      AdminState.summary = res.data;
      updateKPICards(res.data);
    }
  } catch (err) {
    console.error('Failed to load stats summary:', err);
  }
}

function updateKPICards(s) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : '--';
  };

  setEl('kpi-admin-hospitals', s.total_hospitals);
  setEl('kpi-admin-cases', s.total_cases.toLocaleString());
  setEl('kpi-admin-activecases', s.active_admissions);
  setEl('kpi-admin-alerts', s.active_alerts);
  setEl('kpi-admin-lowstock', s.low_stock_medicines);
  setEl('kpi-admin-beds', `${s.total_available_beds} / ${s.total_beds}`);
  setEl('kpi-admin-complaints', s.pending_complaints);
  setEl('kpi-admin-users', s.total_users);
}

async function loadDiseases() {
  try {
    const res = await API.getDiseases();
    AdminState.diseases = (res && res.data) ? res.data : [];
    populateDiseaseDropdowns();
  } catch (err) {
    console.error('Error fetching diseases:', err);
  }
}

async function loadHospitals() {
  try {
    const res = await API.getHospitals();
    AdminState.hospitals = (res && res.data) ? res.data : [];
    populateHospitalDropdowns();
  } catch (err) {
    console.error('Error fetching hospitals:', err);
  }
}

async function loadServices() {
  try {
    const res = await API.getServices();
    AdminState.services = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching services:', err);
  }
}

async function loadVillageDrives() {
  try {
    const res = await API.getVaccinationDrives();
    AdminState.villagedrives = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching village drives:', err);
  }
}

async function loadAshaRequests() {
  try {
    const res = await API.getAshaRequests();
    AdminState.asharequests = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching ASHA requests:', err);
  }
}

async function loadVillages() {
  try {
    const res = await API.getVillages();
    AdminState.villages = (res && res.data) ? res.data : [];
    populateVillageDropdowns();
  } catch (err) {
    console.error('Error fetching villages:', err);
  }
}

async function loadCases() {
  try {
    const res = await API.getCases({ limit: 150 });
    AdminState.cases = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching cases:', err);
  }
}

async function loadAlerts() {
  try {
    const res = await API.getAlerts();
    AdminState.alerts = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching alerts:', err);
  }
}

async function loadMedicines() {
  try {
    const res = await API.getMedicines();
    AdminState.medicines = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching medicines:', err);
  }
}

async function loadVaccination() {
  try {
    const res = await API.getVaccination();
    AdminState.vaccination = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching vaccination records:', err);
  }
}

async function loadComplaints() {
  try {
    const res = await API.getComplaints();
    AdminState.complaints = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching complaints:', err);
  }
}

async function loadUsers() {
  try {
    const res = await API.getUsers();
    AdminState.users = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

async function loadAuditLogs() {
  try {
    const res = await API.getAuditLogs({ limit: 100 });
    AdminState.auditLogs = (res && res.data) ? res.data : [];
  } catch (err) {
    console.error('Error fetching audit logs:', err);
  }
}

// ==============================================================================
// 4. Dropdown Populators
// ==============================================================================
function populateDiseaseDropdowns() {
  const selects = [
    document.getElementById('admit-disease-select'),
    document.getElementById('alert-disease-select'),
    document.getElementById('vaccine-disease-select'),
    document.getElementById('case-filter-disease'),
    document.getElementById('alert-filter-disease'),
    document.getElementById('vaccine-filter-disease')
  ];

  selects.forEach(sel => {
    if (!sel) return;
    const isFilter = sel.id.includes('filter');
    const firstOption = isFilter ? '<option value="">All Tracked Diseases</option>' : '<option value="">Select Target Disease...</option>';
    
    sel.innerHTML = firstOption + AdminState.diseases.map(d => 
      `<option value="${d.disease_id}">${d.name} (${d.category})</option>`
    ).join('');
  });
}

function populateHospitalDropdowns() {
  const admitSelect = document.getElementById('admit-hospital-select');
  const medSelect = document.getElementById('med-hospital-select');
  const medFilter = document.getElementById('med-filter-hospital');
  const caseFilter = document.getElementById('case-filter-hospital');
  const servicePhcSelect = document.getElementById('service-phc-select');
  const servicePhcFilter = document.getElementById('service-filter-phc');
  const vdrivePhcSelect = document.getElementById('vdrive-phc-select');

  const hospOptions = AdminState.hospitals.map(h => `<option value="${h.hospital_id}">${h.name} (${h.city})</option>`).join('');

  if (admitSelect) {
    admitSelect.innerHTML = '<option value="">Select Hospital Facility...</option>' + 
      AdminState.hospitals.map(h => 
        `<option value="${h.hospital_id}" data-beds="${h.available_beds}" data-icu="${h.available_icu}">
          ${h.name} — ${h.city} [Beds Avail: ${h.available_beds}, ICU: ${h.available_icu}]
        </option>`
      ).join('');
  }

  if (medSelect) {
    medSelect.innerHTML = '<option value="">Select Hospital Facility...</option>' + hospOptions;
  }

  if (medFilter) {
    medFilter.innerHTML = '<option value="">All Hospital Facilities</option>' + hospOptions;
  }

  if (caseFilter) {
    caseFilter.innerHTML = '<option value="">All Hospital Facilities</option>' + hospOptions;
  }

  if (servicePhcSelect) {
    servicePhcSelect.innerHTML = '<option value="">Select PHC / CHC Facility...</option>' + hospOptions;
  }

  if (servicePhcFilter) {
    servicePhcFilter.innerHTML = '<option value="">All PHC Facilities</option>' + hospOptions;
  }

  if (vdrivePhcSelect) {
    vdrivePhcSelect.innerHTML = '<option value="">Select Supervising PHC...</option>' + hospOptions;
  }
}

function populateVillageDropdowns() {
  const vdriveVillageSelect = document.getElementById('vdrive-village-select');
  if (vdriveVillageSelect) {
    vdriveVillageSelect.innerHTML = '<option value="">Select Target Village...</option>' +
      AdminState.villages.map(v => `<option value="${v.village_id}">${v.village_name} (${v.district_name || v.block_name || ''})</option>`).join('');
  }
}

// ==============================================================================
// 5. Renderers: Overview Dashboard
// ==============================================================================
function renderOverviewDashboard() {
  // 1. Recent admissions snippet (top 6)
  const recentCasesTable = document.getElementById('overview-recent-cases-body');
  if (recentCasesTable) {
    const list = AdminState.cases.slice(0, 6);
    if (list.length === 0) {
      recentCasesTable.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No admissions recorded.</td></tr>`;
    } else {
      recentCasesTable.innerHTML = list.map(c => `
        <tr>
          <td><span class="fw-bold">#${c.case_id}</span></td>
          <td>${c.disease_name}</td>
          <td>${c.hospital_name} <small class="text-muted">(${c.city})</small></td>
          <td>${c.age_group} / ${c.gender}</td>
          <td>${formatStatusBadge(c.status)}</td>
          <td>
            ${c.status === 'admitted' ? `
              <button class="btn btn-outline-primary btn-sm py-0 px-2 fw-medium" onclick="openCloseCaseModal(${c.case_id}, '${escapeHtml(c.disease_name)}', '${escapeHtml(c.hospital_name)}')">
                <i class="bi bi-door-open me-1"></i>Discharge
              </button>
            ` : `<span class="text-muted small">Discharged</span>`}
          </td>
        </tr>
      `).join('');
    }
  }

  // 2. Active alerts snippet (top 4)
  const activeAlertsContainer = document.getElementById('overview-active-alerts-container');
  if (activeAlertsContainer) {
    const activeAlerts = AdminState.alerts.filter(a => a.status === 'active').slice(0, 4);
    if (activeAlerts.length === 0) {
      activeAlertsContainer.innerHTML = `
        <div class="text-center text-muted py-4 small">
          <i class="bi bi-shield-check text-success fs-3 d-block mb-1"></i>
          All epidemiological indicators normal. No active outbreak warnings.
        </div>`;
    } else {
      activeAlertsContainer.innerHTML = activeAlerts.map(a => `
        <div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded border bg-light">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${a.level === 'critical' ? 'bg-danger' : a.level === 'high' ? 'bg-warning text-dark' : 'bg-primary'} text-uppercase font-monospace" style="font-size: 0.65rem;">
              ${a.level}
            </span>
            <div>
              <div class="fw-bold small">${a.disease_name} in ${a.city}</div>
              <div class="text-muted" style="font-size: 0.75rem;">${a.message}</div>
            </div>
          </div>
          <button class="btn btn-outline-success btn-sm py-0 px-2 fw-medium" onclick="resolveAlertDirect(${a.alert_id})">
            <i class="bi bi-check2-circle me-1"></i>Resolve
          </button>
        </div>
      `).join('');
    }
  }

  // 3. Recent Audit Logs snippet (top 5)
  const auditSnippet = document.getElementById('overview-audit-snippet-body');
  if (auditSnippet) {
    const logs = AdminState.auditLogs.slice(0, 5);
    if (logs.length === 0) {
      auditSnippet.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No recent system events.</td></tr>`;
    } else {
      auditSnippet.innerHTML = logs.map(l => `
        <tr>
          <td><span class="font-monospace text-muted small">${formatDateTime(l.logged_at)}</span></td>
          <td>${formatActionBadge(l.action)}</td>
          <td><span class="fw-semibold">${l.table_name}</span></td>
          <td><small class="text-secondary">${escapeHtml(l.details)}</small></td>
        </tr>
      `).join('');
    }
  }
}

// ==============================================================================
// 6. Renderers: Hospitals & Beds Table
// ==============================================================================
function renderHospitalsTable() {
  const tbody = document.getElementById('hospitals-table-body');
  if (!tbody) return;

  const search = (document.getElementById('hospital-search-input')?.value || '').toLowerCase();
  const stateFilter = (document.getElementById('hospital-filter-state')?.value || '').toLowerCase();

  const filtered = AdminState.hospitals.filter(h => {
    const matchSearch = !search || 
      h.name.toLowerCase().includes(search) || 
      h.city.toLowerCase().includes(search) ||
      h.state.toLowerCase().includes(search);
    const matchState = !stateFilter || h.state.toLowerCase() === stateFilter;
    return matchSearch && matchState;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No hospital facilities match your criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const occPct = h.total_beds > 0 ? Math.round(100 - (h.available_beds / h.total_beds * 100)) : 0;
    const occColor = occPct >= 90 ? 'bg-danger' : occPct >= 75 ? 'bg-warning text-dark' : 'bg-success';

    return `
      <tr>
        <td class="fw-bold">#${h.hospital_id}</td>
        <td>
          <div class="fw-bold text-dark">${h.name}</div>
          <small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${h.latitude}, ${h.longitude}</small>
        </td>
        <td>
          <span class="badge bg-light text-dark border">${h.city}, ${h.state}</span>
        </td>
        <td class="fw-semibold">${h.total_beds}</td>
        <td>
          <span class="badge ${h.available_beds > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} fw-bold">
            ${h.available_beds}
          </span>
        </td>
        <td style="min-width: 120px;">
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height: 6px;">
              <div class="progress-bar ${occColor}" role="progressbar" style="width: ${occPct}%;"></div>
            </div>
            <span class="small font-monospace">${occPct}%</span>
          </div>
        </td>
        <td>${h.total_icu}</td>
        <td>
          <span class="badge ${h.available_icu > 0 ? 'bg-primary-subtle text-primary' : 'bg-danger-subtle text-danger'} fw-bold">
            ${h.available_icu}
          </span>
        </td>
        <td>${h.ventilators || 0}</td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-outline-primary btn-action" onclick="openHospitalModal('edit', ${h.hospital_id})" title="Edit facility details & beds">
              <i class="bi bi-pencil-square"></i>Edit
            </button>
            <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteHospital(${h.hospital_id}, '${escapeHtml(h.name)}')" title="Delete hospital facility">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 6B. Renderers: Affordable Services Table
// ==============================================================================
function renderServicesTable() {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;

  const search = (document.getElementById('service-search-input')?.value || '').toLowerCase();
  const catFilter = document.getElementById('service-filter-category')?.value || '';
  const phcFilter = document.getElementById('service-filter-phc')?.value || '';

  const filtered = AdminState.services.filter(s => {
    const matchSearch = !search ||
      s.service_name.toLowerCase().includes(search) ||
      (s.hospital_name && s.hospital_name.toLowerCase().includes(search)) ||
      (s.scheme_name && s.scheme_name.toLowerCase().includes(search));
    const matchCat = !catFilter || s.category === catFilter;
    const matchPhc = !phcFilter || String(s.phc_id) === String(phcFilter);
    return matchSearch && matchCat && matchPhc;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No affordable healthcare services match criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td class="fw-bold">#${s.service_id}</td>
      <td>
        <div class="fw-semibold text-dark">${escapeHtml(s.hospital_name || 'PHC #' + s.phc_id)}</div>
        <small class="text-muted">${s.city || ''}</small>
      </td>
      <td><span class="fw-bold">${escapeHtml(s.service_name)}</span></td>
      <td><span class="badge bg-secondary-subtle text-secondary border font-monospace">${escapeHtml(s.category)}</span></td>
      <td>
        ${s.is_free ? '<span class="badge bg-success-subtle text-success border fw-bold">FREE (₹0)</span>' : `<span class="fw-bold font-monospace">₹${parseFloat(s.cost_inr).toFixed(0)}</span>`}
      </td>
      <td>
        ${s.scheme_name ? `<span class="badge bg-primary-subtle text-primary border">${escapeHtml(s.scheme_name)}</span>` : '<span class="text-muted small">Universal PHC</span>'}
      </td>
      <td><small class="text-muted">${escapeHtml(s.notes || '--')}</small></td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-outline-primary btn-action" onclick="openServiceModal('edit', ${s.service_id})" title="Edit service">
            <i class="bi bi-pencil-square"></i>Edit
          </button>
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteService(${s.service_id}, '${escapeHtml(s.service_name)}')" title="Delete service">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 6C. Renderers: Village Vaccination Drives Table
// ==============================================================================
function renderVillageDrivesTable() {
  const tbody = document.getElementById('villagedrives-table-body');
  if (!tbody) return;

  const search = (document.getElementById('villagedrive-search-input')?.value || '').toLowerCase();

  const filtered = AdminState.villagedrives.filter(v => {
    return !search ||
      v.vaccine_name.toLowerCase().includes(search) ||
      (v.village_name && v.village_name.toLowerCase().includes(search)) ||
      (v.hospital_name && v.hospital_name.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No village vaccination drives found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(v => `
    <tr>
      <td class="fw-bold">#${v.drive_id}</td>
      <td><span class="fw-bold text-primary">${escapeHtml(v.vaccine_name)}</span></td>
      <td>
        <div class="fw-semibold text-dark">${escapeHtml(v.village_name || 'Village #' + v.village_id)}</div>
        <small class="text-muted">${v.district_name || ''}</small>
      </td>
      <td><small class="text-muted">${escapeHtml(v.hospital_name || 'PHC #' + v.phc_id)}</small></td>
      <td>
        <div class="fw-semibold">${formatDate(v.drive_date)}</div>
        <small class="text-muted font-monospace">${v.time_slot || '09:00 - 14:00'}</small>
      </td>
      <td><span class="badge bg-light text-dark border">${escapeHtml(v.target_group || 'All')}</span></td>
      <td>
        <span class="badge ${v.doses_available > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} font-monospace fw-bold">
          ${v.doses_available} doses
        </span>
      </td>
      <td>
        <span class="badge ${v.status === 'completed' ? 'bg-secondary' : v.status === 'scheduled' ? 'bg-success' : 'bg-warning text-dark'} text-capitalize font-monospace">
          ${v.status}
        </span>
      </td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-outline-primary btn-action" onclick="openVillageDriveModal('edit', ${v.drive_id})" title="Edit drive">
            <i class="bi bi-pencil-square"></i>Edit
          </button>
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteVillageDrive(${v.drive_id}, '${escapeHtml(v.vaccine_name)}')" title="Cancel drive">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 6D. Renderers: ASHA Grassroots Field Requests Table
// ==============================================================================
function renderAshaRequestsTable() {
  const tbody = document.getElementById('ashareq-table-body');
  if (!tbody) return;

  if (AdminState.asharequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No pending ASHA field requests.</td></tr>`;
    return;
  }

  tbody.innerHTML = AdminState.asharequests.map(r => `
    <tr>
      <td class="fw-bold">#${r.request_id}</td>
      <td>
        <div class="fw-bold text-dark">${escapeHtml(r.worker_name || 'ASHA #' + r.worker_id)}</div>
        <small class="text-muted"><i class="bi bi-telephone me-1"></i>${r.contact_number || '--'}</small>
      </td>
      <td><span class="badge bg-light text-dark border">${escapeHtml(r.village_name || 'Village #' + r.village_id)}</span></td>
      <td><span class="badge bg-primary-subtle text-primary border font-monospace text-capitalize">${r.request_type}</span></td>
      <td>
        <span class="badge ${r.urgency === 'emergency' ? 'bg-danger text-white' : r.urgency === 'high' ? 'bg-warning text-dark' : 'bg-info-subtle text-info'} text-uppercase font-monospace">
          ${r.urgency}
        </span>
      </td>
      <td class="small" style="max-width: 300px;">${escapeHtml(r.details)}</td>
      <td><small class="text-muted">${escapeHtml(r.hospital_name || 'Linked PHC')}</small></td>
      <td>
        <span class="badge ${r.status === 'resolved' ? 'bg-success' : r.status === 'in_progress' ? 'bg-warning text-dark' : 'bg-secondary'} font-monospace text-capitalize">
          ${r.status}
        </span>
      </td>
      <td>
        <div class="action-btn-group">
          ${r.status === 'pending' ? `
            <button class="btn btn-outline-primary btn-action" onclick="updateAshaRequestStatus(${r.request_id}, 'in_progress')">
              <i class="bi bi-play me-1"></i>Acknowledge
            </button>
          ` : ''}
          ${r.status !== 'resolved' ? `
            <button class="btn btn-outline-success btn-action" onclick="updateAshaRequestStatus(${r.request_id}, 'resolved')">
              <i class="bi bi-check2-circle me-1"></i>Resolve
            </button>
          ` : '<span class="text-success small fw-semibold"><i class="bi bi-check-all me-1"></i>Completed</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 7. Renderers: Patient Cases Table
// ==============================================================================
function renderCasesTable() {
  const tbody = document.getElementById('cases-table-body');
  if (!tbody) return;

  const search = (document.getElementById('case-search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('case-filter-status')?.value || '';
  const diseaseFilter = document.getElementById('case-filter-disease')?.value || '';
  const hospFilter = document.getElementById('case-filter-hospital')?.value || '';

  const filtered = AdminState.cases.filter(c => {
    const matchSearch = !search ||
      c.disease_name.toLowerCase().includes(search) ||
      c.hospital_name.toLowerCase().includes(search) ||
      c.city.toLowerCase().includes(search) ||
      String(c.case_id).includes(search);
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchDisease = !diseaseFilter || String(c.disease_id) === String(diseaseFilter);
    const matchHosp = !hospFilter || String(c.hospital_id) === String(hospFilter);

    return matchSearch && matchStatus && matchDisease && matchHosp;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No patient admissions found matching filter parameters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td class="fw-bold">#${c.case_id}</td>
      <td>
        <div class="fw-bold text-dark">${c.disease_name}</div>
        <small class="text-muted">${c.disease_category || ''}</small>
      </td>
      <td>
        <div>${c.hospital_name}</div>
        <small class="text-muted">${c.city}, ${c.state}</small>
      </td>
      <td>
        <span class="badge bg-light text-secondary border font-monospace">
          ${c.age_group} (${c.gender})
        </span>
      </td>
      <td>
        ${c.icu_required ? `
          <span class="badge bg-danger-subtle text-danger fw-bold"><i class="bi bi-heart-pulse-fill me-1"></i>ICU</span>
        ` : `
          <span class="badge bg-light text-muted border">General</span>
        `}
      </td>
      <td>${formatStatusBadge(c.status)}</td>
      <td><small class="font-monospace text-muted">${formatDate(c.admitted_on)}</small></td>
      <td><small class="font-monospace text-muted">${c.closed_on ? formatDate(c.closed_on) : '--'}</small></td>
      <td>
        <div class="action-btn-group">
          ${c.status === 'admitted' ? `
            <button class="btn btn-outline-success btn-action" onclick="openCloseCaseModal(${c.case_id}, '${escapeHtml(c.disease_name)}', '${escapeHtml(c.hospital_name)}')" title="Discharge patient and release bed via sp_close_case">
              <i class="bi bi-door-open"></i>Discharge
            </button>
          ` : ''}
          <button class="btn btn-outline-primary btn-action" onclick="openEditCaseModal(${c.case_id})" title="Edit case attributes">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteCase(${c.case_id})" title="Delete patient case record">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 8. Renderers: Disease Catalog Table
// ==============================================================================
function renderDiseasesTable() {
  const tbody = document.getElementById('diseases-table-body');
  if (!tbody) return;

  const search = (document.getElementById('disease-search-input')?.value || '').toLowerCase();
  const catFilter = document.getElementById('disease-filter-category')?.value || '';

  const filtered = AdminState.diseases.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search);
    const matchCat = !catFilter || d.category === catFilter;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No diseases found matching filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td class="fw-bold">#${d.disease_id}</td>
      <td class="fw-bold text-dark">${d.name}</td>
      <td>${formatCategoryBadge(d.category)}</td>
      <td>
        <span class="badge bg-danger-subtle text-danger font-monospace px-2 py-1">
          <i class="bi bi-bell-fill me-1"></i>${d.alert_threshold} cases / 7 days
        </span>
      </td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-outline-primary btn-action" onclick="openDiseaseModal('edit', ${d.disease_id})">
            <i class="bi bi-pencil-square"></i>Edit
          </button>
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteDisease(${d.disease_id}, '${escapeHtml(d.name)}')">
            <i class="bi bi-trash3"></i>Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 9. Renderers: Outbreak Alerts Table
// ==============================================================================
function renderAlertsTable() {
  const tbody = document.getElementById('alerts-table-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('alert-filter-status')?.value || '';
  const levelFilter = document.getElementById('alert-filter-level')?.value || '';
  const diseaseFilter = document.getElementById('alert-filter-disease')?.value || '';

  const filtered = AdminState.alerts.filter(a => {
    const matchStatus = !statusFilter || a.status === statusFilter;
    const matchLevel = !levelFilter || a.level === levelFilter;
    const matchDisease = !diseaseFilter || String(a.disease_id) === String(diseaseFilter);
    return matchStatus && matchLevel && matchDisease;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No outbreak alerts match current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td class="fw-bold">#${a.alert_id}</td>
      <td class="fw-bold">${a.disease_name}</td>
      <td><span class="badge bg-light text-dark border">${a.city}</span></td>
      <td>${formatAlertLevelBadge(a.level)}</td>
      <td class="text-secondary small" style="max-width: 320px;">${escapeHtml(a.message)}</td>
      <td>
        <span class="badge ${a.status === 'active' ? 'bg-danger text-white' : 'bg-secondary text-white'}">
          ${a.status.toUpperCase()}
        </span>
      </td>
      <td><small class="font-monospace text-muted">${formatDateTime(a.created_at)}</small></td>
      <td>
        <div class="action-btn-group">
          ${a.status === 'active' ? `
            <button class="btn btn-outline-success btn-action" onclick="resolveAlertDirect(${a.alert_id})" title="Mark alert as resolved">
              <i class="bi bi-check-circle"></i>Resolve
            </button>
          ` : ''}
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteAlert(${a.alert_id})" title="Delete alert">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 10. Renderers: Pharmacy Inventory Table
// ==============================================================================
function renderMedicinesTable() {
  const tbody = document.getElementById('medicines-table-body');
  if (!tbody) return;

  const search = (document.getElementById('med-search-input')?.value || '').toLowerCase();
  const hospFilter = document.getElementById('med-filter-hospital')?.value || '';
  const lowStockOnly = document.getElementById('med-filter-lowstock')?.checked;

  const filtered = AdminState.medicines.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search) || (m.hospital_name && m.hospital_name.toLowerCase().includes(search));
    const matchHosp = !hospFilter || String(m.hospital_id) === String(hospFilter);
    const matchLowStock = !lowStockOnly || (m.stock <= m.reorder_level);
    return matchSearch && matchHosp && matchLowStock;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No pharmacy items found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const isLow = m.stock <= m.reorder_level;
    return `
      <tr class="${isLow ? 'table-warning-subtle' : ''}">
        <td class="fw-bold">#${m.medicine_id}</td>
        <td>
          <div class="fw-bold text-dark">${m.name}</div>
        </td>
        <td>
          <div>${m.hospital_name || '--'}</div>
          <small class="text-muted">${m.city || ''}</small>
        </td>
        <td>
          <span class="badge ${isLow ? 'bg-danger text-white' : 'bg-success-subtle text-success'} font-monospace fs-6 px-2">
            ${m.stock}
          </span>
        </td>
        <td class="font-monospace">${m.reorder_level}</td>
        <td>
          ${isLow ? `
            <span class="badge bg-danger-subtle text-danger border border-danger-subtle">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>Deficit: ${m.reorder_level - m.stock}
            </span>
          ` : `
            <span class="badge bg-success-subtle text-success border border-success-subtle">
              <i class="bi bi-check-circle me-1"></i>Stock Adequate
            </span>
          `}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-outline-primary btn-action" onclick="openMedicineModal('edit', ${m.medicine_id})">
              <i class="bi bi-pencil-square"></i>Edit Stock
            </button>
            <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteMedicine(${m.medicine_id}, '${escapeHtml(m.name)}')">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 11. Renderers: Vaccination Drives Table
// ==============================================================================
function renderVaccinationTable() {
  const tbody = document.getElementById('vaccination-table-body');
  if (!tbody) return;

  const stateFilter = (document.getElementById('vaccine-filter-state')?.value || '').toLowerCase();
  const diseaseFilter = document.getElementById('vaccine-filter-disease')?.value || '';

  const filtered = AdminState.vaccination.filter(v => {
    const matchState = !stateFilter || v.state.toLowerCase() === stateFilter;
    const matchDisease = !diseaseFilter || String(v.disease_id) === String(diseaseFilter);
    return matchState && matchDisease;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No vaccination drive records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const pct = v.coverage_pct !== null && v.coverage_pct !== undefined ? v.coverage_pct : 
      (v.target_population > 0 ? Math.round((v.doses_given / v.target_population) * 100) : 0);
    const barClass = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning text-dark';

    return `
      <tr>
        <td class="fw-bold">#${v.vaccination_id}</td>
        <td class="fw-bold">${v.disease_name}</td>
        <td><span class="badge bg-light text-dark border">${v.state}</span></td>
        <td class="font-monospace fw-semibold">${Number(v.doses_given).toLocaleString()}</td>
        <td class="font-monospace text-muted">${Number(v.target_population).toLocaleString()}</td>
        <td style="min-width: 140px;">
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height: 6px;">
              <div class="progress-bar ${barClass}" style="width: ${Math.min(100, pct)}%;"></div>
            </div>
            <span class="small font-monospace fw-bold">${pct}%</span>
          </div>
        </td>
        <td><small class="font-monospace text-muted">${formatDate(v.record_date)}</small></td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-outline-primary btn-action" onclick="openVaccinationModal('edit', ${v.vaccination_id})">
              <i class="bi bi-pencil-square"></i>Edit
            </button>
            <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteVaccination(${v.vaccination_id}, '${escapeHtml(v.state)}')">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 12. Renderers: Review Complaints Table
// ==============================================================================
function renderComplaintsTable() {
  const tbody = document.getElementById('complaints-table-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('complaint-filter-status')?.value || '';

  const filtered = AdminState.complaints.filter(c => {
    return !statusFilter || c.status === statusFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No citizen grievances found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td class="fw-bold">#${c.complaint_id}</td>
      <td><span class="badge bg-light text-dark border">${c.city || 'Unspecified'}</span></td>
      <td class="small" style="max-width: 380px;">${escapeHtml(c.description)}</td>
      <td>${formatComplaintStatusBadge(c.status)}</td>
      <td><small class="font-monospace text-muted">${formatDateTime(c.created_at)}</small></td>
      <td>
        <div class="action-btn-group">
          ${c.status === 'new' ? `
            <button class="btn btn-outline-primary btn-action" onclick="updateComplaintStatus(${c.complaint_id}, 'reviewed')">
              <i class="bi bi-eye me-1"></i>Review
            </button>
          ` : ''}
          ${c.status !== 'closed' ? `
            <button class="btn btn-outline-success btn-action" onclick="updateComplaintStatus(${c.complaint_id}, 'closed')">
              <i class="bi bi-check2-circle me-1"></i>Close
            </button>
          ` : ''}
          <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteComplaint(${c.complaint_id})">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==============================================================================
// 13. Renderers: User Management Table
// ==============================================================================
function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  const roleFilter = document.getElementById('user-filter-role')?.value || '';

  const filtered = AdminState.users.filter(u => {
    return !roleFilter || u.role === roleFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No user accounts found matching filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isSelf = AdminState.currentUser && AdminState.currentUser.user_id === u.user_id;

    return `
      <tr>
        <td class="fw-bold">#${u.user_id}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-person-circle fs-5 text-secondary"></i>
            <span class="fw-bold text-dark">${escapeHtml(u.username)}</span>
            ${isSelf ? '<span class="badge bg-info-subtle text-info border font-monospace ms-1">Current Session</span>' : ''}
          </div>
        </td>
        <td>
          <span class="badge ${u.role === 'admin' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'} text-uppercase font-monospace px-2 py-1">
            <i class="bi ${u.role === 'admin' ? 'bi-shield-lock-fill' : 'bi-person-check'} me-1"></i>${u.role}
          </span>
        </td>
        <td><small class="font-monospace text-muted">${formatDateTime(u.created_at)}</small></td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-outline-primary btn-action" onclick="openUserModal('edit', ${u.user_id})">
              <i class="bi bi-pencil-square"></i>Edit
            </button>
            <button class="btn btn-outline-danger btn-action" onclick="confirmDeleteUser(${u.user_id}, '${escapeHtml(u.username)}')" ${isSelf ? 'disabled title="Cannot delete active account"' : ''}>
              <i class="bi bi-trash3"></i>Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 14. Renderers: Audit Log Table
// ==============================================================================
function renderAuditTable() {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  const actionFilter = document.getElementById('audit-filter-action')?.value || '';
  const search = (document.getElementById('audit-search-input')?.value || '').toLowerCase();

  const filtered = AdminState.auditLogs.filter(l => {
    const matchAction = !actionFilter || l.action === actionFilter;
    const matchSearch = !search ||
      l.table_name.toLowerCase().includes(search) ||
      (l.username && l.username.toLowerCase().includes(search)) ||
      (l.details && l.details.toLowerCase().includes(search));
    return matchAction && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No audit logs match criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td class="fw-bold font-monospace">#${l.log_id}</td>
      <td>
        <span class="fw-semibold text-dark">${l.username || 'System/Public'}</span>
        ${l.user_role ? `<span class="badge bg-light text-muted border font-monospace ms-1" style="font-size: 0.65rem;">${l.user_role}</span>` : ''}
      </td>
      <td>${formatActionBadge(l.action)}</td>
      <td><span class="badge bg-secondary-subtle text-secondary font-monospace">${l.table_name}</span></td>
      <td class="font-monospace text-muted">#${l.record_id || '--'}</td>
      <td class="small text-secondary" style="max-width: 320px;">${escapeHtml(l.details)}</td>
      <td><small class="font-monospace text-muted">${formatDateTime(l.logged_at)}</small></td>
    </tr>
  `).join('');
}

// ==============================================================================
// 15. Form Modals Openers & Populate
// ==============================================================================

// --- Admit Patient Modal (sp_admit_patient) ---
function openAdmitPatientModal() {
  const form = document.getElementById('admit-patient-form');
  if (form) form.reset();

  const errBox = document.getElementById('admit-error-box');
  if (errBox) errBox.classList.add('d-none');

  populateDiseaseDropdowns();
  populateHospitalDropdowns();

  if (bsModals['admitPatientModal']) {
    bsModals['admitPatientModal'].show();
  }
}

// --- Discharge / Close Case Modal (sp_close_case) ---
function openCloseCaseModal(caseId, diseaseName, hospName) {
  document.getElementById('close-case-id').value = caseId;
  document.getElementById('close-case-summary').textContent = `Case #${caseId} — ${diseaseName} at ${hospName}`;
  document.getElementById('close-case-status').value = 'recovered';

  const errBox = document.getElementById('close-case-error-box');
  if (errBox) errBox.classList.add('d-none');

  if (bsModals['closeCaseModal']) {
    bsModals['closeCaseModal'].show();
  }
}

// --- Edit Case Modal ---
function openEditCaseModal(caseId) {
  const item = AdminState.cases.find(c => c.case_id === caseId);
  if (!item) return;

  document.getElementById('edit-case-id').value = item.case_id;
  document.getElementById('edit-case-info').textContent = `Case #${item.case_id} — ${item.disease_name} (${item.hospital_name})`;
  document.getElementById('edit-case-age').value = item.age_group;
  document.getElementById('edit-case-gender').value = item.gender;
  document.getElementById('edit-case-icu').checked = Boolean(item.icu_required);
  document.getElementById('edit-case-status').value = item.status;

  if (bsModals['editCaseModal']) {
    bsModals['editCaseModal'].show();
  }
}

// --- Hospital / PHC Modal (Add / Edit) ---
function openHospitalModal(mode, id = null) {
  const form = document.getElementById('hospital-form');
  if (form) form.reset();

  const title = document.getElementById('hospital-modal-title');
  const idInput = document.getElementById('hospital-modal-id');

  if (mode === 'edit' && id) {
    const item = AdminState.hospitals.find(h => h.hospital_id === id);
    if (!item) return;
    title.textContent = `Edit PHC / Facility: ${item.name}`;
    idInput.value = item.hospital_id;
    document.getElementById('hosp-name').value = item.name;
    if (document.getElementById('hosp-facility-type')) document.getElementById('hosp-facility-type').value = item.facility_type || 'PHC';
    if (document.getElementById('hosp-hours')) document.getElementById('hosp-hours').value = item.operating_hours || '24x7';
    if (document.getElementById('hosp-phone')) document.getElementById('hosp-phone').value = item.contact_phone || '';
    document.getElementById('hosp-city').value = item.city;
    document.getElementById('hosp-state').value = item.state;
    document.getElementById('hosp-lat').value = item.latitude;
    document.getElementById('hosp-lng').value = item.longitude;
    document.getElementById('hosp-total-beds').value = item.total_beds;
    document.getElementById('hosp-avail-beds').value = item.available_beds;
    document.getElementById('hosp-total-icu').value = item.total_icu;
    document.getElementById('hosp-avail-icu').value = item.available_icu;
    document.getElementById('hosp-ventilators').value = item.ventilators || 0;
    if (document.getElementById('hosp-doctor')) document.getElementById('hosp-doctor').checked = Boolean(item.doctor_on_duty);
    if (document.getElementById('hosp-ambulance')) document.getElementById('hosp-ambulance').checked = Boolean(item.ambulance_available);
  } else {
    title.textContent = 'Add New PHC / Health Centre Facility';
    idInput.value = '';
    if (document.getElementById('hosp-facility-type')) document.getElementById('hosp-facility-type').value = 'PHC';
    if (document.getElementById('hosp-hours')) document.getElementById('hosp-hours').value = '24x7';
    if (document.getElementById('hosp-doctor')) document.getElementById('hosp-doctor').checked = true;
    if (document.getElementById('hosp-ambulance')) document.getElementById('hosp-ambulance').checked = true;
  }

  if (bsModals['hospitalModal']) {
    bsModals['hospitalModal'].show();
  }
}

// --- Service Modal (Add / Edit) ---
function openServiceModal(mode, id = null) {
  const form = document.getElementById('service-form');
  if (form) form.reset();
  populateHospitalDropdowns();

  const title = document.getElementById('service-modal-title');
  const idInput = document.getElementById('service-modal-id');

  if (mode === 'edit' && id) {
    const item = AdminState.services.find(s => s.service_id === id);
    if (!item) return;
    title.textContent = `Edit Service: ${item.service_name}`;
    idInput.value = item.service_id;
    document.getElementById('service-name').value = item.service_name;
    document.getElementById('service-phc-select').value = item.phc_id;
    document.getElementById('service-category').value = item.category;
    document.getElementById('service-cost').value = item.cost_inr;
    document.getElementById('service-is-free').checked = Boolean(item.is_free);
    document.getElementById('service-scheme').value = item.scheme_name || '';
    document.getElementById('service-notes').value = item.notes || '';
  } else {
    title.textContent = 'Add Affordable Service / Scheme';
    idInput.value = '';
    document.getElementById('service-cost').value = '0';
    document.getElementById('service-is-free').checked = true;
  }

  if (bsModals['serviceModal']) {
    bsModals['serviceModal'].show();
  }
}

// --- Village Drive Modal (Add / Edit) ---
function openVillageDriveModal(mode, id = null) {
  const form = document.getElementById('village-drive-form');
  if (form) form.reset();
  populateHospitalDropdowns();
  populateVillageDropdowns();

  const title = document.getElementById('vdrive-modal-title');
  const idInput = document.getElementById('vdrive-modal-id');

  if (mode === 'edit' && id) {
    const item = AdminState.villagedrives.find(v => v.drive_id === id);
    if (!item) return;
    title.textContent = `Edit Vaccination Drive: ${item.vaccine_name}`;
    idInput.value = item.drive_id;
    document.getElementById('vdrive-phc-select').value = item.phc_id;
    document.getElementById('vdrive-village-select').value = item.village_id;
    document.getElementById('vdrive-vaccine').value = item.vaccine_name;
    document.getElementById('vdrive-date').value = item.drive_date ? item.drive_date.substring(0, 10) : '';
    document.getElementById('vdrive-time').value = item.time_slot || '09:00 AM - 02:00 PM';
    document.getElementById('vdrive-target').value = item.target_group || '';
    document.getElementById('vdrive-doses').value = item.doses_available || 100;
  } else {
    title.textContent = 'Schedule Village Vaccination Drive';
    idInput.value = '';
    document.getElementById('vdrive-time').value = '09:00 AM - 02:00 PM';
    document.getElementById('vdrive-target').value = 'Infants & Children';
    document.getElementById('vdrive-doses').value = 100;
  }

  if (bsModals['villageDriveModal']) {
    bsModals['villageDriveModal'].show();
  }
}

// --- Disease Modal (Add / Edit) ---
function openDiseaseModal(mode, id = null) {
  const form = document.getElementById('disease-form');
  if (form) form.reset();

  const title = document.getElementById('disease-modal-title');
  const idInput = document.getElementById('disease-modal-id');

  if (mode === 'edit' && id) {
    const item = AdminState.diseases.find(d => d.disease_id === id);
    if (!item) return;
    title.textContent = `Edit Disease: ${item.name}`;
    idInput.value = item.disease_id;
    document.getElementById('disease-name').value = item.name;
    document.getElementById('disease-category').value = item.category;
    document.getElementById('disease-threshold').value = item.alert_threshold;
  } else {
    title.textContent = 'Add New Disease to Catalog';
    idInput.value = '';
    document.getElementById('disease-threshold').value = 20;
  }

  if (bsModals['diseaseModal']) {
    bsModals['diseaseModal'].show();
  }
}

// --- Alert Modal (Create) ---
function openAlertModal() {
  const form = document.getElementById('alert-form');
  if (form) form.reset();
  populateDiseaseDropdowns();

  if (bsModals['alertModal']) {
    bsModals['alertModal'].show();
  }
}

// --- Medicine Modal (Add / Edit) ---
function openMedicineModal(mode, id = null) {
  const form = document.getElementById('medicine-form');
  if (form) form.reset();

  const title = document.getElementById('medicine-modal-title');
  const idInput = document.getElementById('medicine-modal-id');
  populateHospitalDropdowns();

  if (mode === 'edit' && id) {
    const item = AdminState.medicines.find(m => m.medicine_id === id);
    if (!item) return;
    title.textContent = `Edit Medicine: ${item.name}`;
    idInput.value = item.medicine_id;
    document.getElementById('med-hospital-select').value = item.hospital_id;
    document.getElementById('med-hospital-select').disabled = true; // hospital fixed on edit
    document.getElementById('med-name').value = item.name;
    document.getElementById('med-stock').value = item.stock;
    document.getElementById('med-reorder').value = item.reorder_level;
  } else {
    title.textContent = 'Add Medicine to Hospital Inventory';
    idInput.value = '';
    document.getElementById('med-hospital-select').disabled = false;
  }

  if (bsModals['medicineModal']) {
    bsModals['medicineModal'].show();
  }
}

// --- Vaccination Modal (Add / Edit) ---
function openVaccinationModal(mode, id = null) {
  const form = document.getElementById('vaccination-form');
  if (form) form.reset();

  const title = document.getElementById('vaccination-modal-title');
  const idInput = document.getElementById('vaccination-modal-id');
  populateDiseaseDropdowns();

  if (mode === 'edit' && id) {
    const item = AdminState.vaccination.find(v => v.vaccination_id === id);
    if (!item) return;
    title.textContent = `Edit Vaccination Drive: ${item.state}`;
    idInput.value = item.vaccination_id;
    document.getElementById('vaccine-disease-select').value = item.disease_id;
    document.getElementById('vaccine-state').value = item.state;
    document.getElementById('vaccine-doses').value = item.doses_given;
    document.getElementById('vaccine-target').value = item.target_population;
    document.getElementById('vaccine-date').value = item.record_date ? item.record_date.split('T')[0] : '';
  } else {
    title.textContent = 'Record Vaccination Drive Progress';
    idInput.value = '';
    document.getElementById('vaccine-date').value = new Date().toISOString().split('T')[0];
  }

  if (bsModals['vaccinationModal']) {
    bsModals['vaccinationModal'].show();
  }
}

// --- User Modal (Add / Edit) ---
function openUserModal(mode, id = null) {
  const form = document.getElementById('user-form');
  if (form) form.reset();

  const title = document.getElementById('user-modal-title');
  const idInput = document.getElementById('user-modal-id');
  const pwdHelp = document.getElementById('user-password-help');
  const pwdInput = document.getElementById('user-password');

  if (mode === 'edit' && id) {
    const item = AdminState.users.find(u => u.user_id === id);
    if (!item) return;
    title.textContent = `Edit User Account: ${item.username}`;
    idInput.value = item.user_id;
    document.getElementById('user-username').value = item.username;
    document.getElementById('user-role').value = item.role;
    pwdInput.removeAttribute('required');
    if (pwdHelp) pwdHelp.textContent = 'Leave password blank to retain existing password.';
  } else {
    title.textContent = 'Create New System User Account';
    idInput.value = '';
    pwdInput.setAttribute('required', 'required');
    if (pwdHelp) pwdHelp.textContent = 'Password must be provided for new accounts.';
  }

  if (bsModals['userModal']) {
    bsModals['userModal'].show();
  }
}

// ==============================================================================
// 16. Form Submissions Handlers
// ==============================================================================
function initFormSubmissions() {
  // 1. Admit Patient Form (Stored Procedure)
  const admitForm = document.getElementById('admit-patient-form');
  if (admitForm) {
    admitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('admit-error-box');
      if (errBox) errBox.classList.add('d-none');

      const disease_id = document.getElementById('admit-disease-select').value;
      const hospital_id = document.getElementById('admit-hospital-select').value;
      const age_group = document.getElementById('admit-age-group').value;
      const gender = document.getElementById('admit-gender').value;
      const icu_required = document.getElementById('admit-icu').checked;

      if (!disease_id || !hospital_id || !age_group || !gender) {
        showToast('Please fill all required admission fields.', 'warning');
        return;
      }

      const submitBtn = admitForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Executing sp_admit_patient...';

      try {
        const res = await API.admitPatient({
          disease_id: parseInt(disease_id, 10),
          hospital_id: parseInt(hospital_id, 10),
          age_group,
          gender,
          icu_required
        });

        if (res && res.success) {
          showToast(`Admission #${res.case_id} successful! Stored procedure atomic transaction committed.`, 'success');
          if (bsModals['admitPatientModal']) bsModals['admitPatientModal'].hide();
          await refreshAllData();
          renderCasesTable();
        }
      } catch (err) {
        console.error('Admission failed:', err);
        const msg = err.data && err.data.error ? err.data.error : err.message;
        if (errBox) {
          errBox.textContent = `Stored Procedure Error: ${msg}`;
          errBox.classList.remove('d-none');
        }
        showToast(msg, 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // 2. Discharge / Close Case Form (sp_close_case)
  const closeCaseForm = document.getElementById('close-case-form');
  if (closeCaseForm) {
    closeCaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const caseId = document.getElementById('close-case-id').value;
      const status = document.getElementById('close-case-status').value;

      try {
        const res = await API.closeCase(caseId, status);
        if (res && res.success) {
          showToast(`Case #${caseId} closed as "${status}". Bed released to inventory via sp_close_case.`, 'success');
          if (bsModals['closeCaseModal']) bsModals['closeCaseModal'].hide();
          await refreshAllData();
          renderCasesTable();
        }
      } catch (err) {
        const msg = err.data && err.data.error ? err.data.error : err.message;
        showToast(msg, 'danger');
      }
    });
  }

  // 3. Edit Case Form
  const editCaseForm = document.getElementById('edit-case-form');
  if (editCaseForm) {
    editCaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const caseId = document.getElementById('edit-case-id').value;
      const age_group = document.getElementById('edit-case-age').value;
      const gender = document.getElementById('edit-case-gender').value;
      const icu_required = document.getElementById('edit-case-icu').checked;
      const status = document.getElementById('edit-case-status').value;

      try {
        const res = await API.updateCase(caseId, { age_group, gender, icu_required, status });
        if (res && res.success) {
          showToast(`Case #${caseId} updated successfully.`, 'success');
          if (bsModals['editCaseModal']) bsModals['editCaseModal'].hide();
          await refreshAllData();
          renderCasesTable();
        }
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // 4. Hospital / PHC Form (Create / Update)
  const hospForm = document.getElementById('hospital-form');
  if (hospForm) {
    hospForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('hospital-modal-id').value;
      const data = {
        name: document.getElementById('hosp-name').value,
        facility_type: document.getElementById('hosp-facility-type')?.value || 'PHC',
        operating_hours: document.getElementById('hosp-hours')?.value || '24x7',
        contact_phone: document.getElementById('hosp-phone')?.value || null,
        doctor_on_duty: document.getElementById('hosp-doctor')?.checked ? 1 : 0,
        ambulance_available: document.getElementById('hosp-ambulance')?.checked ? 1 : 0,
        city: document.getElementById('hosp-city').value,
        state: document.getElementById('hosp-state').value,
        latitude: parseFloat(document.getElementById('hosp-lat').value),
        longitude: parseFloat(document.getElementById('hosp-lng').value),
        total_beds: parseInt(document.getElementById('hosp-total-beds').value, 10),
        available_beds: parseInt(document.getElementById('hosp-avail-beds').value, 10),
        total_icu: parseInt(document.getElementById('hosp-total-icu').value, 10),
        available_icu: parseInt(document.getElementById('hosp-avail-icu').value, 10),
        ventilators: parseInt(document.getElementById('hosp-ventilators').value, 10)
      };

      try {
        if (id) {
          await API.updateHospital(id, data);
          showToast(`PHC / Facility "${data.name}" updated successfully.`, 'success');
        } else {
          await API.createHospital(data);
          showToast(`PHC "${data.name}" registered successfully.`, 'success');
        }
        if (bsModals['hospitalModal']) bsModals['hospitalModal'].hide();
        await refreshAllData();
        renderHospitalsTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 4B. Service Form (Create / Update)
  const serviceForm = document.getElementById('service-form');
  if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('service-modal-id').value;
      const data = {
        phc_id: parseInt(document.getElementById('service-phc-select').value, 10),
        service_name: document.getElementById('service-name').value,
        category: document.getElementById('service-category').value,
        cost_inr: parseFloat(document.getElementById('service-cost').value || '0'),
        is_free: document.getElementById('service-is-free').checked ? 1 : 0,
        scheme_name: document.getElementById('service-scheme').value || null,
        notes: document.getElementById('service-notes').value || null
      };

      try {
        if (id) {
          await API.updateService(id, data);
          showToast(`Service "${data.service_name}" updated.`, 'success');
        } else {
          await API.createService(data);
          showToast(`Service "${data.service_name}" added to catalog.`, 'success');
        }
        if (bsModals['serviceModal']) bsModals['serviceModal'].hide();
        await refreshAllData();
        renderServicesTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 4C. Village Vaccination Drive Form (Create / Update)
  const vdriveForm = document.getElementById('village-drive-form');
  if (vdriveForm) {
    vdriveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('vdrive-modal-id').value;
      const doses = parseInt(document.getElementById('vdrive-doses').value, 10);
      const data = {
        phc_id: parseInt(document.getElementById('vdrive-phc-select').value, 10),
        village_id: parseInt(document.getElementById('vdrive-village-select').value, 10),
        vaccine_name: document.getElementById('vdrive-vaccine').value,
        drive_date: document.getElementById('vdrive-date').value,
        time_slot: document.getElementById('vdrive-time').value || '09:00 AM - 02:00 PM',
        target_group: document.getElementById('vdrive-target').value || 'Infants & Children',
        doses_allocated: doses,
        doses_available: doses,
        status: 'scheduled'
      };

      try {
        if (id) {
          await API.updateVaccinationDrive(id, data);
          showToast(`Vaccination drive "${data.vaccine_name}" updated.`, 'success');
        } else {
          await API.createVaccinationDrive(data);
          showToast(`Village vaccination drive scheduled for ${data.drive_date}.`, 'success');
        }
        if (bsModals['villageDriveModal']) bsModals['villageDriveModal'].hide();
        await refreshAllData();
        renderVillageDrivesTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 5. Disease Form (Create / Update)
  const diseaseForm = document.getElementById('disease-form');
  if (diseaseForm) {
    diseaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('disease-modal-id').value;
      const data = {
        name: document.getElementById('disease-name').value,
        category: document.getElementById('disease-category').value,
        alert_threshold: parseInt(document.getElementById('disease-threshold').value, 10)
      };

      try {
        if (id) {
          await API.updateDisease(id, data);
          showToast(`Disease "${data.name}" updated successfully.`, 'success');
        } else {
          await API.createDisease(data);
          showToast(`Disease "${data.name}" cataloged successfully.`, 'success');
        }
        if (bsModals['diseaseModal']) bsModals['diseaseModal'].hide();
        await refreshAllData();
        renderDiseasesTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 6. Alert Form (Create)
  const alertForm = document.getElementById('alert-form');
  if (alertForm) {
    alertForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        disease_id: parseInt(document.getElementById('alert-disease-select').value, 10),
        city: document.getElementById('alert-city').value,
        area_level: document.getElementById('alert-area-level')?.value || 'district',
        area_name: document.getElementById('alert-city').value,
        level: document.getElementById('alert-level').value,
        message: document.getElementById('alert-message').value
      };

      try {
        await API.createAlert(data);
        showToast(`Outbreak alert issued for ${data.city}.`, 'success');
        if (bsModals['alertModal']) bsModals['alertModal'].hide();
        await refreshAllData();
        renderAlertsTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 7. Medicine Form (Create / Update)
  const medForm = document.getElementById('medicine-form');
  if (medForm) {
    medForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('medicine-modal-id').value;
      const data = {
        hospital_id: parseInt(document.getElementById('med-hospital-select').value, 10),
        name: document.getElementById('med-name').value,
        stock: parseInt(document.getElementById('med-stock').value, 10),
        reorder_level: parseInt(document.getElementById('med-reorder').value, 10)
      };

      try {
        if (id) {
          await API.updateMedicine(id, { name: data.name, stock: data.stock, reorder_level: data.reorder_level });
          showToast(`Medicine "${data.name}" updated successfully.`, 'success');
        } else {
          await API.addMedicine(data);
          showToast(`Medicine "${data.name}" registered to hospital inventory.`, 'success');
        }
        if (bsModals['medicineModal']) bsModals['medicineModal'].hide();
        await refreshAllData();
        renderMedicinesTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 8. Vaccination Form (Create / Update)
  const vacForm = document.getElementById('vaccination-form');
  if (vacForm) {
    vacForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('vaccination-modal-id').value;
      const data = {
        disease_id: parseInt(document.getElementById('vaccine-disease-select').value, 10),
        state: document.getElementById('vaccine-state').value,
        doses_given: parseInt(document.getElementById('vaccine-doses').value, 10),
        target_population: parseInt(document.getElementById('vaccine-target').value, 10),
        record_date: document.getElementById('vaccine-date').value
      };

      try {
        if (id) {
          await API.updateVaccination(id, data);
          showToast(`Vaccination record for ${data.state} updated.`, 'success');
        } else {
          await API.addVaccination(data);
          showToast(`Vaccination drive in ${data.state} logged successfully.`, 'success');
        }
        if (bsModals['vaccinationModal']) bsModals['vaccinationModal'].hide();
        await refreshAllData();
        renderVaccinationTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }

  // 9. User Form (Create / Update)
  const userForm = document.getElementById('user-form');
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('user-modal-id').value;
      const username = document.getElementById('user-username').value;
      const password = document.getElementById('user-password').value;
      const role = document.getElementById('user-role').value;

      try {
        if (id) {
          const payload = { username, role };
          if (password) payload.password = password;
          await API.updateUser(id, payload);
          showToast(`User account "${username}" updated successfully.`, 'success');
        } else {
          await API.createUser({ username, password, role });
          showToast(`User account "${username}" created successfully.`, 'success');
        }
        if (bsModals['userModal']) bsModals['userModal'].hide();
        await refreshAllData();
        renderUsersTable();
      } catch (err) {
        showToast(err.data?.error || err.message, 'danger');
      }
    });
  }
}

// ==============================================================================
// 17. Search & Filter Listeners
// ==============================================================================
function initFilters() {
  const listen = (id, event, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  };

  // Hospital filters
  listen('hospital-search-input', 'input', renderHospitalsTable);
  listen('hospital-filter-state', 'change', renderHospitalsTable);

  // Service filters
  listen('service-search-input', 'input', renderServicesTable);
  listen('service-filter-category', 'change', renderServicesTable);
  listen('service-filter-phc', 'change', renderServicesTable);

  // Village Drive filters
  listen('villagedrive-search-input', 'input', renderVillageDrivesTable);

  // Case filters
  listen('case-search-input', 'input', renderCasesTable);
  listen('case-filter-status', 'change', renderCasesTable);
  listen('case-filter-disease', 'change', renderCasesTable);
  listen('case-filter-hospital', 'change', renderCasesTable);

  // Disease filters
  listen('disease-search-input', 'input', renderDiseasesTable);
  listen('disease-filter-category', 'change', renderDiseasesTable);

  // Alert filters
  listen('alert-filter-status', 'change', renderAlertsTable);
  listen('alert-filter-level', 'change', renderAlertsTable);
  listen('alert-filter-disease', 'change', renderAlertsTable);

  // Medicine filters
  listen('med-search-input', 'input', renderMedicinesTable);
  listen('med-filter-hospital', 'change', renderMedicinesTable);
  listen('med-filter-lowstock', 'change', renderMedicinesTable);

  // Vaccination filters
  listen('vaccine-filter-state', 'change', renderVaccinationTable);
  listen('vaccine-filter-disease', 'change', renderVaccinationTable);

  // Complaint filters
  listen('complaint-filter-status', 'change', renderComplaintsTable);

  // User filters
  listen('user-filter-role', 'change', renderUsersTable);

  // Audit filters
  listen('audit-filter-action', 'change', renderAuditTable);
  listen('audit-search-input', 'input', renderAuditTable);

  // Universal Delete Confirmation Confirm Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (AdminState.deleteTarget && typeof AdminState.deleteTarget.action === 'function') {
        try {
          await AdminState.deleteTarget.action();
          if (bsModals['deleteConfirmModal']) bsModals['deleteConfirmModal'].hide();
        } catch (err) {
          showToast(err.data?.error || err.message, 'danger');
        }
      }
    });
  }
}

// ==============================================================================
// 18. Universal Delete Modal Trigger
// ==============================================================================
function showUniversalDeleteModal(title, message, actionFn) {
  document.getElementById('delete-modal-title').textContent = title;
  document.getElementById('delete-modal-message').innerHTML = message;
  AdminState.deleteTarget = { action: actionFn };

  if (bsModals['deleteConfirmModal']) {
    bsModals['deleteConfirmModal'].show();
  }
}

function confirmDeleteHospital(id, name) {
  showUniversalDeleteModal(
    'Delete Hospital Facility',
    `Are you sure you want to permanently delete <strong>${escapeHtml(name)}</strong> (ID #${id})?<br><br><span class="text-danger small"><i class="bi bi-exclamation-triangle-fill me-1"></i>Warning: All associated bed records and local references will be affected.</span>`,
    async () => {
      await API.deleteHospital(id);
      showToast(`Hospital "${name}" deleted.`, 'success');
      await refreshAllData();
      renderHospitalsTable();
    }
  );
}

function confirmDeleteService(id, name) {
  showUniversalDeleteModal(
    'Delete Healthcare Service',
    `Are you sure you want to remove service <strong>${escapeHtml(name)}</strong> (ID #${id}) from the catalog?`,
    async () => {
      await API.deleteService(id);
      showToast(`Service "${name}" deleted.`, 'success');
      await refreshAllData();
      renderServicesTable();
    }
  );
}

function confirmDeleteVillageDrive(id, vaccine) {
  showUniversalDeleteModal(
    'Cancel Village Vaccination Drive',
    `Are you sure you want to cancel drive <strong>#${id}</strong> (${escapeHtml(vaccine)})?`,
    async () => {
      await API.deleteVaccinationDrive(id);
      showToast(`Drive #${id} deleted.`, 'success');
      await refreshAllData();
      renderVillageDrivesTable();
    }
  );
}

async function updateAshaRequestStatus(requestId, status) {
  try {
    const res = await API.updateAshaRequestStatus(requestId, status);
    if (res && res.success) {
      showToast(`ASHA request #${requestId} status set to "${status}".`, 'success');
      await refreshAllData();
      renderAshaRequestsTable();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function confirmDeleteCase(id) {
  showUniversalDeleteModal(
    'Delete Patient Admission',
    `Are you sure you want to permanently delete Case <strong>#${id}</strong>?<br><br><span class="text-muted small">If the case is currently admitted, the occupied hospital bed will be released back to inventory.</span>`,
    async () => {
      await API.deleteCase(id);
      showToast(`Case #${id} deleted successfully.`, 'success');
      await refreshAllData();
      renderCasesTable();
    }
  );
}

function confirmDeleteDisease(id, name) {
  showUniversalDeleteModal(
    'Delete Disease Catalog Entry',
    `Are you sure you want to permanently delete <strong>${escapeHtml(name)}</strong> (ID #${id})?`,
    async () => {
      await API.deleteDisease(id);
      showToast(`Disease "${name}" deleted.`, 'success');
      await refreshAllData();
      renderDiseasesTable();
    }
  );
}

function confirmDeleteAlert(id) {
  showUniversalDeleteModal(
    'Delete Outbreak Alert',
    `Are you sure you want to delete Alert record <strong>#${id}</strong>?`,
    async () => {
      await API.deleteAlert(id);
      showToast(`Alert #${id} deleted.`, 'success');
      await refreshAllData();
      renderAlertsTable();
    }
  );
}

function confirmDeleteMedicine(id, name) {
  showUniversalDeleteModal(
    'Delete Medicine Stock Item',
    `Are you sure you want to delete pharmacy record <strong>${escapeHtml(name)}</strong> (ID #${id})?`,
    async () => {
      await API.deleteMedicine(id);
      showToast(`Medicine item "${name}" deleted.`, 'success');
      await refreshAllData();
      renderMedicinesTable();
    }
  );
}

function confirmDeleteVaccination(id, state) {
  showUniversalDeleteModal(
    'Delete Vaccination Record',
    `Are you sure you want to delete vaccination record <strong>#${id}</strong> for <strong>${escapeHtml(state)}</strong>?`,
    async () => {
      await API.deleteVaccination(id);
      showToast(`Vaccination record #${id} deleted.`, 'success');
      await refreshAllData();
      renderVaccinationTable();
    }
  );
}

function confirmDeleteComplaint(id) {
  showUniversalDeleteModal(
    'Delete Citizen Grievance',
    `Are you sure you want to delete grievance complaint <strong>#${id}</strong>?`,
    async () => {
      await API.deleteComplaint(id);
      showToast(`Complaint #${id} deleted.`, 'success');
      await refreshAllData();
      renderComplaintsTable();
    }
  );
}

function confirmDeleteUser(id, username) {
  showUniversalDeleteModal(
    'Delete User Account',
    `Are you sure you want to delete user account <strong>${escapeHtml(username)}</strong> (ID #${id})?<br><br><span class="text-danger small">The user will immediately lose access to HealthWatch AI.</span>`,
    async () => {
      await API.deleteUser(id);
      showToast(`User account "${username}" deleted.`, 'success');
      await refreshAllData();
      renderUsersTable();
    }
  );
}

// Direct Actions
async function resolveAlertDirect(alertId) {
  try {
    const res = await API.resolveAlert(alertId);
    if (res && res.success) {
      showToast(`Outbreak Alert #${alertId} marked as resolved.`, 'success');
      await refreshAllData();
      renderAlertsTable();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function updateComplaintStatus(complaintId, status) {
  try {
    const res = await API.updateComplaint(complaintId, status);
    if (res && res.success) {
      showToast(`Complaint #${complaintId} status updated to "${status}".`, 'success');
      await refreshAllData();
      renderComplaintsTable();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ==============================================================================
// 19. Formatters & UI Utilities
// ==============================================================================
function formatStatusBadge(status) {
  if (status === 'admitted') return '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i>Admitted</span>';
  if (status === 'recovered') return '<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1"><i class="bi bi-check2 me-1"></i>Recovered</span>';
  if (status === 'deceased') return '<span class="badge bg-secondary text-white px-2 py-1">Deceased</span>';
  return `<span class="badge bg-light text-dark">${status}</span>`;
}

function formatCategoryBadge(category) {
  const map = {
    'vector-borne': 'bg-warning-subtle text-warning border border-warning-subtle',
    'water-borne': 'bg-info-subtle text-info border border-info-subtle',
    'air-borne': 'bg-primary-subtle text-primary border border-primary-subtle',
    'other': 'bg-secondary-subtle text-secondary border border-secondary-subtle'
  };
  return `<span class="badge ${map[category] || 'bg-light text-dark'} text-capitalize font-monospace px-2 py-1">${category}</span>`;
}

function formatAlertLevelBadge(level) {
  if (level === 'critical') return '<span class="badge bg-danger text-white text-uppercase font-monospace px-2 py-1"><i class="bi bi-exclamation-octagon me-1"></i>CRITICAL</span>';
  if (level === 'high') return '<span class="badge bg-warning text-dark text-uppercase font-monospace px-2 py-1"><i class="bi bi-exclamation-triangle me-1"></i>HIGH</span>';
  return '<span class="badge bg-primary text-white text-uppercase font-monospace px-2 py-1"><i class="bi bi-info-circle me-1"></i>WARNING</span>';
}

function formatComplaintStatusBadge(status) {
  if (status === 'new') return '<span class="badge bg-warning-subtle text-warning border border-warning-subtle text-uppercase font-monospace px-2">New Grievance</span>';
  if (status === 'reviewed') return '<span class="badge bg-info-subtle text-info border border-info-subtle text-uppercase font-monospace px-2">Under Review</span>';
  if (status === 'closed') return '<span class="badge bg-success-subtle text-success border border-success-subtle text-uppercase font-monospace px-2">Resolved & Closed</span>';
  return `<span class="badge bg-light text-dark">${status}</span>`;
}

function formatActionBadge(action) {
  const map = {
    'INSERT': 'bg-success-subtle text-success border border-success-subtle',
    'UPDATE': 'bg-primary-subtle text-primary border border-primary-subtle',
    'DELETE': 'bg-danger-subtle text-danger border border-danger-subtle',
    'ADMIT': 'bg-teal-subtle text-teal border border-teal-subtle',
    'CLOSE': 'bg-indigo-subtle text-indigo border border-indigo-subtle',
    'RESOLVE': 'bg-success-subtle text-success border border-success-subtle'
  };
  return `<span class="badge ${map[action] || 'bg-light text-dark'} font-monospace px-2 py-1">${action}</span>`;
}

function formatDate(isoStr) {
  if (!isoStr) return '--';
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '--';
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==============================================================================
// ADD-ON WIDGET: Doctor Presence Flags & Feedback Alerts
// ==============================================================================
async function loadFeedbackAdminFlags() {
  const tbody = document.getElementById('admin-flags-low-doctor-tbody');
  const alertList = document.getElementById('admin-flags-alerts-list');
  const countBadge = document.getElementById('admin-flags-alert-count');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Checking feedback flags...</td></tr>';
  }
  if (alertList) {
    alertList.innerHTML = '<div class="p-3 text-center text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Loading feedback alerts...</div>';
  }

  try {
    const res = await API.getFeedbackFlags();
    const low = (res && res.lowDoctorPresence) ? res.lowDoctorPresence : [];
    const alerts = (res && res.activeAlerts) ? res.activeAlerts : [];

    // 1. Low doctor presence table
    if (tbody) {
      if (low.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-success small"><i class="bi bi-shield-check me-1"></i>All monitored PHCs have healthy villager doctor attendance (&ge; 50%).</td></tr>';
      } else {
        tbody.innerHTML = low.map(item => `
          <tr>
            <td class="fw-semibold text-dark">${escapeHtml(item.name)}</td>
            <td><span class="badge bg-light text-dark border font-monospace">${item.reports_14d}</span></td>
            <td><span class="badge bg-danger">${item.doctor_present_pct}%</span></td>
            <td><span class="badge bg-secondary-subtle text-dark border">${item.medicine_yes_pct !== null ? item.medicine_yes_pct + '%' : '--'}</span></td>
          </tr>
        `).join('');
      }
    }

    // 2. Active feedback alerts
    if (countBadge) countBadge.textContent = alerts.length;
    if (alertList) {
      if (alerts.length === 0) {
        alertList.innerHTML = '<div class="p-3 text-center text-muted small"><i class="bi bi-check-circle text-success me-1"></i>No active doctor-absent alerts triggered in the last 24 hours.</div>';
      } else {
        alertList.innerHTML = alerts.map(a => `
          <div class="list-group-item p-3 border-start border-danger border-4">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <strong class="text-danger small"><i class="bi bi-exclamation-triangle-fill me-1"></i>${escapeHtml(a.phc_name)}</strong>
              <span class="badge bg-danger text-uppercase font-monospace" style="font-size:0.7rem;">${a.alert_type}</span>
            </div>
            <div class="small text-dark mb-1">${escapeHtml(a.message)}</div>
            <small class="text-muted"><i class="bi bi-clock me-1"></i>${new Date(a.created_at).toLocaleString()}</small>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Failed to load feedback admin flags:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-danger small">${err.message || 'Failed to load flags'}</td></tr>`;
    if (alertList) alertList.innerHTML = `<div class="p-3 text-center text-danger small">${err.message || 'Failed to load alerts'}</div>`;
  }
}

