// ⚽🚗 Axend Turbo — effetti: particelle (un'unica mesh "instanced" per tipo di fusione), scie a nastro, aloni,
// onde d'urto e anelli. Tutto preallocato: durante la partita non si crea niente (né oggetti né memoria).
import * as THREE from 'three';
import { FRAG_OUT } from './util';

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- particelle

const PART_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iCol;
attribute vec3 iSize; // dimensione, allungamento lungo la velocità, rotazione
varying vec4 vCol;
varying vec2 vUv;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 q = position.xy;
  float size = iSize.x;
  vec2 off;
  if (iSize.y > 0.0) {
    vec3 vv = mat3(viewMatrix) * iVel;
    vec2 d = vv.xy;
    float l = length(d);
    d = l > 1e-4 ? d / l : vec2(0.0, 1.0);
    vec2 n = vec2(-d.y, d.x);
    float len = size + l * iSize.y;
    off = d * q.y * len + n * q.x * size;
  } else {
    float c = cos(iSize.z);
    float s = sin(iSize.z);
    off = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * size;
  }
  mv.xy += off;
  vCol = iCol;
  vUv = q;
  gl_Position = projectionMatrix * mv;
}`;
const PART_FRAG_ADD = /* glsl */ `
varying vec4 vCol;
varying vec2 vUv;
void main() {
  float d = length(vUv) * 2.0;
  float a = clamp(1.0 - d, 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a);
  gl_FragColor = vec4(vCol.rgb, a * vCol.a);
  ${FRAG_OUT}
}`;
const PART_FRAG_ALPHA = /* glsl */ `
varying vec4 vCol;
varying vec2 vUv;
void main() {
  float d = length(vUv) * 2.0;
  float a = smoothstep(1.0, 0.55, d);
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vCol.rgb * (0.75 + 0.25 * (1.0 - d)), a * vCol.a);
  ${FRAG_OUT}
}`;

export class Particles {
  readonly max: number;
  count = 0;
  budget = 1; // qualità: 0..1 (quante se ne creano davvero)
  mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private p: Float32Array;
  private v: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private a0: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private stretch: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private attrs: THREE.InstancedBufferAttribute[];

  constructor(max: number, additive: boolean) {
    this.max = max;
    const F = (n: number) => new Float32Array(max * n);
    this.p = F(3);
    this.v = F(3);
    this.life = F(1);
    this.maxLife = F(1);
    this.s0 = F(1);
    this.s1 = F(1);
    this.c0 = F(3);
    this.c1 = F(3);
    this.a0 = F(1);
    this.drag = F(1);
    this.grav = F(1);
    this.stretch = F(1);
    this.rot = F(1);
    this.spin = F(1);
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.aPos = new THREE.InstancedBufferAttribute(F(3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(F(3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(F(4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(F(3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iVel', this.aVel);
    geo.setAttribute('iCol', this.aCol);
    geo.setAttribute('iSize', this.aSize);
    geo.instanceCount = 0;
    this.geo = geo;
    this.attrs = [this.aPos, this.aVel, this.aCol, this.aSize];
    const mat = new THREE.ShaderMaterial({
      vertexShader: PART_VERT,
      fragmentShader: additive ? PART_FRAG_ADD : PART_FRAG_ALPHA,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: !additive,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
  }

  // una particella (metri, m/s, secondi). c0 → c1 nel corso della vita
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: THREE.Color, c1: THREE.Color, alpha: number, drag = 0, grav = 0, stretch = 0, spin = 0) {
    let i = this.count;
    if (i >= this.max) i = (Math.random() * this.max) | 0; // piena: si rimpiazza una a caso
    else this.count++;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx;
    this.v[i * 3 + 1] = vy;
    this.v[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.c0[i * 3] = c0.r;
    this.c0[i * 3 + 1] = c0.g;
    this.c0[i * 3 + 2] = c0.b;
    this.c1[i * 3] = c1.r;
    this.c1[i * 3 + 1] = c1.g;
    this.c1[i * 3 + 2] = c1.b;
    this.a0[i] = alpha;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.stretch[i] = stretch;
    this.rot[i] = Math.random() * TAU;
    this.spin[i] = spin;
  }

  clear() {
    this.count = 0;
    this.geo.instanceCount = 0;
  }

  update(dt: number) {
    const { p, v } = this;
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // si toglie scambiandola con l'ultima
        n--;
        if (i !== n) this.move(n, i);
        i--;
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      v[i * 3] *= k;
      v[i * 3 + 1] = v[i * 3 + 1] * k - this.grav[i] * dt;
      v[i * 3 + 2] *= k;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
    }
    this.count = n;
    const ap = this.aPos.array as Float32Array;
    const av = this.aVel.array as Float32Array;
    const ac = this.aCol.array as Float32Array;
    const as = this.aSize.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const age = 1 - this.life[i] / this.maxLife[i];
      ap[i * 3] = p[i * 3];
      ap[i * 3 + 1] = p[i * 3 + 1];
      ap[i * 3 + 2] = p[i * 3 + 2];
      av[i * 3] = v[i * 3];
      av[i * 3 + 1] = v[i * 3 + 1];
      av[i * 3 + 2] = v[i * 3 + 2];
      ac[i * 4] = this.c0[i * 3] + (this.c1[i * 3] - this.c0[i * 3]) * age;
      ac[i * 4 + 1] = this.c0[i * 3 + 1] + (this.c1[i * 3 + 1] - this.c0[i * 3 + 1]) * age;
      ac[i * 4 + 2] = this.c0[i * 3 + 2] + (this.c1[i * 3 + 2] - this.c0[i * 3 + 2]) * age;
      ac[i * 4 + 3] = this.a0[i] * Math.min(1, age * 14) * (1 - age) * (1 - age * 0.3);
      as[i * 3] = this.s0[i] + (this.s1[i] - this.s0[i]) * age;
      as[i * 3 + 1] = this.stretch[i];
      as[i * 3 + 2] = this.rot[i];
    }
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(1, n) * a.itemSize);
      a.needsUpdate = true;
    }
    this.geo.instanceCount = n;
  }

  private move(from: number, to: number) {
    const c3 = (arr: Float32Array) => {
      arr[to * 3] = arr[from * 3];
      arr[to * 3 + 1] = arr[from * 3 + 1];
      arr[to * 3 + 2] = arr[from * 3 + 2];
    };
    c3(this.p);
    c3(this.v);
    c3(this.c0);
    c3(this.c1);
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from];
    this.s1[to] = this.s1[from];
    this.a0[to] = this.a0[from];
    this.drag[to] = this.drag[from];
    this.grav[to] = this.grav[from];
    this.stretch[to] = this.stretch[from];
    this.rot[to] = this.rot[from];
    this.spin[to] = this.spin[from];
  }
}

// ---------------------------------------------------------------- aloni (quadratini luminosi sempre girati verso la telecamera)

export class Glows {
  mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  count = 0;
  constructor(max: number) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iVel', new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('iCol', this.aCol);
    geo.setAttribute('iSize', this.aSize);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: PART_VERT,
      fragmentShader: PART_FRAG_ADD,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }
  set(i: number, x: number, y: number, z: number, size: number, c: THREE.Color, a: number) {
    const p = this.aPos.array as Float32Array;
    const col = this.aCol.array as Float32Array;
    const s = this.aSize.array as Float32Array;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    col[i * 4] = c.r;
    col[i * 4 + 1] = c.g;
    col[i * 4 + 2] = c.b;
    col[i * 4 + 3] = a;
    s[i * 3] = size;
    s[i * 3 + 1] = 0;
    s[i * 3 + 2] = 0;
    if (i >= this.count) this.count = i + 1;
  }
  setAlpha(i: number, a: number, size?: number) {
    (this.aCol.array as Float32Array)[i * 4 + 3] = a;
    if (size !== undefined) (this.aSize.array as Float32Array)[i * 3] = size;
  }
  flush() {
    this.geo.instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- scie a nastro (boost, supersonico, palla)

const RIB_VERT = /* glsl */ `
attribute vec4 color;
attribute float side;
varying vec4 vCol;
varying float vSide;
void main() {
  vCol = color;
  vSide = side;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
const RIB_FRAG = /* glsl */ `
varying vec4 vCol;
varying float vSide;
void main() {
  float a = 1.0 - vSide * vSide;
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
  ${FRAG_OUT}
}`;

export class Ribbons {
  readonly N: number;
  readonly max: number;
  mesh: THREE.Mesh;
  private pts: Float32Array;
  private ints: Float32Array;
  private head: Int32Array;
  private used: Uint8Array;
  private live: Uint8Array;
  private col: Float32Array;
  private width: Float32Array;
  private aPos: THREE.BufferAttribute;
  private aCol: THREE.BufferAttribute;
  private tA = new THREE.Vector3();
  private tB = new THREE.Vector3();
  private tC = new THREE.Vector3();
  constructor(max: number, N = 26) {
    this.N = N;
    this.max = max;
    this.pts = new Float32Array(max * N * 3);
    this.ints = new Float32Array(max * N);
    this.head = new Int32Array(max);
    this.used = new Uint8Array(max);
    this.live = new Uint8Array(max);
    this.col = new Float32Array(max * 3);
    this.width = new Float32Array(max);
    const nv = max * N * 2;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(nv * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const side = new Float32Array(nv);
    for (let i = 0; i < nv; i++) side[i] = i % 2 ? 1 : -1;
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
    const idx: number[] = [];
    for (let r = 0; r < max; r++)
      for (let k = 0; k < N - 1; k++) {
        const a = (r * N + k) * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT,
      fragmentShader: RIB_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }
  alloc(c: THREE.Color, width: number) {
    for (let i = 0; i < this.max; i++)
      if (!this.used[i]) {
        this.used[i] = 1;
        this.setStyle(i, c, width);
        this.reset(i);
        return i;
      }
    return -1;
  }
  free(id: number) {
    if (id < 0) return;
    this.used[id] = 0;
    this.reset(id);
  }
  setStyle(id: number, c: THREE.Color, width: number) {
    if (id < 0) return;
    this.col[id * 3] = c.r;
    this.col[id * 3 + 1] = c.g;
    this.col[id * 3 + 2] = c.b;
    this.width[id] = width;
  }
  reset(id: number) {
    if (id < 0) return;
    this.ints.fill(0, id * this.N, (id + 1) * this.N);
    this.live[id] = 0;
    this.head[id] = -1;
  }
  // nuovo punto in testa (metri); intensità 0 = in quel tratto la scia non c'è
  push(id: number, x: number, y: number, z: number, intensity: number) {
    if (id < 0) return;
    const N = this.N;
    let h = this.head[id];
    if (h < 0) {
      // la prima volta si riempie tutto lo storico con lo stesso punto
      for (let k = 0; k < N; k++) {
        const o = (id * N + k) * 3;
        this.pts[o] = x;
        this.pts[o + 1] = y;
        this.pts[o + 2] = z;
      }
      h = 0;
    } else h = (h + 1) % N;
    this.head[id] = h;
    const o = (id * N + h) * 3;
    this.pts[o] = x;
    this.pts[o + 1] = y;
    this.pts[o + 2] = z;
    this.ints[id * N + h] = intensity;
    if (intensity > 0) this.live[id] = N + 1;
    else if (this.live[id] > 0) this.live[id]--;
  }
  update(cam: THREE.Vector3) {
    const N = this.N;
    const P = this.aPos.array as Float32Array;
    const C = this.aCol.array as Float32Array;
    const t = this.tA;
    const view = this.tB;
    const sd = this.tC;
    for (let r = 0; r < this.max; r++) {
      const base = r * N * 2;
      if (!this.used[r] || !this.live[r] || this.head[r] < 0) {
        // vuota: tutti i vertici in un punto (nessun pixel)
        if (C[base * 4 + 3] !== 0 || P[base * 3] !== 0) {
          P.fill(0, base * 3, (base + N * 2) * 3);
          C.fill(0, base * 4, (base + N * 2) * 4);
        }
        continue;
      }
      const h = this.head[r];
      const w0 = this.width[r];
      for (let k = 0; k < N; k++) {
        const i = (h - k + N) % N;
        const ip = (h - Math.max(k - 1, 0) + N) % N;
        const inx = (h - Math.min(k + 1, N - 1) + N) % N;
        const o = (r * N + i) * 3;
        const x = this.pts[o];
        const y = this.pts[o + 1];
        const z = this.pts[o + 2];
        const op = (r * N + ip) * 3;
        const on = (r * N + inx) * 3;
        t.set(this.pts[op] - this.pts[on], this.pts[op + 1] - this.pts[on + 1], this.pts[op + 2] - this.pts[on + 2]);
        view.set(cam.x - x, cam.y - y, cam.z - z);
        sd.crossVectors(t, view);
        const l = sd.length();
        const f = 1 - k / (N - 1);
        const inten = this.ints[r * N + i];
        const hw = l > 1e-6 && inten > 0 ? (w0 * (0.25 + 0.75 * f)) / l : 0;
        const v = base + k * 2;
        P[v * 3] = x - sd.x * hw;
        P[v * 3 + 1] = y - sd.y * hw;
        P[v * 3 + 2] = z - sd.z * hw;
        P[v * 3 + 3] = x + sd.x * hw;
        P[v * 3 + 4] = y + sd.y * hw;
        P[v * 3 + 5] = z + sd.z * hw;
        const a = inten * f * f;
        for (let s = 0; s < 2; s++) {
          const c = (v + s) * 4;
          C[c] = this.col[r * 3];
          C[c + 1] = this.col[r * 3 + 1];
          C[c + 2] = this.col[r * 3 + 2];
          C[c + 3] = a;
        }
      }
    }
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
  }
  clearAll() {
    for (let r = 0; r < this.max; r++) if (this.used[r]) this.reset(r);
  }
}

// ---------------------------------------------------------------- onde d'urto (sfere) e anelli (a terra / sui muri)

const SHOCK_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHOCK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float a = (pow(f, 2.5) * 1.2 + 0.06) * uAlpha;
  gl_FragColor = vec4(uColor, a);
  ${FRAG_OUT}
}`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uThick;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float d = abs(r - (1.0 - uThick)) / uThick;
  float a = clamp(1.0 - d, 0.0, 1.0);
  a = a * a * uAlpha;
  gl_FragColor = vec4(uColor, a);
  ${FRAG_OUT}
}`;
const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

interface Pulse {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  t: number;
  life: number;
  r0: number;
  r1: number;
  a: number;
  active: boolean;
}

export class Pulses {
  group = new THREE.Group();
  private spheres: Pulse[] = [];
  private rings: Pulse[] = [];
  private up = new THREE.Vector3(0, 0, 1);
  constructor() {
    const sg = new THREE.IcosahedronGeometry(1, 3);
    const rg = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: SHOCK_VERT,
        fragmentShader: SHOCK_FRAG,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(sg, mat);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.group.add(mesh);
      this.spheres.push({ mesh, mat, t: 0, life: 1, r0: 0, r1: 1, a: 1, active: false });
    }
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uThick: { value: 0.2 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(rg, mat);
      mesh.visible = false;
      mesh.renderOrder = 9;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, t: 0, life: 1, r0: 0, r1: 1, a: 1, active: false });
    }
  }
  private pick(pool: Pulse[]) {
    let best = pool[0];
    for (const p of pool) {
      if (!p.active) return p;
      if (p.t / p.life > best.t / best.life) best = p;
    }
    return best;
  }
  sphere(pos: THREE.Vector3, color: THREE.Color, r0: number, r1: number, life: number, alpha = 1) {
    const p = this.pick(this.spheres);
    p.active = true;
    p.t = 0;
    p.life = life;
    p.r0 = r0;
    p.r1 = r1;
    p.a = alpha;
    p.mesh.position.copy(pos);
    (p.mat.uniforms.uColor.value as THREE.Color).copy(color);
    p.mesh.visible = true;
    p.mesh.scale.setScalar(r0);
  }
  // anello piatto con la normale data (unitaria, coordinate di three)
  ring(pos: THREE.Vector3, normal: THREE.Vector3, color: THREE.Color, r0: number, r1: number, life: number, alpha = 1, thick = 0.2) {
    const p = this.pick(this.rings);
    p.active = true;
    p.t = 0;
    p.life = life;
    p.r0 = r0;
    p.r1 = r1;
    p.a = alpha;
    p.mesh.position.copy(pos);
    p.mesh.quaternion.setFromUnitVectors(this.up, normal);
    (p.mat.uniforms.uColor.value as THREE.Color).copy(color);
    p.mat.uniforms.uThick.value = thick;
    p.mesh.visible = true;
    p.mesh.scale.setScalar(r0);
  }
  private pools: Pulse[][] = [this.spheres, this.rings];
  update(dt: number) {
    for (const pool of this.pools)
      for (const p of pool) {
        if (!p.active) continue;
        p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        const e = 1 - (1 - k) * (1 - k) * (1 - k);
        p.mesh.scale.setScalar(p.r0 + (p.r1 - p.r0) * e);
        p.mat.uniforms.uAlpha.value = p.a * (1 - k) * (1 - k);
      }
  }
  clear() {
    for (const pool of [this.spheres, this.rings])
      for (const p of pool) {
        p.active = false;
        p.mesh.visible = false;
      }
  }
}

