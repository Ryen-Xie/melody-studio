import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { PALETTES } from './roll/draw'
import { KEY_W, noteRect, tickToX } from './roll/geometry'
import { engine } from '../audio/engine'
import { barTicks, formatPosition } from '../lib/ticks'
import { pitchLabel } from '../lib/pitch'
import { keyLabel } from '../lib/theory'
import { useT } from '../lib/i18n'

export function BottomPanel() {
  const t = useT()
  const open = useUiStore((s) => s.bottomOpen)
  const tab = useUiStore((s) => s.bottomTab)
  const height = useUiStore((s) => s.bottomHeight)
  const setOpen = useUiStore((s) => s.setBottomOpen)
  const setTab = useUiStore((s) => s.setBottomTab)
  const setHeight = useUiStore((s) => s.setBottomHeight)

  const dragRef = useRef<{ y: number; h: number } | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      setHeight(dragRef.current.h + (dragRef.current.y - e.clientY))
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [setHeight])

  return (
    <div className="bottom" style={{ height: open ? height : 32 }}>
      <div
        className="bottom-resize"
        onPointerDown={(e) => {
          if (!open) return
          dragRef.current = { y: e.clientY, h: height }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
      />
      <div className="bottom-head">
        <button
          className={`tab ${tab === 'velocity' ? 'active' : ''}`}
          onClick={() => {
            setTab('velocity')
            setOpen(true)
          }}
        >
          {t('bottom.velocity')}
        </button>
        <button
          className={`tab ${tab === 'info' ? 'active' : ''}`}
          onClick={() => {
            setTab('info')
            setOpen(true)
          }}
        >
          {t('bottom.info')}
        </button>
        <div style={{ flex: 1 }} />
        <span className="kbd-hint" style={{ marginRight: 6 }}>
          {open && tab === 'velocity' ? t('bottom.dragHint') : ''}
        </span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {open && (tab === 'velocity' ? <VelocityLane /> : <InfoPanel />)}
    </div>
  )
}

function VelocityLane() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const overrides = useRef<Map<string, number>>(new Map())
  const dirty = useRef(true)
  const dragNote = useRef<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    const markDirty = () => {
      dirty.current = true
    }
    const a = useProjectStore.subscribe(markDirty)
    const b = useUiStore.subscribe(markDirty)
    return () => {
      a()
      b()
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!dirty.current) return
      dirty.current = false
      const canvas = ref.current
      if (!canvas) return
      const st = useUiStore.getState()
      const proj = useProjectStore.getState().project
      const selected = new Set(useProjectStore.getState().selectedIds)
      const vp = st.viewport
      const p = PALETTES[st.theme]
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = p.rulerBg
      ctx.fillRect(0, 0, w, h)

      const pad = 12
      const laneH = h - pad * 2
      const velY = (v: number) => pad + (1 - v / 127) * laneH

      ctx.fillStyle = p.gridBeat
      for (const v of [32, 64, 96]) {
        ctx.fillRect(KEY_W, velY(v), w - KEY_W, 1)
      }
      ctx.fillStyle = p.gridBar
      ctx.fillRect(KEY_W, h - 1, w - KEY_W, 1)

      const barLen = barTicks(proj.timeSignature)
      const view = {
        start: vp.scrollTicks,
        end: vp.scrollTicks + (vp.width - KEY_W) / vp.pxPerTick,
      }
      const step = barLen / 4
      for (let t = Math.floor(view.start / step) * step; t <= view.end; t += step) {
        const x = tickToX(t, vp)
        if (x < KEY_W) continue
        const isBar = Math.abs(t % barLen) < 0.001
        ctx.fillStyle = isBar ? p.gridBar : p.gridSub
        ctx.fillRect(x, 0, 1, h)
      }

      for (const note of proj.notes) {
        const r = noteRect(note, vp)
        if (r.x + r.w < KEY_W || r.x > w) continue
        const velocity = overrides.current.get(note.id) ?? note.velocity
        const top = velY(velocity)
        const isSel = selected.has(note.id)
        const isHover = hover === note.id
        ctx.globalAlpha = isSel ? 0.95 : isHover ? 0.85 : 0.55
        ctx.fillStyle = isSel ? p.note : p.noteOut
        const barW = Math.max(2.5, Math.min(10, Math.max(3, r.w * 0.5)))
        ctx.fillRect(r.x + 1, top, barW, h - pad - top)
        ctx.globalAlpha = 1
        ctx.fillStyle = isSel ? p.note : p.noteOut
        ctx.beginPath()
        ctx.arc(r.x + 1 + barW / 2, top, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hover])

  const velocityFromY = (y: number, h: number) => {
    const pad = 12
    const laneH = Math.max(1, h - pad * 2)
    return Math.max(1, Math.min(127, Math.round((1 - (y - pad) / laneH) * 127)))
  }

  const pick = (x: number) => {
    const st = useUiStore.getState()
    const proj = useProjectStore.getState().project
    for (let i = proj.notes.length - 1; i >= 0; i -= 1) {
      const r = noteRect(proj.notes[i], st.viewport)
      const width = Math.max(6, Math.min(14, r.w))
      if (x >= r.x - 3 && x <= r.x + width + 3) return proj.notes[i]
    }
    return null
  }

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const note = pick(x)
    if (!note) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragNote.current = note.id
    overrides.current.set(note.id, velocityFromY(y, rect.height))
    const selected = useProjectStore.getState().selectedIds
    const targets = selected.includes(note.id) && selected.length > 1 ? selected : [note.id]
    for (const id of targets) overrides.current.set(id, velocityFromY(y, rect.height))
    dirty.current = true
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (!dragNote.current) {
      const note = pick(x)
      setHover(note?.id ?? null)
      return
    }
    const value = velocityFromY(y, rect.height)
    const selected = useProjectStore.getState().selectedIds
    const targets =
      selected.includes(dragNote.current) && selected.length > 1
        ? selected
        : [dragNote.current]
    for (const id of targets) overrides.current.set(id, value)
    dirty.current = true
  }

  const handleUp = () => {
    if (!dragNote.current) return
    const patches = [...overrides.current.entries()].map(([id, velocity]) => ({
      id,
      patch: { velocity },
    }))
    overrides.current.clear()
    dragNote.current = null
    useProjectStore.getState().updateNotes(patches)
    dirty.current = true
  }

  return (
    <div className="velocity-wrap">
      <canvas
        ref={ref}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={() => {
          setHover(null)
          if (!dragNote.current) return
          handleUp()
        }}
      />
    </div>
  )
}

