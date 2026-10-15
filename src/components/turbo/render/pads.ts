// ⚽🚗 Axend Turbo — cuscinetti del boost come Rocket League: i grandi con la sfera arancione che galleggia sul piedistallo
// e il fascio di luce, i piccoli con il dischetto luminoso. Spenti (timer > 0) si abbassano e si scuriscono;
// quando tornano "saltano" su. Tutto con InstancedMesh: poche chiamate di disegno per 34 cuscinetti.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pad } from '../../../game/turbo/world';
import { S } from './coords';
import { Glows } from './fx';
import { FRAG_OUT } from './util';

const ORB = new THREE.Color(1.9, 0.95, 0.22);
const ORB_DIM = new THREE.Color(0.35, 0.16, 0.05);
const RING_ON = new THREE.Color(1.8, 0.9, 0.2);
const RING_OFF = new THREE.Color(0.22, 0.12, 0.06);
const HALO = new THREE.Color(1.3, 0.62, 0.12);

const BEAM_VERT = /* glsl */ `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vH;
void main() {
  float a = (1.0 - vH) * (1.0 - vH) * (0.5 + 0.15 * sin(uTime * 5.0 + vH * 12.0));
  gl_FragColor = vec4(uColor, a);
  ${FRAG_OUT}
}`;

export class PadsView {
  group = new THREE.Group();
  private rings: THREE.InstancedMesh;
  private orbs: THREE.InstancedMesh;
  private pucks: THREE.InstancedMesh;
  private beams: THREE.InstancedMesh;
  private beamMat: THREE.ShaderMaterial;
  private all: THREE.InstancedMesh[];
  private glows: Glows;
  private vis: Float32Array; // 0 = spento, 1 = acceso (animato)
  private vel: Float32Array;
  private pads: { x: number; z: number; big: boolean; bigIdx: number; smallIdx: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(list: Pad[]) {
    const n = list.length;
    this.vis = new Float32Array(n).fill(1);
    this.vel = new Float32Array(n);
    let nb = 0;
    let ns = 0;
    for (const p of list) this.pads.push({ x: p.x * S, z: -p.y * S, big: p.big, bigIdx: p.big ? nb++ : -1, smallIdx: p.big ? -1 : ns++ });

    // piedistalli e dischi (statici, una geometria sola)
    const bases: THREE.BufferGeometry[] = [];
    for (const p of this.pads) {
      const r = p.big ? 1.15 : 0.62;
      const g = new THREE.CylinderGeometry(r * 0.92, r, p.big ? 0.12 : 0.05, 28, 1);
      g.translate(p.x, p.big ? 0.06 : 0.025, p.z);
      bases.push(g.toNonIndexed());
      if (p.big) {
        const col = new THREE.CylinderGeometry(0.34, 0.44, 0.3, 20, 1);
        col.translate(p.x, 0.27, p.z);
        bases.push(col.toNonIndexed());
      }
    }
    const baseGeo = mergeGeometries(bases)!;
    bases.forEach((b) => b.dispose());
    this.group.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#2c303c', roughness: 0.35, metalness: 0.7 })));

    // anello luminoso (acceso/spento) appoggiato sul disco
    const ringGeo = new THREE.RingGeometry(0.72, 0.9, 40, 1);
    ringGeo.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), n);
    // sfere dei grandi
    this.orbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 3), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, nb));
    // dischetti dei piccoli
    this.pucks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.34, 0.07, 24, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, ns));
    // fascio di luce sopra i grandi
    const beamGeo = new THREE.CylinderGeometry(0.55, 0.9, 2.6, 24, 1, true);
    beamGeo.translate(0, 1.3, 0);
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(1.2, 0.55, 0.1) }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.beams = new THREE.InstancedMesh(beamGeo, this.beamMat, Math.max(1, nb));
    this.beams.renderOrder = 5;
    for (const im of [this.rings, this.orbs, this.pucks, this.beams]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.orbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, nb) * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.pucks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, ns) * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.glows = new Glows(n);
    this.pads.forEach((p, i) => this.glows.set(i, p.x, p.big ? 0.75 : 0.18, p.z, p.big ? 2.6 : 1.1, HALO, p.big ? 0.75 : 0.45));
    this.glows.flush();
    this.all = [this.rings, this.orbs, this.pucks, this.beams];
    this.group.add(this.rings, this.orbs, this.pucks, this.beams, this.glows.mesh);
  }

  update(list: Pad[], t: number, dt: number) {
    this.beamMat.uniforms.uTime.value = t;
    for (let i = 0; i < this.pads.length; i++) {
      const p = this.pads[i];
      const on = (list[i]?.timer ?? 0) <= 0;
      const target = on ? 1 : 0;
      // si spegne di colpo, si riaccende con un piccolo salto (molla)
      if (!on) {
        this.vis[i] = Math.max(0, this.vis[i] - dt * 7);
        this.vel[i] = 0;
      } else {
        this.vel[i] += ((target - this.vis[i]) * 180 - this.vel[i] * 14) * dt;
        this.vis[i] += this.vel[i] * dt;
      }
      const v = Math.max(0, this.vis[i]);
      const k = Math.min(1, v);
      // anello
      this.c.copy(RING_OFF).lerp(RING_ON, k);
      this.p.set(p.x, p.big ? 0.125 : 0.055, p.z);
      this.s.setScalar(p.big ? 1.15 : 0.62);
      this.m.compose(this.p, this.q.identity(), this.s);
      this.rings.setMatrixAt(i, this.m);
      this.rings.setColorAt(i, this.c);
      if (p.big) {
        const bob = Math.sin(t * 2.2 + i) * 0.06;
        this.p.set(p.x, 0.82 + bob, p.z);
        this.q.setFromAxisAngle(this.up, t * 1.2 + i);
        this.s.setScalar(Math.max(0.0001, v));
        this.m.compose(this.p, this.q, this.s);
        this.orbs.setMatrixAt(p.bigIdx, this.m);
        this.c.copy(ORB_DIM).lerp(ORB, k);
        this.orbs.setColorAt(p.bigIdx, this.c);
        this.p.set(p.x, 0.12, p.z);
        this.s.set(1, Math.max(0.0001, k), 1);
        this.m.compose(this.p, this.q.identity(), this.s);
        this.beams.setMatrixAt(p.bigIdx, this.m);
        this.glows.setAlpha(i, 0.75 * k, 2.6 * (0.6 + 0.4 * k) + Math.sin(t * 3 + i) * 0.15);
      } else {
        this.p.set(p.x, 0.1 + Math.sin(t * 3 + i) * 0.015, p.z);
        this.s.set(Math.max(0.0001, v), 1, Math.max(0.0001, v));
        this.m.compose(this.p, this.q.identity(), this.s);
        this.pucks.setMatrixAt(p.smallIdx, this.m);
        this.c.copy(ORB_DIM).lerp(ORB, k);
        this.pucks.setColorAt(p.smallIdx, this.c);
        this.glows.setAlpha(i, 0.45 * k);
      }
    }
    for (const im of this.all) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.glows.flush();
  }

  // posizione del cuscinetto i (three)
  position(i: number, out: THREE.Vector3) {
    const p = this.pads[i];
    return p ? out.set(p.x, 0.1, p.z) : out.set(0, 0, 0);
  }
  isBig(i: number) {
    return !!this.pads[i]?.big;
  }
}
