import { Eraser, Hand, MousePointer2, Pencil } from 'lucide-react'
import { useUiStore } from '../store/ui'
import { useT } from '../lib/i18n'
import type { Tool } from '../types'

export function ToolRail() {
  const t = useT()
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)

  const tools: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
    { id: 'select', label: t('rail.select'), key: '1', icon: <MousePointer2 size={17} /> },
    { id: 'draw', label: t('rail.draw'), key: '2', icon: <Pencil size={17} /> },
    { id: 'erase', label: t('rail.erase'), key: '3', icon: <Eraser size={17} /> },
    { id: 'pan', label: t('rail.pan'), key: '4', icon: <Hand size={17} /> },
  ]

  return (
    <div className="rail">
      {tools.map((item) => (
        <button
          key={item.id}
          className={`tool-btn ${tool === item.id ? 'active' : ''}`}
          onClick={() => setTool(item.id)}
          title={`${item.label}  (${item.key})`}
          aria-label={item.label}
        >
          {item.icon}
          <span className="kbd">{item.key}</span>
        </button>
      ))}

      <div className="rail-sep" />

      <div style={{ flex: 1 }} />
    </div>
  )
}
