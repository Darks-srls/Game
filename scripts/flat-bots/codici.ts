import { registerBot, type FlatBot } from './types';

// indizi a caso (qualcuno può capitare sul tabellone: il server lo rifiuta e il bot ci riprova)
const CLUES = ['zorro', 'vento', 'marte', 'galassia', 'cibo', 'notte', 'paura', 'acqua', 'metallo', 'sport', 'animale', 'freddo', 'dolce'];
// "telepatia" da banco di prova: i capitani finti passano la chiave ai compagni, così le partite finiscono anche a parole
// scoperte e non solo sull'assassino (un capitano vero lo fa con gli indizi)
let key: (string | null)[] = [];

export const codici: FlatBot = (v, me, { rand }) => {
  if (v.amCaptain) key = v.cards.map((c: any) => c.color);
  if (rand() < 0.5) return null; // pensano un po'
  if (v.stage === 'INTRO') return v.ready.includes(me) || rand() < 0.3 ? null : { type: 'MG_READY' };
  const myTeam = v.teams[me];
  if (myTeam !== v.turn) return null;
  if (v.stage === 'CLUE' && v.amCaptain && v.captains[v.turn] === me) {
    const n = rand() < 0.1 ? 0 : rand() < 0.1 ? -1 : 1 + Math.floor(rand() * 3);
    return { type: 'MG_CLUE', payload: { word: CLUES[Math.floor(rand() * CLUES.length)], n } };
  }
  if (v.stage === 'GUESS' && v.captains[v.turn] !== me) {
    const mine = v.cards.findIndex((c: any) => c.picks.includes(me));
    // dopo qualche carta a volte si passa
    if (v.guesses >= 1 && rand() < 0.2) return { type: 'MG_PASS' };
    if (mine >= 0) return rand() < 0.5 ? { type: 'MG_REVEAL', payload: { i: mine } } : null;
    const closed = v.cards.map((c: any, i: number) => (!c.open ? i : -1)).filter((i: number) => i >= 0);
    const good = closed.filter((i: number) => key[i] === (myTeam === 0 ? 'R' : 'B'));
    const others = closed.filter((i: number) => v.cards[i].picks.length);
    // di solito la carta giusta, a volte quella di un compagno, a volte a caso (errori, passanti, assassino)
    const r = rand();
    const pool = good.length && r < 0.75 ? good : others.length && r < 0.85 ? others : closed;
    return { type: 'MG_PICK', payload: { i: pool[Math.floor(rand() * pool.length)] } };
  }
  return null;
};

registerBot('CODICI', codici);
