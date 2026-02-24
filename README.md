# Embers

Native desktop habits app powered by workbook configuration with persistent tracking, streak analytics, and export capabilities.

## Implemented Scope

### Phase 1: Habit Model and UI

- Native app shell with Electron, Vite, React, and TypeScript.
- Workbook-driven habit catalog from `data/embers-habits.xlsx`.
- Habit types: `toggle` and `counter`.
- Score calculation from `score_per_unit`.
- Streak qualification from `streak_min_count`.
- Tooltip support for habit clarification text.
- Tag-based habit categorization with color badges.

### Phase 2: Persistence and Analytics

- Day-based persistence using `habit-day-log.json`.
- Per-day save and load API endpoints.
- Streak analytics from saved history.
- 30-day score timeline in the UI.
- Per-habit and global streak tracking.

### Phase 3: Complete Day and Lock Workflow

- Complete-day endpoint to save and lock with timestamp.
- Unlock endpoint to re-enable editing.
- Locked and future days are read-only.
- Lock status banner with completion timestamp.

### Phase 4: Export and Reporting

- Per-habit daily history records.
- CSV export of full habit history.
- History panel with 30-day qualification indicators.
- Extended analytics with `computeHabitHistory()`.

### Phase 5: Packaging and Distribution

- Windows x64 portable packaging.
- Distribution output in `release/win-unpacked/`.
- Launcher batch file support.
- Version set to `0.1.0`.

## Workbook Source of Truth

On first run, the API auto-generates `data/embers-habits.xlsx` if missing.

### Required Sheets

- `Habits`
  - `habit_id`
  - `label`
  - `type` (`toggle` or `counter`)
  - `group_id`
  - `tags` (comma-separated IDs)
  - `score_per_unit`
  - `streak_min_count`
  - `min_count`
  - `max_count`
  - `tooltip`
  - `active` (`0` or `1`)
  - `sort_order`
- `Groups`
  - `group_id`, `group_label`, `sort_order`
- `Tag Options`
  - `tag_id`, `tag_label`, `tag_color`

Schema reference is in `data/embers-workbook-schema.json`.

## API Endpoints

### Data and Configuration

- `GET /api/data` returns workbook-configured habits, groups, and tags.
- `GET /api/health` returns server health.

### Day Management

- `GET /api/day/:date` loads `YYYY-MM-DD` counts and lock state.
- `PUT /api/day/:date` saves day counts.
- `POST /api/day/:date/complete` saves and locks a day.
- `POST /api/day/:date/unlock` unlocks a completed day.

### Analytics and Reporting

- `GET /api/analytics?date=YYYY-MM-DD` returns streak and timeline analytics.
- `GET /api/analytics/history` returns per-habit daily history.
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

- Use `release/win-unpacked/Embers.exe` for portable distribution.
- Use `release/Run Embers.bat` as an optional launcher.

## Notes

- Keep habit configuration in workbook sheets, not hardcoded UI values.
- Day-log format supports legacy entry compatibility.
- Data remains local-first and portable.
