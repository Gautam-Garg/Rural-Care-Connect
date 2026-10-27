-- =====================================================
-- Rural Care Connect add-ons (runs on the healthwatch DB)
-- Safe to run more than once.
-- =====================================================

-- ---------- Shared: distance function (Haversine) ----------
DROP FUNCTION IF EXISTS fn_distance_km;
DELIMITER $$
CREATE FUNCTION fn_distance_km(lat1 DOUBLE, lng1 DOUBLE, lat2 DOUBLE, lng2 DOUBLE)
RETURNS DOUBLE DETERMINISTIC
BEGIN
  RETURN 6371 * ACOS(LEAST(1.0, GREATEST(-1.0,
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * COS(RADIANS(lng2) - RADIANS(lng1))
    + SIN(RADIANS(lat1)) * SIN(RADIANS(lat2)))));
END$$
DELIMITER ;

-- =====================================================
-- FEATURE 1: Total Cost of Care
-- =====================================================
CREATE TABLE IF NOT EXISTS Travel_Mode (
  mode_id     INT AUTO_INCREMENT PRIMARY KEY,
  mode_code   VARCHAR(20) NOT NULL UNIQUE,
  label_en    VARCHAR(40) NOT NULL,
  cost_per_km DECIMAL(6,2) NOT NULL,
  speed_kmph  DECIMAL(5,1) NOT NULL,
  is_sample   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Travel_Mode (mode_code, label_en, cost_per_km, speed_kmph, is_sample) VALUES
 ('walk',    'Walk',           0.00,  4.0, 1),
 ('bicycle', 'Bicycle',        0.00, 12.0, 1),
 ('bike',    'Own motorbike',  3.00, 30.0, 1),
 ('bus',     'Bus',            3.00, 25.0, 1),
 ('auto',    'Shared auto',    4.00, 20.0, 1),
 ('vehicle', 'Hired vehicle', 12.00, 30.0, 1);

CREATE TABLE IF NOT EXISTS Cost_Assumption (
  assumption_id INT AUTO_INCREMENT PRIMARY KEY,
  key_name      VARCHAR(50) NOT NULL UNIQUE,
  value_num     DECIMAL(10,2) NOT NULL,
  label         VARCHAR(120),
  is_sample     TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Cost_Assumption (key_name, value_num, label, is_sample) VALUES
 ('default_daily_wage',        300, 'Daily wage used if the user enters none (Rs.)', 1),
 ('visit_waiting_hours',         2, 'Hours spent at the facility per visit', 1),
 ('work_day_hours',              8, 'Hours in one working day', 1),
 ('private_clinic_distance_km', 12, 'Assumed distance to a private clinic in town (km)', 1);

-- category values must match Service_Cost.category exactly
CREATE TABLE IF NOT EXISTS Private_Benchmark (
  benchmark_id          INT AUTO_INCREMENT PRIMARY KEY,
  category              VARCHAR(40) NOT NULL UNIQUE,
  label                 VARCHAR(60) NOT NULL DEFAULT 'Private clinic (typical) (Sample)',
  typical_service_cost  DECIMAL(8,2) NOT NULL,
  typical_medicine_cost DECIMAL(8,2) NOT NULL DEFAULT 0,
  is_sample             TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Private_Benchmark (category, label, typical_service_cost, typical_medicine_cost, is_sample) VALUES
 ('Consultation',   'Private clinic (typical) (Sample)', 300, 200, 1),
 ('Vaccination',    'Private clinic (typical) (Sample)', 250,   0, 1),
 ('Emergency Care', 'Private clinic (typical) (Sample)', 600, 300, 1),
 ('Diagnostic',     'Private clinic (typical) (Sample)', 500,   0, 1),
 ('General Health', 'Private clinic (typical) (Sample)', 300, 150, 1),
 ('fever',          'Private clinic (typical) (Sample)', 300, 200, 1),
 ('delivery',       'Private clinic (typical) (Sample)', 1500, 500, 1),
 ('injury',         'Private clinic (typical) (Sample)', 600, 300, 1),
 ('tests',          'Private clinic (typical) (Sample)', 500,   0, 1),
 ('general',        'Private clinic (typical) (Sample)', 300, 150, 1);

DROP PROCEDURE IF EXISTS sp_total_cost_of_care;
DELIMITER $$
CREATE PROCEDURE sp_total_cost_of_care(
  IN p_lat DOUBLE,
  IN p_lng DOUBLE,
  IN p_category VARCHAR(40),
  IN p_mode VARCHAR(20),
  IN p_daily_wage DECIMAL(8,2),
  IN p_limit INT
)
BEGIN
  DECLARE v_cpk   DECIMAL(6,2) DEFAULT NULL;
  DECLARE v_speed DECIMAL(5,1) DEFAULT NULL;
  DECLARE v_wait  DECIMAL(4,1) DEFAULT 2;
  DECLARE v_day   DECIMAL(4,1) DEFAULT 8;
  DECLARE v_pdist DECIMAL(5,1) DEFAULT 12;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

  SELECT cost_per_km, speed_kmph INTO v_cpk, v_speed FROM Travel_Mode WHERE mode_code = p_mode;
  IF v_cpk IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown travel mode';
  END IF;

  SELECT value_num INTO v_wait  FROM Cost_Assumption WHERE key_name = 'visit_waiting_hours';
  SELECT value_num INTO v_day   FROM Cost_Assumption WHERE key_name = 'work_day_hours';
  SELECT value_num INTO v_pdist FROM Cost_Assumption WHERE key_name = 'private_clinic_distance_km';

  SELECT t.*, (t.service_cost + t.travel_cost + t.wage_loss) AS total_cost
  FROM (
    SELECT p.phc_id,
           p.name AS phc_name,
           p.facility_type,
           p.doctor_on_duty,
           p.operating_hours,
           p.contact_phone,
           ROUND(d.dist, 1) AS distance_km,
           sc.service_name,
           sc.is_free,
           sc.scheme_name,
           IF(sc.is_free = 1, 0, ROUND(sc.cost_inr)) AS service_cost,
           ROUND(d.dist * 2 * v_cpk) AS travel_cost,
           ROUND(p_daily_wage * LEAST(1, (d.dist * 2 / v_speed + v_wait) / v_day)) AS wage_loss
    FROM (SELECT phc_id, fn_distance_km(p_lat, p_lng, latitude, longitude) AS dist FROM PHC) d
    JOIN PHC p           ON p.phc_id = d.phc_id
    JOIN Service_Cost sc ON sc.phc_id = p.phc_id
    WHERE sc.category = p_category
       OR (p_category IN ('Consultation', 'fever') AND sc.category IN ('Consultation', 'fever'))
       OR (p_category IN ('Maternal Care', 'delivery') AND sc.category IN ('Maternal Care', 'delivery'))
       OR (p_category IN ('Vaccination', 'vaccination') AND sc.category IN ('Vaccination', 'vaccination'))
       OR (p_category IN ('Emergency Care', 'injury') AND sc.category IN ('Emergency Care', 'injury'))
       OR (p_category IN ('Diagnostic', 'tests') AND sc.category IN ('Diagnostic', 'tests'))
       OR (p_category IN ('Medicine Supply', 'medicines') AND sc.category IN ('Medicine Supply', 'medicines'))
       OR (p_category IN ('General Health', 'general') AND sc.category IN ('General Health', 'general'))
  ) t
  ORDER BY total_cost ASC
  LIMIT p_limit;

  SELECT x.*, (x.service_cost + x.travel_cost + x.wage_loss) AS total_cost
  FROM (
    SELECT pb.label AS phc_name,
           'PRIVATE' AS facility_type,
           v_pdist AS distance_km,
           ROUND(pb.typical_service_cost + pb.typical_medicine_cost) AS service_cost,
           ROUND(v_pdist * 2 * v_cpk) AS travel_cost,
           ROUND(p_daily_wage * LEAST(1, (v_pdist * 2 / v_speed + v_wait) / v_day)) AS wage_loss
    FROM Private_Benchmark pb
    WHERE pb.category = p_category
       OR (p_category IN ('Consultation', 'fever') AND pb.category IN ('Consultation', 'fever'))
       OR (p_category IN ('Maternal Care', 'delivery') AND pb.category IN ('Maternal Care', 'delivery'))
       OR (p_category IN ('Vaccination', 'vaccination') AND pb.category IN ('Vaccination', 'vaccination'))
       OR (p_category IN ('Emergency Care', 'injury') AND pb.category IN ('Emergency Care', 'injury'))
       OR (p_category IN ('Diagnostic', 'tests') AND pb.category IN ('Diagnostic', 'tests'))
       OR (p_category IN ('Medicine Supply', 'medicines') AND pb.category IN ('Medicine Supply', 'medicines'))
       OR (p_category IN ('General Health', 'general') AND pb.category IN ('General Health', 'general'))
    LIMIT 1
  ) x;
END$$
DELIMITER ;

-- =====================================================
-- FEATURE 2: Medicine fallback
-- Medicine rows are matched across PHCs by medicine name.
-- =====================================================
CREATE TABLE IF NOT EXISTS Medicine_Info (
  info_id                INT AUTO_INCREMENT PRIMARY KEY,
  name                   VARCHAR(100) NOT NULL UNIQUE,
  salt_composition       VARCHAR(150) NULL,
  strength               VARCHAR(30)  NULL,
  jan_aushadhi_available TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Medicine_Info (name)
SELECT DISTINCT name FROM Medicine;

-- Seed salts and strengths for demo matching
UPDATE Medicine_Info SET salt_composition = 'Paracetamol', strength = '500mg', jan_aushadhi_available = 1 WHERE name LIKE 'Paracetamol%500mg%';
UPDATE Medicine_Info SET salt_composition = 'Paracetamol', strength = '650mg', jan_aushadhi_available = 1 WHERE name LIKE 'Paracetamol%650mg%';
UPDATE Medicine_Info SET salt_composition = 'Oral Rehydration Salts', strength = 'Sachet', jan_aushadhi_available = 1 WHERE name LIKE '%ORS%' OR name LIKE '%Oral Rehydration%';
UPDATE Medicine_Info SET salt_composition = 'Amoxicillin', strength = '250mg', jan_aushadhi_available = 1 WHERE name LIKE 'Amoxicillin%250mg%';
UPDATE Medicine_Info SET salt_composition = 'Ciprofloxacin', strength = '500mg', jan_aushadhi_available = 1 WHERE name LIKE 'Ciprofloxacin%500mg%';
UPDATE Medicine_Info SET salt_composition = 'Metronidazole', strength = '400mg', jan_aushadhi_available = 1 WHERE name LIKE 'Metronidazole%400mg%';
UPDATE Medicine_Info SET salt_composition = 'Zinc Sulfate', strength = '20mg', jan_aushadhi_available = 1 WHERE name LIKE 'Zinc%20mg%';
UPDATE Medicine_Info SET salt_composition = 'Metformin', strength = '500mg', jan_aushadhi_available = 1 WHERE name LIKE 'Metformin%500mg%';

CREATE TABLE IF NOT EXISTS Jan_Aushadhi_Kendra (
  kendra_id  INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  village_id INT NULL,
  latitude   DECIMAL(10,6) NOT NULL,
  longitude  DECIMAL(10,6) NOT NULL,
  phone      VARCHAR(20) NULL,
  is_sample  TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_jak_village FOREIGN KEY (village_id) REFERENCES Village(village_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Jan_Aushadhi_Kendra (name, village_id, latitude, longitude, is_sample)
SELECT CONCAT('Jan Aushadhi Kendra (Sample) - ', v.name), v.village_id,
       v.latitude + 0.010, v.longitude + 0.010, 1
FROM Village v
WHERE v.village_id NOT IN (
  SELECT village_id FROM (
    SELECT village_id FROM Jan_Aushadhi_Kendra WHERE village_id IS NOT NULL
  ) AS jak_sub
)
ORDER BY v.village_id
LIMIT 8;

CREATE TABLE IF NOT EXISTS Medicine_Demand_Log (
  log_id        INT AUTO_INCREMENT PRIMARY KEY,
  phc_id        INT NOT NULL,
  medicine_name VARCHAR(100) NOT NULL,
  searched_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_demand_name (medicine_name, searched_at),
  CONSTRAINT fk_mdl_phc FOREIGN KEY (phc_id) REFERENCES PHC(phc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW vw_missed_medicines AS
SELECT l.medicine_name, p.name AS phc_name, COUNT(*) AS searches_last_30_days
FROM Medicine_Demand_Log l
JOIN PHC p ON p.phc_id = l.phc_id
WHERE l.searched_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY l.medicine_name, p.name
ORDER BY searches_last_30_days DESC;

DROP PROCEDURE IF EXISTS sp_medicine_fallback;
DELIMITER $$
CREATE PROCEDURE sp_medicine_fallback(
  IN p_phc_id INT,
  IN p_medicine_id INT,
  IN p_lat DOUBLE,
  IN p_lng DOUBLE,
  IN p_limit INT
)
BEGIN
  DECLARE v_name     VARCHAR(100) DEFAULT NULL;
  DECLARE v_salt     VARCHAR(150) DEFAULT NULL;
  DECLARE v_strength VARCHAR(30)  DEFAULT NULL;
  DECLARE v_jan      TINYINT(1)   DEFAULT 0;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

  SELECT name INTO v_name FROM Medicine
  WHERE medicine_id = p_medicine_id AND hospital_id = p_phc_id;
  IF v_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicine not found at this PHC';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL THEN
    SELECT latitude, longitude INTO p_lat, p_lng FROM PHC WHERE phc_id = p_phc_id;
  END IF;

  SELECT salt_composition, strength, jan_aushadhi_available
  INTO v_salt, v_strength, v_jan
  FROM Medicine_Info WHERE name = v_name;

  SELECT p.phc_id,
         p.name AS phc_name,
         p.facility_type,
         p.contact_phone,
         p.doctor_on_duty,
         ROUND(fn_distance_km(p_lat, p_lng, p.latitude, p.longitude), 1) AS distance_km,
         m.stock AS quantity,
         (m.updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)) AS data_may_be_old
  FROM Medicine m
  JOIN PHC p ON p.phc_id = m.hospital_id
  WHERE m.name = v_name
    AND m.hospital_id <> p_phc_id
    AND m.stock > 0
  ORDER BY distance_km
  LIMIT p_limit;

  SELECT m.name AS alternative_name, m.stock AS quantity
  FROM Medicine m
  JOIN Medicine_Info mi ON mi.name = m.name
  WHERE m.hospital_id = p_phc_id
    AND m.name <> v_name
    AND v_salt IS NOT NULL
    AND v_strength IS NOT NULL
    AND mi.salt_composition = v_salt
    AND mi.strength = v_strength
    AND m.stock > 0;

  SELECT k.kendra_id, k.name, k.phone,
         ROUND(fn_distance_km(p_lat, p_lng, k.latitude, k.longitude), 1) AS distance_km
  FROM Jan_Aushadhi_Kendra k
  WHERE v_jan = 1
  ORDER BY distance_km
  LIMIT p_limit;
END$$
DELIMITER ;

-- =====================================================
-- FEATURE 3: "Was the doctor there?" feedback loop
-- =====================================================
CREATE TABLE IF NOT EXISTS Visit_Feedback (
  feedback_id        INT AUTO_INCREMENT PRIMARY KEY,
  phc_id             INT NOT NULL,
  village_id         INT NULL,
  visit_date         DATE NOT NULL,
  doctor_present     ENUM('YES','NO') NOT NULL,
  medicine_available ENUM('YES','PARTIAL','NO','NOT_NEEDED') NOT NULL DEFAULT 'NOT_NEEDED',
  source             ENUM('VILLAGER','ASHA') NOT NULL DEFAULT 'VILLAGER',
  user_id            INT NULL,
  device_hash        CHAR(64) NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vf_phc     FOREIGN KEY (phc_id)     REFERENCES PHC(phc_id),
  CONSTRAINT fk_vf_village FOREIGN KEY (village_id) REFERENCES Village(village_id),
  UNIQUE KEY uq_one_report_per_day (phc_id, device_hash, visit_date),
  INDEX idx_vf_phc_date (phc_id, visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Feedback_Alert (
  feedback_alert_id INT AUTO_INCREMENT PRIMARY KEY,
  phc_id            INT NOT NULL,
  alert_type        VARCHAR(40) NOT NULL DEFAULT 'DOCTOR_ABSENT_REPORTS',
  message           VARCHAR(255) NOT NULL,
  status            ENUM('active','resolved') NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fa_phc FOREIGN KEY (phc_id) REFERENCES PHC(phc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW vw_phc_feedback_summary AS
SELECT
  f.phc_id,
  COUNT(*)                                                    AS reports_14d,
  SUM(f.doctor_present = 'YES')                               AS doctor_yes,
  ROUND(100 * SUM(f.doctor_present = 'YES') / COUNT(*))       AS doctor_present_pct,
  ROUND(100 * SUM(f.medicine_available = 'YES')
        / NULLIF(SUM(f.medicine_available <> 'NOT_NEEDED'), 0)) AS medicine_yes_pct,
  MAX(f.created_at)                                           AS last_report_at
FROM Visit_Feedback f
WHERE f.visit_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
GROUP BY f.phc_id;

DROP TRIGGER IF EXISTS trg_feedback_doctor_absent;
DELIMITER $$
CREATE TRIGGER trg_feedback_doctor_absent
AFTER INSERT ON Visit_Feedback
FOR EACH ROW
BEGIN
  DECLARE v_no_count INT DEFAULT 0;
  DECLARE v_recent   INT DEFAULT 0;

  IF NEW.doctor_present = 'NO' THEN
    SELECT COUNT(*) INTO v_no_count
    FROM Visit_Feedback
    WHERE phc_id = NEW.phc_id
      AND doctor_present = 'NO'
      AND visit_date >= DATE_SUB(CURDATE(), INTERVAL 3 DAY);

    SELECT COUNT(*) INTO v_recent
    FROM Feedback_Alert
    WHERE phc_id = NEW.phc_id
      AND alert_type = 'DOCTOR_ABSENT_REPORTS'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY);

    IF v_no_count >= 3 AND v_recent = 0 THEN
      INSERT INTO Feedback_Alert (phc_id, alert_type, message)
      VALUES (NEW.phc_id, 'DOCTOR_ABSENT_REPORTS',
              'Three or more villagers reported no doctor in the last 3 days. Please check the roster.');
    END IF;
  END IF;
END$$
DELIMITER ;

-- Sample feedback data (labeled sample)
INSERT IGNORE INTO Visit_Feedback (phc_id, visit_date, doctor_present, medicine_available, device_hash) VALUES
 (1, CURDATE(),                           'YES', 'YES',        SHA2('sample-1', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'YES', 'PARTIAL',    SHA2('sample-2', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'NO',  'NO',         SHA2('sample-3', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'YES', 'YES',        SHA2('sample-4', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'YES', 'NOT_NEEDED', SHA2('sample-5', 256));
