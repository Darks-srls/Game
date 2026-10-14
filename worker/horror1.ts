// "Non lasciarmi solo": il server decide porte, oggetti, interventi, stabilità dell'edificio e il Custode.
// Le posizioni dei giocatori arrivano dal livello 3D in tempo reale (P3_MOVE, ~15 al secondo); il Custode viaggia
// come posizione 'custode'. Il Custode reagisce ai rumori del lavoro (mai al microfono), avvisa con due colpi
// metallici, bussa tre volte prima di aprire una porta, non attraversa i muri e dopo un colpo si ritira.
import type { GameId, Horror1View } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import {
  BATTERY_SPOTS,
  CUSTODE,
  DYN_EFFECT,
  DYN_PROPS,
  DOORS,
  HIDES,
  FLOOR_NAMES,
  HOLD,
  MODULE_SPOTS,
  NOISE,
  STATIONS,
  USE_RANGE,
  findPath,
  floorBase,
  floorHeight,
  groundAt,
  lineOfSight,
  nodeAt,
  roomAt,
  type ItemKind,
  type Node3,
  type StationDef,
} from '../src/data/horror1';

type PState = 'ok' | 'ferito' | 'intrappolato' | 'evacuato' | 'estratto' | 'uscito';
interface HPlayer {
  state: PState;
  wounds: number;
  woundAt: number;
  rescues: number; // quante volte è già stato soccorso
  protectUntil: number;
  evacAt: number | null; // evacuazione assistita in corso (fine)
  carrying: string | null;
  runNoiseAt: number;
  helped: number; // compagni liberati
  offSince?: number; // da quando non è collegato (un minuto per rientrare)
  how: string; // come è finita (per il resoconto)
  lostState?: PState; // com'era prima di perdere la connessione (per rientrare)
  hidden?: string | null; // dentro un nascondiglio (armadio, armadietto)
  hideAt?: number;
  breathAt?: number; // ultimo respiro trattenuto male (dentro il nascondiglio)
  voiceAt?: number; // ultima voce alta sentita dal Custode
  trap?: { code: string; revealed: number; self: number; lotAt: number } | null; // incatenato: combinazione del lucchetto
}
interface Hold {
  st: string; // postazione, porta o compagno
  kind: string;
  last: number; // ultimo segnale dal telefono
  p?: number; // lavori interattivi: avanzamento dichiarato dal minigioco (0..1)
}
type Mode1 = 'dorme' | 'mostra' | 'ronda' | 'indaga' | 'caccia' | 'cerca' | 'ritira';
interface Custode {
  mode: Mode1;
  f: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  path: Node3[];
  pathI: number;
  goal: Node3 | null;
  lair: Node3;
  until: number;
  lastContact: number;
  lastNoise: number;
  victim: string | null;
  seenAt: Record<string, number>; // da quando vede ciascuno (vicinanza prolungata)
  lastSeen: { f: number; x: number; z: number } | null;
  windupAt: number;
  knock: { door: string; until: number } | null;
  signalAt: number;
  calmUntil: number; // pausa dopo un colpo: niente nuove cacce
  anim: number;
  shown: boolean;
  showAt: number; // secondi di gioco della prima apparizione (innocua)
  repathAt: number;
  dash?: boolean; // apparizione: lo scatto finale verso chi guarda
  dashTo?: { x: number; z: number } | null;
}
interface S1 {
  humans: string[];
  stage: Horror1View['stage'];
  startAt: number;
  briefEnds: number;
  evacEnds: number | null;
  pressure: number; // 0 tranquilla, 1 normale, 2 alta
  players: Record<string, HPlayer>;
  doors: Record<string, { open: boolean; blocked: boolean; lock: '' | 'acqua' | 'test' }>;
  fermi: number;
  items: Record<string, { kind: ItemKind; f: number; x: number; y: number; z: number; by: string | null; clean: boolean }>;
  holds: Record<string, Hold>;
  prog: Record<string, number>; // avanzamento di ogni lavoro (0..1)
  modulo: boolean; // modulo luci montato nel quadro
  luce: 'spenta' | 'test' | 'ok';
  luceTestUntil: number;
  filtro: 'sporco' | 'fuori' | 'montato';
  pompaOn: boolean;
  acqua: number; // 1 = lavanderia allagata, 0 = asciutta
  batteria: boolean;
  collaudo: { a: boolean; b: boolean; until: number; done: boolean; codeA: string; codeB: string };
  blink: number; // test luci: quante volte lampeggia la lampada di prova (va impostato sul quadro)
  names: Record<string, string>;
  guastoAt: number;
  stability: number;
  log: { t: number; text: string; kind: 'info' | 'warn' | 'ok' | 'danger' }[];
  leak: { st: string; until: number } | null;
  nextLeakAt: number;
  atmoAt: number;
  chairRot: number;
  custode: Custode;
  noises: { f: number; x: number; z: number; r: number; at: number; what: string }[];
  causes: string[]; // conseguenze osservabili (per il resoconto)
  spawns: Record<string, { x: number; y: number; z: number }>;
  hunt: { phase: 'avviso' | 'attiva'; until: number; target: string } | null;
  deadline: number; // fine del turno di notte: poi si evacua
  found: string[]; // oggetti già visti da qualcuno (compaiono sulla pianta)
  huntAt: number;
  burst: string[]; // lampadine scoppiate (punto vicino: la lampada accesa più vicina)
  moved: Record<string, { k: string; seed: number; at: number }>; // oggetti spostati dal palazzo
  polterAt: number;
  lastPolter: string;
  result: Horror1View['result'];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
// Lavori interattivi: l'avanzamento lo dà il minigioco sul telefono (girare, strofinare, collegare…)
const isMini = (s: S1, st: StationDef) => ['filtro', 'lavello', 'pompa', 'alloggio', 'valvola'].includes(st.kind) || (st.kind === 'pannello' && !s.modulo);
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const station = (id: string) => STATIONS.find((s) => s.id === id)!;
const ACTIVE: PState[] = ['ok', 'ferito'];
const PRESS = [
  { speed: 0.86, rest: 1.4, ear: 0.8, leak: 1.4 },
  { speed: 1, rest: 1, ear: 1, leak: 1 },
  { speed: 1.12, rest: 0.7, ear: 1.2, leak: 0.75 },
];

// Lavoro più facile da svolgere in due: chi osserva il livello accelera il riavvio della pompa
const COOP: Record<string, string> = { pompa: 'livello' };

function addLog(s: S1, ctx: Ctx, text: string, kind: S1['log'][number]['kind'] = 'info') {
  s.log.push({ t: ctx.now, text, kind });
  if (s.log.length > 30) s.log.shift();
  ctx.emit('P3_FX', { k: 'log', text, kind });
}

// Dove si trova un giocatore (dalla posizione in tempo reale)
function where(ctx: Ctx, id: string) {
  const p = ctx.p3get(id);
  if (!p) return null;
  const g = groundAt(p.x, p.z, p.y + 0.15);
  const flags = p.a | 0;
  return { x: p.x, y: p.y, z: p.z, f: g?.f ?? 1, run: !!(flags & 16), crouch: !!(flags & 32), torch: !!(flags & 64) };
}
const near3 = (a: { f: number; x: number; y: number; z: number }, s: { f: number; x: number; y: number; z: number }, r: number) => Math.hypot(a.x - s.x, a.z - s.z) <= r && Math.abs(a.y - s.y) < 2.4;
const stationPos = (st: StationDef) => ({ f: st.f, x: st.x, y: floorBase(st.f) + 0.1, z: st.z });

function noise(s: S1, f: number, x: number, z: number, r: number, what: string, ctx: Ctx) {
  s.noises.push({ f, x, z, r: r * PRESS[s.pressure].ear, at: ctx.now, what });
  if (s.noises.length > 20) s.noises.shift();
}

// ---------------------------------------------------------------- il Custode

const LAIRS: Node3[] = [
  { f: 0, c: 14, r: 17 }, // vano impianti
  { f: 3, c: 23, r: 6 }, // corridoio tecnico
  { f: 1, c: 13, r: 17 }, // locale caldaia
];
// Dove gira di ronda: spazi dei lavoratori e scale
const PATROL: Node3[] = [
  { f: 0, c: 9, r: 14 },
  { f: 0, c: 19, r: 11 },
  { f: 0, c: 16, r: 7 },
  { f: 1, c: 21, r: 9 },
  { f: 1, c: 9, r: 13 },
  { f: 1, c: 16, r: 14 },
  { f: 3, c: 20, r: 10 },
  { f: 3, c: 16, r: 7 },
  { f: 2, c: 9, r: 14 },
  { f: 0, c: 4, r: 12 },
];

function newCustode(): Custode {
  const lair = pick(LAIRS);
  return {
    mode: 'dorme',
    f: lair.f,
    x: lair.c + 0.5,
    y: floorBase(lair.f),
    z: lair.r + 0.5,
    yaw: 0,
    path: [],
    pathI: 0,
    goal: null,
    lair,
    until: 0,
    lastContact: 0,
    lastNoise: 0,
    victim: null,
    seenAt: {},
    lastSeen: null,
    windupAt: 0,
    knock: null,
    signalAt: 0,
    calmUntil: 0,
    anim: 9,
    shown: false,
    showAt: rand(40, 70),
    repathAt: 0,
  };
}

// Il Custode passa dalle porte aperte; quelle chiuse le apre dopo aver bussato (mai quelle con il lucchetto)
function custodePath(s: S1, to: Node3) {
  const C = s.custode;
  return findPath(nodeAt(C.f, C.x, C.z), to, (id) => !s.doors[id]?.lock && id !== 't-portone', 6000);
}
function setGoal(s: S1, to: Node3) {
  const C = s.custode;
  const p = custodePath(s, to);
  C.goal = to;
  C.path = p ?? [];
  C.pathI = 1;
}
function signal(s: S1, ctx: Ctx, force = false) {
  const C = s.custode;
  if (!force && ctx.now < C.signalAt) return;
  C.signalAt = ctx.now + 11000;
  // due colpi metallici: si sentono nel punto in cui si trova (e il tablet lo scrive per chi non sente)
  ctx.emit('P3_FX', { k: 'colpi', f: C.f, x: C.x, y: C.y, z: C.z, zone: FLOOR_NAMES[C.f] });
}

function custodeTick(s: S1, ctx: Ctx, dt: number) {
  const C = s.custode;
  const now = ctx.now;
  const P = PRESS[s.pressure];
  const play = s.stage === 'PLAY' || s.stage === 'EVAC';
  if (!play) return;
  const since = (now - s.startAt) / 1000;
  const players = s.humans
    .filter((id) => ACTIVE.includes(s.players[id].state) && now >= s.players[id].protectUntil && !s.players[id].offSince)
    .map((id) => ({ id, p: where(ctx, id) }))
    .filter((o): o is { id: string; p: NonNullable<ReturnType<typeof where>> } => !!o.p);

  // ---- manifestazione anticipata: si fa vedere lontano, senza fare niente (dopo 1:40–2:40)
  if (!C.shown && C.mode === 'dorme' && since > C.showAt && players.length) {
    for (const o of players) {
      // un punto in fondo a un corridoio che il giocatore vede, a 8-14 metri
      for (let tries = 0; tries < 40; tries++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(8, 14);
        const x = o.p.x + Math.sin(a) * d;
        const z = o.p.z + Math.cos(a) * d;
        const h = floorHeight(o.p.f, x, z);
        if (h === null || Math.abs(h - o.p.y) > 0.3 || !lineOfSight(o.p.f, o.p.x, o.p.z, x, z, openSet(s))) continue;
        C.shown = true;
        C.mode = 'mostra';
        C.f = o.p.f;
        C.x = x;
        C.z = z;
        C.y = h;
        C.yaw = Math.atan2(o.p.x - x, o.p.z - z);
        C.until = now + 4600;
        C.anim = 0;
        C.dash = false;
        C.dashTo = { x: o.p.x, z: o.p.z };
        ctx.emit('P3_FX', { k: 'apparizione', f: C.f, x, y: h, z, to: o.id });
        break;
      }
      if (C.shown) break;
    }
  }
  if (C.mode === 'mostra') {
    // ti fissa, piega la testa… poi scatta verso di te per un paio di metri e sparisce
    if (!C.dash && now >= C.until - 1100) {
      C.dash = true;
      C.anim = 2;
      ctx.emit('P3_FX', { k: 'scatto', f: C.f, x: C.x, y: C.y, z: C.z });
    }
    if (C.dash && C.dashTo) {
      const dx = C.dashTo.x - C.x;
      const dz = C.dashTo.z - C.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.2) {
        const k = Math.min(1, (7.5 * dt) / d);
        C.x += dx * k;
        C.z += dz * k;
      }
    }
    if (now >= C.until) {
      ctx.emit('P3_FX', { k: 'svanisce', f: C.f, x: C.x, y: C.y, z: C.z });
      C.dash = false;
      // sparisce e torna nella tana
      C.mode = 'dorme';
      C.f = C.lair.f;
      C.x = C.lair.c + 0.5;
      C.z = C.lair.r + 0.5;
      C.y = floorBase(C.lair.f);
      C.until = now + rand(25000, 40000) * P.rest;
      C.anim = 9;
    }
    publish(s, ctx);
    return;
  }

