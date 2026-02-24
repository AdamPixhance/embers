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

function extractRows(sheet) {
  if (!sheet) return []
  const rows = []
  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum += 1) {
    const row = sheet.getRow(rowNum)
    const hasContent = row.values.some((entry, index) => index > 0 && toText(entry).length > 0)
    if (hasContent) rows.push(row)
  }
  return rows
}

export async function loadWorkbookData() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(WORKBOOK_PATH)

  const habitsSheet = workbook.getWorksheet('Habits')
  const groupsSheet = workbook.getWorksheet('Groups')
  const badgesSheet = workbook.getWorksheet('Badges')

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

  const habits = extractRows(habitsSheet)
    .map((row) => {
      const habitId = toText(row.getCell(1).value)
      if (!habitId) return null

      const typeRaw = toText(row.getCell(3).value).toLowerCase()
      const type = typeRaw === 'counter' ? 'counter' : 'toggle'
      const scorePerUnit = toNumber(row.getCell(6).value, 0)
      const polarityRaw = toText(row.getCell(5).value).toLowerCase()
      const polarity = polarityRaw === 'bad' || polarityRaw === 'good'
        ? polarityRaw
        : scorePerUnit < 0
          ? 'bad'
          : 'good'

      const minCount = toNumber(row.getCell(8).value, 0)
      const maxCount = toNumber(row.getCell(9).value, type === 'toggle' ? 1 : 999999)

      return {
        habitId,
        label: toText(row.getCell(2).value) || habitId,
        type,
        groupId: toText(row.getCell(4).value),
        polarity,
        scorePerUnit,
        streakMinCount: Math.max(1, toNumber(row.getCell(7).value, 1)),
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

  const badges = extractRows(badgesSheet)
    .map((row) => {
      const badgeId = toText(row.getCell(1).value)
      if (!badgeId) return null

      return {
        badgeId,
        displayName: toText(row.getCell(2).value) || badgeId,
        icon: toText(row.getCell(3).value) || '•',
        colorHex: toText(row.getCell(4).value) || '#94a3b8',
        minScore: toNumber(row.getCell(5).value, 0),
        sortOrder: toNumber(row.getCell(6).value, 9999),
        active: toNumber(row.getCell(7).value, 1) === 1,
      }
    })
    .filter(Boolean)
    .filter((badge) => badge.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  return {
    habits,
    groups,
    badges,
  }
}
