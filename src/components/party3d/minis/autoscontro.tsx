// 🚗 Autoscontro (telefono): granita gigante che si scioglie dai bordi, luna park intorno, auto dello scontro con la scintilla, BONK!
import * as THREE from 'three';
import { AUTO, autoRadius } from '../../../data/minis/autoscontro';
import { ANIM } from '../../../data/party3d';
import { haptic, soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, flagLine, glow, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { ko: Record<string, number> } | null;

const bonkAt = new Map<string, number>(); // quando è stata urtata ogni auto (per farla traballare)
let lastBig = 0;

// ---------------------------------------------------------------- l'auto dello scontro (geometrie e materiali condivisi da tutte)
let KIT: {
  tub: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  bumper: THREE.BufferGeometry;
  hood: THREE.BufferGeometry;
  seat: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  column: THREE.BufferGeometry;
  pole: THREE.BufferGeometry;
  ball: THREE.BufferGeometry;
  spark: THREE.BufferGeometry;
  flame: THREE.BufferGeometry;
  rubber: THREE.Material;
  chrome: THREE.Material;
  seatM: THREE.Material;
  dark: THREE.Material;
  lamp: THREE.Material;
  sparkM: THREE.MeshBasicMaterial;
  flameM: THREE.MeshBasicMaterial;
  bodies: Map<string, THREE.Material>;
} | null = null;

function kit() {
  if (KIT) return KIT;
  const tub = new THREE.CylinderGeometry(0.9, 0.78, 0.62, 28);
  const hood = new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  hood.scale(1, 0.5, 0.75);
  const flame = new THREE.ConeGeometry(0.2, 0.9, 10);
  flame.rotateX(-Math.PI / 2);
  KIT = {
    tub,
    rim: new THREE.TorusGeometry(0.84, 0.07, 8, 32),
    bumper: new THREE.TorusGeometry(0.95, 0.17, 10, 36),
    hood,
    seat: rbox(0.95, 0.75, 0.2, 0.09),
    wheel: new THREE.TorusGeometry(0.2, 0.045, 8, 20),
    column: new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8),
    pole: new THREE.CylinderGeometry(0.04, 0.05, 2.5, 8),
    ball: new THREE.SphereGeometry(0.09, 10, 8),
    spark: new THREE.OctahedronGeometry(0.13, 0),
    flame,
    rubber: toy('#262338', { roughness: 0.7, clearcoat: 0.1 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#dfe7f2', metalness: 0.9, roughness: 0.2 }),
    seatM: toy('#2b2d42', { roughness: 0.55 }),
    dark: toy('#1d1b2c'),
    lamp: glow('#fff3b0', 1.3),
    sparkM: new THREE.MeshBasicMaterial({ color: '#6fc8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    flameM: new THREE.MeshBasicMaterial({ color: '#ff9f1c', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    bodies: new Map(),
  };
  return KIT;
}

function makeCar(color: string) {
  const K = kit();
  let body = K.bodies.get(color);
  if (!body) {
    body = toy(color, { clearcoat: 0.9, clearcoatRoughness: 0.12, roughness: 0.3 });
    K.bodies.set(color, body);
  }
  const g = new THREE.Group();
  g.name = 'auto-car';
  const car = new THREE.Group(); // si inclina nelle curve e traballa negli urti
  g.add(car);
  const tub = outlined(new THREE.Mesh(K.tub, body), 1.04);
  tub.position.y = 0.5;
  const rim = new THREE.Mesh(K.rim, K.chrome);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.82;
  const bump = new THREE.Mesh(K.bumper, K.rubber);
  bump.rotation.x = Math.PI / 2;
  bump.position.y = 0.32;
  const hood = outlined(new THREE.Mesh(K.hood, body), 1.05);
  hood.position.set(0, 0.8, 0.42);
  const seat = new THREE.Mesh(K.seat, K.seatM);
  seat.position.set(0, 1.05, -0.58);
  seat.rotation.x = -0.15;
  const wheel = new THREE.Mesh(K.wheel, K.dark);
  wheel.position.set(0, 0.96, 0.5);
  wheel.rotation.x = -0.75;
  const column = new THREE.Mesh(K.column, K.dark);
  column.position.set(0, 0.8, 0.62);
  column.rotation.x = -0.75;
  car.add(tub, rim, bump, hood, seat, wheel, column);
  for (const x of [-0.3, 0.3]) {
    const l = new THREE.Mesh(K.ball, K.lamp);
    l.position.set(x, 0.72, 0.86);
    l.scale.setScalar(1.3);
    car.add(l);
  }
  // il palo con la scintilla in cima (come quelli veri sotto la rete elettrica)
  const pole = new THREE.Mesh(K.pole, K.chrome);
  pole.position.set(0, 1.95, -0.78);
  const tip = new THREE.Mesh(K.ball, K.chrome);
  tip.position.set(0, 3.2, -0.78);
  const spark = new THREE.Mesh(K.spark, K.sparkM);
  spark.position.set(0, 3.32, -0.78);
  const flame = new THREE.Mesh(K.flame, K.flameM);
  flame.position.set(0, 0.45, -1.25);
  flame.visible = false;
  car.add(pole, tip, spark, flame);
  shadowy(car, true, false);
  g.userData = { car, spark, flame, yaw: 0, roll: 0, lean: 0 };
  return g;
}

// ---------------------------------------------------------------- texture della pista
function granitaTexture() {
  return canvasTex(1024, 1024, (c) => {
    const cx = 512;
    const g = c.createRadialGradient(cx, cx, 40, cx, cx, 512);
    g.addColorStop(0, '#fff2bd');
    g.addColorStop(0.55, '#fff3a8');
    g.addColorStop(1, '#ffe066');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 1024);
    // anelli di fragola e menta (pista da luna park)
    const rings: [number, string][] = [
      [470, '#ff6b8b'],
      [330, '#7bdcb5'],
      [190, '#ff6b8b'],
    ];
    for (const [r, col] of rings) {
      c.strokeStyle = col;
      c.globalAlpha = 0.55;
      c.lineWidth = 26;
      c.setLineDash([60, 38]);
      c.beginPath();
      c.arc(cx, cx, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([]);
    c.globalAlpha = 1;
    // cristalli di ghiaccio che luccicano
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 505;
      c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(255,214,10,0.45)';
      const w = 3 + rnd() * 7;
      c.fillRect(cx + Math.cos(a) * r, cx + Math.sin(a) * r, w, w * (0.4 + rnd()));
    }
    // fettine di limone
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const x = cx + Math.cos(a) * 400;
      const y = cx + Math.sin(a) * 400;
      c.fillStyle = '#fff6b0';
      c.strokeStyle = '#f2c200';
      c.lineWidth = 10;
      c.beginPath();
      c.arc(x, y, 38, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(242,194,0,0.7)';
      c.lineWidth = 4;
      for (let k = 0; k < 8; k++) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos((k / 8) * Math.PI * 2) * 32, y + Math.sin((k / 8) * Math.PI * 2) * 32);
        c.stroke();
      }
    }
    // la scritta al centro
    c.save();
    c.translate(cx, cx);
    c.font = '900 92px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 18;
    c.strokeStyle = '#1d0f3d';
    c.strokeText('BONK!', 0, 0);
    c.fillStyle = '#ff4d6d';
    c.fillText('BONK!', 0, -4);
    c.restore();
  });
}

const sideTexture = () =>
  canvasTex(
    512,
    128,
    (c) => {
      c.fillStyle = '#fff6c9';
      c.fillRect(0, 0, 512, 128);
      // colature di sciroppo
      c.fillStyle = '#ff6b8b';
      c.fillRect(0, 0, 512, 22);
      for (let i = 0; i < 16; i++) {
        const x = i * 32 + 10;
        const h = 30 + ((i * 37) % 50);
        c.beginPath();
        c.moveTo(x - 9, 20);
        c.lineTo(x - 9, h);
        c.arc(x, h, 9, Math.PI, 0, true);
        c.lineTo(x + 9, 20);
        c.fill();
      }
    },
    [10, 1],
  );

// ruota panoramica sullo sfondo
function ferrisWheel() {
  const g = new THREE.Group();
  const wheel = new THREE.Group();
  const frame = toy('#ffffff', { metalness: 0.2 });
  const rimG = new THREE.TorusGeometry(11, 0.25, 8, 64);
  for (const z of [-1, 1]) {
    const rim = new THREE.Mesh(rimG, frame);
    rim.position.z = z;
    wheel.add(rim);
  }
  const spokeG = new THREE.CylinderGeometry(0.12, 0.12, 22, 6);
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(spokeG, frame);
    s.rotation.z = (i / 8) * Math.PI;
    wheel.add(s);
  }
  const cabins: THREE.Object3D[] = [];
  const cabG = rbox(1.8, 1.6, 1.6, 0.4);
  const cols = ['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff70a6', '#8338ec'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cab = new THREE.Mesh(cabG, toy(cols[i % cols.length]));
    cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11 - 1.2, 0);
    wheel.add(cab);
    cabins.push(cab);
  }
  const bulbG = new THREE.SphereGeometry(0.22, 8, 6);
  const bulbM = glow('#fff3b0', 2.6);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const b = new THREE.Mesh(bulbG, bulbM);
    b.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 1.3);
    wheel.add(b);
  }
  wheel.position.y = 14;
  const legG = new THREE.CylinderGeometry(0.35, 0.5, 15, 8);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legG, toy('#ff4d6d'));
    leg.position.set(s * 4, 7, 0);
    leg.rotation.z = s * 0.27;
    g.add(leg);
  }
  g.add(wheel);
  g.userData = { wheel, cabins };
  return g;
}

