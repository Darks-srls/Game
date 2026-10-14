// Personaggi di "Non lasciarmi solo": i manutentori (giacca da lavoro, guanti, casco o berretto riconoscibile),
// le mani con la torcia in prima persona e il Custode: alto, tuta da lavoro irrigidita dall'umidità, il volto
// che sembra un'area mancante. Proporzioni umane leggermente semplificate, movimenti contenuti.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const mat = (color: THREE.ColorRepresentation, roughness = 0.75, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 12);

// Un arto che gira attorno alla spalla/anca
function limb(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, len: number) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

// ---------------------------------------------------------------- i compagni

export interface Worker {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  lens: THREE.Mesh;
  beam: THREE.Mesh;
  label: THREE.Sprite;
  phase: number;
  stepAt: number;
}
const JACKETS = ['#2f4a6d', '#6d3b2f', '#3e5b3a', '#5b4a6e', '#6b5b2f', '#2f5f63', '#6e2f4a', '#4a4a4a'];
function hashOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}
export function makeWorker(id: string, name: string, color: string): Worker {
  const h = hashOf(id);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const jacket = mat(JACKETS[h % JACKETS.length], 0.85);
  const pants = mat('#2a2c30', 0.9);
  const skin = mat('#c99a7a', 0.7);
  const glove = mat('#1f1f1f', 0.8);
  // fascia riflettente con il colore del giocatore (si riconosce anche al buio)
  const band = mat(color, 0.4, 0, { emissive: color, emissiveIntensity: 0.25 });
  const torso = new THREE.Mesh(rbox(0.46, 0.62, 0.26, 0.09), jacket);
  torso.position.y = 1.2;
  torso.castShadow = true;
  body.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.27), band);
  stripe.position.y = 1.12;
  body.add(stripe);
  const hips = new THREE.Mesh(rbox(0.38, 0.18, 0.24, 0.06), pants);
  hips.position.y = 0.86;
  body.add(hips);
  const head = new THREE.Group();
  head.position.y = 1.66;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skin);
  skull.scale.set(1, 1.15, 1.05);
  skull.castShadow = true;
  head.add(skull);
  // il segno di riconoscimento: casco, berretto, cappuccio o cuffie
  const kind = h % 4;
  if (kind === 0) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e0b81e', 0.4));
    helmet.position.y = 0.03;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 20), mat('#e0b81e', 0.4));
    brim.position.y = 0.03;
    head.add(helmet, brim);
  } else if (kind === 1) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0.8));
    cap.position.y = 0.02;
    const visor = new THREE.Mesh(rbox(0.2, 0.02, 0.12, 0.01), mat(color, 0.8));
    visor.position.set(0, 0.03, 0.14);
    head.add(cap, visor);
  } else if (kind === 2) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), jacket);
    hood.position.set(0, 0.0, -0.02);
    hood.rotation.x = -0.25;
    head.add(hood);
  } else {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.148, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a2b2b', 0.95));
    beanie.position.y = 0.02;
    beanie.scale.y = 1.2;
    head.add(beanie);
  }
  body.add(head);
  const armL = limb(body, capsule(0.06, 0.5), jacket, -0.29, 1.48, 0.62);
  const armR = limb(body, capsule(0.06, 0.5), jacket, 0.29, 1.48, 0.62);
  const legL = limb(body, capsule(0.075, 0.68), pants, -0.11, 0.86, 0.83);
  const legR = limb(body, capsule(0.075, 0.68), pants, 0.11, 0.86, 0.83);
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), glove);
    hand.position.y = -0.64;
    a.add(hand);
  }
  // borsa laterale (cambia lato da giocatore a giocatore)
  const bag = new THREE.Mesh(rbox(0.12, 0.22, 0.26, 0.03), mat('#3b3127', 0.9));
  bag.position.set(h % 2 ? 0.27 : -0.27, 0.88, 0);
  body.add(bag);
  // la torcia nella mano destra
  const torch = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 12), mat('#2b2b2b', 0.4, 0.6));
  tube.rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#fff1d0', emissiveIntensity: 2 }));
  lens.position.z = 0.111;
  torch.add(tube, lens);
  torch.position.set(0, -0.62, 0.07);
  armR.add(torch);
  // il fascio di luce che si vede nell'aria (cono tenue)
  const beam = makeBeam(5.5, 0.9, 0.05);
  beam.position.z = 0.12;
  torch.add(beam);
  const label = nameLabel(name);
  label.position.y = 2.05;
  label.visible = false;
  root.add(label);
  return { root, body, head, armL, armR, legL, legR, lens, beam, label, phase: Math.random() * 6, stepAt: 0 };
}

