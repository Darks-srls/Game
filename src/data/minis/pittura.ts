// 🎨 Pennellate: un pavimento di 24×24 piastrelle di maiolica da colorare col proprio colore (regole fisiche)
import { PHYS, registerMini } from '../party3d';

export const PAINT = {
  n: 24, // piastrelle per lato (1 m l'una)
  half: 12,
  splashR: 3, // il secchio colora un cerchio di questo raggio
  bucketPick: 1.35, // si prende passandoci sopra
  dropMs: 1300, // il secchio cade dal cielo (si vede dove atterra)
  maxBuckets: 2,
  every: [3200, 6200] as const, // ogni quanto ne arriva uno (ms)
  stunMs: 1100, // dopo uno schiaffo si perde l'equilibrio: niente colore per un attimo
  sendMs: 1000, // il pavimento intero viaggia al massimo ogni secondo (i cambi minuti come effetti)
};
export const PAINT_N = PAINT.n * PAINT.n; // 576
// un carattere per piastrella: '.' libera, altrimenti l'indice del giocatore nell'elenco (order)
export const PAINT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const PAINT_EMPTY = '.';

// che piastrella c'è sotto (x, z)? -1 = fuori
export function paintTileAt(x: number, z: number) {
  const i = Math.floor(x + PAINT.half);
  const j = Math.floor(z + PAINT.half);
  return i < 0 || j < 0 || i >= PAINT.n || j >= PAINT.n ? -1 : j * PAINT.n + i;
}
export const paintTileCenter = (k: number) => ({ x: (k % PAINT.n) - PAINT.half + 0.5, z: Math.floor(k / PAINT.n) - PAINT.half + 0.5 });

// le piastrelle (indici) dentro un cerchio
export function paintTilesIn(x: number, z: number, r: number, out: number[] = []) {
  out.length = 0;
  const i0 = Math.max(0, Math.floor(x - r + PAINT.half));
  const i1 = Math.min(PAINT.n - 1, Math.floor(x + r + PAINT.half));
  const j0 = Math.max(0, Math.floor(z - r + PAINT.half));
  const j1 = Math.min(PAINT.n - 1, Math.floor(z + r + PAINT.half));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const cx = i - PAINT.half + 0.5;
      const cz = j - PAINT.half + 0.5;
      if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r) out.push(j * PAINT.n + i);
    }
  return out;
}

registerMini({
  kind: 'PITTURA',
  name: 'Pennellate',
  tag: 'Colora più di tutti',
  rules: 'Ognuno ha il suo rullo: dove passi le piastrelle prendono il tuo colore (anche quelle già colorate dagli altri). Prendi i secchi di vernice che cadono dal cielo: SPLASH! Lo schiaffo fa perdere l’equilibrio. Vince chi alla fine ha più piastrelle.',
  seconds: 60,
  // la cornice d'oro tiene tutti dentro il quadro
  clamp: (p) => {
    const m = PAINT.half - PHYS.radius;
    if (p.x < -m) p.x = -m;
    else if (p.x > m) p.x = m;
    if (p.z < -m) p.z = -m;
    else if (p.z > m) p.z = m;
  },
});
