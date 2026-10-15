// Banco di prova della fisica di Axend Turbo: misura le cose che si conoscono di Rocket League e le confronta.
//   npx tsx scripts/prova-turbo.ts
import { World } from '../src/game/turbo/world';
import { noControls, type Controls } from '../src/game/turbo/car';
import { BALL, TICK_RATE } from '../src/game/turbo/consts';
import { Quat, V3 } from '../src/game/turbo/math';

const f1 = (v: number) => v.toFixed(1);
let ok = 0;
let ko = 0;
function check(name: string, value: number, lo: number, hi: number, note = '') {
  const pass = value >= lo && value <= hi;
  if (pass) ok++;
  else ko++;
  console.log(`${pass ? '✓' : '✗'} ${name}: ${f1(value)} (atteso ${lo}–${hi})${note ? ' · ' + note : ''}`);
}

// un mondo con una macchina sola, già in gioco (niente conto alla rovescia)
function solo(x = 0, y = -2000, yaw = Math.PI / 2) {
  const w = new World();
  const c = w.addCar('a', 0);
  w.kickoff();
  c.place(x, y, 17, yaw);
  w.phase = 'play';
  for (const p of w.pads) p.timer = 1e9; // niente cuscinetti: non falsano le misure del boost
  w.ball.pos.set(3000, 4000, 2000); // palla lontana e ferma
  w.ball.vel.set(0, 0, 0);
  return { w, c };
}
function run(w: World, ctrl: Controls | ((t: number) => Controls), seconds: number, each?: (t: number) => void) {
  const n = Math.round(seconds * TICK_RATE);
  for (let i = 0; i < n; i++) {
    const t = i / TICK_RATE;
    const c = typeof ctrl === 'function' ? ctrl(t) : ctrl;
    w.ball.pos.set(3000, 4000, 1500);
    w.ball.vel.set(0, 0, 0);
    w.step(() => c);
    each?.(t);
  }
}
const ctl = (p: Partial<Controls>): Controls => ({ ...noControls(), ...p });

