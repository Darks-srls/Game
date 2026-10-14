import { CQ_WORDS, CQ_WORDS_SPICY, cqMarks } from '../../src/data/flat/cinque';
import { registerBot, type FlatBot } from './types';

const ALL = [...new Set([...CQ_WORDS, ...CQ_WORDS_SPICY])];

// un piccolo risolutore: prova solo parole che rispettano i colori già visti (p2 invece tira a caso)
export const cinque: FlatBot = (v, me, { rand }) => {
  if (v.stage !== 'PLAY' || !v.order.includes(me)) return null;
  const rows: { w: string; c: string }[] = v.myRows;
  if (rows.length >= v.maxTries || rows.some((r) => r.c === 'GGGGG')) return null;
  if (rand() < 0.85) return null; // ci pensa su
  if (rand() < 0.05) return { type: 'MG_GUESS', payload: { word: rand() < 0.5 ? 'xyz' : 'zzzzz' } }; // parole non valide: il server le ignora
  const tried = new Set(rows.map((r) => r.w));
  const fits = me === 'p2' ? ALL : ALL.filter((w) => rows.every((r) => cqMarks(r.w, w) === r.c));
  const pool = fits.filter((w) => !tried.has(w));
  const list = pool.length ? pool : ALL.filter((w) => !tried.has(w));
  const word = list[Math.floor(rand() * list.length)];
  return { type: 'MG_GUESS', payload: { word: rand() < 0.2 ? word.toUpperCase() : word } };
};

registerBot('CINQUE', cinque);
