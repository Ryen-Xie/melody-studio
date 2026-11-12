import type { Project } from '../types'
import { barTicks, ticksToSeconds } from '../lib/ticks'
import { SAMPLE_FILES, fetchSample, nearestRoot } from './samples'
import { encodeWav } from './wav'

export interface RenderOptions {
  onProgress?: (progress: number, label?: string) => void
  startTicks?: number
  endTicks?: number
}

const TAIL_SECONDS = 2

function makeImpulse(ctx: OfflineAudioContext, seconds = 2.2, decay = 2.8): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * seconds)
  const buffer = ctx.createBuffer(2, length, rate)
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return buffer
}

/**
 * Render the melody offline with the same samples used for playback, then
 * encode it as 16-bit WAV. Nothing is captured from the speakers.
 */
export async function renderProjectWav(
  project: Project,
  opts: RenderOptions = {},
): Promise<Blob> {
  const { onProgress } = opts
  const totalTicks = barTicks(project.timeSignature) * project.bars
  const loop = project.loop
  const startTicks =
    opts.startTicks ?? (loop.enabled ? Math.max(0, loop.start) : 0)
  const endTicks =
    opts.endTicks ?? (loop.enabled ? Math.min(totalTicks, loop.end) : totalTicks)

  const notes = project.notes.filter(
    (n) => n.start + n.duration > startTicks && n.start < endTicks,
  )
  const spanTicks = Math.max(1, endTicks - startTicks)
  const lengthSeconds = ticksToSeconds(spanTicks, project.bpm) + TAIL_SECONDS
  const sampleRate = 44100

  onProgress?.(0.05, 'Preparing audio engine')
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(lengthSeconds * sampleRate),
    sampleRate,
  )

  const master = ctx.createGain()
  master.gain.value = 0.82
  const glue = ctx.createDynamicsCompressor()
  glue.threshold.value = -8
  glue.knee.value = 8
  glue.ratio.value = 3
  glue.attack.value = 0.004
  glue.release.value = 0.24

  const dry = ctx.createGain()
  dry.gain.value = 1
  const wet = ctx.createGain()
  wet.gain.value = Math.max(0, Math.min(0.6, project.instrument.reverb))
  const convolver = ctx.createConvolver()
  convolver.buffer = makeImpulse(ctx)

  dry.connect(glue)
  convolver.connect(wet)
  wet.connect(glue)
  glue.connect(master)
  master.connect(ctx.destination)

  // Decode every sample the melody needs, once.
  const needed = new Map<string, Promise<AudioBuffer>>()
  for (const note of notes) {
    const root = nearestRoot(note.pitch)
    if (!needed.has(root.name)) {
      needed.set(
        root.name,
        fetchSample(SAMPLE_FILES[root.name]).then((raw) =>
          ctx.decodeAudioData(raw.slice(0)),
        ),
      )
    }
  }

  const buffers = new Map<string, AudioBuffer>()
  let loaded = 0
  for (const [name, promise] of needed) {
    buffers.set(name, await promise)
    loaded += 1
    onProgress?.(0.08 + 0.42 * (loaded / Math.max(1, needed.size)), 'Loading piano samples')
  }

  onProgress?.(0.55, 'Placing notes')
  await new Promise((r) => setTimeout(r, 0))

  for (const note of notes) {
    const root = nearestRoot(note.pitch)
    const buffer = buffers.get(root.name)
    if (!buffer) continue

    const at = ticksToSeconds(note.start - startTicks, project.bpm)
    if (at >= lengthSeconds) continue
    const dur = ticksToSeconds(note.duration, project.bpm)
    const release = 0.55
    const stopAt = Math.min(lengthSeconds, at + dur + release)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = Math.pow(2, (note.pitch - root.pitch) / 12)

    const gain = ctx.createGain()
    const peak = Math.max(0.02, note.velocity / 127) * 0.9
    gain.gain.setValueAtTime(0.0001, Math.max(0, at))
    gain.gain.linearRampToValueAtTime(peak, at + 0.006)
    gain.gain.setValueAtTime(peak, Math.max(at + 0.006, at + dur))
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(at + dur + 0.01, stopAt))

    source.connect(gain)
    gain.connect(dry)
    gain.connect(convolver)
    source.start(Math.max(0, at))
    source.stop(stopAt)
  }

  onProgress?.(0.62, 'Rendering waveform')
  const rendered = await ctx.startRendering()

  /* normalize to a predictable level so exports are not whisper-quiet */
  let peak = 0
  for (let ch = 0; ch < rendered.numberOfChannels; ch += 1) {
    const data = rendered.getChannelData(ch)
    for (let i = 0; i < data.length; i += 1) {
      const value = Math.abs(data[i])
      if (value > peak) peak = value
    }
  }
  if (peak > 0.0005) {
    const gain = Math.min(12, 0.89 / peak)
    for (let ch = 0; ch < rendered.numberOfChannels; ch += 1) {
      const data = rendered.getChannelData(ch)
      for (let i = 0; i < data.length; i += 1) data[i] *= gain
    }
  }

  onProgress?.(0.92, 'Encoding WAV')
  await new Promise((r) => setTimeout(r, 0))
  const blob = encodeWav(rendered)
  onProgress?.(1, 'Done')
  return blob
}
