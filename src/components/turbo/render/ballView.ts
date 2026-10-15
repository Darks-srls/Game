// ⚽🚗 Axend Turbo — la palla come quella di Rocket League: pannelli esagonali (poliedro di Goldberg, 162 pannelli)
// con le giunture che si illuminano, bordo luminoso, rotola secondo ball.rot; scia quando va forte;
// ombra e anello per terra (l'anello si allarga con la quota: si capisce quanto è alta).
import * as THREE from 'three';
import { BALL } from '../../../game/turbo/consts';
import type { Ball } from '../../../game/turbo/ball';
import { TEAM_COLORS } from '../contract';
import { FLOOR_CORNER, FLOOR_X, FLOOR_Y } from './arenaMesh';
import { S } from './coords';
import type { Fx } from './fx';
import { FRAG_OUT } from './util';

const R = BALL.radius * S;

// ---------------------------------------------------------------- geometria: pannelli esagonali e pentagonali
export function ballGeometry(radius: number, freq = 4) {
  const t = (1 + Math.sqrt(5)) / 2;
  const base = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  // suddivisione geodetica (vertici condivisi)
  const verts: THREE.Vector3[] = [];
  const keys = new Map<string, number>();
  const vid = (p: THREE.Vector3) => {
    const k = `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`;
    let i = keys.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push(p.clone());
      keys.set(k, i);
    }
    return i;
  };
  const tris: number[][] = [];
  for (const [a, b, c] of faces) {
    const A = base[a];
    const B = base[b];
    const C = base[c];
    const grid: number[][] = [];
    for (let i = 0; i <= freq; i++) {
      grid.push([]);
      for (let j = 0; j <= freq - i; j++) {
        const p = new THREE.Vector3()
          .copy(A)
          .addScaledVector(new THREE.Vector3().subVectors(B, A), i / freq)
          .addScaledVector(new THREE.Vector3().subVectors(C, A), j / freq)
          .normalize();
        grid[i].push(vid(p));
      }
    }
    for (let i = 0; i < freq; i++)
      for (let j = 0; j < freq - i; j++) {
        tris.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);
        if (j < freq - i - 1) tris.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
      }
  }
  const around: number[][] = verts.map(() => []);
  tris.forEach((tr, ti) => tr.forEach((v) => around[v].push(ti)));
  const cent = tris.map((tr) => new THREE.Vector3().add(verts[tr[0]]).add(verts[tr[1]]).add(verts[tr[2]]).normalize());
  // pentagoni (i 12 vertici originali) e i loro vicini: disegno "a fiore"
  const kind: number[] = verts.map((_, i) => (around[i].length === 5 ? 2 : 0));
  verts.forEach((_, i) => {
    if (kind[i] !== 2) return;
    for (const ti of around[i]) for (const v of tris[ti]) if (kind[v] === 0) kind[v] = 1;
  });
  const COL = [new THREE.Color(0.86, 0.88, 0.92), new THREE.Color(0.55, 0.6, 0.7), new THREE.Color(0.1, 0.11, 0.15)];

  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  const tri = (a: number, b: number, c: number) => {
    const P = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const pa = P(a);
    const fn = new THREE.Vector3().subVectors(P(b), pa).cross(new THREE.Vector3().subVectors(P(c), pa));
    if (fn.dot(pa) >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };
  verts.forEach((v, i) => {
    // angoli del pannello in giro attorno al centro
    const u = new THREE.Vector3(v.y, v.z, -v.x).cross(v).normalize();
    const w = new THREE.Vector3().crossVectors(v, u);
    const corners = around[i].map((ti) => cent[ti]).sort((p, q) => Math.atan2(p.dot(w), p.dot(u)) - Math.atan2(q.dot(w), q.dot(u)));
    const c = COL[kind[i]];
    const ci = push(tmp.copy(v).multiplyScalar(radius * 1.003), v, c);
    const inner: number[] = [];
    const outer: number[] = [];
    for (const k of corners) {
      const d2 = tmp.copy(v).lerp(k, 0.55).normalize();
      inner.push(push(tmp2.copy(d2).multiplyScalar(radius * 1.0015), d2, c));
      const d1 = tmp.copy(v).lerp(k, 0.86).normalize();
      // bordo smussato: la normale si piega verso fuori dal pannello
      const tan = tmp2.copy(d1).addScaledVector(v, -d1.dot(v)).normalize();
      const n1 = new THREE.Vector3().copy(d1).addScaledVector(tan, 0.5).normalize();
      outer.push(push(d1.clone().multiplyScalar(radius * 0.994), n1, c));
    }
    const m = corners.length;
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      tri(ci, inner[k], inner[k2]);
      tri(inner[k], outer[k], outer[k2]);
      tri(inner[k], outer[k2], inner[k2]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- shader: bordo luminoso e ombra con anello

const RIM_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float a = pow(f, 3.0) * uPower;
  gl_FragColor = vec4(uColor, a);
  ${FRAG_OUT}
}`;
const SHADOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SHADOW_FRAG = /* glsl */ `
uniform float uCore;
uniform float uCoreA;
uniform float uRing;
uniform float uRingA;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float core = (1.0 - smoothstep(uCore * 0.35, uCore, r)) * uCoreA;
  float fw = fwidth(r) * 1.5 + 0.004;
  float ring = (1.0 - smoothstep(0.012, 0.012 + fw, abs(r - uRing))) * uRingA;
  float a = max(core, ring);
  vec3 c = mix(vec3(0.0, 0.0, 0.03), vec3(1.0), ring / (core + ring + 1e-4));
  gl_FragColor = vec4(c, a);
}`;

const SEAM = new THREE.Color(1.1, 1.5, 1.9);
const TEAM = [new THREE.Color(TEAM_COLORS[0]), new THREE.Color(TEAM_COLORS[1])];
const SHADOW_SIZE = 4.2; // metri (metà lato del quadrato dell'ombra)

export class BallView {
  group = new THREE.Group();
  ball = new THREE.Group();
  private seamMat: THREE.MeshBasicMaterial;
  private rimMat: THREE.ShaderMaterial;
  private shadow: THREE.Mesh;
  private shMat: THREE.ShaderMaterial;
  private trail: number;
  private seam = new THREE.Color().copy(SEAM);
  private tmpC = new THREE.Color();
  private last = new THREE.Vector3(1e9, 0, 0);
  private hidden = false;
  readonly pos = new THREE.Vector3(); // posizione disegnata (three)

  constructor(private fx: Fx) {
    const panels = new THREE.Mesh(
      ballGeometry(R),
      new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 1.1 }),
    );
    this.seamMat = new THREE.MeshBasicMaterial({ color: this.seam, toneMapped: false });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.975, 3), this.seamMat);
    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: RIM_VERT,
      fragmentShader: RIM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0.7, 0.9, 1.3) }, uPower: { value: 0.6 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const rim = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.035, 3), this.rimMat);
    rim.renderOrder = 8;
    this.ball.add(core, panels, rim);
    this.group.add(this.ball);
    this.shMat = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: { uCore: { value: 0.2 }, uCoreA: { value: 0.5 }, uRing: { value: 0.3 }, uRingA: { value: 0 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(SHADOW_SIZE * 2, SHADOW_SIZE * 2), this.shMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 3;
    this.group.add(this.shadow);
    this.trail = fx.ribbons.alloc(SEAM, R * 0.62);
  }

  // la palla esplode (gol): sparisce fino al calcio d'inizio
  hide() {
    this.hidden = true;
  }

  update(b: Ball, off: { x: number; y: number; z: number } | undefined, phase: string, dt: number, fancy: boolean) {
    const ux = b.pos.x + (off?.x ?? 0);
    const uy = b.pos.y + (off?.y ?? 0);
    const uz = b.pos.z + (off?.z ?? 0);
    const p = this.pos.set(ux * S, uz * S, -uy * S);
    if (phase !== 'goal') this.hidden = false;
    const vis = !this.hidden;
    this.ball.visible = vis;
    this.shadow.visible = vis;
    this.ball.position.copy(p);
    this.ball.quaternion.set(b.rot.x, b.rot.z, -b.rot.y, b.rot.w);

    // colore delle giunture: si tinge della squadra dell'ultimo tocco
    const team = b.lastTouchTeam === 0 || b.lastTouchTeam === 1 ? TEAM[b.lastTouchTeam] : null;
    this.tmpC.copy(SEAM);
    if (team) this.tmpC.lerp(this.seam.copy(team).multiplyScalar(2.2), 0.55);
    this.seamMat.color.lerp(this.tmpC, Math.min(1, dt * 4));
    const speed = b.vel.len();
    const fast = Math.max(0, Math.min(1, (speed - 1700) / 1900));
    this.rimMat.uniforms.uPower.value = 0.5 + fast * 1.4;
    (this.rimMat.uniforms.uColor.value as THREE.Color).copy(this.seamMat.color).multiplyScalar(0.6);

    // ombra e anello sul pavimento (solo sopra la parte piatta del campo)
    const ax = Math.abs(ux);
    const ay = Math.abs(uy);
    const onFloor = ax < FLOOR_X && ay < FLOOR_Y + 260 && ax + ay < FLOOR_CORNER;
    if (vis && onFloor) {
      this.shadow.visible = true;
      this.shadow.position.set(p.x, 0.012, p.z);
      const h = Math.max(0, uz - BALL.radius);
      const core = (R * 0.95) / SHADOW_SIZE;
      this.shMat.uniforms.uCore.value = core;
      this.shMat.uniforms.uCoreA.value = Math.max(0.2, 0.58 - h / 2600);
      const ringR = Math.min(0.97, core * (1 + h / 650));
      this.shMat.uniforms.uRing.value = ringR;
      this.shMat.uniforms.uRingA.value = h > 60 ? Math.min(0.5, (h - 60) / 400) * (1 - Math.max(0, (ringR - 0.8) / 0.17)) : 0;
    } else this.shadow.visible = false;

    // scia quando va forte (colore dell'ultimo tocco)
    if (this.last.distanceToSquared(p) > 64) this.fx.ribbons.reset(this.trail);
    this.last.copy(p);
    this.fx.ribbons.setStyle(this.trail, this.tmpC.copy(this.seamMat.color).multiplyScalar(0.8), R * 0.6);
    this.fx.ribbons.push(this.trail, p.x, p.y, p.z, vis && fancy ? fast * 0.9 : 0);
  }

  // punto della palla verso un altro punto (three) — per le scintille del tocco
  surfaceToward(target: THREE.Vector3, out: THREE.Vector3, normal: THREE.Vector3) {
    normal.subVectors(target, this.pos);
    const l = normal.length();
    if (l < 1e-6) normal.set(0, 1, 0);
    else normal.multiplyScalar(1 / l);
    return out.copy(this.pos).addScaledVector(normal, R);
  }
}

