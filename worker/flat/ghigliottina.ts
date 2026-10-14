// 🪓 La ghigliottina (come il gioco finale dell'Eredità): cinque parole escono una ogni 7 secondi,
// una sola parola le collega tutte. Si risponde quando si vuole: meno indizi servono, più punti.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { GH_ITEMS, GH_ITEMS_SPICY, type GhItem, type GhigliottinaView } from '../../src/data/flat/ghigliottina';
import type { Ctx, Mode } from '../modes';
import { clean, deck, shuffle } from '../party';
import { registerFlat } from './registry';

const READY_MS = 3_000;
const CLUE_MS = 7_000; // un indizio ogni 7 secondi
const AFTER_MS = 15_000; // dopo l'ultimo indizio
const REVEAL_MS = 12_000;
const WRONG_PAUSE = 2_000;
const POINTS = [10, 8, 6, 4, 2]; // secondo gli indizi scoperti
const FIRST_BONUS = 2;

type Verdict = 'OK' | 'CLOSE' | 'NO';

interface GhState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  rounds: number;
  round: number;
  items: GhItem[];
  stage: GhigliottinaView['stage'];
  stageEndsAt: number | null;
  startedAt: number | null;
  shown: number; // indizi scoperti
  solved: GhigliottinaView['solved'];
  tries: Record<string, number>;
  last: Record<string, { text: string; verdict: 'NO' | 'CLOSE' }>;
  waitUntil: Record<string, number>;
  lastAt: Record<string, number>;
  history: GhigliottinaView['history'];
}

// ---------------------------------------------------------------- confronto tollerante

// minuscole, senza accenti, punteggiatura, articolo iniziale e spazi
const normAnswer = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(il|lo|la|i|gli|le|l|un|uno|una)\s+/, '')
    .replace(/ /g, '');

function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

// un errore di battitura ogni ~6 lettere; "ci sei quasi" se manca poco. Un indizio scritto tale e quale non vale mai
export function judgeGh(text: string, answers: string[], clues: string[] = []): Verdict {
  const g = normAnswer(text);
  if (!g || clues.some((w) => normAnswer(w) === g)) return 'NO';
  let close = false;
  for (const ans of answers) {
    const t = normAnswer(ans);
    const ok = Math.floor(t.length / 6);
    const d = distance(g, t);
    if (d <= ok) return 'OK';
    if (d <= ok + Math.max(1, Math.round(t.length / 5))) close = true;
    if (g.length >= 3 && t.length >= 3 && (g.startsWith(t) || t.startsWith(g)) && Math.abs(g.length - t.length) <= 3) close = true;
  }
  return close ? 'CLOSE' : 'NO';
}

// ---------------------------------------------------------------- fasi

const item = (s: GhState) => s.items[(s.round - 1) % s.items.length];
const allSolved = (s: GhState, ctx: Ctx, except?: string) =>
  s.order.filter((id) => id !== except && ctx.isOnline(id)).every((id) => s.solved.some((x) => x.id === id));

function nextRound(s: GhState, ctx: Ctx) {
  if (s.round >= s.rounds) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.round += 1;
  s.stage = 'READY';
  s.stageEndsAt = ctx.now + READY_MS;
  s.startedAt = null;
  s.shown = 0;
  s.solved = [];
  s.gained = {};
  s.tries = {};
  s.last = {};
  s.waitUntil = {};
}

function play(s: GhState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.startedAt = ctx.now;
  s.shown = 1;
  s.stageEndsAt = ctx.now + 4 * CLUE_MS + AFTER_MS;
}

function reveal(s: GhState, ctx: Ctx) {
  s.stage = 'REVEAL';
  s.shown = 5;
  s.stageEndsAt = ctx.now + REVEAL_MS;
  s.history.push({ a: item(s).a, first: s.solved[0]?.id ?? null });
}

export const ghigliottina: Mode<GhState> = {
  start(settings: GameSettings, list, ctx) {
    const order = shuffle(list.map((p) => p.id));
    const rounds = flatOpt(settings, 'GHIGLIOTTINA', 'round');
    const s: GhState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      rounds,
      round: 0,
      items: deck(GH_ITEMS, GH_ITEMS_SPICY, !!settings.spicy).slice(0, rounds),
      stage: 'READY',
      stageEndsAt: null,
      startedAt: null,
      shown: 0,
      solved: [],
      tries: {},
      last: {},
      waitUntil: {},
      lastAt: {},
      history: [],
    };
    nextRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_GUESS') {
      if (s.stage !== 'PLAY' || !s.order.includes(me) || s.solved.some((x) => x.id === me)) return false;
      if (ctx.now < (s.waitUntil[me] ?? 0) || ctx.now - (s.lastAt[me] ?? 0) < 300) return false;
      const text = clean(payload?.text, 30);
      if (!text) return false;
      s.lastAt[me] = ctx.now;
      const it = item(s);
      const verdict = judgeGh(text, [it.a, ...it.alt], it.w);
      if (verdict === 'OK') {
        const points = POINTS[s.shown - 1] + (s.solved.length === 0 ? FIRST_BONUS : 0);
        s.solved.push({ id: me, clues: s.shown, points, ms: ctx.now - (s.startedAt ?? ctx.now) });
        s.scores[me] = (s.scores[me] ?? 0) + points;
        s.gained[me] = points;
        delete s.last[me];
        if (allSolved(s, ctx)) reveal(s, ctx);
      } else {
        s.tries[me] = (s.tries[me] ?? 0) + 1;
        s.last[me] = { text, verdict };
        s.waitUntil[me] = ctx.now + WRONG_PAUSE;
      }
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
    if (s.stage === 'PLAY' && s.startedAt !== null) {
      let changed = false;
      const shown = Math.min(5, 1 + Math.floor((ctx.now - s.startedAt) / CLUE_MS));
      if (shown > s.shown) {
        s.shown = shown;
        changed = true;
      }
      if (s.stageEndsAt && ctx.now >= s.stageEndsAt) {
        reveal(s, ctx);
        changed = true;
      }
      return changed;
    }
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'READY') play(s, ctx);
    else if (s.stage === 'REVEAL') nextRound(s, ctx);
    return true;
  },
  deadline(s) {
    if (s.stage === 'PLAY' && s.startedAt !== null && s.shown < 5) return Math.min(s.stageEndsAt ?? Infinity, s.startedAt + s.shown * CLUE_MS);
    return s.stageEndsAt;
  },
  view(s, me): GhigliottinaView {
    const it = item(s);
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const mine = s.solved.some((x) => x.id === me);
    const last = s.last[me];
    return {
      stage: s.stage,
      order: s.order,
      scores: s.scores,
      gained: s.gained,
      round: s.round,
      rounds: s.rounds,
      stageEndsAt: s.stageEndsAt,
      startedAt: s.startedAt,
      nextClueAt: s.stage === 'PLAY' && s.startedAt !== null && s.shown < 5 ? s.startedAt + s.shown * CLUE_MS : null,
      // gli indizi non ancora usciti restano sul server
      clues: s.stage === 'READY' ? [] : it.w.slice(0, open ? 5 : s.shown),
      links: open ? it.x : null,
      solved: s.solved,
      me: { solved: mine, tries: s.tries[me] ?? 0, last: last?.text ?? null, verdict: last?.verdict ?? null, waitUntil: s.waitUntil[me] ?? 0 },
      answer: open || mine ? it.a : null,
      history: s.stage === 'END' ? s.history : [],
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'PLAY' && s.solved.length && allSolved(s, ctx, id)) {
      reveal(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('GHIGLIOTTINA', ghigliottina);
