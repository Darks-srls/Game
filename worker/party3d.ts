// 🎉 Axend Party: minigiochi 3D in tempo reale (Spingi giù, Luce rossa luce verde, Sedie musicali, Cecchini, Pasta al dente,
// Pavimento di wafer, Macedonia, Calcetto gigante, Pomodorata, Corsa pazza e gli altri).
// Le posizioni viaggiano a parte (P3_MOVE / P3_POS, ~15 al secondo, vedi index.ts); qui ci sono le regole,
// i bot che giocano da soli e la classifica. Il server decide chi è eliminato, chi si siede e chi viene colpito.
import type { GameId, PartyView } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import { shuffle } from './party';
import {
  ANIM,
  BOT_NAMES,
  CHAIRS,
  MINIGAMES,
  MINIS,
  miniKinds,
  PARTY_COLORS,
  PHYS,
  POINTS,
  RED,
  RED_TIMES,
  SNIPER,
  SNIPER_BOXES,
  SNIPER_HIT_POINTS,
  SLOPE,
  TABLE,
  YARD,
  BRIDGE,
  PLAZA,
  DENTE,
  WAFER,
  HEX_N,
  HEX_TILES,
  FRUIT,
  FRUITS,
  PITCH,
  MARKET,
  CRATES,
  RACE,
  RACE_CP,
  SWEEPERS,
  HAMMERS,
  HAMMER,
  DOOR,
  DOOR_ROWS,
  PLATS,
  noPush,
  noDash,
  dentePlace,
  waferY,
  hexAt,
  setHexState,
  fruitTile,
  fruitTimes,
  fruitSafe,
  setFruitOpen,
  marketRadius,
  crateAt,
  groundAt,
  sweepAngle,
  hammerHead,
  doorX,
  setOpenDoors,
  platX,
  platAt,
  fallOutOf,
  bridgeRowZ,
  setBrokenTiles,
  tileAt,
  ballPos,
  spoonAngle,
  blockedByBoxes,
  newBody,
  pushTargets,
  sniperEye,
  stepBody,
  sumoRadius,
  type Body,
  type Input,
  type MiniKind,
  type NetPos,
} from '../src/data/party3d';
import { SERVER_MINIS, type MiniApi, type ServerMini } from './minis/types';
import './minis'; // registra i minigiochi a moduli

interface Bot {
  id: string;
  name: string;
  skill: number; // 0.3 (scarso) … 0.9 (forte)
  body: Body;
  input: Input;
  thinkAt: number;
  goal: { x: number; z: number; row?: number } | null;
  waitUntil: number;
  reactAt: number;
  pushAnimUntil: number;
  aim: { target: string; at: number } | null;
  lastPos: Record<string, { x: number; z: number; t: number }>;
  plan: number; // pasta al dente: quando scola (ms); corsa: piattaforma su cui sta saltando
  tried: string[]; // corsa: porte finte già provate
  memo: Record<string, number>; // corsa: decisioni prese davanti agli ostacoli (aspettare o buttarsi)
  mem: any; // minigiochi a moduli: memoria libera del bot
}

interface PState {
  humans: string[];
  bots: Bot[];
  colors: Record<string, string>;
  queue: MiniKind[];
  round: number;
  kind: MiniKind;
  stage: PartyView['stage'];
  stageEndsAt: number | null;
  playStart: number | null;
  spawnNo: number;
  spawns: Record<string, { x: number; y: number; z: number; r: number }>;
  alive: Record<string, boolean>;
  out: string[];
  finished: string[];
  points: Record<string, number>;
  roundPoints: Record<string, number> | null;
  pushReady: Record<string, number>;
  light: { state: 'GREEN' | 'TURN' | 'RED'; endsAt: number; since: number } | null;
  redBase: Record<string, { x: number; z: number }> | null;
  redCheckAt: number;
  chairs: { phase: 'MUSIC' | 'STOP'; endsAt: number; list: { x: number; z: number; by: string | null }[]; giro: number } | null;
  snipers: string[];
  sniperCount: Record<string, number>;
  hits: Record<string, number>;
  reloadAt: Record<string, number>;
  blindReady: Record<string, number>; // cecchini: quando si può rilanciare un pomodoro alla torre
  // polpette rotolanti
  balls: { id: number; x: number; t0: number; v: number }[];
  nextBallAt: number;
  ballSeq: number;
  ballHits: Record<string, number>;
  bestZ: Record<string, number>;
  // mestolo della nonna
  slams: { id: number; x: number; z: number; at: number }[];
  nextSlamAt: number;
  slamSeq: number;
  spoonPrev: number;
  spoonHit: Record<string, number>;
  // gallina d'oro
  hen: { holder: string | null; x: number; z: number; vx: number; vz: number; grabAt: number; turnAt: number; safeUntil?: number } | null;
  hold: Record<string, number>;
  // mosse da giocatore bravo: scatto (con schivata)
  dodge: Record<string, number>;
  dashReady: Record<string, number>;
  // ponte di lasagne
  fake: number[];
  broken: string[];
  seen: string[]; // lastre su cui qualcuno è già stato (quindi reggono)
  // petardo
  bomb: { holder: string; explodeAt: number; lastFrom: string | null; passAt: number } | null;
  // pasta al dente: i tempi di chi ha scolato (ms dal via) ed errore totale di ognuno (secondi)
  dente: { manche: number; phase: 'GO' | 'REVEAL'; startAt: number; endsAt: number; stops: Record<string, number | null> } | null;
  err: Record<string, number>;
  // pavimento di wafer
  hex: string;
  hexAt: Record<string, number>; // mattonella che si sbriciola → quando cade
  hexSent: number;
  hexDirty: boolean;
  // macedonia
  fruit: { phase: 'SHOW' | 'HIDE' | 'DROP' | 'RISE'; endsAt: number; giro: number; target: number; grid: number[]; open: boolean[] } | null;
  // calcetto
  team: Record<string, number>;
  keepers: (string | null)[];
  score: [number, number];
  goals: Record<string, number>;
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number; last: string | null; resetAt: number; kickoffAt: number } | null;
  vel: Record<string, { x: number; z: number; t: number; vx: number; vz: number }>; // velocità stimata dei giocatori veri
  // pomodorata
  toms: { id: number; by: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; t0: number }[];
  tomSeq: number;
  throwReady: Record<string, number>;
  // corsa pazza
  doorReal: number[][]; // per ogni fila, le porte vere
  doorOpen: string[];
  doorBump: Record<string, number>;
  hitAt: Record<string, number>;
  // minigiochi a moduli: stato del minigioco e ultime ripartenze
  ext: any;
  tpAt: Record<string, number>;
}

const INTRO_MS = 7_000;
const RESULT_MS = 7_000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hashOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
const everyone = (s: PState) => [...s.humans, ...s.bots.map((b) => b.id)];
const isBot = (s: PState, id: string) => s.bots.find((b) => b.id === id);
const seatedOn = (s: PState, id: string) => s.chairs?.list.findIndex((c) => c.by === id) ?? -1;

function pos(s: PState, ctx: Ctx, id: string): NetPos | null {
  const b = isBot(s, id);
  if (b) return { x: b.body.x, y: b.body.y, z: b.body.z, r: b.body.r, a: 0 };
  return ctx.p3get(id) ?? null;
}

// ---------------------------------------------------------------- minigiochi a moduli: l'api che ricevono

const extOf = (s: PState): ServerMini | undefined => SERVER_MINIS[s.kind as keyof typeof SERVER_MINIS];
// l'ultimo ctx di ogni partita (view() non lo riceve, ma i minigiochi a moduli possono chiedere le posizioni)
const LAST_CTX = new WeakMap<PState, Ctx>();

function makeApi(s: PState, ctx: Ctx): MiniApi {
  const now = ctx.now;
  const api: MiniApi = {
    ext: s.ext,
    ctx,
    now,
    t: s.playStart ? Math.max(0, (now - s.playStart) / 1000) : 0,
    stage: s.stage,
    stageEndsAt: s.stageEndsAt,
    ids: () => everyone(s),
    inGame: () => everyone(s).filter((id) => s.alive[id] && !s.finished.includes(id)),
    humans: s.humans,
    bots: s.bots,
    bot: (id) => isBot(s, id),
    alive: (id) => !!s.alive[id],
    finished: (id) => s.finished.includes(id),
    pos: (id) => pos(s, ctx, id),
    vel: (id) => velOf(s, id),
    color: (id) => s.colors[id] ?? '#ffffff',
    name: (id) => isBot(s, id)?.name ?? '',
    eliminate: (id, reason) => eliminate(s, ctx, id, reason),
    finish: (id) => {
      if (s.alive[id] && !s.finished.includes(id)) s.finished.push(id);
    },
    fling: (id, v) => fling(s, ctx, id, v),
    teleport: (id, p) => {
      if (now - (s.tpAt[id] ?? 0) < 700) return;
      s.tpAt[id] = now;
      const r = p.r ?? 0;
      const b = isBot(s, id);
      if (b) {
        b.body = newBody(p.x, p.z, r, p.y);
        b.goal = null;
      } else ctx.emit('P3_FX', { k: 'respawn', id, x: p.x, y: p.y, z: p.z, r });
      ctx.p3set(id, { x: p.x, y: p.y, z: p.z, r, a: ANIM.idle });
    },
    dodging: (id) => dodging(s, ctx, id),
    emit: (fx) => ctx.emit('P3_FX', fx),
    end: () => {
      if (s.stage === 'PLAY') finishRound(s, ctx);
    },
    setObj: (key, p) => ctx.p3set(key, p),
    go: (b, gx, gz, speed = 1) => {
      const dx = gx - b.body.x;
      const dz = gz - b.body.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) b.input = { ...b.input, x: (dx / d) * speed, z: (dz / d) * speed };
      return d;
    },
    push: (b, x, z) => {
      if (x !== undefined && z !== undefined) b.body.r = Math.atan2(x - b.body.x, z - b.body.z);
      doPush(s, ctx, b.id);
    },
    dash: (b) => botDash(s, ctx, b as Bot),
    rand,
  };
  return api;
}

// ---------------------------------------------------------------- inizio di ogni minigioco

function layout(s: PState, ctx: Ctx) {
  const ids = everyone(s);
  const n = ids.length;
  s.spawns = {};
  if (s.kind === 'SNIPER') {
    // i cecchini a turno: prima chi non l'ha ancora fatto
    const howMany = n >= 8 ? 2 : 1;
    // prima i giocatori veri (a turno), i bot solo se servono
    s.snipers = shuffle(ids)
      .sort((a, b) => (isBot(s, a) ? 1 : 0) - (isBot(s, b) ? 1 : 0) || (s.sniperCount[a] ?? 0) - (s.sniperCount[b] ?? 0))
      .slice(0, howMany);
    for (const id of s.snipers) s.sniperCount[id] = (s.sniperCount[id] ?? 0) + 1;
  } else s.snipers = [];
  if (s.kind === 'CALCIO') soccerTeams(s);
  const runners = ids.filter((id) => !s.snipers.includes(id));
  const tiles = shuffle(Array.from({ length: FRUIT.n * FRUIT.n }, (_, i) => i));
  const mini = extOf(s);
  const api = mini ? makeApi(s, ctx) : null;
  shuffle(runners).forEach((id, i, list) => {
    const m = list.length;
    const f = m <= 1 ? 0.5 : i / (m - 1);
    const a = (i / m) * Math.PI * 2;
    let p = { x: 0, y: 0, z: 0, r: 0 };
    if (mini && api) p = mini.spawn ? mini.spawn(api, id, i, m) : { x: Math.sin(a) * 8, y: 0, z: Math.cos(a) * 8, r: a + Math.PI };
    else if (s.kind === 'SUMO') p = { x: Math.sin(a) * 8, y: 0, z: Math.cos(a) * 8, r: a + Math.PI };
    else if (s.kind === 'NONNA') p = { x: Math.sin(a) * 6, y: 0, z: Math.cos(a) * 6, r: a + Math.PI };
    else if (s.kind === 'GALLINA') p = { x: Math.sin(a) * 9, y: 0, z: Math.cos(a) * 9, r: a + Math.PI };
    else if (s.kind === 'POLPETTE') p = { x: -6 + 12 * f, y: 0, z: SLOPE.start, r: 0 };
    else if (s.kind === 'PONTE') p = { x: -4.5 + 9 * f, y: 0, z: -26, r: 0 };
    else if (s.kind === 'BOTTO') p = { x: Math.sin(a) * 8, y: 0, z: Math.cos(a) * 8, r: a + Math.PI };
    else if (s.kind === 'CHAIRS') p = { x: Math.sin(a) * 6, y: 0, z: Math.cos(a) * 6, r: a + Math.PI };
    else if (s.kind === 'REDLIGHT') p = { x: -12 + 24 * f, y: 0, z: RED.start, r: 0 };
    else if (s.kind === 'DENTE') p = { ...dentePlace(i, m), y: 0 };
    else if (s.kind === 'WAFER') p = { x: Math.sin(a) * 7, y: 0, z: Math.cos(a) * 7, r: a + Math.PI };
    else if (s.kind === 'FRUTTA') {
      const c = fruitTile(tiles[i % tiles.length]);
      p = { x: c.x + (i >= tiles.length ? 1.3 : 0), y: 0, z: c.z, r: 0 };
    } else if (s.kind === 'POMODORI') p = { x: Math.sin(a) * 9, y: 0, z: Math.cos(a) * 9, r: a + Math.PI };
    else if (s.kind === 'CORSA') p = { x: -5 + 10 * f, y: 0, z: RACE.start, r: 0 };
    else if (s.kind === 'CALCIO') p = soccerSpot(s, id);
    else p = { x: -5 + 10 * f, y: 0, z: SNIPER.start, r: 0 };
    s.spawns[id] = p;
  });
  s.snipers.forEach((id, i) => {
    const e = sniperEye(i, s.snipers.length);
    s.spawns[id] = { x: e.x, y: SNIPER.towerTop, z: e.z, r: Math.PI };
  });
  s.spawnNo += 1;
  for (const id of ids) {
    const p = s.spawns[id];
    const b = isBot(s, id);
    if (b) {
      b.body = newBody(p.x, p.z, p.r, p.y);
      b.goal = null;
      b.aim = null;
      b.waitUntil = 0;
      b.reactAt = 0;
      b.plan = 0;
      b.tried = [];
      b.memo = {};
      b.mem = {};
      b.input = { x: 0, z: 0, jump: false };
    }
    ctx.p3set(id, { x: p.x, y: p.y, z: p.z, r: p.r, a: ANIM.idle });
  }
}

// ---------------------------------------------------------------- calcetto: squadre, posti in campo, calcio d'inizio

