# Embers Product Vision

## Goal
Build a native desktop habits app with Pixcope-quality UX/UI while keeping all behavior editable from workbook data instead of hardcoded logic.

## Core Principles
- Native-first desktop experience (`.exe` distribution)
- Workbook-driven configuration for editable business rules
- Minimal code changes required for content/config updates
- Local-first data ownership

## Habit Types
1. Toggle Habit
   - Binary done/not done each day
   - Optional score value when done
2. Counter Habit
   - Increment/decrement from `0`
   - Per-unit score value (positive or negative)
   - Optional min/max bounds from workbook config

## Streak Rules
- A habit contributes to streak only when its daily completion threshold is met.
- Default threshold is `1`.
- For counter habits, streak increments only if `count >= streak_min_count`.

## Tooltip System
- Habits can define short label and extended guidance text.
- UI displays an info icon for habits with tooltip text.
- Hover/focus shows explanatory tooltip.

## Workbook-Driven Fields (Target)
- Habit id
- Habit label
- Habit type (`toggle` or `counter`)
- Group id / Group label
- Tags
- Base score / per-count score
- Min/max count
- Streak minimum count
- Tooltip text
- Active state
- Sort order

## Migration Notes
- `Embers0.1` remains archived as legacy baseline.
- This workspace is the active direction for future development.
