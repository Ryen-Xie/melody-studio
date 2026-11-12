import { useMemo, useState } from 'react'
import { Check, Download, Loader2 } from 'lucide-react'
import { Modal } from './Modal'
import { useProjectStore } from '../store/project'
import { useUiStore } from '../store/ui'
import { projectToMidi, downloadBlob, safeFilename } from '../io/midi'
import { serializeProject } from '../io/projectFile'
import { renderProjectWav } from '../audio/render'
import { barTicks } from '../lib/ticks'

type Format = 'wav' | 'midi' | 'json'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const notify = useUiStore((s) => s.notify)
  const [format, setFormat] = useState<Format>('wav')
  const [range, setRange] = useState<'all' | 'loop'>('all')
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState(safeFilename(project.name))

  const barLen = barTicks(project.timeSignature)
  const totalSeconds = ((barLen * project.bars) / 480) * (60 / project.bpm)
  const loopSeconds = ((project.loop.end - project.loop.start) / 480) * (60 / project.bpm)
  const seconds = range === 'loop' && project.loop.enabled ? loopSeconds : totalSeconds
  const duration = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

  const busy = progress !== null

  const summary = useMemo(
    () => [
      ['Notes', String(project.notes.length)],
      ['Tempo', `${project.bpm} BPM`],
      ['Length', `${project.bars} bars · ${duration}`],
    ],
    [project.notes.length, project.bpm, project.bars, duration],
  )

  const run = async () => {
    setError(null)
    const base = safeFilename(filename)
    try {
      if (format === 'midi') {
        downloadBlob(projectToMidi(project), `${base}.mid`)
        notify('MIDI exported')
        onClose()
        return
      }
      if (format === 'json') {
        downloadBlob(
          new Blob([serializeProject(project)], { type: 'application/json' }),
          `${base}.melody.json`,
        )
        notify('Project file exported')
        onClose()
        return
      }

      const useLoop = range === 'loop' && project.loop.enabled
      setProgress({ value: 0.02, label: 'Starting' })
      const blob = await renderProjectWav(project, {
        startTicks: useLoop ? project.loop.start : 0,
        endTicks: useLoop ? project.loop.end : barLen * project.bars,
        onProgress: (value, label) => setProgress({ value, label: label ?? 'Rendering' }),
      })
      downloadBlob(blob, `${base}.wav`)
      setProgress(null)
      notify('WAV exported')
      onClose()
    } catch (err) {
      setProgress(null)
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
    }
  }

  return (
    <Modal
      title="Export"
      subtitle="Everything is generated on this device"
      onClose={onClose}
      footer={
        <>
          <span className="kbd-hint" style={{ alignSelf: 'center' }}>
            {format === 'wav' ? `${duration} of audio` : format === 'midi' ? 'Standard MIDI file' : 'Melody Studio project'}
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
            {busy ? 'Rendering…' : `Export ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      <div className="chip-group" style={{ display: 'inline-flex', marginBottom: 16 }}>
        {(['wav', 'midi', 'json'] as Format[]).map((item) => (
          <button
            key={item}
            className={`chip ${format === item ? 'active' : ''}`}
            onClick={() => setFormat(item)}
            disabled={busy}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="row" style={{ paddingTop: 0 }}>
        <span className="row-label">File name</span>
        <input
          className="num-input"
          style={{ width: 240 }}
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          disabled={busy}
        />
      </div>

      {format === 'wav' && (
        <div className="row">
          <span className="row-label">Range</span>
          <div className="chip-group">
            <button
              className={`chip ${range === 'all' ? 'active' : ''}`}
              onClick={() => setRange('all')}
              disabled={busy}
            >
              Whole project
            </button>
            <button
              className={`chip ${range === 'loop' ? 'active' : ''}`}
              onClick={() => setRange('loop')}
              disabled={busy || !project.loop.enabled}
              title={project.loop.enabled ? '' : 'Turn the loop on first'}
            >
              Loop only
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 10,
          background: 'var(--panel-soft)',
          border: '1px solid var(--line-soft)',
        }}
      >
        <div style={{ display: 'flex', gap: 22, marginBottom: 8 }}>
          {summary.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)' }}>
                {label}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 550, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
        <p className="empty-note">
          {format === 'wav'
            ? 'Rendered offline with the same piano samples you hear — no system audio is recorded.'
            : format === 'midi'
              ? 'Opens in FL Studio, Ableton Live, Logic Pro and any DAW that reads .mid files.'
              : 'A portable copy of the project, including notes, chords and settings.'}
        </p>
      </div>

      {progress && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{progress.label}</span>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              {Math.round(progress.value * 100)}%
            </span>
          </div>
          <div className="progress">
            <div style={{ width: `${Math.round(progress.value * 100)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 14, color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </p>
      )}

      {!busy && progress === null && !error && format === 'wav' && (
        <p className="empty-note" style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Check size={12} /> 44.1 kHz · 16-bit · stereo WAV
        </p>
      )}
    </Modal>
  )
}