// rossi (0) attaccano verso +z, blu (1) verso -z. I giocatori veri divisi in parti uguali, poi i bot
function soccerTeams(s: PState) {
  const list = [...shuffle(s.humans), ...shuffle(s.bots.map((b) => b.id))];
  s.team = Object.fromEntries(list.map((id, i) => [id, i % 2]));
  // il portiere è un bot (se la squadra ne ha uno)
  s.keepers = [0, 1].map((t) => s.bots.find((b) => s.team[b.id] === t)?.id ?? null);
}
const SOCCER_SLOTS = [
  [0, -13.4],
  [-4, -5],
  [4, -5],
  [0, -8.5],
  [-7, -9],
  [7, -9],
  [-2.5, -2.5],
  [2.5, -2.5],
  [-5.5, -12],
  [5.5, -12],
  [0, -4],
  [-8, -4],
  [8, -4],
];
function soccerSpot(s: PState, id: string) {
  const t = s.team[id] ?? 0;
  const keeper = s.keepers[t];
  const mates = everyone(s).filter((x) => (s.team[x] ?? 0) === t && x !== keeper);
  const k = keeper ? (id === keeper ? 0 : mates.indexOf(id) + 1) : mates.indexOf(id) + 1;
  const [x, z] = SOCCER_SLOTS[Math.max(0, k) % SOCCER_SLOTS.length];
  return t === 0 ? { x, y: 0, z, r: 0 } : { x: -x, y: 0, z: -z, r: Math.PI };
}
const newBall = (now: number): NonNullable<PState['ball']> => ({ x: 0, y: PITCH.ballR, z: 0, vx: 0, vy: 0, vz: 0, last: null, resetAt: 0, kickoffAt: now });
function kickoff(s: PState, ctx: Ctx) {
  s.spawns = {};
  for (const id of everyone(s)) {
    const p = soccerSpot(s, id);
    s.spawns[id] = p;
    const b = isBot(s, id);
    if (b) {
      b.body = newBody(p.x, p.z, p.r, 0);
      b.goal = null;
    }
    if (s.alive[id]) ctx.p3set(id, { x: p.x, y: 0, z: p.z, r: p.r, a: ANIM.idle });
  }
  s.spawnNo += 1;
  s.ball = newBall(ctx.now);
  ctx.p3set('ball', { x: 0, y: PITCH.ballR, z: 0, r: 0, a: 0 });
}

// quando ognuno ha giocato l'ultima volta a ogni minigioco (serve a non riproporre sempre gli stessi)
const SEEN = new Map<string, Map<MiniKind, number>>();

function beginRound(s: PState, ctx: Ctx) {
  s.kind = s.queue[s.round];
  for (const id of s.humans) {
    const m = SEEN.get(id) ?? new Map<MiniKind, number>();
    m.set(s.kind, ctx.now);
    SEEN.set(id, m);
  }
  if (SEEN.size > 2000) SEEN.delete(SEEN.keys().next().value!);
  s.stage = 'INTRO';
  s.stageEndsAt = ctx.now + INTRO_MS;
  s.playStart = null;
  s.alive = Object.fromEntries(everyone(s).map((id) => [id, true]));
  s.out = [];
  s.finished = [];
  s.roundPoints = null;
  s.light = null;
  s.redBase = null;
  s.chairs = null;
  s.hits = {};
  s.reloadAt = {};
  s.pushReady = {};
  s.balls = [];
  s.ballHits = {};
  s.bestZ = {};
  s.slams = [];
  s.spoonPrev = 0;
  s.spoonHit = {};
  s.hen = null;
  s.hold = {};
  s.dodge = {};
  s.dashReady = {};
  s.fake = [];
  s.broken = [];
  s.seen = [];
  s.bomb = null;
  s.dente = null;
  s.err = {};
  s.hex = s.kind === 'WAFER' ? '0'.repeat(HEX_N * WAFER.layers) : '';
  s.hexAt = {};
  s.hexSent = 0;
  s.hexDirty = false;
  s.fruit = null;
  s.team = {};
  s.keepers = [null, null];
  s.score = [0, 0];
  s.goals = {};
  s.ball = null;
  s.vel = {};
  s.toms = [];
  s.throwReady = {};
  s.doorReal = DOOR_ROWS.map(() => shuffle([0, 1, 2, 3, 4]).slice(0, Math.random() < 0.5 ? 2 : 3));
  s.doorOpen = [];
  s.doorBump = {};
  s.hitAt = {};
  s.tpAt = {};
  s.ext = {};
  const mini = extOf(s);
  if (mini?.init) s.ext = mini.init(makeApi(s, ctx)) ?? {};
  layout(s, ctx);
  if (s.kind === 'CALCIO') {
    s.ball = newBall(ctx.now);
    ctx.p3set('ball', { x: 0, y: PITCH.ballR, z: 0, r: 0, a: 0 });
  }
}

function startPlay(s: PState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.playStart = ctx.now;
  const secs = MINIGAMES[s.kind].seconds;
  s.stageEndsAt = secs ? ctx.now + secs * 1000 : null;
  if (s.kind === 'REDLIGHT') s.light = { state: 'GREEN', endsAt: ctx.now + rand(3000, 5000), since: ctx.now };
  if (s.kind === 'CHAIRS') s.chairs = { phase: 'MUSIC', endsAt: ctx.now + rand(6000, 10000), list: [], giro: 1 };
  if (s.kind === 'POLPETTE') s.nextBallAt = ctx.now + 1200;
  if (s.kind === 'NONNA') {
    s.nextSlamAt = ctx.now + 3000;
    s.spoonPrev = 0;
  }
  if (s.kind === 'GALLINA') s.hen = { holder: null, x: 0, z: 0, vx: 0, vz: 0, grabAt: ctx.now + 600, turnAt: 0 };
  if (s.kind === 'PONTE') {
    s.fake = Array.from({ length: BRIDGE.rows }, () => (Math.random() < 0.5 ? 0 : 1));
    s.broken = [];
    s.seen = [];
  }
  if (s.kind === 'BOTTO') s.bomb = newBomb(s, ctx, everyone(s).filter((id) => s.alive[id]));
  if (s.kind === 'DENTE') denteGo(s, ctx, 0);
  if (s.kind === 'FRUTTA') fruitGiro(s, ctx, 0);
  if (s.kind === 'CALCIO') s.ball = newBall(ctx.now);
  extOf(s)?.play?.(makeApi(s, ctx));
  // chi non è collegato non gioca
  for (const id of s.humans) if (!ctx.isOnline(id)) eliminate(s, ctx, id, 'offline');
}

// un petardo nuovo in mano a qualcuno a caso (miccia più corta quando si è in pochi)
function newBomb(s: PState, ctx: Ctx, ids: string[]): PState['bomb'] {
  if (!ids.length) return null;
  const k = 0.6 + (0.4 * ids.length) / Math.max(1, everyone(s).length);
  return { holder: ids[Math.floor(Math.random() * ids.length)], explodeAt: ctx.now + rand(PLAZA.fuseMin, PLAZA.fuseMax) * k, lastFrom: null, passAt: ctx.now + 1200 };
}

// pasta al dente: una manche nuova (i bot decidono già quando scolare, sbagliando un po' secondo la bravura)
function denteGo(s: PState, ctx: Ctx, manche: number) {
  s.dente = { manche, phase: 'GO', startAt: ctx.now + DENTE.leadMs, endsAt: 0, stops: {} };
  const target = DENTE.targets[manche];
  for (const b of s.bots) {
    let e = gauss() * (0.05 + (1 - b.skill) * 0.6) * (0.5 + target / 16);
    if (Math.random() < 0.08) e += (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.8); // distrazione
    b.plan = Math.max(DENTE.showFor * 1000 + 300, Math.round((target + e) * 1000));
  }
}

// SCOLA! Il telefono manda il suo tempo (così il ritardo della rete non conta), ma non può barare di molto
function doStop(s: PState, ctx: Ctx, id: string, ms: number): boolean {
  const D = s.dente;
  if (s.stage !== 'PLAY' || s.kind !== 'DENTE' || !D || D.phase !== 'GO' || !s.alive[id] || id in D.stops) return false;
  const el = ctx.now - D.startAt;
  if (el < 0) return false;
  D.stops[id] = Math.round(Number.isFinite(ms) ? clamp(ms, el - 400, el) : el);
  ctx.emit('P3_FX', { k: 'scola', id });
  const b = isBot(s, id);
  if (b) b.pushAnimUntil = ctx.now + 450;
  return true;
}

// macedonia: un giro nuovo (frutta a caso, solo alcune piastrelle hanno il frutto da salvare)
function fruitGiro(s: PState, ctx: Ctx, giro: number) {
  const n = FRUIT.n * FRUIT.n;
  const target = Math.floor(Math.random() * FRUITS.length);
  const safe = new Set(shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, fruitSafe(giro)));
  const others = FRUITS.map((_, i) => i).filter((i) => i !== target);
  const grid = Array.from({ length: n }, (_, i) => (safe.has(i) ? target : others[Math.floor(Math.random() * others.length)]));
  s.fruit = { phase: 'SHOW', endsAt: ctx.now + fruitTimes(giro).show, giro, target, grid, open: grid.map(() => true) };
  for (const b of s.bots) {
    b.reactAt = 0;
    b.goal = null;
  }
}

// pomodorata: lancio (parabola simulata qui, il telefono la disegna uguale)
function throwTomato(s: PState, ctx: Ctx, by: string, a: number): boolean {
  if (s.stage !== 'PLAY' || s.kind !== 'POMODORI' || !s.alive[by] || !Number.isFinite(a) || ctx.now < (s.throwReady[by] ?? 0) - 100) return false;
  const p = pos(s, ctx, by);
  if (!p || p.y < -1) return false;
  s.throwReady[by] = ctx.now + MARKET.reload;
  const dx = Math.sin(a);
  const dz = Math.cos(a);
  const T = { id: ++s.tomSeq, by, x: p.x + dx * 0.7, y: p.y + 1.7, z: p.z + dz * 0.7, vx: dx * MARKET.speed, vy: MARKET.lift, vz: dz * MARKET.speed, t0: ctx.now };
  s.toms.push(T);
  const b = isBot(s, by);
  if (b) {
    b.pushAnimUntil = ctx.now + 300;
    b.body.r = a;
  }
  ctx.emit('P3_FX', { k: 'throw', ...T, at: ctx.now });
  return false;
}

// spinta da un ostacolo (bot: subito sul corpo; giocatore vero: al suo telefono)
function fling(s: PState, ctx: Ctx, id: string, v: { vx: number; vy: number; vz: number }) {
  const b = isBot(s, id);
  if (b) {
    b.body.kx += v.vx;
    b.body.kz += v.vz;
    b.body.vy = Math.max(b.body.vy, v.vy);
    b.body.ground = false;
  } else ctx.knock(id, v);
}

// velocità di un giocatore (i bot la sanno, per gli altri si stima dalle posizioni)
const velOf = (s: PState, id: string) => {
  const b = isBot(s, id);
  return b ? { vx: b.body.vx + b.body.kx, vz: b.body.vz + b.body.kz } : { vx: s.vel[id]?.vx ?? 0, vz: s.vel[id]?.vz ?? 0 };
};

// scatto: per un attimo non ti prende niente (spinte, mestolo, polpette)
function doDash(s: PState, ctx: Ctx, id: string): boolean {
  if (s.stage !== 'PLAY' || noDash(s.kind) || !s.alive[id] || ctx.now < (s.dashReady[id] ?? 0) - 150) return false;
  s.dashReady[id] = ctx.now + PHYS.dashCooldown;
  s.dodge[id] = ctx.now + PHYS.dodgeMs;
  ctx.emit('P3_FX', { k: 'dash', id });
  return false;
}
const dodging = (s: PState, ctx: Ctx, id: string) => ctx.now < (s.dodge[id] ?? 0);

function eliminate(s: PState, ctx: Ctx, id: string, reason: string) {
  if (!s.alive[id]) return;
  s.alive[id] = false;
  s.out.push(id);
  if (s.chairs) for (const c of s.chairs.list) if (c.by === id) c.by = null;
  ctx.emit('P3_FX', { k: 'out', id, reason });
}

// Classifica del minigioco → punti
function finishRound(s: PState, ctx: Ctx) {
  const rp: Record<string, number> = Object.fromEntries(everyone(s).map((id) => [id, 0]));
  const groups: string[][] = [];
  const mini = extOf(s);
  const ranked = mini?.rank?.(makeApi(s, ctx));
  if (ranked && !Array.isArray(ranked)) {
    // il minigioco dà i punti direttamente
    for (const id of everyone(s)) rp[id] = Math.max(0, Math.round(ranked[id] ?? 0));
  } else if (mini) {
    // gruppi dal primo all'ultimo (di solito: chi è arrivato, chi è rimasto in piedi, poi gli eliminati dall'ultimo al primo)
    const order = ranked ?? [...s.finished.map((id) => [id]), everyone(s).filter((id) => s.alive[id] && !s.finished.includes(id)), ...[...s.out].reverse().map((id) => [id])];
    let place = 0;
    const seen = new Set<string>();
    for (const g of order) {
      const fresh = g.filter((id) => !seen.has(id) && id in rp);
      for (const id of fresh) {
        rp[id] = POINTS[place] ?? 1;
        seen.add(id);
      }
      place += fresh.length;
    }
  } else if (s.kind === 'SNIPER') {
    s.finished.forEach((id, i) => (rp[id] = POINTS[i] ?? 1));
    for (const id of everyone(s)) if (!s.snipers.includes(id) && !s.finished.includes(id)) rp[id] = s.alive[id] ? 2 : 1;
    for (const id of s.snipers) rp[id] = (s.hits[id] ?? 0) * SNIPER_HIT_POINTS;
  } else if (s.kind === 'DENTE') {
    // pasta al dente: vince chi ha sbagliato di meno in totale
    const sorted = everyone(s).sort((a, b) => (s.err[a] ?? 99) - (s.err[b] ?? 99));
    sorted.forEach((id, i) => (rp[id] = s.alive[id] ? (POINTS[i] ?? 1) : 1));
  } else if (s.kind === 'CALCIO') {
    // calcetto: vittoria 10, pareggio 6, sconfitta 3, più 2 per ogni gol segnato
    for (const id of everyone(s)) {
      const t = s.team[id] ?? 0;
      const mine = s.score[t];
      const theirs = s.score[1 - t];
      rp[id] = s.alive[id] ? (mine > theirs ? 10 : mine === theirs ? 6 : 3) + 2 * (s.goals[id] ?? 0) : 1;
    }
  } else if (s.kind === 'POLPETTE' || s.kind === 'GALLINA' || s.kind === 'PONTE' || s.kind === 'CORSA') {
    // polpette e ponte: prima chi è arrivato, poi chi è andato più avanti; gallina: chi l'ha tenuta di più
    const score = (id: string) => (s.kind === 'GALLINA' ? (s.hold[id] ?? 0) : s.finished.includes(id) ? 1000 - s.finished.indexOf(id) : (s.bestZ[id] ?? -99));
    const sorted = everyone(s).sort((a, b) => score(b) - score(a));
    sorted.forEach((id, i) => (rp[id] = s.alive[id] ? (POINTS[i] ?? 1) : 1));
  } else {
    if (s.kind === 'REDLIGHT') for (const id of s.finished) groups.push([id]);
    const survivors = everyone(s).filter((id) => s.alive[id] && !s.finished.includes(id));
    if (survivors.length) groups.push(survivors);
    for (const id of [...s.out].reverse()) groups.push([id]);
    let place = 0;
    for (const g of groups) {
      for (const id of g) rp[id] = POINTS[place] ?? 1;
      place += g.length;
    }
  }
  for (const [id, p] of Object.entries(rp)) s.points[id] = (s.points[id] ?? 0) + p;
  s.roundPoints = rp;
  s.stage = 'RESULT';
  s.stageEndsAt = ctx.now + RESULT_MS;
  s.light = null;
  s.toms = [];
}

