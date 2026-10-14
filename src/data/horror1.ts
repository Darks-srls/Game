// "Non lasciarmi solo": horror cooperativo in prima persona. Una squadra di manutenzione entra di notte in un
// condominio evacuato e deve riattivare gli impianti mentre il Custode occupa gli spazi di lavoro.
// Qui ci sono la mappa del condominio, le regole del movimento, le distanze e i tempi: le usano sia il telefono
// sia il server (che decide porte, oggetti, interventi e il comportamento del Custode).
// Mondo in metri: y verso l'alto. Ogni piano è una griglia di celle da 1 m; i muri stanno sui bordi tra le celle.

export const H1 = {
  cols: 28,
  rows: 20,
  row0: -10, // le righe da -10 a 0 sono il cortile davanti al palazzo (solo al piano terra)
  floors: 4, // 0 cantina, 1 piano terra, 2 primo piano, 3 secondo piano
  floorH: 3.2, // da un pavimento all'altro
  ceil: 2.9, // altezza del soffitto sopra il pavimento
  wallT: 0.14, // spessore dei muri
};
export const floorBase = (f: number) => (f - 1) * H1.floorH;
export const FLOOR_NAMES = ['Cantina', 'Piano terra', 'Primo piano', 'Secondo piano'];

// Valori iniziali di design (da correggere giocando)
export const MOVE = {
  walk: 2.3,
  run: 3.9,
  crouch: 1.15,
  stamina: 5, // secondi di corsa
  staminaBack: 0.55, // recupero al secondo
  carry: 0.72, // con la batteria in mano
  wounded: 0.86,
  radius: 0.3,
  eye: 1.62,
  eyeCrouch: 1.05,
  step: 0.55, // gradino massimo
  gravity: 18,
};
export const USE_RANGE = 2.1; // distanza per usare un oggetto
export const VOICE = { clear: 4, fade: 12, max: 17 }; // voce di prossimità (metri)

// ---------------------------------------------------------------- le stanze

export type Tex =
  | 'terrazzo'
  | 'intonaco'
  | 'salvia'
  | 'scale'
  | 'carta'
  | 'piastrelle'
  | 'parquet'
  | 'cemento'
  | 'muroCantina'
  | 'linoleum'
  | 'cucina'
  | 'marmo'
  | 'metallo'
  | 'asfalto'
  | 'facciata'
  | 'bagno'
  | 'carta2';
export type Zone = 'atrio' | 'scale' | 'corridoio' | 'casa' | 'cantina' | 'tecnico' | 'lavanderia' | 'servizio' | 'esterno';
export type LightKind = 'calda' | 'fredda' | 'neon' | 'spenta' | 'debole';

export interface RoomDef {
  f: number;
  id: string; // lettera nella griglia del piano
  name: string;
  zone: Zone;
  floor: Tex;
  wall: Tex;
  light: LightKind;
  rects: [number, number, number, number][]; // c0, r0, c1, r1 (compresi)
  lamps?: [number, number][]; // posizione delle lampade (x, z)
}

// La tromba delle scale (uguale su tutti i piani): due rampe (A sale verso +z, B torna verso -z) e il ballatoio L
const SHAFT = { a0: 11, a1: 12, b0: 13, b1: 14, r0: 6, r1: 10, l0: 11, l1: 12 };
export const STAIR = { z0: 6, z1: 11, z2: 13, ...SHAFT }; // rampa da z0 a z1, ballatoio fino a z2

const ring = (f: number, name: string, wall: Tex, floor: Tex, light: LightKind, lamps: [number, number][]): RoomDef => ({
  f,
  id: 'C',
  name,
  zone: 'corridoio',
  floor,
  wall,
  light,
  rects: [
    [8, 6, 10, 15],
    [15, 6, 17, 15],
    [8, 13, 17, 15],
  ],
  lamps,
});
const shaft = (f: number): RoomDef[] => [
  { f, id: 'A', name: 'Scale', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'debole', rects: [[SHAFT.a0, SHAFT.r0, SHAFT.a1, SHAFT.r1]] },
  { f, id: 'B', name: 'Scale', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'debole', rects: [[SHAFT.b0, SHAFT.r0, SHAFT.b1, SHAFT.r1]] },
  { f, id: 'L', name: 'Scale', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'debole', rects: [[SHAFT.a0, SHAFT.l0, SHAFT.b1, SHAFT.l1]], lamps: [[13, 12.4]] },
];

