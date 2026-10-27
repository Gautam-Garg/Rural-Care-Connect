// ==============================================================================
// Rural Care Connect: Public Dashboard Controller
// Tagline: "Healthcare access for every village."
// Manages:
//   1. Nearby PHC Map with Haversine GPS & Village Hierarchy (sp_nearest_phc)
//   2. Affordable Care by Budget (v_affordable_services)
//   3. Village Vaccination Drives (vw_upcoming_drives)
//   4. Area Outbreak Alerts (district / block / village level)
//   5. Rural AI Symptom Checker & Facility Guidance
//   6. PHC Directory & Bed Inventory
//   7. Historical EpiClim India Heat Map & Epidemiological Trends
//   8. Weather Risk Correlation & Citizen Grievance Redressal
// ==============================================================================

// Global State
const PublicState = {
  phcs: [],
  alerts: [],
  diseases: [],
  geography: [],
  selectedVillageCoords: null,
  userGPSCoords: null,
  currentRadius: 50,
  
  // Nearby PHC Map
  phcMap: null,
  phcMapMarkers: [],
  userPinMarker: null,

  // EpiClim India Map
  indiaMap: null,
  baseLayers: {},
  activeBasemapName: 'Light Gray',
  heatLayer: null,
  heatmapMarkers: [],
  mapInitialBoundsSet: false,

  // Charts
  trendChart: null,
  categoryChart: null,
  weatherVsCasesChart: null,
  costBarChart: null,
  epiclimFilters: null
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate session
  const user = await API.checkAuth();
  if (!user) return;

  // 2. Initialize Navigation & Global Controls
  initNavigation();

  // 3. Load Geographic Hierarchy & Master Data
  await loadGeographyHierarchy();
  await loadSummaryKPIs();
  await loadActiveAlerts();
  await loadDiseases();
  await loadPHCs();

  // 4. Initialize Core Features
  initNearbyPHCMap();
  initAffordableCare();
  initTotalCostCalculator();
  initFeedbackListeners();
  initVaccinationDrives();
  initAreaAlerts();
  initSymptomChecker();
  
  // 5. Initialize Epidemiology & Telemetry
  initIndiaEpiMap();
  await initEpiclimSurveillance();
  await loadTrendCharts();
  await loadWeatherTelemetry('Pune Rural');
  initComplaintForm();
});

// ==============================================================================
// 1. Navigation & Section Toggling
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

  function activateSection(targetId) {
    sections.forEach(s => s.classList.add('d-none'));
    const activeSection = document.getElementById(`section-${targetId}`);
    if (activeSection) {
      activeSection.classList.remove('d-none');
    }

    sidebarLinks.forEach(link => {
      if (link.getAttribute('data-section') === targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (sidebar) sidebar.classList.remove('show');

    // Invalidate map sizes if navigating to maps
    if (targetId === 'nearby' && PublicState.phcMap) {
      setTimeout(() => PublicState.phcMap.invalidateSize(), 200);
    }
    if (targetId === 'map' && PublicState.indiaMap) {
      setTimeout(() => PublicState.indiaMap.invalidateSize(), 200);
    }
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-section');
      activateSection(targetId);
    });
  });
}

// ==============================================================================
// 2. Geographic Hierarchy Loading (State > District > Block > Village)
// ==============================================================================
async function loadGeographyHierarchy() {
  try {
    const res = await API.getGeographyHierarchy();
    if (res.success && res.data) {
      PublicState.geography = res.data;
      populateGeographyDropdowns();
    }
  } catch (err) {
    console.error('Failed to load geography hierarchy:', err);
  }
}

function populateGeographyDropdowns() {
  const stateSelects = [
    document.getElementById('select-phc-state'),
    document.getElementById('filter-drive-state')
  ];

  stateSelects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">All States / सभी राज्य</option>';
    PublicState.geography.forEach(s => {
      sel.innerHTML += `<option value="${s.state_id}">${s.name}</option>`;
    });
  });

  // State change event for nearby PHC map
  const phcStateSel = document.getElementById('select-phc-state');
  const phcDistSel = document.getElementById('select-phc-district');
  const phcVilSel = document.getElementById('select-phc-village');

  if (phcStateSel && phcDistSel && phcVilSel) {
    phcStateSel.addEventListener('change', () => {
      const stateId = parseInt(phcStateSel.value, 10);
      phcDistSel.innerHTML = '<option value="">All Districts / सभी जिले</option>';
      phcVilSel.innerHTML = '<option value="">Select Village...</option>';

      if (!stateId) return;
      const stateObj = PublicState.geography.find(s => s.state_id === stateId);
      if (stateObj && stateObj.districts) {
        stateObj.districts.forEach(d => {
          phcDistSel.innerHTML += `<option value="${d.district_id}">${d.name}</option>`;
        });
      }
    });

    phcDistSel.addEventListener('change', () => {
      const stateId = parseInt(phcStateSel.value, 10);
      const distId = parseInt(phcDistSel.value, 10);
      phcVilSel.innerHTML = '<option value="">Select Village...</option>';

      if (!stateId || !distId) return;
      const stateObj = PublicState.geography.find(s => s.state_id === stateId);
      if (stateObj) {
        const distObj = stateObj.districts.find(d => d.district_id === distId);
        if (distObj && distObj.blocks) {
          distObj.blocks.forEach(b => {
            if (b.villages) {
              b.villages.forEach(v => {
                phcVilSel.innerHTML += `<option value="${v.village_id}" data-lat="${v.latitude}" data-lng="${v.longitude}">${v.name} (${b.name})</option>`;
              });
            }
          });
        }
      }
    });

    phcVilSel.addEventListener('change', () => {
      const opt = phcVilSel.selectedOptions[0];
      if (opt && opt.dataset.lat && opt.dataset.lng) {
        const lat = parseFloat(opt.dataset.lat);
        const lng = parseFloat(opt.dataset.lng);
        PublicState.selectedVillageCoords = { lat, lng };
        setUserPinOnPHCMap(lat, lng, `Village: ${opt.textContent}`);
        fetchNearestPHCs(lat, lng, PublicState.currentRadius);
      }
    });
  }

  // State change event for vaccination drives
  const driveStateSel = document.getElementById('filter-drive-state');
  const driveDistSel = document.getElementById('filter-drive-district');
  const driveVilSel = document.getElementById('filter-drive-village');

  if (driveStateSel && driveDistSel && driveVilSel) {
    driveStateSel.addEventListener('change', () => {
      const stateId = parseInt(driveStateSel.value, 10);
      driveDistSel.innerHTML = '<option value="">All Districts</option>';
      driveVilSel.innerHTML = '<option value="">All Villages</option>';
      if (!stateId) {
        loadVaccinationDrives();
        return;
      }
      const stateObj = PublicState.geography.find(s => s.state_id === stateId);
      if (stateObj && stateObj.districts) {
        stateObj.districts.forEach(d => {
          driveDistSel.innerHTML += `<option value="${d.district_id}">${d.name}</option>`;
        });
      }
      loadVaccinationDrives();
    });

    driveDistSel.addEventListener('change', () => {
      const stateId = parseInt(driveStateSel.value, 10);
      const distId = parseInt(driveDistSel.value, 10);
      driveVilSel.innerHTML = '<option value="">All Villages</option>';
      if (stateId && distId) {
        const stateObj = PublicState.geography.find(s => s.state_id === stateId);
        if (stateObj) {
          const distObj = stateObj.districts.find(d => d.district_id === distId);
          if (distObj && distObj.blocks) {
            distObj.blocks.forEach(b => {
              if (b.villages) {
                b.villages.forEach(v => {
                  driveVilSel.innerHTML += `<option value="${v.village_id}">${v.name}</option>`;
                });
              }
            });
          }
        }
      }
      loadVaccinationDrives();
    });

    driveVilSel.addEventListener('change', () => {
      loadVaccinationDrives();
    });
  }
}

