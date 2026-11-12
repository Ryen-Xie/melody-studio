import { create } from 'zustand'
import type { SnapOption } from '../lib/snap'
import type { Tool } from '../types'
import { clamp } from '../lib/ticks'

export interface Viewport {
  /** horizontal zoom */
  pxPerTick: number
  /** vertical zoom, px per semitone */
  rowHeight: number
  /** left edge of the visible area, in ticks */
  scrollTicks: number
  /** pitch at the very top of the visible grid (fractional allowed) */
  scrollPitch: number
  width: number
  height: number
}

export const MIN_PX_PER_TICK = 0.035
export const MAX_PX_PER_TICK = 0.9
export const MIN_ROW_HEIGHT = 9
export const MAX_ROW_HEIGHT = 34

export type BottomTab = 'velocity' | 'info'

interface UiStore {
  tool: Tool
  setTool: (t: Tool) => void
  snap: SnapOption
  setSnap: (s: SnapOption) => void

  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  toggleTheme: () => void

  viewport: Viewport
  setViewportSize: (width: number, height: number) => void
  setScroll: (patch: Partial<Pick<Viewport, 'scrollTicks' | 'scrollPitch'>>) => void
  panBy: (dxPx: number, dyPx: number) => void
  zoomXAt: (factor: number, anchorPx: number, keyboardWidth: number) => void
  zoomYAt: (factor: number, anchorPx: number, rulerHeight: number) => void
  fitToContent: (args: {
    totalTicks: number
    minPitch: number
    maxPitch: number
    width: number
    height: number
    keyboardWidth: number
    rulerHeight: number
  }) => void

  keyboardOctave: number
  setKeyboardOctave: (v: number) => void

  scaleSnap: boolean
  setScaleSnap: (v: boolean) => void
  showScaleGuide: boolean
  setShowScaleGuide: (v: boolean) => void
  showChords: boolean
  setShowChords: (v: boolean) => void
  chordPreview: boolean
  setChordPreview: (v: boolean) => void

  rightOpen: boolean
  setRightOpen: (v: boolean) => void
  bottomOpen: boolean
  setBottomOpen: (v: boolean) => void
  bottomTab: BottomTab
  setBottomTab: (t: BottomTab) => void
  bottomHeight: number
  setBottomHeight: (h: number) => void

  playing: boolean
  setPlaying: (v: boolean) => void
  saveState: 'saved' | 'saving' | 'dirty'
  setSaveState: (v: 'saved' | 'saving' | 'dirty') => void
  audioStatus: 'idle' | 'loading' | 'ready' | 'fallback'
  setAudioStatus: (v: 'idle' | 'loading' | 'ready' | 'fallback') => void

  toast: string | null
  notify: (message: string) => void
  clearToast: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUiStore = create<UiStore>((set) => ({
  tool: 'draw',
  setTool: (tool) => set({ tool }),
  snap: '1/8',
  setSnap: (snap) => set({ snap }),

  theme:
    typeof localStorage !== 'undefined' && localStorage.getItem('melody-theme') === 'light'
      ? 'light'
      : 'dark',
  setTheme: (theme) => {
    try {
      localStorage.setItem('melody-theme', theme)
    } catch {
      /* private mode */
    }
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem('melody-theme', theme)
      } catch {
        /* private mode */
      }
      return { theme }
    }),

  viewport: {
    pxPerTick: 0.14,
    rowHeight: 18,
    scrollTicks: 0,
    scrollPitch: 84,
    width: 900,
    height: 520,
  },
  setViewportSize: (width, height) =>
    set((s) => ({ viewport: { ...s.viewport, width, height } })),
  setScroll: (patch) =>
    set((s) => ({
      viewport: {
        ...s.viewport,
        ...(patch.scrollTicks !== undefined
          ? { scrollTicks: Math.max(0, patch.scrollTicks) }
          : {}),
        ...(patch.scrollPitch !== undefined
          ? { scrollPitch: clamp(12, 112, patch.scrollPitch) }
          : {}),
      },
    })),
  panBy: (dxPx, dyPx) =>
    set((s) => ({
      viewport: {
        ...s.viewport,
        scrollTicks: Math.max(0, s.viewport.scrollTicks - dxPx / s.viewport.pxPerTick),
        scrollPitch: clamp(
          12,
          112,
          s.viewport.scrollPitch + dyPx / s.viewport.rowHeight,
        ),
      },
    })),
  zoomXAt: (factor, anchorPx, keyboardWidth) =>
    set((s) => {
      const vp = s.viewport
      const next = clamp(MIN_PX_PER_TICK, MAX_PX_PER_TICK, vp.pxPerTick * factor)
      const anchorTicks = vp.scrollTicks + (anchorPx - keyboardWidth) / vp.pxPerTick
      const scrollTicks = Math.max(
        0,
        anchorTicks - (anchorPx - keyboardWidth) / next,
      )
      return { viewport: { ...vp, pxPerTick: next, scrollTicks } }
    }),
  zoomYAt: (factor, anchorPx, rulerHeight) =>
    set((s) => {
      const vp = s.viewport
      const next = clamp(MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, vp.rowHeight * factor)
      const anchorPitch = vp.scrollPitch - (anchorPx - rulerHeight) / vp.rowHeight
      const scrollPitch = clamp(
        12,
        112,
        anchorPitch + (anchorPx - rulerHeight) / next,
      )
      return { viewport: { ...vp, rowHeight: next, scrollPitch } }
    }),
  fitToContent: ({ totalTicks, minPitch, maxPitch, width, height, keyboardWidth, rulerHeight }) =>
    set((s) => {
      const usableW = Math.max(200, width - keyboardWidth - 24)
      const usableH = Math.max(120, height - rulerHeight - 24)
      const pxPerTick = clamp(
        MIN_PX_PER_TICK,
        MAX_PX_PER_TICK,
        usableW / Math.max(totalTicks, 1),
      )
      const pitchSpan = Math.max(12, maxPitch - minPitch + 5)
      const rowHeight = clamp(MIN_ROW_HEIGHT, MAX_ROW_HEIGHT, usableH / pitchSpan)
      return {
        viewport: {
          ...s.viewport,
          pxPerTick,
          rowHeight,
          scrollTicks: 0,
          scrollPitch: Math.min(112, maxPitch + 2),
        },
      }
    }),

  keyboardOctave: 4,
  setKeyboardOctave: (v) => set({ keyboardOctave: clamp(1, 7, v) }),

  scaleSnap: false,
  setScaleSnap: (scaleSnap) => set({ scaleSnap }),
  showScaleGuide: true,
  setShowScaleGuide: (showScaleGuide) => set({ showScaleGuide }),
  showChords: true,
  setShowChords: (showChords) => set({ showChords }),
  chordPreview: true,
  setChordPreview: (chordPreview) => set({ chordPreview }),

  rightOpen: true,
  setRightOpen: (rightOpen) => set({ rightOpen }),
  bottomOpen: true,
  setBottomOpen: (bottomOpen) => set({ bottomOpen }),
  bottomTab: 'velocity',
  setBottomTab: (bottomTab) => set({ bottomTab }),
  bottomHeight: 132,
  setBottomHeight: (h) => set({ bottomHeight: clamp(96, 340, h) }),

  playing: false,
  setPlaying: (playing) => set({ playing }),
  saveState: 'saved',
  setSaveState: (saveState) => set({ saveState }),
  audioStatus: 'idle',
  setAudioStatus: (audioStatus) => set({ audioStatus }),

  toast: null,
  notify: (message) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: message })
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },
  clearToast: () => set({ toast: null }),
}))