export const ROOMS: RoomDef[] = [
  // ---- cantina: verde freddo, cemento, tubature
  { f: 0, id: 'P', name: 'Pianerottolo della cantina', zone: 'cantina', floor: 'cemento', wall: 'muroCantina', light: 'neon', rects: [[8, 2, 17, 5]], lamps: [[12.5, 3.5]] },
  ring(0, 'Corridoio delle cantine', 'muroCantina', 'cemento', 'neon', [[9, 8], [16, 8], [12.5, 14]]),
  { f: 0, id: 'Z', name: 'Cantine', zone: 'cantina', floor: 'cemento', wall: 'muroCantina', light: 'spenta', rects: [[1, 1, 7, 8]], lamps: [[4, 4.5]] },
  { f: 0, id: 'O', name: 'Officina', zone: 'cantina', floor: 'cemento', wall: 'muroCantina', light: 'neon', rects: [[1, 10, 7, 15]], lamps: [[4, 12.5]] },
  { f: 0, id: 'U', name: 'Lavanderia', zone: 'lavanderia', floor: 'linoleum', wall: 'salvia', light: 'neon', rects: [[18, 1, 26, 8]], lamps: [[22, 4.5]] },
  { f: 0, id: 'D', name: 'Deposito', zone: 'cantina', floor: 'cemento', wall: 'muroCantina', light: 'spenta', rects: [[22, 9, 26, 13]], lamps: [[24, 11]] },
  { f: 0, id: 'M', name: 'Locale pompa', zone: 'tecnico', floor: 'cemento', wall: 'muroCantina', light: 'debole', rects: [[18, 9, 21, 15]], lamps: [[19.5, 12]] },
  { f: 0, id: 'I', name: 'Vano impianti', zone: 'tecnico', floor: 'cemento', wall: 'muroCantina', light: 'spenta', rects: [[4, 16, 23, 18]], lamps: [[13.5, 17.5]] },
  ...shaft(0),
  // ---- il cortile: si parte dal furgone della squadra, sotto la pioggia
  { f: 1, id: 'E', name: 'Cortile', zone: 'esterno', floor: 'asfalto', wall: 'muroCantina', light: 'calda', rects: [[0, -10, 27, 0]], lamps: [[3.5, -8.5], [24.5, -8.5]] },
  // ---- piano terra: atrio ambra, terrazzo consumato
  { f: 1, id: 'P', name: 'Atrio', zone: 'atrio', floor: 'terrazzo', wall: 'intonaco', light: 'calda', rects: [[8, 1, 17, 5]], lamps: [[10.5, 3], [15, 3]] },
  ring(1, 'Corridoio del piano terra', 'intonaco', 'terrazzo', 'debole', [[9, 9], [16, 9], [12.5, 14]]),
  { f: 1, id: 'K', name: 'Locale contatori', zone: 'tecnico', floor: 'cemento', wall: 'metallo', light: 'neon', rects: [[1, 1, 7, 7]], lamps: [[4, 4]] },
  { f: 1, id: 'G', name: 'Deposito biciclette', zone: 'servizio', floor: 'cemento', wall: 'intonaco', light: 'debole', rects: [[1, 9, 7, 15]], lamps: [[4, 12]] },
  { f: 1, id: 'Q', name: 'Portineria', zone: 'casa', floor: 'parquet', wall: 'carta', light: 'calda', rects: [[18, 1, 26, 4]], lamps: [[22, 2.5]] },
  { f: 1, id: 'V', name: 'Corridoio di servizio', zone: 'servizio', floor: 'cemento', wall: 'salvia', light: 'neon', rects: [[18, 6, 26, 15]], lamps: [[20, 8], [24, 13]] },
  { f: 1, id: 'N', name: 'Locale caldaia', zone: 'tecnico', floor: 'cemento', wall: 'muroCantina', light: 'spenta', rects: [[5, 16, 22, 18]], lamps: [[13.5, 17.5]] },
  ...shaft(1),
  // ---- primo piano: il piano delle sedie rosse
  { f: 2, id: 'P', name: 'Pianerottolo del primo piano', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'debole', rects: [[8, 2, 17, 5]], lamps: [[12.5, 3.5]] },
  ring(2, 'Corridoio del primo piano', 'salvia', 'piastrelle', 'debole', [[9, 9], [16, 9], [12.5, 14]]),
  { f: 2, id: 'k', name: 'Cucina degli Esposito', zone: 'casa', floor: 'cucina', wall: 'piastrelle', light: 'calda', rects: [[1, 1, 7, 5]], lamps: [[4, 3]] },
  { f: 2, id: 'l', name: 'Soggiorno degli Esposito', zone: 'casa', floor: 'parquet', wall: 'carta', light: 'spenta', rects: [[1, 6, 7, 12]], lamps: [[4, 9]] },
  { f: 2, id: 'm', name: 'Soggiorno dei Rossi', zone: 'casa', floor: 'parquet', wall: 'intonaco', light: 'calda', rects: [[18, 1, 26, 6]], lamps: [[22, 3.5]] },
  { f: 2, id: 'n', name: 'Camera dei Rossi', zone: 'casa', floor: 'parquet', wall: 'carta2', light: 'spenta', rects: [[18, 7, 26, 12]], lamps: [[22, 9.5]] },
  { f: 2, id: 'q', name: 'Appartamento restituito', zone: 'casa', floor: 'parquet', wall: 'intonaco', light: 'spenta', rects: [[3, 16, 24, 18]], lamps: [[8, 17.5], [19, 17.5]] },
  ...shaft(2),
  // ---- secondo piano: il piano spento
  { f: 3, id: 'P', name: 'Pianerottolo del secondo piano', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'spenta', rects: [[8, 2, 17, 5]], lamps: [[12.5, 3.5]] },
  ring(3, 'Corridoio della carta da parati', 'carta', 'parquet', 'spenta', [[9, 9], [16, 9], [12.5, 14]]),
  { f: 3, id: 's', name: 'Casa della signora Bruni', zone: 'casa', floor: 'parquet', wall: 'carta', light: 'spenta', rects: [[1, 1, 7, 12]], lamps: [[4, 4], [4, 9.5]] },
  { f: 3, id: 'T', name: 'Corridoio tecnico', zone: 'tecnico', floor: 'cemento', wall: 'metallo', light: 'spenta', rects: [[18, 1, 26, 12]], lamps: [[22, 6]] },
  { f: 3, id: 'w', name: 'Interno 9', zone: 'casa', floor: 'piastrelle', wall: 'bagno', light: 'spenta', rects: [[5, 16, 22, 18]], lamps: [[13.5, 17.5]] },
  { f: 3, id: 'B', name: 'Scale', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'spenta', rects: [[SHAFT.b0, SHAFT.r0, SHAFT.b1, SHAFT.r1]] },
  { f: 3, id: 'L', name: 'Scale', zone: 'scale', floor: 'marmo', wall: 'scale', light: 'spenta', rects: [[SHAFT.a0, SHAFT.l0, SHAFT.b1, SHAFT.l1]] },
];

// Coppie di stanze senza muro in mezzo (lo spazio continua)
const OPEN = new Set(['P|A', 'P|B', 'A|L', 'B|L', 'P|C']);
const openPair = (a: string, b: string) => OPEN.has(`${a}|${b}`) || OPEN.has(`${b}|${a}`);

// ---------------------------------------------------------------- porte

