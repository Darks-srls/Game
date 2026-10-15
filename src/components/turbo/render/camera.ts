// ⚽🚗 Axend Turbo — la telecamera come Rocket League.
// "Macchina": dietro la macchina a distanza/altezza/angolo delle impostazioni, gira con la macchina anche sui muri.
// "Palla" (ball cam): un braccio che parte dalla macchina e punta la palla → la macchina resta sempre in basso al centro.
// Sguardo libero (look) che ruota il braccio attorno alla macchina, morbidezza (stiffness), FOV orizzontale come in RL
// adattato agli schermi verticali, scossoni (gol, demolizioni), mai dentro i muri (si avvicina se un muro sta in mezzo).
// I conti si fanno nelle unità della fisica (uu, z in alto), poi si converte per three.
import * as THREE from 'three';
import { arenaDist } from '../../../game/turbo/arena';
import type { Car } from '../../../game/turbo/car';
import type { World } from '../../../game/turbo/world';
import type { CamSettings } from '../contract';
import { S } from './coords';

const UP = new THREE.Vector3(0, 0, 1);
const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

// temporanei (niente allocazioni per fotogramma)
const P = new THREE.Vector3();
const carF = new THREE.Vector3();
const carU = new THREE.Vector3();
const tgt = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const F = new THREE.Vector3();
const U = new THREE.Vector3();
const Rt = new THREE.Vector3();
const C = new THREE.Vector3();
const O = new THREE.Vector3();
const Fc = new THREE.Vector3();
const Uc = new THREE.Vector3();
const qU = new THREE.Quaternion();
const m = new THREE.Matrix4();
const r3 = new THREE.Vector3();
const u3 = new THREE.Vector3();
const b3 = new THREE.Vector3();

// FOV verticale dal FOV orizzontale di Rocket League (pensato per 16:9)
export function verticalFov(hfovDeg: number, aspect: number) {
  const tanH = Math.tan((hfovDeg * DEG) / 2);
  let tanV: number;
  if (aspect >= 16 / 9) tanV = tanH * (9 / 16); // più largo di 16:9: si vede di più ai lati
  else if (aspect >= 1) tanV = tanH / aspect; // 4:3 ecc.: stesso FOV orizzontale
  else tanV = tanH * (1 + (1 - aspect) * 0.3); // verticale: un po' più alto, ma senza effetto "occhio di pesce"
  tanV = Math.min(tanV, Math.tan(50 * DEG));
  return (2 * Math.atan(tanV)) / DEG;
}