  // ---- la caccia (come un fantasma): prima l'avviso (luci impazzite, colpi), poi viene a cercare qualcuno
  if (!s.hunt && now >= s.huntAt && since > 110 && now >= C.calmUntil && C.mode !== 'caccia' && players.length) {
    const t = pick(players);
    s.hunt = { phase: 'avviso', until: now + 4500, target: t.id };
    ctx.emit('P3_FX', { k: 'caccia_inizio', f: t.p.f, x: t.p.x, y: t.p.y, z: t.p.z });
  }
  if (s.hunt?.phase === 'avviso' && now >= s.hunt.until) {
    const tp = where(ctx, s.hunt.target);
    if (!tp || !ACTIVE.includes(s.players[s.hunt.target]?.state)) s.hunt = null;
    else {
      // compare fuori vista, a qualche stanza di distanza
      const open = openSet(s);
      let spot: Node3 | null = null;
      for (let tries = 0; tries < 80 && !spot; tries++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(9, 15);
        const n = nodeAt(tp.f, tp.x + Math.sin(a) * d, tp.z + Math.cos(a) * d);
        const h = floorHeight(n.f, n.c + 0.5, n.r + 0.5);
        if (h === null || h !== floorBase(n.f)) continue;
        if (lineOfSight(n.f, n.c + 0.5, n.r + 0.5, tp.x, tp.z, open)) continue;
        const path = findPath(n, nodeAt(tp.f, tp.x, tp.z), (id) => !s.doors[id]?.lock && id !== 't-portone', 3000); // mai nel cortile: da lì non rientra
        if (path && path.length > 7 && path.length < 26) spot = n;
      }
      if (spot) {
        C.f = spot.f;
        C.x = spot.c + 0.5;
        C.z = spot.r + 0.5;
        C.y = floorBase(spot.f);
        C.mode = 'indaga';
        C.lastNoise = now;
        C.anim = 1;
        setGoal(s, nodeAt(tp.f, tp.x, tp.z));
        signal(s, ctx, true);
        s.hunt = { phase: 'attiva', until: now + 32000, target: s.hunt.target };
      } else s.hunt = null;
    }
  }
  if (s.hunt?.phase === 'attiva') {
    // sente dov'è la squadra (si aggiorna ogni tanto, non di continuo)
    const tp = where(ctx, s.hunt.target);
    if (C.mode === 'indaga' && tp && now - C.lastNoise > 3500) {
      C.lastNoise = now;
      setGoal(s, nodeAt(tp.f, tp.x + rand(-2, 2), tp.z + rand(-2, 2)));
    }
    if (now >= s.hunt.until && C.mode !== 'caccia') {
      s.hunt = null;
      s.huntAt = now + rand(120000, 190000) * P.rest;
      ctx.emit('P3_FX', { k: 'svanisce', f: C.f, x: C.x, y: C.y, z: C.z });
      C.mode = 'dorme';
      C.until = now + rand(CUSTODE.rest[0], CUSTODE.rest[1]) * P.rest;
      C.f = C.lair.f;
      C.x = C.lair.c + 0.5;
      C.z = C.lair.r + 0.5;
      C.y = floorBase(C.lair.f);
      C.path = [];
      C.anim = 9;
      publish(s, ctx);
      return;
    }
  }

  // ---- rumori: il più forte sentito di recente (dopo la pausa iniziale)
  const heard = s.noises
    .filter((n) => now - n.at < 1500)
    .map((n) => ({ n, d: Math.hypot(n.x - C.x, n.z - C.z) + Math.abs(n.f - C.f) * 7 }))
    .filter((o) => o.d < o.n.r)
    .sort((a, b) => a.d - b.d)[0];
  s.noises = s.noises.filter((n) => now - n.at < 1500);
  // prima della prima caccia c'è sempre un'apparizione innocua (o comunque un po' di tempo per ambientarsi)
  const awake = since > 55 && (C.shown || since > 100) && now >= C.calmUntil;
  if (heard && awake && C.mode !== 'caccia') {
    const first = C.mode === 'dorme' || C.mode === 'ronda' || C.mode === 'ritira';
    C.lastNoise = now;
    C.mode = 'indaga';
    C.anim = 1;
    if (first || !C.goal || Math.hypot(C.goal.c - heard.n.x, C.goal.r - heard.n.z) > 2) setGoal(s, nodeAt(heard.n.f, heard.n.x, heard.n.z));
    if (first) {
      signal(s, ctx, true);
      if (!s.causes.includes(heard.n.what)) s.causes.push(heard.n.what);
    }
  }

