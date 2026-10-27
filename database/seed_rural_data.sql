-- ==============================================================================
-- Rural Care Connect: Comprehensive Seed Dataset (MySQL 8)
-- Replaces big-city hospital data with realistic rural health ecosystem
-- States: Maharashtra, Madhya Pradesh, Bihar
-- Includes:
--   - 3 States, 10 Rural Districts, 20 Blocks, 45 Villages
--   - 30 PHCs, CHCs, and Sub-centres with realistic capacities & GPS
--   - 3 Users (admin, viewer, asha)
--   - 75+ Affordable Service Cost rows with Ayushman Bharat / JSY / Jan Aushadhi
--   - 18 Village Vaccination Drives
--   - 12 Area-targeted Alerts (district / block / village level)
--   - 60+ Medicine Inventory rows per PHC with reorder alerts
--   - ASHA Workers & PHC Service Requests
--   - Rural Patient Admissions & Cases
-- ==============================================================================

USE healthwatch;

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_SAFE_UPDATES = @@SQL_SAFE_UPDATES, SQL_SAFE_UPDATES = 0;

-- ------------------------------------------------------------------------------
-- 1. Users (admin, viewer, asha)
-- ------------------------------------------------------------------------------
INSERT INTO Users (username, password_hash, role) VALUES
  ('admin', '$2a$10$T6YP7BzHnNxUQZprW4tYxO95Coiukl79623.wmrossCtPIkXYXOQm', 'admin'),
  ('viewer', '$2a$10$4Ra2QNEBA54coG./u.TBme0h2NBcob7rkla3goJrpuX1NvP/J9Ys6', 'public'),
  ('asha', '$2a$10$b1AvAG4rXyAnGILfHn9k2.sllK5.eIpu0RiVktLmdoeUmte1VqaIa', 'asha')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role);

-- ------------------------------------------------------------------------------
-- 2. Diseases Master
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Disease;
INSERT INTO Disease (disease_id, name, category, alert_threshold) VALUES
  (1, 'Dengue', 'vector-borne', 12),
  (2, 'Malaria', 'vector-borne', 10),
  (3, 'Chikungunya', 'vector-borne', 10),
  (4, 'Cholera', 'water-borne', 6),
  (5, 'Typhoid', 'water-borne', 12),
  (6, 'Acute Diarrhoeal Disease', 'water-borne', 15),
  (7, 'Tuberculosis', 'air-borne', 8),
  (8, 'COVID-19', 'air-borne', 15);

-- ------------------------------------------------------------------------------
-- 3. Geographic Hierarchy (State > District > Block > Village)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE State;
INSERT INTO State (state_id, name, code) VALUES
  (1, 'Maharashtra', 'MH'),
  (2, 'Madhya Pradesh', 'MP'),
  (3, 'Bihar', 'BR');

TRUNCATE TABLE District;
INSERT INTO District (district_id, state_id, name, latitude, longitude) VALUES
  -- Maharashtra
  (1, 1, 'Pune Rural', 18.7523, 73.9100),
  (2, 1, 'Satara', 17.6805, 73.9903),
  (3, 1, 'Nashik Rural', 20.0820, 74.0200),
  (4, 1, 'Ahmednagar', 19.0952, 74.7496),
  -- Madhya Pradesh
  (5, 2, 'Sehore', 23.2000, 77.0800),
  (6, 2, 'Raisen', 23.3300, 77.7800),
  (7, 2, 'Hoshangabad (Narmadapuram)', 22.7500, 77.7200),
  -- Bihar
  (8, 3, 'Patna Rural', 25.5500, 85.0500),
  (9, 3, 'Gaya', 24.7955, 85.0002),
  (10, 3, 'Nalanda', 25.1982, 85.5149);

TRUNCATE TABLE Block;
INSERT INTO Block (block_id, district_id, name) VALUES
  -- Maharashtra
  (1, 1, 'Junnar'),
  (2, 1, 'Shirur'),
  (3, 2, 'Wai'),
  (4, 2, 'Khandala'),
  (5, 3, 'Sinnar'),
  (6, 3, 'Dindori'),
  (7, 4, 'Sangamner'),
  -- Madhya Pradesh
  (8, 5, 'Ichhawar'),
  (9, 5, 'Ashta'),
  (10, 6, 'Sanchi'),
  (11, 6, 'Gairatganj'),
  (12, 7, 'Babai'),
  (13, 7, 'Sohagpur'),
  -- Bihar
  (14, 8, 'Bihta'),
  (15, 8, 'Danapur Rural'),
  (16, 9, 'Bodh Gaya'),
  (17, 9, 'Sherghati'),
  (18, 9, 'Barachatti'),
  (19, 10, 'Rajgir'),
  (20, 10, 'Silao');

