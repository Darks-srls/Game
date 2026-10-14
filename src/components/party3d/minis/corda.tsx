// 🍝 Salta la corda (telefono): il tagliere gigante, i due cuochi giganti che girano la manovella, lo spaghetto al dente
// (e poi quello agli spinaci) con l'ombra per terra, il cerchio che si stringe intorno a me fino al momento di saltare.
// Il passaggio sopra di me lo controllo qui (preciso, senza ritardi di rete) e lo dico al server con MG_CORDA_HIT.
import * as THREE from 'three';
import { CORDA, cordaActive, cordaAngle, cordaCurrent, cordaNextRev, cordaOmega, cordaPasses, cordaSpeed, crossed, ropeCross, ropeLowAt, ropeZ } from '../../../data/minis/corda';
import { PHYS } from '../../../data/party3d';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

const ROPE_COL = ['#f6d77a', '#7cc46a'];
const HUB_X = 15.4; // dove i cuochi girano la manovella
const HAND_R = 1.8; // raggio del giro della mano
const APEX = PHYS.jumpV / PHYS.gravity;
const PASSES: { tau: number; n: number }[] = [];

// stato del mio telefono
let act: ((type: string, payload?: unknown) => void) | null = null;
const prevA = [0, 0];
let prevT = -1;
let hitSent = false;
let jumps = 0;
let round = -1;

// lo spaghetto in posa "in basso": dritto sopra il campo, poi curva fino alle mani dei cuochi
function ropeGeo() {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 64; k++) {
    const x = -HUB_X + (k / 64) * HUB_X * 2;
    const ax = Math.abs(x);
    let r = CORDA.R;
    if (ax > CORDA.halfX) {
      const u = Math.min(1, (ax - CORDA.halfX) / (HUB_X - CORDA.halfX));
      r = HAND_R + (CORDA.R - HAND_R) * (1 - u * u * (3 - 2 * u));
    }
    pts.push(new THREE.Vector3(x, -r, 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, CORDA.rope, 10);
}

function boardTex() {
  return canvasTex(1024, 256, (c) => {
    c.fillStyle = '#e2b679';
    c.fillRect(0, 0, 1024, 256);
    let s = 21;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 70; k++) {
      c.strokeStyle = `rgba(140,85,35,${0.12 + rnd() * 0.2})`;
      c.lineWidth = 1 + rnd() * 3;
      c.beginPath();
      const y = rnd() * 256;
      c.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) c.lineTo(x, y + Math.sin(x / 90 + k) * 4);
      c.stroke();
    }
    // farina
    for (let k = 0; k < 18; k++) {
      const x = rnd() * 1024;
      const y = rnd() * 256;
      const g = c.createRadialGradient(x, y, 0, x, y, 50);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - 50, y - 50, 100, 100);
    }
    // la riga del centro (il posto più facile: lo spaghetto passa più basso)
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.setLineDash([24, 18]);
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, 128);
    c.lineTo(1024, 128);
    c.stroke();
  });
}

// un cuoco gigante (girato verso -x se sta a destra); le braccia le muove il fotogramma
function makeChef(sx: number) {
  const g = new THREE.Group();
  const white = toy('#ffffff', { roughness: 0.5 });
  const skin = toy('#ffd8b1');
  const legs = new THREE.Mesh(rbox(2.4, 3, 1.6, 0.4), toy('#2b2d42'));
  legs.position.y = 1.5;
  const jacket = outlined(new THREE.Mesh(rbox(3.6, 4, 2.4, 0.8), white), 1.03);
  jacket.position.y = 5;
  for (let k = 0; k < 3; k++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toy('#e63946'));
    btn.position.set(0.5, 4.2 + k * 0.8, 1.22);
    g.add(btn);
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.28, 8, 20), toy('#e63946'));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 7;
  const head = outlined(new THREE.Mesh(rbox(2.2, 2.1, 2, 0.8), skin), 1.04);
  head.position.y = 8.2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), toy('#ffb4a2'));
  nose.position.set(0, 8.2, 1.05);
  const stache = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), toy('#3d2314'));
    m.scale.set(1.3, 0.45, 0.5);
    m.position.set(s * 0.55, 7.75, 1.0);
    m.rotation.z = s * 0.35;
    stache.add(m);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toy('#1b1b2f'));
    eye.position.set(s * 0.45, 8.65, 1.0);
    g.add(eye);
  }
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.1, 24), white);
  hatBand.position.y = 9.7;
  const hatTop = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), white), 1.03);
  hatTop.scale.y = 0.8;
  hatTop.position.y = 10.7;
  g.add(legs, jacket, scarf, head, nose, stache, hatBand, hatTop);
  shadowy(g);
  g.scale.setScalar(1.25);
  g.position.set(sx * 18.4, -1.4, 0);
  g.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
  return { g, blockers: [legs, jacket, head, hatTop] };
}

