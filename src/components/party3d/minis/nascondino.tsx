// 🫙 Trasformisti (telefono): la cucina-mercato piena di oggetti, la dispensa dei cercatori, i travestimenti identici
// agli oggetti veri, il mattarello, i fischi. Gli oggetti travestiti e quelli veri escono dalla stessa funzione: identici.
import * as THREE from 'three';
import { FURNITURE, HIDE, PANTRY, PROPS, PROP_NAMES, PROP_TYPES } from '../../../data/minis/nascondino';
import { haptic, soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, flagLine, glow, matte, outlined, poof, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx, type MiniFrame } from './types';

type Ext = { phase: 'HIDE' | 'SEEK'; seekAt: number; seekers: string[]; disguise: Record<string, number>; score: Record<string, number> } | null;

const swingAt = new Map<string, number>(); // colpo di mattarello (performance.now)
const stunUntil = new Map<string, number>(); // cercatore stordito (Date.now)
const whistleAt = new Map<string, number>(); // ha fischiato (Date.now)
let hitReady = 0;
let morphReady = 0;
let whistleReady = 0;

// suoni con la nota giusta (lo stesso sintetizzatore degli altri effetti)
function fischio(vol: number) {
  soundManager.playNote(1450, 0.16, { vol, slideTo: 2300 });
  soundManager.playNote(1300, 0.34, { vol, slideTo: 2700 }, 0.22);
}

// ---------------------------------------------------------------- gli oggetti (stessa ricetta per quelli veri e per i travestiti)
type Kit = { g: Record<string, THREE.BufferGeometry>; m: Record<string, THREE.Material | THREE.Material[]> };
let MATS: Kit['m'] | null = null;

function propMats() {
  if (MATS) return MATS;
  const sack = canvasTex(256, 256, (c) => {
    c.fillStyle = '#efe0bd';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(150,120,70,0.25)';
    c.lineWidth = 2;
    for (let i = 0; i < 256; i += 6) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 256);
      c.moveTo(0, i);
      c.lineTo(256, i);
      c.stroke();
    }
    c.fillStyle = '#c1121f';
    c.fillRect(0, 70, 256, 14);
    c.fillStyle = '#2a6fdb';
    c.font = '900 46px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.fillText('FARINA', 128, 140);
    c.font = '900 40px "Lilita One", "Baloo 2", sans-serif';
    c.fillStyle = '#c1121f';
    c.fillText('00', 128, 186);
  });
  const can = canvasTex(256, 128, (c) => {
    c.fillStyle = '#e63946';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#2d9c4a';
    c.fillRect(0, 0, 256, 16);
    c.fillRect(0, 112, 256, 16);
    c.fillStyle = '#fff3d6';
    c.beginPath();
    c.ellipse(128, 64, 70, 36, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d62828';
    c.beginPath();
    c.arc(84, 64, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2d9c4a';
    c.fillRect(80, 38, 8, 8);
    c.fillStyle = '#c1121f';
    c.font = '900 24px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.fillText('POMODORO', 150, 72);
  });
  const wicker = canvasTex(128, 64, (c) => {
    c.fillStyle = '#b07a3c';
    c.fillRect(0, 0, 128, 64);
    for (let y = 0; y < 64; y += 8)
      for (let x = 0; x < 128; x += 16) {
        c.fillStyle = (x / 16 + y / 8) % 2 ? '#d9a35a' : '#9a6630';
        c.fillRect(x, y, 14, 6);
      }
  });
  const check = canvasTex(64, 64, (c) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
        c.fillRect(i * 16, j * 16, 16, 16);
      }
  });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9d1dc', metalness: 0.85, roughness: 0.25 });
  MATS = {
    sack: toy('#ffffff', { map: sack, roughness: 0.9, clearcoat: 0 }),
    rope: toy('#8a5a2b', { roughness: 0.8 }),
    can: [toy('#ffffff', { map: can, clearcoat: 0.6 }), steel, steel],
    steel,
    glass: toy('#2f9e5b', { roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.88 }),
    wicker: toy('#ffffff', { map: wicker, roughness: 0.85, clearcoat: 0 }),
    cork: toy('#c8955a', { roughness: 0.8 }),
    wood: toy('#b5743a', { roughness: 0.6, clearcoat: 0.2 }),
    cushion: toy('#ffffff', { map: check, roughness: 0.7 }),
    bread: toy('#d99a4e', { roughness: 0.55, clearcoat: 0.35 }),
    crust: toy('#b9732f', { roughness: 0.55, clearcoat: 0.35 }),
    pot: new THREE.MeshStandardMaterial({ color: '#aab4c3', metalness: 0.9, roughness: 0.22 }),
    knob: toy('#1d1b2c'),
  };
  return MATS;
}

function propGeos(): Kit['g'] {
  const sack = new THREE.SphereGeometry(0.55, 22, 16);
  sack.scale(1, 1.12, 0.85);
  const lid = new THREE.SphereGeometry(0.62, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  lid.scale(1, 0.32, 1);
  const loaf = new THREE.SphereGeometry(0.22, 14, 10);
  loaf.scale(1.4, 0.75, 0.9);
  return {
    sack,
    neck: new THREE.CylinderGeometry(0.16, 0.3, 0.28, 14),
    tie: new THREE.TorusGeometry(0.18, 0.045, 6, 16),
    tuft: new THREE.ConeGeometry(0.16, 0.22, 8),
    can: new THREE.CylinderGeometry(0.42, 0.42, 0.95, 26),
    canRim: new THREE.TorusGeometry(0.41, 0.035, 6, 26),
    glass: new THREE.SphereGeometry(0.55, 22, 16),
    basket: new THREE.CylinderGeometry(0.57, 0.5, 0.62, 22),
    jarNeck: new THREE.CylinderGeometry(0.11, 0.17, 0.48, 12),
    cork: new THREE.CylinderGeometry(0.12, 0.1, 0.14, 10),
    seat: rbox(0.82, 0.1, 0.82, 0.04),
    leg: new THREE.CylinderGeometry(0.04, 0.035, 0.5, 8),
    post: new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8),
    slat: rbox(0.72, 0.12, 0.06, 0.03),
    cushion: rbox(0.68, 0.08, 0.68, 0.04),
    bowl: new THREE.CylinderGeometry(0.5, 0.36, 0.42, 22),
    loaf,
    baguette: new THREE.CapsuleGeometry(0.07, 0.75, 4, 10),
    pot: new THREE.CylinderGeometry(0.6, 0.55, 0.78, 28),
    lid,
    knob: new THREE.SphereGeometry(0.09, 10, 8),
    handle: new THREE.TorusGeometry(0.12, 0.035, 6, 14),
  };
}

