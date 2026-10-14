// 🍕 Pizza express (telefono): pizzeria col forno a legna che fuma, sei tavoli colorati e numerati (si illuminano),
// pizze sul bancone, in mano ai camerieri (sopra la testa, con la bandierina del tavolo) e per terra dopo gli schiaffi
import * as THREE from 'three';
import { PIZ, PIZ_POTS, PIZ_SLOTS, PIZ_TABLES } from '../../../data/minis/pizze';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, dust, glow, matte, outlined, poof, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx, type MiniFrame } from './types';

type Ext = { pz: (number | string)[][]; s: Record<string, number>; dl: Record<string, number>; t0: number } | null;

interface PzC {
  i: number;
  d: number; // tavolo
  s: number; // 0 bancone, 1 in mano, 2 per terra
  slot: number;
  by: string;
  hot: number; // presa dal bancone (ora del server, 0 = mai)
  x: number;
  z: number;
  at: number; // atterraggio (per terra)
  fx: number;
  fz: number;
}

function decode(a: (number | string)[], t0: number): PzC {
  const n = (k: number) => Number(a[k] ?? 0);
  const base = { i: n(0), d: n(1), s: n(2), slot: 0, by: '', hot: 0, x: 0, z: 0, at: 0, fx: 0, fz: 0 };
  if (base.s === 0) return { ...base, slot: n(3) };
  if (base.s === 1) return { ...base, by: String(a[3]), hot: n(4) + t0 };
  return { ...base, x: n(3), z: n(4), at: n(5) + t0, fx: n(6), fz: n(7), hot: n(8) + t0 };
}

// ---------------------------------------------------------------- texture

let pizzaCache: THREE.Texture | null = null;
const pizzaTex = () =>
  (pizzaCache ??= canvasTex(256, 256, (c) => {
    c.fillStyle = '#f0b866';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#d93a2b';
    c.beginPath();
    c.arc(128, 128, 112, 0, Math.PI * 2);
    c.fill();
    const rnd = (() => {
      let x = 11;
      return () => (x = (x * 16807) % 2147483647) / 2147483647;
    })();
    c.fillStyle = '#ffeaa8';
    for (let k = 0; k < 16; k++) {
      c.beginPath();
      c.arc(40 + rnd() * 176, 40 + rnd() * 176, 10 + rnd() * 12, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#2d8a3e';
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      c.ellipse(50 + rnd() * 156, 50 + rnd() * 156, 10, 5, rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }));

// bandierina del tavolo: numero bianco sul colore del tavolo
const flagTexs: THREE.Texture[] = [];
const flagTex = (d: number) =>
  (flagTexs[d] ??= canvasTex(128, 96, (c) => {
    c.fillStyle = PIZ_TABLES[d].color;
    c.fillRect(0, 0, 128, 96);
    c.strokeStyle = '#1d0f3d';
    c.lineWidth = 8;
    c.strokeRect(4, 4, 120, 88);
    c.font = '900 76px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 10;
    c.strokeText(String(d + 1), 64, 52);
    c.fillStyle = '#ffffff';
    c.fillText(String(d + 1), 64, 50);
  }));

const floorTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          c.fillStyle = (i + j) % 2 ? '#f3e3c3' : '#d9774b';
          c.fillRect(i * 64, j * 64, 64, 64);
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.fillRect(i * 64 + 4, j * 64 + 4, 28, 8);
        }
    },
    [7, 7],
  );

const brickTex = (rep: [number, number]) =>
  canvasTex(
    256,
    128,
    (c) => {
      c.fillStyle = '#e8d9c0';
      c.fillRect(0, 0, 256, 128);
      const cols = ['#c0583a', '#b44f33', '#cc6442', '#a94a30'];
      for (let row = 0; row < 4; row++)
        for (let k = -1; k < 5; k++) {
          c.fillStyle = cols[(row + k + 4) % cols.length];
          c.fillRect(k * 64 + (row % 2 ? 32 : 0) + 3, row * 32 + 3, 58, 26);
        }
    },
    rep,
  );

