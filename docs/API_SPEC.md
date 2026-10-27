# REST API Spec

All responses are JSON. `[A]` = admin only. All others need login.

| Method | Route | Purpose |
|---|---|---|
| POST | /api/login | body {username,password} returns {role}; sets session |
| POST | /api/logout | end session |
| GET | /api/me | current user and role |
| GET | /api/hospitals?city=&q= | list/search (uses vw_bed_availability) |
| POST/PUT/DELETE | /api/hospitals[/:id] [A] | add/edit/delete hospital, edit bed counts |
| GET | /api/diseases | list diseases |
| POST/PUT/DELETE | /api/diseases[/:id] [A] | manage diseases and thresholds |
| GET | /api/cases?disease=&city=&from=&to= | search cases |
| POST | /api/cases [A] | admit patient (calls sp_admit_patient) |
| PUT | /api/cases/:id/close [A] | recovered/deceased (calls sp_close_case) |
| GET | /api/stats/trend?disease=&city=&days=30 | daily cases (vw_daily_cases) |
| GET | /api/stats/heatmap | cases per state/district with lat/lon (Disease_Stats + Patient_Cases) |
| GET | /api/stats/prediction?city= | emergency prediction score |
| GET | /api/alerts?status=active | list alerts |
| POST | /api/alerts [A] | manual alert |
| PUT | /api/alerts/:id/resolve [A] | resolve |
| GET | /api/weather?city= | fetch from Open-Meteo, store in Weather, return |
| GET/POST/PUT/DELETE | /api/medicines [A for writes] | inventory, /api/medicines/low-stock |
| GET/POST | /api/vaccination [A for POST] | coverage |
| POST | /api/complaints | public submit |
| GET/PUT | /api/complaints [A] | review |
| GET | /api/reports/cases.csv, beds.csv, alerts.csv | downloads |
| GET | /api/audit [A] | audit log |
| POST | /api/symptom-check | rule-based symptom to possible disease list |

Weather call: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation`
