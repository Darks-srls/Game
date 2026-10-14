import { registerBot, type FlatBot } from './types';

// risponde a caso (non conosce la giusta) dopo averci pensato un po'; ogni tanto qualcuno non risponde proprio
export const quizzone: FlatBot = (v, me, { rand }) => {
  if (v.stage !== 'QUESTION' || !v.answers || v.myPick !== null) return null;
  if ((me.charCodeAt(me.length - 1) + v.qNo) % 5 === 0) return null; // questo giro lascia scadere il tempo
  if (rand() < 0.02) return { type: 'MG_ANSWER', payload: { i: 9 } }; // mossa non valida: il server deve ignorarla
  if (rand() < 0.55) return null;
  return { type: 'MG_ANSWER', payload: { i: Math.floor(rand() * 4) } };
};

registerBot('QUIZZONE', quizzone);
