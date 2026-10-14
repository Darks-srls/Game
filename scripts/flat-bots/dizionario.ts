import { registerBot, type FlatBot } from './types';

// poche bugie: così capitano anche le definizioni uguali da unire
const FAKES = [
  'Piccolo attrezzo usato dai calzolai per bucare il cuoio.',
  'Dolce tipico della Lunigiana a base di castagne.',
  'Chi parla troppo durante i funerali.',
  'Malattia delle viti causata da un fungo.',
  'Dolce tipico della Lunigiana a base di castagne!',
  'Antica moneta d’argento della Repubblica di Venezia.',
  'Uccello migratore che nidifica sulle scogliere.',
];

export const dizionario: FlatBot = (v, me, { rand }) => {
  if (rand() < 0.55) return null; // pensano un po'
  if (v.stage === 'WRITE' && v.order.includes(me) && !v.myDef) {
    if (rand() < 0.1) return null; // qualcuno non scrive niente
    return { type: 'MG_DEF', payload: { text: FAKES[Math.floor(rand() * FAKES.length)] } };
  }
  if (v.stage === 'VOTE' && v.order.includes(me) && v.myVote === null) {
    const choices = v.options.map((o: any, i: number) => (o.mine ? -1 : i)).filter((i: number) => i >= 0);
    if (choices.length) return { type: 'MG_VOTE', payload: { i: choices[Math.floor(rand() * choices.length)] } };
  }
  // chi guida ogni tanto riconosce una bugia come giusta
  if (v.stage === 'REVEAL' && me === 'p1' && rand() < 0.05) {
    const fakes = v.options.map((o: any, i: number) => (o.real ? -1 : i)).filter((i: number) => i >= 0);
    if (fakes.length) return { type: 'MG_MARK', payload: { i: fakes[Math.floor(rand() * fakes.length)] } };
  }
  return null;
};

registerBot('DIZIONARIO', dizionario);
