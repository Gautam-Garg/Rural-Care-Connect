# Rural Care Connect: Database Management System (DBMS) Concepts Implementation

This document serves as an academic and technical reference detailing where and how key database concepts are implemented in **Rural Care Connect**.

---

## 1. Relational Database Normalization (3NF)

To eliminate update anomalies, deletion anomalies, and data redundancy, the geographic and facility data is normalized into **Third Normal Form (3NF)**:

| Entity | Functional Dependencies | Key |
|---|---|---|
| `State` | `state_id -> name, code` | `state_id` (PK) |
| `District` | `district_id -> state_id, name, latitude, longitude` | `district_id` (PK), `state_id` (FK) |
| `Block` | `block_id -> district_id, name` | `block_id` (PK), `district_id` (FK) |
| `Village` | `village_id -> block_id, name, population, latitude, longitude` | `village_id` (PK), `block_id` (FK) |
| `PHC` | `phc_id -> village_id, name, facility_type, beds, lat, lng...` | `phc_id` (PK), `village_id` (FK) |

**Educational Value:** Instead of repeating state and district names for every village or PHC, changes to a district or state name occur in exactly one row, maintaining referential integrity across the system.

---

## 2. SQL Stored Procedures & Spherical Trigonometry

### 2.1 Spherical Haversine Geolocation (`sp_nearest_phc`)
- **Location:** `database/procedures.sql` and `database/migration_rural_care_connect.sql`
- **Concept:** Complex mathematical computations executed in the DBMS engine rather than pulling all rows into Node.js memory.
- **Formula:**
  $$\text{Distance} = 6371 \times \arccos(\sin(\phi_1)\sin(\phi_2) + \cos(\phi_1)\cos(\phi_2)\cos(\Delta\lambda))$$
- **Implementation Safeguard:** Uses `LEAST(1.0, GREATEST(-1.0, ...))` to prevent floating-point precision domain errors in MySQL's `ACOS` function.

### 2.2 Atomic Clinical Patient Admission (`sp_admit_patient`)
- **Location:** `database/procedures.sql`
- **DBMS Concepts:** ACID Transactions, Row-Level Locking (`FOR UPDATE`), Error Handling (`SIGNAL SQLSTATE`).
- **Workflow:**
  1. `START TRANSACTION;`
  2. `SELECT available_beds FROM PHC WHERE phc_id = ... FOR UPDATE;` (Locks the specific PHC row against concurrent write races).
  3. Evaluates if `available_beds <= 0`. If true:
     `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No bed available in this hospital facility';` (Triggers immediate rollback).
  4. Decrements bed or ICU counter in `PHC`.
  5. Inserts new record into `Patient_Cases`.
  6. `COMMIT;`

### 2.3 Automated Bed Release (`sp_close_case`)
- **Location:** `database/procedures.sql`
- Automatically marks patient case as recovered or deceased, logs discharge date, and restores bed capacity back to the parent PHC facility.

---

## 3. Relational Views & Materialization

Views provide abstraction, simplify complex queries, and enforce security by restricting direct table access.

| View Name | Definition / Purpose | Joined Tables |
|---|---|---|
| `Hospital` | Backwards-compatibility view mapping legacy hospital columns to `PHC`. | `PHC` |
| `vw_bed_availability` | Computes live bed, ICU, and ventilator availability along with occupancy percentage. | `PHC` |
| `v_affordable_services` | Joins pricing catalog with facility details and village coordinates for budget filtering. | `Service_Cost`, `PHC`, `Village` |
| `vw_upcoming_drives` | Combines village immunization drives with district and block information. | `Vaccination_Drive`, `PHC`, `Village`, `District`, `Block` |
| `vw_low_stock` | Filters medicine inventory to show items where `stock <= reorder_level`. | `Medicine`, `PHC` |
| `vw_daily_cases` | Aggregates daily admissions by disease and facility. | `Patient_Cases`, `Disease`, `PHC` |
| `vw_outbreak_candidates` | Identifies facilities where 7-day admissions exceed historical baselines. | `Patient_Cases`, `Disease`, `PHC` |

---

## 4. Database Triggers (Automated Event Handlers)

Triggers run synchronously within the database engine on data modification events.

### 4.1 Village Vaccine Stockout Trigger (`trg_vaccine_drive_stockout`)
- **Event:** `AFTER UPDATE ON Vaccination_Drive`
- **Condition:** `OLD.doses_available > 0 AND NEW.doses_available = 0`
- **Action:** Inserts a `critical` alert into `Alerts` informing health officers that a village vaccination camp has exhausted its doses.

### 4.2 Outbreak Early Warning Trigger (`trg_case_alert`)
- **Event:** `AFTER INSERT ON Patient_Cases`
- **Action:** Calculates total admissions for the admitted disease in that city over the previous 7 days. If the count exceeds `Disease.alert_threshold`, automatically generates an early-warning outbreak alert.

### 4.3 Audit Trail Triggers
- **Events:** `AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE` on critical tables (`PHC`, `Patient_Cases`, `Medicine`).
- **Action:** Inserts immutable records into `Audit_Log` with timestamps, record IDs, and diff details.

---

## 5. ACID Properties & Concurrency Control

- **Atomicity:** `sp_admit_patient` ensures that either both the bed decrement AND case insertion succeed, or neither does.
- **Consistency:** Foreign key constraints (`ON DELETE CASCADE` or `RESTRICT`) maintain valid relationships between villages, blocks, PHCs, and cases.
- **Isolation:** Explicit row-level locks (`SELECT ... FOR UPDATE`) inside stored procedures prevent race conditions (e.g., two ASHA workers booking the last remaining bed simultaneously).
- **Durability:** MySQL InnoDB write-ahead redo logs ensure committed transactions survive crashes or system reboots.

---

## 6. Indexing Strategy & Query Optimization

To maintain sub-second query performance across large datasets (such as `Disease_Stats` with 8,974 rows):

1. **Composite Geographic Index:**
   `CREATE INDEX idx_stats_disease_year_state ON Disease_Stats(disease_name, year, state);`
   - Speeds up multidimensional filtering on epidemiology charts.
2. **Spatial Coordinate Indexing:**
   `CREATE INDEX idx_phc_coords ON PHC(latitude, longitude);`
   - Accelerates bounding box and Haversine distance computations in `sp_nearest_phc`.
3. **Foreign Key Indexes:**
   Indexes on `Patient_Cases(hospital_id)`, `Patient_Cases(disease_id)`, `Service_Cost(phc_id)`, and `Vaccination_Drive(village_id)` optimize JOIN performance.
