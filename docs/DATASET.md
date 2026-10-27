# Dataset Guide

## Primary dataset: EpiClim (India, weekly, district-wise)
Built from the government IDSP weekly outbreak reports, 2009 onward. Covers Dengue, Malaria, Cholera, Acute Diarrhoeal Disease and others, with state, district, latitude, longitude, week/month/year, cases, deaths, plus temperature and precipitation.
- Paper and download links: https://arxiv.org/html/2501.18602v1
- Original source: IDSP weekly outbreaks portal, https://idsp.mohfw.gov.in/index4.php?lang=1&level=0&linkid=406&lid=3689
- Alternative state/district/disease-wise cases and deaths table: https://dataful.in/datasets/18514/

Save the CSV as `data/epiclim.csv`.

## Real CSV header (verified on the downloaded file: 8,985 rows, years 2009-2022)
`(unnamed index), week_of_outbreak, state_ut, district, Disease, Cases, Deaths, day, mon, year, Latitude, Longitude, preci, LAI, Temp`

## Import script (backend/scripts/importDataset.js)
Map columns to Disease_Stats:
| CSV | Disease_Stats |
|---|---|
| Disease | disease_name |
| state_ut | state |
| district | district |
| week_of_outbreak ("3rd week") | week (parse the leading number) |
| year, mon, day | year, plus a report_date DATE column built from year-mon-day |
| Cases | cases |
| Deaths | deaths (blank means 0) |
| Latitude, Longitude | latitude, longitude |
| Temp | temperature (Kelvin in the CSV: subtract 273.15 to store Celsius) |
| preci | preci |
| LAI | ignore |

Cleaning rules (found in the file):
1. Ignore the first unnamed index column.
2. Cases has one bad value ("3/1"): skip any row where Cases is not a whole number.
3. Drop exact duplicate rows (about 10).
4. Deaths is blank in ~72% of rows: store 0.
5. Temp has some impossible values (min about -13 C, max about 54 C) and 938 blanks: store NULL for blanks; treat values outside 0-50 C as NULL.
6. Merge disease name variants: "Dengue Fever", "Suspected Dengue" -> Dengue; "Suspected Chikungunya" -> Chikungunya; "Suspected Cholera" -> Cholera; "Malaria (PV)" -> Malaria; "Diarrhea" -> Acute Diarrhoeal Disease; "Gastroenteritis" -> Acute Gastroenteritis. Keep combined ones ("Dengue And Chikungunya" and similar) as one label "Dengue/Chikungunya".
7. Insert in batches of 1000 inside a transaction; add new disease names to Disease with threshold 20; print rows imported/skipped.

## Use in the dashboard
- Heat map and long-term trends read Disease_Stats.
- Live feed and beds read Patient_Cases and Hospital (seeded plus admin entered).
- Weather-vs-cases chart joins Disease_Stats.temperature/preci with weekly cases.

## Note
IDSP data reports outbreaks, not every case, so label charts "reported outbreak cases". Live hospital data has no public feed; that part is simulated by seed and admin entry.
