-- ==============================================================================
-- HealthWatch AI: Database Triggers (MySQL 8)
-- DBMS Concepts: Active Databases, Event-Condition-Action (ECA) Rules,
--                Row-Level Triggers (AFTER INSERT, AFTER UPDATE, AFTER DELETE),
--                Automated Alert Generation & Audit Trails
-- ==============================================================================

USE healthwatch;

DELIMITER $$

-- ------------------------------------------------------------------------------
-- Trigger 1: trg_case_alert (Automated Outbreak Detection)
-- Event: AFTER INSERT on Patient_Cases
-- Condition: Cases for disease in hospital's city over past 7 days >= alert_threshold
-- Action: Automatically raises an alert in Alerts table if no active alert exists.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_case_alert$$

CREATE TRIGGER trg_case_alert 
AFTER INSERT ON Patient_Cases
FOR EACH ROW
BEGIN
  DECLARE v_city VARCHAR(80);
  DECLARE v_thr INT;
  DECLARE v_cnt INT;
  DECLARE v_name VARCHAR(100);

  -- Retrieve city where the admission took place
  SELECT city INTO v_city 
  FROM Hospital 
  WHERE hospital_id = NEW.hospital_id;

  -- Retrieve disease alert threshold and name
  SELECT alert_threshold, name 
  INTO v_thr, v_name 
  FROM Disease 
  WHERE disease_id = NEW.disease_id;

  -- Count recent admissions for this disease in the same city over the past 7 days
  SELECT COUNT(*) INTO v_cnt 
  FROM Patient_Cases pc
  JOIN Hospital h ON h.hospital_id = pc.hospital_id
  WHERE pc.disease_id = NEW.disease_id 
    AND h.city = v_city
    AND pc.admitted_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

  -- Evaluate outbreak threshold and ensure duplicate active alert is not raised
  IF v_cnt >= v_thr AND NOT EXISTS (
    SELECT 1 FROM Alerts 
    WHERE disease_id = NEW.disease_id 
      AND city = v_city 
      AND status = 'active'
  ) THEN
    INSERT INTO Alerts (disease_id, city, level, message, status)
    VALUES (
      NEW.disease_id,
      v_city,
      CASE 
        WHEN v_cnt >= (3 * v_thr) THEN 'critical' 
        WHEN v_cnt >= (2 * v_thr) THEN 'high' 
        ELSE 'warning' 
      END,
      CONCAT(v_name, ' outbreak risk in ', v_city, ': ', v_cnt, ' cases in 7 days'),
      'active'
    );
  END IF;
END$$

-- ==============================================================================
-- Audit Triggers (Track Admin Changes on Hospital, Disease, and Medicine)
-- ==============================================================================

-- Hospital Audit Triggers
DROP TRIGGER IF EXISTS trg_hospital_after_insert$$
CREATE TRIGGER trg_hospital_after_insert
AFTER INSERT ON Hospital
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'INSERT', 'Hospital', NEW.hospital_id, 
          CONCAT('Added hospital "', NEW.name, '" in ', NEW.city, ', ', NEW.state, ' (Beds: ', NEW.total_beds, ')'));
END$$

DROP TRIGGER IF EXISTS trg_hospital_after_update$$
CREATE TRIGGER trg_hospital_after_update
AFTER UPDATE ON Hospital
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'UPDATE', 'Hospital', NEW.hospital_id, 
          CONCAT('Updated hospital "', NEW.name, '" (Avail Beds: ', OLD.available_beds, '->', NEW.available_beds, ', Avail ICU: ', OLD.available_icu, '->', NEW.available_icu, ')'));
END$$

DROP TRIGGER IF EXISTS trg_hospital_after_delete$$
CREATE TRIGGER trg_hospital_after_delete
AFTER DELETE ON Hospital
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'DELETE', 'Hospital', OLD.hospital_id, 
          CONCAT('Deleted hospital "', OLD.name, '"'));
END$$

-- Disease Audit Triggers
DROP TRIGGER IF EXISTS trg_disease_after_insert$$
CREATE TRIGGER trg_disease_after_insert
AFTER INSERT ON Disease
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'INSERT', 'Disease', NEW.disease_id, 
          CONCAT('Added disease "', NEW.name, '" (Category: ', NEW.category, ', Threshold: ', NEW.alert_threshold, ')'));
END$$

DROP TRIGGER IF EXISTS trg_disease_after_update$$
CREATE TRIGGER trg_disease_after_update
AFTER UPDATE ON Disease
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'UPDATE', 'Disease', NEW.disease_id, 
          CONCAT('Updated disease "', NEW.name, '" (Threshold: ', OLD.alert_threshold, '->', NEW.alert_threshold, ')'));
END$$

DROP TRIGGER IF EXISTS trg_disease_after_delete$$
CREATE TRIGGER trg_disease_after_delete
AFTER DELETE ON Disease
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'DELETE', 'Disease', OLD.disease_id, 
          CONCAT('Deleted disease "', OLD.name, '"'));
END$$

-- Medicine Audit Triggers
DROP TRIGGER IF EXISTS trg_medicine_after_insert$$
CREATE TRIGGER trg_medicine_after_insert
AFTER INSERT ON Medicine
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'INSERT', 'Medicine', NEW.medicine_id, 
          CONCAT('Added medicine "', NEW.name, '" (Stock: ', NEW.stock, ', Reorder: ', NEW.reorder_level, ')'));
END$$

DROP TRIGGER IF EXISTS trg_medicine_after_update$$
CREATE TRIGGER trg_medicine_after_update
AFTER UPDATE ON Medicine
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'UPDATE', 'Medicine', NEW.medicine_id, 
          CONCAT('Updated medicine "', NEW.name, '" (Stock: ', OLD.stock, '->', NEW.stock, ')'));
END$$

DROP TRIGGER IF EXISTS trg_medicine_after_delete$$
CREATE TRIGGER trg_medicine_after_delete
AFTER DELETE ON Medicine
FOR EACH ROW
BEGIN
  INSERT INTO Audit_Log (user_id, action, table_name, record_id, details)
  VALUES (NULL, 'DELETE', 'Medicine', OLD.medicine_id, 
          CONCAT('Deleted medicine "', OLD.name, '"'));
END$$

DELIMITER ;
