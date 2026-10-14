// 🎯 Più o meno (Wits & Wagers semplificato): ognuno scrive una stima, poi le stime diverse si mettono in fila e
// si scommettono 2 fiches su quella più vicina SENZA superare la risposta vera. Quote più alte ai bordi.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { STIMA_QUESTIONS, STIMA_SPICY, type StimaQ, type StimaSlot, type StimaView } from '../../src/data/flat/stima';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const GUESS_MS = 40_000;
const BET_MS = 30_000;
const REVEAL_MS = 10_000; // il numero vero "scorre" e si accende la casella vincente
const CHIPS = 2; // fiches a testa per round
const AUTHOR_BONUS = 3; // a chi ha scritto la stima vincente
const LOWEST_ODDS = 6; // "Più basso di tutte"
const MAX_GUESS = 999_999_999;
const SPICY_SHARE = 0.35;

interface StimaState {
  order: string[];
  qs: { q: string; a: number; u: string; spicy: boolean }[];
  round: number;
  stage: StimaView['stage'];
  stageEndsAt: number | null;
  guesses: Record<string, number>;
  slots: StimaSlot[];
  bets: Record<string, number[]>;
  win: number | null;
  gained: Record<string, number>;
  scores: Record<string, number>;
  history: StimaView['history'];
}

// domande uscite di recente su questo server: si evitano finché ce ne sono di nuove
const recent: string[] = [];

function buildQuestions(n: number, spicy: boolean): StimaState['qs'] {
  const fresh = (list: StimaQ[]) => {
    const f = list.filter((q) => !recent.includes(q[0]));
    return shuffle(f.length >= n ? f : list);
  };
  const normal = fresh(STIMA_QUESTIONS);
  const hot = spicy ? fresh(STIMA_SPICY) : [];
  const nHot = spicy ? Math.round(n * SPICY_SHARE) : 0;
  const picked = shuffle([...normal.slice(0, n - nHot).map((q) => ({ q, spicy: false })), ...hot.slice(0, nHot).map((q) => ({ q, spicy: true }))]);
  for (const { q } of picked) recent.push(q[0]);
  if (recent.length > 120) recent.splice(0, recent.length - 120);
  return picked.map(({ q, spicy: s }) => ({ q: q[0], a: q[1], u: q[2], spicy: s }));
}

// caselle: "Più basso di tutte" + le stime diverse dalla più bassa alla più alta.
// Quote: al centro 2:1, poi 3:1 e 4:1, ai bordi 5:1 (con tante stime anche più caselle a 5:1).
export function buildSlots(guesses: Record<string, number>): StimaSlot[] {
  const values = [...new Set(Object.values(guesses))].sort((a, b) => a - b);
  const mid = (values.length - 1) / 2;
  return [
    { value: null, by: [], odds: LOWEST_ODDS },
    ...values.map((v, i) => ({
      value: v,
      by: Object.keys(guesses).filter((id) => guesses[id] === v),
      odds: Math.min(5, 2 + Math.floor(Math.abs(i - mid))),
    })),
  ];
}

// vince la stima più vicina senza superare la risposta; se tutte la superano vince "Più basso di tutte"
export function winningSlot(slots: StimaSlot[], answer: number): number {
  let win = 0;
  slots.forEach((s, i) => {
    if (s.value !== null && s.value <= answer) win = i;
  });
  return win;
}

const online = (s: StimaState, ctx: Ctx) => s.order.filter((id) => ctx.isOnline(id));
const allGuessed = (s: StimaState, ctx: Ctx) => online(s, ctx).every((id) => id in s.guesses);
const allBet = (s: StimaState, ctx: Ctx) => online(s, ctx).every((id) => (s.bets[id]?.length ?? 0) >= CHIPS);

function newRound(s: StimaState, ctx: Ctx) {
  s.stage = 'GUESS';
  s.stageEndsAt = ctx.now + GUESS_MS;
  s.guesses = {};
  s.slots = [];
  s.bets = {};
  s.win = null;
  s.gained = {};
}

function toBet(s: StimaState, ctx: Ctx) {
  // nessuno ha scritto niente: niente da scommettere, si mostra solo la risposta
  if (!Object.keys(s.guesses).length) return toReveal(s, ctx);
  s.slots = buildSlots(s.guesses);
  s.bets = {};
  s.stage = 'BET';
  s.stageEndsAt = ctx.now + BET_MS;
}

