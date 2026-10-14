// 🚀 Astro Impostori: la mappa dell'astronave (coordinate del mondo in pixel)
// Si cammina dentro l'unione di stanze e corridoi; gli oggetti grandi (tavolo, reattore…) sono ostacoli.
// La vista si ferma ai muri: si vede solo ciò che è "in linea d'aria" dentro stanze e corridoi.

export const WORLD = { w: 2314, h: 1300 };
export const PLAYER_R = 22; // raggio della pedina
export const SPEED = 285; // pixel al secondo
export const GHOST_SPEED = 360;
export const VISION = { crew: 300, impostor: 420 };
export const KILL_RANGE = 110;
export const REPORT_RANGE = 150;
export const TASK_RANGE = 95;
export const BUTTON_RANGE = 140;
export const VENT_RANGE = 75;
export const DISCUSS_MS = 10_000; // in riunione si vota solo dopo 10 secondi di discussione

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Prop {
  img: string; // immagine in /art/astro/
  x: number;
  y: number;
  r: number; // raggio dell'ostacolo
  s: number; // dimensione disegnata
}

export interface Room extends Rect {
  id: string;
  name: string;
  props: Prop[];
}

export const ROOMS: Room[] = [
  { id: 'reattore', name: 'Reattore', x: 65, y: 65, w: 286, h: 247, props: [{ img: 'reactor', x: 150, y: 150, r: 45, s: 132 }] },
  { id: 'mensa', name: 'Mensa', x: 910, y: 52, w: 455, h: 351, props: [{ img: 'table', x: 1138, y: 215, r: 56, s: 156 }] },
  { id: 'armeria', name: 'Armeria', x: 1950, y: 65, w: 293, h: 247, props: [{ img: 'weapons', x: 2178, y: 137, r: 42, s: 124 }] },
  { id: 'motori', name: 'Motori', x: 65, y: 494, w: 273, h: 273, props: [{ img: 'engine', x: 117, y: 566, r: 38, s: 108 }, { img: 'engine', x: 286, y: 709, r: 38, s: 108 }] },
  { id: 'sicurezza', name: 'Sicurezza', x: 455, y: 494, w: 247, h: 273, props: [{ img: 'security', x: 627, y: 572, r: 44, s: 120 }] },
  { id: 'infermeria', name: 'Infermeria', x: 819, y: 494, w: 234, h: 273, props: [{ img: 'medbay', x: 995, y: 572, r: 41, s: 112 }] },
  { id: 'amministrazione', name: 'Amministrazione', x: 1222, y: 494, w: 260, h: 273, props: [{ img: 'admin', x: 1352, y: 585, r: 47, s: 128 }] },
  { id: 'ossigeno', name: 'Ossigeno', x: 1599, y: 494, w: 247, h: 273, props: [{ img: 'o2', x: 1664, y: 572, r: 39, s: 108 }] },
  { id: 'navigazione', name: 'Navigazione', x: 1963, y: 494, w: 286, h: 273, props: [{ img: 'nav', x: 2197, y: 631, r: 41, s: 116 }] },
  { id: 'elettricita', name: 'Elettricità', x: 195, y: 936, w: 273, h: 299, props: [{ img: 'electric', x: 390, y: 1164, r: 35, s: 100 }] },
  { id: 'laboratorio', name: 'Laboratorio', x: 585, y: 936, w: 273, h: 299, props: [{ img: 'lab', x: 722, y: 1151, r: 47, s: 128 }] },
  { id: 'magazzino', name: 'Magazzino', x: 962, y: 936, w: 390, h: 325, props: [{ img: 'crates', x: 1040, y: 1177, r: 47, s: 128 }, { img: 'crates', x: 1274, y: 1177, r: 47, s: 128 }] },
  { id: 'comunicazioni', name: 'Comunicazioni', x: 1469, y: 936, w: 273, h: 299, props: [{ img: 'comms', x: 1664, y: 1151, r: 42, s: 120 }] },
  { id: 'scudi', name: 'Scudi', x: 1859, y: 936, w: 286, h: 299, props: [{ img: 'shields', x: 2048, y: 1151, r: 39, s: 112 }] },
];

