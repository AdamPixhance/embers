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

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekdayAbbr(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`)
  return WEEKDAY_ABBR[date.getDay()]
}

function parseScheduleDays(raw) {
  const value = String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return new Set(value)
}

function isHabitActiveOnDate(habit, dateIso) {
  if (habit?.active === false) return false
  if (habit?.activeFrom && dateIso < habit.activeFrom) return false
  if (habit?.inactiveFrom && dateIso >= habit.inactiveFrom) return false

  const scheduleType = String(habit?.scheduleType ?? 'daily').toLowerCase()
  if (scheduleType === 'daily') return true

  const date = new Date(`${dateIso}T00:00:00`)
  const weekday = date.getDay()

  if (scheduleType === 'weekdays') return weekday >= 1 && weekday <= 5
  if (scheduleType === 'weekends') return weekday === 0 || weekday === 6
  if (scheduleType === 'custom') {
    const allowed = parseScheduleDays(habit?.scheduleDays)
    return allowed.has(getWeekdayAbbr(dateIso))
  }

  return true
}

function filterHabitsForDate(habits, dateIso) {
  return (habits ?? []).filter((habit) => isHabitActiveOnDate(habit, dateIso))
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

function resolvePotentialCount(_habit) {
  // Both toggles and counters use 1 as the minimum to complete the habit
  return 1
}

function computeScoreModelForDate(habits, dayCounts) {
  let score = 0
  let maxPositiveScore = 0
  let maxNegativeMagnitude = 0

  for (const habit of habits ?? []) {
    const count = normalizeCountValue(dayCounts?.[habit.habitId] ?? 0)
    score += count * habit.scorePerUnit

    const potentialCount = resolvePotentialCount(habit)
    const potentialScore = potentialCount * habit.scorePerUnit
    if (habit?.polarity === 'bad') {
      maxNegativeMagnitude += Math.abs(potentialScore)
    } else {
      maxPositiveScore += Math.max(0, potentialScore)
    }
  }

  const scorePercent =
    score >= 0
      ? maxPositiveScore > 0
        ? (score / maxPositiveScore) * 100
        : 0
      : maxNegativeMagnitude > 0
        ? (score / maxNegativeMagnitude) * 100
        : 0

  return {
    score,
    scorePercent: Math.max(-100, Math.min(100, scorePercent)),
    maxPositiveScore,
    maxNegativeMagnitude,
  }
}

function resolveBadgeForScorePercent(scorePercent, badges) {
  const ordered = [...(badges ?? [])]
    .filter((badge) => badge?.active !== false)
    .sort((left, right) => left.minScore - right.minScore || left.sortOrder - right.sortOrder)

  let winner = null
  for (const badge of ordered) {
    if (scorePercent >= badge.minScore) {
      winner = badge
    }
  }
  return winner
}

function hasAnyProgress(dayRecord) {
  const counts = normalizeDayRecord(dayRecord).counts
  return Object.values(counts).some((value) => normalizeCountValue(value) !== 0)
}

function computeDayScore(habits, dayCounts) {
  let dayScore = 0
  for (const habit of habits) {
    const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
    dayScore += count * habit.scorePerUnit
  }
  return dayScore
}

function computeAverageScore(entries, habits, endDate, days) {
  const start = new Date(`${endDate}T00:00:00`)
  start.setDate(start.getDate() - (days - 1))
  const startIso = start.toISOString().slice(0, 10)

  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key >= startIso && key <= endDate)
    .sort()

  const scores = []
  for (const dateIso of dateKeys) {
    const dayCounts = normalizeDayRecord(entries[dateIso]).counts
    if (!hasAnyProgress(entries[dateIso])) continue
    const habitsForDate = filterHabitsForDate(habits, dateIso)
    if (habitsForDate.length === 0) continue
    scores.push(computeDayScore(habitsForDate, dayCounts))
  }

  if (scores.length === 0) return 0
  return scores.reduce((sum, value) => sum + value, 0) / scores.length
}

function computeSignStreak(entries, habits, upToDate) {
  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key <= upToDate)
    .sort()

  let baseDate = null
  for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
    const dateIso = dateKeys[index]
    if (hasAnyProgress(entries[dateIso])) {
      baseDate = dateIso
      break
    }
  }

  if (!baseDate) return { signStreak: 0, signStreakIsPositive: true }

  const baseHabits = filterHabitsForDate(habits, baseDate)
  const baseScore = computeDayScore(baseHabits, normalizeDayRecord(entries[baseDate]).counts)
  const isPositive = baseScore >= 0

  let streak = 0
  for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
    const dateIso = dateKeys[index]
    if (dateIso > baseDate) continue
    if (!hasAnyProgress(entries[dateIso])) break

    const habitsForDate = filterHabitsForDate(habits, dateIso)
    const dayScore = computeDayScore(habitsForDate, normalizeDayRecord(entries[dateIso]).counts)
    if ((dayScore >= 0) !== isPositive) break
    streak += 1
  }

  return { signStreak: streak, signStreakIsPositive: isPositive }
}

export function findOpenDayInProgress(entries, upToDate) {
  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key <= upToDate)
    .sort()

  for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
    const dateIso = dateKeys[index]
    const record = normalizeDayRecord(entries[dateIso])
    if (!record.locked && hasAnyProgress(record)) {
      return {
        date: dateIso,
        locked: false,
        hasProgress: true,
      }
    }
  }

  return null
}

export function computeAnalytics(entries, habits, upToDate, badges = []) {
  const habitMap = new Map(habits.map((habit) => [habit.habitId, habit]))

  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key <= upToDate)
    .sort()

  let totalScore = 0
  let qualifiedHabitsForDay = 0
  const latestCounts = normalizeDayRecord(entries[upToDate]).counts
  const habitsForLatest = filterHabitsForDate(habits, upToDate)

  for (const habit of habitsForLatest) {
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
      if (!isHabitActiveOnDate(habit, day)) continue
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
    const habitsForDay = filterHabitsForDate(habits, day)
    if (habitsForDay.length === 0) break
    const allQualified = habitsForDay.every((habit) => {
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
    const habitsForDay = filterHabitsForDate(habits, dateIso)
    const dayModel = computeScoreModelForDate(habitsForDay, dayCounts)
    let qualified = 0
    for (const habit of habitsForDay) {
      const count = normalizeCountValue(dayCounts[habit.habitId] ?? 0)
      if (count >= habit.streakMinCount) {
        qualified += 1
      }
    }
    return {
      date: dateIso,
      score: dayModel.score,
      qualifiedCount: qualified,
      totalHabits: habitsForDay.length,
      badge: resolveBadgeForScorePercent(dayModel.scorePercent, badges),
    }
  })

  const badgeTimeline = dateKeys.slice(-120).map((dateIso) => {
    const dayCounts = normalizeDayRecord(entries[dateIso]).counts
    const habitsForDay = filterHabitsForDate(habits, dateIso)
    const dayModel = computeScoreModelForDate(habitsForDay, dayCounts)

    return {
      date: dateIso,
      score: dayModel.score,
      badge: resolveBadgeForScorePercent(dayModel.scorePercent, badges),
    }
  })

  const latestScoreModel = computeScoreModelForDate(habitsForLatest, latestCounts)
  const dailyBadge = resolveBadgeForScorePercent(latestScoreModel.scorePercent, badges)
  const { signStreak, signStreakIsPositive } = computeSignStreak(entries, habits, upToDate)

  return {
    totalScore,
    qualifiedHabitsForDay,
    totalHabits: habitsForLatest.length,
    globalStreak,
    perHabit,
    timeline,
    badgeTimeline,
    dailyBadge,
    generatedForDate: upToDate,
    habitCount: habitMap.size,
    signStreak,
    signStreakIsPositive,
    averages: {
      days7: computeAverageScore(entries, habits, upToDate, 7),
      days30: computeAverageScore(entries, habits, upToDate, 30),
      days365: computeAverageScore(entries, habits, upToDate, 365),
    },
  }
}

export function computeHabitHistory(entries, habits) {
  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key))
    .sort()

  return habits.map((habit) => {
    const dailyRecords = dateKeys
      .filter((dateIso) => isHabitActiveOnDate(habit, dateIso))
      .map((dateIso) => {
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

export function computeBadgeMap(entries, habits, startDate, endDate, badges = []) {
  const dateKeys = Object.keys(entries)
    .filter((key) => isIsoDate(key) && key >= startDate && key <= endDate)
    .sort()

  const map = {}
  for (const dateIso of dateKeys) {
    const dayCounts = normalizeDayRecord(entries[dateIso]).counts
    const habitsForDay = filterHabitsForDate(habits, dateIso)
    if (habitsForDay.length === 0) continue
    const dayModel = computeScoreModelForDate(habitsForDay, dayCounts)
    map[dateIso] = {
      date: dateIso,
      score: dayModel.score,
      badge: resolveBadgeForScorePercent(dayModel.scorePercent, badges),
      hasProgress: hasAnyProgress(entries[dateIso]),
    }
  }
  return map
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