export class CameraRig {
  readonly cam: THREE.PerspectiveCamera;
  private aspect = 16 / 9;
  private fwd = new THREE.Vector3(0, 1, 0); // direzione del braccio (uu)
  private up = new THREE.Vector3(0, 0, 1);
  private yaw = 0; // sguardo libero
  private pitch = 0;
  private reach = 1; // quanto del braccio è libero (muri in mezzo)
  private trauma = 0;
  private fovKick = 0;
  private mode: 'follow' | 'spec' | 'orbit' | '' = '';
  private lastCar = new THREE.Vector3(1e9, 0, 0);
  private spec = new THREE.Vector3(0, -3500, 1400);
  private specLook = new THREE.Vector3();
  private pos = new THREE.Vector3(); // posizione finale (uu)
  private lastFov = 0;
  private lastAspect = 0;
  private shakeT = 0;

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }
  setAspect(a: number) {
    this.aspect = Math.max(0.2, a);
  }
  // scossone (0…1): si somma e svanisce da solo
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  // posizione della telecamera in uu (per suoni e distanze)
  get posUU() {
    return this.pos;
  }

  update(world: World, me: Car | undefined, myOff: { x: number; y: number; z: number } | undefined, ball: THREE.Vector3, cam: CamSettings, look: { x: number; y: number }, t: number, dt: number) {
    const phase = world.phase;
    let mode: 'follow' | 'spec' | 'orbit';
    if (phase === 'end') mode = 'orbit';
    else if (!me || me.demoed) mode = 'spec';
    else mode = 'follow';
    const snap = mode !== this.mode;
    this.mode = mode;

    let fovBoost = 0;
    if (mode === 'follow' && me) {
      P.set(me.pos.x + (myOff?.x ?? 0), me.pos.y + (myOff?.y ?? 0), me.pos.z + (myOff?.z ?? 0));
      // calcio d'inizio, ricomparsa: si salta subito dietro la macchina
      const jump = this.lastCar.distanceToSquared(P) > 500 * 500;
      this.lastCar.copy(P);
      const now = snap || jump;
      qU.set(me.rot.x, me.rot.y, me.rot.z, me.rot.w);
      carF.set(1, 0, 0).applyQuaternion(qU);
      carU.set(0, 0, 1).applyQuaternion(qU);
      const stiff = clamp(cam.stiffness, 0, 1);

      // "su" del braccio: quello della macchina quando è appoggiata (muri compresi), altrimenti quello del mondo
      tgt.copy(me.onGround ? carU : UP);
      if (now) this.up.copy(tgt);
      else this.up.lerp(tgt, ease(4 + 6 * stiff, dt)).normalize();
      const up = this.up;

      // dove punta il braccio
      const ballMode = cam.ballCam && phase !== 'countdown';
      // avanti della macchina sul piano del braccio
      tmp.copy(carF).addScaledVector(up, -carF.dot(up));
      const carFlat = tmp.lengthSq() > 0.04 ? tmp.normalize() : null;
      if (ballMode) {
        tgt.subVectors(ball, P);
        const dist = tgt.length();
        const vert = tgt.dot(up);
        tmp2.copy(tgt).addScaledVector(up, -vert);
        let hl = tmp2.length();
        if (hl < 1) {
          tmp2.copy(carFlat ?? this.fwd);
          hl = 0;
        } else tmp2.multiplyScalar(1 / hl);
        // palla quasi sopra la macchina: la direzione orizzontale va verso l'avanti della macchina (niente giravolte)
        if (carFlat && hl < 260) tmp2.lerp(carFlat, clamp((260 - hl) / 200, 0, 1)).normalize();
        const elev = clamp(Math.atan2(vert - 40, Math.max(hl, 1)), -0.32, 0.62) * clamp(dist / 400, 0.3, 1);
        tgt.copy(tmp2).multiplyScalar(Math.cos(elev)).addScaledVector(up, Math.sin(elev));
      } else if (carFlat) tgt.copy(carFlat);
      else {
        // muso dritto in su o in giù: si segue la velocità, o si resta come prima
        tmp.set(me.vel.x, me.vel.y, me.vel.z);
        tmp.addScaledVector(up, -tmp.dot(up));
        tgt.copy(tmp.lengthSq() > 300 * 300 ? tmp.normalize() : this.fwd);
      }
      if (now) this.fwd.copy(tgt);
      else this.turnToward(this.fwd, tgt, up, ease(ballMode ? 7 + 9 * stiff : 4 + 10 * stiff, dt));
      // il braccio resta perpendicolare al "su" quando non si guarda la palla
      if (!ballMode) this.fwd.addScaledVector(up, -this.fwd.dot(up)).normalize();

      // sguardo libero (x = 1 → si guarda dietro passando da destra)
      const sw = Math.max(1, cam.swivel) * 1.6;
      this.yaw += (-clamp(look.x, -1, 1) * Math.PI - this.yaw) * ease(sw, dt);
      this.pitch += (clamp(look.y, -1, 1) * 0.85 - this.pitch) * ease(sw, dt);
      F.copy(this.fwd).applyAxisAngle(up, this.yaw);
      Rt.crossVectors(F, up);
      if (Rt.lengthSq() < 1e-6) Rt.set(1, 0, 0);
      Rt.normalize();
      U.crossVectors(Rt, F).normalize();
      if (Math.abs(this.pitch) > 1e-4) {
        F.applyAxisAngle(Rt, this.pitch);
        U.applyAxisAngle(Rt, this.pitch);
      }

      // morbidezza: con poca rigidità la telecamera resta un po' indietro quando si accelera
      const lag = (1 - stiff) * 0.022;
      tmp.set(me.vel.x, me.vel.y, me.vel.z).multiplyScalar(lag).clampLength(0, 70);
      O.copy(P).sub(tmp);
      C.copy(O).addScaledVector(F, -cam.distance).addScaledVector(U, cam.height);
      // mai dentro i muri: dal perno (sopra la macchina) verso la telecamera, ci si ferma prima della parete
      tmp2.copy(P).addScaledVector(U, Math.min(cam.height, 60));
      const want = this.march(tmp2, C, 26);
      if (now || want < this.reach) this.reach = want;
      else this.reach += (want - this.reach) * ease(3.5, dt);
      C.lerpVectors(tmp2, C, this.reach);

      // inclinazione (angle) attorno all'asse destro
      const a = clamp(cam.angle, -30, 10) * DEG;
      Fc.copy(F).multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a));
      Uc.copy(U).multiplyScalar(Math.cos(a)).addScaledVector(F, -Math.sin(a));
      fovBoost = me.isSupersonic ? 1 : me.isBoosting ? 0.55 : 0;
    } else if (mode === 'spec') {
      // senza macchina: si segue la palla dall'alto, dal lato della mia squadra
      const side = me?.team === 1 ? 1 : -1;
      tgt.set(clamp(ball.x * 0.85, -3300, 3300), clamp(ball.y + side * 2100, -4600, 4600), clamp(ball.z + 1250, 500, 1850));
      if (snap) {
        this.spec.copy(tgt);
        this.specLook.copy(ball);
      }
      this.spec.lerp(tgt, ease(2.2, dt));
      this.specLook.lerp(ball, ease(6, dt));
      const r = this.march(this.specLook, this.spec, 60);
      C.lerpVectors(this.specLook, this.spec, r);
      this.lookAt(C, this.specLook);
    } else {
      // fine partita: giro lento sopra il campo
      const a = t * 0.12;
      C.set(Math.cos(a) * 3200, Math.sin(a) * 4200, 1500);
      tmp.set(0, 0, 250);
      this.lookAt(C, tmp);
    }

    // scossone
    this.trauma = Math.max(0, this.trauma - dt * 1.3);
    this.shakeT += dt;
    if (this.trauma > 0) {
      const k = this.trauma * this.trauma;
      const st = this.shakeT * 28;
      tmp.set(Math.sin(st * 1.1) + Math.sin(st * 2.3) * 0.5, Math.sin(st * 1.7 + 1) + Math.sin(st * 2.9) * 0.5, Math.sin(st * 1.3 + 2) + Math.sin(st * 3.1) * 0.5);
      C.addScaledVector(tmp, 22 * k);
      tmp2.crossVectors(Fc, Uc).normalize();
      Fc.addScaledVector(tmp2, Math.sin(st * 1.9) * 0.025 * k).addScaledVector(Uc, Math.sin(st * 2.4) * 0.02 * k).normalize();
    }
    // sicurezza: mai a meno di 22 uu da una parete (anche con lo scossone)
    const d0 = arenaDist(C.x, C.y, C.z);
    if (d0 < 22) {
      tmp.set(arenaDist(C.x + 1, C.y, C.z) - arenaDist(C.x - 1, C.y, C.z), arenaDist(C.x, C.y + 1, C.z) - arenaDist(C.x, C.y - 1, C.z), arenaDist(C.x, C.y, C.z + 1) - arenaDist(C.x, C.y, C.z - 1));
      if (tmp.lengthSq() > 1e-8) C.addScaledVector(tmp.normalize(), 22 - d0);
    }
    this.pos.copy(C);

    // → three
    this.cam.position.set(C.x * S, C.z * S, -C.y * S);
    Rt.crossVectors(Fc, Uc).normalize();
    Uc.crossVectors(Rt, Fc).normalize();
    r3.set(Rt.x, Rt.z, -Rt.y);
    u3.set(Uc.x, Uc.z, -Uc.y);
    b3.set(-Fc.x, -Fc.z, Fc.y);
    m.makeBasis(r3, u3, b3);
    this.cam.quaternion.setFromRotationMatrix(m);

    // FOV (con un piccolo allargamento col boost)
    this.fovKick += (fovBoost - this.fovKick) * ease(3, dt);
    const fov = verticalFov(clamp(cam.fov, 60, 120) + this.fovKick * 4, this.aspect);
    if (Math.abs(fov - this.lastFov) > 0.01 || this.aspect !== this.lastAspect) {
      this.lastFov = fov;
      this.lastAspect = this.aspect;
      this.cam.fov = fov;
      this.cam.aspect = this.aspect;
      this.cam.updateProjectionMatrix();
    }
  }

  // gira v verso target attorno agli assi giusti, di una frazione k dell'angolo (niente passaggi per lo zero)
  private turnToward(v: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3, k: number) {
    const d = clamp(v.dot(target), -1, 1);
    const ang = Math.acos(d);
    if (ang < 1e-5) {
      v.copy(target);
      return;
    }
    tmp.crossVectors(v, target);
    if (tmp.lengthSq() < 1e-10) tmp.copy(up);
    tmp.normalize();
    v.applyAxisAngle(tmp, ang * k).normalize();
  }

  private lookAt(from: THREE.Vector3, to: THREE.Vector3) {
    Fc.subVectors(to, from);
    if (Fc.lengthSq() < 1) Fc.set(0, 1, 0);
    Fc.normalize();
    Rt.crossVectors(Fc, UP);
    if (Rt.lengthSq() < 1e-6) Rt.set(1, 0, 0);
    Rt.normalize();
    Uc.crossVectors(Rt, Fc).normalize();
  }

  // frazione libera del segmento a→b prima di arrivare a "margin" da una parete (campo di distanza)
  private march(a: THREE.Vector3, b: THREE.Vector3, margin: number) {
    tmp.subVectors(b, a);
    const len = tmp.length();
    if (len < 1) return 1;
    tmp.multiplyScalar(1 / len);
    let t = 0;
    for (let i = 0; i < 40; i++) {
      const d = arenaDist(a.x + tmp.x * t, a.y + tmp.y * t, a.z + tmp.z * t) - margin;
      if (d < 0.5) break;
      t += d;
      if (t >= len) return 1;
    }
    return clamp(t / len, 0, 1);
  }
}
