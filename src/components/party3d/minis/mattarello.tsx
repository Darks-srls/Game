// 🥖 Il mattarello (telefono): sei tronconi di sfoglia colorata che girano (i buchi sono ritagli veri nella texture),
// frecce che dicono da che parte gira e lampeggiano prima del cambio di verso, ciotolona di sugo sotto
import * as THREE from 'three';
import { MAT, matAngle, matCurrent, matHoleAt, matIndex, matNextRev, matOmega, matSpeed } from '../../../data/minis/mattarello';
import { MINIS } from '../../../data/party3d';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, flagLine, glow, makeNonna, outlined, popText, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

// colori della sfoglia: all'uovo, spinaci, pomodoro, barbabietola, zafferano, integrale
const DOUGH = ['#f7d57e', '#a8d672', '#f4895f', '#e58bbd', '#ffc94a', '#cfa57c'];
const TW = 1024; // texture: giro intero (u) × lunghezza del troncone (v)
const TH = 256;
const PX_U = TW / (2 * Math.PI * MAT.R); // pixel per metro lungo il giro
const PX_V = TH / MAT.len; // … e lungo il mattarello
const SAUCE_Y = -12;

let wasGround = false;
let lastWarnRev = -1;

const pathStar = (c: CanvasRenderingContext2D, ro: number, ri: number, rot: number) => {
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rot + (k / 10) * Math.PI * 2;
    const r = k % 2 ? ri : ro;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
};

// la sagoma di un buco (in metri), centrata nell'origine
function holePath(c: CanvasRenderingContext2D, h: { r: number; star: boolean; a: number }, grow = 0) {
  if (h.star) pathStar(c, h.r * 1.45 + grow, h.r + grow, h.a * 3);
  else {
    c.beginPath();
    c.arc(0, 0, h.r + 0.06 + grow, 0, Math.PI * 2);
  }
}

// disegna qualcosa sopra ogni buco (anche a cavallo della cucitura della texture)
function eachSpot(c: CanvasRenderingContext2D, h: { a: number; x: number }, draw: () => void) {
  const u = ((((h.a - Math.PI / 2) / (Math.PI * 2)) % 1) + 1) % 1;
  const px = u * TW;
  const py = ((MAT.len / 2 - h.x) / MAT.len) * TH;
  for (const off of [-TW, 0, TW]) {
    if (px + off < -120 || px + off > TW + 120) continue;
    c.save();
    c.translate(px + off, py);
    c.scale(PX_U, PX_V);
    draw();
    c.restore();
  }
}

// la sfoglia di base (senza buchi): righe del mattarello, farina, puntini
function baseDough(i: number) {
  const cv = document.createElement('canvas');
  cv.width = TW;
  cv.height = TH;
  const c = cv.getContext('2d')!;
  const col = new THREE.Color(DOUGH[i]);
  c.fillStyle = DOUGH[i];
  c.fillRect(0, 0, TW, TH);
  // strisce lungo il mattarello: si vede che gira
  for (let x = 0; x < TW; x += 32) {
    const k = (x / 32) % 2 ? 0.94 : 1.04;
    c.fillStyle = `#${col.clone().multiplyScalar(k).getHexString()}`;
    c.fillRect(x, 0, 32, TH);
  }
  let s = 11 + i * 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 900; k++) {
    c.fillStyle = k % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(120,70,20,0.18)';
    c.beginPath();
    c.arc(rnd() * TW, rnd() * TH, 1 + rnd() * 2.5, 0, Math.PI * 2);
    c.fill();
  }
  // farina a chiazze
  for (let k = 0; k < 14; k++) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.translate(rnd() * TW, rnd() * TH);
    c.fillStyle = g;
    c.fillRect(-60, -60, 120, 120);
    c.restore();
  }
  // bordi del troncone (la sfoglia ripiegata)
  c.fillStyle = `#${col.clone().multiplyScalar(0.78).getHexString()}`;
  c.fillRect(0, 0, TW, 7);
  c.fillRect(0, TH - 7, TW, 7);
  return cv;
}

