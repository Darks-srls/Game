// 🤖 Simon dice (telefono): nove piastrelle di gelatina sospese su passerelle di savoiardi, il forno-robot Simon
// che accende la sequenza (ogni colore la sua nota), le piastrelle che si aprono sotto chi sbaglia
import * as THREE from 'three';
import { SIMON, SIMON_COLORS, SIMON_NAMES, SIMON_NOTES, simonTile, simonTileAt } from '../../../data/minis/simon';
import { haptic, soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, glow, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { giro: number; phase: 'SHOW' | 'GO' | 'PAUSE'; endsAt: number; phaseAt: number; len: number; prog: Record<string, number>; done: string[] } | null;

const NT = SIMON.n * SIMON.n;
// quello che sa il mio telefono: la sequenza vista (dagli effetti), i miei passi (in anticipo sul server), chi sta cadendo
const S = {
  giro: -1,
  seq: [] as number[],
  go: false,
  myProg: 0,
  myLast: -1,
  myWrong: false,
  litAt: new Float64Array(NT),
  litDur: new Float64Array(NT).fill(500),
  flashAt: new Float64Array(NT),
  lastLit: -1,
  say: 'SIMON DICE',
  sayAt: 0,
};
const falls = new Map<string, { x: number; z: number; at: number }>();
const holes: { x: number; z: number; at: number; color: string }[] = [];

// le note dei colori (lo stesso sintetizzatore degli altri effetti)
function note(i: number, vol = 0.13, dur = 0.5) {
  const f = SIMON_NOTES[i] ?? 440;
  soundManager.playNote(f, dur, { type: 'triangle', vol, attack: 0.01 });
  soundManager.playNote(f * 2, dur * 0.6, { type: 'sine', vol: vol * 0.35 });
}

function say(text: string) {
  S.say = text;
  S.sayAt = performance.now();
}

// simboli sulle piastrelle (aiutano anche chi distingue male i colori)
function symbolTex(i: number) {
  return canvasTex(256, 256, (c) => {
    c.translate(128, 128);
    c.beginPath();
    if (i === 0) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 ? 42 : 100;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else if (i === 1) {
      c.moveTo(0, 86);
      c.bezierCurveTo(-120, 0, -70, -100, 0, -40);
      c.bezierCurveTo(70, -100, 120, 0, 0, 86);
    } else if (i === 2) {
      c.arc(0, 0, 88, 0, Math.PI * 2);
      c.moveTo(44, 0);
      c.arc(0, 0, 44, 0, Math.PI * 2, true);
    } else if (i === 3) {
      c.moveTo(0, -96);
      c.lineTo(96, 78);
      c.lineTo(-96, 78);
    } else if (i === 4) c.rect(-78, -78, 156, 156);
    else if (i === 5) {
      c.moveTo(0, -104);
      c.lineTo(76, 0);
      c.lineTo(0, 104);
      c.lineTo(-76, 0);
    } else if (i === 6) {
      for (const [x, y] of [
        [-30, -96],
        [30, -96],
        [30, -30],
        [96, -30],
        [96, 30],
        [30, 30],
        [30, 96],
        [-30, 96],
        [-30, 30],
        [-96, 30],
        [-96, -30],
        [-30, -30],
      ])
        c.lineTo(x, y);
    } else if (i === 7) {
      c.arc(0, 0, 92, 0.5, Math.PI * 2 - 0.5);
      c.arc(40, 0, 70, Math.PI * 2 - 1.05, 1.05, true);
    } else {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.moveTo(Math.cos(a) * 52 + 40, Math.sin(a) * 52);
        c.arc(Math.cos(a) * 52, Math.sin(a) * 52, 40, 0, Math.PI * 2);
      }
    }
    c.closePath();
    c.lineJoin = 'round';
    c.lineWidth = 16;
    c.strokeStyle = 'rgba(29,15,61,0.85)';
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fill('evenodd');
  });
}