const clothTex = (color: string) =>
  canvasTex(128, 128, (c) => {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        c.fillStyle = (i + j) % 2 ? '#ffffff' : color;
        c.fillRect(i * 16, j * 16, 16, 16);
      }
  });

const neonTex = () =>
  canvasTex(1024, 256, (c) => {
    c.fillStyle = '#1d0f3d';
    c.beginPath();
    c.roundRect(6, 6, 1012, 244, 50);
    c.fill();
    c.font = '900 120px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = '#ff4d6d';
    c.shadowBlur = 30;
    c.fillStyle = '#ffd1dc';
    c.fillText('PIZZERIA', 512, 100);
    c.shadowColor = '#4cc9f0';
    c.fillStyle = '#d6f6ff';
    c.font = '900 60px "Lilita One", sans-serif';
    c.fillText('DA AXEND · FORNO A LEGNA', 512, 200);
  });

const menuTex = () =>
  canvasTex(256, 320, (c) => {
    c.fillStyle = '#263238';
    c.fillRect(0, 0, 256, 320);
    c.strokeStyle = '#a0663a';
    c.lineWidth = 16;
    c.strokeRect(0, 0, 256, 320);
    c.fillStyle = '#ffffff';
    c.font = '900 38px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.fillText('MENÙ', 128, 56);
    c.font = '700 24px sans-serif';
    ['Margherita  5', 'Diavola  7', 'Capricciosa  8', 'Quattro formaggi  8', 'Ananas  NO'].forEach((t, i) => c.fillText(t, 128, 110 + i * 40));
  });

// ---------------------------------------------------------------- pezzi

let pizzaGeo: { crust: THREE.BufferGeometry; top: THREE.BufferGeometry; crustM: THREE.Material; topM: THREE.Material } | null = null;
function makePizza(withFlag = true) {
  pizzaGeo ??= {
    crust: new THREE.CylinderGeometry(0.62, 0.6, 0.1, 24),
    top: new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2),
    crustM: toy('#e9a35a', { roughness: 0.6 }),
    topM: toy('#ffffff', { map: pizzaTex(), roughness: 0.5, clearcoat: 0.3 }),
  };
  const g = new THREE.Group();
  const crust = new THREE.Mesh(pizzaGeo.crust, pizzaGeo.crustM);
  const top = new THREE.Mesh(pizzaGeo.top, pizzaGeo.topM);
  top.position.y = 0.052;
  g.add(crust, top);
  let flag: THREE.Mesh | null = null;
  if (withFlag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), toy('#f1e3c6'));
    pole.position.set(0.25, 0.45, 0);
    flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshStandardMaterial({ map: flagTex(0), side: THREE.DoubleSide, roughness: 0.6 }));
    flag.position.set(0.5, 0.72, 0);
    g.add(pole, flag);
  }
  // fumo della pizza calda
  const steam: THREE.Mesh[] = [];
  const puffM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), puffM);
    p.userData.ph = k / 3;
    steam.push(p);
    g.add(p);
  }
  shadowy(g, true, false);
  g.userData.flag = flag;
  g.userData.steam = steam;
  g.userData.d = -1;
  return g;
}

function setFlag(g: THREE.Object3D, d: number) {
  if (g.userData.d === d) return;
  g.userData.d = d;
  const f = g.userData.flag as THREE.Mesh | null;
  if (f) {
    (f.material as THREE.MeshStandardMaterial).map = flagTex(d);
    (f.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }
}

function animSteam(g: THREE.Object3D, t: number, hot: boolean) {
  for (const p of g.userData.steam as THREE.Mesh[]) {
    p.visible = hot;
    if (!hot) continue;
    const ph = (t * 0.8 + p.userData.ph) % 1;
    p.position.set(Math.sin(ph * 7 + p.userData.ph * 5) * 0.2, 0.15 + ph * 0.9, Math.cos(ph * 5) * 0.15);
    p.scale.setScalar(0.6 + ph);
  }
}

function lemonTree() {
  const g = new THREE.Group();
  const pot = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 1.1, 18), toy('#c8553d')), 1.04);
  pot.position.y = 0.55;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), toy('#7a4a2b'));
  trunk.position.y = 1.8;
  const crown = new THREE.Group();
  const leafM = toy('#3a9d4a');
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), leafM);
    const a = (k / 5) * Math.PI * 2;
    b.position.set(Math.sin(a) * 0.5, (k % 2) * 0.3, Math.cos(a) * 0.5);
    crown.add(b);
  }
  const lemonM = toy('#ffe14d', { clearcoat: 0.8 });
  for (let k = 0; k < 7; k++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), lemonM);
    l.scale.set(1, 1.3, 1);
    const a = (k / 7) * Math.PI * 2;
    l.position.set(Math.sin(a) * 0.95, -0.2 + (k % 3) * 0.3, Math.cos(a) * 0.95);
    crown.add(l);
  }
  crown.position.y = 2.9;
  g.add(pot, trunk, crown);
  g.userData.crown = crown;
  return shadowy(g);
}

