// ==============================================================================
// Rural Care Connect: Shared Client API Wrapper
// Handles HTTP communication with the Express REST API, session management,
// role checks, and UI utility helpers.
// Tagline: "Healthcare access for every village."
// ==============================================================================

const API = {
  baseURL: '/api',

  /**
   * Core fetch wrapper handling JSON parsing, cookies, and uniform error reporting
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const config = {
      method: options.method || 'GET',
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
      credentials: 'include', // essential for express-session cookie
      ...options
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = (data && data.error) ? data.error : `HTTP Error ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${config.method} ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ----------------------------------------------------------------------------
  // Authentication & Session
  // ----------------------------------------------------------------------------
  async login(username, password) {
    return this.request('/login', {
      method: 'POST',
      body: { username, password }
    });
  },

  async logout() {
    return this.request('/logout', {
      method: 'POST'
    });
  },

  async getMe() {
    return this.request('/me');
  },

  /**
   * Route guard: validates active session and ensures appropriate portal role
   * @param {'admin' | 'public' | 'asha'} expectedRole 
   */
  async checkAuth(expectedRole = null) {
    try {
      const me = await this.getMe();
      if (!me.authenticated) {
        window.location.href = '/login.html';
        return null;
      }

      if (expectedRole && me.role !== expectedRole) {
        // Redirect to their appropriate portal if they opened the wrong dashboard
        if (me.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else if (me.role === 'asha') {
          window.location.href = '/asha/dashboard.html';
        } else {
          window.location.href = '/public/dashboard.html';
        }
        return null;
      }

      return me;
    } catch (err) {
      window.location.href = '/login.html';
      return null;
    }
  },

  // ----------------------------------------------------------------------------
  // Real-time Summary Statistics & Analytics
  // ----------------------------------------------------------------------------
  async getStatsSummary() {
    return this.request('/stats/summary');
  },

  async getStatsTrend(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stats/trend${qs ? `?${qs}` : ''}`);
  },

  async getStatsCategories() {
    return this.request('/stats/categories');
  },

  async getEpiclimFilters() {
    return this.request('/stats/epiclim-filters');
  },

  async getHeatmap(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stats/heatmap${qs ? `?${qs}` : ''}`);
  },

  async getWeatherCases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/stats/weather-cases${qs ? `?${qs}` : ''}`);
  },

  // ----------------------------------------------------------------------------
  // Weather Telemetry
  // ----------------------------------------------------------------------------
  async getWeather(city = 'Pune Rural') {
    return this.request(`/weather?city=${encodeURIComponent(city)}`);
  },

  // ----------------------------------------------------------------------------
  // Primary Health Centres (PHC / CHC / Sub-centre) & Hospital Compatibility
  // ----------------------------------------------------------------------------
  async getPHCs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/phcs${qs ? `?${qs}` : ''}`);
  },

  async getHospitals(params = {}) {
    // Alias to getPHCs for backwards compatibility
    return this.getPHCs(params);
  },

  async getNearestPHCs(lat, lng, radius = 50) {
    return this.request(`/phcs/nearest?lat=${lat}&lng=${lng}&radius=${radius}`);
  },

  async getPHCById(id) {
    return this.request(`/phcs/${id}`);
  },

  async getHospitalById(id) {
    return this.getPHCById(id);
  },

  async getPHCMedicines(id) {
    return this.request(`/phcs/${id}/medicines`);
  },

  async createPHC(data) {
    return this.request('/phcs', {
      method: 'POST',
      body: data
    });
  },

  async createHospital(data) {
    return this.createPHC(data);
  },

  async updatePHC(id, data) {
    return this.request(`/phcs/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async updateHospital(id, data) {
    return this.updatePHC(id, data);
  },

  async deletePHC(id) {
    return this.request(`/phcs/${id}`, {
      method: 'DELETE'
    });
  },

  async deleteHospital(id) {
    return this.deletePHC(id);
  },

  // ----------------------------------------------------------------------------
  // Geographic Hierarchy (State > District > Block > Village)
  // ----------------------------------------------------------------------------
  async getGeographyHierarchy() {
    return this.request('/geography/hierarchy');
  },

  async getStates() {
    return this.request('/geography/states');
  },

  async getDistricts(stateId = null) {
    const qs = stateId ? `?state_id=${stateId}` : '';
    return this.request(`/geography/districts${qs}`);
  },

  async getBlocks(districtId = null) {
    const qs = districtId ? `?district_id=${districtId}` : '';
    return this.request(`/geography/blocks${qs}`);
  },

  async getVillages(blockId = null) {
    const qs = blockId ? `?block_id=${blockId}` : '';
    return this.request(`/geography/villages${qs}`);
  },

  // ----------------------------------------------------------------------------
  // Affordable Care by Budget
  // ----------------------------------------------------------------------------
  async getAffordableServices(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/services/affordable${qs ? `?${qs}` : ''}`);
  },

  async getServices(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/services${qs ? `?${qs}` : ''}`);
  },

  async createService(data) {
    return this.request('/services', {
      method: 'POST',
      body: data
    });
  },

  async updateService(id, data) {
    return this.request(`/services/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteService(id) {
    return this.request(`/services/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // Village Vaccination Drives
  // ----------------------------------------------------------------------------
  async getVaccinationDrives(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/vaccination-drives${qs ? `?${qs}` : ''}`);
  },

  async createVaccinationDrive(data) {
    return this.request('/vaccination-drives', {
      method: 'POST',
      body: data
    });
  },

  async updateVaccinationDrive(id, data) {
    return this.request(`/vaccination-drives/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteVaccinationDrive(id) {
    return this.request(`/vaccination-drives/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // ASHA Worker Operations
  // ----------------------------------------------------------------------------
  async getAshaProfile() {
    return this.request('/asha/profile');
  },

  async getAshaDashboard() {
    return this.request('/asha/dashboard');
  },

  async submitAshaRequest(data) {
    return this.request('/asha/requests', {
      method: 'POST',
      body: data
    });
  },

  async getAshaRequests() {
    return this.request('/asha/requests');
  },

  async updateAshaRequest(id, status) {
    return this.request(`/asha/requests/${id}`, {
      method: 'PUT',
      body: { status }
    });
  },

  // ----------------------------------------------------------------------------
  // Diseases & Thresholds
  // ----------------------------------------------------------------------------
  async getDiseases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/diseases${qs ? `?${qs}` : ''}`);
  },

  async createDisease(data) {
    return this.request('/diseases', {
      method: 'POST',
      body: data
    });
  },

  async updateDisease(id, data) {
    return this.request(`/diseases/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteDisease(id) {
    return this.request(`/diseases/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // Patient Cases & Admissions (sp_admit_patient, sp_close_case)
  // ----------------------------------------------------------------------------
  async getCases(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/cases${qs ? `?${qs}` : ''}`);
  },

  async admitPatient(data) {
    return this.request('/cases', {
      method: 'POST',
      body: data
    });
  },

  async closeCase(id, status) {
    return this.request(`/cases/${id}/close`, {
      method: 'PUT',
      body: { status }
    });
  },

  async updateCase(id, data) {
    return this.request(`/cases/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteCase(id) {
    return this.request(`/cases/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // Outbreak Alerts
  // ----------------------------------------------------------------------------
  async getAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/alerts${qs ? `?${qs}` : ''}`);
  },

  async createAlert(data) {
    return this.request('/alerts', {
      method: 'POST',
      body: data
    });
  },

  async resolveAlert(id) {
    return this.request(`/alerts/${id}/resolve`, {
      method: 'PUT'
    });
  },

  // ----------------------------------------------------------------------------
  // Medicine & Pharmacy Stock
  // ----------------------------------------------------------------------------
  async getMedicines(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/medicines${qs ? `?${qs}` : ''}`);
  },

  async getLowStockMedicines() {
    return this.request('/medicines/low-stock');
  },

  async createMedicine(data) {
    return this.request('/medicines', {
      method: 'POST',
      body: data
    });
  },

  async updateMedicine(id, data) {
    return this.request(`/medicines/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteMedicine(id) {
    return this.request(`/medicines/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // State-level Vaccination Coverage
  // ----------------------------------------------------------------------------
  async getVaccinationCoverage(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/vaccination${qs ? `?${qs}` : ''}`);
  },

  async addVaccination(data) {
    return this.request('/vaccination', {
      method: 'POST',
      body: data
    });
  },

  async updateVaccination(id, data) {
    return this.request(`/vaccination/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteVaccination(id) {
    return this.request(`/vaccination/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // Grievance Complaints
  // ----------------------------------------------------------------------------
  async submitComplaint(data) {
    return this.request('/complaints', {
      method: 'POST',
      body: data
    });
  },

  async getComplaints(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/complaints${qs ? `?${qs}` : ''}`);
  },

  async updateComplaint(id, status) {
    return this.request(`/complaints/${id}`, {
      method: 'PUT',
      body: { status }
    });
  },

  async deleteComplaint(id) {
    return this.request(`/complaints/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // User Management
  // ----------------------------------------------------------------------------
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/users${qs ? `?${qs}` : ''}`);
  },

  async createUser(data) {
    return this.request('/users', {
      method: 'POST',
      body: data
    });
  },

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // ----------------------------------------------------------------------------
  // Audit Trail
  // ----------------------------------------------------------------------------
  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/audit${qs ? `?${qs}` : ''}`);
  },

  // ----------------------------------------------------------------------------
  // Add-Ons: Total Cost of Care, Medicine Fallback, Doctor Feedback
  // ----------------------------------------------------------------------------
  async getCostModes() {
    return this.request('/cost/modes');
  },

  async compareCost(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/cost/compare${qs ? `?${qs}` : ''}`);
  },

  async getMedicineFallback(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/medicine-fallback${qs ? `?${qs}` : ''}`);
  },

  async sendFeedback(data) {
    return this.request('/feedback', {
      method: 'POST',
      body: data
    });
  },

  async getFeedbackSummary(phcId) {
    return this.request(`/feedback/summary/${phcId}`);
  },

  async getFeedbackFlags() {
    return this.request('/feedback/admin/flags');
  }
};

// ------------------------------------------------------------------------------
// UI Feedback Helpers (Toast Alerts)
// ------------------------------------------------------------------------------
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success' :
                  type === 'danger' ? 'bg-danger' :
                  type === 'warning' ? 'bg-warning text-dark' : 'bg-primary';

  toast.className = `toast align-items-center text-white ${bgClass} border-0 show mb-2 shadow`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-medium py-3 px-3">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
