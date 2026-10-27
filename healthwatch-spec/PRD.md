# Product Requirements: HealthWatch AI

## Users and roles
| Role | Login | Can do |
|---|---|---|
| public | viewer | View-only: beds, charts, map, search, weather, alerts; submit complaints |
| admin | admin | Everything public can, plus Create/Read/Update/Delete on all tables, user management, audit log, dataset import, report export |

Role is stored in Users.role. The backend must enforce it on every route (never trust the frontend alone).

## Features
1. Login with role-based redirect.
2. Live disease feed: latest cases with disease, hospital, city, status.
3. India heat map (Leaflet): circle markers sized by case count per state/district.
4. Hospital bed availability: total/available beds, ICU, ventilators, colour coded (green >30%, amber 10-30%, red <10%).
5. Trend graphs (Chart.js): cases per day/week per disease, deaths, recoveries.
6. Search and filter: by disease, hospital, city, state, date range.
7. Weather panel: current temperature, humidity, rainfall for a chosen city (Open-Meteo) and stored in Weather table; chart of weather vs cases (correlation).
8. Medicine inventory with low-stock warning.
9. Vaccination tracking (coverage % per state).
10. Alerts: created automatically by a database trigger when a disease crosses its threshold in a city within 7 days; admin can also create/resolve manually.
11. Citizen complaints: public form, admin review.
12. Reports: download CSV (and printable page) of cases, beds, alerts.
13. Innovations: emergency prediction score (see ARCHITECTURE.md), outbreak detection, disease spread simulation (simple growth-rate slider), audit logs, rule-based symptom checker (educational disclaimer, not medical advice).

## Non-functional
- All SQL uses parameterised queries (no string concatenation).
- Passwords hashed with bcrypt.
- Responsive, clean Bootstrap UI with a sidebar and cards.
- Every admin write is logged in Audit_Log.
