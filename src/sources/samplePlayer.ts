import { type AdsrParams, triggerAttack, triggerRelease } from "./envelope";
import type { NoteTarget } from "../midi/noteTarget";
import { semitoneRatio } from "./pitch";

export interface SamplePlayerParams extends AdsrParams {
  rootNote: number;
  loop: boolean;
  /** If true, a triggered sample plays out fully regardless of noteOff —
   * only the attack is shaped, there's no release gate. If false, the
   * sample (typically loop: true too) is gated like a synth voice: it
   * sustains until noteOff triggers the release. */
  oneShot: boolean;
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
    this.stopVoice(note, this.audioContext.currentTime);

    const startTime = time ?? this.audioContext.currentTime;
    const source = this.audioContext.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.params.loop;
    source.playbackRate.value = semitoneRatio(note, this.params.rootNote);

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.output);
    source.start(startTime);

    triggerAttack(gain.gain, this.audioContext, this.params, velocity, startTime);
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
    if (this.params.oneShot) return;
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
