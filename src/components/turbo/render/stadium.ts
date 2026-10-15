// ⚽🚗 Axend Turbo — lo stadio come Rocket League: campo d'erba con le linee, metà blu e metà arancione,
// muri bassi opachi con pannelli AXEND, vetro con esagoni e bordi luminosi, porte al neon con rete e fondo luminoso,
// tribune con il pubblico (quadratini "instanced" disegnati dallo shader), torri di luce, maxischermi e cielo.
// Poche chiamate di disegno: ogni pezzo è una geometria unica con materiali condivisi.
import * as THREE from 'three';
import { ARENA } from '../../../game/turbo/consts';
import { TEAM_COLORS, type Quality } from '../contract';
import {
  FLOOR_CORNER,
  FLOOR_X,
  FLOOR_Y,
  GH,
  GW,
  GY1,
  Geo,
  LOOP_LEN,
  OPAQUE_TOP,
  S_OPAQUE,
  buildFloor,
  buildGlass,
  buildGoal,
  buildGoalFrame,
  buildNeon,
  buildWallLow,
} from './arenaMesh';
import { S } from './coords';
import { Glows } from './fx';
import { FONT, FRAG_OUT, canvasTex, rng, strokeText } from './util';

const EX = ARENA.extentX;
const EY = ARENA.extentY;
const CS = ARENA.cornerSum;
const SQ2 = Math.SQRT2;
const SCREEN_Y = EY + 1300 + 1350; // maxischermi davanti al bordo del tetto
const BLUE = new THREE.Color(TEAM_COLORS[0]);
const ORANGE = new THREE.Color(TEAM_COLORS[1]);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- texture

function grassTex(aniso: number) {
  const t = canvasTex(
    512,
    512,
    (g) => {
      const r = rng(11);
      g.fillStyle = '#4fae55';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#44a04b';
      g.fillRect(0, 256, 512, 256);
      // macchie morbide (si ripetono senza cuciture)
      for (let i = 0; i < 70; i++) {
        const x = r() * 512;
        const y = r() * 512;
        const rad = 20 + r() * 50;
        const dark = r() < 0.5;
        for (const ox of [-512, 0, 512])
          for (const oy of [-512, 0, 512]) {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
            gr.addColorStop(0, dark ? 'rgba(25,70,30,0.10)' : 'rgba(160,220,140,0.07)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
          }
      }
      // fili d'erba
      for (let i = 0; i < 16000; i++) {
        const x = r() * 512;
        const y = r() * 512;
        g.fillStyle = r() < 0.55 ? `rgba(18,60,24,${0.1 + r() * 0.14})` : `rgba(175,235,150,${0.06 + r() * 0.1})`;
        g.fillRect(x, y, 1, 2 + r() * 3);
      }
    },
    { repeat: true, aniso },
  );
  t.repeat.set(1 / 1024, 1 / 1024); // le uv del pavimento sono in uu: una piastrella = 10 m (due strisce)
  return t;
}

const V_RAMP_TOP = (Math.PI / 2) * ARENA.wallFillet;
function wallTex(aniso: number) {
  const W = 1024;
  const H = 512;
  const yTop = H * (1 - V_RAMP_TOP / S_OPAQUE); // dove la rampa diventa muro
  const t = canvasTex(
    W,
    H,
    (g) => {
      // rampa: grigio ardesia con frecce che salgono
      const gr = g.createLinearGradient(0, yTop, 0, H);
      gr.addColorStop(0, '#3a4256');
      gr.addColorStop(1, '#56627a');
      g.fillStyle = gr;
      g.fillRect(0, yTop, W, H - yTop);
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.lineWidth = 10;
      for (let x = 0; x < W; x += 128)
        for (let k = 0; k < 2; k++) {
          const y = yTop + 60 + k * 90;
          g.beginPath();
          g.moveTo(x + 24, y + 40);
          g.lineTo(x + 64, y);
          g.lineTo(x + 104, y + 40);
          g.stroke();
        }
      // striscia luminosa dove la rampa diventa muro
      g.fillStyle = '#ffffff';
      g.fillRect(0, yTop - 8, W, 16);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, yTop + 14, W, 5);
      // pannelli
      for (let p = 0; p < 2; p++) {
        const x0 = p * 512;
        const pg = g.createLinearGradient(0, 8, 0, yTop - 8);
        pg.addColorStop(0, '#2a3247');
        pg.addColorStop(1, '#1a2030');
        g.fillStyle = pg;
        g.fillRect(x0 + 6, 12, 500, yTop - 28);
        g.strokeStyle = 'rgba(255,255,255,0.16)';
        g.lineWidth = 4;
        g.strokeRect(x0 + 8, 14, 496, yTop - 32);
        const cy = (yTop - 8) / 2 + 6;
        if (p === 0) {
          g.save();
          g.translate(x0 + 256, cy);
          g.transform(1, 0, -0.18, 1, 0, 0);
          g.font = `900 ${Math.round((yTop - 40) * 0.62)}px ${FONT}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          strokeText(g, 'AXEND', 0, 4, '#ffffff', 'rgba(0,0,0,0.35)', 10);
          g.restore();
        } else {
          g.fillStyle = 'rgba(255,255,255,0.85)';
          for (let k = 0; k < 4; k++) {
            const x = x0 + 70 + k * 44;
            g.beginPath();
            g.moveTo(x, cy - 50);
            g.lineTo(x + 34, cy);
            g.lineTo(x, cy + 50);
            g.lineTo(x + 16, cy + 50);
            g.lineTo(x + 50, cy);
            g.lineTo(x + 16, cy - 50);
            g.closePath();
            g.fill();
          }
          g.font = `900 ${Math.round((yTop - 40) * 0.36)}px ${FONT}`;
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          strokeText(g, 'TURBO', x0 + 270, cy + 4, '#ffffff', 'rgba(0,0,0,0.3)', 8);
        }
      }
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, 6);
    },
    { aniso, text: true },
  );
  t.wrapS = THREE.RepeatWrapping;
  const period = LOOP_LEN / Math.round(LOOP_LEN / 1600);
  t.repeat.set(1 / period, 1 / S_OPAQUE);
  return t;
}

function logoTex() {
  return canvasTex(512, 512, (g) => {
    g.translate(256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(0, 0, 236, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 214, 0, Math.PI * 2);
    g.stroke();
    // metà colorate
    g.globalAlpha = 0.35;
    g.fillStyle = TEAM_COLORS[0];
    g.beginPath();
    g.arc(0, 0, 210, 0, Math.PI);
    g.fill();
    g.fillStyle = TEAM_COLORS[1];
    g.beginPath();
    g.arc(0, 0, 210, Math.PI, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.save();
    g.transform(1, 0, -0.16, 1, 0, 0);
    g.font = `900 112px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    strokeText(g, 'AXEND', 0, -6, '#ffffff', 'rgba(0,0,0,0.25)', 8);
    g.font = `900 46px ${FONT}`;
    strokeText(g, 'T U R B O', 0, 74, 'rgba(255,255,255,0.9)', 'rgba(0,0,0,0.2)', 6);
    g.restore();
  }, { text: true });
}

function seatTex() {
  const t = canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#2a2f3d';
      g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 4; row++) {
        const y = row * 64;
        g.fillStyle = '#1b1f29';
        g.fillRect(0, y + 44, 256, 20);
        for (let k = 0; k < 8; k++) {
          g.fillStyle = '#d8dce6';
          g.fillRect(k * 32 + 4, y + 10, 24, 30);
          g.fillStyle = '#9aa1b2';
          g.fillRect(k * 32 + 4, y + 34, 24, 8);
        }
      }
    },
    { repeat: true },
  );
  return t;
}

