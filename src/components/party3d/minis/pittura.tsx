// 🎨 Pennellate (telefono): il quadro di maiolica nella cornice d'oro, i rulli, i secchi che cadono dal cielo, SPLASH!
// Il pavimento colorato è UNA texture 24×24 (un pixel per piastrella), aggiornata solo quando cambia qualcosa.
import * as THREE from 'three';
import { PAINT, PAINT_CHARS, PAINT_N, paintTileAt } from '../../../data/minis/pittura';
import { haptic, soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, glow, matte, outlined, popText, rbox, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Bucket = { id: number; x: number; z: number; at: number };
type Ext = { tiles: string; order: string[]; buckets: Bucket[] } | null;

const N = PAINT.n;
const EMPTY_RGB = [253, 246, 227]; // le piastrelle libere sul quadretto del cavalletto

// ---------------------------------------------------------------- stato del pavimento sul telefono
const FL = {
  key: '', // giro + giocatori (se cambia si riparte da zero)
  arr: new Int8Array(PAINT_N).fill(-1), // chi ha ogni piastrella (indice in order)
  snap: '', // l'ultimo pavimento intero arrivato dal server
  pred: new Map<number, number>(), // le mie piastrelle colorate in anticipo (piastrella → quando)
  order: [] as string[],
  palette: [] as number[][],
  data: null as Uint8Array | null, // pixel della texture
  dirty: true,
};
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };
const dizzy = new Map<string, number>(); // sbilanciato fino a (Date.now())
const drops = new Map<number, Bucket & { seen: number }>(); // secchi annunciati dagli effetti
const taken = new Set<number>();
type Ring = { m: THREE.Mesh; t0: number };
let rings: Ring[] = [];
let ringGroup: THREE.Group | null = null;
const CODE = new Int8Array(128).fill(-1);
for (let i = 0; i < PAINT_CHARS.length; i++) CODE[PAINT_CHARS.charCodeAt(i)] = i;

function setTile(k: number, who: number) {
  FL.arr[k] = who;
  const D = FL.data;
  if (!D) return;
  const o = ((N - 1 - Math.floor(k / N)) * N + (k % N)) * 4; // la riga 0 della texture è in fondo (z grande)
  const c = who >= 0 ? (FL.palette[who] ?? [200, 200, 200]) : EMPTY_RGB;
  D[o] = c[0];
  D[o + 1] = c[1];
  D[o + 2] = c[2];
  D[o + 3] = who >= 0 ? 255 : 0;
  FL.dirty = true;
}