// braccio (cilindro) da una spalla a una mano, rifatto a ogni fotogramma senza allocazioni
const ARM_UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
function placeArm(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  tmpA.subVectors(to, from);
  const len = tmpA.length();
  m.position.copy(from).addScaledVector(tmpA, 0.5);
  m.quaternion.setFromUnitVectors(ARM_UP, tmpA.divideScalar(len || 1));
  m.scale.set(1, len, 1);
}

registerClientMini({
  kind: 'CORDA',
  orbit: { c: [0, 4, 0], r: 30 },
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffe066" to="#f4a261">
      <path d="M12 30 Q50 98 88 30" fill="none" stroke="#1d0f3d" strokeWidth={10} strokeLinecap="round" />
      <path d="M12 30 Q50 98 88 30" fill="none" stroke="#f6d77a" strokeWidth={5} strokeLinecap="round" />
      <rect x="40" y="26" width="20" height="22" rx="6" fill="#3a86ff" {...stroke} />
      <rect x="41" y="10" width="18" height="16" rx="5" fill="#ffd23f" {...stroke} />
      <path d="M36 54 l-6 8 M64 54 l6 8" {...stroke} />
      <path d="M30 80 h40" stroke="#1d0f3d" strokeOpacity="0.35" strokeWidth={6} strokeLinecap="round" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (anche doppio) · E schiaffo · salta quando il cerchio diventa verde',
  feed: {
    spaghetto: ['{n} è stato spaghettato', 'lo spaghetto ha preso {n}', '{n} è volato via con lo spaghetto'],
    caduto: ['{n} è caduto dal tagliere', '{n} è finito nell’acqua della pasta'],
  },
  build(world) {
    const g = world.arena;
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -21;
    sh.right = sh.top = 21;
    // ---- il tagliere
    const wood = toy('#ffffff', { map: boardTex(), roughness: 0.6, clearcoat: 0.2 });
    const side = toy('#a8692f');
    const board = new THREE.Mesh(rbox(CORDA.halfX * 2 + 0.8, 1.4, CORDA.halfZ * 2, 0.3), [side, side, wood, side, side, side]);
    board.position.y = -0.7;
    g.add(shadowy(board));
    // piedistalli dei cuochi
    for (const sx of [-1, 1]) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.6, 32), toy('#ffd166'));
      ped.position.set(sx * 18.4, -2.2, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 22, 16), toy('#8d5524'));
      leg.position.set(sx * 18.4, -14, 0);
      g.add(shadowy(ped), leg);
    }
    // ---- la pentola dell'acqua della pasta, laggiù (chi cade ci finisce dentro)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(19, 17, 10, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }));
    pot.position.y = -24;
    const water = new THREE.Mesh(new THREE.CircleGeometry(18.6, 64), toy('#bfe6ff', { roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -20.5;
    g.add(pot, water);
    const bubbleGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const bubbles = new THREE.InstancedMesh(bubbleGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, roughness: 0.1 }), 40);
    const bub: { x: number; z: number; y: number; s: number }[] = [];
    const dummy = new THREE.Object3D();
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 17;
      bub.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, y: Math.random(), s: 0.4 + Math.random() * 0.9 });
    }
    g.add(bubbles);
    // ---- i cuochi, le braccia, gli spaghetti
    const chefs = [makeChef(-1), makeChef(1)];
    for (const c of chefs) {
      g.add(c.g);
      world.camBlockers.push(...c.blockers);
    }
    const sleeve = toy('#ffffff', { roughness: 0.5 });
    const armGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 12);
    const arms: THREE.Mesh[][] = [];
    const hands: THREE.Mesh[][] = [];
    for (let n = 0; n < 2; n++) {
      arms.push([]);
      hands.push([]);
      for (const sx of [-1, 1]) {
        const a = new THREE.Mesh(armGeo, sleeve);
        a.castShadow = true;
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), toy('#ffd8b1'));
        g.add(a, h);
        arms[n].push(a);
        hands[n].push(h);
        a.userData.sx = sx;
      }
    }
    const ropeG = ropeGeo();
    const ropes: THREE.Group[] = [];
    const ropeMats: THREE.MeshPhysicalMaterial[] = [];
    const shadows: THREE.Mesh[] = [];
    const shadowMat: THREE.MeshBasicMaterial[] = [];
    for (let n = 0; n < 2; n++) {
      const m = toy(ROPE_COL[n], { roughness: 0.25, clearcoat: 0.9, emissive: ROPE_COL[n], emissiveIntensity: 0 });
      const rope = new THREE.Group();
      const mesh = new THREE.Mesh(ropeG, m);
      mesh.castShadow = true;
      rope.add(mesh);
      rope.position.y = CORDA.cy;
      g.add(rope);
      ropes.push(rope);
      ropeMats.push(m);
      const sm = new THREE.MeshBasicMaterial({ color: '#1d0f3d', transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(CORDA.halfX * 2 + 0.6, 0.75), sm);
      s.rotation.x = -Math.PI / 2;
      s.position.y = 0.025;
      g.add(s);
      shadows.push(s);
      shadowMat.push(sm);
    }
    // ---- il cerchio del tempo intorno a me: si stringe fino al momento giusto per saltare
    const target = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.84, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    target.rotation.x = -Math.PI / 2;
    g.add(target);
    const timers: THREE.Mesh[] = [];
    for (let k = 0; k < 2; k++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2;
      g.add(r);
      timers.push(r);
    }
    // ---- il pubblico: pomodori e polpette con gli occhi, che saltano anche loro
    const fans: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Group();
      const tomato = k % 3 !== 2;
      const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.3, 18, 14), toy(tomato ? '#e63946' : '#8a4b2a')), 1.05);
      f.add(body);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), toy('#ffffff'));
        eye.position.set(s * 0.45, 0.35, 1.1);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toy('#1b1b2f'));
        pupil.position.set(s * 0.45, 0.35, 1.38);
        f.add(eye, pupil);
      }
      if (tomato) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 5), toy('#2d8a3e'));
        leaf.position.y = 1.35;
        f.add(leaf);
      }
      const sz = k % 2 ? 1 : -1;
      f.position.set(-7 + (k >> 1) * 7, -2, sz * 13.5);
      f.rotation.y = sz > 0 ? Math.PI : 0;
      f.userData.ph = k * 0.7;
      fans.push(f);
      g.add(shadowy(f));
      const step = new THREE.Mesh(rbox(3.6, 1, 3, 0.3), toy(k % 2 ? '#3a86ff' : '#ff70a6'));
      step.position.set(f.position.x, -3.6, f.position.z);
      g.add(step);
    }
    const balloons: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff'][k % 4]);
      b.position.set(-13 + k * 5.2, 6 + (k % 3) * 1.5, (k % 2 ? 1 : -1) * 16);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const lastA = [0, 0];

    return (f) => {
      const t = f.playT;
      const plan = cordaCurrent();
      for (let n = 0; n < 2; n++) {
        const on = cordaActive(n, t) && (n === 0 || t > 0);
        const a = cordaAngle(n, t);
        const pop = n === 1 ? Math.min(1, Math.max(0, (t - plan.t2) / 0.5)) : 1;
        ropes[n].visible = on;
        ropes[n].rotation.x = -a;
        ropes[n].scale.set(1, pop, pop);
        // quando passa in basso si illumina un po'
        const low = Math.cos(a);
        ropeMats[n].emissiveIntensity = on && low > 0.75 ? (low - 0.75) * 1.6 : 0;
        // ombra per terra
        const z = ropeZ(a);
        shadows[n].visible = on && low > 0.25 && Math.abs(z) < CORDA.halfZ + 1;
        shadows[n].position.z = z;
        shadowMat[n].opacity = Math.min(0.6, (low - 0.25) * 0.9);
        // le mani dei cuochi sulla manovella (il secondo spaghetto con l'altra mano)
        for (let k = 0; k < 2; k++) {
          const sx = k ? 1 : -1;
          to.set(sx * HUB_X, CORDA.cy - HAND_R * Math.cos(a), HAND_R * Math.sin(a));
          from.set(sx * 17.6, CORDA.cy + 0.4, n === 0 ? -1.6 : 1.6);
          arms[n][k].visible = on || n === 0;
          hands[n][k].visible = on || n === 0;
          if (!on) to.set(sx * 17, CORDA.cy - 2.4, n === 0 ? -1.6 : 1.6);
          placeArm(arms[n][k], from, to);
          hands[n][k].position.copy(to);
        }
        // fischio quando passa in basso
        if (on && f.view.stage === 'PLAY' && crossed(lastA[n], a, 0)) soundManager.playWhoosh();
        lastA[n] = a;
      }
      // il cerchio del tempo (solo per me, vivo)
      const me = f.me;
      const show = f.view.stage === 'PLAY' && !!f.view.alive[f.myId];
      target.visible = show;
      for (const r of timers) r.visible = false;
      if (show) {
        target.position.set(me.x, 0.04, me.z);
        cordaPasses(me.z, t, 1.15, PASSES);
        for (let k = 0; k < Math.min(2, PASSES.length); k++) {
          const p = PASSES[k];
          const r = timers[k];
          const rad = 0.78 + (p.tau - APEX) * 2.6;
          if (rad < 0.25) continue;
          r.visible = true;
          r.position.set(me.x, 0.05 + k * 0.01, me.z);
          r.scale.setScalar(rad);
          const good = Math.abs(p.tau - APEX) < 0.11;
          const m = r.material as THREE.MeshBasicMaterial;
          m.color.set(good ? '#06d6a0' : p.tau < APEX ? '#ff4d6d' : ROPE_COL[p.n]);
          m.opacity = good ? 1 : 0.75;
        }
      }
      // bolle, pubblico, palloncini
      for (let k = 0; k < bub.length; k++) {
        const b = bub[k];
        b.y += f.dt * 0.6;
        if (b.y > 1) b.y = 0;
        dummy.position.set(b.x, -21 + b.y * 1.2, b.z);
        dummy.scale.setScalar(b.s * Math.sin(b.y * Math.PI));
        dummy.updateMatrix();
        bubbles.setMatrixAt(k, dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;
      for (const fan of fans) fan.position.y = -2 + Math.max(0, Math.sin(f.t * 5 + fan.userData.ph)) * 1.2;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.5;
    };
  },
  // il passaggio sopra di me: preso o saltato (lo vedo qui, esatto) → al server
  local(f, world) {
    const t = f.playT;
    if (round !== f.view.round || t < prevT - 0.5) {
      round = f.view.round;
      hitSent = false;
      jumps = 0;
      prevT = -1;
    }
    const me = f.me;
    const alive = f.view.stage === 'PLAY' && !!f.view.alive[f.myId];
    if (prevT >= 0 && alive && !hitSent && me.y > -1 && Math.abs(me.z) < CORDA.halfZ + 0.6) {
      const c = ropeCross(me.z);
      for (let n = 0; n < 2; n++) {
        if (!cordaActive(n, prevT)) continue;
        const a = cordaAngle(n, t);
        if (!crossed(prevA[n], a, c)) continue;
        if (me.y < ropeLowAt(me.z) + CORDA.hit) {
          // preso: volo via subito (il server mi elimina appena lo sa)
          hitSent = true;
          const dz = (cordaOmega(t) >= 0 ? 1 : -1) * (n === 0 ? 1 : -1);
          me.kz += dz * 12;
          me.kx += (Math.random() - 0.5) * 4;
          me.vy = 9;
          me.ground = false;
          soundManager.playBonk();
          popText(world, me.x, me.y, me.z, 'SPAGHETTATO!', '#ffd60a', { scale: 1.2 });
          f.act('MG_CORDA_HIT', { dz });
          break;
        }
        jumps++;
        if (jumps % 10 === 0) {
          popText(world, me.x, me.y + 0.4, me.z, `${jumps} SALTI!`, '#06d6a0', { scale: 1.1 });
          soundManager.playSuccess();
        }
      }
    }
    for (let n = 0; n < 2; n++) prevA[n] = cordaAngle(n, t);
    prevT = t;
  },
  status(h) {
    act = h.act;
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const plan = cordaCurrent();
    if (plan.t2 > t && plan.t2 - t < 4) return { text: 'ARRIVA IL SECONDO SPAGHETTO!', cls: 'sc-purple pulse-soft' };
    const rev = cordaNextRev(t);
    if (rev < 2.5) return { text: 'LO SPAGHETTO CAMBIA VERSO!', cls: 'sc-purple pulse-soft' };
    if (Math.abs(h.me.z) > 2.2) return { text: 'QUI PASSA PIÙ ALTO: VIENI AL CENTRO', cls: 'sc-yellow' };
    return { text: 'SALTA QUANDO IL CERCHIO È VERDE', cls: 'sc-dark' };
  },
  hud(h: HudCtx) {
    act = h.act;
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const k = (cordaSpeed(t) - CORDA.w0) / (CORDA.w1 - CORDA.w0);
    const on = Math.max(1, Math.min(5, Math.round(1 + k * 4)));
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        <p className="sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white">
          <span className="sc-stroke-sm font-display text-base">{jumps}</span> SALTI
        </p>
        <p className="sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white">
          RITMO
          <span className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, j) => (
              <span key={j} className={`inline-block h-3 w-2 rounded-sm border border-[#1d0f3d] ${j < on ? (j >= 3 ? 'bg-red-500' : 'bg-amber-300') : 'bg-white/25'}`} />
            ))}
          </span>
        </p>
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'corda_hit') {
      const at = c.where(p.id) ?? { x: p.x, y: p.y, z: p.z };
      burst(c.world, at.x, at.y + 1, at.z, ['#f6d77a', '#e63946', '#ffffff', '#7cc46a'], 40, 8);
      ringPulse(c.world, at.x, at.y, at.z, '#ffd60a');
      const av = c.avatar(p.id);
      if (av) av.shockUntil = performance.now() + 1200;
      if (p.id === c.myId) c.shake(0.8);
      else {
        popText(c.world, at.x, at.y, at.z, 'SPAGHETTATO!', '#ffd60a', { scale: 1.1 });
        soundManager.playBonk();
      }
    }
  },
});
