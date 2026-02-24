# Embers v1.0.0

Embers 1.0.0 is the first stable desktop release focused on a coherent local-first workflow, cleaner packaging, and consistent release outputs.

## Highlights

- Stable desktop release packaging for Windows.
- Local-first habit tracking with workbook-driven configuration.
- Consistent day flow with open-day enforcement and completion locking.
- Portable release bundle with launcher and included quick-start README.

## Included in this release

- Updated app/version metadata to `1.0.0`.
- Aligned desktop build metadata and release output naming.
- Updated distribution documentation to match actual build artifacts.
- Cleaned portable README content for clearer first-run guidance.
- Improved portable packaging script to:
  - derive version from `package.json`
  - package from detected desktop output directory
  - generate versioned portable folder names

## Build artifacts

Primary upload artifact:

- `Embers-portable-1.0.0.zip`

Contents include:

- `Embers.exe`
- `Run Embers.bat`
- `README.txt`
- bundled runtime files
- app resources and local data folder structure

## Upgrade notes

- Previous hardcoded `0.1.0` packaging/version references were replaced with `1.0.0`.
- Distribution guidance now points to current output folders used by the packaging pipeline.

## Known notes

- During packaging, Electron may log: `asar parameter set to an invalid value (false), ignoring and disabling asar`.
- This is informational for the current packaging configuration and does not block artifact generation.

## Checks performed before release

- Production web build completed successfully.
- Desktop package build completed successfully.
- Portable package generation completed successfully.
- Final zip archive generated successfully.
