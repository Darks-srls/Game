// 🟩 Cinque lettere (tipo Wordle a gara): tutti cercano la stessa parola di 5 lettere con 6 tentativi.
// Gli altri vedono i colori delle mie righe ma non le lettere (fino alla rivelazione).
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { CQ_WORDS, CQ_WORDS_SPICY, cqClean, cqMarks, type CinqueView } from '../../src/data/flat/cinque';
import type { Ctx, Mode } from '../modes';
import { deck, shuffle } from '../party';
import { registerFlat } from './registry';

const READY_MS = 3_000;
const PLAY_MS = 180_000;
const REVEAL_MS = 10_000;
const MAX_TRIES = 6;
const SPEED_BONUS = [3, 2, 1]; // primo, secondo, terzo a trovarla

interface CqState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  rounds: number;
  round: number;
  words: string[];
  stage: CinqueView['stage'];
  stageEndsAt: number | null;
  startedAt: number | null;
  rows: Record<string, { w: string; c: string }[]>;
  solvedAt: Record<string, number>; // ms dall'inizio
  solvedOrder: string[];
  lastAt: Record<string, number>;
  history: CinqueView['history'];
}

const secret = (s: CqState) => s.words[(s.round - 1) % s.words.length];
const isDone = (s: CqState, id: string) => id in s.solvedAt || (s.rows[id]?.length ?? 0) >= MAX_TRIES;
const allDone = (s: CqState, ctx: Ctx, except?: string) => s.order.filter((id) => id !== except && ctx.isOnline(id)).every((id) => isDone(s, id));

function nextRound(s: CqState, ctx: Ctx) {
  if (s.round >= s.rounds) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.round += 1;
  s.stage = 'READY';
  s.stageEndsAt = ctx.now + READY_MS;
  s.startedAt = null;
  s.rows = {};
  s.solvedAt = {};
  s.solvedOrder = [];
  s.gained = {};
}

function play(s: CqState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.startedAt = ctx.now;
  s.stageEndsAt = ctx.now + PLAY_MS;
}

function reveal(s: CqState, ctx: Ctx) {
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + REVEAL_MS;
  s.history.push({ word: secret(s), solvers: [...s.solvedOrder] });
}

export const cinque: Mode<CqState> = {
  start(settings: GameSettings, list, ctx) {
    const order = shuffle(list.map((p) => p.id));
    const rounds = flatOpt(settings, 'CINQUE', 'round');
    const s: CqState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      rounds,
      round: 0,
      words: deck(CQ_WORDS, CQ_WORDS_SPICY, !!settings.spicy).slice(0, rounds),
      stage: 'READY',
      stageEndsAt: null,
      startedAt: null,
      rows: {},
      solvedAt: {},
      solvedOrder: [],
      lastAt: {},
      history: [],
    };
    nextRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_GUESS') {
      if (s.stage !== 'PLAY' || !s.order.includes(me) || isDone(s, me) || ctx.now - (s.lastAt[me] ?? 0) < 300) return false;
      const w = cqClean(payload?.word);
      // qualsiasi parola di 5 lettere va bene, ma con almeno una vocale e non già provata
      if (!w || !/[aeiou]/.test(w)) return false;
      const rows = (s.rows[me] ??= []);
      if (rows.some((r) => r.w === w)) return false;
      s.lastAt[me] = ctx.now;
      const c = cqMarks(w, secret(s));
      rows.push({ w, c });
      if (c === 'GGGGG') {
        const points = MAX_TRIES + 1 - rows.length + (SPEED_BONUS[s.solvedOrder.length] ?? 0);
        s.solvedAt[me] = ctx.now - (s.startedAt ?? ctx.now);
        s.solvedOrder.push(me);
        s.scores[me] = (s.scores[me] ?? 0) + points;
        s.gained[me] = points;
      }
      if (allDone(s, ctx)) reveal(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'READY') play(s, ctx);
      else if (s.stage === 'PLAY') reveal(s, ctx);
      else nextRound(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'READY') play(s, ctx);
    else if (s.stage === 'PLAY') reveal(s, ctx);
    else if (s.stage === 'REVEAL') nextRound(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): CinqueView {
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      round: s.round,
      rounds: s.rounds,
      stageEndsAt: s.stageEndsAt,
      maxTries: MAX_TRIES,
      myRows: s.rows[me] ?? [],
      // degli altri solo i colori: le lettere si vedono alla rivelazione
      boards: s.order.map((id) => ({
        id,
        rows: (s.rows[id] ?? []).map((r) => ({ w: open || id === me ? r.w : null, c: r.c })),
        solved: id in s.solvedAt,
        ms: s.solvedAt[id] ?? null,
      })),
      solvedOrder: s.solvedOrder,
      secret: open ? secret(s) : null,
      history: s.stage === 'END' ? s.history : [],
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'PLAY' && Object.keys(s.rows).length && allDone(s, ctx, id)) {
      reveal(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('CINQUE', cinque);