function makeProp(t: number, k: Kit) {
  const { g, m } = k;
  const o = new THREE.Group();
  const add = (geo: string, mat: string, x: number, y: number, z: number, line = 0) => {
    const mesh = new THREE.Mesh(g[geo], m[mat]);
    mesh.position.set(x, y, z);
    if (line) outlined(mesh, line);
    o.add(mesh);
    return mesh;
  };
  if (t === 0) {
    // sacco di farina
    add('sack', 'sack', 0, 0.6, 0, 1.05);
    add('neck', 'sack', 0, 1.25, 0);
    const tie = add('tie', 'rope', 0, 1.2, 0);
    tie.rotation.x = Math.PI / 2;
    add('tuft', 'sack', 0, 1.46, 0);
  } else if (t === 1) {
    // barattolo di pomodoro
    add('can', 'can', 0, 0.475, 0, 1.05);
    for (const y of [0.04, 0.93]) add('canRim', 'steel', 0, y, 0).rotation.x = Math.PI / 2;
  } else if (t === 2) {
    // damigiana impagliata
    add('glass', 'glass', 0, 0.68, 0, 1.04).scale.y = 1.05;
    add('basket', 'wicker', 0, 0.32, 0);
    add('jarNeck', 'glass', 0, 1.42, 0);
    add('cork', 'cork', 0, 1.7, 0);
  } else if (t === 3) {
    // sedia di legno col cuscino a quadretti
    add('seat', 'wood', 0, 0.5, 0, 1.06);
    for (const x of [-0.34, 0.34]) for (const z of [-0.34, 0.34]) add('leg', 'wood', x, 0.24, z);
    for (const x of [-0.34, 0.34]) add('post', 'wood', x, 0.92, -0.36);
    for (const y of [0.92, 1.18]) add('slat', 'wood', 0, y, -0.36);
    add('cushion', 'cushion', 0, 0.59, 0.02);
  } else if (t === 4) {
    // cesta del pane
    add('bowl', 'wicker', 0, 0.21, 0, 1.05);
    add('loaf', 'bread', -0.15, 0.48, 0.1).rotation.y = 0.5;
    add('loaf', 'crust', 0.18, 0.47, -0.08).rotation.y = -0.6;
    const b1 = add('baguette', 'bread', -0.1, 0.72, -0.18);
    b1.rotation.set(0.35, 0, 0.3);
    const b2 = add('baguette', 'crust', 0.14, 0.7, -0.05);
    b2.rotation.set(-0.25, 0, -0.35);
  } else {
    // pentolone
    add('pot', 'pot', 0, 0.39, 0, 1.04);
    add('lid', 'pot', 0, 0.78, 0);
    add('knob', 'knob', 0, 0.98, 0);
    for (const s of [-1, 1]) {
      const h = add('handle', 'knob', s * 0.64, 0.58, 0);
      h.rotation.y = Math.PI / 2;
    }
  }
  return shadowy(o);
}

let DECO_KIT: Kit | null = null; // per i travestimenti (le geometrie dell'arena si buttano a ogni minigioco)
const decoKit = () => (DECO_KIT ??= { g: propGeos(), m: propMats() });

// ---------------------------------------------------------------- cappello, mattarello, benda
let SEEK_KIT: { hat: THREE.BufferGeometry; puff: THREE.BufferGeometry; pin: THREE.BufferGeometry; grip: THREE.BufferGeometry; band: THREE.BufferGeometry; star: THREE.BufferGeometry; note: THREE.SpriteMaterial; arrow: THREE.BufferGeometry } | null = null;
function seekKit() {
  if (SEEK_KIT) return SEEK_KIT;
  const noteTex = canvasTex(128, 128, (c) => {
    c.font = '900 110px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 14;
    c.strokeStyle = '#1d0f3d';
    c.strokeText('♪', 64, 66);
    c.fillStyle = '#ffd60a';
    c.fillText('♪', 64, 62);
  });
  SEEK_KIT = {
    hat: new THREE.CylinderGeometry(0.36, 0.32, 0.38, 18),
    puff: new THREE.SphereGeometry(0.46, 18, 12),
    pin: new THREE.CylinderGeometry(0.13, 0.13, 1.25, 14),
    grip: new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8),
    band: new THREE.TorusGeometry(0.5, 0.07, 8, 24),
    star: new THREE.OctahedronGeometry(0.11, 0),
    note: new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthTest: false, toneMapped: false }),
    arrow: new THREE.ConeGeometry(0.22, 0.4, 4),
  };
  return SEEK_KIT;
}
const WHITE = () => toy('#ffffff', { roughness: 0.5 });
let SEEK_MATS: { white: THREE.Material; wood: THREE.Material; band: THREE.Material; star: THREE.Material; mine: THREE.Material } | null = null;
const seekMats = () => (SEEK_MATS ??= { white: WHITE(), wood: toy('#e0b07a', { roughness: 0.6 }), band: toy('#1d1b2c'), star: glow('#ffd60a', 2.2), mine: glow('#ffbe0b', 2) });