// Corridoi (larghi 110, corti): entrano di ~65 px nelle stanze, così si passa senza incastrarsi
export const CORRIDORS: Rect[] = [
  { x: 287, y: 134, w: 687, h: 110 }, // reattore – mensa
  { x: 1301, y: 134, w: 713, h: 110 }, // mensa – armeria
  { x: 147, y: 248, w: 110, h: 310 }, // reattore – motori
  { x: 2051, y: 248, w: 110, h: 310 }, // armeria – navigazione
  { x: 1083, y: 339, w: 110, h: 531 }, // mensa – corridoio centrale
  { x: 79, y: 790, w: 2195, h: 110 }, // corridoio centrale, da un capo all'altro della nave
  { x: 147, y: 703, w: 110, h: 167 }, // dalle stanze di sopra giù nel corridoio centrale
  { x: 524, y: 703, w: 110, h: 167 },
  { x: 881, y: 703, w: 110, h: 167 },
  { x: 1297, y: 703, w: 110, h: 167 },
  { x: 1668, y: 703, w: 110, h: 167 },
  { x: 2051, y: 703, w: 110, h: 167 },
  { x: 277, y: 820, w: 110, h: 180 }, // dal corridoio centrale giù nelle stanze di sotto
  { x: 667, y: 820, w: 110, h: 180 },
  { x: 1102, y: 820, w: 110, h: 180 },
  { x: 1551, y: 820, w: 110, h: 180 },
  { x: 1947, y: 820, w: 110, h: 180 },
];

export type TaskType = 'WIRES' | 'HOLD' | 'SLIDER' | 'TAPS' | 'CODE' | 'SIMON' | 'NUMBERS' | 'SWIPE';

export interface Station {
  room: string;
  x: number;
  y: number;
  type: TaskType;
  title: string;
}

export const STATIONS: Station[] = [
  { room: 'reattore', x: 315, y: 94, type: 'SIMON', title: 'Avvia il reattore' },
  { room: 'reattore', x: 98, y: 280, type: 'NUMBERS', title: 'Sblocca i collettori' },
  { room: 'mensa', x: 943, y: 85, type: 'HOLD', title: 'Scarica i dati' },
  { room: 'mensa', x: 1333, y: 371, type: 'TAPS', title: 'Svuota la spazzatura' },
  { room: 'mensa', x: 1333, y: 85, type: 'WIRES', title: 'Collega i cavi' },
  { room: 'armeria', x: 1989, y: 280, type: 'TAPS', title: 'Distruggi gli asteroidi' },
  { room: 'armeria', x: 2210, y: 280, type: 'CODE', title: 'Ricarica le armi' },
  { room: 'motori', x: 299, y: 530, type: 'SLIDER', title: 'Allinea il motore superiore' },
  { room: 'motori', x: 98, y: 735, type: 'SLIDER', title: 'Allinea il motore inferiore' },
  { room: 'sicurezza', x: 484, y: 530, type: 'WIRES', title: 'Collega i cavi' },
  { room: 'infermeria', x: 848, y: 530, type: 'HOLD', title: 'Scansione medica' },
  { room: 'infermeria', x: 1024, y: 735, type: 'NUMBERS', title: 'Analizza i campioni' },
  { room: 'amministrazione', x: 1251, y: 530, type: 'SWIPE', title: 'Passa il badge' },
  { room: 'amministrazione', x: 1453, y: 735, type: 'HOLD', title: 'Carica i dati' },
  { room: 'ossigeno', x: 1817, y: 530, type: 'TAPS', title: 'Pulisci il filtro' },
  { room: 'ossigeno', x: 1628, y: 735, type: 'CODE', title: 'Regola l’ossigeno' },
  { room: 'navigazione', x: 2220, y: 530, type: 'SLIDER', title: 'Traccia la rotta' },
  { room: 'navigazione', x: 1992, y: 735, type: 'CODE', title: 'Inserisci le coordinate' },
  { room: 'elettricita', x: 224, y: 969, type: 'WIRES', title: 'Collega i cavi' },
  { room: 'elettricita', x: 439, y: 969, type: 'SLIDER', title: 'Calibra la corrente' },
  { room: 'laboratorio', x: 614, y: 1206, type: 'SIMON', title: 'Analizza il DNA' },
  { room: 'magazzino', x: 1157, y: 1229, type: 'HOLD', title: 'Rifornisci il carburante' },
  { room: 'comunicazioni', x: 1498, y: 969, type: 'NUMBERS', title: 'Ripristina le comunicazioni' },
  { room: 'scudi', x: 2116, y: 1206, type: 'TAPS', title: 'Accendi gli scudi' },
];

