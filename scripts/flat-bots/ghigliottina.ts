import { GH_ITEMS, GH_ITEMS_SPICY } from '../../src/data/flat/ghigliottina';
import { registerBot, type FlatBot } from './types';

const ALL = [...GH_ITEMS, ...GH_ITEMS_SPICY];
const WRONG = ['casa', 'mare', 'tempo', 'boh', 'sole', 'cane', 'fuoco'];

export const ghigliottina: FlatBot = (v, me, { rand }) => {
  if (v.stage !== 'PLAY' || v.me.solved || !v.order.includes(me) || !v.clues.length) return null;
  // il bot "riconosce" la ghigliottina dagli indizi già usciti
  const it = ALL.find((x) => v.clues.every((c: string, i: number) => x.w[i] === c));
  const r = rand();
  // più indizi ci sono, più è facile; p3 non la sa mai (così si chiude anche per tempo scaduto)
  if (it && me !== 'p3' && r < 0.008 * v.clues.length * v.clues.length) {
    const k = rand();
    const text = k < 0.25 ? it.a.toLowerCase() : k < 0.4 && it.alt.length ? it.alt[0] : k < 0.5 && it.a.length >= 6 ? it.a.slice(0, -2) + it.a.slice(-1) + it.a.slice(-2, -1) : it.a;
    return { type: 'MG_GUESS', payload: { text } };
  }
  if (r > 0.94) return { type: 'MG_GUESS', payload: { text: it && rand() < 0.4 ? it.a.slice(0, -1) + 'x' : WRONG[Math.floor(rand() * WRONG.length)] } };
  return null;
};

registerBot('GHIGLIOTTINA', ghigliottina);
