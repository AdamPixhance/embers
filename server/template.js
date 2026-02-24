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
const CATEGORY_HEADERS = ['category', 'default_score_per_unit', 'meaning', 'example_use_case']
const SCHEDULE_HEADERS = ['schedule_type', 'description', 'uses_schedule_days']
const SCHEDULE_DAYS_HEADERS = ['day_abbr', 'day_name']

const sampleHabits = [
  ['wake_on_time', 'Wake up on time', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Out of bed by your target time.', 1, 10, 'daily', '', '', ''],
  ['sleep_7h', 'Sleep 7+ hours', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Track a full night of sleep.', 1, 20, 'daily', '', '', ''],
  ['hydrate', 'Drink water (glasses)', 'counter', 'health', 'good', 0.5, 6, 0, 14, 'Track daily glasses of water.', 1, 30, 'daily', '', '', ''],
  ['steps', 'Walk 7k+ steps', 'toggle', 'health', 'good', 2, 1, 0, 1, 'Aim for movement throughout the day.', 1, 40, 'daily', '', '', ''],
  ['stretch', 'Stretch or mobility', 'toggle', 'recovery', 'good', 1, 1, 0, 1, '5-10 minutes of mobility.', 1, 50, 'daily', '', '', ''],
  ['strength', 'Strength training', 'toggle', 'health', 'good', 3, 1, 0, 1, 'Any meaningful resistance work.', 1, 60, 'weekdays', '', '', ''],
  ['deep_work_blocks', 'Deep work blocks (50m)', 'counter', 'focus', 'good', 3, 2, 0, 8, 'One block = 50 minutes uninterrupted work.', 1, 70, 'weekdays', '', '', ''],
  ['priority_list', 'Daily priority list', 'toggle', 'focus', 'good', 2, 1, 0, 1, 'Top 3 priorities for the day.', 1, 80, 'daily', '', '', ''],
  ['reading', 'Reading', 'counter', 'mind', 'good', 1, 20, 0, 120, 'Minutes of focused reading.', 1, 90, 'daily', '', '', ''],
  ['learn', 'Learn something new', 'toggle', 'mind', 'good', 2, 1, 0, 1, 'Course, tutorial, or deliberate practice.', 1, 100, 'weekdays', '', '', ''],
  ['journal', 'Journal', 'toggle', 'mind', 'good', 1.5, 1, 0, 1, 'Quick reflection or gratitude.', 1, 110, 'daily', '', '', ''],
  ['outside_light', 'Sunlight or outdoor time', 'toggle', 'recovery', 'good', 1, 1, 0, 1, 'Step outside for 10+ minutes.', 1, 120, 'daily', '', '', ''],
  ['tidy_space', 'Tidy one space', 'toggle', 'home', 'good', 1, 1, 0, 1, 'Reset a surface or room.', 1, 130, 'daily', '', '', ''],
  ['connect', 'Reach out to someone', 'toggle', 'social', 'good', 1, 1, 0, 1, 'Message or call a friend/family.', 1, 140, 'custom', 'Mon, Wed, Fri', '', ''],
  ['budget_check', 'Check spending', 'toggle', 'finance', 'good', 1.5, 1, 0, 1, 'Quick glance at budget or expenses.', 1, 150, 'weekends', '', '', ''],
  ['late_scrolling', 'Late-night scrolling', 'toggle', 'recovery', 'bad', -2, 0, 0, 1, 'Avoid after your bedtime.', 1, 160, 'daily', '', '', ''],
  ['sugar_snacks', 'Sugary snacks/drinks', 'counter', 'health', 'bad', -1.5, 0, 0, 8, 'Track how often you reach for sugar.', 1, 170, 'daily', '', '', ''],
  ['missed_meal', 'Skipped a meal', 'toggle', 'health', 'bad', -1, 0, 0, 1, 'Avoid long gaps without food.', 1, 180, 'daily', '', '', ''],
  ['distracted_blocks', 'Distracted work blocks', 'counter', 'focus', 'bad', -1, 0, 0, 6, 'Track unplanned distractions.', 1, 190, 'weekdays', '', '', ''],
  ['clutter_pile', 'Left clutter unresolved', 'toggle', 'home', 'bad', -0.5, 0, 0, 1, 'Put things back after use.', 1, 200, 'daily', '', '', ''],
]

const sampleGroups = [
  ['health', 'Health', 1],
  ['focus', 'Focus', 2],
  ['mind', 'Mind', 3],
  ['recovery', 'Recovery', 4],
  ['home', 'Home', 5],
  ['social', 'Social', 6],
  ['finance', 'Finance', 7],
]

const sampleBadges = [
  ['crash', 'Crash Day', '💥', '#b91c1c', -8, 1, 1],
  ['rough', 'Rough Day', '⚠️', '#f97316', -3, 2, 1],
  ['neutral', 'Neutral Day', '⚪', '#94a3b8', 0, 3, 1],
  ['solid', 'Solid Day', '🟢', '#22c55e', 5, 4, 1],
  ['great', 'Great Day', '🏆', '#16a34a', 10, 5, 1],
  ['elite', 'Elite Day', '💎', '#2563eb', 16, 6, 1],
]

const sampleCategories = [
  ['must', 3, 'Critical actions for your forward momentum', 'Deep work, gym, core routines'],
  ['good', 2, 'Strong positive habits with long-term benefit', 'Reading, hydration, planning'],
  ['great', 1, 'Helpful positive habits', 'Stretching, journaling'],
  ['bad', -1, 'Mild negatives to reduce', 'Scrolling, snacking'],
  ['killer', -2, 'High-impact negatives', 'Sleep debt, binge habits'],
  ['must_avoid', -3, 'Red-line habits to avoid', 'All-nighters, severe self-sabotage'],
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

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF0F172A' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

function styleWorksheetBase(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  }
}

function styleBodyRows(sheet, startRow, endRow) {
  for (let rowNum = startRow; rowNum <= endRow; rowNum += 1) {
    const row = sheet.getRow(rowNum)
    const isAlternate = rowNum % 2 === 0
    row.eachCell((cell) => {
      if (isAlternate) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    })
  }
}

function normalizeHexColor(hex) {
  const raw = String(hex ?? '').trim().replace('#', '')
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `FF${raw.toUpperCase()}`
  return 'FF94A3B8'
}

function applyBadgeColorPreview(sheet, rowCount) {
  for (let rowNum = 2; rowNum <= rowCount; rowNum += 1) {
    const colorRaw = sheet.getCell(`D${rowNum}`).value
    const argb = normalizeHexColor(colorRaw)
    sheet.getCell(`B${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    }
    sheet.getCell(`B${rowNum}`).font = { bold: true, color: { argb: 'FF0F172A' } }
  }
}

function createInstructionsSheet(workbook) {
  const instructions = workbook.addWorksheet('Instructions')
  instructions.getCell('A1').value = 'Embers Workbook Template'
  instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1D4ED8' } }

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
    '- Badges sheet maps score thresholds to visual grading in Stats.',
    '- schedule_type controls when a habit appears (daily, weekdays, weekends, custom).',
    '- schedule_days uses comma-separated abbreviations like Mon, Wed, Fri when schedule_type=custom.',
    '- active_from/inactive_from set date windows to preserve history without deleting rows.',
    '- Focus mode hides navigation and keeps only today visible (no workbook edits needed).',
  ]

  lines.forEach((line, index) => {
    const cell = instructions.getCell(`A${index + 3}`)
    cell.value = line
    cell.alignment = { wrapText: true }
  })

  instructions.getColumn(1).width = 120
  instructions.getRow(1).height = 24
  instructions.getRow(3).font = { bold: true }
}

export async function ensureWorkbookTemplate() {
  try {
    await fs.access(WORKBOOK_PATH)
    return false
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const workbook = new ExcelJS.Workbook()

    createInstructionsSheet(workbook)

    const habits = workbook.addWorksheet('Habits')
    habits.addRow(HABIT_HEADERS)
    sampleHabits.forEach((row) => habits.addRow(row))
    styleHeaderRow(habits.getRow(1))
    styleWorksheetBase(habits)
    styleBodyRows(habits, 2, sampleHabits.length + 1)
    setColumnWidths(habits, [24, 32, 12, 18, 12, 16, 18, 12, 12, 52, 10, 12, 16, 20, 14, 14])

    const groups = workbook.addWorksheet('Groups')
    groups.addRow(GROUP_HEADERS)
    sampleGroups.forEach((row) => groups.addRow(row))
    styleHeaderRow(groups.getRow(1))
    styleWorksheetBase(groups)
    styleBodyRows(groups, 2, sampleGroups.length + 1)
    setColumnWidths(groups, [18, 24, 12])

    const badges = workbook.addWorksheet('Badges')
    badges.addRow(BADGE_HEADERS)
    sampleBadges.forEach((row) => badges.addRow(row))
    styleHeaderRow(badges.getRow(1))
    styleWorksheetBase(badges)
    styleBodyRows(badges, 2, sampleBadges.length + 1)
    applyBadgeColorPreview(badges, sampleBadges.length + 1)
    setColumnWidths(badges, [16, 20, 10, 14, 12, 12, 10])

    const categories = workbook.addWorksheet('Category Defaults')
    categories.addRow(CATEGORY_HEADERS)
    sampleCategories.forEach((row) => categories.addRow(row))
    styleHeaderRow(categories.getRow(1))
    styleWorksheetBase(categories)
    styleBodyRows(categories, 2, sampleCategories.length + 1)
    setColumnWidths(categories, [16, 24, 44, 40])

    const schedules = workbook.addWorksheet('Schedule Options')
    schedules.addRow(SCHEDULE_HEADERS)
    sampleSchedules.forEach((row) => schedules.addRow(row))
    styleHeaderRow(schedules.getRow(1))
    styleWorksheetBase(schedules)
    styleBodyRows(schedules, 2, sampleSchedules.length + 1)
    setColumnWidths(schedules, [16, 40, 18])

    const scheduleDays = workbook.addWorksheet('Schedule Days')
    scheduleDays.addRow(SCHEDULE_DAYS_HEADERS)
    sampleScheduleDays.forEach((row) => scheduleDays.addRow(row))
    styleHeaderRow(scheduleDays.getRow(1))
    styleWorksheetBase(scheduleDays)
    styleBodyRows(scheduleDays, 2, sampleScheduleDays.length + 1)
    setColumnWidths(scheduleDays, [10, 20])

    for (let rowNum = 2; rowNum <= 2000; rowNum += 1) {
      habits.getCell(`C${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"toggle,counter"'],
      }
      habits.getCell(`D${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Groups!$A$2:$A$500'],
      }
      habits.getCell(`E${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"good,bad"'],
      }
      habits.getCell(`K${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"0,1"'],
      }
      habits.getCell(`M${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Schedule Options!$A$2:$A$20'],
      }
      habits.getCell(`N${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Schedule Days!$A$2:$A$20'],
      }

      habits.getCell(`F${rowNum}`).numFmt = '0.00'
      habits.getCell(`G${rowNum}`).numFmt = '0'
      habits.getCell(`H${rowNum}`).numFmt = '0'
      habits.getCell(`I${rowNum}`).numFmt = '0'
      habits.getCell(`L${rowNum}`).numFmt = '0'
      habits.getCell(`M${rowNum}`).numFmt = '@'
      habits.getCell(`N${rowNum}`).numFmt = '@'

      badges.getCell(`E${rowNum}`).numFmt = '0.00'
      badges.getCell(`F${rowNum}`).numFmt = '0'
      badges.getCell(`G${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"0,1"'],
      }
    }

    habits.getCell('A1').note = 'habit_id should remain stable once created (used in saved day history).'
    habits.getCell('E1').note = 'Use good for positive habit side, bad for negative habit side.'
    habits.getCell('F1').note = 'Positive values reward behavior, negative values penalize behavior.'
    habits.getCell('G1').note = 'Daily threshold required to qualify streak for this habit.'
    habits.getCell('M1').note = 'Use Schedule Options. Custom uses Schedule Days (comma-separated for multiple days).'
    habits.getCell('O1').note = 'Set a YYYY-MM-DD start date to activate after that day (optional).'
    habits.getCell('P1').note = 'Set a YYYY-MM-DD end date to stop showing after that day (optional).'

    badges.getCell('E1').note = 'Badge applies when day score is >= min_score. Highest matching threshold wins.'

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
