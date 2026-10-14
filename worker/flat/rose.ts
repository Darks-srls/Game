// 🌹 Rose e teschi: ognuno ha 4 sottobicchieri (3 rose e 1 teschio). Si mettono coperti sulla propria pila,
// poi un'asta: chi la vince deve girare N dischi (prima i suoi, dall'alto) senza trovare teschi.
import type { GameSettings, Player } from '../../src/types/game';
import { ROSE_WIN_POINTS, type Disc, type RoseLog, type RoseSeat, type RoseView } from '../../src/data/flat/rose';
import type { Ctx, Mode } from '../modes';
import { registerFlat } from './registry';

const PLACE_MS = 20_000;
const PLAY_MS = 30_000;
const BID_MS = 25_000;
const CHOOSE_MS = 20_000;
const FLIP_FIRST_MS = 1_800; // pausa prima di girare il primo disco (suspense)
const FLIP_STEP_MS = 1_100;
const RESULT_MS = 7_000;
const AFK_MS = 10_000; // chi ha già fatto scadere il tempo: mosse automatiche veloci
const OFFLINE_MS = 3_000;

interface RoseState {
  order: string[];
  roses: Record<string, number>; // rose possedute (mano + pila)
  skull: Record<string, boolean>; // ha ancora il teschio
  stacks: Record<string, Disc[]>; // pile sul tavolo, dal basso all'alto
  flips: Record<string, number>; // dischi girati dall'alto in ogni pila
  points: Record<string, number>;
  out: string[]; // eliminati (o usciti), nell'ordine in cui sono usciti
  afk: string[];
  round: number;
  starter: string;
  stage: RoseView['stage'];
  stageEndsAt: number | null;
  stageMs: number;
  turn: string | null;
  placed: string[];
  bid: { by: string; n: number } | null;
  bids: { by: string; n: number }[];
  passed: string[];
  flipper: string | null;
  ownLeft: number; // dischi suoi che chi sfida deve ancora girare (in automatico)
  choosing: boolean;
  result: RoseView['result'];
  lost: { id: string; disc: Disc } | null; // il disco perso lo sa solo chi l'ha perso
  winner: string | null;
  ranking: string[] | null;
  log: RoseLog[];
  logNo: number;
  scores: Record<string, number>;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const isAlive = (s: RoseState, id: string) => s.order.includes(id) && !s.out.includes(id);
const alive = (s: RoseState) => s.order.filter((id) => !s.out.includes(id));
const owned = (s: RoseState, id: string) => (s.roses[id] ?? 0) + (s.skull[id] ? 1 : 0);
const total = (s: RoseState) => s.order.reduce((n, id) => n + (s.stacks[id]?.length ?? 0), 0);
const flippedTotal = (s: RoseState) => s.order.reduce((n, id) => n + (s.flips[id] ?? 0), 0);
const unflipped = (s: RoseState, id: string) => (s.stacks[id]?.length ?? 0) - (s.flips[id] ?? 0);

// dischi ancora in mano (quelli posseduti meno quelli già sulla pila)
function hand(s: RoseState, id: string): Disc[] {
  const stack = s.stacks[id] ?? [];
  const r = Math.max(0, (s.roses[id] ?? 0) - stack.filter((d) => d === 'R').length);
  const list: Disc[] = Array.from({ length: r }, () => 'R');
  if (s.skull[id] && !stack.includes('S')) list.push('S');
  return list;
}

function addLog(s: RoseState, e: RoseLog) {
  s.log = [...s.log, e].slice(-14);
  s.logNo = (s.logNo ?? 0) + 1;
}

function setTimer(s: RoseState, ctx: Ctx, ms: number) {
  s.stageEndsAt = ctx.now + ms;
  s.stageMs = ms;
}

// tempo per chi deve agire: chi non c'è o non risponde non blocca il tavolo
const waitMs = (s: RoseState, id: string, base: number, ctx: Ctx) => (!ctx.isOnline(id) ? OFFLINE_MS : s.afk.includes(id) ? AFK_MS : base);

function markAfk(s: RoseState, id: string) {
  if (!s.afk.includes(id)) s.afk.push(id);
  addLog(s, { k: 'auto', by: id });
}

// il prossimo ancora in gioco, in senso orario
function nextAlive(s: RoseState, from: string): string {
  const n = s.order.length;
  const i = s.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = s.order[(i + k) % n];
    if (isAlive(s, id)) return id;
  }
  return from;
}

