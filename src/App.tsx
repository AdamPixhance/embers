import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Flame,
  Home,
  Info,
  Lock,
  LockOpen,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Target,
  TriangleAlert,
} from 'lucide-react'
import './App.css'
import embersMark from './assets/embers-mark.svg'

type Group = {
  groupId: string
  groupLabel: string
  sortOrder: number
}

type Badge = {
  badgeId: string
  displayName: string
  icon: string
  colorHex: string
  minScore: number
  sortOrder: number
  active: boolean
}

type Habit = {
  habitId: string
  label: string
  type: 'toggle' | 'counter'
  groupId: string
  polarity: 'good' | 'bad'
  scorePerUnit: number
  streakMinCount: number
  minCount: number
  maxCount: number
  tooltip: string
  active: boolean
  sortOrder: number
  scheduleType: string
  scheduleDays: string
  activeFrom: string
  inactiveFrom: string
}

type WorkbookPayload = {
  habits: Habit[]
  groups: Group[]
  badges: Badge[]
  workbookPath: string
  workbookUpdatedAt: string
}

type AnalyticsPayload = {
  totalScore: number
  qualifiedHabitsForDay: number
  totalHabits: number
  globalStreak: number
  signStreak: number
  signStreakIsPositive: boolean
  averages: {
    days7: number
    days30: number
    days365: number
  }
  perHabit: Array<{
    habitId: string
    label: string
    currentStreak: number
    streakMinCount: number
  }>
  timeline: Array<{
    date: string
    score: number
    qualifiedCount: number
    totalHabits: number
    badge: Badge | null
  }>
  badgeTimeline: Array<{
    date: string
    score: number
    badge: Badge | null
  }>
  dailyBadge: Badge | null
  generatedForDate: string
}

type DayPayload = {
  date: string
  counts: Record<string, number>
  locked: boolean
  completedAt: string | null
}

type OpenDayPayload = {
  openDay: {
    date: string
    locked: boolean
    hasProgress: boolean
  } | null
}

type BadgeMapItem = {
  date: string
  score: number
  badge: Badge | null
  hasProgress: boolean
}

const desktopApiBase =
  typeof window !== 'undefined' && 'embersApiBase' in window
    ? String((window as Window & { embersApiBase?: string }).embersApiBase ?? '')
    : ''

const apiUrl = (path: string) => `${desktopApiBase}${path}`
const todayIso = () => new Date().toISOString().slice(0, 10)
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function shiftDate(dateIso: string, deltaDays: number) {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}

