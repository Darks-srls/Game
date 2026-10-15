// ⚽🚗 Axend Turbo — la macchina (Octane), fisica come Rocket League / RocketSim:
// quattro ruote a "raggio" con sospensioni (toccano campo e palla: così il flip reset viene da solo), attrito laterale
// che dipende dallo slittamento, freno a mano, sterzo dalle curve di velocità, aderenza ai muri, salto/doppio salto,
// flip con le sue regole (annullamento, blocco del beccheggio, smorzamento in verticale), controllo in aria, boost.
import { arenaDist, arenaNormal, arenaRay } from './arena';
import {
  CAR,
  DRIVE_SPEED_TORQUE_FACTOR,
  GRAVITY,
  HANDBRAKE_LAT_FACTOR,
  HANDBRAKE_LONG_FACTOR,
  LAT_FRICTION,
  LAT_FRICTION_K,
  NON_STICKY_FRICTION,
  POWERSLIDE_STEER_FROM_SPEED,
  ROLLING_K,
  STEER_ANGLE_FROM_SPEED,
} from './consts';
import { Quat, V3, clamp, curve, sgn } from './math';

export interface Controls {
  throttle: number; // -1..1
  steer: number; // -1..1 (+ = destra)
  pitch: number; // -1..1 (+ = muso su)
  yaw: number; // -1..1 (+ = destra)
  roll: number; // -1..1 (+ = rollio a destra)
  jump: boolean;
  boost: boolean;
  handbrake: boolean;
}
export const noControls = (): Controls => ({ throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false });

export interface Wheel {
  contact: boolean;
  world: boolean; // il contatto è col campo (non con la palla)
  point: V3;
  normal: V3;
  susp: number; // lunghezza della sospensione (per disegnare la ruota)
  steer: number; // angolo di sterzo (rad, + = sinistra)
  spin: number; // rotazione della ruota (solo grafica)
}

// inerzia della scatola (massa 180, misure della hitbox)
const [HX, HY, HZ] = CAR.hitboxSize;
const INV_I = new V3(12 / (CAR.mass * (HY * HY + HZ * HZ)), 12 / (CAR.mass * (HX * HX + HZ * HZ)), 12 / (CAR.mass * (HX * HX + HY * HY)));
// altezza del punto d'attacco delle ruote sopra l'origine, così a riposo l'origine sta a 17 uu (compressione ~1,3 uu)
const restCompression = GRAVITY / (2 * CAR.springFront + 2 * CAR.springBack);
// ruote: punto d'attacco (x, y, hz) rispetto all'origine della macchina; il centro della ruota sta a hz − susp (vedi Wheel.susp)
export const WHEEL_DEFS = CAR.wheels.map((w) => ({ ...w, hz: w.radius + w.rest - restCompression - CAR.restZ }));

const tmpA = new V3();
const tmpB = new V3();
const tmpC = new V3();
const tmpD = new V3();
const tmpE = new V3();

export interface BallLike {
  pos: V3;
  vel: V3;
  angVel: V3;
}

export class Car {
  id: string;
  team: 0 | 1;
  bot: boolean;
  pos = new V3();
  vel = new V3();
  angVel = new V3();
  rot = new Quat();
  boost = CAR.boostSpawn;
  controls: Controls = noControls();
  lastJump = false;
  wheels: Wheel[] = WHEEL_DEFS.map(() => ({ contact: false, world: false, point: new V3(), normal: new V3(0, 0, 1), susp: 0, steer: 0, spin: 0 }));
  numWheels = 0;
  onGround = false;
  worldContact = false; // almeno una ruota tocca il campo
  bodyContact = false; // la carrozzeria tocca il campo (tetto, fianco…)
  bodyNormal = new V3(0, 0, 1);
  // salto e flip
  isJumping = false;
  hasJumped = false;
  jumpTime = 0;
  hasDoubleJumped = false;
  hasFlipped = false;
  isFlipping = false;
  flipTime = 0;
  flipFwd = 0; // direzione del flip (avanti/indietro)
  flipRight = 0; // (destra/sinistra)
  airTime = 0;
  airTimeSinceJump = 0;
  isAutoFlipping = false;
  autoFlipTimer = 0;
  autoFlipScale = 0;
  // guida
  handbrakeVal = 0;
  isBoosting = false;
  boostingTime = 0;
  isSupersonic = false;
  supersonicTime = 0;
  // stato di gioco
  demoed = false;
  respawnTimer = 0;
  bumpCooldown = 0;
  bumpOther = '';
  lastExtraHitTick = -10;
  // forze accumulate nel passo (accelerazioni uu/s² e rad/s²)
  acc = new V3();
  angAcc = new V3();
  flipResetPending = false; // per gli effetti: ha appena ripreso il flip toccando la palla

