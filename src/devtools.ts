import { useProjectStore } from './store/project'
import { useUiStore } from './store/ui'
import { engine } from './audio/engine'
import { Midi } from '@tonejs/midi'
import { projectToMidi } from './io/midi'
import { renderProjectWav } from './audio/render'
import { serializeProject, parseProject } from './io/projectFile'
import { listProjects, loadProject, deleteProject, saveProject } from './io/db'

/** Dev-only inspection hook used by the smoke tests. */
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__melody = {
    project: () => useProjectStore.getState(),
    ui: () => useUiStore.getState(),
    engine,
    Midi,
    projectToMidi,
    renderProjectWav,
    serializeProject,
    parseProject,
    listProjects,
    loadProject,
    deleteProject,
    saveProject,
  }
}