function formatDayHeading(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00`)
  return {
    dayName: date.toLocaleDateString(undefined, { weekday: 'long' }),
    fullDate: date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}

function areCountsEqual(left: Record<string, number>, right: Record<string, number>) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (Number(left[key]) !== Number(right[key])) return false
  }
  return true
}

function parseScheduleDays(raw: string) {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function isHabitActiveOnDate(habit: Habit, dateIso: string) {
  if (!habit.active) return false
  if (habit.activeFrom && dateIso < habit.activeFrom) return false
  if (habit.inactiveFrom && dateIso >= habit.inactiveFrom) return false

  const scheduleType = String(habit.scheduleType || 'daily').toLowerCase()
  if (scheduleType === 'daily') return true

  const date = new Date(`${dateIso}T00:00:00`)
  const weekday = date.getDay()

  if (scheduleType === 'weekdays') return weekday >= 1 && weekday <= 5
  if (scheduleType === 'weekends') return weekday === 0 || weekday === 6
  if (scheduleType === 'custom') {
    const allowed = new Set(parseScheduleDays(habit.scheduleDays || ''))
    return allowed.has(WEEKDAY_ABBR[weekday])
  }

  return true
}

function filterHabitsForDate(habits: Habit[], dateIso: string) {
  return habits.filter((habit) => isHabitActiveOnDate(habit, dateIso))
}

function buildRange(start: Date, end: Date) {
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function App() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [view, setView] = useState<'day' | 'stats'>('day')
  const [data, setData] = useState<WorkbookPayload | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [dayLocked, setDayLocked] = useState(false)
  const [dayCompletedAt, setDayCompletedAt] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [resetAcknowledged, setResetAcknowledged] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [openDayInProgress, setOpenDayInProgress] = useState<string | null>(null)
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [showOpenDayDialog, setShowOpenDayDialog] = useState(false)
  const [openDayTarget, setOpenDayTarget] = useState<string | null>(null)
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [snapshotDone, setSnapshotDone] = useState<string[]>([])
  const [snapshotMissed, setSnapshotMissed] = useState<string[]>([])
  const [badgeWeek, setBadgeWeek] = useState<Record<string, BadgeMapItem>>({})
  const [badgeMonth, setBadgeMonth] = useState<Record<string, BadgeMapItem>>({})
  const [badgeYear, setBadgeYear] = useState<Record<string, BadgeMapItem>>({})
  const [showClosePrompt, setShowClosePrompt] = useState(false)
  const [lastSavedCounts, setLastSavedCounts] = useState<Record<string, number>>({})
  const allowCloseRef = useRef(false)

  const loadWorkbookData = async () => {
    const response = await fetch(apiUrl('/api/data'))
    if (!response.ok) throw new Error('Failed to load workbook data')
    const payload = (await response.json()) as WorkbookPayload
    setData(payload)
    return payload
  }

  const loadOpenDayInProgress = async (dateIso: string) => {
    const response = await fetch(apiUrl(`/api/open-day?date=${encodeURIComponent(dateIso)}`))
    if (!response.ok) throw new Error('Failed to evaluate open day continuity')
    const payload = (await response.json()) as OpenDayPayload
    setOpenDayInProgress(payload.openDay?.date ?? null)
    return payload.openDay?.date ?? null
  }

  const hydrateCountsForDate = async (payload: WorkbookPayload, dateIso: string) => {
    const response = await fetch(apiUrl(`/api/day/${dateIso}`))
    if (!response.ok) throw new Error('Failed to load day counts')

    const body = (await response.json()) as DayPayload
    const next: Record<string, number> = {}

    for (const habit of payload.habits) {
      const raw = Number(body.counts[habit.habitId] ?? habit.minCount)
      const bounded = Math.max(habit.minCount, Math.min(habit.maxCount, Number.isFinite(raw) ? raw : 0))
      next[habit.habitId] = habit.type === 'toggle' ? (bounded >= 1 ? 1 : 0) : bounded
    }

    setCounts(next)
    setDayLocked(body.locked)
    setDayCompletedAt(body.completedAt)
    setLastSavedCounts(next)
  }

  const refreshAnalytics = async (dateIso: string) => {
    const response = await fetch(apiUrl(`/api/analytics?date=${encodeURIComponent(dateIso)}`))
    if (!response.ok) throw new Error('Failed to load analytics')
    const payload = (await response.json()) as AnalyticsPayload
    setAnalytics(payload)
  }

  const loadBadgeRange = async (start: string, end: string) => {
    const response = await fetch(apiUrl(`/api/analytics/badges?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`))
    if (!response.ok) throw new Error('Failed to load badge range')
    return (await response.json()) as { badgeMap: Record<string, BadgeMapItem> }
  }

  const toggleFocusMode = async () => {
    if (!isFocusMode) {
      await goToDate(todayIso())
      setView('day')
      setIsNavExpanded(false)
    }
    setIsFocusMode((previous) => !previous)
  }

  const goToDate = async (nextDate: string) => {
    const openDay = await loadOpenDayInProgress(todayIso())
    if (openDay && openDay !== nextDate) {
      setOpenDayTarget(openDay)
      setShowOpenDayDialog(true)
      return
    }

    setSelectedDate(nextDate)
    setError('')
  }

  const saveDay = async () => {
    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/day/${selectedDate}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })
      if (!response.ok) throw new Error('Failed to save day data')

      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)

      await refreshAnalytics(selectedDate)
      await loadOpenDayInProgress(todayIso())
      setLastSavedCounts({ ...counts })
      setError('')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const completeDay = async () => {
    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/day/${selectedDate}/complete`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })
      if (!response.ok) throw new Error('Failed to complete day')

      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)
      await refreshAnalytics(selectedDate)
      await loadOpenDayInProgress(todayIso())
      setLastSavedCounts({ ...counts })

      const done: string[] = []
      const missed: string[] = []
      const habits = filterHabitsForDate(data?.habits ?? [], selectedDate)
      for (const habit of habits) {
        const current = counts[habit.habitId] ?? 0
        if (current >= habit.streakMinCount) done.push(habit.label)
        else missed.push(habit.label)
      }
      setSnapshotDone(done)
      setSnapshotMissed(missed)
      setShowSnapshotModal(true)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Complete failed')
    } finally {
      setSaving(false)
    }
  }

  const unlockCurrentDay = async () => {
    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/day/${selectedDate}/unlock`), { method: 'POST' })
      if (!response.ok) throw new Error('Failed to unlock day')
      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)
      await loadOpenDayInProgress(todayIso())
      setLastSavedCounts({ ...counts })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExportingBackup(true)
    try {
      const response = await fetch(apiUrl('/api/export/csv'))
      if (!response.ok) throw new Error('Failed to export CSV')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'embers-habits-export.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportingBackup(false)
    }
  }

  const resetAppData = async () => {
    if (!resetAcknowledged) {
      setError('Please acknowledge the warning before resetting.')
      return
    }

    setResetting(true)
    try {
      const response = await fetch(apiUrl('/api/reset-app-data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: 'DELETE ALL DATA' }),
      })
      if (!response.ok) throw new Error('Failed to reset app data')

      const date = todayIso()
      setSelectedDate(date)
      setView('day')
      const workbook = await loadWorkbookData()
      await hydrateCountsForDate(workbook, date)
      await refreshAnalytics(date)
      await loadOpenDayInProgress(date)
      setResetAcknowledged(false)
      setShowResetModal(false)
      setLastSavedCounts({})
      setError('')
      window.alert('App reset complete. All personal data was deleted and default placeholder habits were restored.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const today = todayIso()
        const workbook = await loadWorkbookData()
        const openDay = await loadOpenDayInProgress(today)
        const initialDate = openDay ?? today

        setSelectedDate(initialDate)
        await hydrateCountsForDate(workbook, initialDate)
        await refreshAnalytics(initialDate)

        if (openDay && openDay !== today) {
          setOpenDayTarget(openDay)
          setShowOpenDayDialog(true)
        } else {
          setError('')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load data')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  useEffect(() => {
    if (!data) return
    hydrateCountsForDate(data, selectedDate).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to change date')
    })
    refreshAnalytics(selectedDate).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    })
  }, [selectedDate, data])

  useEffect(() => {
    if (view !== 'stats') return
    const anchor = new Date(`${selectedDate}T00:00:00`)
    const weekStart = new Date(anchor)
    weekStart.setDate(anchor.getDate() - anchor.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const nextMonthStart = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
    const monthEnd = new Date(nextMonthStart)
    monthEnd.setDate(nextMonthStart.getDate() - 1)

    const yearStart = new Date(anchor.getFullYear(), 0, 1)
    const yearEnd = new Date(anchor.getFullYear(), 11, 31)

    Promise.all([
      loadBadgeRange(weekStart.toISOString().slice(0, 10), weekEnd.toISOString().slice(0, 10)),
      loadBadgeRange(monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)),
      loadBadgeRange(yearStart.toISOString().slice(0, 10), yearEnd.toISOString().slice(0, 10)),
    ])
      .then(([week, month, year]) => {
        setBadgeWeek(week.badgeMap ?? {})
        setBadgeMonth(month.badgeMap ?? {})
        setBadgeYear(year.badgeMap ?? {})
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      })
  }, [view, selectedDate])

  useEffect(() => {
    if (!isFocusMode) return
    if (view !== 'day') setView('day')
  }, [isFocusMode, view])

  const isDirty = useMemo(() => !areCountsEqual(counts, lastSavedCounts), [counts, lastSavedCounts])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (allowCloseRef.current) return
      if (!isDirty) return
      event.preventDefault()
      setShowClosePrompt(true)
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const habitsForSelectedDate = useMemo(() => {
    return filterHabitsForDate(data?.habits ?? [], selectedDate)
  }, [data, selectedDate])

  const groupedByPolarity = useMemo(() => {
    const map = new Map<string, { group: Group; good: Habit[]; bad: Habit[] }>()
    const groupMap = new Map((data?.groups ?? []).map((group) => [group.groupId, group]))
    const fallbackGroup: Group = { groupId: 'other', groupLabel: 'Other', sortOrder: 9999 }

    for (const habit of habitsForSelectedDate) {
      const group = groupMap.get(habit.groupId) ?? fallbackGroup
      if (!map.has(group.groupId)) {
        map.set(group.groupId, { group, good: [], bad: [] })
      }
      const bucket = map.get(group.groupId)
      if (!bucket) continue
      if (habit.polarity === 'bad') bucket.bad.push(habit)
      else bucket.good.push(habit)
    }

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        good: entry.good.sort((left, right) => left.sortOrder - right.sortOrder),
        bad: entry.bad.sort((left, right) => left.sortOrder - right.sortOrder),
      }))
      .filter((entry) => entry.good.length > 0 || entry.bad.length > 0)
      .sort((left, right) => left.group.sortOrder - right.group.sortOrder)
  }, [data, habitsForSelectedDate])

  const progressModel = useMemo(() => {
    if (!data) return { score: 0, min: 0, max: 1, percent: 50 }

    let min = 0
    let max = 0
    let score = 0

    for (const habit of habitsForSelectedDate) {
      const current = counts[habit.habitId] ?? 0
      score += current * habit.scorePerUnit

      const low = Math.min(habit.minCount * habit.scorePerUnit, habit.maxCount * habit.scorePerUnit)
      const high = Math.max(habit.minCount * habit.scorePerUnit, habit.maxCount * habit.scorePerUnit)
      min += low
      max += high
    }

    const span = Math.max(0.0001, max - min)
    const percent = Math.max(0, Math.min(100, ((score - min) / span) * 100))
    return { score, min, max, percent }
  }, [data, counts, habitsForSelectedDate])

  const liveBadge = useMemo(() => {
    const badges = [...(data?.badges ?? [])]
      .filter((badge) => badge.active)
      .sort((left, right) => left.minScore - right.minScore || left.sortOrder - right.sortOrder)

    let matched: Badge | null = null
    for (const badge of badges) {
      if (progressModel.score >= badge.minScore) matched = badge
    }
    return matched
  }, [data, progressModel.score])

  const setHabitCount = (habit: Habit, nextCount: number) => {
    if (openDayInProgress && openDayInProgress !== selectedDate) {
      setOpenDayTarget(openDayInProgress)
      setShowOpenDayDialog(true)
      return
    }
    const bounded = Math.max(habit.minCount, Math.min(habit.maxCount, nextCount))
    setCounts((previous) => ({
      ...previous,
      [habit.habitId]: habit.type === 'toggle' ? (bounded >= 1 ? 1 : 0) : bounded,
    }))
  }

  const renderHabitControl = (habit: Habit) => {
    const count = counts[habit.habitId] ?? 0
    if (habit.type === 'toggle') {
      return (
        <button
          type="button"
          className={`toggle-button ${count >= 1 ? 'is-on' : 'is-off'}`}
          onClick={() => setHabitCount(habit, count >= 1 ? 0 : 1)}
          disabled={dayLocked || selectedDate > todayIso()}
          aria-label={`${habit.label}: ${count >= 1 ? 'Done' : 'Not done'} (click to toggle)`}
        >
          {count >= 1 ? 'Done' : 'Not done'}
        </button>
      )
    }

    return (
      <div className="counter-wrap" role="group" aria-label={`${habit.label} counter: ${count}`}>
        <button
          type="button"
          className="counter-btn"
          onClick={() => setHabitCount(habit, count - 1)}
          disabled={dayLocked || selectedDate > todayIso()}
          aria-label={`Decrease ${habit.label}`}
        >
          <Minus size={15} />
        </button>
        <span className="counter-value">{count}</span>
        <button
          type="button"
          className="counter-btn"
          onClick={() => setHabitCount(habit, count + 1)}
          disabled={dayLocked || selectedDate > todayIso()}
          aria-label={`Increase ${habit.label}`}
        >
          <Plus size={15} />
        </button>
      </div>
    )
  }

  const streakMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const habitStreak of analytics?.perHabit ?? []) {
      map.set(habitStreak.habitId, habitStreak.currentStreak)
    }
    return map
  }, [analytics])

  const miniActivity = useMemo(() => {
    const timeline = analytics?.badgeTimeline ?? []
    const map = new Map(timeline.map((item) => [item.date, item]))
    const last7: BadgeMapItem[] = []
    const cursor = new Date(`${selectedDate}T00:00:00`)
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(cursor)
      day.setDate(cursor.getDate() - i)
      const iso = day.toISOString().slice(0, 10)
      const entry = map.get(iso)
      last7.push({
        date: iso,
        score: entry?.score ?? 0,
        badge: entry?.badge ?? null,
        hasProgress: entry ? true : false,
      })
    }
    return last7
  }, [analytics, selectedDate])

  if (loading) {
    return <div className="screen center">Loading Embers…</div>
  }

  const dayHeading = formatDayHeading(selectedDate)
  const readOnlyDay = dayLocked || selectedDate > todayIso()

  return (
    <div
      className={`screen ember-root ${isNavExpanded ? 'nav-expanded' : 'nav-collapsed'}${isFocusMode ? ' focus-mode' : ''}`}
    >
      <aside className={`side-nav card ${isNavExpanded ? 'expanded' : 'collapsed'}`} aria-label="Main navigation">
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setIsNavExpanded((previous) => !previous)}
          title={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
        >
          <Menu size={18} />
        </button>

        <button type="button" className="brand-logo" onClick={() => setView('day')} title="Embers home">
          <img src={embersMark} alt="Embers" className="brand-icon" />
          {isNavExpanded ? <span className="nav-label">Embers</span> : null}
        </button>

        <button type="button" className={`nav-item ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')} title="Day view">
          <Home size={17} />
          {isNavExpanded ? <span className="nav-label">Day</span> : null}
        </button>

        <button type="button" className={`nav-item ${view === 'stats' ? 'active' : ''}`} onClick={() => setView('stats')} title="Stats">
          <BarChart3 size={17} />
          {isNavExpanded ? <span className="nav-label">Stats</span> : null}
        </button>

        <div className="nav-divider" />

        <button
          type="button"
          className="nav-item"
          onClick={async () => {
            setLoading(true)
            try {
              const workbook = await loadWorkbookData()
              await hydrateCountsForDate(workbook, selectedDate)
              await refreshAnalytics(selectedDate)
              await loadOpenDayInProgress(todayIso())
              setError('')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Refresh failed')
            } finally {
              setLoading(false)
            }
          }}
          title="Refresh workbook"
        >
          <RefreshCw size={17} />
          {isNavExpanded ? <span className="nav-label">Refresh</span> : null}
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={async () => {
            const response = await fetch(apiUrl('/api/open-workbook'), { method: 'POST' })
            if (!response.ok) setError('Unable to open workbook')
          }}
          title="Open workbook"
        >
          <FolderOpen size={17} />
          {isNavExpanded ? <span className="nav-label">Workbook</span> : null}
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={handleExport}
          disabled={exportingBackup || resetting || loading || saving}
          title="Export CSV"
        >
          <Download size={17} />
          {isNavExpanded ? <span className="nav-label">Export</span> : null}
        </button>
      </aside>

      <main className="main-panel">
        <header className="day-header card">
          <div className="header-controls-row">
            <button type="button" className="complete-button" onClick={completeDay} disabled={saving || readOnlyDay}>
              Complete day
            </button>

            <button
              type="button"
              className="icon-action save-action"
              onClick={saveDay}
              disabled={saving || readOnlyDay}
              title={saving ? 'Saving' : 'Save day'}
              aria-label={saving ? 'Saving day' : 'Save day'}
            >
              <Save size={16} />
            </button>

            {dayLocked ? (
              <button
                type="button"
                className="icon-action unlock-action"
                onClick={unlockCurrentDay}
                disabled={saving || selectedDate > todayIso()}
                title="Unlock day"
                aria-label="Unlock day"
              >
                <LockOpen size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="icon-action lock-action"
                disabled
                title="Day remains open until completed"
                aria-label="Day is open"
              >
                <Lock size={16} />
              </button>
            )}

            <button
              type="button"
              className={`icon-action focus-action ${isFocusMode ? 'is-on' : ''}`}
              onClick={() => {
                toggleFocusMode().catch((err) => {
                  setError(err instanceof Error ? err.message : 'Unable to toggle focus mode')
                })
              }}
              title={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
              aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
            >
              <Target size={16} />
            </button>

            <div className="day-nav-inline">
              <button type="button" className="icon-action" onClick={() => goToDate(shiftDate(selectedDate, -1))} title="Previous day">
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="today-pill" onClick={() => goToDate(todayIso())}>
                Today
              </button>
              <button
                type="button"
                className="icon-action"
                disabled={selectedDate >= todayIso()}
                onClick={() => goToDate(shiftDate(selectedDate, 1))}
                title="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="day-heading-block">
              <h2>{dayHeading.dayName}</h2>
              <p>{dayHeading.fullDate}</p>
            </div>

            <div className="score-and-state">
              <div className="score-value">Score {progressModel.score.toFixed(1)}</div>
              <div className="score-bar-wrap">
                <div className="score-bar-fill" style={{ width: `${progressModel.percent}%` }} />
              </div>
              <div className="score-substats">
                <div className="score-average">
                  7-day avg: <strong>{analytics?.averages?.days7.toFixed(1) ?? '0.0'}</strong>
                </div>
                <div className="mini-activity">
                  {miniActivity.map((item) => (
                    <span
                      key={item.date}
                      className="mini-activity-cell"
                      style={{ backgroundColor: item.badge?.colorHex ?? '#e2e8f0' }}
                      title={`${item.date} • ${item.badge?.displayName ?? 'No badge'} • Score ${item.score.toFixed(1)}`}
                    />
                  ))}
                </div>
              </div>
              {liveBadge ? (
                <div className="badge-pill" style={{ backgroundColor: liveBadge.colorHex }}>
                  <span>{liveBadge.icon}</span>
                  <span>{liveBadge.displayName}</span>
                </div>
              ) : null}
              {analytics && analytics.signStreak > 0 ? (
                <div className="sign-streak">
                  <span className="tooltip-wrap">
                    <span className="streak-icon">
                      {analytics.signStreakIsPositive ? <Flame size={16} /> : <TriangleAlert size={16} />}
                    </span>
                    <span className="tooltip-bubble">
                      {analytics.signStreakIsPositive ? 'Positive streak' : 'Negative streak'}: {analytics.signStreak} day(s)
                    </span>
                  </span>
                </div>
              ) : null}
              <div className={`day-state ${dayLocked ? 'locked' : 'open'}`}>
                {dayLocked
                  ? `Locked${dayCompletedAt ? ` • ${new Date(dayCompletedAt).toLocaleString()}` : ''}`
                  : 'Open day'}
              </div>
            </div>
          </div>
        </header>

        {openDayInProgress && openDayInProgress !== selectedDate ? (
          <section className="card continuity-banner" role="alert">
            <strong>Day in progress detected: {openDayInProgress}</strong>
            <p>Complete or manage this open day before editing other dates.</p>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setOpenDayTarget(openDayInProgress)
                setShowOpenDayDialog(true)
              }}
            >
              Resolve open day
            </button>
          </section>
        ) : null}

        {error ? (
          <div className="error-banner card" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}

        {view === 'day' ? (
          <section className="group-rows">
            {groupedByPolarity.map((entry) => (
              <article key={entry.group.groupId} className="group-row card">
                <div className="group-side-label" aria-label={`Group ${entry.group.groupLabel}`}>
                  <span>{entry.group.groupLabel}</span>
                </div>

                <div className="row-column bad-column">
                  {entry.bad.map((habit) => {
                    const score = (counts[habit.habitId] ?? 0) * habit.scorePerUnit
                    const streak = streakMap.get(habit.habitId) ?? 0
                    return (
                      <div key={habit.habitId} className="habit-item habit-bad">
                        <div>
                          <div className="habit-title-row">
                            <h5>{habit.label}</h5>
                            {streak >= 2 ? (
                              <span className="tooltip-wrap">
                                <span className="streak-icon">
                                  <Flame size={14} />
                                </span>
                                <span className="tooltip-bubble">Streak: {streak} days</span>
                              </span>
                            ) : null}
                            {habit.tooltip?.trim() ? (
                              <span className="tooltip-wrap">
                                <button type="button" className="info-pill" aria-label={`Info for ${habit.label}`}>
                                  <Info size={13} />
                                </button>
                                <span className="tooltip-bubble">{habit.tooltip}</span>
                              </span>
                            ) : null}
                          </div>
                          <p className="habit-sub">Score {score.toFixed(1)}</p>
                        </div>
                        {renderHabitControl(habit)}
                      </div>
                    )
                  })}
                </div>

                <div className="row-column good-column">
                  {entry.good.map((habit) => {
                    const score = (counts[habit.habitId] ?? 0) * habit.scorePerUnit
                    const streak = streakMap.get(habit.habitId) ?? 0
                    return (
                      <div key={habit.habitId} className="habit-item habit-good">
                        <div>
                          <div className="habit-title-row">
                            <h5>{habit.label}</h5>
                            {streak >= 2 ? (
                              <span className="tooltip-wrap">
                                <span className="streak-icon">
                                  <Flame size={14} />
                                </span>
                                <span className="tooltip-bubble">Streak: {streak} days</span>
                              </span>
                            ) : null}
                            {habit.tooltip?.trim() ? (
                              <span className="tooltip-wrap">
                                <button type="button" className="info-pill" aria-label={`Info for ${habit.label}`}>
                                  <Info size={13} />
                                </button>
                                <span className="tooltip-bubble">{habit.tooltip}</span>
                              </span>
                            ) : null}
                          </div>
                          <p className="habit-sub">Score {score.toFixed(1)}</p>
                        </div>
                        {renderHabitControl(habit)}
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="stats-layout">
            <div className="stats-top card">
              <h3>Stats</h3>
              <p>
                Global streak: <strong>{analytics?.globalStreak ?? 0}</strong> days · Qualified habits today:{' '}
                <strong>
                  {analytics?.qualifiedHabitsForDay ?? 0}/{analytics?.totalHabits ?? 0}
                </strong>
              </p>
              <div className="stats-averages">
                <div>
                  7-day avg <strong>{analytics?.averages?.days7.toFixed(1) ?? '0.0'}</strong>
                </div>
                <div>
                  30-day avg <strong>{analytics?.averages?.days30.toFixed(1) ?? '0.0'}</strong>
                </div>
                <div>
                  365-day avg <strong>{analytics?.averages?.days365.toFixed(1) ?? '0.0'}</strong>
                </div>
              </div>
            </div>

            <div className="card badge-grid-card">
              <h3>Weekly grid</h3>
              <div className="badge-grid github-grid">
                {buildRange(
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    const start = new Date(anchor)
                    start.setDate(anchor.getDate() - anchor.getDay())
                    return start
                  })(),
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    const start = new Date(anchor)
                    start.setDate(anchor.getDate() - anchor.getDay())
                    const end = new Date(start)
                    end.setDate(start.getDate() + 6)
                    return end
                  })()
                ).map((dateIso) => {
                  const info = badgeWeek[dateIso]
                  return (
                    <span
                      key={`week-${dateIso}`}
                      className="badge-cell"
                      title={`${dateIso} • ${info?.badge?.displayName ?? 'No badge'} • Score ${info?.score?.toFixed(1) ?? '0.0'}`}
                      style={{ backgroundColor: info?.badge?.colorHex ?? '#e2e8f0' }}
                    >
                      {info?.badge?.icon ?? ''}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="card badge-grid-card">
              <h3>Monthly grid</h3>
              <div className="badge-grid github-grid">
                {buildRange(
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    return new Date(anchor.getFullYear(), anchor.getMonth(), 1)
                  })(),
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
                    const end = new Date(nextMonth)
                    end.setDate(nextMonth.getDate() - 1)
                    return end
                  })()
                ).map((dateIso) => {
                  const info = badgeMonth[dateIso]
                  return (
                    <span
                      key={`month-${dateIso}`}
                      className="badge-cell"
                      title={`${dateIso} • ${info?.badge?.displayName ?? 'No badge'} • Score ${info?.score?.toFixed(1) ?? '0.0'}`}
                      style={{ backgroundColor: info?.badge?.colorHex ?? '#e2e8f0' }}
                    >
                      {info?.badge?.icon ?? ''}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="card badge-grid-card">
              <h3>Yearly grid</h3>
              <div className="badge-grid github-grid">
                {buildRange(
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    return new Date(anchor.getFullYear(), 0, 1)
                  })(),
                  (() => {
                    const anchor = new Date(`${selectedDate}T00:00:00`)
                    return new Date(anchor.getFullYear(), 11, 31)
                  })()
                ).map((dateIso) => {
                  const info = badgeYear[dateIso]
                  return (
                    <span
                      key={`year-${dateIso}`}
                      className="badge-cell"
                      title={`${dateIso} • ${info?.badge?.displayName ?? 'No badge'} • Score ${info?.score?.toFixed(1) ?? '0.0'}`}
                      style={{ backgroundColor: info?.badge?.colorHex ?? '#e2e8f0' }}
                    >
                      {info?.badge?.icon ?? ''}
                    </span>
                  )
                })}
              </div>
            </div>

            <section className="stats-reset-row">
              <button type="button" className="danger-button" onClick={() => setShowResetModal(true)}>
                Reset app and delete all personal data
              </button>
            </section>
          </section>
        )}
      </main>

      {showResetModal ? (
        <div className="reset-modal-backdrop" role="presentation" onClick={() => setShowResetModal(false)}>
          <section className="reset-modal card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>
              <ShieldAlert size={16} /> Danger Zone
            </h3>
            <p>
              Resetting will permanently delete all personal habits, streaks, statistics, timeline history, workbook customizations,
              and local app data.
            </p>
            <label className="danger-checkbox">
              <input
                type="checkbox"
                checked={resetAcknowledged}
                onChange={(event) => setResetAcknowledged(event.target.checked)}
                disabled={resetting || exportingBackup || loading || saving}
              />
              <span>I understand this is irreversible and will delete all personal data.</span>
            </label>

            <div className="danger-actions modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={handleExport}
                disabled={exportingBackup || resetting || loading || saving}
              >
                <Download size={16} /> {exportingBackup ? 'Exporting backup…' : 'Export backup before reset'}
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={resetAppData}
                disabled={resetting || exportingBackup || loading || saving || !resetAcknowledged}
              >
                {resetting ? 'Resetting…' : 'Reset app and delete all personal data'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showOpenDayDialog && openDayTarget ? (
        <div className="reset-modal-backdrop" role="presentation" onClick={() => setShowOpenDayDialog(false)}>
          <section className="reset-modal card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>
              <TriangleAlert size={16} /> Unfinished Day Found
            </h3>
            <p>
              {openDayTarget} has progress but is still open. Continue that day or finalize it before editing other dates.
            </p>
            <div className="danger-actions modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setShowOpenDayDialog(false)
                  goToDate(openDayTarget).catch((err) => {
                    setError(err instanceof Error ? err.message : 'Failed to open day')
                  })
                }}
              >
                Continue that day
              </button>
              <button
                type="button"
                className="complete-button"
                onClick={async () => {
                  try {
                    const response = await fetch(apiUrl(`/api/day/${openDayTarget}/complete`), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    })
                    if (!response.ok) throw new Error('Failed to finalize open day')
                    setShowOpenDayDialog(false)
                    setOpenDayInProgress(null)
                    setSelectedDate(openDayTarget)
                    await refreshAnalytics(openDayTarget)
                    await loadOpenDayInProgress(todayIso())
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to finalize open day')
                  }
                }}
              >
                Finalize that day
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showSnapshotModal ? (
        <div className="reset-modal-backdrop" role="presentation" onClick={() => setShowSnapshotModal(false)}>
          <section className="reset-modal card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Day Snapshot</h3>
            <div className="snapshot-grid">
              <div>
                <h4>Done</h4>
                {snapshotDone.length ? (
                  <ul>
                    {snapshotDone.map((item) => (
                      <li key={item}>✓ {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No habits completed.</p>
                )}
              </div>
              <div>
                <h4>Not done</h4>
                {snapshotMissed.length ? (
                  <ul>
                    {snapshotMissed.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Everything completed.</p>
                )}
              </div>
            </div>
            <div className="danger-actions modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowSnapshotModal(false)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showClosePrompt ? (
        <div className="reset-modal-backdrop" role="presentation" onClick={() => setShowClosePrompt(false)}>
          <section className="reset-modal card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Save before closing?</h3>
            <p>You have unsaved changes for this day. Save before closing?</p>
            <div className="danger-actions modal-actions">
              <button type="button" className="ghost-button" onClick={() => setShowClosePrompt(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  allowCloseRef.current = true
                  window.close()
                }}
              >
                Close without saving
              </button>
              <button
                type="button"
                className="complete-button"
                onClick={async () => {
                  const ok = await saveDay()
                  if (!ok) return
                  allowCloseRef.current = true
                  window.close()
                }}
              >
                Save and close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
