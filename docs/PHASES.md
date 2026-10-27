# Build Phases

Build one phase at a time. After each phase, run it, show me how to test it, and wait for my "next".

## Phase 1: Database
schema.sql, views.sql, procedures.sql, triggers.sql, seed.sql (see DATABASE_SCHEMA.md). Include test queries that prove the trigger fires and the transaction rolls back when no bed is free.
Done when: `SELECT * FROM vw_bed_availability;` returns rows.

## Phase 2: Backend and auth
Express server, MySQL pool, .env, login/logout/me, requireLogin and requireAdmin, bcrypt seed script for the two demo users.
Done when: login returns the correct role and a public user gets 403 on POST /api/hospitals.

## Phase 3: Core APIs
Hospitals, diseases, cases (admit/close via procedures), alerts, medicines, vaccination, complaints, audit log writes.

## Phase 4: Frontend shell
login.html with role redirect, Bootstrap sidebar layout, shared api.js, protected pages.

## Phase 5: Public dashboard
Bed availability cards/table, disease charts, search, alerts banner, weather panel, complaint form.

## Phase 6: Admin dashboard
CRUD forms/tables for every entity, admit-patient form, bed editor, alert resolve, audit log, complaints review, user management.

## Phase 7: Maps, trends, dataset
Leaflet India heat map, trend graphs, importDataset.js for the CSV (DATASET.md), weather-vs-cases chart.

## Phase 8: Innovations
Emergency prediction score, outbreak detection view, spread simulation slider, symptom checker, CSV report downloads.

## Phase 9: Polish and docs
Error handling, loading states, empty states, README run steps verified, ER diagram (Mermaid) in docs, sample screenshots list, viva Q&A notes on each DBMS concept used.
