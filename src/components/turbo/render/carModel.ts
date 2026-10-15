// ⚽🚗 Axend Turbo — la macchina stile Octane, fatta da zero: carrozzeria "scolpita" da sezioni arrotondate
// (muso basso, coda alta), abitacolo di vetro scuro, parafanghi larghi, spoiler, minigonne, tubi del boost, fanali,
// antenna con la pallina. Una texture per squadra (colore, strisce bianche, parti nere) fa tutta la carrozzeria
// in UNA chiamata di disegno; le ruote di tutte le macchine sono una sola InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { arenaNormal, arenaRay } from '../../../game/turbo/arena';
import type { Car } from '../../../game/turbo/car';
import { WHEEL_DEFS } from '../../../game/turbo/car';
import { V3 } from '../../../game/turbo/math';
import { TEAM_COLORS } from '../contract';
import { S, dirToThree, toThree } from './coords';
import type { Fx } from './fx';
import { FONT, FRAG_OUT, canvasTex, strokeText } from './util';

export const MAX_CARS = 16;
const TAU = Math.PI * 2;

// uu locali della macchina (avanti +x, sinistra +y, su +z) → locali di three (avanti +x, su +y, sinistra −z), in metri
const UU2THREE = new THREE.Matrix4().set(S, 0, 0, 0, 0, 0, S, 0, 0, -S, 0, 0, 0, 0, 0, 1);

// ---------------------------------------------------------------- atlante della carrozzeria
// parte alta (v 0,25…1): la vernice della carrozzeria (u = giro della sezione, v = lunghezza);
// in basso: campioni di colore pieno per le altre parti
const SW = { team: 0, black: 1, white: 2, glass: 3, chrome: 4, teamDark: 5, carbon: 6 } as const;
const swatchUV = (i: number): [number, number] => [(i * 64 + 32) / 512, 1 - 450 / 512];

function paintAtlas(team: 0 | 1) {
  const base = TEAM_COLORS[team];
  const dark = new THREE.Color(base).multiplyScalar(0.45).getStyle();
  const map = canvasTex(512, 512, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 384);
    // luce: più chiaro sopra, più scuro sui fianchi bassi
    const lg = g.createLinearGradient(0, 0, 512, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.35)');
    lg.addColorStop(0.2, 'rgba(0,0,0,0.05)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    lg.addColorStop(0.8, 'rgba(0,0,0,0.05)');
    lg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = lg;
    g.fillRect(0, 0, 512, 384);
    // minigonne nere in basso
    g.fillStyle = '#15171d';
    g.fillRect(0, 0, 90, 384);
    g.fillRect(422, 0, 90, 384);
    // fascia scura sui fianchi con filo bianco (le due fiancate: u ≈ 0,25 e 0,75)
    for (const cx of [128, 384]) {
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(cx - 14, 20);
      g.lineTo(cx + 8, 20);
      g.lineTo(cx + 14, 330);
      g.lineTo(cx - 8, 330);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(cx + (cx < 256 ? 16 : -20), 30, 4, 300);
    }
    // doppia striscia bianca sul tetto e sul cofano
    g.fillStyle = '#ffffff';
    g.fillRect(238, 0, 11, 384);
    g.fillRect(263, 0, 11, 384);
    // prese d'aria sul cofano
    g.fillStyle = 'rgba(10,10,14,0.85)';
    for (const x of [214, 284]) g.fillRect(x, 40, 14, 60);
    // campioni
    const sw = [base, '#15171d', '#f4f6fb', '#0b1220', '#c9ced8', dark, '#2a2d35', '#101010'];
    sw.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(i * 64, 384, 64, 128);
    });
  });
  // ruvidezza (G) e metallo (B) con la stessa disposizione
  const orm = canvasTex(
    512,
    512,
    (g) => {
      g.fillStyle = 'rgb(255,82,40)';
      g.fillRect(0, 0, 512, 384);
      g.fillStyle = 'rgb(255,170,0)';
      g.fillRect(0, 0, 90, 384);
      g.fillRect(422, 0, 90, 384);
      const rough = [82, 170, 90, 18, 38, 100, 130, 200];
      const metal = [40, 0, 0, 160, 255, 30, 60, 0];
      rough.forEach((r, i) => {
        g.fillStyle = `rgb(255,${r},${metal[i]})`;
        g.fillRect(i * 64, 384, 64, 128);
      });
    },
    { srgb: false },
  );
  return { map, orm };
}