function InfoPanel() {
  const t = useT()
  const lang = useUiStore((s) => s.lang)
  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedIds)
  const selected = project.notes.filter((n) => selectedIds.includes(n.id))
  const barLen = barTicks(project.timeSignature)
  const cells = [
    [t('info.project'), project.name],
    [t('info.key'), keyLabel(project.keyRoot, project.keyMode, lang)],
    [t('info.tempo'), `${project.bpm} BPM`],
    [t('info.time'), `${project.timeSignature.numerator}/${project.timeSignature.denominator}`],
    [t('info.length'), t('info.bars', { n: project.bars })],
    [t('info.notes'), String(project.notes.length)],
    [t('info.selected'), String(selected.length)],
    [
      t('info.loop'),
      project.loop.enabled
        ? `${Math.floor(project.loop.start / barLen) + 1} → ${Math.ceil(project.loop.end / barLen)}`
        : t('common.off'),
    ],
  ]
  const first = selected[0]

  return (
    <div className="info-grid">
      {cells.map(([label, value]) => (
        <dl key={label} className="info-cell">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </dl>
      ))}
      {first && (
        <>
          <dl className="info-cell">
            <dt>{t('info.note')}</dt>
            <dd>{pitchLabel(first.pitch)}</dd>
          </dl>
          <dl className="info-cell">
            <dt>{t('info.start')}</dt>
            <dd>{formatPosition(first.start, project.timeSignature)}</dd>
          </dl>
          <dl className="info-cell">
            <dt>{t('insp.length')}</dt>
            <dd>{t('info.beats', { n: Math.round((first.duration / 480) * 100) / 100 })}</dd>
          </dl>
          <dl className="info-cell">
            <dt>{t('info.velocity')}</dt>
            <dd>{first.velocity}</dd>
          </dl>
        </>
      )}
      <dl className="info-cell">
        <dt>{t('info.position')}</dt>
        <dd>
          <PlayheadTime />
        </dd>
      </dl>
    </div>
  )
}

function PlayheadTime() {
  const [tick, setTick] = useState(0)
  const ts = useProjectStore((s) => s.project.timeSignature)
  useEffect(() => {
    let last = 0
    return engine.subscribeFrame(() => {
      const now = performance.now()
      if (now - last < 100) return
      last = now
      setTick(engine.positionTicks)
    })
  }, [])
  return <>{formatPosition(tick, ts)}</>
}
