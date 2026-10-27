# Rural Care Connect: Add-Ons for the Existing `healthwatch` Database

Three add-ons, rewritten to fit **your real database and your real tables** (from `DB_SCHEMA.md`):

1. **Total Cost of Care calculator**
2. **Medicine fallback** (out of stock, where next?)
3. **"Was the doctor there?" feedback loop**

---

## 0. What changed from my first guide

My first guide assumed a separate `rural_care_connect_db` and guessed table names. That was wrong for your project. This version:

- Uses your **existing database `healthwatch`**. It never creates or switches databases.
- **Finds the database automatically** from `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), the same file your server already uses.
- Uses your **real tables and columns**: `PHC` (not Facility), `phc_id`, `cost_inr`, `doctor_on_duty`, `Medicine.hospital_id`, `Medicine.stock`, `Medicine.reorder_level`, and so on.
- **Checks the database before changing anything.** If a table or column from `DB_SCHEMA.md` is missing, it stops and tells you exactly what.
- Is **safe to run twice**. Everything uses `IF NOT EXISTS`, `INSERT IGNORE` or drop-and-recreate for new routines only.

### What it adds and what it touches

| Action | Objects |
|---|---|
| **New tables** | `Travel_Mode`, `Cost_Assumption`, `Private_Benchmark`, `Medicine_Info`, `Jan_Aushadhi_Kendra`, `Medicine_Demand_Log`, `Visit_Feedback`, `Feedback_Alert` |
| **New views** | `vw_phc_feedback_summary`, `vw_missed_medicines` |
| **New routines** | function `fn_distance_km`, procedures `sp_total_cost_of_care` and `sp_medicine_fallback`, trigger `trg_feedback_doctor_absent` |
| **One small change to an existing table** | `Medicine` gets one new column, `updated_at` (so "data may be old" works). Nothing is renamed, dropped or removed. |
| **Untouched** | `PHC`, `Alerts`, `Service_Cost`, `Patient_Cases`, `Disease_Stats` (EpiClim), all existing views, procedures and triggers |

> Your existing trigger `trg_vaccine_drive_stockout` writes into `Alerts`, which needs a `disease_id`. The feedback trigger therefore writes into its **own** table, `Feedback_Alert`, so it cannot disturb disease charts or outbreak alerts.

---

## 1. Before you start

### 1.1 Take a backup (2 minutes)

Open a terminal in the project folder:

```
mysqldump -u root -p healthwatch > backup_before_addons.sql
```

Type your MySQL password when asked. Keep the file safe.

### 1.2 Protect your password

Your `.env` screenshot shows the database password. Do not share that screenshot again, and make sure `.env` stays in `.gitignore` (it looks like you already have one). If the screenshot went anywhere public, change the MySQL password.

### 1.3 Files you will add

```
backend/
  scripts/migrate_addons.js        (Section 2, the automatic runner)
  routes/cost.js                   (Section 4)
  routes/medicine_fallback.js      (Section 4)
  routes/feedback.js               (Section 4)
  test_addons.js                   (Section 6)
database/
  addons_migration.sql             (Section 3, all SQL in one file)
```

### 1.4 Install and add a script

```
cd backend
npm install express-rate-limit
```

Open `package.json` and add one line inside `"scripts"`:

```json
"migrate:addons": "node scripts/migrate_addons.js"
```

Your `express`, `mysql2` and `dotenv` packages are already installed.

---

## 2. The automatic runner: `backend/scripts/migrate_addons.js`

What it does, in order:

1. Reads `backend/.env` and connects to **the database named in `DB_NAME`**.
2. Checks that the database exists and that MySQL is version 8 or newer.
3. Checks that the tables and columns from `DB_SCHEMA.md` exist. If not, it stops with a clear list.
4. Adds `Medicine.updated_at` only if it is missing.
5. Runs `database/addons_migration.sql` statement by statement.
6. Prints a summary of what now exists.

```js
// backend/scripts/migrate_addons.js
// Run with:  npm run migrate:addons     (from the backend folder)

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Tables and columns the add-ons depend on (taken from DB_SCHEMA.md)
const REQUIRED = {
  PHC: ['phc_id', 'village_id', 'name', 'facility_type', 'doctor_on_duty',
        'operating_hours', 'contact_phone', 'latitude', 'longitude'],
  Village: ['village_id', 'name', 'latitude', 'longitude'],
  Service_Cost: ['service_id', 'phc_id', 'service_name', 'category',
                 'cost_inr', 'is_free', 'scheme_name'],
  Medicine: ['medicine_id', 'hospital_id', 'name', 'stock', 'reorder_level']
};

