import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const releaseDir = path.join(projectRoot, 'release')

async function readAppVersion() {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const raw = await fs.readFile(packageJsonPath, 'utf-8')
  const parsed = JSON.parse(raw)
  return String(parsed.version || '1.0.0')
}

async function resolveBuiltAppDir() {
  const candidates = [
    path.join(releaseDir, 'Embers-win32-x64'),
    path.join(releaseDir, 'win-unpacked'),
  ]

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) return candidate
    } catch {
      // continue
    }
  }

  throw new Error('No desktop build output found. Run npm run build:desktop first.')
}

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

async function createRunBatch(portableDir) {
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

async function createReadme(portableDir) {
  const readmeContent = `Embers Portable Edition

Native desktop habit app (local-first).

Quick Start
1. Double-click Run Embers.bat
2. Or run Embers.exe directly

Notes
- Windows 10 or later
- No installation required
- Data remains local on this machine

Data Files
- data/embers-habits.xlsx (created on first run if missing)
- data/habit-day-log.json

Support
Use the project repository issue tracker for feedback and bugs.
`
  const readmePath = path.join(portableDir, 'README.txt')
  await fs.writeFile(readmePath, readmeContent, 'utf-8')
  console.log(`Created README: ${path.relative(projectRoot, readmePath)}`)
}

async function packageApp() {
  try {
    const version = await readAppVersion()
    const portableDir = path.join(releaseDir, `Embers-portable-${version}`)
    const builtAppDir = await resolveBuiltAppDir()

    console.log('Clearing previous build...')
    if (await fs.stat(portableDir).catch(() => null)) {
      await fs.rm(portableDir, { recursive: true, force: true })
      console.log(`Removed old portable build`)
    }

    console.log('Packaging app files...')
    await copyDir(builtAppDir, portableDir)

    console.log('Creating launcher...')
    await createRunBatch(portableDir)

    console.log('Creating documentation...')
    await createReadme(portableDir)

    console.log(`\n✓ Portable app created successfully: ${portableDir}`)
    console.log(`\n Package size: Check folder for details`)
  } catch (error) {
    console.error('Error packaging app:', error.message)
    process.exit(1)
  }
}

packageApp()
