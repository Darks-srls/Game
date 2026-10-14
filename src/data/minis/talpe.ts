// 🐹 Schiaccia le talpe: sul tagliere gigante spuntano talpe col cappello da cuoco. Si schiacciano ATTERRANDOCI sopra da un salto
// (regole fisiche: piano di lavoro quadrato con il bordo rialzato, buche a filo del piano)
import { PHYS, registerMini } from '../party3d';

export const TALPE = {
  n: 5, // griglia 5×5 di buche
  step: 4.5, // distanza tra le buche
  half: 12.6, // il tagliere (dal centro al bordo)
  holeR: 0.8, // la buca (grafica)
  hitR: 1.3, // atterrando entro 1,3 m dal centro della buca la talpa è schiacciata
  warn: 450, // la terra trema un attimo prima che spunti
  upMax: 1600, // quanto resta fuori all'inizio…
  upMin: 900, // … e alla fine
  pts: [1, 3, -2], // talpa normale, d'oro, bomba
  boomR: 2.3, // la bomba che scoppia da sola spinge chi è vicino
};

export const holeX = (i: number) => ((i % TALPE.n) - (TALPE.n - 1) / 2) * TALPE.step;
export const holeZ = (i: number) => (Math.floor(i / TALPE.n) - (TALPE.n - 1) / 2) * TALPE.step;

registerMini({
  kind: 'TALPE',
  name: 'Schiaccia le talpe',
  tag: 'Salta e schiaccia',
  rules:
    'Dalle buche del tagliere spuntano talpe col cappello da cuoco: schiacciale ATTERRANDOCI SOPRA da un salto (+1). Quella d’oro vale 3, quella nera con la miccia è una bomba: −2 e voli via! Sempre più talpe, sempre più veloci. Lo schiaffo spinge gli altri.',
  seconds: 60,
  clamp: (p) => {
    const m = TALPE.half - PHYS.radius;
    if (p.x > m) p.x = m;
    else if (p.x < -m) p.x = -m;
    if (p.z > m) p.z = m;
    else if (p.z < -m) p.z = -m;
  },
});
