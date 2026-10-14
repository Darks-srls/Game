// 🐷 Ruba la coda (telefono): l'aia del salumiere con botti e forme giganti, la coda di salame che dondola, maialini in giro
import * as THREE from 'three';
import { RUBA, RUBA_OBST } from '../../../data/minis/rubacoda';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, glow, matte, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { tail: string[]; safe: Record<string, number>; sec: Record<string, number> } | null;

// secondi con la coda dal vivo (arrivano come effetto ogni mezzo secondo)
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };

// ---------------------------------------------------------------- texture

// cotto dell'aia: mattonelle di terracotta con le fughe e un po' di paglia
const cottoTex = () =>
  canvasTex(
    512,
    512,
    (c) => {
      c.fillStyle = '#e7c9a0';
      c.fillRect(0, 0, 512, 512);
      const cols = ['#d9784a', '#cf6d3f', '#e08655', '#c9673b', '#dc7d4c'];
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = cols[(i * 3 + j * 7) % cols.length];
          c.fillRect(i * 64 + 3, j * 64 + 3, 58, 58);
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.fillRect(i * 64 + 6, j * 64 + 6, 30, 10);
        }
      c.strokeStyle = 'rgba(255,214,102,0.7)';
      c.lineWidth = 2;
      for (let k = 0; k < 70; k++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const a = Math.random() * Math.PI;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
        c.stroke();
      }
    },
    [7, 7],
  );

const grassTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#6cc57c';
      c.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 500; k++) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(40,120,60,0.3)' : 'rgba(170,230,140,0.3)';
        c.fillRect(Math.random() * 256, Math.random() * 256, 2, 6);
      }
    },
    [30, 30],
  );

// doghe della botte
const staveTex = () =>
  canvasTex(256, 128, (c) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? '#9c5a2c' : '#a8653a';
      c.fillRect(i * 16, 0, 16, 128);
      c.fillStyle = 'rgba(60,25,10,0.55)';
      c.fillRect(i * 16, 0, 2, 128);
    }
    for (let k = 0; k < 40; k++) {
      c.fillStyle = 'rgba(70,30,10,0.18)';
      c.fillRect(Math.random() * 256, Math.random() * 128, 1, 18);
    }
  });

const lidTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#b8743f';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(70,30,10,0.35)';
    c.lineWidth = 3;
    for (let r = 20; r < 130; r += 16) {
      c.beginPath();
      c.arc(128, 128, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#7a1f2b';
    c.font = '900 44px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.fillText('VINO', 128, 142);
  });

// crosta della forma di parmigiano con la scritta a puntini
const rindTex = () =>
  canvasTex(1024, 128, (c) => {
    c.fillStyle = '#e9b44c';
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = '#d39b32';
    c.fillRect(0, 0, 1024, 14);
    c.fillRect(0, 114, 1024, 14);
    c.font = '900 64px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(140,85,20,0.55)';
    c.fillText('PARMIGIANO · REGGIANO ·', 512, 66);
  });

const cheeseTopTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#f6d27a';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#e9b44c';
    c.beginPath();
    c.arc(128, 128, 128, 0, Math.PI * 2);
    c.arc(128, 128, 112, 0, Math.PI * 2, true);
    c.fill();
    for (let k = 0; k < 40; k++) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.arc(30 + Math.random() * 196, 30 + Math.random() * 196, 2 + Math.random() * 4, 0, Math.PI * 2);
      c.fill();
    }
  });

// fetta di salame (per la coda e le decorazioni)
let salamiCache: THREE.Texture | null = null;
const salamiTex = () =>
  (salamiCache ??= canvasTex(128, 128, (c) => {
    c.fillStyle = '#a3192a';
    c.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 46; k++) {
      c.fillStyle = k % 3 ? '#f6d5d5' : '#d9485a';
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    for (let y = 16; y < 128; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(128, y + 8);
      c.stroke();
    }
  }));

const stripeTex = (a: string, b: string) =>
  canvasTex(256, 64, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? a : b;
      c.fillRect(i * 32, 0, 32, 64);
    }
  });

