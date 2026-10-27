# Rural Care Connect: Healthcare Access for Every Village

**UN Sustainable Development Goals:** SDG 3 (Good Health & Well-Being), SDG 9 (Industry, Innovation & Infrastructure), SDG 10 (Reduced Inequalities)

**Rural Care Connect** is a rural health management and disease surveillance information system powered by MySQL 8 and Express. Built to serve rural communities across Maharashtra, Madhya Pradesh, and Bihar, it connects villagers, grassroots ASHA healthcare workers, and primary health centre administrators into a unified, high-reliability platform.

---

## Key Highlights & Innovations
- **Primary Healthcare Pivot:** Migrated from a metro-hospital model to a realistic rural infrastructure of **Primary Health Centres (PHC)**, **Community Health Centres (CHC)**, and **Sub-centres** with doctor shifts, 108 emergency ambulance stations, and 24x7 operating hours.
- **Grassroots ASHA Network:** Dedicated portal for Accredited Social Health Activists (ASHA) enabling village caseload tracking, immediate patient admission via MySQL stored procedures, emergency 108 transport requests, and medical replenishment requests.
- **SQL Haversine Geolocation (`sp_nearest_phc`):** Instant calculation of nearest health centre distances computed directly in MySQL 8 using spherical trigonometry.
- **Affordable Care by Budget (`v_affordable_services`):** Transparent cost lookup matching patient budgets against free and subsidized government schemes (Janani Suraksha Yojana, Ayushman Bharat, Jan Aushadhi).
- **Universal Village Immunization (`Vaccination_Drive`):** Village-level vaccination camp scheduling with automated early-warning alerts (`trg_vaccine_drive_stockout`) when doses reach zero.
- **Rule-Based Rural Symptom Checker:** Offline, deterministic clinical guidance for high-incidence rural illnesses (Malaria, Dengue, Cholera, Typhoid, Acute Respiratory Infection, Snakebite/Rabies).
- **Trilingual Localization (English, Hindi, Marathi):** Instant client-side language switching without page reloads.
- **Offline & Low-Bandwidth Mode:** 2G-optimized stylesheet toggle reducing layout weight and disabling heavy animations.
- **Preserved EpiClim Epidemiology Dataset:** Complete preservation of all **8,974 historical disease outbreak records** (`Disease_Stats`), interactive Chart.js timelines, and Leaflet geospatial heat maps.

---

## System Architecture

```
rural-care-connect/
├── database/
│   ├── migration_rural_care_connect.sql # Structural schema migration & views/triggers
│   ├── seed_rural_data.sql              # States, Districts, Blocks, Villages, PHCs, Costs, Drives
│   ├── schema.sql                       # Base schema definitions
│   ├── views.sql                        # Relational & analytical views
│   ├── procedures.sql                   # ACID stored procedures (Haversine, Admit, Close)
│   └── triggers.sql                     # Database triggers (stockouts, alerts, audit)
├── backend/
│   ├── server.js                        # Express server entry point & route mounting
│   ├── db.js                            # MySQL 8 connection pool (mysql2/promise)
│   ├── middleware/auth.js               # RBAC guards (requireLogin, requireAdmin, requireAsha)
│   ├── routes/
│   │   ├── auth.js                      # Login, logout, session state
│   │   ├── phcs.js                      # PHC CRUD and sp_nearest_phc Haversine search
│   │   ├── hospitals.js                 # Backwards-compatible alias to PHCs
│   │   ├── geography.js                 # State > District > Block > Village hierarchy
│   │   ├── services.js                  # Affordable care catalog & budget filtering
│   │   ├── vaccination_drives.js        # Village immunization camp tracking
│   │   ├── asha.js                      # ASHA worker profile, dashboard, and field requests
│   │   ├── cases.js                     # Patient admission (sp_admit_patient, sp_close_case)
│   │   ├── diseases.js                  # Disease catalog & outbreak thresholds
│   │   ├── alerts.js                    # Outbreak alerts with area-level targeting
│   │   ├── medicines.js                 # Pharmacy inventory & vw_low_stock
│   │   ├── stats.js                     # KPI summary & EpiClim dataset (8,974 records)
│   │   ├── weather.js                   # Open-Meteo meteorological API integration
│   │   ├── complaints.js                # Public grievance reporting
│   │   └── reports.js                   # PDF / CSV report downloads
│   ├── scripts/
│   │   └── run_migration.js             # Automated DB migration and seeding script
│   └── test_rural_care_connect.js       # Comprehensive 28-point automated test suite
├── frontend/
│   ├── login.html                       # Unified portal login with demo quick-buttons
│   ├── public/dashboard.html            # Public citizen portal (PHC finder, Budget care, Drives)
│   ├── asha/dashboard.html              # Dedicated ASHA grassroots field worker portal
│   ├── admin/dashboard.html             # Administrative management & surveillance portal
│   ├── css/style.css                    # Responsive stylesheet with 2G low-bandwidth mode
│   ├── js/
│   │   ├── api.js                       # Shared REST API client
│   │   ├── i18n.js                      # Trilingual translation engine (EN, HI, MR)
│   │   ├── public-dashboard.js          # Public dashboard controller & Leaflet maps
│   │   ├── asha-dashboard.js            # ASHA portal controller
│   │   └── admin-dashboard.js           # Admin portal controller
│   └── locales/
│       ├── en.json                      # English localization dictionary
│       ├── hi.json                      # Hindi localization dictionary
│       └── mr.json                      # Marathi localization dictionary
└── docs/                                # Technical specifications and architecture guides
```

