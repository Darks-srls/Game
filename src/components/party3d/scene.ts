// 🎨 Grafica 3D di Axend Party (Three.js), stile Fall Guys / Roblox:
// plastica lucida con riflessi, contorni cartoon, bagliore sulle luci, arene piene di decorazioni, polvere e coriandoli.
// La qualità si adatta da sola: se il telefono fatica si spengono gli effetti più pesanti.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import {
  ANIM,
  BRIDGE,
  CHAIRS,
  CRATES,
  DENTE,
  DOOR,
  DOOR_ROWS,
  FRUIT,
  FRUITS,
  FRUIT_NAMES,
  HAMMER,
  HAMMERS,
  HEX_N,
  HEX_TILES,
  MARKET,
  PITCH,
  PLAT,
  PLATS,
  PLAZA,
  POST_R,
  RACE,
  RACE_CP,
  RED,
  SLOPE,
  SWEEPERS,
  TEAM_COLORS,
  TEAM_NAMES,
  WAFER,
  bridgeRowZ,
  SLOPE_POSTS,
  SNIPER,
  SNIPER_BOXES,
  SUMO,
  TABLE,
  YARD,
  ballPos,
  doorX,
  fruitTile,
  hammerHead,
  marketRadius,
  platX,
  slopeHeight,
  sniperEye,
  spoonAngle,
  sweepAngle,
  waferY,
  type MiniKind,
} from '../../data/party3d';
import type { PartyView } from '../../types/game';
import type { NetPos } from '../../data/party3d';
import { CLIENT_MINIS, type MiniFrame, type OtherPos } from './minis/types';
import type { Body } from '../../data/party3d';

// ---------------------------------------------------------------- materiali

// plastica lucida (personaggi, oggetti)
export const toy = (color: THREE.ColorRepresentation, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3, ...extra });
// opaco (pavimenti, muri)
export const matte = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
export const glow = (color: THREE.ColorRepresentation, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
export const rbox = (w: number, h: number, d: number, r = 0.08) => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#1d0f3d', side: THREE.BackSide });

export function shade(hex: string, k: number) {
  return new THREE.Color(hex).multiplyScalar(k);
}

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export const shadowy = <T extends THREE.Object3D>(o: T, cast = true, receive = true) => {
  o.traverse((x) => {
    if ((x as THREE.Mesh).isMesh && (x as THREE.Mesh).material !== OUTLINE) {
      x.castShadow = cast;
      x.receiveShadow = receive;
    }
  });
  return o;
};

// contorno cartoon: una copia leggermente più grande, girata al rovescio e scura
export function outlined(mesh: THREE.Mesh, k = 1.06) {
  const o = new THREE.Mesh(mesh.geometry, OUTLINE);
  o.scale.setScalar(k);
  mesh.add(o);
  return mesh;
}

// ---------------------------------------------------------------- mondo

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  arena: THREE.Group;
  fx: THREE.Group;
  clouds: THREE.Group;
  pickables: THREE.Object3D[]; // per la mira dei cecchini
  camBlockers: THREE.Object3D[]; // muri e decorazioni grandi: la telecamera non ci passa dietro (minigiochi a moduli)
  update: (t: number, dt: number, info: ArenaInfo) => void;
  render: (dt: number) => void;
  setSize: (w: number, h: number) => void;
  setQuality: (q: 'auto' | 'alta' | 'bassa') => void;
  dispose: () => void;
}

export interface ArenaInfo {
  playT: number; // secondi dall'inizio del minigioco
  light: 'GREEN' | 'TURN' | 'RED' | null;
  chairs: { x: number; z: number; by: string | null }[];
  music: boolean;
  now: number; // ora del server (ms)
  balls: { id: number; x: number; t0: number; v: number }[];
  slams: { id: number; x: number; z: number; at: number }[];
  broken: string[];
  dente: PartyView['dente'];
  hex: string;
  fruit: PartyView['fruit'];
  score: [number, number] | null;
  doors: string[];
  me: { x: number; y: number; z: number };
  // minigiochi a moduli
  view?: PartyView;
  myId?: string;
  body?: Body;
  latest?: Map<string, NetPos>;
  others?: Map<string, OtherPos>;
  act?: (type: string, payload?: unknown) => void;
}

export function createWorld(canvas: HTMLCanvasElement, lowPower: boolean): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let ratio = Math.min(window.devicePixelRatio || 1, lowPower ? 1.6 : 2);
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const horizon = new THREE.Color('#ffd3ee');
  scene.fog = new THREE.Fog(horizon, 90, 260);
  // riflessi morbidi sulla plastica (una "stanza" luminosa finta)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.22;

  // cielo sfumato con il sole
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#2f8fff') },
        mid: { value: new THREE.Color('#8fd3ff') },
        bottom: { value: horizon },
        sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.7).normalize() },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(vP, sunDir), 0.0); c += vec3(1.0, 0.92, 0.7) * (pow(s, 600.0) * 0.9 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight('#dff1ff', '#ffc7ea', 1.0));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.3);
  sun.position.set(20, 34, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  // luce fredda da dietro: bordi luminosi sui personaggi
  const rim = new THREE.DirectionalLight('#b8d8ff', 1.1);
  rim.position.set(-15, 12, -30);
  scene.add(rim);

  // nuvole morbide
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.22 });
  const puff = new THREE.IcosahedronGeometry(1, 3);
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Group();
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(puff, cloudMat);
      const r = 3 + Math.random() * 3.5;
      s.scale.set(r, r * 0.75, r);
      s.position.set(k * 3.6 - n * 1.8, Math.random() * 1.8, Math.random() * 2.5);
      c.add(s);
    }
    const a = (i / 22) * Math.PI * 2;
    const r = 110 + Math.random() * 90;
    c.position.set(Math.sin(a) * r, -25 + Math.random() * 70, Math.cos(a) * r);
    c.lookAt(0, c.position.y, 0);
    clouds.add(c);
  }
  scene.add(clouds);
  scene.add(backdrop());

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  const arena = new THREE.Group();
  const fx = new THREE.Group();
  scene.add(arena, fx);

  // effetti di schermo: bagliore e vignetta (si spengono se il telefono fatica)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 1.6) // soglia alta (HDR): brillano solo neon e lampadine;
  composer.addPass(bloom);
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = 1.05;
  vignette.uniforms.darkness.value = 1.05;
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  let fancy = true;
  let mode: 'auto' | 'alta' | 'bassa' = 'auto';
  const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
  let slow = 0;
  let frames = 0;
  let w0 = 1;
  let h0 = 1;

  const world: World = {
    renderer,
    scene,
    camera,
    sun,
    arena,
    fx,
    clouds,
    pickables: [],
    camBlockers: [],
    update: () => {},
    setSize: (w, h) => {
      w0 = w;
      h0 = h;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
    },
    setQuality: (q) => {
      mode = q;
      fancy = q !== 'bassa';
      ratio = q === 'bassa' ? 1 : q === 'alta' ? maxRatio : Math.min(maxRatio, lowPower ? 1.6 : 2);
      renderer.setPixelRatio(ratio);
      renderer.shadowMap.type = q === 'bassa' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      slow = 0;
      frames = 0;
      world.setSize(w0, h0);
    },
    render: (dt) => {
      // qualità automatica: dopo i primi secondi, se si va sotto i ~40 fps si alleggerisce
      frames++;
      // (prima si abbassa solo la risoluzione, e solo se si scende davvero sotto i ~28 fps:
      //  un iPhone in risparmio energetico va a 30 fps fissi e non deve perdere gli effetti)
      if (frames > 90 && fancy && mode === 'auto') {
        slow = slow * 0.95 + (dt > 0.036 ? 1 : 0) * 0.05;
        if (slow > 0.6) {
          slow = 0;
          frames = 0;
          if (ratio > 1.35) ratio = Math.max(1.2, ratio - 0.3);
          else {
            fancy = false;
            ratio = Math.min(ratio, 1.2);
            renderer.shadowMap.type = THREE.PCFShadowMap;
          }
          renderer.setPixelRatio(ratio);
          world.setSize(w0, h0);
        }
      }
      if (fancy) composer.render(dt);
      else renderer.render(scene, camera);
    },
    dispose: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mm of mats) {
          (mm as THREE.MeshStandardMaterial).map?.dispose();
          mm.dispose();
        }
      });
      env.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
  return world;
}

// Sfondo: isolette volanti con alberelli e un arcobaleno lontano
function backdrop() {
  const g = new THREE.Group();
  const grass = matte('#7bd389');
  const dirt = matte('#c08457');
  const leaves = [toy('#52b788'), toy('#95d5b2'), toy('#ffafcc')];
  for (let i = 0; i < 9; i++) {
    const isl = new THREE.Group();
    const s = 4 + Math.random() * 5;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.95, 1.2, 7), grass);
    const under = new THREE.Mesh(new THREE.ConeGeometry(s * 0.95, s * 1.6, 7), dirt);
    under.rotation.x = Math.PI;
    under.position.y = -s * 0.8 - 0.6;
    isl.add(top, under);
    for (let k = 0; k < 3; k++) {
      const tr = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), dirt);
      trunk.position.y = 1.4;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), leaves[(i + k) % 3]);
      crown.position.y = 3;
      tr.add(trunk, crown);
      tr.position.set((Math.random() - 0.5) * s, 0, (Math.random() - 0.5) * s);
      isl.add(tr);
    }
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const r = 75 + Math.random() * 40;
    isl.position.set(Math.sin(a) * r, -8 + Math.random() * 22, Math.cos(a) * r);
    isl.userData.bob = Math.random() * 6;
    g.add(isl);
  }
  // arcobaleno
  const colors = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
  colors.forEach((c, i) => {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(60 - i * 2.2, 1.1, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false }));
    arc.position.set(-40, -12, 170);
    arc.rotation.y = 0.5;
    g.add(arc);
  });
  return g;
}

export function clearGroup(g: THREE.Group) {
  for (const c of [...g.children]) {
    g.remove(c);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.material !== OUTLINE) m.geometry.dispose?.();
    });
  }
}

// ---------------------------------------------------------------- pezzi decorativi

export function balloon(color: string) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), toy(color));
  b.scale.y = 1.2;
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.25, 8), toy(color));
  knot.position.y = -1.1;
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3), matte('#ffffff'));
  str.position.y = -2.6;
  g.add(b, knot, str);
  g.userData.phase = Math.random() * 6;
  return g;
}

export function flagLine(from: THREE.Vector3, to: THREE.Vector3, n = 14) {
  const g = new THREE.Group();
  const cols = ['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff70a6', '#fb5607'];
  const geo = new THREE.ConeGeometry(0.35, 0.7, 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * 1.2;
    const f = new THREE.Mesh(geo, toy(cols[i % cols.length]));
    f.position.copy(p);
    f.rotation.x = Math.PI;
    g.add(f);
  }
  return g;
}

// arco del traguardo con lo striscione a scacchi
export function finishArch(width: number, z: number) {
  const g = new THREE.Group();
  const pillar = toy('#ff4d6d');
  for (const x of [-width / 2, width / 2]) {
    const p = outlined(new THREE.Mesh(rbox(1, 7, 1, 0.3), pillar));
    p.position.set(x, 3.5, 0);
    g.add(p);
  }
  const check = canvasTex(512, 64, (c) => {
    for (let i = 0; i < 32; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
        c.fillRect(i * 16, j * 16, 16, 16);
      }
  });
  const banner = new THREE.Mesh(rbox(width + 1, 1.4, 0.4, 0.15), [toy('#ffffff', { map: check }), toy('#ffffff', { map: check }), toy('#ffd60a'), toy('#ffd60a'), toy('#ffffff', { map: check }), toy('#ffffff', { map: check })]);
  banner.position.y = 7;
  g.add(outlined(banner, 1.03));
  for (const x of [-width / 2, width / 2]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), glow('#fff3b0', 3));
    bulb.position.set(x, 7.4, 0);
    g.add(bulb);
  }
  g.position.z = z;
  return shadowy(g);
}

// guardia stile telefilm (tuta rosa, maschera con il simbolo)
function guard(symbol: 'o' | 'tri' | 'sq') {
  const g = new THREE.Group();
  const suit = toy('#ff3d7f');
  const body = new THREE.Mesh(rbox(0.9, 1.3, 0.55, 0.2), suit);
  body.position.y = 1.4;
  const head = new THREE.Mesh(rbox(0.85, 0.85, 0.85, 0.3), suit);
  head.position.y = 2.5;
  const mask = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), toy('#111111'));
  mask.position.set(0, 2.5, -0.43);
  mask.rotation.y = Math.PI;
  const sym = new THREE.Mesh(
    symbol === 'o' ? new THREE.RingGeometry(0.1, 0.16, 24) : symbol === 'tri' ? new THREE.RingGeometry(0.1, 0.17, 3) : new THREE.RingGeometry(0.1, 0.17, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }),
  );
  sym.position.set(0, 2.5, -0.44);
  for (const x of [-0.25, 0.25]) {
    const leg = new THREE.Mesh(rbox(0.36, 0.8, 0.4, 0.12), suit);
    leg.position.set(x, 0.4, 0);
    g.add(leg);
  }
  g.add(body, head, mask, sym);
  return shadowy(g);
}

// ---------------------------------------------------------------- arene