const signTex = () =>
  canvasTex(1024, 256, (c) => {
    c.fillStyle = '#fff3d6';
    c.beginPath();
    c.roundRect(8, 8, 1008, 240, 60);
    c.fill();
    c.lineWidth = 16;
    c.strokeStyle = '#7a1f2b';
    c.stroke();
    c.font = '900 132px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#c1121f';
    c.fillText('SALUMERIA', 512, 112);
    c.font = '900 52px "Lilita One", sans-serif';
    c.fillStyle = '#7a1f2b';
    c.fillText('DA AXEND · DAL 1952', 512, 204);
  });

// ---------------------------------------------------------------- pezzi

// la coda di salame: tre pezzi a catena con lo spago (geometrie e materiali condivisi)
let tailParts: { seg: THREE.BufferGeometry; mat: THREE.Material; knot: THREE.BufferGeometry; string: THREE.Material; tip: THREE.BufferGeometry } | null = null;
function makeTail() {
  tailParts ??= {
    seg: new THREE.CapsuleGeometry(0.13, 0.26, 4, 10),
    mat: toy('#ffffff', { map: salamiTex(), roughness: 0.55, clearcoat: 0.3 }),
    knot: new THREE.TorusGeometry(0.1, 0.03, 6, 12),
    string: matte('#f1e3c6'),
    tip: new THREE.SphereGeometry(0.06, 8, 6),
  };
  const P = tailParts;
  const root = new THREE.Group();
  root.name = 'rc-tail';
  root.position.set(0, 0.66, -0.3);
  const knot = new THREE.Mesh(P.knot, P.string);
  root.add(knot);
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = root;
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    if (i) pivot.position.y = -0.46;
    const m = new THREE.Mesh(P.seg, P.mat);
    m.position.y = -0.23;
    m.castShadow = true;
    m.rotation.y = i * 1.7;
    pivot.add(m);
    if (i < 2) {
      const tie = new THREE.Mesh(P.tip, P.string);
      tie.position.y = -0.46;
      pivot.add(tie);
    }
    parent.add(pivot);
    parent = pivot;
    segs.push(pivot);
  }
  root.userData.segs = segs;
  root.userData.phase = Math.random() * 6;
  return root;
}

function barrel() {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const y = (i / 10) * 1.7;
    pts.push(new THREE.Vector2(0.9 + Math.sin((i / 10) * Math.PI) * 0.16, y));
  }
  const body = outlined(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), toy('#ffffff', { map: staveTex(), roughness: 0.6, clearcoat: 0.2 })), 1.03);
  const iron = toy('#3d3d46', { metalness: 0.6, roughness: 0.35 });
  for (const y of [0.22, 0.85, 1.48]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.9 + Math.sin((y / 1.7) * Math.PI) * 0.16 + 0.02, 0.045, 6, 32), iron);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    g.add(hoop);
  }
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.9, 28), toy('#ffffff', { map: lidTex(), roughness: 0.7 }));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 1.69;
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 8), toy('#c9a227', { metalness: 0.7, roughness: 0.3 }));
  tap.rotation.x = Math.PI / 2;
  tap.position.set(0, 0.42, 1.12);
  g.add(body, lid, tap);
  return shadowy(g);
}

function cheese(r: number, h: number, knife = false) {
  const g = new THREE.Group();
  const top = toy('#ffffff', { map: cheeseTopTex(), roughness: 0.75, clearcoat: 0.1 });
  const side = toy('#ffffff', { map: rindTex(), roughness: 0.7, clearcoat: 0.15 });
  const e = 0.14;
  const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h - e * 2, 40), [side, top, top]), 1.025);
  body.position.y = h / 2;
  const rimM = toy('#e3a93f', { roughness: 0.7 });
  for (const y of [e, h - e]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r - e, e, 8, 40), rimM);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    g.add(rim);
  }
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r - e, 40), top);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = h;
  g.add(body, cap);
  if (knife) {
    // il coltello da parmigiano piantato sopra
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 4), toy('#d9dde3', { metalness: 0.9, roughness: 0.15 }));
    blade.rotation.x = Math.PI;
    blade.scale.z = 0.25;
    blade.position.set(0.5, h + 0.25, 0.2);
    const handle = outlined(new THREE.Mesh(rbox(0.22, 0.7, 0.22, 0.08), toy('#5c3d2e')), 1.08);
    handle.position.set(0.5, h + 1.1, 0.2);
    g.add(blade, handle);
  }
  return shadowy(g);
}

