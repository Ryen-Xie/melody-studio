import * as Tone from 'tone'
import type { Chord, Project } from '../types'
import { CHORD_INTERVALS } from '../lib/theory'
import { pitchLabel } from '../lib/pitch'
import { barTicks, clamp, secondsToTicks, ticksToSeconds, ticksPerBeat } from '../lib/ticks'
import { SAMPLE_BASE, SAMPLE_FILES } from './samples'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'fallback'

type Listener = () => void

class MelodyEngine {
  private sampler: Tone.Sampler | null = null
  private poly: Tone.PolySynth | null = null
  private volume: Tone.Volume | null = null
  private reverb: Tone.Reverb | null = null
  private click: Tone.Synth | null = null
  private transport = Tone.getTransport()

  private loadPromise: Promise<void> | null = null
  private _status: EngineStatus = 'idle'
  private statusListeners = new Set<Listener>()
  private frameListeners = new Set<Listener>()

  private project: Project | null = null
  private bpm = 96
  private raf = 0

  isPlaying = false
  onEnded: (() => void) | null = null

  get status(): EngineStatus {
    return this._status
  }

  subscribeStatus = (fn: Listener) => {
    this.statusListeners.add(fn)
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  subscribeFrame = (fn: Listener) => {
    this.frameListeners.add(fn)
    return () => {
      this.frameListeners.delete(fn)
    }
  }

  private setStatus(status: EngineStatus) {
    this._status = status
    this.statusListeners.forEach((fn) => fn())
  }

  private emitFrame() {
    this.frameListeners.forEach((fn) => fn())
  }

  async init(): Promise<void> {
    if (this._status === 'ready' || this._status === 'fallback') return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = (async () => {
      this.setStatus('loading')
      await Tone.start()
      this.buildChain()
      try {
        const sampler = new Tone.Sampler({
          urls: SAMPLE_FILES,
          baseUrl: SAMPLE_BASE,
          release: 1.1,
          attack: 0,
          curve: 'exponential',
        })
        if (this.reverb) sampler.connect(this.reverb)
        await Tone.loaded()
        this.sampler = sampler
        this.setStatus('ready')
      } catch (err) {
        console.warn('[melody] piano samples unavailable, using synth fallback', err)
        const poly = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.005, decay: 0.9, sustain: 0.18, release: 1.4 },
        })
        poly.maxPolyphony = 48
        if (this.reverb) poly.connect(this.reverb)
        this.poly = poly
        this.setStatus('fallback')
      }
    })()

    return this.loadPromise
  }

  private buildChain() {
    if (this.volume) return
    this.volume = new Tone.Volume(-3).toDestination()
    this.reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.012, wet: 0.26 })
    this.reverb.connect(this.volume)
    try {
      void this.reverb.generate()
    } catch {
      /* the reverb is optional */
    }
    this.click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
      volume: -14,
    }).connect(this.volume)
    this.transport.bpm.value = this.bpm
  }

  setVolume(db: number) {
    if (this.volume) this.volume.volume.rampTo(clamp(-40, 6, db), 0.05)
  }

  setReverb(wet: number) {
    if (this.reverb) this.reverb.wet.rampTo(clamp(0, 1, wet), 0.1)
  }

  /** Audition a single pitch (used while drawing and by the keyboard). */
  async preview(pitch: number, velocity = 100, duration = 1.1) {
    await this.init()
    const name = pitchLabel(pitch)
    const vel = clamp(1, 127, velocity) / 127
    const now = Tone.now()
    if (this.sampler) this.sampler.triggerAttackRelease(name, duration, now, vel)
    else this.poly?.triggerAttackRelease(name, duration, now, vel)
  }

  async previewAttack(pitch: number, velocity = 100) {
    await this.init()
    const name = pitchLabel(pitch)
    const vel = clamp(1, 127, velocity) / 127
    if (this.sampler) this.sampler.triggerAttack(name, Tone.now(), vel)
    else this.poly?.triggerAttack(name, Tone.now(), vel)
  }

  previewRelease(pitch: number) {
    const name = pitchLabel(pitch)
    if (this.sampler) this.sampler.triggerRelease(name, Tone.now())
    else this.poly?.triggerRelease(name, Tone.now())
  }

  async previewChord(chord: Pick<Chord, 'root' | 'quality'>, octave = 4) {
    await this.init()
    const base = 12 * (octave + 1) + chord.root
    const names = CHORD_INTERVALS[chord.quality].map((i) => pitchLabel(base + i))
    const now = Tone.now()
    if (this.sampler) this.sampler.triggerAttackRelease(names, 1.4, now, 0.5)
    else this.poly?.triggerAttackRelease(names, 1.4, now, 0.5)
  }

  setMetronome(on: boolean, project?: Project) {
    if (project) this.project = { ...project, instrument: { ...project.instrument, metronome: on } }
    if (this.isPlaying) this.schedule()
  }

  get positionTicks(): number {
    return secondsToTicks(this.transport.seconds, this.bpm)
  }

  private startFrameLoop() {
    if (this.raf) return
    const tick = () => {
      this.raf = requestAnimationFrame(tick)
      this.emitFrame()
    }
    this.raf = requestAnimationFrame(tick)
  }

  private stopFrameLoop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  /** Rebuild every scheduled event from the project snapshot. */
  schedule(project?: Project) {
    if (project) this.project = project
    const p = this.project
    if (!p) return

    this.bpm = p.bpm
    this.transport.bpm.value = p.bpm
    this.transport.cancel(0)

    const totalTicks = barTicks(p.timeSignature) * p.bars
    const endSeconds = ticksToSeconds(totalTicks, p.bpm)

    if (p.loop.enabled) {
      this.transport.loop = true
      this.transport.loopStart = ticksToSeconds(Math.min(p.loop.start, totalTicks), p.bpm)
      this.transport.loopEnd = Math.min(
        ticksToSeconds(Math.max(p.loop.end, p.loop.start + ticksPerBeat(p.timeSignature.denominator)), p.bpm),
        endSeconds,
      )
    } else {
      this.transport.loop = false
      this.transport.loopStart = 0
      this.transport.loopEnd = 0
    }

    for (const note of p.notes) {
      const at = ticksToSeconds(note.start, p.bpm)
      if (at > endSeconds) continue
      const dur =
        Math.max(0.03, ticksToSeconds(note.duration, p.bpm)) +
        (p.instrument.sustain ? 0.9 : 0)
      const vel = clamp(1, 127, note.velocity) / 127
      this.transport.schedule((time: number) => {
        const name = pitchLabel(note.pitch)
        if (this.sampler) this.sampler.triggerAttackRelease(name, dur, time, vel)
        else this.poly?.triggerAttackRelease(name, dur, time, vel)
      }, at)
    }

    if (p.instrument.metronome) {
      const beatLen = ticksPerBeat(p.timeSignature.denominator)
      const beats = Math.ceil(totalTicks / beatLen)
      for (let b = 0; b < beats; b += 1) {
        const at = ticksToSeconds(b * beatLen, p.bpm)
        if (at > endSeconds) break
        const accent = b % p.timeSignature.numerator === 0
        this.transport.schedule((time: number) => {
          this.click?.triggerAttackRelease(accent ? 'C6' : 'C5', 0.03, time, accent ? 0.9 : 0.5)
        }, at)
      }
    }

    if (!p.loop.enabled) {
      this.transport.schedule((time: number) => {
        void time
        this.isPlaying = false
        this.stopFrameLoop()
        this.transport.stop()
        this.transport.seconds = 0
        this.emitFrame()
        this.onEnded?.()
      }, endSeconds)
    }
  }

  async play(project: Project, fromTicks?: number) {
    await this.init()
    this.project = project
    this.bpm = project.bpm

    const totalTicks = barTicks(project.timeSignature) * project.bars
    let startTicks = fromTicks ?? this.positionTicks

    if (project.loop.enabled) {
      if (startTicks < project.loop.start || startTicks >= project.loop.end) {
        startTicks = project.loop.start
      }
    } else if (startTicks >= totalTicks) {
      startTicks = 0
    }

    this.schedule(project)
    this.transport.seconds = ticksToSeconds(startTicks, project.bpm)
    this.transport.start('+0.06')
    this.isPlaying = true
    this.startFrameLoop()
    this.emitFrame()
  }

  pause() {
    this.transport.pause()
    this.isPlaying = false
    this.stopFrameLoop()
    this.emitFrame()
  }

  stop() {
    this.transport.stop()
    this.transport.seconds = 0
    this.isPlaying = false
    this.stopFrameLoop()
    this.emitFrame()
  }

  seek(ticks: number) {
    const p = this.project
    const total = p ? barTicks(p.timeSignature) * p.bars : ticks
    this.transport.seconds = ticksToSeconds(clamp(0, total, ticks), this.bpm)
    this.emitFrame()
  }

  /** Keep tempo/loop in sync even while stopped. */
  sync(project: Project) {
    this.project = project
    this.bpm = project.bpm
    this.transport.bpm.value = project.bpm
  }

  /** Re-schedule while playing so edits are heard immediately. */
  refresh(project: Project) {
    const wasPlaying = this.isPlaying
    const at = this.positionTicks
    this.sync(project)
    if (wasPlaying) {
      this.schedule(project)
      this.transport.seconds = ticksToSeconds(at, project.bpm)
    }
    this.emitFrame()
  }

  dispose() {
    this.stopFrameLoop()
    this.transport.stop()
    this.transport.cancel(0)
    this.sampler?.dispose()
    this.poly?.dispose()
    this.reverb?.dispose()
    this.volume?.dispose()
    this.click?.dispose()
  }
}

export const engine = new MelodyEngine()