  // ---- vista: chi è vicino o illuminato davanti a lui
  if (C.mode !== 'dorme' && C.mode !== 'ritira' && awake) {
    const open = openSet(s);
    let best: { id: string; d: number } | null = null;
    for (const o of players) {
      const hid = s.players[o.id].hidden;
      if (hid) {
        // l'ha visto entrare: va ad aprire proprio quell'anta
        const sawIt = C.mode === 'caccia' && C.victim === o.id && now - C.lastContact < 1800 && now - (s.players[o.id].hideAt ?? 0) < 1800;
        if (!sawIt) {
          delete C.seenAt[o.id];
          continue;
        }
      }
      const sameFloor = o.p.f === C.f && Math.abs(o.p.y - C.y) < 2;
      const d = Math.hypot(o.p.x - C.x, o.p.z - C.z);
      let sees = false;
      if (sameFloor && lineOfSight(C.f, C.x, C.z, o.p.x, o.p.z, open)) {
        const range = (o.p.torch ? CUSTODE.sight : CUSTODE.sight * 0.6) * (o.p.crouch ? 0.6 : 1);
        const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(o.p.x - C.x, o.p.z - C.z) - C.yaw), Math.cos(Math.atan2(o.p.x - C.x, o.p.z - C.z) - C.yaw)));
        if (d < range && (ang < 1.1 || d < 5)) sees = true;
      }
      // vicinanza prolungata (anche senza vedere bene)
      if (sameFloor && d < CUSTODE.near) {
        C.seenAt[o.id] ??= now;
        if (now - C.seenAt[o.id] > 1500) sees = true;
      } else delete C.seenAt[o.id];
      if (sees && (!best || d < best.d)) best = { id: o.id, d };
    }
    if (best) {
      if (C.mode !== 'caccia') {
        ctx.emit('P3_FX', { k: 'caccia', id: best.id, f: C.f, x: C.x, y: C.y, z: C.z });
        signal(s, ctx, true);
      }
      C.mode = 'caccia';
      C.victim = best.id;
      C.lastContact = now;
      const vp = where(ctx, best.id)!;
      C.lastSeen = { f: vp.f, x: vp.x, z: vp.z };
    }
  }

  // ---- nascondigli: se è davanti all'anta e da dentro si è sentito respirare, la apre
  if (C.mode === 'indaga' || C.mode === 'cerca' || C.mode === 'ronda') {
    for (const o of players) {
      const pl = s.players[o.id];
      const h = pl.hidden ? HIDES.find((x) => x.id === pl.hidden) : null;
      if (!h || h.f !== C.f) continue;
      if (Math.hypot(h.ex - C.x, h.ez - C.z) < 1.4 && now - (pl.breathAt ?? 0) < 6000) {
        pl.hidden = null;
        ctx.emit('P3_FX', { k: 'scovato', id: o.id, hide: h.id, x: h.ex, y: floorBase(h.f), z: h.ez });
        ctx.emit('P3_FX', { k: 'sposta', id: o.id, f: h.f, x: h.ex, y: floorBase(h.f), z: h.ez });
        hitPlayer(s, ctx, o.id);
        return;
      }
    }
  }

  // ---- decisioni di ogni stato
  if (C.mode === 'dorme') {
    C.anim = 9;
    if (now >= C.until && since > 100 && now >= C.calmUntil) {
      C.mode = 'ronda';
      C.f = C.lair.f;
      C.x = C.lair.c + 0.5;
      C.z = C.lair.r + 0.5;
      C.y = floorBase(C.lair.f);
      C.until = now + rand(40000, 70000);
      setGoal(s, pick(PATROL));
      signal(s, ctx, true);
    }
  } else if (C.mode === 'ronda') {
    C.anim = 1;
    if (!C.path.length || C.pathI >= C.path.length) setGoal(s, pick(PATROL));
    if (now >= C.until) {
      C.mode = 'ritira';
      setGoal(s, C.lair);
    }
  } else if (C.mode === 'indaga') {
    C.anim = 1;
    if (now - C.lastNoise > 6000) signal(s, ctx);
    if (C.pathI >= C.path.length) {
      // arrivato dove ha sentito il rumore: cerca lì intorno
      C.mode = 'cerca';
      C.until = now + CUSTODE.giveUp;
      C.lastSeen = { f: C.f, x: C.x, z: C.z };
    }
  } else if (C.mode === 'caccia') {
    C.anim = 2;
    const vid = C.victim!;
    const vp = where(ctx, vid);
    const vok = vp && ACTIVE.includes(s.players[vid]?.state) && now >= s.players[vid].protectUntil;
    if (!vok || now - C.lastContact > 2500) {
      C.mode = 'cerca';
      C.until = now + CUSTODE.giveUp;
      C.windupAt = 0;
      if (C.lastSeen) setGoal(s, nodeAt(C.lastSeen.f, C.lastSeen.x, C.lastSeen.z));
    } else {
      if (now >= C.repathAt) {
        C.repathAt = now + 450;
        setGoal(s, nodeAt(vp.f, vp.x, vp.z));
      }
      const d = Math.hypot(vp.x - C.x, vp.z - C.z);
      const reachable = vp.f === C.f && Math.abs(vp.y - C.y) < 1.6 && lineOfSight(C.f, C.x, C.z, vp.x, vp.z, openSet(s));
      if (!C.windupAt && d < CUSTODE.reach && reachable) {
        C.windupAt = now + CUSTODE.windup;
        ctx.emit('P3_FX', { k: 'alza', id: vid });
      }
      if (C.windupAt) {
        C.anim = 4;
        if (now >= C.windupAt) {
          C.windupAt = 0;
          if (d < CUSTODE.reach + 0.55 && reachable) {
            if (s.players[vid].hidden) {
              const h = HIDES.find((x) => x.id === s.players[vid].hidden);
              s.players[vid].hidden = null;
              if (h) ctx.emit('P3_FX', { k: 'scovato', id: vid, hide: h.id, x: h.ex, y: floorBase(h.f), z: h.ez });
            }
            hitPlayer(s, ctx, vid);
          }
          else C.anim = 2;
        }
      }
    }
  } else if (C.mode === 'cerca') {
    C.anim = 1;
    if (C.pathI >= C.path.length && C.lastSeen) {
      // gira intorno all'ultimo punto
      const a = rand(0, Math.PI * 2);
      const n = nodeAt(C.lastSeen.f, C.lastSeen.x + Math.sin(a) * rand(2, 6), C.lastSeen.z + Math.cos(a) * rand(2, 6));
      if (floorHeight(n.f, n.c + 0.5, n.r + 0.5) !== null) setGoal(s, n);
    }
    if (now >= C.until && now - C.lastNoise > CUSTODE.giveUp) {
      C.mode = 'ritira';
      setGoal(s, C.lair);
    }
  } else if (C.mode === 'ritira') {
    C.anim = 1;
    if (C.pathI >= C.path.length) {
      C.mode = 'dorme';
      C.until = now + rand(CUSTODE.rest[0], CUSTODE.rest[1]) * P.rest;
      C.anim = 9;
    }
  }

  // ---- cammina lungo il percorso (le porte chiuse le apre dopo aver bussato)
  if (C.mode !== 'dorme' && !C.windupAt && C.path.length && C.pathI < C.path.length) {
    const next = C.path[C.pathI];
    const prev = C.path[C.pathI - 1] ?? nodeAt(C.f, C.x, C.z);
    const door = doorBetween(prev, next);
    if (door && !s.doors[door].open) {
      if (!C.knock || C.knock.door !== door) {
        C.knock = { door, until: now + (s.doors[door].blocked ? CUSTODE.knockWaitBlocked : CUSTODE.knockWait) };
        ctx.emit('P3_FX', { k: 'bussa', door });
      }
      C.anim = 3;
      if (now >= C.knock.until) {
        s.doors[door].open = true;
        s.doors[door].blocked = false;
        C.knock = null;
        ctx.emit('P3_FX', { k: 'sfonda', door });
      }
    } else {
      C.knock = null;
      const tx = next.c + 0.5;
      const tz = next.r + 0.5;
      const sp = (C.mode === 'caccia' ? CUSTODE.chase : C.mode === 'indaga' ? CUSTODE.hunt : CUSTODE.walk) * P.speed;
      const dx = tx - C.x;
      const dz = tz - C.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        C.pathI++;
        C.f = next.f;
      } else {
        const k = Math.min(1, (sp * dt) / d);
        C.x += dx * k;
        C.z += dz * k;
        let dy = Math.atan2(dx, dz) - C.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        C.yaw += dy * Math.min(1, dt * 6);
      }
      const g = floorHeight(C.f, C.x, C.z) ?? floorHeight(next.f, C.x, C.z);
      if (g !== null) C.y += (g - C.y) * Math.min(1, dt * 10);
    }
  }
  publish(s, ctx);
}
function publish(s: S1, ctx: Ctx) {
  const C = s.custode;
  ctx.p3set('custode', { x: C.x, y: C.y, z: C.z, r: C.yaw, a: C.anim });
}

function doorBetween(a: Node3, b: Node3): string | null {
  for (const d of DOORS) {
    if (d.f !== a.f && d.f !== b.f) continue;
    const [c2, r2] = d.side === 'N' ? [d.c, d.r - 1] : d.side === 'S' ? [d.c, d.r + 1] : d.side === 'W' ? [d.c - 1, d.r] : [d.c + 1, d.r];
    if ((a.c === d.c && a.r === d.r && b.c === c2 && b.r === r2) || (b.c === d.c && b.r === d.r && a.c === c2 && a.r === r2)) return d.id;
  }
  return null;
}
const openSet = (s: S1) => new Set(Object.entries(s.doors).filter(([, d]) => d.open).map(([id]) => id));

function hitPlayer(s: S1, ctx: Ctx, id: string) {
  const pl = s.players[id];
  const C = s.custode;
  C.anim = 5;
  if (pl.state === 'ok') {
    pl.state = 'ferito';
    pl.wounds = 1;
    pl.woundAt = ctx.now;
    ctx.emit('P3_FX', { k: 'colpo', id, grave: false, x: C.x, y: C.y, z: C.z });
    addLog(s, ctx, 'Un compagno è stato ferito', 'danger');
  } else {
    pl.state = 'intrappolato';
    pl.wounds = 2;
    pl.hidden = null;
    pl.trap = { code: digits(3), revealed: 0, self: 0, lotAt: 0 };
    const why = 'Il Custode ha colpito due volte la stessa persona (un ferito va protetto o portato fuori)';
    if (!s.causes.includes(why)) s.causes.unshift(why);
    ctx.emit('P3_FX', { k: 'colpo', id, grave: true, x: C.x, y: C.y, z: C.z });
    // trascinato in una stanza vicina
    const p = where(ctx, id);
    if (p) {
      const here = roomAt(p.f, p.x, p.z)?.id;
      let spot: { x: number; z: number } | null = null;
      for (let tries = 0; tries < 60 && !spot; tries++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(2.5, 6);
        const x = Math.floor(p.x + Math.sin(a) * d) + 0.5;
        const z = Math.floor(p.z + Math.cos(a) * d) + 0.5;
        const rm = roomAt(p.f, x, z);
        if (rm && rm.id !== here && rm.zone !== 'scale' && rm.zone !== 'esterno' && floorHeight(p.f, x, z) === floorBase(p.f) && findPath(nodeAt(p.f, p.x, p.z), nodeAt(p.f, x, z), () => true, 800)) spot = { x, z };
      }
      if (spot) ctx.emit('P3_FX', { k: 'sposta', id, f: p.f, x: spot.x, y: floorBase(p.f), z: spot.z });
    }
    addLog(s, ctx, `${s.names[id] ?? 'Un compagno'} è incatenato: il lucchetto ha una combinazione che vede solo lui`, 'danger');
    if (pl.carrying) dropItem(s, ctx, id);
  }
  if (pl.carrying && s.items[pl.carrying]?.kind === 'batteria') dropItem(s, ctx, id);
  // poi sparisce (torna nella sua tana): c'è tempo per riorganizzarsi
  ctx.emit('P3_FX', { k: 'svanisce', f: C.f, x: C.x, y: C.y, z: C.z });
  C.mode = 'dorme';
  C.victim = null;
  C.calmUntil = ctx.now + CUSTODE.after;
  C.until = ctx.now + rand(CUSTODE.rest[0], CUSTODE.rest[1]) * PRESS[s.pressure].rest;
  C.f = C.lair.f;
  C.x = C.lair.c + 0.5;
  C.z = C.lair.r + 0.5;
  C.y = floorBase(C.lair.f);
  C.path = [];
  C.anim = 9;
  s.hunt = null;
  s.huntAt = ctx.now + rand(110000, 170000) * PRESS[s.pressure].rest;
  for (const h of Object.keys(s.holds)) if (h === id) delete s.holds[h];
}

// ---------------------------------------------------------------- oggetti e lavori