// Splits a .sql file into statements. Understands DELIMITER lines,
// so the same file also works in MySQL Workbench.
function splitStatements(sql) {
  const out = [];
  let delim = ';';
  let buf = [];
  for (const line of sql.split(/\r?\n/)) {
    const m = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (m) { delim = m[1]; continue; }
    if (/^\s*--/.test(line)) continue;            // skip full-line comments
    buf.push(line);
    const joined = buf.join('\n').trimEnd();
    if (joined.endsWith(delim)) {
      const stmt = joined.slice(0, -delim.length).trim();
      if (stmt) out.push(stmt);
      buf = [];
    }
  }
  const rest = buf.join('\n').trim();
  if (rest) out.push(rest);
  return out;
}

async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName) throw new Error('DB_NAME is missing in backend/.env');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName
  });
  console.log(`Connected to database "${dbName}" on ${process.env.DB_HOST || 'localhost'}`);

  // 1. MySQL version
  const [[ver]] = await conn.query('SELECT VERSION() AS v');
  if (parseInt(ver.v, 10) < 8) throw new Error(`MySQL 8 or newer needed, found ${ver.v}`);

  // 2. Check required tables and columns
  const problems = [];
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const [rows] = await conn.query(
      `SELECT LOWER(COLUMN_NAME) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)`, [dbName, table]);
    if (!rows.length) { problems.push(`Table missing: ${table}`); continue; }
    const have = new Set(rows.map(r => r.c));
    const missing = cols.filter(c => !have.has(c.toLowerCase()));
    if (missing.length) problems.push(`Table ${table} is missing columns: ${missing.join(', ')}`);
  }
  if (problems.length) {
    console.error('\nThe database does not match DB_SCHEMA.md:\n - ' + problems.join('\n - '));
    console.error('\nNothing was changed. Fix the names above (or tell me what your tables look like) and run again.');
    await conn.end();
    process.exit(1);
  }
  console.log('Schema check passed.');

  // 3. Add Medicine.updated_at only if missing
  const [col] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = 'medicine' AND COLUMN_NAME = 'updated_at'`, [dbName]);
  if (!col.length) {
    await conn.query(
      `ALTER TABLE Medicine ADD COLUMN updated_at TIMESTAMP NOT NULL
       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    console.log('Added Medicine.updated_at');
  }

  // 4. Run the SQL file
  const file = path.join(__dirname, '..', '..', 'database', 'addons_migration.sql');
  const statements = splitStatements(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const s of statements) {
    try { await conn.query(s); n++; }
    catch (e) {
      console.error(`\nFailed on statement #${n + 1}:\n${s.slice(0, 300)}...\n\n${e.message}`);
      await conn.end();
      process.exit(1);
    }
  }
  console.log(`Ran ${n} statements.`);

  // 5. Summary
  const [t] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?
     AND TABLE_NAME IN ('Travel_Mode','Cost_Assumption','Private_Benchmark','Medicine_Info',
       'Jan_Aushadhi_Kendra','Medicine_Demand_Log','Visit_Feedback','Feedback_Alert')`, [dbName]);
  const [r] = await conn.query(
    `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?
     AND ROUTINE_NAME IN ('fn_distance_km','sp_total_cost_of_care','sp_medicine_fallback')`, [dbName]);
  console.log(`\nNew tables found: ${t.length} of 8`);
  console.log(`New routines found: ${r.length} of 3`);
  console.log('Done.');
  await conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
```

---

## 3. The SQL file: `database/addons_migration.sql`

Everything for all three features is in this one file. You can also paste it into MySQL Workbench (with `healthwatch` selected) instead of using the runner.

