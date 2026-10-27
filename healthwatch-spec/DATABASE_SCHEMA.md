# Database Schema (MySQL 8)

Generate these as `database/schema.sql`, `views.sql`, `procedures.sql`, `triggers.sql`, and `seed.sql` (at least 10 hospitals across Indian cities, 8 diseases, 200 sample cases, 2 users).
Tables must be in 3NF. Add indexes on all foreign keys and on (disease_id, admitted_on).

## Tables
```sql
CREATE DATABASE IF NOT EXISTS healthwatch;
USE healthwatch;

CREATE TABLE Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','public') NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Disease (
  disease_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('vector-borne','water-borne','air-borne','other') NOT NULL,
  alert_threshold INT NOT NULL DEFAULT 20   -- cases in 7 days per city
);

CREATE TABLE Hospital (
  hospital_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  total_beds INT NOT NULL CHECK (total_beds >= 0),
  available_beds INT NOT NULL CHECK (available_beds >= 0),
  total_icu INT NOT NULL DEFAULT 0,
  available_icu INT NOT NULL DEFAULT 0,
  ventilators INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (available_beds <= total_beds),
  CHECK (available_icu <= total_icu)
);

CREATE TABLE Patient_Cases (
  case_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  hospital_id INT NOT NULL,
  age_group ENUM('0-14','15-30','31-45','46-60','60+') NOT NULL,
  gender ENUM('M','F','O') NOT NULL,
  icu_required BOOLEAN DEFAULT FALSE,
  status ENUM('admitted','recovered','deceased') DEFAULT 'admitted',
  admitted_on DATE NOT NULL,
  closed_on DATE NULL,
  FOREIGN KEY (disease_id) REFERENCES Disease(disease_id),
  FOREIGN KEY (hospital_id) REFERENCES Hospital(hospital_id),
  INDEX idx_disease_date (disease_id, admitted_on)
);

CREATE TABLE Weather (
  weather_id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(80) NOT NULL,
  record_date DATE NOT NULL,
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  rainfall DECIMAL(6,2),
  UNIQUE KEY uq_city_date (city, record_date)
);

CREATE TABLE Medicine (
  medicine_id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 50,
  FOREIGN KEY (hospital_id) REFERENCES Hospital(hospital_id) ON DELETE CASCADE
);

CREATE TABLE Alerts (
  alert_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  city VARCHAR(80) NOT NULL,
  level ENUM('warning','high','critical') NOT NULL,
  message VARCHAR(255) NOT NULL,
  status ENUM('active','resolved') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (disease_id) REFERENCES Disease(disease_id)
);

CREATE TABLE Vaccination (
  vaccination_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  state VARCHAR(80) NOT NULL,
  doses_given INT NOT NULL,
  target_population INT NOT NULL,
  record_date DATE NOT NULL,
  FOREIGN KEY (disease_id) REFERENCES Disease(disease_id)
);

-- Extra tables for features named in the project brief
CREATE TABLE Complaints (
  complaint_id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(80), description TEXT NOT NULL,
  status ENUM('new','reviewed','closed') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Audit_Log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT, action VARCHAR(20), table_name VARCHAR(50), record_id INT,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imported real dataset (IDSP / EpiClim), see DATASET.md
CREATE TABLE Disease_Stats (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_name VARCHAR(100), state VARCHAR(80), district VARCHAR(80),
  year INT, week INT, report_date DATE, cases INT, deaths INT DEFAULT 0,
  latitude DECIMAL(9,6), longitude DECIMAL(9,6),
  temperature DECIMAL(5,2), preci DECIMAL(8,2),
  INDEX idx_stat (disease_name, state, year, week)
);
```