TRUNCATE TABLE Village;
INSERT INTO Village (village_id, block_id, name, population, latitude, longitude) VALUES
  -- MH - Junnar
  (1, 1, 'Otur', 4500, 19.2612, 73.9854),
  (2, 1, 'Narayangaon', 6800, 19.1234, 73.9781),
  (3, 1, 'Anerai', 1800, 19.2104, 73.9421),
  -- MH - Shirur
  (4, 2, 'Pabal', 3200, 18.8351, 74.0532),
  (5, 2, 'Koregaon Bhima', 5100, 18.6534, 74.0521),
  -- MH - Wai
  (6, 3, 'Bhuinj', 2900, 17.9712, 74.0125),
  (7, 3, 'Surur', 2100, 17.9351, 74.0321),
  -- MH - Khandala
  (8, 4, 'Shirwal', 5800, 18.1354, 73.9851),
  (9, 4, 'Lonand', 4200, 18.0412, 74.1923),
  -- MH - Sinnar
  (10, 5, 'Vavi', 3100, 19.8214, 74.1256),
  (11, 5, 'Dodi', 2600, 19.7854, 74.0921),
  -- MH - Dindori
  (12, 6, 'Vani Rural', 3900, 20.2105, 73.9102),
  (13, 6, 'Khedgaon', 2200, 20.1524, 73.8541),
  -- MH - Sangamner
  (14, 7, 'Rajur', 4100, 19.5421, 73.8124),
  (15, 7, 'Ashwi', 2800, 19.6105, 74.3214),

  -- MP - Ichhawar
  (16, 8, 'Bilkisganj', 3800, 23.0854, 77.1521),
  (17, 8, 'Amlaha', 2500, 23.1124, 77.0124),
  -- MP - Ashta
  (18, 9, 'Kothri', 4200, 23.0124, 76.7824),
  (19, 9, 'Jawar', 3100, 23.0512, 76.6214),
  -- MP - Sanchi
  (20, 10, 'Salamatpur', 3500, 23.4124, 77.7102),
  (21, 10, 'Gulabganj Rural', 2700, 23.4854, 77.8105),
  -- MP - Gairatganj
  (22, 11, 'Tekapar', 1900, 23.3912, 78.1521),
  (23, 11, 'Silwani Border', 2300, 23.3105, 78.2914),
  -- MP - Babai
  (24, 12, 'Bagra Tawa', 3400, 22.6521, 77.8524),
  (25, 12, 'Semri Harchand', 2900, 22.7125, 77.9512),
  -- MP - Sohagpur
  (26, 13, 'Sobhapur', 4000, 22.7854, 78.1824),
  (27, 13, 'Pipariya Kalan', 2600, 22.7321, 78.3125),

  -- Bihar - Bihta
  (28, 14, 'Neora', 4800, 25.6124, 85.0124),
  (29, 14, 'Amhara', 3200, 25.5421, 84.9214),
  (30, 14, 'Painal', 2400, 25.5812, 84.9654),
  -- Bihar - Danapur Rural
  (31, 15, 'Usri Khurd', 3600, 25.6214, 85.0512),
  (32, 15, 'Maniari', 2900, 25.6512, 85.0921),
  -- Bihar - Bodh Gaya
  (33, 16, 'Mastipur', 3900, 24.7124, 84.9854),
  (34, 16, 'Bakrour', 2700, 24.6954, 85.0124),
  (35, 16, 'Mora Pahar', 1800, 24.7521, 84.9321),
  -- Bihar - Sherghati
  (36, 17, 'Hamzapur', 3300, 24.5812, 84.8124),
  (37, 17, 'Dobhi Rural', 4100, 24.5214, 84.9512),
  -- Bihar - Barachatti
  (38, 18, 'Sobh', 2500, 24.4812, 85.0812),
  (39, 18, 'Bhalua', 1900, 24.4215, 85.1214),
  -- Bihar - Rajgir
  (40, 19, 'Nahub', 3100, 25.0412, 85.4215),
  (41, 19, 'Pilkhi', 2400, 25.0124, 85.4854),
  (42, 19, 'Barabar Foot', 1700, 25.0854, 85.3912),
  -- Bihar - Silao
  (43, 20, 'Nalanda Dehat', 4500, 25.1324, 85.4521),
  (44, 20, 'Karianna', 2800, 25.1612, 85.5124),
  (45, 20, 'Mahuri', 2200, 25.1105, 85.4102);

