import type { NoteTarget } from "../midi/noteTarget";
import {
  type AdsrParams,
  type EnvelopeSchedule,
  triggerAttack,
  triggerRelease,
  triggerStealFade,
} from "./envelope";
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
  envelope: EnvelopeSchedule;
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
    // mid-flight, audible as a click. stopVoice's return value is when
    // it's actually safe to start the new voice -- see its own comment
    // for why a fresh source can't just start immediately at startTime if
    // something was stolen (two overlapping copies of the same sample
    // content, or two overlapping loop iterations, are correlated enough
    // to cancel like out-of-phase tones would, not independent signals).
    const voiceStartTime = this.stopVoice(note, startTime);

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
    source.start(voiceStartTime, offsetSeconds, durationSeconds);

    let envelope = triggerAttack(
      gain.gain,
      this.audioContext,
      this.params,
      velocity / 127,
      voiceStartTime,
    );
    // start()'s duration argument above cuts the raw buffer off at
    // startTime + durationSeconds with no fade of its own -- fine when a
    // sample's own content already tapers to silence there, but once a
    // trimmed range can end anywhere in the waveform, that's an abrupt
    // truncation mid-signal (a pop), and noteOff's own release can't save
    // it: oneShot voices never call noteOff at all (see below), and a
    // gated voice's release is timed by the *step's* gate, not the
    // sample's own trimmed length, so it can easily still be scheduled
    // for *after* the buffer has already hard-stopped. Scheduling this
    // release now guarantees a fade completes by the buffer's actual end
    // regardless of gate; if noteOff later calls its own release first
    // (a shorter gate than the trimmed range), triggerRelease cleanly
    // overrides these scheduled points with its own, same as any other
    // re-trigger -- which is exactly why the *updated* schedule from this
    // call has to replace `envelope` below, not just get discarded: a
    // later noteOff's own triggerRelease needs to know this preemptive
    // release already started, or it'll anchor on the stale pre-release
    // value and click.
    if (!this.params.loop) {
      const releaseSeconds = Math.max(this.params.releaseMs, 0) / 1000;
      const naturalEndTime = voiceStartTime + durationSeconds;
      envelope = triggerRelease(
        gain.gain,
        this.audioContext,
        envelope,
        Math.max(voiceStartTime, naturalEndTime - releaseSeconds),
      ).schedule;
    }
    if (this.params.oneShot) {
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(note);
      };
    } else {
      this.voices.set(note, { source, gain, envelope });
    }
  }

  noteOff(note: number, time?: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    const atTime = time ?? this.audioContext.currentTime;
    const { endTime } = triggerRelease(
      voice.gain.gain,
      this.audioContext,
      voice.envelope,
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

  /** Returns the time it's safe for a new voice to start: `time` unchanged
   * if there was nothing to steal, or the stolen voice's declick-fade
   * end time otherwise -- see the caller's comment for why that matters. */
  private stopVoice(note: number, time: number): number {
    const voice = this.voices.get(note);
    if (!voice) return time;
    const { endTime } = triggerStealFade(
      voice.gain.gain,
      this.audioContext,
      voice.envelope,
      time,
    );
    voice.source.stop(endTime);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
    return endTime;
  }
}