// Cono di luce morbido (sfuma in lunghezza e sui bordi)
export function makeBeam(len: number, radius: number, opacity: number) {
  const geo = new THREE.ConeGeometry(radius, len, 28, 1, true);
  geo.translate(0, -len / 2, 0);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { op: { value: opacity }, len: { value: len } },
    vertexShader: `varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ vZ = position.z; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float op; uniform float len; varying float vZ; varying vec3 vN; varying vec3 vV;
      void main(){ float along = clamp(vZ / len, 0.0, 1.0); float rim = pow(abs(dot(vN, vV)), 1.6);
        float a = op * (1.0 - along) * (1.0 - along) * rim; gl_FragColor = vec4(1.0, 0.93, 0.8, a); }`,
  });
  return new THREE.Mesh(geo, m);
}

function nameLabel(text: string) {
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d')!;
  c.font = '600 40px Arial, sans-serif';
  const w = Math.ceil(c.measureText(text).width) + 30;
  cv.width = w;
  cv.height = 60;
  c.font = '600 40px Arial, sans-serif';
  c.fillStyle = 'rgba(10,12,16,0.55)';
  c.beginPath();
  c.roundRect(0, 0, w, 60, 14);
  c.fill();
  c.fillStyle = '#e8e2d6';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, w / 2, 32);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }));
  s.scale.set((w / 60) * 0.18, 0.18, 1);
  return s;
}

// Animazione di un compagno: cammina, corre, si abbassa; intrappolato resta a terra
export function animateWorker(w: Worker, o: { speed: number; crouch: boolean; pitch: number; torch: boolean; down: boolean; carry: boolean; t: number; dt: number }) {
  const k = Math.min(1, o.dt * 10);
  const walking = o.speed > 0.3 && !o.down;
  w.phase += o.dt * (walking ? 3 + o.speed * 2.1 : 1);
  const s = Math.sin(w.phase * 2);
  const amp = walking ? Math.min(0.75, 0.25 + o.speed * 0.15) : 0;
  const ease = (g: THREE.Object3D, x: number, z = 0) => {
    g.rotation.x += (x - g.rotation.x) * k;
    g.rotation.z += (z - g.rotation.z) * k;
  };
  if (o.down) {
    // a terra, appoggiato al muro
    w.body.position.y += (-0.72 - w.body.position.y) * k;
    ease(w.legL, -1.5, -0.2);
    ease(w.legR, -1.3, 0.2);
    ease(w.armL, -0.5, -0.3);
    ease(w.armR, -2.2 + Math.sin(o.t * 2) * 0.3, 0.2);
    w.body.rotation.x += (-0.2 - w.body.rotation.x) * k;
  } else {
    const cy = o.crouch ? -0.38 : 0;
    w.body.position.y += (cy + Math.abs(Math.cos(w.phase * 2)) * 0.03 * (walking ? 1 : 0) - w.body.position.y) * k;
    ease(w.legL, s * amp + (o.crouch ? -0.9 : 0));
    ease(w.legR, -s * amp + (o.crouch ? -0.9 : 0));
    ease(w.armL, o.carry ? -1.1 : -s * amp * 0.7);
    // braccio della torcia: segue lo sguardo
    ease(w.armR, o.carry ? -1.1 : -1.35 - o.pitch * 0.8);
    w.body.rotation.x += ((o.crouch ? 0.25 : walking ? 0.06 : 0) - w.body.rotation.x) * k;
    w.head.rotation.x = -o.pitch * 0.6;
  }
  w.lens.visible = o.torch;
  w.beam.visible = o.torch && !o.down;
}

