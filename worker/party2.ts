// Altri giochi di Axend Games: Teatrino, Smorfie, Dadi bugiardi, Gioco dell'Oca pazza, Non ridere!
import type { DadiBid, DadiView, GameId, NonRidereView, OcaEvent, OcaView, SmorfieView, TeatrinoView } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import { deck, shuffle } from './party';
import { FRASI_TEATRO, FRASI_TEATRO_SPICY, STILI, STILI_SPICY } from '../src/data/teatrino';
import { SMORFIE, SMORFIE_SPICY } from '../src/data/smorfie';
import { MISSIONI, MISSIONI_SPICY } from '../src/data/missioni';
import { OCA_BOARD, OCA_BRIDGE_TO, OCA_END } from '../src/data/oca';

const add = (scores: Record<string, number>, gained: Record<string, number>, id: string, points: number) => {
  if (!points) return;
  scores[id] = (scores[id] ?? 0) + points;
  gained[id] = (gained[id] ?? 0) + points;
};
const asChoice = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < max ? (v as number) : null);

// ---------------------------------------------------------------- 🎭 Teatrino

interface TeatrinoState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  turn: number;
  turnCount: number;
  actor: string;
  phrase: string;
  options: string[];
  answer: number;
  stage: TeatrinoView['stage'];
  stageEndsAt: number | null;
  guesses: Record<string, number>;
  phrases: string[];
  styles: string[];
}

const ACT_MS = 45_000;
const TEATRO_REVEAL_MS = 7_000;

function teatroTurn(s: TeatrinoState, ctx: Ctx) {
  for (s.turn += 1; s.turn < s.turnCount; s.turn++) {
    const actor = s.order[s.turn % s.order.length];
    if (!ctx.isOnline(actor)) continue;
    s.actor = actor;
    s.phrase = s.phrases[s.turn % s.phrases.length];
    // sei stili diversi, presi a rotazione dal mazzo mescolato
    s.options = Array.from({ length: 6 }, (_, i) => s.styles[(s.turn * 6 + i) % s.styles.length]);
    s.answer = Math.floor(Math.random() * 6);
    s.guesses = {};
    s.gained = {};
    s.stage = 'ACT';
    s.stageEndsAt = ctx.now + ACT_MS;
    return;
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

const teatroGuessers = (s: TeatrinoState, ctx: Ctx) => s.order.filter((id) => id !== s.actor && ctx.isOnline(id));

function teatroReveal(s: TeatrinoState, ctx: Ctx) {
  s.gained = {};
  let right = 0;
  for (const [id, g] of Object.entries(s.guesses)) {
    if (g !== s.answer) continue;
    add(s.scores, s.gained, id, 100);
    right++;
  }
  add(s.scores, s.gained, s.actor, 50 * right); // chi recita bene fa indovinare tanti
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + TEATRO_REVEAL_MS;
}

export const teatrino: Mode<TeatrinoState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: TeatrinoState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      turn: -1,
      turnCount: order.length * settings.teatroLaps,
      actor: order[0],
      phrase: '',
      options: [],
      answer: 0,
      stage: 'ACT',
      stageEndsAt: null,
      guesses: {},
      phrases: deck(FRASI_TEATRO, FRASI_TEATRO_SPICY, settings.spicy),
      styles: deck(STILI, STILI_SPICY, settings.spicy),
    };
    teatroTurn(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_PICK') {
      const choice = asChoice(payload.choice, s.options.length);
      if (s.stage !== 'ACT' || choice === null || me === s.actor || !s.order.includes(me) || me in s.guesses) return false;
      s.guesses[me] = choice;
      if (teatroGuessers(s, ctx).every((id) => id in s.guesses)) teatroReveal(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'ACT') teatroReveal(s, ctx);
      else teatroTurn(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'ACT') teatroReveal(s, ctx);
    else teatroTurn(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const reveal = s.stage === 'REVEAL';
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      actor: s.stage === 'END' ? null : s.actor,
      turnNo: Math.min(s.turn + 1, s.turnCount),
      turnCount: s.turnCount,
      phrase: s.phrase,
      options: s.options,
      myStyle: s.stage === 'ACT' && me === s.actor ? s.answer : null,
      answer: reveal ? s.answer : null,
      guessed: Object.keys(s.guesses),
      myGuess: s.guesses[me] ?? null,
      guesses: reveal ? s.guesses : null,
      stageEndsAt: s.stageEndsAt,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage !== 'ACT') return false;
    if (id === s.actor) teatroTurn(s, ctx);
    else if (Object.keys(s.guesses).length && teatroGuessers(s, ctx).every((g) => g in s.guesses)) teatroReveal(s, ctx);
    else return false;
    return true;
  },
};