function ledTex() {
  const t = canvasTex(
    1024,
    64,
    (g) => {
      g.fillStyle = '#070912';
      g.fillRect(0, 0, 1024, 64);
      g.font = `900 44px ${FONT}`;
      g.textBaseline = 'middle';
      const words = ['AXEND TURBO', '★', 'GOL!', '★', 'AXEND GAMES', '★', 'BOOST!', '★'];
      let x = 12;
      for (const w of words) {
        g.fillStyle = w === '★' ? '#ffd23f' : '#ffffff';
        g.fillText(w, x, 35);
        x += g.measureText(w).width + 28;
      }
      // puntini del led
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < 64; y += 4) g.fillRect(0, y, 1024, 1);
      for (let xx = 0; xx < 1024; xx += 4) g.fillRect(xx, 0, 1, 64);
    },
    { repeat: true, text: true },
  );
  return t;
}

function lampTex() {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = '#1a1d26';
    g.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 8; x++) {
        const gr = g.createRadialGradient(16 + x * 32, 16 + y * 32, 0, 16 + x * 32, 16 + y * 32, 14);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.6, '#fff4d8');
        gr.addColorStop(1, '#8a8470');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(16 + x * 32, 16 + y * 32, 13, 0, Math.PI * 2);
        g.fill();
      }
  });
}