function nextRound(s: PState, ctx: Ctx) {
  s.round += 1;
  if (s.round >= s.queue.length) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  beginRound(s, ctx);
}

// ---------------------------------------------------------------- azioni

function doPush(s: PState, ctx: Ctx, by: string): boolean {
  if (s.stage !== 'PLAY' || noPush(s.kind) || !s.alive[by] || s.snipers.includes(by) || seatedOn(s, by) >= 0 || s.finished.includes(by)) return false;
  if (ctx.now < (s.pushReady[by] ?? 0)) return false;
  const mini = extOf(s);
  if (mini?.push) {
    const own = mini.push(makeApi(s, ctx), by);
    if (own !== undefined) {
      s.pushReady[by] = ctx.now + PHYS.pushCooldown;
      const pb = isBot(s, by);
      if (pb) pb.pushAnimUntil = ctx.now + 350;
      return own;
    }
  }
  const p = pos(s, ctx, by);
  if (!p) return false;
  s.pushReady[by] = ctx.now + PHYS.pushCooldown;
  const B = s.ball;
  if (s.kind === 'CALCIO' && B && !B.resetAt && ctx.now - (s.hitAt[by] ?? 0) > 500) {
    // TIRA: cannonata verso dove guardi (e verso la palla). Appena travolto dalla palla non si tira
    const dx = B.x - p.x;
    const dz = B.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < PITCH.kickRange && Math.abs(p.y - (B.y - PITCH.ballR)) < 1.8) {
      const kx = dx / (d || 1) + Math.sin(p.r) * 0.7;
      const kz = dz / (d || 1) + Math.cos(p.r) * 0.7;
      const kl = Math.hypot(kx, kz) || 1;
      B.vx = (kx / kl) * PITCH.kick;
      B.vz = (kz / kl) * PITCH.kick;
      B.vy = PITCH.kickLift;
      B.last = by;
      const kb = isBot(s, by);
      if (kb) kb.pushAnimUntil = ctx.now + 350;
      ctx.emit('P3_FX', { k: 'kick', by, x: B.x, y: B.y, z: B.z });
      return false;
    }
  }
  const others = everyone(s)
    .filter((id) => id !== by && s.alive[id] && !s.snipers.includes(id) && seatedOn(s, id) < 0 && !s.finished.includes(id))
    .map((id) => ({ id, ...pos(s, ctx, id)! }))
    .filter((o) => o.x !== undefined && Math.abs(o.y - p.y) < 2);
  const reach = pushTargets(p, others);
  // chi sta scattando schiva lo schiaffo
  const hit = reach.filter((t) => !dodging(s, ctx, t.id));
  for (const t of reach) if (dodging(s, ctx, t.id)) ctx.emit('P3_FX', { k: 'dodge', id: t.id });
  for (const t of hit) {
    let dx = t.x - p.x;
    let dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) {
      dx = Math.sin(p.r);
      dz = Math.cos(p.r);
    } else {
      dx /= d;
      dz /= d;
    }
    const v = { vx: dx * PHYS.pushPower, vy: PHYS.pushLift, vz: dz * PHYS.pushPower };
    const b = isBot(s, t.id);
    if (b) {
      b.body.kx += v.vx;
      b.body.kz += v.vz;
      b.body.vy = Math.max(b.body.vy, v.vy);
      b.body.ground = false;
    } else ctx.knock(t.id, v);
  }
  const pb = isBot(s, by);
  if (pb) pb.pushAnimUntil = ctx.now + 350;
  ctx.emit('P3_FX', { k: 'push', by, hit: hit.map((h) => h.id) });
  if (mini?.onPush) mini.onPush(makeApi(s, ctx), by, hit.map((h) => h.id));
  const H = s.hen;
  if (s.kind === 'GALLINA' && H?.holder && ctx.now >= (H.safeUntil ?? 0) && hit.some((h) => h.id === H.holder)) {
    // schiaffo a chi ce l'ha: la gallina passa subito a chi l'ha colpito (e per un attimo non gliela si può riprendere)
    ctx.emit('P3_FX', { k: 'steal', by, from: H.holder });
    H.holder = by;
    H.safeUntil = ctx.now + 1800;
    ctx.emit('P3_FX', { k: 'grab', id: by });
    return true;
  }
  return false;
}

function trySit(s: PState, ctx: Ctx, id: string, i: number): boolean {
  const c = s.chairs;
  if (s.stage !== 'PLAY' || !c || c.phase !== 'STOP' || !s.alive[id] || seatedOn(s, id) >= 0) return false;
  const chair = c.list[i];
  const p = pos(s, ctx, id);
  if (!chair || chair.by || !p || Math.hypot(p.x - chair.x, p.z - chair.z) > CHAIRS.sitRange + 0.6) return false;
  chair.by = id;
  const b = isBot(s, id);
  if (b) {
    b.body.x = chair.x;
    b.body.z = chair.z;
    b.body.r = Math.atan2(-chair.x, -chair.z);
  }
  return true;
}

