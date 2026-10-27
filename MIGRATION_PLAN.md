# Migration Plan: HealthWatch AI -> Rural Care Connect
**Tagline:** *"Healthcare access for every village."*  
**Problem Statement:** Rural Healthcare Access (SDG 3, SDG 9, SDG 10). Decentralized, rural-first health information system connecting villagers and ASHA workers to Primary Health Centres (PHCs), Community Health Centres (CHCs), and Sub-centres.

---

## 1. What We Are Keeping (Preserving Core Strengths)
- **EpiClim Outbreak Dataset & Historical Disease Stats:** All 8,974 records across 2009–2022 preserved in `Disease_Stats`.
- **EpiClim India Heat Map & Analytical Graphs:** Interactive Leaflet heat map and Chart.js disease trend analytics, filtered by disease, state, and year.
- **Weather Telemetry & Environmental Risk:** Temperature, humidity, rainfall correlation with vector-borne diseases.
- **Citizen Complaints & Grievance Redressal:** Retained and adapted for rural village issues (medicine stockout, PHC closed, water contamination).
- **Downloadable PDF/CSV Reports:** Retained with updated Rural Care Connect headers and PHC metrics.
- **Advanced DBMS Foundations:** 
  - 3NF relational normalization
  - ACID stored procedures (`sp_admit_patient`, `sp_close_case`) with row-level locks
  - Event-Condition-Action (ECA) triggers for automated outbreak alerts and audit logging
  - Role-Based Access Control (RBAC) in MySQL and Express session middleware
  - Complex multi-table JOINs, GROUP BY / HAVING aggregations, and performance indexes.

---

## 2. What We Are Renaming & Converting
- **Brand & Identity:**
  - Old: "HealthWatch AI - Disease Surveillance & Hospital Resource Dashboard"
  - New: **"Rural Care Connect"** — *"Healthcare access for every village."*
- **Facilities Concept:**
  - `Hospital` is transformed into **`PHC` (Primary Health Centre)**.
  - Supports `facility_type`: `PHC`, `CHC` (Community Health Centre), and `Sub-centre`.
  - Bed capacity scaled to rural reality (4–30 beds, plus doctor availability, ambulance availability, 24x7/day open hours, direct phone line).
  - Legacy view `Hospital` created pointing to `PHC` to guarantee backward compatibility.
- **Sample Data Shift:**
  - Urban metro hospitals replaced with **realistic rural facilities** across Maharashtra, Madhya Pradesh, and Bihar (districts like Pune rural, Satara, Nashik, Bhopal rural, Sehore, Patna rural, Gaya, etc.).
- **Medicine Inventory:**
  - Scaled to rural essential drugs (ORS, Zinc, Paracetamol, Amoxicillin, Antisnake Venom, Iron Folic Acid, Rabies vaccine) mapped to each PHC with low-stock alerts.

---

## 3. What We Are Adding (New Features)
1. **Geographic Hierarchy:**
   - Tables: `State` -> `District` -> `Block` -> `Village` with foreign keys and cascading indexes.
2. **Nearby PHC Finder with Haversine Formula:**
   - Public Leaflet map with (a) GPS "Use my location", (b) interactive map click/pin drop, and (c) State/District/Block/Village picker.
   - Stored procedure `sp_nearest_phc(lat, lng, radius_km)` calculating great-circle distance in SQL.
3. **Affordable Care by Budget:**
   - Table `Service_Cost` with service category, cost in INR, `is_free` flag, and government scheme name (Ayushman Bharat, Janani Suraksha Yojana, PM Jan Aushadhi).
   - Relational view `v_affordable_services`.
   - Public budget finder: user enters ₹ budget and selects medical need (delivery, fever, tests, injury, etc.).
4. **Village Vaccination Drives:**
   - Table `Vaccination_Drive` tracking scheduled village drives with dose counts, target groups, and dates.
   - Public "Drives near me" portal.
   - Administrative CRUD.
   - Trigger `trg_vaccine_stockout_alert`: generates alert when doses reach 0.
5. **Area-Targeted Alerts:**
   - `Alerts` table enhanced with `area_level` (state, district, block, village) and `area_id`.
   - Outbreak trigger `trg_district_outbreak_alert` fired on admissions crossing threshold.
6. **Rural-Friendly Extras:**
   - **Multilingual Support:** English, Hindi (हिन्दी), and Marathi (मराठी) via dynamic localization dictionary.
   - **Low-Bandwidth Mode:** Lightweight UI toggle optimizing contrast, minimizing animations, and maximizing readability on 2G/3G connections.
   - **ASHA Worker Role & Portal:** Dedicated role (`asha`), credentialed user (`asha` / `asha123`), and operational portal for reporting village cases, tracking vaccination, and submitting emergency PHC requests.
   - **Emergency 108 Button:** Immediate modal with closest emergency PHC, ambulance status, and direct call trigger.
   - **Rule-based Rural Symptom Checker:** Offline triage logic guiding patients to the correct facility level (Sub-centre vs PHC vs CHC) based on red flags.

---

## 4. Execution Sequence
- **Step 1:** Write `migration_rural_care_connect.sql` (schema alterations, new tables, views, stored procedures, triggers, indexes).
- **Step 2:** Write `seed_rural_data.sql` (geographic hierarchy, >= 25 PHCs, >= 40 villages, >= 60 service costs, >= 15 drives, >= 10 alerts, ASHA workers, rural patient cases).
- **Step 3:** Apply database migration to MySQL `healthwatch`.
- **Step 4:** Update backend routes, middleware, and server (`/api/phcs`, `/api/geography`, `/api/services`, `/api/vaccination-drives`, `/api/asha`, etc.).
- **Step 5:** Update frontend portals:
  - Multilingual localization (`i18n.js`, language dictionary).
  - `login.html`: Add Rural Care Connect branding, ASHA quick login, language switch.
  - `public/dashboard.html`: Nearby PHC map, Budget finder, Vaccination drives, Area alerts, Emergency 108 modal, Symptom checker, Low-bandwidth mode.
  - `admin/dashboard.html`: PHC management, Vaccination drive CRUD, Service Cost catalog, Area alerts.
  - `asha/dashboard.html`: Dedicated mobile-friendly ASHA portal.
  - `css/style.css`: Add low-bandwidth mode styles, accessibility enhancements, emergency modal.
- **Step 6:** Run tests and verify all acceptance checklist items.
- **Step 7:** Update documentation (`README.md`, `ARCHITECTURE.md`, `DB_SCHEMA.md`, `CHANGELOG.md`, `DBMS_CONCEPTS.md`).
