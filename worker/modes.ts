// Giochi "a moduli" di Axend Games: Passa la bomba, Disegna e indovina, Artista impostore.
// Ogni gioco tiene il suo stato dentro la stanza; il Durable Object chiama queste funzioni.
import type { NetPos } from '../src/data/party3d';
import type { ArtistaView, BombaView, DisegnaView, DrawOp, FeedItem, GameId, GameSettings, ModeView, Player } from '../src/types/game';
import { CATEGORIE, CATEGORIE_SPICY, LETTERE, SILLABE } from '../src/data/bomba';
import { DRAW_WORDS, DRAW_WORDS_SPICY } from '../src/data/disegna';
import { ARTIST_WORDS, ARTIST_WORDS_SPICY } from '../src/data/artista';

export interface Ctx {
  now: number;
  isOnline: (id: string) => boolean;
  canLead: (id: string) => boolean;
  emit: (type: string, payload: unknown, exceptId?: string) => void; // messaggio a tutta la stanza (tranne exceptId)
  storeImage: (dataUrl: string) => { url: string; key: string } | null; // salva una foto JPEG (Smorfie)
  pos: (id: string) => { x: number; y: number } | null; // videogiochi: ultima posizione nota
  teleport: (points: Record<string, { x: number; y: number }>) => void; // videogiochi: sposta i giocatori
  p3get: (id: string) => NetPos | null; // giochi 3D: ultima posizione nota
  p3set: (id: string, p: NetPos) => void; // giochi 3D: posizione decisa dal server (bot, partenze)
  knock: (id: string, v: { vx: number; vy: number; vz: number }) => void; // giochi 3D: spinta a un giocatore
}

export interface Board {
  id: number;
  ops: DrawOp[];
}

