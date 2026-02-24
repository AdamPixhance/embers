import ExcelJS from 'exceljs'
import fs from 'node:fs/promises'
import { DATA_DIR, WORKBOOK_PATH } from './constants.js'

const HABIT_HEADERS = [
  'habit_id',
  'label',
  'type',
  'group_id',
  'tags',
  'score_per_unit',
  'streak_min_count',
  'min_count',
  'max_count',
  'tooltip',
  'active',
  'sort_order',
]

const GROUP_HEADERS = ['group_id', 'group_label', 'sort_order']
const TAG_HEADERS = ['tag_id', 'tag_label', 'tag_color']
const CATEGORY_HEADERS = ['category', 'default_score_per_unit', 'meaning', 'example_use_case']

const sampleHabits = [
  [
    'wake_on_time',
    'Wake up before 06:15',
    'toggle',
    'health',
    'identity,consistency',
    2,
    1,
    0,
    1,
    'Mark Done if you got out of bed before 06:15.',
    1,
    10,
  ],
  [
    'drink_water_glasses',
    'Drink water (glasses)',
    'counter',
    'health',
    'energy,consistency',
    0.5,
    8,
    0,
    20,
    'Target is 8+ glasses. Use + / - to track total glasses.',
    1,
    20,
  ],
  [
    'deep_work_blocks',
    'Deep work blocks (50m)',
    'counter',
    'focus',
    'growth,identity',
    3,
    2,
    0,
    8,
    'One block = one uninterrupted 50-minute focus session.',
    1,
    30,
  ],
  [
    'no_late_scrolling',
    'No scrolling after 22:30',
    'toggle',
    'discipline',
    'discipline,recovery',
    2,
    1,
    0,
    1,
    'Done means no social feed scrolling after 22:30.',
    1,
    40,
  ],
  [
    'reading_pages',
    'Read pages',
    'counter',
    'growth',
    'growth,consistency',
    0.2,
    20,
    0,
    200,
    'Track book pages read today. 20+ pages qualifies streak.',
    1,
    50,
  ],
  [
    'gaming_hours',
    'Gaming hours',
    'counter',
    'discipline',
    'recovery',
    -1,
    0,
    0,
    12,
    'Negative scoring habit. Keep this as low as possible.',
    1,
    60,
  ],
]

const sampleGroups = [
  ['health', 'Health', 1],
  ['focus', 'Focus', 2],
  ['discipline', 'Discipline', 3],
  ['growth', 'Growth', 4],
]

const sampleTags = [
  ['identity', 'Identity', '#60a5fa'],
  ['growth', 'Growth', '#34d399'],
  ['energy', 'Energy', '#f59e0b'],
  ['consistency', 'Consistency', '#a78bfa'],
  ['discipline', 'Discipline', '#f97316'],
  ['recovery', 'Recovery', '#14b8a6'],
]

const sampleCategories = [
  ['must', 3, 'Critical daily actions to move life forward', 'Deep work blocks, core training'],
  ['good', 2, 'Strong positive habits with high long-term ROI', 'Morning walk, reading'],
  ['great', 1, 'Helpful positives that still matter', 'Stretching, journaling'],
  ['bad', -1, 'Mild negatives that should be reduced', 'Gaming hours, random browsing'],
  ['killer', -2, 'High-impact negatives that hurt momentum', 'Skipping sleep, doom-scrolling'],
  ['must_avoid', -3, 'Hard red-line behaviors to avoid', 'All-nighters, major self-sabotage'],
]

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF0F172A' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    }
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

function styleBodyRows(sheet, startRow, endRow) {
  for (let rowNum = startRow; rowNum <= endRow; rowNum += 1) {
    const row = sheet.getRow(rowNum)
    const isAlternate = rowNum % 2 === 0
    row.eachCell((cell) => {
      if (isAlternate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        }
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

function applyTagColorPreview(tagsSheet, rowCount) {
  for (let rowNum = 2; rowNum <= rowCount; rowNum += 1) {
    const colorRaw = tagsSheet.getCell(`C${rowNum}`).value
    const argb = normalizeHexColor(colorRaw)
    tagsSheet.getCell(`B${rowNum}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    }
    tagsSheet.getCell(`B${rowNum}`).font = { bold: true, color: { argb: 'FF0F172A' } }
  }
}

function styleWorksheetBase(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  }
}

function createInstructionsSheet(workbook) {
  const instructions = workbook.addWorksheet('Instructions')

  instructions.getCell('A1').value = 'Embers Workbook Template'
  instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1D4ED8' } }

  const lines = [
    'How to use this file:',
    '1) Edit rows in Habits to define your habits (toggle/counter).',
    '2) Group IDs in Habits must exist in Groups sheet.',
    '3) Tags in Habits are comma-separated tag_ids from Tag Options sheet.',
    '4) active = 1 shows habit in app, active = 0 hides it.',
    '5) For toggle habits use min_count=0, max_count=1, streak_min_count=1.',
    '6) For counter habits set your numeric target in streak_min_count.',
    '',
    'Placeholder rows are included so users can run the app immediately.',
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
    setColumnWidths(habits, [22, 32, 12, 18, 30, 16, 18, 12, 12, 52, 10, 12])

    const groups = workbook.addWorksheet('Groups')
    groups.addRow(GROUP_HEADERS)
    sampleGroups.forEach((row) => groups.addRow(row))
    styleHeaderRow(groups.getRow(1))
    styleWorksheetBase(groups)
    styleBodyRows(groups, 2, sampleGroups.length + 1)
    setColumnWidths(groups, [16, 24, 12])

    const tags = workbook.addWorksheet('Tag Options')
    tags.addRow(TAG_HEADERS)
    sampleTags.forEach((row) => tags.addRow(row))
    styleHeaderRow(tags.getRow(1))
    styleWorksheetBase(tags)
    styleBodyRows(tags, 2, sampleTags.length + 1)
    applyTagColorPreview(tags, sampleTags.length + 1)
    setColumnWidths(tags, [18, 20, 14])

    const categories = workbook.addWorksheet('Category Defaults')
    categories.addRow(CATEGORY_HEADERS)
    sampleCategories.forEach((row) => categories.addRow(row))
    styleHeaderRow(categories.getRow(1))
    styleWorksheetBase(categories)
    styleBodyRows(categories, 2, sampleCategories.length + 1)
    setColumnWidths(categories, [16, 24, 40, 36])

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
        formulae: ['=\'Tag Options\'!$A$2:$A$500'],
      }
      habits.getCell(`K${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"0,1"'],
      }

      habits.getCell(`F${rowNum}`).numFmt = '0.00'
      habits.getCell(`G${rowNum}`).numFmt = '0'
      habits.getCell(`H${rowNum}`).numFmt = '0'
      habits.getCell(`I${rowNum}`).numFmt = '0'
      habits.getCell(`L${rowNum}`).numFmt = '0'
    }

    habits.getCell('A1').note =
      'habit_id should stay stable once created (used as permanent key in saved history).'
    habits.getCell('D1').note =
      'group_id must exist in Groups sheet. Use dropdown list for valid values.'
    habits.getCell('E1').note =
      'tags are comma-separated tag_ids from Tag Options (e.g. growth,consistency).'
    habits.getCell('F1').note =
      'score_per_unit can be positive or negative. Negative is useful for bad habits.'
    habits.getCell('G1').note =
      'streak_min_count is daily threshold required to qualify streak.'
    habits.getCell('K1').note = 'active = 1 shows in app, active = 0 hides it.'

    await workbook.xlsx.writeFile(WORKBOOK_PATH)
    return true
  }
}