```sql
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

INSERT IGNORE INTO Travel_Mode (mode_code, label_en, cost_per_km, speed_kmph) VALUES
 ('walk',    'Walk',           0.00,  4.0),
 ('bicycle', 'Bicycle',        0.00, 12.0),
 ('bike',    'Own motorbike',  3.00, 30.0),
 ('bus',     'Bus',            3.00, 25.0),
 ('auto',    'Shared auto',    4.00, 20.0),
 ('vehicle', 'Hired vehicle', 12.00, 30.0);

CREATE TABLE IF NOT EXISTS Cost_Assumption (
  assumption_id INT AUTO_INCREMENT PRIMARY KEY,
  key_name      VARCHAR(50) NOT NULL UNIQUE,
  value_num     DECIMAL(10,2) NOT NULL,
  label         VARCHAR(120),
  is_sample     TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Cost_Assumption (key_name, value_num, label) VALUES
 ('default_daily_wage',        300, 'Daily wage used if the user enters none (Rs.)'),
 ('visit_waiting_hours',         2, 'Hours spent at the facility per visit'),
 ('work_day_hours',              8, 'Hours in one working day'),
 ('private_clinic_distance_km', 12, 'Assumed distance to a private clinic in town (km)');

-- category values must match Service_Cost.category exactly
CREATE TABLE IF NOT EXISTS Private_Benchmark (
  benchmark_id          INT AUTO_INCREMENT PRIMARY KEY,
  category              VARCHAR(40) NOT NULL UNIQUE,
  label                 VARCHAR(60) NOT NULL DEFAULT 'Private clinic (typical)',
  typical_service_cost  DECIMAL(8,2) NOT NULL,
  typical_medicine_cost DECIMAL(8,2) NOT NULL DEFAULT 0,
  is_sample             TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO Private_Benchmark (category, typical_service_cost, typical_medicine_cost) VALUES
 ('Consultation',   300, 200),
 ('Vaccination',    250,   0),
 ('Emergency Care', 600, 300),
 ('Diagnostic',     500,   0),
 ('General Health', 300, 150);

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

INSERT INTO Jan_Aushadhi_Kendra (name, village_id, latitude, longitude)
SELECT CONCAT('Jan Aushadhi Kendra (sample) - ', v.name), v.village_id,
       v.latitude + 0.010, v.longitude + 0.010
FROM Village v
WHERE v.village_id NOT IN (SELECT village_id FROM Jan_Aushadhi_Kendra WHERE village_id IS NOT NULL)
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
```

### Run it

From the `backend` folder:

```
npm run migrate:addons
```

Expected output:

```
Connected to database "healthwatch" on localhost
Schema check passed.
Added Medicine.updated_at
Ran 30-something statements.

New tables found: 8 of 8
New routines found: 3 of 3
Done.
```

If it stops with "The database does not match DB_SCHEMA.md", copy that message and send it to me. Nothing is changed in that case.

### Fill in medicine details for the demo

`Medicine_Info` is filled automatically with every medicine name you already have. Add salt and strength for the 8 to 10 medicines you will demo. Run in MySQL Workbench (adjust the names to match your data):

```sql
UPDATE Medicine_Info
SET salt_composition = 'Paracetamol', strength = '500mg', jan_aushadhi_available = 1
WHERE name LIKE 'Paracetamol%';
```

Check your real names first with `SELECT DISTINCT name FROM Medicine;`.
Two medicines count as alternatives only when **both** salt and strength match.

---

## 4. Backend routes

### 4.1 One tiny rule for the database connection

I have not seen your `db.js`. This line works whether it exports a normal pool or a promise pool. Put it at the top of each new route file:

```js
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;
```

### 4.2 `backend/routes/cost.js`

