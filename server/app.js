import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { IMAGES_DIR, WORKBOOK_PATH } from './constants.js'
import { ensureWorkbookTemplate, resetAllAppData } from './template.js'
import { loadWorkbookData } from './workbook.js'
import {
  completeDay,
  computeAnalytics,
  computeHabitHistory,
  generateHabitCSV,
  getDayCounts,
  listDayEntries,
  saveDayCounts,
  unlockDay,
} from './daylog.js'

function openPath(targetPath) {
  const platform = process.platform

  if (platform === 'win32') {
    const child = spawn('cmd', ['/c', 'start', '', targetPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
    return
  }

  if (platform === 'darwin') {
    const child = spawn('open', [targetPath], { detached: true, stdio: 'ignore' })
    child.unref()
    return
  }

  const child = spawn('xdg-open', [targetPath], { detached: true, stdio: 'ignore' })
  child.unref()
}

export async function createEmbersApi() {
  await ensureWorkbookTemplate()
  await fs.mkdir(IMAGES_DIR, { recursive: true })

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use('/api/images', express.static(IMAGES_DIR))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/data', async (_req, res) => {
    try {
      const data = await loadWorkbookData()
      const stat = await fs.stat(WORKBOOK_PATH)
      res.json({ ...data, workbookPath: WORKBOOK_PATH, workbookUpdatedAt: stat.mtime.toISOString() })
    } catch (error) {
      res.status(500).json({
        message: 'Failed to load workbook data.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.get('/api/day/:date', async (req, res) => {
    try {
      const day = await getDayCounts(req.params.date)
      res.json({ date: req.params.date, ...day })
    } catch (error) {
      res.status(400).json({
        message: 'Unable to load day log.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.put('/api/day/:date', async (req, res) => {
    try {
      const day = await saveDayCounts(req.params.date, req.body?.counts ?? {})
      res.json({ ok: true, date: req.params.date, ...day })
    } catch (error) {
      res.status(400).json({
        message: 'Unable to save day log.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.post('/api/day/:date/complete', async (req, res) => {
    try {
      const day = await completeDay(req.params.date, req.body?.counts)
      res.json({ ok: true, date: req.params.date, ...day })
    } catch (error) {
      res.status(400).json({
        message: 'Unable to complete day.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.post('/api/day/:date/unlock', async (req, res) => {
    try {
      const day = await unlockDay(req.params.date)
      res.json({ ok: true, date: req.params.date, ...day })
    } catch (error) {
      res.status(400).json({
        message: 'Unable to unlock day.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.get('/api/analytics', async (req, res) => {
    try {
      const workbook = await loadWorkbookData()
      const entries = await listDayEntries()
      const dateParam = typeof req.query.date === 'string' ? req.query.date : ''
      const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : new Date().toISOString().slice(0, 10)
      const analytics = computeAnalytics(entries, workbook.habits, requestedDate)
      res.json(analytics)
    } catch (error) {
      res.status(500).json({
        message: 'Unable to compute analytics.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.get('/api/analytics/history', async (_req, res) => {
    try {
      const workbook = await loadWorkbookData()
      const entries = await listDayEntries()
      const history = computeHabitHistory(entries, workbook.habits)
      res.json({ habits: history })
    } catch (error) {
      res.status(500).json({
        message: 'Unable to compute habit history.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.get('/api/export/csv', async (_req, res) => {
    try {
      const workbook = await loadWorkbookData()
      const entries = await listDayEntries()
      const history = computeHabitHistory(entries, workbook.habits)
      const csv = generateHabitCSV(history)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=embers-habits-export.csv')
      res.send(csv)
    } catch (error) {
      res.status(500).json({
        message: 'Unable to generate CSV export.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.post('/api/open-workbook', async (_req, res) => {
    try {
      await fs.access(WORKBOOK_PATH)
      openPath(WORKBOOK_PATH)
      res.json({ ok: true, workbookPath: WORKBOOK_PATH })
    } catch (error) {
      res.status(500).json({
        message: 'Unable to open active workbook.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.post('/api/reset-app-data', async (req, res) => {
    try {
      const confirmPhrase = String(req.body?.confirmPhrase ?? '').trim()
      if (confirmPhrase !== 'DELETE ALL DATA') {
        return res.status(400).json({
          message: 'Reset rejected.',
          details: 'Invalid confirmation phrase. Use DELETE ALL DATA.',
        })
      }

      const result = await resetAllAppData()
      res.json({
        ok: true,
        message: 'All personal habits, statistics, and local app data were reset.',
        ...result,
      })
    } catch (error) {
      res.status(500).json({
        message: 'Unable to reset app data.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  return app
}

export async function startEmbersApi(port = 4010) {
  const app = await createEmbersApi()

  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => {
        console.log(`Embers API running on http://localhost:${port}`)
        console.log(`Workbook source: ${WORKBOOK_PATH}`)
        resolve(server)
      })
      .on('error', reject)
  })
}
