const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType.includes("mp4") ? "m4a" : "webm";
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
}

/** Records whatever's connected to `source` as it's actually heard,
 * including any live control changes made mid-recording. Taps the signal
 * via a MediaStreamAudioDestinationNode rather than rendering offline, so
 * this is a real-time capture (subject to real-time performance) rather
 * than a deterministic bounce. */
export class Recorder {
  private destination: MediaStreamAudioDestinationNode;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  constructor(audioContext: AudioContext, source: AudioNode) {
    this.destination = audioContext.createMediaStreamDestination();
    source.connect(this.destination);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  start(): void {
    if (this.isRecording()) return;
    const mimeType = pickMimeType();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(
      this.destination.stream,
      mimeType ? { mimeType } : undefined,
    );
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start();
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        resolve({ blob: new Blob(), mimeType: "audio/webm" });
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve({ blob: new Blob(this.chunks, { type: mimeType }), mimeType });
      };
      recorder.stop();
    });
  }
}
