// 📖 Il dizionario (tipo Balderdash): esce una parola vera ma rarissima, ognuno inventa una definizione credibile,
// poi si vota quella vera in mezzo alle bugie. +2 a chi indovina, +1 all'autore per ogni voto alla sua bugia,
// +3 a chi scrive la definizione giusta.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { DIZ_CAT, DIZ_WORDS, DIZ_WORDS_SPICY, type DizionarioView, type DizWord } from '../../src/data/flat/dizionario';
import type { Ctx, Mode } from '../modes';
import { clean, deck, shuffle } from '../party';
import { registerFlat } from './registry';

const WRITE_MS = 90_000;
const VOTE_MS = 45_000;
const MAX_DEF = 150;
// la rivelazione gira una carta alla volta, poi resta il tempo di guardare i punti
const REVEAL_START_MS = 1_500;
const REVEAL_STEP_MS = 1_700;
const revealMs = (options: number) => REVEAL_START_MS + options * REVEAL_STEP_MS + 9_000;

interface DizOpt {
  text: string;
  authors: string[];
  real: boolean;
}

interface DizState {
  order: string[];
  gone: string[];
  scores: Record<string, number>;
  gained: Record<string, number>;
  round: number;
  rounds: number;
  words: DizWord[];
  word: DizWord;
  stage: DizionarioView['stage'];
  stageEndsAt: number | null;
  revealAt: number | null;
  defs: Record<string, string>;
  options: DizOpt[];
  votes: Record<string, number>;
  marked: number[]; // bugie che chi guida ha riconosciuto come giuste
}

// per confrontare le definizioni: minuscole, senza accenti né punteggiatura
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// quasi uguali: stesse parole a meno di qualche errore di battitura
function similar(a: string, b: string) {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 8 || Math.abs(a.length - b.length) > Math.max(2, len / 10)) return false;
  return distance(a, b) <= Math.max(1, Math.floor(len / 12));
}

const active = (s: DizState) => s.order.filter((id) => !s.gone.includes(id));
const correct = (s: DizState, i: number) => s.options[i]?.real || s.marked.includes(i);
// chi può votare: chi gioca e ha almeno una definizione non sua da scegliere
const canVote = (s: DizState, id: string) => active(s).includes(id) && s.options.some((o) => !o.authors.includes(id));

// punti del round (si ricalcolano se chi guida segna una bugia come giusta)
function computeGained(s: DizState) {
  const g: Record<string, number> = Object.fromEntries(active(s).map((id) => [id, 0]));
  const add = (id: string, n: number) => {
    if (id in g) g[id] += n;
  };
  for (const [voter, i] of Object.entries(s.votes)) {
    const o = s.options[i];
    if (!o) continue;
    if (correct(s, i)) add(voter, 2);
    else for (const a of o.authors) if (a !== voter) add(a, 1);
  }
  // chi ha scritto la definizione giusta
  s.options.forEach((o, i) => {
    if (correct(s, i)) for (const a of o.authors) add(a, 3);
  });
  s.gained = g;
}

function newRound(s: DizState, ctx: Ctx) {
  s.round += 1;
  s.word = s.words[(s.round - 1) % s.words.length];
  s.defs = {};
  s.options = [];
  s.votes = {};
  s.marked = [];
  s.gained = {};
  s.revealAt = null;
  s.stage = 'WRITE';
  s.stageEndsAt = ctx.now + WRITE_MS;
}

// fine scrittura: le definizioni quasi uguali si uniscono, quelle uguali alla vera contano come giuste
function toVote(s: DizState, ctx: Ctx) {
  const real: DizOpt = { text: s.word[2], authors: [], real: true };
  const realKey = norm(real.text);
  const fakes: (DizOpt & { key: string })[] = [];
  for (const id of active(s)) {
    const text = s.defs[id];
    if (!text) continue;
    const k = norm(text);
    if (!k) continue;
    if (similar(k, realKey)) {
      real.authors.push(id);
      continue;
    }
    const same = fakes.find((f) => similar(f.key, k));
    if (same) same.authors.push(id);
    else fakes.push({ text, authors: [id], real: false, key: k });
  }
  s.options = shuffle([real, ...fakes.map(({ text, authors }) => ({ text, authors, real: false }))]);
  s.votes = {};
  // nessuna bugia da votare: si passa subito alla rivelazione
  if (!fakes.length) return toReveal(s, ctx);
  s.stage = 'VOTE';
  s.stageEndsAt = ctx.now + VOTE_MS;
}

function toReveal(s: DizState, ctx: Ctx) {
  computeGained(s);
  s.stage = 'REVEAL';
  s.revealAt = ctx.now;
  s.stageEndsAt = ctx.now + revealMs(s.options.length);
}