// ---------------------------------------------------------------- fasi

function newRound(s: RoseState, starter: string, ctx: Ctx) {
  s.round += 1;
  s.starter = isAlive(s, starter) ? starter : nextAlive(s, starter);
  s.stacks = Object.fromEntries(s.order.map((id) => [id, []]));
  s.flips = {};
  s.placed = [];
  s.bid = null;
  s.bids = [];
  s.passed = [];
  s.flipper = null;
  s.ownLeft = 0;
  s.choosing = false;
  s.result = null;
  s.lost = null;
  s.turn = null;
  s.stage = 'PLACE';
  setTimer(s, ctx, PLACE_MS);
  addLog(s, { k: 'round', n: s.round, by: s.starter });
  checkPlace(s, ctx);
}

// posa iniziale: si va avanti quando tutti hanno messo il disco; se mancano solo assenti si accorcia l'attesa
function checkPlace(s: RoseState, ctx: Ctx) {
  const waiting = alive(s).filter((id) => !s.placed.includes(id));
  if (!waiting.length) return toPlay(s, ctx);
  if (waiting.every((id) => !ctx.isOnline(id) || s.afk.includes(id))) {
    const ms = waiting.every((id) => !ctx.isOnline(id)) ? OFFLINE_MS : AFK_MS;
    if ((s.stageEndsAt ?? Infinity) > ctx.now + ms) setTimer(s, ctx, ms);
  }
}

function place(s: RoseState, id: string, disc: Disc) {
  s.stacks[id] = [...(s.stacks[id] ?? []), disc];
  s.placed.push(id);
}

function toPlay(s: RoseState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.turn = s.starter;
  setTimer(s, ctx, waitMs(s, s.turn, PLAY_MS, ctx));
}

function addDisc(s: RoseState, id: string, disc: Disc, ctx: Ctx) {
  s.stacks[id] = [...s.stacks[id], disc];
  addLog(s, { k: 'add', by: id });
  s.turn = nextAlive(s, id);
  setTimer(s, ctx, waitMs(s, s.turn, PLAY_MS, ctx));
}

function challenge(s: RoseState, id: string, n: number, ctx: Ctx) {
  s.bid = { by: id, n };
  s.bids = [{ by: id, n }];
  s.passed = [];
  s.stage = 'BID';
  addLog(s, { k: 'challenge', by: id, n });
  if (n >= total(s)) return startFlip(s, ctx); // nessuno può rilanciare oltre il massimo
  nextBidder(s, id, ctx);
}

// asta: tocca al prossimo che non ha passato (chi ha l'offerta più alta aspetta)
function nextBidder(s: RoseState, from: string, ctx: Ctx) {
  const n = s.order.length;
  const i = s.order.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = s.order[(i + k) % n];
    if (isAlive(s, id) && !s.passed.includes(id) && id !== s.bid?.by) {
      s.turn = id;
      setTimer(s, ctx, waitMs(s, id, BID_MS, ctx));
      return;
    }
  }
  startFlip(s, ctx);
}

function raise(s: RoseState, id: string, n: number, ctx: Ctx) {
  s.bid = { by: id, n };
  s.bids = [...s.bids, { by: id, n }].slice(-12);
  addLog(s, { k: 'raise', by: id, n });
  if (n >= total(s)) return startFlip(s, ctx);
  nextBidder(s, id, ctx);
}

