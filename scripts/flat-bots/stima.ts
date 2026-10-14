import { registerBot, type FlatBot } from './types';

// stime a caso ma plausibili (anni tra 1000 e 2025, altrimenti da 1 a 100.000), fiches su caselle a caso;
// ogni tanto qualcuno non scrive o non punta (prova i tempi scaduti)
export const stima: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // ci pensano un po'
  const lazy = (me.charCodeAt(me.length - 1) + v.round) % 5 === 0;
  if (v.stage === 'GUESS' && v.myGuess === null && !lazy) {
    const year = String(v.unit).startsWith('anno');
    const value = year ? 1000 + Math.floor(rand() * 1026) : Math.round(10 ** (rand() * 5));
    return { type: 'MG_GUESS', payload: { value: rand() < 0.03 ? 'boh' : String(value) } };
  }
  if (v.stage === 'BET' && !lazy) {
    if (v.myBets.length >= v.chips) return rand() < 0.05 ? { type: 'MG_CLEAR' } : null;
    return { type: 'MG_BET', payload: { slot: rand() < 0.03 ? 99 : Math.floor(rand() * v.slots.length) } };
  }
  return null;
};

registerBot('STIMA', stima);