export type DoorKind = 'legno' | 'acciaio' | 'portone' | 'servizio' | 'cantina';
export interface DoorDef {
  id: string;
  f: number;
  // bordo: tra la cella (c, r) e quella accanto verso 'side'
  c: number;
  r: number;
  side: 'N' | 'S' | 'E' | 'W';
  kind: DoorKind;
  label?: string; // numero o targhetta
  open?: boolean; // aperta all'inizio
  lock?: 'acqua' | 'test'; // bloccata dall'acqua (deposito) o fino al collaudo (uscita di servizio)
}
export const DOORS: DoorDef[] = [
  // cantina
  { id: 'c-cantine', f: 0, c: 8, r: 4, side: 'W', kind: 'cantina', label: 'CANTINE' },
  { id: 'c-officina', f: 0, c: 8, r: 12, side: 'W', kind: 'acciaio', label: 'OFFICINA' },
  { id: 'c-lavanderia', f: 0, c: 17, r: 4, side: 'E', kind: 'legno', label: 'LAVANDERIA' },
  { id: 'c-deposito', f: 0, c: 24, r: 8, side: 'S', kind: 'acciaio', label: 'DEPOSITO', lock: 'acqua' },
  { id: 'c-pompa', f: 0, c: 17, r: 12, side: 'E', kind: 'acciaio', label: 'POMPA' },
  { id: 'c-impianti', f: 0, c: 13, r: 15, side: 'S', kind: 'acciaio', label: 'IMPIANTI' },
  // piano terra
  { id: 't-portone', f: 1, c: 12, r: 1, side: 'N', kind: 'portone', label: 'INGRESSO' },
  { id: 't-contatori', f: 1, c: 8, r: 4, side: 'W', kind: 'acciaio', label: 'CONTATORI' },
  { id: 't-bici', f: 1, c: 8, r: 11, side: 'W', kind: 'legno', label: 'BICI' },
  { id: 't-portineria', f: 1, c: 17, r: 3, side: 'E', kind: 'legno', label: 'PORTINERIA' },
  { id: 't-servizio', f: 1, c: 17, r: 10, side: 'E', kind: 'acciaio', label: 'SERVIZIO', open: true },
  { id: 't-uscita', f: 1, c: 26, r: 13, side: 'E', kind: 'servizio', label: 'USCITA', lock: 'test' },
  { id: 't-caldaia', f: 1, c: 13, r: 15, side: 'S', kind: 'acciaio', label: 'CALDAIA' },
  // primo piano
  { id: 'p-esposito', f: 2, c: 8, r: 9, side: 'W', kind: 'legno', label: '3' },
  { id: 'p-esposito2', f: 2, c: 4, r: 5, side: 'S', kind: 'legno', open: true },
  { id: 'p-rossi', f: 2, c: 17, r: 9, side: 'E', kind: 'legno', label: '4' },
  { id: 'p-rossi2', f: 2, c: 22, r: 6, side: 'S', kind: 'legno' },
  { id: 'p-vuoto', f: 2, c: 13, r: 15, side: 'S', kind: 'legno', label: '5' },
  // secondo piano
  { id: 's-bruni', f: 3, c: 8, r: 9, side: 'W', kind: 'legno', label: '7' },
  { id: 's-tecnico', f: 3, c: 17, r: 4, side: 'E', kind: 'acciaio', label: 'TECNICO' },
  { id: 's-nove', f: 3, c: 13, r: 15, side: 'S', kind: 'legno', label: '9' },
];

// ---------------------------------------------------------------- le griglie dei piani

export interface Grid {
  cells: string[]; // una stringa per riga
  room: (c: number, r: number) => string; // lettera ('#' = fuori / pieno)
}
export const GRIDS: Grid[] = Array.from({ length: H1.floors }, (_, f) => {
  const rows = Array.from({ length: H1.rows - H1.row0 }, () => '#'.repeat(H1.cols).split(''));
  for (const rm of ROOMS.filter((x) => x.f === f))
    for (const [c0, r0, c1, r1] of rm.rects) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) rows[r - H1.row0][c] = rm.id;
  const cells = rows.map((x) => x.join(''));
  return { cells, room: (c, r) => (c < 0 || r < H1.row0 || c >= H1.cols || r >= H1.rows ? '#' : cells[r - H1.row0][c]) };
});
export const roomAt = (f: number, x: number, z: number): RoomDef | null => {
  const id = GRIDS[f]?.room(Math.floor(x), Math.floor(z));
  if (!id || id === '#') return null;
  return ROOMS.find((r) => r.f === f && r.id === id) ?? null;
};

// Bordo tra due celle: chiave unica (V = bordo verticale a x = c, H = bordo orizzontale a z = r)
export const edgeKey = (c: number, r: number, side: DoorDef['side']) =>
  side === 'N' ? `H:${c}:${r}` : side === 'S' ? `H:${c}:${r + 1}` : side === 'W' ? `V:${c}:${r}` : `V:${c + 1}:${r}`;
const DOOR_BY_EDGE: Record<string, DoorDef>[] = Array.from({ length: H1.floors }, () => ({}));
for (const d of DOORS) DOOR_BY_EDGE[d.f][edgeKey(d.c, d.r, d.side)] = d;
export const doorOnEdge = (f: number, key: string) => DOOR_BY_EDGE[f][key] ?? null;

// Il bordo è un muro? (le porte sono a parte: dipendono da aperta/chiusa)
function wallEdge(f: number, a: string, b: string, key: string) {
  if (DOOR_BY_EDGE[f][key]) return false;
  if (a === b) return false;
  if (a === '#' && b === '#') return false;
  return !openPair(a, b);
}

// Tutti i muri di un piano, come segmenti (per disegnarli, per le collisioni e per la vista)
export interface WallSeg {
  f: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  key: string;
  inner: string; // stanza da un lato
  outer: string; // stanza dall'altro
}
export const WALLS: WallSeg[][] = GRIDS.map((g, f) => {
  const list: WallSeg[] = [];
  for (let r = H1.row0; r <= H1.rows; r++)
    for (let c = 0; c <= H1.cols; c++) {
      // bordo verticale a x = c, tra (c-1, r) e (c, r)
      if (r < H1.rows) {
        const a = g.room(c - 1, r);
        const b = g.room(c, r);
        const key = `V:${c}:${r}`;
        if (wallEdge(f, a, b, key)) list.push({ f, x0: c, z0: r, x1: c, z1: r + 1, key, inner: a, outer: b });
      }
      // bordo orizzontale a z = r, tra (c, r-1) e (c, r)
      if (c < H1.cols) {
        const a = g.room(c, r - 1);
        const b = g.room(c, r);
        const key = `H:${c}:${r}`;
        if (wallEdge(f, a, b, key)) list.push({ f, x0: c, z0: r, x1: c + 1, z1: r, key, inner: a, outer: b });
      }
    }
  return list;
});
const WALL_SET = WALLS.map((l) => new Set(l.map((w) => w.key)));

// Il bordo tra due celle vicine è chiuso? (muro o porta chiusa)
export function blockedEdge(f: number, c: number, r: number, c2: number, r2: number, openDoors: Set<string>): boolean {
  let key: string;
  if (c2 === c + 1) key = `V:${c + 1}:${r}`;
  else if (c2 === c - 1) key = `V:${c}:${r}`;
  else if (r2 === r + 1) key = `H:${c}:${r + 1}`;
  else key = `H:${c}:${r}`;
  if (WALL_SET[f].has(key)) return true;
  const d = DOOR_BY_EDGE[f][key];
  return !!d && !openDoors.has(d.id);
}

// ---------------------------------------------------------------- quota del pavimento (scale comprese)

// Altezza del pavimento della cella sul piano f nel punto (x, z), relativa allo zero del mondo
export function floorHeight(f: number, x: number, z: number): number | null {
  const id = GRIDS[f]?.room(Math.floor(x), Math.floor(z));
  if (!id || id === '#') return null;
  const b = floorBase(f);
  const h = STAIR.z1 - STAIR.z0;
  if (id === 'A') return b + (Math.max(0, Math.min(h, z - STAIR.z0)) / h) * 1.6;
  if (id === 'L') return b + 1.6;
  if (id === 'B') return b + 1.6 + (Math.max(0, Math.min(h, STAIR.z1 - z)) / h) * 1.6;
  return b;
}
// Il pavimento su cui si poggia: il più alto sotto i piedi (entro un gradino). null = niente pavimento (si è contro un muro)
export function groundAt(x: number, z: number, y: number): { h: number; f: number } | null {
  let best: { h: number; f: number } | null = null;
  for (let f = 0; f < H1.floors; f++) {
    const h = floorHeight(f, x, z);
    if (h === null || h > y + MOVE.step) continue;
    if (!best || h > best.h) best = { h, f };
  }
  return best;
}

