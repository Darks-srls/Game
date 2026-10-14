import { registerBot, type FlatBot } from './types';

const ENDINGS = ['ino', 'ella', 'orto', 'ampo', 'ucca', 'ero', 'ana'];
// una parola che inizia con la lettera (poche varianti: così escono anche le risposte uguali); ogni tanto una sbagliata
const word = (letter: string, rand: () => number) => {
  if (rand() < 0.08) return letter === 'Z' ? 'Abete' : 'Zucca';
  return letter + ENDINGS[Math.floor(rand() * ENDINGS.length)];
};

export const nomicose: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  if (v.stage === 'WRITE' && v.myAnswers) {
    const answers = [...v.myAnswers];
    const empty = answers.findIndex((x: string) => !x);
    if (empty >= 0 && rand() < 0.5) {
      answers[empty] = rand() < 0.1 ? '' : word(v.letter, rand);
      return { type: 'MG_ANSWERS', payload: { answers } };
    }
    if (empty < 0 && !v.stoppedBy && rand() < 0.15) return { type: 'MG_STOP', payload: { answers } };
    return null;
  }
  if (v.stage === 'REVIEW' && v.order.includes(me)) {
    if (rand() < 0.25) {
      const cat = Math.floor(rand() * v.rows.length);
      const row = v.rows[cat]?.filter((r: any) => r.by !== me && r.status !== 'vuota' && r.status !== 'lettera');
      if (row?.length) return { type: 'MG_FLAG', payload: { id: row[Math.floor(rand() * row.length)].by, cat } };
    }
    if (!v.done.includes(me) && rand() < 0.2) return { type: 'MG_DONE' };
  }
  return null;
};

registerBot('NOMICOSE', nomicose);