interface Drum {
  group: THREE.Group;
  base: HTMLCanvasElement;
  cv: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  glowCv: HTMLCanvasElement;
  glowTex: THREE.CanvasTexture;
  mat: THREE.MeshStandardMaterial;
  opened: number;
  soonSig: string;
  seed: number;
  arrows: THREE.Mesh[];
  arrowMat: THREE.MeshStandardMaterial;
}

// la sfoglia con i buchi aperti (ritagliati) e quelli che si apriranno (tratteggiati)
function paintDrum(d: Drum, i: number, t: number) {
  const plan = matCurrent();
  const c = d.cv.getContext('2d')!;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, TW, TH);
  c.drawImage(d.base, 0, 0);
  const dark = `#${new THREE.Color(DOUGH[i]).multiplyScalar(0.55).getHexString()}`;
  let opened = 0;
  for (const h of plan.holes[i]) {
    if (t >= h.open) {
      opened++;
      // bordo cotto intorno al buco, poi il ritaglio
      eachSpot(c, h, () => {
        holePath(c, h, 0.16);
        c.fillStyle = dark;
        c.fill();
      });
    } else
      eachSpot(c, h, () => {
        holePath(c, h);
        c.setLineDash([0.22, 0.16]);
        c.lineWidth = 0.07;
        c.strokeStyle = dark;
        c.stroke();
      });
  }
  c.globalCompositeOperation = 'destination-out';
  for (const h of plan.holes[i])
    if (t >= h.open)
      eachSpot(c, h, () => {
        holePath(c, h);
        c.fill();
      });
  c.globalCompositeOperation = 'source-over';
  c.setLineDash([]);
  d.tex.needsUpdate = true;
  d.opened = opened;
}

// i buchi che stanno per aprirsi brillano (mappa di luce a parte)
function paintGlow(d: Drum, i: number, t: number) {
  const plan = matCurrent();
  const c = d.glowCv.getContext('2d')!;
  c.fillStyle = '#000000';
  c.fillRect(0, 0, d.glowCv.width, d.glowCv.height);
  c.save();
  c.scale(d.glowCv.width / TW, d.glowCv.height / TH);
  for (const h of plan.holes[i])
    if (h.open > t && h.open - t < 3.5)
      eachSpot(c, h, () => {
        holePath(c, h);
        c.lineWidth = 0.2;
        c.strokeStyle = '#ffffff';
        c.stroke();
      });
  c.restore();
  d.glowTex.needsUpdate = true;
}

// freccia piatta (indica dove corre la sfoglia in cima)
function arrowGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.9);
  s.lineTo(0.75, 0);
  s.lineTo(0.3, 0);
  s.lineTo(0.3, -0.8);
  s.lineTo(-0.3, -0.8);
  s.lineTo(-0.3, 0);
  s.lineTo(-0.75, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); // sdraiata: la punta verso -z
  g.rotateY(Math.PI); // … e verso +z
  return g;
}

function bowlTex() {
  return canvasTex(512, 128, (c) => {
    c.fillStyle = '#fbf7ef';
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#2b59c3';
    c.fillRect(0, 18, 512, 14);
    c.fillRect(0, 96, 512, 6);
    for (let k = 0; k < 16; k++) {
      c.beginPath();
      c.arc(16 + k * 32, 62, 9, 0, Math.PI * 2);
      c.fill();
    }
  }, [6, 1]);
}

function meatball(r: number) {
  const g = new THREE.Group();
  const ball = outlined(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), toy('#8a4b2a', { roughness: 0.8, clearcoat: 0.1 })), 1.05);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 16, 8, 0, Math.PI * 2, 0, 0.9), toy('#d62828', { roughness: 0.2, clearcoat: 1 }));
  g.add(ball, cap);
  return g;
}