// ---------------------------------------------------------------- gli effetti del gioco (coordinate di three, metri)

const C = (hex: string) => new THREE.Color(hex);
const WHITE = C('#ffffff');
const HOT = new THREE.Color(1.6, 1.35, 0.9);
const FIRE = new THREE.Color(1.4, 0.55, 0.12);
const EMBER = new THREE.Color(0.35, 0.06, 0.02);
const SMOKE = C('#5b5f6b');
const SMOKE_DARK = C('#24262d');
const DUST = C('#d9e4cf');
const DUST2 = C('#b8c6ad');
const SPARK = new THREE.Color(1.5, 1.25, 0.7);
const SPARK_END = new THREE.Color(1.2, 0.4, 0.08);
const PAD = new THREE.Color(1.6, 0.8, 0.15);
const PAD_END = new THREE.Color(1.0, 0.3, 0.02);
const FLIP = new THREE.Color(0.6, 1.4, 1.6);

export class Fx {
  add = new Particles(1800, true);
  alpha = new Particles(700, false);
  ribbons = new Ribbons(40);
  pulses = new Pulses();
  group = new THREE.Group();
  private tc = new THREE.Color();
  private tc2 = new THREE.Color();
  private tv = new THREE.Vector3();
  private tn = new THREE.Vector3();
  private tu = new THREE.Vector3();
  constructor() {
    this.group.add(this.alpha.mesh, this.add.mesh, this.ribbons.mesh, this.pulses.group);
  }
  setBudget(k: number) {
    this.add.budget = k;
    this.alpha.budget = k;
  }
  private n(count: number) {
    return Math.max(1, Math.round(count * this.add.budget));
  }
  update(dt: number, cam: THREE.Vector3) {
    this.add.update(dt);
    this.alpha.update(dt);
    this.ribbons.update(cam);
    this.pulses.update(dt);
  }
  clear() {
    this.add.clear();
    this.alpha.clear();
    this.ribbons.clearAll();
    this.pulses.clear();
  }

