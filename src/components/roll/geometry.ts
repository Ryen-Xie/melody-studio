import type { Viewport } from '../../store/ui'
import type { Note } from '../../types'

export const KEY_W = 88
export const RULER_H = 34
export const EDGE_GRAB = 8

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const tickToX = (tick: number, vp: Viewport) =>
  KEY_W + (tick - vp.scrollTicks) * vp.pxPerTick

export const xToTick = (x: number, vp: Viewport) =>
  vp.scrollTicks + (x - KEY_W) / vp.pxPerTick

/** Bottom edge of the row for `pitch`. */
export const pitchToY = (pitch: number, vp: Viewport) =>
  RULER_H + (vp.scrollPitch - pitch) * vp.rowHeight

/** Top edge of the row for `pitch`. */
export const pitchTopY = (pitch: number, vp: Viewport) =>
  RULER_H + (vp.scrollPitch - pitch - 1) * vp.rowHeight

export const yToPitch = (y: number, vp: Viewport) =>
  Math.floor(vp.scrollPitch - (y - RULER_H) / vp.rowHeight)

export const noteRect = (note: Pick<Note, 'pitch' | 'start' | 'duration'>, vp: Viewport): Rect => ({
  x: tickToX(note.start, vp),
  y: pitchTopY(note.pitch, vp),
  w: Math.max(2, note.duration * vp.pxPerTick),
  h: vp.rowHeight,
})

export const pointInRect = (x: number, y: number, r: Rect) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export function hitNote(
  notes: Note[],
  x: number,
  y: number,
  vp: Viewport,
): Note | null {
  const slack = Math.min(3, vp.rowHeight / 3)
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const r = noteRect(notes[i], vp)
    if (
      x >= r.x - slack &&
      x <= r.x + r.w + slack &&
      y >= r.y &&
      y <= r.y + r.h
    ) {
      return notes[i]
    }
  }
  return null
}

export function edgeAt(note: Note, x: number, vp: Viewport): 'l' | 'r' | null {
  const r = noteRect(note, vp)
  if (r.w < 14) return null
  if (Math.abs(x - r.x) <= EDGE_GRAB) return 'l'
  if (Math.abs(x - (r.x + r.w)) <= EDGE_GRAB) return 'r'
  return null
}

export function visiblePitchRange(vp: Viewport) {
  const top = Math.ceil(vp.scrollPitch)
  const bottom = Math.floor(vp.scrollPitch - (vp.height - RULER_H) / vp.rowHeight)
  return { top, bottom }
}

export function visibleTickRange(vp: Viewport) {
  return {
    start: vp.scrollTicks,
    end: vp.scrollTicks + Math.max(0, vp.width - KEY_W) / vp.pxPerTick,
  }
}

export function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}
