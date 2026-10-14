// 🪙 Pioggia di monete (telefono): piazza con la fontana, palazzi, la Banca del Parmigiano col caveau aperto,
// monete di cioccolato che piovono (tutte insieme in due InstancedMesh), forme di parmigiano che cadono dal cielo
import * as THREE from 'three';
import { MON } from '../../../data/minis/monete';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { burst, canvasTex, dust, glow, matte, outlined, popText, rbox, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { c: number[][]; f: number[][]; n: Record<string, number>; last: number; t0: number } | null;

interface CoinC {
  i: number;
  x: number;
  z: number;
  v: number;
  at: number; // quando atterra (ora del server)
  fx?: number;
  fz?: number;
}
interface FormaC {
  i: number;
  x: number;
  z: number;
  at: number;
  hit: boolean; // già caduta (effetti fatti)
}

// ---------------------------------------------------------------- stato sul telefono (si rimette a posto in build)
const coins = new Map<number, CoinC>();
const gone = new Set<number>(); // già prese: uno stato vecchio non le fa ricomparire
const hidden = new Map<number, number>(); // toccate da me: nascoste subito, in attesa del server
const formas = new Map<number, FormaC>();
let lastExt: unknown = null;
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };
let stunUntil = 0; // schiacciato (Date.now())
let sparkle: ((x: number, y: number, z: number, big: boolean) => void) | null = null;
let crushFx: ((f: FormaC, near: boolean) => void) | null = null;

const decode = (a: number[], t0: number): CoinC => ({ i: a[0], x: a[1], z: a[2], v: a[3], at: a[4] + t0, fx: a[5], fz: a[6] });

// ---------------------------------------------------------------- texture

const stonesTex = () =>
  canvasTex(
    512,
    512,
    (c) => {
      c.fillStyle = '#4a4550';
      c.fillRect(0, 0, 512, 512);
      const cols = ['#6b6570', '#5f5966', '#77707c', '#686272', '#71697a'];
      for (let row = 0; row < 16; row++)
        for (let k = 0; k < 16; k++) {
          const off = row % 2 ? 16 : 0;
          c.fillStyle = cols[(row * 5 + k * 3) % cols.length];
          c.beginPath();
          c.roundRect(k * 32 + off - 14 + 2, row * 32 + 2, 28, 28, 7);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.07)';
          c.fillRect(k * 32 + off - 8, row * 32 + 6, 12, 5);
        }
    },
    [9, 9],
  );