  // direzione a caso nella semisfera attorno a n (in tv)
  private hemi(n: THREE.Vector3, spread: number) {
    const v = this.tv.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
    v.normalize().multiplyScalar(spread).add(n);
    return v.normalize();
  }

  // scintille del tocco della palla (power = velocità relativa in uu/s)
  sparks(p: THREE.Vector3, normal: THREE.Vector3, power: number) {
    const k = Math.min(1, power / 3500);
    const count = this.n(6 + k * 46);
    for (let i = 0; i < count; i++) {
      const d = this.hemi(normal, 1.1);
      const sp = rand(3, 7) + k * rand(6, 22);
      this.add.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(0.18, 0.45) + k * 0.25, 0.035 + k * 0.03, 0.01, SPARK, SPARK_END, 1, 1.5, 9, 0.045);
    }
    // lampo
    this.add.spawn(p.x, p.y, p.z, 0, 0, 0, 0.12 + k * 0.1, 0.4 + k * 1.6, 0.9 + k * 2.6, HOT, FIRE, 0.8 + k * 0.5);
    if (power > 1800) this.pulses.ring(p, normal, this.tc.setRGB(1.5, 1.2, 0.7), 0.3, 1.2 + k * 2.5, 0.35, 0.8 * k, 0.25);
  }

  // polvere a terra (atterraggi e salti): n = normale della superficie
  dust(p: THREE.Vector3, normal: THREE.Vector3, amount: number) {
    const count = this.n(4 + amount * 10);
    // due direzioni sul piano della superficie
    const t1 = this.tu.set(normal.y, normal.z, -normal.x).cross(normal);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0).cross(normal);
    t1.normalize();
    const t2 = this.tn.crossVectors(normal, t1);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rand(0.6, 1.8) + amount * 2.5;
      const dx = (t1.x * Math.cos(a) + t2.x * Math.sin(a)) * sp + normal.x * rand(0.2, 0.9);
      const dy = (t1.y * Math.cos(a) + t2.y * Math.sin(a)) * sp + normal.y * rand(0.2, 0.9);
      const dz = (t1.z * Math.cos(a) + t2.z * Math.sin(a)) * sp + normal.z * rand(0.2, 0.9);
      this.alpha.spawn(p.x, p.y, p.z, dx, dy, dz, rand(0.45, 0.9), rand(0.18, 0.3), rand(0.6, 1.1) + amount * 0.5, DUST, DUST2, 0.45, 3.2, -0.3, 0, rand(-1, 1));
    }
  }

  // fiamma del boost: una "sbuffata" all'uscita del tubo (dir = indietro, vel = velocità della macchina)
  boost(p: THREE.Vector3, back: THREE.Vector3, vel: THREE.Vector3, team: THREE.Color, supersonic: boolean, smoke: boolean) {
    const sp = rand(5, 8);
    const jx = rand(-0.5, 0.5);
    const jy = rand(-0.5, 0.5);
    const jz = rand(-0.5, 0.5);
    this.tc.copy(team).multiplyScalar(1.6);
    this.add.spawn(p.x, p.y, p.z, vel.x * 0.35 + back.x * sp + jx, vel.y * 0.35 + back.y * sp + jy, vel.z * 0.35 + back.z * sp + jz, rand(0.16, 0.26), rand(0.16, 0.22), rand(0.36, 0.55), HOT, this.tc, 0.9, 2.5, -0.5);
    if (supersonic)
      this.add.spawn(p.x, p.y, p.z, vel.x * 0.2 + back.x * 3 + jx, vel.y * 0.2 + back.y * 3 + jy, vel.z * 0.2 + back.z * 3 + jz, rand(0.25, 0.4), 0.1, 0.04, WHITE, this.tc, 0.6, 0.5, 0, 0.03);
    if (smoke && Math.random() < 0.5)
      this.alpha.spawn(p.x - back.x * 0.4, p.y - back.y * 0.4, p.z - back.z * 0.4, vel.x * 0.1 + back.x * 2 + jx, vel.y * 0.1 + back.y * 2 + jy + 0.4, vel.z * 0.1 + back.z * 2 + jz, rand(0.5, 0.8), 0.25, rand(0.8, 1.2), SMOKE, SMOKE_DARK, 0.22, 1.8, -0.8, 0, rand(-2, 2));
  }

  // raccolta di un cuscinetto
  pad(p: THREE.Vector3, big: boolean) {
    const count = this.n(big ? 34 : 12);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = rand(0.1, big ? 0.9 : 0.5);
      const up = rand(2, big ? 9 : 5);
      this.add.spawn(p.x + Math.cos(a) * r, p.y + 0.1, p.z + Math.sin(a) * r, Math.cos(a) * rand(0.5, 2), up, Math.sin(a) * rand(0.5, 2), rand(0.35, 0.7), big ? 0.09 : 0.06, 0.02, PAD, PAD_END, 1, 2, 2, 0.05);
    }
    this.pulses.ring(this.tv.set(p.x, p.y + 0.05, p.z), this.tn.set(0, 1, 0), PAD, 0.4, big ? 3.2 : 1.6, 0.45, 1, 0.22);
    if (big) this.add.spawn(p.x, p.y + 0.8, p.z, 0, 0, 0, 0.25, 1.5, 3.5, HOT, PAD_END, 0.9);
  }

  // flip reset: lampo azzurro attorno alla macchina
  flipReset(p: THREE.Vector3, up: THREE.Vector3) {
    this.pulses.ring(p, up, FLIP, 0.6, 3.2, 0.5, 1, 0.18);
    this.pulses.sphere(p, FLIP, 0.6, 2.2, 0.4, 0.8);
    const count = this.n(24);
    for (let i = 0; i < count; i++) {
      const d = this.hemi(up, 2.5);
      const sp = rand(3, 8);
      this.add.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(0.3, 0.6), 0.07, 0.02, FLIP, WHITE, 1, 2.5, 0, 0.06);
    }
  }

  // ricomparsa dopo la demolizione
  respawn(p: THREE.Vector3, team: THREE.Color) {
    this.pulses.ring(this.tv.set(p.x, 0.03, p.z), this.tn.set(0, 1, 0), team, 0.5, 2.6, 0.6, 1, 0.2);
    const count = this.n(20);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      this.add.spawn(p.x + Math.cos(a) * 0.9, p.y, p.z + Math.sin(a) * 0.9, 0, rand(2, 6), 0, rand(0.4, 0.8), 0.08, 0.02, team, WHITE, 1, 1, 0, 0.05);
    }
  }

  // esplosione (demolizione e gol): fuoco, scintille, detriti, fumo, onde
  explosion(p: THREE.Vector3, team: THREE.Color, scale: number, goal: boolean) {
    const k = scale;
    // lampo
    this.add.spawn(p.x, p.y, p.z, 0, 0, 0, goal ? 0.4 : 0.25, 2 * k, 7 * k, HOT, team, 1);
    // palle di fuoco colorate
    this.tc.copy(team).multiplyScalar(goal ? 2.2 : 1.2);
    this.tc2.copy(team).multiplyScalar(0.25);
    const fire = this.n(goal ? 60 : 28);
    for (let i = 0; i < fire; i++) {
      const d = this.hemi(this.tn.set(0, 0.35, 0), 1);
      const sp = rand(2, 9) * k;
      this.add.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(0.45, 0.95), rand(0.5, 1.0) * k, rand(1.2, 2.4) * k, i % 3 ? this.tc : HOT, goal ? this.tc2 : EMBER, 0.85, 2.6, -0.6);
    }
    // scintille lunghe
    const sp2 = this.n(goal ? 180 : 60);
    for (let i = 0; i < sp2; i++) {
      const d = this.hemi(this.tn.set(0, 0.2, 0), 1);
      const sp = rand(8, goal ? 34 : 20) * Math.sqrt(k);
      this.add.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(0.5, goal ? 1.6 : 1), rand(0.05, 0.1), 0.02, i % 2 ? SPARK : WHITE, i % 2 ? this.tc : SPARK_END, 1, 1, 7, 0.05);
    }
    // brillantini colorati che cadono piano (solo gol)
    if (goal) {
      const gl = this.n(90);
      for (let i = 0; i < gl; i++) {
        const d = this.hemi(this.tn.set(0, 0.8, 0), 1.2);
        const sp = rand(4, 16);
        this.add.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(1.5, 2.8), 0.12, 0.08, i % 2 ? WHITE : this.tc, this.tc, 1, 1.8, 3, 0, rand(-6, 6));
      }
    }
    // detriti scuri
    const deb = this.n(goal ? 0 : 18);
    for (let i = 0; i < deb; i++) {
      const d = this.hemi(this.tn.set(0, 0.7, 0), 1);
      const sp = rand(4, 11);
      this.alpha.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(0.8, 1.4), rand(0.08, 0.16), 0.06, SMOKE_DARK, SMOKE_DARK, 1, 0.4, 9, 0, rand(-10, 10));
    }
    // fumo
    const sm = this.n(goal ? 26 : 16);
    for (let i = 0; i < sm; i++) {
      const d = this.hemi(this.tn.set(0, 0.5, 0), 1);
      const sp = rand(1, 5) * k;
      this.alpha.spawn(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, rand(1.2, 2.2), rand(0.8, 1.4) * k, rand(2.5, 4) * k, SMOKE, SMOKE_DARK, 0.4, 1.2, -0.6, 0, rand(-1, 1));
    }
    // onde d'urto
    this.pulses.sphere(p, this.tc.copy(team).multiplyScalar(1.5), 0.5, (goal ? 16 : 5) * (goal ? 1 : k), goal ? 1.0 : 0.6, 1);
    if (goal) this.pulses.sphere(p, WHITE, 0.5, 9, 0.55, 0.8);
    this.pulses.ring(this.tv.set(p.x, 0.04, p.z), this.tu.set(0, 1, 0), team, 0.5, goal ? 26 : 7, goal ? 1.3 : 0.7, 1, 0.12);
  }
}
