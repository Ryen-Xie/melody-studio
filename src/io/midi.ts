import { Midi } from '@tonejs/midi'
import type { Project } from '../types'
import { ticksToSeconds } from '../lib/ticks'

/** Standard MIDI File, playable in FL Studio / Live / Logic. */
export function projectToMidi(project: Project): Blob {
  const midi = new Midi()
  midi.header.setTempo(project.bpm)
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [project.timeSignature.numerator, project.timeSignature.denominator],
    measures: project.bars,
  })

  const track = midi.addTrack()
  track.name = project.name || 'Melody'
  track.channel = 0
  track.instrument.number = 0

  for (const note of project.notes) {
    track.addNote({
      midi: note.pitch,
      time: ticksToSeconds(note.start, project.bpm),
      duration: Math.max(0.02, ticksToSeconds(note.duration, project.bpm)),
      velocity: Math.max(0.05, Math.min(1, note.velocity / 127)),
    })
  }

  const bytes = midi.toArray()
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'audio/midi',
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const safeFilename = (name: string) =>
  (name.trim() || 'melody').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
