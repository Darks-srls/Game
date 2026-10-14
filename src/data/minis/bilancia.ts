// ⚖️ La bilancia: un piatto rotondo gigante su un perno che pende dalla parte dove c'è più peso (regole fisiche).
// L'inclinazione la simula il server (pesi dei giocatori e delle polpette): arriva ai telefoni come oggetto 'bil_tilt'
// (15 volte al secondo) e al server stesso con sync. Il piano: y = -(tx·x + tz·z), (tx, tz) punta verso il lato basso.
import { registerMini } from '../party3d';

export const BIL = {
  r: 12, // raggio del piatto
  tMax: Math.tan((16 * Math.PI) / 180), // inclinazione massima (pendenza)
  slide: 19, // scivolata: m/s per unità di pendenza (a 20° quasi 7 m/s: in salita non si va più)
  ballR: 1.15, // raggio di una polpetta
  ballM: 3.5, // una polpetta pesa come tre giocatori e mezzo
  ballDrop: 15, // da che quota cade
  ballG: 20, // gravità delle polpette (cadono un po' piano: si vedono arrivare)
  fallOut: -10,
  slamFrom: 16, // la nonna comincia a dare ciabattate sul bordo
  slamWarn: 1800, // … e si vede prima dove (ms)
  slamR: 3.6, // chi è lì vicino vola via
};
const R2 = BIL.r * BIL.r;

// inclinazione attuale (variabile del modulo: ground e groundVel la leggono a ogni passo)
let tx = 0;
let tz = 0;
export function setBilTilt(x: number, z: number) {
  tx = x;
  tz = z;
}
export const bilTiltX = () => tx;
export const bilTiltZ = () => tz;
// quota del piatto sotto (x, z)
export const bilY = (x: number, z: number) => -(tx * x + tz * z);
// (x, z) è sopra il piatto? (distanza misurata sul piano inclinato)
export function bilOn(x: number, z: number) {
  const y = tx * x + tz * z;
  return x * x + z * z + y * y <= R2;
}

const GV = { x: 0, z: 0 };

registerMini({
  kind: 'BILANCIA',
  name: 'La bilancia',
  tag: 'Tieni l’equilibrio',
  rules:
    'Siete sul piatto di una bilancia gigante: pende dalla parte dove c’è più gente e sul piatto storto si scivola giù! Dall’alto piovono polpette che pesano e rotolano: scansale (con lo SCHIAFFO le rilanci contro gli altri). Chi cade dal bordo è fuori: vince l’ultimo in piedi.',
  seconds: 90,
  fallOut: BIL.fallOut,
  ground: (x, z) => {
    const y = tx * x + tz * z;
    return x * x + z * z + y * y <= R2 ? -y : null;
  },
  // sul piatto storto si scivola verso il lato basso
  groundVel: () => {
    GV.x = tx * BIL.slide;
    GV.z = tz * BIL.slide;
    return GV;
  },
  // l'inclinazione nella view c'è solo per il server (sul telefono arriva come oggetto, più spesso)
  sync: (ext) => {
    if (ext && typeof ext.tx === 'number') {
      tx = ext.tx;
      tz = ext.tz;
    }
  },
});
