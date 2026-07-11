import {
  type ModulationTarget,
  depthPercentToUnits,
  getModulationTarget,
} from "./targetRegistry";
import type { LfoShape, ModulatableWorkletSynth } from "./types";

export interface LfoSlotConfig {
  enabled: boolean;
  targetId: string | null;
  shape: LfoShape;
  rateHz: number;
  /** 0-100 — converted into the target's real units via depthPercentToUnits
   * before it reaches either mechanism below. */
  depthPercent: number;
}

interface SlotState {
  oscillator: OscillatorNode | null;
  depthGain: GainNode | null;
  connectedParam: AudioParam | null;
}

export interface LfoEngine {
  setSlot(slot: number, config: LfoSlotConfig): void;
}

/** Owns a fixed set of LFO slots' actual wiring — one slot per array index
 * implied by whatever slot numbers the caller uses. A slot assigned to a
 * native AudioParam target gets a persistent OscillatorNode -> depth
 * GainNode connected straight into that AudioParam (additive modulation,
 * the idiomatic Web Audio approach — see FilterEffect.frequencyParam's doc
 * comment). A slot assigned to a worklet-internal target instead just
 * forwards the config to the synth, which computes the LFO itself once per
 * render block, since those aren't real AudioParams. Reassigning a slot
 * across kinds cleanly tears down whichever mechanism it was previously
 * using.
 *
 * `targets` is the full list of destinations the app wants to expose —
 * this engine has no built-in knowledge of any specific param; the app
 * owns that list (see this project's own lfoTargets.ts for an example). */
export function createLfoEngine(
  audioContext: AudioContext,
  synth: ModulatableWorkletSynth,
  audioParams: Record<string, AudioParam>,
  targets: ModulationTarget[],
): LfoEngine {
  const slots = new Map<number, SlotState>();

  function slotState(slot: number): SlotState {
    let state = slots.get(slot);
    if (!state) {
      state = { oscillator: null, depthGain: null, connectedParam: null };
      slots.set(slot, state);
    }
    return state;
  }

  function disconnectAudioParamSlot(slot: number): void {
    const state = slotState(slot);
    if (state.depthGain && state.connectedParam) {
      state.depthGain.disconnect(state.connectedParam);
    }
    state.connectedParam = null;
  }

  function setSlot(slot: number, config: LfoSlotConfig): void {
    const target = config.targetId
      ? getModulationTarget(targets, config.targetId)
      : undefined;

    if (!config.enabled || !target) {
      disconnectAudioParamSlot(slot);
      synth.setModulation(slot, null);
      return;
    }

    if (target.kind === "worklet") {
      disconnectAudioParamSlot(slot);
      synth.setModulation(slot, {
        target: target.id,
        shape: config.shape,
        rateHz: config.rateHz,
        depth: depthPercentToUnits(target, config.depthPercent),
        min: target.min,
        max: target.max,
      });
      return;
    }

    // Native AudioParam target — clear any previous worklet assignment for
    // this slot, then (lazily) create/reuse this slot's oscillator chain.
    synth.setModulation(slot, null);
    const param = audioParams[target.id];
    if (!param) return;

    const state = slotState(slot);
    if (!state.oscillator || !state.depthGain) {
      state.oscillator = audioContext.createOscillator();
      state.depthGain = audioContext.createGain();
      state.oscillator.connect(state.depthGain);
      state.oscillator.start();
    }
    state.oscillator.type = config.shape;
    state.oscillator.frequency.value = config.rateHz;
    state.depthGain.gain.value = depthPercentToUnits(
      target,
      config.depthPercent,
    );

    if (state.connectedParam !== param) {
      disconnectAudioParamSlot(slot);
      state.depthGain.connect(param);
      state.connectedParam = param;
    }
  }

  return { setSlot };
}