export interface Mode<S> {
  start(settings: GameSettings, players: Player[], ctx: Ctx): S;
  action(s: S, me: string, type: string, payload: any, ctx: Ctx): boolean; // true = stato cambiato, da mandare a tutti
  tick(s: S, ctx: Ctx): boolean; // scadenze (sveglia del server)
  deadline(s: S): number | null;
  view(s: S, me: string): ModeView;
  ids(s: S): string[];
  finished(s: S): boolean;
  leave(s: S, id: string, ctx: Ctx): boolean;
  upgrade?(s: S): void;
  p3Tick?(s: S, ctx: Ctx, dt: number): boolean; // giochi 3D: 15 volte al secondo (bot, cadute, fasi) // partite salvate da una versione precedente: aggiunge i campi nuovi
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
// Per confrontare le risposte: minuscole, senza accenti, spazi o apostrofi
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Quante lettere bisogna cambiare per passare da una parola all'altra (per il "ci sei quasi")
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------- Foglio condiviso

const OP_TYPES: DrawOp['t'][] = ['pen', 'line', 'rect', 'ellipse', 'fill', 'clear', 'undo'];
const MAX_OPS = 5000;

export function cleanOp(raw: any): DrawOp | null {
  if (!raw || typeof raw !== 'object' || !OP_TYPES.includes(raw.t)) return null;
  const op: DrawOp = { g: Number.isFinite(raw.g) ? Math.floor(raw.g) : 0, t: raw.t };
  if (typeof raw.c === 'string' && /^#[0-9a-f]{6}$/i.test(raw.c)) op.c = raw.c;
  if (Number.isFinite(raw.w)) op.w = Math.max(1, Math.min(80, Math.round(raw.w)));
  if (Array.isArray(raw.p)) {
    const p = raw.p.slice(0, 600).map(Number);
    if (p.length % 2 || p.some((n: number) => !Number.isFinite(n))) return null;
    op.p = p.map((n: number) => Math.max(-64, Math.min(576, Math.round(n))));
  }
  return op;
}

// Aggiunge un tratto e lo manda subito agli altri (chi disegna lo vede già)
function addOp(board: Board, op: DrawOp, ctx: Ctx, from: string) {
  if (board.ops.length >= MAX_OPS) return;
  board.ops.push(op);
  ctx.emit('DRAW_OP', { board: board.id, index: board.ops.length - 1, op }, from);
}

// ---------------------------------------------------------------- 💣 Passa la bomba

type BombaPrompt = BombaView['prompt'];

interface BombaState {
  spicy?: boolean;
  order: string[];
  lives: Record<string, number>;
  maxLives: number;
  mode: GameSettings['bombaMode'];
  holder: string;
  prompt: BombaPrompt;
  roundStart: number;
  explodeAt: number | null; // segreto: nessuno sa quando scoppia
  nextAt: number | null;
  stage: BombaView['stage'];
  boomVictim: string | null;
  winner: string | null;
  round: number;
  lastPass: number;
  used: string[];
}

const fuse = () => 12_000 + Math.random() * 28_000; // la miccia dura tra 12 e 40 secondi

function bombaPrompt(mode: GameSettings['bombaMode'], used: string[], spicy?: boolean): BombaPrompt {
  const kinds: BombaPrompt['kind'][] =
    mode === 'SILLABE' ? ['SILLABA'] : mode === 'CATEGORIE' ? ['CATEGORIA'] : mode === 'LETTERE' ? ['LETTERA'] : ['SILLABA', 'CATEGORIA', 'CATEGORIA', 'LETTERA'];
  const kind = pick(kinds);
  // 🌶️ piccante: le categorie sgravate escono più spesso di quelle normali
  const cats = spicy ? [...CATEGORIE, ...CATEGORIE_SPICY, ...CATEGORIE_SPICY] : CATEGORIE;
  const list = kind === 'SILLABA' ? SILLABE : kind === 'CATEGORIA' ? cats : LETTERE;
  const fresh = list.filter((x) => !used.includes(x));
  return { kind, text: pick(fresh.length ? fresh : list) };
}

// Il prossimo giocatore ancora in gioco (meglio se collegato)
function nextHolder(s: BombaState, from: string, ctx: Ctx): string {
  const n = s.order.length;
  const i = s.order.indexOf(from);
  for (const needOnline of [true, false]) {
    for (let k = 1; k <= n; k++) {
      const id = s.order[(i + k) % n];
      if (id !== from && s.lives[id] > 0 && (!needOnline || ctx.isOnline(id))) return id;
    }
  }
  return from;
}

function newBombRound(s: BombaState, holder: string, ctx: Ctx) {
  s.prompt = bombaPrompt(s.mode, s.used, s.spicy);
  s.used = [...s.used, s.prompt.text].slice(-120);
  s.holder = holder;
  s.stage = 'LIVE';
  s.roundStart = ctx.now;
  s.explodeAt = ctx.now + fuse();
  s.nextAt = null;
  s.boomVictim = null;
  s.round += 1;
}

// Resta un solo giocatore con delle vite: ha vinto
function checkBombaEnd(s: BombaState): boolean {
  const alive = s.order.filter((id) => s.lives[id] > 0);
  if (alive.length > 1) return false;
  s.stage = 'END';
  s.winner = alive[0] ?? null;
  s.explodeAt = null;
  s.nextAt = null;
  return true;
}

export const bomba: Mode<BombaState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: BombaState = {
      spicy: settings.spicy,
      order,
      lives: Object.fromEntries(order.map((id) => [id, settings.bombaLives])),
      maxLives: settings.bombaLives,
      mode: settings.bombaMode,
      holder: order[0],
      prompt: { kind: 'SILLABA', text: '' },
      roundStart: ctx.now,
      explodeAt: null,
      nextAt: null,
      stage: 'LIVE',
      boomVictim: null,
      winner: null,
      round: 0,
      lastPass: 0,
      used: [],
    };
    newBombRound(s, pick(order), ctx);
    return s;
  },
  action(s, me, type, _payload, ctx) {
    // Solo chi ha la bomba può passarla, e un doppio tocco per sbaglio non la passa due volte
    if (type !== 'MG_PASS' || s.stage !== 'LIVE' || s.holder !== me || ctx.now - s.lastPass < 350) return false;
    s.holder = nextHolder(s, me, ctx);
    s.lastPass = ctx.now;
    return true;
  },
  tick(s, ctx) {
    if (s.stage === 'LIVE' && s.explodeAt && ctx.now >= s.explodeAt) {
      s.lives[s.holder] = Math.max(0, s.lives[s.holder] - 1);
      s.boomVictim = s.holder;
      s.explodeAt = null;
      if (!checkBombaEnd(s)) {
        s.stage = 'BOOM';
        s.nextAt = ctx.now + 5000;
      }
      return true;
    }
    if (s.stage === 'BOOM' && s.nextAt && ctx.now >= s.nextAt) {
      const victim = s.boomVictim ?? s.holder;
      newBombRound(s, s.lives[victim] > 0 ? victim : nextHolder(s, victim, ctx), ctx);
      return true;
    }
    return false;
  },
  deadline: (s) => (s.stage === 'LIVE' ? s.explodeAt : s.stage === 'BOOM' ? s.nextAt : null),
  view: (s) => ({
    stage: s.stage,
    order: s.order,
    lives: s.lives,
    maxLives: s.maxLives,
    holder: s.holder,
    prompt: s.prompt,
    roundStart: s.roundStart,
    round: s.round,
    boomVictim: s.boomVictim,
    winner: s.winner,
  }),
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (!(id in s.lives) || s.stage === 'END') return false;
    s.lives[id] = 0;
    if (checkBombaEnd(s)) return true;
    if (s.holder === id && s.stage === 'LIVE') s.holder = nextHolder(s, id, ctx);
    return true;
  },
};

