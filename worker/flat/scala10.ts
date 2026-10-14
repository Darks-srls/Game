// 🔟 Da 1 a 10 (cooperativo, tipo Top Ten): a ogni round un capitano. Gli altri ricevono un numero segreto da 1 a 10
// e scrivono una risposta al tema che "valga" quel numero; il capitano le mette in fila dalla più bassa alla più alta.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { S10_THEMES, S10_THEMES_SPICY, type Scala10Theme, type Scala10View } from '../../src/data/flat/scala10';
import type { Ctx, Mode } from '../modes';
import { clean, deck, shuffle } from '../party';
import { registerFlat } from './registry';

const WRITE_MS = 60_000;
const ORDER_MS = 120_000;
// la rivelazione dura di più con più risposte (una carta ogni 1,2 secondi, come nella schermata)
const revealMs = (n: number) => 4_000 + 1_200 * n + 5_000;
const MAX_LIVES = 8;

interface S10Card {
  by: string;
  text: string;
  n: number;
}

interface S10State {
  order: string[];
  rounds: number;
  round: number;
  turn: number; // per scegliere il capitano a rotazione
  captain: string;
  themes: Scala10Theme[];
  theme: Scala10Theme;
  stage: Scala10View['stage'];
  stageEndsAt: number | null;
  writers: string[];
  numbers: Record<string, number>; // segreti
  answers: Record<string, string>;
  cards: S10Card[]; // mescolate: l'id di una risposta è la sua posizione qui
  arrange: number[];
  result: Scala10View['result'];
  skipped: boolean;
  lives: number;
  score: number;
  maxScore: number;
  gained: number;
  lost: number;
  history: Scala10View['history'];
}

