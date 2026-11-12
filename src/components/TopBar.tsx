import { useEffect, useRef, useState } from 'react'
import {
  CircleStop,
  Cloud,
  Download,
  FolderOpen,
  HelpCircle,
  Moon,
  Music4,
  PanelRight,
  Pause,
  Play,
  Redo2,
  Repeat,
  Sun,
  Undo2,
} from 'lucide-react'
import { engine } from '../audio/engine'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { formatPosition } from '../lib/ticks'
import { pitchClassLabel } from '../lib/pitch'

function PositionReadout() {
  const [tick, setTick] = useState(0)
  const ts = useProjectStore((s) => s.project.timeSignature)
  const last = useRef(0)

  useEffect(() => {
    return engine.subscribeFrame(() => {
      const now = performance.now()
      if (now - last.current < 45) return
      last.current = now
      setTick(engine.positionTicks)
    })
  }, [])

  return <span className="position-readout">{formatPosition(tick, ts)}</span>
}

function NumberField({
  value,
  min,
  max,
  suffix,
  onChange,
  width = 44,
}: {
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (v: number) => void
  width?: number
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) {
      const next = Math.min(max, Math.max(min, Math.round(parsed)))
      onChange(next)
      setDraft(String(next))
    } else {
      setDraft(String(value))
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
      <input
        value={draft}
        style={{ width }}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit()
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') setDraft(String(value))
          e.stopPropagation()
        }}
      />
      {suffix && <span style={{ fontSize: 10, color: 'var(--faint)' }}>{suffix}</span>}
    </span>
  )
}

export function TopBar({
  onOpenProjects,
  onOpenExport,
  onOpenHelp,
}: {
  onOpenProjects: () => void
  onOpenExport: () => void
  onOpenHelp: () => void
}) {
  const project = useProjectStore((s) => s.project)
  const setName = useProjectStore((s) => s.setName)
  const setBpm = useProjectStore((s) => s.setBpm)
  const setKey = useProjectStore((s) => s.setKey)
  const setTimeSignature = useProjectStore((s) => s.setTimeSignature)
  const setLoop = useProjectStore((s) => s.setLoop)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)

  const playing = useUiStore((s) => s.playing)
  const setPlaying = useUiStore((s) => s.setPlaying)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const saveState = useUiStore((s) => s.saveState)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const setRightOpen = useUiStore((s) => s.setRightOpen)

  const [name, setLocalName] = useState(project.name)
  useEffect(() => setLocalName(project.name), [project.name])

  const togglePlay = () => {
    if (engine.isPlaying) {
      engine.pause()
      setPlaying(false)
    } else {
      void engine.play(useProjectStore.getState().project)
      setPlaying(true)
    }
  }

  const stop = () => {
    engine.stop()
    setPlaying(false)
  }

  const toggleLoop = () => {
    const enabled = !project.loop.enabled
    if (enabled) {
      const bar = 1920
      setLoop({ enabled, start: 0, end: Math.min(project.bars * bar, 4 * bar) })
    } else {
      setLoop({ enabled })
    }
  }

  const KEY_ROOTS = Array.from({ length: 12 }, (_, i) => i)

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Music4 size={15} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-name">Melody Studio</div>
          <div className="brand-sub">Compose</div>
        </div>
      </div>

      <div className="divider-v" />

      <input
        className="project-name"
        value={name}
        spellCheck={false}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => {
          const next = name.trim() || 'Untitled melody'
          if (next !== project.name) setName(next)
          setLocalName(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }}
      />

      <div className="save-state">
        <span className={`save-dot ${saveState === 'saved' ? '' : 'pending'}`} />
        {saveState === 'saving' ? 'Saving' : saveState === 'dirty' ? 'Editing' : 'Saved'}
      </div>

      <div className="topbar-spacer" />

      <div className="transport">
        <button
          className={`tp-btn primary ${playing ? 'playing' : ''}`}
          onClick={togglePlay}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <button className="tp-btn" onClick={stop} title="Stop (Enter)">
          <CircleStop size={15} />
        </button>
        <button
          className={`tp-btn ${project.loop.enabled ? 'active' : ''}`}
          onClick={toggleLoop}
          title="Loop (L)"
        >
          <Repeat size={14} />
        </button>
      </div>

      <PositionReadout />

      <div className="field" title="Tempo">
        <span className="field-label">BPM</span>
        <NumberField value={project.bpm} min={30} max={260} onChange={setBpm} width={34} />
      </div>

      <div className="field" title="Key and mode">
        <span className="field-label">Key</span>
        <select
          value={project.keyRoot}
          onChange={(e) => setKey(Number(e.target.value), project.keyMode)}
        >
          {KEY_ROOTS.map((root) => (
            <option key={root} value={root}>
              {pitchClassLabel(root, [1, 3, 5, 8, 10].includes(root))}
            </option>
          ))}
        </select>
        <select
          value={project.keyMode}
          onChange={(e) => setKey(project.keyRoot, e.target.value as 'major' | 'minor')}
        >
          <option value="major">major</option>
          <option value="minor">minor</option>
        </select>
      </div>

      <div className="field" title="Time signature">
        <span className="field-label">Time</span>
        <select
          value={`${project.timeSignature.numerator}/${project.timeSignature.denominator}`}
          onChange={(e) => {
            const [numerator, denominator] = e.target.value.split('/').map(Number)
            setTimeSignature({ numerator, denominator })
          }}
        >
          {['4/4', '3/4', '2/4', '5/4', '6/8', '7/8'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="topbar-spacer" />

      <button className="icon-btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl Z)">
        <Undo2 size={15} />
      </button>
      <button className="icon-btn" disabled={!canRedo} onClick={redo} title="Redo (Ctrl Shift Z)">
        <Redo2 size={15} />
      </button>

      <div className="divider-v" />

      <button className="icon-btn" onClick={onOpenProjects} title="Projects">
        <FolderOpen size={15} />
      </button>
      <button
        className={`icon-btn ${rightOpen ? 'on' : ''}`}
        onClick={() => setRightOpen(!rightOpen)}
        title="Inspector panel"
      >
        <PanelRight size={15} />
      </button>
      <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button className="icon-btn" onClick={onOpenHelp} title="Keyboard shortcuts (?)">
        <HelpCircle size={15} />
      </button>
      <button className="btn primary" onClick={onOpenExport} style={{ marginLeft: 4 }}>
        <Download size={13} />
        Export
      </button>

      <div className="divider-v" />
      <div className="save-state" title="Projects are stored in this browser">
        <Cloud size={13} />
      </div>
    </header>
  )
}
