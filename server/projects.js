import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { DATA_DIR, PROJECTS_PATH } from './constants.js'

const VALID_STATUSES = new Set(['pending', 'greenlit', 'declined'])

function normalizeStatus(value) {
  if (typeof value !== 'string') return 'pending'
  const lowered = value.toLowerCase()
  return VALID_STATUSES.has(lowered) ? lowered : 'pending'
}

async function ensureProjectsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(PROJECTS_PATH)
  } catch {
    await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects: [] }, null, 2), 'utf-8')
  }
}

export async function listProjects() {
  await ensureProjectsFile()
  const content = await fs.readFile(PROJECTS_PATH, 'utf-8')
  const parsed = JSON.parse(content)
  const projects = Array.isArray(parsed.projects) ? parsed.projects : []
  for (const project of projects) {
    project.status = normalizeStatus(project.status)
  }
  return projects.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

export async function getProjectById(id) {
  const projects = await listProjects()
  return projects.find((project) => project.id === id) ?? null
}

export async function saveProject(payload) {
  const projects = await listProjects()
  const existing = projects.find((project) => project.id === payload.id)
  const now = new Date().toISOString()

  if (existing) {
    existing.name = payload.name
    existing.timelineId = payload.timelineId
    existing.complexityId = payload.complexityId
    existing.selectedServiceIds = payload.selectedServiceIds
    existing.status = normalizeStatus(payload.status ?? existing.status)
    existing.updatedAt = now
  } else {
    projects.push({
      id: payload.id || randomUUID(),
      name: payload.name,
      timelineId: payload.timelineId,
      complexityId: payload.complexityId,
      selectedServiceIds: payload.selectedServiceIds,
      status: normalizeStatus(payload.status),
      createdAt: now,
      updatedAt: now,
    })
  }

  await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects }, null, 2), 'utf-8')
  return projects.find((project) => project.id === (payload.id || projects.at(-1)?.id))
}

export async function updateProjectStatus(id, status) {
  const projects = await listProjects()
  const target = projects.find((project) => project.id === id)
  if (!target) return null

  target.status = normalizeStatus(status)
  target.updatedAt = new Date().toISOString()

  await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects }, null, 2), 'utf-8')
  return target
}

export async function deleteProject(id) {
  const projects = await listProjects()
  const nextProjects = projects.filter((project) => project.id !== id)
  if (nextProjects.length === projects.length) return false

  await fs.writeFile(PROJECTS_PATH, JSON.stringify({ projects: nextProjects }, null, 2), 'utf-8')
  return true
}
