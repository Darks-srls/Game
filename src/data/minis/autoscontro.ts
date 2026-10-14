// 🚗 Autoscontro: tutti su un'auto dello scontro, su una pista rotonda di granita che si scioglie dai bordi (regole fisiche)
import { registerMini } from '../party3d';

export const AUTO = {
  r0: 14, // raggio della pista all'inizio
  rMin: 7, // … e alla fine
  shrinkFrom: 12, // secondi prima che cominci a sciogliersi
  rate: 0.1, // metri al secondo
  hitR: 1.75, // due auto si toccano (distanza tra i centri)
  carR: 0.78, // ingombro dell'auto sul telefono (non si compenetrano)
  pairMs: 420, // la stessa coppia non si riurta subito
  koMs: 4000, // chi ti ha urtato negli ultimi 4 s si prende il merito se cadi
  minClose: 1.4, // sotto questa velocità d'avvicinamento è solo un contatto, non un BONK
};

export const autoRadius = (t: number) => (t < AUTO.shrinkFrom ? AUTO.r0 : Math.max(AUTO.rMin, AUTO.r0 - (t - AUTO.shrinkFrom) * AUTO.rate));

registerMini({
  kind: 'AUTOSCONTRO',
  name: 'Autoscontro',
  tag: 'Botte da orbi',
  rules: 'Tutti sull’autoscontro, sopra una granita gigante che si scioglie dai bordi: si scivola! Sperona gli altri (lo SCATTO è il turbo): chi va più forte spinge di più. Chi cade è fuori, vince l’ultimo in pista.',
  seconds: 90,
  speed: 1.25,
  grip: 2.2,
  noPush: true,
  noDoubleJump: true,
  ground: (x, z, t) => {
    const r = autoRadius(t);
    return x * x + z * z <= r * r ? 0 : null;
  },
});
