import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { engine } from '../audio/engine'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import type { Chord, ChordQuality, Note } from '../types'
import { MAX_PITCH, MIN_PITCH, pitchClassLabel, pitchLabel } from '../lib/pitch'
import {
  CHORD_QUALITIES,
  CHORD_SUFFIX,
  PROGRESSIONS,
  SCALE_INTERVALS,
  chordForDegree,
  chordLabel,
  chordTones,
  keyLabel,
} from '../lib/theory'
import { barTicks, clamp, formatPosition } from '../lib/ticks'
import { SKETCHES, buildSketch } from '../lib/sketch'
import { snapTicks } from '../lib/snap'

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string
  count?: string | number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="section">
      <button className="section-head" onClick={() => setOpen(!open)}>
        <span className="section-title">
          {title}
          {count !== undefined && count !== '' && <span className="count">{count}</span>}
        </span>
        <ChevronDown size={14} className={`section-chev ${open ? '' : 'closed'}`} />
      </button>
      {open && children}
    </section>
  )
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onLive,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step?: number
  onLive?: (v: number) => void
  onCommit: (v: number) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      className="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={local}
      onChange={(e) => {
        const next = Number(e.target.value)
        setLocal(next)
        onLive?.(next)
      }}
      onPointerUp={() => onCommit(local)}
      onKeyUp={() => onCommit(local)}
      onBlur={() => onCommit(local)}
    />
  )
}

