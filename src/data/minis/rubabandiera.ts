// 🧺 Rubabandiera: due file una di fronte all'altra, ognuno ha un numero. La nonna al centro tiene lo strofinaccio
// e chiama un numero: chi lo prende deve tornare oltre la sua linea senza farsi toccare (regole fisiche dell'arena)
import { PHYS, registerMini } from '../party3d';

export const RUBA = {
  halfX: 13, // cortile 26 × 16
  halfZ: 8,
  lineZ: 4.6, // le linee di casa: rossi a z = -4.6, blu a z = +4.6 (chi ha lo strofinaccio torna oltre la sua)
  rowZ: 6.2, // la fila, dietro la linea
  gap: 2.2, // distanza tra due in fila
  grabR: 1.05, // lo strofinaccio (al centro) si prende toccandolo
  tagR: 1.4, // toccato!
  nonnaX: 1.45, // la nonna sta di lato, col braccio teso
  nonnaR: 0.85,
  waitMin: 1500, // la nonna chiama dopo un attimo a caso (non si può anticipare)
  waitMax: 3200,
  noGrab: 8000, // se nessuno lo prende: si riparte
  carryMax: 9000, // chi l'ha preso deve arrivare a casa in tempo
  pointMs: 2200,
  target: 5, // si vince a 5 punti
};

// il posto in fila del numero k (1..n): le due file sono "a specchio", così il 3 dei rossi e il 3 dei blu
// sono alla stessa distanza dallo strofinaccio (in diagonale, come nel cortile)
export function rubaSlot(team: number, k: number, n: number) {
  const x = (k - (n + 1) / 2) * RUBA.gap;
  return team ? { x: -x, z: RUBA.rowZ, r: Math.PI } : { x, z: -RUBA.rowZ, r: 0 };
}
export const NUM_WORDS = ['ZERO', 'UNO', 'DUE', 'TRE', 'QUATTRO', 'CINQUE', 'SEI', 'SETTE', 'OTTO', 'NOVE', 'DIECI'];

registerMini({
  kind: 'RUBABANDIERA',
  name: 'Rubabandiera',
  tag: 'Il classico del cortile',
  rules:
    'Due squadre in fila una di fronte all’altra: ognuno ha un numero (sulla casacca). La nonna chiama un numero (a volte due): solo quelli corrono! Chi tocca per primo lo strofinaccio lo prende e deve tornare oltre la sua linea senza farsi toccare dall’avversario con lo stesso numero. Arrivato = punto alla tua squadra, toccato = punto a loro. Fai finte, usa lo SCATTO. Si vince a 5.',
  seconds: 120,
  noPush: true, // qui si tocca, non si spinge
  clamp: (p) => {
    const r = PHYS.radius;
    p.x = Math.max(-RUBA.halfX + r, Math.min(RUBA.halfX - r, p.x));
    p.z = Math.max(-RUBA.halfZ + r, Math.min(RUBA.halfZ - r, p.z));
    // la nonna non si sposta
    const dx = p.x - RUBA.nonnaX;
    const d = Math.hypot(dx, p.z);
    const min = RUBA.nonnaR + r;
    if (d < min) {
      if (d < 0.001) p.x = RUBA.nonnaX - min;
      else {
        p.x = RUBA.nonnaX + (dx / d) * min;
        p.z = (p.z / d) * min;
      }
    }
  },
});