// ==============================================================================
// 3. KPI Summary & Active Outbreak Alerts
// ==============================================================================
async function loadSummaryKPIs() {
  try {
    const res = await API.getStatsSummary();
    if (res.success && res.data) {
      const d = res.data;
      const elHosp = document.getElementById('kpi-hospitals');
      const elBeds = document.getElementById('kpi-beds');
      const elAlerts = document.getElementById('kpi-alerts');
      const elDrives = document.getElementById('kpi-drives');

      if (elHosp) elHosp.textContent = d.total_phcs || d.total_hospitals || 30;
      if (elBeds) elBeds.textContent = d.total_available_beds || '--';
      if (elAlerts) elAlerts.textContent = d.active_alerts || 0;
      if (elDrives) elDrives.textContent = d.upcoming_drives || 18;
    }
  } catch (err) {
    console.error('Failed to load KPIs:', err);
  }
}

async function loadActiveAlerts() {
  const container = document.getElementById('alerts-banner-container');
  try {
    const res = await API.getAlerts({ status: 'active' });
    PublicState.alerts = res.success ? res.data : [];

    if (!container) return;

    if (PublicState.alerts.length === 0) {
      container.innerHTML = `
        <div class="alert alert-success d-flex align-items-center mb-0 py-2 px-3 small border-0 shadow-sm" role="alert">
          <i class="bi bi-shield-check fs-5 me-2"></i>
          <div><strong>All Clear:</strong> No active disease outbreaks or vaccine stockout alerts in monitored rural areas.</div>
        </div>
      `;
      return;
    }

    const topAlert = PublicState.alerts[0];
    const alertClass = topAlert.level === 'critical' ? 'alert-pulse-critical bg-danger-subtle text-danger' :
                       topAlert.level === 'high' ? 'alert-pulse-warning bg-warning-subtle text-dark' : 'bg-info-subtle text-primary';

    container.innerHTML = `
      <div class="alert ${alertClass} d-flex flex-wrap justify-content-between align-items-center mb-0 py-2 px-3 small shadow-sm rounded-3" role="alert">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill fs-5"></i>
          <div>
            <strong>[${topAlert.level.toUpperCase()} ALERT]:</strong> ${topAlert.message}
            <span class="badge bg-dark ms-2 font-monospace">${topAlert.area_level || 'District'}: ${topAlert.area_name || topAlert.city}</span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline-dark py-0 px-2 fw-semibold" onclick="document.querySelector('.sidebar-link[data-section=\\'alerts\\']').click()">
          View All (${PublicState.alerts.length}) <i class="bi bi-arrow-right"></i>
        </button>
      </div>
    `;
  } catch (err) {
    if (container) container.innerHTML = '';
  }
}

// ==============================================================================
// 4. Nearby PHC Finder (Map & Haversine GPS) - Prompt 4.1
// ==============================================================================
function initNearbyPHCMap() {
  const mapContainer = document.getElementById('phc-leaflet-map');
  if (!mapContainer) return;

  // Center on rural central-west India (Maharashtra/MP region: approx 19.5, 75.0)
  PublicState.phcMap = L.map('phc-leaflet-map').setView([19.26, 74.0], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors | Rural Care Connect'
  }).addTo(PublicState.phcMap);

  // Click on map drops pin and searches nearest
  PublicState.phcMap.on('click', (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    setUserPinOnPHCMap(lat, lng, 'Selected Location / चयनित स्थान');
    fetchNearestPHCs(lat, lng, PublicState.currentRadius);
  });

  // GPS Button handler
  const btnGPS = document.getElementById('btn-use-gps');
  if (btnGPS) {
    btnGPS.addEventListener('click', () => {
      if (navigator.geolocation) {
        btnGPS.disabled = true;
        btnGPS.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Locating...';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btnGPS.disabled = false;
            btnGPS.innerHTML = '<i class="bi bi-crosshair me-1"></i> Use My Location';
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            PublicState.userGPSCoords = { lat, lng };
            setUserPinOnPHCMap(lat, lng, 'My Location (GPS)');
            fetchNearestPHCs(lat, lng, PublicState.currentRadius);
          },
          (err) => {
            btnGPS.disabled = false;
            btnGPS.innerHTML = '<i class="bi bi-crosshair me-1"></i> Use My Location';
            // Default fallback to Otur (Maharashtra rural)
            showToast('Could not access device GPS. Defaulting to Otur Village, Maharashtra.', 'warning');
            const lat = 19.2612;
            const lng = 73.9854;
            setUserPinOnPHCMap(lat, lng, 'Otur Village (Sample GPS)');
            fetchNearestPHCs(lat, lng, PublicState.currentRadius);
          },
          { timeout: 7000 }
        );
      } else {
        showToast('Browser Geolocation is not supported.', 'danger');
      }
    });
  }

  // Radius select handler
  const radiusSel = document.getElementById('select-phc-radius');
  if (radiusSel) {
    radiusSel.addEventListener('change', () => {
      PublicState.currentRadius = parseFloat(radiusSel.value) || 50;
      const coords = PublicState.selectedVillageCoords || PublicState.userGPSCoords || { lat: 19.2612, lng: 73.9854 };
      fetchNearestPHCs(coords.lat, coords.lng, PublicState.currentRadius);
    });
  }

  // Initial load around sample Otur / Junnar rural area
  const initialLat = 19.2612;
  const initialLng = 73.9854;
  setUserPinOnPHCMap(initialLat, initialLng, 'Default Location: Otur, Maharashtra');
  fetchNearestPHCs(initialLat, initialLng, 50);
}

