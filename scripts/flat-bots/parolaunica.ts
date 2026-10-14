import { registerBot, type FlatBot } from './types';

const WORDS = ['casa', 'rosso', 'grande', 'acqua', 'notte', 'veloce', 'dolce', 'freddo'];
export const parolaunica: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.6) return null; // pensano un po'
  if (v.stage === 'CLUE' && v.guesser !== me && !v.myClue) return { type: 'MG_CLUE', payload: { text: WORDS[Math.floor(rand() * WORDS.length)] } };
  if (v.stage === 'CHECK' && v.guesser !== me) {
    const other = v.clues.find((c: any) => c.by !== me && !c.cancelled);
    if (other && rand() < 0.2) return { type: 'MG_FLAG', payload: { id: other.by } };
    if (!v.okBy.includes(me)) return { type: 'MG_OK' };
  }
  if (v.stage === 'GUESS' && v.guesser === me) return rand() < 0.15 ? { type: 'MG_PASS' } : { type: 'MG_GUESS', payload: { text: rand() < 0.3 ? 'gatto' : 'boh' } };
  return null;
};

registerBot('PAROLAUNICA', parolaunica);
