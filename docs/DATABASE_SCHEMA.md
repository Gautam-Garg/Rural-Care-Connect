# Rural Care Connect: Complete Database Schema Documentation

**Database Engine:** MySQL 8.0 Community / Server  
**Default Database Name:** `healthwatch`  
**Character Set:** `utf8mb4`  
**Collation:** `utf8mb4_unicode_ci`

---

## 1. Tables Overview

### 1.1 `Users`
Stores system accounts with Role-Based Access Control (RBAC).
- `user_id` (INT, PK, AUTO_INCREMENT)
- `username` (VARCHAR(50), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL) - Bcrypt 10 rounds
- `role` (ENUM('admin', 'public', 'asha'), NOT NULL DEFAULT 'public')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### 1.2 `State`
State-level administrative entity.
- `state_id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(100), UNIQUE, NOT NULL)
- `code` (VARCHAR(10), UNIQUE, NOT NULL)

### 1.3 `District`
Districts mapped to a state.
- `district_id` (INT, PK, AUTO_INCREMENT)
- `state_id` (INT, FK -> `State.state_id`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `latitude` (DECIMAL(10, 6), NOT NULL)
- `longitude` (DECIMAL(10, 6), NOT NULL)

### 1.4 `Block`
Sub-district / Taluka administrative division.
- `block_id` (INT, PK, AUTO_INCREMENT)
- `district_id` (INT, FK -> `District.district_id`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)

### 1.5 `Village`
Grassroots village community records.
- `village_id` (INT, PK, AUTO_INCREMENT)
- `block_id` (INT, FK -> `Block.block_id`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `population` (INT, NOT NULL DEFAULT 1000)
- `latitude` (DECIMAL(10, 6), NOT NULL)
- `longitude` (DECIMAL(10, 6), NOT NULL)

### 1.6 `PHC` (Primary Health Centre)
Rural frontline health facilities. Replaces metro hospital model.
- `phc_id` (INT, PK, AUTO_INCREMENT)
- `village_id` (INT, FK -> `Village.village_id`, NULLABLE)
- `name` (VARCHAR(150), NOT NULL)
- `facility_type` (ENUM('PHC', 'CHC', 'Sub-centre', 'District Hospital'), NOT NULL DEFAULT 'PHC')
- `total_beds` (INT, NOT NULL DEFAULT 10)
- `available_beds` (INT, NOT NULL DEFAULT 10)
- `total_icu` (INT, NOT NULL DEFAULT 0)
- `available_icu` (INT, NOT NULL DEFAULT 0)
- `ventilators` (INT, NOT NULL DEFAULT 0)
- `doctor_on_duty` (TINYINT(1), NOT NULL DEFAULT 1)
- `ambulance_available` (TINYINT(1), NOT NULL DEFAULT 1)
- `operating_hours` (VARCHAR(50), NOT NULL DEFAULT '24x7')
- `contact_phone` (VARCHAR(20), NULLABLE)
- `city` (VARCHAR(100), NOT NULL)
- `state` (VARCHAR(100), NOT NULL)
- `latitude` (DECIMAL(10, 6), NOT NULL)
- `longitude` (DECIMAL(10, 6), NOT NULL)

### 1.7 `Service_Cost`
Catalog of affordable healthcare procedures, treatments, and scheme subsidies.
- `service_id` (INT, PK, AUTO_INCREMENT)
- `phc_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `service_name` (VARCHAR(150), NOT NULL)
- `category` (ENUM('Consultation', 'Maternal Care', 'Diagnostic', 'Emergency Care', 'Vaccination', 'Medicine Supply', 'General Health'), NOT NULL)
- `cost_inr` (DECIMAL(10, 2), NOT NULL DEFAULT 0.00)
- `is_free` (TINYINT(1), NOT NULL DEFAULT 0)
- `scheme_name` (VARCHAR(150), NULLABLE) - e.g., JSY, Ayushman Bharat
- `notes` (TEXT, NULLABLE)