function pass(s: RoseState, id: string, ctx: Ctx) {
  s.passed.push(id);
  addLog(s, { k: 'pass', by: id });
  nextBidder(s, id, ctx);
}

function startFlip(s: RoseState, ctx: Ctx) {
  const f = s.bid!.by;
  s.stage = 'FLIP';
  s.flipper = f;
  s.turn = f;
  s.flips = {};
  // prima i suoi dischi, dall'alto (girati dal server uno alla volta, uguale per tutti)
  s.ownLeft = Math.min(s.bid!.n, s.stacks[f]?.length ?? 0);
  s.choosing = false;
  if (s.ownLeft > 0) setTimer(s, ctx, FLIP_FIRST_MS);
  else toChoose(s, ctx);
}

function toChoose(s: RoseState, ctx: Ctx) {
  s.choosing = true;
  setTimer(s, ctx, waitMs(s, s.flipper!, CHOOSE_MS, ctx));
}

// gira il disco in cima (tra quelli non ancora girati) della pila di "of"
function flipTop(s: RoseState, of: string, ctx: Ctx) {
  const stack = s.stacks[of];
  const disc = stack[stack.length - 1 - (s.flips[of] ?? 0)];
  s.flips[of] = (s.flips[of] ?? 0) + 1;
  addLog(s, { k: 'flip', by: s.flipper!, of, disc });
  if (disc === 'S') return endChallenge(s, 'SKULL', of, ctx);
  if (flippedTotal(s) >= s.bid!.n) return endChallenge(s, 'WIN', null, ctx);
  if (s.ownLeft > 0) setTimer(s, ctx, FLIP_STEP_MS);
  else toChoose(s, ctx);
}

function flipOwnStep(s: RoseState, ctx: Ctx) {
  s.ownLeft -= 1;
  flipTop(s, s.flipper!, ctx);
}

function endChallenge(s: RoseState, kind: 'WIN' | 'SKULL', of: string | null, ctx: Ctx) {
  const f = s.flipper!;
  let isOut = false;
  if (kind === 'WIN') {
    s.points[f] = (s.points[f] ?? 0) + 1;
    addLog(s, { k: 'win', by: f, points: s.points[f] });
    if (s.points[f] >= ROSE_WIN_POINTS) s.winner = f;
    s.starter = f;
  } else {
    addLog(s, { k: 'skull', by: f, of: of! });
    // perde un disco a caso tra tutti i suoi (anche quelli in mano): quale, lo sa solo lui
    const k = Math.floor(Math.random() * owned(s, f));
    const disc: Disc = k < s.roses[f] ? 'R' : 'S';
    if (disc === 'R') s.roses[f] -= 1;
    else s.skull[f] = false;
    s.lost = { id: f, disc };
    addLog(s, { k: 'lose', by: f, left: owned(s, f) });
    if (owned(s, f) === 0) {
      s.out.push(f);
      isOut = true;
      addLog(s, { k: 'out', by: f });
    }
    // se il teschio era di un altro, il round dopo comincia lui
    s.starter = of && of !== f ? of : f;
  }
  const still = alive(s);
  if (!s.winner && still.length <= 1) s.winner = still[0] ?? null;
  s.result = { kind, flipper: f, of, out: isOut, points: s.points[f] ?? 0 };
  s.stage = 'RESULT';
  s.turn = null;
  s.choosing = false;
  s.ownLeft = 0;
  setTimer(s, ctx, RESULT_MS);
}

// chi sfidava è uscito dalla stanza: il round non vale
function voidRound(s: RoseState, id: string, ctx: Ctx) {
  addLog(s, { k: 'void', by: id });
  s.result = { kind: 'VOID', flipper: id, of: null, out: true, points: s.points[id] ?? 0 };
  s.starter = nextAlive(s, id);
  s.stage = 'RESULT';
  s.turn = null;
  s.choosing = false;
  s.ownLeft = 0;
  setTimer(s, ctx, RESULT_MS);
}