const coinTex = (label: string, big: boolean) =>
  canvasTex(256, 256, (c) => {
    const g = c.createRadialGradient(100, 90, 20, 128, 128, 128);
    g.addColorStop(0, big ? '#fff6b0' : '#ffe680');
    g.addColorStop(1, big ? '#f2a900' : '#d99a00');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(122,74,0,0.7)';
    c.lineWidth = 12;
    c.beginPath();
    c.arc(128, 128, 104, 0, Math.PI * 2);
    c.stroke();
    c.font = `900 ${big ? 150 : 140}px "Lilita One", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(122,74,0,0.85)';
    c.fillText(label, 132, 140);
    c.fillStyle = big ? '#fffbe0' : '#fff2b0';
    c.fillText(label, 126, 132);
  });

const rindTex = () =>
  canvasTex(512, 128, (c) => {
    c.fillStyle = '#e9b44c';
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#c98a2a';
    c.fillRect(0, 0, 512, 12);
    c.fillRect(0, 116, 512, 12);
    c.font = '900 46px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(140,85,20,0.6)';
    c.fillText('PARMIGIANO · REGGIANO', 256, 66);
  });

// facciata di un palazzo con le finestre e le persiane verdi
const facadeTex = (wall: string, cols: number, rows: number) =>
  canvasTex(512, 512, (c) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, 512, 512);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(0, 480, 512, 32);
    const w = 512 / cols;
    const h = 480 / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const x = i * w + w * 0.3;
        const y = j * h + h * 0.22;
        c.fillStyle = '#2f3d4f';
        c.fillRect(x, y, w * 0.4, h * 0.55);
        c.fillStyle = '#2a7d4f';
        c.fillRect(x - w * 0.16, y, w * 0.15, h * 0.55);
        c.fillRect(x + w * 0.41, y, w * 0.15, h * 0.55);
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.fillRect(x - w * 0.05, y + h * 0.55, w * 0.5, 5);
      }
  });

const bankTex = () =>
  canvasTex(1024, 256, (c) => {
    c.fillStyle = '#f4ead5';
    c.fillRect(0, 0, 1024, 256);
    c.font = '900 92px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#7a4a00';
    c.fillText('BANCA DEL PARMIGIANO', 512, 110);
    c.font = '900 44px "Lilita One", sans-serif';
    c.fillStyle = '#b07a12';
    c.fillText('CAVEAU · APERTO PER FESTA', 512, 200);
  });

const waterTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#3fa7d6';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 4;
      for (let k = 0; k < 14; k++) {
        c.beginPath();
        const y = Math.random() * 256;
        c.moveTo(0, y);
        c.bezierCurveTo(80, y - 14, 170, y + 14, 256, y);
        c.stroke();
      }
    },
    [2, 2],
  );

// ---------------------------------------------------------------- pezzi

function parmesan(r: number, h: number) {
  const g = new THREE.Group();
  const top = toy('#f6d27a', { roughness: 0.75, clearcoat: 0.1 });
  const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), [toy('#ffffff', { map: rindTex(), roughness: 0.7 }), top, top]), 1.03);
  g.add(body);
  return g;
}

function pigeon() {
  const g = new THREE.Group();
  const grey = toy('#9aa0ad');
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), grey);
  body.scale.set(0.8, 0.8, 1.4);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toy('#6d7280'));
  head.position.set(0, 0.18, 0.38);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), toy('#ffb703'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.16, 0.56);
  // le ali girano intorno all'asse del corpo (avanti-indietro)
  const wingG = new THREE.PlaneGeometry(0.6, 0.32).rotateX(-Math.PI / 2);
  const wingM = toy('#c3c7d0', { side: THREE.DoubleSide });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 0.08, 0);
    const w = new THREE.Mesh(wingG, wingM);
    w.position.x = s * 0.3;
    pivot.add(w);
    pivot.userData.s = s;
    wings.push(pivot);
    g.add(pivot);
  }
  g.add(body, head, beak);
  g.userData.wings = wings;
  return g;
}

registerClientMini({
  kind: 'MONETE',
  orbit: { c: [0, 0, 0], r: 28 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ffe066" to="#f59f00">
      <ellipse cx="50" cy="80" rx="30" ry="6" fill="#1d0f3d" opacity="0.25" />
      <circle cx="38" cy="58" r="17" fill="#ffd60a" {...stroke} />
      <text x="38" y="65" textAnchor="middle" fontSize="20" fontWeight="900" fill="#b07a12">
        €
      </text>
      <circle cx="64" cy="40" r="13" fill="#ffe680" {...stroke} />
      <text x="64" y="46" textAnchor="middle" fontSize="15" fontWeight="900" fill="#b07a12">
        5
      </text>
      <path d="M58 16 v8 M74 20 v6 M30 26 v8" {...stroke} fill="none" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto (schiva la forma) · E schiaffo: fa cadere le monete agli altri',
  build(world) {
    const g = world.arena;
    coins.clear();
    gone.clear();
    hidden.clear();
    formas.clear();
    lastExt = null;
    live = { at: 0, s: {} };
    stunUntil = 0;
    const H = MON.half;
    // la piazza di sampietrini e la strada intorno
    const floor = new THREE.Mesh(new THREE.BoxGeometry(H * 2 + 1.2, 0.6, H * 2 + 1.2), [matte('#8a8290'), matte('#8a8290'), matte('#ffffff', { map: stonesTex() }), matte('#8a8290'), matte('#8a8290'), matte('#8a8290')]);
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    const street = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), matte('#c9b79c'));
    street.rotation.x = -Math.PI / 2;
    street.position.y = -0.62;
    street.receiveShadow = true;
    g.add(floor, street);
    // i muretti di travertino con le colonnine e le palle sopra
    const trav = toy('#efe3c8', { roughness: 0.6, clearcoat: 0.15 });
    for (let s = 0; s < 4; s++) {
      const wall = outlined(new THREE.Mesh(rbox(H * 2 + 1.2, 1, 0.6, 0.12), trav), 1.01);
      const a = (s * Math.PI) / 2;
      wall.position.set(Math.sin(a) * (H + 0.3), 0.5, Math.cos(a) * (H + 0.3));
      wall.rotation.y = a;
      g.add(shadowy(wall));
    }
    const ballM = toy('#d4af37', { metalness: 0.6, roughness: 0.3 });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const col = outlined(new THREE.Mesh(rbox(1, 1.8, 1, 0.12), trav), 1.02);
        col.position.set(sx * (H + 0.3), 0.9, sz * (H + 0.3));
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), ballM);
        ball.position.set(sx * (H + 0.3), 2.2, sz * (H + 0.3));
        g.add(shadowy(col), ball);
      }
    // la fontana: vasca, acqua che si muove, colonnina con la monetona d'oro che gira e gli zampilli
    const fr = MON.fountainR;
    const basin = outlined(new THREE.Mesh(new THREE.CylinderGeometry(fr, fr + 0.1, 0.8, 40, 1, true), toy('#efe3c8', { side: THREE.DoubleSide })), 1.02);
    basin.position.y = 0.4;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(fr, 0.16, 8, 40), trav);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.8;
    const wTex = waterTex();
    const water = new THREE.Mesh(new THREE.CircleGeometry(fr - 0.05, 40), toy('#ffffff', { map: wTex, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.62;
    const column = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 16), trav), 1.04);
    column.position.y = 1.1;
    const bigCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.18, 32), toy('#ffffff', { map: coinTex('€', true), metalness: 0.6, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.25 }));
    bigCoin.rotation.order = 'YXZ';
    bigCoin.rotation.x = Math.PI / 2;
    bigCoin.position.y = 3.15;
    g.add(shadowy(basin), rim, water, shadowy(column), shadowy(bigCoin));
    const drops: THREE.Mesh[] = [];
    const dropG = new THREE.SphereGeometry(0.09, 6, 5);
    const dropM = toy('#bfe9ff', { transparent: true, opacity: 0.85, roughness: 0.1 });
    for (let k = 0; k < 16; k++) {
      const d = new THREE.Mesh(dropG, dropM);
      d.userData.a = (k % 4) * (Math.PI / 2) + 0.4;
      d.userData.ph = k / 16;
      drops.push(d);
      g.add(d);
    }
    // i palazzi intorno, con i panni stesi che sventolano
    const walls: [number, number, number, number, string, number][] = [
      // x, z, larghezza, altezza, colore, rotazione
      [-15, -22, 12, 13, '#f4a259', 0],
      [15, -22, 12, 11, '#e9c46a', 0],
      [-24, -6, 14, 12, '#f28482', Math.PI / 2],
      [-24, 10, 12, 15, '#e9c46a', Math.PI / 2],
      [24, -6, 14, 14, '#90be6d', -Math.PI / 2],
      [24, 10, 12, 11, '#f4a259', -Math.PI / 2],
      [-18, 23, 8, 12, '#f28482', Math.PI],
      [18, 23, 8, 14, '#cdb4db', Math.PI],
    ];
    for (const [x, z, w, h, c, r] of walls) {
      const m = new THREE.Mesh(rbox(w, h, 6, 0.2), [matte(c), matte(c), toy('#a23b2a'), matte(c), matte('#ffffff', { map: facadeTex(c, Math.round(w / 3), Math.round(h / 3.2)) }), matte(c)]);
      m.position.set(x, h / 2 - 0.6, z);
      m.rotation.y = r;
      g.add(shadowy(m, true, false));
    }
    const clothes: THREE.Mesh[] = [];
    const clothG = new THREE.PlaneGeometry(0.9, 1.2).translate(0, -0.6, 0); // appesi per il bordo di sopra
    const lines: [number, number, number, number, number][] = [
      [-20.4, -12, -20.4, -1, 8],
      [20.4, 4, 20.4, 15, 7.5],
      [-20, -18.4, -10, -18.4, 9],
    ];
    const clothCols = ['#ffffff', '#ff4d6d', '#3a86ff', '#ffd60a', '#06d6a0', '#ff70a6'];
    for (const [x1, z1, x2, z2, y] of lines) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const dir = Math.atan2(x2 - x1, z2 - z1);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 4), matte('#ffffff'));
      rope.rotation.order = 'YXZ';
      rope.rotation.set(Math.PI / 2, dir, 0);
      rope.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      g.add(rope);
      const n = Math.floor(len / 1.6);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const cl = new THREE.Mesh(clothG, toy(clothCols[(k + Math.round(y)) % clothCols.length], { side: THREE.DoubleSide, roughness: 0.8, clearcoat: 0 }));
        cl.position.set(x1 + (x2 - x1) * t, y - 0.03, z1 + (z2 - z1) * t);
        cl.rotation.order = 'YXZ';
        cl.rotation.y = dir + Math.PI / 2;
        cl.userData.ph = k * 0.9;
        clothes.push(cl);
        g.add(cl);
      }
    }
    // la Banca del Parmigiano con il caveau aperto (porta rotonda) e le forme impilate
    const bank = new THREE.Group();
    const front = new THREE.Mesh(rbox(20, 12, 6, 0.3), [matte('#f4ead5'), matte('#f4ead5'), toy('#8d6e63'), matte('#f4ead5'), matte('#f4ead5'), matte('#f4ead5')]);
    front.position.y = 6 - 0.6;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: bankTex(), roughness: 0.5 }));
    sign.position.set(0, 9.4, -3.02);
    sign.rotation.y = Math.PI;
    const steel = toy('#c9ced6', { metalness: 0.85, roughness: 0.25 });
    const door = new THREE.Group();
    const disc = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.8, 40), steel), 1.02);
    disc.rotation.x = Math.PI / 2;
    disc.position.x = 3;
    door.add(disc);
    for (let k = 0; k < 8; k++) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 8), toy('#ffd60a', { metalness: 0.8, roughness: 0.2 }));
      const a = (k / 8) * Math.PI * 2;
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(3 + Math.sin(a) * 2.4, Math.cos(a) * 2.4, -0.5);
      door.add(bolt);
    }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 24), toy('#ffd60a', { metalness: 0.8 }));
    wheel.position.set(3, 0, -0.55);
    door.add(wheel);
    door.position.set(3.2, 3.6, -3.4);
    door.rotation.y = -0.9;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.9, 40), matte('#2b1d12'));
    hole.position.set(3.2, 3.6, -3.03);
    hole.rotation.y = Math.PI;
    bank.add(front, sign, hole, door);
    for (let k = 0; k < 9; k++) {
      const p = parmesan(1, 0.6);
      p.position.set(-6 + (k % 3) * 2.2, 0.3 - 0.6 + Math.floor(k / 3) * 0.62, -3.9);
      bank.add(p);
    }
    bank.position.set(0, 0, H + 9);
    g.add(shadowy(bank));
    // lampioni ai lati
    const lampM = toy('#2b2d42', { metalness: 0.4 });
    const lamps: THREE.Mesh[] = [];
    for (const [x, z] of [
      [-H - 2.5, -H + 4],
      [-H - 2.5, H - 4],
      [H + 2.5, -H + 4],
      [H + 2.5, H - 4],
    ]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5.5, 8), lampM);
      pole.position.set(x, 2.15, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), glow('#ffe8a3', 2.4));
      bulb.position.set(x, 5.1, z);
      lamps.push(bulb);
      g.add(shadowy(pole), bulb);
    }
    // i piccioni che girano in tondo
    const pigeons: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const p = pigeon();
      p.userData.a = (k / 6) * Math.PI * 2;
      p.userData.r = 8 + (k % 3) * 4;
      p.userData.y = 10 + (k % 2) * 3;
      p.userData.w = 0.35 + (k % 3) * 0.08;
      pigeons.push(p);
      g.add(p);
    }

    // ---- le monete (tutte insieme) e le loro ombre
    const smallG = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
    const bigG = new THREE.CylinderGeometry(0.72, 0.72, 0.16, 24);
    const small = new THREE.InstancedMesh(smallG, toy('#ffffff', { map: coinTex('€', false), metalness: 0.55, roughness: 0.3, emissive: '#4a3000', emissiveIntensity: 0.2 }), 96);
    const big = new THREE.InstancedMesh(bigG, toy('#ffffff', { map: coinTex('5', true), metalness: 0.65, roughness: 0.2, emissive: '#7a5200', emissiveIntensity: 0.35 }), 28);
    const shadeM = new THREE.MeshBasicMaterial({ color: '#1d0f3d', transparent: true, opacity: 0.32, depthWrite: false });
    const shadows = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), shadeM, 124);
    for (const m of [small, big, shadows]) {
      m.frustumCulled = false;
      m.count = 0;
      g.add(m);
    }
    small.castShadow = big.castShadow = true;
    const tmp = new THREE.Object3D();
    tmp.rotation.order = 'YXZ';
    // scintille quando qualcuno prende una moneta (poche, riusate)
    const sparkG = new THREE.OctahedronGeometry(0.22);
    const sparks: { m: THREE.Mesh; life: number }[] = [];
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(sparkG, glow('#fff3b0', 3));
      m.visible = false;
      sparks.push({ m, life: 0 });
      g.add(m);
    }
    let sparkI = 0;
    sparkle = (x, y, z, isBig) => {
      const s = sparks[sparkI++ % sparks.length];
      s.m.position.set(x, y, z);
      s.m.scale.setScalar(isBig ? 1.8 : 1);
      s.m.visible = true;
      s.life = 0.45;
    };
    // ---- le forme di parmigiano che cadono (al massimo poche insieme: si riusano)
    const pool: { g: THREE.Group; wheel: THREE.Group; warn: THREE.Mesh; ring: THREE.Mesh; id: number }[] = [];
    const warnM = () => new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
    const slot = () => {
      const gg = new THREE.Group();
      const wheel = parmesan(1.25, 0.7);
      const warn = new THREE.Mesh(new THREE.CircleGeometry(MON.formaR, 36).rotateX(-Math.PI / 2), warnM());
      warn.position.y = 0.03;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(MON.formaR, 0.1, 6, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2d55', toneMapped: false }));
      ring.position.y = 0.05;
      gg.add(shadowy(wheel), warn, ring);
      gg.visible = false;
      g.add(gg);
      const s = { g: gg, wheel, warn, ring, id: -1 };
      pool.push(s);
      return s;
    };
    crushFx = (f, near) => {
      burst(world, f.x, 0.6, f.z, ['#f6d27a', '#e9b44c', '#ffffff'], 34, 7);
      dust(world, f.x, 0, f.z, 10);
      if (near) soundManager.playBoom();
    };

    return (fr2) => {
      const t = fr2.t;
      const now = fr2.now;
      const E = fr2.ext as Ext;
      // lo stato del server (al massimo una volta al secondo) rimette a posto le monete
      if (E && E !== lastExt) {
        lastExt = E;
        const ids = new Set<number>();
        for (const a of E.c) {
          ids.add(a[0]);
          if (!coins.has(a[0]) && !gone.has(a[0])) coins.set(a[0], decode(a, E.t0));
        }
        for (const id of coins.keys()) if (id <= E.last && !ids.has(id)) coins.delete(id);
        for (const a of E.f) if (!formas.has(a[0]) && a[3] + E.t0 > now - 300) formas.set(a[0], { i: a[0], x: a[1], z: a[2], at: a[3] + E.t0, hit: false });
      }
      // le tocco io: spariscono subito (il server conferma)
      const me = fr2.me;
      const canTake = fr2.view.stage === 'PLAY' && fr2.view.alive[fr2.myId] !== false && me.y < 1.6 && Date.now() > stunUntil - 400;
      for (const c of coins.values()) {
        if (now >= c.at + MON.life) {
          coins.delete(c.i);
          continue;
        }
        if (canTake && now >= c.at && !hidden.has(c.i) && (c.x - me.x) ** 2 + (c.z - me.z) ** 2 < MON.pickR * MON.pickR) {
          hidden.set(c.i, now);
          soundManager.playPop();
        }
      }
      for (const [i, at] of hidden) if (now - at > 1300) hidden.delete(i);
      // disegno: monete che cadono (ombra che si allarga), atterrate (girano e luccicano), che schizzano via
      let ns = 0;
      let nb = 0;
      let nsh = 0;
      for (const c of coins.values()) {
        if (hidden.has(c.i)) continue;
        const isBig = c.v > 1;
        const rem = c.at - now;
        let y = 0.55 + (isBig ? 0.2 : 0) + Math.sin(t * 3 + c.i) * 0.08;
        let x = c.x;
        let z = c.z;
        let spin = t * (isBig ? 3.2 : 2.4) + c.i;
        if (rem > 0) {
          if (c.fx !== undefined) {
            const s = Math.max(0, 1 - rem / MON.flight);
            x = c.fx + (c.x - c.fx) * s;
            z = (c.fz ?? 0) + (c.z - (c.fz ?? 0)) * s;
            y = 0.6 + Math.sin(s * Math.PI) * 2.4;
            spin = t * 14 + c.i;
          } else {
            const k = Math.min(1, rem / MON.warn);
            y += 16 * k * k;
            spin = t * 9 + c.i;
          }
          if (nsh < 124) {
            const sc = (isBig ? 0.75 : 0.5) * (1 - Math.min(1, rem / MON.warn) * 0.55);
            tmp.position.set(c.x, 0.02, c.z);
            tmp.rotation.set(0, 0, 0);
            tmp.scale.setScalar(sc);
            tmp.updateMatrix();
            shadows.setMatrixAt(nsh++, tmp.matrix);
          }
        }
        // lampeggia negli ultimi due secondi
        const blink = now > c.at + MON.life - 2000 && Math.floor(t * 8) % 2 === 0;
        tmp.position.set(x, y, z);
        tmp.rotation.set(Math.PI / 2, spin, 0);
        tmp.scale.setScalar(blink ? 0.001 : 1);
        tmp.updateMatrix();
        if (isBig && nb < 28) big.setMatrixAt(nb++, tmp.matrix);
        else if (!isBig && ns < 96) small.setMatrixAt(ns++, tmp.matrix);
      }
      small.count = ns;
      big.count = nb;
      shadows.count = nsh;
      small.instanceMatrix.needsUpdate = true;
      big.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      // le forme: cerchio rosso che pulsa, la forma che cade rotolando, poi resta lì e sprofonda
      for (const s of pool) s.id = -1;
      for (const f of formas.values()) {
        const rem = f.at - now;
        if (rem < -2200) {
          formas.delete(f.i);
          continue;
        }
        const s = pool.find((p) => p.id === -1) ?? slot();
        s.id = f.i;
        s.g.visible = true;
        s.g.position.set(f.x, 0, f.z);
        if (rem > 0) {
          const k = rem / MON.formaWarn;
          s.wheel.position.y = 0.35 + 24 * k * k;
          s.wheel.rotation.set(t * 5, 0, t * 3.3);
          s.warn.visible = s.ring.visible = true;
          (s.warn.material as THREE.MeshBasicMaterial).opacity = 0.18 + (1 - k) * 0.3 + Math.sin(t * 18) * 0.08;
          s.ring.scale.setScalar(1 + Math.sin(t * 14) * 0.03);
        } else {
          if (!f.hit) {
            f.hit = true;
            crushFx?.(f, Math.hypot(me.x - f.x, me.z - f.z) < 9);
          }
          s.warn.visible = s.ring.visible = false;
          s.wheel.rotation.set(0, 0, 0);
          const sink = Math.max(0, (-rem - 1400) / 800);
          s.wheel.position.y = 0.35 - sink * 0.9 + (-rem < 200 ? Math.sin((-rem / 200) * Math.PI) * 0.4 : 0);
          s.wheel.scale.setScalar(1 - sink * 0.5);
        }
      }
      for (const s of pool) if (s.id === -1) s.g.visible = false;
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= fr2.dt;
        s.m.position.y += fr2.dt * 2.5;
        s.m.rotation.y += fr2.dt * 10;
        s.m.scale.multiplyScalar(1 + fr2.dt * 2);
        if (s.life <= 0) s.m.visible = false;
      }
      // contorno che si muove
      bigCoin.rotation.y = t * 0.9;
      wTex.offset.set(Math.sin(t * 0.4) * 0.1, t * 0.05);
      for (const d of drops) {
        const ph = (t * 0.9 + d.userData.ph) % 1;
        const a = d.userData.a + Math.floor(d.userData.ph * 4) * 0.2;
        const r = 0.3 + ph * 1.1;
        d.position.set(Math.sin(a) * r, 2.6 + Math.sin(ph * Math.PI) * 0.9 - ph * 1.8, Math.cos(a) * r);
      }
      for (const cl of clothes) cl.rotation.x = Math.sin(t * 2.2 + cl.userData.ph) * 0.35;
      for (const p of pigeons) {
        const u = p.userData;
        u.a += fr2.dt * u.w;
        p.position.set(Math.sin(u.a) * u.r, u.y + Math.sin(t * 1.5 + u.r) * 0.5, Math.cos(u.a) * u.r);
        p.rotation.y = u.a + Math.PI / 2;
        (u.wings as THREE.Group[]).forEach((w) => (w.rotation.z = w.userData.s * Math.sin(t * 14 + u.r) * 0.7));
      }
      for (let k = 0; k < lamps.length; k++) lamps[k].scale.setScalar(1 + Math.sin(t * 4 + k) * 0.05);
    };
  },
  speed: () => (Date.now() < stunUntil ? 0.25 : 1),
  decorate(av, id, f) {
    // il più ricco ha l'anello d'oro per terra (tutti sanno chi schiaffeggiare)
    const E = f.ext as Ext;
    if (!E || f.view.stage !== 'PLAY') return;
    const s = live.at && Date.now() - live.at < 3000 ? live.s : E.n;
    let rich: string | null = null;
    let most = 4;
    for (const k in s)
      if (s[k] > most) {
        most = s[k];
        rich = k;
      }
    if (rich === id) {
      av.ring.visible = true;
      (av.ring.material as THREE.MeshBasicMaterial).color.set('#ffd60a');
    }
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    if (Date.now() < stunUntil) return { text: 'SCHIACCIATO! VEDI LE STELLINE', cls: 'sc-red' };
    for (const f of formas.values()) {
      const rem = f.at - h.now;
      if (rem > 0 && rem < MON.formaWarn + 200 && Math.hypot(h.me.x - f.x, h.me.z - f.z) < MON.formaR + 0.6) return { text: 'FORMA IN ARRIVO: SPOSTATI!', cls: 'sc-red pulse-soft' };
    }
    for (const c of coins.values()) if (c.v > 1 && Math.hypot(h.me.x - c.x, h.me.z - c.z) < 7) return { text: 'MONETONA D’ORO VICINA!', cls: 'sc-yellow pulse-soft' };
    return { text: 'ARRAFFA LE MONETE!', cls: 'sc-yellow' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const s = live.at && Date.now() - live.at < 3000 ? live.s : E.n;
    const top = Object.entries(s)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const rows = top.some(([id]) => id === h.myId) ? top : [...top, [h.myId, s[h.myId] ?? 0] as [string, number]];
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {rows.map(([id, n], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{top[i]?.[0] === id ? i + 1 : '·'}</span>
            {h.nameOf(id)}
            <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="8" fill="#ffd60a" stroke="#1d0f3d" strokeWidth="2.5" />
            </svg>
            {n}
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'mo_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 'mo_drop') {
      for (const a of p.c as number[][]) if (!gone.has(a[0]) && !coins.has(a[0])) coins.set(a[0], decode(a, p.t0));
    } else if (p.k === 'mo_take') {
      const coin = coins.get(p.i);
      gone.add(p.i);
      coins.delete(p.i);
      const mine = p.by === c.myId;
      if (!mine) hidden.delete(p.i);
      const at = coin ?? c.where(p.by);
      if (at) sparkle?.(at.x, 0.8, at.z, p.v > 1);
      if (mine) {
        const w = c.where(c.myId);
        if (w) popText(c.world, w.x, w.y - 0.6, w.z, `+${p.v}`, p.v > 1 ? '#ffd60a' : '#fff3b0', { scale: p.v > 1 ? 1.2 : 0.7, life: 0.7 });
        if (!hidden.has(p.i)) soundManager.playPop();
        if (p.v > 1) soundManager.playSuccess();
        hidden.delete(p.i);
      } else if (p.v > 1) {
        const w = c.where(p.by);
        if (w) popText(c.world, w.x, w.y - 0.6, w.z, '+5', '#ffd60a', { scale: 0.8, life: 0.7 });
      }
    } else if (p.k === 'mo_forma') {
      formas.set(p.i, { i: p.i, x: p.x, z: p.z, at: p.at, hit: false });
      if (Math.hypot(c.me.x - p.x, c.me.z - p.z) < MON.formaR + 2.5) soundManager.playTick();
    } else if (p.k === 'mo_crush') {
      const f = formas.get(p.i);
      if (f && !f.hit) {
        f.hit = true;
        crushFx?.(f, Math.hypot(c.me.x - f.x, c.me.z - f.z) < 9);
      }
      for (const h of p.hit as { id: string; lose: number }[]) {
        const at = c.where(h.id);
        if (at) popText(c.world, at.x, at.y, at.z, h.lose ? `SCHIACCIATO! -${h.lose}` : 'SCHIACCIATO!', '#ff4d6d', { scale: 0.9 });
        if (h.id === c.myId) {
          stunUntil = Date.now() + 1300;
          c.shake(0.9);
          soundManager.playFall();
          c.feed(h.lose ? `Una forma di parmigiano ti ha schiacciato: -${h.lose} monete` : 'Una forma di parmigiano ti ha schiacciato!');
        } else if (h.lose >= 3) c.feed(`${c.nameOf(h.id)} schiacciato da una forma: -${h.lose}`);
      }
      if (Math.hypot(c.me.x - p.x, c.me.z - p.z) < 7) c.shake(0.35);
    } else if (p.k === 'mo_slap') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y - 0.5, at.z, `-${p.lose}`, '#ff4d6d', { scale: 0.8, life: 0.8 });
      if (p.id === c.myId) c.feed(`${c.nameOf(p.by)} ti ha fatto cadere ${p.lose} monete!`);
      else if (p.by === c.myId && p.lose >= 3) c.feed(`Hai fatto cadere ${p.lose} monete a ${c.nameOf(p.id)}: prendile!`);
    } else if (p.k === 'mo_rain') {
      soundManager.playWhoosh();
      c.feed('Acquazzone di monete! Guarda le ombre');
      burst(c.world, p.x, 6, p.z, ['#ffd60a', '#fff3b0', '#ffffff'], 30, 4);
    }
  },
});
