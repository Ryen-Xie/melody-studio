/** Salamander Grand Piano sample map (Alexander Holm, CC-BY 3.0). */
export const SAMPLE_FILES: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
}

export const SAMPLE_BASE = `${import.meta.env.BASE_URL}samples/`

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function noteNameToMidi(name: string): number {
  const m = /^([A-G])(#?)(-?\d+)$/.exec(name)
  if (!m) return 60
  const [, letter, sharp, octave] = m
  return 12 * (Number(octave) + 1) + PC[letter] + (sharp ? 1 : 0)
}

export const SAMPLE_ROOTS = Object.keys(SAMPLE_FILES)
  .map((name) => ({ name, pitch: noteNameToMidi(name) }))
  .sort((a, b) => a.pitch - b.pitch)

export function nearestRoot(pitch: number) {
  let best = SAMPLE_ROOTS[0]
  let bestDist = Infinity
  for (const root of SAMPLE_ROOTS) {
    const d = Math.abs(root.pitch - pitch)
    if (d < bestDist) {
      bestDist = d
      best = root
    }
  }
  return best
}

const rawCache = new Map<string, Promise<ArrayBuffer>>()

export function fetchSample(file: string): Promise<ArrayBuffer> {
  let cached = rawCache.get(file)
  if (!cached) {
    cached = fetch(`${SAMPLE_BASE}${file}`).then((r) => {
      if (!r.ok) throw new Error(`sample ${file} failed (${r.status})`)
      return r.arrayBuffer()
    })
    rawCache.set(file, cached)
    cached.catch(() => rawCache.delete(file))
  }
  return cached
}