// classifica: chi vince, poi i rimasti (punti, dischi), poi gli eliminati (chi è uscito dopo sta più in alto)
function finish(s: RoseState) {
  const rest = alive(s)
    .filter((id) => id !== s.winner)
    .sort((a, b) => (s.points[b] ?? 0) - (s.points[a] ?? 0) || owned(s, b) - owned(s, a));
  const outs = [...s.out].reverse().filter((id) => id !== s.winner);
  const ranking = [...(s.winner ? [s.winner] : []), ...rest, ...outs];
  const n = ranking.length;
  s.scores = {};
  ranking.forEach((id, i) => {
    const prev = ranking[i - 1];
    // a pari punti e dischi (tra i rimasti) si arriva pari
    const tie = i > 0 && rest.includes(id) && rest.includes(prev) && s.points[id] === s.points[prev] && owned(s, id) === owned(s, prev);
    s.scores[id] = tie ? s.scores[prev] : n - i;
  });
  s.ranking = ranking;
  s.stage = 'END';
  s.stageEndsAt = null;
  s.turn = null;
}

// tempo scaduto (o "Avanti" di chi guida): mossa automatica per chi doveva agire
function timeout(s: RoseState, ctx: Ctx) {
  if (s.stage === 'PLACE') {
    for (const id of alive(s).filter((x) => !s.placed.includes(x))) {
      place(s, id, pick(hand(s, id)));
      markAfk(s, id);
    }
    toPlay(s, ctx);
  } else if (s.stage === 'PLAY' && s.turn) {
    const id = s.turn;
    markAfk(s, id);
    const h = hand(s, id);
    if (h.length) addDisc(s, id, pick(h), ctx);
    else challenge(s, id, 1, ctx);
  } else if (s.stage === 'BID' && s.turn) {
    markAfk(s, s.turn);
    pass(s, s.turn, ctx);
  } else if (s.stage === 'FLIP') {
    if (s.ownLeft > 0) return flipOwnStep(s, ctx);
    if (!s.choosing) return toChoose(s, ctx);
    markAfk(s, s.flipper!);
    const piles = s.order.filter((id) => id !== s.flipper && unflipped(s, id) > 0);
    if (piles.length) flipTop(s, pick(piles), ctx);
    else endChallenge(s, 'WIN', null, ctx);
  } else if (s.stage === 'RESULT') {
    if (s.winner) finish(s);
    else newRound(s, s.starter, ctx);
  }
}

const isDisc = (d: unknown): d is Disc => d === 'R' || d === 'S';
const toInt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);