export function Inspector() {
  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedIds)
  const notes = useMemo(
    () => project.notes.filter((n) => selectedIds.includes(n.id)),
    [project.notes, selectedIds],
  )

  return (
    <aside className="inspector">
      <div className="inspector-scroll">
        <NoteSection notes={notes} />
        <KeySection />
        <ChordSection />
        <SketchSection />
        <InstrumentSection />
        <ProjectSection />
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ notes */

function NoteSection({ notes }: { notes: Note[] }) {
  const updateNotes = useProjectStore((s) => s.updateNotes)
  const removeNotes = useProjectStore((s) => s.removeNotes)
  const project = useProjectStore((s) => s.project)
  const snap = useUiStore((s) => s.snap)
  const step = snapTicks(snap, project.timeSignature) || 120

  if (notes.length === 0) {
    return (
      <Section title="Note">
        <p className="empty-note">
          Select a note to edit its pitch, timing and velocity. Double-click a note to jump
          here.
        </p>
      </Section>
    )
  }

  const first = notes[0]
  const beats = Math.round((first.duration / 480) * 100) / 100

  return (
    <Section title="Note" count={notes.length > 1 ? `${notes.length}` : undefined}>
      {notes.length === 1 ? (
        <>
          <div className="row">
            <span className="row-label">Pitch</span>
            <select
              className="num-input"
              style={{ width: 78 }}
              value={first.pitch}
              onChange={(e) => updateNotes([{ id: first.id, patch: { pitch: Number(e.target.value) } }])}
            >
              {Array.from({ length: MAX_PITCH - MIN_PITCH + 1 }, (_, i) => MAX_PITCH - i).map((p) => (
                <option key={p} value={p}>
                  {pitchLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            <span className="row-label">Position</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                className="btn sm ghost"
                onClick={() =>
                  updateNotes([{ id: first.id, patch: { start: Math.max(0, first.start - step) } }])
                }
              >
                −
              </button>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 11.5,
                  color: 'var(--dim)',
                  minWidth: 52,
                  textAlign: 'center',
                }}
              >
                {formatPosition(first.start, project.timeSignature)}
              </span>
              <button
                className="btn sm ghost"
                onClick={() =>
                  updateNotes([{ id: first.id, patch: { start: first.start + step } }])
                }
              >
                +
              </button>
            </div>
          </div>

          <div className="row">
            <span className="row-label">Length</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                className="num-input"
                style={{ width: 56 }}
                type="number"
                step={0.25}
                min={0.1}
                value={beats}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isFinite(value) || value <= 0) return
                  updateNotes([{ id: first.id, patch: { duration: Math.round(value * 480) } }])
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--faint)' }}>beats</span>
            </div>
          </div>
        </>
      ) : (
        <div className="row">
          <span className="row-label">Transpose</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[-12, -1, 1, 12].map((delta) => (
              <button
                key={delta}
                className="btn sm"
                onClick={() =>
                  updateNotes(
                    notes.map((n) => ({
                      id: n.id,
                      patch: { pitch: clamp(MIN_PITCH, MAX_PITCH, n.pitch + delta) },
                    })),
                  )
                }
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span className="row-label">Velocity</span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{first.velocity}</span>
      </div>
      <Slider
        value={first.velocity}
        min={1}
        max={127}
        onCommit={(v) =>
          updateNotes(notes.map((n) => ({ id: n.id, patch: { velocity: v } })))
        }
      />

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          className="btn sm ghost"
          style={{ color: 'var(--danger)' }}
          onClick={() => removeNotes(notes.map((n) => n.id))}
        >
          <Trash2 size={12} /> Delete
        </button>
        <button
          className="btn sm ghost"
          onClick={() => useProjectStore.getState().duplicateSelection()}
        >
          Duplicate
        </button>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------- key */

function KeySection() {
  const project = useProjectStore((s) => s.project)
  const setKey = useProjectStore((s) => s.setKey)
  const scaleSnap = useUiStore((s) => s.scaleSnap)
  const setScaleSnap = useUiStore((s) => s.setScaleSnap)
  const showScaleGuide = useUiStore((s) => s.showScaleGuide)
  const setShowScaleGuide = useUiStore((s) => s.setShowScaleGuide)

  return (
    <Section title="Key & scale">
      <div className="row">
        <span className="row-label">Key</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{keyLabel(project.keyRoot, project.keyMode)}</span>
      </div>
      <div className="row">
        <span className="row-label">Mode</span>
        <div className="chip-group">
          {(['major', 'minor'] as const).map((mode) => (
            <button
              key={mode}
              className={`chip ${project.keyMode === mode ? 'active' : ''}`}
              onClick={() => setKey(project.keyRoot, mode)}
            >
              {mode === 'major' ? 'Major' : 'Minor'}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <span className="row-label">Scale snap</span>
        <button
          className={`switch ${scaleSnap ? 'on' : ''}`}
          onClick={() => setScaleSnap(!scaleSnap)}
          aria-label="Scale snap"
        />
      </div>
      <div className="row">
        <span className="row-label">Highlight rows</span>
        <button
          className={`switch ${showScaleGuide ? 'on' : ''}`}
          onClick={() => setShowScaleGuide(!showScaleGuide)}
          aria-label="Highlight scale rows"
        />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {SCALE_INTERVALS[project.keyMode].map((interval, index) => {
          const pc = (project.keyRoot + interval) % 12
          return (
            <span className="degree" key={index}>
              <b>{pitchClassLabel(pc, [1, 3, 5, 8, 10].includes(project.keyRoot))}</b>
              <span>{index + 1}</span>
            </span>
          )
        })}
      </div>
      <p className="empty-note" style={{ marginTop: 8 }}>
        Notes outside the key are still welcome — they just read as darker in the roll.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ chords */

function ChordSection() {
  const project = useProjectStore((s) => s.project)
  const addChord = useProjectStore((s) => s.addChord)
  const updateChord = useProjectStore((s) => s.updateChord)
  const removeChord = useProjectStore((s) => s.removeChord)
  const setChords = useProjectStore((s) => s.setChords)
  const notify = useUiStore((s) => s.notify)
  const chordPreview = useUiStore((s) => s.chordPreview)
  const setChordPreview = useUiStore((s) => s.setChordPreview)
  const [showPresets, setShowPresets] = useState(false)

  const barLen = barTicks(project.timeSignature)

  const addAtPlayhead = () => {
    const tick = engine.positionTicks
    const bar = Math.floor(tick / barLen)
    const start = bar * barLen
    const existing = project.chords.find(
      (c) => c.start < start + barLen && c.start + c.duration > start,
    )
    if (existing) {
      notify('That bar already has a chord')
      return
    }
    const degree = Math.min(6, (bar % 4) * 1)
    const { root, quality } = chordForDegree(project.keyRoot, project.keyMode, degree)
    addChord({ start, duration: barLen, root, quality })
  }

  const applyProgression = (presetId: string) => {
    const preset = PROGRESSIONS.find((p) => p.id === presetId)
    if (!preset) return
    const chords = Array.from({ length: project.bars }, (_, bar) => {
      const degree = preset.degrees[bar % preset.degrees.length]
      const { root, quality } = chordForDegree(project.keyRoot, project.keyMode, degree)
      return { start: bar * barLen, duration: barLen, root, quality }
    })
    setChords(chords)
    notify(`Applied ${preset.name}`)
  }

  return (
    <Section title="Chords" count={project.chords.length || undefined}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button className="btn sm" onClick={addAtPlayhead}>
          <Plus size={12} /> Add at playhead
        </button>
        <button className="btn sm ghost" onClick={() => setShowPresets(!showPresets)}>
          Progressions
        </button>
      </div>

      {showPresets && (
        <div style={{ marginBottom: 8 }}>
          {PROGRESSIONS.filter((preset) => preset.mode === project.keyMode).map((preset) => {
            const label = preset.degrees
              .map((degree) => chordLabel(chordForDegree(project.keyRoot, project.keyMode, degree)))
              .join(' – ')
            return (
              <button
                key={preset.id}
                className="prog-card"
                onClick={() => applyProgression(preset.id)}
              >
                <span style={{ minWidth: 0 }}>
                  <div className="name">{preset.name}</div>
                  <div className="note">{preset.note}</div>
                </span>
                <span className="chords">{label}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="row" style={{ paddingTop: 0 }}>
        <span className="row-label">Play on click</span>
        <button
          className={`switch ${chordPreview ? 'on' : ''}`}
          onClick={() => setChordPreview(!chordPreview)}
          aria-label="Preview chords"
        />
      </div>

      {project.chords.length === 0 ? (
        <p className="empty-note">
          Chords are a guide, not a rule. Add one per bar to hear how a melody sits on the
          harmony.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {project.chords.map((chord: Chord) => (
            <div
              key={chord.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 6px',
                borderRadius: 7,
                background: 'var(--panel-soft)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--faint)',
                  fontVariantNumeric: 'tabular-nums',
                  width: 16,
                }}
              >
                {Math.floor(chord.start / barLen) + 1}
              </span>
              <button
                style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'left' }}
                onClick={() => chordPreview && void engine.previewChord(chord)}
                title={chordTones(chord).join(' ')}
              >
                {chordLabel(chord)}
              </button>
              <select
                className="num-input"
                style={{ width: 40, height: 22, padding: '0 2px', fontSize: 11 }}
                value={chord.root}
                onChange={(e) => updateChord(chord.id, { root: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {pitchLabel(60 + i).replace(/\d+$/, '')}
                  </option>
                ))}
              </select>
              <select
                className="num-input"
                style={{ width: 54, height: 22, padding: '0 2px', fontSize: 11 }}
                value={chord.quality}
                onChange={(e) => updateChord(chord.id, { quality: e.target.value as ChordQuality })}
              >
                {CHORD_QUALITIES.map((q) => (
                  <option key={q} value={q}>
                    {CHORD_SUFFIX[q] || 'maj'}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                style={{ width: 20, height: 20, marginLeft: 'auto' }}
                onClick={() => removeChord(chord.id)}
                title="Remove chord"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/* ----------------------------------------------------------------- sketches */

function SketchSection() {
  const project = useProjectStore((s) => s.project)
  const applySketch = useProjectStore((s) => s.applySketch)
  const notify = useUiStore((s) => s.notify)

  const apply = (id: string) => {
    const style = SKETCHES.find((s) => s.id === id)
    if (!style) return
    const { notes, chords, bpm } = buildSketch(style, project)
    applySketch(notes, chords, bpm)
    notify(`${style.name} sketch loaded — Ctrl Z to undo`)
  }

  return (
    <Section title="Sketches" defaultOpen={false}>
      <p className="empty-note" style={{ marginBottom: 8 }}>
        Four-bar starting points in your key. Every note stays editable.
      </p>
      <div className="sketch-grid">
        {SKETCHES.map((style) => (
          <button key={style.id} className="sketch-btn" onClick={() => apply(style.id)} title={style.hint}>
            {style.name}
          </button>
        ))}
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------- instrument */

function InstrumentSection() {
  const project = useProjectStore((s) => s.project)
  const setInstrument = useProjectStore((s) => s.setInstrument)

  return (
    <Section title="Piano">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="row-label">Volume</span>
        <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{Math.round(project.instrument.volume)} dB</span>
      </div>
      <Slider
        value={project.instrument.volume}
        min={-30}
        max={6}
        onLive={(v) => engine.setVolume(v)}
        onCommit={(v) => {
          setInstrument({ volume: v })
          engine.setVolume(v)
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="row-label">Reverb</span>
        <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>
          {Math.round(project.instrument.reverb * 100)}%
        </span>
      </div>
      <Slider
        value={project.instrument.reverb}
        min={0}
        max={1}
        step={0.01}
        onLive={(v) => engine.setReverb(v)}
        onCommit={(v) => {
          setInstrument({ reverb: v })
          engine.setReverb(v)
        }}
      />

      <div className="row" style={{ marginTop: 6 }}>
        <span className="row-label">Sustain</span>
        <button
          className={`switch ${project.instrument.sustain ? 'on' : ''}`}
          onClick={() => setInstrument({ sustain: !project.instrument.sustain })}
          aria-label="Sustain"
        />
      </div>

      <div className="row">
        <span className="row-label">Metronome</span>
        <button
          className={`switch ${project.instrument.metronome ? 'on' : ''}`}
          onClick={() => {
            const next = !project.instrument.metronome
            setInstrument({ metronome: next })
            engine.setMetronome(next, useProjectStore.getState().project)
          }}
          aria-label="Metronome"
        />
      </div>

      <p className="empty-note" style={{ marginTop: 6 }}>
        Salamander Grand Piano, sampled and played locally in your browser.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ project */

function ProjectSection() {
  const project = useProjectStore((s) => s.project)
  const setBars = useProjectStore((s) => s.setBars)
  const setLoop = useProjectStore((s) => s.setLoop)
  const barLen = barTicks(project.timeSignature)

  const totalSeconds = ((barLen * project.bars) / 480) * (60 / project.bpm)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)

  return (
    <Section title="Project" defaultOpen={false}>
      <div className="row">
        <span className="row-label">Length</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button className="btn sm ghost" onClick={() => setBars(project.bars - 1)}>
            −
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 56, textAlign: 'center' }}>
            {project.bars} bars
          </span>
          <button className="btn sm ghost" onClick={() => setBars(project.bars + 1)}>
            +
          </button>
        </div>
      </div>
      <div className="row">
        <span className="row-label">Duration</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="row">
        <span className="row-label">Loop bars</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="num-input"
            style={{ width: 44 }}
            type="number"
            min={1}
            max={project.bars}
            value={Math.floor(project.loop.start / barLen) + 1}
            onChange={(e) =>
              setLoop({ start: clamp(0, project.bars - 1, Number(e.target.value) - 1) * barLen })
            }
          />
          <span style={{ color: 'var(--faint)' }}>→</span>
          <input
            className="num-input"
            style={{ width: 44 }}
            type="number"
            min={1}
            max={project.bars}
            value={Math.ceil(project.loop.end / barLen)}
            onChange={(e) => setLoop({ end: clamp(1, project.bars, Number(e.target.value)) * barLen })}
          />
        </div>
      </div>
      <p className="empty-note" style={{ marginTop: 6 }}>
        Shift-drag the ruler to set a loop. Drag the ruler to move the playhead.
      </p>
    </Section>
  )
}
