export interface Send {
  input: AudioNode;
  setLevel(level: number): void;
}

/** A GainNode-based tap for routing a variable amount of a signal into a
 * shared bus — e.g. one master ReverbEffect that several rows each send a
 * different amount into, instead of every row carrying its own (expensive:
 * a ConvolverNode) reverb instance. Connect a chain's output to
 * send.input *in addition to* wherever that chain's own dry signal
 * already goes — a send taps a copy of the signal, it doesn't replace the
 * dry path. */
export function createSend(
  audioContext: AudioContext,
  destination: AudioNode,
  initialLevel = 0,
): Send {
  const gain = audioContext.createGain();
  gain.gain.value = initialLevel;
  gain.connect(destination);

  return {
    input: gain,
    setLevel(level: number): void {
      gain.gain.value = level;
    },
  };
}
