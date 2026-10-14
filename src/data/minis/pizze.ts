// 🍕 Pizza express: dal forno escono le pizze, ognuna va al suo tavolo (stesso colore e numero). Consegna, ruba a schiaffi
// (regole fisiche: pizzeria quadrata col forno in mezzo, i piedistalli del bancone, sei tavoli e tre vasi di limoni)
import { PHYS, registerMini } from '../party3d';

export interface PizCircle {
  x: number;
  z: number;
  r: number;
}

const ring = (r: number, deg: number) => ({ x: Math.sin((deg * Math.PI) / 180) * r, z: Math.cos((deg * Math.PI) / 180) * r });

export const PIZ = {
  half: 14, // pizzeria 28×28
  ovenR: 2.4, // il forno al centro
  slotR: 0.5, // piedistallo del bancone
  tableR: 1.15,
  grab: 1.45, // dal centro del piedistallo
  groundGrab: 1.2, // pizza per terra
  deliver: 2.25, // dal centro del tavolo
  carry: 0.85, // chi porta va più piano
  points: 3,
  bonus: 2, // pizza ancora calda: consegnata entro 8 s da quando è stata presa dal bancone (le zuffe la raffreddano)
  bonusMs: 8000,
  groundMs: 10_000, // per terra da 10 s: torna al forno
  flight: 500, // la pizza che vola via dopo lo schiaffo
};

// tre piedistalli intorno al forno, sei tavoli ai bordi, tre vasi di limoni in mezzo alla sala
export const PIZ_SLOTS = [30, 150, 270].map((a) => ring(3.9, a));
export const PIZ_TABLES = [0, 60, 120, 180, 240, 300].map((a, i) => ({
  ...ring(10.4, a),
  n: i + 1,
  color: ['#e63946', '#fb8500', '#ffd60a', '#06d6a0', '#3a86ff', '#9d4edd'][i],
  name: ['ROSSO', 'ARANCIONE', 'GIALLO', 'VERDE', 'BLU', 'VIOLA'][i],
}));
export const PIZ_POTS = [90, 210, 330].map((a) => ring(7, a));

// tutto quello contro cui si sbatte (forno, piedistalli, tavoli, vasi)
export const PIZ_OBST: PizCircle[] = [
  { x: 0, z: 0, r: PIZ.ovenR },
  ...PIZ_SLOTS.map((s) => ({ ...s, r: PIZ.slotR })),
  ...PIZ_TABLES.map((t) => ({ x: t.x, z: t.z, r: PIZ.tableR })),
  ...PIZ_POTS.map((p) => ({ ...p, r: 0.85 })),
];

registerMini({
  kind: 'PIZZE',
  name: 'Pizza express',
  tag: 'Consegne lampo',
  rules:
    'Dal forno escono le pizze: prendila toccandola e portala al tavolo del suo colore (si illumina). Consegna 3 punti, +2 se è ancora calda (entro 8 secondi da quando è uscita dal forno). Chi porta va più piano: con uno SCHIAFFO gli fai cadere la pizza e chiunque la può prendere!',
  seconds: 75,
  clamp: (p) => {
    const r = PHYS.radius;
    const m = PIZ.half - r;
    if (p.x > m) p.x = m;
    else if (p.x < -m) p.x = -m;
    if (p.z > m) p.z = m;
    else if (p.z < -m) p.z = -m;
    for (let i = 0; i < PIZ_OBST.length; i++) {
      const o = PIZ_OBST[i];
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const min = o.r + r;
      if (Math.abs(dx) >= min || Math.abs(dz) >= min) continue;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.0001) {
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    }
  },
});
