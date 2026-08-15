// A worklet-backed sample player that can read an arbitrary sub-range of a
// loaded buffer forward OR backward, with many overlapping one-shot voices
// at once. Exists because nothing else in bruit-kit can play audio backward:
// samplePlayer.ts's AudioBufferSourceNode can't (Web Audio spec -- no
// negative playbackRate), and granularSynth.ts's grain-rate math is
// structurally always positive. See directional-sample-processor.js for the
// actual per-sample read/interpolation/declick logic.
//
// Deliberately narrower than a full scheduler: each playVoice call renders
// exactly one directional read, scheduled independently. Sequencing many
// voices into a pattern (repeats, curve-spaced gaps, drift) is a host-app
// concern (relpmas's SampleNodeEngine), not this class's.

import { type AutomationPoint, sampleCurveAt } from "../audio/automation";

export type PlaybackDirection = "forward" | "backward";

// Resolution of the per-voice envelope lookup table (see playVoice's own
// envelopeCurve option) -- same "power of 2 + 1" sizing and the same
// build-on-the-main-thread-then-transfer-a-Float32Array approach
// phaseDistortionSynth.ts's setDistortionCurve already uses for its own
// per-sample curve lookup, just built fresh per voice instead of once
// globally (a voice's envelope can differ fire to fire, unlike a synth's
// persistent distortion table). Smaller than setDistortionCurve's 513
// since a plain gain envelope needs far less resolution than a phase
// warp table.
const ENVELOPE_TABLE_SIZE = 257;

export interface DirectionalSamplePlayerOptions {
  /** Where the AudioWorkletProcessor script is served from -- see
   * granularSynth.ts's identical option for why this isn't just a fixed
   * bundler-resolved import. */
  workletUrl?: string;
}

export interface PlayVoiceOptions {
  /** Caller-supplied id for later stopVoice()/onVoiceEnded() correlation.
   * Omitted, one is generated and returned. */
  id?: number;
  /** 0..1 fractions of the loaded buffer's own duration. Directional, not
   * an unordered {lo,hi} bound: the selected fragment always runs forward
   * from startFraction to endFraction, wrapping past the buffer's end back
   * to its start if endFraction < startFraction (a true circular
   * fragment). `direction` picks which way playback actually reads that
   * same fragment. */
  startFraction: number;
  endFraction: number;
  direction: PlaybackDirection;
  /** Absolute AudioContext time; defaults to now. */
  time?: number;
  /** Declick fade in/out applied at this voice's own start/end, independent
   * of any other voice -- default 4ms, same order of magnitude as
   * envelope.ts's STEAL_FADE_MS. */
  fadeMs?: number;
  /** Tape-style: shifts pitch and speed together, same rate math as
   * pitch.ts's semitoneRatio. 0 = unshifted. */
  rateSemitones?: number;
  /** Amplitude shape over this one voice's own span, sampled by elapsed
   * fraction (0 at the voice's first frame, 1 at its last) -- independent
   * of, and multiplied together with, the fixed declick fade `fadeMs`
   * above (see directional-sample-processor.js's own render() for
   * exactly how the two combine). Omitted (the default) applies no
   * envelope at all -- every sample plays at full amplitude except for
   * fadeMs's own declick ramp, identical to this class's behavior before
   * this option existed. Curve values are expected in [0,1]; pass a
   * valueRange-remapped curve yourself if you want to scale a voice's own
   * peak below 1. */
  envelopeCurve?: AutomationPoint[];
  /** Flat multiplier for this one voice's entire span -- independent of,
   * and multiplied together with, both fadeMs and envelopeCurve above.
   * Unlike envelopeCurve (a per-sample varying shape), this is a single
   * number decided once before the voice starts, for a caller that's
   * already computed "how loud should this particular fire be" itself
   * (e.g. from its own curve/random/trigger-relative logic) rather than
   * wanting this class to shape it over time. Defaults to 1. */
  gain?: number;
}

