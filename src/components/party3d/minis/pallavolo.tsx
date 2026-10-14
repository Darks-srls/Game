// 🏐 Beach volley (telefono): spiaggia col mare, palme, ombrelloni, anguria gigante, i gonfiabili a strisce intorno,
// la rete che trema, il pallone da spiaggia gigante con la sua ombra sulla sabbia (per capire dove scende)
import * as THREE from 'three';
import { VOLLEY } from '../../../data/minis/pallavolo';
import { TEAM_COL, TEAM_NAME } from '../../../data/minis/squadre';
import { soundManager } from '../../../utils/audio';
import { Badge, INK, stroke } from '../icons';
import { balloon, burst, canvasTex, dust, glow, matte, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { TeamScore, teamPill, wearVest } from './squadre';
import { registerClientMini, type HudCtx } from './types';

type Ext = {
  team: Record<string, number>;
  my?: number;
  score: number[];
  pts: Record<string, number>;
  phase: 'SERVE' | 'RALLY' | 'POINT';
  until: number;
  lock: number;
  server: string | null;
  serveTeam: number;
} | null;

const R = VOLLEY.ballR;
// il pallone (ammorbidito) e la sua velocità: servono alle scritte e al pulsante
const ball = { x: 0, y: 3.3, z: 0, vx: 0, vy: 0, vz: 0, seen: false };
const armsUp = new Map<string, number>(); // chi ha appena schiacciato (braccia in alto)
let netHit = -9;
let spikeReady = 0;

// il pallone è a portata di schiacciata? (stesso controllo del server, un filo più largo per il ritardo della rete)
function inReach(me: { x: number; y: number; z: number }) {
  const hd = Math.hypot(ball.x - me.x, ball.z - me.z);
  return hd < R + 1.45 && ball.y > me.y + 0.4 && ball.y < me.y + 2.3 + R + 0.8;
}
const canPlay = (E: Ext, myId: string, now: number) => !!E && (E.phase === 'RALLY' || (E.phase === 'SERVE' && E.serveTeam === E.team[myId] && now >= E.lock));

function spikeNow(h: HudCtx) {
  const E = h.ext as Ext;
  if (!E || Date.now() < spikeReady || !canPlay(E, h.myId, h.now) || !inReach(h.me)) return;
  spikeReady = Date.now() + 400;
  armsUp.set(h.myId, performance.now());
  h.me.r = h.yaw;
  h.act('MG_PV_SCHIACCIA', { a: h.yaw });
  soundManager.playWhoosh();
}

// sabbia con le increspature e le righe del campo (corde blu)
function sandTexture() {
  const PX = 28;
  const W = VOLLEY.halfX * 2;
  const D = VOLLEY.halfZ * 2;
  return canvasTex(W * PX, D * PX, (c) => {
    c.fillStyle = '#f3d9a4';
    c.fillRect(0, 0, W * PX, D * PX);
    for (let k = 0; k < 1400; k++) {
      c.fillStyle = k % 2 ? 'rgba(200,160,100,0.25)' : 'rgba(255,255,255,0.35)';
      c.fillRect(Math.random() * W * PX, Math.random() * D * PX, 3, 2);
    }
    c.strokeStyle = 'rgba(190,150,90,0.25)';
    c.lineWidth = 3;
    for (let y = 10; y < D * PX; y += 26) {
      c.beginPath();
      for (let x = 0; x <= W * PX; x += 20) c.lineTo(x, y + Math.sin(x / 40 + y) * 5);
      c.stroke();
    }
    // le righe: corde blu
    const x0 = (VOLLEY.halfX - VOLLEY.lineX) * PX;
    const z0 = (VOLLEY.halfZ - VOLLEY.lineZ) * PX;
    c.strokeStyle = '#1d6fd1';
    c.lineWidth = 8;
    c.strokeRect(x0, z0, VOLLEY.lineX * 2 * PX, VOLLEY.lineZ * 2 * PX);
    c.beginPath();
    c.moveTo(x0, (D / 2) * PX);
    c.lineTo(W * PX - x0, (D / 2) * PX);
    c.stroke();
    // metà campo velate del colore delle squadre
    c.fillStyle = 'rgba(255,59,92,0.10)';
    c.fillRect(0, 0, W * PX, (D / 2) * PX);
    c.fillStyle = 'rgba(58,134,255,0.10)';
    c.fillRect(0, (D / 2) * PX, W * PX, (D / 2) * PX);
  });
}

// pallone da spiaggia: spicchi colorati e i tappi bianchi
function beachBallTexture() {
  return canvasTex(512, 256, (c) => {
    const cols = ['#ff3b5c', '#ffffff', '#3a86ff', '#ffd60a', '#ffffff', '#06d6a0'];
    for (let i = 0; i < 6; i++) {
      c.fillStyle = cols[i];
      c.fillRect((i * 512) / 6, 0, 512 / 6 + 1, 256);
    }
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 512, 22);
    c.fillRect(0, 234, 512, 22);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, 60, 512, 10);
  });
}

