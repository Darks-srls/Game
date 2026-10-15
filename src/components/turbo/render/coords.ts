// ⚽🚗 Axend Turbo — conversione tra le unità della fisica (uu = cm, z in alto, y verso la porta arancione)
// e quelle di Three.js (metri, y in alto). three.x = uu.x, three.y = uu.z, three.z = −uu.y.
// È una rotazione vera (−90° attorno a X): i quaternioni si convertono con q_three = qB · q_uu · qB⁻¹,
// che in pratica sposta solo le componenti del vettore: (x, y, z, w) → (x, z, −y, w).
import * as THREE from 'three';

export const S = 0.01; // 1 uu = 1 cm = 0,01 m

export interface P3 {
  x: number;
  y: number;
  z: number;
}
export interface Q4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

// punto (uu) → three (metri)
export function toThree(p: P3, out: THREE.Vector3) {
  return out.set(p.x * S, p.z * S, -p.y * S);
}
export function xyzToThree(x: number, y: number, z: number, out: THREE.Vector3) {
  return out.set(x * S, z * S, -y * S);
}
// direzione (senza scala)
export function dirToThree(p: P3, out: THREE.Vector3) {
  return out.set(p.x, p.z, -p.y);
}
// three (metri) → uu
export function fromThree(v: THREE.Vector3, out: P3) {
  out.x = v.x / S;
  out.y = -v.z / S;
  out.z = v.y / S;
  return out;
}
// orientamento (quaternione della fisica) → quaternione di three
export function quatToThree(q: Q4, out: THREE.Quaternion) {
  return out.set(q.x, q.z, -q.y, q.w);
}

// I modelli (macchina, palla) si disegnano nelle coordinate locali di three: avanti = +x, sopra = +y, sinistra = −z.
// Così l'oggetto con quaternion = quatToThree(rot) e position = toThree(pos) coincide con la fisica.
