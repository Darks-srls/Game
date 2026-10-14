// 🐷 Ruba la coda: nell'aia del salumiere chi ha la coda di salame scappa, gli altri gliela rubano a schiaffi
// (regole fisiche dell'arena: steccato rotondo, botti di vino e forme di formaggio su cui si può anche saltare)
import { PHYS, registerMini } from '../party3d';

export interface RubaOstacolo {
  x: number;
  z: number;
  r: number; // raggio
  h: number; // altezza (ci si può saltare sopra)
  k: 'botte' | 'forma';
}

export const RUBA = {
  r: 13, // raggio dell'aia (steccato)
  reach: 2.4, // lo schiaffo ruba la coda entro 2,4 m davanti
  safeMs: 1500, // chi ha appena rubato la coda è protetto per un attimo
  holderSpeed: 0.92, // con la coda si corre un po' più piano
};

// una forma gigante al centro e cinque ostacoli in cerchio (botti alte, forme basse)
export const RUBA_OBST: RubaOstacolo[] = [
  { x: 0, z: 0, r: 1.9, h: 1.1, k: 'forma' },
  { x: 0, z: 7.4, r: 1.05, h: 1.7, k: 'botte' },
  { x: 7.04, z: 2.29, r: 1.5, h: 0.95, k: 'forma' },
  { x: 4.35, z: -5.99, r: 1.05, h: 1.7, k: 'botte' },
  { x: -4.35, z: -5.99, r: 1.5, h: 0.95, k: 'forma' },
  { x: -7.04, z: 2.29, r: 1.05, h: 1.7, k: 'botte' },
];

registerMini({
  kind: 'RUBACODA',
  name: 'Ruba la coda',
  tag: 'Acchiappa e scappa',
  rules:
    'Metà di voi ha una coda di salame attaccata dietro. Se non ce l’hai, dai uno SCHIAFFO a chi ce l’ha e diventa tua! Chi ha la coda corre un po’ più piano: scappa, gira intorno alle botti, salta sulle forme. Alla fine vince chi ha la coda, poi chi l’ha tenuta più a lungo.',
  seconds: 60,
  // sopra botti e forme si può atterrare (y = quota da cui si arriva)
  ground: (x, z, _t, y) => {
    if (y === undefined) return 0;
    for (let i = 0; i < RUBA_OBST.length; i++) {
      const o = RUBA_OBST[i];
      const dx = x - o.x;
      const dz = z - o.z;
      if (dx * dx + dz * dz <= o.r * o.r && y >= o.h - 0.6) return o.h;
    }
    return 0;
  },
  clamp: (p) => {
    const r = PHYS.radius;
    const d = Math.hypot(p.x, p.z);
    if (d > RUBA.r - r) {
      p.x *= (RUBA.r - r) / d;
      p.z *= (RUBA.r - r) / d;
    }
    // contro botti e forme si sbatte (a meno di esserci sopra)
    for (let i = 0; i < RUBA_OBST.length; i++) {
      const o = RUBA_OBST[i];
      if ((p.y ?? 0) >= o.h - 0.2) continue;
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const dd = Math.hypot(dx, dz);
      const min = o.r + r;
      if (dd < min && dd > 0.0001) {
        p.x = o.x + (dx / dd) * min;
        p.z = o.z + (dz / dd) * min;
      }
    }
  },
});
