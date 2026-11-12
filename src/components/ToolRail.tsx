import { Eraser, Hand, MousePointer2, Pencil } from 'lucide-react'
import { useUiStore } from '../store/ui'
import type { Tool } from '../types'

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select — move, resize, marquee', key: '1', icon: <MousePointer2 size={17} /> },
  { id: 'draw', label: 'Draw notes', key: '2', icon: <Pencil size={17} /> },
  { id: 'erase', label: 'Erase notes', key: '3', icon: <Eraser size={17} /> },
  { id: 'pan', label: 'Pan the canvas', key: '4', icon: <Hand size={17} /> },
]

export function ToolRail() {
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)

  return (
    <div className="rail">
      {TOOLS.map((item) => (
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
