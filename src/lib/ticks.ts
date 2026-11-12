import { PPQ, type TimeSignature } from '../types'

/** ticks in a whole note */
export const WHOLE = PPQ * 4

export const ticksPerBeat = (denominator: number) => WHOLE / denominator

export const barTicks = (ts: TimeSignature) =>
  ticksPerBeat(ts.denominator) * ts.numerator

export const ticksToSeconds = (ticks: number, bpm: number) =>
  (ticks / PPQ) * (60 / bpm)

export const secondsToTicks = (seconds: number, bpm: number) =>
  seconds * (bpm / 60) * PPQ

/** "bar.beat.sixteenth" — 1-based, what every DAW shows. */
export function formatPosition(ticks: number, ts: TimeSignature): string {
  const beatLen = ticksPerBeat(ts.denominator)
  const barLen = beatLen * ts.numerator
  const safe = Math.max(0, ticks)
  const bar = Math.floor(safe / barLen)
  const inBar = safe - bar * barLen
  const beat = Math.floor(inBar / beatLen)
  const rest = inBar - beat * beatLen
  const sixteenth = Math.floor(rest / (beatLen / 4))
  return `${bar + 1}.${beat + 1}.${sixteenth + 1}`
}

export const snapFloor = (value: number, step: number) =>
  step <= 0 ? value : Math.floor(value / step + 1e-6) * step

export const snapRound = (value: number, step: number) =>
  step <= 0 ? value : Math.round(value / step) * step

export const clamp = (min: number, max: number, v: number) =>
  Math.min(max, Math.max(min, v))
