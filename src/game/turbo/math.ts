// ⚽🚗 Axend Turbo — matematica di base (vettori e quaternioni), uguale per telefono e server.
// Unità di Rocket League: uu (1 uu = 1 cm), secondi. Mondo destrorso: x di lato, y verso la porta arancione, z in alto.
// Assi della macchina: avanti = +x locale, sinistra = +y locale, sopra = +z locale.

export class V3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}
  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v: V3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new V3(this.x, this.y, this.z);
  }
  add(v: V3) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v: V3) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  scale(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  addScaled(v: V3, s: number) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  dot(v: V3) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  len() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  len2() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    const l = this.len();
    if (l > 1e-9) this.scale(1 / l);
    return this;
  }
  // this = a × b
  crossOf(a: V3, b: V3) {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  subOf(a: V3, b: V3) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  clampLen(max: number) {
    const l2 = this.len2();
    if (l2 > max * max) this.scale(max / Math.sqrt(l2));
    return this;
  }
}

export const v3 = (x = 0, y = 0, z = 0) => new V3(x, y, z);
export const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// Quaternione (x, y, z, w): orientamento della macchina
export class Quat {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public w = 1,
  ) {}
  set(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  copy(q: Quat) {
    return this.set(q.x, q.y, q.z, q.w);
  }
  clone() {
    return new Quat(this.x, this.y, this.z, this.w);
  }
  normalize() {
    const l = Math.hypot(this.x, this.y, this.z, this.w) || 1;
    this.x /= l;
    this.y /= l;
    this.z /= l;
    this.w /= l;
    return this;
  }
  // rotazione attorno a z (yaw), poi rollio/beccheggio a zero
  static fromYaw(yaw: number) {
    return new Quat(0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2));
  }
  static fromAxisAngle(ax: V3, angle: number) {
    const s = Math.sin(angle / 2);
    return new Quat(ax.x * s, ax.y * s, ax.z * s, Math.cos(angle / 2));
  }
  // this = a * b
  mulOf(a: Quat, b: Quat) {
    const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
    const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
    const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
    const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    return this.set(x, y, z, w);
  }
  // ruota v (locale → mondo), risultato in out
  rotate(v: V3, out: V3) {
    const { x, y, z, w } = this;
    const ix = w * v.x + y * v.z - z * v.y;
    const iy = w * v.y + z * v.x - x * v.z;
    const iz = w * v.z + x * v.y - y * v.x;
    const iw = -x * v.x - y * v.y - z * v.z;
    out.x = ix * w + iw * -x + iy * -z - iz * -y;
    out.y = iy * w + iw * -y + iz * -x - ix * -z;
    out.z = iz * w + iw * -z + ix * -y - iy * -x;
    return out;
  }
  // ruota v all'indietro (mondo → locale)
  unrotate(v: V3, out: V3) {
    const { x, y, z, w } = this;
    const qx = -x;
    const qy = -y;
    const qz = -z;
    const ix = w * v.x + qy * v.z - qz * v.y;
    const iy = w * v.y + qz * v.x - qx * v.z;
    const iz = w * v.z + qx * v.y - qy * v.x;
    const iw = -qx * v.x - qy * v.y - qz * v.z;
    out.x = ix * w + iw * -qx + iy * -qz - iz * -qy;
    out.y = iy * w + iw * -qy + iz * -qx - ix * -qz;
    out.z = iz * w + iw * -qz + ix * -qy - iy * -qx;
    return out;
  }
  // integra una velocità angolare (mondo, rad/s) per dt
  integrate(w: V3, dt: number) {
    const hx = w.x * dt * 0.5;
    const hy = w.y * dt * 0.5;
    const hz = w.z * dt * 0.5;
    const { x, y, z } = this;
    const qw = this.w;
    this.x += hx * qw + hy * z - hz * y;
    this.y += hy * qw + hz * x - hx * z;
    this.z += hz * qw + hx * y - hy * x;
    this.w += -hx * x - hy * y - hz * z;
    return this.normalize();
  }
}

// curva lineare a tratti: punti [x, y] in ordine; fuori dai bordi resta costante
export function curve(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}
