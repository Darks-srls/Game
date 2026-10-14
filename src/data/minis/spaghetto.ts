// 🍝 Spaghetto: si corre sempre (il joystick gira) e si lascia dietro uno spaghetto al sugo; chi tocca uno spaghetto
// (anche il suo) o i grissini del bordo è fuori. Saltando si passa sopra. (regole fisiche e codifica delle scie)
import { PHYS, registerMini } from '../party3d';

export const SPAG = {
  half: 19, // mezzo lato dell'arena quadrata
  step: 0.5, // distanza tra i pezzi di spaghetto
  life: 12_000, // dopo quanto sparisce un pezzo (così l'arena non si riempie): in tanti dura meno, vedi spagLife
  hitR: 0.42, // tocchi lo spaghetto se passi più vicino di così…
  safeY: 0.7, // …e sei più in basso di così (saltando ci passi sopra)
  ownSafe: 3, // il mio ultimo metro e mezzo (3 pezzi) non mi fa niente
  fresh: 250, // e la punta appena fatta degli altri neanche (ms): passare davanti a una testa non è toccare lo spaghetto
  speed: 0.75,
  safeStart: 1500, // lo spaghetto fatto nei primi 1,5 s non fa niente (ci si sistema)
  rampT: 2.5, // all'inizio si parte piano e si accelera in 2,5 s (c'è tempo per girarsi)
};
// moltiplicatore di velocità all'inizio (uguale per me e per i bot)
export const spagRamp = (t: number) => 0.55 + 0.45 * Math.min(1, Math.max(0, t) / SPAG.rampT);
// quanto dura lo spaghetto: in tanti un po' meno (se no l'arena si riempie subito)
export const spagLife = (n: number) => (n <= 3 ? SPAG.life : n <= 5 ? 10_500 : 9_000);
// tocchi i grissini del bordo?
export const spagWall = (x: number, z: number) => Math.abs(x) >= SPAG.half - PHYS.radius - 0.04 || Math.abs(z) >= SPAG.half - PHYS.radius - 0.04;

// codifica compatta di una scia per lo stato (chi si collega a metà partita): primo punto in decimetri e poi
// una lettera per ogni pezzo (direzione su 64), corretta passo per passo così l'errore non si accumula
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function encodeTrail(xs: number[], zs: number[], from: number): string {
  if (xs.length - from < 1) return '';
  let x = Math.round(xs[from] * 10) / 10;
  let z = Math.round(zs[from] * 10) / 10;
  let out = `${Math.round(x * 10)},${Math.round(z * 10)},`;
  for (let i = from + 1; i < xs.length; i++) {
    const a = Math.atan2(xs[i] - x, zs[i] - z);
    const k = ((Math.round((a / (Math.PI * 2)) * 64) % 64) + 64) % 64;
    out += ALPHA[k];
    const q = (k / 64) * Math.PI * 2;
    x += Math.sin(q) * SPAG.step;
    z += Math.cos(q) * SPAG.step;
  }
  return out;
}
export function decodeTrail(s: string): { x: number; z: number }[] {
  const parts = s.split(',');
  if (parts.length < 3) return [];
  let x = Number(parts[0]) / 10;
  let z = Number(parts[1]) / 10;
  const out = [{ x, z }];
  for (const ch of parts[2]) {
    const q = (ALPHA.indexOf(ch) / 64) * Math.PI * 2;
    x += Math.sin(q) * SPAG.step;
    z += Math.cos(q) * SPAG.step;
    out.push({ x, z });
  }
  return out;
}

registerMini({
  kind: 'SPAGHETTO',
  name: 'Spaghetto',
  tag: 'Non toccare la scia',
  rules:
    'Corri sempre e lasci dietro uno spaghetto al sugo: col joystick giri. Chi tocca uno spaghetto (anche il suo) o i grissini del bordo è fuori! Saltando ci passi sopra, con lo scatto acceleri. Gli spaghetti spariscono dopo un po’. Vince l’ultimo che resta.',
  seconds: 90,
  speed: SPAG.speed,
  autoRun: true,
  noPush: true,
  noDoubleJump: true,
  ground: () => 0,
  clamp: (p) => {
    const L = SPAG.half - PHYS.radius;
    if (p.x > L) p.x = L;
    else if (p.x < -L) p.x = -L;
    if (p.z > L) p.z = L;
    else if (p.z < -L) p.z = -L;
  },
});