// i miei tavoli d'arrivo: freccia che indica dove portare la pizza
function myArrow(f: MiniFrame, av: { deco: THREE.Group; root: THREE.Group }, d: number | null) {
  let arrow = av.deco.getObjectByName('pz-arrow');
  if (d === null) {
    if (arrow) av.deco.remove(arrow);
    return;
  }
  if (!arrow) {
    arrow = new THREE.Group();
    arrow.name = 'pz-arrow';
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    cone.position.z = 1.25;
    cone.name = 'cone';
    arrow.add(cone);
    arrow.position.y = 0.25;
    av.deco.add(arrow);
  }
  const T = PIZ_TABLES[d];
  const a = Math.atan2(T.x - f.me.x, T.z - f.me.z);
  arrow.rotation.y = a - av.root.rotation.y;
  const cone = arrow.getObjectByName('cone') as THREE.Mesh;
  (cone.material as THREE.MeshBasicMaterial).color.set(T.color);
  cone.position.z = 1.2 + Math.sin(f.t * 8) * 0.1;
}

registerClientMini({
  kind: 'PIZZE',
  orbit: { c: [0, 0, 0], r: 29 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ff9f1c" to="#e63946">
      <path d="M18 70 Q50 84 82 70 L76 64 Q50 74 24 64 Z" fill="#c0c6cf" {...stroke} />
      <ellipse cx="50" cy="56" rx="30" ry="12" fill="#f4a259" {...stroke} />
      <ellipse cx="50" cy="55" rx="24" ry="8.5" fill="#e63946" />
      <circle cx="42" cy="54" r="3" fill="#ffeaa8" />
      <circle cx="56" cy="57" r="3" fill="#ffeaa8" />
      <circle cx="51" cy="51" r="2.5" fill="#2d8a3e" />
      <path d="M66 50 V18" {...stroke} />
      <path d="M66 18 H86 V32 H66 Z" fill="#06d6a0" {...stroke} />
      <path d="M22 34 q4 -6 0 -12 M32 30 q4 -6 0 -12" {...stroke} fill="none" opacity="0.8" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto (schiva gli schiaffi) · E schiaffo: fa cadere la pizza a chi la porta',
  build(world) {
    const g = world.arena;
    const H = PIZ.half;
    // pavimento a scacchi, pareti basse di mattoni, il cortile intorno
    const floor = new THREE.Mesh(new THREE.BoxGeometry(H * 2, 0.6, H * 2), [toy('#b0593a'), toy('#b0593a'), matte('#ffffff', { map: floorTex() }), toy('#b0593a'), toy('#b0593a'), toy('#b0593a')]);
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    const yard = new THREE.Mesh(new THREE.CircleGeometry(130, 48), matte('#cdb48b'));
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = -0.62;
    yard.receiveShadow = true;
    g.add(floor, yard);
    const wallM = toy('#ffffff', { map: brickTex([7, 1]), roughness: 0.8, clearcoat: 0 });
    const capM = toy('#f3efe9', { roughness: 0.4 });
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(H * 2 + 1.2, 1.1, 0.6), wallM);
      w.position.set(Math.sin(a) * (H + 0.3), 0.55 - 0.05, Math.cos(a) * (H + 0.3));
      w.rotation.y = a;
      const cap = outlined(new THREE.Mesh(rbox(H * 2 + 1.4, 0.18, 0.8, 0.06), capM), 1.01);
      cap.position.set(Math.sin(a) * (H + 0.3), 1.1, Math.cos(a) * (H + 0.3));
      cap.rotation.y = a;
      g.add(shadowy(w), cap);
    }
    // il forno a legna: cupola di mattoni, bocca col fuoco che balla, comignolo che fuma
    const oven = new THREE.Group();
    const base = outlined(new THREE.Mesh(new THREE.CylinderGeometry(PIZ.ovenR + 0.1, PIZ.ovenR + 0.2, 0.9, 32), toy('#f3efe9', { roughness: 0.5 })), 1.02);
    base.position.y = 0.45;
    const dome = outlined(new THREE.Mesh(new THREE.SphereGeometry(PIZ.ovenR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toy('#ffffff', { map: brickTex([6, 2]), roughness: 0.75, clearcoat: 0 })), 1.02);
    dome.position.y = 0.9;
    const mouthDir = (210 * Math.PI) / 180;
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#1a0a05' }));
    const fireM = glow('#ff7b00', 3);
    const fire = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20, 0, Math.PI), fireM);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 20, Math.PI), toy('#9c3f24'));
    const mouthG = new THREE.Group();
    mouth.position.z = 0.01;
    fire.position.set(0, 0, -0.02);
    mouthG.add(mouth, fire, arch);
    mouthG.position.set(Math.sin(mouthDir) * (PIZ.ovenR - 0.25), 0.95, Math.cos(mouthDir) * (PIZ.ovenR - 0.25));
    mouthG.rotation.y = mouthDir;
    const chimney = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 2.2, 14), toy('#9c3f24')), 1.04);
    chimney.position.set(0.4, 3.5, -0.4);
    oven.add(base, dome, mouthG, chimney);
    g.add(shadowy(oven));
    world.camBlockers.push(base, dome, chimney);
    const smoke: { m: THREE.Mesh; ph: number }[] = [];
    const smokeM = new THREE.MeshStandardMaterial({ color: '#e9e3dc', transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
    const smokeG = new THREE.IcosahedronGeometry(0.55, 1);
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(smokeG, smokeM);
      smoke.push({ m, ph: k / 7 });
      g.add(m);
    }
    // i piedistalli del bancone (marmo con la pala di legno sopra)
    const marble = toy('#f3efe9', { roughness: 0.3, clearcoat: 0.6 });
    const peelM = toy('#c48a50');
    for (const s of PIZ_SLOTS) {
      const ped = outlined(new THREE.Mesh(new THREE.CylinderGeometry(PIZ.slotR, PIZ.slotR + 0.08, 1.05, 18), marble), 1.04);
      ped.position.set(s.x, 0.52, s.z);
      const peel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 24), peelM);
      peel.position.set(s.x, 1.08, s.z);
      g.add(shadowy(ped), shadowy(peel));
    }
    // i tavoli: tovaglia a quadretti del loro colore, sedie, cartello col numero, colonna di luce quando aspettano una pizza
    const legM = toy('#5c3d2e');
    const beams: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial; arrow: THREE.Mesh; sign: THREE.Group }[] = [];
    PIZ_TABLES.forEach((T, d) => {
      const tg = new THREE.Group();
      const top = outlined(new THREE.Mesh(new THREE.CylinderGeometry(PIZ.tableR, PIZ.tableR, 0.12, 28), [toy(T.color), toy('#ffffff', { map: clothTex(T.color) }), toy(T.color)]), 1.03);
      top.position.y = 1.05;
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(PIZ.tableR + 0.02, PIZ.tableR + 0.15, 0.55, 28, 1, true), toy(T.color, { side: THREE.DoubleSide }));
      skirt.position.y = 0.75;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1, 10), legM);
      leg.position.y = 0.5;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), toy('#fff8e1'));
      candle.position.set(0.3, 1.26, 0.2);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow('#ffb703', 4));
      flame.position.set(0.3, 1.46, 0.2);
      tg.add(top, skirt, leg, candle, flame);
      // sedie dalla parte del muro
      const out = Math.atan2(T.x, T.z);
      for (const off of [-0.8, 0.8]) {
        const ch = new THREE.Group();
        const seat = new THREE.Mesh(rbox(0.7, 0.1, 0.7, 0.04), legM);
        seat.position.y = 0.6;
        const back = new THREE.Mesh(rbox(0.7, 0.8, 0.1, 0.04), legM);
        back.position.set(0, 1, 0.32);
        ch.add(seat, back);
        const a = out + off;
        ch.position.set(Math.sin(a) * 1.75, 0, Math.cos(a) * 1.75);
        ch.rotation.y = a;
        tg.add(ch);
      }
      // cartello col numero che gira piano
      const sign = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), toy('#d6dbe1', { metalness: 0.6 }));
      pole.position.y = 2.2;
      const board = outlined(new THREE.Mesh(rbox(1.3, 1, 0.12, 0.08), [toy(T.color), toy(T.color), toy(T.color), toy(T.color), new THREE.MeshStandardMaterial({ map: flagTex(d) }), new THREE.MeshStandardMaterial({ map: flagTex(d) })]), 1.04);
      board.position.y = 3.6;
      sign.add(pole, board);
      tg.add(sign);
      // anello per terra (dove si consegna) e colonna di luce
      const ringMat = new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(PIZ.deliver - 0.12, PIZ.deliver, 40).rotateX(-Math.PI / 2), ringMat);
      ring.position.y = 0.03;
      const beamMat = new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 12, 24, 1, true), beamMat);
      beam.position.y = 6;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), glow(T.color, 1.6));
      arrow.rotation.x = Math.PI;
      arrow.position.y = 6;
      tg.add(ring, beam, arrow);
      tg.position.set(T.x, 0, T.z);
      g.add(shadowy(tg));
      beam.castShadow = arrow.castShadow = ring.castShadow = false;
      beams.push({ m: beam, mat: beamMat, ring: ringMat, arrow, sign });
      world.camBlockers.push(sign);
    });
    // i vasi di limoni (ostacoli)
    const trees: THREE.Group[] = [];
    for (const p of PIZ_POTS) {
      const tr = lemonTree();
      tr.position.set(p.x, 0, p.z);
      trees.push(tr);
      g.add(tr);
      world.camBlockers.push(tr);
    }
    // fuori: la facciata con l'insegna al neon, lavagna del menù, botti, la Vespa, palloncini, pizza gigante che gira
    const facade = new THREE.Mesh(rbox(26, 10, 2, 0.2), toy('#ffffff', { map: brickTex([6, 3]), roughness: 0.8, clearcoat: 0 }));
    facade.position.set(0, 4.4, -H - 4.5);
    const neonM = new THREE.MeshBasicMaterial({ map: neonTex(), toneMapped: false });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), neonM);
    neon.position.set(0, 6.8, -H - 3.45);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(18, 0.15, 2.4), toy('#ffffff', { map: canvasTex(256, 64, (c) => [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => ((c.fillStyle = i % 2 ? '#2a9d8f' : '#ffffff'), c.fillRect(i * 32, 0, 32, 64)))) }));
    awn.position.set(0, 4.2, -H - 2.6);
    awn.rotation.x = 0.35;
    g.add(shadowy(facade), neon, awn);
    world.camBlockers.push(facade);
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshStandardMaterial({ map: menuTex(), roughness: 0.8 }));
    menu.position.set(H + 3.5, 1.1, -6);
    menu.rotation.y = -Math.PI / 2 + 0.3;
    g.add(menu);
    const barrelM = toy('#9c5a2c', { roughness: 0.6 });
    for (const [x, z] of [
      [H + 3, 4],
      [H + 3.3, 6.3],
      [-H - 3, -8],
    ]) {
      const b = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 18), barrelM), 1.03);
      b.position.set(x, 0.2, z);
      g.add(shadowy(b));
      world.camBlockers.push(b);
    }
    const vespa = new THREE.Group();
    const vBody = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.4, 6, 12).rotateX(Math.PI / 2), toy('#7fd1ae')), 1.04);
    vBody.position.y = 0.9;
    const shield = new THREE.Mesh(rbox(1, 1.2, 0.2, 0.1), toy('#7fd1ae'));
    shield.position.set(0, 1.4, 0.9);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6).rotateZ(Math.PI / 2), toy('#d6dbe1', { metalness: 0.7 }));
    bar.position.set(0, 2.05, 0.95);
    const lampV = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow('#fff3b0', 2));
    lampV.position.set(0, 1.95, 1.05);
    const wheelM = toy('#2b2d42');
    for (const z of [-0.9, 0.95]) {
      const wh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 8, 18).rotateY(Math.PI / 2), wheelM);
      wh.position.set(0, 0.35, z);
      vespa.add(wh);
    }
    vespa.add(vBody, shield, bar, lampV);
    vespa.position.set(-H - 4, -0.6, 7);
    vespa.rotation.y = 0.6;
    g.add(shadowy(vespa));
    world.camBlockers.push(vespa);
    const bigPizza = makePizza(false);
    bigPizza.scale.setScalar(4.2);
    bigPizza.rotation.x = Math.PI / 2;
    const bpPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 8, 10), toy('#d6dbe1', { metalness: 0.6 }));
    bpPole.position.set(H + 7, 3.4, 9);
    const bpHolder = new THREE.Group();
    bpHolder.position.set(H + 7, 8.5, 9);
    bpHolder.add(bigPizza);
    g.add(bpPole, bpHolder);
    world.camBlockers.push(bpPole, bpHolder);
    const balloons: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const b = balloon(PIZ_TABLES[k].color);
      const a = (k / 6) * Math.PI * 2 + 0.5;
      b.position.set(Math.sin(a) * (H + 4.5), 6 + (k % 3) * 1.4, Math.cos(a) * (H + 4.5));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // lucine lungo i muri (tutte in un colpo)
    const nb = 72;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), nb);
    const tmp = new THREE.Object3D();
    const bcol = new THREE.Color();
    for (let k = 0; k < nb; k++) {
      const side = Math.floor(k / (nb / 4));
      const t = ((k % (nb / 4)) + 0.5) / (nb / 4);
      const a = (side * Math.PI) / 2;
      const along = (t - 0.5) * (H * 2 + 1);
      const x = Math.sin(a) * (H + 0.35) + Math.cos(a) * along;
      const z = Math.cos(a) * (H + 0.35) - Math.sin(a) * along;
      tmp.position.set(x, 3.1 - Math.sin(t * Math.PI * 4) ** 2 * 0.6, z);
      tmp.updateMatrix();
      bulbs.setMatrixAt(k, tmp.matrix);
      bulbs.setColorAt(k, bcol.set(['#ffd166', '#ff70a6', '#70d6ff', '#9ef01a'][k % 4]));
    }
    g.add(bulbs);
    const postM = toy('#5c3d2e');
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), postM);
        post.position.set(sx * (H + 0.35), 1.8, sz * (H + 0.35));
        g.add(post);
        world.camBlockers.push(post);
      }

    // ---- le pizze (sul bancone e per terra; quelle in mano le disegna decorate)
    const pool: THREE.Group[] = [];
    const slot = () => {
      const p = makePizza();
      g.add(p);
      pool.push(p);
      return p;
    };
    for (let k = 0; k < 6; k++) slot();

    return (f) => {
      const t = f.t;
      const now = f.now;
      const E = f.ext as Ext;
      const list = E ? E.pz.map((a) => decode(a, E.t0)) : [];
      // pizze da disegnare qui
      let used = 0;
      const want = new Set<number>();
      let mineD: number | null = null;
      for (const p of list) {
        want.add(p.d);
        if (p.s === 1) {
          if (p.by === f.myId) mineD = p.d;
          continue;
        }
        const m = pool[used] ?? slot();
        used++;
        m.visible = true;
        setFlag(m, p.d);
        if (p.s === 0) {
          const s = PIZ_SLOTS[p.slot];
          m.position.set(s.x, 1.12, s.z);
          m.rotation.set(0, t * 0.6 + p.i, 0);
          animSteam(m, t, true);
        } else {
          const rem = p.at - now;
          if (rem > 0) {
            // vola via dopo lo schiaffo
            const k = Math.max(0, 1 - rem / PIZ.flight);
            m.position.set(p.fx + (p.x - p.fx) * k, 0.1 + Math.sin(k * Math.PI) * 2.2 + 1.2 * (1 - k), p.fz + (p.z - p.fz) * k);
            m.rotation.set(t * 12, t * 5, 0);
          } else {
            m.position.set(p.x, 0.07, p.z);
            m.rotation.set(0, p.i, 0);
          }
          // per terra da tanto: lampeggia (sta per tornare al forno)
          m.visible = !(now - p.at > PIZ.groundMs - 3000 && Math.floor(t * 8) % 2 === 0);
          animSteam(m, t, p.hot > 0 && now - p.hot < PIZ.bonusMs);
        }
      }
      for (let k = used; k < pool.length; k++) pool[k].visible = false;
      // tavoli: si accendono quando una pizza è per loro (il mio di più, con la freccia)
      beams.forEach((b, d) => {
        const on = want.has(d);
        const mine = mineD === d;
        b.m.visible = on;
        b.mat.opacity = mine ? 0.32 + Math.sin(t * 6) * 0.1 : 0.14;
        b.ring.opacity = mine ? 0.75 + Math.sin(t * 8) * 0.2 : on ? 0.45 : 0.18;
        b.arrow.visible = mine;
        b.arrow.position.y = 5.2 + Math.sin(t * 4) * 0.4;
        b.arrow.rotation.y = t * 2;
        b.sign.rotation.y = Math.sin(t * 0.7 + d) * 0.5;
      });
      // contorno che si muove
      fireM.emissiveIntensity = 2.4 + Math.sin(t * 17) * 0.5 + Math.sin(t * 7.3) * 0.4;
      for (const s of smoke) {
        const ph = (t * 0.28 + s.ph) % 1;
        s.m.position.set(0.4 + Math.sin(ph * 5 + s.ph * 9) * 0.6 + ph * 1.5, 4.6 + ph * 7, -0.4 + Math.cos(ph * 4) * 0.5);
        s.m.scale.setScalar(0.5 + ph * 1.8);
        s.m.visible = ph < 0.93;
      }
      neonM.color.setScalar(Math.sin(t * 23) > 0.97 ? 0.4 : 1);
      bpHolder.rotation.y = t * 0.7;
      for (const tr of trees) tr.userData.crown.rotation.z = Math.sin(t * 1.3 + tr.position.x) * 0.05;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  speed: (f) => {
    const E = f.ext as Ext;
    return E?.pz.some((a) => a[2] === 1 && a[3] === f.myId) ? PIZ.carry : 1;
  },
  // la pizza sopra la testa (braccia alzate, come un cameriere) e, per me, la freccia verso il tavolo
  decorate(av, id, f) {
    const E = f.ext as Ext;
    let carry: PzC | null = null;
    if (E && f.view.stage !== 'END') for (const a of E.pz) if (a[2] === 1 && a[3] === id) carry = decode(a, E.t0);
    let held = av.deco.getObjectByName('pz-carry');
    if (carry && !held) {
      held = makePizza();
      held.name = 'pz-carry';
      held.scale.setScalar(0.95);
      av.deco.add(held);
    } else if (!carry && held) {
      av.deco.remove(held);
      held = undefined;
    }
    if (id === f.myId) myArrow(f, av, carry ? carry.d : null);
    if (!carry || !held) return;
    setFlag(held, carry.d);
    held.position.set(0, 2.45 + Math.sin(f.t * 9) * 0.04, 0.1);
    held.rotation.set(Math.sin(f.t * 5) * 0.06, f.t * 0.8, Math.sin(f.t * 6) * 0.06);
    animSteam(held, f.t, f.now - carry.hot < PIZ.bonusMs);
    av.armL.rotation.set(-2.95, 0, -0.25);
    av.armR.rotation.set(-2.95, 0, 0.25);
  },
  status(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const list = E.pz.map((a) => decode(a, E.t0));
    const mine = list.find((p) => p.s === 1 && p.by === h.myId);
    if (mine) {
      const T = PIZ_TABLES[mine.d];
      const left = Math.ceil((PIZ.bonusMs - (h.now - mine.hot)) / 1000);
      return { text: `AL TAVOLO ${T.n} ${T.name}${left > 0 ? ` · CALDA ${left}s` : ''}`, cls: left > 0 ? 'sc-green pulse-soft' : 'sc-yellow' };
    }
    const carriers = new Set(list.filter((p) => p.s === 1).map((p) => p.by));
    for (const [id, o] of h.others) if (carriers.has(id) && Math.hypot(o.x - h.me.x, o.z - h.me.z) < 3) return { text: 'SCHIAFFO: FAGLI CADERE LA PIZZA!', cls: 'sc-red pulse-soft' };
    if (list.some((p) => p.s === 2 && Math.hypot(p.x - h.me.x, p.z - h.me.z) < 7)) return { text: 'PIZZA PER TERRA: PRENDILA!', cls: 'sc-yellow pulse-soft' };
    return { text: 'PRENDI UNA PIZZA DAL FORNO', cls: 'sc-yellow' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const top = Object.entries(E.s)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (!top.length) return null;
    const rows = top.some(([id]) => id === h.myId) ? top : [...top, [h.myId, E.s[h.myId] ?? 0] as [string, number]];
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {rows.map(([id, n], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{top[i]?.[0] === id ? i + 1 : '·'}</span>
            {h.nameOf(id)} · {n} punti · {E.dl[id] ?? 0}
            <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 2 L18 17 Q10 20 2 17 Z" fill="#f4a259" stroke="#1d0f3d" strokeWidth="2" />
              <circle cx="10" cy="12" r="2" fill="#e63946" />
            </svg>
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'pz_new') {
      const s = PIZ_SLOTS[p.slot];
      if (s) dust(c.world, s.x, 1.1, s.z, 5);
    } else if (p.k === 'pz_take') {
      const at = c.where(p.by);
      if (p.by === c.myId) {
        soundManager.playPop();
        if (at) popText(c.world, at.x, at.y + 0.3, at.z, `TAVOLO ${p.d + 1}!`, PIZ_TABLES[p.d].color, { scale: 0.9 });
      }
    } else if (p.k === 'pz_deliver') {
      const T = PIZ_TABLES[p.d];
      burst(c.world, T.x, 1.4, T.z, [T.color, '#ffffff', '#ffd60a'], 40, 6);
      ringPulse(c.world, T.x, 0, T.z, T.color);
      popText(c.world, T.x, 1.2, T.z, p.fast ? `+${p.pts} CALDA!` : `+${p.pts}`, p.fast ? '#ffd60a' : '#ffffff', { scale: p.by === c.myId ? 1.2 : 0.8 });
      if (p.by === c.myId) {
        soundManager.playSuccess();
        c.shake(0.2);
      } else if (Math.hypot(c.me.x - T.x, c.me.z - T.z) < 9) soundManager.playPop();
    } else if (p.k === 'pz_drop') {
      const at = c.where(p.id);
      if (at) {
        popText(c.world, at.x, at.y + 0.2, at.z, 'PIZZA A TERRA!', '#ff4d6d', { scale: 0.9 });
        burst(c.world, at.x, at.y + 2.2, at.z, ['#e63946', '#ffeaa8', '#f4a259'], 18, 4);
      }
      if (p.id === c.myId) {
        soundManager.playError();
        c.shake(0.5);
        c.feed(`${c.nameOf(p.by)} ti ha fatto cadere la pizza!`);
      } else if (p.by === c.myId) {
        soundManager.playSuccess();
        c.feed(`Pizza di ${c.nameOf(p.id)} per terra: prendila!`);
      }
    } else if (p.k === 'pz_back') {
      poof(c.world, p.x, 0, p.z);
    }
  },
});
