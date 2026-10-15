// ⚽🚗 Axend Turbo — controlli di base dei bot: guida verso un punto, orientamento in aria (regolatore PD sulle
// accelerazioni angolari misurate dell'aria), atterraggio sulle ruote e i profili del salto (misurati con la fisica vera).
import { arenaDist, arenaNormal } from '../arena';
import { Car, noControls, type Controls } from '../car';
import { BALL, CAR, DT } from '../consts';
import { Quat, V3, clamp } from '../math';

const sF = new V3();
const sU = new V3();
const sL = new V3();
const sT = new V3();
const sW = new V3();
const sA = new V3();
const qT = new Quat();
const qE = new Quat();
const qC = new Quat();

// ---------------------------------------------------------------- profili del salto
// z dell'origine e velocità verticale, passo per passo, dopo aver premuto salto da fermi sul pavimento:
// 1 = salto tenuto 0,2 s; 2 = salto tenuto 0,2 s + doppio salto al passo 26
export interface JumpProfile {
  z1: Float64Array;
  v1: Float64Array;
  z2: Float64Array;
  v2: Float64Array;
  max1: number;
  max2: number;
  top1: number; // passo dell'apice
  top2: number;
}
export const PROFILE_N = 241;
export const DOUBLE_TICK = 26;
let profile: JumpProfile | null = null;

function stepCar(c: Car) {
  c.preTick(DT, null, BALL.radius);
  c.vel.addScaled(c.acc, DT);
  c.angVel.addScaled(c.angAcc, DT);
  c.pos.addScaled(c.vel, DT);
  c.rot.integrate(c.angVel, DT);
  c.collideArena(DT);
  c.postTick(DT);
}

function simulateJump(dbl: boolean) {
  const c = new Car('_profilo', 0, true);
  c.place(0, 0, CAR.restZ, 0);
  const ctl = noControls();
  c.controls = ctl;
  for (let i = 0; i < 60; i++) stepCar(c);
  const z = new Float64Array(PROFILE_N);
  const v = new Float64Array(PROFILE_N);
  for (let k = 0; k < PROFILE_N; k++) {
    z[k] = c.pos.z;
    v[k] = c.vel.z;
    ctl.jump = k < 24 || (dbl && k === DOUBLE_TICK);
    stepCar(c);
  }
  return { z, v };
}

export function jumpProfile(): JumpProfile {
  if (profile) return profile;
  const a = simulateJump(false);
  const b = simulateJump(true);
  let max1 = 0;
  let max2 = 0;
  let top1 = 0;
  let top2 = 0;
  for (let k = 0; k < PROFILE_N; k++) {
    if (a.z[k] > max1) (max1 = a.z[k]), (top1 = k);
    if (b.z[k] > max2) (max2 = b.z[k]), (top2 = k);
  }
  profile = { z1: a.z, v1: a.v, z2: b.z, v2: b.v, max1, max2, top1, top2 };
  return profile;
}

// passi per far arrivare l'origine all'altezza h salendo (−1 se non ci arriva)
export function riseTicks(z: Float64Array, top: number, h: number): number {
  for (let k = 0; k <= top; k++) if (z[k] >= h) return k;
  return -1;
}

// ---------------------------------------------------------------- utilità
export function localOf(car: Car, x: number, y: number, z: number, out: V3) {
  out.set(x - car.pos.x, y - car.pos.y, z - car.pos.z);
  return car.rot.unrotate(out, out);
}

export function quatFromBasis(f: V3, l: V3, u: V3, out: Quat) {
  const m00 = f.x;
  const m10 = f.y;
  const m20 = f.z;
  const m01 = l.x;
  const m11 = l.y;
  const m21 = l.z;
  const m02 = u.x;
  const m12 = u.y;
  const m22 = u.z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    out.set((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s);
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    out.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    out.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    out.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
  }
  return out;
}

// ---------------------------------------------------------------- orientamento in aria
// Errore di rotazione (nel sistema della macchina) → velocità angolare voluta (la massima da cui ci si ferma in tempo)
// → accelerazione angolare → comandi, invertendo il modello dell'aria: roll: α = T·u − D·ω; pitch/yaw: α = −T·u − D·(1−|u|)·ω.
const AX_T = [CAR.airTorqueRoll, CAR.airTorquePitch, CAR.airTorqueYaw];
const AX_D = [CAR.airDampRoll, CAR.airDampPitch, CAR.airDampYaw];
const KV = 14; // quanto in fretta si insegue la velocità angolare voluta
const KLIN = 4.2; // vicino all'obiettivo: velocità voluta proporzionale all'errore

function axisCmd(i: number, e: number, w: number) {
  const T = AX_T[i];
  const a = T * 0.62;
  const ae = Math.abs(e);
  let wd = Math.min(Math.sqrt(2 * a * ae), KLIN * ae, CAR.maxAngSpeed);
  if (e < 0) wd = -wd;
  const alpha = (wd - w) * KV;
  const u = (alpha + AX_D[i] * w) / T;
  return clamp(i === 0 ? u : -u, -1, 1);
}

