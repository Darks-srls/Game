import { registerBot, type FlatBot } from './types';

// MS_FERMI=1 → nessuno tocca il telefono (si prova che la partita va avanti da sola coi tempi scaduti)
const fermi = typeof process !== 'undefined' && process.env?.MS_FERMI === '1';

// il giocatore finto manda risultati a caso: spesso giusti, a volte tardi, doppi, finti o di un'altra sfida
export const microsfide: FlatBot = (v, me, { rand, players }) => {
  if (fermi) return null;
  // l'ultimo giocatore (dai 3 in su) non fa mai niente: il gioco non deve aspettarlo
  if (players.length >= 3 && me === players[players.length - 1]) return null;
  const dur = v.endAt - v.playAt;
  if (v.stage === 'RANK' || v.stage === 'RESULT') {
    // risultato in ritardo (deve essere ignorato) o capo che salta la classifica
    if (rand() < 0.08) return { type: 'MG_DONE', payload: { n: v.n, ok: true, ms: 900 } };
    if (v.stage === 'RANK' && rand() < 0.15) return { type: 'MG_FORCE' };
    return null;
  }
  if (v.stage !== 'PLAY' && v.stage !== 'INTRO') return null;
  if (v.mine) return rand() < 0.1 ? { type: 'MG_DONE', payload: { n: v.n, ok: true, ms: 700 } } : null; // doppio invio: ignorato
  if (rand() < 0.45) return null; // sta ancora giocando
  const r = rand();
  if (r < 0.05) return { type: 'MG_DONE', payload: { n: v.n, ok: true, ms: 5 } }; // imbroglione: troppo veloce
  if (r < 0.09) return { type: 'MG_DONE', payload: { n: v.n - 1, ok: true, ms: 800 } }; // sfida vecchia
  if (r < 0.12) return { type: 'MG_DONE', payload: { n: v.n, ok: 'si', ms: 'boh' } }; // spazzatura
  if (r < 0.15) return { type: 'MG_DONE', payload: { n: v.n, ok: true, ms: dur * 5 } }; // tempo impossibile
  if (r < 0.17) return { type: 'MG_DONE', payload: null };
  return { type: 'MG_DONE', payload: { n: v.n, ok: rand() < 0.7, ms: Math.round(250 + rand() * (dur - 250)) } };
};

registerBot('MICROSFIDE', microsfide);