function makeSeekerDeco() {
  const K = seekKit();
  const M = seekMats();
  const hat = new THREE.Group();
  hat.name = 'nasc-hat';
  const base = outlined(new THREE.Mesh(K.hat, M.white), 1.06);
  base.position.y = 0.62;
  const puff = outlined(new THREE.Mesh(K.puff, M.white), 1.04);
  puff.scale.set(1, 0.72, 1);
  puff.position.y = 0.95;
  const band = new THREE.Mesh(K.band, M.band);
  band.name = 'nasc-blind';
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.05;
  const stars = new THREE.Group();
  stars.name = 'nasc-stars';
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(K.star, M.star);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.sin(a) * 0.5, 1.35, Math.cos(a) * 0.5);
    stars.add(s);
  }
  hat.add(base, puff, band, stars);
  // il mattarello in mano (gira intorno alla spalla destra)
  const arm = new THREE.Group();
  arm.name = 'nasc-pin';
  arm.position.set(0.57, 1.16, 0);
  const pin = outlined(new THREE.Mesh(K.pin, M.wood), 1.08);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(-0.15, -0.72, 0);
  for (const x of [-0.95, 0.65]) {
    const gr = new THREE.Mesh(K.grip, M.wood);
    gr.rotation.z = Math.PI / 2;
    gr.position.set(x, -0.72, 0);
    arm.add(gr);
  }
  arm.add(pin);
  return { hat: shadowy(hat, true, false), arm: shadowy(arm, true, false) };
}

// ---------------------------------------------------------------- la cucina
const terracotta = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#8f4a2c';
      c.fillRect(0, 0, 256, 256);
      const cols = ['#d4744a', '#c96a41', '#dc8158', '#cd7046'];
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          c.fillStyle = cols[i * 2 + j];
          c.fillRect(i * 128 + 4, j * 128 + 4, 120, 120);
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.fillRect(i * 128 + 12, j * 128 + 10, 60, 10);
        }
    },
    [15, 15],
  );
const azulejo = () =>
  canvasTex(
    128,
    128,
    (c) => {
      c.fillStyle = '#f5f1e6';
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#2a6fdb';
      c.lineWidth = 6;
      c.strokeRect(3, 3, 122, 122);
      c.fillStyle = '#2a6fdb';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 14 : 34;
        c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      c.fill();
      c.fillStyle = '#ffc93c';
      c.beginPath();
      c.arc(64, 64, 9, 0, Math.PI * 2);
      c.fill();
    },
    [16, 1],
  );
const bricks = () =>
  canvasTex(
    128,
    128,
    (c) => {
      c.fillStyle = '#e8d3b0';
      c.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 5; x++) {
          c.fillStyle = (x + y) % 3 ? '#c4643c' : '#b0532f';
          c.fillRect(x * 28 + (y % 2 ? 14 : 0) - 14 + 2, y * 16 + 2, 24, 12);
        }
    },
    [4, 2],
  );
const label = (text: string, bg: string, fg = '#ffffff') =>
  canvasTex(512, 128, (c) => {
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(4, 4, 504, 120, 30);
    c.fill();
    c.font = '900 76px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 14;
    c.strokeStyle = '#1d0f3d';
    c.strokeText(text, 256, 68);
    c.fillStyle = fg;
    c.fillText(text, 256, 64);
  });

function furniture(k: string, w: number, d: number, h: number) {
  const g = new THREE.Group();
  const wood = toy('#a8672e', { roughness: 0.6 });
  const marble = toy('#f2efe8', { roughness: 0.2, clearcoat: 0.8 });
  if (k === 'forno') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, d), matte('#ffffff', { map: bricks() }));
    base.position.y = 0.65;
    const dome = outlined(new THREE.Mesh(new THREE.SphereGeometry(w * 0.46, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), toy('#e2a970', { roughness: 0.8 })), 1.03);
    dome.scale.y = 0.85;
    dome.position.y = 1.3;
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#2b1408' }));
    mouth.position.set(0, 1.32, d * 0.47);
    const embers = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), glow('#ff7b00', 2.4));
    embers.scale.set(1, 0.4, 0.6);
    embers.position.set(0, 1.42, d * 0.42);
    embers.name = 'embers';
    const chimney = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 2.2, 12), toy('#c4643c')), 1.05);
    chimney.position.set(0.6, 3.2, -0.6);
    g.add(base, dome, mouth, embers, chimney);
  } else if (k === 'botti') {
    const barrelG = new THREE.CylinderGeometry(0.88, 0.88, 1.7, 22);
    const bandG = new THREE.TorusGeometry(0.89, 0.05, 6, 24);
    const bw = toy('#8c4f23', { roughness: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: '#4a4a55', metalness: 0.7, roughness: 0.4 });
    for (const [x, y] of [
      [-0.9, 0.88],
      [0.9, 0.88],
      [0, 2.4],
    ]) {
      const b = outlined(new THREE.Mesh(barrelG, bw), 1.03);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, 0);
      for (const z of [-0.55, 0.55]) {
        const band = new THREE.Mesh(bandG, metal);
        band.position.set(x, y, z);
        g.add(band);
      }
      g.add(b);
    }
  } else if (k === 'tavolo') {
    const cloth = canvasTex(128, 128, (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
          c.fillRect(i * 16, j * 16, 16, 16);
        }
    }, [3, 2]);
    const top = outlined(new THREE.Mesh(rbox(w, 0.12, d, 0.04), toy('#ffffff', { map: cloth, roughness: 0.7 })), 1.03);
    top.position.y = 0.86;
    g.add(top);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2])
      for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.82, 8), wood);
        leg.position.set(x, 0.41, z);
        g.add(leg);
      }
    // piatti di spaghetti e un fiasco
    for (const x of [-0.9, 0.9]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.05, 20), toy('#ffffff'));
      plate.position.set(x, 0.95, 0);
      const pasta = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), toy('#f4c96b'));
      pasta.scale.y = 0.4;
      pasta.position.set(x, 1.0, 0);
      const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toy('#d62828'));
      sauce.position.set(x, 1.06, 0);
      g.add(plate, pasta, sauce);
    }
    const fiasco = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toy('#7a1f2b', { clearcoat: 1 }));
    fiasco.position.set(0, 1.12, 0.2);
    g.add(fiasco);
  } else {
    // banchi: legno con sopra il marmo (e la tenda a righe per il mercato)
    const body = outlined(new THREE.Mesh(rbox(w, h - 0.1, d, 0.08), wood), 1.02);
    body.position.y = (h - 0.1) / 2;
    const top = new THREE.Mesh(rbox(w + 0.15, 0.12, d + 0.15, 0.05), marble);
    top.position.y = h - 0.04;
    g.add(body, top);
    if (k === 'mercato') {
      const stripes = canvasTex(256, 64, (c) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? '#ffffff' : '#2d9c4a';
          c.fillRect(i * 32, 0, 32, 64);
        }
      }, [1, 3]);
      const awning = outlined(new THREE.Mesh(rbox(w + 0.8, 0.12, d + 0.6, 0.05), toy('#ffffff', { map: stripes })), 1.02);
      awning.position.set(0.3, 3.0, 0);
      awning.rotation.z = -0.22;
      g.add(awning);
      for (const z of [-d / 2, d / 2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), toy('#ffffff'));
        pole.position.set(w / 2 + 0.1, 1.5, z);
        g.add(pole);
      }
      // cassette di verdura sul banco
      const veg = ['#d62828', '#ff9f1c', '#7ae031', '#8338ec'];
      for (let i = 0; i < 4; i++) {
        const box = new THREE.Mesh(rbox(1.2, 0.35, 1.3, 0.04), toy('#c98a4b'));
        box.position.set(0, h + 0.18, -d / 2 + 0.9 + i * 1.75);
        const pile = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), toy(veg[i]));
        pile.scale.set(1.1, 0.45, 1.2);
        pile.position.set(0, h + 0.38, box.position.z);
        g.add(box, pile);
      }
    } else if (k === 'banco') {
      for (let i = 0; i < 6; i++) {
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), toy(i % 2 ? '#d99a4e' : '#b9732f'));
        loaf.scale.set(1.5, 0.7, 0.9);
        loaf.position.set(0, h + 0.18, -d / 2 + 0.7 + i * 1.1);
        loaf.rotation.y = i;
        g.add(loaf);
      }
    } else if (k === 'isola') {
      const dough = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), toy('#fff1c9', { roughness: 0.9 }));
      dough.scale.set(1.2, 0.35, 1);
      dough.position.set(-0.6, h + 0.12, 0);
      const flour = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), matte('#ffffff'));
      flour.rotation.x = -Math.PI / 2;
      flour.position.set(0.6, h + 0.02, 0);
      g.add(dough, flour);
    }
  }
  return shadowy(g);
}