// gira la macchina perché il muso guardi `f` e il tetto stia verso `u` (proiettato). Scrive pitch/yaw/roll in out.
// Restituisce l'angolo che manca (radianti).
export function orient(car: Car, f: V3, u: V3, out: Controls): number {
  sF.copy(f).normalize();
  sU.copy(u).addScaled(sF, -u.dot(sF));
  if (sU.len2() < 1e-4) {
    car.up(sU);
    sU.addScaled(sF, -sU.dot(sF));
    if (sU.len2() < 1e-4) sU.set(0, 0, 1).addScaled(sF, -sF.z);
    if (sU.len2() < 1e-4) sU.set(1, 0, 0);
  }
  sU.normalize();
  sL.crossOf(sU, sF);
  quatFromBasis(sF, sL, sU, qT);
  const q = car.rot;
  qC.set(-q.x, -q.y, -q.z, q.w);
  qE.mulOf(qC, qT);
  if (qE.w < 0) qE.set(-qE.x, -qE.y, -qE.z, -qE.w);
  const sinHalf = Math.sqrt(qE.x * qE.x + qE.y * qE.y + qE.z * qE.z);
  const ang = 2 * Math.atan2(sinHalf, qE.w);
  const k = sinHalf > 1e-7 ? ang / sinHalf : 2;
  car.rot.unrotate(car.angVel, sW);
  out.roll = axisCmd(0, qE.x * k, sW.x);
  out.pitch = axisCmd(1, qE.y * k, sW.y);
  out.yaw = axisCmd(2, qE.z * k, sW.z);
  return ang;
}

// muso verso f, senza preoccuparsi del rollio (tiene il tetto più vicino a quello attuale, o al cielo se `level`)
export function aimNose(car: Car, f: V3, out: Controls, level = false): number {
  if (level) sA.set(0, 0, 1);
  else car.up(sA);
  return orient(car, f, sA, out);
}

// ---------------------------------------------------------------- guida a terra
// sterza e accelera verso (tx, ty, tz) cercando di andare a velocità vDes. Restituisce l'angolo (rad, + = a sinistra).
export function driveTo(car: Car, out: Controls, tx: number, ty: number, tz: number, vDes: number, boostOk: boolean, reverseOk = false): number {
  const l = localOf(car, tx, ty, tz, sT);
  const ang = Math.atan2(l.y, l.x);
  const dist = Math.hypot(l.x, l.y);
  const f = car.forward(sF);
  const fwdSpeed = car.vel.dot(f);
  car.rot.unrotate(car.angVel, sW);
  const absAng = Math.abs(ang);
  // retromarcia: bersaglio vicino e dietro, quasi fermi
  if (reverseOk && absAng > 2.0 && dist < 1600 && fwdSpeed < 350) {
    const angB = Math.atan2(l.y, -l.x);
    out.steer = clamp(-3 * angB, -1, 1);
    const vb = -fwdSpeed;
    const err = Math.min(vDes, 1300) - vb;
    out.throttle = err > 50 ? -1 : err > -150 ? -0.02 : err > -400 ? 0 : 1;
    out.handbrake = false;
    out.boost = false;
    return ang;
  }
  out.steer = clamp(-3.4 * ang + 0.1 * sW.z, -1, 1);
  const upZ = car.up(sU).z;
  out.handbrake = absAng > 1.75 && fwdSpeed > 650 && car.onGround && upZ > 0.85;
  const err = vDes - fwdSpeed;
  if (err > 0) {
    out.throttle = err > 40 ? 1 : 0.25;
    out.boost = boostOk && err > 220 && absAng < 0.3 && car.onGround && fwdSpeed < 2270 && car.boost > 0;
  } else if (err > -120) out.throttle = 0.02;
  else if (err > -450) out.throttle = 0;
  else out.throttle = -1;
  if (car.isBoosting && err > 0 && absAng < 0.5 && car.onGround) out.boost = boostOk && car.boost > 0;
  return ang;
}

// ---------------------------------------------------------------- in aria: atterrare sulle ruote
export interface LandMem {
  landTick: number;
  lnx: number;
  lny: number;
  lnz: number;
}

// normale della superficie dove atterrerà la macchina (ricalcolata ogni pochi passi)
export function landingNormal(car: Car, tick: number, mem: LandMem, out: V3): V3 {
  if (tick >= mem.landTick || tick < mem.landTick - 20) {
    const p = car.pos;
    const v = car.vel;
    let nx = 0;
    let ny = 0;
    let nz = 1;
    for (let i = 1; i <= 40; i++) {
      const t = i * 0.05;
      const x = p.x + v.x * t;
      const y = p.y + v.y * t;
      const z = p.z + v.z * t - 325 * t * t;
      if (arenaDist(x, y, z) < 60) {
        arenaNormal(x, y, z, sA);
        nx = sA.x;
        ny = sA.y;
        nz = sA.z;
        break;
      }
    }
    mem.lnx = nx;
    mem.lny = ny;
    mem.lnz = nz;
    mem.landTick = tick + 6;
  }
  return out.set(mem.lnx, mem.lny, mem.lnz);
}

const sN = new V3();
const sH = new V3();
// in aria: ruote verso la superficie dove si atterra, muso nella direzione del moto (o verso `hx, hy` se dato)
export function airRecover(car: Car, out: Controls, tick: number, mem: LandMem, hx?: number, hy?: number): number {
  const n = landingNormal(car, tick, mem, sN);
  if (hx !== undefined && hy !== undefined) sH.set(hx, hy, 0);
  else sH.copy(car.vel);
  sH.addScaled(n, -sH.dot(n));
  if (sH.len2() < 200 * 200) {
    car.forward(sH);
    sH.addScaled(n, -sH.dot(n));
  }
  if (sH.len2() < 1e-4) sH.set(1, 0, 0);
  out.throttle = 1;
  return orient(car, sH, n, out);
}

// comandi della schivata: direzione nel sistema della macchina (avanti, destra)
export function dodgeStick(out: Controls, fwd: number, right: number) {
  const m = Math.max(Math.abs(fwd), Math.abs(right), 1e-6);
  out.pitch = -fwd / m;
  out.yaw = right / m;
  out.roll = 0;
  if (Math.abs(out.pitch) < 0.12) out.pitch = 0;
  if (Math.abs(out.yaw) < 0.12) out.yaw = 0;
}
