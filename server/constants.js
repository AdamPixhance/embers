import path from 'node:path'

export const ROOT_DIR = process.cwd()
export const DATA_DIR = process.env.EMBERS_DATA_DIR
	? path.resolve(process.env.EMBERS_DATA_DIR)
	: path.join(ROOT_DIR, 'data')
export const IMAGES_DIR = path.join(DATA_DIR, 'images')
export const WORKBOOK_PATH = path.join(DATA_DIR, 'embers-habits.xlsx')
export const DAY_LOG_PATH = path.join(DATA_DIR, 'habit-day-log.json')
export const PROJECTS_PATH = path.join(DATA_DIR, 'projects.json')
