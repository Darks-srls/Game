import { registerBot, type FlatBot } from './types';

// giocatore finto dell'Infiltrato: il Maestro risponde a caso e (quasi sempre) dice "hanno indovinato";
// un round su tre nessuno indovina, così si prova anche il tempo scaduto
export const infiltrato: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  const maestro = v.maestro === me;
  if (v.stage === 'ROLE') {
    if (maestro && v.choices && !v.wordChosen) return { type: 'MG_WORD', payload: { word: v.choices[Math.floor(rand() * v.choices.length)] } };
    if (!v.ready.includes(me)) return { type: 'MG_READY' };
  }
  if (v.stage === 'ASK' && maestro) {
    if (v.round % 3 !== 0 && v.answerNo >= 4 && rand() < 0.05) {
      const others = v.order.filter((id: string) => id !== me);
      return { type: 'MG_GUESSED', payload: { by: rand() < 0.8 ? others[Math.floor(rand() * others.length)] : null } };
    }
    if (rand() < 0.3) return { type: 'MG_ANSWER', payload: { a: ['SI', 'NO', 'FORSE', 'QUASI'][Math.floor(rand() * 4)] } };
  }
  if (v.stage === 'VOTE' && (!v.myVote || rand() < 0.05)) {
    const options = v.order.filter((id: string) => id !== me && id !== v.maestro);
    if (options.length) return { type: 'MG_VOTE', payload: { id: options[Math.floor(rand() * options.length)] } };
  }
  return null;
};

registerBot('INFILTRATO', infiltrato);
