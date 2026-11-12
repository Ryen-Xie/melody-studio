import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CircleStop,
  Cloud,
  Download,
  FolderOpen,
  HelpCircle,
  Languages,
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
import { useT } from '../lib/i18n'

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
  const t = useT()
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
  const lang = useUiStore((s) => s.lang)
  const setLang = useUiStore((s) => s.setLang)

  const [name, setLocalName] = useState(project.name)
  useEffect(() => setLocalName(project.name), [project.name])

  const [langOpen, setLangOpen] = useState(false)
  const [langPos, setLangPos] = useState({ x: 0, y: 0 })
  const langBtnRef = useRef<HTMLButtonElement | null>(null)
  const langMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!langOpen) return
    const onDown = (e: MouseEvent) => {
      if (!langMenuRef.current?.contains(e.target as Node)) setLangOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [langOpen])

  const openLang = () => {
    const rect = langBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setLangPos({ x: Math.max(8, rect.right - 168), y: rect.bottom + 6 })
    }
    setLangOpen((v) => !v)
  }

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
  const saveLabel =
    saveState === 'saving'
      ? t('top.saving')
      : saveState === 'dirty'
        ? t('top.editing')
        : t('top.saved')

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Music4 size={15} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-name">Melody Studio</div>
          <div className="brand-sub">{t('top.compose')}</div>
        </div>
      </div>

      <div className="divider-v" />

      <input
        className="project-name"
        value={name}
        spellCheck={false}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => {
          const next = name.trim() || t('proj.untitled')
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
        {saveLabel}
      </div>

      <div className="topbar-spacer" />

      <div className="transport">
        <button
          className={`tp-btn primary ${playing ? 'playing' : ''}`}
          onClick={togglePlay}
          title={playing ? t('top.pause') : t('top.play')}
        >
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <button className="tp-btn" onClick={stop} title={t('top.stop')}>
          <CircleStop size={15} />
        </button>
        <button
          className={`tp-btn ${project.loop.enabled ? 'active' : ''}`}
          onClick={toggleLoop}
          title={t('top.loop')}
        >
          <Repeat size={14} />
        </button>
      </div>

      <PositionReadout />

      <div className="field" title={t('top.tempo')}>
        <span className="field-label">BPM</span>
        <NumberField value={project.bpm} min={30} max={260} onChange={setBpm} width={34} />
      </div>

      <div className="field" title={t('top.key')}>
        <span className="field-label">{t('top.key')}</span>
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
          <option value="major">{t('top.major')}</option>
          <option value="minor">{t('top.minor')}</option>
        </select>
      </div>

      <div className="field" title={t('top.time')}>
        <span className="field-label">{t('top.time')}</span>
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

      <button className="icon-btn" disabled={!canUndo} onClick={undo} title={t('top.undo')}>
        <Undo2 size={15} />
      </button>
      <button className="icon-btn" disabled={!canRedo} onClick={redo} title={t('top.redo')}>
        <Redo2 size={15} />
      </button>

      <div className="divider-v" />

      <button className="icon-btn" onClick={onOpenProjects} title={t('top.projects')}>
        <FolderOpen size={15} />
      </button>
      <button
        className={`icon-btn ${rightOpen ? 'on' : ''}`}
        onClick={() => setRightOpen(!rightOpen)}
        title={t('top.inspector')}
      >
        <PanelRight size={15} />
      </button>

      <button
        ref={langBtnRef}
        className={`icon-btn ${langOpen ? 'on' : ''}`}
        onClick={openLang}
        title={t('top.language')}
        aria-label={t('top.language')}
      >
        <Languages size={15} />
      </button>

      <button className="icon-btn" onClick={toggleTheme} title={t('top.theme')}>
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button className="icon-btn" onClick={onOpenHelp} title={t('top.help')}>
        <HelpCircle size={15} />
      </button>
      <button className="btn primary" onClick={onOpenExport} style={{ marginLeft: 4 }}>
        <Download size={13} />
        {t('top.export')}
      </button>

      <div className="divider-v" />
      <div className="save-state" title={t('top.storage')}>
        <Cloud size={13} />
      </div>

      {langOpen && (
        <div
          ref={langMenuRef}
          className="dropdown"
          style={{ left: langPos.x, top: langPos.y, width: 168 }}
        >
          {(
            [
              ['en', t('top.english')],
              ['zh', t('top.chinese')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className="dropdown-item"
              onClick={() => {
                setLang(value)
                setLangOpen(false)
              }}
            >
              <span style={{ width: 14, display: 'inline-flex' }}>
                {lang === value && <Check size={13} />}
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
