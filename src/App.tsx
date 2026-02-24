import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Info, Minus, Plus, RefreshCw, Save, X } from 'lucide-react'
import './App.css'

type Tag = {
  tagId: string
  tagLabel: string
  tagColor: string
}

type Group = {
  groupId: string
  groupLabel: string
  sortOrder: number
}

type Habit = {
  habitId: string
  label: string
  type: 'toggle' | 'counter'
  groupId: string
  tags: string[]
  scorePerUnit: number
  streakMinCount: number
  minCount: number
  maxCount: number
  tooltip: string
  active: boolean
  sortOrder: number
  tagMeta: { tagId: string; tagColor: string }[]
}

type WorkbookPayload = {
  habits: Habit[]
  groups: Group[]
  tags: Tag[]
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
  }>
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

function App() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [data, setData] = useState<WorkbookPayload | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [dayLocked, setDayLocked] = useState(false)
  const [dayCompletedAt, setDayCompletedAt] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [habitHistory, setHabitHistory] = useState<HabitHistoryItem[]>([])

  const loadWorkbookData = async () => {
    const response = await fetch(apiUrl('/api/data'))
    if (!response.ok) {
      throw new Error('Failed to load workbook data')
    }

    const payload = (await response.json()) as WorkbookPayload
    setData(payload)
    return payload
  }

  const hydrateCountsForDate = async (payload: WorkbookPayload, dateIso: string) => {
    const response = await fetch(apiUrl(`/api/day/${dateIso}`))
    if (!response.ok) {
      throw new Error('Failed to load day counts')
    }

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
    if (!response.ok) {
      throw new Error('Failed to load analytics')
    }
    const payload = (await response.json()) as AnalyticsPayload
    setAnalytics(payload)
  }

  const saveDay = async () => {
    setSaving(true)
    try {
      const response = await fetch(apiUrl(`/api/day/${selectedDate}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })

      if (!response.ok) {
        throw new Error('Failed to save day data')
      }

      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)

      await refreshAnalytics(selectedDate)
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
      if (!response.ok) {
        throw new Error('Failed to complete day')
      }
      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)
      await refreshAnalytics(selectedDate)
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
      const response = await fetch(apiUrl(`/api/day/${selectedDate}/unlock`), {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to unlock day')
      }
      const body = (await response.json()) as DayPayload
      setDayLocked(body.locked)
      setDayCompletedAt(body.completedAt)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setSaving(false)
    }
  }

  const loadHabitHistory = async () => {
    try {
      const response = await fetch(apiUrl('/api/analytics/history'))
      if (!response.ok) {
        throw new Error('Failed to load habit history')
      }
      const payload = (await response.json()) as HistoryPayload
      setHabitHistory(payload.habits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch(apiUrl('/api/export/csv'))
      if (!response.ok) {
        throw new Error('Failed to export CSV')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'embers-habits-export.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const date = todayIso()
        setSelectedDate(date)
        const workbook = await (async () => {
          const response = await fetch(apiUrl('/api/data'))
          if (!response.ok) {
            throw new Error('Failed to load workbook data')
          }
          return (await response.json()) as WorkbookPayload
        })()
        setData(workbook)
        await hydrateCountsForDate(workbook, date)
        await refreshAnalytics(date)
        setError('')
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

  const habitsByGroup = useMemo(() => {
    if (!data) return [] as Array<{ group: Group; habits: Habit[] }>

    const groupMap = new Map(data.groups.map((group) => [group.groupId, group]))
    const fallbackGroup: Group = { groupId: 'other', groupLabel: 'Other', sortOrder: 9999 }
    const buckets = new Map<string, { group: Group; habits: Habit[] }>()

    for (const habit of data.habits) {
      const group = groupMap.get(habit.groupId) ?? fallbackGroup
      if (!buckets.has(group.groupId)) {
        buckets.set(group.groupId, { group, habits: [] })
      }
      buckets.get(group.groupId)?.habits.push(habit)
    }

    return [...buckets.values()]
      .map((entry) => ({
        ...entry,
        habits: entry.habits.sort((left, right) => left.sortOrder - right.sortOrder),
      }))
      .sort((left, right) => left.group.sortOrder - right.group.sortOrder)
  }, [data])

  const tagLookup = useMemo(() => {
    const map = new Map<string, Tag>()
    for (const tag of data?.tags ?? []) {
      map.set(tag.tagId, tag)
    }
    return map
  }, [data])

  const localSummary = useMemo(() => {
    if (!data) {
      return { totalScore: 0, qualifiedCount: 0, totalHabits: 0 }
    }

    let totalScore = 0
    let qualifiedCount = 0
    for (const habit of data.habits) {
      const count = counts[habit.habitId] ?? 0
      totalScore += count * habit.scorePerUnit
      if (count >= habit.streakMinCount) {
        qualifiedCount += 1
      }
    }

    return { totalScore, qualifiedCount, totalHabits: data.habits.length }
  }, [counts, data])

  const maxTimelineScore = useMemo(() => {
    const values = analytics?.timeline.map((item) => Math.abs(item.score)) ?? []
    const max = Math.max(...values, 1)
    return max <= 0 ? 1 : max
  }, [analytics])

  const isFutureDate = selectedDate > todayIso()
  const readOnlyDay = dayLocked || isFutureDate

  const setHabitCount = (habit: Habit, nextCount: number) => {
    const bounded = Math.max(habit.minCount, Math.min(habit.maxCount, nextCount))
    setCounts((previous) => ({
      ...previous,
      [habit.habitId]: habit.type === 'toggle' ? (bounded >= 1 ? 1 : 0) : bounded,
    }))
  }

  const toggleHabit = (habit: Habit) => {
    const current = counts[habit.habitId] ?? 0
    setHabitCount(habit, current >= 1 ? 0 : 1)
  }

  if (loading) {
    return <div className="screen center">Loading Embers…</div>
  }

  return (
    <div className="screen">
      <div className="app-shell">
        <header className="topbar card">
          <div>
            <h1>Embers</h1>
            <p>
              Workbook: {data?.workbookPath} • Updated: {data ? new Date(data.workbookUpdatedAt).toLocaleString() : '-'}
            </p>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setLoading(true)
                loadWorkbookData()
                  .then((payload) => {
                    if (payload) {
                      return hydrateCountsForDate(payload, selectedDate)
                    }
                    return Promise.resolve()
                  })
                  .then(() => refreshAnalytics(selectedDate))
                  .catch((err) => setError(err instanceof Error ? err.message : 'Refresh failed'))
                  .finally(() => setLoading(false))
              }}
              title="Refresh workbook data from file"
              aria-label="Refresh workbook data from file"
            >
              <RefreshCw size={16} /> Refresh workbook
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={saveDay}
              disabled={saving || readOnlyDay}
              title="Save counts for this day without completing"
              aria-label="Save counts for this day without completing"
            >
              <Save size={16} /> {saving ? 'Saving…' : 'Save day'}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={completeDay}
              disabled={saving || readOnlyDay}
              title="Complete and lock this day (prevents further edits)"
              aria-label="Complete and lock this day (prevents further edits)"
            >
              Complete day
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={unlockCurrentDay}
              disabled={saving || !dayLocked || isFutureDate}
              title="Unlock a completed day to allow editing"
              aria-label="Unlock a completed day to allow editing"
            >
              Unlock day
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                const response = await fetch(apiUrl('/api/open-workbook'), { method: 'POST' })
                if (!response.ok) setError('Unable to open workbook')
              }}
              title="Open the workbook file (embers-habits.xlsx) for editing"
              aria-label="Open the workbook file (embers-habits.xlsx) for editing"
            >
              Open workbook
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                if (!showHistory) {
                  loadHabitHistory()
                }
                setShowHistory(!showHistory)
              }}
              title={showHistory ? 'Hide habit history panel' : 'Show habit history panel'}
              aria-label={showHistory ? 'Hide habit history panel' : 'Show habit history panel'}
            >
              {showHistory ? 'Hide' : 'Show'} history
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleExport}
              title="Export habit history as CSV file for analysis"
              aria-label="Export habit history as CSV file for analysis"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </header>

        <section className="date-strip card" aria-label="Date navigation">
          <button
            type="button"
            className="counter-btn"
            onClick={() => setSelectedDate((value) => shiftDate(value, -1))}
            title="Go to previous day"
            aria-label="Go to previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <label htmlFor="date-input" className="sr-only">
            Select date
          </label>
          <input
            id="date-input"
            type="date"
            value={selectedDate}
            max={todayIso()}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="Select date for habit tracking"
            title={`Current date: ${selectedDate}`}
          />
          <button
            type="button"
            className="counter-btn"
            disabled={selectedDate >= todayIso()}
            onClick={() => setSelectedDate((value) => shiftDate(value, 1))}
            title="Go to next day (up to today)"
            aria-label="Go to next day (up to today)"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setSelectedDate(todayIso())}
            title="Jump to today"
            aria-label="Jump to today"
          >
            Today
          </button>
        </section>

        <section
          className="card lock-banner"
          role="status"
          aria-live="polite"
          aria-label={dayLocked ? 'Day is locked and read-only' : 'Day is open for editing'}
        >
          <strong>{dayLocked ? 'Day locked' : 'Day open'}</strong>
          <span>
            {dayLocked
              ? `Completed at ${dayCompletedAt ? new Date(dayCompletedAt).toLocaleString() : 'unknown time'}`
              : 'You can edit counts until you complete this day.'}
          </span>
        </section>

        {error ? (
          <div className="error-banner card" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}

        <section className="summary-grid" aria-label="Daily summary statistics">
          <article className="card summary-card">
            <h3>Daily score</h3>
            <p aria-live="polite" aria-label={`Total daily score: ${localSummary.totalScore.toFixed(1)}`}>
              {localSummary.totalScore.toFixed(1)}
            </p>
          </article>
          <article className="card summary-card">
            <h3>Streak-qualified habits</h3>
            <p aria-live="polite" aria-label={`${localSummary.qualifiedCount} out of ${localSummary.totalHabits} habits qualified for streak`}>
              {localSummary.qualifiedCount}/{localSummary.totalHabits}
            </p>
          </article>
          <article className="card summary-card">
            <h3>Global streak</h3>
            <p aria-live="polite" aria-label={`${analytics?.globalStreak ?? 0} day global streak`}>
              {analytics?.globalStreak ?? 0} days
            </p>
          </article>
        </section>

        <section className="card timeline-card">
          <h2>30-Day Timeline</h2>
          <div className="timeline-bars">
            {(analytics?.timeline ?? []).map((item) => {
              const width = `${Math.max(6, (Math.abs(item.score) / maxTimelineScore) * 100)}%`
              const positive = item.score >= 0
              return (
                <div key={item.date} className="timeline-row" title={`${item.date} • Score ${item.score.toFixed(1)}`}>
                  <span className="timeline-date">{item.date.slice(5)}</span>
                  <div className="timeline-track">
                    <div
                      className={`timeline-fill ${positive ? 'is-positive' : 'is-negative'}`}
                      style={{ width }}
                    />
                  </div>
                  <span className="timeline-score">{item.score.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
        </section>

        {showHistory && (
          <section className="card history-panel">
            <div className="history-header">
              <h2>Habit History</h2>
              <button
                type="button"
                className="counter-btn"
                onClick={() => setShowHistory(false)}
                title="Close history view"
              >
                <X size={16} />
              </button>
            </div>
            <div className="history-habits">
              {habitHistory.map((habit) => (
                <article key={habit.habitId} className="history-habit">
                  <div className="history-habit-header">
                    <h3>{habit.label}</h3>
                    <div className="history-stats">
                      <span title="Total count/occurrences">Count: {habit.totalCount}</span>
                      <span title="Total score earned">Score: {habit.totalScore.toFixed(1)}</span>
                      <span title="Days with at least one count">Active: {habit.daysActive}</span>
                    </div>
                  </div>
                  <div className="history-records">
                    {habit.dailyRecords.slice(-30).map((record) => (
                      <div
                        key={record.date}
                        className={`history-day ${record.qualified ? 'qualified' : 'not-qualified'}`}
                        title={`${record.date} • Count: ${record.count} • Score: ${record.score.toFixed(1)} • ${record.qualified ? 'Qualified' : 'Not qualified'}`}
                      >
                        <span className="day-date">{record.date.slice(5)}</span>
                        <span className="day-count">{record.count}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <main className="groups-grid">
          {habitsByGroup.map((entry) => (
            <section key={entry.group.groupId} className="card group-card">
              <h2>{entry.group.groupLabel}</h2>
              <div className="habits-list">
                {entry.habits.map((habit) => {
                  const count = counts[habit.habitId] ?? 0
                  const qualified = count >= habit.streakMinCount
                  const score = count * habit.scorePerUnit
                  const streak = analytics?.perHabit.find((item) => item.habitId === habit.habitId)?.currentStreak ?? 0

                  return (
                    <article key={habit.habitId} className="habit-card">
                      <div className="habit-head">
                        <div className="habit-title-row">
                          <h3>{habit.label}</h3>
                          {habit.tooltip ? (
                            <span className="info-pill" title={habit.tooltip} aria-label={habit.tooltip}>
                              <Info size={14} />
                            </span>
                          ) : null}
                        </div>
                        <div className="habit-meta">
                          {habit.tags.map((tagId) => {
                            const tag = tagLookup.get(tagId)
                            return (
                              <span
                                key={tagId}
                                className="tag-pill"
                                style={{ backgroundColor: tag?.tagColor ?? '#94a3b8' }}
                                title={tag?.tagLabel ?? tagId}
                              >
                                {tag?.tagLabel ?? tagId}
                              </span>
                            )
                          })}
                        </div>
                      </div>

                      <div className="habit-controls">
                        {habit.type === 'toggle' ? (
                          <button
                            type="button"
                            className={`toggle-button ${count >= 1 ? 'is-on' : 'is-off'}`}
                            onClick={() => toggleHabit(habit)}
                            disabled={readOnlyDay}
                            aria-label={`${habit.label}: ${count >= 1 ? 'Done' : 'Not done'} (click to toggle)`}
                          >
                            {count >= 1 ? 'Done' : 'Not done'}
                          </button>
                        ) : (
                          <div className="counter-wrap" role="group" aria-label={`${habit.label} counter: ${count}`}>
                            <button
                              type="button"
                              className="counter-btn"
                              onClick={() => setHabitCount(habit, count - 1)}
                              disabled={readOnlyDay}
                              aria-label={`Decrease ${habit.label}`}
                              title={`Decrease ${habit.label} from ${count}`}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="counter-value" aria-live="polite" aria-atomic="true">
                              {count}
                            </span>
                            <button
                              type="button"
                              className="counter-btn"
                              onClick={() => setHabitCount(habit, count + 1)}
                              disabled={readOnlyDay}
                              aria-label={`Increase ${habit.label}`}
                              title={`Increase ${habit.label} from ${count}`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      <footer className="habit-foot">
                        <span>Score: {score.toFixed(1)}</span>
                        <span className={qualified ? 'qualified yes' : 'qualified no'}>
                          {qualified ? 'Streak qualified' : `Need ${habit.streakMinCount}+`}
                        </span>
                        <span className="streak-chip">🔥 {streak}</span>
                      </footer>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}

export default App
