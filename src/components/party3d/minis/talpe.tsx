// 🐹 Schiaccia le talpe (telefono): tagliere gigante con 25 buche, talpe col cappello da cuoco (d'oro, bombe con la miccia),
// cucina enorme intorno: fornelli con le pentole che fumano, mestoli che dondolano, orologio che gira, ingredienti giganti
import * as THREE from 'three';
import { holeX, holeZ, TALPE } from '../../../data/minis/talpe';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { burst, canvasTex, glow, makeTomato, matte, outlined, poof, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { m: number[][]; s: Record<string, number>; t0: number; last: number } | null;

interface MoleC {
  id: number;
  h: number;
  k: number; // 0 normale, 1 d'oro, 2 bomba
  up: number;
  down: number;
  hitAt: number; // schiacciata (0 = no, -1 = appena arrivata la notizia)
}

// ---------------------------------------------------------------- stato sul telefono (si rimette a posto in build)
const moles = new Map<number, MoleC>();
const gone = new Set<number>();
let lastExt: unknown = null;
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };
const HOLES = TALPE.n * TALPE.n;
const decode = (a: number[], t0: number): MoleC => ({ id: a[0], h: a[1], k: a[2], up: a[3] + t0, down: a[4] + t0, hitAt: 0 });

// ---------------------------------------------------------------- texture

// tagliere di legno a listelli
const boardTex = () =>
  canvasTex(
    512,
    512,
    (c) => {
      const cols = ['#d9a066', '#cf955a', '#e2ab72', '#c98d52', '#ddb07a'];
      for (let i = 0; i < 8; i++) {
        c.fillStyle = cols[i % cols.length];
        c.fillRect(0, i * 64, 512, 64);
        c.fillStyle = 'rgba(120,70,30,0.35)';
        c.fillRect(0, i * 64, 512, 3);
        for (let k = 0; k < 9; k++) {
          c.strokeStyle = 'rgba(140,85,40,0.22)';
          c.lineWidth = 2;
          c.beginPath();
          const y = i * 64 + 8 + Math.random() * 48;
          c.moveTo(0, y);
          c.bezierCurveTo(170, y + (Math.random() - 0.5) * 16, 340, y + (Math.random() - 0.5) * 16, 512, y);
          c.stroke();
        }
      }
      // qualche taglio di coltello
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 2;
      for (let k = 0; k < 30; k++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 20);
        c.stroke();
      }
    },
    [3, 3],
  );

const marbleTex = () =>
  canvasTex(
    512,
    512,
    (c) => {
      c.fillStyle = '#f3efe9';
      c.fillRect(0, 0, 512, 512);
      c.strokeStyle = 'rgba(140,135,150,0.35)';
      c.lineWidth = 3;
      for (let k = 0; k < 14; k++) {
        c.beginPath();
        c.moveTo(Math.random() * 512, 0);
        c.bezierCurveTo(Math.random() * 512, 170, Math.random() * 512, 340, Math.random() * 512, 512);
        c.stroke();
      }
    },
    [8, 8],
  );

const tilesTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#cfd8dc';
      c.fillRect(0, 0, 256, 256);
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 4; i++) {
          c.fillStyle = (i + j) % 5 === 0 ? '#e3f2fd' : '#ffffff';
          c.fillRect(i * 64 + (j % 2 ? 32 : 0) - 30, j * 32 + 2, 60, 28);
          c.fillRect(i * 64 + (j % 2 ? 32 : 0) + 226, j * 32 + 2, 60, 28);
        }
    },
    [10, 5],
  );

const clockTex = () =>
  canvasTex(512, 512, (c) => {
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.arc(256, 256, 250, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 22;
    c.strokeStyle = '#e63946';
    c.stroke();
    c.fillStyle = '#1d0f3d';
    c.font = '900 64px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillText(String(i), 256 + Math.sin(a) * 190, 256 - Math.cos(a) * 190);
    }
  });

const flourTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#fff8ec';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#2a9d8f';
    c.fillRect(0, 70, 256, 110);
    c.fillStyle = '#ffffff';
    c.font = '900 64px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('FARINA', 128, 112);
    c.font = '900 34px "Lilita One", sans-serif';
    c.fillText('TIPO 00', 128, 160);
  });

// ---------------------------------------------------------------- pezzi

// una talpa (con il corpo per la bomba e per quella d'oro): si riusa tra una buca e l'altra
function makeMole(mats: { fur: THREE.Material; gold: THREE.Material; belly: THREE.Material; bomb: THREE.MeshStandardMaterial }) {
  const g = new THREE.Group();
  const rise = new THREE.Group();
  g.add(rise);
  // la talpa
  const mole = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.5, 6, 14), mats.fur), 1.05);
  body.position.y = 0.35;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), mats.belly);
  belly.scale.set(1, 1.2, 0.45);
  belly.position.set(0, 0.25, 0.36);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mats.belly);
  snout.position.set(0, 0.62, 0.48);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toy('#ff6f91'));
  nose.position.set(0, 0.68, 0.66);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.04), toy('#ffffff'));
  tooth.position.set(0, 0.48, 0.6);
  const eyeW = toy('#ffffff');
  const eyeB = toy('#1b1b2f');
  for (const x of [-0.18, 0.18]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeW);
    e.position.set(x, 0.86, 0.4);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeB);
    p.position.set(x, 0.86, 0.5);
    mole.add(e, p);
  }
  // il cappello da cuoco
  const hat = new THREE.Group();
  const hatM = toy('#ffffff', { roughness: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.32, 16), hatM);
  hat.add(band);
  for (let k = 0; k < 5; k++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), hatM);
    const a = (k / 5) * Math.PI * 2;
    puff.position.set(Math.sin(a) * 0.2, 0.3, Math.cos(a) * 0.2);
    hat.add(puff);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), hatM);
  top.position.y = 0.42;
  hat.add(top);
  hat.position.y = 1.2;
  hat.rotation.z = 0.12;
  const paws: THREE.Mesh[] = [];
  for (const x of [-0.42, 0.42]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mats.belly);
    paw.scale.set(1, 0.6, 1.2);
    paw.position.set(x, 0.12, 0.5);
    paws.push(paw);
    mole.add(paw);
  }
  mole.add(body, belly, snout, nose, tooth, hat);
  // la bomba: palla nera con la miccia accesa e gli occhi arrabbiati
  const bomb = new THREE.Group();
  const ball = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), mats.bomb), 1.05);
  ball.position.y = 0.5;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 10), toy('#5c5f6e', { metalness: 0.6 }));
  cap.position.y = 1.12;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), toy('#c9a227'));
  fuse.position.set(0.08, 1.35, 0);
  fuse.rotation.z = -0.4;
  const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), glow('#ffb703', 4));
  spark.position.set(0.18, 1.55, 0);
  for (const x of [-0.2, 0.2]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeW);
    e.position.set(x, 0.62, 0.52);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), toy('#ffffff'));
    brow.position.set(x, 0.78, 0.56);
    brow.rotation.z = x > 0 ? 0.5 : -0.5;
    bomb.add(e, brow);
  }
  bomb.add(ball, cap, fuse, spark);
  // terra smossa intorno alla buca
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toy('#6b4226', { roughness: 0.9, clearcoat: 0 }));
  mound.scale.y = 0.25;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd60a', toneMapped: false }));
  halo.position.y = 0.06;
  rise.add(mole, bomb);
  g.add(mound, halo);
  shadowy(g, true, false);
  g.visible = false;
  return { g, rise, mole, bomb, body, hat, spark, mound, halo, paws, id: -1, k: -1 };
}

