// Effetti sonori sintetizzati al volo con la Web Audio API: zero file da scaricare.
// Regola d'oro per giocare dal vivo: nessun suono (né vibrazione) cambia in base al ruolo segreto.
export type ToneOptions = { type?: OscillatorType; vol?: number; attack?: number; slideTo?: number };
type NoiseOptions = { vol?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number };

class SoundController {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  public enabled = true;
  public volume = 0.9; // volume generale (0–1), regolabile con lo slider

  constructor() {
    try {
      const saved = localStorage.getItem('spyfall_sound_enabled');
      if (saved !== null) this.enabled = saved === 'true';
      const vol = Number(localStorage.getItem('axend_volume'));
      if (localStorage.getItem('axend_volume') !== null && Number.isFinite(vol)) this.volume = Math.max(0, Math.min(1, vol));
    } catch {
      // memoria del browser non disponibile
    }
  }

  // Volume generale (0 = muto)
  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.enabled = this.volume > 0;
    if (this.master) this.master.gain.value = this.volume;
    try {
      localStorage.setItem('axend_volume', String(this.volume));
      localStorage.setItem('spyfall_sound_enabled', String(this.enabled));
    } catch {
      // memoria del browser non disponibile
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled && this.volume === 0) this.volume = 0.7;
    if (this.master) this.master.gain.value = this.volume;
    try {
      localStorage.setItem('spyfall_sound_enabled', String(this.enabled));
    } catch {
      // memoria del browser non disponibile
    }
    if (this.enabled) this.playPop();
    return this.enabled;
  }

  // Contesto audio pronto (o null se i suoni sono spenti / non supportati)
  private ready(): boolean {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      // un compressore evita che più suoni insieme gracchino
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // una nota libera, anche in ritardo di qualche istante (minigiochi: le note di Simon dice, i fischi…); rispetta volume e muto
  playNote(freq: number, dur = 0.4, opts: ToneOptions = {}, start = 0) {
    if (!this.ready()) return;
    this.tone(freq, start, dur, opts);
  }

  private tone(freq: number, start: number, dur: number, { type = 'sine', vol = 0.15, attack = 0.01, slideTo }: ToneOptions = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hiss(start: number, dur: number, { vol = 0.2, filter = 'bandpass', freq = 1000, freqTo, q = 1 }: NoiseOptions = {}) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + start;
    if (!this.noise) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    f.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // Tocco leggero sui pulsanti
  playClick() {
    if (!this.ready()) return;
    this.tone(660, 0, 0.06, { vol: 0.09, slideTo: 330 });
  }

  // "Pop" a bolla: qualcuno entra, una stanza compare
  playPop() {
    if (!this.ready()) return;
    this.tone(380, 0, 0.13, { vol: 0.14, attack: 0.005, slideTo: 900 });
  }

  // Fruscio di passaggio tra le schermate
  playWhoosh() {
    if (!this.ready()) return;
    this.hiss(0, 0.32, { vol: 0.1, freq: 380, freqTo: 3200, q: 0.8 });
  }

  // Carta, parola o turno svelati: IDENTICO per tutti, spia compresa (dal vivo non deve tradire nessuno)
  playReveal() {
    if (!this.ready()) return;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, i * 0.07, 0.75, { type: 'triangle', vol: 0.1 }));
    this.hiss(0, 0.6, { vol: 0.04, filter: 'highpass', freq: 6000 });
  }

  // Inizio partita: tre colpi che salgono e accordo finale
  playStart() {
    if (!this.ready()) return;
    [0, 0.16, 0.32].forEach((t, i) => this.tone(440 * (1 + i * 0.26), t, 0.12, { type: 'square', vol: 0.05 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => this.tone(f, 0.5, 0.9, { type: 'triangle', vol: 0.09 }));
    this.hiss(0.48, 0.7, { vol: 0.08, filter: 'highpass', freq: 5000 });
  }

  // Ticchettio del conto alla rovescia
  playTick() {
    if (!this.ready()) return;
    this.tone(880, 0, 0.035, { type: 'triangle', vol: 0.1, attack: 0.002, slideTo: 440 });
  }

  // Tempo scaduto
  playAlarm() {
    if (!this.ready()) return;
    [0, 0.22].forEach((t) => this.tone(700, t, 0.2, { type: 'square', vol: 0.07, slideTo: 900 }));
  }

  // Porta che si chiude di colpo (Astro Impostori: lo sentono tutti, uguale)
  playDoor() {
    if (!this.ready()) return;
    this.tone(170, 0, 0.22, { type: 'square', vol: 0.06, slideTo: 60 });
    this.hiss(0, 0.2, { vol: 0.16, filter: 'lowpass', freq: 1100, freqTo: 200 });
  }

  // BOOM della bomba
  playBoom() {
    if (!this.ready()) return;
    this.hiss(0, 1.3, { vol: 0.55, filter: 'lowpass', freq: 2200, freqTo: 50, q: 0.7 });
    this.tone(120, 0, 0.9, { vol: 0.45, attack: 0.005, slideTo: 28 });
  }

  // Risposta giusta
  playSuccess() {
    if (!this.ready()) return;
    [880, 1318.5].forEach((f, i) => this.tone(f, i * 0.09, 0.4, { vol: 0.12 }));
  }

  // Rullo di tamburi prima di una rivelazione, poi piatto
  playDrumroll(seconds = 1.3) {
    if (!this.ready()) return;
    const hits = Math.floor(seconds / 0.045);
    for (let i = 0; i < hits; i++) this.hiss(i * 0.045, 0.05, { vol: 0.05 + 0.12 * (i / hits), freq: 240, q: 1.4 });
    this.hiss(seconds, 1.1, { vol: 0.16, filter: 'highpass', freq: 5000 });
    this.tone(130.8, seconds, 0.6, { type: 'triangle', vol: 0.25, slideTo: 65 });
  }

  // Fanfara di vittoria
  playVictory() {
    if (!this.ready()) return;
    [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => this.tone(f, i * 0.1, 1.1, { type: 'triangle', vol: 0.15, attack: 0.04 }));
  }

  // ---- Axend Party (3D) ----
  // Musichetta in loop (sedie musicali, canzone della bambola): restituisce la funzione per fermarla
  startLoop(notes: number[], step = 0.18, type: OscillatorType = 'triangle'): () => void {
    if (!this.ready()) return () => {};
    let i = 0;
    const timer = setInterval(() => {
      if (!this.ready()) return;
      const f = notes[i % notes.length];
      if (f) this.tone(f, 0, step * 0.9, { type, vol: 0.07 });
      if (i % 4 === 0) this.tone(notes[0] / 2, 0, step * 1.8, { vol: 0.08 });
      i++;
    }, step * 1000);
    return () => clearInterval(timer);
  }

  // Sparo del cecchino
  playShot() {
    if (!this.ready()) return;
    this.hiss(0, 0.25, { vol: 0.35, filter: 'highpass', freq: 1200, freqTo: 300 });
    this.tone(160, 0, 0.18, { type: 'square', vol: 0.12, slideTo: 50 });
  }

  // Salto
  playJump() {
    if (!this.ready()) return;
    this.tone(320, 0, 0.14, { type: 'triangle', vol: 0.08, slideTo: 640 });
  }

  // Spinta che colpisce (boing)
  playBonk() {
    if (!this.ready()) return;
    this.tone(260, 0, 0.18, { type: 'square', vol: 0.07, slideTo: 90 });
    this.hiss(0, 0.08, { vol: 0.12, freq: 900 });
  }

  // Caduta nel vuoto
  playFall() {
    if (!this.ready()) return;
    this.tone(700, 0, 0.9, { type: 'triangle', vol: 0.09, slideTo: 90 });
  }

  // Errore
  playError() {
    if (!this.ready()) return;
    this.tone(190, 0, 0.16, { type: 'square', vol: 0.05 });
    this.tone(140, 0.12, 0.22, { type: 'square', vol: 0.05 });
  }
}

export const soundManager = new SoundController();

// Vibrazione: si spegne insieme ai suoni (utile per giocare dal vivo in silenzio)
export function haptic(pattern: number | number[]) {
  if (!soundManager.enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // vibrazione non supportata
  }
}
