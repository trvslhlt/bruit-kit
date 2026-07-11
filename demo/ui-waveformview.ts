import { createWaveformView } from "../src/ui/waveformView";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const seekFractionEl =
  document.querySelector<HTMLParagraphElement>("#seek-fraction")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  let buffer = createTestBuffer(audioContext);
  let playStartTime = 0;
  let playStartFraction = 0;
  let playing = false;

  const view = createWaveformView(waveformEl, {
    onSeek: (fraction) => {
      seekFractionEl.textContent = `Seeked to ${(fraction * 100).toFixed(1)}%`;
      playFrom(fraction);
    },
  });
  view.setBuffer(buffer);

  function playFrom(fraction: number): void {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    connectToOutput(source, audioContext);
    source.start(0, fraction * buffer.duration);
    source.onended = () => source.disconnect();
    playStartTime = audioContext.currentTime;
    playStartFraction = fraction;
    playing = true;
  }

  function tick(): void {
    if (playing) {
      const elapsed = audioContext.currentTime - playStartTime;
      const fraction = playStartFraction + elapsed / buffer.duration;
      if (fraction >= 1) {
        playing = false;
      } else {
        view.setPlayheadFraction(fraction);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    view.setBuffer(buffer);
  });

  renderParamPanel(paramsEl, [
    {
      id: "jitter",
      label: "Jitter band (ms)",
      min: 0,
      max: 200,
      step: 1,
      value: 0,
      onChange: (value) => view.setPositionJitterMs(value),
    },
  ]);
});