// ---------------------------------------------------------------- movimento e collisioni

export interface HBody {
  x: number;
  y: number;
  z: number;
  f: number; // piano attuale (la griglia dei muri che vale)
  yaw: number; // verso dove guarda (0 = +z)
  pitch: number;
  vy: number;
  stamina: number;
}
export interface HInput {
  x: number; // -1..1 (destra)
  z: number; // -1..1 (avanti)
  run: boolean;
  crouch: boolean;
}

// Il cerchio del personaggio contro i muri vicini e le porte chiuse
function pushOut(b: HBody, openDoors: Set<string>, extra: { x: number; z: number; w: number; d: number }[]) {
  const R = MOVE.radius + H1.wallT / 2;
  const c0 = Math.floor(b.x) - 1;
  const r0 = Math.floor(b.z) - 1;
  const segs: [number, number, number, number][] = [];
  for (const w of WALLS[b.f]) if (w.x1 >= c0 && w.x0 <= c0 + 3 && w.z1 >= r0 && w.z0 <= r0 + 3) segs.push([w.x0, w.z0, w.x1, w.z1]);
  for (const d of DOORS) {
    if (d.f !== b.f || openDoors.has(d.id)) continue;
    const s = doorSeg(d);
    if (s[2] >= c0 && s[0] <= c0 + 3 && s[3] >= r0 && s[1] <= r0 + 3) segs.push(s);
  }
  for (const [x0, z0, x1, z1] of segs) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((b.x - x0) * dx + (b.z - z0) * dz) / len2));
    const px = x0 + dx * t;
    const pz = z0 + dz * t;
    const ox = b.x - px;
    const oz = b.z - pz;
    const d = Math.hypot(ox, oz);
    if (d < R && d > 1e-6) {
      b.x = px + (ox / d) * R;
      b.z = pz + (oz / d) * R;
    }
  }
  // mobili e ingombri (scatole allineate)
  for (const o of extra) {
    const dx = b.x - o.x;
    const dz = b.z - o.z;
    const ox = o.w / 2 + MOVE.radius - Math.abs(dx);
    const oz = o.d / 2 + MOVE.radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) b.x += Math.sign(dx || 1) * ox;
      else b.z += Math.sign(dz || 1) * oz;
    }
  }
}
export function doorSeg(d: DoorDef): [number, number, number, number] {
  if (d.side === 'N') return [d.c, d.r, d.c + 1, d.r];
  if (d.side === 'S') return [d.c, d.r + 1, d.c + 1, d.r + 1];
  if (d.side === 'W') return [d.c, d.r, d.c, d.r + 1];
  return [d.c + 1, d.r, d.c + 1, d.r + 1];
}

// Un passo di movimento in prima persona (uguale per tutti i dispositivi)
export function stepHuman(b: HBody, input: HInput, dt: number, openDoors: Set<string>, opts: { mul: number; props: PropBox[] }) {
  const len = Math.min(1, Math.hypot(input.x, input.z));
  const running = input.run && !input.crouch && len > 0.3 && b.stamina > 0.05;
  b.stamina = running ? Math.max(0, b.stamina - dt) : Math.min(MOVE.stamina, b.stamina + MOVE.staminaBack * dt);
  // sulle rampe si va un po' più svelti (le scale a U sono lunghe e si fanno spesso)
  const cell = GRIDS[b.f]?.room(Math.floor(b.x), Math.floor(b.z));
  const stairMul = cell === 'A' || cell === 'B' || cell === 'L' ? 1.3 : 1;
  const speed = (input.crouch ? MOVE.crouch : running ? MOVE.run : MOVE.walk) * opts.mul * stairMul;
  const fx = Math.sin(b.yaw);
  const fz = Math.cos(b.yaw);
  // avanti = dove guardo, destra = perpendicolare
  const vx = (fx * input.z - fz * input.x) * speed;
  const vz = (fz * input.z + fx * input.x) * speed;
  const props = opts.props.filter((p) => p.f === b.f);
  // si prova a muoversi su x e su z separatamente: se di là non c'è pavimento (o è troppo alto) è un muro
  for (const [mx, mz] of [
    [vx * dt, 0],
    [0, vz * dt],
  ]) {
    const ox = b.x;
    const oz = b.z;
    b.x += mx;
    b.z += mz;
    pushOut(b, openDoors, props);
    const g = groundAt(b.x, b.z, b.y);
    if (!g) {
      b.x = ox;
      b.z = oz;
    }
  }
  const g = groundAt(b.x, b.z, b.y);
  if (g) {
    // sulle scale si segue il gradino (niente piccole cadute che fanno ballare la vista); si cade solo da un vero salto
    if (b.y > g.h + 0.02 && b.y - g.h > 0.45) {
      b.vy -= MOVE.gravity * dt;
      b.y = Math.max(g.h, b.y + b.vy * dt);
    } else {
      b.y = g.h;
      b.vy = 0;
    }
    if (b.y <= g.h + 0.02) b.f = g.f;
  }
  return running;
}

// ---------------------------------------------------------------- vista e percorsi

const cellOf = (v: number) => Math.floor(v);
// Da a a b (stesso piano) si vede? Niente muri e niente porte chiuse in mezzo
export function lineOfSight(f: number, ax: number, az: number, bx: number, bz: number, openDoors: Set<string>): boolean {
  return wallsBetween(f, ax, az, bx, bz, openDoors, 1) === 0;
}
// Quanti muri (o porte chiuse) ci sono in mezzo (si ferma a "max")
export function wallsBetween(f: number, ax: number, az: number, bx: number, bz: number, openDoors: Set<string>, max = 4): number {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.12));
  let c = cellOf(ax);
  let r = cellOf(az);
  let count = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c2 = cellOf(ax + (bx - ax) * t);
    const r2 = cellOf(az + (bz - az) * t);
    if (c2 !== c || r2 !== r) {
      if (c2 !== c && r2 !== r) {
        // diagonale: si passa dalla cella di lato
        if (blockedEdge(f, c, r, c2, r, openDoors) || blockedEdge(f, c2, r, c2, r2, openDoors)) count++;
      } else if (blockedEdge(f, c, r, c2, r2, openDoors)) count++;
      if (count >= max) return count;
      c = c2;
      r = r2;
    }
  }
  return count;
}