// ---------------------------------------------------------------- 🤳 Smorfie

interface SmorfieState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  totalRounds: number;
  stage: SmorfieView['stage'];
  stageEndsAt: number | null;
  prompts: Record<string, string>;
  photos: Record<string, string>;
  queue: string[];
  current: number;
  options: string[];
  answer: number;
  guesses: Record<string, number>;
  album: { by: string; url: string; prompt: string }[];
  imageKeys: string[]; // foto da cancellare a fine partita
  cards: string[];
  cardPos: number;
}

const SHOOT_MS = 75_000;
const PHOTO_GUESS_MS = 25_000;
const PHOTO_REVEAL_MS = 6_000;
const MAX_PHOTO = 600_000;

const nextCard = (s: SmorfieState) => s.cards[s.cardPos++ % s.cards.length];

function smorfieRound(s: SmorfieState, ctx: Ctx) {
  const players = s.order.filter((id) => ctx.isOnline(id));
  if (s.round >= s.totalRounds || players.length < 2) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.round += 1;
  s.prompts = Object.fromEntries(players.map((id) => [id, nextCard(s)]));
  s.photos = {};
  s.queue = [];
  s.current = -1;
  s.gained = {};
  s.stage = 'SHOOT';
  s.stageEndsAt = ctx.now + SHOOT_MS;
}

const photoGuessers = (s: SmorfieState, ctx: Ctx) => s.order.filter((id) => id !== s.queue[s.current] && ctx.isOnline(id));

// Prossima foto da indovinare: la sua situazione mescolata a quelle degli altri (più qualche intrusa)
function smorfieNextPhoto(s: SmorfieState, ctx: Ctx) {
  s.current += 1;
  if (s.current >= s.queue.length) return smorfieRound(s, ctx);
  const owner = s.queue[s.current];
  const truth = s.prompts[owner];
  const others = shuffle(Object.values(s.prompts).filter((p) => p !== truth)).slice(0, 4);
  for (let tries = 0; others.length < 3 && tries < 30; tries++) {
    const extra = nextCard(s); // poche persone: si aggiunge qualche situazione intrusa
    if (extra !== truth && !others.includes(extra)) others.push(extra);
  }
  s.options = shuffle([truth, ...others]);
  s.answer = s.options.indexOf(truth);
  s.guesses = {};
  s.gained = {};
  s.stage = 'GUESS';
  s.stageEndsAt = ctx.now + PHOTO_GUESS_MS;
  if (!photoGuessers(s, ctx).length) smorfieReveal(s, ctx);
}

function smorfieReveal(s: SmorfieState, ctx: Ctx) {
  const owner = s.queue[s.current];
  s.gained = {};
  let right = 0;
  for (const [id, g] of Object.entries(s.guesses)) {
    if (g !== s.answer) continue;
    add(s.scores, s.gained, id, 100);
    right++;
  }
  add(s.scores, s.gained, owner, 50 * right); // faccia riconoscibile = punti anche per chi l'ha fatta
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + PHOTO_REVEAL_MS;
}

function smorfieGuessing(s: SmorfieState, ctx: Ctx) {
  s.queue = shuffle(Object.keys(s.photos));
  s.current = -1;
  smorfieNextPhoto(s, ctx);
}

const missingPhotos = (s: SmorfieState, ctx: Ctx) => Object.keys(s.prompts).filter((id) => ctx.isOnline(id) && !(id in s.photos));

