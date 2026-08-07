/** Web Audio buffer processing that runs offline (OfflineAudioContext,
 * faster than real time) rather than live playback -- trimming a range to
 * real frames, tape/vinyl-style speed change, and baking an
 * effectsChainBuilder chain onto a buffer. No dependency on any particular
 * app's samples/patches/UI concepts: any caller with an AudioBuffer (and,
 * for renderEffectsOffline, an EffectSpec[] chain) can use this. */

import type { WaveformRange } from "../ui/waveformRangeView";
import type { EffectSpec } from "./effectSpec";
import { buildEffectsChain } from "./effectsChainBuilder";
import { preloadPitchShiftWorklet } from "./pitchShiftEffect";
import { preloadSampleRateReducerWorklet } from "./sampleRateReducerEffect";

export function extractRange(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  range: WaveformRange,
): AudioBuffer {
  const startFrame = Math.max(
    0,
    Math.min(buffer.length, Math.floor(range.start * buffer.length)),
  );
  const endFrame = Math.max(
    startFrame + 1,
    Math.min(buffer.length, Math.floor(range.end * buffer.length)),
  );
  const length = endFrame - startFrame;
  const out = audioContext.createBuffer(
    buffer.numberOfChannels,
    length,
    buffer.sampleRate,
  );
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    out
      .getChannelData(channel)
      .set(buffer.getChannelData(channel).subarray(startFrame, endFrame));
  }
  return out;
}

/** Tape/vinyl-style speed change -- playbackRate coupled to pitch. Renders
 * through an OfflineAudioContext sized for the resulting (shorter at
 * rate > 1, longer at rate < 1) duration, same "run the real graph faster
 * than real time" approach renderEffectsOffline uses for effects, just
 * with no chain in between -- a rate-shifted AudioBufferSourceNode
 * connected straight to the destination. `speed` === 1 skips the render
 * entirely (the common case: most edits don't touch this control) rather
 * than round-tripping through OfflineAudioContext for a no-op. Pitch
 * decoupled from speed (a caller's own "Preserve pitch" option, if it has
 * one) isn't handled here -- see pitchCompensationSpec below, layered on
 * afterward through the same "pitchShift" EffectSpec a caller's own
 * effects chain would use directly. */
export async function applySpeed(
  buffer: AudioBuffer,
  speed: number,
): Promise<AudioBuffer> {
  if (speed === 1) return buffer;
  const length = Math.max(1, Math.ceil(buffer.length / speed));
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    length,
    buffer.sampleRate,
  );
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speed;
  source.connect(offlineContext.destination);
  source.start();
  return offlineContext.startRendering();
}

/** A "pitchShift" EffectSpec (the same type effectTable.ts/effectsFields.ts
 * expose as an ordinary chain entry) tuned to exactly cancel out the pitch
 * change `speed` alone would introduce -- doubling playback rate raises
 * pitch by an octave (12 semitones) regardless of the original pitch, so
 * shifting back down by 12*log2(speed) semitones (fractional, not rounded
 * to a whole semitone -- PitchShiftEffect.setParams accepts that fine)
 * restores it while leaving the sped-up/slowed-down duration alone. Not
 * true pitch-preserving time-stretch (no re-analysis of the audio itself)
 * -- just speed-shift-then-shift-back, reusing the same worklet-based
 * pitch shifter effectsChainBuilder already instantiates for a plain
 * "pitchShift" chain entry, rather than a separate time-stretch
 * algorithm. */
export function pitchCompensationSpec(speed: number): EffectSpec[] {
  return [
    {
      type: "pitchShift",
      params: { octave: 0, semitones: -12 * Math.log2(speed), cents: 0, wet: 1 },
    },
  ];
}

const MAX_TAIL_SECONDS = 15;

/** How much extra render time a chain's own decay/echo tail needs beyond
 * the dry buffer's own length, so baking doesn't truncate a reverb's
 * decay or a delay's repeats mid-ring-out. Deliberately approximate (not
 * every param combination is modeled precisely) -- this only sizes an
 * offline render buffer, not anything audible on its own, so "generous
 * enough to not cut off a tail" matters more than exactness. */
export function estimateTailSeconds(effects: EffectSpec[]): number {
  let tail = 0;
  for (const spec of effects) {
    if (spec.type === "reverb") {
      const decay =
        typeof spec.params.decaySeconds === "number"
          ? spec.params.decaySeconds
          : 2.2;
      tail = Math.max(tail, decay + 0.5);
    } else if (spec.type === "delay") {
      const delaySeconds =
        (typeof spec.params.delayMs === "number" ? spec.params.delayMs : 180) /
        1000;
      const feedback =
        typeof spec.params.feedback === "number" ? spec.params.feedback : 0.35;
      // Repeats until the echo drops below ~1% amplitude.
      const repeats =
        feedback > 0.001 ? Math.log(0.01) / Math.log(feedback) : 1;
      tail = Math.max(tail, delaySeconds * (repeats + 1));
    }
  }
  return Math.min(tail, MAX_TAIL_SECONDS);
}

/** Bakes `effects` onto `buffer` via an OfflineAudioContext, reusing the
 * exact same chain-building logic (buildEffectsChain/instantiateEffect) a
 * caller's live playback graph uses -- offline rendering is just running
 * that same graph faster than real time instead of to speakers.
 * Cast to AudioContext at the boundary: every effect class in this
 * toolkit only ever calls methods OfflineAudioContext also implements
 * (createGain/createBiquadFilter/etc., all on the shared BaseAudioContext
 * interface), so this is safe at runtime despite the narrower TS type. */
export async function renderEffectsOffline(
  buffer: AudioBuffer,
  effects: EffectSpec[],
): Promise<AudioBuffer> {
  const tailSeconds = estimateTailSeconds(effects);
  const length = Math.ceil((buffer.duration + tailSeconds) * buffer.sampleRate);
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    length,
    buffer.sampleRate,
  );
  // Worklet registration is scoped per-context, not global -- this fresh
  // OfflineAudioContext doesn't inherit the real-time AudioContext's own
  // preload (see main.ts). Must be awaited *before* buildEffectsChain's
  // synchronous `new PitchShiftEffect(...)`/`new SampleRateReducerEffect(...)`
  // below, or that constructor throws (see preloadPitchShiftWorklet's own
  // doc comment).
  if (effects.some((spec) => spec.type === "pitchShift")) {
    await preloadPitchShiftWorklet(offlineContext);
  }
  if (effects.some((spec) => spec.type === "sampleRateReducer")) {
    await preloadSampleRateReducerWorklet(offlineContext);
  }
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  const chain = buildEffectsChain(
    offlineContext as unknown as AudioContext,
    effects,
  );
  source.connect(chain.input);
  chain.output.connect(offlineContext.destination);
  source.start();
  return offlineContext.startRendering();
}