// ---------------------------------------------------------------- ✏️ Disegna e indovina

interface DisegnaState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  totalRounds: number;
  turn: number;
  guessMs: number;
  stage: DisegnaView['stage'];
  choices: string[];
  word: string;
  stageEndsAt: number | null;
  hintsAt: number[];
  revealed: number[];
  guessed: string[];
  feed: FeedItem[];
  lastGuess: Record<string, number>;
  board: Board;
  words: string[];
  used: string[];
}

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

// Parole del gioco: quelle di base più quelle scritte dal gruppo (che escono più spesso)
function wordPool(settings: GameSettings): string[] {
  const custom = settings.customWords
    .split(/[,\n;]/)
    .map((w) => w.trim().replace(/\s+/g, ' '))
    .filter((w) => w.length >= 2 && w.length <= 30)
    .slice(0, 150);
  if (settings.onlyCustom && custom.length >= 3) return [...new Set(custom)];
  const base = settings.spicy ? [...DRAW_WORDS, ...DRAW_WORDS_SPICY, ...DRAW_WORDS_SPICY, ...DRAW_WORDS_SPICY] : DRAW_WORDS;
  return [...base, ...custom, ...custom];
}

function addFeed(s: DisegnaState, item: FeedItem) {
  s.feed = [...s.feed, item].slice(-30);
}

function beginChoose(s: DisegnaState, ctx: Ctx) {
  const fresh = [...new Set(s.words.filter((w) => !s.used.includes(w)))];
  s.choices = shuffle(fresh.length >= 3 ? fresh : [...new Set(s.words)]).slice(0, 3);
  s.stage = 'CHOOSE';
  s.stageEndsAt = ctx.now + 15_000;
  s.word = '';
  s.guessed = [];
  s.gained = {};
  s.revealed = [];
  s.hintsAt = [];
  s.board = { id: s.board.id + 1, ops: [] };
}

function beginDraw(s: DisegnaState, word: string, ctx: Ctx) {
  s.word = word;
  s.used = [...s.used, word].slice(-300);
  s.choices = [];
  s.stage = 'DRAW';
  s.stageEndsAt = ctx.now + s.guessMs;
  // due indizi (una lettera ciascuno) a metà e a tre quarti del tempo
  s.hintsAt = [...word].filter(isLetter).length >= 4 ? [0.5, 0.75].map((f) => ctx.now + f * s.guessMs) : [];
  addFeed(s, { by: s.order[s.turn], text: '', kind: 'info' });
}

function endTurn(s: DisegnaState, ctx: Ctx) {
  const drawer = s.order[s.turn];
  const bonus = Math.min(200, s.guessed.length * 50); // chi disegna guadagna per ogni giocatore che indovina
  if (bonus) {
    s.scores[drawer] = (s.scores[drawer] ?? 0) + bonus;
    s.gained[drawer] = bonus;
  }
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + 5000;
  s.hintsAt = [];
}

