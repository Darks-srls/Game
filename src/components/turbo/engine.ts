// ⚽🚗 Axend Turbo — il motore del telefono: previsione e correzione (come Rocket League).
// Il server decide tutto; il telefono gira qualche passo "avanti" (il tempo che i miei comandi arrivino al server), così la mia
// macchina risponde subito. A ogni foto del server si riparte da lì e si rifanno i passi coi miei comandi già dati: le piccole
// differenze diventano "correzioni visive" che si smorzano da sole (offsets).
import { World, encodeControls, unpackStats, type Snapshot, type Stats, type TurboEvent } from '../../game/turbo/world';
import { noControls, type Car, type Controls } from '../../game/turbo/car';
import { TICK_RATE } from '../../game/turbo/consts';
import { V3 } from '../../game/turbo/math';

export interface FastSnapshot extends Snapshot {
  ev: TurboEvent[];
  m: Record<string, number>; // per ogni giocatore: quanti passi d'anticipo avevano i suoi comandi
  now: number; // ora del server (ms)
}

const MINE: TurboEvent['k'][] = ['touch', 'pad', 'flipreset'];
const isMine = (e: TurboEvent, me: string) => MINE.includes(e.k) && 'id' in e && e.id === me;

export class TurboEngine {
  world = new World();
  ready = false;
  lead = 8; // passi in anticipo rispetto al server (si regola da solo)
  margin = 0; // ultimo anticipo misurato dal server (passi)
  events: TurboEvent[] = []; // da far vedere (li consuma la grafica)
  offsets = new Map<string, V3>(); // correzioni visive
  score: [number, number] = [0, 0]; // punteggio vero (dal server)
  stats: Record<string, Stats> = {}; // statistiche vere (dal server: quelle del mondo previsto contano anche i passi rifatti)
  private history = new Map<number, Controls>();
  private tickOffset = NaN; // passo del server ≈ ora(ms)·0,12 + tickOffset
  private queue: FastSnapshot[] = [];
  private lastSendTick = -100;
  private delays: number[] = [];

  constructor(
    public myId: string,
    private send: (payload: unknown) => void,
  ) {}

  onSnapshot(s: FastSnapshot) {
    this.queue.push(s);
  }

  // passo del server stimato adesso
  serverTick(nowMs: number) {
    return nowMs * (TICK_RATE / 1000) + this.tickOffset;
  }

  // a ogni fotogramma: applica le foto arrivate, poi avanza la previsione fino a "adesso + anticipo"
  frame(nowMs: number, sample: (world: World, car: Car) => Controls) {
    if (this.queue.length) {
      const all = this.queue;
      this.queue = [];
      for (const s of all) for (const e of s.ev) if (!isMine(e, this.myId)) this.events.push(e);
      this.reconcile(all[all.length - 1], nowMs);
    }
    if (!this.ready) return;
    const target = Math.floor(this.serverTick(nowMs) + this.lead);
    if (target - this.world.tick > 90) {
      // il telefono si è fermato (app in pausa): si aspetta la prossima foto per ripartire da lì
      this.ready = false;
      return;
    }
    let steps = 0;
    while (this.world.tick < target && steps < 16) {
      this.stepForward(sample);
      steps++;
    }
    // i comandi partono solo se ho una macchina (chi guarda e basta non manda niente)
    if (steps && this.world.tick - this.lastSendTick >= 4 && this.world.car(this.myId)) this.sendInputs();
  }

  // un passo nuovo coi miei comandi
  private stepForward(sample: (world: World, car: Car) => Controls) {
    const w = this.world;
    const car = w.car(this.myId);
    const c = car && !car.demoed ? sample(w, car) : noControls();
    this.history.set(w.tick, c);
    w.step((id) => (id === this.myId ? c : undefined));
    for (const e of w.events) if (isMine(e, this.myId)) this.events.push(e);
    this.history.delete(w.tick - 4 * TICK_RATE);
  }

  // i comandi degli ultimi 8 passi (ripetuti: se un pacchetto si perde, arriva col prossimo)
  private sendInputs() {
    const end = this.world.tick;
    const start = Math.max(end - 8, 0);
    const c: number[][] = [];
    for (let t = start; t < end; t++) c.push(encodeControls(this.history.get(t) ?? noControls()));
    this.send({ t: start, c });
    this.lastSendTick = end;
  }

  private reconcile(s: FastSnapshot, nowMs: number) {
    // orologio: la foto meno in ritardo dà la stima migliore (si sale subito, si scende piano).
    // Se il server risulta indietro di molto (partenza in attesa, server che ha saltato avanti o si è fermato) si riparte da lì.
    const cand = s.t - nowMs * (TICK_RATE / 1000);
    if (!Number.isFinite(this.tickOffset) || cand > this.tickOffset || cand < this.tickOffset - 30) this.tickOffset = cand;
    else this.tickOffset += (cand - this.tickOffset) * 0.02;
    // anticipo: i miei comandi devono arrivare almeno ~2 passi prima che il server li usi, anche nei momenti peggiori
    // (si guarda il margine più basso dell'ultimo secondo: così gli sbalzi della rete non fanno arrivare comandi in ritardo)
    const m = s.m[this.myId];
    if (Number.isFinite(m) && m > -1e5) {
      this.margin = m;
      // ritardo effettivo (in passi) = anticipo − margine: dipende solo dalla rete, non dall'anticipo scelto
      this.delays.push(this.lead - m);
      if (this.delays.length > 45) this.delays.shift();
      const want = Math.max(...this.delays) + 2;
      const d = want - this.lead;
      this.lead = Math.max(2, Math.min(60, this.lead + (d > 0 ? Math.min(1, d * 0.3) : Math.max(-0.15, d * 0.05))));
    }
    this.score = [s.sc[0], s.sc[1]];
    if (s.st) this.stats = unpackStats(s.st);

    const w = this.world;
    // posizioni disegnate prima della correzione
    const before = new Map<string, V3>();
    for (const c of w.cars) before.set(c.id, c.pos.clone().add(this.offsets.get(c.id) ?? new V3()));
    before.set('ball', w.ball.pos.clone().add(this.offsets.get('ball') ?? new V3()));
    const predicted = this.ready ? w.tick : -1;

    w.load(s);
    if (predicted > s.t) {
      // si rifanno i passi già previsti coi miei comandi (gli altri ripetono il loro ultimo comando)
      while (w.tick < predicted) {
        const c = this.history.get(w.tick);
        w.step((id) => (id === this.myId ? c : undefined));
      }
    }
    this.ready = true;
    // la differenza diventa una correzione che si smorza (se è troppo grande, si salta: ripartenze, demolizioni)
    for (const [id, old] of before) {
      const now = id === 'ball' ? w.ball.pos : w.car(id)?.pos;
      if (!now) continue;
      const d = old.sub(now);
      if (d.len() > 400) this.offsets.delete(id);
      else this.offsets.set(id, d);
    }
  }

  // da chiamare a ogni fotogramma dalla grafica: le correzioni tornano a zero in un decimo di secondo circa
  decayOffsets(dt: number) {
    const k = Math.exp(-dt * 12);
    for (const [id, o] of this.offsets) {
      o.scale(k);
      if (o.len2() < 0.01) this.offsets.delete(id);
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