// la Vespa che gira per la piazza (si muove sullo sfondo)
function vespa() {
  const g = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.4, 6, 14), toy('#7fd1c7')), 1.04);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.9;
  const shield = new THREE.Mesh(rbox(0.9, 1.3, 0.2, 0.1), toy('#7fd1c7'));
  shield.position.set(0, 1.4, 0.85);
  const seat = new THREE.Mesh(rbox(0.6, 0.18, 1.0, 0.08), toy('#5a3a22'));
  seat.position.set(0, 1.55, -0.3);
  const wheelG = new THREE.TorusGeometry(0.35, 0.13, 8, 18);
  for (const z of [-0.85, 0.95]) {
    const w = new THREE.Mesh(wheelG, toy('#222222'));
    w.rotation.y = Math.PI / 2;
    w.position.set(0, 0.42, z);
    g.add(w);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow('#fff3b0', 2));
  lamp.position.set(0, 2.05, 0.95);
  g.add(body, shield, seat, lamp);
  return shadowy(g);
}

registerClientMini({
  kind: 'NASCONDINO',
  orbit: { c: [0, 0, 1], r: 30 },
  icon: (size) => (
    <Badge size={size} from="#c77dff" to="#7b2cbf">
      <ellipse cx="36" cy="62" rx="17" ry="22" fill="#efe0bd" {...stroke} />
      <path d="M28 40 Q36 34 44 40" fill="none" {...stroke} />
      <path d="M26 58 h20" stroke="#c1121f" strokeWidth="5" />
      <circle cx="31" cy="66" r="3" fill="#1d0f3d" />
      <circle cx="41" cy="66" r="3" fill="#1d0f3d" />
      <rect x="54" y="44" width="26" height="34" rx="6" fill="#e63946" {...stroke} />
      <rect x="54" y="54" width="26" height="12" fill="#fff3d6" />
      <path d="M62 22 l18 16" stroke="#e0b07a" strokeWidth="9" strokeLinecap="round" />
      <path d="M62 22 l18 16" fill="none" {...stroke} strokeWidth="2" />
      <path d="M50 18 q4 -8 10 -4" fill="none" stroke="#ffd60a" strokeWidth="4" strokeLinecap="round" />
    </Badge>
  ),
  hint: 'WASD muovi · E: TRASFORMATI (vicino a un oggetto) / COLPISCI / FISCHIO · Shift scatto',
  feed: {
    trovato: ['{n} è stato trovato!', 'Beccato! {n} era travestito', '{n} non era un oggetto vero'],
  },
  build(world) {
    const g = world.arena;
    const H = HIDE.half;
    // pavimento di cotto e la piazza intorno
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), matte('#ffffff', { map: terracotta(), roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const piazza = new THREE.Mesh(new THREE.CircleGeometry(70, 48), matte('#cbb894', { roughness: 0.9 }));
    piazza.rotation.x = -Math.PI / 2;
    piazza.position.y = -0.04;
    piazza.receiveShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(70, 60, 6, 48), matte('#a88f6a'));
    base.position.y = -3.1;
    g.add(floor, piazza, base);
    // banconi bassi tutto intorno (bassi: la telecamera ci vede sopra)
    const counterM = [matte('#ffffff', { map: azulejo() }), matte('#ffffff', { map: azulejo() }), toy('#a8672e', { roughness: 0.6 }), matte('#e8e1d0'), matte('#ffffff', { map: azulejo() }), matte('#ffffff', { map: azulejo() })];
    const counter = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), counterM);
      m.position.set(x, 0.55, z);
      g.add(shadowy(m));
    };
    counter(0, -H - 0.45, H * 2 + 1.8, 0.9);
    counter(-H - 0.45, 0, 0.9, H * 2);
    counter(H - 0.45 + 0.9, 0, 0.9, H * 2);
    counter((-H - 0.9 + PANTRY.x0) / 2, H + 0.45, PANTRY.x0 + H + 0.9, 0.9);
    counter((H + 0.9 + PANTRY.x1) / 2, H + 0.45, H + 0.9 - PANTRY.x1, 0.9);
    // barattoli sui banconi
    const jarG = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12);
    const jarCols = ['#ff9f1c', '#d62828', '#7ae031', '#ffd60a', '#ff70a6'];
    for (let i = 0; i < 26; i++) {
      const side = i % 3;
      const u = -H + 1 + ((i * 2.3) % (H * 2 - 2));
      const jar = new THREE.Mesh(jarG, toy(jarCols[i % jarCols.length], { clearcoat: 0.8 }));
      if (side === 0) jar.position.set(u, 1.35, -H - 0.45);
      else if (side === 1) jar.position.set(-H - 0.45, 1.35, u);
      else jar.position.set(H + 0.45, 1.35, u);
      g.add(jar);
    }
    // la dispensa: stanzetta con la porta che si apre quando parte la ricerca
    const wallM = toy('#fff4e0', { roughness: 0.7 });
    const wallH = 2.7;
    const wall = (x: number, z: number, w: number, d: number) => {
      const m = outlined(new THREE.Mesh(rbox(w, wallH, d, 0.06), wallM), 1.01);
      m.position.set(x, wallH / 2, z);
      g.add(shadowy(m));
    };
    const pw = PANTRY.x1 - PANTRY.x0;
    wall(PANTRY.x0 - 0.15, (PANTRY.z0 + PANTRY.z1) / 2, 0.3, PANTRY.z1 - PANTRY.z0 + 0.3);
    wall(PANTRY.x1 + 0.15, (PANTRY.z0 + PANTRY.z1) / 2, 0.3, PANTRY.z1 - PANTRY.z0 + 0.3);
    wall(0, PANTRY.z1 + 0.15, pw + 0.6, 0.3);
    const seg = PANTRY.x1 - HIDE.door;
    wall(-(HIDE.door + seg / 2), PANTRY.z0, seg, 0.3);
    wall(HIDE.door + seg / 2, PANTRY.z0, seg, 0.3);
    const lintel = new THREE.Mesh(rbox(HIDE.door * 2 + 0.2, 0.5, 0.32, 0.06), wallM);
    lintel.position.set(0, wallH - 0.25, PANTRY.z0);
    g.add(lintel);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: label('DISPENSA', '#c1121f'), transparent: true, toneMapped: false }));
    sign.position.set(0, wallH + 0.45, PANTRY.z0 - 0.2);
    sign.rotation.y = Math.PI;
    g.add(sign);
    const doors: THREE.Group[] = [];
    const doorM = toy('#7a4a24', { roughness: 0.55 });
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * HIDE.door, 0, PANTRY.z0);
      const leaf = outlined(new THREE.Mesh(rbox(HIDE.door, wallH - 0.55, 0.12, 0.04), doorM), 1.02);
      leaf.position.set(-s * HIDE.door * 0.5, (wallH - 0.55) / 2, 0);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toy('#ffd60a', { metalness: 0.6 }));
      knob.position.set(-s * (HIDE.door - 0.18), 1.05, -0.1);
      pivot.add(leaf, knob);
      pivot.userData.s = s;
      doors.push(pivot);
      g.add(shadowy(pivot));
    }
    // scaffali coi sacchi dentro la dispensa
    for (const y of [0.8, 1.7]) {
      const shelf = new THREE.Mesh(rbox(pw - 0.4, 0.08, 0.7, 0.02), toy('#a8672e'));
      shelf.position.set(0, y, PANTRY.z1 - 0.45);
      g.add(shelf);
      for (let i = 0; i < 5; i++) {
        const jar = new THREE.Mesh(jarG, toy(jarCols[(i + Math.round(y)) % jarCols.length]));
        jar.position.set(-2.4 + i * 1.2, y + 0.3, PANTRY.z1 - 0.45);
        g.add(jar);
      }
    }
    // mobili veri
    let embers: THREE.Mesh | null = null;
    for (const f of FURNITURE) {
      const m = furniture(f.k, f.w, f.d, f.h);
      m.position.set(f.x, 0, f.z);
      if (f.k === 'forno') {
        m.rotation.y = Math.atan2(-f.x, -f.z); // la bocca del forno guarda la stanza
        embers = m.getObjectByName('embers') as THREE.Mesh;
      }
      g.add(m);
    }
    // gli oggetti veri (stessa ricetta dei travestimenti)
    const arenaKit: Kit = { g: propGeos(), m: propMats() };
    for (const o of PROPS) {
      const p = makeProp(o.t, arenaKit);
      p.position.set(o.x, 0, o.z);
      p.rotation.y = o.a;
      g.add(p);
    }
    // fumo dal camino del forno
    const smokeG = new THREE.SphereGeometry(0.45, 10, 8);
    const smokeM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
    const forno = FURNITURE[0];
    const chim = new THREE.Vector3(0.6, 4.4, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-forno.x, -forno.z)).add(new THREE.Vector3(forno.x, 0, forno.z));
    const smoke: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(smokeG, smokeM);
      s.userData.ph = i / 5;
      smoke.push(s);
      g.add(s);
    }
    // lucine e bandierine sopra la cucina, palloncini, alberi di limoni, la Vespa
    for (const [a, b] of [
      [new THREE.Vector3(-H, 6.5, -H), new THREE.Vector3(H, 6.5, H)],
      [new THREE.Vector3(H, 6.5, -H), new THREE.Vector3(-H, 6.5, H)],
    ])
      g.add(flagLine(a, b, 26));
    const poleG = new THREE.CylinderGeometry(0.12, 0.15, 7, 8);
    for (const x of [-H - 1, H + 1])
      for (const z of [-H - 1, H + 1]) {
        const pole = new THREE.Mesh(poleG, toy('#ffffff'));
        pole.position.set(x, 3.5, z);
        g.add(pole);
      }
    const potG = new THREE.CylinderGeometry(0.9, 0.7, 1.2, 14);
    const crownG = new THREE.IcosahedronGeometry(1.8, 1);
    const lemonG = new THREE.SphereGeometry(0.28, 10, 8);
    const lemonM = toy('#ffe600');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const t = new THREE.Group();
      const pot = new THREE.Mesh(potG, toy('#c4643c'));
      pot.position.y = 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2, 6), toy('#8a5a2b'));
      trunk.position.y = 2;
      const crown = new THREE.Mesh(crownG, toy('#2d9c4a', { roughness: 0.7 }));
      crown.position.y = 3.6;
      t.add(pot, trunk, crown);
      for (let k = 0; k < 6; k++) {
        const l = new THREE.Mesh(lemonG, lemonM);
        const b = (k / 6) * Math.PI * 2;
        l.position.set(Math.sin(b) * 1.6, 3.4 + (k % 2) * 0.6, Math.cos(b) * 1.6);
        t.add(l);
      }
      t.position.set(Math.sin(a) * 21, 0, Math.cos(a) * 21);
      g.add(shadowy(t));
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const b = balloon(['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0'][i % 4]);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.sin(a) * 19, 6 + (i % 3) * 2, Math.cos(a) * 19);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    const scooter = vespa();
    g.add(scooter);
    // il segno sotto l'oggetto che colpirei (solo per i cercatori)
    const aim = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32), new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    aim.rotation.x = -Math.PI / 2;
    aim.position.y = 0.04;
    aim.visible = false;
    g.add(aim);
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -19;
    sh.right = sh.top = 19;
    let doorOpen = 0;

    return (f) => {
      const E = f.ext as Ext;
      // la porta della dispensa si spalanca
      const open = E?.phase === 'SEEK' && f.view.stage === 'PLAY' ? 1 : f.view.stage === 'RESULT' ? 1 : 0;
      doorOpen += (open - doorOpen) * Math.min(1, f.dt * 5);
      for (const d of doors) d.rotation.y = d.userData.s * doorOpen * 1.75;
      if (embers) embers.scale.set(1 + Math.sin(f.t * 7) * 0.08, 0.4 + Math.sin(f.t * 11) * 0.05, 0.6);
      smoke.forEach((s) => {
        const k = (f.t * 0.35 + s.userData.ph) % 1;
        s.position.set(chim.x + Math.sin(k * 6 + s.userData.ph * 9) * 0.4, chim.y + k * 4, chim.z);
        s.scale.setScalar(0.5 + k * 1.4);
      });
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
      const va = f.t * 0.22;
      scooter.position.set(Math.sin(va) * 25, 0, Math.cos(va) * 25);
      scooter.rotation.y = va + Math.PI / 2;
      // cercatore: dove andrebbe il colpo (oggetti veri e travestiti, senza distinzione)
      aim.visible = false;
      if (E && E.phase === 'SEEK' && f.view.stage === 'PLAY' && E.seekers.includes(f.myId) && f.view.alive[f.myId]) {
        const t = aimTarget(f, E);
        if (t) {
          aim.visible = true;
          aim.position.x = t.x;
          aim.position.z = t.z;
          aim.scale.setScalar(1 + Math.sin(f.t * 8) * 0.06);
        }
      }
    };
  },
  decorate(av, id, f) {
    const E = f.ext as Ext;
    if (!E) return;
    const seeker = E.seekers.includes(id);
    if (seeker) {
      let hat = av.headDeco.getObjectByName('nasc-hat');
      let arm = av.deco.getObjectByName('nasc-pin');
      if (!hat || !arm) {
        const d = makeSeekerDeco();
        hat = d.hat;
        arm = d.arm;
        av.headDeco.add(hat);
        av.deco.add(arm);
      }
      // la benda mentre gli altri si nascondono, le stelline se stordito
      const blind = hat.getObjectByName('nasc-blind');
      if (blind) blind.visible = E.phase === 'HIDE' && f.view.stage === 'PLAY';
      const stars = hat.getObjectByName('nasc-stars');
      if (stars) {
        stars.visible = (stunUntil.get(id) ?? 0) > Date.now();
        if (stars.visible) stars.rotation.y = f.t * 8;
      }
      // il colpo di mattarello: su e giù
      const e = (performance.now() - (swingAt.get(id) ?? 0)) / 1000;
      const ang = e < 0.12 ? -1.3 - (e / 0.12) * 1.5 : e < 0.32 ? -2.8 + ((e - 0.12) / 0.2) * 2.4 : -1.15 + Math.sin(f.t * 2) * 0.05;
      arm.rotation.x = ang;
      av.armR.rotation.x = ang;
      return;
    }
    // chi si nasconde: diventa l'oggetto (fino alla fine: poi si svela)
    const t = f.view.stage === 'PLAY' ? E.disguise[id] : undefined;
    let prop = av.deco.getObjectByName('nasc-prop') as THREE.Group | undefined;
    if (prop && prop.userData.t !== t) {
      av.deco.remove(prop);
      prop = undefined;
    }
    if (t !== undefined && !prop) {
      prop = makeProp(t, decoKit());
      prop.name = 'nasc-prop';
      prop.userData.t = t;
      prop.userData.lx = av.root.position.x;
      prop.userData.lz = av.root.position.z;
      prop.userData.hop = 0;
      av.deco.add(prop);
    }
    av.body.visible = !prop;
    av.label.visible = !prop;
    if (!prop) return;
    // se si muove, l'oggetto saltella (e si nota!)
    const U = prop.userData;
    const sp = Math.hypot(av.root.position.x - U.lx, av.root.position.z - U.lz) / Math.max(0.001, f.dt);
    U.lx = av.root.position.x;
    U.lz = av.root.position.z;
    U.hop += ((sp > 0.8 ? 1 : 0) - U.hop) * Math.min(1, f.dt * 10);
    const k = Math.abs(Math.sin(f.t * 13));
    prop.position.y = U.hop * k * 0.22;
    prop.scale.set(1 + U.hop * (1 - k) * 0.08, 1 - U.hop * (1 - k) * 0.1, 1 + U.hop * (1 - k) * 0.08);
    // la notina di chi ha appena fischiato
    let note = prop.getObjectByName('nasc-note') as THREE.Sprite | undefined;
    const w = (Date.now() - (whistleAt.get(id) ?? 0)) / 1000;
    if (w < 2.6) {
      if (!note) {
        note = new THREE.Sprite(seekKit().note);
        note.name = 'nasc-note';
        note.renderOrder = 12;
        prop.add(note);
      }
      note.visible = true;
      note.position.set(Math.sin(w * 5) * 0.3, 1.9 + w * 0.5, 0);
      note.scale.setScalar(0.9 * Math.min(1, w * 6) * (1 - Math.max(0, w - 2) / 0.6));
    } else if (note) note.visible = false;
    // solo sul mio telefono: una freccetta per ritrovarmi
    if (id === f.myId) {
      let me = prop.getObjectByName('nasc-me') as THREE.Mesh | undefined;
      if (!me) {
        me = new THREE.Mesh(seekKit().arrow, seekMats().mine);
        me.name = 'nasc-me';
        me.rotation.x = Math.PI;
        prop.add(me);
      }
      me.position.y = 2.1 + Math.sin(f.t * 4) * 0.12;
      me.rotation.y = f.t * 2;
    }
  },
  speed: (f) => {
    const E = f.ext as Ext;
    if (!E || f.view.stage !== 'PLAY') return 1;
    if (E.seekers.includes(f.myId)) return E.phase === 'HIDE' || (stunUntil.get(f.myId) ?? 0) > Date.now() ? 0 : 1;
    return E.phase === 'SEEK' ? 0.85 : 1;
  },
  status(h) {
    const E = h.ext as Ext;
    if (!E) return null;
    const left = Math.max(0, Math.ceil((E.seekAt - h.now) / 1000));
    if (E.seekers.includes(h.myId)) {
      if (E.phase === 'HIDE') return { text: `OCCHI CHIUSI… ${left}`, cls: 'sc-dark' };
      if ((stunUntil.get(h.myId) ?? 0) > Date.now()) return { text: 'STORDITO! ERA UN OGGETTO VERO', cls: 'sc-red pulse-soft' };
      return { text: 'COLPISCI GLI OGGETTI SOSPETTI', cls: 'sc-red' };
    }
    const t = E.disguise[h.myId];
    if (E.phase === 'HIDE') return t === undefined ? { text: `TRASFORMATI VICINO A UN OGGETTO! ${left}`, cls: 'sc-purple pulse-soft' } : { text: `SEI ${PROP_NAMES[t]}: NASCONDITI! ${left}`, cls: 'sc-purple' };
    const near = E.seekers.some((id) => {
      const o = h.others.get(id);
      return o && Math.hypot(o.x - h.me.x, o.z - h.me.z) < 4;
    });
    if (near) return { text: 'UN CERCATORE È VICINO… FERMO!', cls: 'sc-red pulse-soft' };
    return { text: 'NON MUOVERTI… O FISCHIA (+2)', cls: 'sc-dark' };
  },
  button(h) {
    const E = h.ext as Ext;
    if (!E) return null;
    const now = Date.now();
    if (E.seekers.includes(h.myId)) {
      const stunned = (stunUntil.get(h.myId) ?? 0) > now;
      return {
        icon: <PinIcon />,
        label: 'COLPISCI',
        cls: E.phase === 'SEEK' && !stunned ? 'sc-red' : 'sc-dark',
        size: 84,
        disabled: E.phase !== 'SEEK' || stunned,
        cooldown: hitReady > now ? { until: hitReady, total: HIDE.hitCd } : undefined,
        press: () => {
          if (Date.now() < hitReady) return;
          hitReady = Date.now() + HIDE.hitCd;
          swingAt.set(h.myId, performance.now());
          soundManager.playWhoosh();
          h.act('MG_NASC_HIT', { x: h.me.x, z: h.me.z, r: h.me.r });
        },
      };
    }
    if (E.phase === 'HIDE')
      return {
        icon: <WandIcon />,
        label: 'TRASFORMATI',
        cls: 'sc-purple',
        size: 84,
        cooldown: morphReady > now ? { until: morphReady, total: 400 } : undefined,
        press: () => {
          if (Date.now() < morphReady) return;
          morphReady = Date.now() + 400;
          // diventa l'oggetto vero più vicino (premendo ancora si cambia)
          const cur = E.disguise[h.myId];
          let best = -1;
          let bd = 3.5;
          for (const o of PROPS) {
            const d = Math.hypot(o.x - h.me.x, o.z - h.me.z);
            if (d < bd && o.t !== cur) {
              bd = d;
              best = o.t;
            }
          }
          const t = best >= 0 ? best : ((cur ?? -1) + 1) % PROP_TYPES.length;
          h.act('MG_NASC_MORPH', { t });
        },
      };
    const used = whistleReady > now;
    return {
      icon: <WhistleIcon />,
      label: 'FISCHIO',
      cls: used ? 'sc-dark' : 'sc-yellow',
      size: 80,
      disabled: used,
      cooldown: used ? { until: whistleReady, total: HIDE.whistleCd } : undefined,
      press: () => {
        if (Date.now() < whistleReady) return;
        whistleReady = Date.now() + HIDE.whistleCd;
        h.act('MG_NASC_FISCHIO');
      },
    };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const hidden = Object.keys(h.view.alive).filter((id) => h.view.alive[id] && !E.seekers.includes(id)).length;
    const seeker = E.seekers.includes(h.myId);
    const left = Math.max(0, Math.ceil((E.seekAt - h.now) / 1000));
    const top = Object.entries(E.score)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center">
          <p className="sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white">
            <span className={`rounded-full px-2 py-0.5 ${seeker ? 'bg-rose-500' : 'bg-violet-500'}`}>{seeker ? 'CERCATORE' : 'TI NASCONDI'}</span>
            {`Nascosti: ${hidden}`}
            {!seeker && h.alive && <span className="text-amber-300">{`· ${E.score[h.myId] ?? 0} punti`}</span>}
          </p>
        </div>
        {top.length > 0 && (
          <div className="pointer-events-none absolute left-3 top-[100px] flex flex-col gap-1">
            {top.map(([id, v], i) => (
              <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
                <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
                {h.nameOf(id)} · {v}
              </p>
            ))}
          </div>
        )}
        {/* i cercatori aspettano a occhi chiusi */}
        {seeker && E.phase === 'HIDE' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0b0618]/95 px-6 text-center">
            <svg width="120" height="60" viewBox="0 0 120 60" aria-hidden="true">
              <path d="M10 22 Q30 46 50 22" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
              <path d="M70 22 Q90 46 110 22" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
              <path d="M16 34 l-6 8 M30 40 v9 M44 34 l6 8 M76 34 l-6 8 M90 40 v9 M104 34 l6 8" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <p className="sc-stroke font-display text-4xl text-white">OCCHI CHIUSI!</p>
            <p className="max-w-xs text-sm font-bold text-white/80">Sei chiuso in dispensa: gli altri si stanno travestendo da oggetti della cucina. Poi colpisci quelli sospetti col mattarello… ma se è un oggetto vero resti stordito!</p>
            <p className="sc-stroke font-display text-7xl tabular-nums text-yellow-300">{left}</p>
          </div>
        )}
      </>
    );
  },
  fx(p, c) {
    if (p.k === 'nasc_morph') {
      const at = c.where(p.id);
      if (at) poof(c.world, at.x, at.y - 0.6, at.z);
      if (p.id === c.myId) {
        soundManager.playPop();
        haptic(30);
        c.feed(`Ora sei: ${PROP_NAMES[p.t] ?? 'un oggetto'}`);
      }
    } else if (p.k === 'nasc_go') {
      soundManager.playDoor();
      c.shake(0.25);
      c.feed('La dispensa si apre: arrivano i cercatori!');
    } else if (p.k === 'nasc_swing') {
      if (p.by !== c.myId) swingAt.set(p.by, performance.now());
    } else if (p.k === 'nasc_found') {
      if (p.by !== c.myId) swingAt.set(p.by, performance.now());
      burst(c.world, p.x, 1, p.z, ['#ffd60a', '#ff4d6d', '#ffffff', '#8338ec'], 50, 7);
      popText(c.world, p.x, 0.6, p.z, 'TROVATO!', '#ffd60a', { scale: 1.35, life: 1.2 });
      ringPulse(c.world, p.x, 0, p.z, '#ffd60a');
      if (p.by === c.myId) {
        soundManager.playSuccess();
        haptic([40, 30, 40]);
        c.feed(`Hai trovato ${c.nameOf(p.id)}! +${HIDE.foundPts}`);
      } else if (p.id !== c.myId) soundManager.playPop();
    } else if (p.k === 'nasc_miss') {
      if (p.by !== c.myId) swingAt.set(p.by, performance.now());
      stunUntil.set(p.by, Date.now() + (Number(p.ms) || HIDE.stunMs));
      const o = PROPS[p.i];
      if (o) {
        popText(c.world, o.x, 0.4, o.z, 'È VERO!', '#ff9f1c');
        burst(c.world, o.x, 0.8, o.z, ['#ffffff', '#ffd166'], 14, 4);
      }
      if (p.by === c.myId) {
        soundManager.playError();
        c.shake(0.35);
        haptic(80);
      } else soundManager.playBonk();
    } else if (p.k === 'nasc_fischio') {
      whistleAt.set(p.id, Date.now());
      const d = Math.hypot(c.me.x - p.x, c.me.z - p.z);
      // più sei vicino, più lo senti forte
      fischio(p.id === c.myId ? 0.12 : Math.max(0.03, 0.14 - d * 0.004));
      popText(c.world, p.x, 1.2, p.z, 'FIUU FIUU!', '#ffd60a', { scale: 0.8, life: 1.1 });
      if (p.id === c.myId && p.pts) c.feed(`Fischio! +${p.pts}`);
    }
  },
});

