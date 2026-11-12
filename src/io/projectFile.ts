import type { Chord, ChordQuality, Note, Project } from '../types'
import { uid } from '../lib/id'
import { clamp } from '../lib/ticks'
import { CHORD_INTERVALS } from '../lib/theory'

export const PROJECT_FORMAT = 'melody-studio/project'
export const PROJECT_VERSION = 1

export function serializeProject(project: Project): string {
  return JSON.stringify(
    { format: PROJECT_FORMAT, version: PROJECT_VERSION, project },
    null,
    2,
  )
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

export function parseProject(raw: string): Project {
  const data = JSON.parse(raw) as { format?: string; project?: unknown } | Project
  const source = (data as { project?: Project }).project ?? (data as Project)
  if (!source || typeof source !== 'object') throw new Error('Not a Melody Studio project')

  const tsRaw = source.timeSignature ?? { numerator: 4, denominator: 4 }
  const denominator = [2, 4, 8, 16].includes(tsRaw.denominator) ? tsRaw.denominator : 4
  const numerator = clamp(1, 16, Math.round(num(tsRaw.numerator, 4)))

  const notes: Note[] = Array.isArray(source.notes)
    ? source.notes
        .filter((n) => n && Number.isFinite(n.pitch) && Number.isFinite(n.start))
        .map((n) => ({
          id: typeof n.id === 'string' ? n.id : uid('n'),
          pitch: clamp(0, 127, Math.round(n.pitch)),
          start: Math.max(0, Math.round(n.start)),
          duration: Math.max(30, Math.round(num(n.duration, 480))),
          velocity: clamp(1, 127, Math.round(num(n.velocity, 100))),
        }))
    : []

  const chords: Chord[] = Array.isArray(source.chords)
    ? source.chords
        .filter((c) => c && CHORD_INTERVALS[c.quality as ChordQuality])
        .map((c) => ({
          id: typeof c.id === 'string' ? c.id : uid('c'),
          start: Math.max(0, Math.round(num(c.start, 0))),
          duration: Math.max(240, Math.round(num(c.duration, 1920))),
          root: clamp(0, 11, Math.round(num(c.root, 0))),
          quality: c.quality as ChordQuality,
        }))
    : []

  const now = new Date().toISOString()
  return {
    id: typeof source.id === 'string' ? source.id : uid('prj'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Untitled melody',
    bpm: clamp(30, 260, Math.round(num(source.bpm, 96))),
    timeSignature: { numerator, denominator },
    keyRoot: clamp(0, 11, Math.round(num(source.keyRoot, 0))),
    keyMode: source.keyMode === 'minor' ? 'minor' : 'major',
    bars: clamp(1, 64, Math.round(num(source.bars, 8))),
    notes,
    chords,
    loop: {
      start: Math.max(0, Math.round(num(source.loop?.start, 0))),
      end: Math.max(240, Math.round(num(source.loop?.end, 7680))),
      enabled: Boolean(source.loop?.enabled),
    },
    instrument: {
      volume: clamp(-40, 6, num(source.instrument?.volume, -3)),
      reverb: clamp(0, 1, num(source.instrument?.reverb, 0.26)),
      metronome: Boolean(source.instrument?.metronome),
      sustain: Boolean(source.instrument?.sustain),
    },
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: now,
  }
}
