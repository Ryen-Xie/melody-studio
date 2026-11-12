import type { Note, Project, TimeSignature } from '../../types'
import type { Viewport } from '../../store/ui'
import { isBlackKey, pitchClass, pitchLabel } from '../../lib/pitch'
import { CHORD_INTERVALS, chordLabel } from '../../lib/theory'
import { barTicks, ticksPerBeat } from '../../lib/ticks'
import {
  KEY_W,
  RULER_H,
  noteRect,
  pitchTopY,
  tickToX,
  visiblePitchRange,
  visibleTickRange,
  type Rect,
} from './geometry'

export interface Palette {
  bg: string
  rowWhite: string
  rowBlack: string
  rowScale: string
  octaveLine: string
  gridBar: string
  gridBeat: string
  gridSub: string
  keyWhite: string
  keyBlack: string
  keyLine: string
  keyText: string
  keyTextDim: string
  rulerBg: string
  rulerText: string
  rulerSub: string
  note: string
  noteOut: string
  noteEdge: string
  noteSelected: string
  playhead: string
  accent: string
  accentSoft: string
  loopFill: string
  chord: string
  chordBg: string
  dim: string
  shadow: string
}

export const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#0b0c10',
    rowWhite: '#111318',
    rowBlack: '#0c0e13',
    rowScale: 'rgba(141,123,245,0.055)',
    octaveLine: 'rgba(255,255,255,0.09)',
    gridBar: 'rgba(255,255,255,0.13)',
    gridBeat: 'rgba(255,255,255,0.06)',
    gridSub: 'rgba(255,255,255,0.028)',
    keyWhite: '#c9ced8',
    keyBlack: '#171a20',
    keyLine: '#0a0b0e',
    keyText: '#4b5160',
    keyTextDim: '#8a90a0',
    rulerBg: '#0d0f13',
    rulerText: '#8c93a2',
    rulerSub: '#565d6c',
    note: '#8d7bf5',
    noteOut: '#6b7186',
    noteEdge: 'rgba(0,0,0,0.35)',
    noteSelected: '#ffffff',
    playhead: '#f0b429',
    accent: '#8d7bf5',
    accentSoft: 'rgba(141,123,245,0.16)',
    loopFill: 'rgba(0,0,0,0.28)',
    chord: '#b3a7ff',
    chordBg: 'rgba(141,123,245,0.05)',
    dim: 'rgba(0,0,0,0.35)',
    shadow: 'rgba(0,0,0,0.5)',
  },
  light: {
    bg: '#fbfbfd',
    rowWhite: '#ffffff',
    rowBlack: '#f1f2f6',
    rowScale: 'rgba(108,88,234,0.055)',
    octaveLine: 'rgba(20,24,40,0.14)',
    gridBar: 'rgba(20,24,40,0.16)',
    gridBeat: 'rgba(20,24,40,0.075)',
    gridSub: 'rgba(20,24,40,0.035)',
    keyWhite: '#ffffff',
    keyBlack: '#242830',
    keyLine: '#d6d8e0',
    keyText: '#6c7280',
    keyTextDim: '#9aa0ad',
    rulerBg: '#f6f6fa',
    rulerText: '#6a7180',
    rulerSub: '#9aa0ad',
    note: '#6c58ea',
    noteOut: '#98a0b4',
    noteEdge: 'rgba(40,30,90,0.25)',
    noteSelected: '#1c1636',
    playhead: '#d2910a',
    accent: '#6c58ea',
    accentSoft: 'rgba(108,88,234,0.14)',
    loopFill: 'rgba(255,255,255,0.6)',
    chord: '#5b47d6',
    chordBg: 'rgba(108,88,234,0.06)',
    dim: 'rgba(255,255,255,0.45)',
    shadow: 'rgba(30,32,50,0.16)',
  },
}