// rete: maglie bianche trasparenti con la fascia in alto
function netTexture() {
  return canvasTex(512, 128, (c) => {
    c.clearRect(0, 0, 512, 128);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 3;
    for (let x = 0; x <= 512; x += 16) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 128);
      c.stroke();
    }
    for (let y = 0; y <= 128; y += 16) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(512, y);
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 512, 14);
  });
}

// gonfiabile a strisce (tubo con le palle agli angoli)
function stripeTex(repeat: number) {
  return canvasTex(
    128,
    32,
    (c) => {
      const cols = ['#ff3b5c', '#ffffff', '#ffd60a', '#ffffff', '#3a86ff', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        c.fillStyle = cols[i];
        c.fillRect((i * 128) / 6, 0, 128 / 6 + 1, 32);
      }
    },
    [repeat, 1],
  );
}

function palm(h: number) {
  const g = new THREE.Group();
  const trunkM = toy('#a0703c', { clearcoat: 0.1 });
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.32 - i * 0.03, 0.38 - i * 0.03, h / 6, 10), trunkM);
    seg.position.set(Math.sin(i * 0.3) * i * 0.18, (i + 0.5) * (h / 6), 0);
    seg.rotation.z = -0.08 * i;
    g.add(seg);
  }
  const leafM = toy('#2d9c4a', { side: THREE.DoubleSide });
  const crown = new THREE.Group();
  crown.position.set(1.0, h, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4), leafM);
    leaf.scale.set(1, 1, 0.25);
    leaf.position.y = 0;
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.z = -1.25;
    leaf.position.x = 1.6;
    pivot.add(leaf);
    crown.add(pivot);
  }
  for (let i = 0; i < 3; i++) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), toy('#5c3d2e'));
    coco.position.set(Math.sin(i * 2) * 0.35, -0.3, Math.cos(i * 2) * 0.35);
    crown.add(coco);
  }
  g.add(crown);
  g.userData.crown = crown;
  return shadowy(g);
}

function umbrella(a: string, b: string) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), toy('#ffffff'));
  pole.position.y = 1.7;
  const tex = canvasTex(256, 32, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? a : b;
      c.fillRect(i * 32, 0, 32, 32);
    }
  });
  const top = outlined(new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 16, 1, true), toy('#ffffff', { map: tex, side: THREE.DoubleSide })), 1.03);
  top.position.y = 3.4;
  const bed = new THREE.Mesh(rbox(0.9, 0.18, 2.2, 0.06), toy(a));
  bed.position.set(1.2, 0.35, 0.3);
  bed.rotation.x = -0.15;
  g.add(pole, top, bed);
  return shadowy(g);
}