```js
const router = require('express').Router();
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;

// GET /api/cost/modes
router.get('/modes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT mode_code, label_en FROM Travel_Mode ORDER BY mode_id');
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load travel modes' }); }
});

// GET /api/cost/compare?lat=19.99&lng=73.78&category=Consultation&mode=bus&wage=300
router.get('/compare', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const { category, mode = 'bus' } = req.query;
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  if (!category) return res.status(400).json({ error: 'category is required' });

  try {
    let wage = Number(req.query.wage);
    if (!wage || wage < 0 || wage > 3000) {
      const [r] = await pool.query(
        "SELECT value_num FROM Cost_Assumption WHERE key_name = 'default_daily_wage'");
      wage = r.length ? Number(r[0].value_num) : 300;
    }
    const [sets] = await pool.query('CALL sp_total_cost_of_care(?,?,?,?,?,?)',
      [lat, lng, category, mode, wage, 5]);

    res.json({
      government: sets[0],
      privateOption: sets[1][0] || null,
      note: 'Estimates based on adjustable sample assumptions. Not an official price list.'
    });
  } catch (e) {
    if (e.sqlState === '45000') return res.status(400).json({ error: e.sqlMessage });
    console.error(e);
    res.status(500).json({ error: 'Could not calculate cost' });
  }
});

module.exports = router;
```

### 4.3 `backend/routes/medicine_fallback.js`

```js
const router = require('express').Router();
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;

// GET /api/medicine-fallback?phcId=2&medicineId=15&lat=19.99&lng=73.78
// lat and lng are optional; if missing, the PHC's own location is used.
router.get('/', async (req, res) => {
  const phcId = parseInt(req.query.phcId, 10);
  const medicineId = parseInt(req.query.medicineId, 10);
  if (!phcId || !medicineId) {
    return res.status(400).json({ error: 'phcId and medicineId are required' });
  }
  const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
  const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;
  if ((lat !== null && !isFinite(lat)) || (lng !== null && !isFinite(lng))) {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  try {
    const [sets] = await pool.query('CALL sp_medicine_fallback(?,?,?,?,?)',
      [phcId, medicineId, lat, lng, 3]);

    const [[med]] = await pool.query(
      'SELECT name FROM Medicine WHERE medicine_id = ?', [medicineId]);
    await pool.query(
      'INSERT INTO Medicine_Demand_Log (phc_id, medicine_name) VALUES (?, ?)',
      [phcId, med.name]);

    res.json({
      medicine: med.name,
      otherPhcs: sets[0],
      sameCentreAlternatives: sets[1],
      janAushadhi: sets[2],
      safetyNote: 'Ask the doctor or pharmacist before changing any medicine.'
    });
  } catch (e) {
    if (e.sqlState === '45000') return res.status(404).json({ error: e.sqlMessage });
    console.error(e);
    res.status(500).json({ error: 'Could not find alternatives' });
  }
});

module.exports = router;
```

### 4.4 `backend/routes/feedback.js`

```js
const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const pool = typeof db.promise === 'function' ? db.promise() : db;

const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// POST /api/feedback   (public, no login)
router.post('/', limiter, async (req, res) => {
  const { phcId, villageId, visitDate, doctorPresent,
          medicineAvailable = 'NOT_NEEDED', deviceId } = req.body || {};

  if (!phcId || !deviceId || !['YES', 'NO'].includes(doctorPresent)) {
    return res.status(400).json({ error: 'phcId, deviceId and doctorPresent (YES or NO) are required' });
  }
  if (!['YES', 'PARTIAL', 'NO', 'NOT_NEEDED'].includes(medicineAvailable)) {
    return res.status(400).json({ error: 'Invalid medicine answer' });
  }
  const visit = new Date(visitDate);
  const daysAgo = (Date.now() - visit.getTime()) / 86400000;
  if (isNaN(visit.getTime()) || daysAgo < -1 || daysAgo > 7) {
    return res.status(400).json({ error: 'Visit date must be within the last 7 days' });
  }

  const salt = process.env.DEVICE_SALT || process.env.SESSION_SECRET || 'rcc';
  const deviceHash = crypto.createHash('sha256').update(String(deviceId) + salt).digest('hex');

  try {
    await pool.query(
      `INSERT INTO Visit_Feedback
         (phc_id, village_id, visit_date, doctor_present, medicine_available, device_hash)
       VALUES (?,?,?,?,?,?)`,
      [phcId, villageId || null, visitDate, doctorPresent, medicineAvailable, deviceHash]);
    res.status(201).json({ ok: true, message: 'Thank you for helping your village.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already sent a report for this visit today.' });
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Unknown PHC' });
    }
    console.error(e);
    res.status(500).json({ error: 'Could not save feedback' });
  }
});

// GET /api/feedback/summary/:phcId   (public)
router.get('/summary/:phcId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, p.doctor_on_duty
       FROM PHC p LEFT JOIN vw_phc_feedback_summary s ON s.phc_id = p.phc_id
       WHERE p.phc_id = ?`, [req.params.phcId]);
    if (!rows.length) return res.status(404).json({ error: 'PHC not found' });

    const s = rows[0];
    if (!s.reports_14d || s.reports_14d < 5) {
      return res.json({ enough: false, reports: s.reports_14d || 0 });
    }
    res.json({
      enough: true,
      reports: s.reports_14d,
      doctorPresentPct: s.doctor_present_pct,
      medicineYesPct: s.medicine_yes_pct,
      lastReportAt: s.last_report_at,
      conflict: s.doctor_on_duty === 1 && s.doctor_present_pct < 40
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load summary' }); }
});

