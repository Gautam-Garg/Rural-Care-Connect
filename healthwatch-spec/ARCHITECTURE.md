# Architecture

```
Browser (HTML/CSS/JS, Bootstrap, Chart.js, Leaflet)
        | fetch() JSON
Express server (routes, auth middleware, role check)
        | mysql2 (parameterised queries, pool)
MySQL 8 (tables, views, triggers, stored procedures)
        |
External: Open-Meteo weather API (called by backend, cached in Weather table)
```

## Layers
- **Frontend**: static pages served by Express. Two dashboards: `/public/dashboard.html`, `/admin/dashboard.html`. Shared JS in `js/api.js`.
- **Backend**: REST API (see API_SPEC.md). Middleware `requireLogin` and `requireAdmin`. Sessions via express-session.
- **Database**: business rules live in SQL: bed decrement inside a transaction (stored procedure), automatic alerts (trigger), reporting (views), audit (triggers).

## Auth flow
1. POST /api/login with username+password.
2. Server compares bcrypt hash, stores `{user_id, role}` in session.
3. Response includes role; frontend redirects to `/public/` or `/admin/`.
4. `requireAdmin` returns 403 for non-admin on all POST/PUT/DELETE routes.

## Key logic
- **Admit patient**: call `sp_admit_patient` (transaction: check bed, decrement bed/ICU, insert case, commit; rollback if no bed). The AFTER INSERT trigger on Patient_Cases checks the alert threshold.
- **Alert generation**: trigger `trg_case_alert` counts cases for that disease and city in the last 7 days; if >= Disease.alert_threshold and no active alert exists, insert into Alerts (level by ratio: 1x warning, 2x high, 3x critical).
- **Discharge/recover**: procedure `sp_update_case_status` frees the bed.
- **Weather**: backend route calls Open-Meteo for the hospital city's lat/lon, inserts a Weather row, returns it.
- **Emergency prediction score (0-100)** per city: 40% case growth (this week vs last week), 30% bed occupancy, 20% ICU occupancy, 10% weather risk (rain+humidity for vector-borne diseases). Show as a gauge; >70 red.
- **Outbreak detection**: view flagged where this week's cases > 2 x average of previous 4 weeks.
