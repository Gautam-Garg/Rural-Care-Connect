# HealthWatch AI: Real-Time Disease Surveillance & Hospital Resource Dashboard

A DBMS course project. It collects disease case data from hospitals, shows hospital bed/ICU/medicine availability, draws trend charts and an India map, raises outbreak alerts automatically, and gives two role-based portals: a **Public portal** (read-only) and an **Admin portal** (full control).

> Antigravity: read every .md file in this folder before writing code. Start with START_PROMPT.md, then follow PHASES.md one phase at a time.

## Tech stack (fixed, do not change)
| Layer | Choice |
|---|---|
| Database | MySQL 8 (pure SQL: tables, views, triggers, stored procedures, indexes) |
| Backend | Node.js + Express + mysql2 + bcrypt + express-session |
| Frontend | HTML, CSS, JavaScript, Bootstrap 5, Chart.js, Leaflet.js |
| Weather | Open-Meteo API (free, no API key) |
| Dataset | IDSP / EpiClim CSV imported into MySQL (see DATASET.md) |

## Folder structure to generate
```
healthwatch-ai/
  database/   schema.sql  seed.sql  views.sql  procedures.sql  triggers.sql
  backend/    server.js  package.json  .env.example  routes/  middleware/  scripts/importDataset.js
  frontend/   login.html  public/ (dashboard)  admin/ (dashboard)  css/  js/
  data/       epiclim.csv (user downloads)
  docs/       all .md files
```

## Portals
- **Login page**: username + password. Role `public` opens the Public portal, role `admin` opens the Admin portal.
- **Public portal (read-only)**: bed/ICU availability, disease charts, India heat map, search (disease, hospital, city), trend graphs, weather, active alerts, file a complaint, download reports.
- **Admin portal (full CRUD)**: add/edit/delete hospitals, beds, diseases, patient cases, medicines, vaccination records, alerts, users; view audit log and complaints; import dataset.

## How to run (after generation)
1. Install MySQL 8 and Node.js 18+.
2. `mysql -u root -p < database/schema.sql` then `seed.sql`, `views.sql`, `procedures.sql`, `triggers.sql`.
3. `cd backend && npm install && cp .env.example .env` (fill DB password and SESSION_SECRET).
4. `node scripts/importDataset.js ../data/epiclim.csv` (optional but recommended).
5. `npm start`, then open http://localhost:3000.
6. Demo logins (change later): `admin / admin123`, `viewer / viewer123`.
