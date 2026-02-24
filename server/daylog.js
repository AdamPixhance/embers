import fs from 'node:fs/promises'
import path from 'node:path'
import { DAY_LOG_PATH } from './constants.js'

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeCountValue(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function assertNotFutureDate(dateIso) {
  if (dateIso > todayIso()) {
    throw new Error('Future dates are not editable.')
  }
}

function normalizeCounts(counts) {
  const normalized = {}
  for (const [habitId, value] of Object.entries(counts ?? {})) {
    normalized[habitId] = normalizeCountValue(value)
  }
  return normalized
}

function isLegacyCountsObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((entry) => Number.isFinite(Number(entry)))
}

function normalizeDayRecord(raw) {
  if (isLegacyCountsObject(raw)) {
    return {
      counts: normalizeCounts(raw),
      locked: false,
      completedAt: null,
    }
  }

  if (!raw || typeof raw !== 'object') {
    return {
      counts: {},
      locked: false,
      completedAt: null,
    }
  }

  return {
    counts: normalizeCounts(raw.counts),
    locked: raw.locked === true,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
  }
}

async function ensureDayLogFile() {
  try {
    await fs.access(DAY_LOG_PATH)
  } catch {
    await fs.mkdir(path.dirname(DAY_LOG_PATH), { recursive: true })
    await fs.writeFile(DAY_LOG_PATH, JSON.stringify({ entries: {} }, null, 2), 'utf-8')
  }
}

async function readDayLog() {
  await ensureDayLogFile()
  const content = await fs.readFile(DAY_LOG_PATH, 'utf-8')
  const parsed = JSON.parse(content)
  if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
    return { entries: {} }
  }
  return { entries: parsed.entries }
}

async function writeDayLog(logData) {
  await fs.writeFile(DAY_LOG_PATH, JSON.stringify(logData, null, 2), 'utf-8')
}

export async function getDayCounts(dateIso) {
  if (!isIsoDate(dateIso)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }

  const logData = await readDayLog()
  return normalizeDayRecord(logData.entries[dateIso])
}

export async function saveDayCounts(dateIso, counts) {
  if (!isIsoDate(dateIso)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }
  assertNotFutureDate(dateIso)

  const logData = await readDayLog()
  const existing = normalizeDayRecord(logData.entries[dateIso])
  if (existing.locked) {
    throw new Error('Day is locked. Unlock it first to edit.')
  }

  const nextRecord = {
    ...existing,
    counts: normalizeCounts(counts),
  }

  logData.entries[dateIso] = nextRecord
  await writeDayLog(logData)
  return nextRecord
}

export async function completeDay(dateIso, counts) {
  if (!isIsoDate(dateIso)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }
  assertNotFutureDate(dateIso)

  const logData = await readDayLog()
  const existing = normalizeDayRecord(logData.entries[dateIso])

  const nextRecord = {
    counts: normalizeCounts(counts ?? existing.counts),
    locked: true,
    completedAt: new Date().toISOString(),
  }

  logData.entries[dateIso] = nextRecord
  await writeDayLog(logData)
  return nextRecord
}

export async function unlockDay(dateIso) {
  if (!isIsoDate(dateIso)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }
  assertNotFutureDate(dateIso)

  const logData = await readDayLog()
  const existing = normalizeDayRecord(logData.entries[dateIso])
  existing.locked = false
  existing.completedAt = null
  logData.entries[dateIso] = existing
  await writeDayLog(logData)
  return existing
}

export async function listDayEntries() {
  const logData = await readDayLog()
  const normalizedEntries = {}
  for (const [dateIso, raw] of Object.entries(logData.entries ?? {})) {
    if (!isIsoDate(dateIso)) continue
    normalizedEntries[dateIso] = normalizeDayRecord(raw)
  }
  return normalizedEntries
}