-- ------------------------------------------------------------------------------
-- 4. PHCs, CHCs, and Sub-centres (30 Rural Facilities)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE PHC;
INSERT INTO PHC (
  phc_id, name, facility_type, state_id, district_id, block_id, village_id, 
  city, state, latitude, longitude, 
  total_beds, available_beds, total_icu, available_icu, ventilators, 
  doctor_available, ambulance_available, open_hours, phone
) VALUES
  -- Maharashtra (10 facilities)
  (1, 'Otur Primary Health Centre', 'PHC', 1, 1, 1, 1, 'Otur', 'Maharashtra', 19.2612, 73.9854, 10, 6, 2, 1, 1, TRUE, TRUE, '24x7', '02132-264210'),
  (2, 'Narayangaon Community Health Centre', 'CHC', 1, 1, 1, 2, 'Narayangaon', 'Maharashtra', 19.1234, 73.9781, 30, 14, 4, 2, 2, TRUE, TRUE, '24x7', '02132-242300'),
  (3, 'Anerai Health Sub-Centre', 'Sub-centre', 1, 1, 1, 3, 'Anerai', 'Maharashtra', 19.2104, 73.9421, 2, 1, 0, 0, 0, FALSE, FALSE, '09:00 AM - 04:00 PM', '02132-264999'),
  (4, 'Pabal Primary Health Centre', 'PHC', 1, 1, 2, 4, 'Pabal', 'Maharashtra', 18.8351, 74.0532, 12, 7, 2, 1, 1, TRUE, TRUE, '24x7', '02138-272215'),
  (5, 'Bhuinj Primary Health Centre', 'PHC', 1, 2, 3, 6, 'Bhuinj', 'Maharashtra', 17.9712, 74.0125, 8, 4, 1, 1, 0, TRUE, TRUE, '24x7', '02167-240108'),
  (6, 'Wai Rural Sub-District Hospital', 'CHC', 1, 2, 3, 7, 'Wai Rural', 'Maharashtra', 17.9351, 74.0321, 25, 9, 3, 1, 1, TRUE, TRUE, '24x7', '02167-220050'),
  (7, 'Shirwal Community Health Centre', 'CHC', 1, 2, 4, 8, 'Shirwal', 'Maharashtra', 18.1354, 73.9851, 20, 11, 2, 1, 1, TRUE, TRUE, '24x7', '02169-244222'),
  (8, 'Vavi Primary Health Centre', 'PHC', 1, 3, 5, 10, 'Vavi', 'Maharashtra', 19.8214, 74.1256, 8, 5, 1, 0, 0, TRUE, FALSE, '24x7', '02551-246108'),
  (9, 'Dodi Health Sub-Centre', 'Sub-centre', 1, 3, 5, 11, 'Dodi', 'Maharashtra', 19.7854, 74.0921, 2, 2, 0, 0, 0, FALSE, FALSE, '08:30 AM - 03:30 PM', '02551-246999'),
  (10, 'Rajur Tribal Primary Health Centre', 'PHC', 1, 4, 7, 14, 'Rajur', 'Maharashtra', 19.5421, 73.8124, 12, 5, 2, 1, 1, TRUE, TRUE, '24x7', '02424-251108'),

  -- Madhya Pradesh (10 facilities)
  (11, 'Bilkisganj Primary Health Centre', 'PHC', 2, 5, 8, 16, 'Bilkisganj', 'Madhya Pradesh', 23.0854, 77.1521, 10, 6, 2, 1, 0, TRUE, TRUE, '24x7', '07562-273108'),
  (12, 'Ichhawar Community Health Centre', 'CHC', 2, 5, 8, 17, 'Ichhawar', 'Madhya Pradesh', 23.1124, 77.0124, 24, 12, 3, 1, 1, TRUE, TRUE, '24x7', '07562-244100'),
  (13, 'Kothri Primary Health Centre', 'PHC', 2, 5, 9, 18, 'Kothri', 'Madhya Pradesh', 23.0124, 76.7824, 8, 3, 1, 0, 0, TRUE, FALSE, '24x7', '07560-261108'),
  (14, 'Jawar Health Sub-Centre', 'Sub-centre', 2, 5, 9, 19, 'Jawar', 'Madhya Pradesh', 23.0512, 76.6214, 2, 1, 0, 0, 0, FALSE, FALSE, '09:00 AM - 04:00 PM', '07560-261999'),
  (15, 'Salamatpur Primary Health Centre', 'PHC', 2, 6, 10, 20, 'Salamatpur', 'Madhya Pradesh', 23.4124, 77.7102, 10, 7, 2, 2, 1, TRUE, TRUE, '24x7', '07482-277108'),
  (16, 'Sanchi Community Health Centre', 'CHC', 2, 6, 10, 21, 'Sanchi', 'Madhya Pradesh', 23.4854, 77.8105, 22, 10, 3, 2, 1, TRUE, TRUE, '24x7', '07482-266200'),
  (17, 'Tekapar Health Sub-Centre', 'Sub-centre', 2, 6, 11, 22, 'Tekapar', 'Madhya Pradesh', 23.3912, 78.1521, 2, 2, 0, 0, 0, FALSE, FALSE, '08:00 AM - 03:00 PM', '07482-288999'),
  (18, 'Bagra Tawa Primary Health Centre', 'PHC', 2, 7, 12, 24, 'Bagra Tawa', 'Madhya Pradesh', 22.6521, 77.8524, 8, 4, 1, 1, 0, TRUE, TRUE, '24x7', '07574-255108'),
  (19, 'Babai Community Health Centre', 'CHC', 2, 7, 12, 25, 'Babai', 'Madhya Pradesh', 22.7125, 77.9512, 20, 8, 2, 1, 1, TRUE, TRUE, '24x7', '07574-242100'),
  (20, 'Sobhapur Primary Health Centre', 'PHC', 2, 7, 13, 26, 'Sobhapur', 'Madhya Pradesh', 22.7854, 78.1824, 10, 5, 2, 1, 0, TRUE, TRUE, '24x7', '07575-271108'),

  -- Bihar (10 facilities)
  (21, 'Neora Primary Health Centre', 'PHC', 3, 8, 14, 28, 'Neora', 'Bihar', 25.6124, 85.0124, 10, 5, 2, 1, 0, TRUE, TRUE, '24x7', '06115-281108'),
  (22, 'Bihta Community Health Centre', 'CHC', 3, 8, 14, 29, 'Bihta', 'Bihar', 25.5421, 84.9214, 28, 11, 4, 2, 2, TRUE, TRUE, '24x7', '06115-252200'),
  (23, 'Painal Health Sub-Centre', 'Sub-centre', 3, 8, 14, 30, 'Painal', 'Bihar', 25.5812, 84.9654, 2, 2, 0, 0, 0, FALSE, FALSE, '09:00 AM - 04:00 PM', '06115-281999'),
  (24, 'Usri Khurd Primary Health Centre', 'PHC', 3, 8, 15, 31, 'Usri Khurd', 'Bihar', 25.6214, 85.0512, 8, 4, 1, 0, 0, TRUE, FALSE, '24x7', '06115-291108'),
  (25, 'Mastipur Primary Health Centre', 'PHC', 3, 9, 16, 33, 'Mastipur', 'Bihar', 24.7124, 84.9854, 12, 6, 2, 1, 1, TRUE, TRUE, '24x7', '0631-2200108'),
  (26, 'Bodh Gaya Community Health Centre', 'CHC', 3, 9, 16, 34, 'Bodh Gaya Rural', 'Bihar', 24.6954, 85.0124, 30, 15, 4, 2, 2, TRUE, TRUE, '24x7', '0631-2200500'),
  (27, 'Hamzapur Primary Health Centre', 'PHC', 3, 9, 17, 36, 'Hamzapur', 'Bihar', 24.5812, 84.8124, 8, 3, 1, 0, 0, TRUE, TRUE, '24x7', '06326-255108'),
  (28, 'Dobhi Health Sub-Centre', 'Sub-centre', 3, 9, 17, 37, 'Dobhi', 'Bihar', 24.5214, 84.9512, 3, 2, 0, 0, 0, FALSE, FALSE, '08:00 AM - 04:00 PM', '06326-255999'),
  (29, 'Nahub Primary Health Centre', 'PHC', 3, 10, 19, 40, 'Nahub', 'Bihar', 25.0412, 85.4215, 10, 6, 2, 1, 0, TRUE, TRUE, '24x7', '06112-251108'),
  (30, 'Rajgir Rural Community Health Centre', 'CHC', 3, 10, 19, 41, 'Rajgir Rural', 'Bihar', 25.0124, 85.4854, 25, 12, 3, 2, 1, TRUE, TRUE, '24x7', '06112-255300');

