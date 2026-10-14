// Voce di prossimità. Il microfono viene campionato a 16 kHz, compresso (µ-law, come i telefoni fissi) e mandato
// a pezzetti di 100 ms sulla stessa connessione del gioco: il server lo gira ai compagni e basta (non lo registra).
// Niente collegamenti diretti tra telefoni: funziona su qualsiasi rete (dati del telefono, Wi-Fi chiusi).
// Vicino la voce è chiara e viene dalla direzione giusta; allontanandosi perde parole prima di sparire;
// una porta chiusa o un muro la rendono ovattata. La radio è un canale a parte (più "metallico").
import type { HorrorAudio } from './sound';

type V3 = { x: number; y: number; z: number };
interface Peer {
  id: string;
  input: GainNode; // qui entrano i pezzetti di voce ricevuti
  lp: BiquadFilterNode;
  near: GainNode; // voce "nello spazio"
  pan: PannerNode;
  radio: GainNode; // voce alla radio
  analyser: AnalyserNode;
  radioOn: boolean;
  level: number;
  next: number; // quando suonare il prossimo pezzetto (orologio dell'audio)
  lastAt: number;
}

const RATE = 16000;
const FRAME = 1600; // 100 ms

// G.711 µ-law: 8 bit per campione
function muEncode(x: number): number {
  let s = Math.max(-1, Math.min(1, x)) * 32635;
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  s += 132;
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  const man = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}
const MU_TABLE = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const u = ~i & 0xff;
    const sign = u & 0x80;
    const exp = (u >> 4) & 0x07;
    const man = u & 0x0f;
    const v = (((man << 3) + 132) << exp) - 132;
    t[i] = (sign ? -v : v) / 32768;
  }
  return t;
})();

export class ProximityVoice {
  private peers = new Map<string, Peer>();
  private local: MediaStream | null = null;
  private sendRadio = false;
  private meter: { an: AnalyserNode; buf: Float32Array<ArrayBuffer> } | null = null;
  private proc: ScriptProcessorNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private frame = new Uint8Array(FRAME);
  private fill = 0;
  private acc = 0; // posizione frazionaria per il ricampionamento
  private loudUntil = 0;
  muted = false;
  ready = false;
  error = '';

  constructor(
    private me: string,
    private send: (data: ArrayBuffer) => void,
    private audio: HorrorAudio,
  ) {}

