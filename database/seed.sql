-- ==============================================================================
-- HealthWatch AI: Seed Data Script (MySQL 8)
-- DBMS Concepts: DML, Referential Integrity, Deterministic Test Datasets
-- Contains:
--   - 2 Demo Users (admin/admin123, viewer/viewer123) with real bcrypt hashes
--   - 8 Major Communicable Diseases across 4 categories
--   - 10 Tertiary & District Hospitals across Indian Metros
--   - 22 Hospital Medicine Stock Records (including low-stock reorder triggers)
--   - Weather Telemetry Records for major cities
--   - State-level Vaccination Coverage Records
--   - Citizen Grievance Complaints
--   - 2 Initial Outbreak Alerts
--   - Exactly 200 Clinically Distributed Sample Patient Cases
-- ==============================================================================

USE healthwatch;

-- Temporarily disable triggers and foreign key checks during batch seeding
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES, SQL_SAFE_UPDATES = 0;

-- 1. Users (admin / admin123, viewer / viewer123)
INSERT INTO Users (username, password_hash, role) VALUES
  ('admin', '$2a$10$T6YP7BzHnNxUQZprW4tYxO95Coiukl79623.wmrossCtPIkXYXOQm', 'admin'),
  ('viewer', '$2a$10$4Ra2QNEBA54coG./u.TBme0h2NBcob7rkla3goJrpuX1NvP/J9Ys6', 'public')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role);

-- 2. Diseases
TRUNCATE TABLE Disease;
INSERT INTO Disease (disease_id, name, category, alert_threshold) VALUES
  (1, 'Dengue', 'vector-borne', 15),
  (2, 'Malaria', 'vector-borne', 15),
  (3, 'Chikungunya', 'vector-borne', 12),
  (4, 'Cholera', 'water-borne', 10),
  (5, 'Typhoid', 'water-borne', 15),
  (6, 'Acute Diarrhoeal Disease', 'water-borne', 20),
  (7, 'COVID-19', 'air-borne', 20),
  (8, 'Tuberculosis', 'air-borne', 10);

-- 3. Hospitals
TRUNCATE TABLE Hospital;
INSERT INTO Hospital (hospital_id, name, city, state, latitude, longitude, total_beds, available_beds, total_icu, available_icu, ventilators) VALUES
  (1, 'AIIMS New Delhi', 'Delhi', 'Delhi', 28.5672, 77.21, 2500, 320, 200, 25, 150),
  (2, 'KEM Hospital', 'Mumbai', 'Maharashtra', 19.0028, 72.8427, 1800, 180, 150, 12, 90),
  (3, 'Victoria Hospital', 'Bengaluru', 'Karnataka', 12.9647, 77.5746, 1000, 210, 80, 15, 60),
  (4, 'Rajiv Gandhi Govt General Hospital', 'Chennai', 'Tamil Nadu', 13.0805, 80.2796, 1600, 340, 120, 28, 80),
  (5, 'SSKM Hospital', 'Kolkata', 'West Bengal', 22.5392, 88.3426, 1750, 150, 110, 8, 70),
  (6, 'Osmania General Hospital', 'Hyderabad', 'Telangana', 17.3789, 78.4735, 1150, 190, 90, 18, 55),
  (7, 'Sassoon General Hospital', 'Pune', 'Maharashtra', 18.5284, 73.8742, 1290, 220, 100, 22, 65),
  (8, 'Civil Hospital Ahmedabad', 'Ahmedabad', 'Gujarat', 23.0526, 72.6033, 2000, 410, 160, 35, 110),
  (9, 'SMS Hospital', 'Jaipur', 'Rajasthan', 26.8973, 75.8164, 1500, 260, 110, 19, 75),
  (10, 'KGMU Hospital', 'Lucknow', 'Uttar Pradesh', 26.8687, 80.9168, 2200, 290, 140, 20, 95);