### 1.8 `Vaccination_Drive`
Universal Village Immunization camp schedules and inventory.
- `drive_id` (INT, PK, AUTO_INCREMENT)
- `phc_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `village_id` (INT, FK -> `Village.village_id`, NOT NULL)
- `vaccine_name` (VARCHAR(100), NOT NULL)
- `drive_date` (DATE, NOT NULL)
- `time_slot` (VARCHAR(50), NOT NULL DEFAULT '09:00 AM - 02:00 PM')
- `target_group` (VARCHAR(100), NOT NULL DEFAULT 'Infants & Children')
- `doses_allocated` (INT, NOT NULL DEFAULT 100)
- `doses_available` (INT, NOT NULL DEFAULT 100)
- `status` (ENUM('scheduled', 'in_progress', 'completed', 'cancelled'), NOT NULL DEFAULT 'scheduled')

### 1.9 `ASHA_Worker`
Accredited Social Health Activists assigned to villages.
- `asha_id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, FK -> `Users.user_id`, UNIQUE, NULLABLE)
- `village_id` (INT, FK -> `Village.village_id`, NOT NULL)
- `phc_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `phone` (VARCHAR(20), NOT NULL)
- `assigned_since` (DATE, NOT NULL)

### 1.10 `ASHA_Request`
Field emergency requests sent from ASHA workers to their linked PHC.
- `request_id` (INT, PK, AUTO_INCREMENT)
- `asha_id` (INT, FK -> `ASHA_Worker.asha_id`, NOT NULL)
- `phc_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `request_type` (ENUM('emergency_transport', 'medicine_stock', 'doctor_visit', 'vaccine_supply', 'general'), NOT NULL)
- `urgency` (ENUM('normal', 'urgent', 'critical'), NOT NULL DEFAULT 'normal')
- `details` (TEXT, NOT NULL)
- `status` (ENUM('pending', 'in_progress', 'resolved'), NOT NULL DEFAULT 'pending')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### 1.11 `Disease`
Epidemiological catalog of monitored conditions.
- `disease_id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(100), UNIQUE, NOT NULL)
- `category` (ENUM('vector-borne', 'water-borne', 'air-borne', 'other'), NOT NULL)
- `alert_threshold` (INT, NOT NULL DEFAULT 20)

### 1.12 `Patient_Cases`
Clinical patient admissions linked to PHCs and villages.
- `case_id` (INT, PK, AUTO_INCREMENT)
- `disease_id` (INT, FK -> `Disease.disease_id`, NOT NULL)
- `hospital_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `village_id` (INT, FK -> `Village.village_id`, NULLABLE)
- `age_group` (ENUM('0-14', '15-30', '31-45', '46-60', '60+'), NOT NULL)
- `gender` (ENUM('M', 'F', 'O'), NOT NULL)
- `status` (ENUM('admitted', 'recovered', 'deceased'), NOT NULL DEFAULT 'admitted')
- `admitted_on` (DATE, NOT NULL)
- `closed_on` (DATE, NULLABLE)
- `icu_required` (TINYINT(1), NOT NULL DEFAULT 0)