// le carte "giuste" sono la fila crescente più lunga dentro l'ordine del capitano: le altre sono fuori posto
// (sbagliarne una sola costa una vita sola, non tutte quelle che slittano)
function inPlace(nums: number[]): boolean[] {
  const len = nums.map(() => 1);
  const prev = nums.map(() => -1);
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < i; j++)
      if (nums[j] <= nums[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
  const ok = nums.map(() => false);
  let k = len.indexOf(Math.max(0, ...len));
  while (k >= 0) {
    ok[k] = true;
    k = prev[k];
  }
  return ok;
}

function newRound(s: S10State, ctx: Ctx) {
  s.round += 1;
  // capitano a turno (collegato, se possibile)
  for (let k = 0; k < s.order.length; k++) {
    s.captain = s.order[(s.turn + k) % s.order.length];
    if (ctx.isOnline(s.captain)) {
      s.turn += k + 1;
      break;
    }
  }
  s.theme = s.themes[(s.round - 1) % s.themes.length];
  // numeri segreti tutti diversi (oltre i 10 giocatori qualcuno si ripete)
  s.writers = s.order.filter((id) => id !== s.captain && ctx.isOnline(id));
  const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  s.numbers = Object.fromEntries(s.writers.map((id, i) => [id, pool[i] ?? 1 + Math.floor(Math.random() * 10)]));
  s.answers = {};
  s.cards = [];
  s.arrange = [];
  s.result = null;
  s.skipped = false;
  s.gained = 0;
  s.lost = 0;
  s.stage = 'WRITE';
  s.stageEndsAt = ctx.now + WRITE_MS;
}

function toOrder(s: S10State, ctx: Ctx) {
  s.cards = shuffle(Object.entries(s.answers).map(([by, text]) => ({ by, text, n: s.numbers[by] })));
  // con meno di due risposte non c'è niente da ordinare: round saltato senza perdere vite
  if (s.cards.length < 2) return toReveal(s, ctx, true);
  s.arrange = [];
  s.stage = 'ORDER';
  s.stageEndsAt = ctx.now + ORDER_MS;
}

function toReveal(s: S10State, ctx: Ctx, skipped = false) {
  s.skipped = skipped;
  if (skipped) {
    s.result = [];
  } else {
    // le risposte non messe in fila finiscono in fondo, nell'ordine in cui erano
    const ids = [...s.arrange, ...s.cards.map((_, i) => i).filter((i) => !s.arrange.includes(i))];
    const ok = inPlace(ids.map((id) => s.cards[id].n));
    s.result = ids.map((id, k) => ({ id, text: s.cards[id].text, by: s.cards[id].by, n: s.cards[id].n, ok: ok[k] }));
    s.gained = ok.filter(Boolean).length;
    s.lost = ids.length - s.gained;
    s.score += s.gained;
    s.maxScore += ids.length;
    s.lives = Math.max(0, s.lives - s.lost);
    s.history.push({ captain: s.captain, theme: s.theme.t, ok: s.gained, total: ids.length });
  }
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + revealMs(s.result.length);
}

function next(s: S10State, ctx: Ctx) {
  if (s.lives <= 0 || s.round >= s.rounds) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  newRound(s, ctx);
}

const allWritten = (s: S10State, ctx: Ctx) => s.writers.filter((id) => ctx.isOnline(id)).every((id) => id in s.answers);

export const scala10: Mode<S10State> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: S10State = {
      order,
      rounds: flatOpt(settings, 'SCALA10', 'round'),
      round: 0,
      turn: Math.floor(Math.random() * order.length),
      captain: '',
      themes: deck(S10_THEMES, S10_THEMES_SPICY, !!settings.spicy),
      theme: S10_THEMES[0],
      stage: 'WRITE',
      stageEndsAt: null,
      writers: [],
      numbers: {},
      answers: {},
      cards: [],
      arrange: [],
      result: null,
      skipped: false,
      lives: MAX_LIVES,
      score: 0,
      maxScore: 0,
      gained: 0,
      lost: 0,
      history: [],
    };
    newRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_ANSWER') {
      if (s.stage !== 'WRITE' || !s.writers.includes(me)) return false;
      const text = clean(payload?.text, 80);
      if (!text) return false;
      s.answers[me] = text; // si può cambiare finché non scrivono tutti
      if (allWritten(s, ctx)) toOrder(s, ctx);
      return true;
    }
    if (type === 'MG_ARRANGE') {
      if (s.stage !== 'ORDER' || me !== s.captain || !Array.isArray(payload?.ids)) return false;
      const ids = payload.ids.map(Number);
      const valid = ids.every((i: number) => Number.isInteger(i) && i >= 0 && i < s.cards.length) && new Set(ids).size === ids.length;
      if (!valid || ids.length > s.cards.length) return false;
      s.arrange = ids;
      return true;
    }
    if (type === 'MG_CONFIRM') {
      if (s.stage !== 'ORDER' || me !== s.captain || s.arrange.length !== s.cards.length) return false;
      toReveal(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'WRITE') toOrder(s, ctx);
      else if (s.stage === 'ORDER') toReveal(s, ctx);
      else next(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'WRITE') toOrder(s, ctx);
    else if (s.stage === 'ORDER') toReveal(s, ctx); // tempo scaduto: vale la fila com'è
    else if (s.stage === 'REVEAL') next(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): Scala10View {
    const reveal = s.stage === 'REVEAL' || s.stage === 'END';
    const showCards = s.stage === 'ORDER' || reveal;
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      rounds: s.rounds,
      captain: s.captain,
      theme: s.theme,
      stageEndsAt: s.stageEndsAt,
      writers: s.writers,
      written: Object.keys(s.answers),
      myNumber: s.numbers[me] ?? null,
      myAnswer: s.answers[me] ?? null,
      // anonime: niente autore né numero fino alla rivelazione (ognuno riconosce solo la sua)
      answers: showCards ? s.cards.map((c, id) => ({ id, text: c.text, mine: c.by === me })) : [],
      arrange: showCards ? s.arrange : [],
      result: reveal ? s.result : null,
      skipped: s.skipped,
      lives: s.lives,
      maxLives: MAX_LIVES,
      score: s.score,
      maxScore: s.maxScore,
      gained: s.gained,
      lost: s.lost,
      history: s.history,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    s.order = s.order.filter((x) => x !== id);
    // senza capitano il round non si può chiudere: si salta (nessuna vita persa)
    if (id === s.captain && (s.stage === 'WRITE' || s.stage === 'ORDER')) {
      s.cards = [];
      toReveal(s, ctx, true);
      return true;
    }
    if (s.stage === 'WRITE') {
      s.writers = s.writers.filter((x) => x !== id);
      delete s.answers[id];
      if (Object.keys(s.answers).length && allWritten(s, ctx)) toOrder(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('SCALA10', scala10);
