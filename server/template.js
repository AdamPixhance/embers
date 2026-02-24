import ExcelJS from 'exceljs'
import fs from 'node:fs/promises'
import { DATA_DIR, DAY_LOG_PATH, IMAGES_DIR, PROJECTS_PATH, WORKBOOK_PATH } from './constants.js'

const HABIT_HEADERS = [
  'habit_id',
  'label',
  'type',
  'group_id',
  'polarity',
  'score_per_unit',
  'streak_min_count',
  'min_count',
  'max_count',
  'tooltip',
  'active',
  'sort_order',
  'schedule_type',
  'schedule_days',
  'active_from',
  'inactive_from',
]

const GROUP_HEADERS = ['group_id', 'group_label', 'sort_order']
const BADGE_HEADERS = ['badge_id', 'display_name', 'icon', 'color_hex', 'min_score', 'sort_order', 'active']
const SCHEDULE_HEADERS = ['schedule_type', 'description', 'uses_schedule_days']
const SCHEDULE_DAYS_HEADERS = ['day_abbr', 'day_name']

const sampleHabits = [
  // Health & Fitness
  ['wake_on_time', 'Wake up on time', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Out of bed by your target time.', 1, 10, 'daily', '', '', ''],
  ['sleep_7h', 'Sleep 7+ hours', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Track a full night of sleep.', 1, 20, 'daily', '', '', ''],
  ['hydrate', 'Drink water (glasses)', 'counter', 'health', 'good', 0.5, 6, 0, 14, 'Track daily glasses of water.', 1, 30, 'daily', '', '', ''],
  ['steps', 'Walk 7k+ steps', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Aim for movement throughout the day.', 1, 40, 'daily', '', '', ''],
  ['strength', 'Strength training', 'toggle', 'health', 'good', 3, 1, 0, 1, 'Any meaningful resistance work.', 1, 50, 'custom', 'Mon, Wed, Fri', '', ''],
  ['cardio', 'Cardio session', 'toggle', 'health', 'good', 3, 1, 0, 1, 'Run, bike, swim - 20+ minutes.', 1, 60, 'custom', 'Tue, Thu, Sat', '', ''],
  ['meal_prep', 'Meal prep', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Prepare healthy meals for the day/week.', 1, 70, 'weekends', '', '', ''],
  ['veggies', 'Eat vegetables (servings)', 'counter', 'health', 'good', 0.5, 3, 0, 8, 'Track vegetable servings.', 1, 80, 'daily', '', '', ''],
  ['protein', 'Protein intake', 'toggle', 'health', 'good', 1, 1, 0, 1, 'Hit protein target for the day.', 1, 90, 'daily', '', '', ''],
  ['vitamins', 'Take vitamins/supplements', 'toggle', 'health', 'good', 1, 1, 0, 1, 'Daily supplement routine.', 1, 100, 'daily', '', '', ''],
  ['stretch', 'Stretch or mobility', 'toggle', 'recovery', 'good', 1, 1, 0, 1, '5-10 minutes of mobility work.', 1, 110, 'daily', '', '', ''],
  ['posture_check', 'Posture breaks', 'counter', 'health', 'good', 0.5, 3, 0, 10, 'Stand, stretch, reset posture.', 1, 120, 'weekdays', '', '', ''],
  
  // Focus & Productivity
  ['deep_work_blocks', 'Deep work blocks (50m)', 'counter', 'focus', 'good', 3, 2, 0, 8, 'One block = 50 minutes uninterrupted work.', 1, 130, 'weekdays', '', '', ''],
  ['priority_list', 'Daily priority list', 'toggle', 'focus', 'good', 2, 1, 0, 1, 'Top 3 priorities for the day.', 1, 140, 'daily', '', '', ''],
  ['inbox_zero', 'Clear inbox', 'toggle', 'focus', 'good', 1, 1, 0, 1, 'Process all emails to zero.', 1, 150, 'weekdays', '', '', ''],
  ['time_blocked', 'Time-block calendar', 'toggle', 'focus', 'good', 1.5, 1, 0, 1, 'Schedule blocks for key tasks.', 1, 160, 'daily', '', '', ''],
  ['no_meetings_morning', 'Protected morning', 'toggle', 'focus', 'good', 2, 1, 0, 1, 'No meetings before 11am.', 1, 170, 'weekdays', '', '', ''],
  ['single_task', 'Single-tasking', 'toggle', 'focus', 'good', 2, 1, 0, 1, 'No multitasking during work blocks.', 1, 180, 'weekdays', '', '', ''],
  ['weekly_review', 'Weekly review', 'toggle', 'focus', 'good', 3, 1, 0, 1, 'Reflect and plan for the week ahead.', 1, 190, 'custom', 'Sun', '', ''],
  
  // Mind & Learning
  ['reading', 'Reading (minutes)', 'counter', 'mind', 'good', 0.1, 20, 0, 120, 'Minutes of focused reading.', 1, 200, 'daily', '', '', ''],
  ['learn', 'Learn something new', 'toggle', 'mind', 'good', 2, 1, 0, 1, 'Course, tutorial, or deliberate practice.', 1, 210, 'weekdays', '', '', ''],
  ['journal', 'Journal', 'toggle', 'mind', 'good', 1.5, 1, 0, 1, 'Reflection, gratitude, or planning.', 1, 220, 'daily', '', '', ''],
  ['meditate', 'Meditation', 'counter', 'mind', 'good', 0.2, 10, 0, 60, 'Minutes of meditation or breathwork.', 1, 230, 'daily', '', '', ''],
  ['creative_work', 'Creative project', 'toggle', 'mind', 'good', 2, 1, 0, 1, 'Writing, art, music, or side project.', 1, 240, 'custom', 'Tue, Thu, Sat', '', ''],
  ['podcast_learning', 'Educational podcast', 'toggle', 'mind', 'good', 1, 1, 0, 1, 'Listen while commuting or exercising.', 1, 250, 'custom', 'Mon, Wed, Fri', '', ''],
  
  // Recovery & Self-Care
  ['outside_light', 'Sunlight or outdoor time', 'toggle', 'recovery', 'good', 1, 1, 0, 1, 'Step outside for 10+ minutes.', 1, 260, 'daily', '', '', ''],
  ['evening_routine', 'Evening wind-down', 'toggle', 'recovery', 'good', 1.5, 1, 0, 1, 'Consistent pre-bed routine.', 1, 270, 'daily', '', '', ''],
  ['phone_off_early', 'Phone off by 9pm', 'toggle', 'recovery', 'good', 1.5, 1, 0, 1, 'No screens before bedtime.', 1, 280, 'daily', '', '', ''],
  ['sauna_cold', 'Sauna or cold exposure', 'toggle', 'recovery', 'good', 2, 1, 0, 1, 'Heat or cold therapy for recovery.', 1, 290, 'weekends', '', '', ''],
  ['massage_physio', 'Massage or physio', 'toggle', 'recovery', 'good', 2, 1, 0, 1, 'Professional recovery session.', 1, 300, 'custom', 'Sat', '', ''],
  
  // Home & Environment
  ['tidy_space', 'Tidy one space', 'toggle', 'home', 'good', 1, 1, 0, 1, 'Reset a surface or room.', 1, 310, 'daily', '', '', ''],
  ['laundry', 'Laundry', 'toggle', 'home', 'good', 1, 1, 0, 1, 'Wash, dry, fold, put away.', 1, 320, 'weekends', '', '', ''],
  ['dishes_done', 'Clean dishes', 'toggle', 'home', 'good', 0.5, 1, 0, 1, 'Kitchen sink empty.', 1, 330, 'daily', '', '', ''],
  ['bed_made', 'Make bed', 'toggle', 'home', 'good', 0.5, 1, 0, 1, 'First thing in the morning.', 1, 340, 'daily', '', '', ''],
  ['deep_clean', 'Deep clean one area', 'toggle', 'home', 'good', 2, 1, 0, 1, 'Thorough cleaning of one space.', 1, 350, 'weekends', '', '', ''],
  
  // Social & Relationships
  ['connect', 'Reach out to someone', 'toggle', 'social', 'good', 1, 1, 0, 1, 'Message or call a friend/family.', 1, 360, 'custom', 'Mon, Wed, Fri', '', ''],
  ['quality_time', 'Quality time with loved ones', 'toggle', 'social', 'good', 2, 1, 0, 1, 'Intentional time together.', 1, 370, 'daily', '', '', ''],
  ['date_night', 'Date night', 'toggle', 'social', 'good', 3, 1, 0, 1, 'Dedicated time with partner.', 1, 380, 'custom', 'Sat', '', ''],
  ['gratitude_express', 'Express gratitude', 'toggle', 'social', 'good', 1, 1, 0, 1, 'Thank someone or acknowledge their effort.', 1, 390, 'daily', '', '', ''],
  ['volunteer', 'Volunteer or help others', 'toggle', 'social', 'good', 2, 1, 0, 1, 'Give back to community.', 1, 400, 'weekends', '', '', ''],
  
  // Finance & Career
  ['budget_check', 'Review spending', 'toggle', 'finance', 'good', 1.5, 1, 0, 1, 'Quick glance at budget or expenses.', 1, 410, 'weekends', '', '', ''],
  ['save_invest', 'Save or invest', 'toggle', 'finance', 'good', 2, 1, 0, 1, 'Transfer to savings or investments.', 1, 420, 'custom', 'Fri', '', ''],
  ['career_dev', 'Career development', 'toggle', 'career', 'good', 2, 1, 0, 1, 'Networking, courses, skill building.', 1, 430, 'weekdays', '', '', ''],
  ['portfolio_update', 'Update portfolio/resume', 'toggle', 'career', 'good', 2, 1, 0, 1, 'Document achievements and projects.', 1, 440, 'custom', 'Sun', '', ''],
  
  // Bad Habits to Reduce
  ['late_scrolling', 'Late-night scrolling', 'toggle', 'recovery', 'bad', -2, 0, 0, 1, 'Avoid phone after bedtime.', 1, 450, 'daily', '', '', ''],
  ['sugar_snacks', 'Sugary snacks/drinks', 'counter', 'health', 'bad', -1, 0, 0, 8, 'Track how often you reach for sugar.', 1, 460, 'daily', '', '', ''],
  ['missed_meal', 'Skipped a meal', 'toggle', 'health', 'bad', -1.5, 0, 0, 1, 'Avoid long gaps without food.', 1, 470, 'daily', '', '', ''],
  ['distracted_blocks', 'Distracted work blocks', 'counter', 'focus', 'bad', -1.5, 0, 0, 6, 'Track unplanned distractions during work.', 1, 480, 'weekdays', '', '', ''],
  ['clutter_pile', 'Left clutter unresolved', 'toggle', 'home', 'bad', -0.5, 0, 0, 1, 'Put things back after use.', 1, 490, 'daily', '', '', ''],
  ['fast_food', 'Fast food or takeout', 'counter', 'health', 'bad', -1, 0, 0, 5, 'Try to minimize convenience foods.', 1, 500, 'daily', '', '', ''],
  ['missed_workout', 'Missed planned workout', 'toggle', 'health', 'bad', -2, 0, 0, 1, 'Workout was scheduled but skipped.', 1, 510, 'weekdays', '', '', ''],
  ['social_media_binge', 'Social media binge', 'counter', 'focus', 'bad', -1, 0, 0, 10, 'Track mindless scrolling sessions (15m+ each).', 1, 520, 'daily', '', '', ''],
  ['caffeine_late', 'Caffeine after 2pm', 'counter', 'recovery', 'bad', -1, 0, 0, 5, 'Affects sleep quality.', 1, 530, 'daily', '', '', ''],
  ['procrastination', 'Procrastinated on priority', 'toggle', 'focus', 'bad', -2, 0, 0, 1, 'Avoided important task.', 1, 540, 'weekdays', '', '', ''],
  ['stayed_up_late', 'Stayed up past bedtime', 'toggle', 'recovery', 'bad', -2, 0, 0, 1, 'Bedtime was missed by 30+ minutes.', 1, 550, 'daily', '', '', ''],
  ['snapped_at_someone', 'Snapped or argued', 'toggle', 'social', 'bad', -1.5, 0, 0, 1, 'Lost patience with someone.', 1, 560, 'daily', '', '', ''],
  ['impulse_purchase', 'Impulse purchase', 'counter', 'finance', 'bad', -1.5, 0, 0, 5, 'Unplanned non-essential purchase.', 1, 570, 'daily', '', '', ''],
]

const sampleGroups = [
  ['health', 'Health', 1],
  ['focus', 'Focus', 2],
  ['mind', 'Mind', 3],
  ['recovery', 'Recovery', 4],
  ['home', 'Home', 5],
  ['social', 'Social', 6],
  ['finance', 'Finance', 7],
  ['career', 'Career', 8],
]

const sampleBadges = [
  ['crash', 'Crash Day', '💥', '#b91c1c', -40, 1, 1],
  ['rough', 'Rough Day', '⚠️', '#f97316', -15, 2, 1],
  ['struggling', 'Struggling Day', '😓', '#fb923c', 0, 3, 1],
  ['ok', 'OK Day', '⚪', '#94a3b8', 15, 4, 1],
  ['solid', 'Solid Day', '🟢', '#22c55e', 20, 5, 1],
  ['great', 'Great Day', '🏆', '#16a34a', 40, 6, 1],
  ['elite', 'Elite Day', '💎', '#2563eb', 70, 7, 1],
]



const sampleSchedules = [
  ['daily', 'Every day', 0],
  ['weekdays', 'Monday to Friday', 0],
  ['weekends', 'Saturday and Sunday', 0],
  ['custom', 'Specific days listed in schedule_days', 1],
]

const sampleScheduleDays = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
]

function normalizeHexColor(hex) {
  const raw = String(hex ?? '').trim().replace('#', '')
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `FF${raw.toUpperCase()}`
  return 'FF94A3B8'
}

// Removed all styling functions - using zero-formatting approach

export async function ensureWorkbookTemplate() {
  try {
    await fs.access(WORKBOOK_PATH)
    return false
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const workbook = new ExcelJS.Workbook()

    // Minimal workbook with zero formatting
    
    // Instructions sheet - plain text only
    const instructions = workbook.addWorksheet('Instructions')
    instructions.getCell('A1').value = 'Embers Workbook Template'

    const lines = [
      'Daily workflow intent (from Embers v0.1):',
      '1) Open app and focus only on today.',
      '2) Log habit values.',
      '3) Complete day to lock it.',
      '4) If a previous day remains open, finish it before editing others.',
      '',
      'Workbook notes:',
      '- Habits.polarity: good or bad (drives left/right split in Day view).',
      '- score_per_unit: positive for good habits, usually negative for bad habits.',
      '- Badges sheet uses PERCENTAGE-BASED scoring (% of max possible daily score).',
      '- schedule_type controls when a habit appears (daily, weekdays, weekends, custom).',
      '- schedule_days uses comma-separated abbreviations like Mon, Wed, Fri when schedule_type=custom.',
      '- Focus mode hides navigation and keeps only today visible (no workbook edits needed).',
      '',
      'Date Requirements:',
      '- When active=1: active_from should contain the date it was activated (YYYY-MM-DD).',
      '- When active=0: inactive_from should contain the date it was deactivated (YYYY-MM-DD).',
      '- Default state: new habits start with active=1 and active_from set to creation date.',
      '- When you change active from 1 to 0: manually set inactive_from to today\'s date.',
      '- When you change active from 0 to 1: manually set active_from to today\'s date.',
      '',
      'Column Explanations:',
      '- habit_id: stable identifier used in saved day history (do not change after creation)',
      '- type: toggle (0/1) or counter (multiple values)',
      '- polarity: good (positive side) or bad (negative side)',
      '- score_per_unit: points earned/lost per unit (positive rewards, negative penalizes)',
      '- streak_min_count: daily threshold required to qualify for streak',
      '- active: 0=hidden, 1=visible in app',
      '- schedule_type: see Schedule Options sheet for valid types',
      '- schedule_days: comma-separated days (Mon, Tue, etc.) when schedule_type=custom',
      '- active_from/inactive_from: YYYY-MM-DD date ranges (see Date Requirements above)',
      '',
      'Badge Scoring (Percentage-Based):',
      '- Crash Day (<-40%): Significantly below zero',
      '- Rough Day (-40% to -15%): Below expectations',
      '- Struggling Day (-15% to 0%): Slightly negative',
      '- OK Day (0% to 20%): Minimal progress',
      '- Solid Day (20% to 40%): Good progress',
      '- Great Day (40% to 70%): Strong performance',
      '- Elite Day (>70%): Exceptional day',
      '- Percentage is calculated as: (actual score / max possible score for active habits) × 100',
    ]

    lines.forEach((line, index) => {
      instructions.getCell(`A${index + 3}`).value = line
    })

    instructions.getColumn(1).width = 80

    // Habits sheet
    const habits = workbook.addWorksheet('Habits')
    habits.addRow(HABIT_HEADERS)
    sampleHabits.forEach((row) => habits.addRow(row))
    habits.views = [{ state: 'frozen', ySplit: 1 }]

    // Groups sheet
    const groups = workbook.addWorksheet('Groups')
    groups.addRow(GROUP_HEADERS)
    sampleGroups.forEach((row) => groups.addRow(row))
    groups.views = [{ state: 'frozen', ySplit: 1 }]

    // Badges sheet
    const badges = workbook.addWorksheet('Badges')
    badges.addRow(BADGE_HEADERS)
    sampleBadges.forEach((row) => badges.addRow(row))
    badges.views = [{ state: 'frozen', ySplit: 1 }]

    // Schedule Options sheet
    const schedules = workbook.addWorksheet('Schedule Options')
    schedules.addRow(SCHEDULE_HEADERS)
    sampleSchedules.forEach((row) => schedules.addRow(row))
    schedules.views = [{ state: 'frozen', ySplit: 1 }]

    // Schedule Days sheet
    const scheduleDays = workbook.addWorksheet('Schedule Days')
    scheduleDays.addRow(SCHEDULE_DAYS_HEADERS)
    sampleScheduleDays.forEach((row) => scheduleDays.addRow(row))
    scheduleDays.views = [{ state: 'frozen', ySplit: 1 }]

    await workbook.xlsx.writeFile(WORKBOOK_PATH)
    return true
  }
}

export async function resetAllAppData() {
  await fs.mkdir(DATA_DIR, { recursive: true })

  const targets = [WORKBOOK_PATH, DAY_LOG_PATH, PROJECTS_PATH]
  for (const target of targets) {
    await fs.rm(target, { force: true })
  }

  await fs.rm(IMAGES_DIR, { recursive: true, force: true })
  await fs.mkdir(IMAGES_DIR, { recursive: true })

  await ensureWorkbookTemplate()

  return {
    workbookPath: WORKBOOK_PATH,
    resetAt: new Date().toISOString(),
  }
}
