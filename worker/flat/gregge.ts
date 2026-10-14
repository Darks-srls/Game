// 🐑 Il gregge (tipo Herd Mentality): tutti rispondono in segreto alla stessa domanda. Chi ha scritto la risposta più
// comune prende un punto; se UNO SOLO ha una risposta diversa da tutti prende la pecora nera (e finché ce l'ha non vince).
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { GREGGE_QUESTIONS, GREGGE_QUESTIONS_SPICY, type GreggeGroup, type GreggeView } from '../../src/data/flat/gregge';
import type { Ctx, Mode } from '../modes';
import { clean, deck } from '../party';
import { registerFlat } from './registry';

const WRITE_MS = 40_000;
const MERGE_MS = 15_000;
// la rivelazione dura un po' di più se ci sono tanti gruppi da far vedere
const revealMs = (groups: number) => Math.min(15_000, 7_000 + 700 * groups);
const MAX_ROUNDS = 30; // paracadute: dopo tante domande vince chi è davanti
const MAX_EMPTY = 3; // round di fila senza nessuna risposta: la partita si ferma

interface Group {
  id: string;
  atoms: string[]; // risposte "pulite" diverse che stanno nel gruppo
}

interface GreggeState {
  order: string[];
  meta: number;
  round: number;
  questions: string[];
  question: string;
  stage: GreggeView['stage'];
  stageEndsAt: number | null;
  players: string[];
  answers: Record<string, string>; // testo scritto
  atomOf: Record<string, string>; // giocatore → risposta pulita
  groups: Group[];
  nextId: number;
  done: string[];
  feed: GreggeView['feed'];
  blank: string[];
  herd: string | null;
  sheepTo: string | null;
  sheepFrom: string | null;
  sheep: string | null;
  scores: Record<string, number>;
  gained: Record<string, number>;
  winners: string[];
  endReason: GreggeView['endReason'];
  emptyRounds: number;
}

// ---------------------------------------------------------------- raggruppare le risposte da soli

const ARTICLES = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'dell']);
const STOP = new Set([...ARTICLES, 'di', 'd', 'da', 'dal', 'dalla', 'in', 'nel', 'nella', 'con', 'per', 'a', 'al', 'alla', 'ai', 'e', 'ed']);
const NUMBERS: Record<string, string> = {
  zero: '0', uno: '1', due: '2', tre: '3', quattro: '4', cinque: '5', sei: '6', sette: '7', otto: '8', nove: '9', dieci: '10',
  undici: '11', dodici: '12', tredici: '13', venti: '20', cento: '100', mille: '1000',
};

// risposta pulita: minuscole, senza accenti né punteggiatura, senza articolo davanti, numeri in cifre
export function atomOf(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  return words.map((w) => NUMBERS[w] ?? w).join(' ');
}

// radice di una parola: singolare/plurale e maschile/femminile diventano uguali (banana/banane, arancia/arance, fungo/funghi)
function stem(w: string): string {
  if (/^\d+$/.test(w) || w.length <= 3) return w;
  let s = w.replace(/[aeiou]$/, '');
  if (s.length >= 4 && s.endsWith('i')) s = s.slice(0, -1);
  if (/[cg]h$/.test(s)) s = s.slice(0, -1);
  return s;
}
const keyOf = (atom: string) => atom.split(' ').filter((w) => !STOP.has(w)).map(stem).join('') || atom.replace(/ /g, '');

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// piccoli errori di battitura: una lettera nelle parole medie, due in quelle lunghe
const typo = (a: string, b: string) => {
  const len = Math.min(a.length, b.length);
  return len >= 5 && Math.abs(a.length - b.length) <= 2 && distance(a, b) <= (len >= 9 ? 2 : 1);
};

function autoGroups(s: GreggeState): Group[] {
  const atoms = [...new Set(Object.values(s.atomOf))].sort();
  const parent = atoms.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const keys = atoms.map(keyOf);
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) if (keys[i] === keys[j] || typo(keys[i], keys[j])) parent[find(j)] = find(i);
  const byRoot = new Map<number, string[]>();
  atoms.forEach((a, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), a]));
  return [...byRoot.values()].map((list) => ({ id: `g${s.nextId++}`, atoms: list }));
}

const membersOf = (s: GreggeState, g: Group) => Object.keys(s.atomOf).filter((id) => g.atoms.includes(s.atomOf[id]));

// come si chiama il gruppo: la risposta scritta più spesso
function labelOf(s: GreggeState, g: Group): { label: string; variants: string[] } {
  const count = new Map<string, number>();
  for (const id of membersOf(s, g)) {
    const t = s.answers[id].toLowerCase();
    count.set(t, (count.get(t) ?? 0) + 1);
  }
  const variants = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return { label: variants[0] ?? '?', variants: variants.slice(0, 4) };
}