-- ------------------------------------------------------------------------------
-- 5. Affordable Care Catalog: Service_Cost (70+ Rows across categories)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Service_Cost;
INSERT INTO Service_Cost (phc_id, service_name, category, cost_inr, is_free, scheme_name, notes) VALUES
  -- Facility 1: Otur PHC
  (1, 'Normal Institutional Delivery', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Free delivery, food & ₹1400 cash incentive to rural mother'),
  (1, 'General Outpatient Consultation', 'general', 0.00, TRUE, 'National Health Mission', 'Free consultation and prescription checkup'),
  (1, 'Malaria Blood Smear & Rapid Test', 'tests', 0.00, TRUE, 'NVBDCP Free Diagnostics', 'Results in 20 minutes'),
  (1, 'Paracetamol & Antipyretics Packet', 'medicines', 0.00, TRUE, 'PM Jan Aushadhi Free Supply', 'Full 5-day course'),
  (1, 'Oral Rehydration Salts (ORS) & Zinc', 'medicines', 0.00, TRUE, 'Intensified Diarrhea Control', 'Free 2 packets with zinc dispersible tablets'),
  (1, 'Minor Wound Dressing & Tetanus Shot', 'injury', 10.00, FALSE, 'Subsidized PHC User Fee', 'Bandage, antiseptic, and TT injection'),
  (1, 'Complete Blood Count (CBC)', 'tests', 40.00, FALSE, 'Subsidized Diagnostics', 'Automated hemogram'),

  -- Facility 2: Narayangaon CHC
  (2, 'Cesarean Section (C-Section)', 'delivery', 0.00, TRUE, 'Ayushman Bharat (PM-JAY)', 'Cashless surgical delivery with pediatrician on-call'),
  (2, 'Emergency Anti-Snake Venom Injection', 'injury', 0.00, TRUE, 'Free Essential Emergency Drugs', 'Includes 10 vials polyvalent ASV & ICU observation'),
  (2, 'Dengue NS1 Antigen Rapid Test', 'tests', 0.00, TRUE, 'NVBDCP National Program', 'Same-day test with platelet count monitoring'),
  (2, 'Digital X-Ray (Chest / Limb)', 'tests', 50.00, FALSE, 'Subsidized CHC Radiology', 'Digital radiograph with medical officer report'),
  (2, 'Antibiotic Course (Amoxicillin 500mg)', 'medicines', 0.00, TRUE, 'PM Jan Aushadhi', 'Free 5-day generic course'),
  (2, 'Suture Repair for Severe Lacerations', 'injury', 30.00, FALSE, 'Subsidized Minor OT', 'Sterile suture and local anesthesia'),

  -- Facility 3: Anerai Sub-centre
  (3, 'Routine Infant Vaccination (BCG, OPV, Penta)', 'vaccination', 0.00, TRUE, 'Universal Immunization Programme (UIP)', 'Free child immunization card issued'),
  (3, 'Antenatal Checkup (ANC) & IFA Tablets', 'delivery', 0.00, TRUE, 'Pradhan Mantri Surakshit Matritva', 'Free BP, weight, hemoglobin check & Iron Folic Acid'),
  (3, 'Fever Screening & Paracetamol Dispersible', 'fever', 0.00, TRUE, 'National Rural Health Mission', 'Basic primary care pack'),

  -- Facility 4: Pabal PHC
  (4, 'Institutional Delivery Package', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Free delivery and stay for mother and newborn'),
  (4, 'Typhoid Widal Blood Test', 'tests', 0.00, TRUE, 'Free Essential Diagnostic Initiative', 'Confirmatory enteric fever serology'),
  (4, 'Anti-Rabies Vaccine (ARV) 4-dose course', 'injury', 0.00, TRUE, 'National Rabies Control Program', 'Intradermal route, 100% free'),
  (4, 'Oral Rehydration & IV Saline Pack', 'medicines', 0.00, TRUE, 'National Child Health Programme', 'For severe dehydration'),
  (4, 'Fever & Cough Consultation Pack', 'fever', 5.00, FALSE, 'Nominal PHC Registration', 'Covers token and 3 days of supportive medicines'),

  -- Facility 5: Bhuinj PHC
  (5, 'Delivery & Post-natal Care', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Includes free ambulance pickup via 102'),
  (5, 'Malaria & Typhoid Antigen Screening', 'fever', 0.00, TRUE, 'NVBDCP Diagnostic Pack', 'Free dual finger-prick antigen test'),
  (5, 'Dog Bite Wound Wash & TT', 'injury', 0.00, TRUE, 'Free Emergency Care', 'Soap wash + TT injection'),
  (5, 'Blood Sugar & Urine Albumin Test', 'tests', 20.00, FALSE, 'NCD Rural Screening', 'Glucometer + dipstick test'),

  -- Facility 6: Wai CHC
  (6, 'Comprehensive Emergency Obstetric Care', 'delivery', 0.00, TRUE, 'Ayushman Bharat (PM-JAY)', 'Cashless 24x7 OT delivery care'),
  (6, 'Fracture Plaster & Immobilization', 'injury', 50.00, FALSE, 'Subsidized Orthopedic Pack', 'Plaster of Paris cast + sling'),
  (6, 'Broad-Spectrum Antibiotic Injection', 'medicines', 15.00, FALSE, 'Jan Aushadhi Subsidized', 'Ceftriaxone 1g injection with IV set'),
  (6, 'Ultrasonography (USG Obstetric)', 'tests', 80.00, FALSE, 'PNDT Registered Rural USG', 'Anomaly scan for pregnant women'),

  -- Facility 8: Vavi PHC
  (8, 'Acute Dehydration Therapy & Dextrose IV', 'medicines', 0.00, TRUE, 'Free Essential Drugs', '500ml RL/DNS bottle and infusion'),
  (8, 'Rapid Diagnostic Test for Chikungunya', 'tests', 0.00, TRUE, 'NVBDCP Surveillance', 'Free IgM rapid diagnostic test'),
  (8, 'Primary Burn Dressing & Silver Ointment', 'injury', 10.00, FALSE, 'Subsidized Care', 'Sterile burn pad and antimicrobial gel'),

  -- Facility 11: Bilkisganj PHC (MP)
  (11, 'Normal Safe Institutional Delivery', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Free delivery + cash incentive'),
  (11, 'Malaria MP Card & Blood Smear', 'fever', 0.00, TRUE, 'National Vector Borne Disease Program', 'Free testing for Plasmodium Falciparum/Vivax'),
  (11, 'Childhood Pneumonia Amoxicillin Pack', 'medicines', 0.00, TRUE, 'IMNCI Protocol', 'Free dispersible tablets for under-5s'),
  (11, 'Rural Laboratory Lipid & Sugar Panel', 'tests', 60.00, FALSE, 'Subsidized NCD Panel', 'Fasting profile'),

  -- Facility 12: Ichhawar CHC (MP)
  (12, 'High-Risk Pregnancy Inpatient Care', 'delivery', 0.00, TRUE, 'Ayushman Bharat', 'Specialized monitoring and neonatal resuscitation'),
  (12, 'Snake Envenomation Treatment Protocol', 'injury', 0.00, TRUE, 'Free Emergency Drug Protocol', 'Anti-snake venom + neostigmine protocol'),
  (12, 'Electrocardiogram (ECG)', 'tests', 30.00, FALSE, 'Rural Cardiac Diagnostic', '12-lead standard ECG'),
  (12, 'Anti-Diabetic Metformin Supply (1 month)', 'medicines', 25.00, FALSE, 'PM Jan Aushadhi', '60 tablets 500mg generic'),

  -- Facility 15: Salamatpur PHC (MP)
  (15, 'Institutional Maternity & Newborn Care', 'delivery', 0.00, TRUE, 'Janani Shishu Suraksha Karyakram (JSSK)', '100% free food, drugs, transport & care'),
  (15, 'Dengue & Chikungunya Symptom Relief Pack', 'fever', 0.00, TRUE, 'Free Essential Medicine', 'Analgesic, ORS, multi-vitamin'),
  (15, 'Suture Removal & Wound Dressing', 'injury', 5.00, FALSE, 'Nominal PHC Service', 'Aseptic nurse care'),

  -- Facility 16: Sanchi CHC (MP)
  (16, 'Full Maternal Delivery Package', 'delivery', 0.00, TRUE, 'Ayushman Bharat', 'Comprehensive safe delivery'),
  (16, 'Chest X-Ray & TB Sputum CBNAAT', 'tests', 0.00, TRUE, 'National TB Elimination Programme (NTEP)', 'GeneXpert molecular test free of cost'),
  (16, 'Pediatric Antibiotics Syrup (Cefixime)', 'medicines', 0.00, TRUE, 'Free Child Health Drugs', 'Generic dry syrup formulation'),

  -- Facility 18: Bagra Tawa PHC (MP)
  (18, 'Emergency Anti-Rabies Post-Exposure Care', 'injury', 0.00, TRUE, 'National Rabies Control', 'Free ARV day 0/3/7/28 protocol'),
  (18, 'Acute Diarrhea Fluid Resuscitation', 'medicines', 0.00, TRUE, 'Free Essential Medicines', 'IV Ringer Lactate and oral electrolytes'),
  (18, 'Hemoglobin Test (Sahli Method)', 'tests', 10.00, FALSE, 'Anemia Mukt Bharat', 'Free for mothers, ₹10 general'),

  -- Facility 21: Neora PHC (Bihar)
  (21, 'Safe Motherhood Institutional Delivery', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', '₹1400 direct benefit transfer to mother'),
  (21, 'Kala-Azar (Visceral Leishmaniasis) RK39 Test', 'tests', 0.00, TRUE, 'National Kala-Azar Elimination', 'Free rapid test for prolonged fever'),
  (21, 'ORS & Zinc for Pediatric Gastroenteritis', 'medicines', 0.00, TRUE, 'Free Essential Medicine', 'Free 2 packets ORS + 14 zinc tablets'),
  (21, 'Primary Laceration Cleansing & Dressing', 'injury', 10.00, FALSE, 'Subsidized Emergency Pack', 'Antiseptic wash, sterile gauze'),

  -- Facility 22: Bihta CHC (Bihar)
  (22, 'Surgical & Normal Delivery Care', 'delivery', 0.00, TRUE, 'Ayushman Bharat (PM-JAY)', 'Cashless delivery in state-of-the-art OT'),
  (22, 'Snakebite Emergency Inpatient Protocol', 'injury', 0.00, TRUE, 'Free Emergency Medicine', 'Anti-snake venom infusion & ventilatory support'),
  (22, 'Automated Blood Analyzer Panel', 'tests', 40.00, FALSE, 'Subsidized Laboratory', 'Hb, TLC, DLC, Platelets'),
  (22, 'Injectable Antibiotic Pack (Ampicillin)', 'medicines', 0.00, TRUE, 'Free Essential Drugs', 'Pediatric & maternal sepsis protection'),

  -- Facility 25: Mastipur PHC (Bihar)
  (25, 'Free Antenatal Care & Delivery Package', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Free delivery and transport'),
  (25, 'Rapid Diagnostic Typhoid & Malaria Test', 'fever', 0.00, TRUE, 'Free Fever Diagnostic Scheme', 'Dual rapid card test'),
  (25, 'Tetanus Toxoid Vaccine Shot', 'vaccination', 0.00, TRUE, 'Universal Immunization Programme', 'Adult / injury prevention shot'),
  (25, 'Generic Pain Relief Ibuprofen/Paracetamol', 'medicines', 5.00, FALSE, 'PM Jan Aushadhi', 'Strip of 10 generic tablets'),

  -- Facility 26: Bodh Gaya CHC (Bihar)
  (26, 'Caesarean Delivery & Neonatal Intensive Care', 'delivery', 0.00, TRUE, 'Ayushman Bharat', 'Free newborn resuscitation & nursery stay'),
  (26, 'Road Accident Trauma Care & Stabilization', 'injury', 0.00, TRUE, 'Emergency Trauma Stabilization Scheme', 'Free splints, IV fluids, analgesics'),
  (26, 'Comprehensive Fever Workup (Malaria/Dengue/Typhoid)', 'tests', 25.00, FALSE, 'Subsidized Fever Panel', 'Triple diagnostic screen'),

  -- Facility 29: Nahub PHC (Bihar)
  (29, 'Institutional Delivery and Neonatal Care', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana (JSY)', 'Free delivery and care'),
  (29, 'Viral Fever Supportive Medication Pack', 'fever', 0.00, TRUE, 'Free Drug Supply', 'Paracetamol, cetirizine, ORS packets'),
  (29, 'Deep Cut Stitching & Local Anesthesia', 'injury', 20.00, FALSE, 'Subsidized Minor OT', '3-4 stitches with sterile kit'),

  -- Facility 30: Rajgir CHC (Bihar)
  (30, 'Institutional Normal & Assisted Delivery', 'delivery', 0.00, TRUE, 'Janani Suraksha Yojana', 'Free delivery and postpartum room'),
  (30, 'Diagnostic Ultrasound (Obstetric & Abdomen)', 'tests', 75.00, FALSE, 'Subsidized Community Sonography', 'Obstetric biometry & placental localization'),
  (30, 'Anti-Snake Venom 5-Vial Protocol', 'injury', 0.00, TRUE, 'Free Emergency Care', 'Immediate anti-venom administration');

-- ------------------------------------------------------------------------------
-- 6. Village Vaccination Drives (18 Scheduled Drives)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Vaccination_Drive;
INSERT INTO Vaccination_Drive (drive_id, phc_id, village_id, vaccine, drive_date, time, target_group, doses_available, status) VALUES
  (1, 1, 1, 'Pentavalent & Rotavirus', '2026-10-15', '09:00 AM - 01:00 PM', 'Infants 6, 10, 14 weeks', 65, 'scheduled'),
  (2, 1, 2, 'Measles-Rubella (MR-1)', '2026-10-16', '09:30 AM - 02:00 PM', 'Infants 9-12 months', 45, 'scheduled'),
  (3, 1, 3, 'Tetanus Diphtheria (Td)', '2026-10-18', '10:00 AM - 01:30 PM', 'Pregnant Women & Adolescents', 30, 'scheduled'),
  (4, 4, 4, 'BCG & OPV Zero Dose', '2026-10-15', '09:00 AM - 12:30 PM', 'Newborns & Infants', 50, 'scheduled'),
  (5, 5, 6, 'Pentavalent Vaccine', '2026-10-17', '09:00 AM - 02:00 PM', 'Children under 1 year', 40, 'scheduled'),
  (6, 7, 8, 'Oral Polio Vaccine (OPV Booster)', '2026-10-19', '08:30 AM - 01:00 PM', 'Children 1-5 years', 80, 'scheduled'),
  (7, 8, 10, 'COVID-19 Precautionary Dose', '2026-10-20', '10:00 AM - 03:00 PM', 'Elderly (60+) & High Risk', 55, 'scheduled'),
  (8, 10, 14, 'Japanese Encephalitis (JE)', '2026-10-21', '09:00 AM - 01:00 PM', 'Children 1-15 years', 70, 'scheduled'),
  (9, 11, 16, 'Measles-Rubella (MR-2)', '2026-10-15', '09:30 AM - 02:00 PM', 'Toddlers 16-24 months', 50, 'scheduled'),
  (10, 12, 18, 'Pentavalent Booster & Vitamin A', '2026-10-16', '09:00 AM - 01:00 PM', 'Children 1-2 years', 60, 'scheduled'),
  (11, 15, 20, 'Tetanus Diphtheria (Td)', '2026-10-17', '10:00 AM - 02:00 PM', 'Pregnant Women', 35, 'scheduled'),
  (12, 18, 24, 'Rotavirus Oral Drops', '2026-10-22', '09:00 AM - 01:00 PM', 'Infants 6-14 weeks', 40, 'scheduled'),
  (13, 19, 26, 'BCG & Hepatitis B Birth Dose', '2026-10-23', '08:30 AM - 12:30 PM', 'Newborns', 45, 'scheduled'),
  (14, 21, 28, 'Pentavalent & Oral Polio', '2026-10-15', '09:00 AM - 01:30 PM', 'Infants 2.5 months', 75, 'scheduled'),
  (15, 22, 29, 'Measles-Rubella Catch-up', '2026-10-18', '09:00 AM - 02:00 PM', 'Children 9 months - 5 years', 90, 'scheduled'),
  (16, 25, 33, 'Tetanus Diphtheria (Td)', '2026-10-19', '10:00 AM - 02:00 PM', 'Pregnant Women', 50, 'scheduled'),
  (17, 26, 34, 'Pneumococcal Conjugate (PCV)', '2026-10-20', '09:00 AM - 01:00 PM', 'Infants under 1 year', 60, 'scheduled'),
  (18, 29, 40, 'OPV & Vitamin A Megadose', '2026-10-24', '08:30 AM - 01:00 PM', 'Children 1-5 years', 85, 'scheduled');

-- ------------------------------------------------------------------------------
-- 7. Area-Targeted Alerts (12 Realistic Alerts)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Alerts;
INSERT INTO Alerts (alert_id, disease_id, city, area_level, area_id, area_name, level, message, status, created_at) VALUES
  (1, 1, 'Otur', 'block', 1, 'Junnar Block', 'high', 'Dengue cluster detected: 14 confirmed cases in Junnar block villages following post-monsoon water logging.', 'active', NOW() - INTERVAL 1 DAY),
  (2, 4, 'Bilkisganj', 'village', 16, 'Bilkisganj', 'critical', 'Cholera alert in Bilkisganj village: 8 admissions with severe dehydration. Water boiling advisory issued.', 'active', NOW() - INTERVAL 2 DAY),
  (3, 2, 'Bihta', 'district', 8, 'Patna Rural District', 'warning', 'Malaria positivity rising in Patna Rural agricultural belt. ASHA workers distributing long-lasting insecticidal nets.', 'active', NOW() - INTERVAL 3 DAY),
  (4, 5, 'Wai Rural', 'district', 2, 'Satara District', 'warning', 'Enteric fever (Typhoid) surveillance advisory in Satara rural schools. Chlorination check underway.', 'active', NOW() - INTERVAL 4 DAY),
  (5, 6, 'Neora', 'block', 14, 'Bihta Block', 'high', 'Acute Diarrhoeal Disease outbreak risk in Bihta block after river overflow. ORS corner active at PHC Neora.', 'active', NOW() - INTERVAL 12 HOUR),
  (6, 2, 'Bodh Gaya Rural', 'village', 34, 'Bakrour', 'warning', 'Vector density spike in Bakrour village. Indoor residual spraying scheduled by Bodh Gaya CHC team.', 'active', NOW() - INTERVAL 2 DAY),
  (7, 1, 'Shirwal', 'block', 4, 'Khandala Block', 'warning', 'Aedes aegypti breeding found in Khandala storage tanks. Dry-day campaign ordered every Friday.', 'active', NOW() - INTERVAL 5 DAY),
  (8, 7, 'Rajur', 'block', 7, 'Sangamner Block', 'warning', 'Tuberculosis contact tracing drive launched across tribal hamlets of Sangamner block.', 'active', NOW() - INTERVAL 6 DAY),
  (9, 2, 'Ichhawar', 'district', 5, 'Sehore District', 'high', 'Fever spike in Sehore rural clusters: rapid testing kits dispatched to all sub-centres.', 'active', NOW() - INTERVAL 1 DAY),
  (10, 6, 'Nahub', 'village', 40, 'Nahub', 'warning', 'Well water contamination reported in Nahub village. Bleaching powder dispatched from PHC.', 'active', NOW() - INTERVAL 18 HOUR),
  (11, 1, 'Narayangaon', 'block', 1, 'Junnar Block', 'warning', 'Seasonal viral fever advisory for vegetable market hub Narayangaon.', 'resolved', NOW() - INTERVAL 10 DAY),
  (12, 4, 'Bhuinj', 'village', 6, 'Bhuinj', 'high', 'Resolved pipeline leak and water-borne outbreak in Bhuinj.', 'resolved', NOW() - INTERVAL 8 DAY);

-- ------------------------------------------------------------------------------
-- 8. Essential Rural Medicines Inventory (per PHC, with low-stock records)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Medicine;
INSERT INTO Medicine (hospital_id, phc_id, name, stock, reorder_level) VALUES
  -- Facility 1: Otur PHC
  (1, 1, 'Paracetamol 500mg Tablets', 1400, 300),
  (1, 1, 'Oral Rehydration Salts (ORS) Sachets', 650, 150),
  (1, 1, 'Amoxicillin 250mg Capsules', 45, 100), -- LOW STOCK!
  (1, 1, 'Polyvalent Anti-Snake Venom (Vials)', 8, 10), -- LOW STOCK!
  (1, 1, 'Zinc Sulfate Dispersible 20mg', 520, 100),
  (1, 1, 'Iron Folic Acid (IFA) Large', 1800, 400),
  (1, 1, 'Dextrose Normal Saline 500ml', 80, 50),

  -- Facility 2: Narayangaon CHC
  (2, 2, 'Paracetamol 650mg Tablets', 3200, 500),
  (2, 2, 'Polyvalent Anti-Snake Venom (Vials)', 35, 20),
  (2, 2, 'Anti-Rabies Vaccine (ARV 0.5ml)', 12, 25), -- LOW STOCK!
  (2, 2, 'Ceftriaxone 1g Injectable', 180, 50),
  (2, 2, 'Oxytocin 5 IU/ml Injections', 210, 60),
  (2, 2, 'Magnesium Sulfate 50% Injections', 40, 20),
  (2, 2, 'Metronidazole 400mg Tablets', 850, 200),

  -- Facility 4: Pabal PHC
  (4, 4, 'Paracetamol 500mg Tablets', 950, 250),
  (4, 4, 'Oral Rehydration Salts (ORS) Sachets', 32, 100), -- LOW STOCK!
  (4, 4, 'Artemether + Lumefantrine (ACT)', 22, 50), -- LOW STOCK!
  (4, 4, 'Ciprofloxacin 500mg Tablets', 310, 100),
  (4, 4, 'Tetanus Toxoid Vaccine Vials', 90, 40),

  -- Facility 5: Bhuinj PHC
  (5, 5, 'Polyvalent Anti-Snake Venom (Vials)', 4, 10), -- LOW STOCK!
  (5, 5, 'Paracetamol Pediatric Syrup', 110, 30),
  (5, 5, 'ORS Sachets', 400, 100),
  (5, 5, 'Doxycycline 100mg Capsules', 260, 60),

  -- Facility 11: Bilkisganj PHC (MP)
  (11, 11, 'Paracetamol 500mg Tablets', 1100, 250),
  (11, 11, 'Chloroquine Phosphate 250mg', 85, 100), -- LOW STOCK!
  (11, 11, 'Oral Rehydration Salts (ORS)', 18, 120), -- LOW STOCK!
  (11, 11, 'Anti-Snake Venom (Vials)', 5, 8), -- LOW STOCK!
  (11, 11, 'Zinc Tablets 20mg', 450, 100),
  (11, 11, 'Ringer Lactate IV Infusion 500ml', 45, 60), -- LOW STOCK!

  -- Facility 12: Ichhawar CHC (MP)
  (12, 12, 'Polyvalent Anti-Snake Venom (Vials)', 28, 15),
  (12, 12, 'Anti-Rabies Vaccine (ARV)', 32, 20),
  (12, 12, 'Ceftriaxone 1g Injectable', 20, 60), -- LOW STOCK!
  (12, 12, 'Oral Rehydration Salts (ORS)', 900, 200),
  (12, 12, 'Metformin 500mg Tablets', 1400, 300),

  -- Facility 15: Salamatpur PHC (MP)
  (15, 15, 'Paracetamol 500mg Tablets', 700, 200),
  (15, 15, 'Amoxicillin 250mg Capsules', 25, 80), -- LOW STOCK!
  (15, 15, 'Iron Folic Acid Tablets', 1200, 300),

  -- Facility 21: Neora PHC (Bihar)
  (21, 21, 'Paracetamol 500mg Tablets', 1500, 300),
  (21, 21, 'Oral Rehydration Salts (ORS)', 500, 150),
  (21, 21, 'Miltefosine Capsules (Kala-Azar)', 12, 20), -- LOW STOCK!
  (21, 21, 'Polyvalent Anti-Snake Venom (Vials)', 3, 10), -- LOW STOCK!
  (21, 21, 'Zinc Sulfate Dispersible 20mg', 600, 100),
  (21, 21, 'Artemether-Lumefantrine Packets', 18, 50), -- LOW STOCK!

  -- Facility 22: Bihta CHC (Bihar)
  (22, 22, 'Polyvalent Anti-Snake Venom (Vials)', 40, 20),
  (22, 22, 'Anti-Rabies Vaccine (ARV)', 15, 30), -- LOW STOCK!
  (22, 22, 'Paracetamol 650mg Tablets', 2800, 500),
  (22, 22, 'Oxytocin Injections', 180, 50),
  (22, 22, 'Cefixime 200mg Tablets', 35, 100), -- LOW STOCK!

  -- Facility 25: Mastipur PHC (Bihar)
  (25, 25, 'Paracetamol 500mg Tablets', 850, 200),
  (25, 25, 'ORS Sachets', 24, 100), -- LOW STOCK!
  (25, 25, 'Anti-Snake Venom (Vials)', 2, 8), -- LOW STOCK!
  (25, 25, 'Iron Folic Acid Tablets', 900, 200),

  -- Facility 29: Nahub PHC (Bihar)
  (29, 29, 'Paracetamol 500mg Tablets', 620, 150),
  (29, 29, 'ORS Sachets', 280, 80),
  (29, 29, 'Amoxicillin 250mg', 18, 60); -- LOW STOCK!

-- ------------------------------------------------------------------------------
-- 9. ASHA Workers & Initial Service Requests
-- ------------------------------------------------------------------------------
TRUNCATE TABLE ASHA_Worker;
INSERT INTO ASHA_Worker (asha_id, user_id, name, village_id, phc_id, phone, assigned_area) VALUES
  (1, 3, 'Sunita Tai Shinde', 1, 1, '9822104512', 'Otur Ward 1 & 2 (Hamlets: Malwadi, Vetalpada)'),
  (2, NULL, 'Mangalbai Kadam', 2, 2, '9822301982', 'Narayangaon Dehat & Market Ward'),
  (3, NULL, 'Radha Bai Ahirwar', 16, 11, '9425182910', 'Bilkisganj Ward 3 & Harijan Basti'),
  (4, NULL, 'Kamla Devi Yadav', 28, 21, '9835210943', 'Neora Village Tola & Station Para'),
  (5, NULL, 'Manju Devi Paswan', 33, 25, '9835901248', 'Mastipur Mahadalit Tola');

TRUNCATE TABLE ASHA_Request;
INSERT INTO ASHA_Request (request_id, asha_id, phc_id, request_type, urgency, details, status) VALUES
  (1, 1, 1, 'emergency_transport', 'critical', 'Pregnant mother (Kavita Gorde, 24) in labor at Malwadi. 102 ambulance requested immediately.', 'in_progress'),
  (2, 1, 1, 'medicine_stock', 'urgent', 'ORS and Zinc tablets exhausted in sub-centre after 6 diarrhea cases this week.', 'pending'),
  (3, 3, 11, 'doctor_visit', 'urgent', 'Fever spike in Bilkisganj Basti: 5 children with continuous high fever and vomiting.', 'pending'),
  (4, 4, 21, 'vaccine_supply', 'normal', 'Requesting 20 extra doses of Pentavalent vaccine for upcoming drive at Neora Primary School.', 'resolved'),
  (5, 5, 25, 'emergency_transport', 'urgent', 'Elderly farmer with suspected snakebite at Mastipur fields. Requesting ASV readiness at PHC.', 'resolved');

-- ------------------------------------------------------------------------------
-- 10. Sample Rural Patient Admissions
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Patient_Cases;
INSERT INTO Patient_Cases (
  case_id, disease_id, hospital_id, village_id, age_group, gender, icu_required, status, admitted_on, closed_on
) VALUES
  -- Otur PHC (Dengue cluster)
  (1, 1, 1, 1, '15-30', 'M', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (2, 1, 1, 1, '0-14', 'F', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (3, 1, 1, 2, '31-45', 'M', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (4, 1, 1, 1, '15-30', 'F', FALSE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),
  (5, 1, 1, 3, '46-60', 'M', FALSE, 'recovered', NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 1 DAY),
  (6, 1, 1, 1, '0-14', 'M', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),

  -- Narayangaon CHC (Dengue & Malaria)
  (7, 1, 2, 2, '15-30', 'F', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (8, 2, 2, 2, '31-45', 'M', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (9, 2, 2, 4, '46-60', 'M', TRUE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),
  (10, 6, 2, 2, '0-14', 'F', FALSE, 'recovered', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 2 DAY),

  -- Bilkisganj PHC (Cholera cluster)
  (11, 4, 11, 16, '0-14', 'F', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (12, 4, 11, 16, '15-30', 'M', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (13, 4, 11, 16, '31-45', 'F', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (14, 4, 11, 16, '0-14', 'M', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (15, 6, 11, 17, '60+', 'M', FALSE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),

  -- Neora PHC (Diarrhea & Malaria)
  (16, 6, 21, 28, '0-14', 'M', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (17, 6, 21, 28, '0-14', 'F', FALSE, 'admitted', NOW() - INTERVAL 1 DAY, NULL),
  (18, 2, 21, 29, '15-30', 'M', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (19, 5, 21, 28, '31-45', 'F', FALSE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),
  (20, 2, 21, 30, '46-60', 'M', FALSE, 'recovered', NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 2 DAY),

  -- Bodh Gaya CHC
  (21, 2, 26, 33, '15-30', 'F', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (22, 2, 26, 34, '0-14', 'M', FALSE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),
  (23, 7, 26, 35, '46-60', 'M', FALSE, 'admitted', NOW() - INTERVAL 4 DAY, NULL),
  (24, 5, 26, 33, '15-30', 'M', FALSE, 'recovered', NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 3 DAY),

  -- Wai CHC
  (25, 5, 6, 6, '15-30', 'F', FALSE, 'admitted', NOW() - INTERVAL 2 DAY, NULL),
  (26, 1, 6, 7, '31-45', 'M', FALSE, 'admitted', NOW() - INTERVAL 3 DAY, NULL),
  (27, 6, 6, 6, '0-14', 'M', FALSE, 'recovered', NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 1 DAY);

-- ------------------------------------------------------------------------------
-- 11. Citizen Complaints (Rural Context)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Complaints;
INSERT INTO Complaints (complaint_id, city, description, status, created_at) VALUES
  (1, 'Bilkisganj', 'Well water pipeline contaminated near Bilkisganj Basti resulting in diarrhea among children. Requesting immediate water testing and chlorination.', 'reviewed', NOW() - INTERVAL 2 DAY),
  (2, 'Otur', 'Stagnant water accumulation in drain near Otur vegetable market. Heavy mosquito breeding in evening.', 'new', NOW() - INTERVAL 1 DAY),
  (3, 'Mastipur', 'Sub-centre was closed yesterday when mother went for tetanus injection. ANM was on village survey.', 'reviewed', NOW() - INTERVAL 3 DAY),
  (4, 'Neora', 'Need fogging machine in Neora village as fever cases have risen after river flooded low-lying fields.', 'new', NOW() - INTERVAL 12 HOUR),
  (5, 'Pabal', 'Street light broken outside Pabal PHC emergency gate making night entry difficult.', 'closed', NOW() - INTERVAL 5 DAY);

-- ------------------------------------------------------------------------------
-- 12. State-level Vaccination Coverage (Updated with realistic rural state coverage)
-- ------------------------------------------------------------------------------
TRUNCATE TABLE Vaccination;
INSERT INTO Vaccination (vaccination_id, disease_id, state, village_id, drive_id, doses_given, target_population, record_date) VALUES
  (1, 1, 'Maharashtra', 1, 1, 14200, 16000, '2026-10-01'),
  (2, 2, 'Maharashtra', 2, 2, 13800, 15500, '2026-10-01'),
  (3, 6, 'Maharashtra', 6, 5, 15100, 16000, '2026-10-01'),
  (4, 8, 'Maharashtra', 8, 6, 18500, 20000, '2026-10-01'),
  (5, 1, 'Madhya Pradesh', 16, 9, 11200, 14000, '2026-10-01'),
  (6, 2, 'Madhya Pradesh', 18, 10, 10900, 13500, '2026-10-01'),
  (7, 6, 'Madhya Pradesh', 20, 11, 12400, 14500, '2026-10-01'),
  (8, 8, 'Madhya Pradesh', 24, 12, 14200, 17000, '2026-10-01'),
  (9, 1, 'Bihar', 28, 14, 16200, 21000, '2026-10-01'),
  (10, 2, 'Bihar', 29, 15, 15800, 20500, '2026-10-01'),
  (11, 6, 'Bihar', 33, 16, 17100, 21500, '2026-10-01'),
  (12, 8, 'Bihar', 34, 17, 19200, 24000, '2026-10-01');

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET SQL_SAFE_UPDATES = @OLD_SQL_SAFE_UPDATES;
