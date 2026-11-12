import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, ProjectSummary } from '../types'

interface MelodyDB extends DBSchema {
  projects: { key: string; value: Project }
  meta: { key: string; value: string }
}

const DB_NAME = 'melody-studio'
const LAST_KEY = 'last-project-id'
const LS_PREFIX = 'melody-studio:'

let dbPromise: Promise<IDBPDatabase<MelodyDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<MelodyDB>(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('projects')) {
          database.createObjectStore('projects', { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta')
        }
      },
    })
  }
  return dbPromise
}

const localStorageList = (): Project[] => {
  const out: Project[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key?.startsWith(LS_PREFIX)) continue
    try {
      const value = localStorage.getItem(key)
      if (value) out.push(JSON.parse(value) as Project)
    } catch {
      /* skip corrupt entries */
    }
  }
  return out
}

export async function listProjects(): Promise<ProjectSummary[]> {
  let projects: Project[] = []
  try {
    projects = await (await db()).getAll('projects')
  } catch {
    projects = localStorageList()
  }
  return projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      bpm: p.bpm,
      notes: p.notes.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveProject(project: Project): Promise<void> {
  try {
    const database = await db()
    await database.put('projects', project)
    await database.put('meta', project.id, LAST_KEY)
  } catch {
    try {
      localStorage.setItem(LS_PREFIX + project.id, JSON.stringify(project))
      localStorage.setItem(LS_PREFIX + LAST_KEY, project.id)
    } catch {
      console.warn('[melody] could not persist the project')
    }
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    return (await (await db()).get('projects', id)) ?? null
  } catch {
    const raw = localStorage.getItem(LS_PREFIX + id)
    return raw ? (JSON.parse(raw) as Project) : null
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const database = await db()
    await database.delete('projects', id)
    if ((await database.get('meta', LAST_KEY)) === id) {
      await database.delete('meta', LAST_KEY)
    }
  } catch {
    localStorage.removeItem(LS_PREFIX + id)
    if (localStorage.getItem(LS_PREFIX + LAST_KEY) === id) {
      localStorage.removeItem(LS_PREFIX + LAST_KEY)
    }
  }
}

export async function getLastProjectId(): Promise<string | null> {
  try {
    return (await (await db()).get('meta', LAST_KEY)) ?? null
  } catch {
    return localStorage.getItem(LS_PREFIX + LAST_KEY)
  }
}

export async function setLastProjectId(id: string): Promise<void> {
  try {
    await (await db()).put('meta', id, LAST_KEY)
  } catch {
    localStorage.setItem(LS_PREFIX + LAST_KEY, id)
  }
}
