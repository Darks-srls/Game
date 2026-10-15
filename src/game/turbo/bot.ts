// ⚽🚗 Axend Turbo — i bot (riempiono le squadre), l'ASSISTITO (il bot guida la macchina del giocatore per 5 secondi)
// e l'orientamento automatico in aria per il telefono. Il cervello è in ./bot/ (previsione, controlli, decisioni).
//
//   const mem = newBotMemory();                       // una per macchina
//   inputs(id) → botControls(world, car, mem, 0.7)    // ogni passo (120/s) sul server, bravura 0…1
//   assistControls(world, car, mem)                   // durante l'assistito (bot al massimo)
//   airAssist(world, car, controls)                   // telefono: in aria, se non si ruota, gira da solo la macchina
import { type Car, type Controls } from './car';
import { CAR } from './consts';
import { V3 } from './math';
import type { World } from './world';
import { aimNose, airRecover, orient, type LandMem } from './bot/control';
import { botStep, newBotMemory, type BotMemory } from './bot/brain';
import { ballPrediction } from './bot/predict';

export { newBotMemory, ballPrediction };
export type { BotMemory };

// comandi di un bot (bravura 0 = scarso … 1 = fortissimo)
export function botControls(world: World, car: Car, mem: BotMemory, skill: number): Controls {
  mem.assist = false;
  return botStep(world, car, mem, skill);
}

// l'assistito: il bot al massimo livello per la macchina del giocatore (parate, passaggi, tiri al volo, muri, flip reset)
export function assistControls(world: World, car: Car, mem: BotMemory): Controls {
  mem.assist = true;
  return botStep(world, car, mem, 1);
}

// ---------------------------------------------------------------- orientamento automatico in aria (telefono)
const lands = new WeakMap<Car, LandMem>();
const sV = new V3();
const sB = new V3();
const sF = new V3();
const sU = new V3();

// In aria, se il giocatore non sta ruotando: muso verso la palla se ci si sta andando, altrimenti ruote verso dove si
// atterra. Salto, boost e acceleratore restano del giocatore (e quando preme salto lo stick resta fermo: doppio salto).
export function airAssist(world: World, car: Car, c: Controls): Controls {
  const out: Controls = { ...c };
  if (car.demoed || car.onGround || car.numWheels > 0 || world.phase !== 'play') return out;
  if (Math.abs(c.pitch) > 0.08 || Math.abs(c.yaw) > 0.08 || Math.abs(c.roll) > 0.08) return out;
  if (car.isAutoFlipping || (car.hasFlipped && car.flipTime < CAR.flipTorqueTime + CAR.flipPitchlockExtra)) return out;
  if (c.jump && !car.lastJump) return out; // pressione di salto: niente stick (doppio salto, non flip)
  if (car.isJumping && car.jumpTime < 0.05) return out; // appena staccati da terra
  let land = lands.get(car);
  if (!land) {
    land = { landTick: 0, lnx: 0, lny: 0, lnz: 1 };
    lands.set(car, land);
  }
  const b = world.ball;
  sB.subOf(b.pos, car.pos);
  const dist = sB.len();
  const speed = car.vel.len();
  // ci si sta andando verso la palla?
  let toward = false;
  if (dist < 3200) {
    const vDot = speed > 300 ? car.vel.dot(sB) / (speed * dist) : 0;
    const fDot = car.forward(sF).dot(sB) / dist;
    toward = vDot > 0.8 || (c.boost && fDot > 0.55 && vDot > 0.3) || (dist < 700 && fDot > 0.3);
    if (b.pos.z < 200 && car.pos.z < 300 && !c.boost) toward = false; // palla a terra: prima si atterra
  }
  if (toward) {
    const p = ballPrediction(world);
    const off = world.tick - p.tick;
    let found = false;
    if (c.boost && car.boost > 0) {
      // col boost tenuto: il primo istante in cui la palla è raggiungibile spingendo sempre nella stessa direzione,
      // e il muso in quella direzione (come un aerial)
      for (let j = off + 6; j < p.n; j += 3) {
        const T = (j - off) / 120;
        const k = j * 6;
        sV.set(p.d[k] - (car.pos.x + car.vel.x * T), p.d[k + 1] - (car.pos.y + car.vel.y * T), p.d[k + 2] - (car.pos.z + car.vel.z * T - 325 * T * T));
        if (sV.len() <= 0.5 * CAR.boostAccelAir * T * T * 0.92) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      // senza boost: il muso verso dove sarà la palla quando ci arriveremo
      const T = Math.min(4, dist / Math.max(speed, 900));
      const k = Math.min(p.n - 1, Math.max(0, off + Math.round(T * 120))) * 6;
      sV.set(p.d[k] - car.pos.x, p.d[k + 1] - car.pos.y, p.d[k + 2] - car.pos.z);
    }
    aimNose(car, sV, out, false);
    // il rollio lo lasciamo calmo (nessuna rotazione inutile)
    out.roll *= 0.5;
    return out;
  }
  if (c.boost) {
    // si vola: il muso resta dov'è, si mette solo dritta la macchina (ruote in giù)
    car.forward(sF);
    sU.set(0, 0, 1);
    orient(car, sF, sU, out);
    out.pitch = 0;
    out.yaw = 0;
    return out;
  }
  const thr = out.throttle;
  airRecover(car, out, world.tick, land);
  out.throttle = thr;
  return out;
}