// ---------------------------------------------------------------- fasi

function newRound(s: GreggeState, ctx: Ctx) {
  s.round += 1;
  s.question = s.questions[(s.round - 1) % s.questions.length];
  s.players = s.order.filter((id) => ctx.isOnline(id));
  s.answers = {};
  s.atomOf = {};
  s.groups = [];
  s.done = [];
  s.feed = [];
  s.blank = [];
  s.herd = null;
  s.sheepTo = null;
  s.sheepFrom = null;
  s.gained = {};
  s.stage = 'WRITE';
  s.stageEndsAt = ctx.now + WRITE_MS;
}

function toMerge(s: GreggeState, ctx: Ctx) {
  s.atomOf = Object.fromEntries(Object.entries(s.answers).map(([id, t]) => [id, atomOf(t)]));
  s.groups = autoGroups(s);
  // con un gruppo solo (o nessuno) non c'è niente da unire
  if (s.groups.length <= 1) return toReveal(s, ctx);
  s.stage = 'MERGE';
  s.stageEndsAt = ctx.now + MERGE_MS;
}

// i migliori tra chi può vincere (senza pecora nera)
function leaders(s: GreggeState, min: number): string[] {
  const ok = s.order.filter((id) => id !== s.sheep && (s.scores[id] ?? 0) >= min);
  const best = Math.max(0, ...ok.map((id) => s.scores[id] ?? 0));
  return ok.filter((id) => (s.scores[id] ?? 0) === best);
}

function toReveal(s: GreggeState, ctx: Ctx) {
  s.groups = s.groups.filter((g) => membersOf(s, g).length > 0); // gruppi rimasti vuoti (qualcuno è uscito)
  // chi non ha risposto (ed è ancora collegato) conta come una risposta unica
  s.blank = s.players.filter((id) => !(id in s.answers) && ctx.isOnline(id) && s.order.includes(id));
  const sizes = s.groups.map((g) => membersOf(s, g).length);
  const max = Math.max(0, ...sizes);
  // il gregge prende punti solo se è il gruppo più numeroso e non è pari con un altro
  const top = s.groups.filter((_, i) => sizes[i] === max);
  s.herd = max >= 2 && top.length === 1 ? top[0].id : null;
  s.gained = {};
  if (s.herd) {
    for (const id of membersOf(s, top[0])) {
      s.scores[id] = (s.scores[id] ?? 0) + 1;
      s.gained[id] = 1;
    }
  }
  // pecora nera: solo se UNO SOLO è rimasto da solo
  const alone = [...s.groups.filter((_, i) => sizes[i] === 1).flatMap((g) => membersOf(s, g)), ...s.blank];
  s.sheepTo = null;
  s.sheepFrom = null;
  if (alone.length === 1) {
    s.sheepTo = alone[0];
    s.sheepFrom = s.sheep && s.sheep !== alone[0] ? s.sheep : null;
    s.sheep = alone[0];
  }
  s.emptyRounds = Object.keys(s.answers).length ? 0 : s.emptyRounds + 1;
  // si vince arrivando alla meta SENZA la pecora nera (a pari punti, vincono insieme)
  const atGoal = leaders(s, s.meta);
  if (atGoal.length) {
    s.winners = atGoal;
    s.endReason = 'meta';
  } else if (s.emptyRounds >= MAX_EMPTY || s.round >= MAX_ROUNDS) {
    s.winners = leaders(s, 1);
    s.endReason = s.emptyRounds >= MAX_EMPTY ? 'ferma' : 'limite';
  }
  s.stage = 'REVEAL';
  s.stageEndsAt = ctx.now + revealMs(s.groups.length);
}

function next(s: GreggeState, ctx: Ctx) {
  if (s.endReason) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  newRound(s, ctx);
}

const online = (s: GreggeState, ctx: Ctx) => s.players.filter((id) => ctx.isOnline(id) && s.order.includes(id));
const allWritten = (s: GreggeState, ctx: Ctx) => online(s, ctx).every((id) => id in s.answers);
const allDone = (s: GreggeState, ctx: Ctx) => online(s, ctx).every((id) => s.done.includes(id));

