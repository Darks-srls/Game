// ⚖️ La bilancia (telefono): il piatto con la focaccia gigante che pende (inclinazione dal server, ammorbidita),
// le lucine del bordo che diventano rosse dal lato basso, le polpette che piovono col bersaglio per terra,
// la nonna che gira intorno e dà la ciabattata sul bordo, la livella con la bolla
import * as THREE from 'three';
import { BIL, bilTiltX, bilTiltZ, bilY, setBilTilt } from '../../../data/minis/bilancia';
import { PHYS } from '../../../data/party3d';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, dust, makeNonna, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { balls: { id: number; x: number; z: number; f: number }[]; slam: { a: number; at: number } | null; nextSlam: number } | null;

const BULBS = 48;
// polpette viste dal telefono (ammorbidite) e l'ultima volta che una mi ha travolto
const ballPos = new Map<number, { x: number; y: number; z: number; vx: number; vz: number; seen: number }>();
let lastBonk = 0;
let wasGround = false;
let slamAnim = 0; // quando la nonna ha colpito (per l'animazione del braccio)

function focacciaTex() {
  return canvasTex(1024, 1024, (c) => {
    const g = c.createRadialGradient(512, 512, 120, 512, 512, 512);
    g.addColorStop(0, '#f2c46d');
    g.addColorStop(0.85, '#e7a94b');
    g.addColorStop(1, '#b8732c');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 1024);
    let s = 5;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // le fossette della focaccia (con l'olio)
    for (let k = 0; k < 260; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 480;
      const x = 512 + Math.cos(a) * r;
      const y = 512 + Math.sin(a) * r;
      c.fillStyle = 'rgba(150,85,20,0.45)';
      c.beginPath();
      c.ellipse(x, y, 13, 10, rnd() * 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,240,170,0.55)';
      c.beginPath();
      c.ellipse(x - 3, y - 3, 5, 3, 0, 0, Math.PI * 2);
      c.fill();
    }
    // rosmarino e sale grosso
    for (let k = 0; k < 120; k++) {
      c.save();
      c.translate(512 + (rnd() - 0.5) * 900, 512 + (rnd() - 0.5) * 900);
      c.rotate(rnd() * Math.PI);
      c.fillStyle = '#2f6b2f';
      c.fillRect(-9, -2, 18, 4);
      c.restore();
    }
    for (let k = 0; k < 300; k++) {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(512 + (rnd() - 0.5) * 920, 512 + (rnd() - 0.5) * 920, 3, 3);
    }
    // segni del centro (si capisce dove è il perno)
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(512, 512, 60, 0, Math.PI * 2);
    c.stroke();
  });
}

