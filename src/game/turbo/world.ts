// ⚽🚗 Axend Turbo — il mondo: macchine, palla, cuscinetti del boost, gol, calcio d'inizio e tempo.
// Lo stesso codice gira sul server (che decide) e sul telefono (che prevede la propria macchina per non sentire ritardo).
import { goalScored } from './arena';
import { Ball } from './ball';
import { Car, noControls, type Controls } from './car';
import {
  ARENA,
  BALL,
  BALL_CAR_EXTRA,
  BALL_CAR_EXTRA_IMPULSE,
  BIG_PADS,
  BUMP_UPWARD_VEL,
  BUMP_VEL_AIR,
  BUMP_VEL_GROUND,
  CAR,
  CONTACT,
  DT,
  KICKOFF_SETS,
  KICKOFF_SPAWNS,
  MATCH,
  PADS,
  RESPAWNS,
  SMALL_PADS,
  TICK_RATE,
} from './consts';
import { Quat, V3, curve } from './math';

export type Phase = 'countdown' | 'play' | 'goal' | 'end';

export interface Pad {
  x: number;
  y: number;
  big: boolean;
  timer: number; // secondi alla ricomparsa (0 = attivo)
}

export interface Stats {
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  demos: number;
  touches: number;
  points: number;
}
const newStats = (): Stats => ({ goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, touches: 0, points: 0 });

export type TurboEvent =
  | { k: 'goal'; team: 0 | 1; by: string; assist: string; speed: number }
  | { k: 'demo'; by: string; victim: string }
  | { k: 'touch'; id: string; power: number }
  | { k: 'bump'; a: string; b: string }
  | { k: 'pad'; i: number; id: string }
  | { k: 'flipreset'; id: string }
  | { k: 'save'; id: string }
  | { k: 'shot'; id: string }
  | { k: 'respawn'; id: string }
  | { k: 'kickoff' }
  | { k: 'end'; winner: 0 | 1 | -1 }
  | { k: 'overtime' };

const tmp = new V3();
const tmp2 = new V3();

// la palla, andando dritta, entrerebbe nella porta di quella squadra? (0 = porta blu a y−, 1 = arancione a y+)
function onTarget(pos: V3, vel: V3, goalOf: 0 | 1): boolean {
  const gy = goalOf === 0 ? -ARENA.extentY : ARENA.extentY;
  if ((gy - pos.y) * vel.y <= 0 || Math.abs(vel.y) < 100) return false;
  const t = (gy - pos.y) / vel.y;
  if (t > 4) return false;
  const x = pos.x + vel.x * t;
  const z = pos.z + vel.z * t - 325 * t * t; // con la gravità (½·650)
  return Math.abs(x) < ARENA.goalHalfW + BALL.radius * 0.5 && z < ARENA.goalHeight + BALL.radius * 0.5;
}

export class World {
  tick = 0;
  cars: Car[] = [];
  ball = new Ball();
  pads: Pad[] = [...BIG_PADS.map(([x, y]) => ({ x, y, big: true, timer: 0 })), ...SMALL_PADS.map(([x, y]) => ({ x, y, big: false, timer: 0 }))];
  phase: Phase = 'countdown';
  phaseEnd = 0; // tick in cui finisce la fase (conto alla rovescia, festa del gol)
  clock = MATCH.seconds; // secondi di gioco rimasti (in supplementari: secondi passati)
  overtime = false;
  score: [number, number] = [0, 0];
  stats: Record<string, Stats> = {};
  events: TurboEvent[] = [];
  lastGoal: { team: 0 | 1; by: string } | null = null;
  kickoffSeed = 1;

  car(id: string) {
    return this.cars.find((c) => c.id === id);
  }

  addCar(id: string, team: 0 | 1, bot = false) {
    const c = new Car(id, team, bot);
    this.cars.push(c);
    this.stats[id] ??= newStats();
    return c;
  }

