// ⚽🚗 Axend Turbo — la palla: gravità, resistenza dell'aria, rimbalzi con effetto (modello misurato su Rocket League)
import { arenaDist, arenaNormal } from './arena';
import { BALL, GRAVITY } from './consts';
import { Quat, V3 } from './math';

const n = new V3();
const tmp = new V3();
const vPerp = new V3();
const vPara = new V3();
const vSpin = new V3();
const s = new V3();
const dPara = new V3();

export class Ball {
  pos = new V3(0, 0, BALL.restZ);
  vel = new V3();
  angVel = new V3();
  rot = new Quat(); // solo per disegnarla che rotola
  // ultimo tocco (per assist, tiri e parate)
  lastTouchId = '';
  lastTouchTeam = -1;
  lastTouchTick = -1000;
  prevTouchId = ''; // il tocco prima (stessa squadra → assist)
  prevTouchTick = -1000;
  hitWorld = false; // ha rimbalzato su qualcosa in questo passo (per gli effetti)

  reset() {
    this.pos.set(0, 0, BALL.restZ);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.lastTouchId = '';
    this.lastTouchTeam = -1;
    this.prevTouchId = '';
  }

  step(dt: number) {
    this.vel.z -= GRAVITY * dt;
    this.vel.scale(Math.pow(1 - BALL.drag, dt));
    this.pos.addScaled(this.vel, dt);
    this.collideArena();
    this.vel.clampLen(BALL.maxSpeed);
    this.angVel.clampLen(BALL.maxAngSpeed);
    this.rot.integrate(this.angVel, dt);
  }

  collideArena() {
    this.hitWorld = false;
    const R = BALL.radius;
    const d = arenaDist(this.pos.x, this.pos.y, this.pos.z);
    if (d >= R) return;
    arenaNormal(this.pos.x, this.pos.y, this.pos.z, n);
    this.pos.addScaled(n, R - d);
    const vn = this.vel.dot(n);
    if (vn >= 0) return;
    this.hitWorld = vn < -150;
    // rimbalzo: perpendicolare (restituzione) + attrito sulla parte parallela, che dipende dall'effetto
    vPerp.copy(n).scale(vn);
    vPara.copy(this.vel).sub(vPerp);
    vSpin.crossOf(n, this.angVel).scale(R);
    s.copy(vPara).add(vSpin);
    const ratio = vPerp.len() / Math.max(s.len(), 1e-4);
    const kPara = -Math.min(1, BALL.frictionY * ratio) * BALL.friction;
    dPara.copy(s).scale(kPara);
    this.vel.addScaled(vPerp, -(1 + BALL.restitution)).add(dPara);
    tmp.crossOf(dPara, n).scale(BALL.spinA * R);
    this.angVel.add(tmp);
  }
}
