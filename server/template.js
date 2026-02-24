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

const sampleHabits = [
  ['wake_on_time', 'Wake up on time', 'toggle', 'health', 'identity', 2, 1, 0, 1, 'On time means before 06:10.', 1, 10],
  ['gaming_hours', 'Gaming hours', 'counter', 'leisure', 'energy', -1, 1, 0, 12, 'Use + / - to track total hours played today.', 1, 20],
  ['deep_work_hours', 'Deep work hours', 'counter', 'focus', 'identity,growth', 3, 1, 0, 12, 'Count only focused work blocks.', 1, 30],
]

const sampleGroups = [
  ['health', 'Health', 1],
  ['focus', 'Focus', 2],
  ['leisure', 'Leisure', 3],
]

const sampleTags = [
  ['identity', 'Identity', '#60a5fa'],
  ['growth', 'Growth', '#34d399'],
  ['energy', 'Energy', '#f59e0b'],
]

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF1F5' },
    }
  })
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

export async function ensureWorkbookTemplate() {
  try {
    await fs.access(WORKBOOK_PATH)
    return false
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const workbook = new ExcelJS.Workbook()

    const habits = workbook.addWorksheet('Habits')
    habits.addRow(HABIT_HEADERS)
    sampleHabits.forEach((row) => habits.addRow(row))
    styleHeaderRow(habits.getRow(1))
    setColumnWidths(habits, [22, 28, 12, 16, 24, 16, 18, 12, 12, 45, 10, 12])

    const groups = workbook.addWorksheet('Groups')
    groups.addRow(GROUP_HEADERS)
    sampleGroups.forEach((row) => groups.addRow(row))
    styleHeaderRow(groups.getRow(1))
    setColumnWidths(groups, [16, 24, 12])

    const tags = workbook.addWorksheet('Tag Options')
    tags.addRow(TAG_HEADERS)
    sampleTags.forEach((row) => tags.addRow(row))
    styleHeaderRow(tags.getRow(1))
    setColumnWidths(tags, [16, 20, 14])

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
      habits.getCell(`K${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"0,1"'],
      }
    }

    await workbook.xlsx.writeFile(WORKBOOK_PATH)
    return true
  }
}