// 🕳️ Botole: solo l'impostore le usa, per spostarsi da una botola a quelle collegate
export interface Vent {
  room: string;
  x: number;
  y: number;
  links: number[];
}

export const VENTS: Vent[] = [
  { room: 'reattore', x: 273, y: 273, links: [1] }, // 0
  { room: 'motori', x: 200, y: 640, links: [0, 2] }, // 1
  { room: 'elettricita', x: 234, y: 1196, links: [1] }, // 2
  { room: 'mensa', x: 952, y: 364, links: [4, 5] }, // 3
  { room: 'amministrazione', x: 1446, y: 533, links: [3, 5] }, // 4
  { room: 'magazzino', x: 1313, y: 975, links: [3, 4] }, // 5
  { room: 'sicurezza', x: 491, y: 731, links: [7, 8] }, // 6
  { room: 'infermeria', x: 852, y: 731, links: [6, 8] }, // 7
  { room: 'laboratorio', x: 822, y: 972, links: [6, 7] }, // 8
  { room: 'armeria', x: 1989, y: 104, links: [10] }, // 9
  { room: 'navigazione', x: 1999, y: 533, links: [9, 11] }, // 10
  { room: 'scudi', x: 1895, y: 1206, links: [10, 12] }, // 11
  { room: 'comunicazioni', x: 1710, y: 1206, links: [11, 13] }, // 12
  { room: 'ossigeno', x: 1814, y: 731, links: [12] }, // 13
];

export const BUTTON = { x: 1138, y: 215 }; // il pulsante d'emergenza, al centro del tavolo della mensa
// 📹 Telecamere: dalla console in Sicurezza si guardano 4 corridoi in diretta;
// quando qualcuno le sta guardando, le lucine rosse delle telecamere lampeggiano (come nell'originale)
export const CAMERA_CONSOLE = { x: 627, y: 640 };
export const CONSOLE_RANGE = 100;
export const CAMERAS: { name: string; x: number; y: number; mx: number; my: number }[] = [
  { name: 'Corridoio del Reattore', x: 637, y: 189, mx: 637, my: 141 },
  { name: 'Corridoio dell’Armeria', x: 1651, y: 189, mx: 1651, my: 141 },
  { name: 'Incrocio centrale', x: 1138, y: 829, mx: 1209, my: 798 },
  { name: 'Corridoio delle Comunicazioni', x: 1755, y: 845, mx: 1814, my: 798 },
];
export const BUTTON_COOLDOWN = 20_000; // a inizio partita e dopo ogni riunione il pulsante resta bloccato 20 secondi

// ---- Sabotaggi dell'impostore ----
export type SabotageKind = 'lights' | 'reactor' | 'o2' | 'comms';
export const SABOTAGE_MS = 45_000; // reattore e ossigeno: tempo per riparare, poi vince l'impostore
export const SABOTAGE_COOLDOWN = 30_000;
export const DOOR_MS = 25_000; // le porte si riaprono da sole dopo 25 secondi
export const DOOR_COOLDOWN = 20_000;
export const LIGHTS_VISION = 120; // con le luci spente l'equipaggio vede pochissimo