  constructor(id: string, team: 0 | 1, bot = false) {
    this.id = id;
    this.team = team;
    this.bot = bot;
  }

  forward(out: V3) {
    return this.rot.rotate(tmpE.set(1, 0, 0), out);
  }
  left(out: V3) {
    return this.rot.rotate(tmpE.set(0, 1, 0), out);
  }
  up(out: V3) {
    return this.rot.rotate(tmpE.set(0, 0, 1), out);
  }

  // il centro della hitbox nel mondo
  hitboxCenter(out: V3) {
    this.rot.rotate(tmpE.set(CAR.hitboxOffset[0], CAR.hitboxOffset[1], CAR.hitboxOffset[2]), out);
    return out.add(this.pos);
  }

  // impulso (Δquantità di moto) applicato nel punto r (relativo al centro di massa)
  applyImpulse(j: V3, r: V3) {
    this.vel.addScaled(j, 1 / CAR.mass);
    // Δω = I⁻¹ (r × j), con l'inerzia nel sistema della macchina
    tmpA.crossOf(r, j);
    this.rot.unrotate(tmpA, tmpB);
    tmpB.set(tmpB.x * INV_I.x, tmpB.y * INV_I.y, tmpB.z * INV_I.z);
    this.rot.rotate(tmpB, tmpA);
    this.angVel.add(tmpA);
  }

  // massa "inversa" vista nel punto r lungo la direzione a (1/m + (r×a)·I⁻¹(r×a))
  invMassAt(r: V3, a: V3) {
    tmpA.crossOf(r, a);
    this.rot.unrotate(tmpA, tmpB);
    return 1 / CAR.mass + tmpB.x * tmpB.x * INV_I.x + tmpB.y * tmpB.y * INV_I.y + tmpB.z * tmpB.z * INV_I.z;
  }

  // velocità del punto r (relativo al centro di massa)
  velAt(r: V3, out: V3) {
    return out.crossOf(this.angVel, r).add(this.vel);
  }

  // rimette la macchina in un punto fermo, girata verso yaw
  place(x: number, y: number, z: number, yaw: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.rot = Quat.fromYaw(yaw);
    this.isJumping = this.hasJumped = this.hasDoubleJumped = this.hasFlipped = this.isFlipping = false;
    this.jumpTime = this.flipTime = this.airTime = this.airTimeSinceJump = 0;
    this.isAutoFlipping = false;
    this.handbrakeVal = 0;
    this.isBoosting = false;
    this.isSupersonic = false;
    this.supersonicTime = 0;
  }

