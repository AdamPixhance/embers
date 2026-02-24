import ExcelJS from 'exceljs'
import { WORKBOOK_PATH } from './constants.js'

function toText(raw) {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'object') {
    if ('richText' in raw && Array.isArray(raw.richText)) {
      return raw.richText.map((part) => part.text ?? '').join('').trim()
    }
    if ('text' in raw) {
      return String(raw.text ?? '').trim()
    }
    if ('result' in raw) {
      return toText(raw.result)
    }
  }
  return String(raw).trim()
}

function toNumber(raw, fallback = 0) {
  const value = Number(toText(raw))
  return Number.isFinite(value) ? value : fallback
}

function parseStringList(value) {
  return toText(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function extractRows(sheet) {
  if (!sheet) return []
  const rows = []
  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum += 1) {
    const row = sheet.getRow(rowNum)
    const hasContent = row.values.some((entry, idx) => idx > 0 && toText(entry).length > 0)
    if (hasContent) {
      rows.push(row)
    }
  }
  return rows
}

export async function loadWorkbookData() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(WORKBOOK_PATH)

  const habitsSheet = workbook.getWorksheet('Habits')
  const groupsSheet = workbook.getWorksheet('Groups')
  const tagOptionsSheet = workbook.getWorksheet('Tag Options')

  const groups = extractRows(groupsSheet)
    .map((row) => {
      const groupId = toText(row.getCell(1).value)
      if (!groupId) return null
      return {
        groupId,
        groupLabel: toText(row.getCell(2).value) || groupId,
        sortOrder: toNumber(row.getCell(3).value, 9999),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const tags = extractRows(tagOptionsSheet)
    .map((row) => {
      const tagId = toText(row.getCell(1).value)
      if (!tagId) return null
      return {
        tagId,
        tagLabel: toText(row.getCell(2).value) || tagId,
        tagColor: toText(row.getCell(3).value) || '#94a3b8',
      }
    })
    .filter(Boolean)

  const tagColorMap = new Map(tags.map((tag) => [tag.tagId, tag.tagColor]))

  const habits = extractRows(habitsSheet)
    .map((row) => {
      const habitId = toText(row.getCell(1).value)
      if (!habitId) return null

      const typeRaw = toText(row.getCell(3).value).toLowerCase()
      const type = typeRaw === 'counter' ? 'counter' : 'toggle'
      const groupId = toText(row.getCell(4).value)
      const minCount = toNumber(row.getCell(8).value, 0)
      const maxCount = toNumber(row.getCell(9).value, type === 'toggle' ? 1 : 999999)
      const streakMinCount = Math.max(1, toNumber(row.getCell(7).value, 1))

      return {
        habitId,
        label: toText(row.getCell(2).value) || habitId,
        type,
        groupId,
        tags: parseStringList(row.getCell(5).value),
        scorePerUnit: toNumber(row.getCell(6).value, 0),
        streakMinCount,
        minCount,
        maxCount: Math.max(minCount, maxCount),
        tooltip: toText(row.getCell(10).value),
        active: toNumber(row.getCell(11).value, 1) === 1,
        sortOrder: toNumber(row.getCell(12).value, 9999),
      }
    })
    .filter(Boolean)
    .filter((habit) => habit.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const habitsWithTagMeta = habits.map((habit) => ({
    ...habit,
    tagMeta: habit.tags.map((tagId) => ({
      tagId,
      tagColor: tagColorMap.get(tagId) || '#94a3b8',
    })),
  }))

  return {
    habits: habitsWithTagMeta,
    groups,
    tags,
  }
}
