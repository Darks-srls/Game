import { EMOJI, EMOJI_SPICY } from '../../src/data/flat/emoji';
import { registerBot, type FlatBot } from './types';

const ALL = [...EMOJI, ...EMOJI_SPICY];
const WRONG = ['boh', 'titanic', 'il re leone', 'chi dorme non piglia pesci', 'harry potter', 'bella ciao', 'friends'];

// scambia due lettere vicine (errore di battitura che deve essere perdonato)
const typo = (s: string) => (s.length < 8 ? s : s.slice(0, 3) + s[4] + s[3] + s.slice(5));

export const emoji: FlatBot = (v, me, { rand }) => {
  if (v.stage !== 'PLAY' || v.me.solved || !v.order.includes(me)) return null;
  // p2 non la sa mai (così si provano i tempi scaduti e gli aiutini)
  const it = ALL.find((x) => x.e === v.emoji);
  const r = rand();
  if (it && me !== 'p2' && r < 0.03 + v.hint * 0.03) {
    const k = rand();
    const text = k < 0.2 ? typo(it.a) : k < 0.35 && it.alt.length ? it.alt[0] : k < 0.45 ? it.a.toUpperCase() : it.a;
    return { type: 'MG_GUESS', payload: { text } };
  }
  if (r < 0.12) {
    // risposta sbagliata o quasi giusta (taglia l'ultima parola)
    const near = it && rand() < 0.4 ? it.a.split(' ').slice(0, -1).join(' ') || it.a.slice(0, -2) : WRONG[Math.floor(rand() * WRONG.length)];
    return { type: 'MG_GUESS', payload: { text: near } };
  }
  return null;
};

registerBot('EMOJI', emoji);