// Punti dove si ripara: il reattore va tenuto da due persone insieme (ra + rb), l'ossigeno ha due codici (o2a + o2b)
export const FIX_POINTS: Record<string, { kind: SabotageKind; room: string; x: number; y: number; label: string }> = {
  lights: { kind: 'lights', room: 'elettricita', x: 390, y: 1099, label: 'Ripara le luci' },
  comms: { kind: 'comms', room: 'comunicazioni', x: 1573, y: 1105, label: 'Ripara le comunicazioni' },
  o2a: { kind: 'o2', room: 'ossigeno', x: 1755, y: 624, label: 'Codice dell’ossigeno' },
  o2b: { kind: 'o2', room: 'amministrazione', x: 1453, y: 624, label: 'Codice dell’ossigeno' },
  ra: { kind: 'reactor', room: 'reattore', x: 104, y: 195, label: 'Pannello del reattore (sinistra)' },
  rb: { kind: 'reactor', room: 'reattore', x: 306, y: 195, label: 'Pannello del reattore (destra)' },
};
export const FIX_RANGE = 90;

export const SABOTAGE_INFO: Record<SabotageKind, { icon: string; name: string; how: string; critical: boolean }> = {
  lights: { icon: '💡', name: 'Luci spente', how: 'Andate in Elettricità e sistemate gli interruttori', critical: false },
  comms: { icon: '📡', name: 'Comunicazioni interrotte', how: 'Andate in Comunicazioni e ritrovate la frequenza', critical: false },
  o2: { icon: '💨', name: 'Ossigeno in esaurimento!', how: 'Inserite i codici in Ossigeno E in Amministrazione', critical: true },
  reactor: { icon: '☢️', name: 'Reattore in avaria!', how: 'Due persone tengano premuti INSIEME i due pannelli del Reattore', critical: true },
};

// Posti attorno al tavolo: inizio partita e dopo ogni riunione
export const spawnPoint = (i: number, n: number) => {
  const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.round(BUTTON.x + Math.cos(a) * 125), y: Math.round(BUTTON.y + Math.sin(a) * 125) };
};

const AREAS: Rect[] = [...ROOMS, ...CORRIDORS];
const OBSTACLES = ROOMS.flatMap((r) => r.props);

// 🚪 Porte: dove un corridoio entra in una stanza (calcolate dalla mappa)
export const DOORS: { room: string; x: number; y: number; w: number; h: number }[] = CORRIDORS.flatMap((c) =>
  ROOMS.flatMap((r) => {
    const x1 = Math.max(c.x, r.x);
    const y1 = Math.max(c.y, r.y);
    const x2 = Math.min(c.x + c.w, r.x + r.w);
    const y2 = Math.min(c.y + c.h, r.y + r.h);
    if (x2 <= x1 || y2 <= y1) return [];
    if (c.y < r.y) return [{ room: r.id, x: x1, y: r.y - 10, w: x2 - x1, h: 20 }];
    if (c.y + c.h > r.y + r.h) return [{ room: r.id, x: x1, y: r.y + r.h - 10, w: x2 - x1, h: 20 }];
    if (c.x < r.x) return [{ room: r.id, x: r.x - 10, y: y1, w: 20, h: y2 - y1 }];
    return [{ room: r.id, x: r.x + r.w - 10, y: y1, w: 20, h: y2 - y1 }];
  }),
);
let closedDoors: Rect[] = [];
// Il telefono aggiorna quali stanze hanno le porte chiuse (bloccano passaggio e vista)
export function setClosedRooms(rooms: string[]) {
  closedDoors = DOORS.filter((d) => rooms.includes(d.room));
}
const inDoor = (x: number, y: number, r: number) => closedDoors.some((d) => x > d.x - r && x < d.x + d.w + r && y > d.y - r && y < d.y + d.h + r);