function toReveal(s: StimaState, ctx: Ctx) {
  const q = s.qs[s.round - 1];
  s.gained = {};
  s.win = s.slots.length ? winningSlot(s.slots, q.a) : null;
  if (s.win !== null) {
    const slot = s.slots[s.win];
    for (const id of s.order) {
      const chips = (s.bets[id] ?? []).filter((i) => i === s.win).length;
      const pts = chips * slot.odds + (slot.by.includes(id) ? AUTHOR_BONUS : 0);
      if (pts) {
        s.gained[id] = pts;
        s.scores[id] = (s.scores[id] ?? 0) + pts;
      }
    }
  }
  s.history.push({ q: q.q, a: q.a, u: q.u });
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + REVEAL_MS;
}

function next(s: StimaState, ctx: Ctx) {
  if (s.round >= s.qs.length) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.round += 1;
  newRound(s, ctx);
}

function advance(s: StimaState, ctx: Ctx) {
  if (s.stage === 'GUESS') toBet(s, ctx);
  else if (s.stage === 'BET') toReveal(s, ctx);
  else if (s.stage === 'REVEAL') next(s, ctx);
}

export const stima: Mode<StimaState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: StimaState = {
      order,
      qs: buildQuestions(flatOpt(settings, 'STIMA', 'round'), !!settings.spicy),
      round: 1,
      stage: 'GUESS',
      stageEndsAt: null,
      guesses: {},
      slots: [],
      bets: {},
      win: null,
      gained: {},
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      history: [],
    };
    newRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_GUESS') {
      if (s.stage !== 'GUESS' || !s.order.includes(me)) return false;
      // solo cifre: niente segni, virgole o testo (le risposte sono tutte numeri interi ≥ 0)
      const digits = String(payload?.value ?? '').replace(/\D/g, '').slice(0, 9);
      if (!digits) return false;
      const v = Math.min(MAX_GUESS, Number(digits));
      if (!Number.isFinite(v) || s.guesses[me] === v) return false;
      s.guesses[me] = v;
      if (allGuessed(s, ctx)) toBet(s, ctx);
      return true;
    }
    if (type === 'MG_BET') {
      const slot = Number(payload?.slot);
      if (s.stage !== 'BET' || !s.order.includes(me) || !Number.isInteger(slot) || slot < 0 || slot >= s.slots.length) return false;
      // la terza fiche sposta la più vecchia (così si cambia idea senza un tasto in più)
      s.bets[me] = [...(s.bets[me] ?? []), slot].slice(-CHIPS);
      if (allBet(s, ctx)) toReveal(s, ctx);
      return true;
    }
    if (type === 'MG_CLEAR') {
      if (s.stage !== 'BET' || !s.bets[me]?.length) return false;
      s.bets[me] = [];
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt || s.stage === 'END') return false;
    advance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): StimaView {
    const q = s.qs[Math.min(s.round, s.qs.length) - 1];
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      rounds: s.qs.length,
      question: q.q,
      unit: q.u,
      spicy: q.spicy,
      stageEndsAt: s.stageEndsAt,
      guessed: Object.keys(s.guesses),
      myGuess: s.guesses[me] ?? null,
      slots: s.stage === 'GUESS' ? [] : s.slots,
      chips: CHIPS,
      myBets: s.bets[me] ?? [],
      betDone: Object.keys(s.bets).filter((id) => s.bets[id].length >= CHIPS),
      bets: open ? s.bets : null,
      answer: open ? q.a : null,
      win: open ? s.win : null,
      gained: s.stage === 'REVEAL' ? s.gained : {},
      scores: s.scores,
      history: s.stage === 'END' ? s.history : [],
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (!s.order.includes(id)) return false;
    // chi esce sparisce dalla classifica; la sua stima resta sul tabellone (ci hanno già scommesso)
    s.order = s.order.filter((x) => x !== id);
    delete s.scores[id];
    delete s.bets[id];
    delete s.gained[id];
    if (s.stage === 'GUESS') delete s.guesses[id];
    for (const slot of s.slots) slot.by = slot.by.filter((x) => x !== id);
    if (s.stage === 'GUESS' && Object.keys(s.guesses).length && allGuessed(s, ctx)) toBet(s, ctx);
    else if (s.stage === 'BET' && Object.keys(s.bets).length && allBet(s, ctx)) toReveal(s, ctx);
    return true;
  },
};

registerFlat('STIMA', stima);
