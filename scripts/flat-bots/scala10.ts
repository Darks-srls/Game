import { registerBot, type FlatBot } from './types';

const WORDS = ['un sasso', 'la nonna', 'un panino', 'una Ferrari', 'il gatto', 'una festa', 'un mutuo', 'la pizza', 'un drago'];

export const scala10: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.5) return null; // pensano un po'
  if (v.stage === 'WRITE' && v.myNumber !== null && (!v.myAnswer || rand() < 0.03)) {
    // di solito un aiutino col numero dentro (così il capitano finto può fare bene), a volte una risposta a caso
    const word = WORDS[Math.floor(rand() * WORDS.length)];
    return { type: 'MG_ANSWER', payload: { text: rand() < 0.7 ? `${word} da ${v.myNumber}` : word } };
  }
  if (v.stage === 'ORDER' && v.captain === me) {
    if (rand() < 0.05) return null; // a volte si distrae e scade il tempo
    const guess = (t: string) => Number(/(\d+)/.exec(t)?.[1] ?? 1 + Math.floor(rand() * 10));
    const placed: number[] = v.arrange;
    const free = v.answers.filter((a: any) => !placed.includes(a.id));
    if (free.length) {
      // mette in fila una risposta alla volta (come col pollice), nel punto giusto secondo il numero che "capisce"
      const a = free[Math.floor(rand() * free.length)];
      const at = placed.findIndex((id) => guess(v.answers.find((x: any) => x.id === id).text) > guess(a.text));
      const ids = [...placed];
      ids.splice(at < 0 ? ids.length : at, 0, a.id);
      return { type: 'MG_ARRANGE', payload: { ids } };
    }
    // ogni tanto scambia due risposte prima di confermare (errori!)
    if (rand() < 0.15 && placed.length >= 2) {
      const ids = [...placed];
      const i = Math.floor(rand() * (ids.length - 1));
      [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
      return { type: 'MG_ARRANGE', payload: { ids } };
    }
    return { type: 'MG_CONFIRM' };
  }
  return null;
};

registerBot('SCALA10', scala10);
