import workletUrl from './capture-worklet.ts?worker&url';
import { RingBuffer } from './ring-buffer';

/**
 * Moteur audio unique : un seul AudioContext pour le métronome, le synthé et le micro,
 * donc UNE seule horloge partagée (indispensable pour masquer les clics dans le micro).
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly metroBus: GainNode;
  readonly synthBus: GainNode;
  readonly ring = new RingBuffer(1 << 15);
  private captureInput: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyserFallback: AnalyserNode | null = null;
  private workletReady: Promise<boolean> | null = null;
  /** Latence d'entrée estimée du micro (s). */
  inputLatency = 0.01;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.metroBus = this.ctx.createGain();
    this.metroBus.connect(this.master);
    this.synthBus = this.ctx.createGain();
    this.synthBus.gain.value = 0.6;
    this.synthBus.connect(this.master);
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  /** Latence de sortie (haut-parleur), 0 si le navigateur ne la donne pas. */
  get outputLatency(): number {
    const c = this.ctx as AudioContext & { outputLatency?: number };
    return (c.outputLatency ?? 0) + (this.ctx.baseLatency ?? 0);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** Prépare l'entrée d'analyse (worklet, ou AnalyserNode en repli). */
  private async ensureCapture(): Promise<GainNode> {
    if (this.captureInput) return this.captureInput;
    const input = this.ctx.createGain();
    this.captureInput = input;
    this.workletReady ??= (async () => {
      try {
        if (!this.ctx.audioWorklet) return false;
        await this.ctx.audioWorklet.addModule(workletUrl);
        const node = new AudioWorkletNode(this.ctx, 'pa-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
        node.port.onmessage = (e: MessageEvent<{ frame: number; samples: Float32Array }>) => this.ring.write(e.data.samples, e.data.frame);
        input.connect(node);
        const silent = this.ctx.createGain();
        silent.gain.value = 0;
        node.connect(silent).connect(this.ctx.destination); // nécessaire pour que le worklet soit « tiré »
        return true;
      } catch {
        return false;
      }
    })();
    const ok = await this.workletReady;
    if (!ok) {
      this.analyserFallback = this.ctx.createAnalyser();
      this.analyserFallback.fftSize = 8192;
      input.connect(this.analyserFallback);
    }
    return input;
  }

  /** Repli sans AudioWorklet : copie les derniers échantillons dans le tampon. */
  pollFallback(): void {
    const a = this.analyserFallback;
    if (!a) return;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    const endFrame = Math.round(this.ctx.currentTime * this.ctx.sampleRate);
    // On réécrit la fenêtre entière : le tampon accepte une reprise à partir d'un frame postérieur.
    if (endFrame - buf.length + 1 > this.ring.lastFrame) this.ring.write(buf, endFrame - buf.length + 1);
  }

  get usingFallback(): boolean {
    return this.analyserFallback !== null;
  }

  /** Ouvre le micro. Le son reste dans l'appareil : il n'est jamais enregistré ni envoyé. */
  async startMic(deviceId = ''): Promise<void> {
    await this.resume();
    const input = await this.ensureCapture();
    if (this.micSource) return;
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base, video: false });
    } catch (err) {
      // L'entrée choisie a disparu (interface USB débranchée…) : on reprend l'entrée par défaut.
      if (!deviceId || (err as DOMException)?.name === 'NotAllowedError') throw err;
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: base, video: false });
    }
    const track = this.micStream.getAudioTracks()[0];
    const lat = (track?.getSettings() as MediaTrackSettings & { latency?: number })?.latency;
    if (typeof lat === 'number' && lat > 0 && lat < 0.5) this.inputLatency = lat;
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micSource.connect(input);
  }

  /** Identifiant de l'entrée réellement utilisée. */
  get activeDeviceId(): string {
    return (this.micStream?.getAudioTracks()[0]?.getSettings().deviceId as string | undefined) ?? '';
  }

  /** Entrées audio disponibles (les noms ne sont visibles qu'après l'autorisation du micro). */
  async listInputs(): Promise<{ id: string; label: string }[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label }));
  }

  stopMic(): void {
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
  }

  get micActive(): boolean {
    return this.micSource !== null;
  }

  /** Branche une source quelconque (signal de test) sur l'entrée d'analyse. */
  async connectToAnalysis(node: AudioNode): Promise<void> {
    await this.resume();
    node.connect(await this.ensureCapture());
  }
}