## Views (views.sql)
```sql
CREATE VIEW vw_bed_availability AS
SELECT hospital_id, name, city, state, latitude, longitude,
       available_beds, total_beds,
       ROUND(100*available_beds/NULLIF(total_beds,0),1) AS pct_free,
       available_icu, total_icu, ventilators
FROM Hospital;

CREATE VIEW vw_daily_cases AS
SELECT d.name AS disease, h.city, pc.admitted_on AS day, COUNT(*) AS cases,
       SUM(pc.status='deceased') AS deaths
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN Hospital h ON h.hospital_id = pc.hospital_id
GROUP BY d.name, h.city, pc.admitted_on;

CREATE VIEW vw_outbreak_candidates AS   -- GROUP BY + HAVING demo
SELECT d.name AS disease, h.city, COUNT(*) AS cases_7d
FROM Patient_Cases pc
JOIN Disease d ON d.disease_id = pc.disease_id
JOIN Hospital h ON h.hospital_id = pc.hospital_id
WHERE pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY d.name, h.city, d.alert_threshold
HAVING COUNT(*) >= d.alert_threshold;

CREATE VIEW vw_low_stock AS
SELECT m.name AS medicine, h.name AS hospital, m.stock, m.reorder_level
FROM Medicine m JOIN Hospital h ON h.hospital_id = m.hospital_id
WHERE m.stock <= m.reorder_level;
```

## Stored procedures (procedures.sql)
```sql
DELIMITER $$
CREATE PROCEDURE sp_admit_patient(
  IN p_disease INT, IN p_hospital INT, IN p_age_group VARCHAR(10),
  IN p_gender CHAR(1), IN p_icu BOOLEAN)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  IF p_icu THEN
    UPDATE Hospital SET available_icu = available_icu - 1
    WHERE hospital_id = p_hospital AND available_icu > 0;
  ELSE
    UPDATE Hospital SET available_beds = available_beds - 1
    WHERE hospital_id = p_hospital AND available_beds > 0;
  END IF;
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No bed available';
  END IF;
  INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, icu_required, admitted_on)
  VALUES (p_disease, p_hospital, p_age_group, p_gender, p_icu, CURDATE());
  COMMIT;
END$$

CREATE PROCEDURE sp_close_case(IN p_case INT, IN p_status VARCHAR(10))
BEGIN
  DECLARE v_hosp INT; DECLARE v_icu BOOLEAN;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT hospital_id, icu_required INTO v_hosp, v_icu FROM Patient_Cases
    WHERE case_id = p_case AND status = 'admitted' FOR UPDATE;
  UPDATE Patient_Cases SET status = p_status, closed_on = CURDATE() WHERE case_id = p_case;
  IF v_icu THEN UPDATE Hospital SET available_icu = available_icu + 1 WHERE hospital_id = v_hosp;
  ELSE UPDATE Hospital SET available_beds = available_beds + 1 WHERE hospital_id = v_hosp;
  END IF;
  COMMIT;
END$$
DELIMITER ;
```

## Triggers (triggers.sql)
```sql
DELIMITER $$
CREATE TRIGGER trg_case_alert AFTER INSERT ON Patient_Cases
FOR EACH ROW
BEGIN
  DECLARE v_city VARCHAR(80); DECLARE v_thr INT; DECLARE v_cnt INT; DECLARE v_name VARCHAR(100);
  SELECT city INTO v_city FROM Hospital WHERE hospital_id = NEW.hospital_id;
  SELECT alert_threshold, name INTO v_thr, v_name FROM Disease WHERE disease_id = NEW.disease_id;
  SELECT COUNT(*) INTO v_cnt FROM Patient_Cases pc
    JOIN Hospital h ON h.hospital_id = pc.hospital_id
    WHERE pc.disease_id = NEW.disease_id AND h.city = v_city
      AND pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);
  IF v_cnt >= v_thr AND NOT EXISTS
     (SELECT 1 FROM Alerts WHERE disease_id = NEW.disease_id AND city = v_city AND status = 'active') THEN
    INSERT INTO Alerts (disease_id, city, level, message)
    VALUES (NEW.disease_id, v_city,
            CASE WHEN v_cnt >= 3*v_thr THEN 'critical' WHEN v_cnt >= 2*v_thr THEN 'high' ELSE 'warning' END,
            CONCAT(v_name, ' outbreak risk in ', v_city, ': ', v_cnt, ' cases in 7 days'));
  END IF;
END$$
DELIMITER ;
```
Also add AFTER INSERT/UPDATE/DELETE triggers on Hospital, Disease, Medicine that write to Audit_Log (or write audit rows from the backend for admin actions).

## Concepts checklist (map to the syllabus in the viva)
PK/FK, CHECK constraints, normalization (3NF), joins (all views), views, stored procedures, triggers, indexes, aggregates, GROUP BY, HAVING, transactions with rollback.
