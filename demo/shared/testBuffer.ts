/** A short synthesized clip (not loaded from a file) so every demo that
 * needs *a* sample works with zero setup: a couple seconds of a rising
 * tone plus a touch of texture, with an attack/release envelope — enough
 * to look like something on a waveform view and not just be silence. */
export function createTestBuffer(audioContext: AudioContext): AudioBuffer {
  const duration = 2;
  const length = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / audioContext.sampleRate;
    const sweep = 220 + 440 * (t / duration);
    const envelope = Math.min(1, t * 8) * Math.max(0, 1 - t / duration);
    const tone = Math.sin(2 * Math.PI * sweep * t);
    const texture = Math.sin(2 * Math.PI * sweep * 2.01 * t) * 0.3;
    data[i] = (tone + texture) * 0.5 * envelope;
  }
  return buffer;
}