registerClientMini({
  kind: 'PALLAVOLO',
  orbit: { c: [0, 1, 0], r: 26 },
  highCam: true,
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#9be7ff" to="#1d6fd1">
      <path d="M8 80 q42 -10 84 0 v10 h-84 Z" fill="#f3d9a4" {...stroke} />
      <path d="M50 30 v52" {...stroke} />
      <path d="M50 32 h0" stroke="#ffffff" strokeWidth="6" />
      <circle cx="40" cy="34" r="20" fill="#ffffff" {...stroke} />
      <path d="M40 14 q-12 20 0 40" fill="#ff3b5c" stroke={INK} strokeWidth="3" />
      <path d="M40 14 q12 20 0 40" fill="#3a86ff" stroke={INK} strokeWidth="3" />
      <path d="M22 28 q18 4 36 0" fill="none" stroke="#ffd60a" strokeWidth="4" />
      <path d="M64 46 l10 -6 M66 54 l12 -2" {...stroke} fill="none" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (doppio salto!) · Shift scatto · E o clic SCHIACCIA quando il pallone è vicino · vai sotto il pallone per rimandarlo',
  build(world) {
    const g = world.arena;
    armsUp.clear();
    ball.seen = false;
    netHit = -9;
    const W = VOLLEY.halfX * 2;
    const D = VOLLEY.halfZ * 2;
    // il mare intorno (le onde scorrono) e l'isola di sabbia
    const seaTex = canvasTex(
      256,
      256,
      (c) => {
        c.fillStyle = '#27b5e8';
        c.fillRect(0, 0, 256, 256);
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 4;
        for (let y = 8; y < 256; y += 32) {
          c.beginPath();
          for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x / 20) * 5);
          c.stroke();
        }
      },
      [30, 30],
    );
    const sea = new THREE.Mesh(new THREE.CircleGeometry(220, 48), matte('#ffffff', { map: seaTex, roughness: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.9;
    g.add(sea);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 1.2, 48), matte('#f0d095'));
    island.position.y = -0.62;
    island.receiveShadow = true;
    g.add(island);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matte('#ffffff', { map: sandTexture() }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.003;
    sand.receiveShadow = true;
    g.add(sand);
    // i gonfiabili a strisce tutto intorno (il pallone ci rimbalza)
    for (const sx of [-1, 1]) {
      const tube = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, D, 18), toy('#ffffff', { map: stripeTex(10), clearcoat: 0.8, roughness: 0.2 })), 1.03);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(sx * (VOLLEY.halfX + 0.55), 0.55, 0);
      g.add(shadowy(tube));
    }
    for (const sz of [-1, 1]) {
      const tube = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, W, 18), toy('#ffffff', { map: stripeTex(7), clearcoat: 0.8, roughness: 0.2 })), 1.03);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0, 0.55, sz * (VOLLEY.halfZ + 0.55));
      g.add(shadowy(tube));
      for (const sx of [-1, 1]) {
        const knob = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 14), toy(TEAM_COL[sz < 0 ? 0 : 1], { clearcoat: 0.8 })), 1.04);
        knob.position.set(sx * (VOLLEY.halfX + 0.55), 0.85, sz * (VOLLEY.halfZ + 0.55));
        g.add(shadowy(knob));
      }
    }
    // la rete: pali a strisce, maglie, fascia in alto (trema quando ci sbatte il pallone)
    const net = new THREE.Group();
    for (const sx of [-1, 1]) {
      const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, VOLLEY.netH + 0.6, 12), toy('#ffffff', { map: stripeTex(1) })), 1.06);
      pole.position.set(sx * (VOLLEY.halfX + 0.2), (VOLLEY.netH + 0.6) / 2, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), glow('#ffd60a', 1.2));
      cap.position.set(sx * (VOLLEY.halfX + 0.2), VOLLEY.netH + 0.65, 0);
      g.add(shadowy(pole), cap);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, VOLLEY.netH, 1, 1), new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 }));
    mesh.position.y = VOLLEY.netH / 2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W + 0.4, 8), toy('#ffffff'));
    band.rotation.z = Math.PI / 2;
    band.position.y = VOLLEY.netH;
    net.add(mesh, band);
    g.add(net);
    // il pallone gigante e la sua ombra (scura e piccola quando è basso, larga e chiara quando è alto)
    const bmesh = outlined(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), toy('#ffffff', { map: beachBallTexture(), clearcoat: 0.9, roughness: 0.15 })), 1.03);
    bmesh.castShadow = true;
    g.add(bmesh);
    const shadowM = new THREE.MeshBasicMaterial({ color: '#3d2a12', transparent: true, opacity: 0.4, depthWrite: false });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(R, 32), shadowM);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    g.add(blob);
    const serveRingM = new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    const serveRing = new THREE.Mesh(new THREE.TorusGeometry(R * 1.25, 0.06, 8, 40), serveRingM);
    g.add(serveRing);
    // spiaggia intorno: palme, ombrelloni, anguria gigante, carretto della granita, gabbiani, ciambella-pizza in mare
    const palms: THREE.Group[] = [];
    [
      [-16, -10, 7],
      [16, -6, 8],
      [-15.5, 9, 6.5],
      [16, 13, 7.5],
      [-6, 18, 6],
      [8, -18, 7],
    ].forEach(([x, z, h], i) => {
      const p = palm(h);
      p.position.set(x, 0, z);
      p.rotation.y = i * 1.3;
      palms.push(p);
      g.add(p);
      world.camBlockers.push(p);
    });
    [
      [-14, -2, '#ff3b5c', '#ffffff'],
      [14, 3, '#3a86ff', '#ffffff'],
      [-13, 15, '#ffd60a', '#ff70a6'],
      [13.5, -14, '#06d6a0', '#ffffff'],
    ].forEach(([x, z, a, b]) => {
      const u = umbrella(a as string, b as string);
      u.position.set(x as number, 0, z as number);
      g.add(u);
      world.camBlockers.push(u);
    });
    const melon = new THREE.Group();
    const rind = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 32, 1, false, 0, Math.PI), [toy('#2d9c4a'), toy('#ff4d6d'), toy('#ff4d6d')]), 1.02);
    rind.rotation.x = Math.PI / 2;
    melon.add(rind);
    for (let i = 0; i < 9; i++) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toy('#1b1b2f'));
      const a = 0.3 + (i / 9) * (Math.PI - 0.6);
      seed.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.52);
      seed.scale.y = 1.6;
      melon.add(seed);
    }
    melon.position.set(0, 0, -VOLLEY.halfZ - 8);
    g.add(shadowy(melon));
    world.camBlockers.push(melon);
    const cart = new THREE.Group();
    const box = outlined(new THREE.Mesh(rbox(2.6, 1.4, 1.4, 0.2), toy('#fff3b0')), 1.03);
    box.position.y = 1.3;
    const roofC = new THREE.Mesh(rbox(3, 0.2, 1.8, 0.08), toy('#ffd60a'));
    roofC.position.y = 3;
    const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), toy('#ffe14d'));
    lemon.scale.set(1, 1.3, 1);
    lemon.position.y = 3.6;
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 8, 20), toy('#2b2d42'));
      wheel.position.set(sx * 0.9, 0.5, 0.75);
      cart.add(wheel);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), toy('#ffffff'));
      post.position.set(sx * 1.3, 2.4, 0);
      cart.add(post);
    }
    cart.add(box, roofC, lemon);
    cart.position.set(VOLLEY.halfX + 9, 0, 8);
    cart.rotation.y = -Math.PI / 2;
    g.add(shadowy(cart));
    world.camBlockers.push(cart);
    // ciambella a forma di pizza che galleggia
    const floaty = new THREE.Mesh(new THREE.TorusGeometry(2, 0.7, 14, 32), toy('#f4a259', { clearcoat: 0.9 }));
    floaty.rotation.x = Math.PI / 2;
    const floatTop = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), toy('#e63946'));
    floatTop.rotation.x = -Math.PI / 2;
    floatTop.position.y = 0.2;
    const floatG = new THREE.Group();
    floatG.add(floaty, floatTop);
    floatG.position.set(-30, -0.6, 22);
    g.add(floatG);
    const gulls: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const gull = new THREE.Group();
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(rbox(1.2, 0.08, 0.35, 0.03), toy('#ffffff'));
        wing.position.x = s * 0.55;
        wing.userData.s = s;
        gull.add(wing);
      }
      gull.userData.ph = i * 1.6;
      gulls.push(gull);
      g.add(gull);
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const b = balloon([TEAM_COL[0], '#ffd60a', TEAM_COL[1]][i % 3]);
      b.position.set((i % 2 ? 1 : -1) * (VOLLEY.halfX + 11), 8 + (i % 3) * 1.6, -9 + i * 3.6);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    const spinQ = new THREE.Quaternion();
    const axis = new THREE.Vector3();

    return (f) => {
      const E = f.ext as Ext;
      const t = f.t;
      // il pallone: posizione dal server, ammorbidita, gira mentre vola
      const bp = f.latest.get('pv_ball');
      if (bp) {
        if (!ball.seen || Math.hypot(bp.x - ball.x, bp.y - ball.y, bp.z - ball.z) > 9) Object.assign(ball, { x: bp.x, y: bp.y, z: bp.z, seen: true });
        const k = Math.min(1, f.dt * 13);
        const ox = ball.x;
        const oy = ball.y;
        const oz = ball.z;
        ball.x += (bp.x - ball.x) * k;
        ball.y += (bp.y - ball.y) * k;
        ball.z += (bp.z - ball.z) * k;
        const inv = 1 / Math.max(f.dt, 0.001);
        ball.vx = (ball.x - ox) * inv;
        ball.vy = (ball.y - oy) * inv;
        ball.vz = (ball.z - oz) * inv;
        const mx = ball.x - ox;
        const mz = ball.z - oz;
        const dist = Math.hypot(mx, mz);
        if (dist > 0.0005) {
          axis.set(mz, 0, -mx).normalize();
          spinQ.setFromAxisAngle(axis, dist / R);
          bmesh.quaternion.premultiply(spinQ);
        }
      }
      const serving = E?.phase === 'SERVE';
      bmesh.position.set(ball.x, ball.y + (serving ? Math.sin(t * 3) * 0.12 : 0), ball.z);
      bmesh.scale.setScalar(E?.phase === 'POINT' ? 1 + Math.max(0, Math.sin(t * 9)) * 0.04 : 1);
      // ombra sotto il pallone
      const hgt = Math.max(0, ball.y - R);
      blob.position.set(ball.x, 0.02, ball.z);
      blob.scale.setScalar(0.55 + hgt * 0.1);
      shadowM.opacity = Math.max(0.12, 0.5 - hgt * 0.05);
      // anello della battuta (si può battere quando diventa giallo)
      serveRing.visible = !!serving;
      if (serving && E) {
        serveRing.position.copy(bmesh.position);
        serveRing.rotation.set(Math.PI / 2, 0, t);
        serveRingM.color.set(f.now >= E.lock ? '#ffd60a' : '#ffffff');
        serveRing.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
      }
      // la rete trema quando la prende il pallone
      const nh = t - netHit;
      net.position.z = nh >= 0 && nh < 0.6 ? Math.sin(nh * 40) * 0.12 * (1 - nh / 0.6) : 0;
      seaTex.offset.set(t * 0.01, t * 0.006);
      floatG.position.y = -0.6 + Math.sin(t * 1.3) * 0.15;
      floatG.rotation.y = t * 0.1;
      for (const p of palms) (p.userData.crown as THREE.Group).rotation.z = Math.sin(t * 1.1 + p.rotation.y) * 0.05;
      for (const gull of gulls) {
        const a = t * 0.3 + gull.userData.ph;
        gull.position.set(Math.sin(a) * 26, 13 + Math.sin(t + gull.userData.ph) * 1.5, Math.cos(a) * 22);
        gull.rotation.y = a + Math.PI / 2;
        for (const w of gull.children) w.rotation.z = (w.userData.s as number) * Math.sin(t * 6 + gull.userData.ph) * 0.4;
      }
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  decorate(av, id, f) {
    const E = f.ext as Ext;
    wearVest(av, E?.team[id]);
    // dopo una schiacciata: braccia in alto
    const at = armsUp.get(id);
    if (at && performance.now() - at < 380) {
      av.armL.rotation.x = -2.9;
      av.armR.rotation.x = -3.1;
    }
  },
  status(h) {
    const E = h.ext as Ext;
    const t = E?.team[h.myId];
    if (!E || t === undefined) return null;
    if (E.phase === 'POINT') return null;
    if (E.phase === 'SERVE') {
      if (E.server === h.myId) return { text: h.now >= E.lock ? 'BATTI! VAI SOTTO IL PALLONE O SCHIACCIA' : 'TOCCA A TE BATTERE…', cls: 'sc-yellow pulse-soft' };
      if (h.view.playStart && h.now - h.view.playStart < 5000) return teamPill(t, `SEI DEI ${TEAM_NAME[t]}! NON FARLA CADERE`);
      return teamPill(E.serveTeam, `BATTUTA DEI ${TEAM_NAME[E.serveTeam]}`);
    }
    if (canPlay(E, h.myId, h.now) && inReach(h.me)) return { text: 'SCHIACCIA!', cls: 'sc-red pulse-soft' };
    if (ball.z * (t ? 1 : -1) > 0.5 && ball.vy < 0) return { text: 'SOTTO IL PALLONE! NON FARLA CADERE', cls: 'sc-yellow' };
    return null;
  },
  button(h) {
    const E = h.ext as Ext;
    const ok = canPlay(E, h.myId, h.now) && inReach(h.me);
    return {
      icon: (
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="20" cy="12" r="9" fill="#ffffff" stroke={INK} strokeWidth="3" />
          <path d="M20 3 q-5 9 0 18" fill="#ff3b5c" stroke={INK} strokeWidth="2" />
          <path d="M6 30 l9 -12 M3 22 l10 -6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </svg>
      ),
      label: 'SCHIACCIA',
      cls: ok ? 'sc-yellow' : 'sc-dark',
      size: ok ? 88 : 76,
      keyHint: 'E / CLIC',
      disabled: !ok,
      press: () => spikeNow(h),
    };
  },
  hud(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage === 'INTRO') return null;
    const mine = E.pts[h.myId] ?? 0;
    return <TeamScore score={E.score} myTeam={E.team[h.myId]} sub={mine ? `Primo a ${VOLLEY.target} · i tuoi punti: ${mine}` : `Primo a ${VOLLEY.target}`} />;
  },
  fx(p, c) {
    const E = c.view.ext as Ext;
    const myTeam = E?.team[c.myId];
    if (p.k === 'pv_hit') {
      const at = c.where(p.id);
      if (at && p.how !== 'a') dust(c.world, at.x, at.y, at.z, 6);
      burst(c.world, p.x, p.y, p.z, ['#ffffff', '#fff3b0'], 8, 3);
      if (Math.hypot(p.x - c.me.x, p.z - c.me.z) < 14) soundManager.playPop();
      if (p.how === 'm' && at) popText(c.world, at.x, at.y, at.z, 'OPS!', '#ff9f1c', { scale: 0.8 });
    } else if (p.k === 'pv_spike') {
      armsUp.set(p.id, performance.now());
      burst(c.world, p.x, p.y, p.z, ['#ffd60a', '#ffffff', TEAM_COL[E?.team[p.id] ?? 0]], 24, 6);
      popText(c.world, p.x, p.y - 1.5, p.z, 'SCHIACCIATA!', '#ffd60a', { scale: 1.1 });
      soundManager.playBonk();
      if (Math.hypot(p.x - c.me.x, p.z - c.me.z) < 8) c.shake(0.25);
    } else if (p.k === 'pv_net') {
      netHit = performance.now() / 1000;
      soundManager.playWhoosh();
    } else if (p.k === 'pv_point') {
      burst(c.world, p.x, 0.5, p.z, ['#f3d9a4', '#e9c46a', TEAM_COL[p.team], '#ffffff'], 60, 7);
      ringPulse(c.world, p.x, 0, p.z, TEAM_COL[p.team]);
      popText(c.world, p.x, 1, p.z, 'PUNTO!', TEAM_COL[p.team], { scale: 1.5, life: 1.4 });
      if (p.team === myTeam) soundManager.playSuccess();
      else soundManager.playFall();
      c.shake(0.35);
      c.feed(p.by ? `Punto ai ${TEAM_NAME[p.team]}! (${c.nameOf(p.by)})` : `Punto ai ${TEAM_NAME[p.team]}!`);
    } else if (p.k === 'pv_serve') {
      soundManager.playTick();
      if (p.id === c.myId) c.shake(0.15);
      else if (p.id) c.feed(`Batte ${c.nameOf(p.id)} (${TEAM_NAME[p.team]})`);
    }
  },
});