const holeTex = (() => {
  let t: THREE.Texture | null = null;
  return () =>
    (t ??= canvasTex(256, 256, (c) => {
      c.translate(128, 128);
      c.fillStyle = '#120a1f';
      c.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        const r = 70 + (k % 2 ? 22 : 0) + Math.sin(k * 5) * 8;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.fill();
      c.strokeStyle = '#120a1f';
      c.lineWidth = 6;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        c.beginPath();
        c.moveTo(Math.cos(a) * 80, Math.sin(a) * 80);
        c.lineTo(Math.cos(a + 0.15) * 106, Math.sin(a + 0.15) * 106);
        c.lineTo(Math.cos(a - 0.05) * 124, Math.sin(a - 0.05) * 124);
        c.stroke();
      }
    }));
})();

const biscuit = () =>
  canvasTex(
    256,
    64,
    (c) => {
      c.fillStyle = '#e9b66b';
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      let s = 5;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 140; i++) c.fillRect(rnd() * 256, rnd() * 64, 3 + rnd() * 3, 3 + rnd() * 3);
      c.fillStyle = 'rgba(160,90,30,0.25)';
      c.fillRect(0, 0, 256, 6);
      c.fillRect(0, 58, 256, 6);
    },
    [6, 1],
  );

// il forno-robot Simon (davanti = +z locale, poi girato verso le piastrelle)
function makeSimon() {
  const g = new THREE.Group();
  const cream = toy('#f4f1ea', { clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const red = toy('#e63946', { clearcoat: 0.8 });
  const dark = toy('#1d1b2c', { roughness: 0.15, clearcoat: 1 });
  const ped = outlined(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.6, 1.2, 32), toy('#8338ec')), 1.02);
  ped.position.y = -0.6;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.4, 8, 24), toy('#5a189a'));
  cone.rotation.x = Math.PI;
  cone.position.y = -5.2;
  const body = outlined(new THREE.Mesh(rbox(10, 7, 4.2, 0.9), cream), 1.02);
  body.position.y = 4.5;
  const trim = new THREE.Mesh(rbox(10.3, 0.5, 4.5, 0.2), red);
  trim.position.y = 1.4;
  const trim2 = trim.clone();
  trim2.position.y = 7.6;
  // lo sportello del forno è lo schermo
  const door = outlined(new THREE.Mesh(rbox(6.4, 4, 0.4, 0.3), dark), 1.03);
  door.position.set(-1.3, 4.1, 2.05);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 10), new THREE.MeshStandardMaterial({ color: '#dfe7f2', metalness: 0.9, roughness: 0.2 }));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-1.3, 6.4, 2.35);
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 320;
  const screenTex = new THREE.CanvasTexture(cv);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 3.6), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(-1.3, 4.1, 2.27);
  // il pannello con le nove luci (come le piastrelle)
  const panel = new THREE.Mesh(rbox(2.9, 3.2, 0.3, 0.2), dark);
  panel.position.set(3.4, 4.1, 2.05);
  const lights: THREE.MeshStandardMaterial[] = [];
  const lightG = new THREE.SphereGeometry(0.34, 16, 12);
  for (let i = 0; i < NT; i++) {
    const m = glow(SIMON_COLORS[i], 0.15);
    lights.push(m);
    const l = new THREE.Mesh(lightG, m);
    // stessa disposizione delle piastrelle viste da chi gioca (riga 0 in basso)
    l.position.set(3.4 - ((i % 3) - 1) * 0.85, 4.1 + (Math.floor(i / 3) - 1) * 0.9, 2.25);
    g.add(l);
  }
  // occhioni
  const eyes: THREE.Mesh[] = [];
  const whiteG = new THREE.SphereGeometry(0.62, 20, 14);
  const pupilG = new THREE.SphereGeometry(0.3, 14, 10);
  for (const x of [-2.6, 0]) {
    const e = new THREE.Mesh(whiteG, toy('#ffffff'));
    e.scale.z = 0.45;
    e.position.set(x, 7.0, 2.05);
    const p = new THREE.Mesh(pupilG, toy('#1d0f3d'));
    p.position.set(x, 7.0, 2.35);
    p.userData.bx = x;
    eyes.push(p);
    g.add(e, p);
  }
  // cappello da cuoco e antenne
  const hat = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.9, 1.6, 24), cream), 1.03);
  hat.position.set(0, 8.9, 0);
  const puff = outlined(new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), cream), 1.02);
  puff.scale.set(1, 0.7, 1);
  puff.position.set(0, 10.4, 0);
  const bulbs: THREE.MeshStandardMaterial[] = [];
  for (const x of [-4, 4]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), dark);
    ant.position.set(x, 9, 0);
    const bm = glow('#ffd60a', 2);
    bulbs.push(bm);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), bm);
    b.position.set(x, 10.2, 0);
    g.add(ant, b);
  }
  // braccia con le presine
  const arms: THREE.Group[] = [];
  const check = canvasTex(64, 64, (c) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
        c.fillRect(i * 16, j * 16, 16, 16);
      }
  });
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 5.3, 5.6, 0);
    const up = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.4, 14), cream), 1.05);
    up.position.y = -1.7;
    const mitt = outlined(new THREE.Mesh(rbox(1.3, 1.5, 0.8, 0.35), toy('#ffffff', { map: check })), 1.05);
    mitt.position.y = -3.8;
    pivot.add(up, mitt);
    pivot.userData.s = s;
    arms.push(pivot);
    g.add(pivot);
  }
  g.add(ped, cone, body, trim, trim2, door, handle, screen, panel, hat, puff);
  shadowy(g, true, false);
  return { g, lights, eyes, arms, bulbs, cv, screenTex };
}