  // ---------------------------------------------------------------- calcio d'inizio
  kickoff() {
    this.ball.reset();
    for (const p of this.pads) p.timer = 0;
    for (const team of [0, 1] as const) {
      const mates = this.cars.filter((c) => c.team === team);
      // posti a caso tra quelli del calcio d'inizio (uguali e specchiati per le due squadre)
      const set = KICKOFF_SETS[Math.min(3, Math.max(1, mates.length))] ?? [0, 1, 2, 3, 4];
      const order = this.kickoffOrder(set, mates.length);
      mates.forEach((c, i) => {
        const [x, y, yaw] = KICKOFF_SPAWNS[order[i % order.length]];
        const extra = Math.floor(i / order.length) * 220; // squadre più grandi di 3: in fila dietro
        if (team === 0) c.place(x, y - extra, CAR.restZ, yaw);
        else c.place(-x, -y + extra, CAR.restZ, yaw + Math.PI);
        c.boost = CAR.boostSpawn;
        c.demoed = false;
        c.respawnTimer = 0;
        c.controls = noControls();
      });
    }
    this.phase = 'countdown';
    this.phaseEnd = this.tick + MATCH.countdown * TICK_RATE;
    this.events.push({ k: 'kickoff' });
  }

  // in 1v1 e 2v2 le partenze cambiano a ogni calcio d'inizio (deterministico: uguale su server e telefono)
  private kickoffOrder(set: number[], n: number) {
    this.kickoffSeed = (this.kickoffSeed * 16807) % 2147483647;
    const r = this.kickoffSeed / 2147483647;
    if (n === 1) return [Math.floor(r * 5)];
    if (n === 2) return r < 0.5 ? [2, 3] : [0, 1];
    return set;
  }

  // ---------------------------------------------------------------- un passo (1/120 s)
  step(inputs: (id: string) => Controls | undefined) {
    const dt = DT;
    this.events.length = 0;
    const frozen = this.phase === 'countdown' || this.phase === 'end';
    const ballLive = this.phase === 'play' || this.phase === 'countdown';

    // comandi
    for (const c of this.cars) {
      const inp = inputs(c.id);
      if (inp) c.controls = inp;
      if (frozen) c.controls = { ...noControls(), boost: false, jump: false };
    }

    // demoliti: aspettano la ricomparsa
    for (const c of this.cars) {
      if (!c.demoed) continue;
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0) this.respawn(c);
    }