-- 4. Medicine Inventory
TRUNCATE TABLE Medicine;
INSERT INTO Medicine (hospital_id, name, stock, reorder_level) VALUES
  (1, 'Paracetamol 650mg', 1200, 300),
  (1, 'Oseltamivir 75mg', 45, 100),
  (1, 'IV Normal Saline 500ml', 650, 200),
  (2, 'Artesunate Injection', 25, 80),
  (2, 'Paracetamol IV 100ml', 480, 150),
  (2, 'ORS Packets', 1500, 500),
  (3, 'Azithromycin 500mg', 280, 100),
  (3, 'Doxycycline 100mg', 35, 90),
  (4, 'Paracetamol 500mg', 950, 250),
  (4, 'Ceftriaxone 1g Inj', 50, 120),
  (5, 'ORS Powder 21.8g', 80, 200),
  (5, 'Ringer Lactate 500ml', 340, 150),
  (6, 'Remdesivir 100mg Inj', 60, 50),
  (6, 'Ciprofloxacin 500mg', 410, 120),
  (7, 'Doxycycline 100mg', 320, 100),
  (7, 'Paracetamol Drops', 180, 80),
  (8, 'Chloroquine 250mg', 210, 90),
  (8, 'Metronidazole IV', 30, 100),
  (9, 'Azithromycin 500mg', 520, 150),
  (9, 'IV Dextrose 5%', 400, 120),
  (10, 'Rifampicin 450mg', 75, 100),
  (10, 'Isoniazid 300mg', 190, 80);

-- 5. Weather Cache
TRUNCATE TABLE Weather;
INSERT INTO Weather (city, record_date, temperature, humidity, rainfall) VALUES
  ('Delhi', CURDATE(), 31.5, 68, 2.4),
  ('Mumbai', CURDATE(), 29.8, 84.5, 14.2),
  ('Bengaluru', CURDATE(), 24.2, 72, 4.8),
  ('Chennai', CURDATE(), 32, 78.5, 1.2),
  ('Kolkata', CURDATE(), 30.4, 82, 8.6),
  ('Hyderabad', CURDATE(), 28.5, 65, 0),
  ('Pune', CURDATE(), 26.3, 75, 5.5),
  ('Ahmedabad', CURDATE(), 33.6, 58, 0),
  ('Jaipur', CURDATE(), 32.8, 52, 0),
  ('Lucknow', CURDATE(), 31, 70, 3.1);

-- 6. Vaccination Coverage
TRUNCATE TABLE Vaccination;
INSERT INTO Vaccination (disease_id, state, doses_given, target_population, record_date) VALUES
  (7, 'Maharashtra', 17850000, 22000000, CURDATE()),
  (7, 'Delhi', 15200000, 16500000, CURDATE()),
  (7, 'Karnataka', 14100000, 18000000, CURDATE()),
  (7, 'Tamil Nadu', 13900000, 17500000, CURDATE()),
  (7, 'West Bengal', 16200000, 21000000, CURDATE()),
  (7, 'Uttar Pradesh', 28500000, 45000000, CURDATE()),
  (7, 'Gujarat', 12800000, 15000000, CURDATE()),
  (5, 'Maharashtra', 3400000, 8000000, CURDATE()),
  (5, 'West Bengal', 2900000, 7500000, CURDATE()),
  (8, 'Uttar Pradesh', 6100000, 12000000, CURDATE());

-- 7. Complaints
TRUNCATE TABLE Complaints;
INSERT INTO Complaints (city, description, status) VALUES
  ('Delhi', 'Water stagnation near Karol Bagh market leading to sudden rise in mosquito larvae.', 'reviewed'),
  ('Mumbai', 'Drainage overflow outside Dadar station creating foul smell and waterlogging.', 'new'),
  ('Kolkata', 'Contaminated tap water supply reported across ward 42 in past 3 days.', 'reviewed'),
  ('Bengaluru', 'Fogging drive requested in BTM Layout due to suspected dengue fever cases.', 'new'),
  ('Chennai', 'Primary Health Centre running short of basic fever medications in Royapuram.', 'closed'),
  ('Pune', 'Open garbage dump attracting flies near residential colony in Hadapsar.', 'new');

-- 8. Alerts
TRUNCATE TABLE Alerts;
INSERT INTO Alerts (disease_id, city, level, message, status) VALUES
  (1, 'Delhi', 'warning', 'Dengue case spike observed in South Delhi health zone: 16 cases reported in 7 days', 'active'),
  (4, 'Kolkata', 'high', 'Suspected Cholera outbreak alert in East Kolkata: 22 cases in 7 days', 'resolved');