// tendone a righe
function tent(c1: string, c2: string) {
  const g = new THREE.Group();
  const stripes = canvasTex(256, 64, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? c1 : c2;
      c.fillRect(i * 32, 0, 32, 64);
    }
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4.5, 24, 1, true), toy('#ffffff', { map: stripes, side: THREE.DoubleSide }));
  base.position.y = 2.25;
  const roof = outlined(new THREE.Mesh(new THREE.ConeGeometry(6, 4.5, 24), toy('#ffffff', { map: stripes })), 1.03);
  roof.position.y = 6.7;
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 3), toy('#ffd60a'));
  flag.position.y = 9.4;
  flag.rotation.z = Math.PI / 2;
  g.add(base, roof, flag);
  return shadowy(g);
}

// insegna luminosa "AUTOSCONTRO"
function sign() {
  const g = new THREE.Group();
  const tex = canvasTex(1024, 256, (c) => {
    c.fillStyle = '#2b0f4d';
    c.beginPath();
    c.roundRect(8, 8, 1008, 240, 60);
    c.fill();
    c.font = '900 150px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 26;
    c.strokeStyle = '#ff4d6d';
    c.strokeText('AUTOSCONTRO', 512, 136);
    c.fillStyle = '#fff3b0';
    c.fillText('AUTOSCONTRO', 512, 130);
  });
  const panel = outlined(new THREE.Mesh(rbox(16, 4, 0.5, 0.4), [toy('#ffd60a'), toy('#ffd60a'), toy('#ffd60a'), toy('#ffd60a'), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), toy('#ffd60a')]), 1.02);
  panel.position.y = 12;
  const postG = new THREE.CylinderGeometry(0.3, 0.3, 12, 8);
  for (const x of [-6, 6]) {
    const p = new THREE.Mesh(postG, toy('#3a86ff'));
    p.position.set(x, 6, 0);
    g.add(p);
  }
  const bulbG = new THREE.SphereGeometry(0.2, 8, 6);
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const x = t < 0.5 ? -8 + t * 2 * 16 : 8 - (t - 0.5) * 2 * 16;
    const y = t < 0.5 ? 14.1 : 9.9;
    const b = new THREE.Mesh(bulbG, glow(i % 2 ? '#ffd60a' : '#ff4d6d', 2.5));
    b.position.set(x, y, 0.3);
    bulbs.push(b);
    g.add(b);
  }
  g.add(panel);
  g.userData.bulbs = bulbs;
  return shadowy(g, true, false);
}

