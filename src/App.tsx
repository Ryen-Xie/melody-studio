import { useEffect, useRef, useState } from 'react'
import { TopBar } from './components/TopBar'
import { ToolRail } from './components/ToolRail'
import { PianoRoll } from './components/roll/PianoRoll'
import { BottomPanel } from './components/BottomPanel'
import { Inspector } from './components/Inspector'
import { ProjectsDialog } from './components/ProjectsDialog'
import { ExportDialog } from './components/ExportDialog'
import { HelpDialog } from './components/HelpDialog'
import { engine } from './audio/engine'
import { useProjectStore, createEmptyProject } from './store/project'
import { useUiStore } from './store/ui'
import { getLastProjectId, loadProject, saveProject, setLastProjectId } from './io/db'
import { snapTicks } from './lib/snap'
import { clamp } from './lib/ticks'
import { MAX_PITCH, MIN_PITCH } from './lib/pitch'
import { keyState } from './lib/keyState'

type Dialog = 'projects' | 'export' | 'help' | null

/** Ableton-style typing keyboard: two rows of a piano. */
const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
}

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

export default function App() {
  const project = useProjectStore((s) => s.project)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const theme = useUiStore((s) => s.theme)
  const toast = useUiStore((s) => s.toast)
  const notify = useUiStore((s) => s.notify)
  const setPlaying = useUiStore((s) => s.setPlaying)
  const setSaveState = useUiStore((s) => s.setSaveState)
  const audioStatus = useUiStore((s) => s.audioStatus)
  const setAudioStatus = useUiStore((s) => s.setAudioStatus)

  const [dialog, setDialog] = useState<Dialog>(null)
  const loaded = useRef(false)
  const heldKeys = useRef<Map<string, number>>(new Map())

  /* theme */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b0c0f' : '#f4f4f7')
  }, [theme])

  /* restore the last project, or start a clean one */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lastId = await getLastProjectId()
        const restored = lastId ? await loadProject(lastId) : null
        if (!cancelled && restored) {
          useProjectStore.getState().replaceProject(restored)
          engine.sync(restored)
        } else if (!cancelled) {
          const fresh = createEmptyProject()
          await saveProject(fresh)
          await setLastProjectId(fresh.id)
          useProjectStore.getState().replaceProject(fresh)
        }
      } catch (err) {
        console.warn('[melody] could not restore project', err)
      } finally {
        if (!cancelled) loaded.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* keep the audio engine in step with the project */
  useEffect(() => {
    engine.sync(project)
    engine.refresh(project)
  }, [project])

  useEffect(() => {
    return engine.subscribeStatus(() => setAudioStatus(engine.status))
  }, [setAudioStatus])

  useEffect(() => {
    engine.onEnded = () => setPlaying(false)
    return () => {
      engine.onEnded = null
    }
  }, [setPlaying])

  /* autosave */
  useEffect(() => {
    if (!loaded.current) return
    setSaveState('dirty')
    const timer = setTimeout(() => {
      setSaveState('saving')
      void saveProject(project)
        .then(() => setLastProjectId(project.id))
        .then(() => {
          if (useProjectStore.getState().project.id === project.id) setSaveState('saved')
        })
        .catch(() => notify('Autosave failed'))
    }, 650)
    return () => clearTimeout(timer)
  }, [project, setSaveState, notify])

  /* shortcuts */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTyping()
      const mod = e.ctrlKey || e.metaKey
      const store = useProjectStore.getState()

      if (e.key === 'Escape') {
        store.clearSelection()
        return
      }

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveProject(useProjectStore.getState().project)
          .then(() => setLastProjectId(useProjectStore.getState().project.id))
          .then(() => {
            setSaveState('saved')
            notify('Project saved')
          })
        return
      }

      if (typing) return

      /* computer keyboard piano */
      if (!mod && !e.altKey) {
        const semitone = KEY_TO_SEMITONE[e.key.toLowerCase()]
        if (semitone !== undefined) {
          e.preventDefault()
          if (heldKeys.current.has(e.key.toLowerCase())) return
          const pitch = 12 * (useUiStore.getState().keyboardOctave + 1) + semitone
          heldKeys.current.set(e.key.toLowerCase(), pitch)
          void engine.previewAttack(pitch, 92)
          return
        }
        if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') {
          const next = useUiStore.getState().keyboardOctave + (e.key.toLowerCase() === 'z' ? -1 : 1)
          useUiStore.getState().setKeyboardOctave(next)
          notify(`Keyboard octave ${useUiStore.getState().keyboardOctave}`)
          return
        }
      }

      if (e.code === 'Space') {
        e.preventDefault()
        keyState.space = true
        return
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        store.copySelection()
        notify('Copied')
        return
      }
      if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        store.copySelection()
        store.removeNotes(store.selectedIds)
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        store.pasteAt(engine.positionTicks)
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        store.duplicateSelection()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        store.selectAll()
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        store.invertSelection()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length) {
          e.preventDefault()
          store.removeNotes(store.selectedIds)
        }
        return
      }

      if (e.key === 'Enter') {
        engine.stop()
        setPlaying(false)
        return
      }

      if (['1', '2', '3', '4'].includes(e.key)) {
        const tools = ['select', 'draw', 'erase', 'pan'] as const
        useUiStore.getState().setTool(tools[Number(e.key) - 1])
        return
      }

      if (e.key.toLowerCase() === 'l') {
        store.setLoop({ enabled: !store.project.loop.enabled })
        return
      }
      if (e.key === '?') {
        setDialog('help')
        return
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (!store.selectedIds.length) return
        e.preventDefault()
        const step = snapTicks(useUiStore.getState().snap, store.project.timeSignature) || 120
        const horiz = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const vert =
          e.key === 'ArrowUp'
            ? e.shiftKey
              ? 12
              : 1
            : e.key === 'ArrowDown'
              ? e.shiftKey
                ? -12
                : -1
              : 0
        store.updateNotes(
          store.selectedIds.map((id) => {
            const note = store.project.notes.find((n) => n.id === id)!
            return {
              id,
              patch: {
                start: Math.max(0, note.start + horiz),
                pitch: clamp(MIN_PITCH, MAX_PITCH, note.pitch + vert),
              },
            }
          }),
        )
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const held = heldKeys.current.get(e.key.toLowerCase())
      if (held !== undefined) {
        heldKeys.current.delete(e.key.toLowerCase())
        engine.previewRelease(held)
      }
      if (e.code !== 'Space') return
      keyState.space = false
      if (isTyping() || keyState.spaceUsedForDrag) return
      if (engine.isPlaying) {
        engine.pause()
        setPlaying(false)
      } else {
        void engine.play(useProjectStore.getState().project)
        setPlaying(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [notify, setPlaying, setSaveState])

  return (
    <div className="app">
      <TopBar
        onOpenProjects={() => setDialog('projects')}
        onOpenExport={() => setDialog('export')}
        onOpenHelp={() => setDialog('help')}
      />

      <div className="app-body">
        <ToolRail />
        <div className="center">
          <PianoRoll />
          <BottomPanel />
        </div>
        {rightOpen && <Inspector />}
      </div>

      {audioStatus === 'loading' && (
        <div className="audio-banner">
          <span className="audio-dot" /> Loading piano samples…
        </div>
      )}
      {audioStatus === 'fallback' && (
        <div className="audio-banner warn">
          Piano samples unavailable — using the built-in synth
        </div>
      )}

      {dialog === 'projects' && (
        <ProjectsDialog
          onClose={() => setDialog(null)}
          onOpen={(next) => {
            useProjectStore.getState().replaceProject(next)
            engine.stop()
            setPlaying(false)
            engine.sync(next)
          }}
        />
      )}
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