-- 9. Patient Cases (200 records)
TRUNCATE TABLE Patient_Cases;
INSERT INTO Patient_Cases (disease_id, hospital_id, age_group, gender, icu_required, status, admitted_on, closed_on) VALUES
  (1, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (1, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 17 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 24 DAY), NULL),
  (1, 4, '60+', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (1, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (1, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 16 DAY), NULL),
  (1, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 23 DAY), NULL),
  (1, 6, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (1, 9, '60+', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (1, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 15 DAY), NULL),
  (1, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 22 DAY), NULL),
  (1, 8, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 0 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (1, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (1, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 14 DAY), NULL),
  (1, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 21 DAY), NULL),
  (1, 10, '15-30', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_SUB(CURDATE(), INTERVAL 25 DAY)),
  (1, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (1, 6, '46-60', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 13 DAY), NULL),
  (1, 9, '60+', 'M', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 19 DAY)),
  (1, 2, '0-14', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 27 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY)),
  (1, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (1, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 12 DAY), NULL),
  (1, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 19 DAY), NULL),
  (1, 4, '60+', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 26 DAY), DATE_SUB(CURDATE(), INTERVAL 23 DAY)),
  (1, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (1, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL),
  (1, 3, '31-45', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 18 DAY), NULL),
  (1, 6, '46-60', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 22 DAY)),
  (1, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (1, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (1, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 17 DAY), NULL),
  (1, 8, '31-45', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 24 DAY), DATE_SUB(CURDATE(), INTERVAL 21 DAY)),
  (1, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (1, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (1, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 16 DAY), NULL),
  (1, 10, '15-30', 'O', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 23 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
  (1, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (1, 6, '46-60', 'F', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 8 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
  (1, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 15 DAY), NULL),
  (1, 2, '0-14', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 19 DAY)),
  (2, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 0 DAY), NULL),
  (2, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (2, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 14 DAY), NULL),
  (2, 4, '60+', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 21 DAY), DATE_SUB(CURDATE(), INTERVAL 18 DAY)),
  (2, 7, '0-14', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 28 DAY), NULL),
  (2, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (2, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 13 DAY), NULL),
  (2, 6, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY)),
  (2, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 27 DAY), NULL),
  (2, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (2, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 12 DAY), NULL),
  (2, 8, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 19 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY)),
  (2, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 26 DAY), NULL),
  (2, 4, '60+', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (2, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL),
  (2, 10, '15-30', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
  (2, 3, '31-45', 'M', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY)),
  (2, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (2, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (2, 2, '0-14', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 17 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY)),
  (2, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 24 DAY), NULL),
  (2, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (2, 1, '46-60', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (2, 4, '60+', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 13 DAY)),
  (2, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 23 DAY), NULL),
  (2, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (2, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (2, 6, '46-60', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
  (2, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 22 DAY), NULL),
  (2, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 0 DAY), NULL),
  (3, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (3, 8, '31-45', 'O', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY)),
  (3, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 21 DAY), NULL),
  (3, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 28 DAY), NULL),
  (3, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (3, 10, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (3, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 20 DAY), NULL),
  (3, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 27 DAY), NULL),
  (3, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (3, 2, '0-14', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
  (3, 5, '15-30', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 19 DAY), NULL),
  (3, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 26 DAY), NULL),
  (3, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (3, 4, '60+', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY)),
  (3, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 18 DAY), NULL),
  (3, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 25 DAY), NULL),
  (3, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (3, 6, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
  (3, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 17 DAY), NULL),
  (3, 2, '0-14', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 24 DAY), NULL),
  (3, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (3, 8, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 9 DAY), DATE_SUB(CURDATE(), INTERVAL 6 DAY)),
  (3, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 16 DAY), NULL),
  (3, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 23 DAY), NULL),
  (3, 7, '0-14', 'M', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (4, 10, '15-30', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 8 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
  (4, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 15 DAY), NULL),
  (4, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 22 DAY), NULL),
  (4, 9, '60+', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 0 DAY), NULL),
  (4, 2, '0-14', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 4 DAY)),
  (4, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 14 DAY), NULL),
  (4, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 21 DAY), NULL),
  (4, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 28 DAY), NULL),
  (4, 4, '60+', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
  (4, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 13 DAY), NULL),
  (4, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 20 DAY), NULL),
  (4, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 27 DAY), NULL),
  (4, 6, '46-60', 'O', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (4, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 12 DAY), NULL),
  (4, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 19 DAY), NULL),
  (4, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 26 DAY), NULL),
  (4, 8, '31-45', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
  (4, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL),
  (4, 4, '60+', 'F', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY)),
  (4, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 25 DAY), NULL),
  (4, 10, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (4, 3, '31-45', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (4, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 17 DAY), NULL),
  (4, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 24 DAY), NULL),
  (4, 2, '0-14', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (4, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (4, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 16 DAY), NULL),
  (4, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 23 DAY), NULL),
  (4, 4, '60+', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 1 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (4, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (5, 10, '15-30', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 15 DAY), NULL),
  (5, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 22 DAY), NULL),
  (5, 6, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 0 DAY), DATE_SUB(CURDATE(), INTERVAL 0 DAY)),
  (5, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (5, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 14 DAY), NULL),
  (5, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 21 DAY), NULL),
  (5, 8, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_SUB(CURDATE(), INTERVAL 25 DAY)),
  (5, 1, '46-60', 'M', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 6 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
  (5, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 13 DAY), NULL),
  (5, 7, '0-14', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 20 DAY), NULL),
  (5, 10, '15-30', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 27 DAY), DATE_SUB(CURDATE(), INTERVAL 24 DAY)),
  (5, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (5, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 12 DAY), NULL),
  (5, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 19 DAY), NULL),
  (5, 2, '0-14', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 26 DAY), DATE_SUB(CURDATE(), INTERVAL 23 DAY)),
  (5, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (5, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL),
  (5, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 18 DAY), NULL),
  (5, 4, '60+', 'O', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 22 DAY)),
  (5, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (5, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (5, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 17 DAY), NULL),
  (5, 6, '46-60', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 24 DAY), DATE_SUB(CURDATE(), INTERVAL 21 DAY)),
  (5, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (5, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (6, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 16 DAY), NULL),
  (6, 8, '31-45', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 23 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
  (6, 1, '46-60', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (6, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (6, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 15 DAY), NULL),
  (6, 10, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 19 DAY)),
  (6, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 0 DAY), NULL),
  (6, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (6, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 14 DAY), NULL),
  (6, 2, '0-14', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 21 DAY), DATE_SUB(CURDATE(), INTERVAL 18 DAY)),
  (6, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 28 DAY), NULL),
  (6, 8, '31-45', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (6, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 13 DAY), NULL),
  (6, 4, '60+', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 17 DAY)),
  (6, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 27 DAY), NULL),
  (6, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (6, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 12 DAY), NULL),
  (6, 6, '46-60', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 19 DAY), DATE_SUB(CURDATE(), INTERVAL 16 DAY)),
  (6, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 26 DAY), NULL),
  (6, 2, '0-14', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (7, 5, '15-30', 'O', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (7, 8, '31-45', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
  (7, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 25 DAY), NULL),
  (7, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL),
  (7, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL),
  (7, 10, '15-30', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 17 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY)),
  (7, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 24 DAY), NULL),
  (7, 6, '46-60', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL),
  (7, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 9 DAY), NULL),
  (7, 2, '0-14', 'O', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 16 DAY), DATE_SUB(CURDATE(), INTERVAL 13 DAY)),
  (7, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 23 DAY), NULL),
  (7, 8, '31-45', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL),
  (7, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL),
  (7, 4, '60+', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_SUB(CURDATE(), INTERVAL 12 DAY)),
  (7, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 22 DAY), NULL),
  (8, 10, '15-30', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 0 DAY), NULL),
  (8, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 7 DAY), NULL),
  (8, 6, '46-60', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY)),
  (8, 9, '60+', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 21 DAY), NULL),
  (8, 2, '0-14', 'F', 0, 'deceased', DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_SUB(CURDATE(), INTERVAL 27 DAY)),
  (8, 5, '15-30', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL),
  (8, 8, '31-45', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 13 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
  (8, 1, '46-60', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 20 DAY), NULL),
  (8, 4, '60+', 'F', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 27 DAY), NULL),
  (8, 7, '0-14', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 5 DAY), NULL),
  (8, 10, '15-30', 'F', 0, 'recovered', DATE_SUB(CURDATE(), INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
  (8, 3, '31-45', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 19 DAY), NULL),
  (8, 6, '46-60', 'O', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 26 DAY), NULL),
  (8, 9, '60+', 'M', 0, 'admitted', DATE_SUB(CURDATE(), INTERVAL 4 DAY), NULL),
  (8, 2, '0-14', 'F', 1, 'recovered', DATE_SUB(CURDATE(), INTERVAL 11 DAY), DATE_SUB(CURDATE(), INTERVAL 8 DAY));

-- Restore environment variables
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET SQL_SAFE_UPDATES = @OLD_SQL_SAFE_UPDATES;
