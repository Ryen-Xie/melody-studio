/** Musical time is stored in ticks. 480 ticks = one quarter note. */
export const PPQ = 480

export type Tool = 'select' | 'draw' | 'erase' | 'pan'

export type KeyMode = 'major' | 'minor'

export interface Note {
  id: string
  pitch: number
  /** ticks from the start of the clip */
  start: number
  /** ticks */
  duration: number
  /** 1..127 */
  velocity: number
}

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'min9'

export interface Chord {
  id: string
  start: number
  duration: number
  /** pitch class 0-11 */
  root: number
  quality: ChordQuality
}

export interface TimeSignature {
  numerator: number
  denominator: number
}

export interface InstrumentSettings {
  volume: number // -30..6 dB
  reverb: number // 0..1 wet
  metronome: boolean
  sustain: boolean
}

export interface Project {
  id: string
  name: string
  bpm: number
  timeSignature: TimeSignature
  keyRoot: number // 0-11
  keyMode: KeyMode
  bars: number
  notes: Note[]
  chords: Chord[]
  loop: { start: number; end: number; enabled: boolean }
  instrument: InstrumentSettings
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  bpm: number
  notes: number
}

export interface NotePatch {
  id: string
  patch: Partial<Omit<Note, 'id'>>
}