function setUserPinOnPHCMap(lat, lng, label) {
  if (!PublicState.phcMap) return;

  if (PublicState.userPinMarker) {
    PublicState.phcMap.removeLayer(PublicState.userPinMarker);
  }

  // Custom user pin icon
  const userIcon = L.divIcon({
    className: 'custom-user-pin',
    html: `<div style="background-color: #2563eb; width: 22px; height: 22px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  PublicState.userPinMarker = L.marker([lat, lng], { icon: userIcon }).addTo(PublicState.phcMap);
  PublicState.userPinMarker.bindPopup(`<strong>${label}</strong><br>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`).openPopup();
  PublicState.phcMap.panTo([lat, lng]);
}

async function fetchNearestPHCs(lat, lng, radius) {
  const resultsContainer = document.getElementById('phc-results-list');
  const countBadge = document.getElementById('phc-results-count');

  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="text-center py-5 text-muted small">
        <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
        <div>Calculating distance via MySQL Haversine formula (sp_nearest_phc)...</div>
      </div>
    `;
  }

  try {
    const res = await API.getNearestPHCs(lat, lng, radius);
    if (!res.success || !res.data) {
      if (resultsContainer) resultsContainer.innerHTML = '<div class="p-3 text-muted">No PHCs found within this radius.</div>';
      return;
    }

    const facilities = res.data;
    if (countBadge) countBadge.textContent = `${facilities.length} found`;

    // Clear old map markers
    PublicState.phcMapMarkers.forEach(m => PublicState.phcMap.removeLayer(m));
    PublicState.phcMapMarkers = [];

    if (facilities.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="p-4 text-center text-muted">
            <i class="bi bi-geo-alt fs-2 text-secondary mb-2"></i>
            <div>No Primary Health Centres found within ${radius} km.</div>
            <small>Try selecting a larger search radius.</small>
          </div>
        `;
      }
      return;
    }

    // Update emergency modal with the closest facility (#1)
    const closest = facilities[0];
    const elEmergName = document.getElementById('emergency-phc-name');
    const elEmergLoc = document.getElementById('emergency-phc-loc');
    const elEmergCall = document.getElementById('emergency-phc-call');
    const elEmergNav = document.getElementById('emergency-phc-nav');

    if (elEmergName) elEmergName.textContent = closest.name;
    if (elEmergLoc) elEmergLoc.textContent = `${closest.district_name || closest.city} (Distance: ${closest.distance_km} km)`;
    if (elEmergCall && closest.phone) elEmergCall.href = `tel:${closest.phone.replace(/[^0-9]/g, '')}`;
    if (elEmergNav) elEmergNav.href = `https://www.google.com/maps/dir/?api=1&destination=${closest.latitude},${closest.longitude}`;

    // Render results cards and map markers
    let html = '';
    const bounds = L.latLngBounds([[lat, lng]]);

    facilities.forEach((phc, idx) => {
      const typeBadge = phc.facility_type === 'CHC' ? 'bg-primary' :
                        phc.facility_type === 'Sub-centre' ? 'bg-secondary' : 'bg-teal text-white';
      const doctorBadge = phc.doctor_available ?
        '<span class="badge bg-success-subtle text-success border"><i class="bi bi-person-check me-1"></i>Doctor Available</span>' :
        '<span class="badge bg-warning-subtle text-dark border"><i class="bi bi-person-x me-1"></i>Doctor on Call</span>';
      const ambulanceBadge = phc.ambulance_available ?
        '<span class="badge bg-info-subtle text-primary border"><i class="bi bi-truck me-1"></i>Ambulance Ready</span>' :
        '<span class="badge bg-light text-muted border">No Ambulance</span>';

      html += `
        <div class="card mb-2 border rounded-3 p-3 shadow-sm hover-shadow">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div>
              <span class="badge ${typeBadge} small me-1" style="background-color: #0d9488;">${phc.facility_type}</span>
              <strong class="text-dark">${phc.name}</strong>
            </div>
            <span class="badge bg-danger fw-bold font-monospace">${phc.distance_km} km</span>
          </div>

          <div class="small text-muted mb-2">
            <i class="bi bi-geo-alt me-1"></i>${phc.village_name ? phc.village_name + ', ' : ''}${phc.district_name}, ${phc.state} • 
            <i class="bi bi-clock me-1"></i>${phc.open_hours || '24x7'}
          </div>

          <div class="d-flex flex-wrap gap-1 mb-2">
            ${doctorBadge}
            ${ambulanceBadge}
            <span class="badge bg-light text-secondary border"><i class="bi bi-hospital me-1"></i>Beds: ${phc.available_beds}/${phc.total_beds}</span>
          </div>

          <div class="feedback-badge-box mb-2" id="fb-badge-nearest-${phc.phc_id}">
            <span class="badge bg-light text-muted border small">Checking reports...</span>
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-1 pt-2 border-top">
            <div class="d-flex gap-1">
              <a href="tel:${phc.phone}" class="btn btn-sm btn-outline-success fw-bold">
                <i class="bi bi-telephone-fill me-1"></i> ${phc.phone}
              </a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${phc.latitude},${phc.longitude}" target="_blank" class="btn btn-sm btn-outline-primary fw-medium">
                <i class="bi bi-signpost-2 me-1"></i> Directions
              </a>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-info fw-semibold" onclick="showPhcMedicines(${phc.phc_id}, '${escapeHtml(phc.name)}')">
                <i class="bi bi-capsule me-1"></i> Medicines
              </button>
              <button class="btn btn-sm btn-outline-secondary fw-semibold" onclick="openFeedbackModal(${phc.phc_id}, '${escapeHtml(phc.name)}')">
                <i class="bi bi-chat-left-text me-1"></i> Feedback
              </button>
            </div>
          </div>
        </div>
      `;

      // Map marker
      const markerColor = idx === 0 ? '#dc2626' : '#0d9488';
      const phcIcon = L.divIcon({
        className: 'custom-phc-marker',
        html: `<div style="background-color: ${markerColor}; color: white; width: 28px; height: 28px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">#${idx+1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const m = L.marker([phc.latitude, phc.longitude], { icon: phcIcon }).addTo(PublicState.phcMap);
      m.bindPopup(`
        <div style="font-family: inherit;">
          <div class="badge bg-teal mb-1" style="background:#0d9488; color:white;">${phc.facility_type}</div>
          <strong class="d-block text-dark">${phc.name}</strong>
          <div class="text-danger fw-bold small mb-1"><i class="bi bi-arrows-expand me-1"></i>${phc.distance_km} km away</div>
          <div class="small text-muted mb-2">
            <strong>Beds:</strong> ${phc.available_beds}/${phc.total_beds} free<br>
            <strong>Doctor:</strong> ${phc.doctor_available ? 'Available' : 'On Call'}<br>
            <strong>Hours:</strong> ${phc.open_hours}<br>
            <strong>Phone:</strong> <a href="tel:${phc.phone}">${phc.phone}</a>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${phc.latitude},${phc.longitude}" target="_blank" class="btn btn-sm btn-primary text-white w-100 fw-bold">
            <i class="bi bi-arrow-up-right-square me-1"></i> Get Directions
          </a>
        </div>
      `);

      PublicState.phcMapMarkers.push(m);
      bounds.extend([phc.latitude, phc.longitude]);
    });

    if (resultsContainer) {
      resultsContainer.innerHTML = html;
      facilities.forEach(phc => {
        loadFeedbackBadge(phc.phc_id, document.getElementById(`fb-badge-nearest-${phc.phc_id}`));
      });
    }
    PublicState.phcMap.fitBounds(bounds, { padding: [30, 30] });

  } catch (err) {
    console.error('Error fetching nearest PHCs:', err);
    if (resultsContainer) resultsContainer.innerHTML = '<div class="p-3 text-danger">Failed to calculate nearest facilities.</div>';
  }
}

// ==============================================================================
// 5. Affordable Care by Budget - Prompt 4.2
// ==============================================================================
function initAffordableCare() {
  const btnSearch = document.getElementById('btn-search-affordable');
  const inputBudget = document.getElementById('budget-amount');
  const selectCat = document.getElementById('budget-category');

  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      loadAffordableServices();
    });
  }

  if (inputBudget) {
    inputBudget.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadAffordableServices();
    });
  }

  if (selectCat) {
    selectCat.addEventListener('change', () => {
      loadAffordableServices();
    });
  }

  // Initial load
  loadAffordableServices();
}

async function loadAffordableServices() {
  const tbody = document.getElementById('affordable-services-tbody');
  const inputBudget = document.getElementById('budget-amount');
  const selectCat = document.getElementById('budget-category');

  if (!tbody) return;

  const budget = inputBudget ? inputBudget.value.trim() : '50';
  const category = selectCat ? selectCat.value : 'all';

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        Filtering services under ₹${budget || '0'} via v_affordable_services...
      </td>
    </tr>
  `;

  try {
    const coords = PublicState.selectedVillageCoords || PublicState.userGPSCoords || { lat: 19.2612, lng: 73.9854 };
    const res = await API.getAffordableServices({
      budget: budget || 0,
      category,
      lat: coords.lat,
      lng: coords.lng
    });

    if (!res.success || !res.data || res.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">
            <i class="bi bi-cash-stack fs-3 text-secondary d-block mb-2"></i>
            No services found within ₹${budget} for category "${category}".<br>
            <small>Try entering a higher budget or selecting "All Needs".</small>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    res.data.forEach(item => {
      const freeBadge = item.is_free ?
        '<span class="badge-free"><i class="bi bi-patch-check-fill me-1"></i>100% FREE</span>' :
        `<span class="fw-bold text-dark font-monospace">₹${parseFloat(item.cost_inr).toFixed(2)}</span>`;

      const schemeTag = item.scheme_name ?
        `<span class="scheme-tag"><i class="bi bi-shield-check me-1"></i>${item.scheme_name}</span>` :
        '<span class="text-muted small">Standard Subsidized Fee</span>';

      const doctorStatus = item.doctor_available ?
        '<span class="badge bg-success-subtle text-success border">Doctor Present</span>' :
        '<span class="badge bg-warning-subtle text-dark border">On Call</span>';

      rowsHtml += `
        <tr>
          <td>
            <div class="fw-bold text-dark">${item.service_name}</div>
            ${item.notes ? `<small class="text-muted">${item.notes}</small>` : ''}
          </td>
          <td>
            <span class="badge bg-light text-secondary border text-capitalize">${item.category}</span>
          </td>
          <td>
            <div class="fw-semibold">${item.phc_name}</div>
            <small class="text-muted">${item.district_name || item.city}, ${item.state} ${item.distance_km ? `(${item.distance_km} km)` : ''}</small>
          </td>
          <td>
            ${freeBadge}
          </td>
          <td>
            ${schemeTag}
          </td>
          <td>
            ${doctorStatus}
          </td>
          <td>
            <a href="tel:${item.phone}" class="btn btn-sm btn-outline-success fw-bold text-nowrap">
              <i class="bi bi-telephone-fill me-1"></i> Call ${item.phone}
            </a>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error('Error fetching affordable care:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Failed to retrieve affordable services.</td></tr>`;
  }
}

// ==============================================================================
// 6. Village Vaccination Drives - Prompt 4.3
// ==============================================================================
function initVaccinationDrives() {
  loadVaccinationDrives();
}

async function loadVaccinationDrives() {
  const grid = document.getElementById('vaccination-drives-grid');
  if (!grid) return;

  const stateSel = document.getElementById('filter-drive-state');
  const distSel = document.getElementById('filter-drive-district');
  const vilSel = document.getElementById('filter-drive-village');

  const params = {};
  if (vilSel && vilSel.value) params.village_id = vilSel.value;
  else if (distSel && distSel.value) params.district_id = distSel.value;

  grid.innerHTML = `
    <div class="col-12 text-center py-4 text-muted small">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
      Loading scheduled village drives...
    </div>
  `;

  try {
    const res = await API.getVaccinationDrives(params);
    if (!res.success || !res.data || res.data.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="bi bi-shield-x fs-2 text-secondary mb-2"></i>
          <div>No vaccination drives scheduled for the selected area.</div>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    res.data.forEach(drive => {
      const isUrgentDoses = drive.doses_available <= 10;
      const doseBadge = isUrgentDoses ?
        `<span class="badge bg-danger font-monospace">Only ${drive.doses_available} Doses Left</span>` :
        `<span class="badge bg-success font-monospace">${drive.doses_available} Doses Available</span>`;

      cardsHtml += `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 border rounded-3 p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge bg-primary fw-semibold">${drive.vaccine}</span>
              ${doseBadge}
            </div>

            <h4 class="h6 fw-bold mb-1 text-dark">${drive.village_name} Village</h4>
            <div class="small text-muted mb-2">
              <i class="bi bi-geo-alt me-1"></i>${drive.block_name} Block, ${drive.district_name}, ${drive.state_name}
            </div>

            <div class="p-2 bg-light rounded border small mb-3">
              <div><i class="bi bi-calendar-event text-primary me-1"></i><strong>Date:</strong> ${drive.drive_date.split('T')[0]}</div>
              <div><i class="bi bi-clock text-primary me-1"></i><strong>Time:</strong> ${drive.time}</div>
              <div><i class="bi bi-people text-primary me-1"></i><strong>Target:</strong> ${drive.target_group}</div>
              <div><i class="bi bi-hospital text-primary me-1"></i><strong>Linked PHC:</strong> ${drive.phc_name}</div>
            </div>

            <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
              <a href="tel:${drive.phc_phone}" class="btn btn-sm btn-outline-primary fw-semibold">
                <i class="bi bi-telephone-fill me-1"></i> ${drive.phc_phone}
              </a>
              <span class="badge bg-success-subtle text-success border">100% Free UIP</span>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = cardsHtml;
  } catch (err) {
    grid.innerHTML = '<div class="col-12 text-center text-danger py-4">Failed to load vaccination drives.</div>';
  }
}

// ==============================================================================
// 7. Area Outbreak Alerts - Prompt 4.4
// ==============================================================================
function initAreaAlerts() {
  const levelSel = document.getElementById('filter-alert-level');
  const sevSel = document.getElementById('filter-alert-severity');
  const statSel = document.getElementById('filter-alert-status');

  [levelSel, sevSel, statSel].forEach(s => {
    if (s) s.addEventListener('change', loadAreaAlerts);
  });

  loadAreaAlerts();
}

async function loadAreaAlerts() {
  const listContainer = document.getElementById('area-alerts-list');
  if (!listContainer) return;

  const levelSel = document.getElementById('filter-alert-level');
  const sevSel = document.getElementById('filter-alert-severity');
  const statSel = document.getElementById('filter-alert-status');

  const params = {};
  if (levelSel && levelSel.value) params.area_level = levelSel.value;
  if (sevSel && sevSel.value) params.level = sevSel.value;
  if (statSel && statSel.value) params.status = statSel.value;

  try {
    const res = await API.getAlerts(params);
    if (!res.success || !res.data || res.data.length === 0) {
      listContainer.innerHTML = `
        <div class="p-4 text-center text-muted border rounded-3 bg-light">
          <i class="bi bi-check2-circle fs-2 text-success mb-2"></i>
          <div>No outbreak alerts found matching criteria.</div>
        </div>
      `;
      return;
    }

    let html = '';
    res.data.forEach(alert => {
      const badgeClass = alert.level === 'critical' ? 'bg-danger text-white' :
                         alert.level === 'high' ? 'bg-warning text-dark' : 'bg-info text-dark';
      const borderClass = alert.level === 'critical' ? 'border-danger alert-pulse-critical' :
                          alert.level === 'high' ? 'border-warning alert-pulse-warning' : 'border-info';

      html += `
        <div class="card p-3 border rounded-3 shadow-sm ${borderClass} bg-white">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge ${badgeClass} text-uppercase me-2">${alert.level}</span>
              <span class="badge bg-secondary-subtle text-secondary font-monospace me-2">${alert.area_level || 'District'}: ${alert.area_name || alert.city}</span>
              <span class="badge bg-light text-muted border">${alert.disease_name || 'Disease Surveillance'}</span>
            </div>
            <span class="badge ${alert.status === 'active' ? 'bg-danger' : 'bg-success'} text-capitalize">${alert.status}</span>
          </div>

          <h4 class="h6 fw-bold text-dark mb-1">${alert.message}</h4>
          <div class="d-flex justify-content-between align-items-center text-muted small mt-2 pt-2 border-top">
            <span><i class="bi bi-clock me-1"></i>Reported: ${new Date(alert.created_at).toLocaleString()}</span>
            <span class="text-primary fw-semibold"><i class="bi bi-shield-check me-1"></i>Trigger Monitored (ECA)</span>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
  } catch (err) {
    listContainer.innerHTML = '<div class="p-3 text-danger">Failed to load alerts.</div>';
  }
}

// ==============================================================================
// 8. Rural AI Symptom Checker & Facility Guidance - Prompt 4.5
// ==============================================================================
function initSymptomChecker() {
  const btnRun = document.getElementById('btn-run-symptom-check');
  if (!btnRun) return;

  btnRun.addEventListener('click', () => {
    const symptom = document.getElementById('symptom-chief').value;
    const group = document.getElementById('symptom-group').value;
    const isUnconscious = document.getElementById('danger-unconscious').checked;
    const isBreathless = document.getElementById('danger-breath').checked;
    const isSeizure = document.getElementById('danger-seizure').checked;

    const resultBox = document.getElementById('symptom-result-box');
    if (!resultBox) return;

    if (!symptom) {
      resultBox.innerHTML = `
        <div class="alert alert-warning mb-0">
          <i class="bi bi-exclamation-circle me-1"></i> Please choose a primary symptom from the dropdown.
        </div>
      `;
      return;
    }

    const hasDangerSign = isUnconscious || isBreathless || isSeizure;

    let urgency = 'routine';
    let facility = 'PHC';
    let title = '';
    let advice = '';
    let firstAid = '';
    let categoryLink = 'general';

    if (symptom === 'snakebite') {
      urgency = 'critical';
      facility = 'Community Health Centre (CHC) or District Hospital';
      title = 'SNAKEBITE EMERGENCY (सर्पदंश आपातकाल)';
      advice = 'Do NOT waste time at a Sub-centre. Rush immediately to a CHC or Hospital equipped with Polyvalent Anti-Snake Venom (ASV) and oxygen.';
      firstAid = 'Keep the victim calm and strictly IMMOBILIZE the bitten limb with a splint. Do NOT cut, suck venom, or tie tight tourniquets. Call 108 immediately.';
      categoryLink = 'injury';
    } else if (symptom === 'labor') {
      urgency = 'critical';
      facility = 'PHC / 24x7 CHC (JSY Delivery Centre)';
      title = 'ACTIVE MATERNAL LABOR (प्रसव पीड़ा)';
      advice = 'Transport the mother immediately to a 24x7 PHC or CHC. Normal institutional deliveries are 100% free under Janani Suraksha Yojana with direct cash incentive.';
      firstAid = 'Call 102 (Janani Express) or 108 ambulance. Keep mother warm. Pack ANC card and clean clothes.';
      categoryLink = 'delivery';
    } else if (symptom === 'fever_severe' || hasDangerSign) {
      urgency = 'urgent';
      facility = 'Primary Health Centre (PHC)';
      title = 'HIGH SUSPECT OUTBREAK FEVER (गंभीर बुखार)';
      advice = 'Requires immediate blood smear and rapid antigen test for Malaria (NVBDCP) or Dengue NS1. Complete test & medicine pack is 100% free at PHC.';
      firstAid = 'Cold sponging on forehead. Administer Paracetamol. Do NOT give Aspirin/Ibuprofen if Dengue is suspected.';
      categoryLink = 'fever';
    } else if (symptom === 'diarrhea_severe') {
      urgency = hasDangerSign ? 'critical' : 'urgent';
      facility = 'Primary Health Centre (PHC) / Sub-centre';
      title = 'ACUTE DIARRHEA & DEHYDRATION (तीव्र दस्त व निर्जलीकरण)';
      advice = 'Severe risk of hypovolemic shock in children and elderly. Visit nearest PHC for free ORS sachets and IV fluid resuscitation.';
      firstAid = 'Start ORS solution immediately (1 packet in 1 liter clean boiled water). Continue breastfeeding. Give Zinc tablets for children.';
      categoryLink = 'medicines';
    } else if (symptom === 'dog_bite') {
      urgency = 'urgent';
      facility = 'Primary Health Centre (PHC) / CHC';
      title = 'ANIMAL BITE / RABIES EXPOSURE (रेबीज रोकथाम)';
      advice = 'Category II/III bite requires Anti-Rabies Vaccine (ARV) day 0 dose immediately. 100% free at government PHCs.';
      firstAid = 'Wash wound under running water with soap for at least 15 continuous minutes. Do NOT apply chili, lime, or bandage. Get Tetanus Toxoid shot.';
      categoryLink = 'injury';
    } else if (symptom === 'trauma') {
      urgency = 'critical';
      facility = 'Community Health Centre (CHC) / Trauma Unit';
      title = 'SEVERE TRAUMA / FRACTURE / BLEEDING (गंभीर चोट)';
      advice = 'Requires wound debridement, sterile suturing, or X-Ray radiology at nearest CHC.';
      firstAid = 'Apply firm pressure with clean cloth over bleeding site. Immobilize limb if fracture suspected. Call 108.';
      categoryLink = 'injury';
    } else if (symptom === 'tb_cough') {
      urgency = 'routine';
      facility = 'Primary Health Centre (PHC)';
      title = 'SUSPECTED TUBERCULOSIS (टीबी जांच)';
      advice = 'Persistent cough > 2 weeks qualifies for free Sputum Microscopy and CBNAAT GeneXpert test under NTEP.';
      firstAid = 'Wear a cloth mask. Free anti-TB DOTS medicines provided upon test confirmation.';
      categoryLink = 'tests';
    } else {
      urgency = 'routine';
      facility = 'Health Sub-centre or Primary Health Centre (PHC)';
      title = 'PRIMARY OUTPATIENT CARE (प्राथमिक परामर्श)';
      advice = 'Visit your local Health Sub-centre or PHC during outpatient hours for free consultation and generic medication.';
      firstAid = 'Rest, hydration, and fever monitoring.';
      categoryLink = 'general';
    }

    const urgencyBadge = urgency === 'critical' ?
      '<span class="badge bg-danger fs-6 py-2 px-3"><i class="bi bi-exclamation-octagon-fill me-1"></i>CRITICAL EMERGENCY (आपातकालीन)</span>' :
      urgency === 'urgent' ?
      '<span class="badge bg-warning text-dark fs-6 py-2 px-3"><i class="bi bi-exclamation-triangle-fill me-1"></i>URGENT VISIT (तत्काल जाएं)</span>' :
      '<span class="badge bg-success fs-6 py-2 px-3"><i class="bi bi-check-circle-fill me-1"></i>ROUTINE OPD (नियमित जांच)</span>';

    resultBox.innerHTML = `
      <div class="p-3 border rounded-3 ${urgency === 'critical' ? 'bg-danger-subtle border-danger' : 'bg-light'}">
        <div class="mb-3">${urgencyBadge}</div>
        <h4 class="h6 fw-bold text-dark mb-2">${title}</h4>
        
        <div class="p-2 bg-white rounded border mb-3">
          <div class="small fw-bold text-primary mb-1"><i class="bi bi-hospital me-1"></i>Recommended Facility Level:</div>
          <div class="fw-bold text-dark">${facility}</div>
        </div>

        <p class="small text-muted mb-2">${advice}</p>

        <div class="alert alert-info py-2 px-3 small mb-3">
          <strong><i class="bi bi-bandaid me-1"></i>Immediate First-Aid:</strong> ${firstAid}
        </div>

        <div class="d-flex gap-2">
          ${urgency === 'critical' ? `<a href="tel:108" class="btn btn-danger btn-sm fw-bold"><i class="bi bi-telephone-fill me-1"></i> Call 108</a>` : ''}
          <button class="btn btn-sm btn-primary fw-bold" onclick="document.querySelector('.sidebar-link[data-section=\\'budget\\']').click(); document.getElementById('budget-category').value = '${categoryLink}'; loadAffordableServices();">
            <i class="bi bi-search me-1"></i> Find Affordable Care & PHCs for this Need
          </button>
        </div>
      </div>
    `;
  });
}

// ==============================================================================
// 9. PHC Directory & Bed Inventory
// ==============================================================================
async function loadPHCs() {
  const container = document.getElementById('phc-cards-container');
  if (!container) return;

  try {
    const res = await API.getPHCs();
    PublicState.phcs = res.success ? res.data : [];
    renderPHCCards(PublicState.phcs);
  } catch (err) {
    container.innerHTML = '<div class="col-12 text-center text-danger py-4">Failed to load PHC directory.</div>';
  }

  // Filter bindings
  const qInput = document.getElementById('search-phc-query');
  const typeSel = document.getElementById('filter-phc-type');
  const docSel = document.getElementById('filter-phc-doctor');
  const ambSel = document.getElementById('filter-phc-amb');

  function applyPHCFilters() {
    let filtered = [...PublicState.phcs];
    const q = qInput ? qInput.value.toLowerCase().trim() : '';
    const type = typeSel ? typeSel.value : '';
    const doc = docSel ? docSel.value : '';
    const amb = ambSel ? ambSel.value : '';

    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.district_name && p.district_name.toLowerCase().includes(q))
      );
    }
    if (type) filtered = filtered.filter(p => p.facility_type === type);
    if (doc === 'true') filtered = filtered.filter(p => p.doctor_available);
    if (amb === 'true') filtered = filtered.filter(p => p.ambulance_available);

    renderPHCCards(filtered);
  }

  [qInput, typeSel, docSel, ambSel].forEach(el => {
    if (el) el.addEventListener('input', applyPHCFilters);
  });
}

function renderPHCCards(phcs) {
  const container = document.getElementById('phc-cards-container');
  if (!container) return;

  if (phcs.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-4 text-muted">No PHCs match the search filters.</div>';
    return;
  }

  let html = '';
  phcs.forEach(p => {
    const typeBadge = p.facility_type === 'CHC' ? 'bg-primary' :
                      p.facility_type === 'Sub-centre' ? 'bg-secondary' : 'bg-teal text-white';
    const doctorBadge = p.doctor_available ?
      '<span class="badge bg-success-subtle text-success border"><i class="bi bi-person-check me-1"></i>Doctor Available</span>' :
      '<span class="badge bg-warning-subtle text-dark border">Doctor on Call</span>';
    const ambulanceBadge = p.ambulance_available ?
      '<span class="badge bg-info-subtle text-primary border"><i class="bi bi-truck me-1"></i>Ambulance Ready</span>' :
      '<span class="badge bg-light text-muted border">No Ambulance</span>';

    const pctFree = p.total_beds > 0 ? Math.round((p.available_beds / p.total_beds) * 100) : 0;
    const progressClass = pctFree > 30 ? 'progress-bed-bar-green' :
                          pctFree >= 10 ? 'progress-bed-bar-amber' : 'progress-bed-bar-red';

    html += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 border rounded-3 p-3 shadow-sm hover-shadow">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge ${typeBadge} small" style="background:#0d9488;">${p.facility_type}</span>
            <span class="badge bg-light text-secondary border font-monospace">${p.open_hours || '24x7'}</span>
          </div>

          <h4 class="h6 fw-bold mb-1 text-dark">${p.name}</h4>
          <div class="small text-muted mb-2">
            <i class="bi bi-geo-alt me-1"></i>${p.village_name ? p.village_name + ', ' : ''}${p.district_name || p.city}, ${p.state}
          </div>

          <div class="mb-3">
            <div class="d-flex justify-content-between small text-muted mb-1">
              <span>Bed Availability:</span>
              <strong class="text-dark">${p.available_beds} of ${p.total_beds} Free (${pctFree}%)</strong>
            </div>
            <div class="progress progress-bed">
              <div class="progress-bar ${progressClass}" style="width: ${pctFree}%;"></div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-1 mb-3">
            ${doctorBadge}
            ${ambulanceBadge}
            <span class="badge bg-light text-dark border">ICU: ${p.available_icu}/${p.total_icu}</span>
          </div>

          <!-- Feedback Badge -->
          <div class="feedback-badge-box mb-2" id="fb-badge-dir-${p.phc_id}">
            <span class="badge bg-light text-muted border small">Checking reports...</span>
          </div>

          <div class="mt-auto d-flex flex-wrap gap-2 justify-content-between align-items-center pt-2 border-top">
            <div class="d-flex gap-1">
              <a href="tel:${p.phone}" class="btn btn-sm btn-outline-success fw-bold">
                <i class="bi bi-telephone-fill me-1"></i> ${p.phone}
              </a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}" target="_blank" class="btn btn-sm btn-outline-primary fw-medium">
                <i class="bi bi-signpost-2 me-1"></i> Directions
              </a>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-info fw-semibold" onclick="showPhcMedicines(${p.phc_id}, '${escapeHtml(p.name)}')">
                <i class="bi bi-capsule me-1"></i> Medicines
              </button>
              <button class="btn btn-sm btn-outline-secondary fw-semibold" onclick="openFeedbackModal(${p.phc_id}, '${escapeHtml(p.name)}')">
                <i class="bi bi-chat-left-text me-1"></i> Feedback
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  phcs.forEach(p => {
    loadFeedbackBadge(p.phc_id, document.getElementById(`fb-badge-dir-${p.phc_id}`));
  });
}

// ==============================================================================
// 10. Historical EpiClim India Heat Map & Epidemiological Trends
// ==============================================================================
function initIndiaEpiMap() {
  const mapEl = document.getElementById('india-map');
  if (!mapEl) return;

  PublicState.indiaMap = L.map('india-map').setView([22.5, 82.0], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors | EpiClim Dataset'
  }).addTo(PublicState.indiaMap);

  const btnReset = document.getElementById('btn-reset-map-view');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      PublicState.indiaMap.setView([22.5, 82.0], 5);
    });
  }
}

async function initEpiclimSurveillance() {
  try {
    const res = await API.getEpiclimFilters();
    if (res.success && res.data) {
      PublicState.epiclimFilters = res.data;
      const disSel = document.getElementById('map-disease-filter');
      const yrSel = document.getElementById('map-year-filter');

      if (disSel && res.data.diseases) {
        disSel.innerHTML = '<option value="all">All Tracked Diseases</option>';
        res.data.diseases.forEach(d => {
          disSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
      }

      if (yrSel && res.data.years) {
        yrSel.innerHTML = '<option value="all">All Years Cumulative (2009-2022)</option>';
        res.data.years.forEach(y => {
          yrSel.innerHTML += `<option value="${y}">Year ${y}</option>`;
        });
      }

      if (disSel) disSel.addEventListener('change', loadHeatmapData);
      if (yrSel) yrSel.addEventListener('change', loadHeatmapData);

      await loadHeatmapData();
    }
  } catch (err) {
    console.error('Error initializing EpiClim filters:', err);
  }
}

async function loadHeatmapData() {
  if (!PublicState.indiaMap) return;

  const disSel = document.getElementById('map-disease-filter');
  const yrSel = document.getElementById('map-year-filter');
  const disease = disSel ? disSel.value : 'all';
  const year = yrSel ? yrSel.value : 'all';

  try {
    const res = await API.getHeatmap({ disease, year });
    if (!res.success || !res.data) return;

    // Clear old markers
    PublicState.heatmapMarkers.forEach(m => PublicState.indiaMap.removeLayer(m));
    PublicState.heatmapMarkers = [];

    res.data.forEach(pt => {
      if (!pt.lat || !pt.lng) return;
      const radius = Math.min(25, Math.max(6, Math.sqrt(pt.cases) * 0.4));
      const marker = L.circleMarker([pt.lat, pt.lng], {
        radius: radius,
        fillColor: pt.cases > 5000 ? '#dc2626' : pt.cases > 1000 ? '#ea580c' : '#f59e0b',
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.7
      }).addTo(PublicState.indiaMap);

      marker.bindPopup(`
        <strong>${pt.district || 'District'}, ${pt.state || 'State'}</strong><br>
        Cases: <strong>${pt.cases.toLocaleString()}</strong><br>
        Deaths: ${pt.deaths || 0}<br>
        <small class="text-muted">EpiClim IDSP Record</small>
      `);

      PublicState.heatmapMarkers.push(marker);
    });
  } catch (err) {
    console.error('Error loading heatmap:', err);
  }
}

async function loadTrendCharts() {
  const trendCanvas = document.getElementById('trendChart');
  const catCanvas = document.getElementById('categoryChart');

  if (trendCanvas) {
    try {
      const res = await API.getStatsTrend({ days: 30 });
      if (res.success && res.data) {
        const labels = res.data.map(d => d.date);
        const cases = res.data.map(d => d.cases);
        const recoveries = res.data.map(d => d.recoveries);

        if (PublicState.trendChart) PublicState.trendChart.destroy();
        PublicState.trendChart = new Chart(trendCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Admissions',
                data: cases,
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                tension: 0.3,
                fill: true
              },
              {
                label: 'Recoveries',
                data: recoveries,
                borderColor: '#10b981',
                backgroundColor: 'transparent',
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
    } catch (e) {}
  }

  if (catCanvas) {
    try {
      const res = await API.getStatsCategories();
      if (res.success && res.data) {
        const labels = res.data.map(c => c.category);
        const data = res.data.map(c => c.total_cases);

        if (PublicState.categoryChart) PublicState.categoryChart.destroy();
        PublicState.categoryChart = new Chart(catCanvas, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: ['#0d9488', '#0284c7', '#f59e0b', '#dc2626']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
    } catch (e) {}
  }
}

// ==============================================================================
// 11. Weather Telemetry & Citizen Grievance Form
// ==============================================================================
async function loadWeatherTelemetry(city) {
  try {
    const res = await API.getWeather(city);
    if (res.success && res.data) {
      const d = res.data;
      const elT = document.getElementById('weather-temp');
      const elH = document.getElementById('weather-humidity');
      const elR = document.getElementById('weather-rainfall');

      if (elT) elT.textContent = d.temperature ? `${d.temperature} °C` : '28.5 °C';
      if (elH) elH.textContent = d.humidity ? `${d.humidity} %` : '65 %';
      if (elR) elR.textContent = d.rainfall ? `${d.rainfall} mm` : '12.4 mm';
    }
  } catch (e) {}
}

async function loadDiseases() {
  try {
    const res = await API.getDiseases();
    if (res.success) PublicState.diseases = res.data;
  } catch (e) {}
}

function initComplaintForm() {
  const form = document.getElementById('complaint-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = document.getElementById('complaint-city').value.trim();
    const description = document.getElementById('complaint-desc').value.trim();

    if (!description) return;

    try {
      const res = await API.submitComplaint({ city, description });
      if (res.success) {
        showToast('Your feedback has been submitted to the rural health authorities.', 'success');
        form.reset();
      }
    } catch (err) {
      showToast('Failed to submit feedback: ' + err.message, 'danger');
    }
  });
}

// ==============================================================================
// ADD-ONS CONTROLLERS (Total Cost of Care, Medicine Fallback, Doctor Feedback)
// ==============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------------------------
// FEATURE 1: Total Cost of Care Calculator
// ------------------------------------------------------------------------------
function initTotalCostCalculator() {
  const btn = document.getElementById('btn-calc-total-cost');
  if (!btn) return;

  // Attempt to load travel modes from backend
  API.getCostModes().then(modes => {
    const select = document.getElementById('cost-mode-select');
    if (select && Array.isArray(modes) && modes.length) {
      select.innerHTML = modes.map(m => `<option value="${m.mode_code}">${m.label_en}</option>`).join('');
      select.value = 'bus';
    }
  }).catch(() => {});

  btn.addEventListener('click', calculateTotalCost);
}

async function calculateTotalCost() {
  const needSelect = document.getElementById('cost-need-select');
  const modeSelect = document.getElementById('cost-mode-select');
  const wageInput = document.getElementById('cost-wage-input');
  const resultsContainer = document.getElementById('cost-government-results');

  const category = needSelect ? needSelect.value : 'Consultation';
  const mode = modeSelect ? modeSelect.value : 'bus';
  const wage = wageInput ? wageInput.value : '300';

  const coords = PublicState.selectedVillageCoords || PublicState.userGPSCoords || { lat: 19.2612, lng: 73.9854 };

  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="col-12 text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        Calculating total cost of care across facilities (sp_total_cost_of_care)...
      </div>
    `;
  }

  try {
    const res = await API.compareCost({
      lat: coords.lat,
      lng: coords.lng,
      category,
      mode,
      wage
    });

    const govList = res.government || [];
    const priv = res.privateOption;

    // 1. Savings Banner
    const savingsBanner = document.getElementById('cost-savings-banner');
    const savingsText = document.getElementById('cost-savings-text');
    if (govList.length > 0 && priv) {
      const best = govList[0];
      const diff = Math.round(Number(priv.total_cost) - Number(best.total_cost));
      if (diff > 0 && savingsBanner && savingsText) {
        savingsText.textContent = `You could save about Rs. ${diff} compared with a private clinic (estimate).`;
        savingsBanner.classList.remove('d-none');
      } else if (savingsBanner) {
        savingsBanner.classList.add('d-none');
      }
    } else if (savingsBanner) {
      savingsBanner.classList.add('d-none');
    }

    // 2. Private Benchmark Card
    if (priv) {
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('priv-clinic-name', priv.phc_name || 'Private clinic (typical) (Sample)');
      setVal('priv-distance', priv.distance_km || '12');
      setVal('priv-service-cost', '₹' + Math.round(Number(priv.service_cost)));
      setVal('priv-travel-cost', '₹' + Math.round(Number(priv.travel_cost)));
      setVal('priv-wage-loss', '₹' + Math.round(Number(priv.wage_loss)));
      setVal('priv-total-cost', '₹' + Math.round(Number(priv.total_cost)));
    }

    // 3. Stacked Bar Chart
    const canvas = document.getElementById('costChart');
    if (canvas && typeof Chart !== 'undefined') {
      if (PublicState.costBarChart) {
        PublicState.costBarChart.destroy();
      }

      const labels = [];
      const svc = [];
      const trv = [];
      const wag = [];

      if (govList.length > 0) {
        const topGov = govList.slice(0, 3);
        topGov.forEach(g => {
          labels.push(g.phc_name);
          svc.push(Number(g.service_cost));
          trv.push(Number(g.travel_cost));
          wag.push(Number(g.wage_loss));
        });
      }

      if (priv) {
        labels.push('Private clinic (typical) (Sample)');
        svc.push(Number(priv.service_cost));
        trv.push(Number(priv.travel_cost));
        wag.push(Number(priv.wage_loss));
      }

      PublicState.costBarChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Service Cost', data: svc, backgroundColor: '#0d9488' },
            { label: 'Travel Cost', data: trv, backgroundColor: '#3b82f6' },
            { label: 'Lost Wage', data: wag, backgroundColor: '#f59e0b' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: {
              stacked: true,
              title: { display: true, text: 'Rupees (estimate)' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                footer: (items) => {
                  let total = 0;
                  items.forEach(i => { total += i.parsed.y; });
                  return 'Total: ₹' + total + ' (Estimate)';
                }
              }
            }
          }
        }
      });
    }

    // 4. Render Government Facilities
    if (govList.length === 0) {
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="col-12 text-center py-4 text-muted">No centre offers this service nearby.</div>';
      }
      return;
    }

    let govCards = '';
    govList.forEach((g, idx) => {
      const isFree = Number(g.is_free) === 1 || Number(g.service_cost) === 0;
      const freeBadge = isFree ?
        '<span class="badge bg-success-subtle text-success border fw-bold me-1">100% FREE</span>' :
        `<span class="badge bg-light text-dark border fw-bold me-1">₹${g.service_cost}</span>`;

      const schemeTag = g.scheme_name ?
        `<span class="badge bg-info-subtle text-primary border small">${g.scheme_name}</span>` : '';

      govCards += `
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 border rounded-3 p-3 shadow-sm hover-shadow">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <span class="badge bg-teal text-white small me-1" style="background:#0d9488;">${g.facility_type}</span>
                ${idx === 0 ? '<span class="badge bg-success small">Best Value</span>' : ''}
                <h6 class="fw-bold text-dark mt-1 mb-0">${g.phc_name}</h6>
              </div>
              <div class="text-end">
                <div class="text-success fw-bold fs-5 font-monospace">₹${g.total_cost}</div>
                <small class="text-muted" style="font-size:0.75rem;">Total (Estimate)</small>
              </div>
            </div>

            <div class="small text-muted mb-2">
              <i class="bi bi-geo-alt me-1"></i>Distance: <strong>${g.distance_km} km</strong> •
              <i class="bi bi-clock me-1"></i>${g.operating_hours || '24x7'}
            </div>

            <div class="p-2 bg-light rounded border small mb-3">
              <div class="fw-semibold text-dark mb-1">${g.service_name}</div>
              <div class="d-flex flex-wrap gap-1 mb-2">
                ${freeBadge}
                ${schemeTag}
              </div>
              <div class="d-flex justify-content-between text-muted border-top pt-1">
                <span>Service Fee:</span>
                <strong>₹${g.service_cost}</strong>
              </div>
              <div class="d-flex justify-content-between text-muted">
                <span>Travel (${mode}):</span>
                <strong>₹${g.travel_cost} (Estimate)</strong>
              </div>
              <div class="d-flex justify-content-between text-muted">
                <span>Wage Loss:</span>
                <strong>₹${g.wage_loss} (Estimate)</strong>
              </div>
            </div>

            <div class="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
              ${g.contact_phone ? `
                <a href="tel:${g.contact_phone}" class="btn btn-sm btn-outline-success fw-bold">
                  <i class="bi bi-telephone me-1"></i> Call
                </a>
              ` : '<span></span>'}
              <button class="btn btn-sm btn-outline-info" onclick="showPhcMedicines(${g.phc_id}, '${escapeHtml(g.phc_name)}')">
                <i class="bi bi-capsule me-1"></i> Medicines
              </button>
            </div>
          </div>
        </div>
      `;
    });

    if (resultsContainer) {
      resultsContainer.innerHTML = govCards;
    }

  } catch (err) {
    console.error('Error in calculateTotalCost:', err);
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div class="col-12 text-center py-4 text-danger">${err.message || 'Could not calculate cost'}</div>`;
    }
  }
}

// ------------------------------------------------------------------------------
// FEATURE 2: Medicine Fallback & Pharmacy Stock Modal
// ------------------------------------------------------------------------------
async function showPhcMedicines(phcId, phcName) {
  const titleEl = document.getElementById('phc-med-modal-facility');
  if (titleEl) titleEl.textContent = phcName || '';

  const tbody = document.getElementById('phc-med-modal-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Loading pharmacy stock...</td></tr>';
  }

  const modalEl = document.getElementById('modal-phc-medicines');
  let bsModal = bootstrap.Modal.getInstance(modalEl);
  if (!bsModal) bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();

  try {
    const res = await API.getPHCMedicines(phcId);
    const medicines = (res && res.data) ? res.data : [];

    if (!tbody) return;
    if (medicines.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No medicines logged for this facility.</td></tr>';
      return;
    }

    tbody.innerHTML = medicines.map(m => {
      const isOut = Number(m.stock) <= 0;
      const stockBadge = isOut ?
        '<span class="badge bg-danger" data-i18n="med.out">Out of stock</span>' :
        `<span class="badge bg-success font-monospace">${m.stock} in stock</span>`;

      const actionBtn = isOut ? `
        <button class="btn btn-sm btn-warning text-dark fw-bold" onclick="findMedicineFallback(${phcId}, ${m.medicine_id}, '${escapeHtml(m.name)}')">
          <i class="bi bi-geo-alt-fill me-1"></i> <span data-i18n="med.find">Find nearby</span>
        </button>
      ` : '<span class="text-muted small">In Stock</span>';

      return `
        <tr>
          <td class="fw-bold text-dark">${m.name}</td>
          <td class="text-muted small">${m.salt_composition || '--'}</td>
          <td class="text-muted small">${m.strength || '--'}</td>
          <td>${stockBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load medicines: ${err.message}</td></tr>`;
  }
}

async function findMedicineFallback(phcId, medicineId, medicineName) {
  const titleEl = document.getElementById('fallback-medicine-name');
  if (titleEl) titleEl.textContent = medicineName || '';

  const otherList = document.getElementById('fallback-other-phcs-list');
  const sameList = document.getElementById('fallback-same-centre-list');
  const sameContainer = document.getElementById('fallback-same-centre-container');
  const janList = document.getElementById('fallback-jan-aushadhi-list');

  if (otherList) otherList.innerHTML = '<div class="col-12 text-center py-3 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Searching nearby PHCs with stock...</div>';
  if (sameList) sameList.innerHTML = '';
  if (janList) janList.innerHTML = '<div class="col-12 text-center py-3 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Searching Jan Aushadhi generic stores...</div>';

  const modalEl = document.getElementById('modal-medicine-fallback');
  let bsModal = bootstrap.Modal.getInstance(modalEl);
  if (!bsModal) bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();

  try {
    const coords = PublicState.selectedVillageCoords || PublicState.userGPSCoords || { lat: 19.2612, lng: 73.9854 };
    const res = await API.getMedicineFallback({
      phcId,
      medicineId,
      lat: coords.lat,
      lng: coords.lng
    });

    // 1. Other PHCs
    if (otherList) {
      if (!res.otherPhcs || res.otherPhcs.length === 0) {
        otherList.innerHTML = '<div class="col-12 text-muted small p-2 bg-light rounded border">No other PHC currently has verified stock within search radius.</div>';
      } else {
        otherList.innerHTML = res.otherPhcs.map(p => `
          <div class="col-12 col-md-6">
            <div class="card p-3 border rounded shadow-sm h-100">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <span class="badge bg-primary small me-1">${p.facility_type}</span>
                  <strong class="text-dark">${p.phc_name}</strong>
                </div>
                <span class="badge bg-success font-monospace">${p.quantity} in stock</span>
              </div>
              <div class="small text-muted mb-2">
                <i class="bi bi-geo-alt me-1"></i><strong>${p.distance_km} km away</strong>
                ${p.data_may_be_old ? '<span class="badge bg-secondary-subtle text-muted ms-2 border" data-i18n="med.data_may_be_old">Data may be old</span>' : ''}
              </div>
              ${p.contact_phone ? `
                <div class="mt-auto pt-2 border-top">
                  <a href="tel:${p.contact_phone}" class="btn btn-sm btn-outline-success fw-bold w-100">
                    <i class="bi bi-telephone-fill me-1"></i> Call ${p.contact_phone}
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('');
      }
    }

    // 2. Same Centre Alternatives
    if (sameContainer && sameList) {
      if (!res.sameCentreAlternatives || res.sameCentreAlternatives.length === 0) {
        sameContainer.classList.add('d-none');
      } else {
        sameContainer.classList.remove('d-none');
        sameList.innerHTML = res.sameCentreAlternatives.map(alt => `
          <div class="col-12 col-md-6">
            <div class="card p-2 border rounded bg-success-subtle h-100">
              <div class="d-flex justify-content-between align-items-center">
                <strong class="text-success-emphasis">${alt.alternative_name}</strong>
                <span class="badge bg-success">${alt.quantity} units</span>
              </div>
              <small class="text-muted mt-1">Identical active salt & strength. Ask pharmacist before substituting.</small>
            </div>
          </div>
        `).join('');
      }
    }

    // 3. Jan Aushadhi Kendra (Generic Stores)
    if (janList) {
      if (!res.janAushadhi || res.janAushadhi.length === 0) {
        janList.innerHTML = '<div class="col-12 text-muted small p-2 bg-light rounded border">No Jan Aushadhi generic store mapped in this immediate area.</div>';
      } else {
        janList.innerHTML = res.janAushadhi.map(k => `
          <div class="col-12 col-md-4">
            <div class="card p-2 border rounded bg-light h-100">
              <strong class="text-dark small d-block mb-1">${k.name}</strong>
              <div class="small text-danger fw-bold"><i class="bi bi-geo-alt me-1"></i>${k.distance_km} km away</div>
              ${k.phone ? `<small class="text-muted"><i class="bi bi-telephone me-1"></i>${k.phone}</small>` : ''}
            </div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Failed to load fallback:', err);
    if (otherList) otherList.innerHTML = `<div class="col-12 text-danger small">${err.message || 'Could not load alternatives'}</div>`;
  }
}

// ------------------------------------------------------------------------------
// FEATURE 3: "Was the doctor there?" Feedback Loop
// ------------------------------------------------------------------------------
let currentFeedbackPhcId = null;
let selectedDoctorPresent = 'YES';
let selectedMedicineAvail = 'NOT_NEEDED';

function getDeviceId() {
  let id = localStorage.getItem('rcc_device_id');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dev-' + Math.random().toString(36).substring(2) + Date.now();
    localStorage.setItem('rcc_device_id', id);
  }
  return id;
}

function openFeedbackModal(phcId, phcName) {
  currentFeedbackPhcId = phcId;
  const display = document.getElementById('feedback-phc-name-display');
  if (display) display.textContent = phcName;

  selectedDoctorPresent = 'YES';
  selectedMedicineAvail = 'NOT_NEEDED';

  document.querySelectorAll('.btn-feedback-doc').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-value') === 'YES');
  });
  document.querySelectorAll('.btn-feedback-med').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-value') === 'NOT_NEEDED');
  });

  const modalEl = document.getElementById('modal-doctor-feedback');
  let bsModal = bootstrap.Modal.getInstance(modalEl);
  if (!bsModal) bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

function initFeedbackListeners() {
  document.querySelectorAll('.btn-feedback-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-feedback-doc').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDoctorPresent = btn.getAttribute('data-value');
    });
  });

  document.querySelectorAll('.btn-feedback-med').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-feedback-med').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMedicineAvail = btn.getAttribute('data-value');
    });
  });

  const submitBtn = document.getElementById('btn-submit-doctor-feedback');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!currentFeedbackPhcId) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Submitting...';

      try {
        const res = await API.sendFeedback({
          phcId: currentFeedbackPhcId,
          visitDate: new Date().toISOString().slice(0, 10),
          doctorPresent: selectedDoctorPresent,
          medicineAvailable: selectedMedicineAvail,
          deviceId: getDeviceId()
        });

        showToast(res.message || 'Thank you for helping your village.', 'success');

        const modalEl = document.getElementById('modal-doctor-feedback');
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();

        refreshPhcFeedbackBadges(currentFeedbackPhcId);

      } catch (err) {
        showToast(err.message || 'Could not save feedback', 'warning');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Submit Report';
      }
    });
  }
}

async function loadFeedbackBadge(phcId, el) {
  if (!el) return;
  try {
    const s = await API.getFeedbackSummary(phcId);
    if (!s || !s.enough) {
      el.innerHTML = '<span class="badge bg-secondary-subtle text-muted border small"><i class="bi bi-shield-slash me-1"></i>Not enough reports yet</span>';
      return;
    }

    const badgeClass = s.doctorPresentPct >= 70 ? 'bg-success' :
                       s.doctorPresentPct >= 40 ? 'bg-warning text-dark' : 'bg-danger';

    let conflictHtml = '';
    if (s.conflict) {
      conflictHtml = `
        <div class="small text-danger fw-bold mt-1">
          <i class="bi bi-exclamation-triangle-fill me-1"></i>Staff data says doctor is on duty, but villagers report otherwise. Call first.
        </div>
      `;
    }

    el.innerHTML = `
      <span class="badge ${badgeClass} small fw-semibold">
        <i class="bi bi-people-fill me-1"></i>Doctor present: ${s.doctorPresentPct}% of ${s.reports} reports
      </span>
      ${conflictHtml}
    `;
  } catch (err) {
    el.innerHTML = '';
  }
}

function refreshPhcFeedbackBadges(phcId) {
  const b1 = document.getElementById(`fb-badge-nearest-${phcId}`);
  if (b1) loadFeedbackBadge(phcId, b1);
  const b2 = document.getElementById(`fb-badge-dir-${phcId}`);
  if (b2) loadFeedbackBadge(phcId, b2);
}

