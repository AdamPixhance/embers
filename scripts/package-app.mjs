import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const releaseDir = path.join(projectRoot, 'release')
const winUnpackedDir = path.join(releaseDir, 'win-unpacked')
const portableDir = path.join(releaseDir, 'Embers-portable-0.1.0')

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

async function copyDir(src, dest) {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
      console.log(`Copied: ${path.relative(projectRoot, destPath)}`)
    }
  }
}

async function createRunBatch() {
  const batchContent = `@echo off
:: Embers - Native Habit App
:: This batch file launches the Embers application
setlocal enabledelayedexpansion

set "APP_DIR=%~dp0"
set "EXE_PATH=%APP_DIR%Embers.exe"

if not exist "!EXE_PATH!" (
  echo Error: Embers.exe not found at !EXE_PATH!
  pause
  exit /b 1
)

echo Launching Embers...
start "" "!EXE_PATH!"
`
  const batchPath = path.join(portableDir, 'Run Embers.bat')
  await fs.writeFile(batchPath, batchContent, 'utf-8')
  console.log(`Created launcher batch file: ${path.relative(projectRoot, batchPath)}`)
}

async function createReadme() {
  const readmeContent = `# Embers Portable Edition

Native habit tracking app with workbook-driven configuration.

## Quick Start

1. Double-click **Run Embers.bat** to launch the application
2. Or run **Embers.exe** directly

## First Use

- Create your habit configuration in Excel (embers-habits.xlsx)
- Toggle/counter habits with per-unit scoring
- Daily locking prevents past editing and future speculation
- View 30-day trends and per-habit history

## System Requirements

- Windows 10 or later
- No installation required - fully portable

## Data Storage

- Habit configuration: embers-habits.xlsx
- Daily tracking data: habit-day-log.json
- Both stored in the same folder as the app

## Support

For issues or suggestions, visit the project repository.
`
  const readmePath = path.join(portableDir, 'README.txt')
  await fs.writeFile(readmePath, readmeContent, 'utf-8')
  console.log(`Created README: ${path.relative(projectRoot, readmePath)}`)
}

async function packageApp() {
  try {
    console.log('Clearing previous build...')
    if (await fs.stat(portableDir).catch(() => null)) {
      await fs.rm(portableDir, { recursive: true, force: true })
      console.log(`Removed old portable build`)
    }

    console.log('Packaging app files...')
    await copyDir(winUnpackedDir, portableDir)

    console.log('Creating launcher...')
    await createRunBatch()

    console.log('Creating documentation...')
    await createReadme()

    console.log(`\n✓ Portable app created successfully: ${portableDir}`)
    console.log(`\n Package size: Check folder for details`)
  } catch (error) {
    console.error('Error packaging app:', error.message)
    process.exit(1)
  }
}

packageApp()