  // ---------------------------------------------------------------- prima della fisica: ruote, comandi, forze
  preTick(dt: number, ball: BallLike | null, ballRadius: number) {
    const c = this.controls;
    const f = this.forward(new V3());
    const l = this.left(new V3());
    const u = this.up(new V3());
    this.acc.set(0, 0, -GRAVITY);
    this.angAcc.set(0, 0, 0);
    const jumpPressed = c.jump && !this.lastJump;

    // 1) le ruote: raggio verso il basso contro il campo e contro la palla
    const down = tmpD.copy(u).scale(-1);
    let n = 0;
    let worldContact = false;
    const upSum = new V3();
    for (let i = 0; i < 4; i++) {
      const wd = WHEEL_DEFS[i];
      const w = this.wheels[i];
      const hp = this.rot.rotate(tmpC.set(wd.x, wd.y, wd.hz), new V3()).add(this.pos);
      const maxLen = wd.rest + CAR.suspensionTravel + wd.radius;
      let t = arenaRay(hp, down, maxLen);
      let onBall = false;
      if (ball) {
        // raggio contro la sfera della palla
        const ox = hp.x - ball.pos.x;
        const oy = hp.y - ball.pos.y;
        const oz = hp.z - ball.pos.z;
        const b = ox * down.x + oy * down.y + oz * down.z;
        const cc = ox * ox + oy * oy + oz * oz - ballRadius * ballRadius;
        const disc = b * b - cc;
        if (disc >= 0) {
          const tb = -b - Math.sqrt(disc);
          if (tb >= 0 && tb <= maxLen && (t < 0 || tb < t)) {
            t = tb;
            onBall = true;
          }
        }
      }
      if (t >= 0) {
        w.contact = true;
        w.world = !onBall;
        w.point.copy(hp).addScaled(down, t);
        if (onBall && ball) w.normal.subOf(w.point, ball.pos).normalize();
        else arenaNormal(w.point.x, w.point.y, w.point.z, w.normal);
        w.susp = clamp(t - wd.radius, wd.rest - CAR.suspensionTravel, wd.rest + CAR.suspensionTravel);
        n++;
        upSum.add(w.normal);
        if (!onBall) worldContact = true;
      } else {
        w.contact = false;
        w.world = false;
        w.susp = wd.rest + CAR.suspensionTravel;
      }
    }
    this.numWheels = n;
    this.onGround = n >= 3;
    this.worldContact = worldContact;
    if (n >= 3) {
      this.isFlipping = false;
      if (!this.hasJumped || !this.isJumping) {
        // per gli effetti: tornato "a terra" su una palla in volo = flip reset
        if (this.hasFlipped || this.hasDoubleJumped || this.hasJumped) this.flipResetPending = this.wheels.some((w) => w.contact && !w.world);
      }
    }

    const fwdSpeed = this.vel.dot(f);
    const absV = Math.abs(fwdSpeed);

    // 2) freno a mano (sale e scende piano)
    this.handbrakeVal = clamp(this.handbrakeVal + (c.handbrake ? CAR.powerslideRise : -CAR.powerslideFall) * dt, 0, 1);

    // 3) sterzo (solo le ruote davanti), dalla curva della velocità
    let steer = curve(STEER_ANGLE_FROM_SPEED, absV);
    if (this.handbrakeVal > 0) steer += (curve(POWERSLIDE_STEER_FROM_SPEED, absV) - steer) * this.handbrakeVal;
    steer *= c.steer;
    this.wheels[0].steer = this.wheels[1].steer = -steer;
    this.wheels[2].steer = this.wheels[3].steer = 0;

    // 4) acceleratore e freno
    let realThrottle = c.throttle;
    let realBrake = 0;
    if (c.boost && this.boost > 0) realThrottle = 1;
    let driveScale = curve(DRIVE_SPEED_TORQUE_FACTOR, absV);
    let engineThrottle = realThrottle;
    if (!c.handbrake) {
      if (Math.abs(realThrottle) >= 0.001) {
        if (absV > CAR.stoppingForwardVel && sgn(realThrottle) !== sgn(fwdSpeed)) {
          realBrake = 1;
          if (absV > 0.01) engineThrottle = 0;
        }
      } else {
        engineThrottle = 0;
        realBrake = absV < CAR.stoppingForwardVel ? 1 : CAR.coastingBrakeFactor;
      }
    }
    if (n < 3) driveScale /= 4;

    // 5) aderenza: una forza che tiene attaccati a muri e rampe
    if (worldContact) {
      const upc = upSum.len2() > 0 ? tmpA.copy(upSum).normalize() : tmpA.copy(u);
      const fullStick = realThrottle !== 0 || absV > CAR.stoppingForwardVel;
      const scale = 0.5 + (fullStick ? 1 - Math.abs(upc.z) : 0);
      this.acc.addScaled(upc, -GRAVITY * scale);
    }

    // 6) attrito di ogni ruota: laterale (dipende dallo slittamento) e longitudinale (motore o freno)
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      if (!w.contact) continue;
      const wd = WHEEL_DEFS[i];
      const nrm = w.normal;
      // asse della ruota (sinistra, girata dallo sterzo) appiattito sul piano di contatto
      const axle = new V3();
      if (w.steer !== 0) {
        const cs = Math.cos(w.steer);
        const sn = Math.sin(w.steer);
        axle.set(l.x * cs - f.x * sn, l.y * cs - f.y * sn, l.z * cs - f.z * sn);
      } else axle.copy(l);
      axle.addScaled(nrm, -axle.dot(nrm)).normalize();
      const fwdDir = new V3().crossOf(axle, nrm).normalize();
      const offset = new V3().subOf(w.point, this.pos);
      const vAt = this.velAt(offset, new V3());
      const latVel = vAt.dot(axle);
      const longVel = vAt.dot(fwdDir);
      const base = Math.abs(latVel);
      const slip = base > 5 ? base / (Math.abs(longVel) + base) : 0;
      let lat = curve(LAT_FRICTION, slip);
      let long = 1;
      if (this.handbrakeVal > 0) {
        const h = this.handbrakeVal;
        lat *= (curve(HANDBRAKE_LAT_FACTOR, slip) - 1) * h + 1;
        long *= (curve(HANDBRAKE_LONG_FACTOR, slip) - 1) * h + 1;
      }
      if (realThrottle === 0) {
        const s = curve(NON_STICKY_FRICTION, nrm.z);
        lat *= s;
        long *= s;
      }
      // le spinte si applicano all'altezza del centro (niente ribaltamenti dalle ruote)
      const r = new V3().copy(offset).addScaled(u, -u.dot(offset));
      // laterale: annulla una parte dello slittamento ogni passo
      const sideImpulse = (-0.2 * latVel) / this.invMassAt(offset, axle);
      const j = new V3().copy(axle).scale(sideImpulse * lat * LAT_FRICTION_K * dt);
      // longitudinale: motore oppure freno
      let longAcc = 0;
      if (engineThrottle !== 0) longAcc = engineThrottle * CAR.throttleAccel * driveScale * long;
      else if (realBrake !== 0) {
        const lim = 52.5 * realBrake;
        longAcc = clamp(-longVel * ROLLING_K, -lim, lim) * long * (CAR.brakeAccel / 52.5);
      }
      j.addScaled(fwdDir, CAR.mass * longAcc * dt);
      this.applyImpulse(j, r);
      w.spin += (longVel / wd.radius) * dt;
    }
    // ruote in aria: girano piano
    for (const w of this.wheels) if (!w.contact) w.spin += (fwdSpeed / 13) * dt * 0.98;