export interface DrawState {
  vp: Viewport
  project: Project
  notes: Note[]
  selected: Set<string>
  hoverId: string | null
  theme: 'dark' | 'light'
  showScaleGuide: boolean
  showChords: boolean
  scalePcs: Set<number>
  palette?: Palette
}

export interface OverlayState {
  vp: Viewport
  playhead: number | null
  marquee: Rect | null
  ghost: Rect | null
  hoverId: string | null
  snapGuideX: number | null
  playingTick: number | null
  loopPreview?: { a: number; b: number } | null
  project: Project
  notes: Note[]
  theme: 'dark' | 'light'
  selected: Set<string>
}

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.max(0, Math.min(r, h / 2, w / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

export function drawBase(ctx: CanvasRenderingContext2D, s: DrawState) {
  const { vp, project } = s
  const p = s.palette ?? PALETTES[s.theme]
  const ts: TimeSignature = project.timeSignature
  const { top, bottom } = visiblePitchRange(vp)
  const view = visibleTickRange(vp)

  ctx.clearRect(0, 0, vp.width, vp.height)
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, vp.width, vp.height)

  /* ---------- rows ---------- */
  ctx.save()
  ctx.beginPath()
  ctx.rect(KEY_W, RULER_H, vp.width - KEY_W, vp.height - RULER_H)
  ctx.clip()

  for (let pitch = top; pitch >= bottom; pitch -= 1) {
    const y = pitchTopY(pitch, vp)
    if (y > vp.height || y + vp.rowHeight < RULER_H) continue
    const black = isBlackKey(pitch)
    ctx.fillStyle = black ? p.rowBlack : p.rowWhite
    ctx.fillRect(KEY_W, y, vp.width - KEY_W, Math.ceil(vp.rowHeight) + 0.5)
    if (s.showScaleGuide && s.scalePcs.has(pitchClass(pitch))) {
      ctx.fillStyle = p.rowScale
      ctx.fillRect(KEY_W, y, vp.width - KEY_W, Math.ceil(vp.rowHeight) + 0.5)
    }
    if (pitchClass(pitch) === 0) {
      ctx.fillStyle = p.octaveLine
      ctx.fillRect(KEY_W, y + vp.rowHeight - 1, vp.width - KEY_W, 1)
    }
  }

  /* ---------- chord bands ---------- */
  if (s.showChords) {
    for (const chord of project.chords) {
      const x = tickToX(chord.start, vp)
      const w = chord.duration * vp.pxPerTick
      if (x + w < KEY_W || x > vp.width) continue
      ctx.fillStyle = p.chordBg
      ctx.fillRect(x, RULER_H, w, vp.height - RULER_H)
    }
  }

  /* ---------- grid lines ---------- */
  const barLen = barTicks(ts)
  const beatLen = ticksPerBeat(ts.denominator)
  let step = beatLen / 4
  while (step * vp.pxPerTick < 6) step *= 2

  const first = Math.floor(view.start / step) * step
  for (let t = first; t <= view.end + step; t += step) {
    const x = Math.round(tickToX(t, vp)) + 0.5
    if (x < KEY_W) continue
    const isBar = Math.abs(t % barLen) < 0.001
    const isBeat = Math.abs(t % beatLen) < 0.001
    ctx.fillStyle = isBar ? p.gridBar : isBeat ? p.gridBeat : p.gridSub
    ctx.fillRect(x, RULER_H, isBar ? 1.4 : 1, vp.height - RULER_H)
  }

  /* ---------- project end ---------- */
  const endX = tickToX(barLen * project.bars, vp)
  if (endX > KEY_W && endX < vp.width) {
    ctx.fillStyle = p.dim
    ctx.fillRect(endX, RULER_H, vp.width - endX, vp.height - RULER_H)
    ctx.fillStyle = p.gridBar
    ctx.fillRect(endX, RULER_H, 1.5, vp.height - RULER_H)
  }

  /* ---------- loop shading ---------- */
  if (project.loop.enabled) {
    const a = tickToX(project.loop.start, vp)
    const b = tickToX(project.loop.end, vp)
    ctx.fillStyle = p.loopFill
    if (a > KEY_W) ctx.fillRect(KEY_W, RULER_H, a - KEY_W, vp.height - RULER_H)
    if (b < vp.width) ctx.fillRect(b, RULER_H, vp.width - b, vp.height - RULER_H)
  }

  /* ---------- notes ---------- */
  for (const note of s.notes) {
    const r = noteRect(note, vp)
    if (r.x + r.w < KEY_W || r.x > vp.width) continue
    if (r.y > vp.height || r.y + r.h < RULER_H) continue

    const inScale = s.scalePcs.has(pitchClass(note.pitch))
    const selected = s.selected.has(note.id)
    const hovered = s.hoverId === note.id
    const vel = Math.max(0.15, Math.min(1, note.velocity / 127))

    ctx.save()
    if (selected) {
      ctx.shadowColor = s.theme === 'dark' ? p.note : 'rgba(90,70,230,0.5)'
      ctx.shadowBlur = 10
    }
    const color = inScale || !s.showScaleGuide ? p.note : p.noteOut
    ctx.globalAlpha = selected ? 0.98 : 0.55 + 0.42 * vel
    ctx.fillStyle = color
    roundRect(ctx, r.x + 0.5, r.y + 1, r.w - 1, r.h - 2.5, Math.min(4, vp.rowHeight * 0.28))
    ctx.fill()
    ctx.restore()

    /* a thin top light gives the note a little depth */
    if (r.h > 8 && r.w > 6) {
      ctx.globalAlpha = selected ? 0.5 : 0.28
      ctx.fillStyle = s.theme === 'dark' ? '#ffffff' : '#ffffff'
      roundRect(ctx, r.x + 1.5, r.y + 1.8, r.w - 3, 1, 0.5)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    if (selected || hovered) {
      ctx.strokeStyle = selected ? p.noteSelected : color
      ctx.globalAlpha = selected ? 0.9 : 0.55
      ctx.lineWidth = selected ? 1.4 : 1
      roundRect(ctx, r.x + 0.75, r.y + 1.25, r.w - 1.5, r.h - 3, Math.min(4, vp.rowHeight * 0.28))
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    /* notes that belong to the chord under them get a quiet marker */
    const chord = project.chords.find(
      (c) => note.start >= c.start && note.start < c.start + c.duration,
    )
    if (chord) {
      const isTone = CHORD_INTERVALS[chord.quality].some(
        (i) => (chord.root + i) % 12 === pitchClass(note.pitch),
      )
      if (isTone) {
        ctx.globalAlpha = 0.75
        ctx.fillStyle = p.chord
        ctx.fillRect(r.x + 2, r.y + 3.5, 2, Math.max(2, r.h - 7))
        ctx.globalAlpha = 1
      }
    }

    if (selected && r.w > 16) {
      ctx.fillStyle = p.noteSelected
      ctx.globalAlpha = 0.75
      const handleH = Math.max(4, Math.min(9, vp.rowHeight - 8))
      ctx.fillRect(r.x + 2.5, r.y + (r.h - handleH) / 2, 2, handleH)
      ctx.fillRect(r.x + r.w - 4.5, r.y + (r.h - handleH) / 2, 2, handleH)
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()

  /* ---------- keyboard ---------- */
  ctx.fillStyle = p.keyBlack
  ctx.fillRect(0, RULER_H, KEY_W, vp.height - RULER_H)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, RULER_H, KEY_W, vp.height - RULER_H)
  ctx.clip()
  for (let pitch = top; pitch >= bottom; pitch -= 1) {
    const y = pitchTopY(pitch, vp)
    const black = isBlackKey(pitch)
    ctx.fillStyle = black ? p.keyBlack : p.keyWhite
    ctx.fillRect(0, y, KEY_W - (black ? 26 : 0), Math.ceil(vp.rowHeight) + 0.5)
    if (black) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(KEY_W - 26, y, 26, Math.ceil(vp.rowHeight) + 0.5)
    }
    ctx.fillStyle = p.keyLine
    ctx.fillRect(0, y + vp.rowHeight - 1, KEY_W, 1)
    if (pitchClass(pitch) === 0) {
      ctx.fillStyle = p.keyText
      ctx.font = `600 9.5px ${FONT}`
      ctx.textBaseline = 'middle'
      ctx.fillText(pitchLabel(pitch), 8, y + vp.rowHeight / 2)
    }
  }
  ctx.restore()

  ctx.fillStyle = p.keyLine
  ctx.fillRect(KEY_W - 1, RULER_H, 1, vp.height - RULER_H)

  /* ---------- ruler ---------- */
  ctx.fillStyle = p.rulerBg
  ctx.fillRect(0, 0, vp.width, RULER_H)
  ctx.fillStyle = p.keyLine
  ctx.fillRect(0, RULER_H - 1, vp.width, 1)

  ctx.save()
  ctx.beginPath()
  ctx.rect(KEY_W, 0, vp.width - KEY_W, RULER_H)
  ctx.clip()

  ctx.font = `600 10.5px ${FONT}`
  ctx.textBaseline = 'middle'
  const barPx = barLen * vp.pxPerTick
  const barStart = Math.floor(view.start / barLen) * barLen
  for (let t = barStart; t <= view.end + barLen; t += barLen) {
    const x = tickToX(t, vp)
    ctx.fillStyle = p.gridBar
    ctx.fillRect(Math.round(x) + 0.5, 8, 1, RULER_H - 8)
    const bar = Math.floor(t / barLen) + 1
    ctx.fillStyle = p.rulerText
    ctx.fillText(String(bar), x + 6, 16)

    if (barPx > 96) {
      for (let b = 1; b < ts.numerator; b += 1) {
        const bx = x + b * beatLen * vp.pxPerTick
        ctx.fillStyle = p.rulerSub
        ctx.fillRect(Math.round(bx) + 0.5, RULER_H - 7, 1, 6)
      }
    }
  }

  if (s.showChords) {
    for (const chord of project.chords) {
      const x = tickToX(chord.start, vp)
      if (x + 20 < KEY_W || x > vp.width) continue
      const label = chordLabel(chord)
      ctx.font = `600 9.5px ${FONT}`
      const w = ctx.measureText(label).width + 10
      ctx.fillStyle = p.accentSoft
      roundRect(ctx, x + 4, RULER_H - 15, w, 13, 4)
      ctx.fill()
      ctx.fillStyle = p.chord
      ctx.fillText(label, x + 9, RULER_H - 8)
    }
  }
  ctx.restore()

  /* corner */
  ctx.fillStyle = p.rulerBg
  ctx.fillRect(0, 0, KEY_W, RULER_H)
  ctx.fillStyle = p.rulerSub
  ctx.font = `600 9px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillText('KEY', 10, RULER_H / 2)
  const keyName = project.keyMode === 'major' ? 'maj' : 'min'
  ctx.fillStyle = p.keyTextDim
  ctx.fillText(
    `${pitchLabel(project.keyRoot + 60).replace(/\d+$/, '')} ${keyName}`,
    36,
    RULER_H / 2,
  )
  ctx.fillStyle = p.keyLine
  ctx.fillRect(0, RULER_H - 1, KEY_W, 1)
  ctx.fillRect(KEY_W - 1, 0, 1, RULER_H)

  /* loop braces in ruler */
  if (project.loop.enabled) {
    const a = Math.max(KEY_W, tickToX(project.loop.start, vp))
    const b = Math.min(vp.width, tickToX(project.loop.end, vp))
    if (b > a) {
      ctx.fillStyle = p.accent
      ctx.globalAlpha = 0.85
      ctx.fillRect(a, RULER_H - 3, b - a, 2)
      ctx.fillRect(a, RULER_H - 8, 2, 5)
      ctx.fillRect(b - 2, RULER_H - 8, 2, 5)
      ctx.globalAlpha = 1
    }
  }
}

export function drawOverlay(ctx: CanvasRenderingContext2D, s: OverlayState) {
  const vp = s.vp
  const p = PALETTES[s.theme]
  ctx.clearRect(0, 0, vp.width, vp.height)

  /* sounding notes glow — on the note and on its piano key */
  if (s.playingTick !== null) {
    for (const note of s.notes) {
      if (s.playingTick < note.start || s.playingTick >= note.start + note.duration) continue
      const r = noteRect(note, vp)
      if (r.x + r.w >= KEY_W) {
        ctx.fillStyle = s.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'
        roundRect(ctx, r.x, r.y + 1, r.w, r.h - 2.5, 3)
        ctx.fill()
      }
      const keyY = pitchTopY(note.pitch, vp)
      if (keyY + vp.rowHeight > RULER_H && keyY < vp.height) {
        ctx.fillStyle = p.accent
        ctx.globalAlpha = 0.55
        ctx.fillRect(0, keyY + 0.5, KEY_W - 2, Math.max(2, vp.rowHeight - 1.5))
        ctx.globalAlpha = 1
      }
    }
  }

  if (s.ghost) {
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 1.2
    ctx.strokeStyle = p.accent
    ctx.fillStyle = p.accentSoft
    roundRect(ctx, s.ghost.x, s.ghost.y, s.ghost.w, s.ghost.h, 3)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  if (s.snapGuideX !== null && s.snapGuideX > KEY_W) {
    ctx.save()
    ctx.setLineDash([3, 4])
    ctx.strokeStyle = p.accent
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.moveTo(s.snapGuideX + 0.5, RULER_H)
    ctx.lineTo(s.snapGuideX + 0.5, vp.height)
    ctx.stroke()
    ctx.restore()
  }

  if (s.loopPreview) {
    const a = Math.max(KEY_W, tickToX(Math.min(s.loopPreview.a, s.loopPreview.b), vp))
    const b = Math.min(vp.width, tickToX(Math.max(s.loopPreview.a, s.loopPreview.b), vp))
    if (b > a) {
      ctx.fillStyle = p.accentSoft
      ctx.fillRect(a, RULER_H, b - a, vp.height - RULER_H)
      ctx.fillStyle = p.accent
      ctx.globalAlpha = 0.9
      ctx.fillRect(a, RULER_H - 3, b - a, 2)
      ctx.fillRect(a, RULER_H - 8, 2, 5)
      ctx.fillRect(b - 2, RULER_H - 8, 2, 5)
      ctx.globalAlpha = 1
    }
  }

  if (s.marquee) {
    ctx.fillStyle = p.accentSoft
    ctx.fillRect(s.marquee.x, s.marquee.y, s.marquee.w, s.marquee.h)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1
    ctx.strokeRect(s.marquee.x + 0.5, s.marquee.y + 0.5, s.marquee.w, s.marquee.h)
  }

  if (s.playhead !== null) {
    const x = tickToX(s.playhead, vp)
    if (x >= KEY_W && x <= vp.width) {
      ctx.save()
      ctx.shadowColor = p.playhead
      ctx.shadowBlur = 8
      ctx.fillStyle = p.playhead
      ctx.fillRect(x - 0.75, RULER_H - 2, 1.5, vp.height - RULER_H + 2)
      ctx.restore()

      ctx.fillStyle = p.playhead
      ctx.beginPath()
      ctx.moveTo(x - 5, 0)
      ctx.lineTo(x + 5, 0)
      ctx.lineTo(x, 7)
      ctx.closePath()
      ctx.fill()
    }
  }
}
