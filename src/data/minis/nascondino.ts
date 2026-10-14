// 🫙 Trasformisti: nascondino travestiti in una cucina-mercato piena di oggetti (regole fisiche)
// Chi si nasconde diventa un oggetto identico a quelli veri; i cercatori colpiscono gli oggetti sospetti.
import { PHYS, registerMini } from '../party3d';

export const HIDE = {
  half: 15, // la cucina va da -15 a 15
  hideMs: 20_000, // i cercatori restano chiusi in dispensa
  hitRange: 2.2, // il mattarello arriva fin qui
  hitCd: 650,
  stunMs: 1200, // colpito un oggetto vero: stordito
  whistleCd: 9000,
  whistleMax: 4, // i fischi che danno punti
  whistlePts: 2,
  foundPts: 3,
  survivePts: 5,
  tickPts: 10, // +1 ogni 10 s di ricerca
  door: 1.3, // mezza larghezza della porta della dispensa
};
// la dispensa: una stanzetta dietro la parete nord, la porta si apre quando parte la ricerca
export const PANTRY = { x0: -3.5, x1: 3.5, z0: 15, z1: 20 };

export const PROP_TYPES = ['farina', 'pomodoro', 'damigiana', 'sedia', 'pane', 'pentolone'] as const;
export const PROP_NAMES = ['SACCO DI FARINA', 'BARATTOLO DI POMODORO', 'DAMIGIANA', 'SEDIA', 'CESTA DEL PANE', 'PENTOLONE'];
export const PROP_R = [0.55, 0.42, 0.55, 0.5, 0.5, 0.6]; // ingombro di ogni tipo (raggio)

// gli oggetti veri: x, z, tipo, rotazione
const P = (x: number, z: number, t: number, a = 0) => ({ x, z, t, a });
export const PROPS = [
  // il forno a legna (nord-ovest): pentoloni
  P(-8.0, 12.8, 5, 0.3),
  P(-7.2, 10.2, 5, 1.1),
  P(-9.6, 8.0, 5, 2.0),
  P(-12.6, 7.6, 5, 0.7),
  P(-5.6, 13.0, 5, 2.6),
  // la cantina (nord-est): damigiane
  P(7.2, 13.0, 2, 0.2),
  P(9.0, 11.2, 2, 1.4),
  P(8.0, 8.6, 2, 2.2),
  P(11.0, 8.4, 2, 0.9),
  P(12.9, 7.2, 2, 3.0),
  P(6.4, 10.6, 2, 1.8),
  // la panetteria (ovest): ceste del pane
  P(-10.4, 2.6, 4, 0.4),
  P(-9.6, -0.4, 4, 1.6),
  P(-10.4, -3.4, 4, 2.4),
  P(-8.0, 1.4, 4, 0.1),
  P(-7.6, -2.6, 4, 3.1),
  P(-11.4, -6.0, 4, 1.0),
  // il banco del mercato (est): barattoli di pomodoro
  P(10.4, 2.8, 1, 0.5),
  P(9.2, 0.6, 1, 1.9),
  P(10.6, -1.6, 1, 2.8),
  P(8.6, -3.6, 1, 0.2),
  P(10.6, -5.2, 1, 1.2),
  P(7.4, -0.8, 1, 2.5),
  P(9.6, 4.8, 1, 0.8),
  // la sala da pranzo (sud): sedie intorno ai tavoli
  P(-6.2, -9.2, 3, Math.PI),
  P(-3.8, -9.2, 3, Math.PI),
  P(-6.2, -12.8, 3, 0),
  P(-3.8, -12.8, 3, 0),
  P(3.8, -9.2, 3, Math.PI),
  P(6.2, -9.2, 3, Math.PI),
  P(3.8, -12.8, 3, 0),
  P(6.2, -12.8, 3, 0),
  P(0.2, -13.0, 3, 0.6),
  // l'isola della pasta fresca (centro): sacchi di farina
  P(-2.6, 3.6, 0, 0.3),
  P(-0.6, 5.4, 0, 1.2),
  P(2.4, 4.0, 0, 2.1),
  P(-3.4, -1.0, 0, 0.8),
  P(0.4, -2.6, 0, 2.7),
  P(3.4, -0.8, 0, 1.6),
  // sparsi qua e là (per chi vuole rischiare)
  P(-12.8, -9.6, 0, 0.5),
  P(12.9, -9.8, 5, 1.3),
  P(-3.0, 13.2, 4, 0.9),
  P(3.2, 13.2, 1, 0.4),
  P(-12.6, 4.6, 2, 2.2),
  P(12.4, 4.6, 3, 2.0),
  P(0.0, -7.2, 4, 1.7),
];