---

## User Roles & Credentials

The system provides three distinct role-based experiences:

| Role | Username | Password | Default Redirect | Privileges |
|---|---|---|---|---|
| **Administrator** | `admin` | `admin123` | `/admin/dashboard.html` | Full CRUD over PHCs, Services, Drives, Cases, Diseases, Medicines, Users; Audit trail review; Emergency alerts |
| **ASHA Worker** | `asha` | `asha123` | `/asha/dashboard.html` | Grassroots village dashboard; Immediate patient admission (`sp_admit_patient`); Emergency 108 requests; Medicine reorder alerts |
| **Public Citizen** | `viewer` | `viewer123` | `/public/dashboard.html` | Read-only access; Nearest PHC GPS map; Affordable care by budget; Village vaccination schedules; Symptom checker; Sanitation grievances |

**Emergency Links:** Direct 108 Emergency Ambulance and 102 Maternal Transfer helplines are pinned to all portals for single-tap calling.

---

## Quick Setup & Execution

### Prerequisites
- Node.js 18+ (tested on Node.js 24)
- MySQL 8.0+ running locally on port 3306

### 1. Database Configuration
Ensure MySQL has a database named `healthwatch` (or as configured in `backend/.env`):
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=healthwatch
PORT=3000
SESSION_SECRET=rural_care_connect_secret
```

### 2. Run Database Migration & Seeding
From the project root:
```bash
node backend/scripts/run_migration.js
```
*This executes `database/migration_rural_care_connect.sql` and `database/seed_rural_data.sql` while preserving all 8,974 historical EpiClim records.*

### 3. Run Automated Verification Tests
```bash
node backend/test_rural_care_connect.js
```
*Executes all 28 automated integration tests verifying database constraints, stored procedures, RBAC guards, and HTTP endpoints.*

### 4. Start the Application
```bash
cd backend
npm start
```
Open **http://localhost:3000** in your browser.

---

## DBMS Concepts Implemented
- **Relational Normalization:** 3NF hierarchy (`State` -> `District` -> `Block` -> `Village` -> `PHC`).
- **SQL Stored Procedures:**
  - `sp_nearest_phc(lat, lng, radius)`: MySQL Haversine spherical distance calculation.
  - `sp_admit_patient(...)`: ACID atomic admission with capacity validation and bed decrement.
  - `sp_close_case(...)`: Automated bed release and case outcome resolution.
- **Relational Views:** `vw_bed_availability`, `v_affordable_services`, `vw_upcoming_drives`, `vw_low_stock`, `Hospital` (backwards-compatibility view).
- **Triggers:**
  - `trg_vaccine_drive_stockout`: Automatically publishes emergency alert if drive doses hit 0.
  - `trg_case_alert`: Evaluates epidemiological outbreak thresholds on patient admissions.
  - Audit triggers on critical table updates and deletions.
- **ACID Transactions & Row-Level Locking:** `SELECT available_beds FROM PHC WHERE phc_id = ... FOR UPDATE` prevents race conditions during concurrent admissions.
- **Data Security:** Parameterized queries, bcrypt (10 rounds) password hashing, cookie-based session tokens.
