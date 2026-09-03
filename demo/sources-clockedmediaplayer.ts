import { audioBufferToWavBlob } from "../src/audio/wavEncoder";
import { ClockedMediaPlayer } from "../src/sources/clockedMediaPlayer";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const controlsEl = document.querySelector<HTMLDivElement>("#controls")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

// Zero-setup like every other demo here: no real file on disk, just the
// same synthesized test buffer used elsewhere, re-encoded to a WAV Blob
// URL so ClockedMediaPlayer has a real streamable <audio> src to seek
// into. A 2s clip also makes the "position jumps forward to match the
// clock" behavior visible within a few seconds of deactivating/
// reactivating, rather than needing to wait out a long track.
unlockAudioContext(unlockEl).then((audioContext) => {
  const buffer = createTestBuffer(audioContext);
  const url = URL.createObjectURL(audioBufferToWavBlob(buffer));

  // A fixed epoch at page load, and Date.now()-based clock -- so the
  // track's position keeps advancing at the same real-world rate whether
  // or not it's currently active, the same way a real broadcast keeps
  // playing whether or not anyone's tuned in.
  const epochSeconds = Date.now() / 1000;
  const player = new ClockedMediaPlayer(audioContext, {
    url,
    durationSeconds: buffer.duration,
    getMasterClockSeconds: () => Date.now() / 1000,
    epochSeconds,
  });
  connectToOutput(player.output, audioContext);

  const activateButton = document.createElement("button");
  activateButton.textContent = "Activate (tune in)";
  activateButton.addEventListener("click", async () => {
    activateButton.disabled = true;
    await player.activate();
    activateButton.disabled = false;
  });

  const deactivateButton = document.createElement("button");
  deactivateButton.textContent = "Deactivate (tune away)";
  deactivateButton.addEventListener("click", () => player.deactivate());

  controlsEl.append(activateButton, deactivateButton);

  function renderStatus(): void {
    const position = player.currentTimeSeconds;
    statusEl.textContent = player.isActive
      ? `Active — position ${position?.toFixed(2)}s / ${buffer.duration.toFixed(2)}s`
      : "Inactive.";
    requestAnimationFrame(renderStatus);
  }
  renderStatus();
});