// mobili veri (non si colpiscono): x, z, larghezza, profondità, altezza
export const FURNITURE = [
  { x: -12.0, z: 12.0, w: 4.4, d: 4.4, h: 3.2, k: 'forno' },
  { x: 12.6, z: 12.6, w: 3.6, d: 3.6, h: 2.4, k: 'botti' },
  { x: -13.4, z: -1.0, w: 2.2, d: 7.0, h: 1.1, k: 'banco' },
  { x: 13.4, z: -1.0, w: 2.2, d: 7.0, h: 1.1, k: 'mercato' },
  { x: -5.0, z: -11.0, w: 3.4, d: 1.9, h: 0.9, k: 'tavolo' },
  { x: 5.0, z: -11.0, w: 3.4, d: 1.9, h: 0.9, k: 'tavolo' },
  { x: 0.0, z: 1.0, w: 3.0, d: 1.6, h: 1.0, k: 'isola' },
] as const;

let doorOpen = false;
export const pantryOpen = () => doorOpen;

// oggetti e mobili: si sbatte contro (spinge p fuori)
export function hideObstacles(p: { x: number; z: number }) {
  const r = PHYS.radius;
  for (let i = 0; i < PROPS.length; i++) {
    const o = PROPS[i];
    const min = PROP_R[o.t] + r;
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
    }
  }
  for (let i = 0; i < FURNITURE.length; i++) {
    const b = FURNITURE[i];
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const ox = b.w / 2 + r - Math.abs(dx);
    const oz = b.d / 2 + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }
}

// c'è un ostacolo in (x, z)? (per i bot che girano intorno ai mobili)
export function hideBlocked(x: number, z: number, pad = 0.15) {
  const r = PHYS.radius + pad;
  const H = HIDE.half - r;
  if (x < -H || x > H || z < -H || (z > H && (x < PANTRY.x0 + r || x > PANTRY.x1 - r || z > PANTRY.z1 - r))) return true;
  // la parete della dispensa (con la porta, se è aperta)
  if (Math.abs(z - HIDE.half) < r && !(doorOpen && Math.abs(x) < HIDE.door - r)) return true;
  for (const o of PROPS) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (PROP_R[o.t] + r) ** 2) return true;
  for (const b of FURNITURE) if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  return false;
}

registerMini({
  kind: 'NASCONDINO',
  name: 'Trasformisti',
  tag: 'Nascondino travestiti',
  rules: 'I cercatori restano chiusi in dispensa 20 secondi: intanto gli altri premono TRASFORMATI per diventare un oggetto della cucina e si nascondono. Poi i cercatori colpiscono gli oggetti sospetti: se è un oggetto vero restano storditi! Chi si nasconde può FISCHIARE per fare punti… ma si fa sentire.',
  seconds: 100,
  noPush: true,
  clamp: (p) => {
    const r = PHYS.radius;
    const H = HIDE.half;
    const inDoor = doorOpen && Math.abs(p.x) <= HIDE.door - r;
    if (p.z > H) {
      // in dispensa
      if (p.x < PANTRY.x0 + r) p.x = PANTRY.x0 + r;
      else if (p.x > PANTRY.x1 - r) p.x = PANTRY.x1 - r;
      if (p.z > PANTRY.z1 - r) p.z = PANTRY.z1 - r;
      if (!inDoor && p.z < H + r) p.z = H + r;
    } else {
      // in cucina
      if (p.x < -H + r) p.x = -H + r;
      else if (p.x > H - r) p.x = H - r;
      if (p.z < -H + r) p.z = -H + r;
      if (!inDoor && p.z > H - r) p.z = H - r;
    }
    hideObstacles(p);
  },
  // la porta della dispensa: chiusa durante l'introduzione e mentre ci si nasconde
  sync: (ext) => {
    doorOpen = !!ext && ext.phase === 'SEEK';
  },
});