// Nodo del percorso: piano, colonna, riga
export interface Node3 {
  f: number;
  c: number;
  r: number;
}
const nodeHeight = (n: Node3) => floorHeight(n.f, n.c + 0.5, n.r + 0.5);
// Le celle raggiungibili da una cella (anche cambiando piano sulle scale). Le porte chiuse contano come passaggi "da aprire"
export function neighbors(n: Node3, canPass: (doorId: string) => boolean): Node3[] {
  const h = nodeHeight(n);
  if (h === null) return [];
  const out: Node3[] = [];
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const c2 = n.c + dc;
    const r2 = n.r + dr;
    let key: string;
    if (dc === 1) key = `V:${n.c + 1}:${n.r}`;
    else if (dc === -1) key = `V:${n.c}:${n.r}`;
    else if (dr === 1) key = `H:${n.c}:${n.r + 1}`;
    else key = `H:${n.c}:${n.r}`;
    if (WALL_SET[n.f].has(key)) continue;
    const door = DOOR_BY_EDGE[n.f][key];
    if (door && !canPass(door.id)) continue;
    for (let g = Math.max(0, n.f - 1); g <= Math.min(H1.floors - 1, n.f + 1); g++) {
      const h2 = floorHeight(g, c2 + 0.5, r2 + 0.5);
      if (h2 !== null && Math.abs(h2 - h) <= 0.7) out.push({ f: g, c: c2, r: r2 });
    }
  }
  return out;
}
export const nodeKey = (n: Node3) => n.f * 10000 + n.r * 100 + n.c;
// Percorso più breve (A*) fra due celle
export function findPath(a: Node3, b: Node3, canPass: (doorId: string) => boolean, limit = 4000): Node3[] | null {
  const open: { n: Node3; g: number; f: number }[] = [{ n: a, g: 0, f: 0 }];
  const came = new Map<number, Node3>();
  const best = new Map<number, number>([[nodeKey(a), 0]]);
  const goal = nodeKey(b);
  const hfun = (n: Node3) => Math.abs(n.c - b.c) + Math.abs(n.r - b.r) + Math.abs(n.f - b.f) * 6;
  let steps = 0;
  while (open.length && steps++ < limit) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = nodeKey(cur.n);
    if (ck === goal) {
      const path = [cur.n];
      let k = ck;
      while (came.has(k)) {
        const p = came.get(k)!;
        path.unshift(p);
        k = nodeKey(p);
      }
      return path;
    }
    for (const nb of neighbors(cur.n, canPass)) {
      const g = cur.g + 1 + (nb.f !== cur.n.f ? 0.5 : 0);
      const nk = nodeKey(nb);
      if (g < (best.get(nk) ?? Infinity)) {
        best.set(nk, g);
        came.set(nk, cur.n);
        open.push({ n: nb, g, f: g + hfun(nb) });
      }
    }
  }
  return null;
}
// La cella in cui si trova un punto (col piano)
export const nodeAt = (f: number, x: number, z: number): Node3 => ({ f, c: Math.floor(x), r: Math.floor(z) });

// ---------------------------------------------------------------- mobili (ingombri) e postazioni

export interface PropBox {
  f: number;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: string;
  rot?: number; // solo estetico (0, 90…)
  color?: string;
  face?: 'N' | 'S' | 'E' | 'W'; // armadi e armadietti: verso dell'anta (ci si può nascondere dentro)
}
// I mobili principali: bloccano il passaggio. Quelli piccoli sono solo decorazioni (vedi la grafica)
export const PROPS: PropBox[] = [
  // cantina
  { f: 0, kind: 'gabbia', x: 2.5, z: 2.6, w: 2.6, d: 2.8, h: 2.2 },
  { f: 0, kind: 'gabbia', x: 5.8, z: 2.6, w: 2.4, d: 2.8, h: 2.2 },
  { f: 0, kind: 'gabbia', x: 2.5, z: 7.2, w: 2.6, d: 2.6, h: 2.2 },
  { f: 0, kind: 'banco', x: 4, z: 15.4, w: 4.4, d: 0.9, h: 0.95 },
  { f: 0, kind: 'scaffale', x: 1.4, z: 12.5, w: 0.7, d: 3, h: 2 },
  { f: 0, kind: 'lavatrice', x: 19, z: 1.6, w: 0.8, d: 0.8, h: 0.9 },
  { f: 0, kind: 'lavatrice', x: 20, z: 1.6, w: 0.8, d: 0.8, h: 0.9 },
  { f: 0, kind: 'lavatrice', x: 21, z: 1.6, w: 0.8, d: 0.8, h: 0.9 },
  { f: 0, kind: 'vasca', x: 26.2, z: 4, w: 1, d: 2, h: 0.9 },
  { f: 0, kind: 'pompa', x: 19.6, z: 14.4, w: 2.2, d: 1.6, h: 1.4 },
  { f: 0, kind: 'caldaia', x: 7, z: 17.4, w: 2.4, d: 1.4, h: 2.2 },
  { f: 0, kind: 'serbatoio', x: 18, z: 17.3, w: 3, d: 1.6, h: 2 },
  { f: 0, kind: 'scatoloni', x: 25.3, z: 12.6, w: 1.6, d: 1, h: 1.2 },
  { f: 0, kind: 'armadietto', x: 7.6, z: 14.4, w: 0.55, d: 0.6, h: 1.95, face: 'W' },
  { f: 0, kind: 'armadietto', x: 22.6, z: 1.35, w: 0.6, d: 0.55, h: 1.95, face: 'S' },
  { f: 0, kind: 'armadietto', x: 22.4, z: 9.35, w: 0.6, d: 0.55, h: 1.95, face: 'S' },
  // piano terra
  { f: 1, kind: 'quadro', x: 1.35, z: 4, w: 0.5, d: 3, h: 2.1 },
  { f: 1, kind: 'bici', x: 2, z: 10.5, w: 1.8, d: 0.6, h: 1 },
  { f: 1, kind: 'bici', x: 2, z: 13, w: 1.8, d: 0.6, h: 1 },
  { f: 1, kind: 'cassette', x: 8.35, z: 2.5, w: 0.5, d: 2, h: 1.4 },
  { f: 1, kind: 'scrivania', x: 24.5, z: 2.2, w: 2, d: 1, h: 0.8 },
  { f: 1, kind: 'caldaia', x: 13.5, z: 17.6, w: 3, d: 1.4, h: 2.4 },
  { f: 1, kind: 'scatoloni', x: 19.2, z: 14.6, w: 1.4, d: 1, h: 1 },
  { f: 1, kind: 'armadietto', x: 7.62, z: 6.6, w: 0.55, d: 0.6, h: 1.95, face: 'W' },
  { f: 1, kind: 'armadietto', x: 1.35, z: 15.2, w: 0.55, d: 0.6, h: 1.95, face: 'E' },
  { f: 1, kind: 'armadietto', x: 18.4, z: 1.35, w: 0.6, d: 0.55, h: 1.95, face: 'S' },
  { f: 1, kind: 'armadietto', x: 18.36, z: 7.0, w: 0.55, d: 0.6, h: 1.95, face: 'E' },
  { f: 1, kind: 'armadietto', x: 5.4, z: 18.62, w: 0.6, d: 0.55, h: 1.95, face: 'N' },
  // primo piano
  { f: 2, kind: 'sedie', x: 9.2, z: 2.7, w: 0.6, d: 1.8, h: 0.9, color: '#c1121f' },
  { f: 2, kind: 'sedie', x: 16.8, z: 2.7, w: 0.6, d: 1.8, h: 0.9, color: '#c1121f' },
  { f: 2, kind: 'cucina', x: 1.45, z: 3, w: 0.7, d: 3.2, h: 0.9 },
  { f: 2, kind: 'tavolo', x: 4.5, z: 3.2, w: 1.6, d: 1, h: 0.76 },
  { f: 2, kind: 'divano', x: 2, z: 9, w: 1, d: 2.4, h: 0.85 },
  { f: 2, kind: 'armadio', x: 25.6, z: 9.5, w: 0.8, d: 2, h: 2.1, face: 'W' },
  { f: 2, kind: 'armadio', x: 7.6, z: 11.3, w: 0.6, d: 1.2, h: 2.05, face: 'W' },
  { f: 2, kind: 'armadio', x: 3.38, z: 17.0, w: 0.6, d: 1.2, h: 2.05, face: 'E' },
  { f: 2, kind: 'letto', x: 22.5, z: 11.2, w: 2, d: 1.6, h: 0.6 },
  { f: 2, kind: 'divano', x: 25.5, z: 3.5, w: 1, d: 2.4, h: 0.85 },
  { f: 2, kind: 'tavolo', x: 21, z: 3.5, w: 1.4, d: 1.4, h: 0.76 },
  // secondo piano
  { f: 3, kind: 'armadio', x: 1.45, z: 6, w: 0.8, d: 2, h: 2.1, face: 'E' },
  { f: 3, kind: 'armadio', x: 5.75, z: 16.38, w: 1.2, d: 0.6, h: 2.05, face: 'S' },
  { f: 3, kind: 'armadietto', x: 18.38, z: 5.5, w: 0.55, d: 0.6, h: 1.95, face: 'E' },
  { f: 3, kind: 'letto', x: 4, z: 11.2, w: 2, d: 1.6, h: 0.6 },
  { f: 3, kind: 'tavolo', x: 4.5, z: 3.5, w: 1.4, d: 1, h: 0.76 },
  { f: 3, kind: 'serbatoio', x: 25.2, z: 3, w: 1.6, d: 3, h: 2.2 },
  { f: 3, kind: 'quadro', x: 26.3, z: 9, w: 0.5, d: 2, h: 2 },
  { f: 3, kind: 'scatoloni', x: 19.4, z: 11.2, w: 1.6, d: 1.2, h: 1 },
];