function shoot(s: PState, ctx: Ctx, by: string, aim: { x: number; y: number; z: number }, want: string | null = null): boolean {
  if (s.stage !== 'PLAY' || s.kind !== 'SNIPER' || !s.snipers.includes(by) || ctx.now < (s.reloadAt[by] ?? 0)) return false;
  if (![aim.x, aim.y, aim.z].every(Number.isFinite)) return false;
  s.reloadAt[by] = ctx.now + SNIPER.reload;
  const eye = sniperEye(s.snipers.indexOf(by), s.snipers.length);
  let dx = aim.x - eye.x;
  let dy = aim.y - eye.y;
  let dz = aim.z - eye.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;
  let best: { id: string; t: number; c: { x: number; y: number; z: number } } | null = null;
  for (const id of everyone(s)) {
    if (!s.alive[id] || s.snipers.includes(id) || s.finished.includes(id)) continue;
    const p = pos(s, ctx, id);
    if (!p) continue;
    const c = { x: p.x, y: p.y + 1.1, z: p.z };
    const vx = c.x - eye.x;
    const vy = c.y - eye.y;
    const vz = c.z - eye.z;
    const t = vx * dx + vy * dy + vz * dz;
    if (t < 0) continue;
    const miss = Math.hypot(vx - dx * t, vy - dy * t, vz - dz * t);
    // chi il cecchino ha visto nel mirino (il telefono lo dice) vale anche con un po' di ritardo della rete
    const tol = id === want ? SNIPER.hitRadius * 2.4 : SNIPER.hitRadius * 1.25;
    if (miss > tol || blockedByBoxes(eye, c)) continue;
    if (!best || t < best.t) best = { id, t, c };
  }
  ctx.emit('P3_FX', { k: 'shot', by, from: eye, to: best ? best.c : aim, hit: best?.id ?? null });
  if (best) {
    eliminate(s, ctx, best.id, 'colpito');
    s.hits[by] = (s.hits[by] ?? 0) + 1;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- bot

function botDash(s: PState, ctx: Ctx, b: Bot) {
  if (ctx.now < (s.dashReady[b.id] ?? 0)) return;
  b.input.dash = true;
  doDash(s, ctx, b.id);
}

function botBrain(s: PState, ctx: Ctx, b: Bot) {
  const now = ctx.now;
  const me = b.body;
  b.input = { x: 0, z: 0, jump: false };
  if (s.stage !== 'PLAY' || !s.alive[b.id]) return;
  const t = (now - (s.playStart ?? now)) / 1000;
  const go = (gx: number, gz: number, speed = 1) => {
    const dx = gx - me.x;
    const dz = gz - me.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3) b.input = { x: (dx / d) * speed, z: (dz / d) * speed, jump: false };
    return d;
  };
  const others = everyone(s).filter((id) => id !== b.id && s.alive[id] && !s.snipers.includes(id));
  const mini = extOf(s);
  if (mini) {
    mini.bot?.(makeApi(s, ctx), b);
    return;
  }

  if (s.kind === 'SUMO') {
    const R = sumoRadius(t);
    const r = Math.hypot(me.x, me.z);
    let target: { x: number; z: number; d: number; id: string } | null = null;
    for (const id of others) {
      const p = pos(s, ctx, id);
      if (!p || p.y < -1) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (!target || d < target.d) target = { x: p.x, z: p.z, d, id };
    }
    if (r > R - 1.8) go(me.x * 0.2, me.z * 0.2);
    else if (target) {
      if (now >= b.thinkAt) {
        b.thinkAt = now + rand(200, 700);
        b.goal = Math.random() < b.skill ? { x: target.x, z: target.z } : { x: rand(-R / 2, R / 2), z: rand(-R / 2, R / 2) };
      }
      if (b.goal) go(b.goal.x, b.goal.z);
      if (target.d < PHYS.pushRange - 0.3 && Math.random() < 0.15 + b.skill * 0.25) {
        me.r = Math.atan2(target.x - me.x, target.z - me.z);
        doPush(s, ctx, b.id);
      }
    }
    if (Math.random() < 0.004) b.input.jump = true;
  } else if (s.kind === 'REDLIGHT') {
    const L = s.light;
    if (s.finished.includes(b.id) || !L) return;
    if (L.state === 'GREEN') {
      b.reactAt = 0;
      if (now >= b.thinkAt) {
        b.thinkAt = now + rand(400, 1200);
        b.goal = { x: Math.max(-12, Math.min(12, me.x + rand(-3, 3))), z: RED.finish + 2 };
      }
      if (b.goal) go(b.goal.x, b.goal.z, 0.75 + b.skill * 0.25);
      // ogni tanto una spinta a chi gli sta davanti
      if (Math.random() < 0.02) {
        const near = others.map((id) => pos(s, ctx, id)!).find((p) => p && Math.hypot(p.x - me.x, p.z - me.z) < 2);
        if (near) {
          me.r = Math.atan2(near.x - me.x, near.z - me.z);
          doPush(s, ctx, b.id);
        }
      }
    } else {
      if (!b.reactAt) b.reactAt = L.since + rand(300, 2700) * (1.35 - b.skill);
      if (now < b.reactAt && b.goal) go(b.goal.x, b.goal.z); // chi reagisce tardi… viene beccato
    }
  } else if (s.kind === 'CHAIRS') {
    const C = s.chairs;
    if (!C || seatedOn(s, b.id) >= 0) return;
    if (C.phase === 'MUSIC') {
      b.reactAt = 0;
      if (!b.goal || now >= b.thinkAt || go(b.goal.x, b.goal.z, 0.6) < 0.5) {
        b.thinkAt = now + rand(1500, 3500);
        const a = rand(0, Math.PI * 2);
        const r = rand(2, CHAIRS.r - 2);
        b.goal = { x: Math.sin(a) * r, z: Math.cos(a) * r };
      }
      go(b.goal.x, b.goal.z, 0.6);
    } else {
      if (!b.reactAt) b.reactAt = now + rand(200, 1100) * (1.3 - b.skill);
      if (now < b.reactAt) return;
      let best = -1;
      let bestD = Infinity;
      C.list.forEach((c, i) => {
        if (c.by) return;
        const d = Math.hypot(c.x - me.x, c.z - me.z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) return;
      const d = go(C.list[best].x, C.list[best].z);
      if (d < CHAIRS.sitRange) trySit(s, ctx, b.id, best);
      else if (Math.random() < 0.03 * b.skill) {
        const near = others.map((id) => ({ id, p: pos(s, ctx, id)! })).find((o) => o.p && seatedOn(s, o.id) < 0 && Math.hypot(o.p.x - me.x, o.p.z - me.z) < 2);
        if (near) {
          me.r = Math.atan2(near.p.x - me.x, near.p.z - me.z);
          doPush(s, ctx, b.id);
        }
      }
    }
  } else if (s.kind === 'POLPETTE') {
    if (s.finished.includes(b.id)) return;
    if (now >= b.thinkAt) {
      b.thinkAt = now + rand(120, 300);
      let gx = me.x;
      for (const bl of s.balls) {
        const bp = ballPos(bl, now);
        if (bp.z > me.z - 1 && bp.z - me.z < 10 && Math.abs(bp.x - me.x) < SLOPE.ballR + 1.4 && Math.random() < 0.35 + b.skill * 0.6) {
          gx = me.x + (me.x >= bp.x ? 3.2 : -3.2);
        }
      }
      b.goal = { x: Math.max(-6, Math.min(6, gx)), z: me.z + 6 };
    }
    if (b.goal) go(b.goal.x, b.goal.z, 0.8 + b.skill * 0.2);
    // polpetta addosso: i più bravi scattano e ci passano attraverso
    for (const bl of s.balls) {
      const bp = ballPos(bl, now);
      if (bp.z > me.z && bp.z - me.z < 2.8 && Math.abs(bp.x - me.x) < 1.9 && Math.random() < b.skill * 0.3) botDash(s, ctx, b);
    }
  } else if (s.kind === 'PONTE') {
    if (s.finished.includes(b.id)) return;
    let next = BRIDGE.rows;
    for (let i = 0; i < BRIDGE.rows; i++)
      if (bridgeRowZ(i) > me.z + 0.6) {
        next = i;
        break;
      }
    if (next >= BRIDGE.rows) {
      const dz = BRIDGE.finishFrom + 2 - me.z;
      go(me.x * 0.5, BRIDGE.finishFrom + 2);
      if (me.ground && dz < 4 && dz > 1.4) b.input.jump = true;
      return;
    }
    // la lastra che avevo scelto è appena crollata sotto un altro: cambio idea
    if (b.goal?.row !== undefined && s.broken.includes(`${b.goal.row}:${b.goal.x > 0 ? 0 : 1}`)) b.goal = null;
    // lato sicuro già scoperto (qualcuno ci è stato sopra o l'altra è crollata)?
    const k0 = s.broken.includes(`${next}:0`) || s.seen.includes(`${next}:1`);
    const k1 = s.broken.includes(`${next}:1`) || s.seen.includes(`${next}:0`);
    const known = k0 || k1;
    if (!b.goal || b.goal.row !== next || (known && now < b.waitUntil)) {
      const side = k0 ? 1 : k1 ? 0 : Math.random() < 0.5 ? 0 : 1;
      // se nessuno ha ancora provato, i più furbi aspettano che sia un altro a rischiare (ma il tempo scorre)
      const left = (s.stageEndsAt ?? now) - now;
      b.waitUntil = known ? 0 : now + Math.min(left * 0.12, rand(800, 7000) * b.skill);
      b.goal = { x: side ? -BRIDGE.tileX : BRIDGE.tileX, z: bridgeRowZ(next), row: next };
    }
    // se un altro bot sta già provando questa fila (ancora sconosciuta), aspetto di vedere come va
    if (!known && me.ground && s.bots.some((o) => o !== b && s.alive[o.id] && !s.finished.includes(o.id) && o.goal?.row === next && now >= o.waitUntil)) {
      b.waitUntil = Math.max(b.waitUntil, now + 400);
    }
    if (now < b.waitUntil && me.ground) return;
    // prima mi metto sul bordo davanti, allineato verso la lastra scelta, poi salto
    const onStart = me.z <= BRIDGE.startTo + 0.2;
    const tx = me.x > 0 ? BRIDGE.tileX : -BRIDGE.tileX;
    const sx = onStart ? b.goal.x : tx + Math.max(-1, Math.min(1, b.goal.x - tx));
    const sz = onStart ? BRIDGE.startTo - 0.55 : (tileAt(me.x, me.z) ? bridgeRowZ(tileAt(me.x, me.z)!.row) + 1.05 : me.z);
    if (me.ground && (Math.abs(me.x - sx) > 0.35 || me.z < sz - 0.3)) {
      go(sx, sz, 0.7);
      return;
    }
    go(b.goal.x, b.goal.z);
    if (me.ground) b.input.jump = true;
  } else if (s.kind === 'BOTTO') {
    const B = s.bomb;
    if (!B) return;
    const hp = pos(s, ctx, B.holder);
    if (B.holder === b.id) {
      // ce l'ho io: inseguo il più vicino
      let tx = 0;
      let tz = 0;
      let best = Infinity;
      for (const id of others) {
        const p = pos(s, ctx, id);
        if (!p) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (d < best) {
          best = d;
          tx = p.x;
          tz = p.z;
        }
      }
      go(tx, tz);
      if (best < 3.5 && Math.random() < b.skill * 0.08) botDash(s, ctx, b);
    } else if (hp) {
      const dx = me.x - hp.x;
      const dz = me.z - hp.z;
      const d = Math.hypot(dx, dz) || 1;
      const r = Math.hypot(me.x, me.z);
      if (r > PLAZA.r - 2.5) go(-me.z * 0.6 + -me.x * 0.4, me.x * 0.6 - me.z * 0.4);
      else go(me.x + (dx / d) * 4 + rand(-1, 1), me.z + (dz / d) * 4 + rand(-1, 1));
      if (d < 2.6 && Math.random() < b.skill * 0.12) botDash(s, ctx, b);
    }
  } else if (s.kind === 'NONNA') {
    // salta il mestolo quando arriva (a volte sbaglia il tempo)
    const th = spoonAngle(t);
    const omega = (spoonAngle(t + 0.1) - th) / 0.1;
    const phi = Math.atan2(me.x, me.z);
    const TWO = Math.PI * 2;
    const ahead = (((phi - th) % TWO) + TWO) % TWO;
    const reach = ahead / Math.max(0.1, omega);
    let jump = false;
    if (reach < 0.32 && now > b.waitUntil) {
      b.waitUntil = now + 700;
      jump = Math.random() < 0.45 + b.skill * 0.55;
    }
    if (now >= b.thinkAt || !b.goal) {
      b.thinkAt = now + rand(800, 1800);
      const a = rand(0, TWO);
      const r = rand(3, 7);
      b.goal = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    }
    let gx = b.goal.x;
    let gz = b.goal.z;
    for (const sl of s.slams) {
      const d = Math.hypot(me.x - sl.x, me.z - sl.z);
      if (d < TABLE.slamR + 1.2 && Math.random() < 0.4 + b.skill * 0.6) {
        gx = me.x + ((me.x - sl.x) / (d || 1)) * 4;
        gz = me.z + ((me.z - sl.z) / (d || 1)) * 4;
      }
    }
    go(gx, gz);
    b.input.jump = jump;
    if (!jump && reach < 0.16 && Math.random() < b.skill * 0.35) botDash(s, ctx, b);
  } else if (s.kind === 'GALLINA') {
    const H = s.hen;
    if (!H) return;
    if (H.holder === b.id) {
      // scappa da chi è più vicino
      let nx = 0;
      let nz = 0;
      let best = Infinity;
      for (const id of others) {
        const p = pos(s, ctx, id);
        if (!p) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (d < best) {
          best = d;
          nx = p.x;
          nz = p.z;
        }
      }
      const r = Math.hypot(me.x, me.z);
      if (r > YARD.r - 3) go(-me.x, -me.z);
      else go(me.x + (me.x - nx), me.z + (me.z - nz));
    } else if (H.holder) {
      const hp = pos(s, ctx, H.holder);
      if (hp) {
        const dist = (p: { x: number; z: number }) => Math.hypot(p.x - hp.x, p.z - hp.z);
        const myD = dist(me);
        const chasers = others.filter((id) => id !== H.holder && s.alive[id]);
        const rank = chasers.filter((id) => {
          const p = pos(s, ctx, id);
          return p && dist(p) < myD;
        }).length;
        // un po' di spazio dagli altri inseguitori, così non si ammucchiano
        let sx = 0;
        let sz = 0;
        for (const id of chasers) {
          const p = pos(s, ctx, id);
          if (!p) continue;
          const dd = Math.hypot(me.x - p.x, me.z - p.z);
          if (dd > 0.01 && dd < 2.2) {
            sx += ((me.x - p.x) / dd) * (2.2 - dd);
            sz += ((me.z - p.z) / dd) * (2.2 - dd);
          }
        }
        let tx = hp.x;
        let tz = hp.z;
        if (rank >= 2 && myD > 2.5) {
          // taglio la strada: mi piazzo di lato rispetto alla gallina, verso il centro dell'aia
          const slot = (b.id.charCodeAt(b.id.length - 1) % 6) * (Math.PI / 3) + now / 4000;
          const rad = 3 + (rank - 2) * 0.9;
          tx = hp.x * 0.7 + Math.sin(slot) * rad;
          tz = hp.z * 0.7 + Math.cos(slot) * rad;
        }
        go(tx + sx * 1.5, tz + sz * 1.5);
        if (rank < 2 && myD < PHYS.pushRange - 0.4 && now >= (H.safeUntil ?? 0) && Math.random() < 0.04 + b.skill * 0.08) {
          me.r = Math.atan2(hp.x - me.x, hp.z - me.z);
          doPush(s, ctx, b.id);
        }
      }
    } else go(H.x, H.z);
  } else if (s.kind === 'DENTE') {
    // fermi in fila: scolano quando hanno deciso (e ogni tanto saltellano per l'ansia)
    const D = s.dente;
    if (!D) return;
    if (D.phase === 'GO' && !(b.id in D.stops) && now >= D.startAt + b.plan) doStop(s, ctx, b.id, b.plan);
    if (me.ground && Math.random() < (D.phase === 'REVEAL' ? 0.02 : 0.003)) b.input.jump = true;
  } else if (s.kind === 'WAFER') {
    // vado sempre verso una mattonella intera del mio piano, lontano dagli altri; se sotto c'è il buco salto
    const layer = clamp(Math.round(-me.y / WAFER.gap), 0, WAFER.layers - 1);
    const base = layer * HEX_N;
    const solid = (k: number) => s.hex[k] === '0' || (s.hex[k] === '1' && (s.hexAt[k] ?? 0) - now > 220);
    if (!me.ground) {
      if (b.goal) go(b.goal.x, b.goal.z);
      return;
    }
    const near = others.map((id) => pos(s, ctx, id)).filter((p): p is NetPos => !!p && Math.abs(p.y - me.y) < 2);
    const reached = b.goal && Math.hypot(b.goal.x - me.x, b.goal.z - me.z) < 0.7;
    if (!b.goal || reached || (b.goal.row !== undefined && s.hex[b.goal.row] !== '0') || now >= b.thinkAt) {
      b.thinkAt = now + rand(450, 1000);
      let best: { x: number; z: number; row: number } | null = null;
      let bestScore = -Infinity;
      for (let i = 0; i < HEX_N; i++) {
        if (s.hex[base + i] !== '0') continue;
        const tl = HEX_TILES[i];
        const d = Math.hypot(tl.x - me.x, tl.z - me.z);
        if (d < 1.6 || d > 6.8) continue;
        let gaps = 0;
        for (let f = 0.2; f < 1; f += 0.2) {
          const j = hexAt(me.x + (tl.x - me.x) * f, me.z + (tl.z - me.z) * f);
          if (j < 0 || !solid(base + j)) gaps++;
        }
        let nb = 0;
        for (let k = 0; k < 6; k++) {
          const j = hexAt(tl.x + Math.cos((k * Math.PI) / 3) * 2.25, tl.z + Math.sin((k * Math.PI) / 3) * 2.25);
          if (j >= 0 && s.hex[base + j] === '0') nb++;
        }
        let crowd = 0;
        for (const o of near) crowd += Math.max(0, 4 - Math.hypot(o.x - tl.x, o.z - tl.z));
        const score = nb * 0.7 - crowd * 1.1 - gaps * (1.5 + b.skill * 4) - d * 0.12 - Math.hypot(tl.x, tl.z) * 0.06 + Math.random() * (1.4 - b.skill) * 3;
        if (score > bestScore) {
          bestScore = score;
          best = { x: tl.x, z: tl.z, row: base + i };
        }
      }
      b.goal = best;
    }
    if (b.goal) {
      // chi è bravo cammina piano: meno mattonelle consumate
      const d = go(b.goal.x, b.goal.z, 0.95 - b.skill * 0.4);
      // buco davanti? salto (i più bravi non sbagliano quasi mai)
      const ax = me.x + ((b.goal.x - me.x) / (d || 1)) * 1.1;
      const az = me.z + ((b.goal.z - me.z) / (d || 1)) * 1.1;
      const j = hexAt(ax, az);
      if ((j < 0 || !solid(base + j)) && d > 1 && Math.random() < 0.35 + b.skill * 0.65) b.input.jump = true;
      // i furbi saltellano: in aria non si consuma niente
      else if (d > 2.5 && Math.random() < b.skill * 0.05) b.input.jump = true;
    } else if (now >= b.waitUntil) {
      // il mio piano è finito: cammino a caso e cado di sotto
      b.waitUntil = now + 600;
      b.input = { x: rand(-1, 1), z: rand(-1, 1), jump: false };
    }
  } else if (s.kind === 'FRUTTA') {
    const F = s.fruit;
    if (!F) return;
    if (F.phase === 'SHOW' || F.phase === 'RISE') {
      b.reactAt = 0;
      if (!b.goal || b.goal.row !== undefined || now >= b.thinkAt || go(b.goal.x, b.goal.z, 0.5) < 0.5) {
        b.thinkAt = now + rand(1200, 2600);
        const c = fruitTile(Math.floor(Math.random() * FRUIT.n * FRUIT.n));
        b.goal = { x: c.x + rand(-1.4, 1.4), z: c.z + rand(-1.4, 1.4) };
      }
      go(b.goal.x, b.goal.z, 0.5);
    } else if (F.phase === 'HIDE') {
      if (!b.reactAt) b.reactAt = now + rand(250, 1100) * (1.3 - b.skill);
      if (now < b.reactAt) return;
      if (b.goal?.row === undefined) {
        // chi si ricorda va sulla piastrella giusta più vicina, gli altri tirano a indovinare (o seguono la folla)
        const mem = clamp(0.4 + b.skill * 0.56 - F.giro * 0.025, 0.2, 0.96);
        const right = F.grid.map((f, i) => (f === F.target ? i : -1)).filter((i) => i >= 0);
        let pick = Math.floor(Math.random() * F.grid.length);
        if (Math.random() < mem) pick = right.sort((u, v) => Math.hypot(fruitTile(u).x - me.x, fruitTile(u).z - me.z) - Math.hypot(fruitTile(v).x - me.x, fruitTile(v).z - me.z))[Math.random() < 0.8 ? 0 : right.length - 1];
        else if (Math.random() < 0.45) {
          const votes: Record<number, number> = {};
          for (const o of s.bots) if (o !== b && o.goal?.row !== undefined) votes[o.goal.row] = (votes[o.goal.row] ?? 0) + 1;
          const top = Object.entries(votes).sort((u, v) => v[1] - u[1])[0];
          if (top) pick = Number(top[0]);
        }
        const c = fruitTile(pick);
        b.goal = { x: c.x + rand(-1.3, 1.3), z: c.z + rand(-1.3, 1.3), row: pick };
      }
      go(b.goal.x, b.goal.z);
      // spintarella a chi mi ruba il posto
      if (Math.random() < 0.025 * b.skill) {
        const near = others.map((id) => pos(s, ctx, id)).find((p) => p && Math.hypot(p.x - me.x, p.z - me.z) < 2);
        if (near) {
          me.r = Math.atan2(near.x - me.x, near.z - me.z);
          doPush(s, ctx, b.id);
        }
      }
    } else if (b.goal) go(b.goal.x, b.goal.z, 0.5);
  } else if (s.kind === 'CALCIO') {
    const B = s.ball;
    if (!B || B.resetAt) return;
    const team = s.team[b.id] ?? 0;
    const dirZ = team === 0 ? 1 : -1;
    const goalZ = dirZ * (PITCH.halfL + 0.5); // porta avversaria
    const ownZ = -dirZ * PITCH.halfL;
    // si mira all'angolo lontano dal portiere avversario (al centro c'è lui)
    const kp = s.keepers[1 - team] ? pos(s, ctx, s.keepers[1 - team]!) : null;
    const aimX = kp && Math.abs(B.z - goalZ) < 20 ? (kp.x > 0 ? -1 : 1) * (PITCH.goalW - 1.7) : 0;
    const gx = aimX - B.x;
    const gz = goalZ - B.z;
    const gd = Math.hypot(gx, gz) || 1;
    const ux = gx / gd;
    const uz = gz / gd;
    const bx = B.x - me.x;
    const bz = B.z - me.z;
    const bd = Math.hypot(bx, bz) || 1;
    const shoot = (err: number) => {
      me.r = Math.atan2(ux, uz) + gauss() * err;
      doPush(s, ctx, b.id);
    };
    if (s.keepers[team] === b.id) {
      // portiere: sulla linea tra la palla e la porta (reagisce con un po' di ritardo); se la palla è in area esce e la spazza
      if (!b.goal || now >= b.thinkAt) {
        b.thinkAt = now + rand(300, 700) * (1.5 - b.skill);
        const ox = B.x;
        const oz = B.z - ownZ;
        const od = Math.hypot(ox, oz) || 1;
        b.goal = { x: clamp((ox / od) * 1.9 * 0.8 + rand(-1.2, 1.2) * (1.2 - b.skill), -PITCH.goalW + 1.4, PITCH.goalW - 1.4), z: ownZ + (oz / od) * 1.9 };
      }
      let tx = b.goal.x;
      let tz = b.goal.z;
      if (Math.abs(B.z - ownZ) < 5 && bd < 3.6) {
        tx = B.x - ux * 1.4;
        tz = B.z - uz * 1.4;
      }
      go(tx, tz, 0.55 + b.skill * 0.3);
      // le cannonate in arrivo non si bloccano al volo (quasi mai): si para col corpo
      const fast = Math.hypot(B.vx, B.vz) > 8 && Math.random() > 0.12 * b.skill;
      if (!fast && bd < PITCH.kickRange - 0.3 && (B.z - me.z) * dirZ > -0.2 && Math.random() < 0.12 + b.skill * 0.25) shoot(0.7);
      return;
    }
    // attaccanti: il più vicino alla palla va a prenderla, il secondo resta un po' dietro, gli altri si allargano
    const mates = s.bots.filter((o) => o !== b && s.alive[o.id] && s.team[o.id] === team && s.keepers[team] !== o.id);
    const closer = mates.filter((o) => Math.hypot(o.body.x - B.x, o.body.z - B.z) < bd).length;
    if (closer === 0) {
      const align = (bx * ux + bz * uz) / bd; // 1 = la palla è davanti a me, verso la porta
      if (align < 0.7 || bd > PITCH.ballR + 2.3) {
        let tx = B.x - ux * (PITCH.ballR + 1.1);
        let tz = B.z - uz * (PITCH.ballR + 1.1);
        if (align < 0.2 && bd < 5) {
          // sono dal lato sbagliato: giro intorno alla palla invece di spingerla verso casa
          const side = Math.sign(-bx * -uz + -bz * ux) || 1;
          tx = B.x - uz * side * 2.6 - ux * 0.6;
          tz = B.z + ux * side * 2.6 - uz * 0.6;
        }
        go(clamp(tx, -PITCH.halfW + 0.8, PITCH.halfW - 0.8), clamp(tz, -PITCH.halfL - 1, PITCH.halfL + 1));
        if (bd > 7 && Math.random() < 0.02 * b.skill) botDash(s, ctx, b);
        // palla a tiro anche se non sono perfettamente dietro: in attacco tiro, in difesa la spazzo avanti
        const attacking = B.z * dirZ > 0;
        if (bd < PITCH.kickRange && align > (attacking ? 0.35 : 0) && ctx.now >= (s.pushReady[b.id] ?? 0) && Math.random() < 0.08 + b.skill * 0.12) shoot((1 - b.skill) * 0.4);
      } else {
        // allineato: porto palla verso la porta e, se sono a tiro, cannonata
        go(B.x + ux * 2, B.z + uz * 2);
        if (bd < PITCH.kickRange && ctx.now >= (s.pushReady[b.id] ?? 0) && (gd < 12 + b.skill * 6 || Math.random() < 0.02) && Math.random() < 0.12 + b.skill * 0.2) shoot((1 - b.skill) * 0.35);
      }
    } else if (closer === 1) {
      const side = hashOf(b.id) % 2 ? 1 : -1;
      go(clamp(B.x * 0.5 + side * 3, -8, 8), (B.z + ownZ) / 2);
    } else {
      const side = (hashOf(b.id) >> 1) % 2 ? 1 : -1;
      go(side * 6.5, clamp(B.z + dirZ * 3, -PITCH.halfL + 3, PITCH.halfL - 3), 0.8);
    }
  } else if (s.kind === 'POMODORI') {
    // si gira intorno al bersaglio a media distanza, lontani dal bordo, e si lancia prevedendo dove sarà
    const R = marketRadius(t);
    const r = Math.hypot(me.x, me.z) || 0.01;
    if (!b.aim || !s.alive[b.aim.target] || now >= b.thinkAt) {
      b.thinkAt = now + rand(1500, 3500);
      const cand = others
        .map((id) => ({ id, p: pos(s, ctx, id) }))
        .filter((o): o is { id: string; p: NetPos } => !!o.p && o.p.y > -1)
        .sort((u, v) => Math.hypot(u.p.x - me.x, u.p.z - me.z) - Math.hypot(v.p.x - me.x, v.p.z - me.z));
      const pick = cand[Math.random() < 0.65 ? 0 : Math.floor(Math.random() * cand.length)];
      b.aim = pick ? { target: pick.id, at: now + rand(300, 900) * (1.4 - b.skill) } : null;
    }
    const tp = b.aim ? pos(s, ctx, b.aim.target) : null;
    let mx = 0;
    let mz = 0;
    let d = 99;
    if (tp) {
      const dx = tp.x - me.x;
      const dz = tp.z - me.z;
      d = Math.hypot(dx, dz) || 1;
      const side = (hashOf(b.id) + Math.floor(now / 1800)) % 2 ? 1 : -1;
      mx = (-dz / d) * side * 0.8;
      mz = (dx / d) * side * 0.8;
      if (d > 10) {
        mx += dx / d;
        mz += dz / d;
      } else if (d < 5) {
        mx -= dx / d;
        mz -= dz / d;
      }
    }
    if (r > R - 2.8) {
      mx -= (me.x / r) * 2.2;
      mz -= (me.z / r) * 2.2;
    }
    go(me.x + mx * 3, me.z + mz * 3, 0.85);
    if (tp && b.aim && now >= b.aim.at && now >= (s.throwReady[b.id] ?? 0) && d < 13.5) {
      const v = velOf(s, b.aim.target);
      const tf = d / MARKET.speed;
      const lead = 0.3 + b.skill * 0.7;
      const ax = tp.x + v.vx * tf * lead;
      const az = tp.z + v.vz * tf * lead;
      throwTomato(s, ctx, b.id, Math.atan2(ax - me.x, az - me.z) + gauss() * (0.03 + (1 - b.skill) * 0.2));
      b.aim.at = now + rand(250, 900) * (1.5 - b.skill);
    }
    // pomodoro in arrivo: i più svegli scattano di lato
    for (const T of s.toms) {
      if (T.by === b.id) continue;
      const dx = me.x - T.x;
      const dz = me.z - T.z;
      if (Math.hypot(dx, dz) < 3.5 && T.vx * dx + T.vz * dz > 0 && Math.random() < b.skill * 0.2) {
        b.input = { x: -T.vz / MARKET.speed, z: T.vx / MARKET.speed, jump: false };
        botDash(s, ctx, b);
        break;
      }
    }
  } else if (s.kind === 'CORSA') {
    if (s.finished.includes(b.id)) {
      go(me.x, RACE.front - 3, 0.4);
      return;
    }
    const lane = ((hashOf(b.id) % 5) - 2) * 2;
    let tx = me.z < RACE.gapFrom - 4 ? lane : me.x;
    let tz = me.z + 6;
    let jump = false;
    let speed = 0.72 + b.skill * 0.2;
    // 1) barre che girano: salto quando la barra sta per arrivare
    SWEEPERS.forEach((sw, i) => {
      const dz = me.z - sw.z;
      const rho = Math.hypot(me.x, dz);
      if (rho > RACE.sweepR + 0.8 || !me.ground) return;
      const th = sweepAngle(i, t);
      const phi = Math.atan2(me.x, dz);
      const ahead = ((((sw.w > 0 ? phi - th : th - phi) % Math.PI) + Math.PI) % Math.PI) / Math.abs(sw.w);
      if (ahead < 0.34 + (1 - b.skill) * rand(-0.15, 0.25) && ahead > 0.05 && now > b.waitUntil) {
        b.waitUntil = now + 450;
        jump = Math.random() < 0.45 + b.skill * 0.5;
      }
    });
    // 2) martelloni: aspetto davanti finché non c'è un buco
    for (let i = 0; i < HAMMERS.length; i++) {
      const dz = HAMMERS[i].z - me.z;
      if (dz > 2.2 && dz < 4.5 && me.ground) {
        let safe = true;
        for (let k = 0; k <= 8; k++) {
          const h = hammerHead(i, t + k * 0.1);
          if (Math.abs(h.x - me.x) < 2.3 && h.y < 2.9) safe = false;
        }
        // decido una volta sola se aspettare il buco o buttarmi (chi è scarso si butta più spesso)
        b.memo[`h${i}`] ??= Math.random() < 0.35 + b.skill * 0.6 ? 1 : 0;
        if (!safe && b.memo[`h${i}`]) {
          tx = me.x;
          tz = me.z;
        }
        break;
      }
    }
    // 3) porte: provo quella aperta più vicina (o una nuova); se resta chiusa è finta e cambio
    for (let row = 0; row < DOOR_ROWS.length; row++) {
      const rz = DOOR_ROWS[row];
      if (me.z > rz + 0.6) continue;
      if (rz - me.z > 10) break;
      const key = (i: number) => `${row}:${i}`;
      if (!b.goal || b.goal.row !== row || (b.tried.includes(key(b.goal.x)) && !s.doorOpen.includes(key(b.goal.x)))) {
        const all = [0, 1, 2, 3, 4];
        const open = all.filter((i) => s.doorOpen.includes(key(i)));
        const untried = all.filter((i) => !b.tried.includes(key(i)));
        const byDist = (l: number[]) => l.sort((u, v) => Math.abs(doorX(u) - me.x) - Math.abs(doorX(v) - me.x) + rand(-1.5, 1.5) * (1 - b.skill));
        const pick = open.length && Math.random() < 0.45 + b.skill * 0.55 ? byDist(open)[0] : (byDist(untried.length ? untried : all)[0] ?? 2);
        b.goal = { x: pick, z: rz, row };
        b.reactAt = 0;
      }
      tx = doorX(b.goal.x);
      tz = rz + 3;
      if (Math.abs(me.x - tx) > 0.5 && rz - me.z < 2.4) tz = rz - 1.9; // prima mi allineo
      if (rz - me.z < DOOR.half + PHYS.radius + 0.3 && Math.abs(me.x - tx) < 0.7 && !s.doorOpen.includes(key(b.goal.x))) {
        if (!b.reactAt) b.reactAt = now + 380;
        else if (now > b.reactAt) {
          b.tried.push(key(b.goal.x));
          b.reactAt = 0;
        }
      }
      break;
    }
    // 4) piattaforme mobili: aspetto sul bordo che la prossima sia allineata e salto
    if (me.z > RACE.gapFrom - 5 && me.z < RACE.gapTo + 0.5) {
      const on = platAt(me.x, me.z, t);
      const next = PLATS.findIndex((pl) => pl.z > me.z + 1.2);
      if (me.ground) {
        const edgeZ = on >= 0 ? PLATS[on].z + 1.5 : RACE.gapFrom - 0.6;
        const curX = on >= 0 ? platX(on, t) : clamp(me.x, -5, 5);
        if (next >= 0) {
          const px = platX(next, t + 0.6);
          if (me.z < edgeZ - 0.45) {
            tx = on >= 0 ? curX : clamp(px, -4.5, 4.5);
            tz = edgeZ;
            speed = 0.7;
          } else {
            tx = curX;
            tz = me.z;
            if (Math.abs(px - me.x) < 0.6 + (1 - b.skill) * Math.random() * 2.6) {
              jump = true;
              b.plan = next;
              tx = px;
              tz = PLATS[next].z;
            }
          }
        } else {
          tx = clamp(me.x, -5, 5);
          tz = RACE.gapTo + 4;
          if (on >= 0 && me.z > edgeZ - 0.3) {
            jump = true;
            b.plan = -1;
          }
        }
      } else if (b.plan >= 0 && b.plan < PLATS.length && me.z < PLATS[b.plan].z + 1) {
        tx = platX(b.plan, t + 0.15);
        tz = PLATS[b.plan].z;
      } else tz = me.z + 4;
    }
    go(tx, tz, speed);
    b.input.jump = jump;
  } else if (s.kind === 'SNIPER') {
    if (s.snipers.includes(b.id)) {
      // il cecchino bot: sceglie un corridore scoperto, prende la mira e spara (con un po' di errore)
      const eye = sniperEye(s.snipers.indexOf(b.id), s.snipers.length);
      if (now < (s.reloadAt[b.id] ?? 0)) return;
      const visible = everyone(s)
        .filter((id) => s.alive[id] && !s.snipers.includes(id) && !s.finished.includes(id))
        .map((id) => ({ id, p: pos(s, ctx, id)! }))
        .filter((o) => o.p && !blockedByBoxes(eye, { x: o.p.x, y: o.p.y + 1.1, z: o.p.z }));
      if (!b.aim || !visible.some((v) => v.id === b.aim!.target)) {
        const pick = visible.sort((u, v) => v.p.z - u.p.z)[Math.random() < 0.6 ? 0 : Math.floor(Math.random() * visible.length)];
        b.aim = pick ? { target: pick.id, at: now + rand(700, 1700) * (1.4 - b.skill) } : null;
        return;
      }
      if (now < b.aim.at) return;
      const p = pos(s, ctx, b.aim.target)!;
      const err = 0.6 + (1 - b.skill) * 2.2;
      shoot(s, ctx, b.id, { x: p.x + rand(-err, err), y: p.y + 1.1 + rand(-0.4, 0.4), z: p.z + rand(-err, err) });
      b.aim = null;
      return;
    }
    if (s.finished.includes(b.id)) return;
    // il corridore bot: di cassa in cassa, fermandosi un po' al riparo
    if (now < b.waitUntil) return;
    if (!b.goal || go(b.goal.x, b.goal.z) < 0.4) {
      if (b.goal) b.waitUntil = now + rand(200, 1500) * (1.1 - b.skill * 0.5);
      const ahead = SNIPER_BOXES.filter((x) => x.z - x.d / 2 - 0.7 > me.z + 1.5).sort((u, v) => u.z - v.z);
      const choice = ahead[Math.random() < 0.7 ? 0 : Math.min(ahead.length - 1, 1)];
      b.goal = choice
        ? { x: choice.x + rand(-choice.w / 2 + 0.6, choice.w / 2 - 0.6), z: choice.z - choice.d / 2 - 0.75 }
        : { x: rand(-4, 4), z: SNIPER.finish + 1 };
    }
  }
}

// lo stato delle arene condivise (mattonelle, piastrelle, porte) va rimesso prima di ogni giro: il server tiene più stanze
function syncArena(s: PState, ctx?: Ctx) {
  const shared = MINIS[s.kind];
  const mini = extOf(s);
  if (shared?.sync && mini?.view && ctx) shared.sync(mini.view(makeApi(s, ctx), ''));
  if (s.kind === 'PONTE') setBrokenTiles(s.broken);
  if (s.kind === 'WAFER') setHexState(s.hex);
  if (s.kind === 'FRUTTA') setFruitOpen(s.fruit?.open ?? []);
  if (s.kind === 'CORSA') setOpenDoors(s.doorOpen);
}

function moveBots(s: PState, ctx: Ctx, dt: number) {
  const t = s.playStart ? (ctx.now - s.playStart) / 1000 : 0;
  syncArena(s, ctx);
  const mini = extOf(s);
  const api = mini?.speed ? makeApi(s, ctx) : null;
  for (const b of s.bots) {
    const sniper = s.snipers.includes(b.id);
    if (!s.alive[b.id] && s.kind !== 'SUMO') {
      ctx.p3set(b.id, { x: b.body.x, y: -50, z: b.body.z, r: b.body.r, a: ANIM.fall });
      continue;
    }
    if (s.stage === 'PLAY' && s.alive[b.id]) botBrain(s, ctx, b);
    else b.input = { x: 0, z: 0, jump: false };
    const seat = seatedOn(s, b.id);
    if (!sniper && seat < 0 && b.body.y > -40) {
      // in luce rossa chi si è fermato resta fermo davvero (anche se in volo)
      const mul = api && mini?.speed ? mini.speed(api, b.id) : s.hen?.holder === b.id ? YARD.holderSpeed : s.bomb?.holder === b.id ? PLAZA.holderSpeed : 1;
      stepBody(b.body, b.input, dt, s.kind, t, (0.85 + b.skill * 0.2) * mul);
      if (s.kind === 'POLPETTE' && b.body.y < -8) b.body = newBody(rand(-5, 5), SLOPE.start);
      if (s.kind === 'CORSA' && b.body.y < -8) {
        // corsa: si riparte dall'ultima bandierina raggiunta
        const cp = RACE_CP.filter((z) => z <= (s.bestZ[b.id] ?? RACE.start) + 0.5).pop() ?? RACE.start;
        b.body = newBody(rand(-3, 3), cp);
        b.goal = null;
        b.plan = 0;
        b.memo = {};
      }
    }
    if (seat >= 0 && s.chairs) {
      b.body.x = s.chairs.list[seat].x;
      b.body.z = s.chairs.list[seat].z;
    }
    let a: number = ANIM.idle;
    if (!s.alive[b.id]) a = ANIM.fall;
    else if (seat >= 0) a = ANIM.sit;
    else if (s.stage === 'END' || (s.stage === 'RESULT' && (s.roundPoints?.[b.id] ?? 0) >= POINTS[0])) a = ANIM.dance;
    else if (ctx.now < b.pushAnimUntil) a = ANIM.push;
    else if ((b.body.dashT ?? 0) > 0) a = ANIM.dash;
    else if (b.body.dive) a = ANIM.dive;
    else if (!b.body.ground && !sniper) a = ANIM.air;
    else if (Math.hypot(b.body.vx, b.body.vz) > 0.5) a = ANIM.walk;
    ctx.p3set(b.id, { x: b.body.x, y: b.body.y, z: b.body.z, r: b.body.r, a });
  }
}

// ---------------------------------------------------------------- il minigioco che va avanti (15 volte al secondo)

function playTick(s: PState, ctx: Ctx, dt: number): boolean {
  let changed = false;
  const now = ctx.now;
  const outBefore = s.out.length;
  for (const id of s.humans) if (s.alive[id] && !ctx.isOnline(id)) eliminate(s, ctx, id, 'offline');
  // cadute (isola, spinte fuori). Nelle corse si riparte, nel wafer si cade fino al cioccolato
  const fallY = fallOutOf(s.kind);
  const why = s.kind === 'WAFER' ? 'cioccolato' : s.kind === 'FRUTTA' && s.fruit?.phase !== 'SHOW' ? 'frutta' : 'caduto';
  for (const id of everyone(s)) {
    if (!s.alive[id] || s.snipers.includes(id)) continue;
    const p = pos(s, ctx, id);
    if (p && p.y < fallY && s.kind !== 'POLPETTE' && s.kind !== 'CORSA' && extOf(s)?.falls !== 'none') eliminate(s, ctx, id, why);
  }
  // velocità stimata dei giocatori veri (serve alla palla e alla mira dei bot)
  if (s.kind === 'CALCIO' || s.kind === 'POMODORI' || extOf(s))
    for (const id of s.humans) {
      const p = pos(s, ctx, id);
      if (!p) continue;
      const v = s.vel[id];
      if (!v) s.vel[id] = { x: p.x, z: p.z, t: now, vx: 0, vz: 0 };
      else if (p.x !== v.x || p.z !== v.z || now - v.t > 300) {
        const h = Math.max(0.03, (now - v.t) / 1000);
        v.vx = v.vx * 0.4 + ((p.x - v.x) / h) * 0.6;
        v.vz = v.vz * 0.4 + ((p.z - v.z) / h) * 0.6;
        v.x = p.x;
        v.z = p.z;
        v.t = now;
      }
    }
  const runnersLeft = () => everyone(s).filter((id) => s.alive[id] && !s.finished.includes(id) && !s.snipers.includes(id));
  const mini = extOf(s);

  if (mini) {
    if (mini.tick?.(makeApi(s, ctx), dt)) changed = true;
    if (s.stage === 'PLAY') {
      const left = runnersLeft().length;
      const ends = mini.ends ?? 'last';
      if ((s.stageEndsAt && now >= s.stageEndsAt) || (ends === 'last' && left <= 1) || (ends === 'all' && left === 0)) finishRound(s, ctx);
    }
  } else if (s.kind === 'SUMO') {
    if (everyone(s).filter((id) => s.alive[id]).length <= 1 || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'REDLIGHT' && s.light) {
    const L = s.light;
    const t = (now - s.playStart!) / 1000;
    if (now >= L.endsAt) {
      if (L.state === 'GREEN') s.light = { state: 'TURN', endsAt: now + RED_TIMES.turn, since: now };
      else if (L.state === 'TURN') {
        s.light = { state: 'RED', endsAt: now + rand(2000, 3600), since: now };
        s.redBase = null;
        s.redCheckAt = now + RED_TIMES.checkDelay;
      } else s.light = { state: 'GREEN', endsAt: now + rand(1600, Math.max(2200, 5200 - t * 45)), since: now };
      changed = true;
    }
    if (s.light.state === 'RED' && now >= s.redCheckAt) {
      if (!s.redBase) {
        s.redBase = {};
        for (const id of runnersLeft()) {
          const p = pos(s, ctx, id);
          if (p) s.redBase[id] = { x: p.x, z: p.z };
        }
      } else {
        for (const id of runnersLeft()) {
          const p = pos(s, ctx, id);
          const b0 = s.redBase[id];
          if (p && b0 && Math.hypot(p.x - b0.x, p.z - b0.z) > RED_TIMES.tolerance) eliminate(s, ctx, id, 'mosso');
        }
      }
    }
    for (const id of runnersLeft()) {
      const p = pos(s, ctx, id);
      if (p && p.z >= RED.finish) {
        s.finished.push(id);
        changed = true;
      }
    }
    if (!runnersLeft().length || (s.stageEndsAt && now >= s.stageEndsAt)) {
      for (const id of runnersLeft()) eliminate(s, ctx, id, 'tempo');
      finishRound(s, ctx);
    }
  } else if (s.kind === 'CHAIRS' && s.chairs) {
    const C = s.chairs;
    const alive = everyone(s).filter((id) => s.alive[id]);
    if (C.phase === 'MUSIC' && now >= C.endsAt) {
      // le sedie spuntano in posti a caso (lontane tra loro)
      const list: { x: number; z: number; by: string | null }[] = [];
      for (let tries = 0; list.length < alive.length - 1 && tries < 500; tries++) {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(Math.random()) * CHAIRS.chairsR;
        const c = { x: Math.sin(a) * r, z: Math.cos(a) * r, by: null };
        if (list.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > 2.4)) list.push(c);
      }
      s.chairs = { phase: 'STOP', endsAt: now + CHAIRS.stopSeconds * 1000, list, giro: C.giro };
      changed = true;
    } else if (C.phase === 'STOP') {
      const full = C.list.every((c) => c.by);
      if (full || now >= C.endsAt) {
        for (const id of alive) if (seatedOn(s, id) < 0) eliminate(s, ctx, id, 'in piedi');
        if (everyone(s).filter((id) => s.alive[id]).length <= 1) finishRound(s, ctx);
        else s.chairs = { phase: 'MUSIC', endsAt: now + rand(5000, 9000), list: [], giro: C.giro + 1 };
        changed = true;
      }
    }
  } else if (s.kind === 'SNIPER') {
    for (const id of runnersLeft()) {
      const p = pos(s, ctx, id);
      if (p && p.z >= SNIPER.finish) {
        s.finished.push(id);
        changed = true;
      }
    }
    if (!runnersLeft().length || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'POLPETTE') {
    const t = (now - s.playStart!) / 1000;
    if (now >= s.nextBallAt) {
      s.balls.push({ id: ++s.ballSeq, x: rand(-SLOPE.halfW + 1.2, SLOPE.halfW - 1.2), t0: now, v: rand(8, 11) + t * 0.07 });
      s.nextBallAt = now + Math.max(450, rand(850, 1500) - t * 11);
      changed = true;
    }
    const before = s.balls.length;
    s.balls = s.balls.filter((b) => ballPos(b, now).z > SLOPE.back - 4);
    if (s.balls.length !== before) changed = true;
    for (const id of runnersLeft()) {
      const p = pos(s, ctx, id);
      if (!p) continue;
      if (p.y > -1) s.bestZ[id] = Math.max(s.bestZ[id] ?? -99, p.z);
      for (const bl of s.balls) {
        const bp = ballPos(bl, now);
        const dx = p.x - bp.x;
        const key = `${id}:${bl.id}`;
        if (Math.hypot(dx, p.z - bp.z) < SLOPE.ballR + 0.6 && p.y < bp.y + SLOPE.ballR && p.y > bp.y - SLOPE.ballR - 1.8 && now - (s.ballHits[key] ?? 0) > 900 && !dodging(s, ctx, id)) {
          s.ballHits[key] = now;
          const v = { vx: Math.sign(dx || 1) * 4.5, vy: 7.5, vz: -14 };
          const b = isBot(s, id);
          if (b) {
            b.body.kx += v.vx;
            b.body.kz += v.vz;
            b.body.vy = v.vy;
            b.body.ground = false;
          } else ctx.knock(id, v);
          ctx.emit('P3_FX', { k: 'bonk', id });
        }
      }
      if (p.z >= SLOPE.finish && p.y >= SLOPE.top - 1.2) {
        s.finished.push(id);
        changed = true;
      }
    }
    if (!runnersLeft().length || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'NONNA') {
    const t = (now - s.playStart!) / 1000;
    const th = spoonAngle(t);
    const thPrev = s.spoonPrev;
    s.spoonPrev = th;
    const TWO = Math.PI * 2;
    const norm = (a: number) => ((a % TWO) + TWO) % TWO;
    for (const id of everyone(s)) {
      if (!s.alive[id]) continue;
      const p = pos(s, ctx, id);
      if (!p || p.y > TABLE.spoonH || p.y < -1) continue;
      const r = Math.hypot(p.x, p.z);
      if (r > TABLE.spoonR + 0.4 || r < 0.4) continue;
      const phi = Math.atan2(p.x, p.z);
      const m = 0.65 / Math.max(r, 0.8);
      const hit = norm(phi - thPrev) <= th - thPrev + m || norm(thPrev - phi) <= m;
      if (hit && now - (s.spoonHit[id] ?? 0) > 700 && !dodging(s, ctx, id)) {
        s.spoonHit[id] = now;
        const v = { vx: Math.cos(th) * 11 + Math.sin(phi) * 5, vy: 6, vz: -Math.sin(th) * 11 + Math.cos(phi) * 5 };
        const b = isBot(s, id);
        if (b) {
          b.body.kx += v.vx;
          b.body.kz += v.vz;
          b.body.vy = v.vy;
          b.body.ground = false;
        } else ctx.knock(id, v);
        ctx.emit('P3_FX', { k: 'bonk', id });
      }
    }
    if (now >= s.nextSlamAt) {
      const alive = everyone(s).filter((id) => s.alive[id]);
      const target = alive[Math.floor(Math.random() * alive.length)];
      const tp = target ? pos(s, ctx, target) : null;
      let x = (tp?.x ?? 0) + rand(-1.5, 1.5);
      let z = (tp?.z ?? 0) + rand(-1.5, 1.5);
      const r = Math.hypot(x, z);
      if (r > 9.5) {
        x *= 9.5 / r;
        z *= 9.5 / r;
      }
      s.slams.push({ id: ++s.slamSeq, x, z, at: now + TABLE.slamWarn });
      s.nextSlamAt = now + Math.max(900, 2500 - t * 22);
      changed = true;
    }
    for (const sl of s.slams.filter((x) => now >= x.at)) {
      for (const id of everyone(s)) {
        const p = pos(s, ctx, id);
        if (s.alive[id] && p && p.y < 2 && Math.hypot(p.x - sl.x, p.z - sl.z) < TABLE.slamR) eliminate(s, ctx, id, 'ciabatta');
      }
      ctx.emit('P3_FX', { k: 'slam', x: sl.x, z: sl.z });
      s.slams = s.slams.filter((x) => x.id !== sl.id);
      changed = true;
    }
    if (everyone(s).filter((id) => s.alive[id]).length <= 1 || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'PONTE') {
    for (const id of runnersLeft()) {
      const p = pos(s, ctx, id);
      if (!p) continue;
      if (p.y > -1) s.bestZ[id] = Math.max(s.bestZ[id] ?? -99, p.z);
      const tl = tileAt(p.x, p.z);
      if (tl && p.y < 0.4 && p.y > -0.8 && s.fake[tl.row] !== tl.side && !s.seen.includes(`${tl.row}:${tl.side}`)) s.seen.push(`${tl.row}:${tl.side}`);
      if (tl && p.y < 0.4 && p.y > -0.8 && s.fake[tl.row] === tl.side) {
        const key = `${tl.row}:${tl.side}`;
        if (!s.broken.includes(key)) {
          s.broken.push(key);
          ctx.emit('P3_FX', { k: 'crack', row: tl.row, side: tl.side });
          changed = true;
        }
        if (s.alive[id]) {
          eliminate(s, ctx, id, 'caduto');
          changed = true;
          continue;
        }
      }
      if (p.z >= BRIDGE.finishFrom && p.y > -0.5) {
        s.finished.push(id);
        changed = true;
      }
    }
    if (!runnersLeft().length || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'BOTTO') {
    const aliveIds = everyone(s).filter((id) => s.alive[id]);
    if (s.bomb && !s.alive[s.bomb.holder]) {
      s.bomb = newBomb(s, ctx, aliveIds);
      changed = true;
    }
    const B = s.bomb;
    if (B) {
      const hp = pos(s, ctx, B.holder);
      if (hp && now >= B.passAt) {
        let best: string | null = null;
        let bd: number = PLAZA.tagRange;
        for (const id of aliveIds) {
          if (id === B.holder || (id === B.lastFrom && now < B.passAt + 800)) continue;
          const p = pos(s, ctx, id);
          if (!p || Math.abs(p.y - hp.y) > 1.6) continue;
          const d = Math.hypot(p.x - hp.x, p.z - hp.z);
          if (d < bd) {
            bd = d;
            best = id;
          }
        }
        if (best) {
          ctx.emit('P3_FX', { k: 'pass', from: B.holder, to: best });
          s.bomb = { holder: best, explodeAt: B.explodeAt, lastFrom: B.holder, passAt: now + PLAZA.passCooldown };
          changed = true;
        }
      }
      if (s.bomb && now >= s.bomb.explodeAt) {
        const victim = s.bomb.holder;
        const vp = pos(s, ctx, victim);
        ctx.emit('P3_FX', { k: 'boom', id: victim, x: vp?.x ?? 0, z: vp?.z ?? 0 });
        for (const id of aliveIds) {
          if (id === victim || !vp) continue;
          const p = pos(s, ctx, id);
          if (!p) continue;
          const d = Math.hypot(p.x - vp.x, p.z - vp.z);
          if (d > 4.5) continue;
          const v = { vx: ((p.x - vp.x) / (d || 1)) * 11, vy: 7, vz: ((p.z - vp.z) / (d || 1)) * 11 };
          const b = isBot(s, id);
          if (b) {
            b.body.kx += v.vx;
            b.body.kz += v.vz;
            b.body.vy = v.vy;
            b.body.ground = false;
          } else ctx.knock(id, v);
        }
        eliminate(s, ctx, victim, 'petardo');
        const left = everyone(s).filter((id) => s.alive[id]);
        if (left.length <= 1) finishRound(s, ctx);
        else s.bomb = newBomb(s, ctx, left);
        changed = true;
      }
    }
    // chi vola giù per lo scoppio può lasciare in piedi uno solo (o nessuno): si chiude lo stesso
    if (s.stage === 'PLAY' && everyone(s).filter((id) => s.alive[id]).length <= 1) finishRound(s, ctx);
  } else if (s.kind === 'GALLINA' && s.hen) {
    const H = s.hen;
    if (H.holder && (!s.alive[H.holder] || (!isBot(s, H.holder) && !ctx.isOnline(H.holder)))) {
      H.holder = null;
      H.grabAt = now + 500;
      changed = true;
    }
    if (H.holder) {
      const hp = pos(s, ctx, H.holder);
      if (hp) {
        H.x = hp.x;
        H.z = hp.z;
      }
      s.hold[H.holder] = (s.hold[H.holder] ?? 0) + dt;
    } else {
      if (now >= H.grabAt) {
        let best: string | null = null;
        let bestD: number = YARD.grabRange;
        for (const id of everyone(s)) {
          const p = pos(s, ctx, id);
          if (!s.alive[id] || !p) continue;
          const d = Math.hypot(p.x - H.x, p.z - H.z);
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
        if (best) {
          H.holder = best;
          H.safeUntil = now + 1500; // appena presa non te la possono rubare subito
          ctx.emit('P3_FX', { k: 'grab', id: best });
          changed = true;
        }
      }
      if (!H.holder) {
        // scappa dal più vicino, cambiando direzione ogni tanto
        if (now >= H.turnAt) {
          H.turnAt = now + rand(400, 900);
          let nx = 0;
          let nz = 0;
          let bd = Infinity;
          for (const id of everyone(s)) {
            const p = pos(s, ctx, id);
            if (!s.alive[id] || !p) continue;
            const d = Math.hypot(p.x - H.x, p.z - H.z);
            if (d < bd) {
              bd = d;
              nx = p.x;
              nz = p.z;
            }
          }
          let dx = H.x - nx + rand(-2, 2);
          let dz = H.z - nz + rand(-2, 2);
          if (Math.hypot(H.x, H.z) > YARD.r - 3) {
            dx = -H.x + rand(-3, 3);
            dz = -H.z + rand(-3, 3);
          }
          const d = Math.hypot(dx, dz) || 1;
          H.vx = (dx / d) * YARD.henSpeed;
          H.vz = (dz / d) * YARD.henSpeed;
        }
        H.x += H.vx * dt;
        H.z += H.vz * dt;
        const r = Math.hypot(H.x, H.z);
        if (r > YARD.r - 1) {
          H.x *= (YARD.r - 1) / r;
          H.z *= (YARD.r - 1) / r;
        }
      }
    }
    ctx.p3set('hen', { x: H.x, y: 0, z: H.z, r: Math.atan2(H.vx, H.vz), a: H.holder ? 1 : 0 });
    if (s.stageEndsAt && now >= s.stageEndsAt) finishRound(s, ctx);
  } else if (s.kind === 'DENTE' && s.dente) {
    const D = s.dente;
    const target = DENTE.targets[D.manche];
    const aliveIds = everyone(s).filter((id) => s.alive[id]);
    if (D.phase === 'GO') {
      // rivelazione quando hanno scolato tutti o quando è passato troppo (chi non ha scolato prende la penalità)
      if (now >= D.startAt + (target + DENTE.late) * 1000 || (aliveIds.length > 0 && aliveIds.every((id) => id in D.stops))) {
        for (const id of aliveIds) if (!(id in D.stops)) D.stops[id] = null;
        for (const [id, ms] of Object.entries(D.stops)) s.err[id] = (s.err[id] ?? 0) + (ms === null ? DENTE.miss : Math.abs(ms / 1000 - target));
        D.phase = 'REVEAL';
        D.endsAt = now + DENTE.revealMs;
        changed = true;
      }
    } else if (now >= D.endsAt) {
      if (D.manche + 1 >= DENTE.targets.length || !aliveIds.length) finishRound(s, ctx);
      else denteGo(s, ctx, D.manche + 1);
      changed = true;
    }
  } else if (s.kind === 'WAFER') {
    // chi sta in piedi su una mattonella la fa sbriciolare; dopo un attimo cade
    const hex = s.hex.split('');
    const fx: [number, number][] = [];
    for (const id of everyone(s)) {
      if (!s.alive[id]) continue;
      const p = pos(s, ctx, id);
      if (!p) continue;
      const i = hexAt(p.x, p.z);
      if (i < 0) continue;
      for (let l = 0; l < WAFER.layers; l++) {
        if (Math.abs(p.y - waferY(l)) > 0.3) continue;
        const k = l * HEX_N + i;
        if (hex[k] === '0') {
          hex[k] = '1';
          s.hexAt[k] = now + WAFER.crumble;
          fx.push([k, 1]);
        }
      }
    }
    for (const [k, at] of Object.entries(s.hexAt))
      if (now >= at) {
        hex[Number(k)] = '2';
        delete s.hexAt[k];
        fx.push([Number(k), 2]);
      }
    if (fx.length) {
      s.hex = hex.join('');
      ctx.emit('P3_FX', { k: 'hex', c: fx });
      s.hexDirty = true;
    }
    // lo stato intero si manda al massimo ogni 300 ms (le briciole viaggiano subito come effetti)
    if (s.hexDirty && now - s.hexSent >= 300) {
      s.hexDirty = false;
      s.hexSent = now;
      changed = true;
    }
    setHexState(s.hex);
    if (everyone(s).filter((id) => s.alive[id]).length <= 1 || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'FRUTTA' && s.fruit) {
    const F = s.fruit;
    const T = fruitTimes(F.giro);
    const left = () => everyone(s).filter((id) => s.alive[id]).length;
    if (now >= F.endsAt) {
      if (F.phase === 'SHOW') {
        F.phase = 'HIDE';
        F.endsAt = now + T.hide;
      } else if (F.phase === 'HIDE') {
        F.phase = 'DROP';
        F.endsAt = now + T.drop;
        F.open = F.grid.map((f) => f === F.target);
        ctx.emit('P3_FX', { k: 'drop' });
      } else if (F.phase === 'DROP') {
        F.phase = 'RISE';
        F.endsAt = now + T.rise;
        F.open = F.grid.map(() => true);
      } else if (left() <= 1 || F.giro + 1 >= FRUIT.giri) finishRound(s, ctx);
      else fruitGiro(s, ctx, F.giro + 1);
      changed = true;
    }
    if (s.fruit && s.stage === 'PLAY') setFruitOpen(s.fruit.open);
    if (s.stage === 'PLAY' && left() === 0) finishRound(s, ctx);
  } else if (s.kind === 'CALCIO' && s.ball) {
    if (soccerTick(s, ctx, dt)) changed = true;
    if (s.stageEndsAt && now >= s.stageEndsAt) finishRound(s, ctx);
  } else if (s.kind === 'POMODORI') {
    tomatoTick(s, ctx, dt);
    if (everyone(s).filter((id) => s.alive[id]).length <= 1 || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  } else if (s.kind === 'CORSA') {
    if (raceTick(s, ctx, dt)) changed = true;
    if (!runnersLeft().length || (s.stageEndsAt && now >= s.stageEndsAt)) finishRound(s, ctx);
  }
  return changed || s.out.length !== outBefore;
}

// ---------------------------------------------------------------- calcetto: la palla (fisica sul server)

function soccerTick(s: PState, ctx: Ctx, dt: number): boolean {
  const B = s.ball!;
  const now = ctx.now;
  const R = PITCH.ballR;
  let changed = false;
  if (B.resetAt && now >= B.resetAt) {
    kickoff(s, ctx);
    return true;
  }
  // chi ci corre contro la spinge (dribbling)
  for (const id of everyone(s)) {
    if (!s.alive[id]) continue;
    const p = pos(s, ctx, id);
    if (!p || p.y > B.y + R * 0.6 || p.y + 1.8 < B.y - R) continue;
    const dx = B.x - p.x;
    const dz = B.z - p.z;
    const d = Math.hypot(dx, dz);
    const min = R + PHYS.radius;
    if (d >= min || d < 0.001) continue;
    const nx = dx / d;
    const nz = dz / d;
    if (now - (s.hitAt[id] ?? 0) < 600) continue;
    const inward = -(B.vx * nx + B.vz * nz);
    if (inward > 8 && B.last !== id) {
      // cannonata: il pallone travolge chi si mette in mezzo (anche il portiere) e va avanti
      const bs = Math.hypot(B.vx, B.vz) || 1;
      s.hitAt[id] = now;
      if (!dodging(s, ctx, id)) {
        fling(s, ctx, id, { vx: (B.vx / bs) * inward * 0.75, vy: 5.5, vz: (B.vz / bs) * inward * 0.75 });
        ctx.emit('P3_FX', { k: 'bonk', id });
      }
      B.vx *= 0.72;
      B.vz *= 0.72;
      continue;
    }
    B.x = p.x + nx * min;
    B.z = p.z + nz * min;
    const v = velOf(s, id);
    const along = B.vx * nx + B.vz * nz;
    const want = Math.max(0, v.vx * nx + v.vz * nz) * 1.25 + 1.6;
    if (along < want) {
      B.vx += nx * (want - along);
      B.vz += nz * (want - along);
    }
    B.last = id;
  }
  // movimento con rimbalzi (in due passi, così non attraversa le sponde)
  for (let k = 0; k < 2; k++) {
    const h = dt / 2;
    B.vy -= 22 * h;
    B.x += B.vx * h;
    B.y += B.vy * h;
    B.z += B.vz * h;
    if (B.y < R) {
      B.y = R;
      B.vy = B.vy < -2.5 ? -B.vy * 0.45 : 0;
    }
    const f = Math.exp(-(B.y <= R + 0.02 ? 0.6 : 0.1) * h);
    B.vx *= f;
    B.vz *= f;
    const inGoal = Math.abs(B.z) > PITCH.halfL - R;
    const mouth = Math.abs(B.x) < PITCH.goalW - R * 0.4 && B.y < PITCH.goalH;
    const xMax = inGoal && mouth ? PITCH.goalW - R : PITCH.halfW - R;
    if (Math.abs(B.x) > xMax && (Math.abs(B.z) > PITCH.halfL || Math.abs(B.x) > PITCH.halfW - R)) {
      B.x = Math.sign(B.x) * xMax;
      if (B.vx * B.x > 0) B.vx = -B.vx * 0.75;
    }
    const zMax = mouth ? PITCH.halfL + PITCH.goalD - R : PITCH.halfL - R;
    if (Math.abs(B.z) > zMax) {
      B.z = Math.sign(B.z) * zMax;
      if (B.vz * B.z > 0) B.vz = -B.vz * (mouth ? 0.2 : 0.75);
    }
  }
  // gol!
  if (!B.resetAt && Math.abs(B.z) > PITCH.halfL + R * 0.6 && Math.abs(B.x) < PITCH.goalW) {
    const team = B.z > 0 ? 0 : 1; // i rossi segnano nella porta in fondo (+z)
    s.score[team] += 1;
    const by = B.last && (s.team[B.last] ?? -1) === team ? B.last : null;
    if (by) s.goals[by] = (s.goals[by] ?? 0) + 1;
    B.resetAt = now + PITCH.resetMs;
    ctx.emit('P3_FX', { k: 'goal', team, by, own: !!B.last && !by ? B.last : null, x: B.x, z: B.z });
    changed = true;
  }
  ctx.p3set('ball', { x: B.x, y: B.y, z: B.z, r: 0, a: 0 });
  return changed;
}

// ---------------------------------------------------------------- pomodorata: i pomodori in volo

function tomatoTick(s: PState, ctx: Ctx, dt: number) {
  const now = ctx.now;
  const t = (now - s.playStart!) / 1000;
  const keep: PState['toms'] = [];
  for (const T of s.toms) {
    let done = false;
    for (let k = 0; k < 3 && !done; k++) {
      const h = dt / 3;
      const ox = T.x;
      const oy = T.y;
      const oz = T.z;
      T.vy -= MARKET.gravity * h;
      T.x += T.vx * h;
      T.y += T.vy * h;
      T.z += T.vz * h;
      // contro i giocatori (tratto percorso in questo passo, così non passa attraverso)
      for (const id of everyone(s)) {
        if (!s.alive[id] || (id === T.by && now - T.t0 < 400)) continue;
        const p = pos(s, ctx, id);
        if (!p || p.y < -2) continue;
        const sx = T.x - ox;
        const sz = T.z - oz;
        const len2 = sx * sx + sz * sz || 1;
        const u = clamp(((p.x - ox) * sx + (p.z - oz) * sz) / len2, 0, 1);
        const cx = ox + sx * u;
        const cz = oz + sz * u;
        const cy = oy + (T.y - oy) * u;
        if (Math.hypot(p.x - cx, p.z - cz) > MARKET.hitR || cy < p.y - 0.3 || cy > p.y + 2.3) continue;
        if (dodging(s, ctx, id)) {
          ctx.emit('P3_FX', { k: 'dodge', id });
          continue;
        }
        const sp = Math.hypot(T.vx, T.vz) || 1;
        fling(s, ctx, id, { vx: (T.vx / sp) * MARKET.power, vy: 4.5, vz: (T.vz / sp) * MARKET.power });
        ctx.emit('P3_FX', { k: 'splat', tid: T.id, id, by: T.by, x: cx, y: cy, z: cz });
        done = true;
        break;
      }
      if (done) break;
      // contro le cassette e per terra
      const c = crateAt(T.x, T.z);
      if (c && T.y < c.h) {
        ctx.emit('P3_FX', { k: 'splat', tid: T.id, x: T.x, y: c.h, z: T.z, crate: true });
        done = true;
      } else if (T.y <= 0 && groundAt('POMODORI', T.x, T.z, t) !== null) {
        ctx.emit('P3_FX', { k: 'splat', tid: T.id, x: T.x, y: 0.02, z: T.z, ground: true });
        done = true;
      } else if (T.y < -8 || now - T.t0 > 3000) done = true;
    }
    if (!done) keep.push(T);
  }
  s.toms = keep;
}

// ---------------------------------------------------------------- corsa pazza: barre, martelli, porte, arrivo

// la barra a due bracci è passata sull'angolo phi in questo tick? (angoli modulo π)
function swept(phi: number, a0: number, a1: number, m: number) {
  const lo = Math.min(a0, a1) - m;
  const len = Math.abs(a1 - a0) + 2 * m;
  return (((phi - lo) % Math.PI) + Math.PI) % Math.PI <= len;
}

function raceTick(s: PState, ctx: Ctx, dt: number): boolean {
  const now = ctx.now;
  const t = (now - s.playStart!) / 1000;
  let changed = false;
  setOpenDoors(s.doorOpen);
  for (const id of everyone(s)) {
    if (!s.alive[id] || s.finished.includes(id)) continue;
    const p = pos(s, ctx, id);
    if (!p) continue;
    if (p.y > -1) s.bestZ[id] = Math.max(s.bestZ[id] ?? -99, p.z);
    if (p.y < -1) continue;
    const hitOk = now - (s.hitAt[id] ?? 0) > 800 && !dodging(s, ctx, id);
    // barre che girano rasoterra
    SWEEPERS.forEach((sw, i) => {
      if (!hitOk || p.y > RACE.sweepH || now - (s.hitAt[id] ?? 0) <= 800) return;
      const dz = p.z - sw.z;
      const rho = Math.hypot(p.x, dz);
      if (rho > RACE.sweepR + 0.4 || rho < 0.6) return;
      const phi = Math.atan2(p.x, dz);
      if (!swept(phi, sweepAngle(i, t - dt), sweepAngle(i, t), 0.55 / Math.max(rho, 0.8))) return;
      s.hitAt[id] = now;
      const sg = Math.sign(sw.w);
      fling(s, ctx, id, { vx: sg * Math.cos(phi) * 12.5, vy: 7, vz: -sg * Math.sin(phi) * 12.5 });
      ctx.emit('P3_FX', { k: 'bonk', id });
    });
    // martelloni a pendolo
    HAMMERS.forEach((_, i) => {
      if (!hitOk || now - (s.hitAt[id] ?? 0) <= 800) return;
      const h = hammerHead(i, t);
      if (Math.abs(p.z - h.z) > HAMMER.headL / 2 + 0.45 || Math.hypot(p.x - h.x, p.y + 0.9 - h.y) > HAMMER.headR + 0.65) return;
      s.hitAt[id] = now;
      fling(s, ctx, id, { vx: Math.sign(h.vx || p.x - h.x || 1) * 15, vy: 7, vz: rand(-2, 2) });
      ctx.emit('P3_FX', { k: 'bonk', id, big: true });
    });
    // porte: quella vera si sfonda appena la tocchi, quella finta fa solo "bonk"
    DOOR_ROWS.forEach((rz, row) => {
      const dz = rz - p.z;
      if (dz < 0 || dz > DOOR.half + PHYS.radius + 0.6 || Math.abs(p.x) > RACE.halfW) return;
      const i = clamp(Math.floor((p.x + RACE.halfW) / DOOR.slot), 0, DOOR.n - 1);
      const key = `${row}:${i}`;
      if (s.doorOpen.includes(key)) return;
      if (s.doorReal[row]?.includes(i)) {
        s.doorOpen.push(key);
        setOpenDoors(s.doorOpen);
        ctx.emit('P3_FX', { k: 'door', row, i, by: id });
        changed = true;
      } else if (dz < DOOR.half + PHYS.radius + 0.25 && now - (s.doorBump[`${id}:${key}`] ?? 0) > 1500) {
        s.doorBump[`${id}:${key}`] = now;
        ctx.emit('P3_FX', { k: 'fake', id, row, i });
      }
    });
    if (p.z >= RACE.finish && p.y > -0.5) {
      s.finished.push(id);
      changed = true;
    }
  }
  return changed;
}

function viewExt(s: PState, me: string) {
  const mini = extOf(s);
  const ctx = LAST_CTX.get(s);
  if (!mini?.view || !ctx) return null;
  return mini.view(makeApi(s, { ...ctx, now: Date.now() }), me) ?? null;
}

// ---------------------------------------------------------------- il gioco

export const party3d: Mode<PState> = {
  start(settings, players, ctx) {
    const humans = players.map((p) => p.id);
    const used = new Set(players.map((p) => p.color));
    const free = PARTY_COLORS.filter((c) => !used.has(c));
    const nBots = Math.max(0, Math.min(12, settings.partyBots ?? 0));
    const names = shuffle(BOT_NAMES);
    const bots: Bot[] = Array.from({ length: nBots }, (_, i) => ({
      id: `bot${i + 1}`,
      name: names[i % names.length],
      skill: rand(0.35, 0.9),
      body: newBody(0, 0),
      input: { x: 0, z: 0, jump: false },
      thinkAt: 0,
      goal: null,
      waitUntil: 0,
      reactAt: 0,
      pushAnimUntil: 0,
      aim: null,
      lastPos: {},
      plan: 0,
      tried: [],
      memo: {},
      mem: {},
    }));
    // scaletta: prima i minigiochi che questi giocatori non fanno da più tempo (poi mescolati), senza lo stesso due volte di fila
    const want = Math.max(1, settings.partyRounds ?? 5);
    const queue: MiniKind[] = [];
    while (queue.length < want) {
      const fresh = shuffle(miniKinds())
        .map((k) => ({ k, at: Math.max(0, ...humans.map((id) => SEEN.get(id)?.get(k) ?? 0)) + Math.random() * 60_000 }))
        .sort((x, y) => x.at - y.at)
        .slice(0, want - queue.length)
        .map((x) => x.k);
      for (const k of shuffle(fresh)) if (queue[queue.length - 1] !== k) queue.push(k);
      if (!fresh.length) break;
    }
    const s: PState = {
      humans,
      bots,
      colors: Object.fromEntries([
        ...players.map((p) => [p.id, p.color]),
        ...bots.map((b, i) => [b.id, free[i % Math.max(1, free.length)] ?? PARTY_COLORS[i % PARTY_COLORS.length]]),
      ]),
      queue,
      round: 0,
      kind: queue[0],
      stage: 'INTRO',
      stageEndsAt: null,
      playStart: null,
      spawnNo: 0,
      spawns: {},
      alive: {},
      out: [],
      finished: [],
      points: {},
      roundPoints: null,
      pushReady: {},
      light: null,
      redBase: null,
      redCheckAt: 0,
      chairs: null,
      snipers: [],
      sniperCount: {},
      hits: {},
      reloadAt: {},
      blindReady: {},
      balls: [],
      nextBallAt: 0,
      ballSeq: 0,
      ballHits: {},
      bestZ: {},
      slams: [],
      nextSlamAt: 0,
      slamSeq: 0,
      spoonPrev: 0,
      spoonHit: {},
      hen: null,
      hold: {},
      dodge: {},
      dashReady: {},
      fake: [],
      broken: [],
      seen: [],
      bomb: null,
      dente: null,
      err: {},
      hex: '',
      hexAt: {},
      hexSent: 0,
      hexDirty: false,
      fruit: null,
      team: {},
      keepers: [null, null],
      score: [0, 0],
      goals: {},
      ball: null,
      vel: {},
      toms: [],
      tomSeq: 0,
      throwReady: {},
      doorReal: [],
      doorOpen: [],
      doorBump: {},
      hitAt: {},
      ext: {},
      tpAt: {},
    };
    beginRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    LAST_CTX.set(s, ctx);
    switch (type) {
      case 'MG_PUSH':
        return doPush(s, ctx, me);
      case 'MG_SIT':
        return trySit(s, ctx, me, Number(payload.i));
      case 'MG_DASH':
        return doDash(s, ctx, me);
      case 'MG_SHOOT':
        return shoot(s, ctx, me, { x: Number(payload.x), y: Number(payload.y), z: Number(payload.z) }, typeof payload.id === 'string' ? payload.id : null);
      case 'MG_ACCECA': {
        // cecchini: chi corre lancia un pomodoro alla torre e acceca un cecchino per un attimo
        if (s.stage !== 'PLAY' || s.kind !== 'SNIPER' || !s.alive[me] || s.snipers.includes(me) || s.finished.includes(me) || !s.snipers.length) return false;
        if (ctx.now < (s.blindReady[me] ?? 0)) return false;
        s.blindReady[me] = ctx.now + 7000;
        const to = s.snipers[Math.floor(Math.random() * s.snipers.length)];
        const p = pos(s, ctx, me);
        ctx.emit('P3_FX', { k: 'acceca', by: me, to, x: p?.x ?? 0, y: (p?.y ?? 0) + 1.6, z: p?.z ?? 0 });
        return false;
      }
      case 'MG_STOP':
        return doStop(s, ctx, me, Number(payload.ms));
      case 'MG_THROW':
        return throwTomato(s, ctx, me, Number(payload.a));
      case 'MG_PROVA': {
        // solo per le prove (console di chi crea la stanza): salta subito a un minigioco
        const k = String(payload.kind ?? '') as MiniKind;
        if (!ctx.canLead(me) || !miniKinds().includes(k) || s.stage === 'END') return false;
        s.queue[s.round] = k;
        beginRound(s, ctx);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me)) return false;
        if (s.stage === 'INTRO') startPlay(s, ctx);
        else if (s.stage === 'RESULT') nextRound(s, ctx);
        else return false;
        return true;
      default: {
        const fn = extOf(s)?.actions?.[type];
        return fn && s.humans.includes(me) ? fn(makeApi(s, ctx), me, payload ?? {}) : false;
      }
    }
  },
  // la sveglia del server: il grosso lo fa p3Tick, questa serve se il giro si è fermato (es. riavvio)
  tick: () => false,
  deadline: (s) => (s.stage === 'END' ? null : (s.stageEndsAt ?? Date.now() + 10_000)),
  p3Tick(s, ctx, dt) {
    LAST_CTX.set(s, ctx);
    const before = `${s.stage}:${s.round}`;
    let changed = false;
    if (s.stage === 'INTRO' && s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      startPlay(s, ctx);
      changed = true;
    } else if (s.stage === 'RESULT' && s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      nextRound(s, ctx);
      changed = true;
    }
    syncArena(s, ctx);
    moveBots(s, ctx, dt);
    if (s.stage === 'PLAY' && playTick(s, ctx, dt)) changed = true;
    return changed || `${s.stage}:${s.round}` !== before;
  },
  view(s, me) {
    return {
      kind: s.kind,
      stage: s.stage,
      round: s.round,
      rounds: s.queue.length,
      queue: s.queue,
      stageEndsAt: s.stageEndsAt,
      playStart: s.playStart,
      roster: everyone(s).map((id) => {
        const b = isBot(s, id);
        return { id, name: b ? b.name : '', color: s.colors[id] ?? '#ffffff', bot: !!b };
      }),
      alive: s.alive,
      out: s.out,
      finished: s.finished,
      points: s.points,
      roundPoints: s.roundPoints,
      spawn: s.spawns[me] ?? null,
      spawnNo: s.spawnNo,
      light: s.light ? { state: s.light.state, endsAt: s.light.endsAt } : null,
      chairs: s.chairs ? { phase: s.chairs.phase, endsAt: s.chairs.endsAt, list: s.chairs.list, giro: s.chairs.giro } : null,
      snipers: s.snipers,
      hits: s.hits,
      reloadAt: s.reloadAt[me] ?? 0,
      balls: s.kind === 'POLPETTE' ? s.balls : [],
      slams: s.kind === 'NONNA' ? s.slams : [],
      henHolder: s.hen?.holder ?? null,
      broken: s.kind === 'PONTE' ? s.broken : [],
      bomb: s.bomb && s.stage === 'PLAY' ? { holder: s.bomb.holder, hot: s.bomb.explodeAt - Date.now() < 3000 } : null,
      dashReadyAt: s.dashReady?.[me] ?? 0,
      hold: Object.fromEntries(Object.entries(s.hold ?? {}).map(([id, v]) => [id, Math.round(v * 10) / 10])),
      dente:
        s.kind === 'DENTE' && s.dente
          ? {
              manche: s.dente.manche,
              manches: DENTE.targets.length,
              target: DENTE.targets[s.dente.manche],
              phase: s.dente.phase,
              startAt: s.dente.startAt,
              endsAt: s.dente.phase === 'REVEAL' ? s.dente.endsAt : null,
              stopped: Object.keys(s.dente.stops),
              // i tempi si vedono solo nella rivelazione (niente sbirciate)
              stops: s.dente.phase === 'REVEAL' ? s.dente.stops : null,
              err: s.err,
            }
          : null,
      hex: s.kind === 'WAFER' ? s.hex : '',
      fruit:
        s.kind === 'FRUTTA' && s.fruit
          ? {
              phase: s.fruit.phase,
              endsAt: s.fruit.endsAt,
              giro: s.fruit.giro,
              target: s.fruit.phase === 'SHOW' ? null : s.fruit.target,
              // mentre è coperta la griglia non si manda proprio
              grid: s.fruit.phase === 'HIDE' ? null : s.fruit.grid,
              open: s.fruit.open,
            }
          : null,
      soccer: s.kind === 'CALCIO' ? { team: s.team, score: s.score, goals: s.goals, kickoffAt: s.ball?.kickoffAt ?? 0 } : null,
      doors: s.kind === 'CORSA' ? s.doorOpen : [],
      throwReadyAt: s.throwReady?.[me] ?? 0,
      ext: viewExt(s, me),
    };
  },
  ids: (s) => s.humans,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (!s.humans.includes(id) || s.stage !== 'PLAY' || !s.alive[id]) return false;
    eliminate(s, ctx, id, 'uscito');
    return true;
  },
  upgrade(s) {
    s.sniperCount ??= {};
    s.blindReady ??= {};
    s.balls ??= [];
    s.ballHits ??= {};
    s.bestZ ??= {};
    s.slams ??= [];
    s.spoonHit ??= {};
    s.hold ??= {};
    s.hen ??= null;
    s.ballSeq ??= 0;
    s.slamSeq ??= 0;
    s.nextBallAt ??= 0;
    s.nextSlamAt ??= 0;
    s.spoonPrev ??= 0;
    s.dodge ??= {};
    s.dashReady ??= {};
    s.fake ??= [];
    s.broken ??= [];
    s.seen ??= [];
    s.bomb ??= null;
    s.dente ??= null;
    s.err ??= {};
    s.hex ??= '';
    s.hexAt ??= {};
    s.hexSent ??= 0;
    s.hexDirty ??= false;
    s.fruit ??= null;
    s.team ??= {};
    s.keepers ??= [null, null];
    s.score ??= [0, 0];
    s.goals ??= {};
    s.ball ??= null;
    s.vel ??= {};
    s.toms ??= [];
    s.tomSeq ??= 0;
    s.throwReady ??= {};
    s.doorReal ??= [];
    s.doorOpen ??= [];
    s.doorBump ??= {};
    s.hitAt ??= {};
    s.ext ??= {};
    s.tpAt ??= {};
    for (const b of s.bots) {
      b.plan ??= 0;
      b.tried ??= [];
      b.memo ??= {};
      b.mem ??= {};
    }
  },
};

export const PARTY3D_MODES: Partial<Record<GameId, Mode<any>>> = { PARTY3D: party3d };
