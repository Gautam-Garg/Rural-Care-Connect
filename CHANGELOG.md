# Rural Care Connect: Migration Changelog

This document details the transition from **HealthWatch AI** to **Rural Care Connect**, fulfilling all requirements specified in `RURAL_CARE_CONNECT_MASTER_PROMPT.md`.

---

## 1. Summary of Changes

| Domain | Before (HealthWatch AI) | After (Rural Care Connect) |
|---|---|---|
| **Branding & Purpose** | Metro disease surveillance and private hospital tracker | "Rural Care Connect" (*Healthcare access for every village*) aligned with UN SDGs 3, 9, 10 |
| **Geographic Model** | Flat cities / metro areas | 3NF normalized hierarchy: `State` &rarr; `District` &rarr; `Block` &rarr; `Village` across Maharashtra, Madhya Pradesh, and Bihar |
| **Healthcare Facilities** | Metro Hospitals (AIIMS, Apollo, Fortis) | Primary Health Centres (PHC), Community Health Centres (CHC), and Sub-centres with doctor shifts and 108 ambulance stations |
| **Target User Groups** | Public Citizen, Administrator | Public Citizen, ASHA Grassroots Field Worker, Administrator |
| **Distance Calculation** | Client-side approximations | MySQL 8 Stored Procedure `sp_nearest_phc` implementing spherical Haversine formula |
| **Financial Transparency** | Generic bed occupancy | Affordable Care by Budget (`v_affordable_services`) mapping care to government schemes (JSY, Ayushman Bharat, Jan Aushadhi) |
| **Immunization** | State-level aggregates | Village-level camps (`Vaccination_Drive`) with automated database trigger (`trg_vaccine_drive_stockout`) |
| **Language Support** | English only | Trilingual localization (English, Hindi, Marathi) with instant dynamic switching |
| **Connectivity** | Standard broadband layout | Integrated Low-Bandwidth Mode optimized for rural 2G/3G mobile networks |
| **Emergency Access** | Standard phone fields | Prominently pinned Emergency 108 / Maternal 102 single-tap helpline links |

---

## 2. Preserved Components (Zero Data Loss)

1. **Historical Epidemiology Dataset (`Disease_Stats`):**
   - All **8,974 historical EpiClim disease records** were completely preserved during migration.
   - Preserves state, district, year, cases, deaths, temperature, precipitation, and GPS coordinates.
2. **Analytical Dashboards & Visualizations:**
   - Chart.js epidemiology timelines and transmission distribution charts.
   - Leaflet geospatial outbreak heat maps.
   - Weather-disease correlation charts.
3. **Public Grievance System (`Complaints`):**
   - Citizen sanitation and water contamination grievance submission and administrative review workflow.
4. **Audit Logging & Security:**
   - Immutable `Audit_Log` table with transactional timestamps and user attribution.
   - Bcrypt password hashing (10 rounds).

---

## 3. Database Changes

### 3.1 New Tables Added
- `State`: 3 rural states (Maharashtra, Madhya Pradesh, Bihar).
- `District`: 10 rural districts (Pune, Ahmednagar, Satara, Nashik, Bhopal, Sehore, Raisen, Patna, Nalanda, Vaishali).
- `Block`: 20 rural blocks/talukas.
- `Village`: 45 rural villages with census populations and GPS coordinates.
- `PHC`: 30 primary health centres, CHCs, and sub-centres.
- `Service_Cost`: 70 procedure pricing rows with government scheme sponsorships.
- `Vaccination_Drive`: 18 village immunization drive campaigns.
- `ASHA_Worker`: 5 grassroots field health workers.
- `ASHA_Request`: Field alerts and emergency transport transmissions.

### 3.2 Schema Migrations & Views
- `Users.role`: Expanded ENUM to include `'asha'`.
- `Alerts`: Added `area_level`, `area_id`, and `area_name` for village and block targeting.
- `Hospital`: Renamed legacy base table to `Hospital_legacy` and created backward-compatible view `Hospital` pointing to `PHC`.
- `Patient_Cases`: Added `village_id` foreign key.
- `vw_bed_availability`: Created view calculating live PHC bed and ICU occupancy.
- `v_affordable_services`: Created view linking services, costs, and PHC locations.
- `vw_upcoming_drives`: Created view for village vaccination schedules.

### 3.3 Stored Procedures & Triggers
- `sp_nearest_phc`: Implemented Haversine distance in pure SQL.
- `sp_admit_patient`: Updated to acquire row lock on `PHC` and enforce bed capacity.
- `sp_close_case`: Updated to restore bed capacity to `PHC`.
- `trg_vaccine_drive_stockout`: Automated trigger auto-firing alert when drive doses reach 0.
- `trg_case_alert`: Trigger checking weekly outbreak threshold on patient admissions.

---

## 4. Backend & API Enhancements

- Added `/api/phcs`: CRUD for PHCs and `/nearest` endpoint calling `sp_nearest_phc`.
- Kept `/api/hospitals`: Backwards-compatible alias for existing frontend modules.
- Added `/api/geography`: `/tree`, `/states`, `/districts`, `/blocks`, `/villages`.
- Added `/api/services`: `/affordable` and `/budget` endpoints filtering by budget.
- Added `/api/vaccination-drives`: `/upcoming` camp schedules.
- Added `/api/asha`: Profile, village dashboard, patient admission, emergency request submission.
- Added `/api/stats/historical`: Direct paginated access to the preserved 8,974 EpiClim records.
- Updated `backend/middleware/auth.js`: Added `requireAsha` and `requireAdminOrAsha` guards.

---

## 5. Frontend & UI Enhancements

- **`frontend/login.html`:**
  - Rebranded to Rural Care Connect with tagline.
  - Added demo quick-fill buttons for Admin (`admin`), Public (`viewer`), and ASHA (`asha`).
  - Added Language Selector (English, Hindi, Marathi) and emergency 108 helpline.
- **`frontend/public/dashboard.html` & `public-dashboard.js`:**
  - Added Nearest PHC Finder with GPS geolocation and Leaflet radius markers.
  - Added Affordable Care by Budget search tool.
  - Added Village Vaccination Camp schedule widget.
  - Added Rule-Based Offline Symptom Checker for rural illnesses.
  - Added emergency 108 modal with direct call links.
  - Preserved historical EpiClim heatmap and trend charts.
- **`frontend/asha/dashboard.html` & `asha-dashboard.js`:**
  - Brand new dedicated portal for ASHA field workers.
  - Village caseload and active clinical case cards.
  - Immediate patient admission via stored procedure `sp_admit_patient`.
  - Emergency 108 ambulance transfer request submission.
  - PHC medicine stock-out warning indicators.
- **`frontend/admin/dashboard.html` & `admin-dashboard.js`:**
  - Added management sections for PHCs, Affordable Services, Village Drives, and ASHA Requests.
  - Enhanced facility modals with rural parameters (Doctor on duty, ambulance availability).
  - Added modal and filters for scheduling village vaccination camps.
- **Styling & Assets (`style.css`):**
  - Added Low-Bandwidth Mode class definitions (`.low-bandwidth`).
  - Added emergency badge tokens, pulse animations, and status indicators.
- **Localization (`i18n.js`):**
  - Trilingual translation engine supporting English, Hindi, and Marathi.