// GET /api/feedback/admin/flags   (admin only)
// Replace requireAdmin with the role check you already use in backend/middleware.
const requireAdmin = (req, res, next) =>
  (req.session && req.session.user && req.session.user.role === 'admin')
    ? next() : res.status(403).json({ error: 'Admin only' });

router.get('/admin/flags', requireAdmin, async (req, res) => {
  try {
    const [low] = await pool.query(
      `SELECT p.phc_id, p.name, s.reports_14d, s.doctor_present_pct, s.medicine_yes_pct
       FROM vw_phc_feedback_summary s JOIN PHC p ON p.phc_id = s.phc_id
       WHERE s.reports_14d >= 5 AND s.doctor_present_pct < 50
       ORDER BY s.doctor_present_pct ASC`);
    const [alerts] = await pool.query(
      `SELECT fa.*, p.name AS phc_name FROM Feedback_Alert fa
       JOIN PHC p ON p.phc_id = fa.phc_id
       WHERE fa.status = 'active' ORDER BY fa.created_at DESC LIMIT 20`);
    res.json({ lowDoctorPresence: low, activeAlerts: alerts });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load flags' }); }
});

module.exports = router;
```

> **Check this one line:** `requireAdmin` assumes your login stores `req.session.user.role`. Your project already has role checks in `backend/middleware`. Use that one instead so admin rules stay consistent.

### 4.5 Register in `server.js`

Add these three lines next to your other `app.use('/api/...')` lines:

```js
app.use('/api/cost',              require('./routes/cost'));
app.use('/api/medicine-fallback', require('./routes/medicine_fallback'));
app.use('/api/feedback',          require('./routes/feedback'));
```

Make sure `app.use(express.json());` appears **before** them (it probably already does).

---

## 5. Frontend

Your pages already have a location picker (GPS, map pin, or State > District > Village). Reuse it: every new call needs only **latitude and longitude**. For the dropdown option, use the selected village's `latitude` and `longitude`.

### 5.1 Matching "what do you need" to categories

`Service_Cost.category` has fixed values. Your Affordable Care page already maps needs to them; use the same mapping:

| User picks | `category` sent to the API |
|---|---|
| Fever / check-up | `Consultation` |
| Delivery / pregnancy | `Maternal Care` |
| Vaccination | `Vaccination` |
| Injury / emergency | `Emergency Care` |
| Tests | `Diagnostic` |
| Medicines | `Medicine Supply` |
| General | `General Health` |

The private clinic comparison exists for five categories (Consultation, Vaccination, Emergency Care, Diagnostic, General Health). For others, only the government options appear.

### 5.2 Total cost: add a "Total cost" tab beside the budget search

```js
async function showTotalCost(lat, lng) {
  const q = new URLSearchParams({
    lat, lng,
    category: document.getElementById('need').value,
    mode: document.getElementById('mode').value,
    wage: document.getElementById('wage').value || ''
  });
  const res = await fetch('/api/cost/compare?' + q);
  const data = await res.json();
  if (!res.ok) return showError(data.error);
  if (!data.government.length) return showError('No centre offers this service nearby.');

  const best = data.government[0], priv = data.privateOption;
  const labels = [best.phc_name], svc = [best.service_cost],
        trv = [best.travel_cost], wag = [best.wage_loss];
  if (priv) { labels.push('Private clinic (typical)'); svc.push(priv.service_cost);
              trv.push(priv.travel_cost); wag.push(priv.wage_loss); }

  new Chart(document.getElementById('costChart'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Service',   data: svc },
      { label: 'Travel',    data: trv },
      { label: 'Lost wage', data: wag }
    ]},
    options: { scales: { x: { stacked: true },
      y: { stacked: true, title: { display: true, text: 'Rupees (estimate)' } } } }
  });

  if (priv && priv.total_cost > best.total_cost) {
    document.getElementById('saving').textContent =
      `You could save about Rs. ${priv.total_cost - best.total_cost} compared with a private clinic (estimate).`;
  }
}
```

Always show the grey note: **"Estimate. Fares and wages are sample assumptions."** Show the existing **FREE** badge where `is_free = 1`.

### 5.3 Medicine fallback: on each PHC card

For each medicine with `stock = 0`, show a red **Out of stock** badge and a **Find nearby** button.

```js
async function findFallback(phcId, medicineId, lat, lng) {
  const q = new URLSearchParams({ phcId, medicineId });
  if (lat != null && lng != null) { q.set('lat', lat); q.set('lng', lng); }
  const res = await fetch('/api/medicine-fallback?' + q);
  const data = await res.json();
  if (!res.ok) return showError(data.error);
  // Show a popup with three sections:
  //   data.otherPhcs               (name, distance_km, contact_phone; grey "Data may be old" if data_may_be_old)
  //   data.sameCentreAlternatives  (only if the list is not empty)
  //   data.janAushadhi             (nearest low-cost generic store)
  // Always show data.safetyNote in a visible box.
}
```

Your public PHC list must include each medicine's `medicine_id` and `stock` (your `Medicine` table already has both). If your PHC detail API does not return them yet, add them to that query.

### 5.4 Feedback: on each PHC card

```js
function getDeviceId() {
  let id = localStorage.getItem('rcc_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('rcc_device_id', id); }
  return id;
}

async function sendFeedback(phcId, villageId, doctorPresent, medicineAvailable) {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phcId, villageId,
      visitDate: new Date().toISOString().slice(0, 10),
      doctorPresent, medicineAvailable,
      deviceId: getDeviceId()
    })
  });
  const data = await res.json();
  showToast(data.message || data.error);
}