registerClientMini({
  kind: 'MATTARELLO',
  orbit: { c: [0, -2, 0], r: 36 },
  highCam: true,
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffd166" to="#e76f51">
      <path d="M14 70 L24 60 M76 30 L86 20" {...stroke} strokeWidth={9} />
      <rect x="22" y="36" width="56" height="28" rx="14" fill="#f4c27a" {...stroke} transform="rotate(-38 50 50)" />
      <path d="M48 38 l3 7 l7 0 l-5.5 4.5 l2 7 l-6.5 -4 l-6.5 4 l2 -7 l-5.5 -4.5 l7 0 Z" fill="#7a3b22" transform="rotate(-38 50 50)" />
      <path d="M20 84 q10 -8 20 0 M58 16 q10 8 20 0" fill="none" {...stroke} stroke="#ffffff" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto · E schiaffo · corri controcorrente e scansa i buchi',
  feed: {
    buco: ['{n} è caduto in un buco della sfoglia', '{n} è passato per lo stampino', '{n}: buco preso in pieno'],
    sugo: ['{n} è scivolato nel sugo', '{n} è rotolato giù dal mattarello', 'splash: {n} nel sugo'],
  },
  build(world) {
    const g = world.arena;
    const sh = world.sun.shadow.camera;
    sh.left = -26;
    sh.right = 26;
    sh.top = 18;
    sh.bottom = -18;
    // ---- i tronconi: fuori la sfoglia (coi buchi veri), dentro scuro
    const outerGeo = new THREE.CylinderGeometry(MAT.R, MAT.R, MAT.len - 0.06, 80, 1, true);
    outerGeo.rotateZ(-Math.PI / 2);
    const innerGeo = new THREE.CylinderGeometry(MAT.R - 0.05, MAT.R - 0.05, MAT.len - 0.06, 80, 1, true);
    innerGeo.rotateZ(-Math.PI / 2);
    const aGeo = arrowGeo();
    const drums: Drum[] = [];
    for (let i = 0; i < MAT.n; i++) {
      const group = new THREE.Group();
      group.position.set(-MAT.half + MAT.len * (i + 0.5), -MAT.R, 0);
      const base = baseDough(i);
      const cv = document.createElement('canvas');
      cv.width = TW;
      cv.height = TH;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const glowCv = document.createElement('canvas');
      glowCv.width = 512;
      glowCv.height = 128;
      const glowTex = new THREE.CanvasTexture(glowCv);
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.62, emissive: '#ffb703', emissiveMap: glowTex, emissiveIntensity: 0 });
      const inner = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, color: '#6e2a17', roughness: 1, side: THREE.BackSide });
      const outer = new THREE.Mesh(outerGeo, mat);
      outer.castShadow = true;
      outer.receiveShadow = true;
      group.add(outer, new THREE.Mesh(innerGeo, inner));
      g.add(group);
      // frecce ai due lati: dove corre la sfoglia in cima
      const arrowMat = glow('#06d6a0', 0.9);
      const arrows: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const a = new THREE.Mesh(aGeo, arrowMat);
        a.position.set(group.position.x, -2.4, side * (MAT.R + 1.6));
        g.add(a);
        arrows.push(a);
      }
      drums.push({ group, base, cv, tex, glowCv, glowTex, mat, opened: -1, soonSig: '', seed: -1, arrows, arrowMat });
    }
    // collari di legno tra un troncone e l'altro, testate, manici e cavalletti
    const wood = toy('#b5743a', { roughness: 0.55 });
    const collarGeo = new THREE.TorusGeometry(MAT.R - 0.02, 0.08, 10, 80);
    for (let k = 0; k <= MAT.n; k++) {
      const col = new THREE.Mesh(collarGeo, wood);
      col.rotation.y = Math.PI / 2;
      col.position.set(-MAT.half + MAT.len * k, -MAT.R, 0);
      g.add(col);
    }
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(MAT.R - 0.04, 48), toy('#c98b4f'));
      cap.rotation.y = (sx * Math.PI) / 2;
      cap.position.set(sx * MAT.half, -MAT.R, 0);
      const handle = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 6, 24), wood), 1.04);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(sx * (MAT.half + 3), -MAT.R, 0);
      const knob = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 16), wood), 1.04);
      knob.position.set(sx * (MAT.half + 6.3), -MAT.R, 0);
      // cavalletto (a forcella) sotto il manico
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 18, 12), toy('#8d5524'));
      post.position.set(sx * (MAT.half + 3), -MAT.R - 10.3, 0);
      const fork = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.32, 10, 24, Math.PI), toy('#8d5524'));
      fork.rotation.set(0, Math.PI / 2, Math.PI);
      fork.position.set(sx * (MAT.half + 3), -MAT.R - 0.2, 0);
      g.add(cap, shadowy(handle), shadowy(knob), shadowy(post), fork);
    }
    // bandierine tra i cavalletti e palloncini
    const fl = flagLine(new THREE.Vector3(-MAT.half - 6, 6, -14), new THREE.Vector3(MAT.half + 6, 6, -14), 10);
    const fl2 = flagLine(new THREE.Vector3(-MAT.half - 6, 6, 14), new THREE.Vector3(MAT.half + 6, 6, 14), 10);
    g.add(fl, fl2);
    const balloons: THREE.Group[] = [];
    for (let k = 0; k < 6; k++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff', '#ff70a6'][k % 5]);
      const sx = k % 2 ? 1 : -1;
      b.position.set(-MAT.half - 2 + (k * (2 * MAT.half + 4)) / 5, 2 + (k % 3) * 1.6, sx * (15 + (k % 3)));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // ---- la ciotolona di sugo sotto
    const prof: THREE.Vector2[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * (Math.PI / 2);
      prof.push(new THREE.Vector2(Math.sin(a) * 30, -10 - Math.cos(a) * 14));
    }
    prof.push(new THREE.Vector2(31.2, -9.6));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), toy('#ffffff', { map: bowlTex(), side: THREE.DoubleSide, roughness: 0.25, clearcoat: 0.8 }));
    bowl.receiveShadow = true;
    g.add(bowl);
    const seaGeo = new THREE.RingGeometry(0.01, 29, 56, 10);
    const sea = new THREE.Mesh(seaGeo, toy('#c1121f', { roughness: 0.2, clearcoat: 1, emissive: '#6e0a10', emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = SAUCE_Y;
    sea.receiveShadow = true;
    g.add(sea);
    const seaBase = (seaGeo.attributes.position.array as Float32Array).slice();
    const floaters: THREE.Object3D[] = [];
    for (let k = 0; k < 6; k++) {
      const o = k % 3 === 2 ? new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), toy('#2d8a3e')) : meatball(1.2 + (k % 2) * 0.5);
      if (k % 3 === 2) o.scale.set(1.6, 0.25, 0.9);
      const a = (k / 6) * Math.PI * 2 + 0.4;
      const r = 8 + (k % 4) * 4.5;
      o.position.set(Math.sin(a) * r * 1.2, SAUCE_Y, Math.cos(a) * r * 0.6);
      o.userData.ph = k;
      floaters.push(o);
      g.add(o);
    }
    // la nonna laggiù che guarda (e fa il tifo col mattarello piccolo)
    const nonna = makeNonna();
    nonna.scale.setScalar(4.5);
    nonna.position.set(0, -9.6, -34);
    g.add(nonna);
    // pezzi di sfoglia che cadono quando si apre un buco
    const pieces: { m: THREE.Mesh; v: THREE.Vector3; spin: number; life: number }[] = [];
    const starGeo = new THREE.ShapeGeometry(
      (() => {
        const s = new THREE.Shape();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const r = k % 2 ? 0.55 : 0.95;
          if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else s.moveTo(r, 0);
        }
        return s;
      })(),
    );
    let lastPaintT = -99;

    return (f) => {
      const t = f.playT;
      const plan = matCurrent();
      for (let i = 0; i < MAT.n; i++) {
        const d = drums[i];
        d.group.rotation.x = matAngle(i, t);
        // buchi nuovi: ridisegno la sfoglia (e il pezzo ritagliato cade nel sugo)
        let opened = 0;
        let soon = '';
        for (let k = 0; k < plan.holes[i].length; k++) {
          const h = plan.holes[i][k];
          if (t >= h.open) opened++;
          else if (h.open - t < 3.5) soon += k;
        }
        if (d.seed !== plan.seed || opened !== d.opened || t < lastPaintT - 1) {
          const newly = d.seed === plan.seed && opened > d.opened && opened - d.opened <= 2;
          d.seed = plan.seed;
          paintDrum(d, i, t);
          if (newly && f.view.stage === 'PLAY')
            for (const h of plan.holes[i])
              if (t >= h.open && t - h.open < 0.3) {
                // dove è il buco adesso nel mondo
                const a = h.a + matAngle(i, t);
                const m = new THREE.Mesh(starGeo, toy(DOUGH[i], { side: THREE.DoubleSide }));
                m.position.set(d.group.position.x + h.x, -MAT.R + Math.cos(a) * MAT.R, Math.sin(a) * MAT.R);
                m.scale.setScalar(h.r);
                g.add(m);
                pieces.push({ m, v: new THREE.Vector3(0, 1.5, Math.sin(a) * 2), spin: (Math.random() - 0.5) * 8, life: 2.4 });
                if (Math.hypot(f.me.x - m.position.x, f.me.z - m.position.z) < 9) soundManager.playPop();
              }
        }
        if (soon !== d.soonSig) {
          d.soonSig = soon;
          paintGlow(d, i, t);
        }
        d.mat.emissiveIntensity = soon ? 0.55 + Math.sin(f.t * 12) * 0.45 : 0;
        // frecce: verso dove corre la sfoglia in cima; rosse e ballerine prima del cambio di verso
        const w = matOmega(i, t);
        const rev = matNextRev(i, t);
        const warn = rev < MAT.warn && f.view.stage === 'PLAY';
        for (const a of d.arrows) {
          a.rotation.y = w >= 0 ? 0 : Math.PI;
          a.scale.setScalar(warn ? 1.1 + Math.sin(f.t * 16) * 0.2 : 0.7 + Math.min(0.5, Math.abs(w) * 0.4));
          a.position.y = -2.4 + (warn ? Math.abs(Math.sin(f.t * 10)) * 0.4 : 0);
        }
        d.arrowMat.color.set(warn ? '#ff1744' : '#06d6a0');
        d.arrowMat.emissive.set(warn ? '#ff1744' : '#06d6a0');
      }
      lastPaintT = t;
      for (let k = pieces.length - 1; k >= 0; k--) {
        const p = pieces[k];
        p.life -= f.dt;
        p.v.y -= 20 * f.dt;
        p.m.position.addScaledVector(p.v, f.dt);
        p.m.rotation.x += p.spin * f.dt;
        p.m.rotation.z += p.spin * 0.7 * f.dt;
        if (p.life <= 0 || p.m.position.y < SAUCE_Y) {
          if (p.m.position.y < SAUCE_Y + 1) burst(world, p.m.position.x, SAUCE_Y + 0.3, p.m.position.z, ['#c1121f', '#e63946'], 14, 4);
          g.remove(p.m);
          (p.m.material as THREE.Material).dispose();
          pieces.splice(k, 1);
        }
      }
      // il sugo ondeggia, polpette e basilico galleggiano
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let k = 0; k < pos.length; k += 3) pos[k + 2] = seaBase[k + 2] + Math.sin(seaBase[k] * 0.25 + f.t * 1.4) * 0.25 + Math.cos(seaBase[k + 1] * 0.3 + f.t) * 0.2;
      seaGeo.attributes.position.needsUpdate = true;
      for (const o of floaters) {
        o.position.y = SAUCE_Y + 0.2 + Math.sin(f.t * 1.3 + o.userData.ph) * 0.25;
        o.rotation.y = f.t * 0.2 + o.userData.ph;
      }
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.5;
      nonna.userData.arm.rotation.x = -2.4 + Math.sin(f.t * 2.5) * 0.5;
    };
  },
  // sul fianco in discesa il corpo si stacca dal rullo per un attimo: lo riaggancio (così corre e salta come in piano)
  local(f) {
    const me = f.me;
    if (f.view.stage === 'PLAY' && f.view.alive[f.myId] && !me.ground && me.vy <= 0 && wasGround) {
      const g = MINIS.MATTARELLO?.ground?.(me.x, me.z, f.playT);
      if (g !== null && g !== undefined && me.y > g && me.y - g < 0.3) {
        me.y = g;
        me.vy = 0;
        me.ground = true;
        me.airJumps = 0;
      }
    }
    wasGround = me.ground;
    // il mio troncone cambia verso: un tic di avviso
    const i = matIndex(me.x);
    const rev = matNextRev(i, f.playT);
    const key = rev < 1.2 ? Math.round(f.playT + rev) : -1;
    if (key > 0 && key !== lastWarnRev && f.view.alive[f.myId]) {
      lastWarnRev = key;
      soundManager.playTick();
    }
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const me = h.me;
    if (me.y < -1) return { text: 'GIÙ NEL SUGO…', cls: 'sc-red' };
    for (let tau = 0.1; tau <= 0.8; tau += 0.1)
      if (matHoleAt(me.x, me.z, t + tau) >= 0) return { text: 'BUCO IN ARRIVO: SPOSTATI O SALTA!', cls: 'sc-red pulse-soft' };
    const i = matIndex(me.x);
    if (matNextRev(i, t) < MAT.warn) return { text: 'IL RULLO CAMBIA VERSO!', cls: 'sc-purple pulse-soft' };
    if (Math.abs(me.z) > MAT.R * 0.5) return { text: 'TORNA IN CIMA!', cls: 'sc-yellow pulse-soft' };
    return { text: 'CORRI CONTRO IL RULLO', cls: 'sc-dark' };
  },
  // la velocità del rullo (sale col tempo)
  hud(h: HudCtx) {
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const k = (matSpeed(t) - MAT.w0) / (MAT.w1 - MAT.w0);
    const bars = 5;
    const on = Math.max(1, Math.min(bars, Math.round(1 + k * (bars - 1))));
    return (
      <div className="pointer-events-none absolute left-3 top-[72px]">
        <p className="sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white">
          RULLO
          <span className="flex gap-0.5">
            {Array.from({ length: bars }, (_, j) => (
              <span key={j} className={`inline-block h-3 w-2 rounded-sm border border-[#1d0f3d] ${j < on ? (j >= 3 ? 'bg-red-500' : 'bg-amber-300') : 'bg-white/25'}`} />
            ))}
          </span>
        </p>
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'mat_fall') {
      // splash nel sugo, giù sotto dove è caduto
      const x = Math.max(-26, Math.min(26, p.x));
      const z = Math.max(-12, Math.min(12, p.z * 1.6));
      burst(c.world, x, SAUCE_Y + 0.4, z, ['#c1121f', '#e63946', '#ff8a7a', '#7a0d0d'], 46, 8);
      ringPulse(c.world, x, SAUCE_Y - 0.5, z, '#ff4d6d');
      popText(c.world, x, SAUCE_Y + 1, z, p.hole ? 'NEL BUCO!' : 'SPLASH!', '#ffd60a', { scale: 1.2 });
      if (p.id === c.myId) c.shake(0.6);
    }
  },
});