// il bersaglio del mattarello (come lo sceglie il server: il più vicino davanti)
function aimTarget(f: MiniFrame, E: NonNullable<Ext>) {
  const fx = Math.sin(f.me.r);
  const fz = Math.cos(f.me.r);
  let best: { x: number; z: number; s: number } | null = null;
  const consider = (x: number, z: number) => {
    const dx = x - f.me.x;
    const dz = z - f.me.z;
    const d = Math.hypot(dx, dz);
    if (d > HIDE.hitRange + 0.35) return;
    const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (dot < 0.3 && d > 1.0) return;
    const s = d - dot * 0.8;
    if (!best || s < best.s) best = { x, z, s };
  };
  for (const o of PROPS) consider(o.x, o.z);
  for (const [id, o] of f.others) if (f.view.alive[id] && !E.seekers.includes(id)) consider(o.x, o.z);
  return best as { x: number; z: number; s: number } | null;
}

function PinIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 24 L24 6" stroke="#1d0f3d" strokeWidth="9" strokeLinecap="round" />
      <path d="M6 24 L24 6" stroke="#e0b07a" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M3 29 L7 25 M25 5 L29 1" stroke="#1d0f3d" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
function WandIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 27 L19 14" stroke="#1d0f3d" strokeWidth="6" strokeLinecap="round" />
      <path d="M6 27 L19 14" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 3 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 z" fill="#ffd60a" stroke="#1d0f3d" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function WhistleIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="13" cy="19" r="8" fill="#ffd60a" stroke="#1d0f3d" strokeWidth="2.5" />
      <path d="M17 12 h11 v6 h-8" fill="#ffd60a" stroke="#1d0f3d" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="13" cy="19" r="2.5" fill="#1d0f3d" />
      <path d="M24 6 q3 -3 5 0" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
