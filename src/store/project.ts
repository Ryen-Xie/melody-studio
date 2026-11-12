import { create } from 'zustand'
import type { Chord, InstrumentSettings, KeyMode, Note, NotePatch, Project, TimeSignature } from '../types'
import { uid } from '../lib/id'
import { barTicks, clamp } from '../lib/ticks'

const MAX_HISTORY = 150

export function createEmptyProject(name = 'Untitled melody'): Project {
  const now = new Date().toISOString()
  const ts: TimeSignature = { numerator: 4, denominator: 4 }
  return {
    id: uid('prj'),
    name,
    bpm: 96,
    timeSignature: ts,
    keyRoot: 0,
    keyMode: 'major',
    bars: 8,
    notes: [],
    chords: [],
    loop: { start: 0, end: barTicks(ts) * 4, enabled: false },
    instrument: { volume: -3, reverb: 0.26, metronome: false, sustain: false },
    createdAt: now,
    updatedAt: now,
  }
}

interface ProjectStore {
  project: Project
  selectedIds: string[]
  selectedChordId: string | null
  past: Project[]
  future: Project[]
  clipboard: { notes: Note[]; anchor: number }

  replaceProject: (p: Project) => void
  commit: (recipe: (p: Project) => Project) => void
  undo: () => void
  redo: () => void

  setName: (name: string) => void
  setBpm: (bpm: number) => void
  setTimeSignature: (ts: TimeSignature) => void
  setKey: (root: number, mode: KeyMode) => void
  setBars: (bars: number) => void
  setLoop: (loop: Partial<Project['loop']>) => void
  setInstrument: (patch: Partial<InstrumentSettings>) => void

  addNotes: (notes: Omit<Note, 'id'>[]) => string[]
  updateNotes: (patches: NotePatch[]) => void
  removeNotes: (ids: string[]) => void
  replaceNotes: (notes: Note[]) => void

  addChord: (chord: Omit<Chord, 'id'>) => void
  updateChord: (id: string, patch: Partial<Omit<Chord, 'id'>>) => void
  removeChord: (id: string) => void
  setChords: (chords: Omit<Chord, 'id'>[]) => void

  /** Replace the melody, harmony and tempo in a single undo step. */
  applySketch: (notes: Omit<Note, 'id'>[], chords: Omit<Chord, 'id'>[], bpm: number) => void

  select: (ids: string[]) => void
  toggleSelect: (id: string, additive: boolean) => void
  selectAll: () => void
  invertSelection: () => void
  clearSelection: () => void
  selectChord: (id: string | null) => void

  copySelection: () => void
  pasteAt: (tick: number) => void
  duplicateSelection: (offset?: number) => void
}

const touch = (p: Project): Project => ({ ...p, updatedAt: new Date().toISOString() })
const byStart = (a: Note, b: Note) => a.start - b.start

