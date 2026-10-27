-- ==============================================================================
-- HealthWatch AI: Database Schema Definition (MySQL 8)
-- DBMS Concepts: DDL, 3NF Normalization, Primary/Foreign Keys, 
--                CHECK Constraints, Composite Indexes, AUTO_INCREMENT
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS healthwatch
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE healthwatch;

-- 1. Users Table (Authentication & Role-Based Access Control)
-- Roles: 'admin' has full CRUD capabilities; 'public' is read-only.
CREATE TABLE IF NOT EXISTS Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'public') NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Disease Table (Master List of Tracked Diseases)
-- alert_threshold: Number of cases in 7 days per city that triggers an outbreak alert.
CREATE TABLE IF NOT EXISTS Disease (
  disease_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('vector-borne', 'water-borne', 'air-borne', 'other') NOT NULL,
  alert_threshold INT NOT NULL DEFAULT 20 -- threshold for automated alert trigger
) ENGINE=InnoDB;

-- 3. Hospital Table (Hospital Facilities & Live Bed/ICU Inventory)
-- CHECK constraints ensure data integrity (beds cannot be negative, available <= total).
CREATE TABLE IF NOT EXISTS Hospital (
  hospital_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  total_beds INT NOT NULL CHECK (total_beds >= 0),
  available_beds INT NOT NULL CHECK (available_beds >= 0),
  total_icu INT NOT NULL DEFAULT 0 CHECK (total_icu >= 0),
  available_icu INT NOT NULL DEFAULT 0 CHECK (available_icu >= 0),
  ventilators INT NOT NULL DEFAULT 0 CHECK (ventilators >= 0),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_hospital_beds CHECK (available_beds <= total_beds),
  CONSTRAINT chk_hospital_icu CHECK (available_icu <= total_icu),
  INDEX idx_hospital_city (city),
  INDEX idx_hospital_state (state)
) ENGINE=InnoDB;

-- 4. Patient_Cases Table (Clinical Admissions & Case Lifecycle)
-- Linked to Disease and Hospital. Foreign key indexes and composite index optimize queries.
CREATE TABLE IF NOT EXISTS Patient_Cases (
  case_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  hospital_id INT NOT NULL,
  age_group ENUM('0-14', '15-30', '31-45', '46-60', '60+') NOT NULL,
  gender ENUM('M', 'F', 'O') NOT NULL,
  icu_required BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('admitted', 'recovered', 'deceased') NOT NULL DEFAULT 'admitted',
  admitted_on DATE NOT NULL,
  closed_on DATE NULL,
  CONSTRAINT fk_case_disease FOREIGN KEY (disease_id) 
    REFERENCES Disease(disease_id) ON DELETE RESTRICT,
  CONSTRAINT fk_case_hospital FOREIGN KEY (hospital_id) 
    REFERENCES Hospital(hospital_id) ON DELETE CASCADE,
  INDEX idx_case_disease (disease_id),
  INDEX idx_case_hospital (hospital_id),
  INDEX idx_case_status (status),
  INDEX idx_disease_date (disease_id, admitted_on)
) ENGINE=InnoDB;

-- 5. Weather Table (Environmental Telemetry cached per City & Date)
-- Prevents redundant calls to Open-Meteo API using UNIQUE constraint on (city, record_date).
CREATE TABLE IF NOT EXISTS Weather (
  weather_id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(80) NOT NULL,
  record_date DATE NOT NULL,
  temperature DECIMAL(5,2) NULL,
  humidity DECIMAL(5,2) NULL,
  rainfall DECIMAL(6,2) NULL,
  CONSTRAINT uq_city_date UNIQUE (city, record_date),
  INDEX idx_weather_city (city)
) ENGINE=InnoDB;

-- 6. Medicine Table (Critical Drug Inventory & Reorder Level Tracking)
CREATE TABLE IF NOT EXISTS Medicine (
  medicine_id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reorder_level INT NOT NULL DEFAULT 50 CHECK (reorder_level >= 0),
  CONSTRAINT fk_medicine_hospital FOREIGN KEY (hospital_id) 
    REFERENCES Hospital(hospital_id) ON DELETE CASCADE,
  INDEX idx_medicine_hospital (hospital_id)
) ENGINE=InnoDB;

-- 7. Alerts Table (Outbreak Warnings & Severity Status)
-- Automatically populated by trg_case_alert trigger or created manually by Admin.
CREATE TABLE IF NOT EXISTS Alerts (
  alert_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  city VARCHAR(80) NOT NULL,
  level ENUM('warning', 'high', 'critical') NOT NULL,
  message VARCHAR(255) NOT NULL,
  status ENUM('active', 'resolved') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_alerts_disease FOREIGN KEY (disease_id) 
    REFERENCES Disease(disease_id) ON DELETE CASCADE,
  INDEX idx_alerts_disease (disease_id),
  INDEX idx_alerts_city_status (city, status)
) ENGINE=InnoDB;

-- 8. Vaccination Table (State-level Vaccination Progress Tracking)
CREATE TABLE IF NOT EXISTS Vaccination (
  vaccination_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_id INT NOT NULL,
  state VARCHAR(80) NOT NULL,
  doses_given INT NOT NULL CHECK (doses_given >= 0),
  target_population INT NOT NULL CHECK (target_population >= 0),
  record_date DATE NOT NULL,
  CONSTRAINT fk_vaccination_disease FOREIGN KEY (disease_id) 
    REFERENCES Disease(disease_id) ON DELETE CASCADE,
  INDEX idx_vaccination_disease (disease_id),
  INDEX idx_vaccination_state (state)
) ENGINE=InnoDB;

-- 9. Complaints Table (Public Citizen Feedback & Grievance Redressal)
CREATE TABLE IF NOT EXISTS Complaints (
  complaint_id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(80) NULL,
  description TEXT NOT NULL,
  status ENUM('new', 'reviewed', 'closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_complaints_status (status)
) ENGINE=InnoDB;

-- 10. Audit_Log Table (Administrative Security & Modification Trail)
-- Captures table modifications made via triggers and backend CRUD.
CREATE TABLE IF NOT EXISTS Audit_Log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(20) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  details TEXT NULL,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table_record (table_name, record_id)
) ENGINE=InnoDB;

-- 11. Disease_Stats Table (Historical Outbreak Dataset: IDSP / EpiClim)
-- Stores national weekly epidemiological time-series for analytics, map, and ML models.
CREATE TABLE IF NOT EXISTS Disease_Stats (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  disease_name VARCHAR(100) NOT NULL,
  state VARCHAR(80) NOT NULL,
  district VARCHAR(80) NOT NULL,
  year INT NOT NULL,
  week INT NOT NULL,
  report_date DATE NULL,
  cases INT NOT NULL DEFAULT 0,
  deaths INT NOT NULL DEFAULT 0,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  temperature DECIMAL(5,2) NULL,
  preci DECIMAL(8,2) NULL,
  INDEX idx_stat (disease_name, state, year, week),
  INDEX idx_stat_date (report_date)
) ENGINE=InnoDB;