// La pedina (cerchio di raggio PLAYER_R) può stare qui?
export function walkable(x: number, y: number, r = PLAYER_R, doors = true): boolean {
  const inside = AREAS.some((a) => x >= a.x + r && x <= a.x + a.w - r && y >= a.y + r && y <= a.y + a.h - r);
  if (!inside || (doors && inDoor(x, y, r))) return false;
  return OBSTACLES.every((o) => (x - o.x) ** 2 + (y - o.y) ** 2 >= (o.r + r) ** 2);
}

// Movimento con "scivolata" lungo i muri (chi è rimasto in mezzo a una porta che si chiude può uscirne)
export function moveWithCollision(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  const doors = !inDoor(x, y, PLAYER_R);
  if (walkable(x + dx, y + dy, PLAYER_R, doors)) return { x: x + dx, y: y + dy };
  if (dx && walkable(x + dx, y, PLAYER_R, doors)) return { x: x + dx, y };
  if (dy && walkable(x, y + dy, PLAYER_R, doors)) return { x, y: y + dy };
  return { x, y };
}

// ---- Vista: griglia di 8 px che dice dov'è "aperto" (stanze e corridoi); i muri fermano lo sguardo ----
const CELL = 8;
const GW = Math.ceil(WORLD.w / CELL);
const GH = Math.ceil(WORLD.h / CELL);
let grid: Uint8Array | null = null;
function openGrid() {
  if (grid) return grid;
  grid = new Uint8Array(GW * GH);
  for (const a of AREAS) {
    for (let gy = Math.floor(a.y / CELL); gy < Math.ceil((a.y + a.h) / CELL); gy++)
      for (let gx = Math.floor(a.x / CELL); gx < Math.ceil((a.x + a.w) / CELL); gx++) if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) grid[gy * GW + gx] = 1;
  }
  return grid;
}
export const isOpen = (x: number, y: number) => {
  const gx = Math.floor(x / CELL);
  const gy = Math.floor(y / CELL);
  return gx >= 0 && gy >= 0 && gx < GW && gy < GH && openGrid()[gy * GW + gx] === 1 && !(closedDoors.length && inDoor(x, y, 0));
};

// Si vede da A a B? (nessun muro in mezzo)
export function lineOfSight(a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(d / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isOpen(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

// Poligono di ciò che si vede: tanti raggi che si fermano al primo muro (o al raggio visivo)
const RAYS = 360;
const COS = Array.from({ length: RAYS }, (_, i) => Math.cos((i / RAYS) * Math.PI * 2));
const SIN = Array.from({ length: RAYS }, (_, i) => Math.sin((i / RAYS) * Math.PI * 2));
export function visionPolygon(x: number, y: number, radius: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < RAYS; i++) {
    let d = 0;
    // passi lunghi finché è aperto, poi si rifinisce il punto d'impatto
    while (d < radius && isOpen(x + COS[i] * (d + 8), y + SIN[i] * (d + 8))) d += 8;
    if (d < radius) while (d < radius && isOpen(x + COS[i] * (d + 1), y + SIN[i] * (d + 1))) d += 1;
    d = Math.min(d + 10, radius); // un filo di muro si vede
    pts.push(x + COS[i] * d, y + SIN[i] * d);
  }
  return pts;
}

export const roomAt = (x: number, y: number) => ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null;

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Colori degli astronauti
export const ASTRO_COLORS = ['#ff3b3b', '#2f6bff', '#2fd15a', '#ff8cd0', '#ff9a1f', '#ffe21f', '#3a3a46', '#f4f4f4', '#9b4dff', '#8a5a2b', '#2ee6e6', '#a8ff3e'];
export const ASTRO_COLOR_NAMES = ['Rosso', 'Blu', 'Verde', 'Rosa', 'Arancione', 'Giallo', 'Nero', 'Bianco', 'Viola', 'Marrone', 'Ciano', 'Lime'];