    const live = this.cars.filter((c) => !c.demoed);
    for (const c of live) c.preTick(dt, ballLive ? this.ball : null, BALL.radius);
    if (frozen) for (const c of live) c.acc.set(0, 0, c.acc.z), c.vel.set(0, 0, c.vel.z);
    for (const c of live) {
      c.vel.addScaled(c.acc, dt);
      c.angVel.addScaled(c.angAcc, dt);
    }
    // urti con la palla, tra macchine e con il campo
    if (ballLive && this.phase === 'play') {
      // a ogni passo si parte da una squadra diversa: se due macchine toccano insieme (calcio d'inizio) nessuna è avvantaggiata
      const first = this.tick & 1;
      for (const c of live) if (c.team === first) this.carBall(c);
      for (const c of live) if (c.team !== first) this.carBall(c);
    }
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) this.carCar(live[i], live[j]);
    for (const c of live) {
      c.pos.addScaled(c.vel, dt);
      c.rot.integrate(c.angVel, dt);
      c.collideArena(dt);
      c.postTick(dt);
      if (c.flipResetPending) {
        c.flipResetPending = false;
        if (!c.onGround || c.wheels.every((w) => !w.world)) this.events.push({ k: 'flipreset', id: c.id });
      }
    }
    if (frozen) for (const c of live) c.angVel.set(0, 0, 0);
    // la palla si muove solo durante il gioco
    if (this.phase === 'play') this.ball.step(dt);
    this.pickPads(live, dt);

    // fasi e tempo
    if (this.phase === 'countdown' && this.tick >= this.phaseEnd) this.phase = 'play';
    else if (this.phase === 'play') {
      // come in Rocket League l'orologio parte solo quando qualcuno tocca la palla del calcio d'inizio
      const started = this.ball.lastTouchId !== '';
      if (this.overtime) {
        if (started) this.clock += dt;
      } else if (started) this.clock = Math.max(0, this.clock - dt);
      const g = goalScored(this.ball.pos.y, BALL.radius);
      if (g) this.goal(g > 0 ? 0 : 1);
      else if (!this.overtime && this.clock <= 0 && this.ball.pos.z <= BALL.radius + 4) {
        // tempo scaduto e palla a terra: fine, o supplementari se si è pari
        if (this.score[0] === this.score[1]) {
          this.overtime = true;
          this.clock = 0;
          this.events.push({ k: 'overtime' });
          this.kickoff();
        } else this.finish();
      }
    } else if (this.phase === 'goal' && this.tick >= this.phaseEnd) {
      if (this.overtime || (this.clock <= 0 && this.score[0] !== this.score[1])) this.finish();
      else this.kickoff();
    }
    this.tick++;
  }

  private finish() {
    this.phase = 'end';
    this.events.push({ k: 'end', winner: this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1 });
  }

  private goal(team: 0 | 1) {
    this.score[team]++;
    const b = this.ball;
    const by = b.lastTouchTeam === team ? b.lastTouchId : '';
    const assist = by && b.prevTouchId && b.prevTouchId !== by && this.car(b.prevTouchId)?.team === team && b.lastTouchTick - b.prevTouchTick < 5 * TICK_RATE ? b.prevTouchId : '';
    if (by && this.stats[by]) {
      this.stats[by].goals++;
      this.stats[by].points += 100;
    }
    if (assist && this.stats[assist]) {
      this.stats[assist].assists++;
      this.stats[assist].points += 50;
    }
    this.lastGoal = { team, by };
    this.events.push({ k: 'goal', team, by, assist, speed: Math.round(b.vel.len() * 0.036) });
    // l'esplosione della palla spinge via chi è vicino
    for (const c of this.cars) {
      if (c.demoed) continue;
      tmp.subOf(c.pos, b.pos);
      const d = tmp.len();
      if (d < 1400 && d > 1) c.vel.addScaled(tmp.scale(1 / d), (1400 - d) * 1.6).z += (1400 - d) * 0.6;
    }
    this.phase = 'goal';
    this.phaseEnd = this.tick + MATCH.goalPause * TICK_RATE;
    b.vel.set(0, 0, 0);
    b.angVel.set(0, 0, 0);
  }

  private respawn(c: Car) {
    const i = (this.tick + c.id.length) % RESPAWNS.length;
    const [x, y, yaw] = RESPAWNS[i];
    if (c.team === 0) c.place(x, y, CAR.restZ, yaw);
    else c.place(-x, -y, CAR.restZ, yaw + Math.PI);
    c.boost = CAR.boostSpawn;
    c.demoed = false;
    this.events.push({ k: 'respawn', id: c.id });
  }

  private pickPads(cars: Car[], dt: number) {
    for (let i = 0; i < this.pads.length; i++) {
      const p = this.pads[i];
      if (p.timer > 0) {
        p.timer = Math.max(0, p.timer - dt);
        continue;
      }
      const r = p.big ? PADS.bigRadius : PADS.smallRadius;
      for (const c of cars) {
        if (c.boost >= CAR.boostMax) continue;
        const dx = c.pos.x - p.x;
        const dy = c.pos.y - p.y;
        if (dx * dx + dy * dy > r * r || c.pos.z > PADS.height + 70) continue;
        c.boost = Math.min(CAR.boostMax, c.boost + (p.big ? PADS.bigAmount : PADS.smallAmount));
        p.timer = p.big ? PADS.bigCooldown : PADS.smallCooldown;
        this.events.push({ k: 'pad', i, id: c.id });
        break;
      }
    }
  }

  // ---------------------------------------------------------------- macchina contro palla
  private carBall(c: Car) {
    const b = this.ball;
    const R = BALL.radius;
    const hc = c.hitboxCenter(new V3());
    const local = c.rot.unrotate(tmp.subOf(b.pos, hc), new V3());
    const hx = CAR.hitboxSize[0] / 2;
    const hy = CAR.hitboxSize[1] / 2;
    const hz = CAR.hitboxSize[2] / 2;
    const cl = new V3(Math.max(-hx, Math.min(hx, local.x)), Math.max(-hy, Math.min(hy, local.y)), Math.max(-hz, Math.min(hz, local.z)));
    const diff = new V3().subOf(local, cl);
    let distC = diff.len();
    if (distC >= R) return;
    let nLocal: V3;
    if (distC < 1e-4) {
      // centro della palla dentro la scatola: si esce dal lato più vicino
      const ex = hx - Math.abs(local.x);
      const ey = hy - Math.abs(local.y);
      const ez = hz - Math.abs(local.z);
      nLocal = ex < ey && ex < ez ? new V3(Math.sign(local.x) || 1, 0, 0) : ey < ez ? new V3(0, Math.sign(local.y) || 1, 0) : new V3(0, 0, Math.sign(local.z) || 1);
      distC = -Math.min(ex, ey, ez);
    } else nLocal = diff.scale(1 / distC);
    const nrm = c.rot.rotate(nLocal, new V3()); // dalla macchina verso la palla
    const P = c.rot.rotate(cl, new V3()).add(hc);
    const pen = R - distC;
    const preRel = new V3().subOf(b.vel, c.vel);
    // tiro/parata: dove andava la palla prima del tocco
    const wasOnOwn = onTarget(b.pos, b.vel, c.team);

    const rc = new V3().subOf(P, c.pos);
    const rb = new V3().copy(nrm).scale(-R);
    const vc = c.velAt(rc, new V3());
    const vb = new V3().crossOf(b.angVel, rb).add(b.vel);
    const vrel = vb.sub(vc);
    const vn = vrel.dot(nrm);
    if (vn < 0) {
      const invB = 1 / BALL.mass;
      const jn = (-(1 + CONTACT.carBallRestitution) * vn) / (c.invMassAt(rc, nrm) + invB);
      const J = new V3().copy(nrm).scale(jn);
      const vt = new V3().copy(vrel).addScaled(nrm, -vn);
      const vtl = vt.len();
      if (vtl > 1e-3) {
        vt.scale(1 / vtl);
        const kt = c.invMassAt(rc, vt) + invB + 1 / (0.4 * BALL.mass);
        const jt = Math.min(CONTACT.carBallFriction * jn, vtl / kt);
        J.addScaled(vt, -jt);
      }
      b.vel.addScaled(J, invB);
      // effetto sulla palla: Δω = (rb × J) / I
      tmp2.crossOf(rb, J).scale(1 / (0.4 * BALL.mass * R * R));
      b.angVel.add(tmp2);
      c.applyImpulse(J.scale(-1), rc);
    }
    // la palla esce dalla macchina (è molto più leggera: si sposta quasi solo lei)
    const wb = CAR.mass / (CAR.mass + BALL.mass);
    b.pos.addScaled(nrm, pen * wb);
    c.pos.addScaled(nrm, -pen * (1 - wb));

    // la spinta extra di Rocket League (al massimo una ogni 2 passi)
    if (this.tick > c.lastExtraHitTick + 1 || c.lastExtraHitTick > this.tick) {
      c.lastExtraHitTick = this.tick;
      const fwd = c.forward(new V3());
      const dir = new V3().subOf(b.pos, c.pos);
      dir.z *= BALL_CAR_EXTRA.zScale;
      dir.normalize();
      dir.addScaled(fwd, -dir.dot(fwd) * (1 - BALL_CAR_EXTRA.forwardScale)).normalize();
      const relSpeed = Math.min(preRel.len(), BALL_CAR_EXTRA.maxDeltaVel);
      if (relSpeed > 0) b.vel.addScaled(dir, relSpeed * curve(BALL_CAR_EXTRA_IMPULSE, relSpeed));
      b.vel.clampLen(BALL.maxSpeed);
      // tocco: statistiche ed effetti
      if (b.lastTouchId !== c.id) {
        b.prevTouchId = b.lastTouchId;
        b.prevTouchTick = b.lastTouchTick;
      }
      b.lastTouchId = c.id;
      b.lastTouchTeam = c.team;
      b.lastTouchTick = this.tick;
      const st = this.stats[c.id];
      if (st) {
        st.touches++;
        st.points += 2;
        const opp: 0 | 1 = c.team === 0 ? 1 : 0;
        if (wasOnOwn && !onTarget(b.pos, b.vel, c.team)) {
          st.saves++;
          st.points += 50;
          this.events.push({ k: 'save', id: c.id });
        } else if (onTarget(b.pos, b.vel, opp)) {
          st.shots++;
          st.points += 20;
          this.events.push({ k: 'shot', id: c.id });
        }
      }
      this.events.push({ k: 'touch', id: c.id, power: Math.round(relSpeed) });
    }
  }

  // ---------------------------------------------------------------- macchina contro macchina (spintoni e demolizioni)
  private carCar(a: Car, b: Car) {
    // ogni macchina è approssimata da tre sfere lungo l'asse
    const ra = 41;
    const ca = a.hitboxCenter(new V3());
    const cb = b.hitboxCenter(new V3());
    if (ca.x - cb.x > 200 || cb.x - ca.x > 200 || ca.y - cb.y > 200 || cb.y - ca.y > 200 || Math.abs(ca.z - cb.z) > 200) return;
    const fa = a.forward(new V3());
    const fb = b.forward(new V3());
    let best: { d: number; pa: V3; pb: V3 } | null = null;
    for (const oa of [-38, 0, 38])
      for (const ob of [-38, 0, 38]) {
        const pa = new V3().copy(ca).addScaled(fa, oa);
        const pb = new V3().copy(cb).addScaled(fb, ob);
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
        if (d < 2 * ra && (!best || d < best.d)) best = { d, pa, pb };
      }
    if (!best) return;
    const nrm = new V3().subOf(best.pb, best.pa); // da a verso b
    const d = best.d;
    if (d < 1e-4) nrm.set(1, 0, 0);
    else nrm.scale(1 / d);
    const P = new V3().copy(best.pa).addScaled(nrm, ra);
    const pen = 2 * ra - d;
    // spintoni e demolizioni (come RocketSim: ognuna delle due può essere quella che colpisce)
    for (const [c1, c2] of [
      [a, b],
      [b, a],
    ] as const) {
      if (c1.demoed || c2.demoed) return;
      if (c1.bumpOther === c2.id && c1.bumpCooldown > 0) continue;
      const toOther = tmp.subOf(c2.pos, c1.pos);
      if (c1.vel.dot(toOther) <= 0) continue;
      const speed = c1.vel.len();
      if (speed < 1) continue;
      const velDir = new V3().copy(c1.vel).scale(1 / speed);
      const dirTo = new V3().copy(toOther).normalize();
      const speedTowards = c1.vel.dot(dirTo);
      const otherAway = c2.vel.dot(velDir);
      if (speedTowards <= otherAway) continue;
      const localHit = c1.rot.unrotate(tmp2.subOf(P, c1.pos), new V3());
      if (localHit.x <= CAR.bumpMinForward) continue;
      const isDemo = c1.isSupersonic && c1.team !== c2.team;
      if (isDemo) {
        c2.demoed = true;
        c2.respawnTimer = CAR.respawnTime;
        this.events.push({ k: 'demo', by: c1.id, victim: c2.id });
        if (this.stats[c1.id]) {
          this.stats[c1.id].demos++;
          this.stats[c1.id].points += 25;
        }
      } else {
        const base = curve(c2.onGround ? BUMP_VEL_GROUND : BUMP_VEL_AIR, speedTowards);
        const hitUp = c2.onGround ? c2.up(new V3()) : new V3(0, 0, 1);
        c2.vel.addScaled(velDir, base).addScaled(hitUp, curve(BUMP_UPWARD_VEL, speedTowards));
        this.events.push({ k: 'bump', a: c1.id, b: c2.id });
      }
      c1.bumpOther = c2.id;
      c1.bumpCooldown = CAR.bumpCooldown;
    }
    if (a.demoed || b.demoed) return;
    // urto fisico (poco elastico) e separazione
    const rA = new V3().subOf(P, a.pos);
    const rB = new V3().subOf(P, b.pos);
    const vrel = b.velAt(rB, new V3()).sub(a.velAt(rA, new V3()));
    const vn = vrel.dot(nrm);
    if (vn < 0) {
      const k = a.invMassAt(rA, nrm) + b.invMassAt(rB, nrm);
      const jn = (-(1 + CONTACT.carCarRestitution) * vn) / k;
      const J = new V3().copy(nrm).scale(jn);
      b.applyImpulse(J, rB);
      a.applyImpulse(J.scale(-1), rA);
    }
    a.pos.addScaled(nrm, -pen / 2);
    b.pos.addScaled(nrm, pen / 2);
  }

  // ---------------------------------------------------------------- foto dello stato (per la rete)
  snapshot(): Snapshot {
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    const b = this.ball;
    return {
      t: this.tick,
      ph: this.phase,
      pe: this.phaseEnd,
      cl: Math.round(this.clock * 100) / 100,
      ot: this.overtime ? 1 : 0,
      sc: [this.score[0], this.score[1]],
      ks: this.kickoffSeed,
      b: [r1(b.pos.x), r1(b.pos.y), r1(b.pos.z), r1(b.vel.x), r1(b.vel.y), r1(b.vel.z), r4(b.angVel.x), r4(b.angVel.y), r4(b.angVel.z)],
      bt: [b.lastTouchId, b.lastTouchTeam, b.lastTouchTick, b.prevTouchId, b.prevTouchTick],
      p: this.pads.map((p) => Math.round(p.timer * 100) / 100),
      c: this.cars.map((c) => [
        c.id,
        c.team,
        c.bot ? 1 : 0,
        r1(c.pos.x),
        r1(c.pos.y),
        r1(c.pos.z),
        r4(c.rot.x),
        r4(c.rot.y),
        r4(c.rot.z),
        r4(c.rot.w),
        r1(c.vel.x),
        r1(c.vel.y),
        r1(c.vel.z),
        r4(c.angVel.x),
        r4(c.angVel.y),
        r4(c.angVel.z),
        Math.round(c.boost * 100) / 100,
        // stato interno (serve a prevedere uguale al server)
        (c.isJumping ? 1 : 0) | (c.hasJumped ? 2 : 0) | (c.hasDoubleJumped ? 4 : 0) | (c.hasFlipped ? 8 : 0) | (c.isFlipping ? 16 : 0) | (c.isAutoFlipping ? 32 : 0) | (c.isBoosting ? 64 : 0) | (c.isSupersonic ? 128 : 0) | (c.demoed ? 256 : 0) | (c.lastJump ? 512 : 0) | (c.bodyContact ? 1024 : 0),
        r4(c.jumpTime),
        r4(c.flipTime),
        r4(c.flipFwd),
        r4(c.flipRight),
        r4(c.airTime),
        r4(c.airTimeSinceJump),
        r4(c.autoFlipTimer),
        c.autoFlipScale,
        r4(c.handbrakeVal),
        r4(c.boostingTime),
        r4(c.supersonicTime),
        r4(c.respawnTimer),
        r4(c.bumpCooldown),
        c.bumpOther,
        c.lastExtraHitTick,
        encodeControls(c.controls),
      ]),
    };
  }

  load(s: Snapshot) {
    this.tick = s.t;
    this.phase = s.ph;
    this.phaseEnd = s.pe;
    this.clock = s.cl;
    this.overtime = !!s.ot;
    this.score = [s.sc[0], s.sc[1]];
    this.kickoffSeed = s.ks;
    const b = this.ball;
    b.pos.set(s.b[0], s.b[1], s.b[2]);
    b.vel.set(s.b[3], s.b[4], s.b[5]);
    b.angVel.set(s.b[6], s.b[7], s.b[8]);
    [b.lastTouchId, b.lastTouchTeam, b.lastTouchTick, b.prevTouchId, b.prevTouchTick] = s.bt as [string, number, number, string, number];
    s.p.forEach((t, i) => this.pads[i] && (this.pads[i].timer = t));
    const seen = new Set<string>();
    for (const row of s.c) {
      const id = row[0] as string;
      seen.add(id);
      let c = this.car(id);
      if (!c) c = this.addCar(id, row[1] as 0 | 1, !!row[2]);
      c.team = row[1] as 0 | 1;
      c.bot = !!row[2];
      const n = row as number[];
      c.pos.set(n[3], n[4], n[5]);
      c.rot = new Quat(n[6], n[7], n[8], n[9]).normalize();
      c.vel.set(n[10], n[11], n[12]);
      c.angVel.set(n[13], n[14], n[15]);
      c.boost = n[16];
      const f = n[17];
      c.isJumping = !!(f & 1);
      c.hasJumped = !!(f & 2);
      c.hasDoubleJumped = !!(f & 4);
      c.hasFlipped = !!(f & 8);
      c.isFlipping = !!(f & 16);
      c.isAutoFlipping = !!(f & 32);
      c.isBoosting = !!(f & 64);
      c.isSupersonic = !!(f & 128);
      c.demoed = !!(f & 256);
      c.lastJump = !!(f & 512);
      c.bodyContact = !!(f & 1024);
      c.jumpTime = n[18];
      c.flipTime = n[19];
      c.flipFwd = n[20];
      c.flipRight = n[21];
      c.airTime = n[22];
      c.airTimeSinceJump = n[23];
      c.autoFlipTimer = n[24];
      c.autoFlipScale = n[25];
      c.handbrakeVal = n[26];
      c.boostingTime = n[27];
      c.supersonicTime = n[28];
      c.respawnTimer = n[29];
      c.bumpCooldown = n[30];
      c.bumpOther = row[31] as string;
      c.lastExtraHitTick = n[32];
      c.controls = decodeControls(row[33] as number[]);
    }
    this.cars = this.cars.filter((c) => seen.has(c.id));
  }
}