### 1.13 `Medicine`
PHC pharmacy inventory with reorder alert thresholds.
- `medicine_id` (INT, PK, AUTO_INCREMENT)
- `hospital_id` (INT, FK -> `PHC.phc_id`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `stock` (INT, NOT NULL DEFAULT 0)
- `reorder_level` (INT, NOT NULL DEFAULT 50)

### 1.14 `Alerts`
Outbreak warnings with multi-tier geographic targeting.
- `alert_id` (INT, PK, AUTO_INCREMENT)
- `disease_id` (INT, FK -> `Disease.disease_id`, NOT NULL)
- `city` (VARCHAR(100), NOT NULL)
- `area_level` (ENUM('village', 'block', 'district', 'state', 'all'), NOT NULL DEFAULT 'district')
- `area_id` (INT, NULLABLE)
- `area_name` (VARCHAR(150), NULLABLE)
- `level` (ENUM('warning', 'high', 'critical'), NOT NULL)
- `message` (TEXT, NOT NULL)
- `status` (ENUM('active', 'resolved'), NOT NULL DEFAULT 'active')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### 1.15 `Complaints`
Public sanitation and hygiene grievances.
- `complaint_id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, FK -> `Users.user_id`, NULLABLE)
- `city` (VARCHAR(100), NOT NULL)
- `description` (TEXT, NOT NULL)
- `status` (ENUM('new', 'reviewed', 'closed'), NOT NULL DEFAULT 'new')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### 1.16 `Audit_Log`
Immutable security and transaction log.
- `log_id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, NULLABLE)
- `action` (VARCHAR(50), NOT NULL)
- `table_name` (VARCHAR(50), NOT NULL)
- `record_id` (INT, NULLABLE)
- `details` (TEXT, NULLABLE)
- `logged_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

### 1.17 `Disease_Stats` (EpiClim Preserved Dataset)
Historical epidemiological and meteorological surveillance dataset (8,974 rows).
- `stat_id` (INT, PK, AUTO_INCREMENT)
- `disease_name` (VARCHAR(100), NOT NULL)
- `state` (VARCHAR(100), NOT NULL)
- `district` (VARCHAR(150), NOT NULL)
- `year` (INT, NOT NULL)
- `cases` (INT, NOT NULL DEFAULT 0)
- `deaths` (INT, NOT NULL DEFAULT 0)
- `temperature` (DECIMAL(5, 2), NULLABLE)
- `preci` (DECIMAL(6, 2), NULLABLE)
- `latitude` (DECIMAL(10, 6), NULLABLE)
- `longitude` (DECIMAL(10, 6), NULLABLE)

---

## 2. Views

1. **`Hospital` (Backwards Compatibility View):**
   ```sql
   CREATE VIEW Hospital AS
   SELECT 
     phc_id AS hospital_id,
     name,
     city,
     state,
     latitude,
     longitude,
     total_beds,
     available_beds,
     total_icu,
     available_icu,
     ventilators
   FROM PHC;
   ```
2. **`vw_bed_availability`:**
   Exposes real-time bed, ICU, and ventilator availability with occupancy percentage.
3. **`v_affordable_services`:**
   Joins `Service_Cost` with `PHC` and `Village` for transparent cost lookups.
4. **`vw_upcoming_drives`:**
   Joins `Vaccination_Drive`, `PHC`, `Village`, and `District` for universal immunization tracking.
5. **`vw_low_stock`:**
   Filters `Medicine` inventory where `stock <= reorder_level`.
6. **`vw_daily_cases` & `vw_outbreak_candidates`:**
   Aggregates admissions over 7-day windows to detect emerging outbreaks.

---

## 3. Stored Procedures

### 3.1 `sp_nearest_phc(in_lat, in_lng, in_radius_km)`
Calculates nearest primary health centres using the spherical Haversine formula directly in MySQL:
```sql
6371 * ACOS(
  LEAST(1.0, GREATEST(-1.0,
    COS(RADIANS(in_lat)) * COS(RADIANS(p.latitude)) *
    COS(RADIANS(p.longitude) - RADIANS(in_lng)) +
    SIN(RADIANS(in_lat)) * SIN(RADIANS(p.latitude))
  ))
) AS distance_km
```

### 3.2 `sp_admit_patient(in_disease_id, in_hospital_id, in_age_group, in_gender, in_icu_required)`
Atomic clinical admission transaction:
- Acquires row lock: `SELECT available_beds, available_icu FROM PHC WHERE phc_id = in_hospital_id FOR UPDATE`.
- Checks bed or ICU capacity.
- Throws custom exception `SIGNAL SQLSTATE '45000'` if no beds remain.
- Decrements available beds/ICU.
- Inserts row into `Patient_Cases`.
- Returns new `case_id`.

### 3.3 `sp_close_case(in_case_id, in_status)`
Discharges patient, sets `closed_on = CURDATE()`, and releases the bed back into the PHC inventory.

---

## 4. Database Triggers

### 4.1 `trg_vaccine_drive_stockout`
`AFTER UPDATE ON Vaccination_Drive`:
When `NEW.doses_available = 0` and `OLD.doses_available > 0`, automatically inserts a `critical` severity alert into `Alerts` warning administrators of a village vaccine stockout.

### 4.2 `trg_case_alert`
`AFTER INSERT ON Patient_Cases`:
Checks if admissions for the diagnosed disease in the target city over the past 7 days exceed `Disease.alert_threshold`. If exceeded, automatically generates an active outbreak alert.
