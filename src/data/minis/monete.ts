// 🪙 Pioggia di monete: in piazza piovono monete di cioccolato (e forme di parmigiano!). Arraffa tutto, schiaffeggia i ricchi
// (regole fisiche: piazza quadrata con i muretti e la fontana in mezzo)
import { PHYS, registerMini } from '../party3d';

export const MON = {
  half: 13, // piazza 26×26
  fountainR: 1.75, // la fontana al centro (ci si sbatte)
  pickR: 1.15, // si prende toccandola
  warn: 1200, // l'ombra si vede prima che la moneta atterri
  life: 8000, // resta a terra 8 secondi
  flight: 550, // monete che schizzano via (schiaffo, forma)
  formaWarn: 1500, // la forma di parmigiano: cerchio rosso prima che cada
  formaR: 2.1, // chi è sotto viene schiacciato
  big: 5, // valore della monetona d'oro
};

registerMini({
  kind: 'MONETE',
  name: 'Pioggia di monete',
  tag: 'Arraffa tutto',
  rules:
    'Piovono monete di cioccolato: guarda le ombre per terra e corri a prenderle (la monetona d’oro vale 5)! Attento al cerchio rosso: cade una forma di parmigiano che ti schiaccia e ti fa perdere metà delle monete. Uno SCHIAFFO fa cadere monete agli altri: riprendile! Vince chi ne ha di più.',
  seconds: 60,
  clamp: (p) => {
    const r = PHYS.radius;
    const m = MON.half - r;
    if (p.x > m) p.x = m;
    else if (p.x < -m) p.x = -m;
    if (p.z > m) p.z = m;
    else if (p.z < -m) p.z = -m;
    const d = Math.hypot(p.x, p.z);
    const min = MON.fountainR + r;
    if (d < min && d > 0.0001) {
      p.x *= min / d;
      p.z *= min / d;
    }
  },
});
