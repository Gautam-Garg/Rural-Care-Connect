-- ==============================================================================
-- HealthWatch AI: Phase 1 Verification & Test Script (MySQL 8)
-- DBMS Concepts: Testing Views, Stored Procedures, ACID Transactions,
--                Atomic Rollback on Error, Row Locks, Active Triggers, Audit Trail
-- ==============================================================================

USE healthwatch;

-- ------------------------------------------------------------------------------
-- 1. VERIFY VIEWS
-- ------------------------------------------------------------------------------
SELECT '=== 1.1 Testing vw_bed_availability ===' AS test_step;
SELECT hospital_id, name, city, available_beds, total_beds, pct_free, available_icu, total_icu, ventilators 
FROM vw_bed_availability 
LIMIT 5;

SELECT '=== 1.2 Testing vw_daily_cases ===' AS test_step;
SELECT disease, city, day, cases, deaths, recoveries 
FROM vw_daily_cases 
ORDER BY day DESC 
LIMIT 5;

SELECT '=== 1.3 Testing vw_outbreak_candidates (GROUP BY + HAVING) ===' AS test_step;
SELECT * FROM vw_outbreak_candidates;

SELECT '=== 1.4 Testing vw_low_stock ===' AS test_step;
SELECT * FROM vw_low_stock;


-- ------------------------------------------------------------------------------
-- 2. TEST TRANSACTION & ROLLBACK (sp_admit_patient)
-- Purpose: Prove that when available_beds = 0, the procedure signals an error
--          and rolls back the entire transaction without modifying Patient_Cases.
-- ------------------------------------------------------------------------------
SELECT '=== 2.1 Setup: Create test hospital with ZERO available beds ===' AS test_step;

INSERT INTO Hospital (hospital_id, name, city, state, latitude, longitude, total_beds, available_beds, total_icu, available_icu, ventilators)
VALUES (999, 'Test Trauma Centre', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, 50, 0, 10, 0, 5)
ON DUPLICATE KEY UPDATE available_beds = 0, available_icu = 0;

SELECT hospital_id, name, available_beds, available_icu 
FROM Hospital 
WHERE hospital_id = 999;

-- Record count before attempted admission
SET @count_before = (SELECT COUNT(*) FROM Patient_Cases WHERE hospital_id = 999);
SELECT @count_before AS cases_before_failed_admission;

-- This call SHOULD FAIL with: "Error Code: 1644. No bed available in this hospital"
-- In MySQL Workbench / CLI, run the following line to observe rollback:
-- CALL sp_admit_patient(1, 999, '31-45', 'M', FALSE);

-- Verify no row was inserted into Patient_Cases due to rollback:
SET @count_after = (SELECT COUNT(*) FROM Patient_Cases WHERE hospital_id = 999);
SELECT @count_after AS cases_after_failed_admission, 
       IF(@count_before = @count_after, 'PASS: Transaction rolled back atomically!', 'FAIL: Row was inserted!') AS test_result;


-- ------------------------------------------------------------------------------
-- 3. TEST SUCCESSFUL TRANSACTION (sp_admit_patient)
-- Purpose: Verify bed decrement and case insertion commit atomically.
-- ------------------------------------------------------------------------------
SELECT '=== 3.1 Test Successful Patient Admission ===' AS test_step;

-- Give test hospital 2 beds
UPDATE Hospital SET available_beds = 2 WHERE hospital_id = 999;

SELECT hospital_id, available_beds AS beds_before_admission 
FROM Hospital 
WHERE hospital_id = 999;

-- Call procedure to admit patient (icu_required = FALSE)
CALL sp_admit_patient(1, 999, '31-45', 'M', FALSE);

-- Verify bed was decremented and case exists
SELECT hospital_id, available_beds AS beds_after_admission 
FROM Hospital 
WHERE hospital_id = 999;

