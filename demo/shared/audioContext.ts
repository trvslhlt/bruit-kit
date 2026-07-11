import { LimiterEffect } from "../../src/audio/limiterEffect";

/** Every demo page starts by calling this: an AudioContext starts
 * suspended per browser autoplay policy, so this renders a "Click to
 * enable audio" button and resolves once a real user gesture has resumed
 * it. */
export function unlockAudioContext(
  container: HTMLElement,
): Promise<AudioContext> {
  const audioContext = new AudioContext();
  if (audioContext.state === "running") {
    return Promise.resolve(audioContext);
  }
  return new Promise((resolve) => {
    const button = document.createElement("button");
    button.className = "unlock-button";
    button.textContent = "Click to enable audio";
    button.addEventListener("click", async () => {
      await audioContext.resume();
      button.remove();
      resolve(audioContext);
    });
    container.appendChild(button);
  });
}

const sharedLimiters = new WeakMap<AudioContext, LimiterEffect>();

/** Routes `node` through a single shared LimiterEffect before destination —
 * every demo's output goes through this, so nothing in this app can
 * hard-clip regardless of what a demo's own controls are set to (see
 * audio/limiterEffect.ts). */
export function connectToOutput(
  node: AudioNode,
  audioContext: AudioContext,
): void {
  let limiter = sharedLimiters.get(audioContext);
  if (!limiter) {
    limiter = new LimiterEffect(audioContext);
    limiter.output.connect(audioContext.destination);
    sharedLimiters.set(audioContext, limiter);
  }
  node.connect(limiter.input);
}
