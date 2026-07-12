// The granular synth engine. Deliberately has zero knowledge of MIDI —
// it exposes noteOn/noteOff like any synth, and anything that wants to
// drive it (a MIDI file player, a manual on-screen keyboard) is just one
// more caller of that same interface.

import type { WorkletModulationConfig } from "../audio/modulation/types";
import type { NoteEvent, NoteTarget } from "../midi/noteTarget";

export interface GrainParams {
  /** Each spawned grain gets its own random length in [min, max] ms, rather
   * than a single fixed duration. Which end of that range moves is set by
   * grainDurationMode. */
  grainDurationMinMs: number;
  grainDurationMaxMs: number;
  /** "random" (default): duration is picked uniformly across the full
   * min/max range regardless of envelope phase. "envelope": the top of
   * the range scales with the voice's ADSR envelope, so grains start
   * short (attack), lengthen toward grainDurationMaxMs at sustain, then
   * shorten again through release — the same shape densityHz already
   * follows unconditionally (see granular-processor.js's spawnGrain). */
  grainDurationMode: "random" | "envelope";
  densityHz: number;
  positionJitterMs: number;
  pitchJitterCents: number;
  panSpread: number;
  scanSpeed: number;
  playheadMode: "shared" | "per-note";
  /** Per-voice ADSR envelope, applied to both grain amplitude and grain
   * density (sparse-to-dense on attack, thinning out on release) — see
   * granular-processor.js's advanceEnvelope. */
  attackMs: number;
  decayMs: number;
  sustainLevel: number;
  releaseMs: number;
  /** Only affects Direct Play's continuous voice — MIDI/manual notes get
   * their pitch from note number instead. */
  directPitchSemitones: number;
}

/** A lightweight snapshot of one currently-sounding grain, for the live
 * grain-cloud view — not the full grain state, just enough to plot a dot:
 * position in the sample (0..1), pan spread (-1..1), amplitude, remaining
 * life (1 = just spawned, 0 = about to finish), and playback rate (pitch). */
export interface GrainSnapshot {
  pos: number;
  pan: number;
  amp: number;
  life: number;
  rate: number;
}

export interface SynthStatus {
  activeVoices: number;
  activeGrains: number;
  playheadFraction: number;
  /** Capped subset of active grains (see MAX_STATUS_GRAINS in the worklet) —
   * enough for a representative visualization, not necessarily every grain. */
  grains: GrainSnapshot[];
}

export interface GranularSynthOptions {
  /** Where the AudioWorkletProcessor script is served from. Defaults to
   * where granular_midi (this engine's originating app) serves it; a
   * consuming app that copies granular-processor.js to a different public
   * path should pass that path here instead. */
  workletUrl?: string;
}

const DEFAULT_WORKLET_URL = "/worklets/granular-processor.js";

export class GranularSynth implements NoteTarget {
  readonly output: GainNode;
  private node: AudioWorkletNode | null = null;
  private moduleLoaded = false;
  private statusCallback: ((status: SynthStatus) => void) | null = null;
  private workletUrl: string;

  constructor(
    private audioContext: AudioContext,
    options: GranularSynthOptions = {},
  ) {
    this.output = audioContext.createGain();
    this.workletUrl = options.workletUrl ?? DEFAULT_WORKLET_URL;
  }

  /** Sets up the worklet node. Safe to call before a user gesture; only
   * `resume()` needs to happen inside one. */
  async init(): Promise<void> {
    if (this.node) return;
    if (!this.moduleLoaded) {
      await this.audioContext.audioWorklet.addModule(this.workletUrl);
      this.moduleLoaded = true;
    }
    this.node = new AudioWorkletNode(this.audioContext, "granular-processor", {
      outputChannelCount: [2],
    });
    this.node.connect(this.output);
    this.node.port.onmessage = (event) => {
      if (event.data.type === "status" && this.statusCallback) {
        this.statusCallback(event.data as SynthStatus);
      }
    };
  }

  /** Must be called from within a user-gesture handler. */
  async resume(): Promise<void> {
    await this.audioContext.resume();
  }

  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }

  onStatus(callback: (status: SynthStatus) => void): void {
    this.statusCallback = callback;
  }

  async loadSample(buffer: AudioBuffer): Promise<void> {
    await this.init();
    const mono = downmixToMono(buffer);
    this.node?.port.postMessage({ type: "loadSample", channelData: mono }, [
      mono.buffer,
    ]);
  }

  setParams(params: Partial<GrainParams>): void {
    this.node?.port.postMessage({ type: "setParams", params });
  }

  /** Assigns (or clears, with `null`) one of the fixed LFO slots to a
   * worklet-internal target. Native AudioParam targets (effects, master
   * volume) don't go through the synth at all — see lfoEngine.ts, which
   * modulates those directly with a real OscillatorNode instead. */
  setModulation(slot: number, config: WorkletModulationConfig | null): void {
    this.node?.port.postMessage({ type: "setModulation", slot, config });
  }

  noteOn(note: number, velocity: number, time?: number): void {
    this.node?.port.postMessage({ type: "noteOn", note, velocity, time });
  }

  noteOff(note: number, time?: number): void {
    this.node?.port.postMessage({ type: "noteOff", note, time });
  }

  /** Bulk-submit a fully precomputed set of note events (e.g. a whole MIDI
   * file's worth) in one message, rather than one postMessage per note. */
  scheduleEvents(events: NoteEvent[]): void {
    this.node?.port.postMessage({ type: "schedule", events });
  }

  clear(): void {
    this.node?.port.postMessage({ type: "clear" });
  }

  /** Direct Play: a third, independent way to drive the synth alongside
   * noteOn/noteOff — no note number involved at all, so grains stream at
   * the sample's natural pitch (no shift) for as long as it's on. Kept as
   * its own message pair rather than noteOn(60, ...) so it can't collide
   * with the manual keyboard's own note-60 key. */
  directPlayOn(time?: number): void {
    this.node?.port.postMessage({ type: "directPlayOn", time });
  }

  directPlayOff(time?: number): void {
    this.node?.port.postMessage({ type: "directPlayOff", time });
  }

  /** Repositions the moving playhead directly (e.g. from a waveform click). */
  setPlayhead(positionSeconds: number): void {
    this.node?.port.postMessage({
      type: "setPlayhead",
      position: positionSeconds,
    });
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++)
      mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}
