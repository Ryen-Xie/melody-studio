import { Modal } from './Modal'
import { useT } from '../lib/i18n'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT()

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: t('help.transport'),
      rows: [
        [t('help.row.playPause'), 'Space'],
        [t('help.row.stop'), 'Enter'],
        [t('help.row.loop'), 'L'],
        [t('help.row.save'), 'Ctrl S'],
      ],
    },
    {
      title: t('help.editing'),
      rows: [
        [t('help.row.select'), '1'],
        [t('help.row.draw'), '2'],
        [t('help.row.erase'), '3'],
        [t('help.row.pan'), '4'],
        [t('help.row.delete'), 'Del'],
        [t('help.row.duplicate'), 'Ctrl D'],
        [t('help.row.clipboard'), 'Ctrl C · X · V'],
        [t('help.row.selectAll'), 'Ctrl A · Ctrl ⇧ I'],
        [t('help.row.undo'), 'Ctrl Z · Ctrl ⇧ Z'],
        [t('help.row.nudge'), '← → ↑ ↓'],
        [t('help.row.octave'), 'Shift ↑ ↓'],
      ],
    },
    {
      title: t('help.piano'),
      rows: [
        [t('help.row.playNotes'), 'A W S E D F T G Y H U J K'],
        [t('help.row.pianoOctave'), 'Z · X'],
        [t('help.row.clickKey'), t('help.row.audition')],
      ],
    },
    {
      title: t('help.canvas'),
      rows: [
        [t('help.row.zoomX'), t('help.key.ctrlWheel')],
        [t('help.row.zoomY'), t('help.key.altWheel')],
        [t('help.row.scroll'), t('help.key.wheel')],
        [t('help.row.scrollX'), t('help.key.shiftWheel')],
        [t('help.row.panGesture'), t('help.key.spaceDrag')],
        [t('help.row.bypass'), t('help.key.holdShift')],
        [t('help.row.rulerSeek'), t('help.key.clickDrag')],
        [t('help.row.rulerLoop'), t('help.key.shiftDrag')],
        [t('help.row.altDrag'), t('help.key.altDragNote')],
        [t('help.row.dblclick'), t('help.key.dblclickNote')],
      ],
    },
  ]

  return (
    <Modal
      title={t('help.title')}
      subtitle={t('help.subtitle')}
      onClose={onClose}
      width={640}
    >
      <div className="help-grid">
        {groups.map((group) => (
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
          <h4>{t('help.about')}</h4>
          <p className="empty-note">{t('help.about1')}</p>
          <p className="empty-note" style={{ marginTop: 8 }}>
            {t('help.about2')}
          </p>
        </div>
      </div>
    </Modal>
  )
}
