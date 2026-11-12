import { useEffect, useRef, useState } from 'react'
import { Copy, FolderOpen, Plus, Trash2, Upload } from 'lucide-react'
import { Modal } from './Modal'
import { useProjectStore, createEmptyProject } from '../store/project'
import type { Project, ProjectSummary } from '../types'
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
  setLastProjectId,
} from '../io/db'
import { parseProject } from '../io/projectFile'
import { uid } from '../lib/id'
import { useUiStore } from '../store/ui'

export function ProjectsDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void
  onOpen: (project: Project) => void
}) {
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const currentId = useProjectStore((s) => s.project.id)
  const notify = useUiStore((s) => s.notify)

  const refresh = () => {
    void listProjects().then(setItems)
  }

  useEffect(refresh, [])

  const open = async (id: string) => {
    setBusy(true)
    const project = await loadProject(id)
    setBusy(false)
    if (!project) {
      notify('Project could not be opened')
      return
    }
    await setLastProjectId(id)
    onOpen(project)
    onClose()
  }

  const create = async () => {
    const project = createEmptyProject(`Melody ${items.length + 1}`)
    await saveProject(project)
    await setLastProjectId(project.id)
    onOpen(project)
    onClose()
  }

  const duplicate = async (id: string) => {
    const project = await loadProject(id)
    if (!project) return
    const copy: Project = {
      ...project,
      id: uid('prj'),
      name: `${project.name} copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await saveProject(copy)
    refresh()
  }

  const remove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    await deleteProject(id)
    setConfirmId(null)
    refresh()
    if (id === currentId) {
      const next = createEmptyProject()
      await saveProject(next)
      onOpen(next)
    }
  }

  const importFile = async (file: File) => {
    try {
      const text = await file.text()
      const project = parseProject(text)
      project.id = uid('prj')
      project.name = project.name || file.name.replace(/\.json$/i, '')
      await saveProject(project)
      refresh()
      notify('Project imported')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not import that file')
    }
  }

  return (
    <Modal
      title="Projects"
      subtitle="Stored locally in this browser"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={13} />
            Import JSON
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={create}>
            <Plus size={13} />
            New project
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importFile(file)
          e.target.value = ''
        }}
      />

      {items.length === 0 && <p className="empty-note">No projects yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <div key={item.id} className={`project-row ${item.id === currentId ? 'current' : ''}`}>
            <FolderOpen size={15} style={{ color: 'var(--faint)', flex: 'none' }} />
            <div className="meta" onClick={() => void open(item.id)} style={{ cursor: 'pointer' }}>
              <div className="pname">{item.name}</div>
              <div className="pmeta">
                {new Date(item.updatedAt).toLocaleString()} · {item.bpm} BPM · {item.notes} notes
              </div>
            </div>
            <button
              className="icon-btn"
              style={{ width: 26, height: 26 }}
              onClick={() => void duplicate(item.id)}
              title="Duplicate"
              disabled={busy}
            >
              <Copy size={13} />
            </button>
            <button
              className="icon-btn"
              style={{
                width: 26,
                height: 26,
                color: confirmId === item.id ? 'var(--danger)' : undefined,
              }}
              onClick={() => void remove(item.id)}
              title={confirmId === item.id ? 'Click again to delete' : 'Delete'}
              disabled={busy}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      {confirmId && (
        <p className="empty-note" style={{ marginTop: 10, color: 'var(--danger)' }}>
          Click the trash icon again to delete “{items.find((i) => i.id === confirmId)?.name}”.
          This cannot be undone.
        </p>
      )}
    </Modal>
  )
}