// ---------------------------------------------------------------- mani e torcia in prima persona

export interface FirstPerson {
  root: THREE.Group;
  torch: THREE.Group;
  lens: THREE.Mesh;
  beam: THREE.Mesh;
  carry: THREE.Group;
  bob: number;
}
export function makeFirstPerson(): FirstPerson {
  const root = new THREE.Group();
  const sleeve = mat('#2c3440', 0.85);
  const glove = mat('#1d1d1d', 0.75);
  const torch = new THREE.Group();
  // torcia metallica lunga, con la ghiera e la lente (come nella copertina)
  const metal = mat('#3a3d42', 0.35, 0.75);
  const brass = mat('#8c6a3c', 0.35, 0.8);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.3, 18), metal);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.034, 0.08, 18), brass);
  head.rotation.x = Math.PI / 2;
  head.position.z = -0.18;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 18), new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe9c4', emissiveIntensity: 3 }));
  lens.position.z = -0.222;
  lens.rotation.y = Math.PI;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.12, 18), mat('#202224', 0.9));
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.06;
  torch.add(body, head, lens, grip);
  // la mano con il guanto che stringe la torcia e un pezzo di manica
  const hand = new THREE.Mesh(rbox(0.085, 0.07, 0.1, 0.03), glove);
  hand.position.set(0, -0.03, 0.05);
  const thumb = new THREE.Mesh(capsule(0.016, 0.05), glove);
  thumb.rotation.x = Math.PI / 2;
  thumb.position.set(-0.035, 0.02, 0.02);
  const arm = new THREE.Mesh(capsule(0.05, 0.35), sleeve);
  arm.rotation.x = Math.PI / 2 - 0.25;
  arm.position.set(0.02, -0.08, 0.3);
  torch.add(hand, thumb, arm);
  const beam = makeBeam(7.5, 1.35, 0.045);
  beam.position.z = -0.24;
  beam.rotation.y = Math.PI;
  torch.add(beam);
  torch.position.set(0.27, -0.27, -0.5);
  torch.rotation.set(0.04, 0.06, 0);
  torch.scale.setScalar(0.85);
  root.add(torch);
  // con un oggetto in mano: tutte e due le mani davanti
  const carry = new THREE.Group();
  carry.position.set(0, -0.32, -0.55);
  carry.visible = false;
  for (const x of [-0.18, 0.18]) {
    const h = new THREE.Mesh(rbox(0.08, 0.06, 0.1, 0.03), glove);
    h.position.set(x, 0, 0.02);
    const a = new THREE.Mesh(capsule(0.05, 0.32), sleeve);
    a.rotation.x = Math.PI / 2 - 0.4;
    a.position.set(x * 1.2, -0.08, 0.25);
    carry.add(h, a);
  }
  root.add(carry);
  root.traverse((o) => {
    (o as THREE.Mesh).castShadow = false;
    o.renderOrder = 5;
  });
  return { root, torch, lens, beam, carry, bob: 0 };
}

