// 🏐 Beach volley: rossi contro blu sulla sabbia, rete in mezzo (non si passa), pallone da spiaggia gigante e leggero.
// Correndoci o saltandoci contro lo rimandi di là, con lo schiaffo vicino al pallone lo SCHIACCI (regole fisiche)
import { PHYS, registerMini } from '../party3d';
import { keepSide, setMySide } from './squadre';

export const VOLLEY = {
  halfX: 7.5, // sabbia fino ai gonfiabili (15 × 23): i rossi stanno a z < 0, i blu a z > 0
  halfZ: 11.5,
  lineX: 6, // le righe del campo (solo disegnate: il pallone rimbalza sui gonfiabili)
  lineZ: 10,
  netH: 2.6, // la rete è un muro dalla sabbia fino a qui (sopra c'è la corda)
  netT: 0.08,
  ballR: 1.1,
  gravity: 5.8, // pallone leggero: cade piano…
  drag: 0.3, // …e l'aria lo frena
  wall: 0.5, // i gonfiabili rimbalzano (un po')
  bump: 7.4, // tocco correndoci contro: in alto e verso il campo avversario (più forte da lontano)
  bumpFwd: 4.2,
  jumpUp: 5.2, // tocco saltando: più teso
  jumpFwd: 7,
  spike: 14.5, // SCHIACCIATA
  spikeDown: -6,
  touchR: 0.55, // ingombro del personaggio per i tocchi
  target: 7, // primo a 7
  serveLock: 900, // il pallone della battuta si può toccare dopo un attimo…
  serveWait: 3200, // …e se nessuno batte parte da solo
  pointMs: 1900,
};

export type VBall = { x: number; y: number; z: number; vx: number; vy: number; vz: number };

// un passo di fisica del pallone (server e previsioni dei bot): gravità, aria, gonfiabili, rete e corda.
// Ritorna 'floor' quando tocca la sabbia, 'net' se tocca la rete
export function stepVolley(B: VBall, h: number): 'floor' | 'net' | null {
  const R = VOLLEY.ballR;
  B.vy -= VOLLEY.gravity * h;
  const f = Math.exp(-VOLLEY.drag * h);
  B.vx *= f;
  B.vy *= f;
  B.vz *= f;
  const oz = B.z;
  B.x += B.vx * h;
  B.y += B.vy * h;
  B.z += B.vz * h;
  let ev: 'floor' | 'net' | null = null;
  if (Math.abs(B.x) > VOLLEY.halfX - R) {
    B.x = Math.sign(B.x) * (VOLLEY.halfX - R);
    B.vx = -B.vx * VOLLEY.wall;
  }
  if (Math.abs(B.z) > VOLLEY.halfZ - R) {
    B.z = Math.sign(B.z) * (VOLLEY.halfZ - R);
    B.vz = -B.vz * VOLLEY.wall;
  }
  const gap = R + VOLLEY.netT;
  if (B.y < VOLLEY.netH) {
    if (Math.abs(B.z) < gap) {
      const s = Math.sign(oz) || Math.sign(B.z) || 1;
      B.z = s * gap;
      if (B.vz * s < 0) B.vz = -B.vz * 0.3;
      ev = 'net';
    }
  } else {
    const dy = B.y - VOLLEY.netH;
    const d = Math.hypot(dy, B.z);
    if (d < R) {
      // la corda in cima: spinge fuori lungo la normale (e non lo lascia in equilibrio lassù)
      const nz = d > 0.001 ? B.z / d : Math.sign(oz) || 1;
      const ny = d > 0.001 ? dy / d : 0;
      B.z = nz * R + (Math.abs(nz) < 0.05 ? (Math.sign(oz) || 1) * 0.05 : 0);
      B.y = VOLLEY.netH + ny * R;
      const vn = B.vz * nz + B.vy * ny;
      if (vn < 0) {
        B.vz -= 1.6 * vn * nz;
        B.vy -= 1.6 * vn * ny;
      }
      ev = 'net';
    }
  }
  if (B.y <= R) {
    B.y = R;
    ev = 'floor';
  }
  return ev;
}

registerMini({
  kind: 'PALLAVOLO',
  name: 'Beach volley',
  tag: 'Non farla cadere',
  rules:
    'Rossi contro blu sulla spiaggia, la rete in mezzo non si passa. Il pallone gigante è leggero: correndoci o saltandoci contro lo rimandi dall’altra parte, con lo SCHIAFFO quando ce l’hai vicino lo SCHIACCI (saltando va giù a picco!). Se tocca la sabbia nella tua metà è punto per gli altri. Primo a 7.',
  seconds: 90,
  sync: (ext) => setMySide(ext?.my),
  clamp: (p) => {
    const r = PHYS.radius;
    p.x = Math.max(-VOLLEY.halfX + r, Math.min(VOLLEY.halfX - r, p.x));
    p.z = Math.max(-VOLLEY.halfZ + r, Math.min(VOLLEY.halfZ - r, p.z));
    keepSide(p, VOLLEY.netT + r);
  },
});