    // 7) sospensioni: spingono lungo la normale nel punto di contatto
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      if (!w.contact) continue;
      const wd = WHEEL_DEFS[i];
      const offset = tmpC.subOf(w.point, this.pos);
      const vAt = this.velAt(offset, new V3());
      const denom = w.normal.dot(u);
      let relVel = 0;
      let inv = 10;
      if (denom > 0.1) {
        inv = 1 / denom;
        relVel = w.normal.dot(vAt) * inv;
      }
      const compression = wd.rest - w.susp;
      const k = wd.front ? CAR.springFront : CAR.springBack;
      const damp = relVel < 0 ? (wd.front ? CAR.dampCompFront : CAR.dampCompBack) : wd.front ? CAR.dampRelaxFront : CAR.dampRelaxBack;
      const a = compression * k * inv - damp * relVel;
      if (a > 0) this.applyImpulse(tmpB.copy(w.normal).scale(CAR.mass * a * dt), new V3().copy(offset));
    }

    // 8) salto
    if (this.onGround && !this.isJumping) {
      if (this.hasJumped && this.jumpTime < CAR.jumpMinTime + CAR.jumpResetPad) {
        // appena saltato: si tiene
      } else {
        this.hasJumped = false;
        this.jumpTime = 0;
      }
    }
    if (this.isJumping) this.isJumping = this.jumpTime < CAR.jumpMinTime || (c.jump && this.jumpTime < CAR.jumpMaxTime);
    else if (this.onGround && jumpPressed) {
      this.isJumping = true;
      this.jumpTime = 0;
      this.vel.addScaled(u, CAR.jumpImmediate);
    }
    if (this.isJumping) {
      this.hasJumped = true;
      this.acc.addScaled(u, CAR.jumpAccel * (this.jumpTime < CAR.jumpMinTime ? 0.62 : 1));
    }
    if (this.isJumping || this.hasJumped) this.jumpTime += dt;

    // 8b) raddrizzamento: ruote all'aria e premi salto (prima del doppio salto, che così non si spreca contro il pavimento)
    if (jumpPressed && this.bodyContact && this.bodyNormal.z > CAR.autoflipNormZ && !this.onGround) {
      const roll = Math.atan2(l.z, u.z);
      if (Math.abs(roll) > CAR.autoflipRollThresh) {
        this.autoFlipTimer = CAR.autoflipTime * (Math.abs(roll) / Math.PI);
        this.autoFlipScale = roll > 0 ? 1 : -1;
        this.isAutoFlipping = true;
        this.vel.addScaled(u, -CAR.autoflipImpulse);
      }
    }
    // 9) in aria: doppio salto o flip
    if (this.onGround) {
      this.hasDoubleJumped = this.hasFlipped = false;
      this.airTime = this.airTimeSinceJump = 0;
      this.flipTime = 0;
    } else {
      this.airTime += dt;
      if (this.hasJumped && !this.isJumping) this.airTimeSinceJump += dt;
      else this.airTimeSinceJump = 0;
      if (jumpPressed && this.airTimeSinceJump < CAR.doubleJumpMaxDelay && !this.hasDoubleJumped && !this.hasFlipped && !this.isAutoFlipping) {
        const mag = Math.abs(c.yaw) + Math.abs(c.pitch) + Math.abs(c.roll);
        if (mag >= CAR.dodgeDeadzone) this.dodge(f, fwdSpeed);
        else {
          this.vel.addScaled(u, CAR.jumpImmediate);
          this.hasDoubleJumped = true;
        }
      }
    }
    if (this.hasFlipped && !this.onGround) {
      this.flipTime += dt;
      if (this.flipTime <= CAR.flipTorqueTime && this.flipTime >= CAR.flipZDampStart && (this.vel.z < 0 || this.flipTime < CAR.flipZDampEnd))
        this.vel.z *= Math.pow(1 - CAR.flipZDamp120, dt * 120);
    }
    this.isFlipping = this.hasFlipped && this.flipTime < CAR.flipTorqueTime && !this.onGround;

    // 10) coppie in aria: capriola, poi controllo in aria (solo senza ruote a terra)
    if (n === 0) {
      let doAir = !this.isAutoFlipping;
      let pitchScale = 1;
      const wl = this.rot.unrotate(this.angVel, new V3()); // x rollio, y beccheggio (muso giù +), z imbardata (sinistra +)
      if (this.isFlipping) {
        if (this.flipFwd !== 0 || this.flipRight !== 0) {
          let cancel = 1;
          if (this.flipFwd !== 0 && c.pitch !== 0 && sgn(this.flipFwd) === sgn(c.pitch)) {
            cancel = 1 - Math.min(Math.abs(c.pitch), 1); // annullamento del flip tirando indietro
          } else doAir = false;
          const local = tmpA.set(this.flipRight * CAR.flipAlphaRoll, this.flipFwd * CAR.flipAlphaPitch * cancel, 0);
          this.angAcc.add(this.rot.rotate(local, new V3()));
        }
        pitchScale = 0;
      } else if (this.hasFlipped && this.flipTime < CAR.flipTorqueTime + CAR.flipPitchlockExtra) pitchScale = 0;
      if (doAir) {
        const p = c.pitch * pitchScale;
        const ax = CAR.airTorqueRoll * c.roll - CAR.airDampRoll * wl.x;
        const ay = -CAR.airTorquePitch * p - CAR.airDampPitch * (1 - Math.abs(p)) * wl.y;
        const az = -CAR.airTorqueYaw * c.yaw - CAR.airDampYaw * (1 - Math.abs(c.yaw)) * wl.z;
        this.angAcc.add(this.rot.rotate(tmpA.set(ax, ay, az), new V3()));
      }
      if (c.throttle !== 0) this.acc.addScaled(f, c.throttle * CAR.airThrottleAccel);
    }

    if (this.isAutoFlipping) {
      if (this.autoFlipTimer <= 0) {
        this.isAutoFlipping = false;
        this.autoFlipTimer = 0;
      } else {
        this.angVel.addScaled(f, CAR.autoflipTorque * this.autoFlipScale * dt);
        this.autoFlipTimer -= dt;
      }
    }
    // auto-allineamento col terreno mentre si accelera su 1-3 ruote (o di fianco)
    if (c.throttle !== 0 && ((n > 0 && n < 4) || this.bodyContact)) {
      const gUp = n > 0 ? tmpA.copy(upSum).normalize() : tmpA.copy(this.bodyNormal);
      this.acc.addScaled(gUp, -CAR.autorollAccel);
      const axis = tmpB.crossOf(u, gUp);
      this.angAcc.addScaled(axis, CAR.autorollTorque);
    }

    // 12) boost
    if (this.boost > 0) {
      if (this.isBoosting) this.isBoosting = c.boost || this.boostingTime < CAR.boostMinTime;
      else if (c.boost) this.isBoosting = true;
    } else this.isBoosting = false;
    this.boostingTime = this.isBoosting ? this.boostingTime + dt : 0;
    if (this.isBoosting) {
      this.boost = Math.max(this.boost - CAR.boostPerSecond * dt, 0);
      this.acc.addScaled(f, this.onGround ? CAR.boostAccelGround : CAR.boostAccelAir);
    }
    this.boost = Math.min(this.boost, CAR.boostMax);

    this.lastJump = c.jump;
  }

  // flip (schivata): spinta e capriola nella direzione della levetta
  private dodge(f: V3, fwdSpeed: number) {
    const c = this.controls;
    this.flipTime = 0;
    this.hasFlipped = true;
    this.isFlipping = true;
    let dx = -c.pitch; // avanti
    let dy = c.yaw + c.roll; // destra
    if (Math.abs(dy) < 0.1 && Math.abs(dx) < 0.1) {
      dx = 0;
      dy = 0;
    } else {
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
    }
    this.flipFwd = Math.abs(dx) < 0.1 ? 0 : dx;
    this.flipRight = Math.abs(dy) < 0.1 ? 0 : dy;
    if (this.flipFwd === 0 && this.flipRight === 0) return;
    const absV = Math.abs(fwdSpeed);
    const backwards = absV < 100 ? this.flipFwd < 0 : this.flipFwd >= 0 !== fwdSpeed >= 0;
    let ix = this.flipFwd * CAR.flipInitialVel;
    let iy = this.flipRight * CAR.flipInitialVel;
    const ratio = absV / CAR.maxSpeed;
    const maxX = backwards ? CAR.flipBackwardScale : CAR.flipForwardScale;
    ix *= (maxX - 1) * ratio + 1;
    iy *= (CAR.flipSideScale - 1) * ratio + 1;
    if (backwards) ix *= CAR.flipBackwardScaleX;
    // in orizzontale, rispetto a dove punta la macchina
    let fx = f.x;
    let fy = f.y;
    const fl = Math.hypot(fx, fy);
    if (fl > 1e-6) {
      fx /= fl;
      fy /= fl;
    } else {
      fx = 1;
      fy = 0;
    }
    // destra di (fx, fy) = (fy, -fx)
    this.vel.x += ix * fx + iy * fy;
    this.vel.y += ix * fy - iy * fx;
  }

  // ---------------------------------------------------------------- dopo la fisica
  postTick(dt: number) {
    const sp2 = this.vel.len2();
    if (this.isSupersonic && this.supersonicTime < CAR.supersonicMaintainTime) this.isSupersonic = sp2 >= CAR.supersonicMaintainMin ** 2;
    else this.isSupersonic = sp2 >= CAR.supersonicStart ** 2;
    this.supersonicTime = this.isSupersonic ? this.supersonicTime + dt : 0;
    this.vel.clampLen(CAR.maxSpeed);
    this.angVel.clampLen(CAR.maxAngSpeed);
    if (this.bumpCooldown > 0) this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
  }

  // urto della carrozzeria (la scatola) contro il campo: punti della scatola che entrano nei muri
  collideArena(dt: number) {
    const hc = this.hitboxCenter(new V3());
    this.bodyContact = false;
    if (arenaDist(hc.x, hc.y, hc.z) > 90) return;
    const hx = CAR.hitboxSize[0] / 2;
    const hy = CAR.hitboxSize[1] / 2;
    const hz = CAR.hitboxSize[2] / 2;
    let worst = 0;
    const nSum = new V3();
    for (let ix = -1; ix <= 1; ix++)
      for (let iy = -1; iy <= 1; iy++)
        for (let iz = -1; iz <= 1; iz++) {
          if (ix === 0 && iy === 0 && iz === 0) continue;
          const local = tmpC.set(CAR.hitboxOffset[0] + ix * hx, iy * hy, CAR.hitboxOffset[2] + iz * hz);
          const p = this.rot.rotate(local, new V3()).add(this.pos);
          const d = arenaDist(p.x, p.y, p.z);
          if (d >= 0) continue;
          const nrm = arenaNormal(p.x, p.y, p.z, new V3());
          const r = new V3().subOf(p, this.pos);
          const vAt = this.velAt(r, new V3());
          const vn = vAt.dot(nrm);
          if (vn < 0) {
            // urto con rimbalzo e attrito
            const e = vn < -100 ? 0.3 : 0;
            const jn = (-(1 + e) * vn) / this.invMassAt(r, nrm);
            const j = new V3().copy(nrm).scale(jn);
            const vt = new V3().copy(vAt).addScaled(nrm, -vn);
            const vtl = vt.len();
            if (vtl > 1e-3) {
              vt.scale(1 / vtl);
              const jt = Math.min(0.3 * jn, vtl / this.invMassAt(r, vt));
              j.addScaled(vt, -jt);
            }
            this.applyImpulse(j, r);
          }
          if (-d > worst) worst = -d;
          nSum.add(nrm);
          this.bodyContact = true;
        }
    if (this.bodyContact) {
      nSum.normalize();
      this.bodyNormal.copy(nSum);
      this.pos.addScaled(nSum, worst * 0.8);
    }
    void dt;
  }

  integrate(dt: number) {
    this.vel.addScaled(this.acc, dt);
    this.angVel.addScaled(this.angAcc, dt);
    this.angVel.clampLen(CAR.maxAngSpeed);
    this.pos.addScaled(this.vel, dt);
    this.rot.integrate(this.angVel, dt);
  }
}