export function buildArena(world: World, kind: MiniKind) {
  const g = world.arena;
  clearGroup(g);
  world.pickables = [];
  world.camBlockers = [];
  const ext = CLIENT_MINIS[kind as keyof typeof CLIENT_MINIS];
  if (ext) {
    // minigioco a moduli: costruisce tutto lui
    const sh0 = world.sun.shadow.camera;
    sh0.left = sh0.bottom = -18;
    sh0.right = sh0.top = 18;
    world.sun.target.position.set(0, 0, 0);
    world.sun.position.copy(world.sun.target.position).add(new THREE.Vector3(20, 34, 26));
    const frameFn = ext.build(world);
    sh0.updateProjectionMatrix();
    world.update = (t, dt, info) => {
      if (!info.view || !info.body) return;
      const f: MiniFrame = {
        t,
        dt,
        playT: info.playT,
        now: info.now,
        view: info.view,
        ext: info.view.ext,
        myId: info.myId ?? '',
        me: info.body,
        latest: info.latest ?? new Map(),
        others: info.others ?? new Map(),
        act: info.act ?? (() => {}),
      };
      frameFn(f);
    };
    return;
  }
  let update: World['update'] = () => {};
  const sh = world.sun.shadow.camera;
  const balloons: THREE.Group[] = [];
  const addBalloons = (n: number, place: (i: number) => THREE.Vector3) => {
    const cols = ['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff70a6', '#8338ec'];
    for (let i = 0; i < n; i++) {
      const b = balloon(cols[i % cols.length]);
      b.position.copy(place(i));
      b.userData.y0 = b.position.y;
      g.add(b);
      balloons.push(b);
    }
  };

  if (kind === 'SUMO') {
    const top = canvasTex(1024, 1024, (c) => {
      const cols = ['#ffd166', '#ff7aa2'];
      for (let i = 0; i < 16; i++) {
        c.fillStyle = cols[i % 2];
        c.beginPath();
        c.moveTo(512, 512);
        c.arc(512, 512, 520, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2);
        c.fill();
      }
      for (let r = 470; r > 120; r -= 120) {
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 10;
        c.beginPath();
        c.arc(512, 512, r, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(512, 512, 105, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8338ec';
      c.font = 'bold 66px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('AXEND', 512, 516);
    });
    const island = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(SUMO.r0, SUMO.r0, 0.9, 96), [toy('#8338ec'), toy('#ffffff', { map: top, clearcoat: 0.5 }), toy('#5a189a')]);
    disc.position.y = -0.45;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(SUMO.r0, 0.3, 16, 128), toy('#ffffff'));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.05;
    const neon = new THREE.Mesh(new THREE.TorusGeometry(SUMO.r0 + 0.02, 0.1, 8, 128), glow('#ff2e88', 2.5));
    neon.rotation.x = Math.PI / 2;
    neon.position.y = -0.55;
    const under = new THREE.Mesh(new THREE.CylinderGeometry(SUMO.r0 * 0.98, SUMO.r0 * 0.25, 7, 64), toy('#c77dff'));
    under.position.y = -4.4;
    island.add(disc, lip, neon, under);
    shadowy(island, true, true);
    g.add(island);
    // mare di slime che ondeggia
    const seaGeo = new THREE.PlaneGeometry(320, 320, 64, 64);
    const sea = new THREE.Mesh(seaGeo, toy('#ff5fa2', { roughness: 0.15, clearcoat: 1, emissive: '#ff2e88', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -15;
    g.add(sea);
    const base = seaGeo.attributes.position.array.slice() as Float32Array;
    // bolle
    const bubbles = new THREE.Group();
    const bubMat = toy('#ffc2e2', { transparent: true, opacity: 0.85 });
    for (let i = 0; i < 30; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.7, 16, 12), bubMat);
      b.position.set((Math.random() - 0.5) * 80, -15 + Math.random() * 7, (Math.random() - 0.5) * 80);
      b.userData.v = 0.6 + Math.random();
      bubbles.add(b);
    }
    g.add(bubbles);
    // pali di caramella e bandierine tutto intorno (sotto il bordo, decorativi)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 16), toy(i % 2 ? '#ffffff' : '#ff4d6d'));
      pole.position.set(Math.sin(a) * (SUMO.r0 + 9), -9, Math.cos(a) * (SUMO.r0 + 9));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), glow(['#ffd60a', '#3a86ff', '#06d6a0', '#ff70a6'][i % 4], 1.2));
      ball.position.set(pole.position.x, -2.5, pole.position.z);
      g.add(pole, ball);
    }
    addBalloons(10, (i) => {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      return new THREE.Vector3(Math.sin(a) * (SUMO.r0 + 12), 4 + (i % 3) * 3, Math.cos(a) * (SUMO.r0 + 12));
    });
    sh.left = sh.bottom = -16;
    sh.right = sh.top = 16;
    world.sun.target.position.set(0, 0, 0);
    update = (t, dt, info) => {
      const r = Math.max(SUMO.rMin, info.playT < SUMO.shrinkFrom ? SUMO.r0 : SUMO.r0 - (info.playT - SUMO.shrinkFrom) * SUMO.rate) / SUMO.r0;
      island.scale.set(r, 1, r);
      (neon.material as THREE.MeshStandardMaterial).emissiveIntensity = info.playT > SUMO.shrinkFrom - 2 ? 2.5 + Math.sin(t * 9) * 1.5 : 1.5;
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = base[i + 2] + Math.sin(base[i] * 0.08 + t * 1.6) * 0.6 + Math.cos(base[i + 1] * 0.09 + t * 1.2) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
      for (const b of bubbles.children) {
        b.position.y += b.userData.v * dt;
        if (b.position.y > -8) b.position.y = -15.5;
      }
    };
  } else if (kind === 'REDLIGHT') {
    const len = RED.front - RED.back + 14;
    const zc = (RED.front + RED.back) / 2;
    const sand = canvasTex(256, 256, (c) => {
      c.fillStyle = '#f4d7a1';
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 700; i++) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(205,150,90,0.16)' : 'rgba(255,255,255,0.22)';
        c.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
      }
    }, [6, 14]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RED.halfW * 2 + 2, len), matte('#e2c493', { map: sand }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = zc;
    floor.receiveShadow = true;
    g.add(floor);
    // corsie
    for (let x = -RED.halfW + 4; x < RED.halfW; x += 4) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.12, RED.finish - RED.start), matte('#ffffff', { transparent: true, opacity: 0.5 }));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(x, 0.01, (RED.finish + RED.start) / 2);
      g.add(lane);
    }
    const mural = canvasTex(1024, 256, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#4cb2ff');
      gr.addColorStop(1, '#c9ecff');
      c.fillStyle = gr;
      c.fillRect(0, 0, 1024, 256);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) {
        const x = i * 120 + 30;
        const y = 60 + (i % 3) * 40;
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x + k * 18, y - (k % 2) * 10, 22, 0, Math.PI * 2);
          c.fill();
        }
      }
    }, [3, 1]);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(rbox(1, 9, len, 0.35), [toy('#ff8fab'), toy('#ff8fab'), toy('#ffb3c6'), toy('#ff8fab'), matte('#ffffff', { map: mural }), matte('#ffffff', { map: mural })]);
      wall.position.set(side * (RED.halfW + 0.5), 4.5, zc);
      g.add(shadowy(wall));
      // guardie in cima ai muri
      for (let i = 0; i < 3; i++) {
        const gd = guard((['o', 'tri', 'sq'] as const)[i]);
        gd.position.set(side * (RED.halfW + 0.5), 9, RED.start + 14 + i * 16);
        gd.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(gd);
      }
    }
    const line = (z: number, color: string, e = 0.3) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RED.halfW * 2, 0.7), glow(color, e));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.02, z);
      g.add(m);
    };
    line(RED.start + 1.5, '#ffffff', 0.15);
    line(RED.finish, '#ff2e4d', 1.2);
    g.add(finishArch(RED.halfW * 2 - 1, RED.finish));
    g.add(flagLine(new THREE.Vector3(-RED.halfW, 9.5, RED.start + 4), new THREE.Vector3(RED.halfW, 9.5, RED.start + 4)));
    g.add(flagLine(new THREE.Vector3(-RED.halfW, 9.5, 6), new THREE.Vector3(RED.halfW, 9.5, 6)));
    // la bambola gigante
    const doll = new THREE.Group();
    const dress = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.3, 4.2, 40), toy('#ff9f1c')), 1.04);
    dress.position.y = 2.1;
    const shirt = outlined(new THREE.Mesh(rbox(2.4, 1.6, 1.6, 0.45), toy('#ffd60a')), 1.04);
    shirt.position.y = 4.9;
    const head = new THREE.Group();
    head.position.y = 6.6;
    const skull = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.25, 40, 28), toy('#ffe0bd')), 1.04);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.33, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.55), toy('#1b1b1b'));
    hair.rotation.x = 0.35;
    const tailL = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), toy('#1b1b1b'));
    tailL.position.set(-1.2, 0.2, 0.5);
    const tailR = tailL.clone();
    tailR.position.x = 1.2;
    const eyeMat = toy('#111111', { emissive: '#000000' });
    for (const x of [-0.42, 0.42]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), eyeMat);
      e.position.set(x, 0.1, -1.15);
      head.add(e);
    }
    for (const x of [-0.7, 0.7]) {
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), toy('#ff8fab'));
      ch.position.set(x, -0.25, -0.95);
      head.add(ch);
    }
    head.add(skull, hair, tailL, tailR);
    for (const x of [-1.5, 1.5]) {
      const arm = new THREE.Mesh(rbox(0.5, 2.4, 0.5, 0.2), toy('#ffe0bd'));
      arm.position.set(x, 4.4, 0);
      arm.rotation.z = x > 0 ? 0.2 : -0.2;
      doll.add(arm);
    }
    doll.add(dress, shirt, head);
    doll.position.set(0, 0, RED.dollZ);
    doll.scale.setScalar(1.6);
    shadowy(doll);
    g.add(doll);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 12), toy('#8d5a3b'));
    trunk.position.set(0, 3.5, RED.dollZ + 4);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), toy('#52b788', { flatShading: true }));
    crown.position.set(0, 8.5, RED.dollZ + 4);
    g.add(shadowy(trunk), shadowy(crown));
    const alarm = new THREE.PointLight('#ff2e4d', 0, 50);
    alarm.position.set(0, 10, RED.dollZ - 3);
    g.add(alarm);
    addBalloons(8, (i) => new THREE.Vector3((i % 2 ? 1 : -1) * (RED.halfW + 3), 10 + (i % 3) * 2, RED.start + 6 + i * 7));
    sh.left = -18;
    sh.right = 18;
    sh.top = 42;
    sh.bottom = -42;
    world.sun.target.position.set(0, 0, zc);
    let headRot = Math.PI;
    update = (t, dt, info) => {
      const want = info.light === 'GREEN' || !info.light ? Math.PI : 0; // π = di spalle, 0 = guarda i giocatori
      headRot += (want - headRot) * Math.min(1, dt * (info.light === 'TURN' ? 3.2 : 6));
      head.rotation.y = headRot;
      alarm.intensity = info.light === 'RED' ? 60 + Math.sin(t * 10) * 25 : 0;
      eyeMat.emissive.set(info.light === 'RED' ? '#ff0000' : '#000000');
      eyeMat.emissiveIntensity = info.light === 'RED' ? 4 : 0;
    };
  } else if (kind === 'CHAIRS') {
    const tiles = canvasTex(512, 512, (c) => {
      const cols = ['#ff70a6', '#70d6ff', '#ffd670', '#e9ff70', '#ff9770', '#c77dff'];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          c.fillStyle = cols[(x * 3 + y * 5) % cols.length];
          c.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(x * 64 + 6, y * 64 + 6, 52, 10);
        }
    }, [3, 3]);
    const floorMat = toy('#ffffff', { map: tiles, roughness: 0.2, clearcoat: 1, emissive: '#ffffff', emissiveMap: tiles, emissiveIntensity: 0.12 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(CHAIRS.r + 0.6, CHAIRS.r + 0.6, 0.6, 72), [toy('#5a189a'), floorMat, toy('#5a189a')]);
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    g.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CHAIRS.r + 0.35, 0.45, 20, 120), toy('#ffffff'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    g.add(shadowy(ring));
    const neon = new THREE.Mesh(new THREE.TorusGeometry(CHAIRS.r + 0.35, 0.12, 8, 120), glow('#ff2e88', 2.5));
    neon.rotation.x = Math.PI / 2;
    neon.position.y = 0.88;
    g.add(neon);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(CHAIRS.r + 3, CHAIRS.r + 1, 3, 72), toy('#7b2cbf'));
    base.position.y = -2.1;
    g.add(base);
    // palla da discoteca e casse
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 2), new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.05, metalness: 1, flatShading: true }));
    ball.position.y = 9.5;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 10), matte('#333333'));
    rope.position.y = 15.5;
    g.add(ball, rope);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const sp = new THREE.Group();
      const box = outlined(new THREE.Mesh(rbox(1.6, 2.6, 1.4, 0.2), toy('#2b2d42')), 1.04);
      box.position.y = 1.3;
      for (const [y, r] of [[1.8, 0.45], [0.75, 0.3]]) {
        const cone = new THREE.Mesh(new THREE.CircleGeometry(r, 24), glow(['#ff4d6d', '#3a86ff', '#06d6a0', '#ffd60a'][i], 1.2));
        cone.position.set(0, y, 0.71);
        sp.add(cone);
      }
      sp.add(box);
      sp.position.set(Math.sin(a) * (CHAIRS.r + 2.4), 0, Math.cos(a) * (CHAIRS.r + 2.4));
      sp.lookAt(0, 0, 0);
      sp.userData.speaker = true;
      g.add(shadowy(sp));
    }
    // fasci di luce colorati
    const beams: THREE.Mesh[] = [];
    ['#ff4d6d', '#3a86ff', '#06d6a0', '#ffd60a'].forEach((c, i) => {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(0, 9.5, 0);
      beam.userData.i = i;
      g.add(beam);
      beams.push(beam);
    });
    const lamps = [new THREE.PointLight('#ff4d6d', 0, 30), new THREE.PointLight('#3a86ff', 0, 30), new THREE.PointLight('#06d6a0', 0, 30)];
    for (const l of lamps) g.add(l);
    // note musicali che volano
    const notes = new THREE.Group();
    const noteTex = canvasTex(64, 64, (c) => {
      c.fillStyle = '#ffffff';
      c.font = 'bold 54px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('♪', 32, 34);
    });
    for (let i = 0; i < 14; i++) {
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: ['#ff70a6', '#70d6ff', '#ffd670', '#c77dff'][i % 4], transparent: true }));
      n.scale.setScalar(1.1);
      n.userData.a = Math.random() * Math.PI * 2;
      n.userData.h = Math.random() * 6;
      notes.add(n);
    }
    g.add(notes);
    const chairGroup = new THREE.Group();
    g.add(chairGroup);
    const chairCols = ['#ff4d6d', '#3a86ff', '#ffbe0b', '#06d6a0', '#8338ec', '#fb5607'];
    const chairs: THREE.Group[] = [];
    let shownKey = '';
    sh.left = sh.bottom = -14;
    sh.right = sh.top = 14;
    world.sun.target.position.set(0, 0, 0);
    update = (t, dt, info) => {
      ball.rotation.y += dt * (info.music ? 1.5 : 0.2);
      lamps.forEach((l, i) => {
        const a = t * 1.3 + (i * Math.PI * 2) / 3;
        l.position.set(Math.sin(a) * 7, 5, Math.cos(a) * 7);
        l.intensity = info.music ? 40 : 0;
      });
      for (const b of beams) {
        const a = t * 0.9 + (b.userData.i * Math.PI) / 2;
        b.visible = info.music;
        b.rotation.set(Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55);
      }
      notes.visible = info.music;
      for (const n of notes.children) {
        n.userData.h += dt * 1.5;
        if (n.userData.h > 7) n.userData.h = 0;
        const r = 9 + Math.sin(n.userData.a * 3) * 2;
        n.position.set(Math.sin(n.userData.a + t * 0.3) * r, 1 + n.userData.h, Math.cos(n.userData.a + t * 0.3) * r);
        (n as THREE.Sprite).material.opacity = 1 - n.userData.h / 7;
      }
      (neon.material as THREE.MeshStandardMaterial).emissive.setHSL((t * 0.15) % 1, 1, 0.55);
      for (const sp of g.children) if (sp.userData.speaker) sp.scale.setScalar(info.music ? 1 + Math.abs(Math.sin(t * 8)) * 0.05 : 1);
      const key = info.chairs.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)}`).join('|');
      if (key !== shownKey) {
        shownKey = key;
        clearGroup(chairGroup);
        chairs.length = 0;
        info.chairs.forEach((c, i) => {
          const ch = makeChair(chairCols[i % chairCols.length]);
          ch.position.set(c.x, 0, c.z);
          ch.rotation.y = Math.atan2(-c.x, -c.z);
          ch.scale.setScalar(0.01);
          ch.userData.born = t;
          chairGroup.add(ch);
          chairs.push(ch);
        });
      }
      for (const ch of chairs) {
        const k = Math.min(1, (t - ch.userData.born) / 0.5);
        const s = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + Math.sin(k * Math.PI) * 0.35) : 1;
        ch.scale.setScalar(Math.max(0.01, s));
      }
    };
  } else if (kind === 'SNIPER') {
    // Cecchini: canale tra due muri, casse e la torre in fondo
    const len = SNIPER.front - SNIPER.back + 30;
    const zc = (SNIPER.front + SNIPER.back) / 2 + 8;
    const floorTex = canvasTex(256, 256, (c) => {
      c.fillStyle = '#c3cbff';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#aeb9ff';
      c.fillRect(0, 0, 128, 128);
      c.fillRect(128, 128, 128, 128);
    }, [4, 22]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SNIPER.halfW * 2 + 2, len), toy('#ffffff', { map: floorTex, roughness: 0.4, clearcoat: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = zc;
    floor.receiveShadow = true;
    g.add(floor);
    world.pickables.push(floor);
    const stripes = canvasTex(64, 256, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#ffafcc' : '#ffc8dd';
        c.fillRect(0, i * 32, 64, 32);
      }
    }, [len / 6, 1]);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(rbox(1.2, 7, len, 0.45), toy(side < 0 ? '#ffafcc' : '#a2d2ff', { map: side < 0 ? stripes : null }));
      wall.position.set(side * (SNIPER.halfW + 0.6), 3.5, zc);
      g.add(shadowy(wall));
      world.pickables.push(wall);
      for (let z = SNIPER.back + 6; z < SNIPER.front; z += 10) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), glow('#fff3b0', 2.5));
        lamp.position.set(side * (SNIPER.halfW - 0.05), 5.5, z);
        g.add(lamp);
      }
    }
    const plank = canvasTex(256, 256, (c) => {
      c.fillStyle = '#e8a33d';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#c98426';
      for (let y = 0; y < 256; y += 64) c.fillRect(0, y, 256, 7);
      c.strokeStyle = '#9e5f1d';
      c.lineWidth = 16;
      c.strokeRect(8, 8, 240, 240);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(256, 256);
      c.stroke();
    });
    for (const b of SNIPER_BOXES) {
      const crate = outlined(new THREE.Mesh(rbox(b.w, b.h, b.d, 0.14), toy('#ffffff', { map: plank, clearcoat: 0.3, roughness: 0.5 })), 1.025);
      crate.position.set(b.x, b.h / 2, b.z);
      g.add(shadowy(crate));
      world.pickables.push(crate);
    }
    g.add(finishArch(SNIPER.halfW * 2 - 0.5, SNIPER.finish));
    const tower = outlined(new THREE.Mesh(rbox(SNIPER.halfW * 2 + 2.4, SNIPER.towerTop, 6, 0.6), toy('#6c4ab6')), 1.01);
    tower.position.set(0, SNIPER.towerTop / 2, SNIPER.towerZ + 1.5);
    g.add(shadowy(tower));
    world.pickables.push(tower);
    const target = canvasTex(256, 256, (c) => {
      ['#ffffff', '#ff4d6d', '#ffffff', '#ff4d6d', '#ffd60a'].forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        c.arc(128, 128, 120 - i * 24, 0, Math.PI * 2);
        c.fill();
      });
    });
    const logo = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), toy('#ffffff', { map: target }));
    logo.position.set(0, SNIPER.towerTop / 2 - 0.5, SNIPER.towerZ - 1.52);
    logo.rotation.y = Math.PI;
    g.add(logo);
    const stripe = new THREE.Mesh(rbox(SNIPER.halfW * 2 + 2.6, 0.5, 6.2, 0.2), glow('#ffd60a', 0.8));
    stripe.position.set(0, SNIPER.towerTop - 1.2, SNIPER.towerZ + 1.5);
    g.add(stripe);
    const rail = outlined(new THREE.Mesh(rbox(SNIPER.halfW * 2 + 2.4, 0.8, 0.3, 0.12), toy('#ff4d6d')), 1.04);
    rail.position.set(0, SNIPER.towerTop + 0.4, SNIPER.towerZ - 1.3);
    g.add(shadowy(rail));
    for (let i = 0; i < 2; i++) {
      const e = sniperEye(i, 2);
      const siren = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), glow('#ff2e4d', 3));
      siren.position.set(e.x * 2.2, SNIPER.towerTop + 1.2, SNIPER.towerZ + 3.5);
      siren.userData.siren = true;
      g.add(siren);
    }
    g.add(flagLine(new THREE.Vector3(-SNIPER.halfW, 7, -20), new THREE.Vector3(SNIPER.halfW, 7, -20)));
    g.add(flagLine(new THREE.Vector3(-SNIPER.halfW, 7, 0), new THREE.Vector3(SNIPER.halfW, 7, 0)));
    addBalloons(6, (i) => new THREE.Vector3((i % 2 ? 1 : -1) * (SNIPER.halfW + 3), 9 + (i % 3) * 2, SNIPER.back + 8 + i * 9));
    sh.left = -14;
    sh.right = 14;
    sh.top = 45;
    sh.bottom = -45;
    world.sun.target.position.set(0, 0, zc);
    update = (t) => {
      for (const c of g.children) if (c.userData.siren) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 6) > 0 ? 4 : 0.5;
    };
  } else if (kind === 'POLPETTE') {
    // la salita di legno con i forchettoni, la pentola della nonna in cima e un mare di ragù sotto
    const W = SLOPE.halfW * 2;
    const L = SLOPE.rampTo - SLOPE.rampFrom;
    const ang = Math.atan2(SLOPE.top, L);
    const wood = canvasTex(256, 256, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#e9b872' : '#dca35a';
        c.fillRect(0, i * 32, 256, 32);
        c.fillStyle = 'rgba(120,70,20,0.25)';
        c.fillRect(0, i * 32, 256, 3);
      }
      for (let k = 0; k < 40; k++) {
        c.fillStyle = 'rgba(140,80,30,0.18)';
        c.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 40, 2);
      }
    }, [2, 6]);
    const woodTop = toy('#ffffff', { map: wood, roughness: 0.55, clearcoat: 0.3 });
    const side = toy('#b5651d');
    const start = new THREE.Mesh(rbox(W, 1, SLOPE.rampFrom - SLOPE.back + 0.6, 0.25), [side, side, woodTop, side, side, side]);
    start.position.set(0, -0.5, (SLOPE.back + SLOPE.rampFrom) / 2);
    const rampLen = Math.hypot(L, SLOPE.top);
    const ramp = new THREE.Mesh(rbox(W, 1, rampLen + 0.6, 0.25), [side, side, woodTop, side, side, side]);
    ramp.rotation.x = -ang;
    ramp.position.set(0, SLOPE.top / 2 - 0.5 * Math.cos(ang), (SLOPE.rampFrom + SLOPE.rampTo) / 2 + 0.5 * Math.sin(ang));
    const top = new THREE.Mesh(rbox(W, 1, SLOPE.front - SLOPE.rampTo + 0.6, 0.25), [side, side, woodTop, side, side, side]);
    top.position.set(0, SLOPE.top - 0.5, (SLOPE.rampTo + SLOPE.front) / 2);
    g.add(shadowy(start), shadowy(ramp), shadowy(top));
    // bordi di sugo (si vede dove si cade)
    for (const sx of [-1, 1]) {
      const drip = new THREE.Mesh(rbox(0.35, 0.3, rampLen + 0.4, 0.12), glow('#e63946', 0.35));
      drip.rotation.x = -ang;
      drip.position.set(sx * (SLOPE.halfW - 0.05), SLOPE.top / 2 + 0.05, (SLOPE.rampFrom + SLOPE.rampTo) / 2);
      g.add(drip);
    }
    // forchettoni (ci si ripara dietro)
    for (const o of SLOPE_POSTS) {
      const f = forkPost();
      f.position.set(o.x, slopeHeight(o.z), o.z);
      g.add(f);
    }
    // traguardo in cima e pentolone della nonna
    const fin = finishArch(W - 0.6, SLOPE.finish);
    fin.position.y = SLOPE.top;
    g.add(fin);
    const pot = new THREE.Group();
    const potBody = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3, 3.6, 40), new THREE.MeshStandardMaterial({ color: '#d0d4dc', metalness: 0.85, roughness: 0.25 })), 1.02);
    potBody.position.y = 1.8;
    const sauce = new THREE.Mesh(new THREE.CircleGeometry(3.25, 40), glow('#d62828', 0.5));
    sauce.rotation.x = -Math.PI / 2;
    sauce.position.y = 3.45;
    pot.add(potBody, sauce);
    for (let i = 0; i < 6; i++) {
      const mb = meatball();
      mb.scale.setScalar(0.55);
      mb.position.set(Math.sin(i) * 2, 3.6, Math.cos(i * 1.7) * 2);
      pot.add(mb);
    }
    pot.position.set(0, SLOPE.top, SLOPE.front + 3.5);
    g.add(shadowy(pot));
    const nonna = makeNonna();
    nonna.position.set(5.5, SLOPE.top, SLOPE.front + 3);
    nonna.rotation.y = Math.PI + 0.4;
    nonna.scale.setScalar(2.2);
    g.add(nonna);
    // mare di ragù
    const seaGeo = new THREE.PlaneGeometry(260, 260, 48, 48);
    const sea = new THREE.Mesh(seaGeo, toy('#c1121f', { roughness: 0.2, clearcoat: 1, emissive: '#7a0d14', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -16;
    g.add(sea);
    const base = seaGeo.attributes.position.array.slice() as Float32Array;
    const balls = new Map<number, THREE.Object3D>();
    sh.left = -14;
    sh.right = 14;
    sh.top = 45;
    sh.bottom = -45;
    world.sun.target.position.set(0, SLOPE.top / 2, 0);
    update = (t, dt, info) => {
      const live = new Set(info.balls.map((b) => b.id));
      for (const [id, m] of balls)
        if (!live.has(id)) {
          g.remove(m);
          balls.delete(id);
        }
      for (const b of info.balls) {
        let m = balls.get(b.id);
        if (!m) {
          m = meatball();
          g.add(m);
          balls.set(b.id, m);
        }
        const bp = ballPos(b, info.now);
        m.position.set(bp.x, bp.y, bp.z);
        m.rotation.x = -bp.roll;
      }
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = base[i + 2] + Math.sin(base[i] * 0.07 + t * 1.3) * 0.7 + Math.cos(base[i + 1] * 0.08 + t) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
      nonna.userData.arm.rotation.x = -2.2 + Math.sin(t * 3) * 0.6;
    };
  } else if (kind === 'NONNA') {
    // la tavola della nonna: tovaglia a quadretti, pentola al centro, mestolo che gira, ciabattate dall'alto
    const gingham = canvasTex(256, 256, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(220,40,60,0.55)';
      for (let i = 0; i < 8; i += 2) {
        c.fillRect(i * 32, 0, 32, 256);
        c.fillRect(0, i * 32, 256, 32);
      }
    }, [5, 5]);
    const drapeTex = canvasTex(256, 64, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = 'rgba(220,40,60,0.55)';
      for (let i = 0; i < 8; i += 2) c.fillRect(i * 32, 0, 32, 64);
    }, [24, 1]);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.r, TABLE.r, 0.6, 96), [matte('#ffffff', { map: drapeTex }), matte('#ffffff', { map: gingham }), matte('#7f5539')]);
    table.position.y = -0.3;
    table.receiveShadow = true;
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.r + 0.02, TABLE.r + 0.7, 2.4, 96, 1, true), matte('#ffffff', { map: drapeTex, side: THREE.DoubleSide }));
    drape.position.y = -1.6;
    g.add(table, drape);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 26, 16), toy('#8d5524'));
      leg.position.set(Math.sin(a) * 7, -15, Math.cos(a) * 7);
      g.add(leg);
    }
    const tiles = canvasTex(256, 256, (c) => {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          c.fillStyle = (x + y) % 2 ? '#e76f51' : '#f4e1c1';
          c.fillRect(x * 64, y * 64, 64, 64);
        }
    }, [30, 30]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), matte('#ffffff', { map: tiles }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -28;
    g.add(floor);
    // piatti di spaghetti e bicchieri (decorazioni piatte)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 0.08, 32), toy('#ffffff'));
      plate.position.set(Math.sin(a) * 9.4, 0.04, Math.cos(a) * 9.4);
      const pasta = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.22, 10, 24), toy('#f4d35e'));
      pasta.rotation.x = Math.PI / 2;
      pasta.position.set(plate.position.x, 0.18, plate.position.z);
      const meat = meatball();
      meat.scale.setScalar(0.22);
      meat.position.set(plate.position.x, 0.42, plate.position.z);
      g.add(plate, pasta, meat);
    }
    const pot = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 1.2, 32), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.85, roughness: 0.25 })), 1.03);
    pot.position.y = 0.6;
    g.add(shadowy(pot));
    // il mestolo
    const spoon = new THREE.Group();
    const handle = outlined(new THREE.Mesh(rbox(0.5, 0.36, TABLE.spoonR - 1.1, 0.15), toy('#c68642')), 1.04);
    handle.position.set(0, 0.5, (TABLE.spoonR - 1.1) / 2 + 0.7);
    const bowl = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), toy('#c68642')), 1.04);
    bowl.scale.y = 0.55;
    bowl.position.set(0, 0.45, TABLE.spoonR - 0.5);
    spoon.add(handle, bowl);
    g.add(shadowy(spoon));
    const trail = new THREE.Mesh(new THREE.RingGeometry(1, TABLE.spoonR, 64, 1, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    trail.rotation.x = -Math.PI / 2;
    trail.position.y = 0.04;
    g.add(trail);
    const nonna = makeNonna();
    nonna.position.set(0, -10, TABLE.r + 6);
    nonna.rotation.y = Math.PI;
    nonna.scale.setScalar(4.2);
    g.add(nonna);
    const slams = new Map<number, { ring: THREE.Mesh; shoe: THREE.Group; at: number; gone: number }>();
    sh.left = sh.bottom = -14;
    sh.right = sh.top = 14;
    world.sun.target.position.set(0, 0, 0);
    update = (t, dt, info) => {
      const th = spoonAngle(info.playT);
      spoon.rotation.y = th;
      trail.rotation.z = -th - Math.PI / 2 + 0.25;
      const live = new Set(info.slams.map((x) => x.id));
      for (const sl of info.slams) {
        if (slams.has(sl.id)) continue;
        const ring = new THREE.Mesh(new THREE.RingGeometry(TABLE.slamR - 0.25, TABLE.slamR, 48), new THREE.MeshBasicMaterial({ color: '#ff1744', transparent: true, toneMapped: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(sl.x, 0.06, sl.z);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(TABLE.slamR, 48), new THREE.MeshBasicMaterial({ color: '#ff1744', transparent: true, opacity: 0.18, depthWrite: false }));
        ring.add(disc);
        disc.position.z = -0.01;
        const shoe = slipper();
        shoe.position.set(sl.x, 18, sl.z);
        g.add(ring, shoe);
        slams.set(sl.id, { ring, shoe, at: sl.at, gone: 0 });
      }
      for (const [id, x] of slams) {
        const k = 1 - (x.at - info.now) / TABLE.slamWarn;
        (x.ring.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 18) * 0.4;
        x.ring.scale.setScalar(0.4 + Math.min(1, k) * 0.6);
        const fall = Math.min(1, Math.max(0, (k - 0.55) / 0.45));
        x.shoe.position.y = 18 - 17.6 * fall * fall;
        x.shoe.scale.y = fall >= 1 ? 0.7 : 1;
        if (!live.has(id) && !x.gone) x.gone = t;
        if (x.gone && t - x.gone > 0.5) {
          g.remove(x.ring, x.shoe);
          slams.delete(id);
        }
      }
      const angry = info.slams.length > 0;
      nonna.userData.arm.rotation.x = angry ? -2.8 + Math.sin(t * 10) * 0.3 : -0.4 + Math.sin(t * 2) * 0.1;
    };
  } else if (kind === 'GALLINA') {
    // l'aia: prato a strisce, steccato, balle di fieno, fienile e silo
    const grass = canvasTex(256, 256, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#7bd389' : '#6cc57c';
        c.fillRect(0, i * 32, 256, 32);
      }
      for (let k = 0; k < 300; k++) {
        c.fillStyle = 'rgba(40,120,60,0.25)';
        c.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
      }
    }, [5, 5]);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(YARD.r + 0.6, YARD.r + 0.6, 0.6, 72), [toy('#8d5524'), matte('#ffffff', { map: grass }), toy('#8d5524')]);
    yard.position.y = -0.3;
    yard.receiveShadow = true;
    g.add(yard);
    const field = new THREE.Mesh(new THREE.CircleGeometry(120, 48), matte('#5fb36a'));
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.62;
    g.add(field);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const post = new THREE.Mesh(rbox(0.25, 1.3, 0.25, 0.06), toy('#ffffff'));
      post.position.set(Math.sin(a) * (YARD.r + 0.35), 0.65, Math.cos(a) * (YARD.r + 0.35));
      g.add(post);
    }
    for (const y of [0.45, 1]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(YARD.r + 0.35, 0.07, 6, 120), toy('#ffffff'));
      rail.rotation.x = Math.PI / 2;
      rail.position.y = y;
      g.add(rail);
    }
    const hayTex = canvasTex(128, 128, (c) => {
      c.fillStyle = '#f2c94c';
      c.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 120; k++) {
        c.strokeStyle = Math.random() < 0.5 ? '#d9a521' : '#fff2a8';
        c.beginPath();
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        c.moveTo(x, y);
        c.lineTo(x + 14, y + Math.random() * 4);
        c.stroke();
      }
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 24), toy('#ffffff', { map: hayTex, clearcoat: 0 }));
      hay.rotation.z = Math.PI / 2;
      hay.rotation.y = a;
      hay.position.set(Math.sin(a) * (YARD.r + 3.5), 0.5, Math.cos(a) * (YARD.r + 3.5));
      g.add(shadowy(hay));
    }
    const barn = new THREE.Group();
    const walls = outlined(new THREE.Mesh(rbox(12, 7, 9, 0.3), toy('#d62828')), 1.01);
    walls.position.y = 3.5;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 12.6, 3, 1), toy('#5c3d2e'));
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 8.3;
    const door = new THREE.Mesh(rbox(4, 4.6, 0.2, 0.1), toy('#ffffff'));
    door.position.set(0, 2.3, -4.55);
    barn.add(walls, roof, door);
    barn.position.set(-4, 0, YARD.r + 13);
    g.add(shadowy(barn));
    const silo = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 11, 32), toy('#e5e5e5'));
    tube.position.y = 5.5;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), toy('#d62828'));
    dome.position.y = 11;
    silo.add(tube, dome);
    silo.position.set(9, 0, YARD.r + 12);
    g.add(shadowy(silo));
    sh.left = sh.bottom = -16;
    sh.right = sh.top = 16;
    world.sun.target.position.set(0, 0, 0);
  } else if (kind === 'PONTE') {
    // il ponte di lasagne sopra un pentolone di sugo che bolle
    const lasagna = canvasTex(256, 256, (c) => {
      c.fillStyle = '#f6d365';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#e9b949';
      c.lineWidth = 10;
      for (let y = 20; y < 256; y += 40) {
        c.beginPath();
        for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x / 20) * 5);
        c.stroke();
      }
      for (let k = 0; k < 40; k++) {
        c.fillStyle = Math.random() < 0.5 ? 'rgba(214,40,40,0.55)' : 'rgba(255,255,255,0.6)';
        c.beginPath();
        c.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 10, 0, Math.PI * 2);
        c.fill();
      }
    });
    const marble = canvasTex(256, 256, (c) => {
      c.fillStyle = '#f1ece4';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(150,140,130,0.35)';
      c.lineWidth = 3;
      for (let k = 0; k < 12; k++) {
        c.beginPath();
        c.moveTo(Math.random() * 256, 0);
        c.bezierCurveTo(Math.random() * 256, 90, Math.random() * 256, 170, Math.random() * 256, 256);
        c.stroke();
      }
    }, [3, 3]);
    const plat = (from: number, to: number) => {
      const m = outlined(new THREE.Mesh(rbox(BRIDGE.platHalfW * 2, 1.2, to - from, 0.25), toy('#ffffff', { map: marble })), 1.01);
      m.position.set(0, -0.6, (from + to) / 2);
      return shadowy(m);
    };
    g.add(plat(BRIDGE.startFrom, BRIDGE.startTo), plat(BRIDGE.finishFrom, BRIDGE.finishTo));
    const finish = finishArch(BRIDGE.platHalfW * 2 - 1, BRIDGE.finishFrom + 1.5);
    g.add(finish);
    // grissini giganti ai lati (decorazione)
    for (const sx of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, BRIDGE.finishFrom - BRIDGE.startTo + 6, 12), toy('#e0a458'));
      beam.rotation.x = Math.PI / 2;
      beam.position.set(sx * 4.4, -0.9, (BRIDGE.startTo + BRIDGE.finishFrom) / 2);
      g.add(beam);
    }
    const tiles = new Map<string, THREE.Object3D>();
    for (let i = 0; i < BRIDGE.rows; i++)
      for (const side of [0, 1]) {
        const t = new THREE.Group();
        const sheet = outlined(new THREE.Mesh(rbox(BRIDGE.tileHalf * 2, 0.34, BRIDGE.tileHalf * 2, 0.12), toy('#ffffff', { map: lasagna, roughness: 0.5 })), 1.03);
        sheet.position.y = -0.17;
        const sauce = new THREE.Mesh(rbox(BRIDGE.tileHalf * 2 - 0.2, 0.08, BRIDGE.tileHalf * 2 - 0.2, 0.04), toy('#d62828', { roughness: 0.2, clearcoat: 1 }));
        sauce.position.y = 0.02;
        t.add(sheet, sauce);
        t.position.set(side ? -BRIDGE.tileX : BRIDGE.tileX, 0, bridgeRowZ(i));
        g.add(shadowy(t));
        tiles.set(`${i}:${side}`, t);
      }
    const potBig = new THREE.Mesh(new THREE.CylinderGeometry(26, 22, 18, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#9aa1ab', metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }));
    potBig.position.set(0, -38, 0);
    const boil = new THREE.Mesh(new THREE.CircleGeometry(25, 48), glow('#d62828', 0.6));
    boil.rotation.x = -Math.PI / 2;
    boil.position.y = -32;
    g.add(potBig, boil);
    const bubbles = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + Math.random(), 12, 10), toy('#ef476f', { transparent: true, opacity: 0.85 }));
      b.position.set((Math.random() - 0.5) * 40, -32, (Math.random() - 0.5) * 40);
      b.userData.v = 0.5 + Math.random();
      bubbles.add(b);
    }
    g.add(bubbles);
    const falling: { o: THREE.Object3D; v: number; spin: number }[] = [];
    sh.left = -12;
    sh.right = 12;
    sh.top = 30;
    sh.bottom = -30;
    world.sun.target.position.set(0, 0, -6);
    update = (t, dt, info) => {
      for (const key of info.broken) {
        const tile = tiles.get(key);
        if (tile && !tile.userData.gone) {
          tile.userData.gone = true;
          // la lasagna si spezza in quattro pezzi che cadono nel sugo
          for (let k = 0; k < 4; k++) {
            const piece = new THREE.Mesh(rbox(BRIDGE.tileHalf, 0.3, BRIDGE.tileHalf, 0.1), toy('#ffffff', { map: lasagna }));
            piece.position.copy(tile.position).add(new THREE.Vector3((k % 2 ? 0.5 : -0.5) * BRIDGE.tileHalf, 0, (k < 2 ? 0.5 : -0.5) * BRIDGE.tileHalf));
            g.add(piece);
            falling.push({ o: piece, v: Math.random() * 2, spin: (Math.random() - 0.5) * 6 });
          }
          tile.visible = false;
        }
      }
      for (const f of falling) {
        f.v += 20 * dt;
        f.o.position.y -= f.v * dt;
        f.o.rotation.x += f.spin * dt;
        f.o.rotation.z += f.spin * dt * 0.7;
      }
      for (const b of bubbles.children) {
        b.position.y += b.userData.v * dt;
        if (b.position.y > -29) b.position.y = -32.5;
      }
    };
  } else if (kind === 'BOTTO') {
    // piazzetta stile Venezia: sampietrini, casette colorate, lucine e il canale tutto intorno
    const cobble = canvasTex(256, 256, (c) => {
      c.fillStyle = '#9c8f84';
      c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32)
        for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) {
          c.fillStyle = ['#c9b8a6', '#bba893', '#d6c7b6'][(x + y) % 3];
          c.beginPath();
          c.roundRect(x + 2, y + 2, 28, 28, 8);
          c.fill();
        }
    }, [6, 6]);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r, 1, 72), [toy('#8d7b6a'), matte('#ffffff', { map: cobble }), toy('#8d7b6a')]);
    plaza.position.y = -0.5;
    plaza.receiveShadow = true;
    g.add(plaza);
    const mosaic = new THREE.Mesh(new THREE.RingGeometry(1.2, 3, 8), toy('#ffbe0b'));
    mosaic.rotation.x = -Math.PI / 2;
    mosaic.position.y = 0.02;
    g.add(mosaic);
    const canal = new THREE.Mesh(new THREE.RingGeometry(PLAZA.r + 0.2, 60, 72), toy('#2a9d8f', { roughness: 0.1, clearcoat: 1 }));
    canal.rotation.x = -Math.PI / 2;
    canal.position.y = -2.2;
    g.add(canal);
    const houseCols = ['#ff9f1c', '#e76f51', '#f4a261', '#e9c46a', '#ffafcc', '#90be6d', '#4cc9f0', '#c77dff'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = 8 + (i % 3) * 3;
      const house = new THREE.Group();
      const wall = outlined(new THREE.Mesh(rbox(6, h, 5, 0.3), toy(houseCols[i % houseCols.length])), 1.01);
      wall.position.y = h / 2 - 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.5, 4), toy('#9d0208'));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h - 0.75;
      house.add(wall, roof);
      for (let wy = 0; wy < 3; wy++)
        for (const wx of [-1.5, 1.5]) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), glow(wy === 0 && i % 2 ? '#fff3b0' : '#5c7aea', wy === 0 && i % 2 ? 1.2 : 0.2));
          win.position.set(wx, wy * 2.6, -2.52);
          win.rotation.y = Math.PI;
          house.add(win);
        }
      house.position.set(Math.sin(a) * (PLAZA.r + 12), 0, Math.cos(a) * (PLAZA.r + 12));
      house.lookAt(0, 0, 0);
      g.add(shadowy(house));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = ((i + 3) / 6) * Math.PI * 2;
      const line = flagLine(new THREE.Vector3(Math.sin(a) * 15, 8, Math.cos(a) * 15), new THREE.Vector3(Math.sin(b) * 15, 8, Math.cos(b) * 15), 18);
      g.add(line);
    }
    sh.left = sh.bottom = -16;
    sh.right = sh.top = 16;
    world.sun.target.position.set(0, 0, 0);
  } else if (kind === 'DENTE') {
    // la cucina: pavimento a scacchi, fornello, il pentolone che bolle e il timer gigante a forma di pomodoro
    const checks = canvasTex(256, 256, (c) => {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          c.fillStyle = (x + y) % 2 ? '#e63946' : '#fff5e6';
          c.fillRect(x * 64, y * 64, 64, 64);
          c.fillStyle = 'rgba(255,255,255,0.22)';
          c.fillRect(x * 64 + 5, y * 64 + 5, 54, 7);
        }
    }, [9, 9]);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 1, 80), [toy('#8d5524'), toy('#ffffff', { map: checks, roughness: 0.3, clearcoat: 0.6 }), toy('#5c3d2e')]);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    g.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(17, 0.35, 12, 120), toy('#ffffff'));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    // muro di piastrelle con le mensole
    const tileTex = canvasTex(256, 256, (c) => {
      c.fillStyle = '#e3f6ff';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#a9d3e6';
      c.lineWidth = 6;
      for (let y = 0; y <= 256; y += 64) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(256, y);
        c.stroke();
      }
      for (let y = 0; y < 256; y += 64)
        for (let x = (y / 64) % 2 ? 32 : 0; x <= 256; x += 64) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x, y + 64);
          c.stroke();
        }
    }, [12, 5]);
    const wall = new THREE.Mesh(rbox(44, 18, 1.2, 0.4), toy('#ffffff', { map: tileTex, roughness: 0.35 }));
    wall.position.set(0, 8, 14.5);
    g.add(shadowy(wall));
    const boxTex = canvasTex(128, 192, (c) => {
      c.fillStyle = '#1d6fd8';
      c.fillRect(0, 0, 128, 192);
      c.fillStyle = '#ffd60a';
      c.fillRect(0, 120, 128, 30);
      c.fillStyle = '#ffffff';
      c.font = '900 30px "Lilita One", sans-serif';
      c.textAlign = 'center';
      c.fillText('PASTA', 64, 60);
      c.fillText('AXEND', 64, 95);
      c.fillStyle = '#1d0f3d';
      c.font = '900 20px sans-serif';
      c.fillText('N° 5', 64, 142);
    });
    const jarCols = ['#ffbe0b', '#fb5607', '#8ac926', '#ff006e', '#3a86ff', '#9b5de5'];
    for (const side of [-1, 1])
      for (const y of [6, 10.5]) {
        const shelf = outlined(new THREE.Mesh(rbox(11, 0.35, 1.8, 0.12), toy('#b5651d')), 1.03);
        shelf.position.set(side * 13, y, 13.2);
        g.add(shadowy(shelf));
        for (let i = 0; i < 5; i++) {
          const x = side * 13 - 4.2 + i * 2.1;
          if ((i + (y > 8 ? 1 : 0)) % 3 === 0) {
            const box = outlined(new THREE.Mesh(rbox(1.3, 2.1, 0.7, 0.08), [toy('#1d6fd8'), toy('#1d6fd8'), toy('#1d6fd8'), toy('#1d6fd8'), toy('#ffffff', { map: boxTex }), toy('#1d6fd8')]), 1.04);
            box.position.set(x, y + 1.22, 13.2);
            box.rotation.y = Math.PI;
            g.add(shadowy(box));
          } else {
            const jar = new THREE.Group();
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 20), toy('#ffffff', { transparent: true, opacity: 0.35, roughness: 0.05 }));
            const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.0, 20), toy(jarCols[(i * 3 + (y > 8 ? 2 : 0)) % jarCols.length]));
            fill.position.y = -0.15;
            const lid = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.22, 20), toy('#e63946')), 1.06);
            lid.position.y = 0.8;
            jar.add(fill, glass, lid);
            jar.position.set(x, y + 0.88, 13.2);
            g.add(shadowy(jar));
          }
        }
      }
    // padelle appese
    for (const x of [-8, -5.5, 5.5, 8]) {
      const pan = new THREE.Group();
      const disc = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 0.3, 28), toy('#2b2d42', { metalness: 0.4 })), 1.05);
      disc.rotation.x = Math.PI / 2;
      const handle = new THREE.Mesh(rbox(0.3, 1.8, 0.2, 0.08), toy('#8d5524'));
      handle.position.y = 2;
      pan.add(disc, handle);
      pan.position.set(x, 13 - Math.abs(x) * 0.12, 13.6);
      pan.userData.swing = Math.random() * 6;
      pan.userData.pan = true;
      g.add(shadowy(pan));
    }
    // il fornello con le fiamme
    const steel = new THREE.MeshStandardMaterial({ color: '#d0d4dc', metalness: 0.85, roughness: 0.25 });
    const stove = outlined(new THREE.Mesh(rbox(8, 1.8, 8, 0.45), toy('#ffffff', { roughness: 0.25 })), 1.02);
    stove.position.y = 0.9;
    g.add(shadowy(stove));
    const grate = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.16, 8, 40), toy('#2b2d42'));
    grate.rotation.x = Math.PI / 2;
    grate.position.y = 1.85;
    g.add(grate);
    for (let i = 0; i < 4; i++) {
      const knob = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 18), toy(['#e63946', '#ffbe0b', '#06d6a0', '#3a86ff'][i])), 1.08);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-2.4 + i * 1.6, 0.95, -4.1);
      g.add(knob);
    }
    const flames: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 8), glow(i % 2 ? '#4cc9f0' : '#ff9f1c', 2.5));
      f.position.set(Math.sin(a) * 2.6, 2.15, Math.cos(a) * 2.6);
      f.userData.ph = Math.random() * 6;
      g.add(f);
      flames.push(f);
    }
    // il pentolone con l'acqua che bolle e gli spaghetti
    const pot = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3, 2.85, 3.4, 48), steel), 1.02);
    pot.position.y = 3.6;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 10, 48), steel);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 5.3;
    g.add(shadowy(pot), lip);
    for (const sx of [-1, 1]) {
      const h = outlined(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 20, Math.PI), toy('#2b2d42')), 1.06);
      h.position.set(sx * 3.05, 4.8, 0);
      h.rotation.set(0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, -Math.PI / 2);
      g.add(h);
    }
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.85, 40), toy('#bde0fe', { emissive: '#7fc8ff', emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 5.05;
    g.add(water);
    const pasta = new THREE.Group();
    const strand = toy('#f6d365', { roughness: 0.35 });
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + Math.random() * 0.2;
      const r = 1 + Math.random() * 1.7;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 6), strand);
      sp.position.set(Math.sin(a) * r, 5.9, Math.cos(a) * r);
      sp.rotation.set(Math.cos(a) * (0.35 + Math.random() * 0.4), 0, -Math.sin(a) * (0.35 + Math.random() * 0.4));
      sp.userData.base = sp.rotation.clone();
      sp.userData.ph = Math.random() * 6;
      pasta.add(sp);
    }
    g.add(pasta);
    const bubbles: THREE.Mesh[] = [];
    const bubMat = toy('#ffffff', { transparent: true, opacity: 0.8 });
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.22, 12, 8), bubMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.5;
      b.position.set(Math.sin(a) * r, 5.07, Math.cos(a) * r);
      b.userData.ph = Math.random() * 6;
      g.add(b);
      bubbles.push(b);
    }
    // vapore
    const steamTex = canvasTex(128, 128, (c) => {
      const gr = c.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 128, 128);
    });
    const steam: THREE.Sprite[] = [];
    for (let i = 0; i < 20; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      sp.userData.k = i / 20;
      sp.userData.a = Math.random() * Math.PI * 2;
      g.add(sp);
      steam.push(sp);
    }
    // il timer della pasta: un pomodoro gigante con lo schermo
    const timer = new THREE.Group();
    const tom = outlined(new THREE.Mesh(new THREE.SphereGeometry(3, 40, 28), toy('#e63946')), 1.03);
    tom.scale.set(1.3, 1, 1);
    timer.add(tom);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8), toy('#2d9c4a'));
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.sin(a) * 0.7, 3, Math.cos(a) * 0.7);
      leaf.rotation.set(Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2);
      timer.add(leaf);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.9, 8), toy('#2d6a4f'));
    stem.position.y = 3.3;
    timer.add(stem);
    const frame = outlined(new THREE.Mesh(rbox(6.2, 3.3, 0.6, 0.3), toy('#ffffff')), 1.03);
    frame.position.z = -2.9;
    timer.add(frame);
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 256;
    const screenTex = new THREE.CanvasTexture(cv);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    screen.position.z = -3.22;
    screen.rotation.y = Math.PI;
    timer.add(screen);
    timer.position.set(0, 13.2, 3);
    g.add(shadowy(timer));
    // il colapasta e un po' di spesa per terra
    const colander = outlined(new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toy('#ff8fab', { side: THREE.DoubleSide })), 1.03);
    colander.position.set(-12.5, 2.2, 5);
    g.add(shadowy(colander));
    for (const [x, z, s0] of [
      [12, 6, 1.2],
      [13.5, 3.5, 0.9],
      [-14, 1, 0.8],
      [11, 9, 0.7],
    ]) {
      const t0 = outlined(new THREE.Mesh(new THREE.SphereGeometry(s0, 24, 16), toy('#e63946')), 1.05);
      t0.scale.y = 0.85;
      t0.position.set(x, s0 * 0.85, z);
      const lf = new THREE.Mesh(new THREE.ConeGeometry(s0 * 0.35, s0 * 0.5, 5), toy('#2d9c4a'));
      lf.position.set(x, s0 * 1.7, z);
      g.add(shadowy(t0), lf);
    }
    const cheese = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.4, 3), toy('#ffd166')), 1.04);
    cheese.position.set(-12, 0.7, 9);
    g.add(shadowy(cheese));
    addBalloons(8, (i) => {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      return new THREE.Vector3(Math.sin(a) * 19, 7 + (i % 3) * 2, Math.cos(a) * 19);
    });
    sh.left = sh.bottom = -18;
    sh.right = sh.top = 18;
    world.sun.target.position.set(0, 0, 0);
    const fmt = (v: number) => v.toFixed(2).replace('.', ',');
    let shown = '';
    const drawScreen = (top: string, big: string, color: string) => {
      const c = cv.getContext('2d')!;
      c.fillStyle = '#1d0f3d';
      c.fillRect(0, 0, 512, 256);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 0; y < 256; y += 6) c.fillRect(0, y, 512, 2);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffd6e0';
      c.font = '900 30px "Lilita One", "Baloo 2", sans-serif';
      c.fillText(top, 256, 42, 480);
      c.font = '900 150px "Lilita One", "Baloo 2", monospace';
      c.shadowColor = color;
      c.shadowBlur = 24;
      c.fillStyle = color;
      c.fillText(big, 256, 160);
      c.shadowBlur = 0;
      screenTex.needsUpdate = true;
    };
    update = (t, dt, info) => {
      const D = info.dente;
      let top = 'PASTA AL DENTE';
      let big = 'PRONTI?';
      let col = '#ffd60a';
      if (D) {
        top = `MANCHE ${D.manche + 1}/${D.manches} · SCOLA A ${fmt(D.target)}`;
        const el = (info.now - D.startAt) / 1000;
        if (D.phase === 'REVEAL') {
          top = 'STOP! ECCO I TEMPI';
          big = D.target.toFixed(2);
          col = '#ffffff';
        } else if (el < 0) big = 'PRONTI…';
        else if (el < DENTE.showFor) {
          big = el.toFixed(2).padStart(5, '0');
          col = '#7cff6b';
        } else {
          big = '??.??';
          col = Math.floor(t * 2.5) % 2 ? '#ff9f1c' : '#ff4d6d';
        }
      }
      const key = `${top}|${big}|${col}`;
      if (key !== shown) {
        shown = key;
        drawScreen(top, big, col);
      }
      const boil = D?.phase === 'GO' && info.now >= D.startAt ? 1 : 0.45;
      for (const f of flames) {
        f.scale.y = 0.7 + Math.abs(Math.sin(t * 13 + f.userData.ph)) * 0.6 * boil + 0.2;
        f.rotation.z = Math.sin(t * 9 + f.userData.ph) * 0.15;
      }
      for (const b of bubbles) {
        const k = (t * (0.8 + boil) + b.userData.ph) % 1;
        b.position.y = 5.05 + Math.sin(k * Math.PI) * 0.25 * boil;
        b.scale.setScalar(0.4 + k);
      }
      for (const sp of pasta.children) {
        sp.rotation.x = sp.userData.base.x + Math.sin(t * 3 + sp.userData.ph) * 0.06 * boil;
        sp.rotation.z = sp.userData.base.z + Math.cos(t * 2.6 + sp.userData.ph) * 0.06 * boil;
      }
      for (const sp of steam) {
        const k = (sp.userData.k + t * 0.18 * (0.6 + boil)) % 1;
        const a = sp.userData.a + k * 2;
        sp.position.set(Math.sin(a) * (0.8 + k * 2.2), 5.4 + k * 4.2, Math.cos(a) * (0.8 + k * 2.2) + k * 2);
        sp.scale.setScalar(1.3 + k * 3);
        (sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.55 * (0.5 + boil * 0.5);
      }
      timer.rotation.z = D?.phase === 'GO' && info.now - D.startAt > DENTE.showFor * 1000 ? Math.sin(t * 20) * 0.015 : 0;
      for (const c of g.children) if (c.userData.pan) c.rotation.z = Math.sin(t * 1.3 + c.userData.swing) * 0.08;
    };
  } else if (kind === 'WAFER') {
    // tre piani di mattonelle di wafer (vaniglia, fragola, pistacchio) sopra un mare di cioccolato
    const top = canvasTex(256, 256, (c) => {
      c.fillStyle = '#fff6e4';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(150,100,40,0.28)';
      for (let i = 0; i < 256; i += 32) {
        c.fillRect(i, 0, 7, 256);
        c.fillRect(0, i, 256, 7);
      }
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) c.fillRect(x + 10, y + 10, 12, 5);
    }, [1.5, 1.5]);
    const side = canvasTex(128, 64, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#fff6e4' : '#c99a5a';
        c.fillRect(0, i * 8, 128, 8);
      }
    }, [4, 1]);
    const hexGeo = new THREE.CylinderGeometry(WAFER.size * 0.95, WAFER.size * 0.95, 0.7, 6);
    hexGeo.translate(0, -0.35, 0);
    const lineGeo = new THREE.CylinderGeometry(WAFER.size * 0.95 * 1.07, WAFER.size * 0.95 * 1.07, 0.7 * 1.18, 6);
    lineGeo.translate(0, -0.35, 0);
    const mats = [toy('#ffffff', { map: side, roughness: 0.6, clearcoat: 0.1 }), toy('#ffffff', { map: top, roughness: 0.55, clearcoat: 0.15 }), toy('#ffffff', { map: side, roughness: 0.6 })];
    const tints = ['#ffc56e', '#ff94bb', '#a9e070'].map((c) => new THREE.Color(c));
    const white = new THREE.Color('#ffffff');
    const layers: { tiles: THREE.InstancedMesh; lines: THREE.InstancedMesh }[] = [];
    const dummy = new THREE.Object3D();
    const place = (l: number, i: number, dy = 0, rx = 0, rz = 0, sc = 1, jx = 0, jz = 0) => {
      const tl = HEX_TILES[i];
      dummy.position.set(tl.x + jx, waferY(l) + dy, tl.z + jz);
      dummy.rotation.set(rx, 0, rz);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      layers[l].tiles.setMatrixAt(i, dummy.matrix);
      layers[l].lines.setMatrixAt(i, dummy.matrix);
    };
    for (let l = 0; l < WAFER.layers; l++) {
      const tiles = new THREE.InstancedMesh(hexGeo, mats, HEX_N);
      const lines = new THREE.InstancedMesh(lineGeo, OUTLINE, HEX_N);
      tiles.castShadow = true;
      tiles.receiveShadow = l === 0;
      layers.push({ tiles, lines });
      for (let i = 0; i < HEX_N; i++) {
        place(l, i);
        tiles.setColorAt(i, tints[l]);
      }
      tiles.instanceMatrix.needsUpdate = true;
      tiles.instanceColor!.needsUpdate = true;
      g.add(tiles, lines);
    }
    // mare di cioccolato che ondeggia
    const seaGeo = new THREE.PlaneGeometry(320, 320, 64, 64);
    const sea = new THREE.Mesh(seaGeo, toy('#5a2d0c', { roughness: 0.18, clearcoat: 1, emissive: '#2b1405', emissiveIntensity: 0.3 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -25;
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    // lecca-lecca giganti e caramelle che galleggiano
    const swirl = canvasTex(256, 256, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#ff4d6d';
      c.lineWidth = 22;
      c.beginPath();
      for (let a = 0; a < Math.PI * 10; a += 0.1) c.lineTo(128 + Math.cos(a) * a * 3.9, 128 + Math.sin(a) * a * 3.9);
      c.stroke();
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = 33 + (i % 2) * 5;
      const pop = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 30, 10), toy('#ffffff'));
      stick.position.y = -11;
      const candy = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.9, 40), [toy(['#ff4d6d', '#3a86ff', '#06d6a0', '#ffbe0b'][i % 4]), toy('#ffffff', { map: swirl }), toy('#ffffff', { map: swirl })]), 1.03);
      candy.rotation.x = Math.PI / 2;
      candy.position.y = 6 + (i % 3) * 2;
      pop.add(stick, candy);
      pop.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      pop.lookAt(0, 0, 0);
      g.add(shadowy(pop, true, false));
    }
    const sweets: THREE.Object3D[] = [];
    for (let i = 0; i < 12; i++) {
      const sw = new THREE.Group();
      const col = ['#ff70a6', '#70d6ff', '#ffd670', '#9ef01a', '#e0aaff'][i % 5];
      const core = outlined(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), toy(col)), 1.06);
      core.scale.set(1.4, 1, 1);
      sw.add(core);
      for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 10), toy(col));
        wing.rotation.z = (sx * Math.PI) / 2;
        wing.position.x = sx * 1.9;
        sw.add(wing);
      }
      const a = (i / 12) * Math.PI * 2;
      sw.position.set(Math.sin(a) * (14 + (i % 3) * 6), -24 + (i % 4) * 0.4, Math.cos(a) * (14 + (i % 3) * 6));
      sw.userData.ph = Math.random() * 6;
      g.add(sw);
      sweets.push(sw);
    }
    addBalloons(10, (i) => {
      const a = (i / 10) * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a) * 36, 10 + (i % 3) * 3, Math.cos(a) * 36);
    });
    sh.left = sh.bottom = -21;
    sh.right = sh.top = 21;
    world.sun.target.position.set(0, -6, 0);
    // stato mostrato: 0 intera, 1 si sbriciola, 2 cade (con l'ora in cui è cambiata)
    const shownSt = new Uint8Array(HEX_N * WAFER.layers);
    const since = new Float32Array(HEX_N * WAFER.layers);
    const busy = new Set<number>();
    const tmpC = new THREE.Color();
    update = (t, dt, info) => {
      const str = info.hex;
      for (let k = 0; k < shownSt.length; k++) {
        const c = str ? str.charCodeAt(k) - 48 : 0;
        if (c >= 0 && c <= 2 && c !== shownSt[k]) {
          shownSt[k] = c;
          since[k] = t;
          busy.add(k);
        }
      }
      const dirty = new Set<number>();
      for (const k of busy) {
        const l = Math.floor(k / HEX_N);
        const i = k % HEX_N;
        const st = shownSt[k];
        const e = t - since[k];
        dirty.add(l);
        if (st === 0) {
          place(l, i);
          layers[l].tiles.setColorAt(i, tints[l]);
          busy.delete(k);
        } else if (st === 1) {
          // trema e diventa bianca: sta per cadere
          place(l, i, 0, 0, 0, 1, Math.sin(t * 70 + i) * 0.07, Math.cos(t * 63 + i) * 0.07);
          tmpC.copy(tints[l]).lerp(white, Math.min(1, e / 0.6) * (0.55 + Math.sin(t * 30) * 0.25));
          layers[l].tiles.setColorAt(i, tmpC);
        } else if (e < 1.6) {
          place(l, i, -0.5 * 26 * e * e, e * (i % 2 ? 1.5 : -1.2), e * (i % 3 ? 1.1 : -1.4), Math.max(0.01, 1 - e * 0.35));
          tmpC.copy(tints[l]).multiplyScalar(0.8);
          layers[l].tiles.setColorAt(i, tmpC);
        } else {
          place(l, i, -40, 0, 0, 0.001);
          busy.delete(k);
        }
      }
      for (const l of dirty) {
        layers[l].tiles.instanceMatrix.needsUpdate = true;
        layers[l].lines.instanceMatrix.needsUpdate = true;
        layers[l].tiles.instanceColor!.needsUpdate = true;
      }
      // le ombre si vedono sul piano dove sto io
      const myL = Math.max(0, Math.min(WAFER.layers - 1, Math.round(-info.me.y / WAFER.gap)));
      layers.forEach((L, l) => (L.tiles.receiveShadow = l === myL));
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.07 + t * 1.2) * 0.7 + Math.cos(seaBase[i + 1] * 0.08 + t) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
      for (const sw of sweets) {
        sw.position.y = -24.3 + Math.sin(t * 1.3 + sw.userData.ph) * 0.4;
        sw.rotation.y += dt * 0.4;
        sw.rotation.z = Math.sin(t + sw.userData.ph) * 0.2;
      }
    };
  } else if (kind === 'FRUTTA') {
    // macedonia: 16 piastrelle sospese sopra un mare di succo, frutta gigante che galleggia, due tabelloni
    const faces = FRUITS.map((f, i) =>
      canvasTex(256, 256, (c) => {
        c.fillStyle = ['#ffe5ec', '#fff3b0', '#eadcff', '#d8f8d0', '#fffbd1', '#ffe0e0'][i];
        c.fillRect(0, 0, 256, 256);
        c.strokeStyle = 'rgba(29,15,61,0.25)';
        c.lineWidth = 10;
        c.strokeRect(10, 10, 236, 236);
        drawFruit(c, f, 128, 132, 190);
      }),
    );
    const hidden = canvasTex(256, 256, (c) => {
      c.fillStyle = '#7b2cbf';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 8; i++) c.fillRect(i * 32, 0, 14, 256);
      c.font = '900 170px "Lilita One", "Baloo 2", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 18;
      c.strokeStyle = '#1d0f3d';
      c.strokeText('?', 128, 138);
      c.fillStyle = '#ffd60a';
      c.fillText('?', 128, 132);
    });
    const tileCols = ['#ff70a6', '#70d6ff', '#ffd670', '#9ef01a', '#c77dff', '#ff9770'];
    const tiles: { g: THREE.Group; top: THREE.MeshPhysicalMaterial; face: number; y: number; vy: number; pop: number }[] = [];
    for (let i = 0; i < FRUIT.n * FRUIT.n; i++) {
      const tg = new THREE.Group();
      const sideM = toy(tileCols[i % tileCols.length]);
      const topM = toy('#ffffff', { map: hidden, roughness: 0.4, clearcoat: 0.5 });
      const slab = outlined(new THREE.Mesh(rbox(FRUIT.size, 0.8, FRUIT.size, 0.2), [sideM, sideM, topM, sideM, sideM, sideM]), 1.03);
      slab.position.y = -0.4;
      const under = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 4), toy(shade(tileCols[i % tileCols.length], 0.7).getStyle()));
      under.rotation.set(Math.PI, Math.PI / 4, 0);
      under.position.y = -1.9;
      tg.add(slab, under);
      const c = fruitTile(i);
      tg.position.set(c.x, 0, c.z);
      g.add(shadowy(tg));
      tiles.push({ g: tg, top: topM, face: -1, y: 0, vy: 0, pop: 0 });
    }
    // il maxischermo a quattro facce sopra il centro, con il frutto da salvare (non copre mai la telecamera)
    const boards: { tex: THREE.CanvasTexture; cv: HTMLCanvasElement }[] = [];
    const cvb = document.createElement('canvas');
    cvb.width = 512;
    cvb.height = 384;
    const btex = new THREE.CanvasTexture(cvb);
    btex.colorSpace = THREE.SRGBColorSpace;
    boards.push({ tex: btex, cv: cvb });
    const jumbo = new THREE.Group();
    const box = outlined(new THREE.Mesh(rbox(7, 5.6, 7, 0.4), toy('#ff4d6d')), 1.02);
    jumbo.add(box);
    for (let k = 0; k < 4; k++) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.65), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false }));
      const a = (k * Math.PI) / 2;
      scr.position.set(Math.sin(a) * 3.52, 0, Math.cos(a) * 3.52);
      scr.rotation.y = a;
      jumbo.add(scr);
    }
    for (const y of [-3.2, 3.2]) {
      const rimJ = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.18, 8, 40), glow('#ffd60a', 1.4));
      rimJ.rotation.x = Math.PI / 2;
      rimJ.position.y = y;
      jumbo.add(rimJ);
    }
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 30, 8), toy('#2b2d42'));
    cable.position.y = 17.8;
    jumbo.add(cable);
    jumbo.position.set(0, 13.5, 0);
    g.add(shadowy(jumbo, false, false));
    // mare di succo d'arancia e frutta gigante
    const seaGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    const sea = new THREE.Mesh(seaGeo, toy('#ff9f1c', { roughness: 0.15, clearcoat: 1, emissive: '#c45c00', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -16;
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    const floaters: THREE.Object3D[] = [];
    for (let i = 0; i < 12; i++) {
      const f = giantFruit(i % 6);
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const r = 20 + (i % 3) * 5;
      f.position.set(Math.sin(a) * r, -15.2, Math.cos(a) * r);
      f.userData.ph = Math.random() * 6;
      f.userData.y0 = -15.2;
      g.add(f);
      floaters.push(f);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 22, 12), toy(i % 2 ? '#ff4d6d' : '#3a86ff'));
      straw.position.set(Math.sin(a) * 30, -8, Math.cos(a) * 30);
      straw.rotation.z = 0.25 * (i % 2 ? 1 : -1);
      g.add(straw);
      const umbrella = outlined(new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 12), toy(['#ffbe0b', '#06d6a0', '#ff70a6'][i % 3])), 1.03);
      umbrella.position.set(straw.position.x - Math.sin(straw.rotation.z) * 11, 3.2, straw.position.z);
      g.add(umbrella);
    }
    sh.left = sh.bottom = -15;
    sh.right = sh.top = 15;
    world.sun.target.position.set(0, 0, 0);
    let boardKey = '';
    update = (t, dt, info) => {
      const F = info.fruit;
      tiles.forEach((tl, i) => {
        const want = F?.grid ? F.grid[i] : -1;
        if (want !== tl.face) {
          tl.face = want;
          tl.top.map = want >= 0 ? faces[want] : hidden;
          tl.top.needsUpdate = true;
          tl.pop = 1;
        }
        const open = F ? F.open[i] !== false : true;
        if (!open) {
          tl.vy += 30 * dt;
          tl.y = Math.max(-48, tl.y - tl.vy * dt);
        } else {
          if (tl.y < -22) tl.y = -22;
          tl.vy = 0;
          tl.y += (0 - tl.y) * Math.min(1, dt * 6);
        }
        tl.pop = Math.max(0, tl.pop - dt * 4);
        // prima del crollo tremano tutte
        const warn = F?.phase === 'HIDE' && F.endsAt - info.now < 900 ? 0.06 : 0;
        tl.g.position.y = tl.y + Math.sin(t * 50 + i) * warn;
        tl.g.rotation.z = open ? 0 : tl.y * -0.01 * (i % 2 ? 1 : -1);
        tl.g.scale.set(1 + tl.pop * 0.12, 1, 1 + tl.pop * 0.12);
      });
      const left = F ? Math.max(0, Math.ceil((F.endsAt - info.now) / 1000)) : 0;
      const key = `${F?.phase ?? '-'}|${F?.target ?? -1}|${left}`;
      if (key !== boardKey) {
        boardKey = key;
        for (const b of boards) {
          const c = b.cv.getContext('2d')!;
          c.fillStyle = '#1d0f3d';
          c.fillRect(0, 0, 512, 384);
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = '900 52px "Lilita One", "Baloo 2", sans-serif';
          c.fillStyle = '#ffffff';
          const title = !F ? 'MACEDONIA' : F.phase === 'SHOW' ? 'MEMORIZZA!' : F.phase === 'HIDE' ? 'CORRI SU…' : F.phase === 'DROP' ? 'SALVO CHI È SU' : 'SI RIPARTE…';
          c.fillText(title, 256, 52);
          if (F && F.target !== null && F.phase !== 'RISE') {
            drawFruit(c, FRUITS[F.target], 256, 210, 200);
            c.font = '900 40px "Lilita One", "Baloo 2", sans-serif';
            c.fillStyle = '#ffd60a';
            c.fillText(FRUIT_NAMES[F.target], 256, 350);
          } else {
            c.font = '900 170px "Lilita One", "Baloo 2", sans-serif';
            c.fillStyle = '#ffd60a';
            c.fillText(F && F.phase === 'SHOW' ? String(left) : '?', 256, 220);
          }
          if (F && F.phase === 'HIDE') {
            c.fillStyle = '#ff4d6d';
            c.beginPath();
            c.arc(450, 60, 44, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#ffffff';
            c.font = '900 56px "Lilita One", sans-serif';
            c.fillText(String(left), 450, 64);
          }
          b.tex.needsUpdate = true;
        }
      }
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.08 + t * 1.4) * 0.6 + Math.cos(seaBase[i + 1] * 0.07 + t) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
      for (const f of floaters) {
        f.position.y = f.userData.y0 + Math.sin(t * 1.2 + f.userData.ph) * 0.5;
        f.rotation.y += dt * 0.3;
      }
      jumbo.rotation.y = Math.sin(t * 0.3) * 0.25;
      jumbo.position.y = 13.5 + Math.sin(t * 0.9) * 0.25;
    };
  } else if (kind === 'CALCIO') {
    // stadio del calcetto: prato a strisce, sponde con il vetro, porte con la rete, tribune piene e tabellone
    const S = 25.6; // pixel per metro
    const fieldTex = canvasTex(512, 820, (c) => {
      for (let i = 0; i < 10; i++) {
        c.fillStyle = i % 2 ? '#5fc46b' : '#52b55e';
        c.fillRect(0, i * 82, 512, 82);
      }
      c.strokeStyle = '#ffffff';
      c.lineWidth = 7;
      c.strokeRect(8, 8, 496, 804);
      c.beginPath();
      c.moveTo(8, 410);
      c.lineTo(504, 410);
      c.stroke();
      c.beginPath();
      c.arc(256, 410, 3.2 * S, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(256, 410, 9, 0, Math.PI * 2);
      c.fill();
      const bw = (PITCH.goalW + 2.6) * S;
      c.strokeRect(256 - bw, 8, bw * 2, 4.5 * S);
      c.strokeRect(256 - bw, 812 - 4.5 * S, bw * 2, 4.5 * S);
      c.beginPath();
      c.arc(256, 8 + 4.5 * S, 2 * S, 0, Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(256, 812 - 4.5 * S, 2 * S, Math.PI, Math.PI * 2);
      c.stroke();
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(PITCH.halfW * 2, PITCH.halfL * 2), matte('#ffffff', { map: fieldTex }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    g.add(field);
    const base = new THREE.Mesh(rbox(PITCH.halfW * 2 + 14, 3, PITCH.halfL * 2 + 12, 0.8), toy('#3f8f4a'));
    base.position.y = -1.52;
    base.receiveShadow = true;
    g.add(base);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(20, 6, 12, 8), toy('#c08457'));
    under.position.y = -9;
    g.add(under);
    // sponde basse (colorate come le squadre) e vetro sopra
    const glass = new THREE.MeshPhysicalMaterial({ color: '#d8f3ff', transparent: true, opacity: 0.16, roughness: 0.05, clearcoat: 1, depthWrite: false });
    const railM = [toy(TEAM_COLORS[0]), toy(TEAM_COLORS[1])];
    for (const sx of [-1, 1]) {
      const w = outlined(new THREE.Mesh(rbox(0.6, 1.2, PITCH.halfL * 2 + 1.2, 0.2), toy('#ffffff')), 1.02);
      w.position.set(sx * (PITCH.halfW + 0.3), 0.6, 0);
      g.add(shadowy(w));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, PITCH.halfL * 2 + 1.2), glass);
      gl.position.set(sx * (PITCH.halfW + 0.3), 2.6, 0);
      g.add(gl);
    }
    for (const sz of [-1, 1]) {
      const team = sz < 0 ? 0 : 1; // la porta in fondo (+z) la difendono i blu
      for (const sx of [-1, 1]) {
        const len = PITCH.halfW - PITCH.goalW;
        const w = outlined(new THREE.Mesh(rbox(len, 1.2, 0.6, 0.2), railM[team]), 1.02);
        w.position.set(sx * (PITCH.goalW + len / 2), 0.6, sz * (PITCH.halfL + 0.3));
        g.add(shadowy(w));
        const gl = new THREE.Mesh(new THREE.BoxGeometry(len, 2.8, 0.1), glass);
        gl.position.set(sx * (PITCH.goalW + len / 2), 2.6, sz * (PITCH.halfL + 0.3));
        g.add(gl);
      }
      g.add(soccerGoal(TEAM_COLORS[team], sz));
    }
    // tribune con il pubblico che salta
    const crowdGeo = new THREE.BoxGeometry(0.7, 1.1, 0.5);
    const crowd = new THREE.InstancedMesh(crowdGeo, toy('#ffffff'), 240);
    const crowdBase: { x: number; y: number; z: number; ph: number }[] = [];
    const dummy = new THREE.Object3D();
    const crowdCols = ['#ff3b5c', '#3a86ff', '#ffd60a', '#ffffff', '#06d6a0', '#ff70a6'];
    let n = 0;
    for (const sx of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        const step = outlined(new THREE.Mesh(rbox(2, 1 + row * 1.1, 34, 0.15), toy(row % 2 ? '#8338ec' : '#6a4c93')), 1.01);
        step.position.set(sx * (PITCH.halfW + 3 + row * 2), (1 + row * 1.1) / 2 - 0.2, 0);
        g.add(shadowy(step));
        for (let k = 0; k < 30 && n < 240; k++, n++) {
          const b = { x: sx * (PITCH.halfW + 3 + row * 2) + (Math.random() - 0.5) * 0.6, y: 1 + row * 1.1 + 0.35, z: -15.5 + k * 1.07, ph: Math.random() * 6 };
          crowdBase.push(b);
          crowd.setColorAt(n, new THREE.Color(sx < 0 ? (k % 3 ? TEAM_COLORS[0] : crowdCols[(k + row) % crowdCols.length]) : k % 3 ? TEAM_COLORS[1] : crowdCols[(k + row) % crowdCols.length]));
        }
      }
    }
    crowd.castShadow = true;
    g.add(crowd);
    // fari e tabellone
    for (const [x, z] of [
      [-18, -20],
      [18, -20],
      [-18, 20],
      [18, 20],
    ]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 16, 10), toy('#adb5bd'));
      pole.position.set(x, 8, z);
      const lamp = new THREE.Mesh(rbox(3, 2, 0.5, 0.2), glow('#fff3b0', 2.2));
      lamp.position.set(x, 16, z);
      lamp.lookAt(0, 0, 0);
      g.add(pole, lamp);
    }
    const scv = document.createElement('canvas');
    scv.width = 512;
    scv.height = 192;
    const scoreTex = new THREE.CanvasTexture(scv);
    scoreTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Group();
    const bframe = outlined(new THREE.Mesh(rbox(12, 4.8, 0.6, 0.3), toy('#2b2d42')), 1.02);
    const bscr = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 4.2), new THREE.MeshBasicMaterial({ map: scoreTex, toneMapped: false }));
    bscr.position.z = 0.32;
    board.add(bframe, bscr);
    for (const lx of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 10), toy('#adb5bd'));
      leg.position.set(lx, -6.5, 0);
      board.add(leg);
    }
    board.position.set(0, 11, PITCH.halfL + 9);
    board.rotation.y = Math.PI;
    g.add(shadowy(board));
    const board2 = board.clone();
    board2.position.z = -PITCH.halfL - 9;
    board2.rotation.y = 0;
    g.add(board2);
    addBalloons(8, (i) => new THREE.Vector3((i % 2 ? 1 : -1) * 24, 9 + (i % 3) * 2, -14 + i * 4));
    sh.left = -22;
    sh.right = 22;
    sh.top = 24;
    sh.bottom = -24;
    world.sun.target.position.set(0, 0, 0);
    let scoreKey = '';
    let cheer = 0;
    update = (t, dt, info) => {
      const sc = info.score ?? [0, 0];
      const key = sc.join('-');
      if (key !== scoreKey) {
        if (scoreKey) cheer = 2.5;
        scoreKey = key;
        const c = scv.getContext('2d')!;
        c.fillStyle = '#1d0f3d';
        c.fillRect(0, 0, 512, 192);
        c.fillStyle = TEAM_COLORS[0];
        c.fillRect(0, 0, 200, 192);
        c.fillStyle = TEAM_COLORS[1];
        c.fillRect(312, 0, 200, 192);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#ffffff';
        c.font = '900 40px "Lilita One", "Baloo 2", sans-serif';
        c.fillText(TEAM_NAMES[0], 100, 40);
        c.fillText(TEAM_NAMES[1], 412, 40);
        c.font = '900 110px "Lilita One", "Baloo 2", sans-serif';
        c.fillText(String(sc[0]), 100, 125);
        c.fillText(String(sc[1]), 412, 125);
        c.fillStyle = '#ffd60a';
        c.fillText('-', 256, 110);
        scoreTex.needsUpdate = true;
      }
      cheer = Math.max(0, cheer - dt);
      crowdBase.forEach((b, i) => {
        const j = Math.abs(Math.sin(t * (cheer > 0 ? 9 : 3) + b.ph)) * (cheer > 0 ? 0.8 : 0.15);
        dummy.position.set(b.x, b.y + j, b.z);
        dummy.rotation.set(0, 0, cheer > 0 ? Math.sin(t * 7 + b.ph) * 0.3 : 0);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
      });
      crowd.instanceMatrix.needsUpdate = true;
    };
  } else if (kind === 'POMODORI') {
    // il mercato rotondo (si restringe) con le cassette, le bancarelle intorno e un mare di passata
    const cobble = canvasTex(1024, 1024, (c) => {
      c.fillStyle = '#b07d4f';
      c.fillRect(0, 0, 1024, 1024);
      for (let y = 0; y < 1024; y += 48)
        for (let x = (y / 48) % 2 ? 24 : 0; x < 1024; x += 48) {
          c.fillStyle = ['#e9c46a', '#f4a261', '#e7b07a', '#d9a066'][(x * 7 + y * 3) % 4];
          c.beginPath();
          c.roundRect(x + 3, y + 3, 42, 42, 12);
          c.fill();
        }
      c.strokeStyle = '#ffffff';
      c.lineWidth = 16;
      c.beginPath();
      c.arc(512, 512, 150, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#e63946';
      c.beginPath();
      c.arc(512, 512, 110, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2d9c4a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.beginPath();
        c.ellipse(512 + Math.cos(a) * 40, 470 + Math.sin(a) * 20, 30, 12, a, 0, Math.PI * 2);
        c.fill();
      }
    });
    const island = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(MARKET.r0, MARKET.r0, 1, 96), [toy('#9c6644'), matte('#ffffff', { map: cobble }), toy('#7f5539')]);
    disc.position.y = -0.5;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(MARKET.r0, 0.3, 14, 128), toy('#ffffff'));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.05;
    const neon = new THREE.Mesh(new THREE.TorusGeometry(MARKET.r0 + 0.02, 0.1, 8, 128), glow('#ff2e2e', 2));
    neon.rotation.x = Math.PI / 2;
    neon.position.y = -0.55;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(MARKET.r0 * 0.98, MARKET.r0 * 0.25, 7, 48), toy('#c1121f'));
    cone.position.y = -4.4;
    island.add(disc, lip, neon, cone);
    shadowy(island);
    g.add(island);
    const plankTex = canvasTex(256, 256, (c) => {
      c.fillStyle = '#e0a458';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#b5762e';
      for (let y = 0; y < 256; y += 64) c.fillRect(0, y + 56, 256, 10);
      c.strokeStyle = '#8d5524';
      c.lineWidth = 14;
      c.strokeRect(7, 7, 242, 242);
    });
    for (const b of CRATES) {
      const crate = outlined(new THREE.Mesh(rbox(b.w, b.h, b.d, 0.1), toy('#ffffff', { map: plankTex, roughness: 0.6 })), 1.03);
      crate.position.set(b.x, b.h / 2, b.z);
      g.add(shadowy(crate));
      for (let k = 0; k < 4; k++) {
        const tm = makeTomato(0.32);
        tm.position.set(b.x + (k % 2 ? 0.3 : -0.3) * (b.w / 1.3), b.h - 0.05, b.z + (k < 2 ? 0.25 : -0.25) * (b.d / 1.3));
        g.add(tm);
      }
    }
    // bancarelle (decorative, sulle isolette intorno)
    const awning = (a: string, b: string) =>
      canvasTex(256, 64, (c) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? a : b;
          c.fillRect(i * 32, 0, 32, 64);
        }
      });
    const awnings = [awning('#e63946', '#ffffff'), awning('#2d9c4a', '#ffffff'), awning('#ffbe0b', '#ffffff')];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const st = new THREE.Group();
      const isl = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 1.2, 24), toy('#9c6644'));
      isl.position.y = -0.6;
      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 24), toy('#7f5539'));
      cone2.rotation.x = Math.PI;
      cone2.position.y = -3.7;
      const table = outlined(new THREE.Mesh(rbox(4, 1, 2, 0.12), toy('#8d5524')), 1.03);
      table.position.y = 0.5;
      st.add(isl, cone2, table);
      for (const [px, pz] of [
        [-1.8, -0.8],
        [1.8, -0.8],
        [-1.8, 0.8],
        [1.8, 0.8],
      ]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), toy('#ffffff'));
        pole.position.set(px, 1.6, pz);
        st.add(pole);
      }
      const roof = outlined(new THREE.Mesh(rbox(4.6, 0.25, 2.8, 0.1), toy('#ffffff', { map: awnings[i % 3] })), 1.03);
      roof.position.y = 3.25;
      roof.rotation.x = 0.15;
      st.add(roof);
      const prod = ['#e63946', '#ffbe0b', '#2d9c4a', '#9b5de5'];
      for (let k = 0; k < 9; k++) {
        const fr = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), toy(prod[(i + k) % 4]));
        fr.position.set(-1.4 + (k % 5) * 0.7, 1.15, (k < 5 ? -0.35 : 0.35));
        st.add(fr);
      }
      st.position.set(Math.sin(a) * (MARKET.r0 + 9), 0, Math.cos(a) * (MARKET.r0 + 9));
      st.lookAt(0, 0, 0);
      g.add(shadowy(st));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const b = ((i + 1) / 6) * Math.PI * 2 + 0.5;
      const R = MARKET.r0 + 9;
      g.add(flagLine(new THREE.Vector3(Math.sin(a) * R, 4, Math.cos(a) * R), new THREE.Vector3(Math.sin(b) * R, 4, Math.cos(b) * R), 12));
    }
    // mare di passata
    const seaGeo = new THREE.PlaneGeometry(320, 320, 64, 64);
    const sea = new THREE.Mesh(seaGeo, toy('#d62828', { roughness: 0.15, clearcoat: 1, emissive: '#7a0d14', emissiveIntensity: 0.3 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -15;
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    addBalloons(8, (i) => {
      const a = (i / 8) * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a) * (MARKET.r0 + 14), 6 + (i % 3) * 3, Math.cos(a) * (MARKET.r0 + 14));
    });
    sh.left = sh.bottom = -16;
    sh.right = sh.top = 16;
    world.sun.target.position.set(0, 0, 0);
    update = (t, dt, info) => {
      const r = marketRadius(info.playT) / MARKET.r0;
      island.scale.set(r, 1, r);
      (neon.material as THREE.MeshStandardMaterial).emissiveIntensity = info.playT > MARKET.shrinkFrom - 2 ? 2.5 + Math.sin(t * 9) * 1.5 : 1.4;
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.08 + t * 1.5) * 0.6 + Math.cos(seaBase[i + 1] * 0.09 + t * 1.1) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
    };
  } else if (kind === 'CORSA') {
    // corsa pazza: pista a strisce di caramella sospesa sul mare, ostacoli che girano e che dondolano
    const stripe = (a: string, b: string, rep: [number, number]) =>
      canvasTex(128, 128, (c) => {
        c.fillStyle = a;
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = b;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(64, 0);
        c.lineTo(0, 64);
        c.fill();
        c.beginPath();
        c.moveTo(128, 0);
        c.lineTo(128, 64);
        c.lineTo(64, 128);
        c.lineTo(0, 128);
        c.fill();
      }, rep);
    const seg = (from: number, to: number, a: string, b: string) => {
      const len = to - from;
      const topM = toy('#ffffff', { map: stripe(a, b, [3, len / 4]), roughness: 0.35, clearcoat: 0.4 });
      const sideM = toy(shade(a, 0.85).getStyle());
      const m = outlined(new THREE.Mesh(rbox(RACE.halfW * 2, 1.2, len, 0.3), [sideM, sideM, topM, sideM, sideM, sideM]), 1.01);
      m.position.set(0, -0.6, (from + to) / 2);
      g.add(shadowy(m));
    };
    seg(RACE.back, 2, '#ffffff', '#e9e9ff');
    seg(2, 36, '#ff8fab', '#ffc2d1');
    seg(36, 62, '#70d6ff', '#a9e8ff');
    seg(62, RACE.gapFrom, '#ffd670', '#ffe9a8');
    seg(RACE.gapTo, RACE.front, '#9ef01a', '#c8f77a');
    // le barre che girano rasoterra
    const sweepers: THREE.Group[] = [];
    const barTex = canvasTex(256, 32, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#ffffff' : '#ff3b5c';
        c.fillRect(i * 32, 0, 32, 32);
      }
    }, [6, 1]);
    for (const sw of SWEEPERS) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(RACE.sweepR - 0.3, RACE.sweepR, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.02, sw.z);
      g.add(ring);
      const post = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.6, 24), toy('#8338ec')), 1.04);
      post.position.set(0, 0.8, sw.z);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glow('#ffd60a', 1.2));
      dome.position.set(0, 1.6, sw.z);
      g.add(shadowy(post), dome);
      const bar = new THREE.Group();
      const beam = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, RACE.sweepR * 2, 16), toy('#ffffff', { map: barTex })), 1.06);
      beam.rotation.x = Math.PI / 2;
      bar.add(beam);
      for (const e of [-1, 1]) {
        const bump = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), toy('#ffd60a')), 1.06);
        bump.position.z = e * RACE.sweepR;
        bar.add(bump);
      }
      bar.position.set(0, 0.55, sw.z);
      g.add(shadowy(bar));
      sweepers.push(bar);
    }
    // martelloni a pendolo sotto il portale
    const hammers: THREE.Group[] = [];
    const malletTex = canvasTex(128, 64, (c) => {
      c.fillStyle = '#ff9f1c';
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) c.fillRect(i * 32 + 8, 0, 12, 64);
    }, [2, 1]);
    for (const hm of HAMMERS) {
      for (const sx of [-1, 1]) {
        const post = outlined(new THREE.Mesh(rbox(1, HAMMER.pivotY + 1.2, 1, 0.3), toy('#6c4ab6')), 1.03);
        post.position.set(sx * (RACE.halfW + 1.4), (HAMMER.pivotY + 1.2) / 2 - 1.2, hm.z);
        g.add(shadowy(post));
      }
      const beam = outlined(new THREE.Mesh(rbox(RACE.halfW * 2 + 3.8, 0.9, 1, 0.3), toy('#6c4ab6')), 1.03);
      beam.position.set(0, HAMMER.pivotY + 0.4, hm.z);
      g.add(shadowy(beam));
      const pend = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, HAMMER.arm, 10), toy('#adb5bd', { metalness: 0.6 }));
      arm.position.y = -HAMMER.arm / 2;
      const head = outlined(new THREE.Mesh(new THREE.CylinderGeometry(HAMMER.headR, HAMMER.headR, HAMMER.headL, 28), [toy('#ffffff', { map: malletTex }), toy('#ff3b5c'), toy('#ff3b5c')]), 1.04);
      head.rotation.x = Math.PI / 2;
      head.position.y = -HAMMER.arm;
      pend.add(arm, head);
      pend.position.set(0, HAMMER.pivotY, hm.z);
      g.add(shadowy(pend));
      hammers.push(pend);
    }
    // file di porte (alcune finte!)
    const doorTex = canvasTex(128, 192, (c) => {
      c.fillStyle = '#ffbe0b';
      c.fillRect(0, 0, 128, 192);
      c.strokeStyle = '#d98e04';
      c.lineWidth = 10;
      c.strokeRect(14, 14, 100, 70);
      c.strokeRect(14, 100, 100, 78);
      c.font = '900 60px "Lilita One", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#1d0f3d';
      c.fillText('?', 64, 52);
    });
    const doors = new Map<string, { m: THREE.Mesh; open: boolean; v: THREE.Vector3; spin: number }>();
    DOOR_ROWS.forEach((rz, row) => {
      for (let i = 0; i <= DOOR.n; i++) {
        const post = outlined(new THREE.Mesh(rbox(0.3, 3.8, DOOR.half * 2 + 0.2, 0.1), toy('#8338ec')), 1.04);
        post.position.set(-RACE.halfW + i * DOOR.slot, 1.9, rz);
        g.add(shadowy(post));
      }
      const top = outlined(new THREE.Mesh(rbox(RACE.halfW * 2 + 0.4, 0.6, DOOR.half * 2 + 0.3, 0.15), toy('#8338ec')), 1.02);
      top.position.set(0, 4, rz);
      g.add(shadowy(top));
      for (let i = 0; i < DOOR.n; i++) {
        const dm = toy('#ffffff', { map: doorTex });
        const m = outlined(new THREE.Mesh(rbox(DOOR.slot - 0.34, 3.4, DOOR.half * 2 - 0.2, 0.12), [toy('#d98e04'), toy('#d98e04'), toy('#d98e04'), toy('#d98e04'), dm, dm]), 1.03);
        m.position.set(doorX(i), 1.7, rz);
        g.add(shadowy(m));
        doors.set(`${row}:${i}`, { m, open: false, v: new THREE.Vector3(), spin: 0 });
      }
    });
    // piattaforme mobili sopra il vuoto
    const hazard = canvasTex(128, 128, (c) => {
      c.fillStyle = '#ffd60a';
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#1d0f3d';
      for (let i = -128; i < 256; i += 40) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i + 20, 0);
        c.lineTo(i + 148, 128);
        c.lineTo(i + 128, 128);
        c.fill();
      }
      c.fillStyle = '#ffffff';
      c.fillRect(16, 16, 96, 96);
    });
    const plats: THREE.Group[] = [];
    for (let i = 0; i < PLATS.length; i++) {
      const pg = new THREE.Group();
      const side = toy('#ff70a6');
      const pm = outlined(new THREE.Mesh(rbox(PLAT.half * 2, 0.8, PLAT.half * 2, 0.2), [side, side, toy('#ffffff', { map: hazard }), side, side, side]), 1.03);
      pm.position.y = -0.4;
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 12), glow('#70d6ff', 2));
      jet.rotation.x = Math.PI;
      jet.position.y = -1.4;
      pg.add(pm, jet);
      pg.position.z = PLATS[i].z;
      g.add(shadowy(pg));
      plats.push(pg);
    }
    // bandierine dei punti di ripartenza
    for (const cz of RACE_CP.slice(1)) {
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 8), toy('#ffffff'));
        pole.position.set(sx * (RACE.halfW - 0.3), 2, cz);
        const flag = outlined(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 3), toy('#06d6a0')), 1.06);
        flag.rotation.z = (-sx * Math.PI) / 2;
        flag.position.set(sx * (RACE.halfW - 0.3) - sx * 0.7, 3.4, cz);
        g.add(pole, flag);
      }
      const line = new THREE.Mesh(new THREE.PlaneGeometry(RACE.halfW * 2, 0.4), glow('#06d6a0', 0.5));
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, cz);
      g.add(line);
    }
    g.add(finishArch(RACE.halfW * 2 - 0.6, RACE.finish));
    g.add(flagLine(new THREE.Vector3(-RACE.halfW, 7, 4), new THREE.Vector3(RACE.halfW, 7, 4)));
    g.add(flagLine(new THREE.Vector3(-RACE.halfW, 7, 80), new THREE.Vector3(RACE.halfW, 7, 80)));
    // il mare sotto
    const seaGeo = new THREE.PlaneGeometry(200, 400, 40, 80);
    const sea = new THREE.Mesh(seaGeo, toy('#38cbd8', { roughness: 0.1, clearcoat: 1, emissive: '#0b7285', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -18, 50);
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    addBalloons(14, (i) => new THREE.Vector3((i % 2 ? 1 : -1) * (RACE.halfW + 5), 6 + (i % 3) * 2.5, -4 + i * 8.5));
    sh.left = -16;
    sh.right = 16;
    sh.top = 30;
    sh.bottom = -30;
    world.sun.target.position.set(0, 0, 0);
    const sunOff = new THREE.Vector3(20, 34, 26);
    update = (t, dt, info) => {
      SWEEPERS.forEach((_, i) => (sweepers[i].rotation.y = sweepAngle(i, info.playT)));
      HAMMERS.forEach((_, i) => (hammers[i].rotation.z = hammerHead(i, info.playT).a));
      PLATS.forEach((_, i) => {
        plats[i].position.x = platX(i, info.playT);
        (plats[i].children[1] as THREE.Mesh).scale.y = 0.8 + Math.random() * 0.4;
      });
      const open = new Set(info.doors);
      for (const [key, d] of doors) {
        if (open.has(key) && !d.open) {
          // la porta vola via in avanti girando
          d.open = true;
          d.v.set((Math.random() - 0.5) * 4, 7, 9);
          d.spin = (Math.random() < 0.5 ? -1 : 1) * 6;
        }
        if (!open.has(key) && d.open) {
          d.open = false;
          d.m.visible = true;
          d.m.position.set(doorX(Number(key.split(':')[1])), 1.7, DOOR_ROWS[Number(key.split(':')[0])]);
          d.m.rotation.set(0, 0, 0);
        }
        if (d.open && d.m.visible) {
          d.v.y -= 22 * dt;
          d.m.position.addScaledVector(d.v, dt);
          d.m.rotation.x += d.spin * dt;
          if (d.m.position.y < -20) d.m.visible = false;
        }
      }
      // l'ombra segue chi gioca (la pista è lunga)
      world.sun.target.position.set(0, 0, Math.max(RACE.back + 20, Math.min(RACE.front - 20, info.me.z + 8)));
      world.sun.position.copy(world.sun.target.position).add(sunOff);
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.09 + t * 1.3) * 0.6 + Math.cos(seaBase[i + 1] * 0.07 + t) * 0.5;
      seaGeo.attributes.position.needsUpdate = true;
    };
  }
  world.sun.position.copy(world.sun.target.position).add(new THREE.Vector3(20, 34, 26));
  sh.updateProjectionMatrix();
  world.update = (t, dt, info) => {
    for (const b of balloons) {
      b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.phase) * 0.6;
      b.rotation.z = Math.sin(t * 0.6 + b.userData.phase) * 0.12;
    }
    update(t, dt, info);
  };
}

function makeChair(color: string) {
  const g = new THREE.Group();
  const m = toy(color);
  const seat = outlined(new THREE.Mesh(rbox(1.15, 0.24, 1.15, 0.1), m), 1.05);
  seat.position.y = 0.55;
  const back = outlined(new THREE.Mesh(rbox(1.15, 1.1, 0.22, 0.1), m), 1.04);
  back.position.set(0, 1.15, -0.46);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.22, 5), glow('#fff3b0', 1));
  star.position.set(0, 1.2, -0.34);
  g.add(seat, back, star);
  for (const [x, z] of [[-0.47, -0.47], [0.47, -0.47], [-0.47, 0.47], [0.47, 0.47]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), toy('#ffffff'));
    leg.position.set(x, 0.27, z);
    g.add(leg);
  }
  return shadowy(g);
}

// forchettone piantato nella salita
function forkPost() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 0.9, roughness: 0.2 });
  const handle = outlined(new THREE.Mesh(new THREE.CylinderGeometry(POST_R * 0.55, POST_R * 0.6, 2.6, 20), toy('#ffbe0b')), 1.05);
  handle.position.y = 1.3;
  const neck = new THREE.Mesh(rbox(POST_R * 1.8, 0.4, 0.3, 0.1), steel);
  neck.position.y = 2.8;
  g.add(handle, neck);
  for (let i = 0; i < 4; i++) {
    const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.4, 8), steel);
    tine.position.set(-0.45 + i * 0.3, 3.65, 0);
    g.add(tine);
  }
  return shadowy(g);
}

// polpetta gigante (con un po' di sugo e una fogliolina di basilico)
const meatTex = (() => {
  let cache: THREE.Texture | null = null;
  return () =>
    (cache ??= canvasTex(256, 128, (c) => {
      c.fillStyle = '#8a4b2a';
      c.fillRect(0, 0, 256, 128);
      for (let k = 0; k < 600; k++) {
        const r = Math.random();
        c.fillStyle = r < 0.33 ? '#6e3a1f' : r < 0.66 ? '#a45d34' : '#c0392b';
        c.beginPath();
        c.arc(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 3, 0, Math.PI * 2);
        c.fill();
      }
    }));
})();
const MEAT_GEO = new THREE.IcosahedronGeometry(SLOPE.ballR, 3);
function meatball() {
  const g = new THREE.Group();
  const ball = outlined(new THREE.Mesh(MEAT_GEO, new THREE.MeshStandardMaterial({ map: meatTex(), roughness: 0.75, bumpMap: meatTex(), bumpScale: 2 })), 1.04);
  const sauce = new THREE.Mesh(new THREE.SphereGeometry(SLOPE.ballR * 1.01, 24, 12, 0, Math.PI * 2, 0, 0.9), toy('#d62828', { roughness: 0.15, clearcoat: 1 }));
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), toy('#2d6a4f'));
  leaf.scale.set(1, 0.3, 0.6);
  leaf.position.y = SLOPE.ballR * 1.02;
  g.add(ball, sauce, leaf);
  return shadowy(g, true, false);
}

// la ciabatta della nonna (rosa, con il pompon)
function slipper() {
  const g = new THREE.Group();
  const sole = outlined(new THREE.Mesh(rbox(1.8, 0.35, 4.2, 0.17), toy('#ff8fab')), 1.04);
  const strap = outlined(new THREE.Mesh(rbox(1.9, 0.7, 1.4, 0.3), toy('#ff4d6d')), 1.04);
  strap.position.set(0, 0.45, 0.9);
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 2), toy('#ffffff'));
  pom.position.set(0, 0.95, 1.1);
  g.add(sole, strap, pom);
  g.scale.setScalar(1.4);
  return shadowy(g, true, false);
}

// la nonna: crocchia grigia, occhiali, grembiule a fiori, braccio con la ciabatta
export function makeNonna() {
  const g = new THREE.Group();
  const dress = outlined(new THREE.Mesh(rbox(1.5, 1.7, 1, 0.4), toy('#6a4c93')), 1.04);
  dress.position.y = 1.3;
  const apron = new THREE.Mesh(rbox(1.1, 1.3, 0.1, 0.05), toy('#ffffff'));
  apron.position.set(0, 1.2, 0.52);
  const head = outlined(new THREE.Mesh(rbox(1.1, 1.05, 1, 0.38), toy('#ffd8b1')), 1.04);
  head.position.y = 2.75;
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), toy('#c9c9c9'));
  bun.position.set(0, 3.4, -0.25);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), toy('#d9d9d9'));
  hair.position.y = 2.95;
  const glasses = new THREE.Group();
  for (const x of [-0.25, 0.25]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), toy('#222222'));
    lens.position.set(x, 2.82, 0.52);
    glasses.add(lens);
  }
  const mouth = new THREE.Mesh(rbox(0.36, 0.08, 0.05, 0.02), toy('#8b2635'));
  mouth.position.set(0, 2.5, 0.52);
  const arm = new THREE.Group();
  arm.position.set(0.85, 2, 0);
  const armMesh = new THREE.Mesh(rbox(0.35, 1.2, 0.35, 0.15), toy('#6a4c93'));
  armMesh.position.y = 0.55;
  const shoe = slipper();
  shoe.scale.setScalar(0.35);
  shoe.position.set(0, 1.25, 0.3);
  arm.add(armMesh, shoe);
  g.add(dress, apron, head, bun, hair, glasses, mouth, arm);
  g.userData.arm = arm;
  return shadowy(g);
}

// la gallina d'oro (luccica!)
export function makeHen() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.85, roughness: 0.22, emissive: '#8a5a00', emissiveIntensity: 0.35 });
  const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), gold), 1.06);
  body.scale.set(1, 0.85, 1.25);
  body.position.y = 0.75;
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), gold), 1.07);
  head.position.set(0, 1.25, 0.45);
  const red = toy('#e63946');
  for (let i = 0; i < 3; i++) {
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), red);
    comb.position.set(0, 1.55, 0.35 + i * 0.1);
    g.add(comb);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 10), toy('#ff9f1c'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.22, 0.78);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), red);
  wattle.position.set(0, 1.08, 0.72);
  for (const x of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toy('#111111'));
    eye.position.set(x, 1.32, 0.68);
    g.add(eye);
  }
  const wings: THREE.Mesh[] = [];
  for (const x of [-0.45, 0.45]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), gold);
    w.scale.set(0.35, 0.7, 1);
    w.position.set(x, 0.8, -0.05);
    wings.push(w);
    g.add(w);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 12), gold);
  tail.position.set(0, 1.05, -0.65);
  tail.rotation.x = -0.8;
  for (const x of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), toy('#ff9f1c'));
    leg.position.set(x, 0.2, 0);
    g.add(leg);
  }
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 32), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.7, toneMapped: false, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  g.add(body, head, beak, wattle, tail, halo);
  g.userData.wings = wings;
  g.userData.halo = halo;
  return shadowy(g, true, false);
}

// il fucile del cecchino (si vede in prima persona)
export function makeGun() {
  const g = new THREE.Group();
  const purple = toy('#7b2cbf');
  const dark = toy('#2b2d42');
  const body = outlined(new THREE.Mesh(rbox(0.16, 0.2, 0.9, 0.05), purple), 1.05);
  const stock = outlined(new THREE.Mesh(rbox(0.14, 0.24, 0.42, 0.06), toy('#ffd60a')), 1.05);
  stock.position.set(0, -0.05, 0.6);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 12), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.78);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 16), dark);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.17, -0.05);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), glow('#38cbff', 2));
  lens.position.set(0, 0.17, -0.265);
  lens.rotation.y = Math.PI;
  const grip = new THREE.Mesh(rbox(0.1, 0.24, 0.12, 0.04), dark);
  grip.position.set(0, -0.18, 0.15);
  grip.rotation.x = 0.3;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false, transparent: true }));
  flash.position.set(0, 0.03, -1.2);
  flash.visible = false;
  g.add(body, stock, barrel, scope, lens, grip, flash);
  g.userData.flash = flash;
  return g;
}

// il petardo di Capodanno (con la miccia che fa le scintille)
export function makeBomb() {
  const g = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 20), toy('#e63946')), 1.06);
  for (const y of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 20), toy('#ffd60a'));
    band.position.y = y;
    g.add(band);
  }
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), toy('#333333'));
  fuse.position.y = 0.62;
  fuse.rotation.z = 0.3;
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false }));
  spark.position.set(0.06, 0.85, 0);
  g.add(body, fuse, spark);
  g.userData.spark = spark;
  g.userData.body = body;
  return shadowy(g, true, false);
}

// frutta disegnata a mano su canvas (piastrelle e tabelloni della macedonia), dentro un quadrato di lato s
export function drawFruit(c: CanvasRenderingContext2D, f: string, cx: number, cy: number, s: number) {
  c.save();
  c.translate(cx, cy);
  c.scale(s / 100, s / 100);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = 6;
  c.strokeStyle = '#1d0f3d';
  const blob = (fill: string, draw: () => void) => {
    c.beginPath();
    draw();
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  const leaf = (x: number, y: number, a: number, w = 16) =>
    blob('#2d9c4a', () => {
      c.ellipse(x, y, w, w * 0.45, a, 0, Math.PI * 2);
    });
  const shine = (x: number, y: number, rx: number, ry: number) => {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
    c.fill();
  };
  if (f === 'mela') {
    blob('#e63946', () => {
      c.moveTo(0, -24);
      c.bezierCurveTo(30, -46, 54, -10, 38, 18);
      c.bezierCurveTo(28, 44, 8, 44, 0, 36);
      c.bezierCurveTo(-8, 44, -28, 44, -38, 18);
      c.bezierCurveTo(-54, -10, -30, -46, 0, -24);
    });
    c.beginPath();
    c.moveTo(0, -24);
    c.quadraticCurveTo(2, -38, 10, -44);
    c.lineWidth = 8;
    c.stroke();
    leaf(18, -38, -0.5);
    shine(-20, -8, 9, 14);
  } else if (f === 'banana') {
    blob('#ffd60a', () => {
      c.moveTo(-38, -30);
      c.quadraticCurveTo(-34, 38, 42, 30);
      c.quadraticCurveTo(48, 24, 40, 16);
      c.quadraticCurveTo(-12, 18, -24, -32);
      c.closePath();
    });
    c.fillStyle = '#6b3e1f';
    c.fillRect(-40, -38, 14, 10);
    c.beginPath();
    c.moveTo(-18, -10);
    c.quadraticCurveTo(-10, 18, 22, 22);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(160,110,0,0.6)';
    c.stroke();
  } else if (f === 'uva') {
    const pts = [
      [-20, -16],
      [0, -16],
      [20, -16],
      [-10, 2],
      [10, 2],
      [-20, 2],
      [20, 2],
      [0, 20],
      [-10, 36],
      [10, 20],
    ];
    for (const [x, y] of pts)
      blob('#8e44ad', () => {
        c.arc(x, y, 13, 0, Math.PI * 2);
      });
    for (const [x, y] of pts) shine(x - 4, y - 4, 3, 4);
    c.beginPath();
    c.moveTo(0, -28);
    c.lineTo(4, -44);
    c.lineWidth = 7;
    c.stroke();
    leaf(18, -38, -0.3, 18);
  } else if (f === 'anguria') {
    blob('#2d9c4a', () => {
      c.moveTo(-46, -16);
      c.lineTo(46, -16);
      c.arc(0, -16, 46, 0, Math.PI);
    });
    blob('#ffffff', () => {
      c.moveTo(-38, -16);
      c.lineTo(38, -16);
      c.arc(0, -16, 38, 0, Math.PI);
    });
    blob('#ff4d6d', () => {
      c.moveTo(-33, -16);
      c.lineTo(33, -16);
      c.arc(0, -16, 33, 0, Math.PI);
    });
    c.fillStyle = '#1d0f3d';
    for (const [x, y] of [
      [-16, -2],
      [0, 6],
      [16, -2],
      [-8, -10],
      [8, -10],
      [0, -4],
    ]) {
      c.beginPath();
      c.ellipse(x, y, 3, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
  } else if (f === 'limone') {
    blob('#fff04d', () => {
      c.moveTo(-46, 4);
      c.quadraticCurveTo(-40, -32, 0, -30);
      c.quadraticCurveTo(40, -32, 46, 4);
      c.quadraticCurveTo(40, 36, 0, 34);
      c.quadraticCurveTo(-40, 36, -46, 4);
    });
    leaf(20, -32, -0.4);
    shine(-16, -12, 12, 7);
  } else {
    for (const [x, y] of [
      [-18, 22],
      [18, 26],
    ]) {
      c.beginPath();
      c.moveTo(x, y - 14);
      c.quadraticCurveTo(x * 0.3, -14, 4, -38);
      c.lineWidth = 6;
      c.strokeStyle = '#2d6a4f';
      c.stroke();
    }
    c.strokeStyle = '#1d0f3d';
    for (const [x, y] of [
      [-18, 22],
      [18, 26],
    ])
      blob('#d90429', () => {
        c.arc(x, y, 17, 0, Math.PI * 2);
      });
    shine(-23, 16, 4, 6);
    shine(13, 20, 4, 6);
    leaf(18, -36, -0.4, 18);
  }
  c.restore();
}

// frutta gigante che galleggia (decorazione della macedonia): 0 mela, 1 banana, 2 uva, 3 anguria, 4 limone, 5 ciliegie
function giantFruit(i: number) {
  const g = new THREE.Group();
  const leafM = toy('#2d9c4a');
  if (i === 0) {
    const m = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.8, 28, 20), toy('#e63946')), 1.04);
    m.scale.y = 0.9;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.9, 8), toy('#6b3e1f'));
    st.position.y = 1.9;
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), leafM);
    lf.scale.set(1, 0.25, 0.5);
    lf.position.set(0.5, 2.05, 0);
    g.add(m, st, lf);
  } else if (i === 1) {
    const m = outlined(new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.5, 14, 28, Math.PI * 0.8), toy('#ffd60a')), 1.05);
    m.rotation.set(Math.PI / 2, 0, 0.6);
    g.add(m);
  } else if (i === 2) {
    const mat = toy('#8e44ad');
    for (let k = 0; k < 10; k++) {
      const b = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat), 1.07);
      const row = k < 4 ? 0 : k < 7 ? 1 : k < 9 ? 2 : 3;
      b.position.set((k - [0, 4, 7, 9][row] - (3 - row) / 2) * 1.0, -row * 0.85 + 1.2, (k % 2) * 0.4);
      g.add(b);
    }
  } else if (i === 3) {
    const tex = canvasTex(256, 128, (c) => {
      c.fillStyle = '#4caf50';
      c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#1b5e20';
      for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 12, 128);
    });
    const m = outlined(new THREE.Mesh(new THREE.SphereGeometry(2, 28, 20), toy('#ffffff', { map: tex })), 1.04);
    m.scale.set(1.35, 1, 1);
    g.add(m);
  } else if (i === 4) {
    const m = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), toy('#fff04d')), 1.05);
    m.scale.set(1.35, 1, 1);
    for (const sx of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 10), toy('#fff04d'));
      tip.rotation.z = (-sx * Math.PI) / 2;
      tip.position.x = sx * 2.1;
      g.add(tip);
    }
    g.add(m);
  } else {
    for (const sx of [-1, 1]) {
      const b = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), toy('#d90429')), 1.05);
      b.position.set(sx * 0.9, 0, 0);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), toy('#2d6a4f'));
      st.position.set(sx * 0.45, 1.6, 0);
      st.rotation.z = sx * 0.4;
      g.add(b, st);
    }
  }
  return shadowy(g, true, false);
}

// porta del calcetto con la rete (sz = -1 in fondo dietro ai rossi, +1 dietro ai blu)
function soccerGoal(color: string, sz: number) {
  const g = new THREE.Group();
  const frame = toy(color);
  const W = PITCH.goalW;
  const H = PITCH.goalH;
  const D = PITCH.goalD;
  for (const sx of [-1, 1]) {
    const post = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, H, 14), toy('#ffffff')), 1.08);
    post.position.set(sx * W, H / 2, 0);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H, 10), frame);
    back.position.set(sx * W, H / 2, sz * D);
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, D, 10), frame);
    topBar.rotation.x = Math.PI / 2;
    topBar.position.set(sx * W, H, (sz * D) / 2);
    g.add(post, back, topBar);
  }
  const bar = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, W * 2 + 0.44, 14), toy('#ffffff')), 1.08);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = H;
  g.add(bar);
  const netTex = canvasTex(128, 128, (c) => {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 5;
    for (let i = 0; i <= 128; i += 16) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 128);
      c.moveTo(0, i);
      c.lineTo(128, i);
      c.stroke();
    }
  }, [4, 2]);
  const net = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: '#f0f0ff' });
  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H), net);
  backNet.position.set(0, H / 2, sz * D);
  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D), net);
  topNet.rotation.x = Math.PI / 2;
  topNet.position.set(0, H, (sz * D) / 2);
  g.add(backNet, topNet);
  for (const sx of [-1, 1]) {
    const sn = new THREE.Mesh(new THREE.PlaneGeometry(D, H), net);
    sn.rotation.y = Math.PI / 2;
    sn.position.set(sx * W, H / 2, (sz * D) / 2);
    g.add(sn);
  }
  const floorIn = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D), matte(shade(color, 0.55).getStyle()));
  floorIn.rotation.x = -Math.PI / 2;
  floorIn.position.set(0, 0.01, (sz * D) / 2);
  g.add(floorIn);
  g.position.z = sz * PITCH.halfL;
  return shadowy(g, true, false);
}

// il pallone gigante del calcetto (pentagoni neri su bianco)
export function makeSoccerBall() {
  const tex = canvasTex(512, 256, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#1d0f3d';
    const penta = (x: number, y: number, r: number, sx = 1) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(x + Math.cos(a) * r * sx, y + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    };
    for (let k = 0; k < 5; k++) {
      penta(k * 102 + 51, 70, 28, 1.3);
      penta(k * 102 + 0, 170, 28, 1.3);
      penta(k * 102 + 102, 170, 28, 1.3);
    }
    c.fillRect(0, 0, 512, 16);
    c.fillRect(0, 240, 512, 16);
  });
  const g = new THREE.Group();
  const ball = outlined(new THREE.Mesh(new THREE.SphereGeometry(PITCH.ballR, 40, 28), toy('#ffffff', { map: tex, roughness: 0.35, clearcoat: 0.8 })), 1.04);
  g.add(ball);
  g.userData.ball = ball;
  return shadowy(g, true, false);
}

// pomodoro (quelli che si lanciano e quelli nelle cassette)
export function makeTomato(r = 0.32) {
  const g = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), toy('#e63946', { clearcoat: 0.9, roughness: 0.25 })), 1.08);
  body.scale.y = 0.86;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 0.35, 5), toy('#2d9c4a'));
  leaves.position.y = r * 0.85;
  leaves.rotation.x = Math.PI;
  g.add(body, leaves);
  return shadowy(g, true, false);
}

// SPLAT: schizzi di pomodoro (e una macchia per terra se cade sul pavimento)
const splatTex = (() => {
  let cache: THREE.Texture | null = null;
  return () =>
    (cache ??= canvasTex(256, 256, (c) => {
      c.fillStyle = '#d62828';
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r = 70 + (i % 2 ? 26 : 0) + Math.sin(i * 7) * 12;
        c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      c.fill();
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2;
        c.beginPath();
        c.arc(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112, 6 + Math.random() * 9, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(105, 100, 26, 14, -0.6, 0, Math.PI * 2);
      c.fill();
    }));
})();
export function splat(world: World, x: number, y: number, z: number, decal: boolean) {
  burst(world, x, y, z, ['#e63946', '#d62828', '#ff6b6b', '#2d9c4a'], 26, 5);
  if (!decal) return;
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ map: splatTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
  m.scale.setScalar(0.3);
  const g = new THREE.Group();
  g.position.set(x, y + 0.03, z);
  g.add(m);
  g.userData.life = 6;
  g.userData.max = 6;
  g.userData.kind = 'decal';
  world.fx.add(g);
}

// scritta a fumetto che salta fuori ("SBAM!", "SCHIVATA!")
export function popText(world: World, x: number, y: number, z: number, text: string, color = '#ffd60a', opts: { life?: number; scale?: number } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 160;
  const c = cv.getContext('2d')!;
  c.font = '900 92px "Lilita One", "Baloo 2", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 22;
  c.strokeStyle = '#1d0f3d';
  c.strokeText(text, 256, 84);
  c.fillStyle = color;
  c.fillText(text, 256, 80);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
  const life = opts.life ?? 0.9;
  const k = opts.scale ?? 1;
  sp.scale.set(3.2 * k, k, 1);
  sp.renderOrder = 20;
  sp.userData.v = new THREE.Vector3(0, (2.2 * 0.9) / Math.max(0.9, life), 0);
  sp.userData.k = k;
  const g = new THREE.Group();
  g.position.set(x, y + 2.6, z);
  g.add(sp);
  g.userData.life = life;
  g.userData.max = life;
  g.userData.kind = 'text';
  world.fx.add(g);
}

// ---------------------------------------------------------------- personaggi a blocchetti (proporzioni cartoon)

export interface Avatar {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  label: THREE.Sprite;
  squash: number;
  wasAir: boolean;
  phase: number;
  dustAt: number;
  face: THREE.Mesh;
  expr: string;
  shockUntil: number; // faccia spaventata dopo una spinta
  ring: THREE.Mesh; // anello colorato per terra (squadra del calcetto)
  deco: THREE.Group; // minigiochi a moduli: decorazioni attaccate al personaggio (si svuota a ogni minigioco)
  headDeco: THREE.Group; // … e alla testa
}

const faceTex = (() => {
  let cache: THREE.Texture | null = null;
  return () =>
    (cache ??= canvasTex(256, 256, (c) => {
      // occhioni con i riflessi, guance rosa e sorriso
      for (const x of [84, 172]) {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.ellipse(x, 108, 30, 36, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#1b1b2f';
        c.beginPath();
        c.ellipse(x + 3, 114, 20, 26, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(x + 10, 102, 8, 0, Math.PI * 2);
        c.arc(x - 4, 124, 4, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,110,150,0.55)';
      c.beginPath();
      c.ellipse(52, 162, 18, 11, 0, 0, Math.PI * 2);
      c.ellipse(204, 162, 18, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#5a1a2b';
      c.beginPath();
      c.moveTo(102, 158);
      c.quadraticCurveTo(128, 200, 154, 158);
      c.closePath();
      c.fill();
      c.fillStyle = '#ff7a9c';
      c.beginPath();
      c.ellipse(128, 176, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
    }));
})();

// altre facce: spavento (quando si vola via) e gioia (balletto)
const extraFaces: Record<string, THREE.Texture> = {};
function faceFor(kind: 'happy' | 'shock' | 'joy') {
  if (kind === 'happy') return faceTex();
  return (extraFaces[kind] ??= canvasTex(256, 256, (c) => {
    if (kind === 'shock') {
      for (const x of [84, 172]) {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(x, 104, 36, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#1b1b2f';
        c.beginPath();
        c.arc(x, 104, 12, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#3d0c1a';
      c.beginPath();
      c.ellipse(128, 178, 24, 30, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7fd3ff';
      c.beginPath();
      c.moveTo(218, 40);
      c.quadraticCurveTo(238, 78, 218, 86);
      c.quadraticCurveTo(198, 78, 218, 40);
      c.fill();
    } else {
      c.strokeStyle = '#1b1b2f';
      c.lineWidth = 12;
      c.lineCap = 'round';
      for (const x of [84, 172]) {
        c.beginPath();
        c.arc(x, 118, 24, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      c.fillStyle = '#5a1a2b';
      c.beginPath();
      c.moveTo(86, 150);
      c.quadraticCurveTo(128, 222, 170, 150);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,110,150,0.6)';
      c.beginPath();
      c.ellipse(46, 160, 20, 12, 0, 0, Math.PI * 2);
      c.ellipse(210, 160, 20, 12, 0, 0, Math.PI * 2);
      c.fill();
    }
  }));
}

// maglietta con una fantasia diversa per ognuno (righe, pois, stella, fascia)
function shirtTex(color: string, h: number) {
  return canvasTex(128, 128, (c) => {
    c.fillStyle = color;
    c.fillRect(0, 0, 128, 128);
    const light = shade(color, 1.4).getStyle();
    const dark = shade(color, 0.65).getStyle();
    const k = h % 4;
    if (k === 0) {
      c.fillStyle = light;
      for (let y = 8; y < 128; y += 32) c.fillRect(0, y, 128, 12);
    } else if (k === 1) {
      c.fillStyle = light;
      for (let y = 12; y < 128; y += 26) for (let x = (y / 26) % 2 ? 0 : 13; x < 128; x += 26) {
        c.beginPath();
        c.arc(x, y, 6, 0, Math.PI * 2);
        c.fill();
      }
    } else if (k === 2) {
      c.fillStyle = light;
      c.strokeStyle = dark;
      c.lineWidth = 5;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 18 : 40;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
    } else {
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(0, 40);
      c.lineTo(128, 88);
      c.lineTo(128, 118);
      c.lineTo(0, 70);
      c.fill();
    }
  });
}

function nameSprite(name: string, me: boolean) {
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d')!;
  c.font = 'bold 44px "Baloo 2", sans-serif';
  const w = Math.ceil(c.measureText(name).width) + 44;
  cv.width = w;
  cv.height = 68;
  c.font = 'bold 44px "Baloo 2", sans-serif';
  c.fillStyle = me ? '#ffbe0b' : 'rgba(20, 10, 60, 0.72)';
  c.beginPath();
  c.roundRect(2, 6, w - 4, 56, 28);
  c.fill();
  c.strokeStyle = '#ffffff';
  c.lineWidth = 4;
  c.stroke();
  c.fillStyle = me ? '#1b1b1b' : '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(name, w / 2, 36);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true, toneMapped: false }));
  s.scale.set((w / 68) * 0.42, 0.42, 1);
  s.position.y = 2.6;
  s.renderOrder = 10;
  return s;
}

function hashOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function makeAvatar(id: string, color: string, name: string, me: boolean): Avatar {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shirt = toy('#ffffff', { map: shirtTex(color, hashOf(id)) });
  const pants = toy(shade(color, 0.5), { clearcoat: 0.4 });
  const skin = toy('#ffd23f');
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, k = 1.07) => outlined(new THREE.Mesh(geo, m), k);
  const torso = part(rbox(0.86, 0.72, 0.52, 0.18), shirt);
  torso.position.y = 0.86;
  // pancia più chiara
  const belly = new THREE.Mesh(rbox(0.5, 0.36, 0.06, 0.03), toy(shade(color, 1.35)));
  belly.position.set(0, -0.06, 0.26);
  torso.add(belly);
  body.add(torso);
  const head = new THREE.Group();
  head.position.y = 1.72;
  const skull = part(rbox(0.98, 0.94, 0.94, 0.3), skin, 1.05);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), new THREE.MeshStandardMaterial({ map: faceTex(), transparent: true, roughness: 0.5 }));
  face.position.z = 0.475;
  head.add(skull, face);
  // un accessorio diverso per ognuno
  const kind = hashOf(id) % 6;
  if (kind === 1) {
    const capM = toy(shade(color, 0.75));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capM);
    cap.position.y = 0.4;
    const brim = new THREE.Mesh(rbox(0.8, 0.07, 0.45, 0.03), capM);
    brim.position.set(0, 0.42, 0.5);
    head.add(cap, brim);
  } else if (kind === 2) {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 5, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd60a', metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide }));
    crown.position.y = 0.6;
    head.add(crown);
  } else if (kind === 3) {
    for (const x of [-0.22, 0.22]) {
      const ear = part(rbox(0.16, 0.6, 0.1, 0.07), toy('#ffffff'), 1.08);
      ear.position.set(x, 0.75, 0);
      head.add(ear);
    }
  } else if (kind === 4) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 8, 24, Math.PI), toy('#222222'));
    band.position.y = 0.05;
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 20), toy(color));
    p1.rotation.z = Math.PI / 2;
    p1.position.set(-0.53, 0.02, 0);
    const p2 = p1.clone();
    p2.position.x = 0.53;
    head.add(band, p1, p2);
  } else if (kind === 5) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10), toy(shade(color, 0.7)));
    tuft.position.y = 0.64;
    tuft.rotation.z = 0.3;
    head.add(tuft);
  }
  body.add(head);
  const limb = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = part(rbox(w, h, d, 0.12), m);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };
  const armL = limb(0.26, 0.6, 0.28, shirt, -0.57, 1.16);
  const armR = limb(0.26, 0.6, 0.28, shirt, 0.57, 1.16);
  const legL = limb(0.34, 0.52, 0.38, pants, -0.2, 0.52);
  const legR = limb(0.34, 0.52, 0.38, pants, 0.2, 0.52);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    hand.position.y = -0.66;
    arm.add(hand);
  }
  shadowy(body, true, false);
  const label = nameSprite(name, me);
  root.add(label);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ring.visible = false;
  root.add(ring);
  const deco = new THREE.Group();
  root.add(deco);
  const headDeco = new THREE.Group();
  head.add(headDeco);
  return { root, body, legL, legR, armL, armR, head, label, squash: 1, wasAir: false, phase: Math.random() * 10, dustAt: 0, face, expr: 'happy', shockUntil: 0, ring, deco, headDeco };
}

// Animazioni (camminata, salto, seduto, caduta, balletto, spinta) con schiacciamento elastico
export function animateAvatar(av: Avatar, anim: number, speed: number, t: number, dt: number) {
  const ph = (av.phase += dt * (anim === ANIM.walk ? 6 + speed * 1.4 : 4));
  const ease = (o: THREE.Object3D, rx: number, rz = 0) => {
    o.rotation.x += (rx - o.rotation.x) * Math.min(1, dt * 16);
    o.rotation.z += (rz - o.rotation.z) * Math.min(1, dt * 16);
  };
  let bodyY = 0;
  let lean = 0;
  av.body.rotation.y = 0;
  switch (anim) {
    case ANIM.walk: {
      const s = Math.sin(ph * 2);
      ease(av.legL, s * 0.9);
      ease(av.legR, -s * 0.9);
      ease(av.armL, -s * 0.9, -0.1);
      ease(av.armR, s * 0.9, 0.1);
      bodyY = Math.abs(Math.cos(ph * 2)) * 0.1;
      lean = 0.12;
      av.head.rotation.z = Math.sin(ph * 2) * 0.05;
      break;
    }
    case ANIM.air:
      ease(av.legL, -0.6);
      ease(av.legR, 0.35);
      ease(av.armL, -2.7, -0.35);
      ease(av.armR, -2.7, 0.35);
      break;
    case ANIM.sit:
      ease(av.legL, -1.5);
      ease(av.legR, -1.5);
      ease(av.armL, -0.3, -0.15);
      ease(av.armR, -0.3, 0.15);
      bodyY = 0.12;
      break;
    case ANIM.fall:
      ease(av.legL, Math.sin(t * 22) * 0.9);
      ease(av.legR, -Math.sin(t * 22) * 0.9);
      ease(av.armL, -2.8 + Math.sin(t * 18), -0.7);
      ease(av.armR, -2.8 - Math.sin(t * 18), 0.7);
      break;
    case ANIM.dance:
      ease(av.legL, Math.sin(t * 10) * 0.35);
      ease(av.legR, -Math.sin(t * 10) * 0.35);
      ease(av.armL, -2.7 + Math.sin(t * 9) * 0.5, -0.45);
      ease(av.armR, -2.7 - Math.sin(t * 9) * 0.5, 0.45);
      bodyY = Math.abs(Math.sin(t * 9)) * 0.3;
      av.body.rotation.y = Math.sin(t * 4) * 0.7;
      break;
    case ANIM.dive:
      ease(av.armL, -3, -0.2);
      ease(av.armR, -3, 0.2);
      ease(av.legL, 0.3);
      ease(av.legR, 0.3);
      lean = 1.25;
      break;
    case ANIM.dash: {
      const s = Math.sin(ph * 3);
      ease(av.legL, s * 1.1);
      ease(av.legR, -s * 1.1);
      ease(av.armL, 0.9, -0.3);
      ease(av.armR, 0.9, 0.3);
      lean = 0.55;
      break;
    }
    case ANIM.push:
      ease(av.armL, -1.65, 0.2);
      ease(av.armR, -1.65, -0.2);
      ease(av.legL, 0.55);
      ease(av.legR, -0.45);
      lean = 0.3;
      break;
    default: {
      const s = Math.sin(t * 2.2 + av.phase);
      ease(av.legL, 0);
      ease(av.legR, 0);
      ease(av.armL, s * 0.08, -0.1);
      ease(av.armR, -s * 0.08, 0.1);
      bodyY = s * 0.02;
      av.head.rotation.z *= 0.9;
    }
  }
  const air = anim === ANIM.air;
  if (av.wasAir && !air && anim !== ANIM.fall) av.squash = 0.68;
  av.wasAir = air;
  av.squash += (1 - av.squash) * Math.min(1, dt * 11);
  const stretch = air ? 1.1 : av.squash;
  av.body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  av.body.position.y = bodyY;
  av.body.rotation.x += (lean - av.body.rotation.x) * Math.min(1, dt * 10);
  av.body.rotation.z = anim === ANIM.fall ? t * 7 : av.body.rotation.z * 0.8;
  const expr = anim === ANIM.fall || performance.now() < av.shockUntil ? 'shock' : anim === ANIM.dance ? 'joy' : 'happy';
  if (expr !== av.expr) {
    av.expr = expr;
    const m = av.face.material as THREE.MeshStandardMaterial;
    m.map = faceFor(expr as 'happy' | 'shock' | 'joy');
    m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- effetti

const DUST_GEO = new THREE.IcosahedronGeometry(0.22, 1);
export function dust(world: World, x: number, y: number, z: number, n = 3) {
  const g = new THREE.Group();
  g.position.set(x, y + 0.12, z);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(DUST_GEO, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, roughness: 1 }));
    const a = Math.random() * Math.PI * 2;
    p.userData.v = new THREE.Vector3(Math.cos(a) * 0.8, 0.6 + Math.random() * 0.5, Math.sin(a) * 0.8);
    g.add(p);
  }
  g.userData.life = 0.55;
  g.userData.max = 0.55;
  g.userData.kind = 'dust';
  world.fx.add(g);
}

export function burst(world: World, x: number, y: number, z: number, colors: string[], count = 40, power = 6) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const geo = new THREE.PlaneGeometry(0.2, 0.12);
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
    const a = Math.random() * Math.PI * 2;
    const up = 0.5 + Math.random();
    p.userData.v = new THREE.Vector3(Math.cos(a) * power * Math.random(), up * power, Math.sin(a) * power * Math.random());
    p.userData.spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    g.add(p);
  }
  g.userData.life = 1.8;
  g.userData.max = 1.8;
  g.userData.kind = 'burst';
  world.fx.add(g);
}

export function poof(world: World, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y + 1, z);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.3 }));
    const a = (i / 10) * Math.PI * 2;
    s.userData.v = new THREE.Vector3(Math.cos(a) * 2.8, 1 + Math.random() * 1.5, Math.sin(a) * 2.8);
    g.add(s);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), glow('#ffd60a', 3));
  star.userData.v = new THREE.Vector3(0, 3, 0);
  g.add(star);
  g.userData.life = 0.9;
  g.userData.max = 0.9;
  g.userData.kind = 'poof';
  world.fx.add(g);
}

export function tracer(world: World, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
  const a = new THREE.Vector3(from.x, from.y, from.z);
  const b = new THREE.Vector3(to.x, to.y, to.z);
  const len = a.distanceTo(b);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, toneMapped: false }));
  beam.position.copy(a).lerp(b, 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, toneMapped: false }));
  flash.position.copy(b);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false }));
  muzzle.position.copy(a);
  const g = new THREE.Group();
  g.add(beam, flash, muzzle);
  g.userData.life = 0.35;
  g.userData.max = 0.35;
  g.userData.kind = 'fade';
  world.fx.add(g);
}

export function ringPulse(world: World, x: number, y: number, z: number, color = '#ffffff') {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y + 0.9, z);
  const g = new THREE.Group();
  g.add(m);
  g.userData.life = 0.4;
  g.userData.max = 0.4;
  g.userData.kind = 'ring';
  world.fx.add(g);
}

export function updateFx(world: World, dt: number) {
  for (const g of [...world.fx.children]) {
    g.userData.life -= dt;
    const life = g.userData.life;
    const k = Math.max(0, life / g.userData.max);
    if (life <= 0) {
      world.fx.remove(g);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && m.geometry !== DUST_GEO) m.geometry.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      continue;
    }
    for (const c of g.children) {
      const mm = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const v = c.userData.v as THREE.Vector3 | undefined;
      if (g.userData.kind === 'burst') {
        v!.y -= 14 * dt;
        v!.multiplyScalar(1 - dt * 0.8);
        c.position.addScaledVector(v!, dt);
        c.rotation.x += c.userData.spin.x * dt;
        c.rotation.y += c.userData.spin.y * dt;
      } else if (g.userData.kind === 'poof' || g.userData.kind === 'dust') {
        c.position.addScaledVector(v!, dt);
        c.scale.multiplyScalar(1 + dt * 1.8);
        mm.opacity = k;
      } else if (g.userData.kind === 'text') {
        c.position.addScaledVector(v!, dt);
        const pop = (1 + Math.max(0, 0.45 - (g.userData.max - life)) * 1.6) * (c.userData.k ?? 1);
        c.scale.set(3.2 * pop, 1 * pop, 1);
        ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, k * 2);
      } else if (g.userData.kind === 'ring') {
        c.scale.multiplyScalar(1 + dt * 9);
        mm.opacity = k;
      } else if (g.userData.kind === 'decal') {
        // macchia per terra: resta e sparisce piano alla fine
        mm.opacity = Math.min(0.9, life * 0.9);
        if (c.scale.x < 1) c.scale.setScalar(Math.min(1, c.scale.x + dt * 9));
      } else mm.opacity = k;
    }
  }
}
