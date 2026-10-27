-- ==============================================================================
-- Rural Care Connect: Database Migration Script (MySQL 8)
-- Transforms "HealthWatch AI" into "Rural Care Connect"
-- Tagline: "Healthcare access for every village."
-- Problem Statement: Rural Healthcare Access (SDG 3, SDG 9, SDG 10)
-- DBMS Concepts: DDL Alterations, 3NF Hierarchies, Stored Procedures (Haversine),
--                Active Triggers (Stockout & Outbreak), Views, Spatial Indexes
-- ==============================================================================

USE healthwatch;

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES, SQL_SAFE_UPDATES = 0;

-- ------------------------------------------------------------------------------
-- 1. RBAC: Expand Users Role to include 'asha'
-- ------------------------------------------------------------------------------
ALTER TABLE Users 
  MODIFY COLUMN role ENUM('admin', 'public', 'asha') NOT NULL DEFAULT 'public';

-- ------------------------------------------------------------------------------
-- 2. Geographic Hierarchy: State > District > Block > Village (3NF Normalization)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS State (
  state_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS District (
  district_id INT AUTO_INCREMENT PRIMARY KEY,
  state_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  CONSTRAINT fk_district_state FOREIGN KEY (state_id) 
    REFERENCES State(state_id) ON DELETE CASCADE,
  INDEX idx_district_state (state_id),
  INDEX idx_district_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Block (
  block_id INT AUTO_INCREMENT PRIMARY KEY,
  district_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  CONSTRAINT fk_block_district FOREIGN KEY (district_id) 
    REFERENCES District(district_id) ON DELETE CASCADE,
  INDEX idx_block_district (district_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Village (
  village_id INT AUTO_INCREMENT PRIMARY KEY,
  block_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  population INT NOT NULL DEFAULT 1500,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  CONSTRAINT fk_village_block FOREIGN KEY (block_id) 
    REFERENCES Block(block_id) ON DELETE CASCADE,
  INDEX idx_village_block (block_id),
  INDEX idx_village_coords (latitude, longitude)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 3. Core Transformation: PHC (Primary Health Centre)
-- Supports PHC, CHC (Community Health Centre), Sub-centre
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PHC (
  phc_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  facility_type ENUM('PHC', 'CHC', 'Sub-centre') NOT NULL DEFAULT 'PHC',
  state_id INT NULL,
  district_id INT NULL,
  block_id INT NULL,
  village_id INT NULL,
  city VARCHAR(80) NOT NULL, -- used as block/local area identifier
  state VARCHAR(80) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  total_beds INT NOT NULL DEFAULT 6 CHECK (total_beds >= 0),
  available_beds INT NOT NULL DEFAULT 4 CHECK (available_beds >= 0),
  total_icu INT NOT NULL DEFAULT 0 CHECK (total_icu >= 0),
  available_icu INT NOT NULL DEFAULT 0 CHECK (available_icu >= 0),
  ventilators INT NOT NULL DEFAULT 0 CHECK (ventilators >= 0),
  doctor_available BOOLEAN NOT NULL DEFAULT TRUE,
  ambulance_available BOOLEAN NOT NULL DEFAULT TRUE,
  open_hours VARCHAR(100) NOT NULL DEFAULT '24x7',
  phone VARCHAR(30) NOT NULL DEFAULT '108',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_phc_beds CHECK (available_beds <= total_beds),
  CONSTRAINT chk_phc_icu CHECK (available_icu <= total_icu),
  CONSTRAINT fk_phc_district FOREIGN KEY (district_id) REFERENCES District(district_id) ON DELETE SET NULL,
  CONSTRAINT fk_phc_block FOREIGN KEY (block_id) REFERENCES Block(block_id) ON DELETE SET NULL,
  CONSTRAINT fk_phc_village FOREIGN KEY (village_id) REFERENCES Village(village_id) ON DELETE SET NULL,
  INDEX idx_phc_coords (latitude, longitude),
  INDEX idx_phc_district (district_id),
  INDEX idx_phc_facility_type (facility_type),
  INDEX idx_phc_city_state (city, state)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- Legacy Hospital Table Migration & Compatibility View
-- ------------------------------------------------------------------------------
-- Safely drop old triggers on Hospital if any
DROP TRIGGER IF EXISTS trg_hospital_after_insert;
DROP TRIGGER IF EXISTS trg_hospital_after_update;
DROP TRIGGER IF EXISTS trg_hospital_after_delete;

-- Safely drop old foreign keys referencing Hospital
SET @fk1 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Patient_Cases' AND CONSTRAINT_NAME = 'fk_case_hospital');
SET @s1 = IF(@fk1 > 0, 'ALTER TABLE Patient_Cases DROP FOREIGN KEY fk_case_hospital;', 'SELECT 1;');
PREPARE stmt1 FROM @s1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @fk2 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'Medicine' AND CONSTRAINT_NAME = 'fk_medicine_hospital');
SET @s2 = IF(@fk2 > 0, 'ALTER TABLE Medicine DROP FOREIGN KEY fk_medicine_hospital;', 'SELECT 1;');
PREPARE stmt2 FROM @s2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

DROP TABLE IF EXISTS Hospital_legacy;

-- If Hospital is a base table, rename it to Hospital_legacy
SET @is_table = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Hospital' AND TABLE_TYPE = 'BASE TABLE');
SET @s3 = IF(@is_table > 0, 'RENAME TABLE Hospital TO Hospital_legacy', 'SELECT 1');
PREPARE stmt3 FROM @s3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

DROP VIEW IF EXISTS Hospital;
CREATE OR REPLACE VIEW Hospital AS
SELECT 
  phc_id AS hospital_id,
  phc_id,
  name,
  facility_type,
  district_id,
  block_id,
  village_id,
  city,
  state,
  latitude,
  longitude,
  total_beds,
  available_beds,
  total_icu,
  available_icu,
  ventilators,
  doctor_available,
  ambulance_available,
  open_hours,
  phone,
  updated_at
FROM PHC;

-- ------------------------------------------------------------------------------
-- 4. Affordable Care by Budget: Service_Cost Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Service_Cost (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  phc_id INT NOT NULL,
  service_name VARCHAR(150) NOT NULL,
  category ENUM('fever', 'delivery', 'vaccination', 'injury', 'medicines', 'tests', 'general') NOT NULL,
  cost_inr DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  scheme_name VARCHAR(150) NULL, -- e.g., 'Ayushman Bharat', 'Janani Suraksha Yojana (JSY)', 'PM Jan Aushadhi'
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_phc FOREIGN KEY (phc_id) 
    REFERENCES PHC(phc_id) ON DELETE CASCADE,
  INDEX idx_service_category_cost (category, cost_inr),
  INDEX idx_service_phc (phc_id),
  INDEX idx_service_free (is_free)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 5. Vaccination for Villages: Vaccination_Drive Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Vaccination_Drive (
  drive_id INT AUTO_INCREMENT PRIMARY KEY,
  phc_id INT NOT NULL,
  village_id INT NOT NULL,
  vaccine VARCHAR(100) NOT NULL,
  drive_date DATE NOT NULL,
  time VARCHAR(50) NOT NULL DEFAULT '09:00 AM - 02:00 PM',
  target_group VARCHAR(100) NOT NULL DEFAULT 'Infants & Mothers',
  doses_available INT NOT NULL DEFAULT 50 CHECK (doses_available >= 0),
  status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_drive_phc FOREIGN KEY (phc_id) 
    REFERENCES PHC(phc_id) ON DELETE CASCADE,
  CONSTRAINT fk_drive_village FOREIGN KEY (village_id) 
    REFERENCES Village(village_id) ON DELETE CASCADE,
  INDEX idx_drive_date (drive_date),
  INDEX idx_drive_village (village_id),
  INDEX idx_drive_phc (phc_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 6. ASHA Worker Role & Operations Tables
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ASHA_Worker (
  asha_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(100) NOT NULL,
  village_id INT NOT NULL,
  phc_id INT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  assigned_area VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asha_user FOREIGN KEY (user_id) 
    REFERENCES Users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_asha_village FOREIGN KEY (village_id) 
    REFERENCES Village(village_id) ON DELETE CASCADE,
  CONSTRAINT fk_asha_phc FOREIGN KEY (phc_id) 
    REFERENCES PHC(phc_id) ON DELETE CASCADE,
  INDEX idx_asha_village (village_id),
  INDEX idx_asha_phc (phc_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ASHA_Request (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  asha_id INT NOT NULL,
  phc_id INT NOT NULL,
  request_type ENUM('emergency_transport', 'medicine_stock', 'doctor_visit', 'vaccine_supply', 'general') NOT NULL,
  urgency ENUM('normal', 'urgent', 'critical') NOT NULL DEFAULT 'normal',
  details TEXT NOT NULL,
  status ENUM('pending', 'in_progress', 'resolved') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ashareq_asha FOREIGN KEY (asha_id) 
    REFERENCES ASHA_Worker(asha_id) ON DELETE CASCADE,
  CONSTRAINT fk_ashareq_phc FOREIGN KEY (phc_id) 
    REFERENCES PHC(phc_id) ON DELETE CASCADE,
  INDEX idx_ashareq_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 7. Modify Existing Tables (Patient_Cases, Alerts, Medicine, Vaccination)
-- ------------------------------------------------------------------------------

-- Alerts: add area_level and area_id
SET @dbname = DATABASE();
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'Alerts' AND COLUMN_NAME = 'area_level'
);

SET @stmt = IF(@col_exists = 0, 
  'ALTER TABLE Alerts 
     ADD COLUMN area_level ENUM("national", "state", "district", "block", "village") NOT NULL DEFAULT "district",
     ADD COLUMN area_id INT NULL,
     ADD COLUMN area_name VARCHAR(100) NULL,
     ADD INDEX idx_alerts_area (area_level, area_id);', 
  'SELECT "Alerts already has area columns";'
);
PREPARE exec_sql FROM @stmt;
EXECUTE exec_sql;
DEALLOCATE PREPARE exec_sql;

-- Patient_Cases: add village_id and phc_id
SET @col_pc_village = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'Patient_Cases' AND COLUMN_NAME = 'village_id'
);
SET @stmt_pc_v = IF(@col_pc_village = 0,
  'ALTER TABLE Patient_Cases 
     ADD COLUMN village_id INT NULL,
     ADD INDEX idx_pc_village (village_id);',
  'SELECT "Patient_Cases already has village_id";'
);
PREPARE exec_sql FROM @stmt_pc_v;
EXECUTE exec_sql;
DEALLOCATE PREPARE exec_sql;

-- Medicine: add phc_id
SET @col_med_phc = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'Medicine' AND COLUMN_NAME = 'phc_id'
);
SET @stmt_med_p = IF(@col_med_phc = 0,
  'ALTER TABLE Medicine 
     ADD COLUMN phc_id INT NULL,
     ADD INDEX idx_med_phc (phc_id);',
  'SELECT "Medicine already has phc_id";'
);
PREPARE exec_sql FROM @stmt_med_p;
EXECUTE exec_sql;
DEALLOCATE PREPARE exec_sql;

-- Vaccination: add village_id and drive_id
SET @col_vac_vil = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'Vaccination' AND COLUMN_NAME = 'village_id'
);
SET @stmt_vac_v = IF(@col_vac_vil = 0,
  'ALTER TABLE Vaccination 
     ADD COLUMN village_id INT NULL,
     ADD COLUMN drive_id INT NULL,
     ADD INDEX idx_vac_village (village_id);',
  'SELECT "Vaccination already has village_id";'
);
PREPARE exec_sql FROM @stmt_vac_v;
EXECUTE exec_sql;
DEALLOCATE PREPARE exec_sql;

-- ------------------------------------------------------------------------------
-- 8. Views Definition
-- ------------------------------------------------------------------------------

-- 8.1 Bed Availability & PHC Status View
CREATE OR REPLACE VIEW vw_bed_availability AS
SELECT 
  p.phc_id AS hospital_id,
  p.phc_id,
  p.name,
  p.facility_type,
  p.city,
  p.state,
  d.name AS district_name,
  b.name AS block_name,
  v.name AS village_name,
  p.latitude,
  p.longitude,
  p.available_beds,
  p.total_beds,
  ROUND(100.0 * p.available_beds / NULLIF(p.total_beds, 0), 1) AS pct_free,
  p.available_icu,
  p.total_icu,
  ROUND(100.0 * p.available_icu / NULLIF(p.total_icu, 0), 1) AS pct_icu_free,
  p.ventilators,
  p.doctor_available,
  p.ambulance_available,
  p.open_hours,
  p.phone,
  p.updated_at
FROM PHC p
LEFT JOIN District d ON d.district_id = p.district_id
LEFT JOIN Block b ON b.block_id = p.block_id
LEFT JOIN Village v ON v.village_id = p.village_id;

-- 8.2 Affordable Services View (Budget Finder)
CREATE OR REPLACE VIEW v_affordable_services AS
SELECT 
  sc.service_id,
  sc.phc_id,
  p.name AS phc_name,
  p.facility_type,
  p.city,
  p.state,
  d.name AS district_name,
  p.phone,
  p.doctor_available,
  p.open_hours,
  p.latitude,
  p.longitude,
  sc.service_name,
  sc.category,
  sc.cost_inr,
  sc.is_free,
  sc.scheme_name,
  sc.notes
FROM Service_Cost sc
JOIN PHC p ON p.phc_id = sc.phc_id
LEFT JOIN District d ON d.district_id = p.district_id;

-- 8.3 Low Medicine Stock View
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT 
  m.medicine_id,
  m.name AS medicine,
  COALESCE(m.phc_id, m.hospital_id) AS phc_id,
  p.name AS phc_name,
  p.city,
  m.stock,
  m.reorder_level,
  (m.reorder_level - m.stock) AS deficit
FROM Medicine m
JOIN PHC p ON p.phc_id = COALESCE(m.phc_id, m.hospital_id)
WHERE m.stock <= m.reorder_level;

-- 8.4 Upcoming Vaccination Drives View
CREATE OR REPLACE VIEW vw_upcoming_drives AS
SELECT 
  vd.drive_id,
  vd.phc_id,
  p.name AS phc_name,
  p.facility_type,
  vd.village_id,
  v.name AS village_name,
  b.name AS block_name,
  d.name AS district_name,
  s.name AS state_name,
  vd.vaccine,
  vd.drive_date,
  vd.time,
  vd.target_group,
  vd.doses_available,
  vd.status,
  v.latitude AS village_lat,
  v.longitude AS village_lng,
  p.phone AS phc_phone
FROM Vaccination_Drive vd
JOIN PHC p ON p.phc_id = vd.phc_id
JOIN Village v ON v.village_id = vd.village_id
JOIN Block b ON b.block_id = v.block_id
JOIN District d ON d.district_id = b.district_id
JOIN State s ON s.state_id = d.state_id;

-- 8.5 Daily Cases Aggregation View
CREATE OR REPLACE VIEW vw_daily_cases AS
SELECT 
  d.disease_id,
  d.name AS disease,
  d.category,
  p.city,
  p.state,
  pc.admitted_on AS day,
  COUNT(*) AS cases,
  SUM(CASE WHEN pc.status = 'deceased' THEN 1 ELSE 0 END) AS deaths,
  SUM(CASE WHEN pc.status = 'recovered' THEN 1 ELSE 0 END) AS recoveries,
  SUM(CASE WHEN pc.status = 'admitted' THEN 1 ELSE 0 END) AS active_admissions
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN PHC p ON p.phc_id = pc.hospital_id
GROUP BY d.disease_id, d.name, d.category, p.city, p.state, pc.admitted_on;

-- 8.6 Outbreak Candidates View
CREATE OR REPLACE VIEW vw_outbreak_candidates AS
SELECT 
  d.disease_id,
  d.name AS disease,
  p.city,
  d.alert_threshold,
  COUNT(*) AS cases_7d
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN PHC p ON p.phc_id = pc.hospital_id
WHERE pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY d.disease_id, d.name, p.city, d.alert_threshold
HAVING COUNT(*) >= d.alert_threshold;

-- ------------------------------------------------------------------------------
-- 9. Stored Procedures
-- ------------------------------------------------------------------------------

DELIMITER $$

-- 9.1 sp_nearest_phc: Haversine Great-Circle Formula for Nearest Facility Finder
-- DBMS Showcase: Advanced Trigonometric Spatial Query in Stored Procedure
DROP PROCEDURE IF EXISTS sp_nearest_phc$$

CREATE PROCEDURE sp_nearest_phc(
  IN p_lat DECIMAL(9,6),
  IN p_lng DECIMAL(9,6),
  IN p_radius_km DECIMAL(6,2)
)
BEGIN
  -- Radius of Earth in KM = 6371
  SELECT 
    p.phc_id,
    p.name,
    p.facility_type,
    p.city,
    p.state,
    COALESCE(d.name, p.city) AS district_name,
    COALESCE(b.name, '') AS block_name,
    COALESCE(v.name, '') AS village_name,
    p.latitude,
    p.longitude,
    p.available_beds,
    p.total_beds,
    p.doctor_available,
    p.ambulance_available,
    p.open_hours,
    p.phone,
    ROUND(
      6371 * ACOS(
        LEAST(1.0, GREATEST(-1.0,
          COS(RADIANS(p_lat)) * COS(RADIANS(p.latitude)) * 
          COS(RADIANS(p.longitude) - RADIANS(p_lng)) + 
          SIN(RADIANS(p_lat)) * SIN(RADIANS(p.latitude))
        ))
      ), 2
    ) AS distance_km
  FROM PHC p
  LEFT JOIN District d ON d.district_id = p.district_id
  LEFT JOIN Block b ON b.block_id = p.block_id
  LEFT JOIN Village v ON v.village_id = p.village_id
  HAVING (p_radius_km IS NULL OR p_radius_km <= 0 OR distance_km <= p_radius_km)
  ORDER BY distance_km ASC
  LIMIT 25;
END$$

-- 9.2 sp_admit_patient: Atomic Admission with PHC Inventory Decrement
DROP PROCEDURE IF EXISTS sp_admit_patient$$

CREATE PROCEDURE sp_admit_patient(
  IN p_disease INT,
  IN p_phc INT,
  IN p_age_group VARCHAR(10),
  IN p_gender CHAR(1),
  IN p_icu BOOLEAN
)
proc_label: BEGIN
  DECLARE v_new_case_id INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM Disease WHERE disease_id = p_disease) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid disease ID';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM PHC WHERE phc_id = p_phc) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid PHC facility ID';
  END IF;

  IF p_icu THEN
    UPDATE PHC 
    SET available_icu = available_icu - 1
    WHERE phc_id = p_phc AND available_icu > 0;
  ELSE
    UPDATE PHC 
    SET available_beds = available_beds - 1
    WHERE phc_id = p_phc AND available_beds > 0;
  END IF;

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No bed available at this Primary Health Centre';
  END IF;

  INSERT INTO Patient_Cases (
    disease_id,
    hospital_id,
    age_group,
    gender,
    icu_required,
    status,
    admitted_on
  ) VALUES (
    p_disease,
    p_phc,
    p_age_group,
    p_gender,
    p_icu,
    'admitted',
    CURDATE()
  );

  SET v_new_case_id = LAST_INSERT_ID();
  COMMIT;

  SELECT v_new_case_id AS case_id, 'Admission successful at PHC' AS message;
END proc_label$$

-- 9.3 sp_close_case: Atomic Discharge with PHC Inventory Restoration
DROP PROCEDURE IF EXISTS sp_close_case$$

CREATE PROCEDURE sp_close_case(
  IN p_case INT,
  IN p_status VARCHAR(10)
)
proc_label: BEGIN
  DECLARE v_phc INT;
  DECLARE v_icu BOOLEAN;
  DECLARE v_current_status VARCHAR(10);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF p_status NOT IN ('recovered', 'deceased') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Status must be either recovered or deceased';
  END IF;

  SELECT hospital_id, icu_required, status 
  INTO v_phc, v_icu, v_current_status
  FROM Patient_Cases
  WHERE case_id = p_case
  FOR UPDATE;

  IF v_phc IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Patient Case record not found';
  END IF;

  IF v_current_status != 'admitted' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Case is already closed';
  END IF;

  UPDATE Patient_Cases 
  SET status = p_status, closed_on = CURDATE() 
  WHERE case_id = p_case;

  IF v_icu THEN
    UPDATE PHC 
    SET available_icu = available_icu + 1 
    WHERE phc_id = v_phc AND available_icu < total_icu;
  ELSE
    UPDATE PHC 
    SET available_beds = available_beds + 1 
    WHERE phc_id = v_phc AND available_beds < total_beds;
  END IF;

  COMMIT;

  SELECT p_case AS case_id, p_status AS new_status, 'Discharge recorded and PHC bed restored' AS message;
END proc_label$$

-- ------------------------------------------------------------------------------
-- 10. Triggers
-- ------------------------------------------------------------------------------

-- 10.1 Outbreak Trigger: Area-level alert on admissions crossing threshold
DROP TRIGGER IF EXISTS trg_case_alert$$

CREATE TRIGGER trg_case_alert 
AFTER INSERT ON Patient_Cases
FOR EACH ROW
BEGIN
  DECLARE v_city VARCHAR(80);
  DECLARE v_district_id INT;
  DECLARE v_district_name VARCHAR(100);
  DECLARE v_thr INT;
  DECLARE v_cnt INT;
  DECLARE v_name VARCHAR(100);

  -- Retrieve PHC location & district
  SELECT p.city, p.district_id, COALESCE(d.name, p.city)
  INTO v_city, v_district_id, v_district_name
  FROM PHC p
  LEFT JOIN District d ON d.district_id = p.district_id
  WHERE p.phc_id = NEW.hospital_id;

  -- Disease threshold
  SELECT alert_threshold, name 
  INTO v_thr, v_name 
  FROM Disease 
  WHERE disease_id = NEW.disease_id;

  -- Count recent admissions for this disease in the same city/district in 7 days
  SELECT COUNT(*) INTO v_cnt 
  FROM Patient_Cases pc
  JOIN PHC p ON p.phc_id = pc.hospital_id
  WHERE pc.disease_id = NEW.disease_id 
    AND (p.city = v_city OR (p.district_id IS NOT NULL AND p.district_id = v_district_id))
    AND pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

  IF v_cnt >= v_thr AND NOT EXISTS (
    SELECT 1 FROM Alerts 
    WHERE disease_id = NEW.disease_id 
      AND (city = v_city OR (area_id = v_district_id AND area_level = 'district'))
      AND status = 'active'
  ) THEN
    INSERT INTO Alerts (disease_id, city, area_level, area_id, area_name, level, message, status)
    VALUES (
      NEW.disease_id,
      v_city,
      'district',
      v_district_id,
      v_district_name,
      CASE 
        WHEN v_cnt >= (3 * v_thr) THEN 'critical' 
        WHEN v_cnt >= (2 * v_thr) THEN 'high' 
        ELSE 'warning' 
      END,
      CONCAT(v_name, ' outbreak risk in ', v_district_name, ': ', v_cnt, ' cases in 7 days'),
      'active'
    );
  END IF;
END$$

-- 10.2 Vaccine Stockout Trigger: Auto-alert when doses hit 0
DROP TRIGGER IF EXISTS trg_vaccine_drive_stockout$$

CREATE TRIGGER trg_vaccine_drive_stockout
AFTER UPDATE ON Vaccination_Drive
FOR EACH ROW
BEGIN
  DECLARE v_vname VARCHAR(100);
  DECLARE v_pname VARCHAR(150);
  DECLARE v_did INT;

  IF NEW.doses_available = 0 AND OLD.doses_available > 0 THEN
    SELECT v.name, p.name
    INTO v_vname, v_pname
    FROM Village v
    JOIN PHC p ON p.phc_id = NEW.phc_id
    WHERE v.village_id = NEW.village_id;

    -- Create warning alert for the village
    INSERT INTO Alerts (disease_id, city, area_level, area_id, area_name, level, message, status)
    VALUES (
      1, -- Default to active health alert category
      v_vname,
      'village',
      NEW.village_id,
      v_vname,
      'warning',
      CONCAT('URGENT: Stockout of ', NEW.vaccine, ' in Village ', v_vname, ' (Drive #', NEW.drive_id, '). Replenishment required.'),
      'active'
    );
  END IF;
END$$

-- 10.3 PHC Audit Triggers
DROP TRIGGER IF EXISTS trg_phc_after_insert$$
CREATE TRIGGER trg_phc_after_insert
AFTER INSERT ON PHC
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'INSERT', 'PHC', NEW.phc_id, 
          CONCAT('Added ', NEW.facility_type, ' "', NEW.name, '" in ', NEW.city, ', ', NEW.state, ' (Beds: ', NEW.total_beds, ')'));
END$$

DROP TRIGGER IF EXISTS trg_phc_after_update$$
CREATE TRIGGER trg_phc_after_update
AFTER UPDATE ON PHC
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'UPDATE', 'PHC', NEW.phc_id, 
          CONCAT('Updated ', NEW.facility_type, ' "', NEW.name, '" (Avail Beds: ', OLD.available_beds, '->', NEW.available_beds, ', Doctor: ', NEW.doctor_available, ', Ambulance: ', NEW.ambulance_available, ')'));
END$$

DROP TRIGGER IF EXISTS trg_phc_after_delete$$
CREATE TRIGGER trg_phc_after_delete
AFTER DELETE ON PHC
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'DELETE', 'PHC', OLD.phc_id, 
          CONCAT('Deleted PHC facility "', OLD.name, '"'));
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET SQL_SAFE_UPDATES = @OLD_SQL_SAFE_UPDATES;