// Nascondigli: dentro gli armadi e gli armadietti il Custode non ti vede (se non ti ha visto entrare)
export interface HideSpot {
  id: string;
  f: number;
  x: number; // dentro
  z: number;
  ex: number; // davanti all'anta (dove si esce)
  ez: number;
  ry: number; // verso dell'anta
  kind: string;
}
export const HIDES: HideSpot[] = PROPS.filter((p) => p.face).map((p, i) => {
  const [nx, nz] = p.face === 'N' ? [0, -1] : p.face === 'S' ? [0, 1] : p.face === 'E' ? [1, 0] : [-1, 0];
  const half = nx ? p.w / 2 : p.d / 2;
  return { id: `h${i}`, f: p.f, x: p.x, z: p.z, ex: p.x + nx * (half + 0.5), ez: p.z + nz * (half + 0.5), ry: Math.atan2(nx, nz), kind: p.kind };
});

// Oggetti da trasportare
export type ItemKind = 'modulo' | 'filtro' | 'batteria';
export const ITEM_NAMES: Record<ItemKind, string> = { modulo: 'Modulo luci', filtro: 'Filtro della pompa', batteria: 'Batteria di emergenza' };
// Dove può comparire il modulo luci (la partita ne sceglie uno)
export const MODULE_SPOTS = [
  { f: 0, x: 3.2, z: 15.2, y: 0.95 }, // banco dell'officina
  { f: 1, x: 5.5, z: 14.6, y: 0 }, // deposito bici
  { f: 2, x: 21, z: 3.5, y: 0.76 }, // tavolo dei Rossi
  { f: 2, x: 4.5, z: 3.2, y: 0.76 }, // tavolo degli Esposito
];
export const BATTERY_SPOTS = [
  { f: 0, x: 23.2, z: 12.5, y: 0 },
  { f: 0, x: 25.6, z: 10, y: 0 },
];

// Postazioni dove si lavora (tenere premuto per un po')
export type StationKind =
  | 'pannello' // quadro luci: test del piano spento
  | 'lampada' // lampada di prova del secondo piano: conferma
  | 'filtro' // alloggiamento del filtro nella pompa
  | 'lavello' // lavello dell'officina: pulire il filtro
  | 'pompa' // comando della pompa: riavvio
  | 'livello' // indicatore del livello in lavanderia
  | 'alloggio' // alloggiamento della batteria
  | 'collaudo1' // quadro dell'uscita di servizio
  | 'collaudo2' // centralina di piano (primo piano)
  | 'valvola' // valvola di una perdita
  | 'portone'; // ingresso: ritirarsi