export function computeAnalytics(entries, habits, upToDate) {
  const habitMap = new Map(habits.map((habit) => [habit.habitId, habit]))

  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key <= upToDate)
    .sort()

  let totalScore = 0
  let qualifiedHabitsForDay = 0
  const latestCounts = normalizeDayRecord(entries[upToDate]).counts

  for (const habit of habits) {
    const currentCount = normalizeCountValue(latestCounts[habit.habitId] ?? 0)
    totalScore += currentCount * habit.scorePerUnit
    if (currentCount >= habit.streakMinCount) {
      qualifiedHabitsForDay += 1
    }
  }

  const perHabit = habits.map((habit) => {
    let streak = 0
    for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
      const day = dateKeys[index]
      const dayCounts = normalizeDayRecord(entries[day]).counts
      const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
      if (count >= habit.streakMinCount) {
        streak += 1
      } else {
        break
      }
    }

    return {
      habitId: habit.habitId,
      label: habit.label,
      currentStreak: streak,
      streakMinCount: habit.streakMinCount,
    }
  })

  let globalStreak = 0
  for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
    const day = dateKeys[index]
    const dayCounts = normalizeDayRecord(entries[day]).counts
    const allQualified = habits.every((habit) => {
      const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
      return count >= habit.streakMinCount
    })
    if (allQualified) {
      globalStreak += 1
    } else {
      break
    }
  }

  const timeline = dateKeys.slice(-30).map((dateIso) => {
    const dayCounts = normalizeDayRecord(entries[dateIso]).counts
    let dayScore = 0
    let qualified = 0
    for (const habit of habits) {
      const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
      dayScore += count * habit.scorePerUnit
      if (count >= habit.streakMinCount) {
        qualified += 1
      }
    }
    return {
      date: dateIso,
      score: dayScore,
      qualifiedCount: qualified,
      totalHabits: habits.length,
    }
  })

  return {
    totalScore,
    qualifiedHabitsForDay,
    totalHabits: habits.length,
    globalStreak,
    perHabit,
    timeline,
    generatedForDate: upToDate,
    habitCount: habitMap.size,
  }
}

export function computeHabitHistory(entries, habits) {
  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key))
    .sort()

  return habits.map((habit) => {
    const dailyRecords = dateKeys.map((dateIso) => {
      const dayCounts = normalizeDayRecord(entries[dateIso]).counts
      const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
      return {
        date: dateIso,
        count,
        qualified: count >= habit.streakMinCount,
        score: count * habit.scorePerUnit,
      }
    })

    const totalCount = dailyRecords.reduce((sum, record) => sum + record.count, 0)
    const totalScore = dailyRecords.reduce((sum, record) => sum + record.score, 0)
    const daysActive = dailyRecords.filter((record) => record.count > 0).length

    return {
      habitId: habit.habitId,
      label: habit.label,
      type: habit.type,
      scorePerUnit: habit.scorePerUnit,
      streakMinCount: habit.streakMinCount,
      totalCount,
      totalScore,
      daysActive,
      dailyRecords,
    }
  })
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function generateHabitCSV(habitHistory) {
  const rows = []

  rows.push(['Embers Habit Export', new Date().toISOString().slice(0, 10)].map(escapeCSV).join(','))
  rows.push([])

  for (const habit of habitHistory) {
    rows.push([habit.label].map(escapeCSV).join(','))
    rows.push(['Date', 'Count', 'Score', 'Qualified'].map(escapeCSV).join(','))

    for (const day of habit.dailyRecords) {
      rows.push(
        [day.date, day.count, day.score, day.qualified ? 'Yes' : 'No'].map(escapeCSV).join(',')
      )
    }

    rows.push(['', '', '', ''].map(escapeCSV).join(','))
    rows.push(
      ['Total', habit.totalCount, habit.totalScore, `${habit.daysActive} days`]
        .map(escapeCSV)
        .join(',')
    )
    rows.push(['', '', '', ''].map(escapeCSV).join(','))
    rows.push([])
  }

  return rows.join('\n')
}
