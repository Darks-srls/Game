// 👑 Il re della pizza: chi sta da solo nel cerchio d'oro fa punti (regole fisiche dell'arena)
import { registerMini } from '../party3d';

export const RE = {
  r: 13, // raggio della pizza
  zoneR: 2.7, // raggio del cerchio d'oro
  every: 12_000, // ogni quanto si sposta il cerchio (all'inizio; poi sempre più spesso)
  minEvery: 7_000,
  warn: 3_000, // il cerchio nuovo si vede prima che si sposti
  respawnR: 11, // chi cade riparte dal bordo
};

registerMini({
  kind: 'RE',
  name: 'Il re della pizza',
  tag: 'Conquista la corona',
  rules: 'Sulla pizza gigante c’è un cerchio d’oro: chi ci sta dentro DA SOLO è il re e fa punti ogni secondo. In due non conta nessuno: a schiaffi! Ogni tanto il cerchio si sposta (si vede prima dove andrà). Chi cade riparte dal bordo.',
  seconds: 75,
  ground: (x, z) => (Math.hypot(x, z) <= RE.r ? 0 : null),
});
