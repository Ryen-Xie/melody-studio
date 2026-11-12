import type { Chord, KeyMode, Note, Project } from '../types'
import { chordForDegree, SCALE_INTERVALS } from './theory'

export interface SketchStyle {
  id: string
  name: string
  hint: string
  bpm: number
  rhythm: number[][]
  degrees: Record<KeyMode, number[]>
  octave: number
}

const R = {
  ballad: [
    [1, 1, 1, 1],
    [1.5, 0.5, 1, 1],
    [1, 1, 2],
    [2, 1, 1],
  ],
  light: [
    [0.5, 0.5, 1, 0.5, 0.5, 1],
    [1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 1, 1],
    [1.5, 0.5, 0.5, 0.5, 1],
  ],
  romantic: [
    [1.5, 0.5, 2],
    [2, 1, 1],
    [1, 1, 1.5, 0.5],
    [2, 2],
  ],
  emotional: [
    [2, 1, 1],
    [1, 1, 2],
    [2, 2],
    [1.5, 0.5, 1, 1],
  ],
  upbeat: [
    [0.5, 0.5, 1, 0.5, 0.5, 1],
    [1, 1, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 1, 1],
    [1, 1, 2],
  ],
}

export const SKETCHES: SketchStyle[] = [
  {
    id: 'ballad',
    name: 'Pop Ballad',
    hint: 'Slow, open phrases',
    bpm: 76,
    rhythm: R.ballad,
    degrees: { major: [0, 4, 5, 3], minor: [0, 3, 5, 4] },
    octave: 0,
  },
  {
    id: 'light',
    name: 'Light Pop',
    hint: 'Airy eighth-note motion',
    bpm: 104,
    rhythm: R.light,
    degrees: { major: [0, 5, 3, 4], minor: [0, 5, 2, 6] },
    octave: 0,
  },
  {
    id: 'romantic',
    name: 'Romantic',
    hint: 'Long notes, gentle leaps',
    bpm: 84,
    rhythm: R.romantic,
    degrees: { major: [5, 3, 0, 4], minor: [0, 5, 2, 6] },
    octave: 1,
  },
  {
    id: 'emotional',
    name: 'Emotional',
    hint: 'Descending, unresolved',
    bpm: 72,
    rhythm: R.emotional,
    degrees: { major: [0, 3, 5, 4], minor: [0, 5, 3, 4] },
    octave: 0,
  },
  {
    id: 'upbeat',
    name: 'Upbeat Pop',
    hint: 'Short notes, forward push',
    bpm: 122,
    rhythm: R.upbeat,
    degrees: { major: [0, 4, 5, 3], minor: [0, 5, 2, 6] },
    octave: 0,
  },
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Builds a four-bar phrase in the project's key. It is a starting point, not a
 * rule — every note stays fully editable.
 */
export function buildSketch(
  style: SketchStyle,
  project: Project,
): { notes: Omit<Note, 'id'>[]; chords: Omit<Chord, 'id'>[]; bpm: number } {
  const rand = mulberry32(
    Date.now() % 100000 + style.id.length * 7919 + project.keyRoot * 31,
  )
  const beat = 480
  const bar = beat * project.timeSignature.numerator
  const intervals = SCALE_INTERVALS[project.keyMode]
  const tonic = 60 + project.keyRoot + style.octave * 12

  const degreePitch = (degree: number) => {
    const octave = Math.floor(degree / 7)
    const step = ((degree % 7) + 7) % 7
    return tonic + intervals[step] + octave * 12
  }

  const nearestChordTone = (degree: number, chordDegrees: number[]) => {
    let best = degree
    let bestDist = Infinity
    for (const target of chordDegrees) {
      for (let oct = -1; oct <= 1; oct += 1) {
        const candidate = target + oct * 7
        const dist = Math.abs(candidate - degree)
        if (dist < bestDist) {
          bestDist = dist
          best = candidate
        }
      }
    }
    return best
  }

  const notes: Omit<Note, 'id'>[] = []
  const chords: Omit<Chord, 'id'>[] = []
  const progression = style.degrees[project.keyMode]
  let degree = 7

  for (let barIndex = 0; barIndex < 4; barIndex += 1) {
    const chordDegree = progression[barIndex % progression.length]
    const chordTones = [chordDegree, chordDegree + 2, chordDegree + 4]
    const { root, quality } = chordForDegree(project.keyRoot, project.keyMode, chordDegree)
    chords.push({
      start: barIndex * bar,
      duration: bar,
      root,
      quality,
    })

    const rhythm = style.rhythm[barIndex % style.rhythm.length]
    let cursor = barIndex * bar
    rhythm.forEach((beats, i) => {
      if (i === 0) {
        degree = nearestChordTone(degree, chordTones)
      } else {
        const roll = rand()
        if (roll < 0.52) degree += rand() < 0.5 ? 1 : -1
        else if (roll < 0.72) degree += rand() < 0.5 ? 2 : -2
        else if (roll < 0.8) degree += rand() < 0.5 ? 3 : -3
        // otherwise hold the note
      }
      degree = Math.max(0, Math.min(13, degree))

      const duration = Math.round(beats * beat)
      const accent = i === 0 ? 10 : 0
      notes.push({
        pitch: degreePitch(degree),
        start: cursor,
        duration: Math.max(60, duration - (i === rhythm.length - 1 ? 8 : 0)),
        velocity: Math.round(90 + accent + (rand() * 14 - 7)),
      })
      cursor += duration
    })
  }

  /* resolve to the tonic on the last note */
  const last = notes[notes.length - 1]
  if (last) {
    const tonicPitch = degreePitch(7)
    last.pitch = tonicPitch
    last.duration = Math.min(last.duration, beat * 2)
  }

  return { notes, chords, bpm: style.bpm }
}
