-- ==============================================================================
-- HealthWatch AI: Database Views Definition (MySQL 8)
-- DBMS Concepts: Relational Views, Aggregations (COUNT, SUM), GROUP BY, 
--                HAVING Clause, Multi-table INNER JOINs, Computed Columns
-- ==============================================================================

USE healthwatch;

-- 1. View: Bed Availability (Real-time Bed Occupancy & Capacity Metrics)
-- Used by both Public & Admin dashboards to display capacity and color code status.
CREATE OR REPLACE VIEW vw_bed_availability AS
SELECT 
  hospital_id,
  name,
  city,
  state,
  latitude,
  longitude,
  available_beds,
  total_beds,
  ROUND(100.0 * available_beds / NULLIF(total_beds, 0), 1) AS pct_free,
  available_icu,
  total_icu,
  ROUND(100.0 * available_icu / NULLIF(total_icu, 0), 1) AS pct_icu_free,
  ventilators,
  updated_at
FROM Hospital;

-- 2. View: Daily Cases (Time-Series Aggregation of Patient Cases)
-- Aggregates clinical admissions, deaths, and recoveries per day, disease, and city.
CREATE OR REPLACE VIEW vw_daily_cases AS
SELECT 
  d.disease_id,
  d.name AS disease,
  d.category,
  h.city,
  h.state,
  pc.admitted_on AS day,
  COUNT(*) AS cases,
  SUM(CASE WHEN pc.status = 'deceased' THEN 1 ELSE 0 END) AS deaths,
  SUM(CASE WHEN pc.status = 'recovered' THEN 1 ELSE 0 END) AS recoveries,
  SUM(CASE WHEN pc.status = 'admitted' THEN 1 ELSE 0 END) AS active_admissions
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN Hospital h ON h.hospital_id = pc.hospital_id
GROUP BY d.disease_id, d.name, d.category, h.city, h.state, pc.admitted_on;

-- 3. View: Outbreak Candidates (Cluster Detection using GROUP BY & HAVING)
-- Highlights active disease-city clusters where 7-day cases meet or exceed the threshold.
CREATE OR REPLACE VIEW vw_outbreak_candidates AS
SELECT 
  d.disease_id,
  d.name AS disease,
  h.city,
  d.alert_threshold,
  COUNT(*) AS cases_7d
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN Hospital h ON h.hospital_id = pc.hospital_id
WHERE pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY d.disease_id, d.name, h.city, d.alert_threshold
HAVING COUNT(*) >= d.alert_threshold;

-- 4. View: Low Medicine Stock (Supply-Chain Alerts)
-- Flags medical supplies where available inventory has fallen below the reorder threshold.
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT 
  m.medicine_id,
  m.name AS medicine,
  h.hospital_id,
  h.name AS hospital,
  h.city,
  m.stock,
  m.reorder_level,
  (m.reorder_level - m.stock) AS deficit
FROM Medicine m
JOIN Hospital h ON h.hospital_id = m.hospital_id
WHERE m.stock <= m.reorder_level;
