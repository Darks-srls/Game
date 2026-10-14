// Grafica 3D di "Non lasciarmi solo": il condominio costruito dalle griglie dei piani (pavimenti, soffitti, muri, scale,
// porte, mobili), le texture realistiche fatte con Nano Banana, le lampade che lavorano davvero (alcune si stabilizzano,
// una resta debole), la torcia con le ombre, la polvere nel fascio di luce, nebbia e grana della pellicola.
// Il buio nasconde ma lascia leggibile il percorso vicino: c'è sempre un minimo chiarore.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { DOORS, DYN_PROPS, GRIDS, H1, PROPS, ROOMS, STAIR, STATIONS, WALLS, doorSeg, floorBase, type DoorDef, type DynProp, type PropBox, type RoomDef, type Tex } from '../../data/horror1';

// ---------------------------------------------------------------- materiali

const TEX_FALLBACK: Record<Tex | 'soffitto' | 'porta' | 'acciaio' | 'tenda' | 'tessuto' | 'tappeto' | 'legnoMobili' | 'ruggine', string> = {
  terrazzo: '#b39a7c',
  intonaco: '#bfb29a',
  salvia: '#8f9e86',
  scale: '#7d8a99',
  carta: '#9c8a86',
  piastrelle: '#d8d5cc',
  parquet: '#7a5636',
  cemento: '#7c7e7a',
  muroCantina: '#6f766f',
  linoleum: '#6f9a86',
  cucina: '#a87a3c',
  marmo: '#c9c7c2',
  metallo: '#80868c',
  soffitto: '#cfcabd',
  porta: '#4a3222',
  acciaio: '#6c7176',
  asfalto: '#2a2c2e',
  facciata: '#8c8170',
  bagno: '#a9c3cf',
  carta2: '#9aa486',
  tenda: '#9c8040',
  tessuto: '#6e2a2e',
  tappeto: '#7a3b34',
  legnoMobili: '#4a3022',
  ruggine: '#7a4a2a',
};
const ROUGH: Partial<Record<string, number>> = { piastrelle: 0.35, marmo: 0.45, terrazzo: 0.5, linoleum: 0.55, parquet: 0.6, metallo: 0.55, acciaio: 0.5, cucina: 0.4, porta: 0.55, asfalto: 0.25, bagno: 0.25, legnoMobili: 0.5, tessuto: 0.95, tappeto: 0.95, tenda: 0.95 };

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.MeshStandardMaterial>();
// Materiale con la texture vera (se c'è) e la mappa del rilievo; finché carica (o se manca) resta il colore di base
export function surface(name: keyof typeof TEX_FALLBACK, opts: { repeat?: [number, number] } = {}) {
  const key = `${name}:${opts.repeat?.join('x') ?? ''}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color: TEX_FALLBACK[name], roughness: ROUGH[name] ?? 0.85, metalness: name === 'acciaio' || name === 'metallo' ? 0.25 : 0 });
  const set = (t: THREE.Texture, color: boolean) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
  };
  loader.load(`/horror/tex/${name}.webp`, (t) => {
    set(t, true);
    m.map = t;
    m.color.set('#ffffff');
    m.needsUpdate = true;
  });
  loader.load(`/horror/tex/${name}_n.webp`, (t) => {
    set(t, false);
    m.normalMap = t;
    m.normalScale.set(0.9, 0.9);
    m.needsUpdate = true;
  });
  texCache.set(key, m);
  return m;
}
const plain = (color: THREE.ColorRepresentation, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const rbox = (w: number, h: number, d: number, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Targhette, avvisi, cartelli: testo vero dipinto su una texture
function label(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; border?: string } = {}) {
  const w = opts.w ?? 256;
  const h = opts.h ?? 96;
  return canvasTex(w, h, (c) => {
    c.fillStyle = opts.bg ?? '#d9c58a';
    c.fillRect(0, 0, w, h);
    if (opts.border) {
      c.strokeStyle = opts.border;
      c.lineWidth = 6;
      c.strokeRect(4, 4, w - 8, h - 8);
    }
    c.fillStyle = opts.fg ?? '#2b2116';
    c.font = opts.font ?? `bold ${Math.round(h * 0.5)}px Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((ln, i) => c.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h * 0.32));
  });
}

// ---------------------------------------------------------------- il mondo

export interface Lamp {
  x: number;
  y: number;
  z: number;
  f: number;
  room: RoomDef;
  kind: 'neon' | 'bulbo';
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  power: number; // 0..1 deciso dal gioco
  flick: number; // tendenza a tremolare
  warm: boolean;
  seed: number;
}
export interface DoorMesh {
  def: DoorDef;
  pivot: THREE.Group;
  angle: number;
  want: number;
  lockLight: THREE.Mesh | null;
}
export interface HWorld {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  torch: THREE.SpotLight;
  lamps: Lamp[];
  doors: Map<string, DoorMesh>;
  water: THREE.Mesh;
  stations: Map<string, THREE.Object3D>;
  leakFx: THREE.Points;
  moon: THREE.DirectionalLight;
  setSize: (w: number, h: number) => void;
  render: (dt: number, fx: { hurt: number; fear: number; t: number }) => void;
  setQuality: (q: 'auto' | 'alta' | 'bassa') => void;
  dispose: () => void;
}

const LIGHT_POOL = 6;

