# Embers Team Workflow

This file defines how we collaborate safely on source code and shared data.

## Ownership model

- Source code changes: both developers can edit.
- Shared data changes (`data/embers-habits.xlsx`, `data/images/*`): coordinated updates via Git LFS.
- Local app data (`data/habit-day-log.json`, `data/projects.json`): local-only, never committed.

## One-time setup (each machine)

1. Clone repo:
   - `git clone https://github.com/AdamPixhance/embers.git`
2. Enter project:
   - `cd embers`
3. Enable Git LFS:
   - `git lfs install`
4. Pull LFS objects:
   - `git lfs pull`

## Start of day

1. Sync latest source and data:
   - `git pull --rebase --autostash`
   - `git lfs pull`

## Editing workbook (recommended single-editor lock flow)

1. Lock workbook before opening:
   - `git lfs lock data/embers-habits.xlsx`
2. Make workbook changes and save.
3. Commit and push:
   - `git add data/embers-habits.xlsx`
   - `git commit -m "data: update habits workbook"`
   - `git push`
4. Unlock workbook:
   - `git lfs unlock data/embers-habits.xlsx`

## Editing images/assets

1. Add/update files under `data/images/`, `assets/brand/`, or `assets/icons/`.
2. Commit and push:
   - `git add data/images/ assets/`
   - `git commit -m "data: update images and assets"`
   - `git push`

## Editing app/source and creating patches

1. Make code changes.
2. Commit and push source:
   - `git add src server electron package.json`
   - `git commit -m "feat: <short description>" or "fix: <short description>"`
   - `git push`
3. Build release when needed:
   - `npm run build:desktop`

## Rules to prevent data loss

- Never commit `data/habit-day-log.json` or `data/projects.json` (local app state only).
- Pull before starting work, especially before workbook edits.
- If lock fails, stop and coordinate before editing workbook.
- Keep commit messages clear: prefix with `data:`, `feat:`, `fix:`, etc.

## Quick recovery tips

- If local changes block pull:
  - `git stash push -m "temp"`
  - `git pull --rebase`
  - `git stash pop`
- If workbook conflict happens, prefer latest locked owner version and re-apply changes manually.