  async start(): Promise<boolean> {
    try {
      // niente controllo automatico del volume: così un sussurro resta un sussurro (e il Custode non lo sente)
      this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
      const c = this.audio.ctx;
      this.src = c.createMediaStreamSource(this.local);
      const an = c.createAnalyser();
      an.fftSize = 1024;
      this.src.connect(an);
      this.meter = { an, buf: new Float32Array(an.fftSize) };
      // cattura: ricampiona a 16 kHz, manda solo quando si parla (con una piccola coda per non tagliare le parole)
      const proc = c.createScriptProcessor(2048, 1, 1);
      const silent = c.createGain();
      silent.gain.value = 0;
      this.src.connect(proc);
      proc.connect(silent).connect(c.destination);
      const step = c.sampleRate / RATE;
      proc.onaudioprocess = (e) => {
        if (this.muted || !this.local) return;
        const inp = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inp.length; i++) sum += inp[i] * inp[i];
        const rms = Math.sqrt(sum / inp.length);
        if (rms > 0.006) this.loudUntil = performance.now() + 450;
        const talking = performance.now() < this.loudUntil;
        if (!talking) {
          // fine della frase: manda anche l'ultimo pezzetto
          if (this.fill > 160) {
            const out = new Uint8Array(2 + this.fill);
            out[0] = 0xa1;
            out[1] = this.sendRadio ? 1 : 0;
            out.set(this.frame.subarray(0, this.fill), 2);
            this.send(out.buffer);
          }
          this.fill = 0;
          return;
        }
        let pos = this.acc;
        for (; pos < inp.length; pos += step) {
          const i = Math.floor(pos);
          const f = pos - i;
          const v = inp[i] * (1 - f) + (inp[Math.min(inp.length - 1, i + 1)] ?? 0) * f;
          this.frame[this.fill++] = muEncode(v * 1.4);
          if (this.fill === FRAME) {
            const out = new Uint8Array(2 + FRAME);
            out[0] = 0xa1;
            out[1] = this.sendRadio ? 1 : 0;
            out.set(this.frame, 2);
            this.send(out.buffer);
            this.fill = 0;
          }
        }
        this.acc = pos - inp.length;
      };
      this.proc = proc;
      this.ready = true;
      return true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'microfono non disponibile';
      return false;
    }
  }
  stop() {
    this.proc?.disconnect();
    this.src?.disconnect();
    for (const p of this.peers.values()) this.close(p);
    this.peers.clear();
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
  }
  // Quanto forte sto parlando adesso (0 silenzio … 1 urlo)
  level(): number {
    if (!this.meter || this.muted || !this.local) return 0;
    this.meter.an.getFloatTimeDomainData(this.meter.buf);
    let sum = 0;
    for (const v of this.meter.buf) sum += v * v;
    return Math.sqrt(sum / this.meter.buf.length);
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }
  // Radio: tenendo premuto il tasto la mia voce arriva a tutti (con il suono della radio)
  setRadio(on: boolean) {
    this.sendRadio = on;
  }

  // I compagni nella stanza: per ciascuno la sua catena audio (direzione, muri, radio)
  setPeers(ids: string[]) {
    for (const id of ids) if (id !== this.me && !this.peers.has(id)) this.create(id);
    for (const [id, p] of this.peers)
      if (!ids.includes(id)) {
        this.close(p);
        this.peers.delete(id);
      }
  }
  // compatibilità con i vecchi messaggi di collegamento diretto (non servono più)
  onSignal() {}

  private create(id: string) {
    const c = this.audio.ctx;
    const input = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    const near = c.createGain();
    near.gain.value = 0;
    const pan = c.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'linear';
    pan.rolloffFactor = 0; // il volume lo decidiamo noi (distanza e muri)
    const radio = c.createGain();
    radio.gain.value = 0;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    shaper.curve = curve;
    const analyser = c.createAnalyser();
    analyser.fftSize = 256;
    input.connect(lp);
    input.connect(radio);
    input.connect(analyser);
    lp.connect(near).connect(pan).connect(this.audio.voiceBus);
    radio.connect(bp).connect(shaper).connect(this.audio.voiceBus);
    const peer: Peer = { id, input, lp, near, pan, radio, analyser, radioOn: false, level: 0, next: 0, lastAt: 0 };
    this.peers.set(id, peer);
    return peer;
  }
  private close(p: Peer) {
    p.input.disconnect();
    p.near.disconnect();
    p.radio.disconnect();
  }

  // Un pezzetto di voce arrivato dal server: in coda, con un piccolo margine contro i ritardi della rete
  onVoice(from: string, flags: number, data: Uint8Array) {
    if (from === this.me) return;
    const p = this.peers.get(from) ?? this.create(from);
    const c = this.audio.ctx;
    if (c.state !== 'running') return;
    p.radioOn = (flags & 1) === 1;
    const n = data.length;
    if (!n) return;
    // si suona alla frequenza dell'audio del telefono (alcuni Safari non accettano buffer a 16 kHz)
    const k = c.sampleRate / RATE;
    const m = Math.floor(n * k);
    const buf = c.createBuffer(1, m, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let j = 0; j < m; j++) {
      const pos = j / k;
      const i = Math.floor(pos);
      const f = pos - i;
      ch[j] = MU_TABLE[data[i]] * (1 - f) + MU_TABLE[data[Math.min(n - 1, i + 1)]] * f;
    }
    const now = c.currentTime;
    // dopo una pausa (o se si è accumulato troppo ritardo) si riparte con 120 ms di margine
    if (p.next < now + 0.02 || p.next > now + 0.6) p.next = now + 0.12;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.connect(p.input);
    s.start(p.next);
    p.next += buf.duration;
    p.lastAt = performance.now();
  }

  // Ogni fotogramma: quanto e da dove si sente ciascun compagno
  update(id: string, o: { pos: V3 | null; gain: number; muffle: number }) {
    const p = this.peers.get(id);
    if (!p) return;
    const t = this.audio.ctx.currentTime;
    const radio = p.radioOn && performance.now() - p.lastAt < 600;
    p.near.gain.setTargetAtTime((radio ? o.gain * 0.3 : o.gain) * 1.6, t, 0.08);
    p.radio.gain.setTargetAtTime(radio ? 0.9 : 0, t, 0.05);
    p.lp.frequency.setTargetAtTime(o.muffle <= 0 ? 16000 : o.muffle === 1 ? 1200 : 600, t, 0.1);
    if (o.pos) {
      if (p.pan.positionX) {
        p.pan.positionX.setTargetAtTime(o.pos.x, t, 0.05);
        p.pan.positionY.setTargetAtTime(o.pos.y, t, 0.05);
        p.pan.positionZ.setTargetAtTime(o.pos.z, t, 0.05);
      } else p.pan.setPosition(o.pos.x, o.pos.y, o.pos.z);
    }
    // quanto sta parlando (per l'indicatore)
    const buf = new Uint8Array(p.analyser.frequencyBinCount);
    p.analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 2; i < 40; i++) sum += buf[i];
    p.level = p.level * 0.8 + (sum / 38 / 255) * 0.2;
  }
  speaking(id: string) {
    const p = this.peers.get(id);
    return !!p && performance.now() - p.lastAt < 300 && p.level > 0.03;
  }
  radioOf(id: string) {
    const p = this.peers.get(id);
    return !!p && p.radioOn && performance.now() - p.lastAt < 600;
  }
  connected(id: string) {
    return this.peers.has(id);
  }
}