// Passa al prossimo che disegna (salta chi non è collegato); finiti i giri, classifica
function nextTurn(s: DisegnaState, ctx: Ctx) {
  for (let guard = 0; guard <= s.order.length * (s.totalRounds + 1); guard++) {
    s.turn += 1;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      s.round += 1;
    }
    if (s.round > s.totalRounds) break;
    if (ctx.isOnline(s.order[s.turn])) return beginChoose(s, ctx);
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

const pendingGuessers = (s: DisegnaState, ctx: Ctx) =>
  s.order.filter((id) => id !== s.order[s.turn] && ctx.isOnline(id) && !s.guessed.includes(id));

export const disegna: Mode<DisegnaState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: DisegnaState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      round: 1,
      totalRounds: settings.drawRounds,
      turn: 0,
      guessMs: settings.guessSeconds * 1000,
      stage: 'CHOOSE',
      choices: [],
      word: '',
      stageEndsAt: null,
      hintsAt: [],
      revealed: [],
      guessed: [],
      feed: [],
      lastGuess: {},
      board: { id: 0, ops: [] },
      words: wordPool(settings),
      used: [],
    };
    beginChoose(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const drawer = s.order[s.turn];
    switch (type) {
      case 'MG_CHOOSE':
        if (s.stage !== 'CHOOSE' || me !== drawer || !s.choices.includes(payload.word)) return false;
        beginDraw(s, payload.word, ctx);
        return true;
      case 'MG_DRAW': {
        const op = s.stage === 'DRAW' && me === drawer ? cleanOp(payload.op) : null;
        if (op) addOp(s.board, op, ctx, me);
        return false; // il tratto è già arrivato a tutti: nessun aggiornamento generale
      }
      case 'MG_SKIP':
        if (s.stage !== 'DRAW' || me !== drawer) return false;
        endTurn(s, ctx);
        return true;
      case 'MG_GUESS': {
        if (s.stage !== 'DRAW' || me === drawer || !s.order.includes(me) || s.guessed.includes(me)) return false;
        if (ctx.now - (s.lastGuess[me] ?? 0) < 400) return false;
        s.lastGuess[me] = ctx.now;
        const text = String(payload.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const guess = normalize(text);
        const target = normalize(s.word);
        if (!guess) return false;
        if (guess === target) {
          // più veloce = più punti, con un bonus per il primo
          const left = Math.max(0, (s.stageEndsAt ?? ctx.now) - ctx.now) / s.guessMs;
          const points = 50 + Math.round(250 * left) + (s.guessed.length === 0 ? 50 : 0);
          s.scores[me] = (s.scores[me] ?? 0) + points;
          s.gained[me] = points;
          s.guessed.push(me);
          addFeed(s, { by: me, text: '', kind: 'ok' });
          if (!pendingGuessers(s, ctx).length) endTurn(s, ctx);
        } else {
          const close = target.length >= 4 && distance(guess, target) === 1;
          addFeed(s, { by: me, text, kind: close ? 'close' : 'guess' });
        }
        return true;
      }
      default:
        return false;
    }
  },
  tick(s, ctx) {
    let changed = false;
    // Indizio: si scopre una lettera ancora nascosta
    while (s.stage === 'DRAW' && s.hintsAt.length && ctx.now >= s.hintsAt[0]) {
      s.hintsAt.shift();
      const hidden = [...s.word].map((ch, i) => (isLetter(ch) && !s.revealed.includes(i) ? i : -1)).filter((i) => i >= 0);
      if (hidden.length > 1) s.revealed.push(pick(hidden));
      changed = true;
    }
    if (s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      if (s.stage === 'CHOOSE') beginDraw(s, s.choices[0], ctx);
      else if (s.stage === 'DRAW') endTurn(s, ctx);
      else if (s.stage === 'REVEAL') nextTurn(s, ctx);
      changed = true;
    }
    return changed;
  },
  deadline(s) {
    const next = Math.min(s.stageEndsAt ?? Infinity, s.stage === 'DRAW' ? s.hintsAt[0] ?? Infinity : Infinity);
    return next === Infinity ? null : next;
  },
  view(s, me) {
    const drawer = s.order[s.turn];
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const knows = me === drawer || open || s.guessed.includes(me);
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      round: s.round,
      totalRounds: s.totalRounds,
      drawer,
      stageEndsAt: s.stageEndsAt,
      mask: s.stage === 'CHOOSE' ? [] : [...s.word].map((ch, i) => (!isLetter(ch) ? ch : open || s.revealed.includes(i) ? ch.toUpperCase() : null)),
      word: s.stage !== 'CHOOSE' && knows ? s.word : null,
      choices: me === drawer && s.stage === 'CHOOSE' ? s.choices : null,
      guessed: s.guessed,
      feed: s.feed.map((f) => (f.kind === 'close' && f.by !== me ? { ...f, text: '' } : f)), // il "quasi" lo vede solo chi l'ha scritto
      board: { id: s.board.id, count: s.board.ops.length },
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    if (s.order[s.turn] === id && s.stage === 'CHOOSE') {
      nextTurn(s, ctx);
      return true;
    }
    if (s.order[s.turn] === id && s.stage === 'DRAW') {
      endTurn(s, ctx);
      return true;
    }
    if (s.stage === 'DRAW' && s.guessed.length && !pendingGuessers(s, ctx).length) {
      endTurn(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🖌️ Artista impostore

interface ArtistaState {
  order: string[];
  colors: Record<string, string>;
  impostor: string;
  category: string;
  word: string;
  lap: number;
  laps: number;
  turn: number;
  stage: ArtistaView['stage'];
  turnEndsAt: number | null;
  board: Board;
  confirmations: string[];
  strokeG: number | null;
}

const ARTIST_COLORS = ['#e53935', '#1e88e5', '#43a047', '#ff8a1f', '#8e24aa', '#ff5fb0', '#8b5a2b', '#1b1b1f', '#00acc1', '#c0ca33', '#3949ab', '#d81b60', '#00897b', '#f4511e', '#6d4c41', '#7cb342'];
const TURN_MS = 30_000;

function nextArtist(s: ArtistaState, ctx: Ctx) {
  s.strokeG = null;
  for (let guard = 0; guard <= s.order.length * s.laps; guard++) {
    s.turn += 1;
    if (s.turn >= s.order.length) {
      s.turn = 0;
      s.lap += 1;
    }
    if (s.lap >= s.laps) break;
    if (ctx.isOnline(s.order[s.turn])) {
      s.turnEndsAt = ctx.now + TURN_MS;
      return;
    }
  }
  s.stage = 'VOTE';
  s.turnEndsAt = null;
}

function checkVote(s: ArtistaState, ctx: Ctx) {
  if (s.order.every((id) => !ctx.isOnline(id) || s.confirmations.includes(id))) s.stage = 'END';
}

export const artista: Mode<ArtistaState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const spicy = Object.entries(ARTIST_WORDS_SPICY);
    // 🌶️ piccante: una partita su due esce la categoria sgravata
    const [category, words] = settings.spicy && Math.random() < 0.5 ? pick(spicy) : pick(Object.entries(ARTIST_WORDS));
    return {
      order,
      colors: Object.fromEntries(order.map((id, i) => [id, ARTIST_COLORS[i % ARTIST_COLORS.length]])),
      impostor: pick(order.slice(1)), // chi apre il disegno non è mai l'impostore
      category,
      word: pick(words),
      lap: 0,
      laps: 2,
      turn: 0,
      stage: 'DRAW',
      turnEndsAt: ctx.now + TURN_MS,
      board: { id: 1, ops: [] },
      confirmations: [],
      strokeG: null,
    };
  },
  action(s, me, type, payload, ctx) {
    const drawer = s.order[s.turn];
    switch (type) {
      case 'MG_DRAW': {
        const op = s.stage === 'DRAW' && me === drawer ? cleanOp(payload.op) : null;
        if (!op || op.t !== 'pen' || (s.strokeG !== null && op.g !== s.strokeG)) return false; // un solo tratto a testa
        s.strokeG = op.g;
        op.c = s.colors[me]; // ognuno disegna con il suo colore
        op.w = 10;
        addOp(s.board, op, ctx, me);
        return false;
      }
      case 'MG_STROKE_END':
        if (s.stage !== 'DRAW' || me !== drawer || s.strokeG === null) return false;
        nextArtist(s, ctx);
        return true;
      case 'MG_CONFIRM':
        if (s.stage !== 'VOTE' || !s.order.includes(me)) return false;
        s.confirmations = toggle(s.confirmations, me);
        checkVote(s, ctx);
        return true;
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        s.stage = 'END';
        s.turnEndsAt = null;
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (s.stage === 'DRAW' && s.turnEndsAt && ctx.now >= s.turnEndsAt) {
      nextArtist(s, ctx); // tempo scaduto: tocca al prossimo
      return true;
    }
    return false;
  },
  deadline: (s) => (s.stage === 'DRAW' ? s.turnEndsAt : null),
  view(s, me) {
    const end = s.stage === 'END';
    return {
      stage: s.stage,
      order: s.order,
      colors: s.colors,
      drawer: s.stage === 'DRAW' ? s.order[s.turn] : null,
      lap: s.lap,
      laps: s.laps,
      turnEndsAt: s.turnEndsAt,
      category: s.category,
      word: me !== s.impostor || end ? s.word : null,
      isImpostor: me === s.impostor,
      impostor: end ? s.impostor : null,
      confirmations: s.confirmations,
      board: { id: s.board.id, count: s.board.ops.length },
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'DRAW' && s.order[s.turn] === id) {
      nextArtist(s, ctx);
      return true;
    }
    if (s.stage === 'VOTE') {
      checkVote(s, ctx);
      return true;
    }
    return false;
  },
};

export const MODES: Partial<Record<GameId, Mode<any>>> = { BOMBA: bomba, DISEGNA: disegna, ARTISTA: artista };