function dropItem(s: S1, ctx: Ctx, id: string) {
  const pl = s.players[id];
  const it = pl.carrying ? s.items[pl.carrying] : null;
  if (!it) return false;
  const p = where(ctx, id);
  it.by = null;
  if (p) {
    it.f = p.f;
    it.x = p.x;
    it.z = p.z;
    it.y = p.y;
  }
  pl.carrying = null;
  if (p) noise(s, p.f, p.x, p.z, NOISE.caduta, 'Un oggetto caduto ha fatto rumore', ctx);
  ctx.emit('P3_FX', { k: 'appoggia', id, item: it.kind });
  return true;
}

// Si può lavorare a quella postazione adesso? (null = sì, altrimenti il motivo)
function stationBlock(s: S1, id: string, st: StationDef): string | null {
  const pl = s.players[id];
  const it = pl.carrying ? s.items[pl.carrying] : null;
  switch (st.kind) {
    case 'pannello':
      if (s.luce === 'ok') return 'Le luci funzionano già';
      if (!s.modulo && it?.kind !== 'modulo') return 'Serve il modulo luci';
      if (s.luce === 'test') return 'Test in corso: imposta sul quadro quante volte lampeggia la lampada di prova';
      return null;
    case 'lampada':
      return s.luce === 'test' ? 'Conta i lampeggi e dillo a chi è al quadro' : s.luce === 'ok' ? 'Luci già confermate' : 'Prima avvia il test dal quadro luci';
    case 'filtro':
      if (s.filtro === 'sporco') return null;
      if (s.filtro === 'fuori') return it?.kind === 'filtro' ? (it.clean ? null : 'Il filtro è ancora intasato: puliscilo al lavello') : 'Il filtro è stato tolto';
      return 'Filtro già montato';
    case 'lavello':
      return it?.kind === 'filtro' && !it.clean ? null : 'Qui si pulisce il filtro della pompa';
    case 'pompa':
      if (s.pompaOn) return 'La pompa è già in funzione';
      return s.filtro === 'montato' ? null : 'Prima rimonta il filtro pulito';
    case 'livello':
      return null;
    case 'alloggio':
      if (s.batteria) return 'Batteria già installata';
      return it?.kind === 'batteria' ? null : 'Serve la batteria di emergenza';
    case 'collaudo1':
    case 'collaudo2': {
      if (s.collaudo.done) return 'Collaudo completato';
      const missing = [s.luce !== 'ok' && 'luci', !s.pompaOn && 'pompa', !s.batteria && 'batteria'].filter(Boolean);
      if (missing.length) return `Prima: ${missing.join(', ')}`;
      if ((st.kind === 'collaudo1' && s.collaudo.a) || (st.kind === 'collaudo2' && s.collaudo.b)) return 'Questa parte è pronta: serve l’altra postazione';
      return 'Inserisci il codice che compare sull’altra postazione';
    }
    case 'valvola':
      return s.leak?.st === st.id ? null : 'Nessuna perdita qui';
    case 'portone':
      return null;
  }
  return null;
}
function holdTime(s: S1, kind: string, target: string) {
  if (kind === 'soccorso') return s.players[target]?.rescues ? HOLD.soccorso2 : HOLD.soccorso1;
  if (kind === 'blocca') return HOLD.blocca;
  if (kind === 'pannello') return s.modulo ? HOLD.pannello : 2;
  if (kind === 'filtro') return s.filtro === 'sporco' ? HOLD.filtroOut : HOLD.filtroIn;
  if (kind === 'collaudo1' || kind === 'collaudo2') return HOLD.collaudo;
  if (kind === 'portone' && s.players[target]?.state === 'ferito') return 6;
  return HOLD[kind] ?? 3;
}

function finishWork(s: S1, ctx: Ctx, id: string, st: StationDef) {
  const pl = s.players[id];
  const it = pl.carrying ? s.items[pl.carrying] : null;
  s.prog[st.id] = 0;
  switch (st.kind) {
    case 'pannello':
      if (!s.modulo) {
        s.modulo = true;
        if (it) delete s.items[pl.carrying!];
        pl.carrying = null;
        addLog(s, ctx, 'Modulo luci montato nel quadro: ora avvia il test', 'ok');
        return;
      }
      s.luce = 'test';
      s.blink = 2 + Math.floor(Math.random() * 6);
      s.luceTestUntil = ctx.now + 150000;
      addLog(s, ctx, 'Test luci avviato: contate i lampeggi della lampada di prova (secondo piano) e impostateli sul quadro', 'warn');
      ctx.emit('P3_FX', { k: 'testluci' });
      return;
    case 'lampada':
      s.luce = 'ok';
      stabilityUp(s, ctx);
      addLog(s, ctx, 'Luci del secondo piano ripristinate', 'ok');
      ctx.emit('P3_FX', { k: 'luci' });
      return;
    case 'filtro':
      if (s.filtro === 'sporco') {
        s.filtro = 'fuori';
        const iid = `filtro-${Math.floor(ctx.now % 100000)}`;
        s.items[iid] = { kind: 'filtro', f: st.f, x: st.x, y: floorBase(st.f), z: st.z, by: id, clean: false };
        if (pl.carrying) dropItem(s, ctx, id);
        pl.carrying = iid;
        addLog(s, ctx, 'Filtro estratto: è intasato, va pulito al lavello dell’officina');
      } else {
        s.filtro = 'montato';
        if (it) delete s.items[pl.carrying!];
        pl.carrying = null;
        addLog(s, ctx, 'Filtro pulito rimontato: si può riavviare la pompa', 'ok');
      }
      return;
    case 'lavello':
      if (it) it.clean = true;
      addLog(s, ctx, 'Filtro pulito', 'ok');
      return;
    case 'pompa':
      s.pompaOn = true;
      stabilityUp(s, ctx);
      addLog(s, ctx, 'Pompa riavviata: l’acqua della lavanderia scende', 'ok');
      ctx.emit('P3_FX', { k: 'pompa' });
      return;
    case 'alloggio':
      s.batteria = true;
      if (it) delete s.items[pl.carrying!];
      pl.carrying = null;
      stabilityUp(s, ctx);
      addLog(s, ctx, 'Batteria di emergenza installata', 'ok');
      return;
    case 'collaudo1':
    case 'collaudo2':
      if (st.kind === 'collaudo1') s.collaudo.a = true;
      else s.collaudo.b = true;
      if (s.collaudo.a && s.collaudo.b) {
        s.collaudo.done = true;
        s.doors['t-uscita'].lock = '';
        s.doors['t-uscita'].open = true;
        addLog(s, ctx, 'Collaudo riuscito: l’uscita di servizio è aperta. Uscite tutti!', 'ok');
        ctx.emit('P3_FX', { k: 'uscita' });
      } else {
        s.collaudo.until = ctx.now + 35000;
        addLog(s, ctx, `Prima parte del collaudo pronta: completate ${st.kind === 'collaudo1' ? 'la centralina del primo piano' : 'il quadro dell’uscita'} entro 35 secondi`, 'warn');
      }
      return;
    case 'valvola':
      s.leak = null;
      s.nextLeakAt = ctx.now + rand(150000, 240000) * PRESS[s.pressure].leak;
      addLog(s, ctx, 'Perdita riparata', 'ok');
      return;
    case 'portone':
      if (pl.state === 'ferito') {
        // nel furgone c'è la cassetta del pronto soccorso: si torna in forze
        pl.state = 'ok';
        pl.wounds = 0;
        addLog(s, ctx, `${s.names[id] ?? 'Un compagno'} si è medicato nel furgone`, 'ok');
        ctx.emit('P3_FX', { k: 'medicato', id });
        return;
      }
      pl.state = 'estratto';
      pl.how = 'si è ritirato nel furgone';
      if (pl.carrying) dropItem(s, ctx, id);
      addLog(s, ctx, 'Un compagno si è ritirato nel furgone');
      ctx.emit('P3_FX', { k: 'estratto', id });
      return;
  }
}
function stabilityUp(s: S1, ctx: Ctx) {
  if (s.stability > 0 && s.stage === 'PLAY') {
    s.stability--;
    ctx.emit('P3_FX', { k: 'stabile', v: s.stability });
  }
}
function stabilityDown(s: S1, ctx: Ctx, why: string) {
  s.stability = Math.min(3, s.stability + 1);
  addLog(s, ctx, `${why}: l’edificio è ${['operativo', 'in sovraccarico', 'instabile', 'in evacuazione'][s.stability]}`, 'danger');
  if (!s.causes.includes(why)) s.causes.push(why);
  ctx.emit('P3_FX', { k: 'stabile', v: s.stability });
  if (s.stability >= 3 && s.stage === 'PLAY') {
    s.stage = 'EVAC';
    s.evacEnds = ctx.now + 90000;
    addLog(s, ctx, 'EVACUAZIONE: 90 secondi per tornare al furgone', 'danger');
    ctx.emit('P3_FX', { k: 'evacuazione' });
  }
}

// ---------------------------------------------------------------- il gioco

