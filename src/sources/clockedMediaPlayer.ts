// A streamed (not fully buffer-decoded) media source driven by an
// externally-supplied master clock, rather than the NoteTarget/ADSR voice
// model every other file in this directory uses. That model fits a synth
// voice triggered at a moment in time; it doesn't fit "this track is
// always playing somewhere, jump to wherever it currently is when a
// listener tunes in" -- a station's position is a function of the shared
// clock, not of when activate() happens to be called. Uses
// HTMLAudioElement + MediaElementAudioSourceNode specifically because
// AudioBufferSourceNode requires the whole file decoded up front;
// HTMLAudioElement streams via HTTP range requests and supports seeking
// into an arbitrary offset without having downloaded the rest yet.

import { loopedElapsed } from "../audio/clockMath";

export interface ClockedMediaPlayerOptions {
  url: string;
  /** The track's own length -- used to wrap elapsed clock time back into
   * range for looping. Not read from the media file itself (that would
   * mean waiting on `loadedmetadata` before any of this math could run);
   * the caller is expected to already know it (e.g. from station config). */
  durationSeconds: number;
  /** e.g. `() => Date.now() / 1000` -- read fresh on every activate()/
   * resync(), not captured once, so a caller's clock can itself change
   * (paused, resumed, offset) between calls. */
  getMasterClockSeconds: () => number;
  /** Where this track's own timeline lines up with the master clock, in
   * the same units getMasterClockSeconds() returns. Default 0 -- fine as
   * long as every station shares the same clock source, since only
   * relative offsets between stations would matter, not the absolute
   * value. */
  epochSeconds?: number;
}

/** A streamed track, phase-locked to a shared external clock instead of
 * being triggered like a synth voice. Inactive until `activate()`, and
 * fully torn down (not just paused) by `deactivate()` -- see that
 * method's own comment for why re-creating the element on every
 * activation, rather than reusing one, is the deliberate choice here. */
export class ClockedMediaPlayer {
  readonly output: GainNode;
  private url: string;
  private durationSeconds: number;
  private getMasterClockSeconds: () => number;
  private epochSeconds: number;
  private element: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  constructor(
    private audioContext: AudioContext,
    options: ClockedMediaPlayerOptions,
  ) {
    this.output = audioContext.createGain();
    this.url = options.url;
    this.durationSeconds = options.durationSeconds;
    this.getMasterClockSeconds = options.getMasterClockSeconds;
    this.epochSeconds = options.epochSeconds ?? 0;
  }

  get isActive(): boolean {
    return this.element !== null;
  }

  /** Current position read straight off the element once active (which
   * drifts very slightly from the clock-computed target between activate()
   * calls, same as any real playback clock) -- null while inactive, since
   * there's no element to read. */
  get currentTimeSeconds(): number | null {
    return this.element?.currentTime ?? null;
  }

  /** Creates a fresh `<audio>` + `MediaElementAudioSourceNode` pointed at
   * `url`, seeks it to wherever the master clock says this track
   * currently is, and starts playback. A no-op if already active -- call
   * deactivate() first to force a fresh seek. Must be called after a user
   * gesture has already unlocked the AudioContext (same requirement every
   * other bruit-kit source has); browsers otherwise block the underlying
   * `play()`. */
  async activate(): Promise<void> {
    if (this.element) return;
    const element = new Audio();
    element.loop = true;
    element.crossOrigin = "anonymous";
    element.src = this.url;

    // currentTime can't be set meaningfully before the element knows its
    // own seekable range -- wait for that first rather than racing it.
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`ClockedMediaPlayer: failed to load ${this.url}`));
      };
      const cleanup = () => {
        element.removeEventListener("loadedmetadata", onLoaded);
        element.removeEventListener("error", onError);
      };
      element.addEventListener("loadedmetadata", onLoaded);
      element.addEventListener("error", onError);
      element.load();
    });

    element.currentTime = loopedElapsed(
      this.getMasterClockSeconds(),
      this.epochSeconds,
      this.durationSeconds,
    );
    await element.play();

    const sourceNode = this.audioContext.createMediaElementSource(element);
    sourceNode.connect(this.output);
    this.element = element;
    this.sourceNode = sourceNode;
  }

  /** Pauses, disconnects, and discards the underlying element entirely --
   * not just muted/paused-in-place. The next activate() call creates a
   * fresh element and reseeks against whatever the master clock says by
   * then, which is what makes a station self-correct to "wherever it
   * actually is now" after being untuned for a while, and (for an app
   * juggling many stations) drops the HTTP connection instead of leaving
   * dozens of paused streams open in the background. */
  deactivate(): void {
    if (!this.element) return;
    this.element.pause();
    this.sourceNode?.disconnect();
    this.element.removeAttribute("src");
    this.element.load();
    this.element = null;
    this.sourceNode = null;
  }

  /** Reseeks the currently-active element to the master clock's current
   * position without tearing it down -- for correcting the small drift a
   * long-held activation accumulates against the shared clock, without
   * the pop a full deactivate()/activate() cycle would cause. A no-op
   * while inactive. */
  resync(): void {
    if (!this.element) return;
    this.element.currentTime = loopedElapsed(
      this.getMasterClockSeconds(),
      this.epochSeconds,
      this.durationSeconds,
    );
  }

  /** Playback rate of the active element -- the streamed-media analog of
   * an oscillator's pitch, for a caller layering e.g. atmospheric drift
   * on top (see modulation/driftMath.ts) via small multiplicative jitter
   * around 1. Reading/writing while inactive is a harmless no-op/1. */
  get playbackRate(): number {
    return this.element?.playbackRate ?? 1;
  }

  set playbackRate(value: number) {
    if (this.element) this.element.playbackRate = value;
  }
}
