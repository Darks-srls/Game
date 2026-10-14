// 🥚 Caccia alle uova: rossi contro blu sull'aia. La gallona al centro fa le uova, ognuno le porta nel nido
// della sua squadra; si rubano dal nido degli altri e uno schiaffo fa cadere l'uovo (regole fisiche dell'arena)
import { PHYS, registerMini } from '../party3d';

export const UOVA = {
  halfX: 15, // aia 30 × 22 con lo steccato
  halfZ: 11,
  nestX: 12, // i nidi: rossi a x = -12, blu a x = +12
  nestR: 2.2,
  henR: 1.9, // il covone della gallona al centro (ostacolo)
  maxEggs: 8, // uova a terra al massimo (quelle fatte dalla gallona)
  pickR: 1.1, // un uovo si prende toccandolo
  carry: 0.85, // chi porta un uovo va più piano
  stealEvery: 2000, // pausa tra un furto e l'altro (a testa)
  flyMs: 600, // l'uovo vola (dalla gallona o da chi l'ha perso) prima di toccare terra
  gold: 3, // un uovo d'oro vale 3
  maxBonus: 6, // bonus personale: +1 per uovo portato, fino a 6
};
export const nestX = (team: number) => (team ? UOVA.nestX : -UOVA.nestX);
export const eggValue = (g: number) => (g ? UOVA.gold : 1);

registerMini({
  kind: 'UOVA',
  name: 'Caccia alle uova',
  tag: 'Rossi contro blu',
  rules:
    'Rossi contro blu sull’aia: la gallona al centro fa le uova. Toccane uno per prenderlo e portalo nel nido della tua squadra (con l’uovo in mano vai più piano). Toccando il nido degli avversari gli RUBI un uovo! Uno SCHIAFFO a chi porta un uovo glielo fa cadere. Le uova d’oro valgono 3.',
  seconds: 75,
  clamp: (p) => {
    const r = PHYS.radius;
    p.x = Math.max(-UOVA.halfX + r, Math.min(UOVA.halfX - r, p.x));
    p.z = Math.max(-UOVA.halfZ + r, Math.min(UOVA.halfZ - r, p.z));
    // il covone della gallona: si gira intorno
    const d = Math.hypot(p.x, p.z);
    const min = UOVA.henR + r;
    if (d < min) {
      if (d < 0.001) p.x = min;
      else {
        p.x *= min / d;
        p.z *= min / d;
      }
    }
  },
});