function tickGame(s: S1, ctx: Ctx, dt: number): boolean {
  const now = ctx.now;
  let changed = false;
  if (s.stage === 'BRIEF') {
    if (now >= s.briefEnds) {
      s.stage = 'PLAY';
      s.startAt = now;
      s.deadline = now + [30, 25, 20][s.pressure] * 60000;
      addLog(s, ctx, 'Contratto «Il piano spento»: luci del secondo piano, pompa della cantina, batteria e collaudo dell’uscita di servizio', 'info');
      changed = true;
    }
    return changed;
  }
  if (s.stage === 'END') return false;
  // chi è uscito dall'app non conta più
  for (const id of s.humans) {
    const pl = s.players[id];
    // connessione persa: c'è un minuto per rientrare (ricaricare la pagina, il telefono che cambia rete)
    if (!ctx.isOnline(id)) pl.offSince ??= now;
    else delete pl.offSince;
    // (telefono bloccato, app in background): 3 minuti di tempo, e chi rientra dopo torna comunque in gioco
    if (pl.offSince && now - pl.offSince > 180000 && ACTIVE.concat('intrappolato').includes(pl.state)) {
      pl.lostState = pl.state;
      pl.state = 'uscito';
      pl.how = 'ha perso la connessione';
      if (pl.carrying) dropItem(s, ctx, id);
      changed = true;
    }
    if (pl.state === 'uscito' && pl.how === 'ha perso la connessione' && !pl.offSince && (s.stage === 'PLAY' || s.stage === 'EVAC')) {
      pl.state = pl.lostState ?? 'ok';
      pl.how = '';
      pl.hidden = null;
      addLog(s, ctx, `${s.names[id] ?? 'Un compagno'} è rientrato`, 'ok');
      changed = true;
    }
    // la ferita passa dopo un po' senza altri colpi
    if (pl.state === 'ferito' && now - pl.woundAt > 100000 && now >= pl.protectUntil) {
      pl.state = 'ok';
      pl.wounds = 0;
      changed = true;
    }
    // evacuazione assistita: dopo l'attesa torna all'ingresso come osservatore
    if (pl.state === 'intrappolato' && pl.evacAt && now >= pl.evacAt) {
      pl.state = 'evacuato';
      pl.how = 'è stato evacuato';
      pl.evacAt = null;
      ctx.emit('P3_FX', { k: 'sposta', id, f: 1, x: 10, y: 0, z: -4 });
      addLog(s, ctx, 'Un compagno è stato evacuato al furgone');
      changed = true;
    }
    // corsa = rumore (piccolo)
    const p = where(ctx, id);
    if (p && p.run && ACTIVE.includes(pl.state) && now - pl.runNoiseAt > 900) {
      pl.runNoiseAt = now;
      noise(s, p.f, p.x, p.z, NOISE.corsa, 'Correre ha fatto rumore', ctx);
    }
    if (p && pl.carrying && s.items[pl.carrying]) {
      const it = s.items[pl.carrying];
      it.f = p.f;
      it.x = p.x;
      it.y = p.y;
      it.z = p.z;
    }
    // uscita di servizio aperta: chi ci arriva è fuori
    if (p && s.collaudo.done && ACTIVE.includes(pl.state) && p.f === 1 && p.x > 25.6 && p.z > 12.6 && p.z < 14.4) {
      pl.state = 'estratto';
      pl.how = 'è uscito dalla porta di servizio';
      if (pl.carrying) dropItem(s, ctx, id);
      ctx.emit('P3_FX', { k: 'estratto', id });
      changed = true;
    }
  }

  // ---- lavori in corso (tenendo premuto)
  const holding = new Set(Object.values(s.holds).map((h) => h.st));
  for (const [id, h] of Object.entries(s.holds)) {
    const pl = s.players[id];
    const p = where(ctx, id);
    if (!p || !ACTIVE.includes(pl.state) || now - h.last > 1600) {
      endHold(s, ctx, id, 'lasciato');
      changed = true;
      continue;
    }
    if (h.kind === 'soccorso') {
      const t = s.players[h.st];
      const tp = where(ctx, h.st);
      if (!t || t.state !== 'intrappolato' || !tp || !near3(p, tp, USE_RANGE + 0.6)) {
        endHold(s, ctx, id, 'lontano');
        changed = true;
        continue;
      }
      const key = `aiuto:${h.st}`;
      s.prog[key] = (s.prog[key] ?? 0) + dt / holdTime(s, 'soccorso', h.st);
      if (s.prog[key] >= 1) {
        s.prog[key] = 0;
        t.state = 'ferito';
        t.rescues++;
        t.woundAt = now;
        t.evacAt = null;
        t.protectUntil = now + 12000;
        addLog(s, ctx, 'Compagno liberato!', 'ok');
        pl.helped++;
        ctx.emit('P3_FX', { k: 'liberato', id: h.st, by: id });
        delete s.holds[id];
      }
      changed = true;
      continue;
    }
    if (h.kind === 'blocca') {
      const d = DOORS.find((x) => x.id === h.st)!;
      const st = s.doors[h.st];
      if (!st || st.open || !near3(p, { f: d.f, x: d.c + 0.5, y: floorBase(d.f), z: d.r + 0.5 }, USE_RANGE + 0.6)) {
        endHold(s, ctx, id, 'lontano');
        continue;
      }
      const key = `fermo:${h.st}`;
      s.prog[key] = (s.prog[key] ?? 0) + dt / HOLD.blocca;
      if (s.prog[key] >= 1) {
        s.prog[key] = 0;
        st.blocked = true;
        s.fermi--;
        ctx.emit('P3_FX', { k: 'fermo', door: h.st });
        delete s.holds[id];
      }
      changed = true;
      continue;
    }
    const st = station(h.st);
    if (!near3(p, stationPos(st), USE_RANGE + 0.6) || stationBlock(s, id, st)) {
      endHold(s, ctx, id, 'lontano');
      changed = true;
      continue;
    }
    if (st.kind === 'livello') continue; // osservare il livello non finisce mai: aiuta la pompa
    const mul = COOP[st.kind] && holding.has(COOP[st.kind]) ? 1.6 : st.kind.startsWith('collaudo') && holding.has('collaudo1') && holding.has('collaudo2') ? 1.5 : 1;
    const prev = s.prog[st.id] ?? 0;
    // i minigiochi dicono a che punto sono (con un limite di velocità); gli altri lavori avanzano tenendo premuto
    const inc = isMini(s, st) ? Math.max(0, Math.min((h.p ?? 0) - prev, dt * 0.9)) : (dt / holdTime(s, st.kind, st.kind === 'portone' ? id : st.id)) * mul;
    s.prog[st.id] = Math.min(1, prev + inc);
    // i lavori rumorosi
    const nk = st.kind === 'pompa' ? 'pompa' : st.kind === 'pannello' && s.modulo ? 'pannello' : st.kind === 'filtro' ? 'filtro' : st.kind.startsWith('collaudo') ? 'collaudo' : st.kind === 'lavello' ? 'lavello' : st.kind === 'valvola' ? 'valvola' : null;
    if (nk && Math.floor(prev * 6) !== Math.floor(s.prog[st.id] * 6))
      noise(s, st.f, st.x, st.z, NOISE[nk as keyof typeof NOISE], nk === 'pompa' ? 'Il riavvio della pompa ha attirato la presenza' : nk === 'pannello' ? 'Il test del quadro luci ha fatto rumore' : 'Il lavoro ha fatto rumore', ctx);
    if (s.prog[st.id] >= 1) {
      delete s.holds[id];
      finishWork(s, ctx, id, st);
    }
    changed = true;
  }
  // il lavoro lasciato a metà si perde piano piano
  for (const k of Object.keys(s.prog)) if (!holding.has(k) && s.prog[k] > 0 && !k.includes(':')) s.prog[k] = Math.max(0, s.prog[k] - dt * 0.01);

  // ---- impianti
  if (s.luce === 'test' && now >= s.luceTestUntil) {
    s.luce = 'spenta';
    addLog(s, ctx, 'Test luci scaduto senza conferma: va ripetuto', 'warn');
    changed = true;
  }
  if (s.pompaOn && s.acqua > 0) {
    const was = s.acqua;
    s.acqua = Math.max(0, s.acqua - dt / 40);
    if (was >= 0.35 && s.acqua < 0.35) {
      s.doors['c-deposito'].lock = '';
      addLog(s, ctx, 'L’acqua è scesa: la porta del deposito si apre', 'ok');
      ctx.emit('P3_FX', { k: 'deposito' });
    }
    if (Math.floor(was * 20) !== Math.floor(s.acqua * 20)) changed = true;
  }
  if (s.collaudo.until && !s.collaudo.done && now >= s.collaudo.until && (s.collaudo.a !== s.collaudo.b)) {
    s.collaudo = { a: false, b: false, until: 0, done: false, codeA: digits(4), codeB: digits(4) };
    addLog(s, ctx, 'Collaudo non completato in tempo: va ripetuto da entrambe le postazioni (codici nuovi)', 'warn');
    changed = true;
  }
  // ---- perdite di pressione (guasti annunciati)
  if (!s.leak && now >= s.nextLeakAt && s.stage === 'PLAY') {
    const st = pick(STATIONS.filter((x) => x.kind === 'valvola'));
    s.leak = { st: st.id, until: now + 80000 };
    addLog(s, ctx, `Pressione in risalita: perdita al ${FLOOR_NAMES[st.f].toLowerCase()} (80 secondi)`, 'warn');
    ctx.emit('P3_FX', { k: 'perdita', st: st.id, f: st.f, x: st.x, y: floorBase(st.f) + st.y, z: st.z });
    changed = true;
  }
  if (s.leak && now >= s.leak.until) {
    s.leak = null;
    s.nextLeakAt = now + rand(150000, 240000) * PRESS[s.pressure].leak;
    stabilityDown(s, ctx, 'Una perdita non è stata riparata');
    changed = true;
  }
  // ---- piccoli eventi del palazzo (atmosfera, mai pericolosi)
  if (now >= s.atmoAt) {
    s.atmoAt = now + rand(14000, 28000);
    const alive = s.humans.filter((id) => ACTIVE.includes(s.players[id].state) && !s.players[id].hidden);
    const who = pick(alive);
    const p = who ? where(ctx, who) : null;
    const kind = pick(['tubo', 'ascensore', 'citofono', 'passi', 'goccia', 'luce', 'sagoma', 'passo', 'sbatte', 'lampadina', 'corsa', 'sussurro', 'pianto', 'graffi', 'sbatte', 'lampadina', 'cigola', 'buio', 'armadio', 'respiro', 'cigola', 'buio']);
    if (kind === 'cigola' && p) {
      // una porta chiusa vicina si apre piano, da sola, cigolando
      const d = DOORS.filter((x) => x.f === p.f && !s.doors[x.id]?.open && !s.doors[x.id]?.lock && !s.doors[x.id]?.blocked && x.kind !== 'portone' && Math.hypot(x.c + 0.5 - p.x, x.r + 0.5 - p.z) < 10 && Math.hypot(x.c + 0.5 - p.x, x.r + 0.5 - p.z) > 2.5)[0];
      if (d) {
        s.doors[d.id].open = true;
        ctx.emit('P3_FX', { k: 'porta', door: d.id, open: true, by: 'palazzo', slow: true });
        changed = true;
      }
    }
    if (kind === 'armadio' && p) {
      // qualcuno bussa da dentro l'armadio più vicino (vuoto)
      const h = HIDES.filter((x) => x.f === p.f && !s.humans.some((id) => s.players[id].hidden === x.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (h && Math.hypot(h.x - p.x, h.z - p.z) < 12) {
        ctx.emit('P3_FX', { k: 'atmo', what: 'armadio', to: null, f: h.f, x: h.x, y: floorBase(h.f), z: h.z });
        return changed;
      }
    }
    if (kind === 'sedia') {
      s.chairRot = s.chairRot ? 0 : 1;
      changed = true;
    }
    if (kind === 'sbatte' && p) {
      // una porta aperta vicina si chiude di colpo (mai l'uscita, mai con qualcuno sulla soglia)
      const d = DOORS.filter((x) => x.f === p.f && s.doors[x.id]?.open && !x.lock && x.kind !== 'portone' && Math.hypot(x.c + 0.5 - p.x, x.r + 0.5 - p.z) < 11 && Math.hypot(x.c + 0.5 - p.x, x.r + 0.5 - p.z) > 2.2)[0];
      if (d) {
        s.doors[d.id].open = false;
        ctx.emit('P3_FX', { k: 'porta', door: d.id, open: false, by: 'custode', slam: true });
        changed = true;
      }
    }
    if (kind === 'lampadina' && p) {
      s.burst.push(`${p.f}:${p.x.toFixed(1)}:${(p.y + 2.5).toFixed(1)}:${p.z.toFixed(1)}`);
      if (s.burst.length > 12) s.burst.shift();
      changed = true;
      ctx.emit('P3_FX', { k: 'atmo', what: 'lampadina', to: null, f: p.f, x: p.x, y: p.y, z: p.z });
      s.atmoAt = now + rand(15000, 32000);
      return changed;
    }
    ctx.emit('P3_FX', { k: 'atmo', what: kind, to: kind === 'sagoma' || kind === 'passo' ? who : null, f: p?.f ?? 1, x: p?.x ?? 12, y: p?.y ?? 0, z: p?.z ?? 8 });
  }
  // ---- oggetti che si muovono da soli: nei momenti giusti, mai uguali, spesso alle spalle di chi è da solo
  if (now >= s.polterAt && s.stage !== 'BRIEF') {
    const alive = s.humans.filter((id) => ACTIVE.includes(s.players[id].state));
    const pos = alive.map((id) => ({ id, p: where(ctx, id) })).filter((o) => o.p) as { id: string; p: NonNullable<ReturnType<typeof where>> }[];
    // chi è da solo (nessun compagno entro 8 m) attira di più
    const alone = pos.filter((o) => !pos.some((q) => q.id !== o.id && q.p.f === o.p.f && Math.hypot(q.p.x - o.p.x, q.p.z - o.p.z) < 8));
    const who = pick(alone.length && Math.random() < 0.75 ? alone : pos);
    let next = rand(18000, 38000);
    if (who) {
      const opts = DYN_PROPS.filter((d) => {
        if (d.f !== who.p.f) return false;
        const dist = Math.hypot(d.x - who.p.x, d.z - who.p.z);
        if (dist < 2.2 || dist > 13) return false;
        const done = s.moved[d.id];
        // cadere succede una volta sola; accendersi, suonare o girarsi può ripetersi dopo un po'
        if (done && (!DYN_EFFECT[d.kind].repeat || now - done.at < 90000)) return false;
        if (d.kind === s.lastPolter) return false;
        return true;
      });
      // meglio se fuori dal suo sguardo (dietro o di lato): lo sente, si gira e vede che è cambiato
      const behind = opts.filter((d) => {
        const ang = Math.atan2(d.x - who.p.x, d.z - who.p.z) - (ctx.p3get(who.id)?.r ?? 0);
        return Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > 1.2;
      });
      const d = pick(behind.length && Math.random() < 0.7 ? behind : opts);
      if (d) {
        const seed = Math.floor(Math.random() * 1000);
        const k = DYN_EFFECT[d.kind].k;
        s.moved[d.id] = { k, seed, at: now };
        s.lastPolter = d.kind;
        ctx.emit('P3_FX', { k: 'polter', id: d.id, what: k, seed });
        changed = true;
      } else next = rand(8000, 15000);
    }
    // più vicino alla caccia (o subito dopo una scoperta) il palazzo è più nervoso; dopo una caccia si calma
    if (s.hunt) next *= 0.5;
    if (s.custode.mode === 'dorme' && now < s.custode.calmUntil) next *= 1.6;
    s.polterAt = now + next * (s.pressure === 2 ? 0.75 : s.pressure === 0 ? 1.3 : 1);
  }
  // ---- fine del turno: si chiude tutto e si evacua
  if (s.stage === 'PLAY' && s.deadline && now >= s.deadline) {
    s.stage = 'EVAC';
    s.evacEnds = now + 90000;
    addLog(s, ctx, 'Il turno è finito: 90 secondi per uscire (porta di servizio se collaudata, altrimenti il furgone)', 'danger');
    ctx.emit('P3_FX', { k: 'evacuazione' });
    changed = true;
  }
  // ---- oggetti trovati: chi passa vicino li segna sulla pianta di tutti
  for (const [iid, it] of Object.entries(s.items)) {
    if (s.found.includes(iid)) continue;
    if (it.by || s.humans.some((id) => {
      const p = where(ctx, id);
      return p && p.f === it.f && Math.hypot(p.x - it.x, p.z - it.z) < 3.5;
    })) {
      s.found.push(iid);
      if (!it.by) addLog(s, ctx, `Trovato: ${it.kind === 'modulo' ? 'il modulo luci' : it.kind === 'batteria' ? 'la batteria di emergenza' : 'il filtro'} (${FLOOR_NAMES[it.f].toLowerCase()})`, 'ok');
      changed = true;
    }
  }
  // ---- evacuazione
  if (s.stage === 'EVAC' && s.evacEnds && now >= s.evacEnds) {
    for (const id of s.humans) if (ACTIVE.concat('intrappolato').includes(s.players[id].state)) {
      s.players[id].state = 'uscito';
      s.players[id].how = 'è rimasto dentro durante l’evacuazione';
    }
    changed = true;
  }
  // ---- fine: tutti fuori, o nessuno può più soccorrere né uscire
  const states = s.humans.map((id) => s.players[id].state);
  const anyActive = states.some((x) => ACTIVE.includes(x));
  const anyTrapped = states.includes('intrappolato');
  if (!anyActive && !anyTrapped) finish(s, ctx);
  else if (!anyActive && anyTrapped) {
    // nessuno può soccorrere: gli intrappolati possono solo farsi evacuare (si chiude da sola dopo un'attesa)
    for (const id of s.humans) if (s.players[id].state === 'intrappolato' && !s.players[id].evacAt) s.players[id].evacAt = now + 120000;
  }
  if (s.stage === ('END' as S1['stage'])) changed = true;
  return changed;
}

function finish(s: S1, ctx: Ctx) {
  if (s.stage === 'END') return;
  s.stage = 'END';
  const ids = s.humans;
  const out = ids.filter((id) => s.players[id].state === 'estratto').length;
  const evac = ids.filter((id) => s.players[id].state === 'evacuato').length;
  const lost = ids.filter((id) => s.players[id].state === 'uscito').length;
  const full = s.collaudo.done && lost === 0;
  const outcome = full ? 'completo' : out + evac > 0 && lost < ids.length ? 'parziale' : 'fallito';
  const done = [
    s.luce === 'ok' && 'Luci del secondo piano ripristinate',
    s.pompaOn && 'Pompa della cantina riavviata',
    s.batteria && 'Batteria di emergenza installata',
    s.collaudo.done && 'Uscita di servizio collaudata',
  ].filter(Boolean) as string[];
  s.result = {
    outcome,
    minutes: Math.round((ctx.now - s.startAt) / 60000),
    done,
    causes: s.causes.slice(0, 4),
    people: ids.map((id) => ({ id, how: s.players[id].how || 'è uscito', helped: s.players[id].helped })),
  };
  ctx.emit('P3_FX', { k: 'fine', outcome });
}

function freePlayer(s: S1, ctx: Ctx, tid: string, by: string | null) {
  const t = s.players[tid];
  t.state = 'ferito';
  t.rescues++;
  t.woundAt = ctx.now;
  t.evacAt = null;
  t.trap = null;
  t.protectUntil = ctx.now + 12000;
  if (by) {
    s.players[by].helped++;
    addLog(s, ctx, `${s.names[by] ?? 'Un compagno'} ha aperto il lucchetto: ${s.names[tid] ?? 'il compagno'} è libero`, 'ok');
  } else addLog(s, ctx, `${s.names[tid] ?? 'Un compagno'} si è liberato da solo dalle catene`, 'ok');
  ctx.emit('P3_FX', { k: 'liberato', id: tid, by: by ?? tid });
}

function endHold(s: S1, ctx: Ctx, id: string, why: string) {
  const h = s.holds[id];
  if (!h) return;
  delete s.holds[id];
  // riavvio della pompa interrotto nella fase segnalata: sovraccarico
  if (h.kind === 'pompa' && (s.prog.pompa ?? 0) > 0.5 && !s.pompaOn) {
    s.prog.pompa = 0.2;
    stabilityDown(s, ctx, 'Riavvio della pompa interrotto a metà');
  }
  ctx.emit('P3_FX', { k: 'stop', id, why });
}

export const horror1: Mode<S1> = {
  start(settings, players, ctx) {
    const doors: S1['doors'] = {};
    for (const d of DOORS) doors[d.id] = { open: !!d.open, blocked: false, lock: d.lock ?? '' };
    const mod = pick(MODULE_SPOTS);
    const bat = pick(BATTERY_SPOTS);
    const s: S1 = {
      humans: players.map((p) => p.id),
      stage: 'BRIEF',
      startAt: ctx.now,
      briefEnds: ctx.now + 25000,
      evacEnds: null,
      pressure: Math.max(0, Math.min(2, settings.horrorPressure ?? 1)),
      players: Object.fromEntries(
        players.map((p) => [p.id, { state: 'ok', wounds: 0, woundAt: 0, rescues: 0, protectUntil: 0, evacAt: null, carrying: null, runNoiseAt: 0, helped: 0, how: '' } satisfies HPlayer]),
      ),
      doors,
      fermi: 3,
      items: {
        modulo: { kind: 'modulo', f: mod.f, x: mod.x, y: floorBase(mod.f) + mod.y, z: mod.z, by: null, clean: true },
        batteria: { kind: 'batteria', f: bat.f, x: bat.x, y: floorBase(bat.f) + bat.y, z: bat.z, by: null, clean: true },
      },
      holds: {},
      prog: {},
      modulo: false,
      luce: 'spenta',
      luceTestUntil: 0,
      filtro: 'sporco',
      pompaOn: false,
      acqua: 1,
      batteria: false,
      collaudo: { a: false, b: false, until: 0, done: false, codeA: digits(4), codeB: digits(4) },
      blink: 0,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      guastoAt: 0,
      stability: 0,
      log: [],
      leak: null,
      nextLeakAt: ctx.now + rand(240000, 330000),
      atmoAt: ctx.now + 25000 + rand(10000, 18000), // il primo segno arriva presto (il brief dura 25 s)
      chairRot: 0,
      custode: newCustode(),
      noises: [],
      causes: [],
      spawns: {},
      hunt: null,
      deadline: 0,
      found: [],
      huntAt: ctx.now + rand(130000, 170000),
      burst: [],
      moved: {},
      polterAt: ctx.now + 25000 + rand(22000, 34000),
      lastPolter: '',
      result: null,
    };
    // partenza nell'atrio, uno accanto all'altro
    s.humans.forEach((id, i) => {
      s.spawns[id] = { x: 9.6 + (i % 4) * 1.1, y: 0, z: -3.4 - Math.floor(i / 4) * 1.1 };
      ctx.p3set(id, { ...s.spawns[id], r: 0, a: 64 });
    });
    publish(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const pl = s.players[me];
    if (!pl || s.stage === 'END') return false;
    const p = where(ctx, me);
    switch (type) {
      case 'MG_HOLD': {
        // inizio o "sono ancora qui" di un lavoro tenuto premuto
        if (!ACTIVE.includes(pl.state) || !p) return false;
        const target = String(payload.st ?? '');
        const cur = s.holds[me];
        if (cur && cur.st === target) {
          cur.last = ctx.now;
          if (typeof payload.p === 'number') cur.p = Math.max(cur.p ?? 0, Math.min(1, payload.p));
          return false;
        }
        if (pl.hidden) return false;
        // un "sono ancora qui" senza lavoro in corso (appena finito o interrotto): serve ripremere
        if (payload.keep) return false;
        if (payload.kind === 'soccorso') {
          const t = s.players[target];
          const tp = where(ctx, target);
          if (!t || t.state !== 'intrappolato' || !tp || !near3(p, tp, USE_RANGE + 0.4)) return false;
          s.holds[me] = { st: target, kind: 'soccorso', last: ctx.now };
          return true;
        }
        if (payload.kind === 'blocca') {
          const d = DOORS.find((x) => x.id === target);
          const ds = s.doors[target];
          if (!d || !ds || ds.open || ds.blocked || ds.lock || s.fermi <= 0) return false;
          s.holds[me] = { st: target, kind: 'blocca', last: ctx.now };
          return true;
        }
        const st = STATIONS.find((x) => x.id === target);
        if (!st || !near3(p, stationPos(st), USE_RANGE + 0.4)) return false;
        const why = stationBlock(s, me, st);
        if (why) {
          ctx.emit('P3_FX', { k: 'no', id: me, why });
          return false;
        }
        if (st.kind === 'pompa' || st.kind === 'pannello') {
          if ((s.prog[st.id] ?? 0) === 0) addLog(s, ctx, st.kind === 'pompa' ? 'Riavvio della pompa: è rumoroso, non interrompere a metà' : s.modulo ? 'Test del quadro luci in corso' : 'Montaggio del modulo luci', 'warn');
        }
        s.holds[me] = { st: st.id, kind: st.kind, last: ctx.now, p: 0 };
        return true;
      }
      case 'MG_GUASTO': {
        // pompa: la lancetta è finita nel rosso (sovrapressione)
        const h = s.holds[me];
        if (!h || h.kind !== 'pompa' || ctx.now - s.guastoAt < 4000) return false;
        s.guastoAt = ctx.now;
        s.prog.pompa = Math.max(0, (s.prog.pompa ?? 0) - 0.35);
        h.p = s.prog.pompa;
        const st = station('pompa');
        noise(s, st.f, st.x, st.z, NOISE.pompa, 'La pompa in sovrapressione ha fatto un gran rumore', ctx);
        ctx.emit('P3_FX', { k: 'guasto', f: st.f, x: st.x, y: floorBase(st.f) + st.y, z: st.z });
        stabilityDown(s, ctx, 'La pompa è andata in sovrapressione');
        return true;
      }
      case 'MG_CODICE': {
        // quadro luci (lampeggi) e collaudo (codice dell'altra postazione)
        if (!ACTIVE.includes(pl.state) || !p || pl.hidden) return false;
        const st = STATIONS.find((x) => x.id === payload.st);
        const code = String(payload.code ?? '').slice(0, 6);
        if (!st || !near3(p, stationPos(st), USE_RANGE + 0.6)) return false;
        let ok = false;
        if (st.kind === 'pannello') {
          if (s.luce !== 'test') return false;
          ok = code === String(s.blink);
          if (ok) {
            s.luce = 'ok';
            stabilityUp(s, ctx);
            addLog(s, ctx, 'Luci del secondo piano ripristinate', 'ok');
            ctx.emit('P3_FX', { k: 'luci' });
          } else {
            s.blink = 2 + Math.floor(Math.random() * 6);
            addLog(s, ctx, 'Numero sbagliato: il quadro scatta e la lampada cambia sequenza', 'warn');
          }
        } else if (st.kind === 'collaudo1' || st.kind === 'collaudo2') {
          const missing = [s.luce !== 'ok' && 'luci', !s.pompaOn && 'pompa', !s.batteria && 'batteria'].filter(Boolean);
          if (s.collaudo.done || missing.length) return false;
          const A = st.kind === 'collaudo1';
          if ((A && s.collaudo.a) || (!A && s.collaudo.b)) return false;
          ok = code === (A ? s.collaudo.codeA : s.collaudo.codeB);
          if (ok) {
            if (A) s.collaudo.a = true;
            else s.collaudo.b = true;
            if (s.collaudo.a && s.collaudo.b) {
              s.collaudo.done = true;
              s.doors['t-uscita'].lock = '';
              s.doors['t-uscita'].open = true;
              addLog(s, ctx, 'Collaudo riuscito: l’uscita di servizio è aperta. Uscite tutti!', 'ok');
              ctx.emit('P3_FX', { k: 'uscita' });
            } else {
              s.collaudo.until = ctx.now + 90000;
              addLog(s, ctx, `Prima parte del collaudo pronta: inserite il codice ${A ? 'sulla centralina del primo piano' : 'sul quadro dell’uscita'} entro 90 secondi`, 'warn');
            }
          } else addLog(s, ctx, 'Codice del collaudo sbagliato', 'warn');
        } else return false;
        if (!ok) {
          noise(s, st.f, st.x, st.z, NOISE.collaudo * 0.7, 'Un allarme del quadro ha fatto rumore', ctx);
          ctx.emit('P3_FX', { k: 'codice', ok: false, id: me, f: st.f, x: st.x, y: floorBase(st.f) + st.y, z: st.z });
        } else ctx.emit('P3_FX', { k: 'codice', ok: true, id: me, f: st.f, x: st.x, y: floorBase(st.f) + st.y, z: st.z });
        return true;
      }
      case 'MG_LUCCHETTO': {
        // liberare un compagno incatenato: serve la sua combinazione (la vede solo lui)
        if (!ACTIVE.includes(pl.state) || !p) return false;
        const tid = String(payload.id ?? '');
        const t = s.players[tid];
        const tp = where(ctx, tid);
        if (!t || t.state !== 'intrappolato' || !t.trap || !tp || !near3(p, tp, USE_RANGE + 0.6)) return false;
        if (String(payload.code ?? '') === t.trap.code) {
          freePlayer(s, ctx, tid, me);
          return true;
        }
        noise(s, tp.f, tp.x, tp.z, 7, 'Il lucchetto e le catene hanno fatto rumore', ctx);
        ctx.emit('P3_FX', { k: 'catena', id: tid, x: tp.x, y: tp.y + 0.5, z: tp.z, ko: true });
        ctx.emit('P3_FX', { k: 'no', id: me, why: 'Combinazione sbagliata: le catene sbattono (fa rumore)' });
        return false;
      }
      case 'MG_LOTTA': {
        // chi è incatenato si divincola: legge una cifra alla volta (fa rumore). Da solo, alla fine si libera
        const tr = pl.trap;
        if (pl.state !== 'intrappolato' || !tr || !p || ctx.now - tr.lotAt < 1100) return false;
        tr.lotAt = ctx.now;
        noise(s, p.f, p.x, p.z, 7, 'Le catene di un compagno hanno fatto rumore', ctx);
        ctx.emit('P3_FX', { k: 'catena', id: me, x: p.x, y: p.y + 0.5, z: p.z });
        if (tr.revealed < 3) tr.revealed++;
        else {
          const helpers = s.humans.filter((id) => id !== me && ACTIVE.includes(s.players[id].state) && !s.players[id].offSince);
          if (helpers.length) return true;
          tr.self++;
          if (tr.self >= 5) freePlayer(s, ctx, me, null);
        }
        return true;
      }
      case 'MG_NUMERO': {
        // detto alla squadra per chi non usa il microfono (resta scritto nel registro)
        const name = s.names[me] ?? '?';
        if (payload.what === 'lampada') {
          const lamp = station('lampada');
          if (s.luce !== 'test' || !p || !near3(p, stationPos(lamp), 4)) return false;
          addLog(s, ctx, `${name}: «la lampada lampeggia ${s.blink} volte»`, 'warn');
          return true;
        }
        if (payload.what === 'codice') {
          const tr = pl.trap;
          if (pl.state !== 'intrappolato' || !tr) return false;
          addLog(s, ctx, `${name}: «il lucchetto: ${tr.code.split('').map((c, i) => (i < tr.revealed ? c : '_')).join(' ')}»`, 'warn');
          return true;
        }
        if (payload.what === 'collaudo1' || payload.what === 'collaudo2') {
          const st = station(String(payload.what));
          if (!p || !near3(p, stationPos(st), USE_RANGE + 0.6) || s.collaudo.done) return false;
          addLog(s, ctx, `${name}: «codice per ${payload.what === 'collaudo1' ? 'la centralina' : 'il quadro dell’uscita'}: ${payload.what === 'collaudo1' ? s.collaudo.codeB : s.collaudo.codeA}»`, 'warn');
          return true;
        }
        return false;
      }
      case 'MG_HIDE': {
        // dentro un armadio / fuori
        if (!ACTIVE.includes(pl.state) || !p) return false;
        if (!payload.id) {
          if (!pl.hidden) return false;
          const h = HIDES.find((x) => x.id === pl.hidden);
          pl.hidden = null;
          ctx.emit('P3_FX', { k: 'nascondiglio', id: me, hide: h?.id, in: false });
          return true;
        }
        const h = HIDES.find((x) => x.id === payload.id);
        if (!h || pl.hidden || h.f !== p.f || Math.hypot(h.ex - p.x, h.ez - p.z) > 1.9) return false;
        if (s.humans.some((id) => s.players[id].hidden === h.id)) {
          ctx.emit('P3_FX', { k: 'no', id: me, why: 'C’è già qualcuno dentro' });
          return false;
        }
        if (s.holds[me]) delete s.holds[me];
        pl.hidden = h.id;
        pl.hideAt = ctx.now;
        ctx.emit('P3_FX', { k: 'nascondiglio', id: me, hide: h.id, in: true });
        return true;
      }
      case 'MG_RESPIRO': {
        // nell'armadio non ha trattenuto il fiato: si sente da fuori
        if (!pl.hidden || !p) return false;
        pl.breathAt = ctx.now;
        noise(s, p.f, p.x, p.z, 5, 'Un respiro da dentro un armadio', ctx);
        return false;
      }
      case 'MG_VOCE': {
        // parlare forte vicino al Custode lo attira (sussurrare no)
        if (!ACTIVE.includes(pl.state) || !p || ctx.now - (pl.voiceAt ?? 0) < 900) return false;
        pl.voiceAt = ctx.now;
        const lvl = Number(payload.lvl) >= 2 ? 2 : 1;
        noise(s, p.f, p.x, p.z, lvl === 2 ? 13 : 6.5, 'Parlare ad alta voce ha attirato il Custode', ctx);
        return false;
      }
      case 'MG_RELEASE':
        if (!s.holds[me]) return false;
        endHold(s, ctx, me, 'lasciato');
        return true;
      case 'MG_DOOR': {
        if (!ACTIVE.includes(pl.state) || !p) return false;
        const d = DOORS.find((x) => x.id === payload.id);
        const ds = d && s.doors[d.id];
        if (!d || !ds || !near3(p, { f: d.f, x: d.c + 0.5, y: floorBase(d.f), z: d.r + 0.5 }, USE_RANGE + 0.8)) return false;
        if (ds.lock) {
          ctx.emit('P3_FX', { k: 'no', id: me, why: ds.lock === 'acqua' ? 'La porta non si apre: l’acqua spinge da dentro. Serve la pompa' : 'Si apre solo dopo il collaudo dell’uscita' });
          return false;
        }
        if (ds.blocked) {
          ds.blocked = false;
          s.fermi++;
        }
        ds.open = !ds.open;
        noise(s, d.f, d.c + 0.5, d.r + 0.5, NOISE.porta, 'Una porta sbattuta ha fatto rumore', ctx);
        ctx.emit('P3_FX', { k: 'porta', door: d.id, open: ds.open, by: me });
        return true;
      }
      case 'MG_PICK': {
        if (!ACTIVE.includes(pl.state) || !p) return false;
        const it = s.items[String(payload.id)];
        if (!it || it.by || !near3(p, it, USE_RANGE + 0.4)) return false;
        if (pl.carrying) dropItem(s, ctx, me);
        it.by = me;
        pl.carrying = String(payload.id);
        ctx.emit('P3_FX', { k: 'prende', id: me, item: it.kind });
        return true;
      }
      case 'MG_DROP':
        return dropItem(s, ctx, me);
      case 'MG_PING': {
        // messaggi rapidi: vicino (si sente/vede intorno) o via radio (tutti)
        const k = String(payload.k ?? '').slice(0, 16);
        if (!p) return false;
        ctx.emit('P3_FX', { k: 'ping', id: me, what: k, radio: !!payload.radio, f: p.f, x: Number(payload.x) || p.x, y: Number(payload.y) || p.y + 1, z: Number(payload.z) || p.z });
        return false;
      }
      case 'MG_EVAC': {
        // evacuazione assistita (chi è intrappolato e non vuole aspettare)
        if (pl.state !== 'intrappolato' || pl.evacAt) return false;
        pl.evacAt = ctx.now + 20000;
        addLog(s, ctx, 'Un compagno intrappolato ha chiesto l’evacuazione assistita (20 secondi)');
        return true;
      }
      case 'MG_PROVA': {
        // solo per le prove (dalla console di chi crea la stanza): fa partire subito una caccia o un oggetto che si muove
        if (!ctx.canLead(me) || s.stage === 'BRIEF') return false;
        if (payload.what === 'caccia') {
          s.custode.shown = true;
          s.custode.calmUntil = 0;
          s.huntAt = 0;
          s.startAt = Math.min(s.startAt, ctx.now - 130000);
        } else if (payload.what === 'impianti') {
          // salta ai lavori fatti (solo per provare il collaudo)
          s.modulo = true;
          s.luce = 'ok';
          s.filtro = 'montato';
          s.pompaOn = true;
          s.acqua = 0;
          s.doors['c-deposito'].lock = '';
          s.batteria = true;
          delete s.items.modulo;
          delete s.items.batteria;
        } else if (payload.what === 'batteria' && s.items.batteria) {
          if (pl.carrying) dropItem(s, ctx, me);
          s.items.batteria.by = me;
          pl.carrying = 'batteria';
          s.luce = 'ok';
          s.pompaOn = true;
          s.filtro = 'montato';
          s.acqua = 0;
          s.doors['c-deposito'].lock = '';
        } else if (payload.what === 'ferito') {
          pl.state = 'ferito';
          pl.woundAt = ctx.now;
        } else if (payload.what === 'catena') {
          pl.state = 'ferito';
          hitPlayer(s, ctx, me);
        } else if (payload.what === 'oggetto') s.polterAt = 0;
        else if (payload.what === 'evento') s.atmoAt = 0;
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage !== 'BRIEF') return false;
        s.briefEnds = ctx.now;
        return true;
      default:
        return false;
    }
  },
  tick: () => false,
  deadline: (s) => (s.stage === 'END' ? null : Date.now() + 10_000),
  p3Tick(s, ctx, dt) {
    const sig = () => `${s.stage}:${s.stability}:${s.hunt?.phase ?? ''}:${s.hunt?.until ?? 0}`; // la caccia cambia dentro il Custode: va mandata a tutti
    const before = sig();
    let changed = tickGame(s, ctx, dt);
    custodeTick(s, ctx, dt);
    return changed || sig() !== before;
  },
  view(s, me) {
    return {
      stage: s.stage,
      startAt: s.startAt,
      briefEnds: s.briefEnds,
      evacEnds: s.evacEnds,
      pressure: s.pressure,
      players: Object.fromEntries(
        s.humans.map((id) => {
          const p = s.players[id];
          return [
            id,
            {
              state: p.state,
              carrying: p.carrying ? (s.items[p.carrying]?.kind ?? null) : null,
              protectUntil: p.protectUntil,
              rescues: p.rescues,
              evacAt: p.evacAt,
              hidden: p.hidden ?? null,
              // la combinazione la vede solo chi è incatenato (e solo le cifre che è riuscito a leggere)
              trap: p.trap ? { digits: id === me ? p.trap.code.slice(0, p.trap.revealed) : '', revealed: p.trap.revealed, self: p.trap.self } : null,
            },
          ];
        }),
      ),
      doors: Object.fromEntries(Object.entries(s.doors).map(([id, d]) => [id, { open: d.open, blocked: d.blocked, lock: d.lock }])),
      fermi: s.fermi,
      items: Object.entries(s.items).map(([id, it]) => ({ id, kind: it.kind, f: it.f, x: it.x, y: it.y, z: it.z, by: it.by, clean: it.clean })),
      holds: Object.fromEntries(Object.entries(s.holds).map(([id, h]) => [id, { st: h.st, kind: h.kind }])),
      prog: Object.fromEntries(Object.entries(s.prog).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      modulo: s.modulo,
      luce: s.luce,
      luceTestUntil: s.luceTestUntil,
      filtro: s.filtro,
      pompaOn: s.pompaOn,
      acqua: Math.round(s.acqua * 100) / 100,
      batteria: s.batteria,
      collaudo: { a: s.collaudo.a, b: s.collaudo.b, until: s.collaudo.until, done: s.collaudo.done },
      // i codici scritti sui display (ciascuno mostra quello per l'altra postazione)
      codes: { collaudo1: s.collaudo.codeB ?? '', collaudo2: s.collaudo.codeA ?? '' },
      blink: s.luce === 'test' ? s.blink : 0,
      alert: { mode: s.custode.mode, victim: s.custode.victim },
      stability: s.stability,
      log: s.log.slice(-12),
      leak: s.leak,
      chairRot: s.chairRot,
      hunt: s.hunt ? { phase: s.hunt.phase, until: s.hunt.until } : null,
      burst: s.burst ?? [],
      moved: s.moved ?? {},
      result: s.result,
      spawn: s.spawns?.[me] ?? { x: 12, y: 0, z: 3 },
      deadline: s.deadline ?? 0,
      found: s.found ?? [],
      me,
    };
  },
  ids: (s) => s.humans,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    const pl = s.players[id];
    if (!pl || s.stage === 'END') return false;
    pl.state = 'uscito';
    pl.how = 'ha lasciato la partita';
    if (pl.carrying) dropItem(s, ctx, id);
    delete s.holds[id];
    return true;
  },
  upgrade(s) {
    s.custode.showAt ??= 60;
    s.hunt ??= null;
    s.deadline ??= s.startAt + 25 * 60000;
    s.found ??= [];
    s.huntAt ??= Date.now() + 120000;
    s.burst ??= [];
    s.moved ??= {};
    s.polterAt ??= Date.now() + 30000;
    s.lastPolter ??= '';
    s.causes ??= [];
    s.noises ??= [];
    s.names ??= {};
    s.blink ??= 3;
    s.guastoAt ??= 0;
    s.collaudo.codeA ??= digits(4);
    s.collaudo.codeB ??= digits(4);
  },
};

export const HORROR_MODES: Partial<Record<GameId, Mode<any>>> = { HORROR1: horror1 };