export function createHorrorWorld(canvas: HTMLCanvasElement, lowPower: boolean): HWorld {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.3 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020304');
  scene.fog = new THREE.FogExp2('#05070a', 0.07);
  // chiarore minimo (il telefono non deve diventare uno schermo nero)
  scene.add(new THREE.HemisphereLight('#3b4a66', '#1a1612', 0.22));

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 80);
  scene.add(camera);
  // la torcia: un cono con il disegno della lente e le ombre
  const torch = new THREE.SpotLight('#fff1d8', 14, 24, 0.46, 0.6, 1.25);
  torch.castShadow = true;
  torch.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024);
  torch.shadow.camera.near = 0.2;
  torch.shadow.bias = -0.0006;
  torch.shadow.normalBias = 0.03;
  torch.map = canvasTex(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, '#f4efe4');
    g.addColorStop(0.32, '#b9b4aa');
    g.addColorStop(0.42, '#d7d2c7');
    g.addColorStop(0.75, '#5a5752');
    g.addColorStop(1, '#000000');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });
  torch.position.set(0.18, -0.12, 0.05);
  camera.add(torch);
  torch.target.position.set(0, -0.3, -6);
  camera.add(torch.target);

  const building = new THREE.Group();
  scene.add(building);
  const lamps = buildBuilding(building);
  const doors = buildDoors(building);
  buildProps(building);
  const stations = buildStations(building);
  // acqua della lavanderia (sale e scende)
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 8),
    new THREE.MeshStandardMaterial({ color: '#1b2a24', roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(22.5, floorBase(0) + 0.6, 5);
  building.add(water);
  // spruzzo di una perdita
  const leakGeo = new THREE.BufferGeometry();
  leakGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(120 * 3), 3));
  const leakFx = new THREE.Points(leakGeo, new THREE.PointsMaterial({ color: '#cfe8ff', size: 0.035, transparent: true, opacity: 0.8 }));
  leakFx.visible = false;
  building.add(leakFx);

  // luna (solo quando si è fuori): luce fredda e ombre lunghe nel cortile
  const moon = new THREE.DirectionalLight('#9fb4d8', 0);
  moon.position.set(-6, 22, -30);
  moon.target.position.set(12, 0, -2);
  moon.castShadow = !lowPower;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(moon, moon.target);
  // un piccolo gruppo di luci vere che si spostano sulle lampade accese più vicine
  const pool = Array.from({ length: LIGHT_POOL }, () => {
    const l = new THREE.PointLight('#ffd9a8', 0, 9, 1.8);
    scene.add(l);
    return l;
  });

  // polvere che galleggia nel fascio della torcia
  const DUST = lowPower ? 220 : 500;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST * 3; i++) dp[i] = (Math.random() - 0.5) * 8;
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { camPos: { value: new THREE.Vector3() }, camDir: { value: new THREE.Vector3() }, torchOn: { value: 1 }, t: { value: 0 } },
    vertexShader: `uniform vec3 camPos; uniform vec3 camDir; uniform float t; varying float vA;
      void main(){ vec3 p = position; p.y += sin(t*0.3 + position.x*3.0)*0.08; p.x += cos(t*0.2 + position.z*2.0)*0.06;
        vec3 w = camPos + mod(p - camPos + 4.0, 8.0) - 4.0;
        vec3 d = w - camPos; float dist = length(d); float c = dot(normalize(d), camDir);
        vA = smoothstep(0.88, 0.97, c) * smoothstep(7.0, 1.0, dist) * smoothstep(0.25, 0.6, dist);
        vec4 mv = modelViewMatrix * vec4(w, 1.0); gl_PointSize = clamp(7.0 / -mv.z, 1.0, 5.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float torchOn; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(1.0, 0.95, 0.85, vA * torchOn * 0.55 * (1.0 - r*2.0)); }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // effetti di schermo: bagliore delle lampade, grana, vignetta, ferita
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, t: { value: 0 }, hurt: { value: 0 }, fear: { value: 0 }, grain: { value: 0.06 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float t; uniform float hurt; uniform float fear; uniform float grain; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + t*7.13) * 43758.5453); }
      void main(){
        vec2 uv = vUv; vec2 cc = uv - 0.5; float r = length(cc);
        float ab = 0.0015 + fear * 0.004;
        vec3 col = vec3(texture2D(tDiffuse, uv + cc*ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - cc*ab).b);
        float l = dot(col, vec3(0.299,0.587,0.114));
        col = mix(col, vec3(l), 0.18 + fear*0.25); // colori spenti
        col *= 1.0 - smoothstep(0.35, 0.85, r) * (0.75 + fear*0.2);
        col += (rnd(uv*vec2(731.0, 377.0)) - 0.5) * grain;
        col = mix(col, col*vec3(1.25,0.35,0.3), hurt * smoothstep(0.25, 0.75, r));
        gl_FragColor = vec4(col, 1.0); }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let fancy = !lowPower;
  let w0 = 1;
  let h0 = 1;

  const world: HWorld = {
    renderer,
    scene,
    camera,
    torch,
    lamps,
    doors,
    water,
    stations,
    leakFx,
    moon,
    setSize: (w, h) => {
      w0 = w;
      h0 = h;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    setQuality: (q) => {
      fancy = q === 'alta' || (q === 'auto' && !lowPower);
      renderer.setPixelRatio(q === 'bassa' ? 1 : Math.min(window.devicePixelRatio || 1, q === 'alta' ? 2 : lowPower ? 1.3 : 1.75));
      torch.shadow.mapSize.set(q === 'bassa' ? 512 : 1024, q === 'bassa' ? 512 : 1024);
      torch.shadow.map?.dispose();
      torch.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      world.setSize(w0, h0);
    },
    render: (dt, fx) => {
      // le luci vere vanno alle lampade accese più vicine (le altre brillano solo come oggetto)
      const cp = camera.position;
      const lit = lamps.filter((l) => l.mat.emissiveIntensity > 0.05 && Math.abs(l.y - cp.y) < 5).sort((a, b) => dist2(a, cp) - dist2(b, cp));
      pool.forEach((pl, i) => {
        const l = lit[i];
        if (!l || dist2(l, cp) > 26 * 26) {
          pl.intensity = 0;
          return;
        }
        const out = l.room.zone === 'esterno';
        pl.position.set(l.x, l.y - 0.25, l.z);
        pl.color.set(out ? '#ff9f4a' : l.warm ? '#ffcf96' : '#cfe6ff');
        pl.intensity = l.mat.emissiveIntensity * (out ? 14 : l.kind === 'neon' ? 3.2 : 2.6);
        pl.distance = out ? 20 : l.kind === 'neon' ? 10 : 8;
      });
      dustMat.uniforms.camPos.value.copy(cp);
      camera.getWorldDirection(dustMat.uniforms.camDir.value);
      dustMat.uniforms.torchOn.value = torch.intensity > 1 ? 1 : 0;
      dustMat.uniforms.t.value = fx.t;
      grade.uniforms.t.value = fx.t;
      grade.uniforms.hurt.value = fx.hurt;
      grade.uniforms.fear.value = fx.fear;
      if (fancy) composer.render(dt);
      else {
        renderer.render(scene, camera);
      }
    },
    dispose: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mm of mats) mm.dispose();
      });
      for (const m of texCache.values()) {
        m.map?.dispose();
        m.normalMap?.dispose();
      }
      texCache.clear();
      composer.dispose();
      renderer.dispose();
    },
  };
  return world;
}
const dist2 = (a: { x: number; y: number; z: number }, b: THREE.Vector3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

// ---------------------------------------------------------------- il palazzo

const STAIR_CELLS = new Set(['A', 'B', 'L']);
const ceilingTex = () => surface('soffitto', { repeat: [1, 1] });

// Un rettangolo orizzontale (pavimento o soffitto) in una geometria da unire
function quadH(x0: number, z0: number, x1: number, z1: number, y: number, up: boolean, uvScale = 0.5, seg = 1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, seg, seg);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * uvScale, pos.getZ(i) * uvScale);
  return g;
}
// Faccia di un muro: da (x0,z0) a (x1,z1), alta da y0 a y1, guarda verso n
function quadV(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, nx: number, nz: number, uLen = 1.6, seg = 1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.PlaneGeometry(len, y1 - y0, 1, seg);
  const ang = Math.atan2(nx, nz);
  g.rotateY(ang);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const uv = g.attributes.uv;
  // u lungo il muro (si ripete ogni uLen metri), v da pavimento a soffitto
  const ox = Math.min(x0, x1) + Math.min(z0, z1);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (ox + uv.getX(i) * len) / uLen, (y0 - Math.floor(y0 / H1.floorH) * H1.floorH + uv.getY(i) * (y1 - y0)) / H1.ceil);
  return g;
}

// Ombre morbide negli angoli (finta "occlusione ambientale" nei colori dei vertici: costa niente e dà profondità)
function colorize(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => number) {
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const SHAFT_RECT = { c0: STAIR.a0 - 1, c1: STAIR.b1 + 1, r0: STAIR.z0 - 1, r1: STAIR.z2 };
const inShaft = (x: number, z: number) => x >= SHAFT_RECT.c0 && x <= SHAFT_RECT.c1 + 1 && z >= SHAFT_RECT.r0 && z <= SHAFT_RECT.r1 + 0.01;

function buildBuilding(root: THREE.Group): Lamp[] {
  const geos = new Map<string, THREE.BufferGeometry[]>();
  const add = (mat: string, g: THREE.BufferGeometry) => {
    if (!geos.has(mat)) geos.set(mat, []);
    geos.get(mat)!.push(g);
  };
  for (let f = 0; f < H1.floors; f++) {
    const g = GRIDS[f];
    const base = floorBase(f);
    const wallAt = (c: number, r: number, side: 'N' | 'S' | 'E' | 'W') => {
      const a = g.room(c, r);
      const [c2, r2] = side === 'N' ? [c, r - 1] : side === 'S' ? [c, r + 1] : side === 'W' ? [c - 1, r] : [c + 1, r];
      const b = g.room(c2, r2);
      if (a === b) return false;
      return WALLS[f].some((w) => w.key === (side === 'N' ? `H:${c}:${r}` : side === 'S' ? `H:${c}:${r + 1}` : side === 'W' ? `V:${c}:${r}` : `V:${c + 1}:${r}`));
    };
    // pavimenti e soffitti cella per cella, più scuri vicino ai muri
    for (let r = H1.row0; r < H1.rows; r++)
      for (let c = 0; c < H1.cols; c++) {
        const id = g.room(c, r);
        const rm = id === '#' ? null : ROOMS.find((x) => x.f === f && x.id === id);
        const shaftCell = STAIR_CELLS.has(id) || (inShaft(c + 0.5, r + 0.5) && id === '#' && f === H1.floors - 1);
        if (!rm && !shaftCell) continue;
        const n = wallAt(c, r, 'N');
        const sth = wallAt(c, r, 'S');
        const w = wallAt(c, r, 'W');
        const e = wallAt(c, r, 'E');
        const ao = (x: number, _y: number, z: number) => {
          let k = 1;
          if (n && z < r + 0.35) k -= (0.35 - (z - r)) * 1.1;
          if (sth && z > r + 0.65) k -= (z - (r + 0.65)) * 1.1;
          if (w && x < c + 0.35) k -= (0.35 - (x - c)) * 1.1;
          if (e && x > c + 0.65) k -= (x - (c + 0.65)) * 1.1;
          return Math.max(0.5, k);
        };
        if (rm && !STAIR_CELLS.has(id)) {
          const fl = quadH(c, r, c + 1, r + 1, base, true, rm.floor === 'piastrelle' || rm.floor === 'cucina' ? 0.5 : 0.35, 2);
          add(`f:${rm.floor}`, colorize(fl, ao));
          if (rm.zone !== 'esterno') add('ceil', colorize(quadH(c, r, c + 1, r + 1, base + H1.ceil, false, 0.3, 2), (x, y, z) => 0.5 + ao(x, y, z) * 0.5));
        }
        // in fondo alla tromba delle scale c'è il pavimento, in cima il soffitto
        if (f === 0 && STAIR_CELLS.has(id)) add('f:marmo', quadH(c, r, c + 1, r + 1, base, true, 0.35));
        if (f === H1.floors - 1 && (STAIR_CELLS.has(id) || shaftCell)) add('ceil', quadH(c, r, c + 1, r + 1, base + H1.floorH - 0.05, false, 0.3));
      }
    // muri: una faccia per ogni lato che dà su una stanza (nella tromba delle scale tutte e due, fino al piano di sopra)
    for (const w of WALLS[f]) {
      const vertical = w.x0 === w.x1;
      const midX = (w.x0 + w.x1) / 2;
      const midZ = (w.z0 + w.z1) / 2;
      const shaftWall = STAIR_CELLS.has(w.inner) || STAIR_CELLS.has(w.outer) || inShaft(midX, midZ);
      const outdoor = w.inner === 'E' || w.outer === 'E';
      const hgt = shaftWall ? H1.floorH : outdoor ? 4.2 : H1.ceil;
      for (const [rid, other, side] of [
        [w.inner, w.outer, -1],
        [w.outer, w.inner, 1],
      ] as [string, string, number][]) {
        let rm = rid === '#' ? null : ROOMS.find((r) => r.f === f && r.id === rid);
        if (!rm && shaftWall) rm = ROOMS.find((r) => r.f === f && r.id === other) ?? null;
        if (!rm) continue;
        const nx = vertical ? side : 0;
        const nz = vertical ? 0 : side;
        const off = H1.wallT / 2;
        const wallMat = STAIR_CELLS.has(rid) || (rid === '#' && shaftWall) ? 'scale' : rm.wall;
        const quad = quadV(w.x0 + nx * off, w.z0 + nz * off, w.x1 + nx * off, w.z1 + nz * off, base, base + hgt, nx, nz, 1.6, 6);
        add(`w:${wallMat}`, colorize(quad, (_x, y) => {
          const h = y - base;
          return Math.min(1, 0.55 + h * 1.4) * (h > hgt - 0.3 ? 0.78 + (hgt - h) * 0.7 : 1);
        }));
        // battiscopa scuro
        if (rm.zone !== 'esterno' && rm.zone !== 'cantina') {
          const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
          const bb = new THREE.BoxGeometry(vertical ? 0.02 : len, 0.09, vertical ? len : 0.02);
          bb.translate(midX + nx * (off + 0.01), base + 0.045, midZ + nz * (off + 0.01));
          add(rm.zone === 'casa' ? 'bb:legno' : 'bb:pietra', bb);
        }
      }
    }
    // sopra le porte: l'architrave
    for (const d of DOORS.filter((x) => x.f === f)) {
      const [x0, z0, x1, z1] = doorSeg(d);
      const vertical = x0 === x1;
      for (const side of [-1, 1]) {
        const nx = vertical ? side : 0;
        const nz = vertical ? 0 : side;
        const cx = vertical ? x0 + side * 0.5 : x0 + 0.5;
        const cz = vertical ? z0 + 0.5 : z0 + side * 0.5;
        const rid = g.room(Math.floor(cx), Math.floor(cz));
        if (rid === '#') continue;
        const rm = ROOMS.find((r) => r.f === f && r.id === rid);
        add(`w:${rm?.wall ?? 'intonaco'}`, quadV(x0 + nx * 0.07, z0 + nz * 0.07, x1 + nx * 0.07, z1 + nz * 0.07, base + 2.12, base + (rm?.zone === 'esterno' ? 4.2 : H1.ceil), nx, nz));
      }
    }
    // scale: gradini, ballatoio e il sottoscala inclinato
    if (g.cells.some((row) => row.includes('A'))) buildStairs(add, f);
  }
  for (const [key, list] of geos) {
    const [kind, name] = key.split(':');
    let mat: THREE.Material;
    if (kind === 'ceil') mat = vc(ceilingTex());
    else if (kind === 'bb') mat = name === 'legno' ? plain('#3b2a1e', 0.6) : plain('#4a4a46', 0.5);
    else mat = vc(surface((name as Tex) ?? 'intonaco', {}));
    const mesh = new THREE.Mesh(mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)).map(ensureAttrs)), mat);
    mesh.receiveShadow = true;
    mesh.castShadow = kind === 'w';
    root.add(mesh);
  }
  // lampade
  const lamps: Lamp[] = [];
  for (const rm of ROOMS) {
    for (const [x, z] of rm.lamps ?? []) {
      const outdoor = rm.zone === 'esterno';
      const neon = !outdoor && (rm.light === 'neon' || rm.zone === 'cantina' || rm.zone === 'tecnico' || rm.zone === 'servizio' || rm.zone === 'lavanderia');
      const warm = !neon;
      const y = outdoor ? 4.6 : floorBase(rm.f) + H1.ceil - 0.06;
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: outdoor ? '#ff9a3c' : warm ? '#ffcf96' : '#d9ecff', emissiveIntensity: 0, roughness: 0.4 });
      const mesh = neon ? new THREE.Mesh(rbox(1.2, 0.07, 0.12, 0.03), mat) : new THREE.Mesh(new THREE.SphereGeometry(outdoor ? 0.22 : 0.13, 16, 10), mat);
      mesh.position.set(x, neon || outdoor ? y : y - 0.32, z);
      root.add(mesh);
      if (outdoor) {
        // lampione: palo e braccio
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.8, 10), plain('#2b2f33', 0.5, 0.6));
        pole.position.set(x, 2.4, z - 0.6);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), plain('#2b2f33', 0.5, 0.6));
        arm.position.set(x, 4.75, z - 0.3);
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 16, 1, true), plain('#2b2f33', 0.5, 0.6, { side: THREE.DoubleSide }));
        hood.position.set(x, 4.78, z);
        root.add(pole, arm, hood);
      } else if (!neon) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), plain('#111111'));
        wire.position.set(x, y - 0.15, z);
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.16, 20, 1, true), plain('#e8dcc6', 0.6, 0, { side: THREE.DoubleSide }));
        shade.position.set(x, y - 0.24, z);
        root.add(wire, shade);
      } else {
        const box = new THREE.Mesh(rbox(1.3, 0.05, 0.2, 0.02), plain('#c9ccd0', 0.5, 0.3));
        box.position.set(x, y + 0.04, z);
        root.add(box);
      }
      lamps.push({ x, y: mesh.position.y, z, f: rm.f, room: rm, kind: neon ? 'neon' : 'bulbo', mesh, mat, power: 0, flick: rm.light === 'debole' ? 0.5 : neon ? 0.15 : 0.05, warm, seed: Math.random() * 100 });
    }
  }
  // finestre sull'esterno (con le tende): fuori è notte e piove
  const nightMat = new THREE.MeshStandardMaterial({ color: '#0b1220', emissive: '#16233d', emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.6 });
  const frameMat = plain('#3a3027', 0.6);
  const curtain = surface('tenda' as Tex);
  let wi = 0;
  for (let f = 1; f < H1.floors; f++)
    for (const w of WALLS[f]) {
      if (w.inner !== '#' && w.outer !== '#') continue;
      const room = w.inner === '#' ? w.outer : w.inner;
      if (STAIR_CELLS.has(room) || room === 'P' || room === 'E' || room === 'C') continue;
      if (wi++ % 4 !== 1) continue;
      const vertical = w.x0 === w.x1;
      const side = w.inner === '#' ? 1 : -1;
      const nx = vertical ? side : 0;
      const nz = vertical ? 0 : side;
      const cx = (w.x0 + w.x1) / 2 + nx * 0.075;
      const cz = (w.z0 + w.z1) / 2 + nz * 0.075;
      const ry = Math.atan2(nx, nz);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.2), nightMat);
      win.position.set(cx, floorBase(f) + 1.55, cz);
      win.rotation.y = ry;
      const fr = new THREE.Mesh(rbox(0.9, 1.35, 0.06), frameMat);
      fr.position.set(cx - nx * 0.02, floorBase(f) + 1.55, cz - nz * 0.02);
      fr.rotation.y = ry;
      const sill = new THREE.Mesh(rbox(1, 0.06, 0.22), plain('#bfbab0', 0.5));
      sill.position.set(cx + nx * 0.08, floorBase(f) + 0.9, cz + nz * 0.08);
      sill.rotation.y = ry;
      root.add(fr, win, sill);
      if (ROOMS.find((r) => r.f === f && r.id === room)?.zone === 'casa') {
        for (const s of [-1, 1]) {
          const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 2.1, 6, 1), curtain);
          const p = cur.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.025);
          cur.geometry.computeVertexNormals();
          const ox = vertical ? 0 : s * 0.52;
          const oz = vertical ? s * 0.52 : 0;
          cur.position.set(cx + nx * 0.06 + ox, floorBase(f) + 1.5, cz + nz * 0.06 + oz);
          cur.rotation.y = ry;
          cur.castShadow = true;
          root.add(cur);
        }
        // termosifone sotto la finestra
        const rad = new THREE.Group();
        for (let i = 0; i < 8; i++) {
          const fin = new THREE.Mesh(rbox(0.08, 0.6, 0.1, 0.03), plain('#d8d3c8', 0.4, 0.2));
          fin.position.set(-0.32 + i * 0.09, 0, 0);
          rad.add(fin);
        }
        rad.position.set(cx + nx * 0.1, floorBase(f) + 0.45, cz + nz * 0.1);
        rad.rotation.y = ry;
        root.add(rad);
      }
    }
  return lamps;
}
const vc = (m: THREE.MeshStandardMaterial) => {
  if (!m.vertexColors) {
    m.vertexColors = true;
    m.needsUpdate = true;
  }
  return m;
};
// tutte le geometrie unite devono avere gli stessi attributi
function ensureAttrs(g: THREE.BufferGeometry) {
  if (!g.attributes.color) colorize(g, () => 1);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

function buildStairs(add: (mat: string, g: THREE.BufferGeometry) => void, f: number) {
  const base = floorBase(f);
  const steps = 10;
  const run = (STAIR.z1 - STAIR.z0) / steps;
  const rise = 1.6 / steps;
  // rampa A: sale verso +z (gradini pieni fino al piano: niente buchi sotto)
  for (let i = 0; i < steps; i++) {
    const y = base + rise * (i + 1);
    const box = new THREE.BoxGeometry(STAIR.a1 - STAIR.a0 + 1, rise, run);
    box.translate(STAIR.a0 + 1, y - rise / 2, STAIR.z0 + run * (i + 0.5));
    add('f:marmo', box);
    // il bordo del gradino un po' più chiaro (si legge al buio)
    const nose = new THREE.BoxGeometry(STAIR.a1 - STAIR.a0 + 1, 0.025, 0.04);
    nose.translate(STAIR.a0 + 1, y + 0.005, STAIR.z0 + run * i + 0.02);
    add('bb:pietra', nose);
  }
  // ballatoio
  const land = new THREE.BoxGeometry(STAIR.b1 - STAIR.a0 + 1, 0.2, STAIR.z2 - STAIR.z1);
  land.translate((STAIR.a0 + STAIR.b1 + 1) / 2, base + 1.5, (STAIR.z1 + STAIR.z2) / 2);
  add('f:marmo', land);
  // rampa B: dal ballatoio verso -z fino al piano di sopra
  for (let i = 0; i < steps; i++) {
    const y = base + 1.6 + rise * (i + 1);
    const box = new THREE.BoxGeometry(STAIR.b1 - STAIR.b0 + 1, rise, run);
    box.translate(STAIR.b0 + 1, y - rise / 2, STAIR.z1 - run * (i + 0.5));
    add('f:marmo', box);
    const nose = new THREE.BoxGeometry(STAIR.b1 - STAIR.b0 + 1, 0.025, 0.04);
    nose.translate(STAIR.b0 + 1, y + 0.005, STAIR.z1 - run * i - 0.02);
    add('bb:pietra', nose);
  }
  // sotto la rampa B e sotto il ballatoio: il sottoscala inclinato (si vede salendo la rampa A del piano di sotto)
  const slant = (x0: number, x1: number, za: number, ya: number, zb: number, yb: number) => {
    const g = new THREE.BufferGeometry();
    const v = [x0, ya, za, x1, ya, za, x1, yb, zb, x0, ya, za, x1, yb, zb, x0, yb, zb];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 2, 0, 0, 1, 2, 0, 2], 2));
    g.computeVertexNormals();
    // la faccia deve guardare in basso
    if (g.attributes.normal.getY(0) > 0) {
      const p = g.attributes.position.array as Float32Array;
      for (let t = 0; t < p.length; t += 9) for (let k = 0; k < 3; k++) [p[t + 3 + k], p[t + 6 + k]] = [p[t + 6 + k], p[t + 3 + k]];
      g.computeVertexNormals();
    }
    return g;
  };
  add('ceil', slant(STAIR.b0, STAIR.b1 + 1, STAIR.z1, base + 1.6 - 0.25, STAIR.z0, base + 3.2 - 0.25));
  add('ceil', slant(STAIR.a0, STAIR.b1 + 1, STAIR.z1, base + 1.6 - 0.2, STAIR.z2, base + 1.6 - 0.2));
}

// ---------------------------------------------------------------- porte

function buildDoors(root: THREE.Group) {
  const out = new Map<string, DoorMesh>();
  const frameMat = plain('#5b4632', 0.6);
  const steelFrame = plain('#4f555b', 0.5, 0.4);
  const brass = plain('#b08d57', 0.3, 0.8);
  for (const d of DOORS) {
    const [x0, z0, x1, z1] = doorSeg(d);
    const vertical = x0 === x1;
    const base = floorBase(d.f);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, base, (z0 + z1) / 2);
    g.rotation.y = vertical ? Math.PI / 2 : 0;
    root.add(g);
    const metal = d.kind === 'acciaio' || d.kind === 'servizio' || d.kind === 'cantina';
    // stipiti e traversa
    for (const sx of [-0.5, 0.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.14, 0.2), metal ? steelFrame : frameMat);
      post.position.set(sx, 1.07, 0);
      g.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.08, 0.2), metal ? steelFrame : frameMat);
    top.position.set(0, 2.14, 0);
    g.add(top);
    // il battente gira sul cardine di sinistra
    const pivot = new THREE.Group();
    pivot.position.set(-0.46, 0, 0);
    g.add(pivot);
    const panelMat = d.kind === 'cantina' ? plain('#6a6f63', 0.7, 0.3) : surface(metal ? 'acciaio' : 'porta');
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.06, 0.05), panelMat);
    panel.position.set(0.46, 1.04, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    pivot.add(panel);
    if (d.kind === 'portone') {
      // vetro scuro: fuori è notte
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshStandardMaterial({ color: '#0a1220', emissive: '#14203a', emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.6 }));
      glass.position.set(0.46, 1.45, -0.03);
      glass.rotation.y = Math.PI;
      pivot.add(glass);
    }
    for (const sz of [-0.035, 0.035]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.025), brass);
      handle.position.set(0.82, 1.02, sz * 1.4);
      pivot.add(handle);
    }
    // numero o targhetta (sul lato del corridoio)
    if (d.label) {
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(d.label.length > 2 ? 0.34 : 0.12, 0.1),
        new THREE.MeshStandardMaterial({ map: label(d.label, { w: d.label.length > 2 ? 256 : 96, h: 72, bg: metal ? '#c9c2a6' : '#c4a463', border: '#5a4a2c' }), roughness: 0.4, metalness: 0.4 }),
      );
      tag.position.set(0.46, 1.62, 0.03);
      pivot.add(tag);
      const back = tag.clone();
      back.rotation.y = Math.PI;
      back.position.z = -0.03;
      pivot.add(back);
    }
    let lockLight: THREE.Mesh | null = null;
    if (d.lock) {
      lockLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 2 }));
      lockLight.position.set(0.62, 1.32, 0.13);
      g.add(lockLight);
    }
    if (d.kind === 'servizio') {
      // il cartello verde dell'uscita
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.18),
        new THREE.MeshStandardMaterial({ map: label('USCITA', { bg: '#0f8a3d', fg: '#ffffff', w: 256, h: 92 }), emissive: '#ffffff', emissiveIntensity: 0.6, emissiveMap: label('USCITA', { bg: '#0f8a3d', fg: '#ffffff', w: 256, h: 92 }) }),
      );
      sign.position.set(0, 2.42, 0.12);
      sign.rotation.y = Math.PI;
      g.add(sign);
    }
    out.set(d.id, { def: d, pivot, angle: d.open ? 1.5 : 0, want: d.open ? 1.5 : 0, lockLight });
  }
  return out;
}

// ---------------------------------------------------------------- mobili e oggetti di vita quotidiana

function buildProps(root: THREE.Group) {
  for (const p of PROPS) root.add(propMesh(p));
  // decorazioni senza collisioni: avvisi, scarpe, piante, tubi, estintori, cartelli dei piani
  const base = floorBase;
  const decor = new THREE.Group();
  const notice = (text: string, f: number, x: number, z: number, ry: number, y = 1.5) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: label(text, { w: 256, h: 340, bg: '#ece6d6', fg: '#2a2a2a', font: 'bold 26px Arial' }), roughness: 0.9 }));
    m.position.set(x, base(f) + y, z);
    m.rotation.y = ry;
    decor.add(m);
  };
  notice('AVVISO\nmanutenzione\nimpianti\nnotturna\n\nL’Amministratore', 1, 17.92, 2.2, -Math.PI / 2);
  notice('RACCOLTA\nRIFIUTI\nlun: carta\nmer: plastica\nven: vetro', 1, 8.08, 2.0, Math.PI / 2);
  notice('NON USARE\nLA POMPA\nSENZA FILTRO', 0, 17.92, 13.6, -Math.PI / 2);
  notice('PIANO\nSPENTO\nNON SALIRE\nDA SOLI', 2, 8.08, 3.5, Math.PI / 2);
  // cartelli dei piani (numeri e colori di servizio: ci si orienta)
  const floorSign = (f: number, text: string, color: string) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: label(text, { bg: color, fg: '#ffffff', w: 256, h: 128 }), roughness: 0.5 }));
    // sul muro a destra del pianerottolo, lontano dalle porte
    m.position.set(17.92, base(f) + 1.9, f === 1 || f === 2 ? 4.6 : 2.6);
    m.rotation.y = -Math.PI / 2;
    decor.add(m);
  };
  floorSign(0, '-1  CANTINA', '#2f6b4f');
  floorSign(1, '0  INGRESSO', '#a5671d');
  floorSign(2, '1  PIANO', '#40566e');
  floorSign(3, '2  PIANO', '#40566e');
  // tubature sul soffitto della cantina
  const pipeMat = plain('#6f7a74', 0.5, 0.4);
  for (const [x0, z0, x1, z1, yy, r] of [
    [8.2, 6, 8.2, 15.8, 2.6, 0.06],
    [8.4, 6, 8.4, 15.8, 2.45, 0.04],
    [8, 15.6, 18, 15.6, 2.6, 0.07],
    [17.8, 6, 17.8, 15.6, 2.55, 0.05],
  ] as [number, number, number, number, number, number][]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), pipeMat);
    m.rotation.set(Math.PI / 2, 0, x0 !== x1 ? Math.PI / 2 : 0);
    if (x0 !== x1) m.rotation.set(0, 0, Math.PI / 2);
    m.position.set((x0 + x1) / 2, base(0) + yy, (z0 + z1) / 2);
    decor.add(m);
  }
  // scarpe e borse davanti alle porte, una pianta annaffiata da poco
  const shoe = (f: number, x: number, z: number, color: string) => {
    const s = new THREE.Mesh(rbox(0.11, 0.09, 0.27, 0.04), plain(color, 0.7));
    s.position.set(x, base(f) + 0.045, z);
    s.rotation.y = Math.random() * 0.6;
    decor.add(s);
  };
  shoe(2, 9.3, 8.8, '#2b2b2b');
  shoe(2, 9.45, 9.2, '#2b2b2b');
  shoe(2, 16.6, 9.6, '#c23b3b');
  shoe(3, 9.3, 9.6, '#5b4a3a');
  const plant = (f: number, x: number, z: number) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14), plain('#a0522d', 0.7));
    pot.position.set(x, base(f) + 0.15, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), plain('#3c6e47', 0.7, 0, { flatShading: true }));
    leaves.position.set(x, base(f) + 0.55, z);
    leaves.scale.y = 1.3;
    decor.add(pot, leaves);
  };
  plant(1, 16.5, 1.6);
  plant(2, 16.6, 5.2);
  plant(3, 9.2, 5.2);
  // estintori e luci di emergenza verdi
  for (const [f, x, z] of [
    [0, 8.15, 9],
    [1, 17.85, 7.5],
    [2, 8.15, 13.5],
    [3, 17.85, 13.5],
  ] as [number, number, number][]) {
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), plain('#b3201b', 0.4));
    ext.position.set(x, base(f) + 0.75, z);
    decor.add(ext);
    const em = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#10a04a', emissive: '#22ff77', emissiveIntensity: 0.9 }));
    em.position.set(x, base(f) + 2.4, z);
    em.rotation.y = Math.PI / 2;
    decor.add(em);
  }
  // tappeti nei soggiorni
  const rug = surface('tappeto' as Tex);
  for (const [f, x, z, w, d] of [
    [2, 4.4, 9.2, 2.2, 3],
    [2, 22.5, 3.6, 2.4, 2],
    [3, 4.4, 7.5, 2.2, 3],
    [1, 22, 2.6, 2, 1.4],
  ] as [number, number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), rug);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, base(f) + 0.006, z);
    m.receiveShadow = true;
    decor.add(m);
  }
  // il bagno dell'interno 9: vasca, lavandino con lo specchio, water
  const ceramic = plain('#e9e6df', 0.18);
  const tub = new THREE.Mesh(rbox(1.6, 0.55, 0.75, 0.12), ceramic);
  tub.position.set(20.9, base(3) + 0.28, 18.5);
  const sinkB = new THREE.Mesh(rbox(0.55, 0.2, 0.42, 0.06), ceramic);
  sinkB.position.set(16, base(3) + 0.85, 18.7);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.65), new THREE.MeshStandardMaterial({ color: '#9fb0b5', roughness: 0.02, metalness: 1 }));
  mirror.position.set(16, base(3) + 1.55, 18.93);
  mirror.rotation.y = Math.PI;
  const wc = new THREE.Mesh(rbox(0.4, 0.42, 0.6, 0.12), ceramic);
  wc.position.set(14.6, base(3) + 0.21, 18.6);
  decor.add(tub, sinkB, mirror, wc);
  // frigorifero e pensili nella cucina degli Esposito
  const fridge = new THREE.Mesh(rbox(0.65, 1.75, 0.65, 0.04), plain('#d9d5c8', 0.35));
  fridge.position.set(6.6, base(2) + 0.88, 1.45);
  decor.add(fridge);
  // appendiabiti con il cappotto, giornali, secchi e scope in cantina
  const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), plain('#3a2f2a', 0.95));
  coat.position.set(8.25, base(2) + 1.35, 6.4);
  decor.add(coat);
  for (const [f, x, z] of [
    [1, 16.4, 4.2],
    [2, 15.8, 14.4],
    [3, 9.6, 13.8],
  ] as [number, number, number][]) {
    const news = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.3), plain('#cfc8b4', 0.95));
    news.position.set(x, base(f) + 0.01, z);
    news.rotation.y = Math.random() * 3;
    decor.add(news);
  }
  for (const [x, z] of [
    [16.4, 7.4],
    [9.3, 10.5],
  ]) {
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 14), plain('#2f5d8a', 0.5));
    bucket.position.set(x, base(0) + 0.15, z);
    const mop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3), plain('#8a6a40', 0.6));
    mop.position.set(x + 0.15, base(0) + 0.65, z);
    mop.rotation.z = 0.25;
    decor.add(bucket, mop);
  }
  // interruttori e prese accanto alle porte (ci si orienta anche così)
  for (const d of DOORS) {
    if (d.kind === 'portone' || d.kind === 'servizio') continue;
    const [x0, z0, x1, z1] = doorSeg(d);
    const vertical = x0 === x1;
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(rbox(0.08, 0.12, 0.02, 0.01), plain('#e8e4d8', 0.4));
      const nx = vertical ? side * 0.08 : 0;
      const nz = vertical ? 0 : side * 0.08;
      sw.position.set(vertical ? x0 + nx : x0 + 1.25, base(d.f) + 1.15, vertical ? z0 + 1.25 : z0 + nz);
      sw.rotation.y = vertical ? Math.PI / 2 : 0;
      decor.add(sw);
    }
  }
  // macchie di umidità e muffa (dipinte su piani trasparenti)
  const stainTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d')!;
    for (let i = 0; i < 5; i++) {
      const g = c.createRadialGradient(128, 128, 10 + i * 18, 128, 128, 30 + i * 22);
      g.addColorStop(0, 'rgba(60,45,25,0)');
      g.addColorStop(0.8, `rgba(70,52,28,${0.18 - i * 0.025})`);
      g.addColorStop(1, 'rgba(60,45,25,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(128 + Math.random() * 10, 128 + Math.random() * 10, 30 + i * 22, 24 + i * 18, Math.random(), 0, Math.PI * 2);
      c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const stainMat = new THREE.MeshStandardMaterial({ map: stainTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9 });
  for (const [f, x, y, z, ry, sc] of [
    [0, 8.08, 2.2, 7, Math.PI / 2, 1.6],
    [0, 17.92, 1.0, 9.5, -Math.PI / 2, 1.2],
    [3, 12, 2.4, 13.08, 0, 2],
    [2, 1.08, 2.2, 8.5, Math.PI / 2, 1.4],
    [1, 1.08, 2.4, 12, Math.PI / 2, 1.8],
    [3, 26.92, 1.8, 6, -Math.PI / 2, 1.5],
  ] as [number, number, number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * 0.8), stainMat);
    m.position.set(x, base(f) + y, z);
    m.rotation.y = ry;
    decor.add(m);
  }
  // la bicicletta da bambino senza una ruota
  const kid = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), plain('#222222'));
  wheel.position.set(0.3, 0.2, 0);
  const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), plain('#3a86ff', 0.4, 0.4));
  fr.rotation.z = 1.2;
  fr.position.set(0, 0.32, 0);
  kid.add(wheel, fr);
  kid.position.set(5.5, base(1), 10.2);
  kid.rotation.z = 0.25;
  decor.add(kid);
  root.add(decor);
}

function propMesh(p: PropBox): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(p.x, floorBase(p.f), p.z);
  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r = 0.03) => {
    const m = new THREE.Mesh(rbox(w, h, d, r), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const wood = surface('legnoMobili' as Tex);
  const lightWood = plain('#a27b52', 0.6);
  const white = plain('#e6e2d8', 0.45);
  const steel = plain('#8a9096', 0.4, 0.6);
  switch (p.kind) {
    case 'gabbia': {
      // cantina con la rete metallica e roba accatastata dentro
      const mesh = canvasTex(128, 128, (c) => {
        c.clearRect(0, 0, 128, 128);
        c.strokeStyle = '#9aa29a';
        c.lineWidth = 3;
        for (let i = -128; i < 256; i += 16) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i + 128, 128);
          c.stroke();
          c.beginPath();
          c.moveTo(i + 128, 0);
          c.lineTo(i, 128);
          c.stroke();
        }
      });
      mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping;
      mesh.repeat.set(p.w * 2, p.h * 2);
      const net = new THREE.MeshStandardMaterial({ map: mesh, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
      for (const [w, d, x, z] of [
        [p.w, 0.02, 0, p.d / 2],
        [p.w, 0.02, 0, -p.d / 2],
        [0.02, p.d, p.w / 2, 0],
        [0.02, p.d, -p.w / 2, 0],
      ] as [number, number, number, number][]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, p.h, d), net);
        m.position.set(x, p.h / 2, z);
        g.add(m);
      }
      // pile vere: la cassa sopra poggia su quella sotto
      for (let i = 0; i < 2; i++) {
        const bx = (i ? 0.45 : -0.45) * (p.w - 1) * 0.5 + (Math.random() - 0.5) * 0.3;
        const bz = (Math.random() - 0.5) * (p.d - 1);
        const h1 = 0.4 + Math.random() * 0.25;
        box(0.62, h1, 0.5, plain(['#9b7b55', '#7d6a50'][i], 0.9), bx, h1 / 2, bz).rotation.y = (Math.random() - 0.5) * 0.3;
        const h2 = 0.3 + Math.random() * 0.2;
        box(0.48, h2, 0.42, plain('#a88d64', 0.9), bx + (Math.random() - 0.5) * 0.08, h1 + h2 / 2, bz + (Math.random() - 0.5) * 0.06).rotation.y = (Math.random() - 0.5) * 0.5;
      }
      break;
    }
    case 'banco':
      box(p.w, 0.08, p.d, lightWood, 0, p.h, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, p.h, 0.07, steel, (sx * (p.w - 0.15)) / 2, p.h / 2, (sz * (p.d - 0.15)) / 2);
      box(0.4, 0.15, 0.25, plain('#b3201b', 0.5), -1.2, p.h + 0.12, 0);
      break;
    case 'scaffale':
      for (let i = 0; i < 4; i++) box(p.w, 0.04, p.d, steel, 0, 0.2 + i * 0.55, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 1.9, 0.04, steel, (sx * (p.w - 0.04)) / 2, 0.95, (sz * (p.d - 0.04)) / 2);
      for (let i = 0; i < 6; i++) box(0.25, 0.3, 0.3, plain(['#2e5e8a', '#b0752e', '#5e6b33'][i % 3], 0.7), 0, 0.37 + Math.floor(i / 2) * 0.55, -p.d / 2 + 0.4 + (i % 2) * 1.2);
      break;
    case 'lavatrice': {
      box(p.w, p.h, p.d, white, 0, p.h / 2, 0);
      const port = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), plain('#1d2226', 0.1, 0.5));
      port.position.set(0, p.h * 0.48, p.d / 2 + 0.01);
      g.add(port);
      break;
    }
    case 'vasca':
      box(p.w, p.h, p.d, plain('#d6d3cb', 0.3), 0, p.h / 2, 0);
      break;
    case 'pompa': {
      box(p.w, 0.2, p.d, steel, 0, 0.1, 0);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 20), plain('#2f5d8a', 0.45, 0.4));
      motor.rotation.z = Math.PI / 2;
      motor.position.set(-0.3, 0.65, 0);
      motor.castShadow = true;
      g.add(motor);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), steel);
      pipe.position.set(0.7, 1, -0.4);
      g.add(pipe);
      break;
    }
    case 'caldaia':
    case 'serbatoio': {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(p.w, p.d) / 2, Math.min(p.w, p.d) / 2, p.h, 24), plain(p.kind === 'caldaia' ? '#9c9f98' : '#7a8a7c', 0.5, 0.5));
      t.position.y = p.h / 2;
      t.castShadow = true;
      if (p.w > p.d) t.scale.x = p.w / p.d;
      g.add(t);
      break;
    }
    case 'quadro':
      box(p.w, p.h, p.d, plain('#9aa0a2', 0.5, 0.4), 0, p.h / 2, 0);
      for (let i = 0; i < 3; i++) box(0.02, p.h - 0.3, p.d / 3 - 0.08, plain('#8a9092', 0.45, 0.4), p.w / 2 * Math.sign(p.x < 14 ? 1 : -1), p.h / 2, -p.d / 3 + i * (p.d / 3));
      break;
    case 'bici':
      for (const x of [-0.6, 0.6]) {
        const wh = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 24), plain('#1e1e1e', 0.6));
        wh.position.set(x, 0.35, 0);
        g.add(wh);
      }
      box(1.1, 0.04, 0.04, plain('#8a2b2b', 0.4, 0.5), 0, 0.62, 0);
      break;
    case 'cassette': {
      const brass = plain('#a8834f', 0.35, 0.8);
      const wx = p.x < 14 ? -p.w / 2 + 0.03 : p.w / 2 - 0.03; // il muro è dietro
      box(0.03, 1.4, 2, plain('#5b4a3a', 0.7), wx, 0.95, 0);
      for (let i = 0; i < 8; i++) box(0.12, 0.3, 0.42, brass, wx + Math.sign(-wx) * 0.075, 0.55 + (i % 4) * 0.32, -0.5 + Math.floor(i / 4) * 1);
      break;
    }
    case 'scrivania':
    case 'tavolo':
      box(p.w, 0.05, p.d, p.kind === 'tavolo' ? lightWood : wood, 0, p.h, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, p.h, 0.05, wood, (sx * (p.w - 0.12)) / 2, p.h / 2, (sz * (p.d - 0.12)) / 2);
      break;
    case 'sedie': {
      // le sedie rosse fuori dall'appartamento
      const red = plain(p.color ?? '#c1121f', 0.45);
      for (let i = 0; i < 3; i++) {
        const z = -0.6 + i * 0.6;
        box(0.42, 0.05, 0.42, red, 0, 0.45, z);
        box(0.05, 0.45, 0.42, red, p.x < 12 ? -0.2 : 0.2, 0.7, z);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.03, 0.45, 0.03, steel, sx * 0.18, 0.22, z + sz * 0.18);
      }
      g.userData.chairs = true;
      break;
    }
    case 'cucina':
      box(p.w, p.h, p.d, white, 0, p.h / 2, 0);
      box(p.w + 0.04, 0.04, p.d + 0.04, plain('#5c5c5c', 0.3), 0, p.h + 0.02, 0);
      break;
    case 'divano': {
      const fab = surface('tessuto' as Tex);
      box(p.w, 0.45, p.d, fab, 0, 0.22, 0, 0.08);
      box(0.25, 0.5, p.d, fab, p.x > 14 ? 0.38 : -0.38, 0.6, 0, 0.08);
      for (const z of [-p.d / 2 + 0.1, p.d / 2 - 0.1]) box(p.w, 0.25, 0.18, fab, 0, 0.55, z, 0.07);
      // un cuscino storto e una coperta
      box(0.35, 0.12, 0.4, plain('#b8a27a', 0.95), 0, 0.5, -0.3, 0.05).rotation.z = 0.4;
      break;
    }
    case 'armadio':
    case 'armadietto': {
      const metal = p.kind === 'armadietto';
      const body = metal ? plain('#6d7479', 0.45, 0.55) : wood;
      box(p.w, p.h, p.d, body, 0, p.h / 2, 0);
      const [nx, nz] = p.face === 'N' ? [0, -1] : p.face === 'S' ? [0, 1] : p.face === 'E' ? [1, 0] : [-1, 0];
      const half = nx ? p.w / 2 : p.d / 2;
      const span = nx ? p.d : p.w;
      const seamMat = plain('#1a1a1a', 0.8);
      const handleMat = plain(metal ? '#c9ccd0' : '#b08d57', 0.3, 0.8);
      const doors = metal ? 1 : 2;
      for (let i = 0; i < doors; i++) {
        const off = doors === 1 ? 0 : (i - 0.5) * (span / 2);
        const panel = box(nx ? 0.012 : span / doors - 0.03, p.h - 0.08, nx ? span / doors - 0.03 : 0.012, metal ? plain('#79828a', 0.4, 0.5) : surface('legnoMobili' as Tex), nx * (half + 0.006) + (nx ? 0 : off), p.h / 2, nz * (half + 0.006) + (nx ? off : 0), 0.004);
        void panel;
        const hx = nx ? nx * (half + 0.03) : off + (doors === 1 ? span * 0.35 : -Math.sign(off) * 0.06);
        const hz = nx ? (doors === 1 ? span * 0.35 : -Math.sign(off) * 0.06) + 0 : nz * (half + 0.03);
        const handle = box(0.025, 0.14, 0.025, handleMat, nx ? hx : hx, p.h * 0.52, nx ? hz + (doors === 1 ? 0 : off) : hz, 0.008);
        void handle;
      }
      if (metal) {
        // feritoie di aerazione: da dentro si vede fuori (e da fuori si intravede dentro)
        for (let k = 0; k < 5; k++) box(nx ? 0.014 : span * 0.5, 0.018, nx ? span * 0.5 : 0.014, seamMat, nx * (half + 0.013), p.h * 0.78 + k * 0.045, nz * (half + 0.013), 0.002);
      } else box(nx ? 0.014 : 0.012, p.h - 0.1, nx ? 0.012 : 0.014, seamMat, nx * (half + 0.012), p.h / 2, nz * (half + 0.012), 0.002);
      break;
    }
    case 'letto':
      box(p.w, 0.35, p.d, wood, 0, 0.18, 0);
      box(p.w - 0.1, 0.2, p.d - 0.1, plain('#d8d0c0', 0.95), 0, 0.45, 0);
      break;
    case 'scatoloni':
      box(0.55, 0.45, 0.45, plain('#a88d64', 0.95), -0.29, 0.225, 0);
      box(0.55, 0.45, 0.45, plain('#9b7b55', 0.95), 0.29, 0.225, 0.02).rotation.y = 0.06;
      box(0.55, 0.45, 0.45, plain('#b49a70', 0.95), 0.02, 0.675, 0).rotation.y = -0.12;
      break;
    default:
      box(p.w, p.h, p.d, wood, 0, p.h / 2, 0);
  }
  return g;
}

// ---------------------------------------------------------------- postazioni di lavoro

function buildStations(root: THREE.Group) {
  const out = new Map<string, THREE.Object3D>();
  for (const st of STATIONS) {
    const g = new THREE.Group();
    g.position.set(st.x, floorBase(st.f) + st.y, st.z);
    const panel = (w: number, h: number, color: string) => {
      const m = new THREE.Mesh(rbox(w, h, 0.12, 0.02), plain(color, 0.5, 0.3));
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const lamp = (x: number, y: number, color: string) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }));
      l.position.set(x, y, 0.07);
      g.add(l);
      return l;
    };
    switch (st.kind) {
      case 'pannello':
      case 'collaudo1':
      case 'collaudo2': {
        panel(0.55, 0.7, '#b9bdb6');
        g.userData.leds = [lamp(-0.15, 0.22, '#ff3b30'), lamp(0, 0.22, '#ffcc00'), lamp(0.15, 0.22, '#34c759')];
        const slot = new THREE.Mesh(rbox(0.3, 0.16, 0.05), plain('#222222', 0.4));
        slot.position.set(0, -0.08, 0.06);
        g.add(slot);
        break;
      }
      case 'lampada': {
        // lampada da cantiere su un treppiede
        const legMat = plain('#3a3a3a', 0.5, 0.5);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, st.y - 0.04, 8), legMat);
        pole.position.y = -(st.y + 0.04) / 2;
        g.add(pole);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), legMat);
          leg.position.set(Math.sin(a) * 0.16, -st.y + 0.27, Math.cos(a) * 0.16);
          leg.rotation.set(Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55);
          g.add(leg);
        }
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 16), plain('#444444', 0.5, 0.4));
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffd9a0', emissiveIntensity: 0 }));
        bulb.position.y = 0.16;
        g.add(base, bulb);
        g.userData.bulb = bulb;
        break;
      }
      case 'filtro': {
        // il corpo del filtro poggia a terra, attaccato alla pompa
        const hh = st.y + 0.25;
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, hh, 16), plain('#2f5d8a', 0.45, 0.4));
        housing.position.y = 0.25 - hh / 2;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 16), plain('#6f7a74', 0.4, 0.6));
        cap.position.y = 0.27;
        g.add(housing, cap);
        break;
      }
      case 'lavello': {
        const sink = new THREE.Mesh(rbox(0.8, 0.3, 0.5, 0.04), plain('#cfccc4', 0.3));
        const cab = new THREE.Mesh(rbox(0.78, st.y - 0.15, 0.48, 0.02), plain('#8a8f88', 0.6, 0.2));
        cab.position.y = -0.15 - (st.y - 0.15) / 2;
        g.add(cab);
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), plain('#b9bcbf', 0.2, 0.9));
        tap.position.set(0, 0.3, -0.18);
        g.add(sink, tap);
        break;
      }
      case 'pompa':
        panel(0.4, 0.5, '#d9b23a');
        g.userData.leds = [lamp(-0.1, 0.15, '#ff3b30'), lamp(0.1, 0.15, '#34c759')];
        break;
      case 'livello': {
        for (const yy of [-0.45, 0.45]) {
          const br = new THREE.Mesh(rbox(0.05, 0.04, 0.09, 0.01), plain('#6f7a74', 0.4, 0.6));
          br.position.set(0, yy, -0.04);
          g.add(br);
        }
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshStandardMaterial({ color: '#cde6ff', transparent: true, opacity: 0.35, roughness: 0.05 }));
        const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 12), new THREE.MeshStandardMaterial({ color: '#2a6f8a', emissive: '#0d3a4a', emissiveIntensity: 0.6 }));
        g.add(tube, fill);
        g.userData.fill = fill;
        break;
      }
      case 'alloggio':
        panel(0.6, 0.4, '#3d4246');
        g.userData.leds = [lamp(0.2, 0.12, '#ff3b30')];
        break;
      case 'valvola': {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), plain('#c0392b', 0.4, 0.3));
        // il tubo corre lungo il muro dal pavimento al soffitto, la valvola su un tronchetto
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H1.ceil, 10), plain('#6f7a74', 0.5, 0.4));
        pipe.position.set(0, H1.ceil / 2 - st.y, -0.07);
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), plain('#6f7a74', 0.5, 0.4));
        stub.rotation.x = Math.PI / 2;
        stub.position.z = -0.03;
        g.add(wheel, pipe, stub);
        g.userData.wheel = wheel;
        break;
      }
      case 'portone':
        break;
    }
    // il lato con i comandi guarda verso la stanza (verso il centro del palazzo)
    g.rotation.y = st.ry ?? Math.atan2(13.5 - st.x, 9.5 - st.z);
    root.add(g);
    out.set(st.id, g);
  }
  return out;
}

// ---------------------------------------------------------------- oggetti da trasportare

export function makeItem(kind: 'modulo' | 'filtro' | 'batteria') {
  const g = new THREE.Group();
  if (kind === 'modulo') {
    const b = new THREE.Mesh(rbox(0.3, 0.12, 0.22, 0.02), plain('#5b6066', 0.5, 0.4));
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: '#1f6b3a', emissive: '#0c3a1e', emissiveIntensity: 0.4 }));
    board.position.y = 0.07;
    g.add(b, board);
  } else if (kind === 'filtro') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 16), plain('#6b5a3a', 0.9));
    g.add(c);
    g.userData.body = c;
  } else {
    const b = new THREE.Mesh(rbox(0.42, 0.3, 0.26, 0.03), plain('#1f1f1f', 0.5));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.27), plain('#e5b81e', 0.5));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), plain('#222222'));
    handle.position.y = 0.16;
    g.add(b, stripe, handle);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

// ---------------------------------------------------------------- fuori: facciata, furgone, pioggia

export interface Outside {
  rain: THREE.LineSegments;
  van: THREE.Group;
  screen: THREE.Mesh;
}
export function buildExterior(root: THREE.Object3D): Outside {
  // la facciata sopra il piano terra (una sola immagine grande, con finestre e balconi)
  const facadeTex = new THREE.TextureLoader().load('/horror/tex/facciata.webp');
  facadeTex.colorSpace = THREE.SRGBColorSpace;
  facadeTex.wrapS = THREE.RepeatWrapping;
  facadeTex.repeat.set(2.6, 1);
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(H1.cols, 7.4), new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.9, color: '#9a968e' }));
  facade.position.set(H1.cols / 2, 2.9 + 3.7, 0.92);
  facade.rotation.y = Math.PI;
  facade.receiveShadow = true;
  root.add(facade);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(H1.cols + 0.6, 0.35, 0.6), plain('#6d665c', 0.8));
  cornice.position.set(H1.cols / 2, 10.4, 0.8);
  root.add(cornice);
  // una finestra accesa al terzo piano… in un palazzo evacuato
  const lit = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ffb45a', emissiveIntensity: 1.4 }));
  lit.position.set(20.3, 8.1, 0.9);
  lit.rotation.y = Math.PI;
  root.add(lit);
  // muretti e cancello del cortile
  const wallMat = surface('muroCantina');
  for (const [x, z, w, d] of [
    [H1.cols / 2, -10.05, H1.cols, 0.2],
    [-0.05, -5, 0.2, 10],
    [H1.cols + 0.05, -5, 0.2, 10],
  ] as [number, number, number, number][]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), wallMat);
    m.position.set(x, 1.2, z);
    m.receiveShadow = true;
    root.add(m);
  }
  // il furgone della squadra: bianco sporco, portellone aperto, monitor acceso
  const van = new THREE.Group();
  const white = plain('#d7d5cf', 0.45, 0.3);
  const glass = new THREE.MeshStandardMaterial({ color: '#0d141c', roughness: 0.05, metalness: 0.7 });
  // il cassone è vuoto dentro (aperto dietro): si vedono lo scaffale e il monitor
  const body = new THREE.Group();
  for (const [w, h, d, x, y, z] of [
    [2.0, 0.08, 4.4, 0, 0.39, 0],
    [2.0, 0.08, 4.4, 0, 2.51, 0],
    [0.06, 2.2, 4.4, -0.97, 1.45, 0],
    [0.06, 2.2, 4.4, 0.97, 1.45, 0],
    [2.0, 2.2, 0.06, 0, 1.45, 2.17],
  ] as [number, number, number, number, number, number][]) {
    const m = new THREE.Mesh(rbox(w, h, d, 0.03), white);
    m.position.set(x, y, z);
    body.add(m);
  }
  const cab = new THREE.Mesh(rbox(2.0, 1.5, 1.1, 0.25), white);
  cab.position.set(0, 1.1, 2.7);
  const wind = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.7), glass);
  wind.position.set(0, 1.5, 3.26);
  wind.rotation.x = -0.35;
  van.add(body, cab, wind);
  for (const [x, z] of [
    [-1, 2.6],
    [1, 2.6],
    [-1, -1.4],
    [1, -1.4],
  ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18), plain('#151515', 0.8));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    van.add(w);
  }
  // fari accesi (illuminano il cortile bagnato)
  for (const x of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#fff1c8', emissiveIntensity: 2.5 }));
    hl.position.set(x, 0.9, 3.27);
    van.add(hl);
  }
  const beams = new THREE.SpotLight('#fff1d8', 30, 18, 0.5, 0.6, 1.5);
  beams.position.set(0, 0.9, 3.3);
  beams.target.position.set(0, 0, 9);
  van.add(beams, beams.target);
  // dentro: scaffali con l'attrezzatura e il monitor con la pianta del palazzo
  const rack = plain('#3a3d40', 0.6, 0.4);
  for (const yy of [0.8, 1.3, 1.8]) {
    const board = new THREE.Mesh(rbox(0.45, 0.04, 2.8, 0.01), rack);
    board.position.set(-0.7, yy, -0.4);
    van.add(board);
  }
  for (const zz of [-1.78, 0.98]) {
    const up = new THREE.Mesh(rbox(0.04, 1.6, 0.04, 0.01), rack);
    up.position.set(-0.5, 1.23, zz);
    van.add(up);
  }
  for (let i = 0; i < 6; i++) {
    const box = new THREE.Mesh(rbox(0.35, 0.22, 0.4, 0.02), plain(['#c9a227', '#2f4f6f', '#8a2b2b'][i % 3], 0.6));
    box.position.set(-0.7, 0.93 + Math.floor(i / 3) * 0.5, -1.4 + (i % 3) * 0.9);
    van.add(box);
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: '#0b2a1a', emissive: '#2bd27a', emissiveIntensity: 0.45 }));
  screen.position.set(0.85, 1.6, -0.6);
  screen.rotation.y = -Math.PI / 2;
  van.add(screen);
  const inside = new THREE.PointLight('#d9fff0', 2.5, 4, 2);
  inside.position.set(0, 2.2, -0.8);
  van.add(inside);
  // portellone posteriore aperto
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(rbox(0.95, 2.0, 0.06, 0.03), white);
    door.position.set(s * 1.45, 1.4, -2.35);
    door.rotation.y = s * 1.3;
    van.add(door);
  }
  van.position.set(6.2, 0, -5.6);
  van.rotation.y = Math.PI / 2 + 0.08;
  van.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  root.add(van);
  // bidoni della spazzatura e una macchina parcheggiata
  for (const [x, z, c] of [
    [22, -9.3, '#2f5d3a'],
    [23.2, -9.3, '#3c4e8a'],
    [24.4, -9.3, '#7a6a2a'],
  ] as [number, number, string][]) {
    const b = new THREE.Mesh(rbox(1, 1.2, 0.9, 0.06), plain(c, 0.6));
    b.position.set(x, 0.6, z);
    b.castShadow = true;
    root.add(b);
  }
  const car = new THREE.Mesh(rbox(1.8, 1.1, 4, 0.3), plain('#3b1f22', 0.3, 0.5));
  car.position.set(20, 0.65, -5.5);
  car.rotation.y = 0.12;
  car.castShadow = true;
  root.add(car);
  // la pioggia (solo intorno a chi è fuori)
  const N = 1400;
  const pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * H1.cols;
    const z = -10 + Math.random() * 10.8;
    const y = Math.random() * 12;
    pos.set([x, y, z, x + 0.02, y - 0.5, z + 0.02], i * 6);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#8fa3b8', transparent: true, opacity: 0.35 }));
  rain.frustumCulled = false;
  root.add(rain);
  return { rain, van, screen };
}
export function updateRain(o: Outside, dt: number) {
  const p = o.rain.geometry.attributes.position as THREE.BufferAttribute;
  const a = p.array as Float32Array;
  for (let i = 0; i < a.length; i += 6) {
    a[i + 1] -= dt * 14;
    a[i + 4] -= dt * 14;
    if (a[i + 4] < 0) {
      const y = 11 + Math.random() * 2;
      a[i + 1] = y;
      a[i + 4] = y - 0.5;
    }
  }
  p.needsUpdate = true;
}

// ---------------------------------------------------------------- oggetti che il palazzo sposta

export interface DynObj {
  def: DynProp;
  obj: THREE.Group;
  glow?: THREE.Mesh; // schermo della TV o della radio
  anim: { k: string; t: number; seed: number } | null;
  end: boolean; // già nello stato finale
}
// la foto di famiglia con un volto cancellato a mano
const photoTex = () =>
  (() => {
    const cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 200;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#7d6a4f';
    c.fillRect(0, 0, 160, 200);
    c.fillStyle = '#a89070';
    c.fillRect(10, 10, 140, 180);
    for (const [x, y, r] of [
      [50, 80, 18],
      [105, 75, 20],
      [80, 120, 14],
    ]) {
      c.fillStyle = '#5c4a35';
      c.fillRect(x - r, y + r, r * 2, 70);
      c.fillStyle = '#d8b994';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    // il volto cancellato
    c.strokeStyle = '#1a1410';
    c.lineWidth = 5;
    for (let i = 0; i < 14; i++) {
      c.beginPath();
      c.moveTo(88 + Math.random() * 34, 58 + Math.random() * 34);
      c.lineTo(88 + Math.random() * 34, 58 + Math.random() * 34);
      c.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
export function buildDyn(root: THREE.Object3D): Map<string, DynObj> {
  const out = new Map<string, DynObj>();
  const wood = surface('legnoMobili' as Tex);
  for (const d of DYN_PROPS) {
    const g = new THREE.Group();
    const inner = new THREE.Group(); // si anima questo (il gruppo esterno resta al suo posto)
    g.add(inner);
    let glow: THREE.Mesh | undefined;
    switch (d.kind) {
      case 'tazza': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.09, 14), plain('#e8e4da', 0.3));
        m.position.y = 0.045;
        inner.add(m);
        break;
      }
      case 'bottiglia': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.24, 12), new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }));
        m.position.y = 0.12;
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.09, 10), m.material);
        neck.position.y = 0.28;
        inner.add(m, neck);
        break;
      }
      case 'libro': {
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(rbox(0.16, 0.04, 0.23, 0.01), plain(['#6e2a2e', '#2a4a6e', '#5a5a2a'][i], 0.7));
          b.position.set(0, 0.02 + i * 0.042, 0);
          b.rotation.y = i * 0.2;
          inner.add(b);
        }
        break;
      }
      case 'quadro': {
        const frame = new THREE.Mesh(rbox(0.42, 0.52, 0.04, 0.01), plain('#5a3d22', 0.5));
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), new THREE.MeshStandardMaterial({ map: photoTex(), roughness: 0.6 }));
        pic.position.z = 0.022;
        inner.add(frame, pic);
        break;
      }
      case 'tv': {
        const box = new THREE.Mesh(rbox(0.6, 0.48, 0.48, 0.04), plain('#2a2522', 0.5));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshStandardMaterial({ color: '#0d1210', emissive: '#c9d6cf', emissiveIntensity: 0, roughness: 0.1 }));
        scr.position.z = 0.245;
        const stand = new THREE.Mesh(rbox(0.8, 0.5, 0.45, 0.02), wood);
        stand.position.y = -0.5;
        inner.add(box, scr, stand);
        glow = scr;
        break;
      }
      case 'radio': {
        const box = new THREE.Mesh(rbox(0.32, 0.18, 0.12, 0.02), plain('#6b4a2f', 0.5));
        box.position.y = 0.09;
        const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2010', emissive: '#ffb45a', emissiveIntensity: 0 }));
        dial.position.set(0.06, 0.12, 0.062);
        inner.add(box, dial);
        glow = dial;
        break;
      }
      case 'anta': {
        // pensile della cucina: l'anta gira sul cardine
        const cab = new THREE.Mesh(rbox(0.36, 0.6, 0.9, 0.02), wood);
        cab.position.x = 0.18;
        g.add(cab);
        const door = new THREE.Mesh(rbox(0.03, 0.58, 0.88, 0.01), wood);
        door.position.set(0, 0, 0.44);
        inner.position.set(0.37, 0, -0.44);
        inner.add(door);
        break;
      }
      case 'rubinetto': {
        const sink = new THREE.Mesh(rbox(0.5, 0.18, 0.4, 0.03), plain('#cfccc4', 0.3));
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22), plain('#b9bcbf', 0.2, 0.9));
        tap.position.set(0, 0.18, -0.15);
        g.add(sink, tap);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.6 }));
        water.position.set(0, 0.17, -0.1);
        water.visible = false;
        inner.add(water);
        glow = water;
        break;
      }
      case 'sedia': {
        const seat = new THREE.Mesh(rbox(0.44, 0.04, 0.42, 0.01), wood);
        seat.position.y = 0.46;
        const back = new THREE.Mesh(rbox(0.44, 0.5, 0.04, 0.01), wood);
        back.position.set(0, 0.72, -0.2);
        inner.add(seat, back);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 6), wood);
          leg.position.set(sx * 0.19, 0.23, sz * 0.18);
          inner.add(leg);
        }
        break;
      }
      case 'giocattolo': {
        const car = new THREE.Mesh(rbox(0.22, 0.09, 0.12, 0.03), plain('#c0392b', 0.4));
        car.position.y = 0.07;
        inner.add(car);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10), plain('#111111'));
          w.rotation.x = Math.PI / 2;
          w.position.set(sx * 0.07, 0.025, sz * 0.065);
          inner.add(w);
        }
        break;
      }
      case 'pallone': {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), plain('#d64a3a', 0.5));
        b.position.y = 0.11;
        inner.add(b);
        break;
      }
      case 'scatola': {
        const b = new THREE.Mesh(rbox(0.4, 0.3, 0.32, 0.01), plain('#a88d64', 0.95));
        b.position.y = 0.15;
        inner.add(b);
        break;
      }
      case 'attrezzo': {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 8), surface('ruggine' as Tex));
        h.rotation.z = Math.PI / 2;
        h.position.y = 0.02;
        inner.add(h);
        break;
      }
      case 'barattolo': {
        const glass = new THREE.MeshStandardMaterial({ color: '#b9d4c4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 });
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 14), glass);
        jar.position.y = 0.07;
        const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.08, 12), plain(['#7a4b1e', '#9b2d20', '#c9a227'][d.id.length % 3], 0.6));
        fill.position.y = 0.045;
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 14), plain('#8a8f93', 0.4, 0.6));
        lid.position.y = 0.15;
        inner.add(jar, fill, lid);
        break;
      }
      case 'scopa': {
        // appoggiata al muro (pende verso il muro, cade verso la stanza)
        inner.position.z = 0.3;
        inner.rotation.x = -0.29;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 8), plain('#8a6a40', 0.6));
        stick.position.y = 0.75;
        const bristle = new THREE.Mesh(rbox(0.3, 0.12, 0.08, 0.02), plain('#c9b27a', 0.95));
        bristle.position.y = 0.06;
        inner.add(stick, bristle);
        break;
      }
      case 'secchio': {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 16, 1, true), plain('#7d8a93', 0.4, 0.6, { side: THREE.DoubleSide }));
        b.position.y = 0.15;
        const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), plain('#5e676e', 0.5, 0.5));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.y = 0.005;
        inner.add(b, bottom);
        break;
      }
      case 'telefono': {
        const base = new THREE.Mesh(rbox(0.2, 0.08, 0.22, 0.03), plain('#1d1d1d', 0.3));
        base.position.y = 0.04;
        const hand = new THREE.Mesh(rbox(0.22, 0.05, 0.06, 0.025), plain('#1d1d1d', 0.3));
        hand.position.y = 0.11;
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 16), plain('#d8d4c8', 0.4));
        dial.rotation.x = -0.5;
        dial.position.set(0, 0.075, 0.07);
        g.add(base, dial);
        inner.add(hand);
        break;
      }
      case 'carillon': {
        const boxM = new THREE.Mesh(rbox(0.16, 0.08, 0.12, 0.01), plain('#6b3a2a', 0.5));
        boxM.position.y = 0.04;
        g.add(boxM);
        // il coperchio (si apre) e la ballerina
        inner.position.set(0, 0.08, -0.06);
        const lid = new THREE.Mesh(rbox(0.16, 0.015, 0.12, 0.005), plain('#7d4530', 0.5));
        lid.position.z = 0.06;
        inner.add(lid);
        const dancer = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8), plain('#f0d8e0', 0.4));
        dancer.position.set(0, 0.11, 0);
        dancer.name = 'ballerina';
        dancer.visible = false;
        g.add(dancer);
        break;
      }
      case 'lampadario': {
        // appeso al soffitto: oscilla attorno al gancio
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6), plain('#111111'));
        wire.position.y = -0.3;
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.15, 16, 1, true), plain('#5a6a5e', 0.5, 0.4, { side: THREE.DoubleSide }));
        shade.position.y = -0.66;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff4dd', emissive: '#ffcf96', emissiveIntensity: 0.15 }));
        bulb.position.y = -0.7;
        inner.add(wire, shade, bulb);
        glow = bulb;
        break;
      }
      case 'bambola': {
        // seduta, girata verso il muro... finché non si gira
        const dress = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 12), plain('#8a2b3a', 0.8));
        dress.position.y = 0.1;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), plain('#e6d2c0', 0.35));
        head.position.y = 0.26;
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), plain('#2a1a10', 0.9));
        hair.position.y = 0.265;
        hair.rotation.x = 0.35;
        const eyeMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.1 });
        for (const sx of [-1, 1]) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeMat);
          e.position.set(sx * 0.024, 0.27, 0.058);
          inner.add(e);
        }
        inner.add(dress, head, hair);
        break;
      }
    }
    g.position.set(d.x, floorBase(d.f) + d.y, d.z);
    if (d.wall) g.rotation.y = d.wall === 'W' ? Math.PI / 2 : d.wall === 'E' ? -Math.PI / 2 : d.wall === 'N' ? 0 : Math.PI;
    else g.rotation.y = d.rot ?? 0;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    root.add(g);
    out.set(d.id, { def: d, obj: g, glow, anim: null, end: false });
  }
  return out;
}
// L'animazione di un oggetto (cade, rotola, si gira, si apre, si accende). k = secondi dall'inizio. instant = mettilo subito nello stato finale
export function animateDyn(o: DynObj, k: number, instant = false) {
  const a = o.anim;
  if (!a) return;
  const inner = o.obj.children[0] as THREE.Group;
  const rnd = (n: number) => ((Math.sin(a.seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const d = o.def;
  const T = instant ? 99 : k;
  if (a.k === 'cade' && d.kind === 'scopa') {
    // la scopa scivola dal muro e sbatte a terra (rimbalzo)
    const m = Math.min(1, T / 0.55);
    const bounce = T > 0.55 && T < 0.8 ? Math.sin(((T - 0.55) / 0.25) * Math.PI) * 0.12 : 0;
    inner.rotation.x = -0.29 + (1.57 + 0.29) * m * m - bounce;
  } else if (a.k === 'cade') {
    if (d.kind === 'quadro') {
      // si stacca dal muro, scivola giù e resta appoggiato storto
      const fall = Math.min(1, T / 0.45);
      const h = d.y - 0.27;
      inner.position.set(0, -h * fall * fall, 0.05 + fall * 0.12);
      inner.rotation.set(-fall * 0.35, 0, (rnd(1) - 0.5) * fall * 0.6);
    } else {
      // si rovescia, cade dal tavolo e rotola un po'
      const dir = rnd(2) * Math.PI * 2;
      const tip = Math.min(1, T / 0.25);
      const drop = Math.max(0, Math.min(1, (T - 0.2) / 0.35));
      const roll = Math.max(0, Math.min(1, (T - 0.55) / 0.6));
      const dist = 0.35 + rnd(3) * 0.35 + roll * 0.25;
      inner.position.set(Math.sin(dir) * dist * Math.min(1, tip + drop), -d.y * drop * drop + (d.y > 0 ? Math.abs(Math.sin(drop * Math.PI)) * 0.05 : 0), Math.cos(dir) * dist * Math.min(1, tip + drop));
      inner.rotation.set(Math.cos(dir) * 1.55 * tip, roll * 2.5 * rnd(4), -Math.sin(dir) * 1.55 * tip);
    }
  } else if (a.k === 'rotola') {
    const dir = rnd(5) * Math.PI * 2;
    const m = Math.min(1, T / 2.2);
    const e = 1 - (1 - m) * (1 - m);
    inner.position.set(Math.sin(dir) * e * 2.4, Math.abs(Math.sin(m * 12)) * (1 - m) * 0.12, Math.cos(dir) * e * 2.4);
    inner.rotation.set(e * 14 * Math.cos(dir), 0, -e * 14 * Math.sin(dir));
  } else if (a.k === 'gira' && d.kind === 'bambola') {
    // la bambola si gira di colpo (a scatti) verso la stanza
    const m = Math.min(1, T / 0.9);
    const step = Math.floor(m * 4) / 4;
    inner.rotation.y = Math.PI * (T > 2.5 ? 1 : step);
    inner.rotation.z = T > 2.5 ? 0.25 : 0;
  } else if (a.k === 'gira') {
    // la sedia si gira lentamente verso la porta (o verso di te)
    const m = Math.min(1, T / 1.6);
    inner.rotation.y = (rnd(6) < 0.5 ? 1 : -1) * (1.2 + rnd(7)) * (m * m * (3 - 2 * m));
  } else if (a.k === 'squilla') {
    // la cornetta trema a ogni squillo
    const ringing = T < 9.6 && T % 3.2 < 1.6;
    inner.rotation.z = ringing ? (Math.random() - 0.5) * 0.12 : 0;
    inner.position.y = ringing ? Math.random() * 0.01 : 0;
  } else if (a.k === 'suona') {
    const open = T < 7 ? Math.min(1, T / 0.5) : Math.max(0, 1 - (T - 7) / 2);
    inner.rotation.x = -1.2 * open;
    const dancer = o.obj.getObjectByName('ballerina');
    if (dancer) {
      dancer.visible = open > 0.3;
      dancer.rotation.y = T * 2.2;
    }
  } else if (a.k === 'oscilla') {
    const e = T < 6 ? Math.exp(-T / 2.4) : 0;
    inner.rotation.z = Math.sin(T * 3.1) * 0.38 * e;
    inner.rotation.x = Math.sin(T * 2.3 + 1) * 0.12 * e;
    if (o.glow) (o.glow.material as THREE.MeshStandardMaterial).emissiveIntensity = T < 6 && Math.random() < 0.85 ? 0.5 : 0.05;
  } else if (a.k === 'apre') {
    const m = Math.min(1, T / 0.9);
    inner.rotation.y = -1.6 * (1 - Math.pow(1 - m, 3));
  } else if (a.k === 'accende') {
    // TV e radio restano accese ~8 secondi, il rubinetto ~6
    const on = T < (d.kind === 'rubinetto' ? 6 : 8);
    if (o.glow) {
      if (d.kind === 'rubinetto') o.glow.visible = on;
      else (o.glow.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.6 + Math.random() * 0.8 : 0;
    }
  }
  const dur = a.k === 'squilla' ? 10 : a.k === 'suona' ? 9.5 : a.k === 'oscilla' ? 6.5 : 3;
  if (T > dur && a.k !== 'accende') o.end = true;
}
