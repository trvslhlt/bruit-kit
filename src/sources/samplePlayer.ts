import type { NoteTarget } from "../midi/noteTarget";
import { type AdsrParams, triggerAttack, triggerRelease } from "./envelope";
import { semitoneRatio } from "./pitch";

export interface SamplePlayerParams extends AdsrParams {
  rootNote: number;
  loop: boolean;
  /** If true, a triggered sample plays out fully regardless of noteOff —
   * only the attack is shaped, there's no release gate. If false, the
   * sample (typically loop: true too) is gated like a synth voice: it
   * sustains until noteOff triggers the release. */
  oneShot: boolean;
  /** 0..1 fractions of the loaded buffer's own duration, trimming which
   * portion of the sample actually plays -- e.g. picking out one hit from
   * a multi-hit recording, or dropping dead air at the start/end. Applies
   * to both the initial playback position and (when `loop` is set) the
   * loop points, so a trimmed, looping range only ever cycles within the
   * selected window rather than looping the whole buffer. */
  rangeStart: number;
  rangeEnd: number;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const DEFAULT_PARAMS: SamplePlayerParams = {
  rootNote: 60,
  loop: false,
  oneShot: true,
  attackMs: 5,
  decayMs: 0,
  sustainLevel: 1,
  releaseMs: 100,
  rangeStart: 0,
  rangeEnd: 1,
};

/** A polyphonic sample player: each noteOn starts a fresh
 * AudioBufferSourceNode pitched relative to `rootNote`, gated by a
 * per-voice ADSR gain. Buffers are used directly (no downmix, unlike
 * GranularSynth's worklet path) since AudioBufferSourceNode handles
 * multi-channel buffers natively. */
export class SamplePlayer implements NoteTarget {
  readonly output: GainNode;
  private params: SamplePlayerParams = { ...DEFAULT_PARAMS };
  private buffer: AudioBuffer | null = null;
  private voices = new Map<number, Voice>();

  constructor(private audioContext: AudioContext) {
    this.output = audioContext.createGain();
  }

  loadSample(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  setParams(params: Partial<SamplePlayerParams>): void {
    this.params = { ...this.params, ...params };
  }

  noteOn(note: number, velocity: number, time?: number): void {
    if (!this.buffer) return;
    const startTime = time ?? this.audioContext.currentTime;
    // See the matching comment in oscillatorSynth.ts's noteOn -- stopping
    // a stale same-note voice at real "now" instead of this note's own
    // start time truncates its already-scheduled graceful release
    // mid-flight, audible as a click.
    this.stopVoice(note, startTime);

    const source = this.audioContext.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.params.loop;
    source.playbackRate.value = semitoneRatio(note, this.params.rootNote);

    // offset/duration (and loopStart/loopEnd, when looping) are always in
    // the buffer's own native seconds regardless of playbackRate -- the
    // Web Audio spec defines them against the buffer's own timeline, not
    // wall-clock playback time.
    const { offsetSeconds, durationSeconds } = this.rangeSeconds(this.buffer);
    if (this.params.loop) {
      source.loopStart = offsetSeconds;
      source.loopEnd = offsetSeconds + durationSeconds;
    }

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.output);
    // A duration argument is ignored while looping (the loop points above
    // govern repetition instead), so it's safe to always pass one.
    source.start(startTime, offsetSeconds, durationSeconds);

    triggerAttack(
      gain.gain,
      this.audioContext,
      this.params,
      velocity / 127,
      startTime,
    );
    if (this.params.oneShot) {
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(note);
      };
    } else {
      this.voices.set(note, { source, gain });
    }
  }

  noteOff(note: number, time?: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    const atTime = time ?? this.audioContext.currentTime;
    const endTime = triggerRelease(
      voice.gain.gain,
      this.audioContext,
      this.params,
      atTime,
    );
    voice.source.stop(endTime);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }

  /** Clamps rangeStart/rangeEnd to a valid, non-inverted 0..1 pair first --
   * a UI could hand back an in-progress drag where the handles have
   * crossed, and an inverted or negative duration would throw at
   * source.start() rather than just clamping to silence. */
  private rangeSeconds(buffer: AudioBuffer): {
    offsetSeconds: number;
    durationSeconds: number;
  } {
    const start = Math.min(
      1,
      Math.max(0, Math.min(this.params.rangeStart, this.params.rangeEnd)),
    );
    const end = Math.min(
      1,
      Math.max(0, Math.max(this.params.rangeStart, this.params.rangeEnd)),
    );
    return {
      offsetSeconds: start * buffer.duration,
      durationSeconds: Math.max(0, (end - start) * buffer.duration),
    };
  }

  private stopVoice(note: number, time: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    voice.source.stop(time);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }
}