function dialTex() {
  return canvasTex(512, 512, (c) => {
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.arc(256, 256, 250, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 16;
    c.strokeStyle = '#1d0f3d';
    c.stroke();
    // zona verde, gialla, rossa
    const arc = (from: number, to: number, col: string) => {
      c.strokeStyle = col;
      c.lineWidth = 34;
      c.beginPath();
      c.arc(256, 256, 200, from, to);
      c.stroke();
    };
    arc(Math.PI * 0.75, Math.PI * 1.35, '#06d6a0');
    arc(Math.PI * 1.35, Math.PI * 1.8, '#ffd60a');
    arc(Math.PI * 1.8, Math.PI * 2.25, '#ff4d6d');
    c.fillStyle = '#1d0f3d';
    c.font = '900 64px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.fillText('KG', 256, 380);
  });
}

function meatTex() {
  return canvasTex(256, 128, (c) => {
    c.fillStyle = '#8a4b2a';
    c.fillRect(0, 0, 256, 128);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 500; k++) {
      const r = rnd();
      c.fillStyle = r < 0.33 ? '#6e3a1f' : r < 0.66 ? '#a45d34' : '#c0392b';
      c.beginPath();
      c.arc(rnd() * 256, rnd() * 128, 1 + rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
}

registerClientMini({
  kind: 'BILANCIA',
  orbit: { c: [0, 0, 0], r: 30 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ffd166" to="#d4a017">
      <path d="M50 52 L50 84 M36 86 L64 86" {...stroke} strokeWidth={7} />
      <path d="M14 46 L86 30" {...stroke} strokeWidth={8} stroke="#b07a2a" />
      <path d="M14 46 L86 30" stroke="#f4c27a" strokeWidth={4} strokeLinecap="round" />
      <circle cx="50" cy="40" r="5" fill="#d4a017" {...stroke} />
      <circle cx="74" cy="22" r="9" fill="#8a4b2a" {...stroke} />
      <path d="M67 18 q7 -6 14 0" fill="#d62828" />
      <path d="M18 60 l-6 8 M26 62 l-2 9" {...stroke} stroke="#ffffff" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto · E schiaffo (rilancia le polpette) · non stare dal lato basso',
  feed: {
    caduto: ['{n} è scivolato giù dal piatto', '{n} ha perso l’equilibrio', '{n} è finito giù dalla bilancia'],
  },
  build(world) {
    const g = world.arena;
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -17;
    sh.right = sh.top = 17;
    // ---- il piatto (tutto quello che pende sta in "plate")
    const plate = new THREE.Group();
    g.add(plate);
    const crust = toy('#c98a3f', { roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(BIL.r, BIL.r - 0.25, 0.7, 96), [crust, toy('#ffffff', { map: focacciaTex(), roughness: 0.55, clearcoat: 0.35 }), crust]);
    top.position.y = -0.35;
    const brass = new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.85, roughness: 0.25, emissive: '#3d2a00', emissiveIntensity: 0.2 });
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(BIL.r + 0.45, BIL.r - 0.4, 0.5, 96), brass);
    pan.position.y = -0.85;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BIL.r + 0.4, 0.16, 10, 128), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.55;
    plate.add(shadowy(top), shadowy(pan), rim);
    // lucine del bordo (rosse dal lato che scende)
    // (materiale senza luci: il colore di ogni lucina è quello dell'istanza, un po' sopra 1 per il bagliore)
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false }), BULBS);
    const dummy = new THREE.Object3D();
    const bulbXZ: { x: number; z: number }[] = [];
    for (let k = 0; k < BULBS; k++) {
      const a = (k / BULBS) * Math.PI * 2;
      bulbXZ.push({ x: Math.sin(a) * (BIL.r + 0.4), z: Math.cos(a) * (BIL.r + 0.4) });
      dummy.position.set(bulbXZ[k].x, -0.35, bulbXZ[k].z);
      dummy.updateMatrix();
      bulbs.setMatrixAt(k, dummy.matrix);
      bulbs.setColorAt(k, new THREE.Color('#ffd60a'));
    }
    plate.add(bulbs);
    const bulbCol = new THREE.Color();
    // il perno e la bilancia rossa sotto, con il quadrante
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 9, 24), brass);
    column.position.y = -5.4;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16), brass);
    ball.position.y = -1.3;
    const body = outlined(new THREE.Mesh(rbox(10, 7, 10, 1.4), toy('#e63946', { clearcoat: 0.8 })), 1.02);
    body.position.y = -13;
    g.add(shadowy(column), ball, shadowy(body));
    const needles: THREE.Group[] = [];
    for (const sz of [-1, 1]) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(3.1, 48), new THREE.MeshStandardMaterial({ map: dialTex(), roughness: 0.4 }));
      dial.position.set(0, -12.6, sz * 5.06);
      if (sz < 0) dial.rotation.y = Math.PI;
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.25, 10, 48), brass);
      bezel.position.copy(dial.position);
      bezel.rotation.y = dial.rotation.y;
      const needle = new THREE.Group();
      const n = new THREE.Mesh(rbox(0.22, 2.6, 0.1, 0.05), toy('#1d0f3d'));
      n.position.y = 1.2;
      needle.add(n);
      needle.position.set(0, -12.6, sz * 5.15);
      needle.rotation.y = dial.rotation.y;
      g.add(dial, bezel, needle);
      needles.push(needle);
    }
    // il bancone laggiù, con la farina, i pomodori e i palloncini
    const tiles = canvasTex(256, 256, (c) => {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          c.fillStyle = (x + y) % 2 ? '#3a86ff' : '#f1f5ff';
          c.fillRect(x * 64, y * 64, 64, 64);
        }
    }, [24, 24]);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(140, 48), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -16.5;
    floor.receiveShadow = true;
    g.add(floor);
    const deco: THREE.Object3D[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.5;
      const r = 24 + (k % 3) * 4;
      let o: THREE.Object3D;
      if (k % 3 === 0) {
        o = outlined(new THREE.Mesh(new THREE.SphereGeometry(3, 24, 18), toy('#e63946')), 1.03);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 5), toy('#2d8a3e'));
        leaf.position.y = 3;
        o.add(leaf);
        o.position.y = -13.5;
      } else if (k % 3 === 1) {
        o = new THREE.Mesh(rbox(5, 7, 4, 1.2), toy('#f8f4e3'));
        const band = new THREE.Mesh(rbox(5.1, 1.6, 4.1, 0.2), toy('#3a86ff'));
        band.position.y = 0.6;
        o.add(band);
        o.position.y = -13;
      } else {
        o = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3, 5, 32), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.85, roughness: 0.25 }));
        o.position.y = -14;
      }
      o.position.x = Math.sin(a) * r;
      o.position.z = Math.cos(a) * r;
      o.userData.ph = k;
      deco.push(o);
      g.add(shadowy(o));
    }
    const balloons: THREE.Group[] = [];
    for (let k = 0; k < 8; k++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff'][k % 4]);
      const a = (k / 8) * Math.PI * 2 + 0.2;
      b.position.set(Math.sin(a) * (BIL.r + 9), 4 + (k % 3) * 2, Math.cos(a) * (BIL.r + 9));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // ---- la nonna che gira intorno con la ciabatta
    const nonna = makeNonna();
    nonna.scale.setScalar(4.6);
    g.add(nonna);
    world.camBlockers.push(nonna);
    let nonnaA = Math.PI;
    const slamRing = new THREE.Mesh(new THREE.RingGeometry(BIL.slamR - 0.35, BIL.slamR, 48), new THREE.MeshBasicMaterial({ color: '#ff1744', transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    slamRing.rotation.x = -Math.PI / 2;
    const slamDisc = new THREE.Mesh(new THREE.CircleGeometry(BIL.slamR, 48), new THREE.MeshBasicMaterial({ color: '#ff1744', transparent: true, opacity: 0.2, depthWrite: false }));
    slamDisc.position.z = -0.01;
    slamRing.add(slamDisc);
    slamRing.visible = false;
    g.add(slamRing);
    // ---- polpette (una mesh per polpetta viva) e bersagli per terra
    const meatGeo = new THREE.IcosahedronGeometry(BIL.ballR, 2);
    const meatMat = new THREE.MeshStandardMaterial({ map: meatTex(), roughness: 0.8 });
    const capGeo = new THREE.SphereGeometry(BIL.ballR * 1.02, 18, 8, 0, Math.PI * 2, 0, 0.85);
    const capMat = toy('#d62828', { roughness: 0.15, clearcoat: 1 });
    const balls = new Map<number, { root: THREE.Group; spin: THREE.Group; mark: THREE.Mesh }>();
    const markGeo = new THREE.RingGeometry(0.9, 1.25, 32);
    const markMat = new THREE.MeshBasicMaterial({ color: '#ff1744', transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3();
    let tx = 0;
    let tz = 0;

    return (f) => {
      const E = f.ext as Ext;
      // ---- inclinazione: dal server, ammorbidita (e la uso anche per la mia fisica)
      const tp = f.latest.get('bil_tilt');
      if (tp) {
        const k = Math.min(1, f.dt * 10);
        // un pizzico avanti (la rete arriva in ritardo)
        tx += (tp.x + tp.r * 0.06 - tx) * k;
        tz += (tp.z + tp.a * 0.06 - tz) * k;
      } else if (f.view.stage === 'INTRO') {
        tx *= 0.9;
        tz *= 0.9;
      }
      setBilTilt(tx, tz);
      n.set(tx, 1, tz).normalize();
      plate.quaternion.setFromUnitVectors(up, n);
      // lucine: rosse e lampeggianti dal lato che scende
      const blink = Math.sin(f.t * 14) > 0;
      for (let k = 0; k < BULBS; k++) {
        const y = bilY(bulbXZ[k].x, bulbXZ[k].z);
        bulbCol.set(y < -1.6 ? (blink ? '#ff1744' : '#5a0010') : y < -0.6 ? '#ff9f1c' : (k + Math.floor(f.t * 3)) % 4 ? '#ffd60a' : '#ffffff');
        bulbs.setColorAt(k, bulbCol);
      }
      bulbs.instanceColor!.needsUpdate = true;
      const deg = (Math.atan(Math.hypot(tx, tz)) * 180) / Math.PI;
      // la lancetta: da inizio verde (0°) a fine rosso (20°)
      for (const nd of needles) nd.rotation.z = -(Math.PI * 0.75 + (Math.min(20, deg) / 20) * Math.PI * 1.5) - Math.PI / 2;
      // ---- polpette
      const live = new Set<number>();
      for (const b of E?.balls ?? []) {
        live.add(b.id);
        let m = balls.get(b.id);
        if (!m) {
          const root = new THREE.Group();
          const spin = new THREE.Group();
          const meat = outlined(new THREE.Mesh(meatGeo, meatMat), 1.05);
          const cap = new THREE.Mesh(capGeo, capMat);
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), toy('#2d6a4f'));
          leaf.scale.set(1, 0.3, 0.6);
          leaf.position.y = BIL.ballR * 1.03;
          spin.add(meat, cap, leaf);
          root.add(spin);
          shadowy(root, true, false);
          const mark = new THREE.Mesh(markGeo, markMat);
          mark.rotation.x = -Math.PI / 2;
          g.add(root, mark);
          m = { root, spin, mark };
          balls.set(b.id, m);
          ballPos.set(b.id, { x: b.x, y: BIL.ballDrop, z: b.z, vx: 0, vz: 0, seen: f.t });
        }
        const lp = f.latest.get(`bil_b${b.id}`);
        const bp = ballPos.get(b.id)!;
        if (lp) {
          const k = Math.min(1, f.dt * 14);
          const ox = bp.x;
          const oz = bp.z;
          bp.x += (lp.x - bp.x) * k;
          bp.y += (lp.y - bp.y) * k;
          bp.z += (lp.z - bp.z) * k;
          bp.vx = (bp.x - ox) / Math.max(f.dt, 0.001);
          bp.vz = (bp.z - oz) / Math.max(f.dt, 0.001);
          m.spin.rotation.x = lp.r;
          m.root.rotation.y = lp.a;
        }
        m.root.position.set(bp.x, bp.y, bp.z);
        // bersaglio dove cadrà
        m.mark.visible = b.f === 1;
        if (b.f === 1) {
          const k = 1 - Math.max(0, Math.min(1, bp.y / BIL.ballDrop));
          m.mark.position.set(b.x, bilY(b.x, b.z) + 0.06, b.z);
          m.mark.scale.setScalar(0.6 + k * 0.6);
          markMat.opacity = 0.5 + Math.sin(f.t * 18) * 0.4;
        }
      }
      for (const [id, m] of balls)
        if (!live.has(id)) {
          g.remove(m.root, m.mark);
          balls.delete(id);
          ballPos.delete(id);
        }
      // ---- la nonna: va dove colpirà, alza la ciabatta, poi giù
      const slam = E?.slam ?? null;
      if (slam) {
        let d = slam.a - nonnaA;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        nonnaA += d * Math.min(1, f.dt * 3);
      } else nonnaA += f.dt * 0.15;
      nonna.position.set(Math.sin(nonnaA) * (BIL.r + 6.5), -9.5, Math.cos(nonnaA) * (BIL.r + 6.5));
      nonna.rotation.y = nonnaA + Math.PI;
      const since = f.t - slamAnim;
      const arm = nonna.userData.arm as THREE.Group;
      if (since < 0.6) arm.rotation.x = -1.3 + since * 0.5;
      else if (slam) arm.rotation.x = -3 + Math.sin(f.t * 9) * 0.25;
      else arm.rotation.x = -0.5 + Math.sin(f.t * 2) * 0.12;
      slamRing.visible = !!slam && f.view.stage === 'PLAY';
      if (slam) {
        const sx = Math.sin(slam.a) * (BIL.r - BIL.slamR * 0.55);
        const sz = Math.cos(slam.a) * (BIL.r - BIL.slamR * 0.55);
        slamRing.position.set(sx, bilY(sx, sz) + 0.08, sz);
        (slamRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(f.t * 16) * 0.4;
        slamRing.scale.setScalar(0.85 + Math.min(1, Math.max(0, 1 - (slam.at - f.now) / BIL.slamWarn)) * 0.15);
      }
      for (const o of deco) o.rotation.y = Math.sin(f.t * 0.4 + o.userData.ph) * 0.3;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.5;
    };
  },
  // gli altri: appoggiati al MIO piatto (il server li mette sul suo, che è un attimo avanti)
  decorate(av, id, f) {
    if (id === f.myId) return;
    const p = av.root.position;
    const y = bilY(p.x, p.z);
    if (Math.abs(p.y - y) < 0.7 && p.x * p.x + p.z * p.z < BIL.r * BIL.r) p.y = y;
  },
  local(f, world) {
    const me = f.me;
    const alive = f.view.stage === 'PLAY' && f.view.alive[f.myId];
    // il piatto che scende si stacca dai piedi: riaggancio
    if (alive && !me.ground && me.vy <= 0 && wasGround && me.x * me.x + me.z * me.z < BIL.r * BIL.r) {
      const g = bilY(me.x, me.z);
      if (me.y > g && me.y - g < 0.35) {
        me.y = g;
        me.vy = 0;
        me.ground = true;
        me.airJumps = 0;
      }
    }
    wasGround = me.ground;
    if (!alive) return;
    // le polpette mi travolgono qui sul telefono (subito, come le vedo)
    for (const [, b] of ballPos) {
      const dx = me.x - b.x;
      const dz = me.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d > BIL.ballR + PHYS.radius || me.y > b.y + BIL.ballR * 0.55 || me.y + 1.7 < b.y - BIL.ballR) continue;
      if (Date.now() - lastBonk < 650 || (me.dashT ?? 0) > 0) continue;
      lastBonk = Date.now();
      const nx = d > 0.01 ? dx / d : 1;
      const nz = d > 0.01 ? dz / d : 0;
      const sp = Math.hypot(b.vx, b.vz);
      const pw = 8.5 + Math.min(10, sp) * 0.8 + (b.y > bilY(b.x, b.z) + BIL.ballR + 0.5 ? 4 : 0);
      me.kx += nx * pw + b.vx * 0.4;
      me.kz += nz * pw + b.vz * 0.4;
      me.vy = Math.max(me.vy, 6);
      me.ground = false;
      soundManager.playBonk();
      popText(world, me.x, me.y, me.z, 'BOING!', '#ffd60a');
    }
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    const E = h.ext as Ext;
    const me = h.me;
    if (E?.slam) {
      const sx = Math.sin(E.slam.a) * BIL.r;
      const sz = Math.cos(E.slam.a) * BIL.r;
      if (Math.hypot(me.x - sx, me.z - sz) < BIL.slamR + 3) return { text: 'LA NONNA STA PER COLPIRE: SCAPPA!', cls: 'sc-red pulse-soft' };
    }
    for (const b of E?.balls ?? []) if (b.f && Math.hypot(me.x - b.x, me.z - b.z) < BIL.ballR + 1.8) return { text: 'POLPETTA IN ARRIVO!', cls: 'sc-red pulse-soft' };
    const tx = bilTiltX();
    const tz = bilTiltZ();
    const deg = (Math.atan(Math.hypot(tx, tz)) * 180) / Math.PI;
    if (deg > 9 && tx * me.x + tz * me.z > 3) return { text: 'SCIVOLI! VAI VERSO IL LATO ALTO', cls: 'sc-yellow pulse-soft' };
    if (E?.slam) return { text: 'CIABATTATA IN ARRIVO SUL BORDO', cls: 'sc-purple' };
    return { text: 'TIENI IN EQUILIBRIO IL PIATTO', cls: 'sc-dark' };
  },
  // la livella: la bolla va verso il lato alto (girata come la telecamera)
  hud(h: HudCtx) {
    if (h.view.stage !== 'PLAY') return null;
    const tx = bilTiltX();
    const tz = bilTiltZ();
    const deg = (Math.atan(Math.hypot(tx, tz)) * 180) / Math.PI;
    const fx = Math.sin(h.yaw);
    const fz = Math.cos(h.yaw);
    // destra sullo schermo = (-fz, fx), avanti = (fx, fz); la bolla va dalla parte opposta alla discesa
    const k = 26 / Math.tan((20 * Math.PI) / 180);
    let bx = -(tx * -fz + tz * fx) * k;
    let by = (tx * fx + tz * fz) * k;
    const bl = Math.hypot(bx, by);
    if (bl > 26) {
      bx *= 26 / bl;
      by *= 26 / bl;
    }
    const col = deg < 6 ? '#06d6a0' : deg < 12 ? '#ffd60a' : '#ff4d6d';
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col items-center gap-1">
        <svg width="78" height="78" viewBox="-39 -39 78 78" aria-hidden="true">
          <circle r="36" fill="#1d0f3d" opacity="0.6" />
          <circle r="34" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
          <circle r="12" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
          <path d="M-34 0 H34 M0 -34 V34" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
          <circle cx={bx} cy={by} r="8" fill={col} stroke="#1d0f3d" strokeWidth="3" />
          <circle cx={bx - 2.5} cy={by - 2.5} r="2.5" fill="#ffffff" opacity="0.8" />
        </svg>
        <span className="sc-chip px-2 py-0.5 text-[11px] font-black text-white">{deg.toFixed(0)}°</span>
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'bil_drop') {
      if (Math.hypot(c.me.x - p.x, c.me.z - p.z) < 10) soundManager.playWhoosh();
    } else if (p.k === 'bil_thud') {
      const y = bilY(p.x, p.z);
      burst(c.world, p.x, y + 0.3, p.z, ['#d62828', '#8a4b2a', '#ff8a7a'], 30, 6);
      dust(c.world, p.x, y, p.z, 8);
      const d = Math.hypot(c.me.x - p.x, c.me.z - p.z);
      c.shake(d < 6 ? 0.6 : 0.25);
      soundManager.playBonk();
    } else if (p.k === 'bil_bonk') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y, at.z, 'BOING!', '#ffd60a');
      const av = c.avatar(p.id);
      if (av) av.shockUntil = performance.now() + 900;
    } else if (p.k === 'bil_kick') {
      popText(c.world, p.x, p.y, p.z, 'VAI POLPETTA!', '#ff9f1c', { scale: 0.9 });
      soundManager.playPop();
    } else if (p.k === 'bil_slam') {
      slamAnim = performance.now() / 1000;
      const sx = Math.sin(p.a) * BIL.r;
      const sz = Math.cos(p.a) * BIL.r;
      const y = bilY(sx, sz);
      burst(c.world, sx, y + 0.5, sz, ['#ff8fab', '#ff4d6d', '#ffffff', '#ffd60a'], 50, 9);
      ringPulse(c.world, sx, y, sz, '#ff4d6d');
      popText(c.world, sx, y + 1, sz, 'CIABATTATA!', '#ff4d6d', { scale: 1.3 });
      soundManager.playBoom();
      c.shake(Math.hypot(c.me.x - sx, c.me.z - sz) < 7 ? 0.9 : 0.4);
    }
  },
});
