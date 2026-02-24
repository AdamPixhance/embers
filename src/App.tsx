import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Home,
  Info,
  LockOpen,
  Minus,
  Plus,
  RefreshCw,
  Save,
} from 'lucide-react'
import './App.css'

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

type HabitHistoryItem = {
  habitId: string
  label: string
  type: 'toggle' | 'counter'
  scorePerUnit: number
  streakMinCount: number
  totalCount: number
  totalScore: number
  daysActive: number
  dailyRecords: Array<{
    date: string
    count: number
    qualified: boolean
    score: number
  }>
}

type HistoryPayload = {
  habits: HabitHistoryItem[]
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

const desktopApiBase =
  typeof window !== 'undefined' && 'embersApiBase' in window
    ? String((window as Window & { embersApiBase?: string }).embersApiBase ?? '')
    : ''

const apiUrl = (path: string) => `${desktopApiBase}${path}`
const todayIso = () => new Date().toISOString().slice(0, 10)

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
  const [habitHistory, setHabitHistory] = useState<HabitHistoryItem[]>([])
  const [resetting, setResetting] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [resetAcknowledged, setResetAcknowledged] = useState(false)
  const [openDayInProgress, setOpenDayInProgress] = useState<string | null>(null)

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
  }

  const refreshAnalytics = async (dateIso: string) => {
    const response = await fetch(apiUrl(`/api/analytics?date=${encodeURIComponent(dateIso)}`))
    if (!response.ok) throw new Error('Failed to load analytics')
    const payload = (await response.json()) as AnalyticsPayload
    setAnalytics(payload)
  }

  const loadHabitHistory = async () => {
    const response = await fetch(apiUrl('/api/analytics/history'))
    if (!response.ok) throw new Error('Failed to load habit history')
    const payload = (await response.json()) as HistoryPayload
    setHabitHistory(payload.habits)
  }

  const goToDate = async (nextDate: string) => {
    const openDay = await loadOpenDayInProgress(todayIso())
    if (openDay && openDay !== nextDate) {
      setError(`You have an open day in progress (${openDay}). Complete it before editing another day.`)
      setSelectedDate(openDay)
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
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
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
    const firstConfirmation = window.confirm(
      '⚠️ DANGER: This will permanently delete all your personal habits, daily logs, streaks, timeline history, and local app data.\n\nThis cannot be undone.\n\nDo you want to continue?'
    )
    if (!firstConfirmation) return

    const secondConfirmation = window.prompt(
      'Final confirmation required.\n\nType exactly: DELETE ALL DATA\n\nThis will reset the app to default placeholders.'
    )
    if (secondConfirmation !== 'DELETE ALL DATA') {
      setError('Reset cancelled. Confirmation phrase did not match.')
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
      setHabitHistory([])
      const workbook = await loadWorkbookData()
      await hydrateCountsForDate(workbook, date)
      await refreshAnalytics(date)
      await loadOpenDayInProgress(date)
      setResetAcknowledged(false)
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
          setError(`You have a day in progress from ${openDay}. Complete it before editing another day.`)
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
    loadHabitHistory().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    })
  }, [view])

  const groupedByPolarity = useMemo(() => {
    const map = new Map<string, { group: Group; good: Habit[]; bad: Habit[] }>()
    const groupMap = new Map((data?.groups ?? []).map((group) => [group.groupId, group]))
    const fallbackGroup: Group = { groupId: 'other', groupLabel: 'Other', sortOrder: 9999 }

    for (const habit of data?.habits ?? []) {
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
      .sort((left, right) => left.group.sortOrder - right.group.sortOrder)
  }, [data])

  const progressModel = useMemo(() => {
    if (!data) return { score: 0, min: 0, max: 1, percent: 50 }

    let min = 0
    let max = 0
    let score = 0

    for (const habit of data.habits) {
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
  }, [data, counts])

  const setHabitCount = (habit: Habit, nextCount: number) => {
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

  if (loading) {
    return <div className="screen center">Loading Embers…</div>
  }

  const dayHeading = formatDayHeading(selectedDate)
  const readOnlyDay = dayLocked || selectedDate > todayIso()

  return (
    <div className="screen ember-root">
      <aside className="side-nav card" aria-label="Main navigation">
        <div className="brand-block">
          <h1>Embers</h1>
        </div>

        <button
          type="button"
          className={`nav-item ${view === 'day' ? 'active' : ''}`}
          onClick={() => setView('day')}
          title="Day view"
        >
          <Home size={17} /> Day
        </button>
        <button
          type="button"
          className={`nav-item ${view === 'stats' ? 'active' : ''}`}
          onClick={() => setView('stats')}
          title="Stats"
        >
          <BarChart3 size={17} /> Stats
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
          <RefreshCw size={17} /> Refresh
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
          <FolderOpen size={17} /> Workbook
        </button>

        <button
          type="button"
          className="nav-item"
          onClick={handleExport}
          disabled={exportingBackup || resetting || loading || saving}
          title="Export CSV"
        >
          <Download size={17} /> Export
        </button>
      </aside>

      <main className="main-panel">
        <header className="day-header card">
          <div className="day-header-left">
            <button
              type="button"
              className="primary-button"
              onClick={saveDay}
              disabled={saving || readOnlyDay}
            >
              <Save size={16} /> {saving ? 'Saving…' : 'Save day'}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={completeDay}
              disabled={saving || readOnlyDay}
            >
              Complete day
            </button>

            <button
              type="button"
              className="ghost-button"
              onClick={unlockCurrentDay}
              disabled={saving || !dayLocked || selectedDate > todayIso()}
            >
              <LockOpen size={16} /> Unlock day
            </button>
          </div>

          <div className="day-header-center">
            <h2>{dayHeading.dayName}</h2>
            <p>{dayHeading.fullDate}</p>
            <div className="score-line">
              <div className="score-value">Score {progressModel.score.toFixed(1)}</div>
              <div className="score-bar-wrap">
                <div className="score-bar-fill" style={{ width: `${progressModel.percent}%` }} />
              </div>
            </div>
            {analytics?.dailyBadge ? (
              <div className="badge-pill" style={{ backgroundColor: analytics.dailyBadge.colorHex }}>
                <span>{analytics.dailyBadge.icon}</span>
                <span>{analytics.dailyBadge.displayName}</span>
              </div>
            ) : null}
          </div>

          <div className="day-header-right">
            <div className="date-nav-inline">
              <button type="button" className="counter-btn" onClick={() => goToDate(shiftDate(selectedDate, -1))}>
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="counter-btn"
                disabled={selectedDate >= todayIso()}
                onClick={() => goToDate(shiftDate(selectedDate, 1))}
              >
                <ChevronRight size={16} />
              </button>
              <button type="button" className="ghost-button" onClick={() => goToDate(todayIso())}>
                <CalendarDays size={15} /> Today
              </button>
              <input
                type="date"
                value={selectedDate}
                max={todayIso()}
                onChange={(event) => {
                  goToDate(event.target.value).catch((err) => {
                    setError(err instanceof Error ? err.message : 'Date change failed')
                  })
                }}
              />
            </div>

            <div className={`day-state ${dayLocked ? 'locked' : 'open'}`}>
              {dayLocked
                ? `Locked${dayCompletedAt ? ` • ${new Date(dayCompletedAt).toLocaleString()}` : ''}`
                : 'Open day'}
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
                goToDate(openDayInProgress).catch((err) => {
                  setError(err instanceof Error ? err.message : 'Failed to open in-progress day')
                })
              }}
            >
              Go to open day
            </button>
          </section>
        ) : null}

        {error ? (
          <div className="error-banner card" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}

        {view === 'day' ? (
          <section className="day-grid">
            <article className="card polarity-column bad-column">
              <h3>Bad habits to break</h3>
              {groupedByPolarity.map((entry) => (
                <div key={`bad-${entry.group.groupId}`} className="group-block">
                  <h4>{entry.group.groupLabel}</h4>
                  <div className="habit-stack">
                    {entry.bad.length === 0 ? <p className="empty-hint">No bad habits in this group.</p> : null}
                    {entry.bad.map((habit) => {
                      const score = (counts[habit.habitId] ?? 0) * habit.scorePerUnit
                      return (
                        <div key={habit.habitId} className="habit-item habit-bad">
                          <div>
                            <div className="habit-title-row">
                              <h5>{habit.label}</h5>
                              {habit.tooltip ? (
                                <span className="info-pill" title={habit.tooltip}>
                                  <Info size={13} />
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
                </div>
              ))}
            </article>

            <article className="card polarity-column good-column">
              <h3>Good habits to build</h3>
              {groupedByPolarity.map((entry) => (
                <div key={`good-${entry.group.groupId}`} className="group-block">
                  <h4>{entry.group.groupLabel}</h4>
                  <div className="habit-stack">
                    {entry.good.length === 0 ? <p className="empty-hint">No good habits in this group.</p> : null}
                    {entry.good.map((habit) => {
                      const score = (counts[habit.habitId] ?? 0) * habit.scorePerUnit
                      return (
                        <div key={habit.habitId} className="habit-item habit-good">
                          <div>
                            <div className="habit-title-row">
                              <h5>{habit.label}</h5>
                              {habit.tooltip ? (
                                <span className="info-pill" title={habit.tooltip}>
                                  <Info size={13} />
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
                </div>
              ))}
            </article>
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
            </div>

            <div className="card badge-grid-card">
              <h3>Badge timeline</h3>
              <div className="badge-grid">
                {(analytics?.badgeTimeline ?? []).map((item) => (
                  <div
                    key={item.date}
                    className="badge-cell"
                    title={`${item.date} • Score ${item.score.toFixed(1)} • ${item.badge?.displayName ?? 'No badge'}`}
                    style={{ backgroundColor: item.badge?.colorHex ?? '#e2e8f0' }}
                  >
                    <span>{item.badge?.icon ?? '•'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card timeline-card">
              <h3>Recent score trend</h3>
              <div className="timeline-bars">
                {(analytics?.timeline ?? []).map((item) => {
                  const width = `${Math.max(6, (Math.abs(item.score) / Math.max(1, Math.abs(progressModel.max))) * 100)}%`
                  const positive = item.score >= 0
                  return (
                    <div key={item.date} className="timeline-row" title={`${item.date} • Score ${item.score.toFixed(1)}`}>
                      <span className="timeline-date">{item.date.slice(5)}</span>
                      <div className="timeline-track">
                        <div className={`timeline-fill ${positive ? 'is-positive' : 'is-negative'}`} style={{ width }} />
                      </div>
                      <span className="timeline-score">{item.score.toFixed(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card history-panel">
              <h3>Per-habit streaks & totals</h3>
              <div className="history-habits">
                {habitHistory.map((habit) => {
                  const streak = analytics?.perHabit.find((item) => item.habitId === habit.habitId)?.currentStreak ?? 0
                  return (
                    <article key={habit.habitId} className="history-habit">
                      <div className="history-habit-header">
                        <h4>{habit.label}</h4>
                        <div className="history-stats">
                          <span>Streak: {streak}</span>
                          <span>Total: {habit.totalCount}</span>
                          <span>Score: {habit.totalScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <section className="card danger-zone" aria-label="Danger zone">
          <div>
            <h2>Danger Zone</h2>
            <p>
              Resetting will permanently delete all personal habits, streaks, statistics, timeline history, workbook customizations,
              and local app data. This action is irreversible.
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
          </div>
          <div className="danger-actions">
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
      </main>
    </div>
  )
}

export default App
