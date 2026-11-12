import { useEffect, useRef, useState } from 'react'
import { Copy, Eraser, Maximize2, Minus, Music2, Plus, Trash2 } from 'lucide-react'
import { engine } from '../../audio/engine'
import { useProjectStore } from '../../store/project'
import { useUiStore } from '../../store/ui'
import type { Note } from '../../types'
import { MIN_NOTE, snapTicks } from '../../lib/snap'
import { barTicks, clamp, snapFloor, snapRound } from '../../lib/ticks'
import { MAX_PITCH, MIN_PITCH, pitchClass, pitchLabel } from '../../lib/pitch'
import { scalePitchClasses } from '../../lib/theory'
import { PALETTES, drawBase, drawOverlay } from './draw'
import {
  KEY_W,
  RULER_H,
  edgeAt,
  hitNote,
  noteRect,
  pitchTopY,
  rectFromPoints,
  rectsIntersect,
  tickToX,
  xToTick,
  yToPitch,
} from './geometry'
import { keyState } from '../../lib/keyState'
import { SKETCHES, buildSketch } from '../../lib/sketch'

type Drag =
  | { kind: 'pan'; x: number; y: number; scrollTicks: number; scrollPitch: number }
  | { kind: 'marquee'; a: { x: number; y: number }; b: { x: number; y: number }; add: boolean }
  | { kind: 'move'; ids: string[]; origin: Note[]; anchor: Note; dx: number; dy: number; moved: boolean }
  | { kind: 'resize'; id: string; edge: 'l' | 'r'; origin: Note; start: number; duration: number }
  | { kind: 'create'; start: number; pitch: number; duration: number; moved: boolean }
  | { kind: 'erase' }
  | { kind: 'loop'; a: number; b: number }
  | { kind: 'scrub' }
  | { kind: 'keys'; pitch: number }
  | null

interface ContextMenuState {
  x: number
  y: number
  noteId: string
}

const SNAP_VALUES = ['off', '1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T', '1/8.', '1/16.']

