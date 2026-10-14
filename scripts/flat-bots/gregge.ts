import { registerBot, type FlatBot } from './types';

// risposte con varianti scritte male: il server deve raggrupparle da solo (banana/Banane/la banana/bananna…)
const ANSWERS = [
  ['banana', 'Banane', 'la banana', 'bananna', 'BANANA!'],
  ['limone', 'limoni', 'un limone'],
  ['ananas', 'l’ananas'],
  ['sette', '7'],
  ['arancia', 'arance'],
  ['pizza margherita'],
  ['fungo', 'funghi'],
];

export const gregge: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  if (v.stage === 'WRITE' && !v.myAnswer) {
    // quasi sempre una delle prime risposte (il gregge), a volte una strana (la pecora nera)
    const set = ANSWERS[rand() < 0.75 ? Math.floor(rand() * 2) : Math.floor(rand() * ANSWERS.length)];
    return { type: 'MG_ANSWER', payload: { text: rand() < 0.05 ? `boh ${me}` : set[Math.floor(rand() * set.length)] } };
  }
  if (v.stage === 'MERGE' && !v.done.includes(me)) {
    const g = v.groups;
    if (rand() < 0.15 && g.length >= 2) {
      const i = Math.floor(rand() * g.length);
      const j = (i + 1 + Math.floor(rand() * (g.length - 1))) % g.length;
      return { type: 'MG_MERGE', payload: { a: g[i].id, b: g[j].id } };
    }
    const big = g.find((x: any) => x.atoms > 1);
    if (big && rand() < 0.05) return { type: 'MG_SPLIT', payload: { g: big.id } };
    return rand() < 0.4 ? { type: 'MG_DONE' } : null;
  }
  return null;
};

registerBot('GREGGE', gregge);