// ---------------------------------------------------------------- "spazzata" di sezioni arrotondate (superellissi)
interface Ring {
  c: [number, number, number];
  A: [number, number, number]; // asse della larghezza
  B: [number, number, number]; // asse dell'altezza (verso "fuori/sopra")
  ha: number;
  hb: number;
  eT?: number;
  eB?: number;
  taper?: number;
  v?: number; // per la vernice: posizione lungo la macchina (0 dietro … 1 davanti)
}
const spow = (x: number, e: number) => Math.sign(x) * Math.pow(Math.abs(x), e);

function sweep(rings: Ring[], seg: number, swatch: number | null, capStart = true, capEnd = true) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const nr = rings.length;
  const S1 = seg + 1;
  const sw = swatch === null ? null : swatchUV(swatch);
  const ring = (r: Ring, k: number) => {
    const th = -Math.PI / 2 + (TAU * k) / seg;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const e = s >= 0 ? (r.eT ?? 0.6) : (r.eB ?? 0.4);
    const a = r.ha * spow(c, e) * (1 - (r.taper ?? 0) * Math.max(0, s));
    const b = r.hb * spow(s, e);
    return [r.c[0] + r.A[0] * a + r.B[0] * b, r.c[1] + r.A[1] * a + r.B[1] * b, r.c[2] + r.A[2] * a + r.B[2] * b];
  };
  for (const r of rings)
    for (let k = 0; k <= seg; k++) {
      pos.push(...ring(r, k));
      if (sw) uv.push(sw[0], sw[1]);
      else uv.push(k / seg, 0.25 + 0.75 * (r.v ?? 0.5));
    }
  for (let i = 0; i < nr - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * S1 + k;
      const b = a + 1;
      const c = a + S1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  // verso delle facce: la normale deve andare verso l'esterno (lungo +A al punto θ = 0)
  {
    const r = rings[Math.floor(nr / 2) - (nr > 2 ? 0 : 1)];
    const i = rings.indexOf(r);
    const k = Math.floor(seg / 4);
    const a = i * S1 + k;
    const P = (j: number) => new THREE.Vector3(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    const fn = new THREE.Vector3().subVectors(P(a + S1), P(a)).cross(new THREE.Vector3().subVectors(P(a + 1), P(a)));
    const out = new THREE.Vector3(r.A[0], r.A[1], r.A[2]);
    if (fn.dot(out) < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }
  // tappi (vertici separati: normali piatte)
  const cap = (ri: number, dir: number) => {
    const r = rings[ri];
    const base = pos.length / 3;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < seg; k++) {
      const p = ring(r, k);
      cx += p[0] / seg;
      cy += p[1] / seg;
      cz += p[2] / seg;
    }
    pos.push(cx, cy, cz);
    uv.push(...(sw ?? [0.5, 0.25 + 0.75 * (r.v ?? 0.5)]));
    for (let k = 0; k <= seg; k++) {
      pos.push(...ring(r, k));
      uv.push(...(sw ?? [k / seg, 0.25 + 0.75 * (r.v ?? 0.5)]));
    }
    // direzione in cui deve guardare il tappo
    const o = rings[ri === 0 ? 1 : ri - 1].c;
    const want = new THREE.Vector3(r.c[0] - o[0], r.c[1] - o[1], r.c[2] - o[2]).multiplyScalar(dir < 0 ? 1 : 1);
    const t0: number[] = [];
    for (let k = 0; k < seg; k++) t0.push(base, base + 1 + k, base + 2 + k);
    const P = (j: number) => new THREE.Vector3(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    let flip = false;
    for (let k = 0; k < seg; k++) {
      const fn = new THREE.Vector3().subVectors(P(t0[k * 3 + 1]), P(base)).cross(new THREE.Vector3().subVectors(P(t0[k * 3 + 2]), P(base)));
      if (fn.lengthSq() > 1e-10) {
        flip = fn.dot(want) < 0;
        break;
      }
    }
    for (let t = 0; t < t0.length; t += 3) idx.push(t0[t], flip ? t0[t + 2] : t0[t + 1], flip ? t0[t + 1] : t0[t + 2]);
  };
  if (capStart) cap(0, -1);
  if (capEnd) cap(nr - 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// sezione lungo x (carrozzeria, abitacolo, minigonne…)
function alongX(list: [number, number, number, number][], opts: { y?: number; eT?: number; eB?: number; taper?: number; x0?: number; x1?: number }) {
  const x0 = opts.x0 ?? -50;
  const x1 = opts.x1 ?? 77;
  return list.map(
    ([x, hw, zb, zt]): Ring => ({
      c: [x, opts.y ?? 0, (zb + zt) / 2],
      A: [0, 1, 0],
      B: [0, 0, 1],
      ha: hw,
      hb: (zt - zb) / 2,
      eT: opts.eT,
      eB: opts.eB,
      taper: opts.taper,
      v: (x - x0) / (x1 - x0),
    }),
  );
}

// parafango ad arco attorno alla ruota (centro x, z; lato y)
function fender(wx: number, wz: number, yc: number, R: number, ha: number, hb: number, a0: number, a1: number) {
  const rings: Ring[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const k = 0.7 + 0.3 * Math.sin((i / n) * Math.PI);
    rings.push({ c: [wx + ca * R, yc, wz + sa * R], A: [0, 1, 0], B: [ca, 0, sa], ha: ha * k, hb, eT: 0.35, eB: 0.35 });
  }
  return sweep(rings, 16, SW.team);
}

// barretta da a a b (sezione larga ha lungo "side", spessa hb)
function strut(a: [number, number, number], b: [number, number, number], side: [number, number, number], ha: number, hb: number, sw: number, e = 0.5) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const A = new THREE.Vector3(...side).normalize();
  const B = new THREE.Vector3().crossVectors(d, A).normalize();
  const mk = (p: [number, number, number]): Ring => ({ c: p, A: [A.x, A.y, A.z], B: [B.x, B.y, B.z], ha, hb, eT: e, eB: e });
  return sweep([mk(a), mk(b)], 12, sw);
}

// i pezzi della carrozzeria (in uu locali), separati: servono anche alle prove
export function bodyParts() {
  const parts: THREE.BufferGeometry[] = [];
  // scocca
  parts.push(
    sweep(
      alongX(
        [
          [-49.5, 15, 9, 24],
          [-48, 24, 3, 30],
          [-44, 29, 0, 33],
          [-34, 31, -2, 34.5],
          [-20, 31, -3, 34],
          [-4, 30, -3, 32.5],
          [12, 29.5, -3, 29.5],
          [28, 29, -2, 25.5],
          [42, 28.5, -1, 21.5],
          [54, 28, 0, 17.5],
          [64, 26.5, 1.5, 13.5],
          [71.5, 22, 3, 10.5],
          [76, 14, 4.5, 8],
        ],
        { eT: 0.55, eB: 0.35, taper: 0.12 },
      ),
      40,
      null,
    ),
  );
  // abitacolo (vetro scuro)
  parts.push(
    sweep(
      alongX(
        [
          [-31, 17, 31, 33],
          [-25, 22.5, 30, 39.5],
          [-14, 25, 30, 44.5],
          [0, 24.5, 29, 45],
          [11, 22.5, 27, 41.5],
          [19, 19, 24.5, 34.5],
          [24, 13, 23, 26],
        ],
        { eT: 0.75, eB: 0.3, taper: 0.22 },
      ),
      28,
      SW.glass,
    ),
  );
  // cornice del tetto (bianca) sopra il vetro
  parts.push(
    sweep(
      alongX(
        [
          [-24, 6, 43.2, 45.2],
          [-12, 7, 44.6, 46.4],
          [2, 7, 44.6, 46.2],
          [10, 6, 41.8, 43.4],
        ],
        { eT: 0.6, eB: 0.6 },
      ),
      12,
      SW.white,
    ),
  );
  // presa d'aria sul cofano
  parts.push(
    sweep(
      alongX(
        [
          [30, 7, 21.5, 25.6],
          [38, 9, 19.5, 25.4],
          [48, 8, 16.5, 21.2],
          [53, 5, 15, 17.5],
        ],
        { eT: 0.5, eB: 0.5 },
      ),
      16,
      SW.carbon,
    ),
  );
  // parafanghi (dietro e davanti, due lati)
  for (const s of [1, -1]) {
    parts.push(fender(-33.75, 0, 35 * s, 20, 9, 3, -0.22, 2.75));
    parts.push(fender(51.25, -3, 33.5 * s, 17.5, 8, 2.8, 0.3, Math.PI + 0.25));
    // minigonne
    parts.push(
      sweep(
        alongX(
          [
            [-13, 3, -6, 2],
            [-9, 4.5, -7, 4],
            [29, 4.5, -7, 3],
            [33, 3, -6, 1],
          ],
          { y: 32.5 * s, eT: 0.5, eB: 0.5 },
        ),
        12,
        SW.black,
      ),
    );
    // alette laterali dello spoiler e montanti
    parts.push(strut([-53, 36.5 * s, 41], [-38, 36.5 * s, 41], [0, 0, 1], 6.5, 1.1, SW.carbon));
    parts.push(strut([-40, 13 * s, 32], [-45, 13 * s, 43], [1, 0, 0], 3.2, 1.2, SW.carbon));
    // tubi del boost (cromati)
    parts.push(
      sweep(
        [
          { c: [-45, 9.5 * s, 8.5], A: [0, 1, 0], B: [0, 0, 1], ha: 4.6, hb: 4.6, eT: 1, eB: 1 },
          { c: [-51.6, 9.5 * s, 8.5], A: [0, 1, 0], B: [0, 0, 1], ha: 4.6, hb: 4.6, eT: 1, eB: 1 },
          { c: [-52, 9.5 * s, 8.5], A: [0, 1, 0], B: [0, 0, 1], ha: 4.0, hb: 4.0, eT: 1, eB: 1 },
        ],
        14,
        SW.chrome,
      ),
    );
  }
  // alettone
  const tilt = -0.12;
  const A: [number, number, number] = [Math.cos(tilt), 0, Math.sin(tilt)];
  const B: [number, number, number] = [-Math.sin(tilt), 0, Math.cos(tilt)];
  parts.push(
    sweep(
      [-37.5, -36, 36, 37.5].map((y, i): Ring => ({ c: [-45.5, y, 44], A, B, ha: i === 0 || i === 3 ? 7.5 : 9, hb: i === 0 || i === 3 ? 1.1 : 1.6, eT: 0.5, eB: 0.6 })),
      14,
      SW.team,
    ),
  );
  // labbro anteriore e diffusore (neri)
  parts.push(
    sweep(
      alongX(
        [
          [56, 29, -5, -1],
          [72, 33, -5, -1.5],
          [76.5, 28, -4.5, -2.5],
          [78, 20, -4, -3],
        ],
        { eT: 0.3, eB: 0.3 },
      ),
      20,
      SW.black,
    ),
  );
  parts.push(
    sweep(
      alongX(
        [
          [-51.5, 20, -1, 7],
          [-49, 26, -3, 8],
          [-39, 26, -3, 6],
        ],
        { eT: 0.35, eB: 0.35 },
      ),
      20,
      SW.black,
    ),
  );
  // antenna con la pallina
  parts.push(strut([-37, -21, 30], [-37.5, -21, 58], [1, 0, 0], 0.6, 0.6, SW.black, 1));
  const ball = new THREE.SphereGeometry(3.2, 12, 8);
  ball.translate(-37.5, -21, 60);
  const bu = ball.getAttribute('uv');
  const [su, sv] = swatchUV(SW.team);
  for (let i = 0; i < bu.count; i++) bu.setXY(i, su, sv);
  parts.push(ball);
  return parts;
}
export function bodyGeometry() {
  const parts = bodyParts();
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.applyMatrix4(UU2THREE);
  g.computeBoundingSphere();
  return g;
}

// fanali, luci di coda, bocche dei tubi (colori accesi, senza luce)
export function lightsGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const head = new THREE.Color(1.7, 1.8, 2.0);
  const tail = new THREE.Color(2.0, 0.1, 0.12);
  const pipe = new THREE.Color(2.0, 0.75, 0.15);
  for (const s of [1, -1]) {
    const h = new THREE.SphereGeometry(1, 14, 8);
    h.scale(3, 5.6, 2.1);
    h.rotateY(0.35);
    h.rotateZ(0.32 * s);
    h.translate(72.6, 12.5 * s, 8.4);
    parts.push(paint(h.toNonIndexed(), head));
    const t = new THREE.BoxGeometry(1.6, 12, 2.6);
    t.translate(-48.7, 13 * s, 22);
    parts.push(paint(t.toNonIndexed(), tail));
    const p = new THREE.CircleGeometry(3.6, 16);
    p.rotateY(-Math.PI / 2);
    p.translate(-52.15, 9.5 * s, 8.5);
    parts.push(paint(p.toNonIndexed(), pipe));
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.applyMatrix4(UU2THREE);
  return g;
}

// fiamma del boost: due coni con la base sull'origine, punta verso −x (three locali)
export function flameGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    const c = new THREE.CylinderGeometry(0, 4.3, 32, 14, 3, true);
    c.rotateZ(Math.PI / 2);
    c.translate(-16, 9.5 * s, 0);
    parts.push(c);
    const inner = new THREE.CylinderGeometry(0, 2.4, 18, 10, 2, true);
    inner.rotateZ(Math.PI / 2);
    inner.translate(-9, 9.5 * s, 0);
    parts.push(inner);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.applyMatrix4(UU2THREE);
  return g;
}
const FLAME_POS = new THREE.Vector3(-52.2 * S, 8.5 * S, 0); // dove escono le fiamme (three locali)

const FLAME_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FLAME_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float t = vUv.y;
  float edge = abs(dot(normalize(vN), normalize(vV)));
  float flick = 0.8 + 0.2 * sin(uTime * 55.0 + vUv.x * 25.0 + t * 9.0);
  vec3 core = vec3(1.7, 1.5, 1.05);
  vec3 c = mix(core, uColor, smoothstep(0.05, 0.75, t + (1.0 - edge) * 0.5));
  float a = pow(1.0 - t, 1.3) * (0.25 + 0.75 * edge) * flick;
  gl_FragColor = vec4(c, a);
  ${FRAG_OUT}
}`;

// ruota (raggio 1, larghezza 0,8, asse lungo z): gomma, cerchio a 5 razze, mozzo
export function wheelGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, v: number) => {
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3).fill(v);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const prof = [
    [0.62, -0.4],
    [0.86, -0.4],
    [0.96, -0.35],
    [1.0, -0.22],
    [1.0, 0.22],
    [0.96, 0.35],
    [0.86, 0.4],
    [0.62, 0.4],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(prof, 28);
  tire.rotateX(Math.PI / 2);
  parts.push(paint(tire, 0.045));
  for (const s of [1, -1]) {
    const lip = new THREE.TorusGeometry(0.62, 0.05, 6, 28);
    lip.translate(0, 0, 0.33 * s);
    parts.push(paint(lip, 1));
    const back = new THREE.CircleGeometry(0.62, 24);
    if (s < 0) back.rotateY(Math.PI);
    back.translate(0, 0, 0.2 * s);
    parts.push(paint(back, 0.06));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      const sp = new THREE.BoxGeometry(0.46, 0.13, 0.08);
      sp.translate(0.4, 0, 0);
      sp.rotateZ(a);
      sp.translate(0, 0, 0.3 * s);
      parts.push(paint(sp, 0.92));
    }
  }
  const hub = new THREE.CylinderGeometry(0.19, 0.19, 0.7, 16);
  hub.rotateX(Math.PI / 2);
  parts.push(paint(hub, 0.3));
  for (const p of parts) if (p.getAttribute('uv') === undefined) p.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.getAttribute('position').count * 2), 2));
  const g = mergeGeometries(parts)!;
  return g;
}

// ---------------------------------------------------------------- ombre finte (dischi morbidi sulla superficie sotto la macchina)

const SHADOW_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iAx;
attribute vec3 iAy;
attribute float iAlpha;
varying vec2 vUv;
varying float vA;
void main() {
  vec3 p = iPos + iAx * position.x * 2.0 + iAy * position.y * 2.0;
  vUv = position.xy * 2.0;
  vA = iAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const SHADOW_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vA;
void main() {
  vec2 q = abs(vUv);
  vec2 d = max(q - vec2(0.45, 0.3), 0.0);
  float r = length(d) / 0.55;
  float a = (1.0 - smoothstep(0.15, 1.0, r)) * vA;
  gl_FragColor = vec4(0.0, 0.0, 0.02, a);
}`;

export class Shadows {
  mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aX: THREE.InstancedBufferAttribute;
  private aY: THREE.InstancedBufferAttribute;
  private aA: THREE.InstancedBufferAttribute;
  constructor(max: number) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aX = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aY = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iAx', this.aX);
    geo.setAttribute('iAy', this.aY);
    geo.setAttribute('iAlpha', this.aA);
    geo.instanceCount = max;
    this.geo = geo;
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -6,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  set(i: number, p: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, a: number) {
    (this.aPos.array as Float32Array).set([p.x, p.y, p.z], i * 3);
    (this.aX.array as Float32Array).set([ax.x, ax.y, ax.z], i * 3);
    (this.aY.array as Float32Array).set([ay.x, ay.y, ay.z], i * 3);
    (this.aA.array as Float32Array)[i] = a;
  }
  hide(i: number) {
    (this.aA.array as Float32Array)[i] = 0;
  }
  flush(count: number) {
    this.geo.instanceCount = count;
    this.aPos.needsUpdate = this.aX.needsUpdate = this.aY.needsUpdate = this.aA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- risorse condivise da tutte le macchine

export class CarKit {
  group = new THREE.Group();
  bodyGeo = bodyGeometry();
  lightsGeo = lightsGeometry();
  flameGeo = flameGeometry();
  bodyMats: THREE.MeshPhysicalMaterial[];
  lightsMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  flameMats: THREE.ShaderMaterial[];
  wheels: THREE.InstancedMesh;
  shadows = new Shadows(MAX_CARS);
  teamCol = [new THREE.Color(TEAM_COLORS[0]), new THREE.Color(TEAM_COLORS[1])];
  private free: number[] = [];
  constructor() {
    this.bodyMats = ([0, 1] as const).map((t) => {
      const { map, orm } = paintAtlas(t);
      return new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 1.15 });
    });
    this.flameMats = this.teamCol.map(
      (c) =>
        new THREE.ShaderMaterial({
          vertexShader: FLAME_VERT,
          fragmentShader: FLAME_FRAG,
          uniforms: { uColor: { value: c.clone().multiplyScalar(1.8) }, uTime: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
    );
    this.wheels = new THREE.InstancedMesh(wheelGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), MAX_CARS * 4);
    this.wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wheels.frustumCulled = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_CARS * 4; i++) {
      this.wheels.setMatrixAt(i, zero);
      this.wheels.setColorAt(i, this.teamCol[0]);
    }
    this.wheels.count = 0;
    for (let i = MAX_CARS - 1; i >= 0; i--) this.free.push(i);
    this.group.add(this.wheels, this.shadows.mesh);
  }
  takeSlot() {
    return this.free.length ? this.free.pop()! : -1;
  }
  giveSlot(i: number) {
    if (i < 0) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < 4; k++) this.wheels.setMatrixAt(i * 4 + k, zero);
    this.shadows.hide(i);
    this.free.push(i);
  }
  setTime(t: number) {
    for (const m of this.flameMats) m.uniforms.uTime.value = t;
  }
  flush() {
    let used = 0;
    for (let i = 0; i < MAX_CARS; i++) if (!this.free.includes(i)) used = i + 1;
    this.wheels.count = used * 4;
    this.wheels.instanceMatrix.needsUpdate = true;
    if (this.wheels.instanceColor) this.wheels.instanceColor.needsUpdate = true;
    this.shadows.flush(used);
  }
}

// ---------------------------------------------------------------- una macchina in campo

function nameTexture(name: string, team: 0 | 1) {
  return canvasTex(
    256,
    64,
    (g) => {
    let size = 34;
    g.font = `900 ${size}px ${FONT}`;
    while (g.measureText(name).width > 236 && size > 16) {
      size -= 2;
      g.font = `900 ${size}px ${FONT}`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    strokeText(g, name, 128, 28, '#ffffff', 'rgba(8,10,20,0.9)', 7);
    const w = Math.min(236, g.measureText(name).width);
    g.fillStyle = TEAM_COLORS[team];
    g.fillRect(128 - w / 2, 52, w, 6);
    },
    { text: true },
  );
}

// visivo: ruote più grandi della fisica (stile Octane), più in fuori; il fondo della ruota resta dove tocca
const WHEEL_VIS = [
  { r: 14, y: 33 },
  { r: 14, y: -33 },
  { r: 16.5, y: 34.5 },
  { r: 16.5, y: -34.5 },
];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _mw = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
const _n = new THREE.Vector3();
const _back = new THREE.Vector3();
const _uA = new V3();
const _uB = new V3();
const _uN = new V3();

export interface CarCtx {
  t: number;
  dt: number;
  fx: Fx;
  kit: CarKit;
  me: boolean;
  name: string;
  camPos: THREE.Vector3;
  boostRate: number; // particelle per tubo per fotogramma (qualità)
  fancy: boolean; // scie e fumo (spenti con la qualità bassa)
}

export class CarView {
  root = new THREE.Group();
  body: THREE.Mesh;
  lights: THREE.Mesh;
  flame: THREE.Mesh;
  nameSprite: THREE.Sprite;
  slot: number;
  team: 0 | 1;
  private nameKey = '';
  private ribL = -1;
  private ribR = -1;
  private prevGround = true;
  private prevVel = new THREE.Vector3();
  private prevJumping = false;
  private prevDemoed = false;
  private lastPos = new THREE.Vector3(1e9, 0, 0);
  private ss = 0; // supersonico (sfumato)
  private boostAcc = 0;
  readonly id: string;

  constructor(id: string, team: 0 | 1, kit: CarKit, fx: Fx, parent: THREE.Object3D) {
    this.id = id;
    this.team = team;
    this.slot = kit.takeSlot();
    this.body = new THREE.Mesh(kit.bodyGeo, kit.bodyMats[team]);
    this.lights = new THREE.Mesh(kit.lightsGeo, kit.lightsMat);
    this.flame = new THREE.Mesh(kit.flameGeo, kit.flameMats[team]);
    this.flame.position.copy(FLAME_POS);
    this.flame.visible = false;
    this.flame.renderOrder = 8;
    this.root.add(this.body, this.lights, this.flame);
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
    this.nameSprite.scale.set(0.36, 0.09, 1);
    this.nameSprite.center.set(0.5, 0);
    this.nameSprite.renderOrder = 20;
    this.nameSprite.visible = false;
    parent.add(this.root, this.nameSprite);
    const white = new THREE.Color(1.3, 1.4, 1.6).lerp(kit.teamCol[team], 0.25);
    this.ribL = fx.ribbons.alloc(white, 0.07);
    this.ribR = fx.ribbons.alloc(white, 0.07);
  }

  setTeam(team: 0 | 1, kit: CarKit) {
    if (team === this.team) return;
    this.team = team;
    this.body.material = kit.bodyMats[team];
    this.flame.material = kit.flameMats[team];
    this.nameKey = '';
  }

  private setName(name: string) {
    const key = `${name}|${this.team}`;
    if (key === this.nameKey) return;
    this.nameKey = key;
    const mat = this.nameSprite.material;
    mat.map?.dispose();
    mat.map = name ? nameTexture(name, this.team) : null;
    mat.needsUpdate = true;
  }

  update(car: Car, off: { x: number; y: number; z: number } | undefined, c: CarCtx) {
    const { kit, fx } = c;
    const slot = this.slot;
    this.setTeam(car.team, kit);
    // posizione e orientamento (con la correzione visiva)
    _uA.set(car.pos.x + (off?.x ?? 0), car.pos.y + (off?.y ?? 0), car.pos.z + (off?.z ?? 0));
    toThree(_uA, this.root.position);
    _q.set(car.rot.x, car.rot.z, -car.rot.y, car.rot.w);
    this.root.quaternion.copy(_q);
    const P = this.root.position;

    // demolita: sparisce con l'esplosione; ricompare con un anello
    if (car.demoed) {
      if (!this.prevDemoed) {
        fx.explosion(P, kit.teamCol[car.team], 1, false);
        fx.ribbons.reset(this.ribL);
        fx.ribbons.reset(this.ribR);
      }
      this.prevDemoed = true;
      this.root.visible = false;
      this.nameSprite.visible = false;
      _m.makeScale(0, 0, 0);
      if (slot >= 0) {
        for (let k = 0; k < 4; k++) kit.wheels.setMatrixAt(slot * 4 + k, _m);
        kit.shadows.hide(slot);
      }
      fx.ribbons.push(this.ribL, P.x, P.y, P.z, 0);
      fx.ribbons.push(this.ribR, P.x, P.y, P.z, 0);
      return;
    }
    const teleported = this.lastPos.distanceToSquared(P) > 36; // più di 6 m in un fotogramma
    if (this.prevDemoed) {
      fx.respawn(P, kit.teamCol[car.team]);
      fx.ribbons.reset(this.ribL);
      fx.ribbons.reset(this.ribR);
    } else if (teleported) {
      fx.ribbons.reset(this.ribL);
      fx.ribbons.reset(this.ribR);
    }
    this.prevDemoed = false;
    this.root.visible = true;
    this.lastPos.copy(P);

    _mw.compose(P, _q, _one);
    const fwd = _v2.set(1, 0, 0).applyQuaternion(_q);
    const up = _v3.set(0, 1, 0).applyQuaternion(_q);

    // ruote: sospensione (susp), sterzo (steer), rotazione (spin)
    if (slot >= 0)
      for (let i = 0; i < 4; i++) {
        const wd = WHEEL_DEFS[i];
        const w = car.wheels[i];
        const vis = WHEEL_VIS[i];
        const cz = wd.hz - w.susp + (vis.r - wd.radius);
        _v.set(wd.x * S, cz * S, -vis.y * S);
        _qs.setFromAxisAngle(_Y, w.steer);
        _q.setFromAxisAngle(_Z, -w.spin);
        _qs.multiply(_q);
        _s.setScalar(vis.r * S);
        _m.compose(_v, _qs, _s);
        _m.premultiply(_mw);
        kit.wheels.setMatrixAt(slot * 4 + i, _m);
        kit.wheels.setColorAt(slot * 4 + i, kit.teamCol[car.team]);
      }
    _q.set(car.rot.x, car.rot.z, -car.rot.y, car.rot.w);

    // ombra: raggio verso la superficie (sotto la macchina se è appoggiata, verso il basso se è in aria)
    if (slot >= 0) {
      if (car.onGround) car.up(_uB).scale(-1);
      else _uB.set(0, 0, -1);
      const hit = arenaRay(_uA, _uB, 700);
      if (hit >= 0) {
        _uN.set(_uA.x + _uB.x * hit, _uA.y + _uB.y * hit, _uA.z + _uB.z * hit);
        const hp = toThree(_uN, _v);
        arenaNormal(_uN.x, _uN.y, _uN.z, _uN);
        const n = dirToThree(_uN, _n);
        hp.addScaledVector(n, 0.015);
        const f = _s.copy(fwd).addScaledVector(n, -fwd.dot(n));
        if (f.lengthSq() < 1e-6) f.set(1, 0, 0);
        f.normalize();
        const side = n.cross(f).normalize();
        const a = 0.62 * Math.max(0, 1 - hit / 700);
        kit.shadows.set(slot, hp, f.multiplyScalar(0.78), side.multiplyScalar(0.58), a);
      } else kit.shadows.hide(slot);
    }

    // fiamma e particelle del boost
    this.flame.visible = car.isBoosting;
    if (car.isBoosting) {
      const fl = 0.85 + Math.random() * 0.35 + (car.isSupersonic ? 0.25 : 0);
      this.flame.scale.set(fl, 0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.2);
      this.boostAcc += c.boostRate;
      const vel = toThree(car.vel, _s);
      while (this.boostAcc >= 1) {
        this.boostAcc -= 1;
        for (let sz = 1; sz >= -1; sz -= 2) {
          _v.set(-0.55, 0.085, 0.095 * sz).applyMatrix4(_mw);
          _back.copy(fwd).negate();
          fx.boost(_v, _back, vel, kit.teamCol[car.team], car.isSupersonic, c.fancy);
        }
      }
    } else this.boostAcc = 0;

    // scie supersoniche dagli spigoli dietro
    this.ss += ((car.isSupersonic ? 1 : 0) - this.ss) * Math.min(1, c.dt * 8);
    if (c.fancy) {
      _v.set(-0.48, 0.12, 0.36).applyMatrix4(_mw);
      fx.ribbons.push(this.ribL, _v.x, _v.y, _v.z, this.ss > 0.05 ? this.ss : 0);
      _v.set(-0.48, 0.12, -0.36).applyMatrix4(_mw);
      fx.ribbons.push(this.ribR, _v.x, _v.y, _v.z, this.ss > 0.05 ? this.ss : 0);
    }

    // salti e atterraggi: polvere
    const vel = toThree(car.vel, _s); // m/s
    if (car.isJumping && !this.prevJumping && car.jumpTime < 0.05) {
      _v.copy(P).addScaledVector(up, -0.17);
      fx.dust(_v, up, 0.35);
    }
    if (car.onGround && !this.prevGround) {
      const impact = -this.prevVel.dot(up);
      if (impact > 3) {
        _v.copy(P).addScaledVector(up, -0.17);
        fx.dust(_v, up, Math.min(1, impact / 14));
      }
    }
    this.prevGround = car.onGround;
    this.prevJumping = car.isJumping;
    this.prevVel.copy(vel);

    // nome sopra la macchina (non il mio)
    this.setName(c.name);
    const showName = !c.me && !!c.name;
    this.nameSprite.visible = showName;
    if (showName) {
      this.nameSprite.position.set(P.x, P.y + 1.05, P.z);
      const d = P.distanceTo(c.camPos);
      this.nameSprite.material.opacity = d < 2.5 ? 0 : Math.min(1, (d - 2.5) / 2) * 0.95;
    }
  }

  dispose(kit: CarKit, fx: Fx) {
    kit.giveSlot(this.slot);
    fx.ribbons.free(this.ribL);
    fx.ribbons.free(this.ribR);
    this.root.removeFromParent();
    this.nameSprite.removeFromParent();
    this.nameSprite.material.map?.dispose();
    this.nameSprite.material.dispose();
  }
}