function pig() {
  const g = new THREE.Group();
  const pink = toy('#ff9ebb');
  const dark = toy('#e86f95');
  const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), pink), 1.05);
  body.scale.set(1, 0.85, 1.3);
  body.position.y = 0.95;
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), pink), 1.05);
  head.position.set(0, 1.25, 0.95);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 14), dark);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 1.18, 1.42);
  const eyeM = toy('#1b1b2f');
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeM);
    eye.position.set(x, 1.38, 1.36);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), dark);
    ear.position.set(x * 1.6, 1.7, 0.85);
    ear.rotation.z = -x * 2;
    g.add(eye, ear);
  }
  const legs: THREE.Mesh[] = [];
  const legG = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 8);
  for (const [x, z] of [
    [-0.35, 0.55],
    [0.35, 0.55],
    [-0.35, -0.55],
    [0.35, -0.55],
  ]) {
    const leg = new THREE.Mesh(legG, dark);
    leg.position.set(x, 0.3, z);
    legs.push(leg);
    g.add(leg);
  }
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 12, Math.PI * 1.6), dark);
  curl.position.set(0, 1.1, -0.98);
  g.add(body, head, snout, curl);
  g.userData.legs = legs;
  return shadowy(g);
}

// prosciutto appeso (forma a goccia)
function ham() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * (0.25 + t * 0.35), -t * 1.3));
  }
  const m = outlined(new THREE.Mesh(new THREE.LatheGeometry(pts, 16), toy('#c8553d', { roughness: 0.5 })), 1.04);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), toy('#fff1d6'));
  bone.position.y = 0.1;
  m.add(bone);
  return m;
}