function smorfieAdvance(s: SmorfieState, ctx: Ctx) {
  if (s.stage === 'SHOOT') smorfieGuessing(s, ctx);
  else if (s.stage === 'GUESS') smorfieReveal(s, ctx);
  else if (s.stage === 'REVEAL') smorfieNextPhoto(s, ctx);
}

export const smorfie: Mode<SmorfieState> = {
  start(settings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: SmorfieState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      round: 0,
      totalRounds: settings.smorfieRounds,
      stage: 'SHOOT',
      stageEndsAt: null,
      prompts: {},
      photos: {},
      queue: [],
      current: -1,
      options: [],
      answer: 0,
      guesses: {},
      album: [],
      imageKeys: [],
      cards: deck(SMORFIE, SMORFIE_SPICY, settings.spicy),
      cardPos: 0,
    };
    smorfieRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    switch (type) {
      case 'MG_PHOTO': {
        if (s.stage !== 'SHOOT' || !(me in s.prompts) || me in s.photos) return false;
        const image = String(payload.image ?? '');
        if (image.length > MAX_PHOTO || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)) return false;
        const saved = ctx.storeImage(image);
        if (!saved) return false;
        s.photos[me] = saved.url;
        s.imageKeys.push(saved.key);
        s.album.push({ by: me, url: saved.url, prompt: s.prompts[me] });
        if (!missingPhotos(s, ctx).length) smorfieGuessing(s, ctx);
        return true;
      }
      case 'MG_PICK': {
        const choice = asChoice(payload.choice, s.options.length);
        if (s.stage !== 'GUESS' || choice === null || me === s.queue[s.current] || !s.order.includes(me) || me in s.guesses) return false;
        s.guesses[me] = choice;
        if (photoGuessers(s, ctx).every((id) => id in s.guesses)) smorfieReveal(s, ctx);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        smorfieAdvance(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    smorfieAdvance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const showing = s.stage === 'GUESS' || s.stage === 'REVEAL';
    const owner = showing ? s.queue[s.current] : null;
    const reveal = s.stage === 'REVEAL';
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      round: s.round,
      totalRounds: s.totalRounds,
      stageEndsAt: s.stageEndsAt,
      myPrompt: s.stage === 'SHOOT' ? s.prompts[me] ?? null : null,
      shooters: Object.keys(s.prompts),
      sent: Object.keys(s.photos),
      owner,
      photo: owner ? s.photos[owner] : null,
      photoNo: s.current + 1,
      photoCount: s.queue.length,
      options: showing ? s.options : [],
      guessed: showing ? Object.keys(s.guesses) : [],
      myGuess: showing ? s.guesses[me] ?? null : null,
      answer: reveal ? s.answer : null,
      guesses: reveal ? s.guesses : null,
      album: s.stage === 'END' ? s.album : null,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, _id, ctx) {
    if (s.stage === 'SHOOT' && Object.keys(s.photos).length && !missingPhotos(s, ctx).length) {
      smorfieGuessing(s, ctx);
      return true;
    }
    if (s.stage === 'GUESS' && photoGuessers(s, ctx).every((id) => id in s.guesses)) {
      smorfieReveal(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🎲 Dadi bugiardi

interface DadiState {
  order: string[];
  counts: Record<string, number>;
  dice: Record<string, number[]>;
  current: number;
  bid: DadiBid | null;
  history: DadiBid[];
  stage: DadiView['stage'];
  stageEndsAt: number | null;
  reveal: DadiView['reveal'];
  round: number;
  winner: string | null;
  starter: string;
}

const BID_MS = 35_000;
const DICE_REVEAL_MS = 9_000;

const alive = (s: DadiState) => s.order.filter((id) => s.counts[id] > 0);
const diceInPlay = (s: DadiState) => Object.values(s.dice).reduce((n, d) => n + d.length, 0);
const roll = () => 1 + Math.floor(Math.random() * 6);

// Il prossimo ancora in gioco (meglio se collegato)
function nextAlive(s: DadiState, from: number, ctx: Ctx): number {
  const n = s.order.length;
  for (const needOnline of [true, false]) {
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      const id = s.order[i];
      if (s.counts[id] > 0 && (!needOnline || ctx.isOnline(id))) return i;
    }
  }
  return from;
}

function dadiRound(s: DadiState, ctx: Ctx) {
  s.round += 1;
  s.bid = null;
  s.history = [];
  s.reveal = null;
  s.dice = Object.fromEntries(s.order.map((id) => [id, Array.from({ length: s.counts[id] }, roll).sort((a, b) => a - b)]));
  const i = s.order.indexOf(s.starter);
  s.current = s.counts[s.starter] > 0 && ctx.isOnline(s.starter) ? i : nextAlive(s, i, ctx);
  s.stage = 'BID';
  s.stageEndsAt = ctx.now + BID_MS;
}

// "Dubito!": si scoprono i dadi. Gli 1 sono jolly e valgono per qualsiasi faccia
function dadiDoubt(s: DadiState, caller: string, ctx: Ctx) {
  const bid = s.bid!;
  const total = Object.values(s.dice)
    .flat()
    .filter((d) => d === bid.f || d === 1).length;
  const loser = total >= bid.q ? caller : bid.by;
  s.counts[loser] = Math.max(0, s.counts[loser] - 1);
  s.reveal = { caller, bidder: bid.by, q: bid.q, f: bid.f, total, loser };
  s.starter = s.counts[loser] > 0 ? loser : s.order[nextAlive(s, s.order.indexOf(loser), ctx)];
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + DICE_REVEAL_MS;
}

function dadiAfterReveal(s: DadiState, ctx: Ctx) {
  const left = alive(s);
  if (left.length <= 1) {
    s.stage = 'END';
    s.stageEndsAt = null;
    s.winner = left[0] ?? null;
  } else dadiRound(s, ctx);
}

function dadiBid(s: DadiState, by: string, q: number, f: number, ctx: Ctx) {
  s.bid = { q, f, by };
  s.history = [...s.history, s.bid].slice(-8);
  s.current = nextAlive(s, s.current, ctx);
  s.stageEndsAt = ctx.now + BID_MS;
}

// Tempo scaduto: se c'è una scommessa si dubita, altrimenti si apre con la più bassa
function dadiTimeout(s: DadiState, ctx: Ctx) {
  const me = s.order[s.current];
  if (s.bid) dadiDoubt(s, me, ctx);
  else dadiBid(s, me, 1, 2 + Math.floor(Math.random() * 5), ctx);
}

export const dadi: Mode<DadiState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: DadiState = {
      order,
      counts: Object.fromEntries(order.map((id) => [id, settings.diceCount])),
      dice: {},
      current: 0,
      bid: null,
      history: [],
      stage: 'BID',
      stageEndsAt: null,
      reveal: null,
      round: 0,
      winner: null,
      starter: order[0],
    };
    dadiRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const myTurn = s.stage === 'BID' && s.order[s.current] === me;
    switch (type) {
      case 'MG_BID': {
        const q = Number(payload.q);
        const f = Number(payload.f);
        if (!myTurn || !Number.isInteger(q) || !Number.isInteger(f) || f < 2 || f > 6 || q < 1 || q > diceInPlay(s)) return false;
        // si rilancia: più dadi, oppure stessi dadi con una faccia più alta
        if (s.bid && !(q > s.bid.q || (q === s.bid.q && f > s.bid.f))) return false;
        dadiBid(s, me, q, f, ctx);
        return true;
      }
      case 'MG_DOUBT':
        if (!myTurn || !s.bid) return false;
        dadiDoubt(s, me, ctx);
        return true;
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        if (s.stage === 'BID') dadiTimeout(s, ctx);
        else dadiAfterReveal(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'BID') dadiTimeout(s, ctx);
    else dadiAfterReveal(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const open = s.stage !== 'BID';
    return {
      stage: s.stage,
      order: s.order,
      counts: s.counts,
      myDice: s.dice[me] ?? [],
      allDice: open ? s.dice : null,
      current: s.stage === 'BID' ? s.order[s.current] : null,
      bid: s.bid,
      history: s.history,
      totalDice: diceInPlay(s),
      stageEndsAt: s.stageEndsAt,
      reveal: s.reveal,
      round: s.round,
      winner: s.winner,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (!(id in s.counts) || s.stage === 'END') return false;
    s.counts[id] = 0;
    if (alive(s).length <= 1) {
      dadiAfterReveal(s, ctx);
      return true;
    }
    if (s.stage === 'BID' && s.order[s.current] === id) s.current = nextAlive(s, s.current, ctx);
    return true;
  },
};

// ---------------------------------------------------------------- 🦢 Gioco dell'Oca pazza

interface OcaState {
  order: string[];
  pos: Record<string, number>;
  skip: Record<string, number>;
  current: number;
  stage: OcaView['stage'];
  stageEndsAt: number | null;
  roll: number | null;
  rollNo: number;
  moveNo: number;
  mover: string | null;
  path: number[];
  events: OcaEvent[];
  dare: { text: string; by: string; votes: Record<string, 0 | 1> } | null;
  pendingDare: boolean;
  winner: string | null;
  missions: string[];
  missionPos: number;
}

const OCA_ROLL_MS = 20_000;
const OCA_DARE_MS = 45_000;
const OCA_STEP_MS = 320;

// Muove una pedina passo passo (per l'animazione), poi applica le caselle speciali
function ocaMove(s: OcaState, id: string, steps: number, ctx: Ctx) {
  let p = s.pos[id];
  const path: number[] = [];
  const events: OcaEvent[] = [];
  // si arriva anche superando il traguardo (partite più veloci)
  const walk = (n: number) => {
    const dir = Math.sign(n);
    for (let k = 0; k < Math.abs(n) && !(dir > 0 && p === OCA_END); k++) {
      p = Math.max(0, p + dir);
      path.push(p);
    }
  };
  walk(steps);
  let dare = false;
  for (let guard = 0; guard < 8 && p !== OCA_END; guard++) {
    const square = OCA_BOARD[p];
    if (!square) break;
    events.push({ t: square });
    if (square === 'OCA') walk(steps);
    else if (square === 'RAZZO') walk(4);
    else if (square === 'BUCCIA') walk(-3);
    else if (square === 'LABIRINTO') walk(-6);
    else if (square === 'PONTE') {
      p = OCA_BRIDGE_TO;
      path.push(p);
    } else {
      if (square === 'SCHELETRO') {
        p = 0;
        path.push(p);
      } else if (square === 'OSTERIA') s.skip[id] = 1;
      else if (square === 'POZZO') s.skip[id] = 2;
      else if (square === 'SFIDA') dare = true;
      else if (square === 'SCAMBIO') {
        // scambio con chi è più avanti (se sei tu il primo, con l'ultimo)
        const others = s.order.filter((o) => o !== id);
        const leader = others.reduce((a, b) => (s.pos[b] > s.pos[a] ? b : a), others[0]);
        const last = others.reduce((a, b) => (s.pos[b] < s.pos[a] ? b : a), others[0]);
        const other = s.pos[leader] > p ? leader : last;
        if (other && s.pos[other] !== p) {
          const mine = p;
          p = s.pos[other];
          s.pos[other] = mine;
          path.push(p);
          events[events.length - 1] = { t: 'SCAMBIO', with: other };
        }
      }
      break;
    }
  }
  s.pos[id] = p;
  if (p === OCA_END) {
    s.winner = id;
    events.push({ t: 'WIN' });
  }
  s.mover = id;
  s.moveNo += 1;
  s.path = path;
  s.events = events;
  s.pendingDare = dare && p !== OCA_END;
  s.stage = 'MOVE';
  s.stageEndsAt = ctx.now + path.length * OCA_STEP_MS + 1800;
}

// Il turno passa al prossimo collegato (chi è all'osteria o nel pozzo salta)
function ocaNextTurn(s: OcaState, ctx: Ctx) {
  const n = s.order.length;
  for (let k = 1; k <= n * 3; k++) {
    const i = (s.current + k) % n;
    const id = s.order[i];
    if (!ctx.isOnline(id)) continue;
    if (s.skip[id] > 0) {
      s.skip[id] -= 1;
      continue;
    }
    s.current = i;
    s.stage = 'ROLL';
    s.stageEndsAt = ctx.now + OCA_ROLL_MS;
    s.dare = null;
    return;
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

function ocaRoll(s: OcaState, ctx: Ctx) {
  s.roll = 1 + Math.floor(Math.random() * 6);
  s.rollNo += 1;
  s.dare = null;
  ocaMove(s, s.order[s.current], s.roll, ctx);
}

// Fine dell'animazione: vittoria, sfida o turno del prossimo
function ocaAfterMove(s: OcaState, ctx: Ctx) {
  if (s.winner) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  if (s.pendingDare) {
    s.pendingDare = false;
    s.dare = { text: s.missions[s.missionPos++ % s.missions.length], by: s.mover!, votes: {} };
    s.stage = 'DARE';
    s.stageEndsAt = ctx.now + OCA_DARE_MS;
    return;
  }
  ocaNextTurn(s, ctx);
}

const dareVoters = (s: OcaState, ctx: Ctx) => s.order.filter((id) => id !== s.dare?.by && ctx.isOnline(id));

// Il gruppo ha votato la sfida: bravo = avanti di 3, che pena = indietro di 3 (pareggio: vince la simpatia)
function ocaDareResult(s: OcaState, ctx: Ctx) {
  const dare = s.dare!;
  const votes = Object.values(dare.votes);
  const ok = votes.filter((v) => v === 1).length >= votes.filter((v) => v === 0).length;
  ocaMove(s, dare.by, ok ? 3 : -3, ctx);
  s.events = [{ t: ok ? 'DARE_OK' : 'DARE_KO' }, ...s.events];
}

export const oca: Mode<OcaState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    return {
      order,
      pos: Object.fromEntries(order.map((id) => [id, 0])),
      skip: Object.fromEntries(order.map((id) => [id, 0])),
      current: 0,
      stage: 'ROLL',
      stageEndsAt: ctx.now + OCA_ROLL_MS,
      roll: null,
      rollNo: 0,
      moveNo: 0,
      mover: null,
      path: [],
      events: [],
      dare: null,
      pendingDare: false,
      winner: null,
      missions: deck(MISSIONI, MISSIONI_SPICY, settings.spicy),
      missionPos: 0,
    };
  },
  action(s, me, type, payload, ctx) {
    switch (type) {
      case 'MG_ROLL':
        if (s.stage !== 'ROLL' || s.order[s.current] !== me) return false;
        ocaRoll(s, ctx);
        return true;
      case 'MG_VOTE': {
        const choice = payload.choice === 0 || payload.choice === 1 ? (payload.choice as 0 | 1) : null;
        if (s.stage !== 'DARE' || !s.dare || choice === null || me === s.dare.by || !s.order.includes(me)) return false;
        s.dare.votes[me] = choice;
        if (dareVoters(s, ctx).every((id) => id in s.dare!.votes)) ocaDareResult(s, ctx);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        if (s.stage === 'ROLL') ocaRoll(s, ctx);
        else if (s.stage === 'DARE') ocaDareResult(s, ctx);
        else ocaAfterMove(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'ROLL') ocaRoll(s, ctx); // tiro automatico
    else if (s.stage === 'MOVE') ocaAfterMove(s, ctx);
    else if (s.stage === 'DARE') ocaDareResult(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    const dare = s.dare;
    const votes = dare ? Object.values(dare.votes) : [];
    return {
      stage: s.stage,
      order: s.order,
      pos: s.pos,
      skip: s.skip,
      current: s.stage === 'END' ? null : s.order[s.current],
      roll: s.roll,
      rollNo: s.rollNo,
      moveNo: s.moveNo,
      mover: s.mover,
      path: s.path,
      events: s.events,
      dare: dare && s.stage === 'DARE' ? { text: dare.text, by: dare.by, yes: votes.filter((v) => v === 1).length, no: votes.filter((v) => v === 0).length, voters: s.order.filter((id) => id !== dare.by).length } : null,
      myVote: dare && me in dare.votes ? dare.votes[me] : null,
      stageEndsAt: s.stageEndsAt,
      winner: s.winner,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END') return false;
    if (s.stage === 'DARE' && s.dare?.by === id) {
      ocaNextTurn(s, ctx);
      return true;
    }
    if (s.stage === 'DARE' && dareVoters(s, ctx).every((v) => v in s.dare!.votes)) {
      ocaDareResult(s, ctx);
      return true;
    }
    if (s.stage === 'ROLL' && s.order[s.current] === id) {
      ocaNextTurn(s, ctx);
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 🙊 Non ridere!

interface NonRidereState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  turn: number;
  turnCount: number;
  comico: string;
  mission: string;
  stage: NonRidereView['stage'];
  stageEndsAt: number | null;
  laughed: string[];
  missions: string[];
}

const NR_ACT_MS = 40_000;
const NR_MARK_MS = 20_000;
const NR_REVEAL_MS = 6_000;

function nrTurn(s: NonRidereState, ctx: Ctx) {
  for (s.turn += 1; s.turn < s.turnCount; s.turn++) {
    const comico = s.order[s.turn % s.order.length];
    if (!ctx.isOnline(comico)) continue;
    s.comico = comico;
    s.mission = s.missions[s.turn % s.missions.length];
    s.laughed = [];
    s.gained = {};
    s.stage = 'ACT';
    s.stageEndsAt = ctx.now + NR_ACT_MS;
    return;
  }
  s.stage = 'END';
  s.stageEndsAt = null;
}

// Il comico prende 100 punti per ogni risata, chi resta serio ne prende 50
function nrReveal(s: NonRidereState, ids: string[], ctx: Ctx) {
  s.laughed = ids.filter((id, i) => id !== s.comico && s.order.includes(id) && ids.indexOf(id) === i);
  s.gained = {};
  add(s.scores, s.gained, s.comico, 100 * s.laughed.length);
  for (const id of s.order) if (id !== s.comico && ctx.isOnline(id) && !s.laughed.includes(id)) add(s.scores, s.gained, id, 50);
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + NR_REVEAL_MS;
}

function nrAdvance(s: NonRidereState, ctx: Ctx) {
  if (s.stage === 'ACT') {
    s.stage = 'MARK';
    s.stageEndsAt = ctx.now + NR_MARK_MS;
  } else if (s.stage === 'MARK') nrReveal(s, [], ctx);
  else if (s.stage === 'REVEAL') nrTurn(s, ctx);
}

export const nonridere: Mode<NonRidereState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const s: NonRidereState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      turn: -1,
      turnCount: order.length * settings.nrLaps,
      comico: order[0],
      mission: '',
      stage: 'ACT',
      stageEndsAt: null,
      laughed: [],
      missions: deck(MISSIONI, MISSIONI_SPICY, settings.spicy),
    };
    nrTurn(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    switch (type) {
      case 'MG_DONE':
        if (s.stage !== 'ACT' || me !== s.comico) return false;
        nrAdvance(s, ctx);
        return true;
      case 'MG_MARK':
        if (s.stage !== 'MARK' || me !== s.comico || !Array.isArray(payload.ids)) return false;
        nrReveal(s, payload.ids.map(String), ctx);
        return true;
      case 'MG_FORCE':
        if (!ctx.canLead(me) || s.stage === 'END') return false;
        nrAdvance(s, ctx);
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    nrAdvance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me) {
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      comico: s.stage === 'END' ? null : s.comico,
      turnNo: Math.min(s.turn + 1, s.turnCount),
      turnCount: s.turnCount,
      // la missione è una sorpresa: gli altri la scoprono solo dopo
      mission: s.stage === 'END' ? null : s.stage !== 'ACT' || me === s.comico ? s.mission : null,
      stageEndsAt: s.stageEndsAt,
      laughed: s.stage === 'REVEAL' ? s.laughed : [],
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if ((s.stage === 'ACT' || s.stage === 'MARK') && id === s.comico) {
      nrTurn(s, ctx);
      return true;
    }
    return false;
  },
};

export const PARTY2_MODES: Partial<Record<GameId, Mode<any>>> = {
  TEATRINO: teatrino,
  SMORFIE: smorfie,
  DADI: dadi,
  OCA: oca,
  NONRIDERE: nonridere,
};