// 1) a riposo
{
  const { w, c } = solo();
  run(w, noControls(), 2);
  check('altezza a riposo (z dell’origine)', c.pos.z, 15.5, 18.5);
  check('ruote a terra', c.numWheels, 4, 4);
}
// 2) solo acceleratore
{
  const { w, c } = solo(0, -4000);
  let t1400 = -1;
  run(w, ctl({ throttle: 1 }), 6, (t) => {
    if (t1400 < 0 && c.vel.len() >= 1390) t1400 = t;
  });
  check('velocità massima senza boost', c.vel.len(), 1395, 1415);
  check('tempo per arrivare a 1390 uu/s', t1400, 1.7, 3.5);
}
// 3) boost da fermo
{
  const { w, c } = solo(0, -4500);
  c.boost = 100;
  let t2200 = -1;
  run(w, ctl({ throttle: 1, boost: true }), 4, (t) => {
    if (t2200 < 0 && c.vel.len() >= 2200) t2200 = t;
  });
  check('velocità massima col boost', c.vel.len(), 2290, 2300);
  check('tempo per il supersonico (2200) da fermo', t2200, 1.4, 2.6);
  check('boost consumato in 4 s', 100 - c.boost, 100, 100, 'finisce in 3 s');
}
// 4) salto
{
  const { w, c } = solo();
  run(w, noControls(), 0.5);
  let maxZ = 0;
  run(w, (t) => ctl({ jump: t < 0.3 }), 2, () => (maxZ = Math.max(maxZ, c.pos.z)));
  check('salto tenuto: altezza massima', maxZ, 220, 265);
  const s2 = solo();
  run(s2.w, noControls(), 0.5);
  let maxZ2 = 0;
  run(s2.w, (t) => ctl({ jump: t < 0.2 || (t > 0.25 && t < 0.3) }), 2.5, () => (maxZ2 = Math.max(maxZ2, s2.c.pos.z)));
  check('doppio salto: altezza massima', maxZ2, 400, 520);
}
// 5) raggio di curva a 1000 uu/s
{
  const { w, c } = solo(0, 0);
  run(w, ctl({ throttle: 1 }), 0.9);
  const sp = c.vel.len();
  const pts: V3[] = [];
  run(w, (t) => ctl({ throttle: c.vel.len() < sp ? 1 : 0.03, steer: 1 }), 3, () => pts.push(c.pos.clone()));
  // raggio dai punti (cerchio passante per tre punti lontani)
  const a = pts[60];
  const b = pts[150];
  const d = pts[240];
  const A = Math.hypot(b.x - d.x, b.y - d.y);
  const B = Math.hypot(a.x - d.x, a.y - d.y);
  const C = Math.hypot(a.x - b.x, a.y - b.y);
  const area = Math.abs((b.x - a.x) * (d.y - a.y) - (d.x - a.x) * (b.y - a.y)) / 2;
  const R = (A * B * C) / (4 * area);
  check(`raggio di curva a ${Math.round(sp)} uu/s`, R, 380, 560, 'Rocket League ~ 425–460');
}
// 6) flip in avanti: guadagno di velocità
{
  const { w, c } = solo(0, -3000);
  run(w, ctl({ throttle: 1 }), 1);
  const v0 = c.vel.len();
  run(w, (t) => ctl({ throttle: 1, jump: t < 0.05 || (t > 0.12 && t < 0.15), pitch: t > 0.11 ? -1 : 0 }), 0.3);
  const gain = c.vel.len() - v0;
  check('flip in avanti: velocità guadagnata', gain, 380, 600);
  let landed = false;
  run(w, ctl({ throttle: 1 }), 1.5, () => {
    if (c.onGround) landed = true;
  });
  check('dopo il flip si atterra sulle ruote', landed ? 1 : 0, 1, 1);
}
// 7) palla lasciata cadere da 1000
{
  const w = new World();
  w.phase = 'play';
  w.ball.pos.set(0, 0, 1000);
  let peak = 0;
  let bounced = false;
  for (let i = 0; i < 4 * TICK_RATE; i++) {
    w.step(() => undefined);
    if (w.ball.vel.z > 0) bounced = true;
    if (bounced && w.ball.vel.z <= 0 && peak === 0) peak = w.ball.pos.z;
  }
  check('palla: altezza del primo rimbalzo da 1000', peak, 380, 460, 'restituzione 0,6');
}
// 8) tiro: macchina a 1400 contro palla ferma
{
  const w = new World();
  const c = w.addCar('a', 0);
  w.kickoff();
  w.phase = 'play';
  c.place(0, -1500, 17, Math.PI / 2);
  c.vel.set(0, 1400, 0);
  w.ball.pos.set(0, -1300, BALL.radius);
  w.ball.vel.set(0, 0, 0);
  let maxV = 0;
  for (let i = 0; i < 60; i++) {
    w.step(() => ctl({ throttle: 1 }));
    maxV = Math.max(maxV, w.ball.vel.len());
  }
  check('tiro a 1400 uu/s: velocità della palla', maxV, 1900, 2700);
}
// 9) muro: si sale sul muro laterale e ci si resta accelerando
{
  const { w, c } = solo(3400, 0, 0); // verso +x, il muro laterale
  c.boost = 100;
  let tWall = -1;
  for (let i = 0; i < 360 && tWall < 0; i++) run(w, ctl({ throttle: 1 }), 1 / 120, () => c.pos.z > 600 && (tWall = i / 120));
  check('si sale sul muro laterale (tempo per arrivare a quota 600)', tWall, 0.5, 2.8);
  // sul muro: si gira verso l'orizzontale e si guida lungo il muro
  let attached = 0;
  let samples = 0;
  run(w, ctl({ throttle: 1, steer: -0.6 }), 1.5, () => {
    samples++;
    const up = c.up(new V3());
    if (c.numWheels >= 3 && Math.abs(up.x) > 0.8) attached++;
  });
  check('guida sul muro: tempo con le ruote attaccate', (attached / samples) * 100, 70, 100, '%');
  // a motore spento si scivola giù / ci si stacca
  const z0 = c.pos.z;
  run(w, noControls(), 2);
  check('a motore spento si scende dal muro', z0 - c.pos.z, 100, 5000);
}
// 10) volo: salto + boost verso l'alto per 1,5 s
{
  const { w, c } = solo();
  c.boost = 100;
  run(w, noControls(), 0.3);
  // muso in su prima di partire: si salta e si tira indietro
  let maxZ = 0;
  run(w, (t) => ctl({ jump: t < 0.2, pitch: t > 0.05 && t < 0.45 ? 1 : 0, boost: t > 0.1 }), 2, () => (maxZ = Math.max(maxZ, c.pos.z)));
  check('volo col boost: quota raggiunta in 2 s', maxZ, 700, 2044);
}
// 11) flip reset: macchina a ruote in su sotto la palla, dopo aver già usato il flip
{
  const w = new World();
  const c = w.addCar('a', 0);
  w.kickoff();
  w.phase = 'play';
  c.place(0, 0, 400, Math.PI / 2);
  c.rot = Quat.fromAxisAngle(new V3(0, 1, 0), Math.PI).normalize(); // capovolta: ruote verso l'alto
  c.hasJumped = true;
  c.hasFlipped = true;
  c.airTimeSinceJump = 2;
  w.ball.pos.set(0, 0, 400 + 18 + BALL.radius - 4);
  w.ball.vel.set(0, 0, -50);
  let reset = false;
  for (let i = 0; i < 30; i++) {
    w.step(() => noControls());
    if (w.events.some((e) => e.k === 'flipreset')) reset = true;
  }
  check('flip reset: toccando la palla con le 4 ruote si riprende il flip', reset && !c.hasFlipped ? 1 : 0, 1, 1);
}
// 12) soffitto: ci si atterra con le ruote, si riprende il salto e poi si cade
{
  const w = new World();
  const c = w.addCar('a', 0);
  w.kickoff();
  w.phase = 'play';
  for (const p of w.pads) p.timer = 1e9;
  c.place(0, 0, 1900, Math.PI / 2);
  c.rot = Quat.fromAxisAngle(new V3(0, 1, 0), Math.PI).normalize();
  c.vel.set(0, 300, 600);
  c.hasJumped = true;
  c.hasFlipped = true;
  c.flipTime = 5; // il flip è finito da un pezzo (niente smorzamento verticale)
  let touched = false;
  let fell = false;
  for (let i = 0; i < 240; i++) {
    w.ball.pos.set(3000, 4000, 300);
    w.step(() => noControls());
    if (c.onGround && c.pos.z > 1800) touched = true;
    if (touched && c.pos.z < 1700) fell = true;
  }
  check('soffitto: si tocca con le ruote (salto ripreso)', touched && !c.hasFlipped ? 1 : 0, 1, 1);
  check('soffitto: poi si cade (niente guida sul soffitto)', fell ? 1 : 0, 1, 1);
}
// 13) derapata: col freno a mano la macchina gira molto più stretta
{
  const heading = (w: World, c: ReturnType<World['addCar']>, hb: boolean) => {
    run(w, ctl({ throttle: 1 }), 1.2);
    const f0 = c.forward(new V3());
    let turned = 0;
    let prev = f0.clone();
    run(w, ctl({ throttle: 1, steer: 1, handbrake: hb }), 0.6, () => {
      const f = c.forward(new V3());
      turned += Math.acos(Math.max(-1, Math.min(1, f.dot(prev))));
      prev = f;
    });
    return (turned * 180) / Math.PI;
  };
  const a = solo(0, 0);
  const b = solo(0, 0);
  const normal = heading(a.w, a.c, false);
  const drift = heading(b.w, b.c, true);
  check('derapata: gradi girati in 0,6 s senza freno a mano', normal, 40, 120);
  check('derapata: col freno a mano si gira di più (rapporto)', drift / normal, 1.2, 4);
}
// 14) in aria: un giro completo di rollio (velocità massima di rotazione 5,5 rad/s come Rocket League)
{
  const { w, c } = solo();
  c.place(0, 0, 1000, Math.PI / 2);
  c.vel.set(0, 0, 400);
  c.hasJumped = true;
  let angle = 0;
  let t360 = -1;
  let prev = c.up(new V3());
  run(w, ctl({ roll: 1 }), 2, (t) => {
    const u = c.up(new V3());
    angle += Math.acos(Math.max(-1, Math.min(1, u.dot(prev))));
    prev = u;
    if (t360 < 0 && angle >= 2 * Math.PI) t360 = t;
  });
  check('rollio in aria: tempo per un giro completo (s)', t360, 1.1, 1.45, 'Rocket League ~1,25 s');
}
// 15) a ruote all'aria sul pavimento: premendo salto si raddrizza
{
  const { w, c } = solo();
  c.rot = Quat.fromAxisAngle(new V3(1, 0, 0), Math.PI).normalize();
  c.pos.z = 60;
  run(w, noControls(), 1);
  run(w, (t) => ctl({ jump: t < 0.05 }), 2);
  const u = c.up(new V3());
  check('ruote all’aria + salto: torna dritta', u.z, 0.8, 1.01);
}
// 16) calcio d'inizio 1v1 dal centro dietro: tempo per arrivare alla palla col boost
{
  const w = new World();
  const a = w.addCar('a', 0);
  w.addCar('b', 1);
  w.kickoff();
  a.place(0, -4608, 17, Math.PI / 2);
  w.phase = 'play';
  let tTouch = -1;
  for (let i = 0; i < 600 && tTouch < 0; i++) {
    w.step((id) => (id === 'a' ? ctl({ throttle: 1, boost: true }) : noControls()));
    if (w.events.some((e) => e.k === 'touch' && e.id === 'a')) tTouch = i / 120;
  }
  check('calcio d’inizio dal fondo: secondi per arrivare alla palla', tTouch, 2.2, 3.4);
}
// 17) demolizione: macchina supersonica contro un avversario
{
  const w = new World();
  const a = w.addCar('a', 0);
  const b = w.addCar('b', 1);
  w.kickoff();
  w.phase = 'play';
  for (const p of w.pads) p.timer = 1e9;
  a.place(0, -2000, 17, Math.PI / 2);
  b.place(0, -500, 17, 0);
  a.vel.set(0, 2250, 0);
  a.boost = 100;
  let demo = false;
  for (let i = 0; i < 240; i++) {
    w.ball.pos.set(3000, 4000, 300);
    w.step((id) => (id === 'a' ? ctl({ throttle: 1, boost: true }) : noControls()));
    if (w.events.some((e) => e.k === 'demo')) demo = true;
  }
  check('demolizione a velocità supersonica', demo ? 1 : 0, 1, 1);
}
void Quat;
console.log(`\n${ok} ok, ${ko} da sistemare`);
process.exit(ko ? 1 : 0);