export interface Snapshot {
  t: number;
  ph: Phase;
  pe: number;
  cl: number;
  ot: number;
  sc: [number, number];
  ks: number;
  b: number[];
  bt: (string | number)[];
  p: number[];
  c: (string | number | number[])[][];
  st?: Record<string, number[]>; // statistiche (ogni tanto): [gol, assist, parate, tiri, demolizioni, tocchi, punti]
}

const STAT_KEYS: (keyof Stats)[] = ['goals', 'assists', 'saves', 'shots', 'demos', 'touches', 'points'];
export function packStats(stats: Record<string, Stats>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const id of Object.keys(stats)) out[id] = STAT_KEYS.map((k) => stats[id][k]);
  return out;
}
export function unpackStats(st: Record<string, number[]>): Record<string, Stats> {
  const out: Record<string, Stats> = {};
  for (const id of Object.keys(st)) {
    const s = newStats();
    STAT_KEYS.forEach((k, i) => (s[k] = Number(st[id][i]) || 0));
    out[id] = s;
  }
  return out;
}

// comandi compatti per la rete: [throttle, steer, pitch, yaw, roll] in centesimi + bit (salto, boost, freno a mano)
export function encodeControls(c: Controls): number[] {
  const q = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 100);
  return [q(c.throttle), q(c.steer), q(c.pitch), q(c.yaw), q(c.roll), (c.jump ? 1 : 0) | (c.boost ? 2 : 0) | (c.handbrake ? 4 : 0)];
}
export function decodeControls(a: number[] | undefined): Controls {
  if (!a || a.length < 6) return noControls();
  const d = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v / 100)) : 0);
  return { throttle: d(a[0]), steer: d(a[1]), pitch: d(a[2]), yaw: d(a[3]), roll: d(a[4]), jump: !!(a[5] & 1), boost: !!(a[5] & 2), handbrake: !!(a[5] & 4) };
}