export const rose: Mode<RoseState> = {
  start(_settings: GameSettings, players: Player[], ctx) {
    const order = players.map((p) => p.id);
    const s: RoseState = {
      order,
      roses: Object.fromEntries(order.map((id) => [id, 3])),
      skull: Object.fromEntries(order.map((id) => [id, true])),
      stacks: {},
      flips: {},
      points: Object.fromEntries(order.map((id) => [id, 0])),
      out: [],
      afk: [],
      round: 0,
      starter: pick(order),
      stage: 'PLACE',
      stageEndsAt: null,
      stageMs: PLACE_MS,
      turn: null,
      placed: [],
      bid: null,
      bids: [],
      passed: [],
      flipper: null,
      ownLeft: 0,
      choosing: false,
      result: null,
      lost: null,
      winner: null,
      ranking: null,
      log: [],
      logNo: 0,
      scores: {},
    };
    newRound(s, s.starter, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (s.stage === 'END') return false;
    if (type === 'MG_FORCE') {
      if (!ctx.canLead(me)) return false;
      timeout(s, ctx);
      return true;
    }
    if (!isAlive(s, me)) return false;
    // chi fa una mossa da solo non è più "assente"
    const back = () => (s.afk = s.afk.filter((x) => x !== me));
    switch (type) {
      case 'MG_PLACE': {
        const disc = payload?.disc;
        if (s.stage !== 'PLACE' || s.placed.includes(me) || !isDisc(disc) || !hand(s, me).includes(disc)) return false;
        back();
        place(s, me, disc);
        checkPlace(s, ctx);
        return true;
      }
      case 'MG_ADD': {
        const disc = payload?.disc;
        if (s.stage !== 'PLAY' || s.turn !== me || !isDisc(disc) || !hand(s, me).includes(disc)) return false;
        back();
        addDisc(s, me, disc, ctx);
        return true;
      }
      case 'MG_CHALLENGE': {
        const n = toInt(payload?.n);
        if (s.stage !== 'PLAY' || s.turn !== me || !(n >= 1 && n <= total(s))) return false;
        back();
        challenge(s, me, n, ctx);
        return true;
      }
      case 'MG_RAISE': {
        const n = toInt(payload?.n);
        if (s.stage !== 'BID' || s.turn !== me || !s.bid || !(n > s.bid.n && n <= total(s))) return false;
        back();
        raise(s, me, n, ctx);
        return true;
      }
      case 'MG_PASS':
        if (s.stage !== 'BID' || s.turn !== me) return false;
        back();
        pass(s, me, ctx);
        return true;
      case 'MG_FLIP': {
        const of = String(payload?.of ?? '');
        if (s.stage !== 'FLIP' || !s.choosing || s.flipper !== me || of === me || !s.order.includes(of) || unflipped(s, of) <= 0) return false;
        back();
        flipTop(s, of, ctx);
        return true;
      }
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (s.stage === 'END' || !s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    timeout(s, ctx);
    return true;
  },
  deadline: (s) => (s.stage === 'END' ? null : s.stageEndsAt),
  view(s, me): RoseView {
    const seats: Record<string, RoseSeat> = {};
    for (const id of s.order) {
      const stack = s.stacks[id] ?? [];
      const f = s.flips[id] ?? 0;
      seats[id] = {
        discs: owned(s, id),
        hand: s.out.includes(id) ? 0 : hand(s, id).length,
        stack: stack.length,
        flipped: stack.slice(stack.length - f).reverse(),
        points: s.points[id] ?? 0,
        out: s.out.includes(id),
        placed: s.placed.includes(id),
        passed: s.passed.includes(id),
        afk: s.afk.includes(id),
      };
    }
    const player = s.order.includes(me);
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      starter: s.starter,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      turn: s.turn,
      seats,
      total: total(s),
      bid: s.bid,
      bids: s.bids,
      flipper: s.flipper,
      flippedTotal: flippedTotal(s),
      choosing: s.choosing,
      result: s.result,
      // la mia mano e la mia pila le vedo solo io
      me: player ? { hand: s.out.includes(me) ? [] : hand(s, me), stack: s.stacks[me] ?? [], lost: s.lost?.id === me ? s.lost.disc : null } : null,
      log: s.log,
      logNo: s.logNo ?? s.log.length,
      winner: s.winner,
      ranking: s.ranking,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !isAlive(s, id)) return false;
    s.out.push(id);
    s.afk = s.afk.filter((x) => x !== id);
    addLog(s, { k: 'left', by: id });
    const still = alive(s);
    if (still.length <= 1) {
      s.winner = still[0] ?? null;
      finish(s);
      return true;
    }
    if (s.stage === 'PLACE') checkPlace(s, ctx);
    else if (s.stage === 'PLAY' && s.turn === id) {
      s.turn = nextAlive(s, id);
      setTimer(s, ctx, waitMs(s, s.turn, PLAY_MS, ctx));
    } else if (s.stage === 'BID') {
      if (s.bid?.by === id) voidRound(s, id, ctx);
      else if (s.turn === id) nextBidder(s, id, ctx);
    } else if (s.stage === 'FLIP' && s.flipper === id) voidRound(s, id, ctx);
    else if (s.stage === 'RESULT' && s.winner === id) s.winner = null;
    return true;
  },
};

registerFlat('ROSE', rose);
