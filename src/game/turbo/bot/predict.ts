// ⚽🚗 Axend Turbo — previsione della palla per i bot: la palla simulata con la stessa fisica (Ball + campo) fino a 5 s.
// Una sola previsione per mondo, condivisa da tutti i bot: si rifà solo quando la palla esce dalla traiettoria prevista
// (qualcuno l'ha toccata, calcio d'inizio) o per allungare l'orizzonte ogni mezzo secondo.
import { goalScored } from '../arena';
import { Ball } from '../ball';
import { BALL, DT, TICK_RATE } from '../consts';
import type { World } from '../world';

export const PRED_SECONDS = 5;
export const PRED_N = PRED_SECONDS * TICK_RATE + 1;

export class BallPrediction {
  tick = -1; // world.tick della fetta 0
  n = 0; // fette valide (meno di PRED_N se la palla entra in porta prima)
  d = new Float64Array(PRED_N * 6); // per fetta: x, y, z, vx, vy, vz (fetta i = dopo i passi da `tick`)
  goal: 0 | 1 | -1 = 0; // +1 = finisce nella porta arancione (y+), −1 = nella porta blu (y−)
  changedTick = -100000; // ultimo passo in cui la palla ha cambiato strada (tocco, calcio d'inizio)
  checkedTick = -1;
  computes = 0;
}

const sim = new Ball();
const cache = new WeakMap<World, BallPrediction>();

// la previsione aggiornata per questo passo del mondo (costa quasi zero se la palla segue la strada prevista)
export function ballPrediction(world: World): BallPrediction {
  let p = cache.get(world);
  if (!p) {
    p = new BallPrediction();
    cache.set(world, p);
  }
  if (p.checkedTick === world.tick && p.n > 0) return p;
  p.checkedTick = world.tick;
  const b = world.ball;
  const off = world.tick - p.tick;
  let redo = true;
  if (p.n > 0 && off >= 0 && off < p.n) {
    const k = off * 6;
    const d = p.d;
    const err =
      Math.abs(b.pos.x - d[k]) + Math.abs(b.pos.y - d[k + 1]) + Math.abs(b.pos.z - d[k + 2]) + Math.abs(b.vel.x - d[k + 3]) + Math.abs(b.vel.y - d[k + 4]) + Math.abs(b.vel.z - d[k + 5]);
    if (err > 0.01) p.changedTick = world.tick;
    else redo = off > 60 && p.n === PRED_N;
  } else p.changedTick = world.tick;
  if (redo) compute(world, p);
  return p;
}

function compute(world: World, p: BallPrediction) {
  const b = world.ball;
  const d = p.d;
  p.tick = world.tick;
  p.goal = 0;
  p.computes++;
  sim.pos.copy(b.pos);
  sim.vel.copy(b.vel);
  sim.angVel.copy(b.angVel);
  d[0] = b.pos.x;
  d[1] = b.pos.y;
  d[2] = b.pos.z;
  d[3] = b.vel.x;
  d[4] = b.vel.y;
  d[5] = b.vel.z;
  if (world.phase !== 'play') {
    // palla ferma (conto alla rovescia, festa del gol)
    for (let i = 1; i < PRED_N; i++) for (let j = 0; j < 6; j++) d[i * 6 + j] = d[j];
    p.n = PRED_N;
    return;
  }
  for (let i = 1; i < PRED_N; i++) {
    sim.step(DT);
    const k = i * 6;
    d[k] = sim.pos.x;
    d[k + 1] = sim.pos.y;
    d[k + 2] = sim.pos.z;
    d[k + 3] = sim.vel.x;
    d[k + 4] = sim.vel.y;
    d[k + 5] = sim.vel.z;
    const g = goalScored(sim.pos.y, BALL.radius);
    if (g) {
      p.goal = g;
      p.n = i + 1;
      return;
    }
  }
  p.n = PRED_N;
}