registerClientMini({
  kind: 'RUBACODA',
  orbit: { c: [0, 0, 0], r: 27 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ff9ebb" to="#d6336c">
      <path d="M16 30 Q30 18 44 28" fill="none" {...stroke} />
      <g transform="rotate(32 52 56)">
        <rect x="26" y="40" width="54" height="26" rx="13" fill="#b5172f" {...stroke} />
        <circle cx="38" cy="50" r="3.2" fill="#f6d5d5" />
        <circle cx="50" cy="57" r="2.6" fill="#f6d5d5" />
        <circle cx="61" cy="48" r="3" fill="#f6d5d5" />
        <circle cx="70" cy="57" r="2.4" fill="#f6d5d5" />
        <path d="M24 53 L18 53" {...stroke} />
      </g>
      <path d="M70 22 l10 -8 M76 32 l12 -2 M64 16 l2 -10" {...stroke} fill="none" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (anche su botti e forme) · Shift scatto · E schiaffo: ruba la coda',
  build(world) {
    const g = world.arena;
    live = { at: 0, s: {} };
    const R = RUBA.r;
    // l'aia di cotto e il prato intorno
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 0.6, 72), [toy('#8d5524'), matte('#ffffff', { map: cottoTex() }), toy('#8d5524')]);
    yard.position.y = -0.3;
    yard.receiveShadow = true;
    const field = new THREE.Mesh(new THREE.CircleGeometry(130, 48), matte('#ffffff', { map: grassTex() }));
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.62;
    field.receiveShadow = true;
    g.add(yard, field);
    // steccato: pali (tutti insieme) e due traverse rosse e bianche
    const nPosts = 60;
    const posts = new THREE.InstancedMesh(rbox(0.26, 1.35, 0.26, 0.07), toy('#fff6e6'), nPosts);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < nPosts; i++) {
      const a = (i / nPosts) * Math.PI * 2;
      tmp.position.set(Math.sin(a) * (R + 0.35), 0.67, Math.cos(a) * (R + 0.35));
      tmp.rotation.set(0, a, 0);
      tmp.updateMatrix();
      posts.setMatrixAt(i, tmp.matrix);
    }
    posts.castShadow = true;
    g.add(posts);
    [
      [0.45, '#e63946'],
      [1.05, '#ffffff'],
    ].forEach(([y, c]) => {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 0.35, 0.08, 6, 140), toy(c as string));
      rail.rotation.x = Math.PI / 2;
      rail.position.y = y as number;
      g.add(rail);
    });
    // pali alti con le lanterne e le bandierine tra uno e l'altro (tutte in un colpo solo)
    const poles = 10;
    const lanterns: THREE.Mesh[] = [];
    const poleG = new THREE.CylinderGeometry(0.12, 0.16, 5, 8);
    const poleM = toy('#7a4a2b');
    const bulbG = new THREE.SphereGeometry(0.28, 12, 10);
    const flagsPer = 9;
    const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.62, 3), toy('#ffffff', { side: THREE.DoubleSide }), poles * flagsPer);
    const flagCols = ['#e63946', '#ffd60a', '#ffffff', '#2a9d8f', '#ff70a6'];
    const col = new THREE.Color();
    for (let i = 0; i < poles; i++) {
      const a = (i / poles) * Math.PI * 2 + 0.31;
      const x = Math.sin(a) * (R + 1.1);
      const z = Math.cos(a) * (R + 1.1);
      const pole = new THREE.Mesh(poleG, poleM);
      pole.position.set(x, 2.5, z);
      const bulb = new THREE.Mesh(bulbG, glow('#ffcf6b', 2.6));
      bulb.position.set(x, 5.1, z);
      lanterns.push(bulb);
      g.add(shadowy(pole), bulb);
      const a2 = ((i + 1) / poles) * Math.PI * 2 + 0.31;
      const x2 = Math.sin(a2) * (R + 1.1);
      const z2 = Math.cos(a2) * (R + 1.1);
      for (let k = 0; k < flagsPer; k++) {
        const t = (k + 0.5) / flagsPer;
        tmp.position.set(x + (x2 - x) * t, 4.7 - Math.sin(t * Math.PI) * 1.1, z + (z2 - z) * t);
        tmp.rotation.set(Math.PI, Math.atan2(x2 - x, z2 - z) + Math.PI / 2, 0);
        tmp.updateMatrix();
        flags.setMatrixAt(i * flagsPer + k, tmp.matrix);
        flags.setColorAt(i * flagsPer + k, col.set(flagCols[(i + k) % flagCols.length]));
      }
    }
    g.add(flags);
    // botti e forme (dove sbattono le regole fisiche)
    for (const o of RUBA_OBST) {
      const m = o.k === 'botte' ? barrel() : cheese(o.r, o.h, o.x === 0 && o.z === 0);
      m.position.set(o.x, 0, o.z);
      m.rotation.y = o.x * 0.7 + o.z;
      g.add(m);
    }
    // la salumeria in fondo, con la tenda a righe e l'insegna
    const shop = new THREE.Group();
    const walls = outlined(new THREE.Mesh(rbox(14, 7, 5, 0.3), toy('#fff1d6')), 1.01);
    walls.position.y = 3.5;
    const roof = new THREE.Mesh(rbox(15, 0.6, 6, 0.2), toy('#a23b2a'));
    roof.position.y = 7.2;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 2.4), toy('#ffffff', { map: stripeTex('#e63946', '#ffffff') }));
    awning.position.set(0, 4.6, 3.4);
    awning.rotation.x = 0.35;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.5 }));
    sign.position.set(0, 6, 2.53);
    const door = new THREE.Mesh(rbox(2.4, 3.6, 0.2, 0.1), toy('#5c3d2e'));
    door.position.set(0, 1.8, 2.5);
    const winM = toy('#9ad1ff', { roughness: 0.1, clearcoat: 1, emissive: '#3a6fa0', emissiveIntensity: 0.3 });
    for (const x of [-4.2, 4.2]) {
      const win = new THREE.Mesh(rbox(3.2, 2.4, 0.2, 0.1), winM);
      win.position.set(x, 2.4, 2.5);
      shop.add(win);
      for (let k = 0; k < 3; k++) {
        const h = ham();
        h.scale.setScalar(0.55);
        h.position.set(x - 1 + k, 3.4, 2.75);
        shop.add(h);
      }
    }
    shop.add(walls, roof, awning, sign, door);
    shop.position.set(0, -0.6, -(R + 13));
    g.add(shadowy(shop));
    // rastrelliere con prosciutti e salami appesi che dondolano
    const swing: THREE.Object3D[] = [];
    const rackM = toy('#7a4a2b');
    for (const sx of [-1, 1]) {
      const rack = new THREE.Group();
      for (const x of [-2.6, 2.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4.4, 8), rackM);
        post.position.set(x, 2.2, 0);
        rack.add(post);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 5.8, 8), rackM);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = 4.3;
      rack.add(beam);
      for (let k = 0; k < 5; k++) {
        const holder = new THREE.Group();
        holder.position.set(-2 + k, 4.25, 0);
        let o: THREE.Object3D;
        if (k % 2) {
          o = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.1, 4, 10), toy('#ffffff', { map: salamiTex() }));
          o.position.y = -0.85;
        } else o = ham();
        holder.add(o);
        holder.userData.phase = k * 1.3 + sx;
        swing.push(holder);
        rack.add(holder);
      }
      rack.position.set(sx * (R + 6), -0.6, 5);
      rack.rotation.y = sx * 1.2;
      g.add(shadowy(rack));
    }
    // insegna gigante: una fetta di salame che gira su un palo
    const slice = new THREE.Group();
    const disc = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.35, 40), [toy('#7a1020'), toy('#ffffff', { map: salamiTex() }), toy('#ffffff', { map: salamiTex() })]), 1.03);
    disc.rotation.x = Math.PI / 2;
    slice.add(disc);
    slice.position.set(R + 9, 7.5, -8);
    const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 8, 10), toy('#d9dde3', { metalness: 0.6 }));
    sPole.position.set(R + 9, 3.4, -8);
    g.add(shadowy(slice), sPole);
    // maialini che trotterellano intorno allo steccato
    const pigs: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const p = pig();
      p.userData.a = (i / 3) * Math.PI * 2;
      p.userData.w = 0.18 + i * 0.05;
      p.userData.rr = R + 3.2 + i * 1.3;
      p.scale.setScalar(0.9 + i * 0.12);
      pigs.push(p);
      g.add(p);
    }
    // balle di fieno e palloncini
    const hayM = toy('#f2c94c', { roughness: 0.9, clearcoat: 0 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.9;
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.6, 20), hayM);
      hay.rotation.z = Math.PI / 2;
      hay.rotation.y = a;
      hay.position.set(Math.sin(a) * (R + 5.5), 0.4, Math.cos(a) * (R + 5.5));
      g.add(shadowy(hay));
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const b = balloon(['#e63946', '#ffd60a', '#ff70a6', '#2a9d8f'][i % 4]);
      const a = (i / 6) * Math.PI * 2 + 0.6;
      b.position.set(Math.sin(a) * (R + 4), 6 + (i % 3) * 1.5, Math.cos(a) * (R + 4));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }

    return (f) => {
      const t = f.t;
      for (const p of pigs) {
        const u = p.userData;
        u.a += f.dt * u.w;
        const x = Math.sin(u.a) * u.rr;
        const z = Math.cos(u.a) * u.rr;
        p.position.set(x, -0.6 + Math.abs(Math.sin(t * 9 + u.rr)) * 0.18, z);
        p.rotation.y = u.a + Math.PI / 2;
        (u.legs as THREE.Mesh[]).forEach((l, k) => (l.rotation.x = Math.sin(t * 12 + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.6));
      }
      for (const s of swing) s.rotation.z = Math.sin(t * 1.6 + s.userData.phase) * 0.12;
      slice.rotation.y = t * 0.6;
      for (let i = 0; i < lanterns.length; i++) lanterns[i].scale.setScalar(1 + Math.sin(t * 5 + i * 2.1) * 0.06);
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  speed: (f) => ((f.ext as Ext)?.tail.includes(f.myId) ? RUBA.holderSpeed : 1),
  // la coda di salame che dondola dietro + anello per terra (rosso; dorato e lampeggiante se è protetto)
  decorate(av, id, f) {
    const E = f.ext as Ext;
    const has = !!E && E.tail.includes(id) && f.view.stage !== 'END';
    let tail = av.deco.getObjectByName('rc-tail');
    if (has && !tail) {
      tail = makeTail();
      av.deco.add(tail);
    } else if (!has && tail) {
      av.deco.remove(tail);
      tail = undefined;
    }
    if (!has || !tail) return;
    let sp = 0;
    if (id === f.myId) sp = Math.hypot(f.me.vx, f.me.vz);
    else {
      const o = f.others.get(id);
      sp = o ? Math.hypot(o.vx ?? 0, o.vz ?? 0) : 0;
    }
    const k = Math.min(1, sp / 7);
    const ph = tail.userData.phase as number;
    const segs = tail.userData.segs as THREE.Group[];
    const w = f.t * (5 + k * 6) + ph;
    segs[0].rotation.x = 0.35 + k * 0.75 + Math.sin(w) * 0.12;
    segs[0].rotation.z = Math.sin(w * 0.9) * (0.25 + k * 0.2);
    segs[1].rotation.x = 0.15 + k * 0.2 + Math.sin(w - 0.8) * 0.18;
    segs[1].rotation.z = Math.sin(w * 0.9 - 0.7) * 0.3;
    segs[2].rotation.x = 0.1 + Math.sin(w - 1.6) * 0.22;
    segs[2].rotation.z = Math.sin(w * 0.9 - 1.4) * 0.35;
    const safe = (E!.safe[id] ?? 0) > f.now;
    av.ring.visible = !safe || Math.floor(f.t * 10) % 2 === 0;
    const m = av.ring.material as THREE.MeshBasicMaterial;
    m.color.set(safe ? '#ffd60a' : '#e63946');
  },
  status(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const mine = E.tail.includes(h.myId);
    const near = (pick: (id: string) => boolean) => {
      let best = Infinity;
      for (const [id, o] of h.others) {
        if (h.view.alive[id] === false || !pick(id)) continue;
        best = Math.min(best, Math.hypot(o.x - h.me.x, o.z - h.me.z));
      }
      return best;
    };
    if (mine) {
      if ((E.safe[h.myId] ?? 0) > h.now) return { text: 'PRESA! SEI PROTETTO UN ATTIMO', cls: 'sc-yellow' };
      if (near((id) => !E.tail.includes(id)) < 3.2) return { text: 'TI STANNO ADDOSSO: SCAPPA!', cls: 'sc-red pulse-soft' };
      return { text: 'HAI LA CODA: NON FARTELA RUBARE', cls: 'sc-green' };
    }
    const d = near((id) => E.tail.includes(id) && (E.safe[id] ?? 0) <= h.now);
    if (d < RUBA.reach) return { text: 'SCHIAFFO ORA!', cls: 'sc-red pulse-soft' };
    if (near((id) => E.tail.includes(id)) < 3.5) return { text: 'È PROTETTO: ASPETTA UN ATTIMO', cls: 'sc-dark' };
    return { text: 'RUBA UNA CODA A SCHIAFFI!', cls: 'sc-purple' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const sec = live.at && Date.now() - live.at < 3000 ? live.s : E.sec;
    const top = Object.entries(sec)
      .filter(([, v]) => v >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const mineIn = top.some(([id]) => id === h.myId);
    const rows = mineIn || !(sec[h.myId] >= 1) ? top : [...top, [h.myId, sec[h.myId]] as [string, number]];
    if (!rows.length) return null;
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {rows.map(([id, s], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{i < 3 && top[i]?.[0] === id ? i + 1 : '·'}</span>
            {h.nameOf(id)} · {Math.floor(s)}s
            {E.tail.includes(id) && (
              <svg width="18" height="12" viewBox="0 0 36 24" aria-hidden="true">
                <rect x="2" y="4" width="32" height="16" rx="8" fill="#b5172f" stroke="#1d0f3d" strokeWidth="3" />
                <circle cx="12" cy="11" r="2" fill="#f6d5d5" />
                <circle cx="22" cy="14" r="2" fill="#f6d5d5" />
              </svg>
            )}
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'rc_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 'rc_steal') {
      const at = c.where(p.by);
      const from = c.where(p.from);
      if (at) {
        popText(c.world, at.x, at.y + 0.4, at.z, 'PRESA!', '#ffd60a', { scale: 1.25 });
        ringPulse(c.world, at.x, at.y, at.z, '#ffd60a');
      }
      if (from) {
        burst(c.world, from.x, from.y + 0.8, from.z, ['#a3192a', '#f6d5d5', '#ffd60a'], 26, 5);
        popText(c.world, from.x, from.y - 0.4, from.z, 'NOOO!', '#ff4d6d', { scale: 0.8 });
      }
      if (p.by === c.myId) {
        soundManager.playSuccess();
        c.shake(0.3);
        c.feed(`Hai rubato la coda a ${c.nameOf(p.from)}!`);
      } else if (p.from === c.myId) {
        soundManager.playError();
        c.shake(0.55);
        c.feed(`${c.nameOf(p.by)} ti ha rubato la coda!`);
      } else {
        soundManager.playPop();
        c.feed(`${c.nameOf(p.by)} ruba la coda a ${c.nameOf(p.from)}`);
      }
    } else if (p.k === 'rc_gift') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y, at.z, 'CODA!', '#ffd60a');
      if (p.id === c.myId) soundManager.playSuccess();
    }
  },
});