function hexRgb(hex: string) {
  const v = parseInt(hex.replace('#', ''), 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// nuovo giro / nuovi giocatori / pavimento intero arrivato
function syncFloor(E: NonNullable<Ext>, round: number, roster: { id: string; color: string }[]) {
  const key = `${round}|${E.order.join(',')}`;
  if (key !== FL.key) {
    FL.key = key;
    FL.order = E.order;
    FL.palette = E.order.map((id) => hexRgb(roster.find((r) => r.id === id)?.color ?? '#cccccc'));
    FL.snap = '';
    FL.pred.clear();
    for (let k = 0; k < PAINT_N; k++) setTile(k, -1);
  }
  if (E.tiles !== FL.snap && E.tiles.length === PAINT_N) {
    FL.snap = E.tiles;
    const now = Date.now();
    for (let k = 0; k < PAINT_N; k++) {
      const p = FL.pred.get(k);
      if (p !== undefined && now - p < 500) continue; // la mia pennellata è più nuova
      const who = CODE[E.tiles.charCodeAt(k) & 127];
      if (who !== FL.arr[k]) setTile(k, who);
    }
  }
}

function countAll() {
  const n = new Array<number>(FL.order.length).fill(0);
  for (let k = 0; k < PAINT_N; k++) if (FL.arr[k] >= 0 && FL.arr[k] < n.length) n[FL.arr[k]]++;
  return n;
}

// ---------------------------------------------------------------- texture
// la piastrella di maiolica (bianca, coi decori blu e gialli: come quelle della costiera)
const majolica = () =>
  canvasTex(
    128,
    128,
    (c) => {
      c.fillStyle = '#d9cdb0';
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#fdf6e3';
      c.beginPath();
      c.roundRect(4, 4, 120, 120, 14);
      c.fill();
      c.fillStyle = '#2a6fdb';
      for (const [x, y] of [
        [4, 4],
        [124, 4],
        [4, 124],
        [124, 124],
      ]) {
        c.beginPath();
        c.arc(x, y, 24, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#fdf6e3';
      for (const [x, y] of [
        [4, 4],
        [124, 4],
        [4, 124],
        [124, 124],
      ]) {
        c.beginPath();
        c.arc(x, y, 13, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#ffc93c';
      for (let i = 0; i < 4; i++) {
        c.save();
        c.translate(64, 64);
        c.rotate((i * Math.PI) / 2);
        c.beginPath();
        c.ellipse(0, -18, 9, 17, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      c.fillStyle = '#2a6fdb';
      c.beginPath();
      c.arc(64, 64, 8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(42,111,219,0.35)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(64, 64, 34, 0, Math.PI * 2);
      c.stroke();
    },
    [N, N],
  );
// forma della piastrella colorata (bordi arrotondati, fuga in mezzo) e un po' di rilievo da smalto
const tileShape = () =>
  canvasTex(
    64,
    64,
    (c) => {
      c.fillStyle = '#000000';
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.roundRect(2.5, 2.5, 59, 59, 9);
      c.fill();
    },
    [N, N],
  );
const glaze = () =>
  canvasTex(
    64,
    64,
    (c) => {
      const g = c.createRadialGradient(28, 26, 4, 32, 32, 40);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#8a8a8a');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      c.strokeStyle = '#b8b8b8';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(32, 32, 16, 0, Math.PI * 2);
      c.stroke();
    },
    [N, N],
  );
const canLabel = () =>
  canvasTex(256, 64, (c) => {
    const cols = ['#ff4d6d', '#ffd60a', '#06d6a0', '#3a86ff', '#8338ec', '#ff70a6'];
    for (let i = 0; i < 12; i++) {
      c.fillStyle = cols[i % cols.length];
      c.fillRect(i * 22, 0, 22, 64);
    }
    c.fillStyle = '#ffffff';
    c.fillRect(0, 18, 256, 28);
    c.font = '900 24px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#1d0f3d';
    c.fillText('VERNICE · VERNICE', 128, 33);
  });

// ---------------------------------------------------------------- pezzi
let ROLLER: { handle: THREE.BufferGeometry; roll: THREE.BufferGeometry; bar: THREE.BufferGeometry; grip: THREE.BufferGeometry; star: THREE.BufferGeometry; metal: THREE.Material; gripM: THREE.Material; starM: THREE.Material; naps: Map<string, THREE.Material> } | null = null;
function rollerKit() {
  ROLLER ??= {
    handle: new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8),
    roll: new THREE.CylinderGeometry(0.2, 0.2, 0.95, 18),
    bar: new THREE.BoxGeometry(1.0, 0.05, 0.05),
    grip: new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10),
    star: new THREE.OctahedronGeometry(0.11, 0),
    metal: new THREE.MeshStandardMaterial({ color: '#d7dde8', metalness: 0.85, roughness: 0.25 }),
    gripM: toy('#ff4d6d'),
    starM: glow('#ffd60a', 2.2),
    naps: new Map(),
  };
  return ROLLER;
}

function makeRoller(color: string) {
  const K = rollerKit();
  let nap = K.naps.get(color);
  if (!nap) {
    nap = toy(color, { roughness: 0.85, clearcoat: 0 });
    K.naps.set(color, nap);
  }
  const g = new THREE.Group();
  g.name = 'paint-roller';
  const from = new THREE.Vector3(0, 0.95, 0.4);
  const to = new THREE.Vector3(0, 0.24, 1.15);
  const handle = new THREE.Mesh(K.handle, K.metal);
  handle.position.copy(from).lerp(to, 0.5);
  handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  const grip = new THREE.Mesh(K.grip, K.gripM);
  grip.position.copy(from);
  grip.quaternion.copy(handle.quaternion);
  const bar = new THREE.Mesh(K.bar, K.metal);
  bar.position.copy(to);
  const roll = outlined(new THREE.Mesh(K.roll, nap), 1.06);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.2, 1.22);
  g.add(handle, grip, bar, roll);
  shadowy(g, true, false);
  g.userData = { roll, lx: NaN, lz: NaN };
  return g;
}

function makeDizzy() {
  const K = rollerKit();
  const g = new THREE.Group();
  g.name = 'paint-dizzy';
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(K.star, K.starM);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45);
    g.add(s);
  }
  g.position.y = 0.78;
  g.visible = false;
  return g;
}

// tavolozza del pittore (l'isola sotto il quadro)
function palette() {
  const s = new THREE.Shape();
  s.moveTo(0, -17);
  s.bezierCurveTo(16, -18, 23, -6, 21, 6);
  s.bezierCurveTo(19, 17, 6, 20, -4, 18);
  s.bezierCurveTo(-14, 16, -22, 10, -21, -1);
  s.bezierCurveTo(-20, -12, -12, -16.5, 0, -17);
  const hole = new THREE.Path();
  hole.absarc(-14.5, 9.5, 2.2, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.5, bevelSegments: 3, curveSegments: 32 });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, toy('#d39b5f', { roughness: 0.55, clearcoat: 0.3 }));
  m.position.y = -1.4;
  return m;
}

// pennello gigante piantato nella tavolozza
function brush(color: string) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 11, 12), toy('#c1121f'));
  stick.position.y = 5.5;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.38, 1.6, 16), new THREE.MeshStandardMaterial({ color: '#d7dde8', metalness: 0.85, roughness: 0.25 }));
  ferrule.position.y = 11.6;
  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 16), toy('#f4d6a0', { roughness: 0.8 }));
  hair.position.y = 13.6;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 16), toy(color));
  tip.position.y = 14.5;
  g.add(stick, ferrule, hair, tip);
  return shadowy(g);
}