export const gregge: Mode<GreggeState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const s: GreggeState = {
      order,
      meta: flatOpt(settings, 'GREGGE', 'meta'),
      round: 0,
      questions: deck(GREGGE_QUESTIONS, GREGGE_QUESTIONS_SPICY, !!settings.spicy),
      question: '',
      stage: 'WRITE',
      stageEndsAt: null,
      players: [],
      answers: {},
      atomOf: {},
      groups: [],
      nextId: 1,
      done: [],
      feed: [],
      blank: [],
      herd: null,
      sheepTo: null,
      sheepFrom: null,
      sheep: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      gained: {},
      winners: [],
      endReason: null,
      emptyRounds: 0,
    };
    newRound(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (!s.order.includes(me)) return false;
    if (type === 'MG_ANSWER') {
      if (s.stage !== 'WRITE') return false;
      const text = clean(payload?.text, 40);
      if (!atomOf(text)) return false;
      if (!s.players.includes(me)) s.players.push(me); // rientrato a metà: gioca anche lui
      s.answers[me] = text; // si può cambiare finché non scrivono tutti
      if (allWritten(s, ctx)) toMerge(s, ctx);
      return true;
    }
    if (type === 'MG_MERGE') {
      const a = s.groups.find((g) => g.id === String(payload?.a ?? ''));
      const b = s.groups.find((g) => g.id === String(payload?.b ?? ''));
      if (s.stage !== 'MERGE' || !a || !b || a === b) return false;
      const text = `ha unito «${labelOf(s, a).label}» e «${labelOf(s, b).label}»`;
      a.atoms = [...a.atoms, ...b.atoms];
      s.groups = s.groups.filter((g) => g !== b);
      s.feed = [...s.feed, { by: me, text }].slice(-6);
      return true;
    }
    if (type === 'MG_SPLIT') {
      const g = s.groups.find((x) => x.id === String(payload?.g ?? ''));
      if (s.stage !== 'MERGE' || !g || g.atoms.length < 2) return false;
      const text = `ha separato «${labelOf(s, g).label}»`;
      const parts = g.atoms.map((atom) => ({ id: `g${s.nextId++}`, atoms: [atom] }));
      s.groups = s.groups.flatMap((x) => (x === g ? parts : [x]));
      s.feed = [...s.feed, { by: me, text }].slice(-6);
      return true;
    }
    if (type === 'MG_DONE') {
      if (s.stage !== 'MERGE' || s.done.includes(me)) return false;
      s.done.push(me);
      if (allDone(s, ctx)) toReveal(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'WRITE') toMerge(s, ctx);
      else if (s.stage === 'MERGE') toReveal(s, ctx);
      else next(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'WRITE') toMerge(s, ctx);
    else if (s.stage === 'MERGE') toReveal(s, ctx);
    else if (s.stage === 'REVEAL') next(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): GreggeView {
    const reveal = s.stage === 'REVEAL' || s.stage === 'END';
    const mine = s.atomOf[me];
    let groups: GreggeGroup[] = s.stage === 'WRITE' ? [] : s.groups.map((g) => ({
      id: g.id,
      ...labelOf(s, g),
      mine: !!mine && g.atoms.includes(mine),
      atoms: g.atoms.length,
      members: reveal ? membersOf(s, g) : null, // chi ha scritto cosa: sorpresa della rivelazione
    }));
    if (reveal) groups = groups.sort((a, b) => (b.members?.length ?? 0) - (a.members?.length ?? 0));
    return {
      stage: s.stage,
      order: s.order,
      round: s.round,
      meta: s.meta,
      question: s.question,
      stageEndsAt: s.stageEndsAt,
      players: s.players,
      written: Object.keys(s.answers),
      myAnswer: s.answers[me] ?? null,
      groups,
      blank: reveal ? s.blank : [],
      done: s.done,
      feed: s.feed,
      herd: reveal ? s.herd : null,
      sheepTo: reveal ? s.sheepTo : null,
      sheepFrom: reveal ? s.sheepFrom : null,
      sheep: s.sheep,
      scores: s.scores,
      gained: reveal ? s.gained : {},
      winners: s.stage === 'END' ? s.winners : [],
      endReason: s.stage === 'END' ? s.endReason : null,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    s.order = s.order.filter((x) => x !== id);
    s.players = s.players.filter((x) => x !== id);
    s.done = s.done.filter((x) => x !== id);
    delete s.scores[id];
    if (s.sheep === id) s.sheep = null;
    if (s.stage === 'WRITE' || s.stage === 'MERGE') {
      delete s.answers[id];
      delete s.atomOf[id];
      s.groups = s.groups.filter((g) => membersOf(s, g).length > 0);
    }
    if (s.stage === 'WRITE' && Object.keys(s.answers).length && allWritten(s, ctx)) toMerge(s, ctx);
    else if (s.stage === 'MERGE' && allDone(s, ctx)) toReveal(s, ctx);
    // da soli non si gioca: vince chi era davanti
    if (s.order.length < 2 && s.stage !== 'REVEAL') {
      s.winners = leaders(s, 1);
      s.endReason = 'ferma';
      s.stage = 'END';
      s.stageEndsAt = null;
    }
    return true;
  },
};

registerFlat('GREGGE', gregge);