function next(s: DizState, ctx: Ctx) {
  for (const [id, n] of Object.entries(s.gained)) if (id in s.scores) s.scores[id] += n;
  s.gained = {};
  if (s.round >= s.rounds || !active(s).length) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  newRound(s, ctx);
}

const allWritten = (s: DizState, ctx: Ctx) => active(s).filter((id) => ctx.isOnline(id)).every((id) => id in s.defs);
const allVoted = (s: DizState, ctx: Ctx) => active(s).filter((id) => ctx.isOnline(id) && canVote(s, id)).every((id) => id in s.votes);

function advance(s: DizState, ctx: Ctx) {
  if (s.stage === 'WRITE') toVote(s, ctx);
  else if (s.stage === 'VOTE') toReveal(s, ctx);
  else if (s.stage === 'REVEAL') next(s, ctx);
}

export const dizionario: Mode<DizState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const words = deck(DIZ_WORDS, DIZ_WORDS_SPICY, settings.spicy);
    const s: DizState = {
      order,
      gone: [],
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      round: 0,
      rounds: flatOpt(settings, 'DIZIONARIO', 'round'),
      words,
      word: words[0],
      stage: 'WRITE',
      stageEndsAt: null,
      revealAt: null,
      defs: {},
      options: [],
      votes: {},
      marked: [],
    };
    newRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const playing = active(s).includes(me);
    if (type === 'MG_DEF') {
      if (s.stage !== 'WRITE' || !playing) return false;
      const text = clean(payload?.text, MAX_DEF);
      if (!text || text === s.defs[me]) return false;
      s.defs[me] = text;
      if (allWritten(s, ctx)) toVote(s, ctx);
      return true;
    }
    if (type === 'MG_VOTE') {
      const i = Number(payload?.i);
      if (s.stage !== 'VOTE' || !playing || !Number.isInteger(i) || !s.options[i] || s.options[i].authors.includes(me)) return false;
      if (s.votes[me] === i) return false;
      s.votes[me] = i;
      if (allVoted(s, ctx)) toReveal(s, ctx);
      return true;
    }
    if (type === 'MG_MARK') {
      // chi guida può dire che una "bugia" in realtà era giusta: +3 all'autore e chi l'ha votata indovina
      const i = Number(payload?.i);
      if (s.stage !== 'REVEAL' || !ctx.canLead(me) || !Number.isInteger(i) || !s.options[i] || s.options[i].real) return false;
      s.marked = s.marked.includes(i) ? s.marked.filter((x) => x !== i) : [...s.marked, i];
      computeGained(s);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (s.stage === 'END') return false;
    if (s.stageEndsAt && ctx.now >= s.stageEndsAt) {
      advance(s, ctx);
      return true;
    }
    // chi mancava è uscito dall'app: si va avanti senza di lui
    if (s.stage === 'WRITE' && Object.keys(s.defs).length && allWritten(s, ctx)) {
      toVote(s, ctx);
      return true;
    }
    if (s.stage === 'VOTE' && Object.keys(s.votes).length && allVoted(s, ctx)) {
      toReveal(s, ctx);
      return true;
    }
    return false;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): DizionarioView {
    const open = s.stage === 'REVEAL' || s.stage === 'END';
    const options = s.stage === 'WRITE' ? [] : s.options;
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      rounds: s.rounds,
      word: s.word[0],
      cat: DIZ_CAT[s.word[1]] ?? '',
      stageEndsAt: s.stageEndsAt,
      revealAt: open ? s.revealAt : null,
      written: Object.keys(s.defs),
      myDef: s.defs[me] ?? null,
      options: options.map((o, i) =>
        open
          ? {
              text: o.text,
              mine: o.authors.includes(me),
              real: o.real,
              authors: o.authors,
              voters: Object.entries(s.votes)
                .filter(([, v]) => v === i)
                .map(([id]) => id),
              marked: s.marked.includes(i),
            }
          : { text: o.text, mine: o.authors.includes(me) },
      ),
      voted: Object.keys(s.votes),
      myVote: s.votes[me] ?? null,
      real: open ? s.word[2] : null,
      exact: open ? (s.options.find((o) => o.real)?.authors ?? []) : [],
      scores: s.scores,
      gained: s.gained,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id) || s.gone.includes(id)) return false;
    s.gone.push(id);
    delete s.scores[id];
    delete s.defs[id];
    delete s.votes[id];
    if (s.stage === 'REVEAL') computeGained(s);
    if (!active(s).length) {
      s.stage = 'END';
      s.stageEndsAt = null;
      return true;
    }
    if (s.stage === 'WRITE' && Object.keys(s.defs).length && allWritten(s, ctx)) toVote(s, ctx);
    else if (s.stage === 'VOTE' && Object.keys(s.votes).length && allVoted(s, ctx)) toReveal(s, ctx);
    return true;
  },
};

registerFlat('DIZIONARIO', dizionario);
