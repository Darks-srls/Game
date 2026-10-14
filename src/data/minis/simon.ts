// 🤖 Simon dice: nove piastrelle colorate giganti, il forno-robot mostra la sequenza e voi la ripetete coi piedi (regole fisiche)
import { registerMini } from '../party3d';

export const SIMON = {
  n: 3, // 3×3 piastrelle
  step: 6, // da un centro all'altro
  half: 2.3, // mezza piastrella (le passerelle in mezzo sono larghe 1,4 m e non contano)
  edge: 9.7, // oltre il bordo esterno della passerella si cade
  giri: 10,
  first: 2, // lunghezza della sequenza al primo giro (+1 ogni giro)
  leadMs: 1100, // "GUARDA!" prima della sequenza
  perStep: 2500, // tempo per ogni passo…
  extra: 3000, // … più questo
  pauseMs: 1700, // tra un giro e l'altro (piastrelle pulite)
  robotZ: 16.5, // il forno-robot sta dietro alle piastrelle
};
// accesa per quanto tempo (ms) e pausa tra una luce e l'altra: sempre più veloce
export const simonOn = (giro: number) => Math.max(380, 640 - giro * 28);
export const simonGap = (giro: number) => Math.max(140, 220 - giro * 8);

export const SIMON_COLORS = ['#ff3b3b', '#ff9f1c', '#ffd60a', '#7ae031', '#14c9b5', '#3a86ff', '#8f4dff', '#ff5fb0', '#f4f1ea'];
export const SIMON_NAMES = ['ROSSO', 'ARANCIO', 'GIALLO', 'VERDE', 'TURCHESE', 'BLU', 'VIOLA', 'ROSA', 'BIANCO'];
export const SIMON_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]; // una nota per colore

// centro della piastrella i (riga 0 = la più vicina alla telecamera, z negativa)
export const simonTile = (i: number) => ({ x: ((i % SIMON.n) - 1) * SIMON.step, z: (Math.floor(i / SIMON.n) - 1) * SIMON.step });
// su che piastrella sono? -1 = passerella (o fuori). pad allarga (o stringe) le piastrelle
export function simonTileAt(x: number, z: number, pad = 0) {
  const i = Math.round(x / SIMON.step) + 1;
  const j = Math.round(z / SIMON.step) + 1;
  if (i < 0 || j < 0 || i >= SIMON.n || j >= SIMON.n) return -1;
  const c = simonTile(j * SIMON.n + i);
  const h = SIMON.half + pad;
  return Math.abs(x - c.x) <= h && Math.abs(z - c.z) <= h ? j * SIMON.n + i : -1;
}

registerMini({
  kind: 'SIMON',
  name: 'Simon dice',
  tag: 'Memoria',
  rules: 'Il forno-robot Simon accende le piastrelle in sequenza, ognuna col suo suono. Poi TOCCA A VOI: calpestatele nello stesso ordine prima che scada il tempo (le passerelle in mezzo non contano). Piastrella sbagliata? Crolla sotto di te! Ogni giro un colore in più.',
  seconds: 0,
  noPush: true,
  ground: (x, z) => (Math.abs(x) <= SIMON.edge && Math.abs(z) <= SIMON.edge ? 0 : null),
});