registerClientMini({
  kind: 'AUTOSCONTRO',
  orbit: { c: [0, 0, 0], r: 30 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#70d6ff" to="#3a86ff">
      <path d="M58 18 L62 6 M62 6 l-6 3 M62 6 l4 5" stroke="#ffd60a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M60 20 V44" stroke="#dfe7f2" strokeWidth="4" />
      <ellipse cx="50" cy="66" rx="34" ry="13" fill="#262338" {...stroke} />
      <path d="M22 62 Q24 42 50 42 Q76 42 78 62 Q50 72 22 62 Z" fill="#ff4d6d" {...stroke} />
      <circle cx="40" cy="38" r="8" fill="#ffd23f" {...stroke} />
      <path d="M26 54 Q36 50 46 54" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M78 34 l8 -6 M82 44 l10 0 M80 24 l4 -8" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
    </Badge>
  ),
  hint: 'WASD guida (si scivola!) · Shift TURBO · spazio saltello · sperona gli altri giù dalla granita',
  feed: {
    caduto: ['{n} è finito nello sciroppo', '{n} è volato giù dalla granita', 'BONK! {n} è fuori pista'],
  },
  build(world) {
    const g = world.arena;
    const R0 = AUTO.r0;
    // la granita: un disco di ghiaccio al limone che si scioglie dai bordi
    const rink = new THREE.Group();
    // (poco lucida: con il sole sopra una granita a specchio abbagliava tutta la pista)
    const top = toy('#ffffff', { map: granitaTexture(), roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.6 });
    const side = toy('#ffffff', { map: sideTexture(), roughness: 0.4 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 * 0.94, 1.4, 96), [side, top, toy('#ffe9a8')]);
    disc.position.y = -0.7;
    disc.receiveShadow = true;
    rink.add(disc);
    // bordo che brilla (rosso quando si scioglie)
    const edgeM = glow('#ffd60a', 1.0);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.13, 8, 128), edgeM);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.04;
    rink.add(edge);
    g.add(rink);
    // luci da luna park tutto intorno (si rincorrono)
    const NB = 72;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), NB);
    const bulbCols = ['#ff4d6d', '#ffd60a', '#70d6ff'].map((c) => new THREE.Color(c).multiplyScalar(1.4));
    const dim = new THREE.Color('#5a4a6a');
    const dummy = new THREE.Object3D();
    let bulbR = -1;
    let bulbStep = -1;
    g.add(bulbs);
    // il bicchiere sotto (più stretto della pista: non ci si può salire)
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 1.6, 9, 40, 1, true), toy('#ffffff', { transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }));
    cup.position.y = -5.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 20), toy('#ffd6e0', { roughness: 0.2 }));
    stem.position.y = -13;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 0.8, 40), toy('#ffd6e0', { roughness: 0.2 }));
    foot.position.y = -16.2;
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 18, 12), toy('#ff4d6d'));
    straw.position.set(-R0 - 20, -8, -10);
    straw.rotation.z = 0.35;
    g.add(cup, stem, foot, straw);
    // mare di sciroppo di fragola, laggiù
    const seaGeo = new THREE.PlaneGeometry(320, 320, 48, 48);
    const sea = new THREE.Mesh(seaGeo, toy('#ff4f7b', { roughness: 0.15, clearcoat: 1, emissive: '#7a0f2e', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -20;
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    // fette di limone e foglie di menta che galleggiano
    const floaters: THREE.Object3D[] = [];
    const lemonM = toy('#fff27a', { roughness: 0.3 });
    const peelM = toy('#ffd000');
    const mintM = toy('#2ec27e');
    for (let i = 0; i < 14; i++) {
      const o = new THREE.Group();
      if (i % 2) {
        const slice = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24), [peelM, lemonM, lemonM]);
        o.add(slice);
      } else {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), mintM);
        leaf.scale.set(1, 0.18, 0.55);
        o.add(leaf);
      }
      const a = (i / 14) * Math.PI * 2;
      const r = 20 + (i % 3) * 7;
      o.position.set(Math.sin(a) * r, -19.6, Math.cos(a) * r);
      o.userData.ph = i * 1.3;
      floaters.push(o);
      g.add(o);
    }
    // luna park: ruota panoramica, tendoni, insegna, bandierine, palloncini
    const wheel = ferrisWheel();
    wheel.position.set(-26, -8, 34);
    wheel.rotation.y = 0.5;
    g.add(wheel);
    const t1 = tent('#ff4d6d', '#ffffff');
    t1.position.set(30, -10, 20);
    const t2 = tent('#3a86ff', '#ffd60a');
    t2.position.set(24, -10, -32);
    t2.scale.setScalar(0.8);
    g.add(t1, t2);
    const sg = sign();
    sg.position.set(0, -6, R0 + 17);
    sg.rotation.y = Math.PI;
    g.add(sg);
    for (let i = 0; i < 4; i++) {
      const a1 = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const a2 = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
      // (lontane e alte: la telecamera dietro di me non ci passa in mezzo)
      g.add(flagLine(new THREE.Vector3(Math.sin(a1) * (R0 + 14), 15, Math.cos(a1) * (R0 + 14)), new THREE.Vector3(Math.sin(a2) * (R0 + 14), 15, Math.cos(a2) * (R0 + 14)), 18));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 32, 8), toy('#ffffff'));
      pole.position.set(Math.sin(a1) * (R0 + 14), -1, Math.cos(a1) * (R0 + 14));
      g.add(pole);
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 10; i++) {
      const b = balloon(['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff70a6'][i % 5]);
      const a = (i / 10) * Math.PI * 2 + 0.2;
      b.position.set(Math.sin(a) * (R0 + 16), 8 + (i % 3) * 2.5, Math.cos(a) * (R0 + 16));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // le decorazioni grandi: se finiscono tra me e la telecamera, la telecamera si avvicina
    world.camBlockers.push(sg, wheel, t1, t2, straw);
    // ombre più strette sulla pista
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -17;
    sh.right = sh.top = 17;

    return (f) => {
      const R = autoRadius(f.playT);
      const k = R / R0;
      rink.scale.set(k, 1, k);
      const melting = f.view.stage === 'PLAY' && f.playT > AUTO.shrinkFrom && R > AUTO.rMin;
      edgeM.color.set(melting ? '#ff4d6d' : '#ffd60a');
      edgeM.emissive.set(melting ? '#ff4d6d' : '#ffd60a');
      edgeM.emissiveIntensity = melting ? 1.0 + Math.sin(f.t * 10) * 0.4 : 0.8;
      // luci che si rincorrono (le sposto solo se la pista è cambiata)
      const step = Math.floor(f.t * 7);
      if (Math.abs(bulbR - R) > 0.01 || step !== bulbStep) {
        const moved = Math.abs(bulbR - R) > 0.01;
        bulbR = R;
        bulbStep = step;
        for (let i = 0; i < NB; i++) {
          if (moved) {
            const a = (i / NB) * Math.PI * 2;
            dummy.position.set(Math.sin(a) * (R + 0.35), 0.12, Math.cos(a) * (R + 0.35));
            dummy.updateMatrix();
            bulbs.setMatrixAt(i, dummy.matrix);
          }
          const on = (i + step) % 3;
          bulbs.setColorAt(i, melting && step % 2 ? (i % 2 ? bulbCols[0] : dim) : on === 0 ? dim : bulbCols[(i + Math.floor(step / 3)) % 3]);
        }
        if (moved) bulbs.instanceMatrix.needsUpdate = true;
        bulbs.instanceColor!.needsUpdate = true;
      }
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.06 + f.t) * 0.6 + Math.cos(seaBase[i + 1] * 0.07 + f.t * 0.8) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
      for (const o of floaters) {
        o.position.y = -19.6 + Math.sin(f.t * 1.2 + o.userData.ph) * 0.3;
        o.rotation.y += f.dt * 0.15;
      }
      const W = wheel.userData.wheel as THREE.Group;
      W.rotation.z = f.t * 0.12;
      for (const c of wheel.userData.cabins as THREE.Object3D[]) c.rotation.z = -W.rotation.z;
      const sb = sg.userData.bulbs as THREE.Mesh[];
      sb.forEach((b, i) => (b.visible = (i + step) % 4 !== 0));
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  // tutti seduti sull'auto dello scontro, col colore del giocatore
  decorate(av, id, f) {
    let car = av.deco.getObjectByName('auto-car') as THREE.Group | undefined;
    if (!car) {
      const color = f.view.roster.find((r) => r.id === id)?.color ?? '#ff4d6d';
      car = makeCar(color);
      av.deco.add(car);
      car.userData.yaw = av.root.rotation.y;
    }
    const U = car.userData as { car: THREE.Group; spark: THREE.Mesh; flame: THREE.Mesh; yaw: number; roll: number; lean: number };
    // seduto con le mani sul volante
    av.legL.rotation.x = av.legR.rotation.x = -1.45;
    av.legL.rotation.z = -0.12;
    av.legR.rotation.z = 0.12;
    av.armL.rotation.x = av.armR.rotation.x = -1.05;
    av.armL.rotation.z = 0.32;
    av.armR.rotation.z = -0.32;
    av.body.rotation.x = 0;
    // si piega nelle curve e traballa negli urti
    let dy = av.root.rotation.y - U.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    U.yaw = av.root.rotation.y;
    const rate = dy / Math.max(0.001, f.dt);
    U.roll += (Math.max(-0.28, Math.min(0.28, -rate * 0.05)) - U.roll) * Math.min(1, f.dt * 8);
    const hit = bonkAt.get(id) ?? 0;
    const el = (performance.now() - hit) / 1000;
    const wob = el < 0.8 ? Math.exp(-el * 5) * Math.sin(el * 38) * 0.22 : 0;
    U.car.rotation.z = U.roll + wob;
    U.car.rotation.x = wob * 0.6;
    av.body.rotation.z = U.roll * 0.7 + wob;
    av.body.position.y = -0.12 + Math.abs(wob) * 0.4;
    // turbo: fiamma dietro e scintilla più forte
    const turbo = id === f.myId ? (f.me.dashT ?? 0) > 0 : f.others.get(id)?.a === ANIM.dash;
    U.flame.visible = turbo;
    if (turbo) U.flame.scale.set(1, 1, 0.8 + Math.random() * 0.6);
    // (piccola: sopra la mia auto sta proprio al centro dello schermo)
    const s = ((turbo ? 1.3 : 0.7) + Math.random() * 0.4) * (id === f.myId ? 0.7 : 1);
    U.spark.scale.setScalar(s);
    U.spark.rotation.y = f.t * 9;
  },
  // la mia auto non entra nelle altre (l'urto vero lo decide il server)
  local(f) {
    if (!f.view.alive[f.myId] || f.me.y < -0.5) return;
    const min = AUTO.carR * 2;
    for (const [id, o] of f.others) {
      if (f.view.alive[id] === false || Math.abs(o.y - f.me.y) > 1) continue;
      const dx = f.me.x - o.x;
      const dz = f.me.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < min) {
        f.me.x += (dx / d) * (min - d);
        f.me.z += (dz / d) * (min - d);
      }
    }
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const R = autoRadius(t);
    const r = Math.hypot(h.me.x, h.me.z);
    if (h.me.y > -0.5 && r > R - 2.2) return { text: 'ATTENTO AL BORDO!', cls: 'sc-red pulse-soft' };
    if (t < 5) return { text: 'SPERONALI! SCATTO = TURBO', cls: 'sc-yellow' };
    if (t > AUTO.shrinkFrom && t < AUTO.shrinkFrom + 4) return { text: 'LA GRANITA SI SCIOGLIE!', cls: 'sc-purple' };
    return null;
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const top = Object.entries(E.ko)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (!top.length) return null;
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {top.map(([id, n], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
            {h.nameOf(id)} · {n} KO
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'auto_bonk') {
      const now = performance.now();
      bonkAt.set(p.a, now);
      bonkAt.set(p.b, now);
      for (const id of [p.a, p.b]) {
        const av = c.avatar(id);
        if (av) av.shockUntil = now + 700;
      }
      const power = Number(p.p) || 0;
      const y = 0.9;
      burst(c.world, p.x, y, p.z, ['#ffd60a', '#ffffff', '#70d6ff', '#ff9f1c'], Math.min(46, 10 + Math.round(power * 2)), 3 + power * 0.35);
      if (power >= 4.5) popText(c.world, p.x, y - 0.6, p.z, power >= 13 ? 'SBAAAM!' : 'BONK!', power >= 13 ? '#ff4d6d' : '#ffd60a', { scale: power >= 13 ? 1.35 : 1 });
      if (power >= 9) ringPulse(c.world, p.x, 0, p.z, '#ffd60a');
      const mine = p.a === c.myId || p.b === c.myId;
      const d = Math.hypot(c.me.x - p.x, c.me.z - p.z);
      if (!mine && d < 14 && power >= 4.5) soundManager.playBonk(); // (il mio lo suona già la spinta)
      if (power >= 13 && Date.now() - lastBig > 400) {
        lastBig = Date.now();
        if (mine) soundManager.playBoom();
        c.shake(mine ? 0.7 : d < 10 ? 0.35 : 0.15);
      }
      if (mine && power >= 9) haptic(power >= 13 ? [60, 30, 60] : 50);
    } else if (p.k === 'auto_ko') {
      const at = c.where(p.by);
      if (at) popText(c.world, at.x, at.y + 0.8, at.z, 'KO!', '#ff4d6d', { scale: 1.3 });
      if (p.by === c.myId) {
        soundManager.playSuccess();
        c.feed(`Hai buttato giù ${c.nameOf(p.id)}!`);
      } else c.feed(`${c.nameOf(p.by)} ha buttato giù ${c.nameOf(p.id)}`);
    }
  },
});