function stiffCloth(rTop: number, rBot: number, h: number, seed: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 14, 6, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const k = 1 + Math.sin(a * 5 + seed) * 0.05 + Math.sin(a * 11 + y * 4 + seed) * 0.035 + Math.sin(y * 9 + seed) * 0.02;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// ---------------------------------------------------------------- il Custode

// Altissimo e scheletrico, pelle grigia bagnata, la tuta da lavoro marcita, la mascella che si apre troppo.
// Trascina una chiave inglese arrugginita. Si muove a scatti, come se qualcuno saltasse dei fotogrammi.
const texLoader = new THREE.TextureLoader();
const monsterTex = new Map<string, THREE.Texture>();
function mtex(name: string, repeat = 1) {
  const key = `${name}:${repeat}`;
  let t = monsterTex.get(key);
  if (!t) {
    t = texLoader.load(`/horror/tex/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    monsterTex.set(key, t);
  }
  return t;
}
function ntex(name: string, repeat = 1) {
  const t = texLoader.load(`/horror/tex/${name}_n.webp`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export interface Custode {
  root: THREE.Group;
  body: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  wrench: THREE.Group;
  phase: number;
  twitchAt: number;
  twitch: { head: THREE.Euler; arm: number; neck: number };
}

// Un osso coperto di pelle: più largo alle articolazioni, sottile e storto nel mezzo
function boneGeo(len: number, r: number, seed: number) {
  const pts: THREE.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const knob = Math.exp(-((t - 0.04) ** 2) / 0.004) * 0.6 + Math.exp(-((t - 0.96) ** 2) / 0.004) * 0.5;
    const rr = r * (0.55 + knob + Math.sin(t * 9 + seed) * 0.06) * (i === 0 || i === n ? 0.2 : 1);
    pts.push(new THREE.Vector2(Math.max(0.004, rr), -t * len));
  }
  const g = new THREE.LatheGeometry(pts, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getX(i), p.getZ(i));
    const k = 1 + Math.sin(a * 3 + y * 17 + seed) * 0.08 + Math.sin(a * 7 - y * 31 + seed * 2) * 0.05;
    p.setX(i, p.getX(i) * k + Math.sin(y * 6 + seed) * 0.008);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
// Arto a due pezzi (spalla-gomito o anca-ginocchio)
function twoPart(parent: THREE.Object3D, x: number, y: number, len1: number, len2: number, r1: number, r2: number, m1: THREE.Material, m2: THREE.Material) {
  const upper = new THREE.Group();
  upper.position.set(x, y, 0);
  const a = new THREE.Mesh(boneGeo(len1, r1, x * 7 + y), m1);
  upper.add(a);
  const lower = new THREE.Group();
  lower.position.y = -len1;
  const b = new THREE.Mesh(boneGeo(len2, r2, x * 3 + y * 5), m2);
  lower.add(b);
  upper.add(lower);
  parent.add(upper);
  return { upper, lower };
}

export function makeCustode(): Custode {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = new THREE.MeshStandardMaterial({ map: mtex('custodePelle', 3), normalMap: ntex('custodePelle', 3), normalScale: new THREE.Vector2(1.6, 1.6), color: '#7d7e70', roughness: 0.3, metalness: 0.05 });
  const cloth = new THREE.MeshStandardMaterial({ map: mtex('custodeTuta', 2), normalMap: ntex('custodeTuta', 2), normalScale: new THREE.Vector2(1.4, 1.4), color: '#5f6355', roughness: 0.5, side: THREE.DoubleSide });
  const rust = new THREE.MeshStandardMaterial({ map: mtex('ruggine', 1), normalMap: ntex('ruggine', 1), roughness: 0.75, metalness: 0.45 });
  const dark = new THREE.MeshBasicMaterial({ color: '#000000' });

  // bacino e tuta (la tuta pende, rigida, strappata)
  const hips = new THREE.Mesh(stiffCloth(0.2, 0.23, 0.42, 2.1), cloth);
  hips.position.y = 1.32;
  body.add(hips);
  // busto scheletrico: costole sotto la pelle, spalle in avanti
  const chest = new THREE.Group();
  chest.position.y = 1.55;
  chest.rotation.x = 0.55;
  body.add(chest);
  const ribs = new THREE.Mesh(boneGeo(0.72, 0.21, 1.7), skin);
  ribs.position.y = 0.7;
  ribs.scale.set(1.15, 1, 0.72);
  ribs.position.y = 0.32;
  chest.add(ribs);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.17 - i * 0.008, 0.012, 6, 20, Math.PI), skin);
    rib.position.set(0, 0.48 - i * 0.07, 0.03);
    rib.rotation.set(0, Math.PI / 2, Math.PI / 2);
    rib.scale.set(1, 1.15, 0.8);
    chest.add(rib);
  }
  // la pettorina della tuta, slacciata, che pende da una spalla
  const bib = new THREE.Mesh(stiffCloth(0.21, 0.19, 0.42, 5.2), cloth);
  bib.position.set(0, 0.08, 0.02);
  chest.add(bib);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.02), cloth);
  strap.position.set(0.11, 0.42, 0.13);
  strap.rotation.z = -0.15;
  chest.add(strap);
  // collo lungo e la testa piegata
  const neck = new THREE.Group();
  neck.position.set(0, 0.68, 0.06);
  chest.add(neck);
  const neckMesh = new THREE.Mesh(boneGeo(0.2, 0.065, 4.2), skin);
  neckMesh.rotation.x = Math.PI;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.03);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 22), skin);
  skull.scale.set(0.95, 1.35, 1.08);
  skull.position.y = 0.05;
  head.add(skull);
  // il volto (texture fatta con Nano Banana) su una calotta davanti al cranio
  const faceTex = texLoader.load('/horror/tex/custodeVolto.webp');
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.repeat.set(0.62, 0.66);
  faceTex.offset.set(0.19, 0.24);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.32, metalness: 0, color: '#c8c6bc' });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.158, 40, 30, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.08, Math.PI * 0.72), faceMat);
  face.scale.set(1.0, 1.36, 1.12);
  face.position.y = 0.05;
  head.add(face);
  // la mascella: si spalanca (dentro solo buio)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.04);
  head.add(jaw);
  const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin);
  jawMesh.scale.set(1, 1.8, 1.2);
  jawMesh.position.set(0, -0.02, 0.03);
  jaw.add(jawMesh);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), dark);
  mouth.scale.set(1, 1.6, 0.6);
  mouth.position.set(0, -0.03, 0.09);
  jaw.add(mouth);
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 5), new THREE.MeshStandardMaterial({ color: '#b9ad8f', roughness: 0.5 }));
    tooth.position.set(-0.04 + i * 0.02, 0.0, 0.135);
    tooth.rotation.x = Math.PI;
    jaw.add(tooth);
  }
  // braccia lunghissime a due pezzi, mani grandi con dita lunghe
  const arms = [-1, 1].map((side) => {
    const a = twoPart(chest, side * 0.25, 0.62, 0.66, 0.72, 0.045, 0.038, skin, skin);
    const hand = new THREE.Group();
    hand.position.y = -0.72;
    a.lower.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.035), skin);
    palm.position.y = -0.06;
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const f1 = new THREE.Mesh(boneGeo(0.22, 0.012, i * 2.3 + side), skin);
      f1.position.set(-0.03 + i * 0.02, -0.11, 0.005);
      f1.rotation.set(0.35 + i * 0.05, 0, (i - 1.5) * 0.06);
      hand.add(f1);
    }
    const thumb = new THREE.Mesh(boneGeo(0.12, 0.013, side * 5), skin);
    thumb.position.set(side * -0.045, -0.06, 0.02);
    thumb.rotation.set(0.6, 0, side * 0.5);
    hand.add(thumb);
    // un pezzo di manica strappata sul braccio
    const sleeve = new THREE.Mesh(stiffCloth(0.07, 0.065, 0.3, side * 3.1), cloth);
    sleeve.position.y = -0.15;
    a.upper.add(sleeve);
    return { ...a, hand };
  });
  // gambe magre, ginocchia leggermente piegate
  const legs = [-1, 1].map((side) => {
    const l = twoPart(body, side * 0.11, 1.3, 0.66, 0.66, 0.07, 0.055, cloth, skin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), skin);
    foot.position.set(0, -0.68, 0.08);
    l.lower.add(foot);
    return l;
  });
  // la chiave inglese arrugginita (lunga quasi un metro), trascinata
  const wrench = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.05, 10), rust);
  shaft.position.y = -0.55;
  const jawW = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.08), rust);
  jawW.position.set(0.04, -1.1, 0);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.08), rust);
  hook.position.set(0.09, -1.2, 0);
  wrench.add(shaft, jawW, hook);
  wrench.position.y = -0.12;
  arms[1].hand.add(wrench);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  root.visible = false;
  return {
    root,
    body,
    neck,
    head,
    jaw,
    armL: arms[0].upper,
    armR: arms[1].upper,
    foreL: arms[0].lower,
    foreR: arms[1].lower,
    legL: legs[0].upper,
    legR: legs[1].upper,
    shinL: legs[0].lower,
    shinR: legs[1].lower,
    wrench,
    phase: 0,
    twitchAt: 0,
    twitch: { head: new THREE.Euler(), arm: 0, neck: 0 },
  };
}

// a: 0 fermo, 1 cammina, 2 insegue, 3 bussa, 4 alza il braccio, 5 colpisce, 9 nascosto
export function animateCustode(c: Custode, a: number, speed: number, t: number, dt: number) {
  const k = Math.min(1, dt * 9);
  const ease = (g: THREE.Object3D, x: number, z = 0, y = 0) => {
    g.rotation.x += (x - g.rotation.x) * k;
    g.rotation.z += (z - g.rotation.z) * k;
    g.rotation.y += (y - g.rotation.y) * k;
  };
  const moving = speed > 0.2;
  const chase = a === 2;
  c.phase += dt * (moving ? (chase ? 4.6 : 2.0) : 0.5);
  const s = Math.sin(c.phase * 2);
  // scatti: ogni tanto una posa nuova senza transizione (come fotogrammi saltati)
  if (t > c.twitchAt) {
    c.twitchAt = t + (chase ? 0.06 + Math.random() * 0.2 : 0.15 + Math.random() * 0.9);
    c.twitch.head.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9 + 0.35);
    c.twitch.arm = (Math.random() - 0.5) * 0.4;
    c.twitch.neck = (Math.random() - 0.5) * 0.3;
  }
  // spalle curve, ma la testa si alza a guardarti
  c.head.rotation.copy(c.twitch.head);
  c.head.rotation.x -= 0.3;
  c.neck.rotation.x = -0.35 + c.twitch.neck;
  // la mascella: socchiusa, spalancata quando insegue o colpisce
  const jawOpen = a === 4 || a === 5 ? 1.0 : chase ? 0.55 + Math.sin(t * 17) * 0.15 : 0.12 + Math.max(0, Math.sin(t * 0.8)) * 0.1;
  c.jaw.rotation.x += (jawOpen - c.jaw.rotation.x) * Math.min(1, dt * 14);
  if (a === 3) {
    // bussa: il pugno sinistro contro la porta, a colpi secchi
    ease(c.armL, -1.7 + (Math.sin(t * 6.3) > 0.6 ? 0.45 : 0), 0.1);
    ease(c.foreL, -0.4);
    ease(c.armR, 0.1 + c.twitch.arm);
    ease(c.legL, 0);
    ease(c.legR, 0);
  } else if (a === 4 || a === 5) {
    // il gesto prima del colpo: la chiave in alto (leggibile), poi giù
    ease(c.armR, a === 4 ? -3.0 : -0.6, 0.15);
    ease(c.foreR, a === 4 ? -0.5 : 0);
    ease(c.armL, a === 4 ? -1.4 : -0.5, -0.3);
    ease(c.foreL, -0.6);
  } else {
    const amp = moving ? (chase ? 0.85 : 0.4) : 0;
    ease(c.legL, s * amp - 0.12);
    ease(c.legR, -s * amp - 0.12);
    ease(c.shinL, Math.max(0, -s) * amp * 0.9 + 0.2);
    ease(c.shinR, Math.max(0, s) * amp * 0.9 + 0.2);
    // le braccia pendono quasi immobili: è questo che è sbagliato. Quando insegue si allungano in avanti
    ease(c.armL, chase ? -1.1 + s * 0.2 : 0.08 + c.twitch.arm * 0.4, -0.05);
    ease(c.foreL, chase ? -0.3 : -0.1);
    ease(c.armR, chase ? -0.5 : 0.18, 0.05);
    ease(c.foreR, -0.05);
  }
  // la chiave resta puntata verso il pavimento (striscia)
  c.wrench.rotation.x = -c.armR.rotation.x - c.foreR.rotation.x + (moving ? 0.55 : 0.3);
  c.body.rotation.x += ((chase ? 0.38 : 0.12) - c.body.rotation.x) * k;
  c.body.position.y = moving ? Math.abs(Math.cos(c.phase * 2)) * 0.05 : Math.sin(t * 1.3) * 0.01;
}

// Il jumpscare: la testa e il busto del Custode che si lanciano contro lo schermo
export interface Jumpscare {
  root: THREE.Group;
  c: Custode;
  start: number;
}
export function makeJumpscare(): Jumpscare {
  const c = makeCustode();
  c.root.visible = false;
  // una luce fredda dal basso sul volto (la torcia in quel momento quasi si spegne)
  const key = new THREE.PointLight('#bcd6ff', 3.2, 2.6, 1.6);
  key.position.set(0.25, 2.0, 0.9);
  const rim = new THREE.PointLight('#ff5a3a', 1.6, 2.4, 1.6);
  rim.position.set(-0.5, 2.6, 0.3);
  c.root.add(key, rim);
  c.root.traverse((o) => {
    o.renderOrder = 30;
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) m.depthTest = true;
  });
  return { root: c.root, c, start: -1 };
}
// k = secondi da quando è iniziato
export function animateJumpscare(j: Jumpscare, k: number, t: number) {
  const c = j.c;
  if (k < 0 || k > 1.35) {
    c.root.visible = false;
    return false;
  }
  c.root.visible = true;
  // parte da poco lontano e in un lampo è addosso, scuotendosi
  // il volto si ferma a mezzo metro e riempie lo schermo
  const lunge = Math.min(1, k / 0.16);
  const z = -2.7 + lunge * 1.75;
  c.root.position.set((Math.random() - 0.5) * 0.03 * lunge, -2.33 + (1 - lunge) * 0.25 + Math.sin(t * 50) * 0.008, z);
  c.root.rotation.set(0, 0, (Math.random() - 0.5) * 0.06);
  c.body.rotation.x = 0.1;
  c.neck.rotation.x = -0.5;
  c.head.rotation.set(-0.25 + (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.25);
  c.jaw.rotation.x = 1.0 + Math.sin(t * 40) * 0.12;
  // le mani arrivano dai lati (non coprono il volto)
  c.armL.rotation.set(-1.1, 0, -1.0);
  c.armR.rotation.set(-1.1, 0, 1.0);
  c.foreL.rotation.x = -0.9;
  c.foreR.rotation.x = -0.9;
  return true;
}

// ---------------------------------------------------------------- il Custode vero (modello 3D fatto con Tripo)

// Modello con scheletro Mixamo e 5 animazioni (camminata, balzo, posa a scatti, due modi di strisciare).
// Sopra le animazioni il codice aggiunge scatti alla testa, al collo e alle dita: sembra che salti dei fotogrammi.
export interface Monster {
  root: THREE.Group;
  animate: (a: number, speed: number, t: number, dt: number) => void;
  setLunge?: (k: number) => void; // jumpscare: a che punto è il balzo
  setLean?: (k: number) => void; // da vicino si china sulla vittima (0..1)
}
let monsterGltf: Promise<GLTF | null> | null = null;
export function loadMonsterModel() {
  monsterGltf ??= new GLTFLoader()
    .loadAsync('/horror/models/custode.glb')
    .then((g) => g)
    .catch(() => null);
  return monsterGltf;
}
const CLIP = { walk: /^walk/i, lunge: /lunge/i, idle: /creepy/i, crabwalk: /crab|belly/i, crawl: /hands and feet|crawling forward/i };
export function makeMonster(gltf: GLTF, height = 2.45): Monster {
  const model = cloneSkinned(gltf.scene) as THREE.Group;
  // altezza giusta e piedi a terra
  const box = new THREE.Box3().setFromObject(model);
  const k = height / Math.max(0.01, box.max.y - box.min.y);
  model.scale.setScalar(k);
  model.position.y = -box.min.y * k;
  const root = new THREE.Group();
  root.add(model);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      // pelle bagnata: un po' più lucida e scura
      mat.roughness = Math.min(mat.roughness ?? 1, 0.7);
      mat.envMapIntensity = 0.6;
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const find = (re: RegExp) => gltf.animations.find((c) => re.test(c.name));
  const actions: Record<string, THREE.AnimationAction | null> = {};
  for (const [key, re] of Object.entries(CLIP)) {
    const clip = find(re);
    actions[key] = clip ? mixer.clipAction(clip) : null;
  }
  if (actions.lunge) {
    actions.lunge.setLoop(THREE.LoopOnce, 1);
    actions.lunge.clampWhenFinished = true;
  }
  const bone = (name: string) => model.getObjectByName(`mixamorig${name}`) ?? model.getObjectByName(`mixamorig:${name}`) ?? null;
  const head = bone('Head');
  const neck = bone('Neck');
  const fingers = ['LeftHandIndex1', 'LeftHandMiddle1', 'RightHandIndex1', 'RightHandMiddle1', 'LeftHandRing1', 'RightHandRing1'].map(bone).filter(Boolean) as THREE.Object3D[];
  const armL = bone('LeftForeArm');
  const armR = bone('RightForeArm');
  const spine = ['Spine', 'Spine1', 'Spine2'].map(bone).filter(Boolean) as THREE.Object3D[];
  let lean = 0;
  let leanTo = 0;
  let current = '';
  let twitchAt = 0;
  const twitch = { head: new THREE.Euler(), neck: 0, arm: 0, finger: 0 };
  const play = (key: string, fade = 0.25, speed = 1) => {
    const act = actions[key] ?? actions.walk ?? actions.idle;
    if (!act) return;
    act.timeScale = speed;
    if (current === key) return;
    const prev = current ? actions[current] : null;
    act.reset().setEffectiveWeight(1).fadeIn(fade).play();
    prev?.fadeOut(fade);
    current = key;
  };
  const monster: Monster = {
    root,
    // a: 0 fermo, 1 cammina, 2 insegue, 3 bussa, 4 alza il braccio, 5 colpisce
    animate: (a, speed, t, dt) => {
      if (a === 2) play(speed > 0.3 ? 'crawl' : 'idle', 0.15, Math.max(0.9, Math.min(2.2, speed / 1.9)));
      else if (a === 4 || a === 5) play('lunge', 0.08, 1.6);
      else if (a === 1 && speed > 0.2) play('walk', 0.3, Math.max(0.55, Math.min(1.3, speed / 1.4)) * 0.85);
      else play('idle', 0.4, 1);
      mixer.update(dt);
      // scatti: ogni tanto una posa nuova senza transizione (come fotogrammi saltati)
      if (t > twitchAt) {
        const fast = a === 2 || a === 4;
        twitchAt = t + (fast ? 0.05 + Math.random() * 0.18 : 0.2 + Math.random() * 1.1);
        twitch.head.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * (Math.random() < 0.15 ? 1.6 : 0.6));
        twitch.neck = (Math.random() - 0.5) * 0.4;
        twitch.arm = (Math.random() - 0.5) * 0.5;
        twitch.finger = Math.random() * 0.7;
      }
      if (head) {
        head.rotation.x += twitch.head.x;
        head.rotation.y += twitch.head.y;
        head.rotation.z += twitch.head.z;
      }
      if (neck) neck.rotation.z += twitch.neck;
      if (armL) armL.rotation.z += twitch.arm * 0.6;
      if (armR) armR.rotation.z -= twitch.arm * 0.6;
      for (const f of fingers) f.rotation.z += twitch.finger * (Math.random() < 0.5 ? 1 : -1) * 0.5;
      // da vicino: si piega in avanti e porta la faccia all'altezza degli occhi, il collo tirato su a guardarti
      lean += (leanTo - lean) * Math.min(1, dt * 5);
      if (lean > 0.01) {
        for (const b of spine) b.rotation.x += lean * 0.38;
        if (neck) neck.rotation.x -= lean * 0.3;
        if (head) head.rotation.x -= lean * 0.35;
      }
    },
    setLean: (kk) => {
      leanTo = Math.max(0, Math.min(1, kk));
    },
    setLunge: (kk) => {
      play('lunge', 0.02, 1);
      const act = actions.lunge;
      if (act) act.time = Math.min(act.getClip().duration * 0.999, 0.6 + kk * 1.8);
    },
  };
  return monster;
}