export function PianoRoll() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  const dirtyBase = useRef(true)
  const dragRef = useRef<Drag>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const hoverRef = useRef<string | null>(null)
  const snapGuideRef = useRef<number | null>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [cursor, setCursor] = useState('crosshair')

  const tool = useUiStore((s) => s.tool)
  const snap = useUiStore((s) => s.snap)
  const vp = useUiStore((s) => s.viewport)
  const scaleSnap = useUiStore((s) => s.scaleSnap)
  const showScaleGuide = useUiStore((s) => s.showScaleGuide)
  const showChords = useUiStore((s) => s.showChords)
  const setSnap = useUiStore((s) => s.setSnap)
  const notify = useUiStore((s) => s.notify)

  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedIds)

  const totalTicks = barTicks(project.timeSignature) * project.bars

  /* ------------------------------------------------------------ drawing */

  const transformNotes = (list: Note[]): Note[] => {
    const d = dragRef.current
    if (!d || d.kind !== 'move') return list
    const map = new Map(d.origin.map((n) => [n.id, n]))
    const proj = useProjectStore.getState().project
    const limit = barTicks(proj.timeSignature) * proj.bars
    return list.map((n) => {
      const o = map.get(n.id)
      if (!o) return n
      return {
        ...n,
        start: clamp(0, Math.max(0, limit - n.duration), o.start + d.dx),
        pitch: clamp(MIN_PITCH, MAX_PITCH, o.pitch + d.dy),
      }
    })
  }

  const drawBaseNow = () => {
    const canvas = baseRef.current
    if (!canvas) return
    const st = useUiStore.getState()
    const proj = useProjectStore.getState().project
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.max(1, Math.round(st.viewport.width * dpr))
    const H = Math.max(1, Math.round(st.viewport.height * dpr))
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawBase(ctx, {
      vp: st.viewport,
      project: proj,
      notes: transformNotes(proj.notes),
      selected: new Set(useProjectStore.getState().selectedIds),
      hoverId: hoverRef.current,
      theme: st.theme,
      showScaleGuide: st.showScaleGuide,
      showChords: st.showChords,
      scalePcs: scalePitchClasses(proj.keyRoot, proj.keyMode),
      palette: PALETTES[st.theme],
    })
  }

  const drawOverlayNow = () => {
    const canvas = overlayRef.current
    if (!canvas) return
    const st = useUiStore.getState()
    const proj = useProjectStore.getState().project
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.max(1, Math.round(st.viewport.width * dpr))
    const H = Math.max(1, Math.round(st.viewport.height * dpr))
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const d = dragRef.current
    let marquee = null
    let ghost = null
    let loopPreview = null

    if (d?.kind === 'marquee') {
      marquee = rectFromPoints(d.a.x, d.a.y, d.b.x, d.b.y)
    } else if (d?.kind === 'create') {
      ghost = {
        x: tickToX(d.start, st.viewport),
        y: pitchTopY(d.pitch, st.viewport) + 1,
        w: Math.max(3, d.duration * st.viewport.pxPerTick),
        h: st.viewport.rowHeight - 2.5,
      }
    } else if (d?.kind === 'loop') {
      loopPreview = { a: d.a, b: d.b }
    }

    const playhead = engine.positionTicks
    drawOverlay(ctx, {
      vp: st.viewport,
      playhead,
      playingTick: engine.isPlaying ? playhead : null,
      marquee,
      ghost,
      loopPreview,
      hoverId: hoverRef.current,
      snapGuideX: snapGuideRef.current,
      project: proj,
      notes: transformNotes(proj.notes),
      theme: st.theme,
      selected: new Set(useProjectStore.getState().selectedIds),
    })
  }

  /* ------------------------------------------------------------ effects */

  useEffect(() => {
    setCursor(tool === 'draw' ? 'crosshair' : tool === 'pan' ? 'grab' : 'default')
  }, [tool])

  useEffect(() => {
    const markDirty = () => {
      dirtyBase.current = true
    }
    const unsubProject = useProjectStore.subscribe(markDirty)
    const unsubUi = useUiStore.subscribe(markDirty)
    return () => {
      unsubProject()
      unsubUi()
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      useUiStore.getState().setViewportSize(box.width, box.height)
      dirtyBase.current = true
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const drawRef = useRef({ drawBaseNow, drawOverlayNow })
  drawRef.current = { drawBaseNow, drawOverlayNow }

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const st = useUiStore.getState()

      if (engine.isPlaying) {
        const tick = engine.positionTicks
        const x = tickToX(tick, st.viewport)
        if (x > st.viewport.width - 40 || x < KEY_W + 2) {
          st.setScroll({
            scrollTicks: Math.max(
              0,
              tick - (st.viewport.width - KEY_W) * 0.15 / st.viewport.pxPerTick,
            ),
          })
          dirtyBase.current = true
        }
      }

      if (dirtyBase.current) {
        dirtyBase.current = false
        drawRef.current.drawBaseNow()
      }
      drawRef.current.drawOverlayNow()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const st = useUiStore.getState()
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.altKey) st.zoomYAt(Math.exp(-e.deltaY * 0.0022), y, RULER_H)
        else st.zoomXAt(Math.exp(-e.deltaY * 0.0022), x, KEY_W)
      } else if (e.altKey) {
        e.preventDefault()
        st.zoomYAt(Math.exp(-e.deltaY * 0.0022), y, RULER_H)
      } else if (e.shiftKey) {
        e.preventDefault()
        st.setScroll({ scrollTicks: st.viewport.scrollTicks + e.deltaY / st.viewport.pxPerTick })
      } else {
        e.preventDefault()
        st.setScroll({
          scrollTicks: st.viewport.scrollTicks + (e.deltaX + (e.shiftKey ? e.deltaY : 0)) / st.viewport.pxPerTick,
          scrollPitch: st.viewport.scrollPitch - e.deltaY / st.viewport.rowHeight,
        })
      }
      dirtyBase.current = true
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) {
        keyState.space = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        keyState.space = false
        setTimeout(() => {
          keyState.spaceUsedForDrag = false
        }, 0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (contextMenu && !(e.target as HTMLElement).closest('.dropdown')) setContextMenu(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [contextMenu])

  /* ------------------------------------------------------------ helpers */

  const getPos = (e: { clientX: number; clientY: number }) => {
    const rect = baseRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }

  const stepFor = (shift: boolean) =>
    shift ? 0 : snapTicks(useUiStore.getState().snap, project.timeSignature)

  const snapPitch = (pitch: number, enabled = useUiStore.getState().scaleSnap) => {
    if (!enabled) return pitch
    const pcs = scalePitchClasses(project.keyRoot, project.keyMode)
    for (let d = 0; d < 7; d += 1) {
      if (pcs.has(pitchClass(pitch - d))) return pitch - d
      if (pcs.has(pitchClass(pitch + d))) return pitch + d
    }
    return pitch
  }

  const eraseAt = (x: number, y: number) => {
    const st = useUiStore.getState()
    const store = useProjectStore.getState()
    const note = hitNote(store.project.notes, x, y, st.viewport)
    if (note) {
      store.removeNotes([note.id])
      dirtyBase.current = true
    }
  }

  /* ------------------------------------------------------------ pointer */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return
    const { x, y } = getPos(e)
    dragStart.current = { x, y }
    const st = useUiStore.getState()
    const store = useProjectStore.getState()
    keyState.spaceUsedForDrag = false
    setContextMenu(null)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic pointers (tests) have no capture target */
    }

    if (e.button === 1) e.preventDefault()

    if (e.button === 1 || st.tool === 'pan' || keyState.space) {
      if (keyState.space) keyState.spaceUsedForDrag = true
      dragRef.current = {
        kind: 'pan',
        x,
        y,
        scrollTicks: st.viewport.scrollTicks,
        scrollPitch: st.viewport.scrollPitch,
      }
      setCursor('grabbing')
      return
    }

    if (y < RULER_H) {
      if (x < KEY_W) return
      const tick = Math.max(0, xToTick(x, st.viewport))
      if (e.shiftKey) {
        dragRef.current = { kind: 'loop', a: tick, b: tick }
      } else {
        engine.seek(tick)
        dragRef.current = { kind: 'scrub' }
      }
      return
    }

    if (x < KEY_W) {
      const pitch = clamp(MIN_PITCH, MAX_PITCH, yToPitch(y, st.viewport))
      void engine.previewAttack(pitch, 105)
      dragRef.current = { kind: 'keys', pitch }
      return
    }

    const note = hitNote(store.project.notes, x, y, st.viewport)
    const step = stepFor(e.shiftKey)

    if (st.tool === 'erase') {
      if (note) store.removeNotes([note.id])
      dragRef.current = { kind: 'erase' }
      dirtyBase.current = true
      return
    }

    if (note) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey

      if (e.altKey) {
        const ids = store.selectedIds.includes(note.id) ? store.selectedIds : [note.id]
        const copies = store.project.notes
          .filter((n) => ids.includes(n.id))
          .map((n) => ({ pitch: n.pitch, start: n.start, duration: n.duration, velocity: n.velocity }))
        const newIds = store.addNotes(copies)
        store.select(newIds)
        const origin = useProjectStore
          .getState()
          .project.notes.filter((n) => newIds.includes(n.id))
        dragRef.current = {
          kind: 'move',
          ids: newIds,
          origin,
          anchor: origin.find((n) => n.pitch === note.pitch) ?? origin[0],
          dx: 0,
          dy: 0,
          moved: true,
        }
        dirtyBase.current = true
        return
      }

      if (additive) {
        const wasSelected = store.selectedIds.includes(note.id)
        store.toggleSelect(note.id, true)
        if (wasSelected) {
          dirtyBase.current = true
          return
        }
      } else if (!store.selectedIds.includes(note.id)) {
        store.select([note.id])
      }

      const ids = useProjectStore.getState().selectedIds
      const edge = ids.length <= 1 ? edgeAt(note, x, st.viewport) : null

      if (edge) {
        dragRef.current = {
          kind: 'resize',
          id: note.id,
          edge,
          origin: { ...note },
          start: note.start,
          duration: note.duration,
        }
        setCursor('ew-resize')
      } else {
        const origin = store.project.notes.filter((n) => ids.includes(n.id))
        dragRef.current = {
          kind: 'move',
          ids,
          origin,
          anchor: origin.find((n) => n.id === note.id) ?? note,
          dx: 0,
          dy: 0,
          moved: false,
        }
        setCursor('grabbing')
      }
      dirtyBase.current = true
      return
    }

    if (st.tool === 'select') {
      dragRef.current = {
        kind: 'marquee',
        a: { x, y },
        b: { x, y },
        add: e.shiftKey,
      }
      if (!e.shiftKey) store.clearSelection()
      return
    }

    /* draw */
    const rawTick = Math.max(0, xToTick(x, st.viewport))
    const start = clamp(0, Math.max(0, totalTicks - MIN_NOTE), snapFloor(rawTick, step))
    const pitch = snapPitch(clamp(MIN_PITCH, MAX_PITCH, yToPitch(y, st.viewport)))
    const defaultLen = step > 0 ? step : 240
    void engine.preview(
      pitch,
      100,
      Math.min(2, (defaultLen / 480) * (60 / project.bpm) + 0.55),
    )
    dragRef.current = { kind: 'create', start, pitch, duration: defaultLen, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = getPos(e)
    const st = useUiStore.getState()
    const store = useProjectStore.getState()
    const d = dragRef.current

    if (!d) {
      if (y < RULER_H) {
        setCursor(x > KEY_W ? 'text' : 'default')
      } else if (x < KEY_W) {
        setCursor('pointer')
      } else {
        const note = hitNote(store.project.notes, x, y, st.viewport)
        hoverRef.current = note?.id ?? null
        if (st.tool === 'erase') setCursor(note ? 'not-allowed' : 'default')
        else if (note) setCursor(edgeAt(note, x, st.viewport) ? 'ew-resize' : 'grab')
        else setCursor(st.tool === 'select' ? 'default' : 'crosshair')
        drawOverlayNow()
      }
      return
    }

    const dxPx = x - dragStart.current.x
    const dyRows = Math.round((y - dragStart.current.y) / st.viewport.rowHeight)
    const step = stepFor(e.shiftKey)

    switch (d.kind) {
      case 'pan': {
        st.setScroll({
          scrollTicks: Math.max(0, d.scrollTicks - (x - d.x) / st.viewport.pxPerTick),
          scrollPitch: d.scrollPitch + (y - d.y) / st.viewport.rowHeight,
        })
        break
      }
      case 'scrub': {
        engine.seek(Math.max(0, xToTick(x, st.viewport)))
        break
      }
      case 'keys': {
        const pitch = clamp(MIN_PITCH, MAX_PITCH, yToPitch(y, st.viewport))
        if (pitch !== d.pitch) {
          engine.previewRelease(d.pitch)
          d.pitch = pitch
          void engine.previewAttack(pitch, 105)
        }
        break
      }
      case 'marquee': {
        d.b = { x, y }
        break
      }
      case 'create': {
        const tick = Math.max(0, xToTick(x, st.viewport))
        const end = step > 0 ? snapRound(tick, step) : tick
        const minLen = step > 0 ? step : 60
        d.duration = clamp(minLen, Math.max(minLen, totalTicks - d.start), Math.max(minLen, end - d.start))
        d.moved = Math.abs(dxPx) > 3
        snapGuideRef.current = tickToX(d.start, st.viewport)
        break
      }
      case 'move': {
        const raw = d.anchor.start + dxPx / st.viewport.pxPerTick
        const snapped = step > 0 ? snapRound(raw, step) : raw
        d.dx = snapped - d.anchor.start
        let dy = -dyRows
        if (st.scaleSnap) dy = snapPitch(d.anchor.pitch + dy) - d.anchor.pitch
        if (dy !== d.dy) void engine.preview(clamp(MIN_PITCH, MAX_PITCH, d.anchor.pitch + dy))
        d.dy = dy
        d.moved = Math.abs(dxPx) > 2 || dyRows !== 0
        snapGuideRef.current = tickToX(snapped, st.viewport)
        break
      }
      case 'resize': {
        if (d.edge === 'r') {
          const raw = d.origin.duration + dxPx / st.viewport.pxPerTick
          d.duration = clamp(
            MIN_NOTE,
            Math.max(MIN_NOTE, totalTicks - d.origin.start),
            step > 0 ? snapRound(raw, step) : raw,
          )
        } else {
          const raw = d.origin.start + dxPx / st.viewport.pxPerTick
          const maxStart = d.origin.start + d.origin.duration - MIN_NOTE
          const next = clamp(0, maxStart, step > 0 ? snapFloor(raw, step) : raw)
          d.start = next
          d.duration = d.origin.start + d.origin.duration - next
        }
        break
      }
      case 'erase': {
        eraseAt(x, y)
        break
      }
      case 'loop': {
        d.b = Math.max(0, xToTick(x, st.viewport))
        break
      }
    }

    if (d.kind === 'move' || d.kind === 'resize') dirtyBase.current = true
    drawOverlayNow()
  }

  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    snapGuideRef.current = null
    setCursor(useUiStore.getState().tool === 'draw' ? 'crosshair' : 'default')

    if (!d) {
      dirtyBase.current = true
      return
    }

    const st = useUiStore.getState()
    const store = useProjectStore.getState()

    if (d.kind === 'keys') engine.previewRelease(d.pitch)

    if (d.kind === 'loop') {
      const a = Math.min(d.a, d.b)
      const b = Math.max(d.a, d.b)
      if (b - a > 60) store.setLoop({ start: a, end: b, enabled: true })
    }

    if (d.kind === 'create') {
      const ids = store.addNotes([
        {
          pitch: d.pitch,
          start: d.start,
          duration: Math.max(MIN_NOTE, d.duration),
          velocity: 100,
        },
      ])
      store.select(ids)
    }

    if (d.kind === 'marquee') {
      const rect = rectFromPoints(d.a.x, d.a.y, d.b.x, d.b.y)
      if (rect.w > 3 || rect.h > 3) {
        const hits = store.project.notes
          .filter((n) => rectsIntersect(rect, noteRect(n, st.viewport)))
          .map((n) => n.id)
        store.select(d.add ? [...new Set([...store.selectedIds, ...hits])] : hits)
      }
    }

    if (d.kind === 'move' && d.moved && (d.dx !== 0 || d.dy !== 0)) {
      store.updateNotes(
        d.origin.map((n) => ({
          id: n.id,
          patch: {
            start: clamp(0, Math.max(0, totalTicks - n.duration), n.start + d.dx),
            pitch: clamp(MIN_PITCH, MAX_PITCH, n.pitch + d.dy),
          },
        })),
      )
    }

    if (d.kind === 'resize') {
      store.updateNotes([
        { id: d.id, patch: { start: d.start, duration: Math.max(MIN_NOTE, d.duration) } },
      ])
    }

    dirtyBase.current = true
    drawOverlayNow()
  }

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getPos(e)
    const st = useUiStore.getState()
    const store = useProjectStore.getState()
    const note = hitNote(store.project.notes, x, y, st.viewport)
    if (!note) return
    store.select([note.id])
    st.setRightOpen(true)
    st.setBottomOpen(true)
    st.setBottomTab('info')
  }

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const { x, y } = getPos(e)
    const st = useUiStore.getState()
    const store = useProjectStore.getState()
    const note = hitNote(store.project.notes, x, y, st.viewport)
    if (!note) {
      setContextMenu(null)
      return
    }
    if (!store.selectedIds.includes(note.id)) store.select([note.id])
    setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id })
  }

  /* ------------------------------------------------------------ toolbar actions */

  const zoomBy = (factor: number) => {
    const st = useUiStore.getState()
    st.zoomXAt(factor, KEY_W + (st.viewport.width - KEY_W) / 2, KEY_W)
    dirtyBase.current = true
  }

  const fit = () => {
    const st = useUiStore.getState()
    const proj = useProjectStore.getState().project
    const pitches = proj.notes.map((n) => n.pitch)
    const box = wrapRef.current?.getBoundingClientRect()
    st.fitToContent({
      totalTicks: barTicks(proj.timeSignature) * proj.bars,
      minPitch: pitches.length ? Math.min(...pitches) : 55,
      maxPitch: pitches.length ? Math.max(...pitches) : 79,
      width: box?.width || st.viewport.width,
      height: box?.height || st.viewport.height,
      keyboardWidth: KEY_W,
      rulerHeight: RULER_H,
    })
    dirtyBase.current = true
  }

  const menuActions = (() => {
    if (!contextMenu) return []
    const store = useProjectStore.getState()
    const note = store.project.notes.find((n) => n.id === contextMenu.noteId)
    if (!note) return []
    return [
      {
        label: 'Duplicate',
        icon: <Copy size={13} />,
        shortcut: 'Ctrl D',
        run: () => store.duplicateSelection(),
      },
      {
        label: 'Select same pitch',
        icon: <Music2 size={13} />,
        run: () =>
          store.select(
            store.project.notes.filter((n) => n.pitch === note.pitch).map((n) => n.id),
          ),
      },
      {
        label: 'Quantize selection',
        icon: <Maximize2 size={13} />,
        run: () => {
          const step = snapTicks(useUiStore.getState().snap, store.project.timeSignature)
          if (step <= 0) {
            notify('Snap is off — pick a grid first')
            return
          }
          store.updateNotes(
            store.selectedIds.map((id) => {
              const n = store.project.notes.find((x) => x.id === id)!
              return {
                id,
                patch: {
                  start: Math.max(0, snapRound(n.start, step)),
                  duration: Math.max(MIN_NOTE, snapRound(n.duration, step)),
                },
              }
            }),
          )
        },
      },
      {
        label: 'Delete',
        icon: <Trash2 size={13} />,
        shortcut: 'Del',
        danger: true,
        run: () => store.removeNotes(store.selectedIds.length ? store.selectedIds : [note.id]),
      },
    ]
  })()

  const isEmpty = project.notes.length === 0
  const chordCount = project.chords.length

  return (
    <div className="roll-wrap">
      <div className="roll-toolbar">
        <div className="chip-group">
          <button className="chip" onClick={() => zoomBy(0.8)} title="Zoom out (Ctrl + wheel)">
            <Minus size={12} />
          </button>
          <button className="chip" onClick={() => zoomBy(1.25)} title="Zoom in (Ctrl + wheel)">
            <Plus size={12} />
          </button>
          <button className="chip" onClick={fit} title="Fit the melody in view">
            Fit
          </button>
        </div>

        <div className="chip-group" style={{ paddingRight: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', padding: '0 4px 0 8px', fontWeight: 600 }}>
            Snap
          </span>
          <select
            className="snap-select"
            value={snap}
            onChange={(e) => setSnap(e.target.value as typeof snap)}
          >
            {SNAP_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === 'off' ? 'Off' : value}
              </option>
            ))}
          </select>
        </div>

        <div className="chip-group">
          <button
            className={`chip ${showScaleGuide ? 'active' : ''}`}
            onClick={() => useUiStore.getState().setShowScaleGuide(!showScaleGuide)}
            title="Tint the rows that belong to the project key"
          >
            In key
          </button>
          <button
            className={`chip ${scaleSnap ? 'active' : ''}`}
            onClick={() => useUiStore.getState().setScaleSnap(!scaleSnap)}
            title="Snap new and moved notes to the project key"
          >
            Key snap
          </button>
          <button
            className={`chip ${showChords ? 'active' : ''}`}
            onClick={() => useUiStore.getState().setShowChords(!showChords)}
            title="Show the chord track"
          >
            Chords{chordCount ? ` ${chordCount}` : ''}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
              {selectedIds.length} selected
            </span>
            <button
              className="icon-btn"
              style={{ width: 24, height: 24, color: 'var(--danger)' }}
              onClick={() => useProjectStore.getState().removeNotes(selectedIds)}
              title="Delete selected notes"
            >
              <Eraser size={13} />
            </button>
          </div>
        )}
        <span className="kbd-hint">Shift bypasses snap</span>
      </div>

      <div
        ref={wrapRef}
        className={`roll-canvas-wrap tool-${tool}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onPointerLeave={() => {
          if (!dragRef.current) {
            hoverRef.current = null
            drawOverlayNow()
          }
        }}
      >
        <canvas ref={baseRef} className="base" />
        <canvas ref={overlayRef} className="overlay" />

        {isEmpty && (
          <div className="roll-empty">
            <h3>Draw your first note</h3>
            <p>
              Click anywhere on the grid — or press and drag to set the length. The piano
              sounds as you go.
            </p>
            <button
              className="btn sm"
              style={{ pointerEvents: 'auto', marginTop: 12 }}
              onClick={() => {
                const style = SKETCHES.find((s) => s.id === 'light') ?? SKETCHES[0]
                const { notes: sketchNotes, chords, bpm } = buildSketch(
                  style,
                  useProjectStore.getState().project,
                )
                useProjectStore.getState().applySketch(sketchNotes, chords, bpm)
              }}
            >
              Start with a 4-bar sketch
            </button>
            <div className="hint" style={{ marginTop: 12 }}>
              A–K plays the piano · Space + drag pans · Ctrl + wheel zooms
            </div>
          </div>
        )}

        <div className="roll-badge">
          <span>
            {pitchLabel(project.keyRoot + 60).replace(/\d+$/, '')} {project.keyMode}
          </span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>
            {project.timeSignature.numerator}/{project.timeSignature.denominator}
          </span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{Math.round(vp.pxPerTick * 480)} px / beat</span>
        </div>
      </div>

      {contextMenu && (
        <div className="dropdown" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {menuActions.map((action) => (
            <button
              key={action.label}
              className="dropdown-item"
              style={action.danger ? { color: 'var(--danger)' } : undefined}
              onClick={() => {
                action.run()
                setContextMenu(null)
              }}
            >
              {action.icon}
              {action.label}
              {action.shortcut && <span className="shortcut">{action.shortcut}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function isTyping() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
