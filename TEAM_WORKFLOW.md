# Pixcope Team Workflow

This file defines how we collaborate safely on source code and shared data.

## Ownership model

- Source code changes: both developers can edit.
- Shared data changes (`data/pixcope-services.xlsx`, `data/images/*`): coordinated updates.
- Local saved estimates (`data/projects.json`): local-only, never committed.

## One-time setup (each machine)

1. Clone repo:
   - `git clone https://github.com/AdamPixhance/Pixcope.git`
2. Enter project:
   - `cd Pixcope`
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
   - `git lfs lock data/pixcope-services.xlsx`
2. Make workbook changes and save.
3. Commit and push:
   - `git add data/pixcope-services.xlsx`
   - `git commit -m "Data: update workbook"`
   - `git push`
4. Unlock workbook:
   - `git lfs unlock data/pixcope-services.xlsx`

## Editing images

1. Add/update files under `data/images/`.
2. Commit and push:
   - `git add data/images`
   - `git commit -m "Data: update service images"`
   - `git push`

## Editing app/source and creating patches

1. Make code changes.
2. Commit and push source:
   - `git add src server electron package.json package-lock.json`
   - `git commit -m "Patch: <short description>"`
   - `git push`
3. Build release when needed:
   - `npm run build:desktop`

## Rules to prevent data loss

- Never commit `data/projects.json`.
- Pull before starting work, especially before workbook edits.
- If lock fails, stop and coordinate before editing workbook.
- Keep commit messages clear: prefix with `Patch:` or `Data:`.

## Quick recovery tips

- If local changes block pull:
  - `git stash push -m "temp"`
  - `git pull --rebase`
  - `git stash pop`
- If workbook conflict happens, prefer latest locked owner version and re-apply changes manually.