const DEFAULT_WORKLET_URL = "/worklets/directional-sample-processor.js";
const DEFAULT_FADE_MS = 4;

export class DirectionalSamplePlayer {
  readonly output: GainNode;
  private node: AudioWorkletNode | null = null;
  private moduleLoaded = false;
  private workletUrl: string;
  private nextVoiceId = 1;
  private voiceEndedCallback: ((id: number) => void) | null = null;

  constructor(
    private audioContext: AudioContext,
    options: DirectionalSamplePlayerOptions = {},
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
    this.node = new AudioWorkletNode(
      this.audioContext,
      "directional-sample-processor",
      { outputChannelCount: [2] },
    );
    this.node.connect(this.output);
    this.node.port.onmessage = (event) => {
      if (event.data.type === "voiceEnded") {
        this.voiceEndedCallback?.(event.data.id);
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

  /** Fires once per voice when it actually finishes rendering (natural end,
   * or a stopVoice()-triggered release) -- for UI feedback (e.g. flashing a
   * node) only. Audio-scheduling decisions that depend on "when will this
   * voice end" should use the duration computed from range/rate instead of
   * waiting on this, since the message round-trip isn't sample-accurate. */
  onVoiceEnded(callback: (id: number) => void): void {
    this.voiceEndedCallback = callback;
  }

  async loadSample(buffer: AudioBuffer): Promise<void> {
    await this.init();
    const left = buffer.getChannelData(0).slice();
    const right = (
      buffer.numberOfChannels > 1
        ? buffer.getChannelData(1)
        : buffer.getChannelData(0)
    ).slice();
    this.node?.port.postMessage({ type: "loadSample", left, right }, [
      left.buffer,
      right.buffer,
    ]);
  }

  /** Schedules one directional read. Returns the voice id (see
   * PlayVoiceOptions.id). */
  playVoice(options: PlayVoiceOptions): number {
    const id = options.id ?? this.nextVoiceId++;
    // Built here (main thread) via sampleCurveAt, not inside the worklet --
    // same reasoning as phaseDistortionSynth.ts's setDistortionCurve: a
    // fixed-resolution table transferred once is far cheaper per-sample
    // than a breakpoint search on every render() call, and keeps the
    // worklet script free of any curve-math of its own. Only built (and
    // only sent, as a transferable) when a caller actually asks for an
    // envelope -- the common case (no envelopeCurve) costs nothing extra.
    const envelopeTable = options.envelopeCurve
      ? this.buildEnvelopeTable(options.envelopeCurve)
      : null;
    const transfer = envelopeTable ? [envelopeTable.buffer] : [];
    this.node?.port.postMessage(
      {
        type: "playVoice",
        id,
        startFraction: options.startFraction,
        endFraction: options.endFraction,
        direction: options.direction,
        time: options.time ?? this.audioContext.currentTime,
        fadeMs: options.fadeMs ?? DEFAULT_FADE_MS,
        rateSemitones: options.rateSemitones ?? 0,
        envelopeTable,
        gain: options.gain ?? 1,
      },
      transfer,
    );
    return id;
  }

  private buildEnvelopeTable(points: AutomationPoint[]): Float32Array {
    const table = new Float32Array(ENVELOPE_TABLE_SIZE);
    for (let i = 0; i < ENVELOPE_TABLE_SIZE; i++) {
      table[i] = sampleCurveAt(points, i / (ENVELOPE_TABLE_SIZE - 1));
    }
    return table;
  }

  /** Fades out and stops one in-flight voice early. A no-op if it's already
   * finished. */
  stopVoice(id: number, time?: number): void {
    this.node?.port.postMessage({
      type: "stopVoice",
      id,
      time: time ?? this.audioContext.currentTime,
    });
  }

  /** Immediately silences every voice, scheduled or in-flight -- a hard cut,
   * not a declicked stop (see stopVoice for that). */
  panic(): void {
    this.node?.port.postMessage({ type: "panic" });
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }
}
