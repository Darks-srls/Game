// 🎬 Emoji quiz: compare una fila di emoji (film, canzone, proverbio…), tutti scrivono la risposta.
// I primi a indovinare prendono più punti; dopo 15 e 30 secondi arrivano gli aiutini.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { EMOJI, EMOJI_SPICY, type EmojiItem, type EmojiView } from '../../src/data/flat/emoji';
import type { Ctx, Mode } from '../modes';
import { clean, deck, shuffle } from '../party';
import { registerFlat } from './registry';

const READY_MS = 3_000;
const PLAY_MS = 45_000;
const HINT_MS = [15_000, 30_000]; // primo e secondo aiutino
const REVEAL_MS = 9_000;
const WRONG_PAUSE = 1_500; // piccola pausa dopo una risposta sbagliata
const POINTS = [10, 8, 6, 5, 4, 3, 2]; // poi 1 a testa

type Verdict = 'OK' | 'CLOSE' | 'NO';

interface EmojiState {
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  rounds: number;
  round: number;
  items: EmojiItem[];
  stage: EmojiView['stage'];
  stageEndsAt: number | null;
  startedAt: number | null;
  hint: number;
  solved: EmojiView['solved'];
  tries: Record<string, number>;
  last: Record<string, { text: string; verdict: 'NO' | 'CLOSE' }>;
  waitUntil: Record<string, number>;
  lastAt: Record<string, number>;
  history: EmojiView['history'];
}

// ---------------------------------------------------------------- confronto tollerante delle risposte

// minuscole, senza accenti e punteggiatura; due forme: intera e senza l'articolo iniziale (sempre senza spazi)
function forms(s: string): string[] {
  const b = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const full = b.replace(/ /g, '');
  const bare = b.replace(/^(il|lo|la|i|gli|le|l|un|uno|una|the)\s+/, '').replace(/ /g, '');
  return full === bare ? [full] : [bare, full];
}

// lettere da cambiare (scambiare due lettere vicine conta uno)
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

// un errore di battitura ogni ~6 lettere; "ci sei quasi" se manca poco
export function judge(text: string, answers: string[]): Verdict {
  const gs = forms(text).filter(Boolean);
  if (!gs.length) return 'NO';
  let close = false;
  for (const ans of answers)
    for (const t of forms(ans)) {
      if (!t) continue;
      const ok = Math.floor(t.length / 6);
      for (const g of gs) {
        const d = distance(g, t);
        if (d <= ok) return 'OK';
        // i proverbi lunghi: basta scriverne quasi tutto l'inizio
        if (t.length >= 16 && g.length >= Math.ceil(t.length * 0.7) && distance(g, t.slice(0, g.length)) <= Math.floor(g.length / 6)) return 'OK';
        if (d <= ok + Math.max(1, Math.round(t.length / 5))) close = true;
        if (g.length >= 4 && ((t.includes(g) && g.length * 2 >= t.length) || g.includes(t))) close = true;
      }
    }
  return close ? 'CLOSE' : 'NO';
}

// ---------------------------------------------------------------- aiutini

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

// lettere scoperte: col primo aiutino le iniziali, col secondo una lettera ogni tre di ogni parola
function mask(answer: string, hint: number): (string | null)[] {
  const chars = [...answer];
  let pos = 0;
  return chars.map((ch, i) => {
    if (!isLetter(ch)) {
      pos = 0;
      return ch;
    }
    const inWord = pos++;
    const show = inWord === 0 || (hint >= 2 && inWord % 3 === 0) || (hint >= 2 && i === chars.length - 1 && chars.length > 3);
    return show ? ch.toUpperCase() : null;
  });
}

// ---------------------------------------------------------------- fasi

const item = (s: EmojiState) => s.items[(s.round - 1) % s.items.length];
const players = (s: EmojiState, ctx: Ctx, except?: string) => s.order.filter((id) => id !== except && ctx.isOnline(id));
const allSolved = (s: EmojiState, ctx: Ctx, except?: string) => players(s, ctx, except).every((id) => s.solved.some((x) => x.id === id));

function nextRound(s: EmojiState, ctx: Ctx) {
  if (s.round >= s.rounds) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.round += 1;
  s.stage = 'READY';
  s.stageEndsAt = ctx.now + READY_MS;
  s.startedAt = null;
  s.hint = 0;
  s.solved = [];
  s.gained = {};
  s.tries = {};
  s.last = {};
  s.waitUntil = {};
}

function play(s: EmojiState, ctx: Ctx) {
  s.stage = 'PLAY';
  s.startedAt = ctx.now;
  s.stageEndsAt = ctx.now + PLAY_MS;
  s.hint = 0;
}

function reveal(s: EmojiState, ctx: Ctx) {
  const it = item(s);
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + REVEAL_MS;
  s.history.push({ e: it.e, a: it.a, first: s.solved[0]?.id ?? null });
}

export const emoji: Mode<EmojiState> = {
  start(settings: GameSettings, list, ctx) {
    const order = shuffle(list.map((p) => p.id));
    const rounds = flatOpt(settings, 'EMOJI', 'round');
    const s: EmojiState = {
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      rounds,
      round: 0,
      items: deck(EMOJI, EMOJI_SPICY, !!settings.spicy).slice(0, rounds),
      stage: 'READY',
      stageEndsAt: null,
      startedAt: null,
      hint: 0,
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
      const text = clean(payload?.text, 60);
      if (!text) return false;
      s.lastAt[me] = ctx.now;
      const it = item(s);
      const verdict = judge(text, [it.a, ...it.alt]);
      if (verdict === 'OK') {
        const points = POINTS[s.solved.length] ?? 1;
        s.solved.push({ id: me, ms: ctx.now - (s.startedAt ?? ctx.now), points });
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
      const h = HINT_MS.filter((ms) => ctx.now >= s.startedAt! + ms).length;
      if (h > s.hint) {
        s.hint = h;
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
    if (s.stage === 'PLAY' && s.startedAt !== null && s.hint < HINT_MS.length) return Math.min(s.stageEndsAt ?? Infinity, s.startedAt + HINT_MS[s.hint]);
    return s.stageEndsAt;
  },
  view(s, me): EmojiView {
    const it = item(s);
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const mine = s.solved.some((x) => x.id === me);
    const playing = s.stage === 'PLAY';
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
      nextHintAt: playing && s.startedAt !== null && s.hint < HINT_MS.length ? s.startedAt + HINT_MS[s.hint] : null,
      emoji: s.stage === 'READY' ? null : it.e,
      hint: s.hint,
      cat: (playing && s.hint >= 1) || open ? it.c : null,
      mask: playing && s.hint >= 1 && !mine ? mask(it.a, s.hint) : null,
      solved: s.solved,
      me: { solved: mine, tries: s.tries[me] ?? 0, last: last?.text ?? null, verdict: last?.verdict ?? null, waitUntil: s.waitUntil[me] ?? 0 },
      answer: open || mine ? it.a : null,
      history: s.stage === 'END' ? s.history : [],
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    // se mancava solo lui a indovinare si va alla soluzione
    if (s.stage === 'PLAY' && s.solved.length && allSolved(s, ctx, id)) {
      reveal(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('EMOJI', emoji);