export interface StationDef {
  id: string;
  kind: StationKind;
  f: number;
  x: number;
  y: number; // altezza da terra
  z: number;
  name: string;
  ry?: number; // verso in cui guarda (calcolato: le postazioni a muro si appoggiano alla superficie più vicina)
}
export const STATIONS: StationDef[] = [
  { id: 'pannello', kind: 'pannello', f: 1, x: 1.7, y: 1.3, z: 4, name: 'Quadro luci' },
  { id: 'lampada', kind: 'lampada', f: 3, x: 12.5, y: 1.4, z: 15.7, name: 'Lampada di prova' },
  { id: 'filtro', kind: 'filtro', f: 0, x: 20.9, y: 0.8, z: 14.4, name: 'Alloggiamento del filtro' },
  { id: 'lavello', kind: 'lavello', f: 0, x: 6.6, y: 1, z: 10.6, name: 'Lavello' },
  { id: 'pompa', kind: 'pompa', f: 0, x: 18.4, y: 1.1, z: 10.8, name: 'Comando della pompa' },
  { id: 'livello', kind: 'livello', f: 0, x: 18.2, y: 1.4, z: 7.6, name: 'Livello dell’acqua' },
  { id: 'alloggio', kind: 'alloggio', f: 1, x: 26.6, y: 1, z: 11.5, name: 'Alloggiamento batteria' },
  { id: 'collaudo1', kind: 'collaudo1', f: 1, x: 26.6, y: 1.3, z: 14.6, name: 'Quadro dell’uscita' },
  { id: 'collaudo2', kind: 'collaudo2', f: 2, x: 17.7, y: 1.3, z: 2.4, name: 'Centralina di piano' },
  { id: 'portone', kind: 'portone', f: 1, x: 8.2, y: 1.1, z: -5.2, name: 'Furgone della squadra' },
  { id: 'v-cantina', kind: 'valvola', f: 0, x: 15.8, y: 1.6, z: 14.5, name: 'Valvola' },
  { id: 'v-rossi', kind: 'valvola', f: 2, x: 18.4, y: 1.2, z: 1.5, name: 'Valvola' },
  { id: 'v-tecnico', kind: 'valvola', f: 3, x: 24, y: 1.4, z: 1.4, name: 'Valvola' },
  { id: 'v-caldaia', kind: 'valvola', f: 1, x: 10, y: 1.4, z: 17.6, name: 'Valvola' },
];
// Le postazioni a muro si appoggiano davvero a un muro o a un mobile alto (niente roba sospesa a mezz'aria)
const WALL_MOUNT: Partial<Record<StationKind, number>> = { pannello: 0.06, collaudo1: 0.06, collaudo2: 0.06, pompa: 0.06, alloggio: 0.06, valvola: 0.12, livello: 0.08, lavello: 0.25 };
for (const st of STATIONS) {
  const off = WALL_MOUNT[st.kind];
  if (off === undefined) continue;
  let best: { d: number; x: number; z: number; nx: number; nz: number; s: number } | null = null;
  const test = (x0: number, z0: number, x1: number, z1: number, surf: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((st.x - x0) * dx + (st.z - z0) * dz) / (L * L)));
    const qx = x0 + dx * t;
    const qz = z0 + dz * t;
    const d = Math.hypot(st.x - qx, st.z - qz);
    let nx = -dz / L;
    let nz = dx / L;
    if ((st.x - qx) * nx + (st.z - qz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    if (!best || d < best.d) best = { d, x: qx, z: qz, nx, nz, s: surf };
  };
  for (const w of WALLS[st.f]) test(w.x0, w.z0, w.x1, w.z1, H1.wallT / 2);
  for (const p of PROPS) {
    if (p.f !== st.f || p.h < st.y + 0.2) continue;
    const [a, b, c, d] = [p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2];
    test(a, b, c, b, 0);
    test(a, d, c, d, 0);
    test(a, b, a, d, 0);
    test(c, b, c, d, 0);
  }
  const bb = best as { d: number; x: number; z: number; nx: number; nz: number; s: number } | null;
  if (!bb || bb.d > 1.3) continue;
  st.x = +(bb.x + bb.nx * (bb.s + off)).toFixed(3);
  st.z = +(bb.z + bb.nz * (bb.s + off)).toFixed(3);
  st.ry = Math.atan2(bb.nx, bb.nz);
}
// Quanto si tiene premuto (secondi)
export const HOLD: Record<string, number> = {
  pannello: 3.5, // la leva del test (fa rumore)
  lampada: 2.5,
  filtroOut: 3,
  filtroIn: 3,
  lavello: 6,
  pompa: 12,
  livello: 1,
  alloggio: 3,
  collaudo: 6,
  valvola: 4,
  portone: 2.5,
  soccorso1: 6,
  soccorso2: 10,
  blocca: 2,
};
// Quanto rumore fanno i lavori (raggio in metri in cui il Custode lo sente)
export const NOISE = { pompa: 34, pannello: 22, filtro: 14, lavello: 10, collaudo: 18, porta: 9, corsa: 8, caduta: 12, batteria: 13, valvola: 9 };

// Il Custode
export const CUSTODE = {
  walk: 1.25,
  hunt: 2.2, // va verso un rumore
  chase: 3.25,
  sight: 13,
  near: 2.8, // vicinissimo: ti sente anche se non ti vede
  reach: 1.25,
  windup: 750, // ms: alza il braccio prima di colpire
  knockWait: 5000, // ms: tre colpi prima di aprire una porta normale
  knockWaitBlocked: 14000,
  giveUp: 17000, // senza contatto né rumori: smette di cercare
  rest: [35000, 60000], // pausa prima di tornare
  after: 25000, // dopo un colpo si ritira
};

// ---------------------------------------------------------------- oggetti che si muovono da soli

// Piccoli oggetti che il palazzo sposta (cadono, si girano, si accendono). Sono uguali per tutti:
// chi entra dopo li trova già a terra. Non fanno mai danni e non bloccano mai un passaggio.
export type DynKind =
  | 'tazza'
  | 'bottiglia'
  | 'libro'
  | 'quadro'
  | 'tv'
  | 'radio'
  | 'anta'
  | 'rubinetto'
  | 'sedia'
  | 'giocattolo'
  | 'pallone'
  | 'scatola'
  | 'attrezzo'
  | 'barattolo' // vetro: cade e si frantuma
  | 'scopa' // appoggiata al muro: cade
  | 'secchio' // rotola sbattendo
  | 'telefono' // squilla
  | 'carillon' // suona da solo
  | 'lampadario' // oscilla cigolando
  | 'bambola'; // si gira a guardarti