export const useProjectStore = create<ProjectStore>((set, get) => {
  const commit = (recipe: (p: Project) => Project) =>
    set((s) => {
      const next = recipe(s.project)
      if (next === s.project) return {}
      return {
        project: touch(next),
        past: [...s.past, s.project].slice(-MAX_HISTORY),
        future: [],
      }
    })

  return {
    project: createEmptyProject(),
    selectedIds: [],
    selectedChordId: null,
    past: [],
    future: [],
    clipboard: { notes: [], anchor: 0 },

    replaceProject: (p) =>
      set({
        project: { ...p, updatedAt: new Date().toISOString() },
        selectedIds: [],
        selectedChordId: null,
        past: [],
        future: [],
      }),

    commit,
    undo: () =>
      set((s) => {
        if (!s.past.length) return {}
        const previous = s.past[s.past.length - 1]
        return {
          project: previous,
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future].slice(0, MAX_HISTORY),
          selectedIds: s.selectedIds.filter((id) => previous.notes.some((n) => n.id === id)),
        }
      }),
    redo: () =>
      set((s) => {
        if (!s.future.length) return {}
        const next = s.future[0]
        return {
          project: next,
          past: [...s.past, s.project].slice(-MAX_HISTORY),
          future: s.future.slice(1),
          selectedIds: s.selectedIds.filter((id) => next.notes.some((n) => n.id === id)),
        }
      }),

    setName: (name) => commit((p) => ({ ...p, name })),

    setBpm: (bpm) =>
      commit((p) => ({ ...p, bpm: clamp(30, 260, Math.round(bpm)) })),

    setTimeSignature: (ts) =>
      commit((p) => {
        const bar = barTicks(ts)
        return { ...p, timeSignature: ts, loop: { ...p.loop, start: 0, end: bar * 4 } }
      }),

    setKey: (root, mode) => commit((p) => ({ ...p, keyRoot: root, keyMode: mode })),

    setBars: (bars) =>
      commit((p) => {
        const next = clamp(1, 64, Math.round(bars))
        const end = barTicks(p.timeSignature) * next
        return {
          ...p,
          bars: next,
          notes: p.notes.filter((n) => n.start < end),
          chords: p.chords.filter((c) => c.start < end),
          loop: { ...p.loop, end: Math.min(p.loop.end, end) },
        }
      }),

    setLoop: (loop) => commit((p) => ({ ...p, loop: { ...p.loop, ...loop } })),

    setInstrument: (patch) =>
      commit((p) => ({ ...p, instrument: { ...p.instrument, ...patch } })),

    addNotes: (incoming) => {
      const notes = incoming.map((n) => ({ ...n, id: uid('n') }))
      commit((p) => ({ ...p, notes: [...p.notes, ...notes].sort(byStart) }))
      return notes.map((n) => n.id)
    },

    updateNotes: (patches) => {
      if (!patches.length) return
      const map = new Map(patches.map((p) => [p.id, p.patch]))
      commit((p) => ({
        ...p,
        notes: p.notes
          .map((n) => (map.has(n.id) ? { ...n, ...map.get(n.id)! } : n))
          .sort(byStart),
      }))
    },

    removeNotes: (ids) => {
      if (!ids.length) return
      const set_ = new Set(ids)
      commit((p) => ({ ...p, notes: p.notes.filter((n) => !set_.has(n.id)) }))
      set((s) => ({ selectedIds: s.selectedIds.filter((id) => !set_.has(id)) }))
    },

    replaceNotes: (notes) =>
      commit((p) => ({ ...p, notes: [...notes].sort(byStart) })),

    addChord: (chord) =>
      commit((p) => ({
        ...p,
        chords: [...p.chords, { ...chord, id: uid('c') }].sort((a, b) => a.start - b.start),
      })),

    updateChord: (id, patch) =>
      commit((p) => ({
        ...p,
        chords: p.chords.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),

    removeChord: (id) =>
      commit((p) => ({ ...p, chords: p.chords.filter((c) => c.id !== id) })),

    setChords: (chords) =>
      commit((p) => ({
        ...p,
        chords: chords.map((c) => ({ ...c, id: uid('c') })).sort((a, b) => a.start - b.start),
      })),

    applySketch: (incomingNotes, incomingChords, bpm) => {
      const notes = incomingNotes.map((n) => ({ ...n, id: uid('n') }))
      const chords = incomingChords.map((c) => ({ ...c, id: uid('c') }))
      commit((p) => ({
        ...p,
        bpm: clamp(30, 260, Math.round(bpm)),
        notes: notes.sort(byStart),
        chords: chords.sort((a, b) => a.start - b.start),
      }))
      set({ selectedIds: [] })
    },

    select: (ids) => set({ selectedIds: ids }),
    toggleSelect: (id, additive) =>
      set((s) => {
        if (!additive) return { selectedIds: [id] }
        return {
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        }
      }),
    selectAll: () => set((s) => ({ selectedIds: s.project.notes.map((n) => n.id) })),
    invertSelection: () =>
      set((s) => {
        const chosen = new Set(s.selectedIds)
        return { selectedIds: s.project.notes.filter((n) => !chosen.has(n.id)).map((n) => n.id) }
      }),
    clearSelection: () => set({ selectedIds: [] }),
    selectChord: (id) => set({ selectedChordId: id }),

    copySelection: () => {
      const { project, selectedIds } = get()
      const notes = project.notes.filter((n) => selectedIds.includes(n.id))
      if (!notes.length) return
      const anchor = Math.min(...notes.map((n) => n.start))
      set({ clipboard: { notes: notes.map((n) => ({ ...n })), anchor } })
    },

    pasteAt: (tick) => {
      const { clipboard, commit: commitNow } = get()
      if (!clipboard.notes.length) return
      const shift = tick - clipboard.anchor
      const added = clipboard.notes.map((n) => ({
        ...n,
        id: uid('n'),
        start: Math.max(0, n.start + shift),
      }))
      commitNow((p) => ({ ...p, notes: [...p.notes, ...added].sort(byStart) }))
      set({ selectedIds: added.map((n) => n.id) })
    },

    duplicateSelection: (offset) => {
      const { project, selectedIds } = get()
      const notes = project.notes.filter((n) => selectedIds.includes(n.id))
      if (!notes.length) return
      const start = Math.min(...notes.map((n) => n.start))
      const end = Math.max(...notes.map((n) => n.start + n.duration))
      const step = offset ?? Math.max(120, end - start)
      const added = notes.map((n) => ({ ...n, id: uid('n'), start: n.start + step }))
      commit((p) => ({ ...p, notes: [...p.notes, ...added].sort(byStart) }))
      set({ selectedIds: added.map((n) => n.id) })
    },
  }
})