registerClientMini({
  kind: 'SIMON',
  orbit: { c: [0, 2, 3], r: 30 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#8f4dff" to="#3a0ca3">
      <rect x="16" y="22" width="20" height="20" rx="4" fill="#ff3b3b" {...stroke} />
      <rect x="40" y="22" width="20" height="20" rx="4" fill="#ffd60a" {...stroke} />
      <rect x="64" y="22" width="20" height="20" rx="4" fill="#3a86ff" {...stroke} />
      <rect x="16" y="46" width="20" height="20" rx="4" fill="#7ae031" {...stroke} />
      <rect x="40" y="46" width="20" height="20" rx="4" fill="#ffffff" {...stroke} />
      <rect x="64" y="46" width="20" height="20" rx="4" fill="#ff5fb0" {...stroke} />
      <rect x="16" y="70" width="20" height="14" rx="4" fill="#14c9b5" {...stroke} />
      <rect x="40" y="70" width="20" height="14" rx="4" fill="#ff9f1c" {...stroke} />
      <rect x="64" y="70" width="20" height="14" rx="4" fill="#8f4dff" {...stroke} />
      <path d="M44 52 l8 -8 l-2 10 z" fill="#1d0f3d" />
    </Badge>
  ),
  hint: 'Guarda e ascolta Simon, poi calpesta le piastrelle nello stesso ordine · le passerelle non contano · spazio salta',
  feed: {
    sbagliato: ['{n} ha sbagliato piastrella', 'Simon ha bocciato {n}', '{n} è sprofondato'],
    tempo: ['{n} non ha fatto in tempo', '{n} si è perso a metà'],
    caduto: ['{n} è caduto dalle passerelle'],
  },
  build(world) {
    const g = world.arena;
    S.giro = -1;
    S.seq = [];
    S.go = false;
    S.say = 'SIMON DICE';
    falls.clear();
    holes.length = 0;
    // le nove piastrelle di gelatina
    const slabG = rbox(SIMON.half * 2, 0.7, SIMON.half * 2, 0.3);
    const symG = new THREE.PlaneGeometry(3.1, 3.1);
    const pillarG = new THREE.CylinderGeometry(0.7, 0.25, 7, 12);
    const beamG = new THREE.CylinderGeometry(2.0, 2.3, 10, 24, 1, true);
    const tiles = SIMON_COLORS.map((col, i) => {
      const grp = new THREE.Group();
      const mat = toy(col, { clearcoat: 1, clearcoatRoughness: 0.08, roughness: 0.18, emissive: col, emissiveIntensity: 0.05 });
      const slab = outlined(new THREE.Mesh(slabG, mat), 1.02);
      slab.position.y = -0.35;
      const sym = new THREE.Mesh(symG, new THREE.MeshBasicMaterial({ map: symbolTex(i), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }));
      sym.rotation.x = -Math.PI / 2;
      sym.position.y = 0.012;
      const pillar = new THREE.Mesh(pillarG, toy(new THREE.Color(col).multiplyScalar(0.6).getStyle()));
      pillar.position.y = -4.2;
      const beamM = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const beam = new THREE.Mesh(beamG, beamM);
      beam.position.y = 5;
      beam.visible = false;
      grp.add(slab, sym, pillar, beam);
      const c = simonTile(i);
      grp.position.set(c.x, 0, c.z);
      g.add(shadowy(grp, true, true));
      beam.castShadow = false;
      return { grp, mat, beam, beamM, sym };
    });
    // le passerelle di savoiardi (qui si cammina senza che conti niente)
    const bisM = toy('#ffffff', { map: biscuit(), roughness: 0.65, clearcoat: 0.2 });
    const L = SIMON.edge * 2;
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      const v = k * SIMON.step;
      const a = new THREE.Mesh(rbox(L, 0.5, 1.3, 0.22), bisM);
      a.position.set(0, -0.27, v);
      const b = new THREE.Mesh(rbox(1.3, 0.5, L, 0.22), bisM);
      b.position.set(v, -0.28, 0);
      g.add(shadowy(a, false, true), shadowy(b, false, true));
    }
    // il mare di cioccolata calda, i marshmallow, le tazzine giganti
    const seaGeo = new THREE.PlaneGeometry(320, 320, 48, 48);
    const sea = new THREE.Mesh(seaGeo, toy('#5a2d0c', { roughness: 0.18, clearcoat: 1, emissive: '#2b1405', emissiveIntensity: 0.3 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -16;
    g.add(sea);
    const seaBase = seaGeo.attributes.position.array.slice() as Float32Array;
    const marsh: THREE.Object3D[] = [];
    const mG = new THREE.CylinderGeometry(1.2, 1.2, 1.6, 18);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(mG, toy(i % 3 ? '#fff6f9' : '#ffc8dd', { roughness: 0.9 }));
      const a = (i / 14) * Math.PI * 2;
      const r = 18 + (i % 3) * 6;
      m.position.set(Math.sin(a) * r, -15.6, Math.cos(a) * r);
      m.rotation.set(0.4, i, 0.2);
      m.userData.ph = i;
      marsh.push(m);
      g.add(m);
    }
    for (let i = 0; i < 4; i++) {
      const cup = new THREE.Group();
      const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.9, 3.4, 24, 1, true), toy('#ffffff', { side: THREE.DoubleSide })), 1.03);
      const coffee = new THREE.Mesh(new THREE.CircleGeometry(2.45, 24), toy('#4a2511', { clearcoat: 1 }));
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 1.2;
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.25, 8, 16), toy('#ffffff'));
      ear.position.set(2.6, 0, 0);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.4, 0.4, 28), toy('#ffffff'));
      plate.position.y = -1.8;
      cup.add(body, coffee, ear, plate);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      cup.position.set(Math.sin(a) * 24, -12, Math.cos(a) * 24);
      g.add(shadowy(cup));
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 9; i++) {
      const b = balloon(SIMON_COLORS[i]);
      const a = (i / 9) * Math.PI * 2 + 0.35;
      b.position.set(Math.sin(a) * 16, 3 + (i % 3) * 2.2, Math.cos(a) * 16);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // Simon
    const R = makeSimon();
    R.g.position.set(0, 0, SIMON.robotZ);
    R.g.rotation.y = Math.PI;
    g.add(R.g);
    let screenKey = '';
    const drawScreen = (big: string, small: string, color: string) => {
      const c = R.cv.getContext('2d')!;
      c.fillStyle = '#120a1f';
      c.fillRect(0, 0, 512, 320);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 0; y < 320; y += 8) c.fillRect(0, y, 512, 3);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 40px "Lilita One", "Baloo 2", sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText(small, 256, 54);
      c.font = `900 ${big.length > 8 ? 92 : 130}px "Lilita One", "Baloo 2", sans-serif`;
      c.lineJoin = 'round';
      c.lineWidth = 16;
      c.strokeStyle = '#000000';
      c.strokeText(big, 256, 190);
      c.fillStyle = color;
      c.fillText(big, 256, 186);
      R.screenTex.needsUpdate = true;
    };
    // le buche sotto chi sbaglia
    const holeG = new THREE.CircleGeometry(1.15, 24);
    const holeMeshes: THREE.Mesh[] = [];
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -14;
    sh.right = sh.top = 14;
    const white = new THREE.Color('#ffffff');
    const tmp = new THREE.Color();

    return (f) => {
      const E = f.ext as Ext;
      const now = performance.now();
      if (E && E.giro !== S.giro && E.phase !== 'PAUSE') {
        // giro nuovo (o telefono appena collegato)
        S.giro = E.giro;
        if (E.phase === 'GO') S.go = true;
      }
      // le piastrelle: accese da Simon, lampo bianco quando le calpesto giuste
      let lit = -1;
      tiles.forEach((T, i) => {
        const e = now - S.litAt[i];
        const on = e >= 0 && e < S.litDur[i] ? 1 - (e / S.litDur[i]) * 0.3 : 0;
        if (on > 0) lit = i;
        const fl = Math.max(0, 1 - (now - S.flashAt[i]) / 350);
        const base = E?.phase === 'GO' ? 0.1 : 0.05;
        T.mat.emissiveIntensity = base + on * 1.8 + fl * 1.2;
        tmp.set(SIMON_COLORS[i]);
        if (fl > 0) tmp.lerp(white, fl * 0.6);
        T.mat.emissive.copy(tmp);
        T.beam.visible = on > 0;
        T.beamM.opacity = on * 0.35;
        T.grp.position.y = on * 0.12 - fl * 0.08;
        R.lights[i].emissiveIntensity = 0.15 + on * 3;
      });
      // Simon guarda (e indica) la piastrella accesa
      const look = lit >= 0 ? simonTile(lit) : { x: f.me.x, z: f.me.z };
      // (Simon è girato verso di noi: la x del mondo è al contrario della sua)
      const dx = THREE.MathUtils.clamp(-look.x * 0.03, -0.25, 0.25);
      const blink = Math.sin(f.t * 0.9) > 0.985 ? 0.15 : 1;
      for (const p of R.eyes) {
        p.position.x += (p.userData.bx + dx - p.position.x) * Math.min(1, f.dt * 10);
        p.position.y += (6.88 - p.position.y) * Math.min(1, f.dt * 10);
        p.scale.y = blink;
      }
      R.arms.forEach((a) => {
        const s = a.userData.s as number;
        // braccio dalla parte della piastrella accesa (Simon è girato: la sua destra è la nostra sinistra)
        const point = lit >= 0 && Math.sign(-simonTile(lit).x || 1) === s;
        const want = point ? -1.9 : E?.phase === 'GO' ? -0.5 + Math.sin(f.t * 6 + s) * 0.35 : Math.sin(f.t * 1.5 + s) * 0.12;
        a.rotation.x += (want - a.rotation.x) * Math.min(1, f.dt * 9);
        a.rotation.z = s * (point ? 0.35 : 0.12);
      });
      R.bulbs.forEach((b, i) => (b.emissiveIntensity = Math.floor(f.t * 3 + i) % 2 ? 2.4 : 0.4));
      // lo schermo di Simon
      let big = S.say;
      let small = E ? `GIRO ${E.giro + 1} DI ${SIMON.giri}` : 'SIMON DICE';
      let color = '#ffd60a';
      if (E?.phase === 'GO') {
        const left = Math.max(0, Math.ceil((E.endsAt - f.now) / 1000));
        big = String(left);
        small = 'TOCCA A VOI!';
        color = left <= 3 ? '#ff4d6d' : '#7ae031';
      } else if (E?.phase === 'SHOW' && lit >= 0) {
        big = SIMON_NAMES[lit];
        color = SIMON_COLORS[lit];
      }
      const key = `${big}|${small}|${color}`;
      if (key !== screenKey) {
        screenKey = key;
        drawScreen(big, small, color);
      }
      // buche che si aprono e si richiudono
      while (holeMeshes.length < holes.length) {
        const m = new THREE.Mesh(holeG, new THREE.MeshBasicMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
        m.rotation.x = -Math.PI / 2;
        g.add(m);
        holeMeshes.push(m);
      }
      for (let i = holes.length - 1; i >= 0; i--) {
        const h = holes[i];
        const e = (now - h.at) / 1000;
        if (e > 2.2) {
          holes.splice(i, 1);
          continue;
        }
      }
      holeMeshes.forEach((m, i) => {
        const h = holes[i];
        m.visible = !!h;
        if (!h) return;
        const e = (now - h.at) / 1000;
        m.position.set(h.x, 0.03, h.z);
        m.scale.setScalar(e < 0.15 ? e / 0.15 : e > 1.7 ? Math.max(0.01, 1 - (e - 1.7) / 0.5) : 1);
      });
      const pos = seaGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) pos[i + 2] = seaBase[i + 2] + Math.sin(seaBase[i] * 0.07 + f.t * 1.1) * 0.6 + Math.cos(seaBase[i + 1] * 0.08 + f.t) * 0.45;
      seaGeo.attributes.position.needsUpdate = true;
      for (const m of marsh) m.position.y = -15.6 + Math.sin(f.t * 1.3 + m.userData.ph) * 0.3;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  // chi sbaglia sprofonda nella buca (lo faccio vedere cadere anche se è già fuori)
  decorate(av, id, f) {
    const F = falls.get(id);
    if (!F) return;
    const e = (performance.now() - F.at) / 1000;
    if (e > 1.6 || f.view.stage === 'INTRO') {
      if (e > 4) falls.delete(id);
      return;
    }
    av.root.visible = true;
    av.root.position.set(F.x, -0.5 * 22 * e * e, F.z);
    av.label.visible = false;
    av.body.rotation.z = e * 5;
    av.legL.rotation.x = Math.sin(f.t * 22) * 0.9;
    av.legR.rotation.x = -Math.sin(f.t * 22) * 0.9;
    av.armL.rotation.x = -2.8 + Math.sin(f.t * 18);
    av.armR.rotation.x = -2.8 - Math.sin(f.t * 18);
  },
  // i miei passi si sentono subito (il server conferma un attimo dopo)
  local(f) {
    const E = f.ext as Ext;
    if (!E || !S.go || E.phase !== 'GO' || f.view.stage !== 'PLAY' || !f.view.alive[f.myId] || S.myWrong) return;
    if (Math.abs(f.me.y) > 0.25) return;
    const t = simonTileAt(f.me.x, f.me.z);
    if (t < 0 || t === S.myLast) return;
    S.myLast = t;
    if (S.myProg >= E.len || S.seq.length < E.len) return; // finito, o la sequenza non l'ho vista tutta: decide il server
    if (t === S.seq[S.myProg]) {
      S.myProg++;
      S.flashAt[t] = performance.now();
      note(t, 0.14, 0.4);
      if (S.myProg >= E.len) {
        soundManager.playSuccess();
        haptic([30, 30, 30]);
      }
    } else {
      S.myWrong = true;
      soundManager.playError();
      haptic(120);
    }
  },
  status(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const prog = Math.max(S.myProg, E.prog[h.myId] ?? 0);
    if (E.phase === 'SHOW') return { text: 'GUARDA E ASCOLTA SIMON!', cls: 'sc-purple' };
    if (E.phase === 'GO') {
      if (E.done.includes(h.myId) || prog >= E.len) return { text: 'FATTO! ASPETTA GLI ALTRI', cls: 'sc-green' };
      return { text: `TOCCA A TE! ${prog}/${E.len}`, cls: 'sc-yellow pulse-soft' };
    }
    return { text: 'BRAVO! ORA UN COLORE IN PIÙ', cls: 'sc-dark' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    if (!E || h.view.stage !== 'PLAY') return null;
    const prog = Math.max(S.myProg, E.prog[h.myId] ?? 0);
    const left = E.phase === 'GO' ? Math.max(0, E.endsAt - h.now) : 0;
    const total = SIMON.perStep * E.len + SIMON.extra;
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[64px] flex flex-col items-center gap-1.5">
        <p className="sc-chip px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white">{`Giro ${E.giro + 1} di ${SIMON.giri} · ${E.len} colori`}</p>
        {h.alive && (
          <div className="flex max-w-[86vw] flex-wrap justify-center gap-1">
            {Array.from({ length: E.len }, (_, k) => (
              <span
                key={k}
                className={`h-5 w-5 rounded-md border-[3px] border-[#1d0f3d] ${k === prog && E.phase === 'GO' ? 'scale-125 animate-pulse bg-white' : k < prog ? '' : 'bg-white/30'}`}
                style={k < prog && S.seq[k] !== undefined ? { background: SIMON_COLORS[S.seq[k]] } : k < prog ? { background: '#7ae031' } : undefined}
              />
            ))}
          </div>
        )}
        {E.phase === 'GO' && (
          <div className="h-2.5 w-[min(70vw,360px)] overflow-hidden rounded-full border-2 border-[#1d0f3d] bg-[#1d0f3d]/60">
            <div className={`h-full ${left < 3000 ? 'bg-rose-500' : 'bg-lime-400'}`} style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
          </div>
        )}
      </div>
    );
  },
  fx(p, c) {
    const now = performance.now();
    if (p.k === 'simon_show') {
      S.giro = p.giro;
      S.seq = [];
      S.go = false;
      S.myProg = 0;
      S.myLast = -1;
      S.myWrong = false;
      say('GUARDA!');
      if (p.giro > 0) soundManager.playWhoosh();
    } else if (p.k === 'simon_lit') {
      S.seq[p.n] = p.i;
      S.litAt[p.i] = now;
      S.litDur[p.i] = Number(p.d) || 500;
      S.lastLit = p.i;
      note(p.i, 0.15, (Number(p.d) || 500) / 1000);
      const t = simonTile(p.i);
      ringPulse(c.world, t.x, 0, t.z, SIMON_COLORS[p.i]);
    } else if (p.k === 'simon_go') {
      S.go = true;
      S.myProg = 0;
      S.myWrong = false;
      say('TOCCA A VOI!');
      soundManager.playStart();
      // chi è già sulla prima piastrella giusta ha già fatto il primo passo
      const t = Math.abs(c.me.y) < 0.25 ? simonTileAt(c.me.x, c.me.z) : -1;
      S.myLast = t;
      if (t >= 0 && t === S.seq[0] && c.view.alive[c.myId]) {
        S.myProg = 1;
        S.flashAt[t] = now;
        note(t, 0.14, 0.4);
      }
    } else if (p.k === 'simon_ok') {
      const t = simonTile(p.i);
      if (p.id === c.myId) {
        if (p.n > S.myProg) {
          // non l'avevo previsto (sequenza persa?): suono adesso
          S.myProg = p.n;
          S.flashAt[p.i] = now;
          note(p.i, 0.14, 0.4);
        }
      } else {
        const at = c.where(p.id);
        ringPulse(c.world, at?.x ?? t.x, 0, at?.z ?? t.z, SIMON_COLORS[p.i]);
      }
    } else if (p.k === 'simon_done') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y, at.z, 'FATTO!', '#7ae031', { scale: 0.9 });
    } else if (p.k === 'simon_wrong') {
      const col = SIMON_COLORS[p.i] ?? '#ffffff';
      holes.push({ x: p.x, z: p.z, at: now, color: col });
      falls.set(p.id, { x: p.x, z: p.z, at: now });
      burst(c.world, p.x, 0.2, p.z, [col, col, '#1d0f3d', '#ffffff'], 40, 6);
      popText(c.world, p.x, 0.3, p.z, 'SBAGLIATO!', '#ff4d6d', { scale: 1.1 });
      const d = Math.hypot(c.me.x - p.x, c.me.z - p.z);
      if (p.id === c.myId) {
        soundManager.playFall();
        c.shake(0.6);
      } else {
        soundManager.playBoom();
        c.shake(d < 6 ? 0.4 : 0.15);
      }
    } else if (p.k === 'out' && p.reason === 'tempo') {
      // tempo scaduto: la piastrella si apre anche sotto chi è rimasto indietro
      const at = c.where(p.id);
      if (at) {
        holes.push({ x: at.x, z: at.z, at: now, color: '#ffffff' });
        falls.set(p.id, { x: at.x, z: at.z, at: now });
      }
    } else if (p.k === 'simon_round') {
      say(p.ok > 0 ? 'BRAVI!' : 'OPS!');
      for (let i = 0; i < NT; i++) {
        const t = simonTile(i);
        burst(c.world, t.x, 0.3, t.z, [SIMON_COLORS[i], '#ffffff'], 10, 3);
      }
      if (c.view.alive[c.myId]) soundManager.playSuccess();
    }
  },
});
