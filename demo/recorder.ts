import { Recorder, extensionForMimeType } from "../src/audio/recorder";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import {
  connectToOutput,
  getSharedLimiter,
  unlockAudioContext,
} from "./shared/audioContext";
import { createOnScreenKeyboard } from "./shared/keyboard";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const recordButtonEl =
  document.querySelector<HTMLButtonElement>("#record-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;
const resultEl = document.querySelector<HTMLDivElement>("#result")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  connectToOutput(synth.output, audioContext);
  createOnScreenKeyboard(keyboardEl, synth);

  // Tap post-limiter (getSharedLimiter().output) rather than synth.output
  // directly, so the recording matches what actually comes out of the
  // speakers, same "as it's actually heard" intent as Recorder's own doc
  // comment.
  const recorder = new Recorder(
    audioContext,
    getSharedLimiter(audioContext).output,
  );

  recordButtonEl.addEventListener("click", () => {
    recorder.start();
    recordButtonEl.disabled = true;
    stopButtonEl.disabled = false;
  });

  stopButtonEl.addEventListener("click", async () => {
    const { blob, mimeType } = await recorder.stop();
    recordButtonEl.disabled = false;
    stopButtonEl.disabled = true;

    const url = URL.createObjectURL(blob);
    resultEl.innerHTML = "";
    const audioEl = document.createElement("audio");
    audioEl.controls = true;
    audioEl.src = url;
    resultEl.appendChild(audioEl);

    const link = document.createElement("a");
    link.href = url;
    link.download = `recording.${extensionForMimeType(mimeType)}`;
    link.textContent = "Download";
    resultEl.appendChild(document.createElement("br"));
    resultEl.appendChild(link);
  });
});
