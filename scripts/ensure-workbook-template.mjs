import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

process.env.EMBERS_DATA_DIR = path.join(projectRoot, 'data')

const { ensureWorkbookTemplate } = await import('../server/template.js')
const created = await ensureWorkbookTemplate()

if (created) {
  console.log('Created workbook template at data/embers-habits.xlsx')
} else {
  console.log('Workbook template already exists at data/embers-habits.xlsx')
}