async function loadFeedbackBadge(phcId, el) {
  const s = await (await fetch('/api/feedback/summary/' + phcId)).json();
  if (!s.enough) { el.textContent = 'Not enough reports yet'; return; }
  el.textContent = `Doctor present: ${s.doctorPresentPct}% of ${s.reports} reports`;
  el.className = s.doctorPresentPct >= 70 ? 'badge bg-success'
               : s.doctorPresentPct >= 40 ? 'badge bg-warning text-dark' : 'badge bg-danger';
  if (s.conflict) {
    // show: "Staff data says a doctor is available, but many villagers report otherwise. Call first."
  }
}
```

**Screen rules:** two big question cards ("Was the doctor there?" Yes / No; "Was the medicine available?" Yes / Partly / No / Did not need). Never show a percentage until 5 reports exist.

**Admin dashboard widget:** call `GET /api/feedback/admin/flags` and list the two arrays (low doctor presence, active feedback alerts).

### 5.5 Language strings (please have a native speaker check)

| Key | English | Hindi | Marathi |
|---|---|---|---|
| `cost.total` | Total cost (estimate) | कुल खर्च (अनुमान) | एकूण खर्च (अंदाजे) |
| `cost.travel` | Travel | यात्रा | प्रवास |
| `cost.wage` | Lost wage | छूटी हुई मज़दूरी | बुडालेली मजुरी |
| `med.out` | Out of stock | उपलब्ध नहीं | उपलब्ध नाही |
| `med.find` | Find nearby | पास में खोजें | जवळ शोधा |
| `fb.doctor_q` | Was the doctor there? | क्या डॉक्टर मिले? | डॉक्टर भेटले का? |
| `fb.yes` | Yes | हाँ | होय |
| `fb.no` | No | नहीं | नाही |
| `fb.notenough` | Not enough reports yet | अभी पर्याप्त रिपोर्ट नहीं | अजून पुरेसे अहवाल नाहीत |

---

## 6. Testing

### 6.1 Quick check in MySQL Workbench

```sql
SELECT DATABASE();                                           -- must say healthwatch
CALL sp_total_cost_of_care(19.9975, 73.7898, 'Consultation', 'bus', 300, 5);
```

You should see two result tables: government options (cheapest total first) and the private benchmark. Change the coordinates to a place near your sample PHCs if the distances look very large.

### 6.2 Make a medicine out of stock for the demo

```sql
UPDATE Medicine SET stock = 0
WHERE hospital_id = 1 AND name LIKE 'Paracetamol%';
```

Remember to restore the stock after the demo.

### 6.3 Smoke test: `backend/test_addons.js`

Start the server first (`npm start`), then in another terminal:

```
node test_addons.js 19.9975 73.7898
```

```js
// backend/test_addons.js  (needs Node 18 or newer)
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const lat = process.argv[2] || '19.9975';
const lng = process.argv[3] || '73.7898';
let failed = 0;

