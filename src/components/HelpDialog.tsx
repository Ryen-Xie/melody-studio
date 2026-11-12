import { Modal } from './Modal'

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Transport',
    rows: [
      ['Play / pause', 'Space'],
      ['Stop', 'Enter'],
      ['Loop on / off', 'L'],
      ['Save to this browser', 'Ctrl S'],
    ],
  },
  {
    title: 'Editing',
    rows: [
      ['Select / move', '1'],
      ['Draw notes', '2'],
      ['Erase notes', '3'],
      ['Pan canvas', '4'],
      ['Delete selection', 'Del'],
      ['Duplicate', 'Ctrl D'],
      ['Copy / cut / paste', 'Ctrl C · X · V'],
      ['Select all / invert', 'Ctrl A · Ctrl ⇧ I'],
      ['Undo / redo', 'Ctrl Z · Ctrl ⇧ Z'],
      ['Nudge notes', '← → ↑ ↓'],
      ['Nudge an octave', 'Shift ↑ ↓'],
    ],
  },
  {
    title: 'Piano',
    rows: [
      ['Play notes', 'A W S E D F T G Y H U J K'],
      ['Octave down / up', 'Z · X'],
      ['Click a key', 'audition that pitch'],
    ],
  },
  {
    title: 'Canvas',
    rows: [
      ['Zoom horizontally', 'Ctrl + wheel'],
      ['Zoom pitch rows', 'Alt + wheel'],
      ['Scroll', 'wheel'],
      ['Scroll horizontally', 'Shift + wheel'],
      ['Pan', 'Space + drag · middle drag'],
      ['Bypass snap while dragging', 'hold Shift'],
      ['Ruler: move playhead', 'click / drag'],
      ['Ruler: set loop', 'Shift + drag'],
      ['Duplicate by dragging', 'Alt + drag a note'],
      ['Note properties', 'Double-click a note'],
    ],
  },
]

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard & mouse"
      subtitle="Everything worth knowing, on one screen"
      onClose={onClose}
      width={640}
    >
      <div className="help-grid">
        {GROUPS.map((group) => (
          <div className="help-col" key={group.title}>
            <h4>{group.title}</h4>
            {group.rows.map(([label, keys]) => (
              <div className="help-row" key={label}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        ))}
        <div className="help-col">
          <h4>About</h4>
          <p className="empty-note">
            Melody Studio keeps every project in this browser. The piano is the Salamander
            Grand Piano by Alexander Holm, used under CC-BY 3.0.
          </p>
          <p className="empty-note" style={{ marginTop: 8 }}>
            Built with Tone.js, React and Canvas. Everything runs locally — no account, no
            upload, no tracking.
          </p>
        </div>
      </div>
    </Modal>
  )
}