// ---------------------------------------------------------------- linee del campo (geometria a strisce, nitida da vicino e da lontano)
class Decals {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  c = [0.9, 0.9, 0.9, 0.92];
  z = 1.2;
  color(r: number, g: number, b: number, a: number) {
    this.c = [r, g, b, a];
  }
  v(x: number, y: number) {
    this.pos.push(x, y, this.z);
    this.col.push(this.c[0], this.c[1], this.c[2], this.c[3]);
    return this.pos.length / 3 - 1;
  }
  // linea spessa w lungo i punti (giunti a spigolo)
  line(pts: [number, number][], w: number, closed = false) {
    const n = pts.length;
    const L: number[] = [];
    const Rr: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(i - 1, 0)];
      const next = closed ? pts[(i + 1) % n] : pts[Math.min(i + 1, n - 1)];
      let t1x = p[0] - prev[0];
      let t1y = p[1] - prev[1];
      let t2x = next[0] - p[0];
      let t2y = next[1] - p[1];
      const l1 = Math.hypot(t1x, t1y);
      const l2 = Math.hypot(t2x, t2y);
      if (l1 < 1e-6) {
        t1x = t2x;
        t1y = t2y;
      }
      if (l2 < 1e-6) {
        t2x = t1x;
        t2y = t1y;
      }
      const a = Math.hypot(t1x, t1y) || 1;
      const b = Math.hypot(t2x, t2y) || 1;
      t1x /= a;
      t1y /= a;
      t2x /= b;
      t2y /= b;
      let tx = t1x + t2x;
      let ty = t1y + t2y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      const m = w / 2 / Math.max(0.3, nx * -t1y + ny * t1x);
      L.push(this.v(p[0] + nx * m, p[1] + ny * m));
      Rr.push(this.v(p[0] - nx * m, p[1] - ny * m));
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      this.idx.push(L[i], Rr[i], Rr[j], L[i], Rr[j], L[j]);
    }
  }
  circle(cx: number, cy: number, r: number, w: number, a0 = 0, a1 = Math.PI * 2, n = 96) {
    const pts: [number, number][] = [];
    const closed = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
    const m = closed ? n : n + 1;
    for (let i = 0; i < m; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.line(pts, w, closed);
  }
  disc(cx: number, cy: number, r: number, n = 32) {
    const c = this.v(cx, cy);
    const ring: number[] = [];
    for (let i = 0; i < n; i++) ring.push(this.v(cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r));
    for (let i = 0; i < n; i++) this.idx.push(c, ring[i], ring[(i + 1) % n]);
  }
  rect(x0: number, y0: number, x1: number, y1: number) {
    const a = this.v(x0, y0);
    const b = this.v(x1, y0);
    const c = this.v(x1, y1);
    const d = this.v(x0, y1);
    this.idx.push(a, b, c, a, c, d);
  }
  toGeometry() {
    const n = this.pos.length / 3;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = this.pos[i * 3] * S;
      p[i * 3 + 1] = this.pos[i * 3 + 2] * S;
      p[i * 3 + 2] = -this.pos[i * 3 + 1] * S;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function fieldLines() {
  const d = new Decals();
  const W = 30;
  // riempimenti colorati delle aree (prima, così le linee stanno sopra)
  for (const sy of [1, -1]) {
    const c = sy > 0 ? ORANGE : BLUE;
    d.color(c.r, c.g, c.b, 0.16);
    d.rect(-2000, Math.min(3500 * sy, FLOOR_Y * sy), 2000, Math.max(3500 * sy, FLOOR_Y * sy));
    d.color(c.r, c.g, c.b, 0.14);
    d.rect(-1200, Math.min(4250 * sy, FLOOR_Y * sy), 1200, Math.max(4250 * sy, FLOOR_Y * sy));
    // davanti alla porta (sulla bocca), più acceso
    d.color(c.r, c.g, c.b, 0.3);
    d.rect(-GW, Math.min(FLOOR_Y * sy, EY * sy), GW, Math.max(FLOOR_Y * sy, EY * sy));
  }
  d.color(0.92, 0.92, 0.92, 0.9);
  // bordo del campo (dentro il pavimento piatto)
  const b = 20;
  const xs = FLOOR_X - b;
  const yb = FLOOR_Y - b;
  const cs = FLOOR_CORNER - b * SQ2;
  for (const sy of [1, -1])
    for (const sx of [1, -1]) {
      d.line(
        [
          [xs * sx, 0],
          [xs * sx, (cs - xs) * sy],
          [(cs - yb) * sx, yb * sy],
          [GW * sx, yb * sy],
        ],
        W,
      );
    }
  // linea di porta sulla bocca
  for (const sy of [1, -1]) d.line([[-GW, EY * sy - 15], [GW, EY * sy - 15]], W);
  // metà campo, cerchio, dischetto
  d.line([[-xs, 0], [xs, 0]], W);
  d.circle(0, 0, 1000, W);
  d.disc(0, 0, 55);
  // aree
  for (const sy of [1, -1]) {
    d.line([[-2000, yb * sy], [-2000, 3500 * sy], [2000, 3500 * sy], [2000, yb * sy]], W);
    d.line([[-1200, yb * sy], [-1200, 4250 * sy], [1200, 4250 * sy], [1200, yb * sy]], W);
    d.circle(0, 3500 * sy, 800, W, sy > 0 ? Math.PI : 0, sy > 0 ? Math.PI * 2 : Math.PI, 48);
  }
  return d.toGeometry();
}

// ---------------------------------------------------------------- shader del vetro, della rete e del cielo

const SURF_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GLASS_FRAG = /* glsl */ `
uniform vec3 uBlue;
uniform vec3 uOrange;
uniform float uAlpha;
uniform float uHex;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q);
  return 0.5 - max(dot(q, s * 0.5), q.x);
}
void main() {
  vec3 n = normalize(vNrm);
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - abs(dot(n, v)), 3.0);
  float wall = step(abs(n.y), 0.8);
  // esagoni (uv in uu: 1 esagono ~ 1,3 m)
  vec2 p = vUv * 0.01 / 1.3;
  float e = hexEdge(p);
  float fw = fwidth(e) * 1.2 + 0.004;
  float hex = (1.0 - smoothstep(0.012, 0.012 + fw, e)) * uHex;
  // montanti verticali ogni 8 m sui muri
  float mu = abs(fract(vUv.x / 800.0) - 0.5) * 800.0;
  float mfw = fwidth(vUv.x) * 1.5 + 0.5;
  float mull = (1.0 - smoothstep(4.0, 4.0 + mfw, mu)) * wall;
  float t = smoothstep(-6.0, 6.0, -vWorld.z);
  vec3 team = mix(uBlue, uOrange, t);
  float glowLow = exp(-max(vWorld.y - 7.14, 0.0) * 0.8) * wall;
  float shimmer = 0.5 + 0.5 * sin(vWorld.x * 0.4 + vWorld.z * 0.3 - uTime * 1.6);
  vec3 col = mix(vec3(0.7, 0.85, 1.0), team, 0.55) * (0.4 + hex * 0.8 + mull * 1.0 + glowLow * 0.9);
  float a = uAlpha * (0.035 + hex * (0.11 + 0.05 * shimmer) + mull * 0.35 + fres * 0.22 + glowLow * 0.25);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.9));
  ${FRAG_OUT}
}`;

const NET_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFlash;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vNrm);
  vec3 an = abs(n);
  vec2 p = an.x > 0.6 ? vWorld.zy : (an.z > 0.6 ? vWorld.xy : vWorld.xz);
  // rete a rombi
  vec2 q = vec2(p.x + p.y, p.x - p.y) / 0.3;
  vec2 g = abs(fract(q) - 0.5);
  float d = min(g.x, g.y);
  float fw = fwidth(d) * 1.4 + 0.01;
  float net = 1.0 - smoothstep(0.03, 0.03 + fw, d);
  float depth = clamp((abs(vWorld.z) - 51.2) / 8.8, 0.0, 1.0);
  float back = smoothstep(0.6, 0.9, an.z) * step(59.5, abs(vWorld.z));
  float pulse = 0.5 + 0.5 * sin(uTime * 2.0 - vWorld.y * 1.2);
  vec3 col = uColor * (0.15 + depth * 0.35 + back * (0.8 + 0.25 * pulse) + net * (0.6 + 0.6 * depth) + uFlash * 2.0);
  float a = 0.38 + net * 0.45 + back * 0.55 + depth * 0.15 + uFlash * 0.3;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  ${FRAG_OUT}
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // sempre sul fondo
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSun;
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHorizon, uMid, smoothstep(-0.05, 0.28, h));
  c = mix(c, uTop, smoothstep(0.22, 0.9, h));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSun * (pow(s, 700.0) * 5.0 + pow(s, 30.0) * 0.4 + pow(s, 5.0) * 0.14);
  float st = step(0.9972, hash(floor(d * 300.0))) * smoothstep(0.3, 0.7, h);
  c += vec3(st * 0.7);
  gl_FragColor = vec4(c, 1.0);
  ${FRAG_OUT}
}`;

// ---------------------------------------------------------------- pubblico

const CROWD_VERT = /* glsl */ `
attribute vec3 iPos;
attribute float iFace;
attribute vec3 iCol;
attribute vec2 iSeed;
uniform float uTime;
uniform vec2 uCheer;
varying vec2 vUv;
varying vec3 vCol;
varying float vSeed;
varying float vCheer;
void main() {
  float cheer = mix(uCheer.x, uCheer.y, iSeed.y);
  float ph = iSeed.x * 6.2831;
  float jump = max(0.0, sin(uTime * (6.0 + iSeed.x * 4.0) + ph)) * (0.04 + cheer * 0.5);
  vec3 right = vec3(-sin(iFace), 0.0, cos(iFace));
  vec3 p = iPos + right * position.x * 1.55 + vec3(0.0, (position.y + 0.5) * 1.05 + jump, 0.0);
  vUv = position.xy + 0.5;
  vCol = iCol;
  vSeed = iSeed.x;
  vCheer = cheer;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const CROWD_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying float vSeed;
varying float vCheer;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float slot = floor(vUv.x * 3.0);
  float h = hash(vSeed * 91.7 + slot * 13.1);
  vec2 p = vec2(fract(vUv.x * 3.0) - 0.5, vUv.y);
  p.x += (h - 0.5) * 0.14;
  p.y -= (hash(h * 7.3) - 0.5) * 0.1 + max(0.0, sin(uTime * 9.0 + h * 30.0)) * vCheer * 0.12 * h;
  float head = length((p - vec2(0.0, 0.64)) * vec2(1.0, 0.92)) - 0.15;
  vec2 bp = p - vec2(0.0, 0.25);
  float body = max(abs(bp.x) - (0.3 - bp.y * 0.18), abs(bp.y) - 0.26);
  float up = step(0.5, h) * step(0.35, vCheer);
  vec2 ap = vec2(abs(p.x) - 0.3, p.y - 0.7);
  float arm = mix(1.0, max(abs(ap.x) - 0.055, abs(ap.y) - 0.2), up);
  float d = min(min(head, body), arm);
  if (d > 0.0) discard;
  vec3 skin = mix(vec3(0.93, 0.72, 0.56), vec3(0.42, 0.27, 0.17), hash(h * 3.1));
  vec3 rnd = vec3(hash(h * 5.0), hash(h * 7.0), hash(h * 9.0));
  vec3 shirt = mix(vCol, rnd * rnd, step(0.78, hash(h * 11.0)));
  vec3 c = head < 0.0 ? skin : (arm < 0.0 && body > 0.0 ? skin : shirt);
  c *= 0.5 + 0.5 * clamp(p.y * 1.4, 0.0, 1.0);
  gl_FragColor = vec4(c * 0.9, 1.0);
  ${FRAG_OUT}
}`;

// ---------------------------------------------------------------- tribune (in uu: anelli ottagonali sempre più larghi)

// ottagono spostato in fuori di d (lati), d + 1300 dietro le porte, d + 500 negli angoli; lati lunghi spezzati a metà
function standRing(d: number): [number, number][] {
  const Xs = EX + d;
  const Yb = EY + d + 1300;
  const Cc = CS + (d + 500) * SQ2;
  return [
    [Xs, 0],
    [Xs, Cc - Xs],
    [Cc - Yb, Yb],
    [-(Cc - Yb), Yb],
    [-Xs, Cc - Xs],
    [-Xs, 0],
    [-Xs, -(Cc - Xs)],
    [-(Cc - Yb), -Yb],
    [Cc - Yb, -Yb],
    [Xs, -(Cc - Xs)],
  ];
}
// fascia tra due profili (d, z): normali piatte; uv = (lunghezza lungo il bordo, lunghezza lungo il profilo) in uu
function standBand(g: Geo, d0: number, z0: number, d1: number, z1: number) {
  const r0 = standRing(d0);
  const r1 = standRing(d1);
  const n = r0.length;
  const pl = Math.hypot(d1 - d0, z1 - z0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = r0[j][0] - r0[i][0];
    const ey = r0[j][1] - r0[i][1];
    const el = Math.hypot(ex, ey) || 1;
    // normale orizzontale verso il campo (anello in senso antiorario → a sinistra del bordo)
    const hx = -ey / el;
    const hy = ex / el;
    const dz = z1 - z0;
    const dd = d1 - d0;
    let nx = hx * dz;
    let ny = hy * dz;
    let nz = dd;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const a = g.vert(r0[i][0], r0[i][1], z0, nx, ny, nz, 0, 0);
    const b = g.vert(r0[j][0], r0[j][1], z0, nx, ny, nz, el, 0);
    const c = g.vert(r1[j][0], r1[j][1], z1, nx, ny, nz, Math.hypot(r1[j][0] - r1[i][0], r1[j][1] - r1[i][1]), pl);
    const e = g.vert(r1[i][0], r1[i][1], z1, nx, ny, nz, 0, pl);
    g.quad(a, b, c, e);
  }
}

// ---------------------------------------------------------------- lo stadio

export interface StadiumOpts {
  aniso: number;
}

export class Stadium {
  group = new THREE.Group();
  private glassMat: THREE.ShaderMaterial;
  private netMats: THREE.ShaderMaterial[] = [];
  private frameMats: THREE.MeshBasicMaterial[] = [];
  private neonMat: THREE.MeshBasicMaterial;
  private crowdMat: THREE.ShaderMaterial;
  private crowdGeo: THREE.InstancedBufferGeometry;
  private crowdTotal = 0;
  private led: THREE.Texture;
  private screenCv: HTMLCanvasElement;
  private screenTex: THREE.CanvasTexture;
  private glows: Glows;
  private flash = [0, 0];
  private cheerV = [0, 0];
  private score = [-1, -1];
  private hdr = 1;
  private lampMat: THREE.MeshBasicMaterial;

  constructor(opts: StadiumOpts) {
    const G = this.group;
    const aniso = opts.aniso;

    // ---- luci (niente ombre: costano troppo sui telefoni; le ombre sono dischi finti sotto macchine e palla)
    G.add(new THREE.HemisphereLight('#c3cdff', '#3b3430', 0.85));
    const key = new THREE.DirectionalLight('#fff4e4', 1.9);
    key.position.set(-30, 60, 25);
    const fill = new THREE.DirectionalLight('#a9b8ff', 0.5);
    fill.position.set(40, 25, -45);
    G.add(key, key.target, fill, fill.target);

    // ---- cielo e terra
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(450, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color('#081440') },
          uMid: { value: new THREE.Color('#3c2f86') },
          uHorizon: { value: new THREE.Color('#ff8c5f') },
          uSunDir: { value: new THREE.Vector3(-0.62, 0.1, -0.78).normalize() },
          uSun: { value: new THREE.Color('#ffc58a') },
        },
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = 50; // dopo gli oggetti opachi: si disegna solo dove non c'è niente (risparmia pixel)
    G.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(430, 48), new THREE.MeshLambertMaterial({ color: '#1b1f2c' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    G.add(ground);

    // ---- pavimento
    const floorGeo = buildFloor().toGeometry((x, y, _z, out) => {
      const ay = Math.abs(y);
      const k = smooth(-1600, 1600, y);
      let r = 0.92 + (1.1 - 0.92) * k;
      let g = 1.0 - 0.03 * k;
      let b = 1.1 + (0.86 - 1.1) * k;
      const edge = Math.min(FLOOR_X - Math.abs(x), FLOOR_Y - ay, (FLOOR_CORNER - Math.abs(x) - ay) / SQ2);
      let e = 0.8 + 0.2 * smooth(0, 1000, edge);
      if (ay > FLOOR_Y + 1) {
        // dentro la porta: più scuro e del colore della squadra
        const c = y > 0 ? ORANGE : BLUE;
        const kk = 0.45;
        r = r * (1 - kk) + c.r * 2 * kk;
        g = g * (1 - kk) + c.g * 2 * kk;
        b = b * (1 - kk) + c.b * 2 * kk;
        e = 0.72 - 0.22 * smooth(EY, GY1, ay);
      }
      out[0] = r * e;
      out[1] = g * e;
      out[2] = b * e;
    });
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: grassTex(aniso), vertexColors: true }));
    G.add(floor);
    const lines = new THREE.Mesh(
      fieldLines(),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    );
    lines.renderOrder = 2;
    G.add(lines);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 17),
      new THREE.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.y = 0.012;
    logo.renderOrder = 1;
    G.add(logo);

    // ---- muro opaco (rampa + muro basso) con i pannelli AXEND, tinto metà blu e metà arancione
    const tint = (y: number, out: number[], lo: number[], hi: number[]) => {
      const k = smooth(-1400, 1400, y);
      out[0] = lo[0] + (hi[0] - lo[0]) * k;
      out[1] = lo[1] + (hi[1] - lo[1]) * k;
      out[2] = lo[2] + (hi[2] - lo[2]) * k;
    };
    const TB = [0.6, 0.82, 1.4];
    const TO = [1.4, 0.8, 0.45];
    const wallGeo = buildWallLow().toGeometry((_x, y, _z, out) => tint(y, out, TB, TO));
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: wallTex(aniso), vertexColors: true }));
    G.add(wall);

    // ---- vetro (muro alto, raccordo e soffitto)
    this.glassMat = new THREE.ShaderMaterial({
      vertexShader: SURF_VERT,
      fragmentShader: GLASS_FRAG,
      uniforms: {
        uBlue: { value: BLUE.clone().multiplyScalar(1.3) },
        uOrange: { value: ORANGE.clone().multiplyScalar(1.3) },
        uAlpha: { value: 1 },
        uHex: { value: 1 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(buildGlass().toGeometry(), this.glassMat);
    glass.renderOrder = 5;
    G.add(glass);

    // ---- strisce al neon
    this.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const neon = new THREE.Mesh(
      buildNeon().toGeometry((_x, y, z, out) => {
        const k = smooth(-2500, 2500, y);
        const top = z > ARENA.height - 400 ? 0.7 : 1;
        out[0] = (BLUE.r + (ORANGE.r - BLUE.r) * k) * top + 0.08;
        out[1] = (BLUE.g + (ORANGE.g - BLUE.g) * k) * top + 0.08;
        out[2] = (BLUE.b + (ORANGE.b - BLUE.b) * k) * top + 0.08;
      }),
      this.neonMat,
    );
    G.add(neon);

    // ---- porte: rete con fondo luminoso e cornice al neon (y > 0 = porta arancione)
    for (const team of [0, 1] as const) {
      const sy = team === 1 ? 1 : -1;
      const col = team === 1 ? ORANGE : BLUE;
      const net = new THREE.ShaderMaterial({
        vertexShader: SURF_VERT,
        fragmentShader: NET_FRAG,
        uniforms: { uColor: { value: col.clone() }, uFlash: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
      });
      this.netMats.push(net);
      const goal = new THREE.Mesh(buildGoal(sy).toGeometry(), net);
      goal.renderOrder = 4;
      G.add(goal);
      const fm = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), toneMapped: false });
      this.frameMats.push(fm);
      G.add(new THREE.Mesh(buildGoalFrame(sy).toGeometry(), fm));
    }

    // ---- tribune
    const struct = new Geo();
    const PROF: [number, number][] = [
      [250, -50],
      [250, 900],
      [420, 900],
      [420, 1050],
    ];
    for (let i = 0; i < PROF.length - 1; i++) standBand(struct, PROF[i][0], PROF[i][1], PROF[i + 1][0], PROF[i + 1][1]);
    standBand(struct, 3300, 3050, 3300, 3750);
    standBand(struct, 3300, 3750, 3550, 3750);
    // tetto a sbalzo
    standBand(struct, 3550, 3750, 3550, 4250);
    standBand(struct, 1500, 4650, 3550, 4250); // sopra (guarda in su)
    standBand(struct, 3550, 4100, 1500, 4500); // sotto (guarda il campo)
    standBand(struct, 1500, 4500, 1500, 4650); // bordo davanti
    // torri di luce (pilone)
    const towers: [number, number][] = [];
    for (const sx of [1, -1]) for (const sy of [1, -1]) towers.push([7000 * sx, 8200 * sy]);
    for (const [tx, ty] of towers) {
      const w = 110;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const b = ((k + 1) / 4) * Math.PI * 2 + Math.PI / 4;
        const nx = Math.cos((a + b) / 2);
        const ny = Math.sin((a + b) / 2);
        const p0 = struct.vert(tx + Math.cos(a) * w * 1.6, ty + Math.sin(a) * w * 1.6, -50, nx, ny, 0);
        const p1 = struct.vert(tx + Math.cos(b) * w * 1.6, ty + Math.sin(b) * w * 1.6, -50, nx, ny, 0);
        const p2 = struct.vert(tx + Math.cos(b) * w, ty + Math.sin(b) * w, 7000, nx, ny, 0);
        const p3 = struct.vert(tx + Math.cos(a) * w, ty + Math.sin(a) * w, 7000, nx, ny, 0);
        struct.quad(p0, p1, p2, p3);
      }
    }
    // maxischermi appesi davanti al tetto, dietro le porte: cornice e tiranti
    for (const sy of [1, -1]) {
      const y = SCREEN_Y * sy;
      for (const sx of [-1, 1]) {
        const x = 1100 * sx;
        const p0 = struct.vert(x - 40, y + 20 * sy, 4380, 0, -sy, 0);
        const p1 = struct.vert(x + 40, y + 20 * sy, 4380, 0, -sy, 0);
        const p2 = struct.vert(x + 40, y + 20 * sy, 4560, 0, -sy, 0);
        const p3 = struct.vert(x - 40, y + 20 * sy, 4560, 0, -sy, 0);
        struct.quad(p0, p1, p2, p3);
      }
      const yy = y + 25 * sy;
      const a = struct.vert(-1650, yy, 2920, 0, -sy, 0);
      const b = struct.vert(1650, yy, 2920, 0, -sy, 0);
      const c = struct.vert(1650, yy, 4400, 0, -sy, 0);
      const d = struct.vert(-1650, yy, 4400, 0, -sy, 0);
      struct.quad(a, b, c, d);
    }
    const structGeo = struct.toGeometry((x, y, z, out) => {
      const k = smooth(-3000, 3000, y);
      const c = 0.16 + (z > 3700 ? 0.06 : 0);
      out[0] = c * (0.85 + 0.3 * k);
      out[1] = c * 0.95;
      out[2] = c * (1.25 - 0.3 * k);
      void x;
    });
    G.add(new THREE.Mesh(structGeo, new THREE.MeshLambertMaterial({ vertexColors: true })));

    const seats = new Geo();
    standBand(seats, 420, 1050, 3300, 3050);
    const seatGeo = seats.toGeometry((_x, y, _z, out) => tint(y, out, [0.55, 0.7, 1.15], [1.15, 0.7, 0.45]));
    const st = seatTex();
    st.repeat.set(1 / 260, 1 / 260);
    G.add(new THREE.Mesh(seatGeo, new THREE.MeshLambertMaterial({ map: st, vertexColors: true })));

    // ---- tabellone led che scorre sul fronte delle tribune
    const ledG = new Geo();
    standBand(ledG, 235, 690, 235, 880);
    this.led = ledTex();
    this.led.repeat.set(1 / 1400, 1);
    const ledMesh = new THREE.Mesh(
      ledG.toGeometry((_x, y, _z, out) => tint(y, out, [0.6, 0.85, 1.6], [1.6, 0.9, 0.5])),
      new THREE.MeshBasicMaterial({ map: this.led, vertexColors: true, toneMapped: false }),
    );
    G.add(ledMesh);

    // ---- pubblico
    const crowd = this.buildCrowd();
    this.crowdGeo = crowd.geo;
    this.crowdTotal = crowd.count;
    this.crowdMat = crowd.mat;
    G.add(crowd.mesh);

    // ---- lampade: pannelli delle torri e striscia sotto il tetto
    const lamps = new Geo();
    for (const [tx, ty] of towers) {
      // pannello girato verso il centro e inclinato in giù
      const dirx = -tx;
      const diry = -ty;
      const l = Math.hypot(dirx, diry);
      const fx = dirx / l;
      const fy = diry / l;
      const rx = -fy;
      const ry = fx;
      const tilt = 0.45;
      const cz = 7250;
      const hw = 900;
      const hh = 420;
      // il bordo alto si sporge verso il campo: il pannello guarda in giù verso il centro
      const ux = fx * Math.sin(tilt);
      const uy = fy * Math.sin(tilt);
      const uz = Math.cos(tilt);
      const nx = fx * Math.cos(tilt);
      const ny = fy * Math.cos(tilt);
      const nz = -Math.sin(tilt);
      const P = (sx: number, sy: number, u: number, v: number) => lamps.vert(tx + rx * hw * sx + ux * hh * sy, ty + ry * hw * sx + uy * hh * sy, cz + uz * hh * sy, nx, ny, nz, u, v);
      lamps.quad(P(-1, -1, 0, 0), P(1, -1, 1, 0), P(1, 1, 1, 1), P(-1, 1, 0, 1));
    }
    this.lampMat = new THREE.MeshBasicMaterial({ map: lampTex(), toneMapped: false, side: THREE.DoubleSide });
    G.add(new THREE.Mesh(lamps.toGeometry(), this.lampMat));
    const roofLights = new Geo();
    standBand(roofLights, 1520, 4490, 1700, 4470);
    G.add(new THREE.Mesh(roofLights.toGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.13, 0.98), toneMapped: false, side: THREE.DoubleSide })));

    // ---- aloni delle luci (un'unica mesh)
    this.glows = new Glows(64);
    const warm = new THREE.Color(1.1, 1.02, 0.84);
    let gi = 0;
    for (const [tx, ty] of towers) {
      const dx = -tx / Math.hypot(tx, ty);
      const dy = -ty / Math.hypot(tx, ty);
      for (let k = -1; k <= 1; k++) {
        const x = tx + -dy * 600 * k + dx * 200;
        const y = ty + dx * 600 * k + dy * 200;
        this.glows.set(gi++, x * S, 72.5, -y * S, 22, warm, 0.55);
      }
    }
    // luci sopra le porte
    for (const sy of [1, -1]) {
      const c = sy > 0 ? ORANGE : BLUE;
      for (const sx of [-1, 1]) this.glows.set(gi++, GW * sx * S, (GH + 40) * S, -EY * sy * S, 2.4, new THREE.Color(c.r * 1.5, c.g * 1.5, c.b * 1.5), 0.6);
    }
    this.glows.flush();
    G.add(this.glows.mesh);

    // ---- maxischermi
    this.screenCv = document.createElement('canvas');
    this.screenCv.width = 512;
    this.screenCv.height = 256;
    this.screenTex = new THREE.CanvasTexture(this.screenCv);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const scr = new Geo();
    for (const sy of [1, -1]) {
      const y = SCREEN_Y * sy;
      // da dentro il campo si legge da sinistra a destra (guardando verso +y la destra è +x)
      const xa = -1550 * sy;
      const xb = 1550 * sy;
      const a = scr.vert(xa, y, 3000, 0, -sy, 0, 0, 0);
      const b = scr.vert(xb, y, 3000, 0, -sy, 0, 1, 0);
      const c = scr.vert(xb, y, 4320, 0, -sy, 0, 1, 1);
      const d = scr.vert(xa, y, 4320, 0, -sy, 0, 0, 1);
      scr.quad(a, b, c, d);
    }
    G.add(new THREE.Mesh(scr.toGeometry(), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false })));
    this.setScore(0, 0);
  }

  private buildCrowd() {
    const r = rng(42);
    const pos: number[] = [];
    const face: number[] = [];
    const col: number[] = [];
    const seed: number[] = [];
    const NR = 24;
    const shirtsB = ['#2f7bff', '#5ea0ff', '#1d4fc4', '#ffffff', '#2f7bff'].map((c) => new THREE.Color(c));
    const shirtsO = ['#ff8a1f', '#ffb15e', '#e2620b', '#ffffff', '#ff8a1f'].map((c) => new THREE.Color(c));
    for (let row = 0; row < NR; row++) {
      const t = (row + 0.5) / NR;
      const d = 420 + (3300 - 420) * t;
      const z = 1050 + (3050 - 1050) * t;
      const ring = standRing(d);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const ex = b[0] - a[0];
        const ey = b[1] - a[1];
        const el = Math.hypot(ex, ey);
        const n = Math.floor(el / 200);
        // normale verso il campo (in three: x, −y)
        const hx = -ey / el;
        const hy = ex / el;
        const fa = Math.atan2(-hy, hx); // angolo in three (x, z)
        for (let k = 0; k < n; k++) {
          if (r() < 0.1) continue;
          const f = (k + 0.5 + (r() - 0.5) * 0.3) / n;
          const x = a[0] + ex * f;
          const y = a[1] + ey * f;
          pos.push(x * S, z * S, -y * S);
          face.push(fa);
          const side = y > 0 ? 1 : 0;
          const pal = side ? shirtsO : shirtsB;
          const c = Math.abs(y) < 2500 && r() < 0.35 ? (side ? shirtsB : shirtsO)[Math.floor(r() * 5)] : pal[Math.floor(r() * 5)];
          col.push(c.r, c.g, c.b);
          seed.push(r(), side);
        }
      }
    }
    // ordine a caso: con meno qualità si disegnano solo i primi (pubblico più rado ma uniforme)
    const count = pos.length / 3;
    const order = [...Array(count).keys()];
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const P = new Float32Array(count * 3);
    const F = new Float32Array(count);
    const Cc = new Float32Array(count * 3);
    const Sd = new Float32Array(count * 2);
    order.forEach((o, i) => {
      P.set(pos.slice(o * 3, o * 3 + 3), i * 3);
      F[i] = face[o];
      Cc.set(col.slice(o * 3, o * 3 + 3), i * 3);
      Sd.set(seed.slice(o * 2, o * 2 + 2), i * 2);
    });
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3));
    geo.setAttribute('iFace', new THREE.InstancedBufferAttribute(F, 1));
    geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(Cc, 3));
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(Sd, 2));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      vertexShader: CROWD_VERT,
      fragmentShader: CROWD_FRAG,
      uniforms: { uTime: { value: 0 }, uCheer: { value: new THREE.Vector2() } },
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { geo, mat, mesh, count };
  }

  // tabellone: punteggio
  setScore(a: number, b: number) {
    if (this.score[0] === a && this.score[1] === b) return;
    this.score = [a, b];
    const g = this.screenCv.getContext('2d')!;
    const W = 512;
    const H = 256;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#10162a');
    bg.addColorStop(1, '#05070f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = TEAM_COLORS[0];
    g.fillRect(0, 0, W / 2, 10);
    g.fillStyle = TEAM_COLORS[1];
    g.fillRect(W / 2, 0, W / 2, 10);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 40px ${FONT}`;
    strokeText(g, 'AXEND TURBO', W / 2, 46, '#ffffff', '#000000', 6);
    g.font = `900 120px ${FONT}`;
    strokeText(g, String(a), W * 0.27, 158, TEAM_COLORS[0], '#000000', 10);
    strokeText(g, String(b), W * 0.73, 158, TEAM_COLORS[1], '#000000', 10);
    g.font = `900 70px ${FONT}`;
    strokeText(g, '–', W / 2, 152, '#ffffff', '#000000', 8);
    this.screenTex.needsUpdate = true;
  }

  // gol: la porta che subisce lampeggia e il pubblico della squadra che segna esulta
  goal(team: 0 | 1) {
    const conceded = team === 0 ? 1 : 0;
    this.flash[conceded] = 1;
    this.cheerV[team] = 1;
    this.cheerV[conceded] = Math.max(this.cheerV[conceded], 0.15);
  }
  cheer(team: 0 | 1, amount: number) {
    this.cheerV[team] = Math.max(this.cheerV[team], amount);
  }

  setQuality(q: Quality, bloom: boolean) {
    const frac = q === 'alta' ? 1 : q === 'media' ? 0.7 : 0.4;
    this.crowdGeo.instanceCount = Math.floor(this.crowdTotal * frac);
    this.glassMat.uniforms.uHex.value = q === 'bassa' ? 0.6 : 1;
    // con il bagliore (bloom) i neon possono andare oltre il bianco
    this.hdr = bloom ? 1.6 : 1;
    this.neonMat.color.setScalar(this.hdr);
    this.lampMat.color.setScalar(bloom ? 1.25 : 0.9);
  }

  update(t: number, dt: number) {
    this.glassMat.uniforms.uTime.value = t;
    this.crowdMat.uniforms.uTime.value = t;
    for (let i = 0; i < 2; i++) {
      this.cheerV[i] = Math.max(0, this.cheerV[i] - dt * 0.22);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 0.6);
      const f = this.flash[i];
      const blink = f > 0 ? 0.5 + 0.5 * Math.cos(t * 18) : 0;
      this.netMats[i].uniforms.uTime.value = t;
      this.netMats[i].uniforms.uFlash.value = f * blink;
      const base = i === 0 ? BLUE : ORANGE;
      this.frameMats[i].color.copy(base).multiplyScalar((1.3 + f * blink * 2.5) * (this.hdr > 1 ? 1.5 : 1));
    }
    (this.crowdMat.uniforms.uCheer.value as THREE.Vector2).set(this.cheerV[0], this.cheerV[1]);
    this.led.offset.x = (this.led.offset.x + dt * 0.06) % 1;
  }
}
