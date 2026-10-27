-- ==============================================================================
-- HealthWatch AI: Add Realistic Outbreak Data (Dengue in Delhi & Cholera in Kolkata)
-- DBMS Concepts: DML (INSERT ONLY), Time-Series Modeling, Epidemic Curve
-- Note: Does NOT truncate or drop any tables; purely adds rows to Patient_Cases.
-- ==============================================================================

USE healthwatch;

-- ------------------------------------------------------------------------------
-- 1. DENGUE OUTBREAK IN DELHI (Hospital ID 1: AIIMS New Delhi, Disease ID 1)
-- Rising curve over the last 30 days:
-- - Days 28-21: Sporadic baseline (1 case / 2-3 days, all recovered)
-- - Days 20-14: Outbreak incubation & early transmission (2-3 cases / day)
-- - Days 13-8:  Rapid transmission acceleration (4-6 cases / day)
-- - Days 7-0:   Surging epidemic wave (8-16 cases / day, mostly admitted)
-- ------------------------------------------------------------------------------

INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, icu_required, status, admitted_on, closed_on) VALUES
  -- Days 28 to 21 ago: Sporadic baseline
  (1, 1, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_SUB(CURDATE(), INTERVAL 23 DAY)),
  (1, 1, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
  (1, 1, '46-60', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY)),

  -- Days 20 to 14 ago: Early cluster detection (10 cases)
  (1, 1, '0-14',  'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY)),
  (1, 1, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
  (1, 1, '31-45', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 13 DAY)),
  (1, 1, '46-60', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
  (1, 1, '60+',   'M', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (1, 1, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY)),
  (1, 1, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (1, 1, '0-14',  'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
  (1, 1, '46-60', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY)),
  (1, 1, '60+',   'F', 1, 'deceased',  DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY)),

  -- Days 13 to 8 ago: Exponential acceleration (21 cases)
  (1, 1, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
  (1, 1, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY)),
  (1, 1, '46-60', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
  (1, 1, '0-14',  'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
  (1, 1, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
  (1, 1, '31-45', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
  (1, 1, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
  (1, 1, '60+',   'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY),  DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (1, 1, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY),  DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
  (1, 1, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY),  DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 9 DAY),  NULL),
  (1, 1, '60+',   'F', 1, 'deceased',  DATE_SUB(CURDATE(), INTERVAL 9 DAY),  DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 9 DAY),  NULL),
  (1, 1, '0-14',  'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 8 DAY),  DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (1, 1, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 8 DAY),  DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  NULL),
  (1, 1, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY),  NULL),

  -- Days 7 to 0 ago: Outbreak surge & peak wave (98 cases)
  -- Day 7 (8 cases)
  (1, 1, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (1, 1, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 1, '31-45', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 1, '60+',   'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  -- Day 6 (9 cases)
  (1, 1, '0-14',  'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '60+',   'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  -- Day 5 (11 cases)
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '46-60', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '60+',   'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  -- Day 4 (12 cases)
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '46-60', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '60+',   'F', 1, 'deceased',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  -- Day 3 (13 cases)
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  -- Day 2 (15 cases)
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '46-60', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '60+',   'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '60+',   'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  -- Day 1 (16 cases)
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '46-60', 'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '60+',   'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  -- Day 0 / Today (14 cases)
  (1, 1, '15-30', 'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '46-60', 'M', 1, 'admitted',  CURDATE(), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '60+',   'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '0-14',  'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '0-14',  'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '15-30', 'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '15-30', 'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '31-45', 'M', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '46-60', 'F', 0, 'admitted',  CURDATE(), NULL),
  (1, 1, '31-45', 'F', 0, 'admitted',  CURDATE(), NULL);


-- ------------------------------------------------------------------------------
-- 2. CHOLERA OUTBREAK IN KOLKATA (Hospital ID 5: SSKM Hospital, Disease ID 4)
-- Rising curve over the last 30 days:
-- - Days 26-18: Early baseline water contamination (1 case / 2-3 days)
-- - Days 16-10: Cluster outbreak expanding (2-4 cases / day)
-- - Days 9-5:   Monsoon water supply contamination surge (5-9 cases / day)
-- - Days 4-0:   Epidemic wave peak (10-12 cases / day, mostly admitted)
-- ------------------------------------------------------------------------------

INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, icu_required, status, admitted_on, closed_on) VALUES
  -- Days 26 to 18 ago: Baseline (4 cases)
  (4, 5, '31-45', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 26 DAY), DATE_SUB(CURDATE(), INTERVAL 22 DAY)),
  (4, 5, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 23 DAY), DATE_SUB(CURDATE(), INTERVAL 19 DAY)),
  (4, 5, '46-60', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY)),
  (4, 5, '0-14',  'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY)),

  -- Days 16 to 10 ago: Expanding waterborne transmission (12 cases)
  (4, 5, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
  (4, 5, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY)),
  (4, 5, '0-14',  'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (4, 5, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
  (4, 5, '60+',   'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (4, 5, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY)),
  (4, 5, '31-45', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
  (4, 5, '60+',   'F', 1, 'deceased',  DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (4, 5, '0-14',  'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
  (4, 5, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),

  -- Days 9 to 5 ago: Outbreak surge (35 cases)
  -- Day 9 (5 cases)
  (4, 5, '15-30', 'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
  (4, 5, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (4, 5, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  -- Day 8 (6 cases)
  (4, 5, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 8 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (4, 5, '60+',   'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  -- Day 7 (7 cases)
  (4, 5, '0-14',  'M', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (4, 5, '60+',   'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (4, 5, '31-45', 'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  -- Day 6 (8 cases)
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '60+',   'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  -- Day 5 (9 cases)
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '46-60', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '60+',   'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),

  -- Days 4 to 0 ago: Outbreak crest (54 cases)
  -- Day 4 (10 cases)
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  -- Day 3 (11 cases)
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '46-60', 'F', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '60+',   'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  -- Day 2 (12 cases)
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '60+',   'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '60+',   'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  -- Day 1 (11 cases)
  (4, 5, '15-30', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '46-60', 'M', 1, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '60+',   'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  -- Day 0 / Today (10 cases)
  (4, 5, '15-30', 'M', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '15-30', 'F', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '31-45', 'M', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '31-45', 'F', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '46-60', 'M', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '46-60', 'F', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '60+',   'M', 1, 'admitted',  CURDATE(), NULL),
  (4, 5, '0-14',  'M', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '0-14',  'F', 0, 'admitted',  CURDATE(), NULL),
  (4, 5, '15-30', 'F', 0, 'admitted',  CURDATE(), NULL);
