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

export type PlaybackDirection = "forward" | "backward";

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
  /** 0..1 fractions of the loaded buffer's own duration. Order doesn't
   * matter -- the processor sorts them, `direction` alone controls which
   * way playback actually reads. */
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
    this.node?.port.postMessage({
      type: "playVoice",
      id,
      startFraction: options.startFraction,
      endFraction: options.endFraction,
      direction: options.direction,
      time: options.time ?? this.audioContext.currentTime,
      fadeMs: options.fadeMs ?? DEFAULT_FADE_MS,
      rateSemitones: options.rateSemitones ?? 0,
    });
    return id;
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