async function check(name, fn) {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
}
const get = async (p) => { const r = await fetch(BASE + p); return { r, j: await r.json() }; };
const post = async (p, b) => {
  const r = await fetch(BASE + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return { r, j: await r.json() };
};

(async () => {
  await check('travel modes load', async () => {
    const { r, j } = await get('/api/cost/modes');
    if (!r.ok || !j.length) throw new Error('no modes');
  });
  await check('cost compare works', async () => {
    const { r, j } = await get(`/api/cost/compare?lat=${lat}&lng=${lng}&category=Consultation&mode=bus`);
    if (!r.ok || !Array.isArray(j.government)) throw new Error(JSON.stringify(j));
  });
  await check('cost compare rejects bad mode', async () => {
    const { r } = await get(`/api/cost/compare?lat=${lat}&lng=${lng}&category=Consultation&mode=rocket`);
    if (r.status !== 400) throw new Error('expected 400, got ' + r.status);
  });
  await check('cost compare rejects missing location', async () => {
    const { r } = await get('/api/cost/compare?category=Consultation');
    if (r.status !== 400) throw new Error('expected 400');
  });
  await check('feedback saves once, rejects duplicate', async () => {
    const body = { phcId: 1, doctorPresent: 'YES', medicineAvailable: 'YES',
      visitDate: new Date().toISOString().slice(0, 10), deviceId: 'test-' + Date.now() };
    const a = await post('/api/feedback', body);
    if (a.r.status !== 201) throw new Error('first save failed: ' + JSON.stringify(a.j));
    const b = await post('/api/feedback', body);
    if (b.r.status !== 409) throw new Error('duplicate not blocked');
  });
  await check('feedback rejects old visit date', async () => {
    const { r } = await post('/api/feedback', { phcId: 1, doctorPresent: 'NO',
      visitDate: '2020-01-01', deviceId: 'x' });
    if (r.status !== 400) throw new Error('expected 400');
  });
  await check('feedback summary loads', async () => {
    const { r, j } = await get('/api/feedback/summary/1');
    if (!r.ok || typeof j.enough !== 'boolean') throw new Error(JSON.stringify(j));
  });
  await check('fallback rejects missing ids', async () => {
    const { r } = await get('/api/medicine-fallback');
    if (r.status !== 400) throw new Error('expected 400');
  });

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
```

Note: this test adds one real feedback row for PHC 1. Delete it afterwards if you like:
`DELETE FROM Visit_Feedback WHERE created_at >= CURDATE() AND source = 'VILLAGER' AND phc_id = 1;`

### 6.4 Sample feedback data (label it "Sample" in the demo)

```sql
INSERT IGNORE INTO Visit_Feedback (phc_id, visit_date, doctor_present, medicine_available, device_hash) VALUES
 (1, CURDATE(),                           'YES', 'YES',        SHA2('sample-1', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'YES', 'PARTIAL',    SHA2('sample-2', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'NO',  'NO',         SHA2('sample-3', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'YES', 'YES',        SHA2('sample-4', 256)),
 (1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'YES', 'NOT_NEEDED', SHA2('sample-5', 256));
```

For the live trigger demo, insert three `'NO'` rows for a second PHC (for example `phc_id = 2`, different `device_hash` values, dates within the last 3 days). Then:

```sql
SELECT * FROM Feedback_Alert;
```

You should see exactly one active alert, even if you insert a fourth "NO".

### 6.5 Final checklist

- [ ] Backup file created
- [ ] `npm run migrate:addons` printed "8 of 8" tables and "3 of 3" routines
- [ ] Existing pages still load (PHC map, Affordable Care, Vaccination drives, Alerts, Admin)
- [ ] Cost chart shows service, travel and lost wage, with the word "Estimate"
- [ ] Out-of-stock medicine shows the popup with the safety note
- [ ] Duplicate feedback is blocked; old dates are rejected
- [ ] Percentage hidden until 5 reports; shown after
- [ ] Three "No" answers create one `Feedback_Alert`
- [ ] `node test_addons.js` ends with "All checks passed"

---

## 7. Update your documents

Add to `DB_SCHEMA.md` (Tables overview):

| Table | Purpose |
|---|---|
| `Travel_Mode` | Sample fare per km and speed for each way of travelling |
| `Cost_Assumption` | Adjustable wage and waiting-time assumptions |
| `Private_Benchmark` | Typical private clinic cost per service category (sample) |
| `Medicine_Info` | Salt, strength and generic availability for each medicine name |
| `Jan_Aushadhi_Kendra` | Low-cost generic medicine stores (sample locations) |
| `Medicine_Demand_Log` | Searches for out-of-stock medicines |
| `Visit_Feedback` | Anonymous villager confirmations of doctor and medicine availability |
| `Feedback_Alert` | Alerts raised when doctor-absent reports pile up |

Also add: view `vw_phc_feedback_summary` and `vw_missed_medicines`; function `fn_distance_km`; procedures `sp_total_cost_of_care` and `sp_medicine_fallback`; trigger `trg_feedback_doctor_absent`; and the new column `Medicine.updated_at`.

For `DBMS_CONCEPTS.md`:

| Concept | Where it is shown |
|---|---|
| Stored function | `fn_distance_km` |
| Stored procedure, multiple result sets | `sp_total_cost_of_care`, `sp_medicine_fallback` |
| Trigger | `trg_feedback_doctor_absent` |
| Views with aggregates and GROUP BY | `vw_phc_feedback_summary`, `vw_missed_medicines` |
| UNIQUE constraint | one feedback per device, PHC and day |
| Foreign keys | `Visit_Feedback`, `Feedback_Alert`, `Medicine_Demand_Log`, `Jan_Aushadhi_Kendra` |
| Indexes | `idx_vf_phc_date`, `idx_demand_name` |
| Idempotent migration | `IF NOT EXISTS`, `INSERT IGNORE`, drop-and-recreate for routines |

---

## 8. One prompt for your coding assistant (Copilot or Antigravity)

Paste this into the chat in VS Code if you prefer to let the assistant apply the guide:

> Open `RCC_AddOns_Guide_Existing_DB.md` and `DB_SCHEMA.md` in this project. Implement the three add-ons exactly as described, on the EXISTING database `healthwatch` from `backend/.env`. Do not create or switch databases. Do not rename, drop or recreate any existing table, view, procedure or trigger. Step by step: (1) create `database/addons_migration.sql` and `backend/scripts/migrate_addons.js` as in Sections 2 and 3, add the `migrate:addons` script to `package.json`, and run it; (2) create the three route files and register them in `server.js`, using the project's existing `db.js` and role middleware; (3) add the frontend pieces (Total cost tab, Out of stock plus Find nearby popup, doctor-present feedback buttons and badge, admin widget) to the existing public and admin pages, reusing the existing location picker and language files, with English, Hindi and Marathi strings; (4) create `backend/test_addons.js` and run it. Label all cost figures "Estimate" and all new sample rows "Sample". Always show the medicine safety note. When done, list what you changed and anything I must check manually.
