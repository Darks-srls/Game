// Suoni di "Non lasciarmi solo", tutti sintetizzati (niente file da scaricare) e messi nello spazio 3D:
// la voce quotidiana del palazzo (ronzio, tubi, pompa, gocce) e gli errori di ritmo del soprannaturale.
// Ogni suono importante ha anche una scritta (vedi HorrorView): qui c'è solo l'audio.

type V3 = { x: number; y: number; z: number };
export type StepMat = 'marmo' | 'cemento' | 'legno' | 'piastrelle' | 'acqua' | 'terrazzo';
export type RoomSound = 'piccola' | 'corridoio' | 'scale' | 'cantina' | 'tecnico';

const REVERB: Record<RoomSound, { len: number; decay: number; wet: number }> = {
  piccola: { len: 0.5, decay: 3.2, wet: 0.16 },
  corridoio: { len: 1.4, decay: 2.6, wet: 0.28 },
  scale: { len: 2.8, decay: 2, wet: 0.42 },
  cantina: { len: 2, decay: 2.2, wet: 0.38 },
  tecnico: { len: 1.6, decay: 2.4, wet: 0.34 },
};

export class HorrorAudio {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  amb: GainNode;
  voiceBus: GainNode;
  private wet: GainNode;
  private conv: ConvolverNode;
  private noiseBuf: AudioBuffer;
  private room: RoomSound | null = null;
  private loops: { stop: () => void }[] = [];
  private heart = { gain: null as GainNode | null, next: 0, rate: 0 };
  private breath = { next: 0, on: false };
  private pump: { gain: GainNode; osc: OscillatorNode[] } | null = null;
  private chaseLoop: { gain: GainNode; stop: () => void } | null = null;
  occlude: (p: V3) => number = () => 0; // quanti muri ci sono tra me e il suono (lo calcola chi conosce la mappa)

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.amb = c.createGain();
    this.voiceBus = c.createGain();
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.voiceBus.connect(this.master);
    this.conv = c.createConvolver();
    this.wet = c.createGain();
    this.wet.gain.value = 0.3;
    this.conv.connect(this.wet).connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.setRoom('corridoio');
    const l = c.listener;
    if (l.positionX) {
      l.positionX.value = 0;
      l.positionY.value = 0;
      l.positionZ.value = 0;
    }
  }

  resume() {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }
  setVolume(v: number) {
    this.master.gain.value = Math.max(0, Math.min(1.5, v));
  }
  dispose() {
    this.chaseLoop?.stop();
    this.chaseLoop = null;
    for (const l of this.loops) l.stop();
    this.loops = [];
    void this.ctx.close();
  }

  // Chi ascolta: posizione e verso (la testa)
  setListener(p: V3, yaw: number, pitch: number) {
    const l = this.ctx.listener;
    const fx = Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = Math.cos(yaw) * Math.cos(pitch);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  // Riverbero dell'ambiente in cui mi trovo (tromba delle scale lunga, appartamento corto)
  setRoom(kind: RoomSound) {
    if (kind === this.room) return;
    this.room = kind;
    const r = REVERB[kind];
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * r.len);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, r.decay) * (i < 40 ? i / 40 : 1);
    }
    this.conv.buffer = buf;
    this.wet.gain.setTargetAtTime(r.wet, c.currentTime, 0.3);
  }

  // ---------------------------------------------------------------- mattoncini

  private noise(dur: number, at = this.ctx.currentTime) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loopStart = Math.random();
    s.loop = true;
    s.start(at, Math.random() * 1.5);
    s.stop(at + dur + 0.05);
    return s;
  }
  // Un punto nello spazio: filtro dei muri → posizione → effetti (+ riverbero)
  private spot(p: V3 | null, gain = 1, opts: { send?: number; ref?: number } = {}) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    if (!p) {
      g.connect(this.sfx);
      if (opts.send) {
        const s = c.createGain();
        s.gain.value = opts.send;
        g.connect(s).connect(this.conv);
      }
      return g;
    }
    const walls = this.occlude(p);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = walls <= 0 ? 18000 : walls === 1 ? 1100 : walls === 2 ? 520 : 300;
    const pan = c.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = opts.ref ?? 1.6;
    pan.rolloffFactor = 1.15;
    pan.maxDistance = 60;
    if (pan.positionX) {
      pan.positionX.value = p.x;
      pan.positionY.value = p.y;
      pan.positionZ.value = p.z;
    } else pan.setPosition(p.x, p.y, p.z);
    const out = c.createGain();
    out.gain.value = walls <= 0 ? 1 : walls === 1 ? 0.55 : walls === 2 ? 0.3 : 0.16;
    g.connect(lp).connect(pan).connect(out).connect(this.sfx);
    const s = c.createGain();
    s.gain.value = (opts.send ?? 0.35) * (walls ? 1.3 : 1);
    out.connect(s).connect(this.conv);
    return g;
  }
  private env(g: GainNode, at: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  }
  private tone(out: AudioNode, type: OscillatorType, f: number, at: number, a: number, peak: number, d: number, glideTo?: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + a + d);
    const g = this.ctx.createGain();
    this.env(g, at, a, peak, d);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + a + d + 0.05);
  }
  private burst(out: AudioNode, at: number, dur: number, type: BiquadFilterType, f: number, q: number, peak: number, a = 0.004) {
    const n = this.noise(dur + a, at);
    const bp = this.ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, at, a, peak, dur);
    n.connect(bp).connect(g).connect(out);
  }

  // ---------------------------------------------------------------- passi e corpo

  footstep(p: V3 | null, mat: StepMat, loud = 1, self = false) {
    const c = this.ctx;
    const at = c.currentTime + Math.random() * 0.015;
    // cupi e di sottofondo: suola di gomma sul pavimento, quasi solo bassi (i miei ancora più piano)
    const out = this.spot(self ? null : p, (self ? 0.16 : 0.42) * loud, { send: self ? 0.08 : 0.25 });
    const k = 0.85 + Math.random() * 0.3;
    if (mat === 'acqua') {
      this.burst(out, at, 0.22, 'lowpass', 650 * k, 0.6, 0.5, 0.02);
      this.tone(out, 'sine', 260 + Math.random() * 200, at + 0.04, 0.01, 0.05, 0.08);
      return;
    }
    const f = { marmo: 520, terrazzo: 480, piastrelle: 560, cemento: 380, legno: 300 }[mat] * k;
    // un tonfo morbido (attacco lento, niente clic) e un fruscio basso
    this.burst(out, at, 0.11, 'lowpass', f, 0.5, 0.42, 0.012);
    this.tone(out, 'sine', mat === 'legno' ? 95 : 70, at, 0.01, 0.38, 0.1, 45);
    if (mat === 'legno' && Math.random() < 0.18) this.creak(out, at + 0.05, 0.3, 0.03);
  }
  private creak(out: AudioNode, at: number, dur: number, peak: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 + Math.random() * 40, at);
    o.frequency.linearRampToValueAtTime(110 + Math.random() * 60, at + dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 9;
    bp.frequency.setValueAtTime(900, at);
    bp.frequency.linearRampToValueAtTime(1500, at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(bp).connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  // ---------------------------------------------------------------- porte

  door(p: V3, open: boolean, kind: 'legno' | 'acciaio' | 'portone' | 'servizio' | 'cantina', slam = false) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.9);
    const metal = kind !== 'legno' && kind !== 'portone';
    // maniglia / scrocco
    this.burst(out, at, 0.03, 'highpass', metal ? 3000 : 2200, 0.7, 0.4);
    this.tone(out, 'square', metal ? 1800 : 1300, at, 0.001, 0.05, 0.03);
    if (open) this.creak(out, at + 0.06, metal ? 0.6 : 0.9, metal ? 0.07 : 0.1);
    else {
      this.tone(out, 'sine', metal ? 70 : 95, at + 0.12, 0.002, slam ? 1 : 0.55, metal ? 0.35 : 0.22, 40);
      this.burst(out, at + 0.12, 0.12, 'lowpass', metal ? 1600 : 700, 0.7, slam ? 0.8 : 0.4);
      if (metal) [1, 2.7, 5.1].forEach((m, i) => this.tone(out, 'sine', 210 * m, at + 0.12, 0.002, 0.12 / (i + 1), 0.6));
    }
  }

  // ---------------------------------------------------------------- il Custode

  // Due colpi metallici: annunciano che si sta avvicinando
  metalKnocks(p: V3) {
    const at = this.ctx.currentTime + 0.05;
    const out = this.spot(p, 1.6, { send: 0.75, ref: 4 });
    for (const t of [0, 0.62]) {
      const f0 = 150 + Math.random() * 10;
      [1, 2.32, 4.25, 6.63, 9.38].forEach((m, i) => this.tone(out, 'sine', f0 * m, at + t, 0.001, 0.5 / (i + 1), 1.4 - i * 0.2));
      this.burst(out, at + t, 0.05, 'highpass', 2500, 0.5, 0.6);
    }
  }
  // Tre colpi su una porta: tra poco la apre
  doorKnocks(p: V3) {
    const at = this.ctx.currentTime + 0.05;
    const out = this.spot(p, 1.4, { send: 0.5 });
    for (const t of [0, 0.5, 1.0]) {
      this.tone(out, 'sine', 120, at + t, 0.002, 1, 0.18, 55);
      this.burst(out, at + t, 0.09, 'bandpass', 520, 1, 0.9);
    }
  }
  doorBreak(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1.6, { send: 0.6 });
    this.tone(out, 'sine', 80, at, 0.002, 1.2, 0.5, 35);
    this.burst(out, at, 0.4, 'lowpass', 1400, 0.6, 1);
    this.creak(out, at + 0.1, 0.5, 0.15);
  }
  custodeStep(p: V3, fast: boolean) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, fast ? 1.3 : 1, { send: 0.5, ref: 2.5 });
    this.tone(out, 'sine', 52, at, 0.006, 1.1, 0.28, 32);
    this.burst(out, at, 0.16, 'lowpass', 320, 0.6, 0.7, 0.01);
    // il piede nudo che striscia sul pavimento umido
    this.burst(out, at + 0.05, fast ? 0.14 : 0.4, 'bandpass', 900, 2, 0.22, fast ? 0.02 : 0.15);
  }
  // La chiave inglese arrugginita trascinata sul pavimento: si sente prima di vederlo
  scrape(p: V3, dur = 0.7) {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(p, 0.9, { send: 0.6, ref: 3 });
    const n = this.noise(dur + 0.1, at);
    const bp1 = c.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.Q.value = 14;
    bp1.frequency.setValueAtTime(1900 + Math.random() * 600, at);
    bp1.frequency.linearRampToValueAtTime(1500 + Math.random() * 900, at + dur);
    const bp2 = c.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.Q.value = 9;
    bp2.frequency.value = 3400 + Math.random() * 800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.55, at + 0.08);
    g.gain.setValueAtTime(0.5, at + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    n.connect(bp1).connect(g);
    n.connect(bp2).connect(g);
    g.connect(out);
    // ogni tanto un colpo del ferro contro una piastrella
    if (Math.random() < 0.5) [1, 2.7, 5.2].forEach((m, i) => this.tone(out, 'sine', 310 * m, at + dur * Math.random(), 0.001, 0.2 / (i + 1), 0.5));
  }
  // Ringhio gutturale (lo si sente quando è vicino)
  growl(p: V3, strong = false) {
    const c = this.ctx;
    const at = c.currentTime;
    const dur = strong ? 1.8 : 1.3;
    const out = this.spot(p, strong ? 1.4 : 0.9, { send: 0.5, ref: 2 });
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(strong ? 70 : 55, at);
    o.frequency.linearRampToValueAtTime(strong ? 48 : 40, at + dur);
    const fm = c.createOscillator();
    fm.frequency.value = 23;
    const fg = c.createGain();
    fg.gain.value = 18;
    fm.connect(fg).connect(o.frequency);
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 420;
    f1.Q.value = 3;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 900;
    f2.Q.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.6, at + 0.25);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(out);
    o.start(at);
    fm.start(at);
    o.stop(at + dur + 0.05);
    fm.stop(at + dur + 0.05);
    this.burst(out, at, dur, 'bandpass', 600, 1.5, 0.25, 0.3);
  }
  // L'urlo del jumpscare: forte, stridente, vicinissimo
  scream() {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(null, 1.25, { send: 0.35 });
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) curve[i] = Math.tanh(((i / 511) * 2 - 1) * 6);
    shaper.curve = curve;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.9, at + 0.04);
    g.gain.setValueAtTime(0.85, at + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    shaper.connect(g).connect(out);
    const voices: [number, number, OscillatorType][] = [
      [520, 330, 'sawtooth'],
      [780, 470, 'square'],
      [1310, 980, 'sawtooth'],
      [180, 90, 'sawtooth'],
    ];
    for (const [f0, f1, type] of voices) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + 1.5);
      const vib = c.createOscillator();
      vib.frequency.value = 31 + Math.random() * 9;
      const vg = c.createGain();
      vg.gain.value = f0 * 0.06;
      vib.connect(vg).connect(o.frequency);
      const og = c.createGain();
      og.gain.value = 0.22;
      o.connect(og).connect(shaper);
      o.start(at);
      vib.start(at);
      o.stop(at + 1.6);
      vib.stop(at + 1.6);
    }
    this.burst(out, at, 1.4, 'bandpass', 2600, 0.8, 0.8, 0.02);
    this.tone(out, 'sine', 45, at, 0.01, 1.4, 0.9, 30);
  }
  // Sussurro vicino all'orecchio (solo per me)
  whisper(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.5, { send: 0.2, ref: 0.6 });
    for (let i = 0; i < 6; i++) this.burst(out, at + i * 0.22 + Math.random() * 0.08, 0.12 + Math.random() * 0.1, 'bandpass', 2400 + Math.random() * 1800, 4, 0.35, 0.03);
  }
  // Un pianto soffocato dietro una porta
  crying(p: V3) {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(p, 0.45, { send: 0.5 });
    for (let i = 0; i < 4; i++) {
      const t = at + i * 0.75;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(560 + Math.random() * 60, t);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.6);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value = 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.12);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.62);
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.65);
      this.burst(out, t + 0.6, 0.12, 'bandpass', 1800, 2, 0.12, 0.03);
    }
  }
  // Unghie dentro il muro
  scratches(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.6, { send: 0.4 });
    for (let i = 0; i < 5; i++) this.burst(out, at + i * 0.32 + Math.random() * 0.1, 0.22, 'bandpass', 3000 + Math.random() * 1200, 6, 0.3, 0.05);
  }
  // Qualcosa corre veloce oltre il corridoio
  runPast(from: V3, to: V3) {
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      setTimeout(() => this.custodeStep({ x: from.x + (to.x - from.x) * k, y: from.y, z: from.z + (to.z - from.z) * k }, true), i * 170);
    }
  }
  // Una lampadina che scoppia
  bulb(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1, { send: 0.5 });
    this.burst(out, at, 0.08, 'highpass', 3000, 0.6, 1);
    for (let i = 0; i < 8; i++) this.tone(out, 'sine', 3000 + Math.random() * 4000, at + 0.05 + Math.random() * 0.4, 0.001, 0.06, 0.06);
    this.tone(out, 'sine', 120, at, 0.002, 0.4, 0.15, 60);
  }
  // Oggetti che cadono, scivolano, si girano (legno, vetro, metallo, carta)
  objectFall(p: V3, mat: 'legno' | 'vetro' | 'metallo' | 'carta' | 'ceramica') {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.9, { send: 0.45 });
    if (mat === 'vetro') return this.glass(p);
    if (mat === 'ceramica') {
      this.burst(out, at, 0.1, 'highpass', 2500, 0.7, 0.9);
      for (let i = 0; i < 10; i++) this.tone(out, 'sine', 2500 + Math.random() * 5000, at + Math.random() * 0.35, 0.001, 0.05, 0.05);
    } else if (mat === 'metallo') {
      [1, 2.4, 4.6, 7.1].forEach((m, i) => this.tone(out, 'sine', 420 * m, at, 0.001, 0.35 / (i + 1), 0.9));
      this.tone(out, 'sine', 430, at + 0.25, 0.001, 0.12, 0.5);
    } else if (mat === 'carta') this.burst(out, at, 0.25, 'bandpass', 1500, 0.8, 0.4, 0.01);
    else {
      this.tone(out, 'sine', 110, at, 0.003, 0.7, 0.18, 60);
      this.burst(out, at, 0.12, 'bandpass', 700, 1, 0.6);
      this.tone(out, 'sine', 140, at + 0.18, 0.003, 0.25, 0.12, 80);
    }
  }
  slide(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.7, { send: 0.4 });
    this.burst(out, at, 0.7, 'bandpass', 500, 1.5, 0.4, 0.1);
    this.creak(out, at, 0.7, 0.06);
  }
  // TV o radio che si accende da sola: fruscio e un frammento di musica storta
  staticNoise(p: V3, dur = 3) {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(p, 0.5, { send: 0.3 });
    this.burst(out, at, dur, 'bandpass', 3200, 0.5, 0.35, 0.05);
    const notes = [330, 311, 277, 247];
    notes.forEach((f, i) => this.tone(out, 'triangle', f * (1 + (Math.random() - 0.5) * 0.04), at + 0.5 + i * 0.45, 0.02, 0.06, 0.4));
  }
  faucet(p: V3, dur = 4) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.5, { send: 0.3 });
    this.burst(out, at, dur, 'bandpass', 2200, 0.7, 0.22, 0.2);
  }
  ballBounces(p: V3) {
    for (let i = 0; i < 6; i++) setTimeout(() => this.objectFall({ x: p.x, y: p.y - i * 0.3, z: p.z + i * 0.45 }, 'carta'), 260 * i * (1 - i * 0.07));
  }
  // Ronzio che sale quando sta per cominciare una caccia
  dread() {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(null, 0.5, { send: 0.4 });
    for (const f of [41, 43.5, 82.4]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, at);
      o.frequency.linearRampToValueAtTime(f * 1.06, at + 4.5);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(120, at);
      lp.frequency.linearRampToValueAtTime(900, at + 4.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.22, at + 4);
      g.gain.linearRampToValueAtTime(0.0001, at + 5);
      o.connect(lp).connect(g).connect(out);
      o.start(at);
      o.stop(at + 5.1);
    }
  }
  custodeBreath(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.7, { send: 0.4 });
    this.burst(out, at, 1.3, 'bandpass', 380, 2.5, 0.35, 0.6);
    this.tone(out, 'sawtooth', 48, at + 0.2, 0.6, 0.05, 0.9);
  }
  windup(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1.3, { send: 0.3 });
    this.burst(out, at, 0.5, 'bandpass', 260, 3, 0.8, 0.3);
    this.tone(out, 'sawtooth', 55, at, 0.3, 0.25, 0.4, 90);
  }
  // Il colpo: forte, vicino, senza effetti visivi accecanti
  hit(grave: boolean) {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 1.2, { send: 0.4 });
    this.tone(out, 'sine', 70, at, 0.003, 1.5, 0.6, 30);
    this.burst(out, at, 0.35, 'lowpass', 1800, 0.6, 1.2);
    if (grave) this.burst(out, at + 0.2, 1.2, 'lowpass', 400, 0.6, 0.6, 0.2);
  }
  // Accordo storto che sale: qualcosa ti ha visto
  stinger(strong = true) {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(null, strong ? 0.5 : 0.3, { send: 0.6 });
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, at);
    lp.frequency.exponentialRampToValueAtTime(3500, at + 1.2);
    lp.connect(out);
    for (const f of [110, 116.5, 164.8, 233]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.16, at + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + 3.3);
    }
    const s = c.createOscillator();
    s.type = 'sine';
    s.frequency.setValueAtTime(1700, at);
    const vib = c.createOscillator();
    vib.frequency.value = 7;
    const vg = c.createGain();
    vg.gain.value = 30;
    vib.connect(vg).connect(s.frequency);
    const sg = c.createGain();
    this.env(sg, at + 0.3, 0.8, 0.04, 1.6);
    s.connect(sg).connect(out);
    s.start(at + 0.3);
    vib.start(at + 0.3);
    s.stop(at + 2.8);
    vib.stop(at + 2.8);
  }
  // Battito del cuore (0 = niente, 1 = fortissimo)
  heartbeat(level: number) {
    const now = this.ctx.currentTime;
    if (level <= 0.05) return;
    if (now < this.heart.next) return;
    const period = 1.05 - level * 0.5;
    this.heart.next = now + period;
    const out = this.spot(null, 0.25 + level * 0.5, { send: 0 });
    this.tone(out, 'sine', 52, now, 0.01, 1, 0.12, 40);
    this.tone(out, 'sine', 46, now + 0.2, 0.01, 0.7, 0.14, 36);
  }
  // Respiro affannato (quando si è feriti)
  breathing(on: boolean, fast: boolean) {
    const now = this.ctx.currentTime;
    if (!on || now < this.breath.next) return;
    this.breath.next = now + (fast ? 1.3 : 2.4);
    const out = this.spot(null, fast ? 0.22 : 0.14, { send: 0.05 });
    this.burst(out, now, fast ? 0.35 : 0.6, 'bandpass', 900, 0.9, 0.5, 0.15);
    this.burst(out, now + (fast ? 0.55 : 1.1), fast ? 0.4 : 0.8, 'bandpass', 600, 0.9, 0.4, 0.2);
  }

  // ---------------------------------------------------------------- oggetti del palazzo (poltergeist)

  // Vetro che si frantuma: botta, schianto brillante, tante schegge che tintinnano e scivolano via
  glass(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1.35, { send: 0.55 });
    this.tone(out, 'sine', 180, at, 0.002, 0.5, 0.08, 90);
    this.burst(out, at, 0.06, 'highpass', 1800, 0.6, 1.2);
    this.burst(out, at + 0.01, 0.45, 'highpass', 4200, 0.4, 0.7, 0.003);
    for (let i = 0; i < 26; i++) {
      const t = at + 0.02 + Math.pow(Math.random(), 1.7) * 0.9;
      this.tone(out, 'sine', 2800 + Math.random() * 6500, t, 0.001, 0.06 + Math.random() * 0.06, 0.04 + Math.random() * 0.12);
    }
    for (let i = 0; i < 5; i++) this.burst(out, at + 0.35 + Math.random() * 0.6, 0.05, 'bandpass', 5000 + Math.random() * 2000, 2, 0.18);
  }
  // Vecchio telefono a muro: due campanelli che vibrano, tre squilli
  phone(p: V3) {
    const c = this.ctx;
    const out = this.spot(p, 0.7, { send: 0.45 });
    for (let r = 0; r < 3; r++) {
      const at = c.currentTime + r * 3.2;
      for (const f of [1320, 1480]) {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const am = c.createOscillator();
        am.type = 'square';
        am.frequency.value = 22;
        const ag = c.createGain();
        ag.gain.value = 0.5;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.12, at + 0.02);
        g.gain.setValueAtTime(0.12, at + 1.5);
        g.gain.linearRampToValueAtTime(0.0001, at + 1.6);
        am.connect(ag).connect(g.gain);
        o.connect(g).connect(out);
        o.start(at);
        am.start(at);
        o.stop(at + 1.65);
        am.stop(at + 1.65);
      }
    }
  }
  // Carillon che parte da solo e si scarica rallentando (stonato)
  musicBox(p: V3) {
    const at = this.ctx.currentTime + 0.1;
    const out = this.spot(p, 0.55, { send: 0.6 });
    const mel = [659, 784, 880, 988, 880, 784, 659, 587, 659, 523, 587, 494, 523, 440];
    let t = 0;
    mel.forEach((f, i) => {
      const det = 1 + (Math.random() - 0.5) * 0.025;
      this.tone(out, 'sine', f * det, at + t, 0.002, 0.16, 1.2);
      this.tone(out, 'sine', f * 2.01 * det, at + t, 0.002, 0.05, 0.5);
      this.tone(out, 'sine', f * 3.98 * det, at + t, 0.001, 0.02, 0.25);
      t += 0.32 + i * i * 0.006; // si scarica
    });
  }
  // Lampadario che oscilla: cigolio della catenella avanti e indietro
  swing(p: V3) {
    const out = this.spot(p, 0.6, { send: 0.5 });
    for (let i = 0; i < 6; i++) this.creak(out, this.ctx.currentTime + i * 0.75, 0.5, 0.06 * (1 - i * 0.12));
  }
  // Una porta che si apre da sola, lentissima
  slowCreak(p: V3) {
    const out = this.spot(p, 1, { send: 0.55 });
    const at = this.ctx.currentTime;
    this.creak(out, at, 2.6, 0.13);
    this.creak(out, at + 1.2, 2, 0.08);
  }
  // Qualcuno bussa da dentro un armadio (ovattato)
  wardrobeKnock(p: V3) {
    const at = this.ctx.currentTime + 0.05;
    const out = this.spot(p, 1.1, { send: 0.3 });
    for (const t of [0, 0.34, 0.95]) {
      this.tone(out, 'sine', 95, at + t, 0.002, 0.8, 0.16, 50);
      this.burst(out, at + t, 0.06, 'lowpass', 420, 0.8, 0.7);
    }
  }
  // Catene che sbattono (chi è incatenato che si divincola, o un lucchetto sbagliato)
  chain(p: V3, ko = false) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.9, { send: 0.45 });
    for (let i = 0; i < 9; i++) {
      const t = at + Math.random() * 0.55;
      this.tone(out, 'sine', 900 + Math.random() * 2600, t, 0.001, 0.09, 0.12);
      this.burst(out, t, 0.02, 'highpass', 3000, 0.8, 0.2);
    }
    if (ko) this.tone(out, 'square', 140, at + 0.1, 0.005, 0.12, 0.3, 90);
  }
  // Display dei quadri: codice giusto / sbagliato (l'allarme si sente lontano)
  code(p: V3, ok: boolean) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, ok ? 0.6 : 1.1, { send: 0.4 });
    if (ok) [880, 1175, 1568].forEach((f, i) => this.tone(out, 'sine', f, at + i * 0.09, 0.005, 0.18, 0.25));
    else for (let i = 0; i < 3; i++) this.tone(out, 'square', i % 2 ? 660 : 880, at + i * 0.22, 0.005, 0.16, 0.18);
  }
  // Sovrapressione della pompa: colpo sordo e sfiato
  bang(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1.6, { send: 0.7, ref: 4 });
    this.tone(out, 'sine', 55, at, 0.003, 1.5, 0.9, 28);
    this.burst(out, at, 0.5, 'lowpass', 900, 0.6, 1.2);
    this.burst(out, at + 0.2, 2.2, 'highpass', 2600, 0.6, 0.35, 0.05);
  }
  // Dentro l'armadio: il mio respiro (più forte se il Custode è vicino e non lo trattengo)
  hideBreath(level: number) {
    const now = this.ctx.currentTime;
    if (now < this.breath.next) return;
    this.breath.next = now + 1.6 - level * 0.6;
    const out = this.spot(null, 0.12 + level * 0.3, { send: 0.02 });
    this.burst(out, now, 0.45, 'bandpass', 800, 0.9, 0.6, 0.18);
    this.burst(out, now + 0.7, 0.55, 'bandpass', 560, 0.9, 0.45, 0.22);
  }
  gasp() {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.5, { send: 0.05 });
    this.burst(out, at, 0.35, 'bandpass', 1300, 1.2, 0.9, 0.05);
  }
  heal() {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.3, { send: 0.3 });
    [523, 659, 784, 1046].forEach((f, i) => this.tone(out, 'sine', f, at + i * 0.12, 0.01, 0.12, 0.6));
  }
  // I suoni dei minigiochi dei lavori (vicini, non nello spazio)
  task(what: 'tick' | 'scrub' | 'click' | 'spark' | 'ok' | 'ko' | 'squeak' | 'hiss') {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.35, { send: 0.05 });
    if (what === 'tick') this.burst(out, at, 0.015, 'highpass', 3500, 0.8, 0.4);
    else if (what === 'click') {
      this.burst(out, at, 0.02, 'bandpass', 2400, 2, 0.6);
      this.tone(out, 'square', 900, at, 0.001, 0.05, 0.03);
    } else if (what === 'scrub') this.burst(out, at, 0.12, 'bandpass', 2600 + Math.random() * 800, 1.2, 0.35, 0.02);
    else if (what === 'spark') {
      for (let i = 0; i < 5; i++) this.burst(out, at + i * 0.025, 0.02, 'highpass', 5000, 0.8, 0.5);
      this.tone(out, 'sawtooth', 120, at, 0.002, 0.08, 0.15);
    } else if (what === 'ok') [660, 990].forEach((f, i) => this.tone(out, 'sine', f, at + i * 0.08, 0.005, 0.15, 0.2));
    else if (what === 'ko') this.tone(out, 'square', 160, at, 0.004, 0.12, 0.2, 110);
    else if (what === 'squeak') {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(620 + Math.random() * 200, at);
      o.frequency.linearRampToValueAtTime(780 + Math.random() * 300, at + 0.18);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 6;
      const g = this.ctx.createGain();
      this.env(g, at, 0.02, 0.12, 0.18);
      o.connect(bp).connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.25);
    } else if (what === 'hiss') this.burst(out, at, 0.4, 'highpass', 3000, 0.5, 0.35, 0.03);
  }
  // Musica dell'inseguimento: bassi che pulsano, colpi metallici e archi stridenti (finché ti insegue)
  chase(on: boolean) {
    const c = this.ctx;
    if (!on) {
      if (this.chaseLoop) {
        const l = this.chaseLoop;
        this.chaseLoop = null;
        l.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.6);
        setTimeout(() => l.stop(), 2500);
      }
      return;
    }
    if (this.chaseLoop) return;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.setTargetAtTime(0.55, c.currentTime, 0.25);
    gain.connect(this.sfx);
    const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
    // basso pulsante
    const bass = c.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.value = 46.25;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const pulse = c.createGain();
    pulse.gain.value = 0.25;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 3.2;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.22;
    lfo.connect(lfoG).connect(pulse.gain);
    bass.connect(lp).connect(pulse).connect(gain);
    nodes.push(bass, lfo);
    // archi stridenti (cluster)
    for (const f of [622, 659, 698]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const vib = c.createOscillator();
      vib.frequency.value = 5 + Math.random() * 2;
      const vg = c.createGain();
      vg.gain.value = 6;
      vib.connect(vg).connect(o.frequency);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 1.5;
      bp.Q.value = 2;
      const g = c.createGain();
      g.gain.value = 0.025;
      o.connect(bp).connect(g).connect(gain);
      nodes.push(o, vib);
    }
    for (const n of nodes) n.start();
    // colpi metallici a tempo
    let alive = true;
    const hitLoop = (k: number) => {
      if (!alive) return;
      const at = c.currentTime;
      [1, 2.4, 4.1].forEach((m, i) => this.tone(gain, 'sine', 98 * m, at, 0.001, 0.22 / (i + 1), 0.35));
      this.burst(gain, at, 0.05, 'lowpass', 600, 0.8, 0.5);
      setTimeout(() => hitLoop(k + 1), Math.max(300, 620 - k * 8));
    };
    hitLoop(0);
    this.chaseLoop = {
      gain,
      stop: () => {
        alive = false;
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            // già fermo
          }
        }
        gain.disconnect();
      },
    };
  }

  // ---------------------------------------------------------------- il palazzo

  // Il ronzio del palazzo, il vento fuori e (in cantina) la vibrazione degli impianti
  startAmbient() {
    const c = this.ctx;
    const hum = c.createOscillator();
    hum.frequency.value = 50;
    const hum2 = c.createOscillator();
    hum2.frequency.value = 100.6;
    const hg = c.createGain();
    hg.gain.value = 0.018;
    hum.connect(hg);
    const hg2 = c.createGain();
    hg2.gain.value = 0.006;
    hum2.connect(hg2).connect(hg);
    hg.connect(this.amb);
    hum.start();
    hum2.start();
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const wf = c.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 380;
    wf.Q.value = 0.7;
    const wg = c.createGain();
    wg.gain.value = 0.02;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 0.014;
    lfo.connect(lg).connect(wg.gain);
    const lfo2 = c.createOscillator();
    lfo2.frequency.value = 0.11;
    const lg2 = c.createGain();
    lg2.gain.value = 160;
    lfo2.connect(lg2).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(this.amb);
    wind.start();
    lfo.start();
    lfo2.start();
    this.loops.push({
      stop: () => {
        for (const n of [hum, hum2, wind, lfo, lfo2]) n.stop();
      },
    });
  }
  private rainGain: GainNode | null = null;
  setRain(level: number) {
    const c = this.ctx;
    if (!this.rainGain) {
      const n = c.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      this.rainGain = c.createGain();
      this.rainGain.gain.value = 0;
      n.connect(hp).connect(lp).connect(this.rainGain).connect(this.amb);
      n.start();
      this.loops.push({ stop: () => n.stop() });
    }
    this.rainGain.gain.setTargetAtTime(level * 0.09, c.currentTime, 0.4);
  }
  // Pompa accesa: un brontolio che si sente in cantina (e attutito sopra)
  setPump(on: boolean, p: V3 | null) {
    if (on && !this.pump) {
      const c = this.ctx;
      const g = c.createGain();
      g.gain.value = 0;
      const o1 = c.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 37;
      const o2 = c.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 74.3;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      o1.connect(lp);
      const g2 = c.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(lp);
      const out = this.spot(p, 1, { send: 0.3, ref: 3 });
      lp.connect(g).connect(out);
      o1.start();
      o2.start();
      g.gain.setTargetAtTime(0.22, c.currentTime, 1.5);
      this.pump = { gain: g, osc: [o1, o2] };
    } else if (!on && this.pump) {
      const pm = this.pump;
      pm.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      setTimeout(() => pm.osc.forEach((o) => o.stop()), 2500);
      this.pump = null;
    }
  }
  // Rumore di un lavoro in corso (relè, motore, ronzio elettrico)
  work(p: V3, kind: string) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.8);
    if (kind === 'pannello') {
      this.tone(out, 'square', 60 + Math.random() * 3, at, 0.01, 0.06, 0.4);
      this.burst(out, at, 0.04, 'highpass', 4000, 0.7, 0.3);
    } else if (kind === 'pompa') {
      this.tone(out, 'sawtooth', 40, at, 0.05, 0.2, 0.5, 46);
      this.burst(out, at, 0.3, 'lowpass', 500, 0.7, 0.4, 0.05);
    } else if (kind === 'lavello') this.burst(out, at, 0.5, 'bandpass', 1800, 0.6, 0.3, 0.05);
    else if (kind === 'valvola') this.creak(out, at, 0.4, 0.12);
    else {
      this.burst(out, at, 0.06, 'bandpass', 2200, 1, 0.4);
      this.tone(out, 'sine', 900, at, 0.001, 0.1, 0.12);
    }
  }
  done(p: V3 | null) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.6, { send: 0.2 });
    this.tone(out, 'sine', 660, at, 0.005, 0.15, 0.2);
    this.tone(out, 'sine', 990, at + 0.12, 0.005, 0.12, 0.3);
  }
  // Un colpo sordo nel tubo… e la risposta che arriva un secondo troppo tardi
  pipe(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 1.1, { send: 0.6, ref: 3 });
    for (const [t, k] of [
      [0, 1],
      [1.15, 0.55],
    ]) {
      [1, 2.1, 3.9].forEach((m, i) => this.tone(out, 'sine', 68 * m, at + t, 0.002, (0.7 * k) / (i + 1), 0.9));
      this.burst(out, at + t, 0.08, 'lowpass', 900, 0.7, 0.5 * k);
    }
  }
  // Un ascensore lontano… in un palazzo che non ha l'ascensore
  elevator(p: V3) {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(p, 0.9, { send: 0.7, ref: 5 });
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, at);
    o.frequency.linearRampToValueAtTime(130, at + 4);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.12, at + 0.8);
    g.gain.linearRampToValueAtTime(0.12, at + 3.6);
    g.gain.linearRampToValueAtTime(0.0001, at + 4.4);
    o.connect(lp).connect(g).connect(out);
    o.start(at);
    o.stop(at + 4.5);
    for (const t of [0.1, 4.3]) this.tone(out, 'sine', 180, at + t, 0.002, 0.3, 0.4, 120);
  }
  intercom(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.8, { send: 0.4 });
    for (let i = 0; i < 3; i++) {
      const t = at + i * 0.9;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 620;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.setValueAtTime(0.12, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.6);
    }
  }
  drip(p: V3) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.45, { send: 0.6 });
    this.tone(out, 'sine', 1100 + Math.random() * 900, at, 0.001, 0.25, 0.08, 700);
  }
  // Passi che continuano dopo che tutti si sono fermati
  phantomSteps(p: V3, n = 4) {
    for (let i = 0; i < n; i++) setTimeout(() => this.footstep(p, 'legno', 0.7), i * 520);
  }
  hiss(p: V3, dur = 2) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.7, { send: 0.3 });
    this.burst(out, at, dur, 'highpass', 3500, 0.5, 0.35, 0.2);
    this.tone(out, 'sine', 55, at, 0.01, 0.6, 0.4, 40);
  }
  siren() {
    const c = this.ctx;
    const at = c.currentTime;
    const out = this.spot(null, 0.18, { send: 0.5 });
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, at);
    o.frequency.linearRampToValueAtTime(760, at + 0.9);
    o.frequency.linearRampToValueAtTime(520, at + 1.8);
    const g = c.createGain();
    this.env(g, at, 0.05, 0.6, 1.8);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 1.9);
  }
  // Radio e messaggi rapidi
  radioClick(open: boolean) {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.35, { send: 0 });
    this.tone(out, 'square', open ? 1400 : 900, at, 0.001, 0.15, 0.03);
    this.burst(out, at + 0.02, 0.12, 'bandpass', 2500, 0.8, 0.25);
  }
  ping(p: V3 | null, danger = false) {
    const at = this.ctx.currentTime;
    const out = this.spot(p, 0.5, { send: 0.1 });
    this.tone(out, 'sine', danger ? 440 : 880, at, 0.005, 0.25, 0.25);
    this.tone(out, 'sine', danger ? 330 : 1320, at + 0.12, 0.005, 0.2, 0.3);
  }
  ui(ok = true) {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.3, { send: 0 });
    this.tone(out, 'sine', ok ? 740 : 220, at, 0.003, 0.2, 0.12);
  }
  pickup() {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.4, { send: 0.1 });
    this.burst(out, at, 0.08, 'bandpass', 1200, 1, 0.5);
    this.tone(out, 'sine', 300, at, 0.002, 0.2, 0.08);
  }
  torch(on: boolean) {
    const at = this.ctx.currentTime;
    const out = this.spot(null, 0.3, { send: 0 });
    this.tone(out, 'square', on ? 2200 : 1700, at, 0.001, 0.12, 0.015);
    this.burst(out, at, 0.02, 'highpass', 5000, 0.7, 0.2);
  }
}
