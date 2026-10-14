// ☝️ Una parola sola (cooperativo): chi indovina non vede la parola, gli altri scrivono un indizio di UNA parola;
// gli indizi uguali (o vietati) si cancellano prima che lui li veda.
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import { PU_WORDS, PU_WORDS_SPICY, type ParolaUnicaView } from '../../src/data/flat/parolaunica';
import type { Ctx, Mode } from '../modes';
import { clean, deck } from '../party';
import { registerFlat } from './registry';

const CLUE_MS = 70_000;
const CHECK_MS = 25_000;
const GUESS_MS = 50_000;
const RESULT_MS = 7_000;

type Why = 'uguale' | 'vietato' | 'bocciato';

interface PUState {
  order: string[];
  words: string[];
  cardNo: number; // carta in gioco (da 1)
  cards: number;
  burned: number; // carte bruciate dagli errori
  turn: number;
  guesser: string;
  word: string;
  stage: ParolaUnicaView['stage'];
  stageEndsAt: number | null;
  clues: Record<string, string>;
  auto: Record<string, Why>; // cancellati in automatico
  flags: Record<string, string[]>; // autore dell'indizio → chi l'ha segnalato
  okBy: string[];
  guess: string | null;
  result: 'OK' | 'KO' | 'PASS' | null;
  score: number;
  history: ParolaUnicaView['history'];
}

// per confrontare: minuscole, senza accenti, spazi e apostrofi
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
// stessa radice (gatto/gatti/gattino): le prime 5 lettere uguali bastano per le parole lunghe
const sameRoot = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)) || (a.length >= 4 && (b.includes(a) || a.includes(b)));

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const writers = (s: PUState) => s.order.filter((id) => id !== s.guesser);
const onlineWriters = (s: PUState, ctx: Ctx) => writers(s).filter((id) => ctx.isOnline(id));
const cancelled = (s: PUState, id: string): Why | null => {
  if (s.auto[id]) return s.auto[id];
  // bocciato dalla maggioranza di chi controlla (escluso l'autore)
  const judges = Math.max(1, writers(s).length - 1);
  return (s.flags[id]?.length ?? 0) * 2 > judges ? 'bocciato' : null;
};

function newCard(s: PUState, ctx: Ctx) {
  s.guesser = s.order[s.turn % s.order.length];
  // chi indovina deve essere collegato (se no si passa al prossimo)
  for (let k = 0; k < s.order.length && !ctx.isOnline(s.guesser); k++) {
    s.turn += 1;
    s.guesser = s.order[s.turn % s.order.length];
  }
  s.word = s.words[(s.cardNo - 1 + s.burned) % s.words.length];
  s.stage = 'CLUE';
  s.stageEndsAt = ctx.now + CLUE_MS;
  s.clues = {};
  s.auto = {};
  s.flags = {};
  s.okBy = [];
  s.guess = null;
  s.result = null;
}

// fine della scrittura: si cancellano da soli gli indizi uguali tra loro o troppo simili alla parola
function toCheck(s: PUState, ctx: Ctx) {
  const w = norm(s.word);
  const ids = Object.keys(s.clues);
  for (const id of ids) {
    const c = norm(s.clues[id]);
    if (!c || sameRoot(c, w)) s.auto[id] = 'vietato';
  }
  for (const a of ids)
    for (const b of ids) {
      if (a >= b || s.auto[a] === 'vietato' || s.auto[b] === 'vietato') continue;
      const ca = norm(s.clues[a]);
      const cb = norm(s.clues[b]);
      if (ca === cb || sameRoot(ca, cb)) s.auto[a] = s.auto[b] = 'uguale';
    }
  // con meno di 3 indizi non serve il controllo a mano: si va dritti a indovinare
  if (ids.length <= 2) return toGuess(s, ctx);
  s.stage = 'CHECK';
  s.stageEndsAt = ctx.now + CHECK_MS;
}

function toGuess(s: PUState, ctx: Ctx) {
  s.stage = 'GUESS';
  s.stageEndsAt = ctx.now + GUESS_MS;
}

function finish(s: PUState, ctx: Ctx, result: 'OK' | 'KO' | 'PASS', guess: string | null) {
  s.result = result;
  s.guess = guess;
  if (result === 'OK') s.score += 1;
  // sbagliare costa una carta in più (si brucia la prossima)
  if (result === 'KO' && s.cardNo + s.burned < s.cards) s.burned += 1;
  s.history.push({ word: s.word, guesser: s.guesser, result, guess });
  s.stage = 'RESULT';
  s.stageEndsAt = ctx.now + RESULT_MS;
}

function next(s: PUState, ctx: Ctx) {
  if (s.cardNo + s.burned >= s.cards) {
    s.stage = 'END';
    s.stageEndsAt = null;
    return;
  }
  s.cardNo += 1;
  s.turn += 1;
  newCard(s, ctx);
}

