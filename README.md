# Embers

Embers is a native desktop habit system built around a single, focused daily flow:

1) Log today.
2) Complete the day.
3) Move forward without breaking your history.

Everything is local-first, workbook-driven, and designed for fast check-ins across the day.

## Highlights

- Day-first workflow with strict single open-day enforcement.
- Good vs bad habits, weighted scoring, and real-time badge grading.
- Toggle and counter habits with min/max bounds and streak thresholds.
- Schedule windows (daily / weekdays / weekends / custom days).
- Active date windows for habits to preserve history safely.
- Focus mode to hide distractions and keep only today visible.
- Weekly, monthly, and yearly badge grids with averages.
- CSV export for all habit history.

## Workbook Source of Truth

On first run, the API auto-generates `data/embers-habits.xlsx` if missing.

### Required Sheets

- `Habits`
  - `habit_id`
  - `label`
  - `type` (`toggle` or `counter`)
  - `group_id`
  - `polarity` (`good` or `bad`)
  - `score_per_unit`
  - `streak_min_count`
  - `min_count`
  - `max_count`
  - `tooltip`
  - `active` (`0` or `1`)
  - `sort_order`
  - `schedule_type` (`daily`, `weekdays`, `weekends`, `custom`)
  - `schedule_days` (comma-separated abbreviations like `Mon, Wed, Fri`)
  - `active_from` (optional `YYYY-MM-DD`)
  - `inactive_from` (optional `YYYY-MM-DD`, exclusive end date)
- `Groups`
  - `group_id`, `group_label`, `sort_order`
- `Badges`
  - `badge_id`, `display_name`, `icon`, `color_hex`, `min_score`, `sort_order`, `active`
- `Schedule Options`
  - `schedule_type`, `description`, `uses_schedule_days`
- `Schedule Days`
  - `day_abbr`, `day_name`

Schema reference is in `data/embers-workbook-schema.json`.

## API Endpoints

### Data and Configuration

- `GET /api/data` returns workbook-configured habits, groups, and badges.
- `GET /api/health` returns server health.

### Day Management

- `GET /api/day/:date` loads `YYYY-MM-DD` counts and lock state.
- `PUT /api/day/:date` saves day counts.
- `POST /api/day/:date/complete` saves and locks a day.
- `POST /api/day/:date/unlock` unlocks a completed day.
- `GET /api/open-day` returns the most recent unfinished day.

### Analytics and Reporting

- `GET /api/analytics?date=YYYY-MM-DD` returns streaks, badges, and averages.
- `GET /api/analytics/badges?start=YYYY-MM-DD&end=YYYY-MM-DD` returns badge colors for grids.
- `GET /api/export/csv` downloads habit history CSV.

### Workbook Management

- `POST /api/open-workbook` opens `embers-habits.xlsx` in the default app.

## Build and Distribution

### Development

```bash
npm install
npm run dev
npm run dev:desktop
```

### Production Build

```bash
npm run build
npm run brand:assets
npm run build:desktop
```

### Distribution

- Desktop build output: `release/Embers-win32-x64/Embers.exe`
- Portable bundle (with launcher + README): `npm run package:portable`
- Portable output folder: `release/Embers-portable-1.0.0`

## Notes

- Keep habit configuration in workbook sheets, not hardcoded UI values.
- Data remains local-first and portable.