registerClientMini({
  kind: 'TALPE',
  orbit: { c: [0, 0, 0], r: 27 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#b5e48c" to="#52b788">
      <ellipse cx="50" cy="80" rx="32" ry="9" fill="#6b4226" {...stroke} />
      <path d="M28 80 Q28 40 50 40 Q72 40 72 80 Z" fill="#8d5a3b" {...stroke} />
      <ellipse cx="50" cy="62" rx="10" ry="7" fill="#f2c9a0" {...stroke} />
      <circle cx="50" cy="58" r="4" fill="#ff6f91" />
      <circle cx="42" cy="50" r="3.5" fill="#1b1b2f" />
      <circle cx="58" cy="50" r="3.5" fill="#1b1b2f" />
      <rect x="37" y="28" width="26" height="12" rx="3" fill="#ffffff" {...stroke} />
      <circle cx="41" cy="22" r="8" fill="#ffffff" {...stroke} />
      <circle cx="59" cy="22" r="8" fill="#ffffff" {...stroke} />
      <circle cx="50" cy="17" r="9" fill="#ffffff" {...stroke} />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (atterra SULLA talpa!) · Shift scatto/tuffo · E schiaffo',
  build(world) {
    const g = world.arena;
    moles.clear();
    gone.clear();
    lastExt = null;
    live = { at: 0, s: {} };
    const H = TALPE.half;
    // il tagliere col bordo rialzato, sopra il bancone di marmo
    const board = new THREE.Mesh(new THREE.BoxGeometry(H * 2, 0.8, H * 2), [
      toy('#b57a45'),
      toy('#b57a45'),
      toy('#ffffff', { map: boardTex(), roughness: 0.65, clearcoat: 0.15 }),
      toy('#b57a45'),
      toy('#b57a45'),
      toy('#b57a45'),
    ]);
    board.position.y = -0.4;
    board.receiveShadow = true;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 70), [matte('#d8d2c8'), matte('#d8d2c8'), toy('#ffffff', { map: marbleTex(), roughness: 0.3, clearcoat: 0.6 }), matte('#d8d2c8'), matte('#d8d2c8'), matte('#d8d2c8')]);
    counter.position.set(0, -1.3, -6);
    counter.receiveShadow = true;
    g.add(board, counter);
    const lipM = toy('#8d5524');
    for (let s = 0; s < 4; s++) {
      const lip = outlined(new THREE.Mesh(rbox(H * 2 + 1.2, 0.7, 0.6, 0.18), lipM), 1.01);
      const a = (s * Math.PI) / 2;
      lip.position.set(Math.sin(a) * (H + 0.3), 0.15, Math.cos(a) * (H + 0.3));
      lip.rotation.y = a;
      g.add(shadowy(lip));
    }
    // le 25 buche (tutte insieme): fondo scuro e bordo di terra
    const holeM = new THREE.MeshBasicMaterial({ color: '#2b1608' });
    const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(TALPE.holeR, 24).rotateX(-Math.PI / 2), holeM, HOLES);
    const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(TALPE.holeR + 0.05, 0.13, 8, 28).rotateX(Math.PI / 2), toy('#7a4a2b', { roughness: 0.8, clearcoat: 0 }), HOLES);
    const tmp = new THREE.Object3D();
    for (let h = 0; h < HOLES; h++) {
      tmp.position.set(holeX(h), 0.012, holeZ(h));
      tmp.updateMatrix();
      holes.setMatrixAt(h, tmp.matrix);
      tmp.position.y = 0.04;
      tmp.updateMatrix();
      rims.setMatrixAt(h, tmp.matrix);
    }
    rims.receiveShadow = true;
    g.add(holes, rims);
    // la parete di piastrelle in fondo con la finestra, le mensole coi barattoli e l'orologio
    const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 26), matte('#ffffff', { map: tilesTex() }));
    back.position.set(0, 11, -26);
    g.add(back);
    const win = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshBasicMaterial({ color: '#9fd8ff' }));
    const frameM = toy('#ffffff');
    const fr1 = new THREE.Mesh(rbox(10.6, 0.5, 0.4, 0.1), frameM);
    fr1.position.y = 3.6;
    const fr2 = fr1.clone();
    fr2.position.y = -3.6;
    const fr3 = new THREE.Mesh(rbox(0.5, 7.6, 0.4, 0.1), frameM);
    fr3.position.x = -5.1;
    const fr4 = fr3.clone();
    fr4.position.x = 5.1;
    const fr5 = new THREE.Mesh(rbox(0.25, 7, 0.3), frameM);
    win.add(glass, fr1, fr2, fr3, fr4, fr5);
    win.position.set(-12, 9, -25.8);
    g.add(win);
    const shelfM = toy('#a0663a');
    const jarCols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8338ec', '#06d6a0'];
    for (const y of [6, 9.5]) {
      const shelf = new THREE.Mesh(rbox(12, 0.35, 1.6, 0.08), shelfM);
      shelf.position.set(11, y, -25.2);
      g.add(shadowy(shelf));
      for (let k = 0; k < 5; k++) {
        const jar = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6 + (k % 2) * 0.6, 16), toy(jarCols[(k + (y > 7 ? 2 : 0)) % jarCols.length], { transparent: true, opacity: 0.85 })), 1.04);
        jar.position.set(6.5 + k * 2.2, y + 0.98 + (k % 2) * 0.3, -25.2);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.25, 16), toy('#ffd60a', { metalness: 0.5 }));
        lid.position.set(6.5 + k * 2.2, y + 1.9 + (k % 2) * 0.6, -25.2);
        g.add(jar, lid);
      }
    }
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.5 }));
    const handM = toy('#1d0f3d');
    const big = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.08), handM);
    big.geometry.translate(0, 0.9, 0);
    const small = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.4, 0.08), handM);
    small.geometry.translate(0, 0.6, 0);
    big.position.z = small.position.z = 0.06;
    clock.add(face, big, small);
    clock.position.set(2, 18, -25.8);
    g.add(clock);
    // la barra con i mestoli che dondolano
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 18, 8).rotateZ(Math.PI / 2), toy('#c0c6cf', { metalness: 0.8, roughness: 0.25 }));
    rail.position.set(0, 15, -25.2);
    g.add(rail);
    const steel = toy('#d6dbe1', { metalness: 0.85, roughness: 0.2 });
    const wood = toy('#b07a46');
    const tools: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const tool = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 8), k % 3 === 1 ? wood : steel);
      handle.position.y = -1.6;
      tool.add(handle);
      let head: THREE.Mesh;
      if (k % 3 === 0) head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel); // mestolo
      else if (k % 3 === 1) head = new THREE.Mesh(rbox(0.9, 1.1, 0.12, 0.05), wood); // spatola
      else head = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 16), steel); // frusta
      head.position.y = -3.3;
      if (k % 3 === 2) head.scale.set(0.8, 1.4, 1);
      tool.add(head);
      tool.position.set(-7.5 + k * 3, 15, -25);
      tool.userData.ph = k * 1.1;
      tools.push(tool);
      g.add(shadowy(tool));
    }
    // a sinistra i fornelli con due pentoloni che fumano
    const stove = new THREE.Group();
    const top2 = outlined(new THREE.Mesh(rbox(9, 1.2, 16, 0.2), toy('#2b2d42', { metalness: 0.3 })), 1.01);
    top2.position.y = -0.2;
    stove.add(top2);
    const flames: THREE.Mesh[] = [];
    const steam: { m: THREE.Mesh; ph: number; base: THREE.Vector3 }[] = [];
    const puffG = new THREE.IcosahedronGeometry(0.7, 1);
    const puffM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, roughness: 1, depthWrite: false });
    [-3.8, 3.8].forEach((z, i) => {
      const flame = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.18, 6, 32).rotateX(Math.PI / 2), glow('#4cc9f0', 2.5));
      flame.position.set(0, 0.45, z);
      flames.push(flame);
      const pot = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.4, 3.6, 28), toy(i ? '#e63946' : '#c0c6cf', { metalness: i ? 0.1 : 0.8, roughness: 0.25 })), 1.02);
      pot.position.set(0, 2.4, z);
      const sauce = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28).rotateX(-Math.PI / 2), toy(i ? '#f1faee' : '#d62828', { roughness: 0.2 }));
      sauce.position.set(0, 4.05, z);
      stove.add(flame, pot, sauce);
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(puffG, puffM);
        const base = new THREE.Vector3(0, 4.3, z);
        steam.push({ m, ph: k / 5 + i * 0.1, base });
        stove.add(m);
      }
    });
    stove.position.set(-H - 6.5, -0.6, -2);
    g.add(shadowy(stove));
    // a destra gli ingredienti giganti: pomodoro, aglio, mattarello, sacco di farina, basilico
    const tomato = makeTomato(2.2);
    tomato.position.set(H + 5, 1.3, -8);
    const garlic = new THREE.Group();
    const garM = toy('#f8f1e5');
    for (let k = 0; k < 6; k++) {
      const clove = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), garM);
      const a = (k / 6) * Math.PI * 2;
      clove.scale.set(0.8, 1.3, 0.8);
      clove.position.set(Math.sin(a) * 0.7, 1.1, Math.cos(a) * 0.7);
      garlic.add(clove);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 8), garM);
    tip.position.y = 2.6;
    garlic.add(tip);
    garlic.position.set(H + 4.5, -0.8, 1);
    const pin = new THREE.Group();
    const roll = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 9, 24).rotateZ(Math.PI / 2), wood), 1.02);
    const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 12).rotateZ(Math.PI / 2), wood);
    h1.position.x = 5.5;
    const h2 = h1.clone();
    h2.position.x = -5.5;
    pin.add(roll, h1, h2);
    pin.position.set(H + 5.5, 0.2, 9);
    pin.rotation.y = Math.PI / 2 - 0.25;
    const flour = outlined(new THREE.Mesh(rbox(4, 5, 3, 0.8), [toy('#fff8ec'), toy('#fff8ec'), toy('#fff8ec'), toy('#fff8ec'), toy('#ffffff', { map: flourTex() }), toy('#fff8ec')]), 1.02);
    flour.position.set(H + 6, 1.7, 17);
    flour.rotation.y = -0.6;
    const basil = new THREE.Group();
    const potB = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 2, 16), toy('#c8553d')), 1.03);
    potB.position.y = 0.4;
    basil.add(potB);
    const leafM = toy('#2d9c4a');
    for (let k = 0; k < 9; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), leafM);
      leaf.scale.set(1, 0.35, 0.6);
      const a = (k / 9) * Math.PI * 2;
      leaf.position.set(Math.sin(a) * 0.9, 2 + (k % 3) * 0.5, Math.cos(a) * 0.9);
      leaf.rotation.y = a;
      basil.add(leaf);
    }
    basil.position.set(-H - 4.5, -0.6, 15);
    g.add(shadowy(tomato), shadowy(garlic), shadowy(pin), shadowy(flour), shadowy(basil));
    world.camBlockers.push(stove, tomato, garlic, pin, flour, basil);

    // ---- le talpe (si riusano)
    const mats = {
      fur: toy('#8d5a3b', { roughness: 0.6 }),
      gold: toy('#ffd60a', { metalness: 0.75, roughness: 0.2, emissive: '#7a5200', emissiveIntensity: 0.35 }),
      belly: toy('#f2c9a0'),
      bomb: toy('#2b2d42', { roughness: 0.3, emissive: '#ff2d55', emissiveIntensity: 0 }),
    };
    const pool: ReturnType<typeof makeMole>[] = [];
    const slot = () => {
      const s = makeMole(mats);
      g.add(s.g);
      pool.push(s);
      return s;
    };
    for (let k = 0; k < 8; k++) slot();

    return (f) => {
      const t = f.t;
      const now = f.now;
      const E = f.ext as Ext;
      if (E && E !== lastExt) {
        lastExt = E;
        const ids = new Set<number>();
        for (const a of E.m) {
          ids.add(a[0]);
          if (!moles.has(a[0]) && !gone.has(a[0])) moles.set(a[0], decode(a, E.t0));
        }
        for (const [id, m] of moles) if (id <= E.last && !ids.has(id) && !m.hitAt && now < m.down) moles.delete(id);
      }
      for (const s of pool) s.id = -1;
      for (const m of moles.values()) {
        if (m.hitAt === -1) m.hitAt = now;
        if ((m.hitAt && now - m.hitAt > 500) || (!m.hitAt && now > m.down + 250)) {
          moles.delete(m.id);
          continue;
        }
        const s = pool.find((p) => p.id === -1) ?? slot();
        s.id = m.id;
        s.g.visible = true;
        s.g.position.set(holeX(m.h), 0, holeZ(m.h));
        if (s.k !== m.k) {
          s.k = m.k;
          s.mole.visible = m.k !== 2;
          s.bomb.visible = m.k === 2;
          s.body.material = m.k === 1 ? mats.gold : mats.fur;
          s.halo.visible = m.k === 1;
        }
        // quanto è fuori: 0 sotto terra … 1 fuori
        let out = 0;
        if (m.hitAt) out = Math.max(0, 1 - (now - m.hitAt) / 450);
        else if (now >= m.up && now <= m.down) out = Math.min(1, (now - m.up) / 140, (m.down - now) / 160);
        const pop = out > 0 && out < 1 && !m.hitAt ? Math.sin(out * Math.PI) * 0.15 : 0;
        s.rise.position.y = -1.6 + Math.min(1, out) * 1.6 + pop;
        // schiacciata: si appiattisce
        if (m.hitAt) {
          const k = Math.min(1, (now - m.hitAt) / 90);
          s.rise.scale.set(1 + k * 0.5, 1 - k * 0.72, 1 + k * 0.5);
        } else s.rise.scale.set(1, 1 + Math.sin(t * 7 + m.id) * 0.04, 1);
        s.rise.rotation.y = Math.sin(t * 2.3 + m.id) * 0.7;
        s.rise.visible = s.rise.position.y > -1.5;
        // la terra trema prima che spunti
        const warn = now < m.up ? 1 - (m.up - now) / TALPE.warn : 1;
        s.mound.scale.set(0.6 + warn * 0.4 + (now < m.up ? Math.sin(t * 60) * 0.05 : 0), 0.25 * (0.4 + warn * 0.6), 0.6 + warn * 0.4);
        s.mound.position.x = now < m.up ? Math.sin(t * 47) * 0.05 : 0;
        if (m.k === 1) s.halo.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
        if (m.k === 2) {
          s.spark.scale.setScalar(0.7 + Math.random() * 0.8);
          const hot = Math.max(0, 1 - (m.down - now) / 900);
          mats.bomb.emissiveIntensity = hot * (0.5 + Math.sin(t * 30) * 0.5);
        }
        s.paws.forEach((p, i) => (p.position.y = 0.12 + (out >= 1 ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.08 : 0)));
      }
      for (const s of pool) if (s.id === -1) s.g.visible = false;
      // la cucina che si muove
      for (const tool of tools) tool.rotation.z = Math.sin(t * 1.4 + tool.userData.ph) * 0.12;
      for (const fl of flames) fl.scale.setScalar(1 + Math.sin(t * 20 + fl.position.z) * 0.03);
      for (const st of steam) {
        const ph = (t * 0.35 + st.ph) % 1;
        st.m.position.set(st.base.x + Math.sin(ph * 6 + st.ph * 9) * 0.8, st.base.y + ph * 7, st.base.z + Math.cos(ph * 5 + st.ph * 7) * 0.8);
        st.m.scale.setScalar(0.5 + ph * 1.6);
        st.m.visible = ph < 0.95;
      }
      // l'orologio: la lancetta lunga fa un giro in un minuto di gioco
      big.rotation.z = -(f.playT / 60) * Math.PI * 2;
      small.rotation.z = -(f.playT / 720) * Math.PI * 2 - 1;
      tomato.rotation.y = Math.sin(t * 0.5) * 0.2;
    };
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    let gold = false;
    for (const m of moles.values()) {
      if (m.hitAt || h.now < m.up - 300 || h.now > m.down) continue;
      const d = Math.hypot(h.me.x - holeX(m.h), h.me.z - holeZ(m.h));
      if (m.k === 2 && d < 2.2) return { text: 'BOMBA! NON SALTARCI SOPRA', cls: 'sc-red pulse-soft' };
      if (m.k === 1 && d < 9) gold = true;
    }
    if (gold) return { text: 'TALPA D’ORO! VALE 3', cls: 'sc-yellow pulse-soft' };
    return { text: 'SALTA E ATTERRA SULLE TALPE!', cls: 'sc-green' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const s = live.at && Date.now() - live.at < 3000 ? live.s : E.s;
    const top = Object.entries(s)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (!top.length) return null;
    const rows = top.some(([id]) => id === h.myId) ? top : [...top, [h.myId, s[h.myId] ?? 0] as [string, number]];
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {rows.map(([id, n], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{top[i]?.[0] === id ? i + 1 : '·'}</span>
            {h.nameOf(id)} · {n} {n === 1 ? 'talpa' : 'talpe'}
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'tp_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 'tp_mole') {
      const a = p.m as number[];
      if (!moles.has(a[0]) && !gone.has(a[0])) moles.set(a[0], decode(a, p.t0));
    } else if (p.k === 'tp_hit') {
      gone.add(p.i);
      const m = moles.get(p.i);
      if (m) m.hitAt = -1; // l'ora giusta la mette il prossimo fotogramma
      const x = holeX(p.h);
      const z = holeZ(p.h);
      const mine = p.by === c.myId;
      if (p.kk !== 2) {
        burst(c.world, x, 0.9, z, p.kk === 1 ? ['#ffd60a', '#fff3b0', '#ffffff'] : ['#ffffff', '#ffd166', '#8d5a3b'], p.kk === 1 ? 34 : 18, 5);
        ringPulse(c.world, x, 0, z, p.kk === 1 ? '#ffd60a' : '#ffffff');
      }
      const w = c.where(p.by);
      const txt = p.pts > 0 ? `+${p.pts}` : `${p.pts}`;
      if (w) popText(c.world, w.x, w.y - 0.3, w.z, p.kk === 2 ? `BUM! ${txt}` : p.kk === 1 ? `ORO! ${txt}` : txt, p.pts > 0 ? (p.kk === 1 ? '#ffd60a' : '#ffffff') : '#ff4d6d', { scale: mine ? 1.1 : 0.75, life: 0.8 });
      if (mine) {
        if (p.kk === 2) soundManager.playError();
        else if (p.kk === 1) soundManager.playSuccess();
        else soundManager.playBonk();
        c.shake(p.kk === 2 ? 0.7 : 0.2);
      } else if (p.kk === 1) c.feed(`${c.nameOf(p.by)} ha schiacciato la talpa d’oro!`);
    } else if (p.k === 'tp_boom') {
      const x = holeX(p.h);
      const z = holeZ(p.h);
      burst(c.world, x, 0.8, z, ['#2b2d42', '#ff6b35', '#ffd60a', '#ffffff'], 46, 8);
      poof(c.world, x, 0, z);
      const d = Math.hypot(c.me.x - x, c.me.z - z);
      if (d < 12) soundManager.playBoom();
      if ((p.hit as string[]).includes(c.myId)) {
        c.shake(0.9);
        if (p.by !== c.myId) c.feed('Una talpa-bomba ti è scoppiata vicino!');
      } else if (d < 6) c.shake(0.35);
      if (!p.by) popText(c.world, x, 0.4, z, 'BUM!', '#ff6b35', { scale: 1.1 });
    }
  },
});
