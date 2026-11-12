import type { Chord, ChordQuality, KeyMode } from '../types'
import { pitchClassLabel } from './pitch'
import { translate, type Lang } from './i18n'

export const SCALE_INTERVALS: Record<KeyMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  min9: [0, 3, 7, 10, 14],
}

export const CHORD_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  min9: 'm9',
}

export const CHORD_QUALITIES: ChordQuality[] = [
  'maj',
  'min',
  'min7',
  'maj7',
  'dom7',
  'sus4',
  'sus2',
  'dim',
  'aug',
  'min9',
]

export const scalePitchClasses = (root: number, mode: KeyMode): Set<number> =>
  new Set(SCALE_INTERVALS[mode].map((i) => (root + i) % 12))

export const chordPitchClasses = (chord: Pick<Chord, 'root' | 'quality'>): Set<number> =>
  new Set(CHORD_INTERVALS[chord.quality].map((i) => (chord.root + i) % 12))

export const chordLabel = (chord: Pick<Chord, 'root' | 'quality'>, flats = false) =>
  `${pitchClassLabel(chord.root, flats)}${CHORD_SUFFIX[chord.quality]}`

/** Diatonic quality of each scale degree. */
export function diatonicQuality(mode: KeyMode, degree: number): ChordQuality {
  const major: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
  const minor: ChordQuality[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj']
  return (mode === 'major' ? major : minor)[((degree % 7) + 7) % 7]
}

export function chordForDegree(rootPc: number, mode: KeyMode, degree: number) {
  const interval = SCALE_INTERVALS[mode][((degree % 7) + 7) % 7]
  return {
    root: (rootPc + interval) % 12,
    quality: diatonicQuality(mode, degree),
  }
}

export interface ProgressionPreset {
  id: string
  name: string
  /** scale degrees, 0 = tonic */
  degrees: number[]
  mode: KeyMode
  note: string
}

export const PROGRESSIONS: ProgressionPreset[] = [
  { id: 'pop-anthem', name: 'I – V – vi – IV', degrees: [0, 4, 5, 3], mode: 'major', note: 'The modern pop anthem' },
  { id: 'sensitive', name: 'vi – IV – I – V', degrees: [5, 3, 0, 4], mode: 'major', note: 'Warm and searching' },
  { id: 'fifties', name: 'I – vi – IV – V', degrees: [0, 5, 3, 4], mode: 'major', note: 'Fifties doo-wop' },
  { id: 'lift', name: 'IV – V – iii – vi', degrees: [3, 4, 2, 5], mode: 'major', note: 'Lifts on the fourth' },
  { id: 'turnaround', name: 'ii – V – I', degrees: [1, 4, 0], mode: 'major', note: 'Jazz turnaround' },
  { id: 'epic', name: 'i – VI – III – VII', degrees: [0, 5, 2, 6], mode: 'minor', note: 'Cinematic minor' },
  { id: 'ballad', name: 'i – iv – VI – v', degrees: [0, 3, 5, 4], mode: 'minor', note: 'Slow ballad' },
]

/** Note names in a chord, for the inspector. */
export function chordTones(chord: Pick<Chord, 'root' | 'quality'>, flats = false): string[] {
  return CHORD_INTERVALS[chord.quality].map((i) => pitchClassLabel(chord.root + i, flats))
}

export function keyLabel(root: number, mode: KeyMode, lang: Lang = 'en'): string {
  const flats = [1, 3, 5, 8, 10].includes(root)
  const name = translate(lang, mode === 'major' ? 'theory.major' : 'theory.minor')
  return lang === 'zh' ? `${pitchClassLabel(root, flats)}${name}` : `${pitchClassLabel(root, flats)} ${name}`
}
