// A short-lived-in-spirit, re-triggerable sibling to lfoEngine.ts's own
// oscillator->depth-gain->target-param wiring. lfoEngine.ts is built for a
// fixed set of persistent, long-lived slots assigned once and left running
// (grid-sequencer's rows) -- forcing a per-firing, freshly re-triggered
// modulation route (e.g. relpmas's SampleNode modulation routes: "on
// trigger, ramp this LFO's own rate 1Hz -> 20Hz, which in turn modulates a
// chorus depth") through that slot/ModulationTarget model would fight its
// design rather than fit it. This is the same underlying technique --
// oscillator -> depth gain -> target AudioParam, additive modulation, the
// idiomatic Web Audio approach -- with its own rate/depth exposed as plain
// AudioParams a caller can both connect to a target *and* hand to
// audio/automation.ts's scheduleAutomation for a one-shot sweep, instead of
// being owned by a slot-indexed engine.

export interface TriggerableModulator {
  /** The oscillator's own frequency -- set `.value` directly for a fixed
   * rate, or pass this to scheduleAutomation for a one-shot rate sweep
   * (e.g. the brief's own "1Hz -> 20Hz on trigger" example). */
  readonly rateParam: AudioParam;
  /** Depth (peak swing) applied on top of the target param's own base
   * value once connected -- same scheduleAutomation-able shape as
   * rateParam. */
  readonly depthParam: AudioParam;
  /** Connects this modulator's output into `target`, additive per Web
   * Audio's normal AudioParam-connection semantics (coexists with the
   * target's own `.value`/other scheduled automation). Re-pointing to a
   * new target first disconnects the old one; connecting the same target
   * again is a no-op. */
  connect(target: AudioParam): void;
  disconnect(): void;
}

/** The oscillator starts immediately and runs continuously -- "triggering"
 * a modulation route (see relpmas) means scheduling a fresh rate/depth
 * sweep on an already-running oscillator via scheduleAutomation, not
 * starting/stopping the oscillator itself, since a stopped
 * OscillatorNode can never be restarted (Web Audio spec). */
export function createTriggerableModulator(
  audioContext: AudioContext,
  shape: OscillatorType = "sine",
): TriggerableModulator {
  const oscillator = audioContext.createOscillator();
  const depthGain = audioContext.createGain();
  oscillator.type = shape;
  depthGain.gain.value = 0;
  oscillator.connect(depthGain);
  oscillator.start();

  let connectedParam: AudioParam | null = null;

  return {
    rateParam: oscillator.frequency,
    depthParam: depthGain.gain,
    connect(target) {
      if (connectedParam === target) return;
      if (connectedParam) depthGain.disconnect(connectedParam);
      depthGain.connect(target);
      connectedParam = target;
    },
    disconnect() {
      if (connectedParam) depthGain.disconnect(connectedParam);
      connectedParam = null;
    },
  };
}