const allWritten = (s: PUState, ctx: Ctx) => onlineWriters(s, ctx).every((id) => id in s.clues);
const allChecked = (s: PUState, ctx: Ctx) => onlineWriters(s, ctx).every((id) => s.okBy.includes(id));

export const parolaunica: Mode<PUState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const cards = flatOpt(settings, 'PAROLAUNICA', 'carte');
    const s: PUState = {
      order,
      words: deck(PU_WORDS, PU_WORDS_SPICY, settings.spicy),
      cardNo: 1,
      cards,
      burned: 0,
      turn: Math.floor(Math.random() * order.length),
      guesser: '',
      word: '',
      stage: 'CLUE',
      stageEndsAt: null,
      clues: {},
      auto: {},
      flags: {},
      okBy: [],
      guess: null,
      result: null,
      score: 0,
      history: [],
    };
    newCard(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (type === 'MG_CLUE') {
      if (s.stage !== 'CLUE' || me === s.guesser || !s.order.includes(me)) return false;
      // una parola sola: si tiene il primo pezzo
      const text = clean(payload?.text, 24).split(' ')[0];
      if (!text) return false;
      s.clues[me] = text;
      if (allWritten(s, ctx)) toCheck(s, ctx);
      return true;
    }
    if (type === 'MG_FLAG') {
      const id = String(payload?.id ?? '');
      if (s.stage !== 'CHECK' || me === s.guesser || id === me || !(id in s.clues) || !s.order.includes(me)) return false;
      const list = s.flags[id] ?? [];
      s.flags[id] = list.includes(me) ? list.filter((x) => x !== me) : [...list, me];
      return true;
    }
    if (type === 'MG_OK') {
      if (s.stage !== 'CHECK' || me === s.guesser || s.okBy.includes(me)) return false;
      s.okBy.push(me);
      if (allChecked(s, ctx)) toGuess(s, ctx);
      return true;
    }
    if (type === 'MG_GUESS') {
      if (s.stage !== 'GUESS' || me !== s.guesser) return false;
      const text = clean(payload?.text, 30);
      if (!text) return false;
      const g = norm(text);
      const w = norm(s.word);
      // un errore di battitura nelle parole lunghe si perdona
      const ok = g === w || (w.length >= 6 && distance(g, w) <= 1);
      finish(s, ctx, ok ? 'OK' : 'KO', text);
      return true;
    }
    if (type === 'MG_PASS') {
      if (s.stage !== 'GUESS' || me !== s.guesser) return false;
      finish(s, ctx, 'PASS', null);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      if (s.stage === 'CLUE') toCheck(s, ctx);
      else if (s.stage === 'CHECK') toGuess(s, ctx);
      else if (s.stage === 'GUESS') finish(s, ctx, 'PASS', null);
      else next(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'CLUE') toCheck(s, ctx);
    else if (s.stage === 'CHECK') toGuess(s, ctx);
    else if (s.stage === 'GUESS') finish(s, ctx, 'PASS', null);
    else if (s.stage === 'RESULT') next(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): ParolaUnicaView {
    const iGuess = me === s.guesser;
    const reveal = s.stage === 'RESULT' || s.stage === 'END';
    const showAll = !iGuess && (s.stage === 'CHECK' || s.stage === 'GUESS' || reveal);
    const showValid = iGuess && (s.stage === 'GUESS' || reveal);
    const clues = showAll || showValid
      ? Object.entries(s.clues).map(([by, text]) => {
          const why = cancelled(s, by);
          // chi indovina non vede il testo degli indizi cancellati (fino al risultato)
          return { by, text: why && iGuess && !reveal ? null : text, cancelled: !!why, why, flags: s.flags[by]?.length ?? 0 };
        })
      : [];
    return {
      stage: s.stage,
      order: s.order,
      guesser: s.guesser,
      cardNo: s.cardNo,
      cards: s.cards,
      left: Math.max(0, s.cards - s.cardNo - s.burned),
      word: iGuess && !reveal ? null : s.word,
      stageEndsAt: s.stageEndsAt,
      written: Object.keys(s.clues),
      myClue: s.clues[me] ?? null,
      clues,
      myFlags: Object.entries(s.flags)
        .filter(([, by]) => by.includes(me))
        .map(([id]) => id),
      okBy: s.okBy,
      guess: s.guess,
      result: s.result,
      score: s.score,
      history: s.history,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END') return false;
    // se esce chi indovina si passa alla carta dopo; se mancava solo lui a scrivere si va avanti
    if (id === s.guesser && s.stage !== 'RESULT') {
      finish(s, ctx, 'PASS', null);
      return true;
    }
    if (s.stage === 'CLUE' && Object.keys(s.clues).length && allWritten(s, ctx)) {
      toCheck(s, ctx);
      return true;
    }
    if (s.stage === 'CHECK' && allChecked(s, ctx)) {
      toGuess(s, ctx);
      return true;
    }
    return false;
  },
};

registerFlat('PAROLAUNICA', parolaunica);