export interface DynProp {
  id: string;
  kind: DynKind;
  f: number;
  x: number;
  y: number; // altezza da terra
  z: number;
  rot?: number; // verso iniziale
  wall?: 'N' | 'S' | 'E' | 'W'; // appeso a un muro (quadri, ante)
}
export const DYN_PROPS: DynProp[] = [
  // primo piano, Esposito
  { id: 'd-tazza1', kind: 'tazza', f: 2, x: 4.2, y: 0.79, z: 3.0 },
  { id: 'd-bott1', kind: 'bottiglia', f: 2, x: 4.9, y: 0.79, z: 3.45 },
  { id: 'd-anta1', kind: 'anta', f: 2, x: 1.12, y: 1.65, z: 2.3, wall: 'W' },
  { id: 'd-rub1', kind: 'rubinetto', f: 2, x: 1.3, y: 0.95, z: 3.9, rot: Math.PI / 2 },
  { id: 'd-tv1', kind: 'tv', f: 2, x: 6.4, y: 0.55, z: 9.6, rot: -Math.PI / 2 },
  { id: 'd-quadro1', kind: 'quadro', f: 2, x: 1.08, y: 1.65, z: 10.5, wall: 'W' },
  { id: 'd-libro1', kind: 'libro', f: 2, x: 2.0, y: 0.68, z: 7.9 },
  // primo piano, Rossi
  { id: 'd-radio1', kind: 'radio', f: 2, x: 21.2, y: 0.79, z: 3.3 },
  { id: 'd-sedia1', kind: 'sedia', f: 2, x: 21.0, y: 0, z: 4.7, rot: Math.PI },
  { id: 'd-quadro2', kind: 'quadro', f: 2, x: 26.92, y: 1.7, z: 2.4, wall: 'E' },
  { id: 'd-gioco1', kind: 'giocattolo', f: 2, x: 20, y: 0, z: 8.4 },
  // secondo piano
  { id: 'd-quadro3', kind: 'quadro', f: 3, x: 1.08, y: 1.65, z: 3.2, wall: 'W' },
  { id: 'd-sedia2', kind: 'sedia', f: 3, x: 4.6, y: 0, z: 4.6, rot: Math.PI },
  { id: 'd-tazza2', kind: 'tazza', f: 3, x: 4.3, y: 0.79, z: 3.4 },
  { id: 'd-tv2', kind: 'tv', f: 3, x: 6.5, y: 0.55, z: 8.2, rot: -Math.PI / 2 },
  { id: 'd-scatola1', kind: 'scatola', f: 3, x: 19.42, y: 0.9, z: 11.2 },
  { id: 'd-pallone2', kind: 'pallone', f: 3, x: 9.3, y: 0, z: 12.6 },
  // piano terra
  { id: 'd-radio2', kind: 'radio', f: 1, x: 24.2, y: 0.78, z: 2.2 },
  { id: 'd-quadro4', kind: 'quadro', f: 1, x: 18.08, y: 1.7, z: 2.6, wall: 'W' },
  { id: 'd-pallone1', kind: 'pallone', f: 1, x: 5.2, y: 0, z: 13.4 },
  // cantina
  { id: 'd-scatola2', kind: 'scatola', f: 0, x: 1.4, y: 1.32, z: 12.0 },
  { id: 'd-attrezzo1', kind: 'attrezzo', f: 0, x: 4.6, y: 0.99, z: 15.35 },
  { id: 'd-bott2', kind: 'bottiglia', f: 0, x: 5.6, y: 0, z: 6.3 },
  // più oggetti ovunque: il palazzo deve "rispondere" in ogni zona, anche dove si lavora
  { id: 'd-bar1', kind: 'barattolo', f: 0, x: 2.6, y: 0.99, z: 15.2 },
  { id: 'd-bar2', kind: 'barattolo', f: 0, x: 5.3, y: 0.99, z: 15.55 },
  { id: 'd-bar3', kind: 'barattolo', f: 0, x: 1.4, y: 1.32, z: 13.6 },
  { id: 'd-bar4', kind: 'barattolo', f: 0, x: 20, y: 0.9, z: 1.6 },
  { id: 'd-scopa1', kind: 'scopa', f: 0, x: 8.18, y: 0, z: 7.6, wall: 'W' },
  { id: 'd-secchio1', kind: 'secchio', f: 0, x: 9.4, y: 0, z: 13.8 },
  { id: 'd-lamp1', kind: 'lampadario', f: 0, x: 12.5, y: 2.9, z: 14.5 },
  { id: 'd-bott3', kind: 'bottiglia', f: 0, x: 19.0, y: 0.9, z: 1.55 },
  { id: 'd-tel1', kind: 'telefono', f: 1, x: 24.95, y: 0.82, z: 2.0 },
  { id: 'd-scopa2', kind: 'scopa', f: 1, x: 7.82, y: 0, z: 9.4, wall: 'E' },
  { id: 'd-scopa3', kind: 'scopa', f: 1, x: 26.82, y: 0, z: 7.4, wall: 'E' },
  { id: 'd-lamp2', kind: 'lampadario', f: 1, x: 11, y: 2.9, z: 3 },
  { id: 'd-secchio2', kind: 'secchio', f: 1, x: 20, y: 0, z: 17.3 },
  { id: 'd-bar5', kind: 'barattolo', f: 1, x: 23.9, y: 0.82, z: 2.45 },
  { id: 'd-tel2', kind: 'telefono', f: 2, x: 21.3, y: 0.79, z: 3.8 },
  { id: 'd-car1', kind: 'carillon', f: 2, x: 22, y: 0.65, z: 11.5 },
  { id: 'd-bamb1', kind: 'bambola', f: 2, x: 12, y: 0, z: 17.5 },
  { id: 'd-lamp3', kind: 'lampadario', f: 2, x: 12.5, y: 2.9, z: 14.5 },
  { id: 'd-bar6', kind: 'barattolo', f: 2, x: 1.45, y: 0.94, z: 2.2 },
  { id: 'd-car2', kind: 'carillon', f: 3, x: 4.85, y: 0.79, z: 3.75 },
  { id: 'd-lamp4', kind: 'lampadario', f: 3, x: 12.5, y: 2.9, z: 14.5 },
  { id: 'd-bamb2', kind: 'bambola', f: 3, x: 9, y: 0, z: 17.5 },
  { id: 'd-bar7', kind: 'barattolo', f: 3, x: 16.15, y: 0.95, z: 18.72 },
  { id: 'd-scopa4', kind: 'scopa', f: 3, x: 17.82, y: 0, z: 13.4, wall: 'E' },
];
// Che cosa fa ogni oggetto quando il palazzo lo "tocca" (e se può rifarlo dopo un po')
export const DYN_EFFECT: Record<DynKind, { k: 'cade' | 'rotola' | 'gira' | 'apre' | 'accende' | 'squilla' | 'suona' | 'oscilla'; repeat: boolean }> = {
  tazza: { k: 'cade', repeat: false },
  bottiglia: { k: 'cade', repeat: false },
  libro: { k: 'cade', repeat: false },
  quadro: { k: 'cade', repeat: false },
  tv: { k: 'accende', repeat: true },
  radio: { k: 'accende', repeat: true },
  anta: { k: 'apre', repeat: true },
  rubinetto: { k: 'accende', repeat: true },
  sedia: { k: 'gira', repeat: true },
  giocattolo: { k: 'rotola', repeat: false },
  pallone: { k: 'rotola', repeat: false },
  scatola: { k: 'cade', repeat: false },
  attrezzo: { k: 'cade', repeat: false },
  barattolo: { k: 'cade', repeat: false },
  scopa: { k: 'cade', repeat: false },
  secchio: { k: 'rotola', repeat: false },
  telefono: { k: 'squilla', repeat: true },
  carillon: { k: 'suona', repeat: true },
  lampadario: { k: 'oscilla', repeat: true },
  bambola: { k: 'gira', repeat: true },
};