// tubetto di colore schiacciato
function tube(color: string) {
  const g = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 16), toy('#f1f1f1')), 1.04);
  body.scale.set(1, 1, 0.55);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 1.6, 16), toy(color));
  band.scale.set(1, 1, 0.56);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 12), toy('#1d0f3d'));
  cap.position.y = 2.4;
  const blob = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10), toy(color, { clearcoat: 1, roughness: 0.15 }));
  blob.scale.set(1.4, 0.35, 1.1);
  blob.position.set(0, 3.4, 0.2);
  g.add(body, band, cap, blob);
  g.rotation.x = Math.PI / 2;
  return shadowy(g);
}

registerClientMini({
  kind: 'PITTURA',
  orbit: { c: [0, 0, 0], r: 30 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ffd166" to="#ff70a6">
      <rect x="16" y="40" width="20" height="20" rx="4" fill="#3a86ff" {...stroke} />
      <rect x="36" y="40" width="20" height="20" rx="4" fill="#3a86ff" {...stroke} />
      <rect x="16" y="60" width="20" height="20" rx="4" fill="#06d6a0" {...stroke} />
      <rect x="36" y="60" width="20" height="20" rx="4" fill="#fdf6e3" {...stroke} />
      <rect x="56" y="60" width="20" height="20" rx="4" fill="#ff4d6d" {...stroke} />
      <rect x="48" y="16" width="36" height="16" rx="7" fill="#ff4d6d" {...stroke} />
      <path d="M66 32 V40 H70 V50" fill="none" {...stroke} />
      <rect x="66" y="48" width="8" height="18" rx="3" fill="#ffd60a" {...stroke} />
    </Badge>
  ),
  hint: 'WASD muovi: dove passi colori · prendi i secchi (SPLASH!) · E schiaffo: sbilancia · Shift scatto',
  build(world) {
    const g = world.arena;
    rings = [];
    ringGroup = new THREE.Group();
    g.add(ringGroup);
    FL.key = '';
    FL.dirty = true;
    drops.clear();
    taken.clear();
    // la texture del pavimento colorato: un pixel per piastrella
    const data = new Uint8Array(PAINT_N * 4);
    FL.data = data;
    for (let k = 0; k < PAINT_N; k++) setTile(k, -1);
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const W = PAINT.half * 2;
    // il quadro: piastrelle di maiolica bianche…
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.8, W + 0.4), [matte('#e7dcc0'), matte('#e7dcc0'), matte('#ffffff', { map: majolica(), roughness: 0.35 }), matte('#e7dcc0'), matte('#e7dcc0'), matte('#e7dcc0')]);
    slab.position.y = -0.4;
    slab.receiveShadow = true;
    // …e sopra il colore di chi ci è passato
    const paintM = new THREE.MeshStandardMaterial({ map: tex, alphaMap: tileShape(), alphaTest: 0.5, bumpMap: glaze(), bumpScale: 1.4, roughness: 0.22, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2 });
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(W, W), paintM);
    paint.rotation.x = -Math.PI / 2;
    paint.position.y = 0.012;
    paint.receiveShadow = true;
    g.add(slab, paint);
    // la cornice d'oro
    const gold = toy('#f2c14e', { metalness: 0.55, roughness: 0.28, clearcoat: 0.8 });
    for (const [x, z, w, d] of [
      [0, PAINT.half + 0.55, W + 2.2, 1.1],
      [0, -PAINT.half - 0.55, W + 2.2, 1.1],
      [PAINT.half + 0.55, 0, 1.1, W],
      [-PAINT.half - 0.55, 0, 1.1, W],
    ]) {
      const bar = outlined(new THREE.Mesh(rbox(w, 0.9, d, 0.3), gold), 1.02);
      bar.position.set(x, 0.1, z);
      g.add(shadowy(bar));
    }
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const orn = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), gold), 1.04);
        orn.position.set(x * (PAINT.half + 0.55), 0.6, z * (PAINT.half + 0.55));
        g.add(shadowy(orn));
      }
    // la tavolozza sotto, con i colori, i pennelli e i tubetti
    g.add(shadowy(palette(), false, true));
    const blobCols = ['#ff4d6d', '#ffd60a', '#06d6a0', '#3a86ff', '#8338ec', '#fb5607', '#ff70a6', '#70d6ff'];
    blobCols.forEach((col, i) => {
      const a = (i / blobCols.length) * Math.PI * 2 + 0.25;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), toy(col, { clearcoat: 1, roughness: 0.12 }));
      blob.scale.set(1, 0.45, 1);
      blob.position.set(Math.sin(a) * 17.2, -1.0, Math.cos(a) * 15.5);
      g.add(blob);
    });
    const brushes: THREE.Object3D[] = [];
    [
      [-22, -21, '#3a86ff', 0.25],
      [22, 21, '#ff4d6d', -0.3],
      [23, -20, '#06d6a0', -0.2],
    ].forEach(([x, z, col, tilt], i) => {
      // (lontani dal quadro: la telecamera dietro di me non ci finisce dentro)
      const b = brush(col as string);
      b.position.set(x as number, -6, z as number);
      b.rotation.set(tilt as number, i, (tilt as number) * 0.8);
      g.add(b);
      brushes.push(b);
    });
    const tb = tube('#ff70a6');
    tb.position.set(-18, -0.4, 4);
    tb.rotation.z = 0.6;
    g.add(tb);
    // il cavalletto col quadretto: il pavimento dal vivo, visto dall'alto
    const easel = new THREE.Group();
    const wood = toy('#a8672e', { roughness: 0.6 });
    const legG = new THREE.CylinderGeometry(0.18, 0.22, 13, 8);
    for (const [x, rz, rx] of [
      [-2.6, -0.16, 0],
      [2.6, 0.16, 0],
      [0, 0, -0.35],
    ]) {
      const leg = new THREE.Mesh(legG, wood);
      leg.position.set(x, 5, rx ? 1.6 : 0);
      leg.rotation.set(rx, 0, rz);
      easel.add(leg);
    }
    const ledge = new THREE.Mesh(rbox(6.5, 0.3, 0.8, 0.1), wood);
    ledge.position.set(0, 3.4, -0.3);
    const canvasFrame = outlined(new THREE.Mesh(rbox(7.2, 7.2, 0.35, 0.12), gold), 1.02);
    canvasFrame.position.set(0, 7.2, 0);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    pic.position.set(0, 7.2, -0.2);
    pic.rotation.set(0, Math.PI, Math.PI); // girato come il pavimento visto da chi gioca
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 3.2, 1.2, 24), toy('#d39b5f', { roughness: 0.55 }));
    isle.position.set(0, -2.2, 0.6);
    easel.add(ledge, canvasFrame, pic, isle);
    // grande e lontano (si vede da tutto il quadro, ma non sta mai tra me e la telecamera)
    easel.position.set(0, -5, PAINT.half + 19);
    easel.scale.setScalar(1.7);
    g.add(shadowy(easel));
    world.camBlockers.push(easel, ...brushes);
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 10; i++) {
      const b = balloon(blobCols[i % blobCols.length]);
      const a = (i / 10) * Math.PI * 2 + 0.5;
      b.position.set(Math.sin(a) * 31, 9 + (i % 3) * 2.2, Math.cos(a) * 31);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // i secchi di vernice
    const canG = new THREE.CylinderGeometry(0.42, 0.37, 0.62, 24);
    const canM = [toy('#ffffff', { map: canLabel(), clearcoat: 0.6 }), new THREE.MeshStandardMaterial({ color: '#cfd6e2', metalness: 0.8, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#cfd6e2', metalness: 0.8, roughness: 0.3 })];
    const rimG = new THREE.TorusGeometry(0.42, 0.045, 8, 28);
    const paintTopM = toy('#ff4d6d', { clearcoat: 1, roughness: 0.1, emissive: '#ff4d6d', emissiveIntensity: 0.25 });
    const paintTopG = new THREE.CircleGeometry(0.4, 24);
    const handleG = new THREE.TorusGeometry(0.36, 0.03, 6, 20, Math.PI);
    const dripG = new THREE.CapsuleGeometry(0.06, 0.22, 4, 8);
    const ringG = new THREE.RingGeometry(PAINT.splashR - 0.12, PAINT.splashR, 64);
    const ringM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    const beamG = new THREE.CylinderGeometry(0.28, 0.28, 10, 12, 1, true);
    const beamM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const rainbow = ['#ff4d6d', '#ffd60a', '#06d6a0', '#3a86ff', '#8338ec'];
    const dripMs = rainbow.map((c) => toy(c, { clearcoat: 1, roughness: 0.1 }));
    const meshes = new Map<number, THREE.Group>();
    const makeBucket = () => {
      const b = new THREE.Group();
      const can = new THREE.Group();
      const body = outlined(new THREE.Mesh(canG, canM), 1.05);
      body.position.y = 0.31;
      const rim = new THREE.Mesh(rimG, canM[1]);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.62;
      const top = new THREE.Mesh(paintTopG, paintTopM);
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.6;
      const handle = new THREE.Mesh(handleG, canM[1]);
      handle.position.y = 0.62;
      can.add(body, rim, top, handle);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const d = new THREE.Mesh(dripG, dripMs[i]);
        d.position.set(Math.sin(a) * 0.42, 0.5 - (i % 2) * 0.08, Math.cos(a) * 0.42);
        can.add(d);
      }
      shadowy(can, true, false);
      const mark = new THREE.Mesh(ringG, ringM);
      mark.rotation.x = -Math.PI / 2;
      mark.position.y = 0.03;
      const beam = new THREE.Mesh(beamG, beamM);
      beam.position.y = 5;
      b.add(can, mark, beam);
      b.userData = { can, mark, beam, landed: false };
      return b;
    };
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -16;
    sh.right = sh.top = 16;
    const hue = new THREE.Color();

    return (f) => {
      const E = f.ext as Ext;
      if (E) syncFloor(E, f.view.round, f.view.roster);
      if (FL.dirty) {
        FL.dirty = false;
        tex.needsUpdate = true;
      }
      // i secchi: quelli dello stato più quelli appena annunciati (e non ancora presi)
      const want = new Map<number, Bucket>();
      for (const B of E?.buckets ?? []) if (!taken.has(B.id)) want.set(B.id, B);
      for (const [id, B] of drops) {
        if (Date.now() - B.seen > 2500 || taken.has(id)) drops.delete(id);
        else if (!want.has(id)) want.set(id, B);
      }
      for (const [id, m] of meshes)
        if (!want.has(id)) {
          g.remove(m);
          meshes.delete(id);
        }
      hue.setHSL((f.t * 0.25) % 1, 0.85, 0.55);
      paintTopM.color.copy(hue);
      paintTopM.emissive.copy(hue);
      beamM.color.copy(hue);
      for (const [id, B] of want) {
        let m = meshes.get(id);
        if (!m) {
          m = makeBucket();
          m.position.set(B.x, 0, B.z);
          meshes.set(id, m);
          g.add(m);
        }
        const U = m.userData as { can: THREE.Group; mark: THREE.Mesh; beam: THREE.Mesh; landed: boolean };
        const left = (B.at - f.now) / PAINT.dropMs;
        if (left > 0) {
          // cade dal cielo (si vede già dove atterra e quanto colora)
          U.can.position.y = 15 * left * left;
          U.can.rotation.set(left * 3, left * 5, 0);
          U.beam.visible = false;
          U.mark.scale.setScalar(0.6 + (1 - left) * 0.4);
        } else {
          if (!U.landed) {
            U.landed = true;
            burst(world, B.x, 0.3, B.z, rainbow, 18, 4);
            if (Math.hypot(f.me.x - B.x, f.me.z - B.z) < 14) soundManager.playPop();
          }
          U.can.position.y = 0.05 + Math.abs(Math.sin(f.t * 3 + id)) * 0.18;
          U.can.rotation.set(0, f.t * 1.5, 0);
          U.beam.visible = true;
          U.mark.scale.setScalar(1 + Math.sin(f.t * 5) * 0.03);
        }
      }
      // gli anelli degli SPLASH che si allargano fino al bordo colorato
      const nowP = performance.now();
      rings = rings.filter((r) => {
        const e = (nowP - r.t0) / 1000;
        if (e > 0.9) {
          ringGroup?.remove(r.m);
          (r.m.material as THREE.Material).dispose();
          return false;
        }
        r.m.scale.setScalar(0.2 + Math.min(1, e / 0.3) * 0.8);
        (r.m.material as THREE.MeshBasicMaterial).opacity = e < 0.3 ? 0.9 : 0.9 * (1 - (e - 0.3) / 0.6);
        return true;
      });
      for (const b of brushes) b.rotation.y += f.dt * 0.1;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
      easel.rotation.z = Math.sin(f.t * 0.7) * 0.01;
    };
  },
  // ognuno spinge il suo rullo (del suo colore); chi è sbilanciato vede le stelline
  decorate(av, id, f) {
    let roller = av.deco.getObjectByName('paint-roller') as THREE.Group | undefined;
    if (!roller) {
      roller = makeRoller(f.view.roster.find((r) => r.id === id)?.color ?? '#ff4d6d');
      av.deco.add(roller);
      av.headDeco.add(makeDizzy());
    }
    const U = roller.userData as { roll: THREE.Mesh; lx: number; lz: number };
    const px = av.root.position.x;
    const pz = av.root.position.z;
    if (!Number.isNaN(U.lx)) {
      const dx = px - U.lx;
      const dz = pz - U.lz;
      // gira in avanti o indietro secondo dove va
      const fwd = dx * Math.sin(av.root.rotation.y) + dz * Math.cos(av.root.rotation.y);
      U.roll.rotation.x += fwd / 0.2;
    }
    U.lx = px;
    U.lz = pz;
    av.armL.rotation.x = av.armR.rotation.x = -0.8 + Math.sin(f.t * 9) * 0.04;
    av.armL.rotation.z = 0.2;
    av.armR.rotation.z = -0.2;
    const dz = av.headDeco.getObjectByName('paint-dizzy');
    if (dz) {
      dz.visible = (dizzy.get(id) ?? 0) > Date.now();
      if (dz.visible) dz.rotation.y = f.t * 7;
    }
  },
  // la mia pennellata si vede subito (il server conferma poco dopo)
  local(f) {
    const E = f.ext as Ext;
    if (!E || f.view.stage !== 'PLAY' || !f.view.alive[f.myId] || FL.key === '') return;
    if (f.me.y > 0.4 || (dizzy.get(f.myId) ?? 0) > Date.now()) return;
    const who = E.order.indexOf(f.myId);
    const k = paintTileAt(f.me.x, f.me.z);
    if (who < 0 || k < 0 || FL.arr[k] === who) return;
    setTile(k, who);
    FL.pred.set(k, Date.now());
  },
  speed: (f) => ((dizzy.get(f.myId) ?? 0) > Date.now() ? 0.55 : 1),
  status(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    if ((dizzy.get(h.myId) ?? 0) > Date.now()) return { text: 'SBILANCIATO! IL RULLO NON COLORA', cls: 'sc-red pulse-soft' };
    const near = E.buckets.find((b) => h.now >= b.at && Math.hypot(b.x - h.me.x, b.z - h.me.z) < 9);
    if (near) return { text: 'SECCHIO DI VERNICE: PRENDILO!', cls: 'sc-yellow pulse-soft' };
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    if (t < 5) return { text: 'COLORA PIÙ PIASTRELLE CHE PUOI', cls: 'sc-yellow' };
    return null;
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage === 'INTRO' || !FL.order.length) return null;
    // i conti del server (ogni mezzo secondo); se tardano, quelli del pavimento che vedo
    const fresh = live.at && Date.now() - live.at < 2000;
    const n = fresh ? null : countAll();
    const rows = FL.order.map((id, i) => ({ id, v: fresh ? (live.s[id] ?? 0) : (n![i] ?? 0) })).sort((a, b) => b.v - a.v);
    const mine = rows.find((r) => r.id === h.myId)?.v ?? 0;
    const pct = (v: number) => Math.round((v / PAINT_N) * 100);
    return (
      <>
        {/* la barra dei colori: quanto quadro ha ognuno */}
        <div className="pointer-events-none absolute inset-x-0 top-[64px] flex flex-col items-center gap-1">
          <div className="flex h-4 w-[min(78vw,420px)] overflow-hidden rounded-full border-[3px] border-[#1d0f3d] bg-[#fdf6e3]/80">
            {rows
              .filter((r) => r.v > 0)
              .map((r) => (
                <div key={r.id} style={{ width: `${(r.v / PAINT_N) * 100}%`, background: h.colorOf(r.id) }} className={r.id === h.myId ? 'brightness-110' : ''} />
              ))}
          </div>
          {h.alive && <p className="sc-chip px-3 py-0.5 text-xs font-black text-white">{`IL TUO COLORE: ${pct(mine)}%`}</p>}
        </div>
        <div className="pointer-events-none absolute left-3 top-[118px] flex flex-col gap-1">
          {rows.slice(0, 3).map((r, i) =>
            r.v > 0 ? (
              <p key={r.id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${r.id === h.myId ? '!bg-amber-500/80' : ''}`}>
                <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-[#1d0f3d]" style={{ background: h.colorOf(r.id) }} />
                {h.nameOf(r.id)} · {pct(r.v)}%
              </p>
            ) : null,
          )}
        </div>
      </>
    );
  },
  fx(p, c) {
    if (p.k === 'paint_t') {
      const list = p.c as number[];
      const now = Date.now();
      const me = FL.order.indexOf(c.myId);
      for (let i = 0; i + 1 < list.length; i += 2) {
        const k = list[i];
        const who = list[i + 1];
        if (k < 0 || k >= PAINT_N) continue;
        const pr = FL.pred.get(k);
        if (pr !== undefined && now - pr < 300 && who !== me) continue; // notizia vecchia: ci sono appena passato io
        FL.pred.delete(k);
        if (FL.arr[k] !== who) setTile(k, who);
      }
    } else if (p.k === 'paint_splash') {
      const list = p.c as number[];
      for (let i = 0; i + 1 < list.length; i += 2) {
        FL.pred.delete(list[i]);
        setTile(list[i], list[i + 1]);
      }
      taken.add(p.b);
      const col = c.view.roster.find((r) => r.id === p.id)?.color ?? '#ffffff';
      burst(c.world, p.x, 0.6, p.z, [col, col, '#ffffff'], 60, 8);
      popText(c.world, p.x, 0.4, p.z, 'SPLASH!', col, { scale: 1.4, life: 1.1 });
      if (ringGroup) {
        const m = new THREE.Mesh(new THREE.RingGeometry(PAINT.splashR - 0.35, PAINT.splashR, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, 0.06, p.z);
        ringGroup.add(m);
        rings.push({ m, t0: performance.now() });
      }
      const d = Math.hypot(c.me.x - p.x, c.me.z - p.z);
      if (p.id === c.myId) {
        soundManager.playSuccess();
        soundManager.playWhoosh();
        haptic([40, 30, 60]);
        c.shake(0.35);
      } else if (d < 14) {
        soundManager.playPop();
        c.feed(`${c.nameOf(p.id)} ha preso il secchio`);
      }
    } else if (p.k === 'paint_drop') {
      drops.set(p.id, { id: p.id, x: p.x, z: p.z, at: p.at, seen: Date.now() });
      soundManager.playWhoosh();
    } else if (p.k === 'paint_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 'paint_dizzy') {
      const until = Date.now() + (Number(p.ms) || PAINT.stunMs);
      for (const id of p.ids as string[]) {
        dizzy.set(id, until);
        if (id === c.myId) haptic(70);
      }
    }
  },
});
