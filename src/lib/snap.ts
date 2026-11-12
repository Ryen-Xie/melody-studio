import type { TimeSignature } from '../types'
import { WHOLE } from './ticks'

export type SnapOption =
  | 'off'
  | '1/1'
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32'
  | '1/4T'
  | '1/8T'
  | '1/16T'
  | '1/8.'
  | '1/16.'

export const SNAP_OPTIONS: { id: SnapOption; label: string; group: string }[] = [
  { id: 'off', label: 'Off', group: 'Free' },
  { id: '1/1', label: '1/1', group: 'Straight' },
  { id: '1/2', label: '1/2', group: 'Straight' },
  { id: '1/4', label: '1/4', group: 'Straight' },
  { id: '1/8', label: '1/8', group: 'Straight' },
  { id: '1/16', label: '1/16', group: 'Straight' },
  { id: '1/32', label: '1/32', group: 'Straight' },
  { id: '1/4T', label: '1/4 T', group: 'Triplet' },
  { id: '1/8T', label: '1/8 T', group: 'Triplet' },
  { id: '1/16T', label: '1/16 T', group: 'Triplet' },
  { id: '1/8.', label: '1/8 dotted', group: 'Dotted' },
  { id: '1/16.', label: '1/16 dotted', group: 'Dotted' },
]

/** Length of one grid step in ticks for the given snap setting. */
export function snapTicks(option: SnapOption, _ts: TimeSignature): number {
  if (option === 'off') return 0
  const triplet = option.endsWith('T')
  const dotted = option.endsWith('.')
  const core = option.replace(/[T.]$/, '')
  const [num, den] = core.split('/').map(Number)
  let step = (WHOLE * num) / den
  if (triplet) step *= 2 / 3
  if (dotted) step *= 3 / 2
  return step
}

/** Shortest note the editor will create, regardless of snap. */
export const MIN_NOTE = 30
