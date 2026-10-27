-- ==============================================================================
-- HealthWatch AI: Stored Procedures (MySQL 8)
-- DBMS Concepts: ACID Transactions, START TRANSACTION, COMMIT, ROLLBACK,
--                Row-Level Locking (SELECT ... FOR UPDATE),
--                Exception Handling (DECLARE EXIT HANDLER FOR SQLEXCEPTION),
--                Custom Exceptions (SIGNAL SQLSTATE)
-- ==============================================================================

USE healthwatch;

DELIMITER $$

-- ------------------------------------------------------------------------------
-- Procedure 1: sp_admit_patient
-- Purpose: Atomically checks bed availability, decrements bed count,
--          inserts patient admission record, and commits.
--          Rolls back transaction completely if bed is not available.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_admit_patient$$

CREATE PROCEDURE sp_admit_patient(
  IN p_disease INT,
  IN p_hospital INT,
  IN p_age_group VARCHAR(10),
  IN p_gender CHAR(1),
  IN p_icu BOOLEAN
)
proc_label: BEGIN
  DECLARE v_new_case_id INT;

  -- Exit handler: automatically rollback transaction if any SQL error occurs
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Validate disease exists
  IF NOT EXISTS (SELECT 1 FROM Disease WHERE disease_id = p_disease) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid disease ID';
  END IF;

  -- Validate hospital exists
  IF NOT EXISTS (SELECT 1 FROM Hospital WHERE hospital_id = p_hospital) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid hospital ID';
  END IF;

  -- Atomically decrement bed or ICU inventory
  IF p_icu THEN
    UPDATE Hospital 
    SET available_icu = available_icu - 1
    WHERE hospital_id = p_hospital AND available_icu > 0;
  ELSE
    UPDATE Hospital 
    SET available_beds = available_beds - 1
    WHERE hospital_id = p_hospital AND available_beds > 0;
  END IF;

  -- Check if bed was successfully decremented
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No bed available in this hospital';
  END IF;

  -- Insert clinical admission record
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
    p_hospital,
    p_age_group,
    p_gender,
    p_icu,
    'admitted',
    CURDATE()
  );

  SET v_new_case_id = LAST_INSERT_ID();

  -- Commit atomic transaction
  COMMIT;

  -- Return created record info for API and testing callers
  SELECT v_new_case_id AS case_id, 'Admission successful' AS message;
END proc_label$$

-- ------------------------------------------------------------------------------
-- Procedure 2: sp_close_case
-- Purpose: Closes an active case ('recovered' or 'deceased'), updates closed_on,
--          and restores the bed/ICU count in the corresponding hospital.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_close_case$$

CREATE PROCEDURE sp_close_case(
  IN p_case INT,
  IN p_status VARCHAR(10)
)
proc_label: BEGIN
  DECLARE v_hosp INT;
  DECLARE v_icu BOOLEAN;
  DECLARE v_current_status VARCHAR(10);

  -- Exit handler: rollback transaction if an exception occurs
  DECLARE EXIT HANDLER FOR SQLEXCEPTION 
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Validate status parameter
  IF p_status NOT IN ('recovered', 'deceased') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Status must be either recovered or deceased';
  END IF;

  -- Select case details with FOR UPDATE to prevent race conditions
  SELECT hospital_id, icu_required, status 
  INTO v_hosp, v_icu, v_current_status
  FROM Patient_Cases
  WHERE case_id = p_case
  FOR UPDATE;

  -- Check if case exists
  IF v_hosp IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Case ID not found';
  END IF;

  -- Only currently admitted cases can be closed
  IF v_current_status != 'admitted' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Case is already closed';
  END IF;

  -- Update case status and discharge date
  UPDATE Patient_Cases 
  SET status = p_status, closed_on = CURDATE() 
  WHERE case_id = p_case;

  -- Return bed to hospital capacity
  IF v_icu THEN
    UPDATE Hospital 
    SET available_icu = available_icu + 1 
    WHERE hospital_id = v_hosp AND available_icu < total_icu;
  ELSE
    UPDATE Hospital 
    SET available_beds = available_beds + 1 
    WHERE hospital_id = v_hosp AND available_beds < total_beds;
  END IF;

  COMMIT;

  SELECT p_case AS case_id, p_status AS new_status, 'Case closed and bed released' AS message;
END proc_label$$

DELIMITER ;
