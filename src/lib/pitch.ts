const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export const MIN_PITCH = 21 // A0
export const MAX_PITCH = 108 // C8

export const pitchClass = (pitch: number) => ((pitch % 12) + 12) % 12

export const isBlackKey = (pitch: number) =>
  [1, 3, 6, 8, 10].includes(pitchClass(pitch))

export const pitchName = (pitch: number, flats = false): string =>
  (flats ? FLATS : NAMES)[pitchClass(pitch)]

export const pitchLabel = (pitch: number, flats = false): string =>
  `${pitchName(pitch, flats)}${Math.floor(pitch / 12) - 1}`

export const pitchClassLabel = (pc: number, flats = false): string =>
  (flats ? FLATS : NAMES)[((pc % 12) + 12) % 12]

export const KEY_NAMES_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const KEY_NAMES_MINOR = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