SELECT case_id, disease_id, hospital_id, age_group, gender, icu_required, status, admitted_on
FROM Patient_Cases 
WHERE hospital_id = 999 
ORDER BY case_id DESC 
LIMIT 1;


-- ------------------------------------------------------------------------------
-- 4. TEST CASE CLOSURE & BED RELEASE (sp_close_case)
-- Purpose: Verify status changes to 'recovered' and bed is restored.
-- ------------------------------------------------------------------------------
SELECT '=== 4.1 Test Case Discharge / Bed Release ===' AS test_step;

SET @latest_case_id = (SELECT case_id FROM Patient_Cases WHERE hospital_id = 999 ORDER BY case_id DESC LIMIT 1);

CALL sp_close_case(@latest_case_id, 'recovered');

-- Check case status and discharge date
SELECT case_id, status, admitted_on, closed_on 
FROM Patient_Cases 
WHERE case_id = @latest_case_id;

-- Check restored bed count in hospital (should increase from 1 back to 2)
SELECT hospital_id, available_beds AS beds_after_discharge 
FROM Hospital 
WHERE hospital_id = 999;


-- ------------------------------------------------------------------------------
-- 5. TEST AUTOMATED OUTBREAK TRIGGER (trg_case_alert)
-- Purpose: Prove that inserting cases crossing a disease alert threshold in a
--          city within 7 days fires trg_case_alert and inserts an active alert.
-- ------------------------------------------------------------------------------
SELECT '=== 5.1 Test Outbreak Alert Trigger ===' AS test_step;

-- Setup: Create dedicated test disease with low threshold = 3 for easy testing
INSERT INTO Disease (disease_id, name, category, alert_threshold)
VALUES (99, 'Zika Virus Test', 'vector-borne', 3)
ON DUPLICATE KEY UPDATE alert_threshold = 3;

-- Clean any prior alerts for this test disease in Jaipur
DELETE FROM Alerts WHERE disease_id = 99 AND city = 'Jaipur';

-- Verify no active alert exists currently
SELECT * FROM Alerts WHERE disease_id = 99 AND city = 'Jaipur' AND status = 'active';

-- Insert 2 cases (threshold is 3, so trigger should NOT fire yet)
INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, status, admitted_on)
VALUES 
  (99, 999, '15-30', 'F', 'admitted', CURDATE()),
  (99, 999, '31-45', 'M', 'admitted', CURDATE());

SELECT COUNT(*) AS cases_recorded, 'Should be 2 (below threshold 3)' AS note 
FROM Patient_Cases 
WHERE disease_id = 99 AND hospital_id = 999;

SELECT COUNT(*) AS alert_count_before, 'Should be 0' AS note 
FROM Alerts 
WHERE disease_id = 99 AND city = 'Jaipur' AND status = 'active';

-- Insert 3rd case (crosses threshold of 3, trigger trg_case_alert FIRES!)
INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, status, admitted_on)
VALUES (99, 999, '46-60', 'F', 'admitted', CURDATE());

-- Verify trigger automatically generated an active alert in Alerts table!
SELECT alert_id, disease_id, city, level, message, status, created_at
FROM Alerts 
WHERE disease_id = 99 AND city = 'Jaipur' AND status = 'active';


-- ------------------------------------------------------------------------------
-- 6. TEST AUDIT LOG TRIGGERS
-- ------------------------------------------------------------------------------
SELECT '=== 6.1 Verify Audit Log Entries ===' AS test_step;
SELECT log_id, action, table_name, record_id, details, logged_at 
FROM Audit_Log 
ORDER BY log_id DESC 
LIMIT 10;


-- ------------------------------------------------------------------------------
-- CLEANUP TEST DATA (Optional)
-- ------------------------------------------------------------------------------
-- DELETE FROM Patient_Cases WHERE hospital_id = 999;
-- DELETE FROM Alerts WHERE disease_id = 99;
-- DELETE FROM Hospital WHERE hospital_id = 999;
-- DELETE FROM Disease WHERE disease_id = 99;
