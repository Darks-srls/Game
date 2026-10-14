// 🍅 Sale il sugo (telefono): pentolone gigante con la spirale di pane, formaggi, lasagne, cucchiai, mestoli e molle,
// il mare di sugo che bolle e sale, batticarne e mattarello, e la barra dell'altezza (tu contro il sugo)
import * as THREE from 'three';
import { SUGO, SUGO_PLATS, sugoAngle, sugoLevel, sugoPend, sugoPlatAt, sugoSweepAngle, type SugoPlat } from '../../../data/minis/sugo';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, dust, glow, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

// stato condiviso tra mondo, HUD ed effetti (il minigioco è uno alla volta)
let lastBoing = 0;
let lastTick = 0;
let leader: string | null = null; // chi è più in alto (cappello da chef)
const squash = new Float32Array(SUGO_PLATS.length); // molle schiacciate (si rilasciano da sole)

const rnd = (seed: number) => {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
};

// ---------------------------------------------------------------- texture (piccole, disegnate una volta)

const breadTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#f6dfa8';
    c.fillRect(0, 0, 256, 256);
    const r = rnd(3);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(196,150,80,0.55)' : 'rgba(255,245,215,0.7)';
      c.beginPath();
      c.ellipse(r() * 256, r() * 256, 2 + r() * 6, 1.5 + r() * 4, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = '#c8853f';
    c.lineWidth = 18;
    c.strokeRect(0, 0, 256, 256);
  });
const cheeseTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#ffd23f';
    c.fillRect(0, 0, 256, 256);
    const r = rnd(11);
    for (let i = 0; i < 22; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rr = 8 + r() * 18;
      c.fillStyle = '#e8a90c';
      c.beginPath();
      c.arc(x, y, rr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f5bd1f';
      c.beginPath();
      c.arc(x + 2, y + 2, rr * 0.75, 0, Math.PI * 2);
      c.fill();
    }
  });
const lasagnaTex = () =>
  canvasTex(512, 128, (c) => {
    c.fillStyle = '#ffd77a';
    c.fillRect(0, 0, 512, 128);
    // bordi ondulati della sfoglia
    c.fillStyle = '#f2b84b';
    for (const y of [0, 128]) {
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= 512; x += 16) c.lineTo(x, y + (y ? -1 : 1) * (8 + Math.sin(x * 0.2) * 6));
      c.lineTo(512, y);
      c.fill();
    }
    const r = rnd(5);
    for (let i = 0; i < 30; i++) {
      c.fillStyle = r() < 0.6 ? '#d63a2a' : '#fff4dc';
      c.beginPath();
      c.ellipse(r() * 512, 20 + r() * 88, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
const layersTex = () =>
  canvasTex(64, 64, (c) => {
    const cols = ['#ffd77a', '#c8321f', '#fff1d0', '#ffd77a', '#c8321f', '#fff1d0', '#ffd77a'];
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, (i * 64) / cols.length, 64, 64 / cols.length + 1);
    });
  });
const woodTex = () =>
  canvasTex(
    256,
    64,
    (c) => {
      c.fillStyle = '#c98b4e';
      c.fillRect(0, 0, 256, 64);
      c.strokeStyle = 'rgba(120,70,30,0.45)';
      c.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        for (let x = 0; x <= 256; x += 8) c.lineTo(x, 4 + i * 7 + Math.sin(x * 0.05 + i) * 2.5);
        c.stroke();
      }
    },
    [1, 1],
  );
const potTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#e63946';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#fff4e6';
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          c.beginPath();
          c.arc(32 + i * 64 + (j % 2) * 32, 32 + j * 64, 13, 0, Math.PI * 2);
          c.fill();
        }
    },
    [10, 9],
  );
const sauceTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      c.fillStyle = '#c4231b';
      c.fillRect(0, 0, 256, 256);
      const r = rnd(9);
      for (let i = 0; i < 26; i++) {
        c.strokeStyle = r() < 0.5 ? 'rgba(120,10,10,0.5)' : 'rgba(255,110,80,0.45)';
        c.lineWidth = 3 + r() * 6;
        c.beginPath();
        const x = r() * 256;
        const y = r() * 256;
        c.arc(x, y, 10 + r() * 40, r() * 6, r() * 6 + 2.5);
        c.stroke();
      }
      // goccioline d'olio
      for (let i = 0; i < 40; i++) {
        c.fillStyle = 'rgba(255,200,90,0.55)';
        c.beginPath();
        c.arc(r() * 256, r() * 256, 1.5 + r() * 4, 0, Math.PI * 2);
        c.fill();
      }
    },
    [14, 14],
  );
const focacciaTex = () =>
  canvasTex(512, 512, (c) => {
    c.fillStyle = '#e9b85e';
    c.fillRect(0, 0, 512, 512);
    const r = rnd(21);
    for (let i = 0; i < 140; i++) {
      const x = r() * 512;
      const y = r() * 512;
      c.fillStyle = 'rgba(176,112,40,0.55)';
      c.beginPath();
      c.arc(x, y, 6 + r() * 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,236,170,0.6)';
      c.beginPath();
      c.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
      c.fill();
    }
    // rosmarino e sale grosso
    for (let i = 0; i < 70; i++) {
      c.save();
      c.translate(r() * 512, r() * 512);
      c.rotate(r() * 6);
      c.fillStyle = '#3f7d3a';
      c.fillRect(-7, -1.5, 14, 3);
      c.restore();
      c.fillStyle = '#ffffff';
      c.fillRect(r() * 512, r() * 512, 3, 3);
    }
  });
const pizzaTex = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = '#f0b866';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#d63a2a';
    c.beginPath();
    c.arc(128, 128, 112, 0, Math.PI * 2);
    c.fill();
    const r = rnd(4);
    for (let i = 0; i < 16; i++) {
      c.fillStyle = '#fff1c4';
      c.beginPath();
      c.arc(128 + (r() - 0.5) * 170, 128 + (r() - 0.5) * 170, 10 + r() * 10, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 8; i++) {
      c.fillStyle = '#2d8a3e';
      c.beginPath();
      c.ellipse(128 + (r() - 0.5) * 160, 128 + (r() - 0.5) * 160, 10, 5, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });

// ---------------------------------------------------------------- pezzi

// una piattaforma (a quota 0 nel suo gruppo, x = lungo il giro, z = verso fuori)
function platMesh(p: SugoPlat, M: Record<string, THREE.Material>) {
  const g = new THREE.Group();
  if (p.k === 'pane') {
    const m = outlined(new THREE.Mesh(rbox(p.hl * 2, 0.6, p.hw * 2, 0.22), [M.crust, M.crust, M.bread, M.crust, M.crust, M.crust]), 1.03);
    m.position.y = -0.3;
    g.add(m);
  } else if (p.k === 'formaggio') {
    const m = outlined(new THREE.Mesh(rbox(p.hl * 2, 0.8, p.hw * 2, 0.12), M.cheese), 1.03);
    m.position.y = -0.4;
    g.add(m);
    if (p.amp) {
      // tenuto su da due palloncini (si muove avanti e indietro)
      for (const sx of [-1, 1]) {
        const b = balloon(sx < 0 ? '#ff4d6d' : '#06d6a0');
        b.position.set(sx * (p.hl - 0.4), 3.4, 0);
        b.scale.setScalar(0.8);
        g.add(b);
      }
    }
  } else if (p.k === 'lasagna') {
    const m = outlined(new THREE.Mesh(rbox(p.hl * 2, 0.75, p.hw * 2, 0.1), [M.layers, M.layers, M.lasagna, M.pasta, M.layers, M.layers]), 1.02);
    m.position.y = -0.375;
    g.add(m);
  } else if (p.k === 'cucchiaio') {
    // cucchiaio di legno piantato nel pentolone: manico + paletta tonda in fondo
    const handle = outlined(new THREE.Mesh(rbox(p.hl * 2, 0.4, p.hw * 2 - 0.6, 0.18), M.wood), 1.04);
    handle.position.set(0, -0.2, -0.3);
    const bowl = outlined(new THREE.Mesh(new THREE.CylinderGeometry(p.hl + 0.25, p.hl + 0.1, 0.42, 24), M.wood), 1.04);
    bowl.scale.z = 1.25;
    bowl.position.set(0, -0.21, p.hw - (p.hl + 0.25) * 1.25);
    g.add(handle, bowl);
  } else if (p.k === 'mestolo') {
    // mestolo d'acciaio pieno di sugo, appeso al bordo con il manico
    const bowl = outlined(new THREE.Mesh(new THREE.SphereGeometry(p.disc, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.steel), 1.03);
    bowl.scale.y = 0.45;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(p.disc, 0.1, 8, 32), M.steel);
    rim.rotation.x = Math.PI / 2;
    const top = new THREE.Mesh(new THREE.CircleGeometry(p.disc - 0.05, 32), M.sauce);
    top.rotation.x = -Math.PI / 2;
    top.position.y = -0.02;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), M.steel);
    const inward = p.rho - p.disc - SUGO.potR;
    arm.scale.y = Math.hypot(inward + 0.2, 2.6);
    arm.position.set(0, 1.3, -p.disc - inward / 2);
    arm.rotation.x = -Math.atan2(inward + 0.2, 2.6);
    g.add(bowl, rim, top, arm);
  } else if (p.k === 'molla') {
    // molla di spaghetti con il cuscinetto (polpetta schiacciata)
    const pad = outlined(new THREE.Mesh(new THREE.CylinderGeometry(p.disc, p.disc * 0.92, 0.36, 28), M.pad), 1.04);
    pad.position.y = -0.18;
    pad.name = 'pad';
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2 * 5;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.62, -0.4 - (i / 80) * 2.2, Math.sin(a) * 0.62));
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.11, 6), M.spaghetto);
    coil.name = 'coil';
    const cup = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.55, 0.5, 18), M.steel), 1.05);
    cup.position.y = -2.85;
    const arm = new THREE.Mesh(rbox(0.3, 0.3, p.rho - SUGO.potR, 0.1), M.steel);
    arm.position.set(0, -2.9, -(p.rho - SUGO.potR) / 2);
    g.add(pad, coil, cup, arm);
  } else if (p.k === 'pizza') {
    const m = outlined(new THREE.Mesh(new THREE.CylinderGeometry(p.disc, p.disc, 0.5, 40), [M.crust, M.pizza, M.crust]), 1.03);
    m.position.y = -0.25;
    m.name = 'disc';
    const crust = new THREE.Mesh(new THREE.TorusGeometry(p.disc, 0.2, 10, 48), M.crust);
    crust.rotation.x = Math.PI / 2;
    crust.position.y = -0.04;
    m.add(crust);
    // braccio di sotto fino al pentolone
    const arm = new THREE.Mesh(rbox(0.5, 0.5, p.rho - SUGO.potR, 0.15), M.steel);
    arm.position.set(0, -0.9, -(p.rho - SUGO.potR) / 2);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 10), M.steel);
    pin.position.y = -0.6;
    g.add(m, arm, pin);
  }
  return g;
}

// batticarne a pendolo (perno sopra la lasagna, braccio dal pentolone)
function makePendulum(p: SugoPlat, M: Record<string, THREE.Material>) {
  const outer = new THREE.Group();
  outer.position.set(p.cx, p.y + SUGO.pendY, p.cz);
  outer.rotation.y = p.th;
  const bracket = new THREE.Mesh(rbox(0.5, 0.5, p.rho - SUGO.potR + 0.4, 0.15), M.steel);
  bracket.position.z = -(p.rho - SUGO.potR) / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), M.red);
  hub.rotation.x = Math.PI / 2;
  outer.add(bracket, hub);
  const swing = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, SUGO.pendArm, 10), M.wood);
  stick.position.y = -SUGO.pendArm / 2;
  const head = outlined(new THREE.Mesh(rbox(1.0, 1.0, 3.0, 0.12), M.mallet), 1.04);
  head.position.y = -SUGO.pendArm;
  swing.add(stick, head);
  outer.add(swing);
  return { outer, swing };
}

// mattarello che gira sulla pizza (con il macinapepe in mezzo)
function makeSweeper(p: SugoPlat, M: Record<string, THREE.Material>) {
  const g = new THREE.Group();
  g.position.set(p.cx, p.y, p.cz);
  const mill = outlined(new THREE.Mesh(new THREE.CylinderGeometry(SUGO.postR, SUGO.postR + 0.1, 1.6, 16), M.wood), 1.05);
  mill.position.y = 0.8;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10), M.red);
  knob.position.y = 1.75;
  const bar = new THREE.Group();
  bar.position.y = SUGO.sweepH;
  const pin = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, SUGO.sweepR * 2, 16), M.wood), 1.06);
  pin.rotation.x = Math.PI / 2;
  bar.add(pin);
  for (const e of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), M.red);
    h.rotation.x = Math.PI / 2;
    h.position.z = e * (SUGO.sweepR + 0.3);
    bar.add(h);
  }
  g.add(mill, knob, bar);
  return { g, bar };
}

// cappello da chef (per chi è più in alto)
function chefHat() {
  const g = new THREE.Group();
  const white = toy('#ffffff');
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 20), white);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), white);
  puff.scale.y = 0.75;
  puff.position.y = 0.4;
  g.add(band, puff);
  g.name = 'sugo-hat';
  return g;
}

registerClientMini({
  kind: 'SUGO',
  orbit: { c: [0, 19, 0], r: 46 },
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffb3a7" to="#d62828">
      <path d="M30 30 L70 30 L66 84 L34 84 Z" fill="#e9ecef" {...stroke} />
      <path d="M32 60 L68 60 L66 84 L34 84 Z" fill="#e63946" />
      <circle cx="44" cy="70" r="3.5" fill="#ff8a7a" />
      <circle cx="57" cy="76" r="2.5" fill="#ff8a7a" />
      <path d="M26 30 L74 30" {...stroke} />
      <path d="M50 52 L50 18 M40 28 L50 16 L60 28" fill="none" {...stroke} stroke="#ffffff" strokeWidth={6} />
      <path d="M78 22 q6 -6 0 -12 M84 30 q6 -6 0 -12" fill="none" {...stroke} stroke="#ffffff" strokeWidth={3} />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (2 volte = doppio) · Shift scatto/tuffo · E schiaffo · sali fino al coperchio prima del sugo!',
  feed: {
    sugo: ['{n} è finito nel sugo', '{n} è diventato ragù', 'il sugo si è preso {n}', '{n} fa la scarpetta', '{n} bolle in pentola'],
  },
  build(world) {
    const g = world.arena;
    const M: Record<string, THREE.Material> = {
      bread: toy('#ffffff', { map: breadTex(), roughness: 0.8, clearcoat: 0.1 }),
      crust: toy('#c8853f', { roughness: 0.7 }),
      cheese: toy('#ffffff', { map: cheeseTex(), roughness: 0.5 }),
      lasagna: toy('#ffffff', { map: lasagnaTex(), roughness: 0.55 }),
      layers: toy('#ffffff', { map: layersTex(), roughness: 0.6 }),
      pasta: toy('#f2b84b'),
      wood: toy('#ffffff', { map: woodTex(), roughness: 0.65 }),
      steel: new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.75, roughness: 0.28 }),
      sauce: toy('#d1271d', { roughness: 0.15, clearcoat: 1, emissive: '#5a0900', emissiveIntensity: 0.3 }),
      pad: toy('#7a3b1d', { roughness: 0.6 }),
      spaghetto: toy('#ffd166', { roughness: 0.45 }),
      pizza: toy('#ffffff', { map: pizzaTex(), roughness: 0.6 }),
      red: toy('#e63946'),
      mallet: new THREE.MeshStandardMaterial({ color: '#b8c0c8', metalness: 0.8, roughness: 0.3 }),
    };
    // l'ombra deve coprire tutta la torre: la segue il sole (vedi sotto)
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -19;
    sh.right = sh.top = 19;

    // il pentolone (smaltato a pois) con le fasce d'acciaio, il bordo e il coperchio
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(SUGO.potR, SUGO.potR, SUGO.top + 6, 64, 1, true), toy('#ffffff', { map: potTex(), clearcoat: 0.8, clearcoatRoughness: 0.15, roughness: 0.3 }));
    pot.position.y = (SUGO.top - 6) / 2;
    pot.receiveShadow = true;
    g.add(pot);
    world.camBlockers.push(pot);
    for (const y of [10, 20, 30]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(SUGO.potR + 0.02, 0.16, 8, 72), M.steel);
      band.rotation.x = Math.PI / 2;
      band.position.y = y - 1.5;
      g.add(band);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(SUGO.potR + 0.05, 0.38, 12, 80), M.steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = SUGO.top - 0.45;
    g.add(rim);
    const lid = outlined(new THREE.Mesh(new THREE.CylinderGeometry(SUGO.lidR, SUGO.lidR + 0.15, 0.5, 64), [M.steel, toy('#ffffff', { map: lidTex(), metalness: 0.5, roughness: 0.3 }), M.steel]), 1.01);
    lid.position.y = SUGO.top - 0.25;
    const knobStem = new THREE.Mesh(new THREE.CylinderGeometry(SUGO.knobR * 0.55, SUGO.knobR * 0.7, SUGO.knobH * 0.6, 20), M.steel);
    knobStem.position.y = SUGO.top + SUGO.knobH * 0.3;
    const knob = outlined(new THREE.Mesh(new THREE.SphereGeometry(SUGO.knobR, 24, 16), M.red), 1.04);
    knob.scale.y = 0.6;
    knob.position.y = SUGO.top + SUGO.knobH * 0.75;
    g.add(shadowy(lid), knobStem, shadowy(knob));
    world.camBlockers.push(lid);
    // bandierine a scacchi sul coperchio (il traguardo)
    const check = canvasTex(64, 64, (c) => {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          c.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
          c.fillRect(i * 16, j * 16, 16, 16);
        }
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), M.steel);
      pole.position.set(Math.sin(a) * (SUGO.lidR - 0.5), SUGO.top + 1.5, Math.cos(a) * (SUGO.lidR - 0.5));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: check, side: THREE.DoubleSide }));
      flag.position.set(pole.position.x + Math.cos(a) * 0.6, SUGO.top + 2.6, pole.position.z - Math.sin(a) * 0.6);
      flag.rotation.y = a + Math.PI / 2;
      flag.userData.a = a;
      g.add(pole, flag);
    }
    const lights: THREE.Mesh[] = [];
    const bulbM = [glow('#fff3b0', 1.6), glow('#ff4d6d', 1.6)];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bulbM[i % 2]);
      b.position.set(Math.sin(a) * (SUGO.lidR + 0.05), SUGO.top + 0.05, Math.cos(a) * (SUGO.lidR + 0.05));
      lights.push(b);
      g.add(b);
    }

    // la focaccia di partenza, con i grissini sotto
    const foc = outlined(new THREE.Mesh(new THREE.CylinderGeometry(SUGO.baseR, SUGO.baseR - 0.3, 1.2, 72), [M.crust, toy('#ffffff', { map: focacciaTex(), roughness: 0.75 }), M.crust]), 1.01);
    foc.position.y = -0.6;
    g.add(shadowy(foc));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 10), M.crust);
      stick.position.set(Math.sin(a) * (SUGO.baseR - 2), -7.5, Math.cos(a) * (SUGO.baseR - 2));
      g.add(stick);
    }

    // il percorso
    const plats: { p: SugoPlat; o: THREE.Group; pad?: THREE.Object3D; coil?: THREE.Object3D; disc?: THREE.Object3D }[] = [];
    for (const p of SUGO_PLATS) {
      const o = platMesh(p, M);
      o.position.set(p.cx, p.y, p.cz);
      o.rotation.y = p.th;
      g.add(shadowy(o));
      plats.push({ p, o, pad: o.getObjectByName('pad'), coil: o.getObjectByName('coil'), disc: o.getObjectByName('disc') });
      // la telecamera non passa dietro le piattaforme (il primo pezzo è quello grosso)
      if (o.children[0]) world.camBlockers.push(o.children[0]);
    }
    const moving = plats.filter((q) => q.p.amp || q.p.spin);
    const springs = plats.filter((q) => q.p.k === 'molla');
    const pends = SUGO_PLATS.filter((p) => p.pend).map((p) => ({ p, ...makePendulum(p, M) }));
    for (const q of pends) g.add(shadowy(q.outer));
    const sweeps = SUGO_PLATS.filter((p) => p.sweep).map((p) => ({ p, ...makeSweeper(p, M) }));
    for (const q of sweeps) g.add(shadowy(q.g));

    // il mare di sugo che sale (con bolle, vapore e roba che galleggia)
    const sauceMap = (M.sauce as THREE.MeshPhysicalMaterial).clone();
    sauceMap.map = sauceTex();
    sauceMap.color.set('#ffffff');
    const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 72), sauceMap);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = true;
    g.add(sea);
    const NB = 40;
    const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toy('#e0392b', { roughness: 0.2, clearcoat: 1 }), NB);
    const bub = Array.from({ length: NB }, () => ({ x: 0, z: 0, t0: -9, life: 1, r: 0.5 }));
    const tmp = new THREE.Object3D();
    g.add(bubbles);
    const floaters: THREE.Object3D[] = [];
    const R = rnd(77);
    for (let i = 0; i < 12; i++) {
      let o: THREE.Object3D;
      if (i % 3 === 0) {
        o = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), toy('#7a3b1d', { roughness: 0.8 })), 1.04); // polpetta
      } else if (i % 3 === 1) {
        o = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8), toy('#2d8a3e')); // foglia di basilico
        o.scale.set(1.6, 0.12, 0.8);
      } else {
        o = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), toy('#e63946')), 1.04); // mezzo pomodoro
      }
      const a = R() * Math.PI * 2;
      const r = 20 + R() * 40;
      o.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      o.userData.ph = R() * 6;
      o.userData.spin = (R() - 0.5) * 0.3;
      floaters.push(o);
      g.add(o);
    }
    // il mestolone gigante che gira il sugo laggiù
    const stir = new THREE.Group();
    const spoonStick = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 40, 12), M.wood);
    spoonStick.position.y = 14;
    spoonStick.rotation.z = 0.35;
    stir.add(spoonStick);
    g.add(stir);
    // vapore che sale dal sugo
    const steamTex = canvasTex(64, 64, (c) => {
      const gr = c.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 64, 64);
    });
    const steam: THREE.Sprite[] = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      sp.userData.t0 = -R() * 4;
      sp.userData.a = R() * Math.PI * 2;
      sp.userData.r = 9 + R() * 14;
      steam.push(sp);
      g.add(sp);
    }
    // palloncini in alto
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 10; i++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff', '#ff70a6'][i % 5]);
      const a = (i / 10) * Math.PI * 2;
      b.position.set(Math.sin(a) * 19, 8 + (i % 4) * 9, Math.cos(a) * 19);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    const sunOff = new THREE.Vector3(20, 34, 26);
    let bubbleAt = 0;

    return (f) => {
      const t = f.playT;
      const lvl = sugoLevel(t);
      // l'ombra segue chi gioca su per la torre
      const ty = Math.max(0, Math.min(SUGO.top, f.me.y));
      world.sun.target.position.set(0, ty, 0);
      world.sun.position.copy(world.sun.target.position).add(sunOff);
      // piattaforme che scorrono e pizza che gira
      for (const q of moving) {
        if (q.p.amp) {
          const a = sugoAngle(q.p, t);
          q.o.position.set(Math.sin(a) * q.p.rho, q.p.y, Math.cos(a) * q.p.rho);
          q.o.rotation.y = a;
        } else if (q.disc) q.disc.rotation.y = q.p.spin * t;
      }
      for (const q of pends) q.swing.rotation.z = sugoPend(q.p, t).a;
      for (const q of sweeps) q.bar.rotation.y = sugoSweepAngle(q.p, t);
      // molle: si schiacciano quando qualcuno ci atterra
      for (const q of springs) {
        const i = q.p.i;
        let on = false;
        const test = (o: { x: number; y: number; z: number }) => {
          if (Math.abs(o.y - q.p.y) < 0.35 && Math.hypot(o.x - q.p.cx, o.z - q.p.cz) < q.p.disc) on = true;
        };
        test(f.me);
        for (const o of f.others.values()) test(o);
        if (on) squash[i] = 1;
        squash[i] = Math.max(0, squash[i] - f.dt * 4);
        const k = Math.sin(squash[i] * Math.PI) * 0.45;
        if (q.pad) q.pad.position.y = -0.18 - k;
        if (q.coil) q.coil.scale.y = 1 - k * 0.35;
      }
      // il sugo
      sea.position.y = lvl + Math.sin(f.t * 1.3) * 0.05;
      if (sauceMap.map) {
        sauceMap.map.offset.x = f.t * 0.006;
        sauceMap.map.offset.y = Math.sin(f.t * 0.2) * 0.02;
      }
      if (f.t - bubbleAt > 0.08) {
        bubbleAt = f.t;
        const b = bub[Math.floor(Math.random() * NB)];
        if (f.t - b.t0 > b.life) {
          const a = Math.random() * Math.PI * 2;
          const r = SUGO.potR + 1 + Math.random() * 26;
          Object.assign(b, { x: Math.sin(a) * r, z: Math.cos(a) * r, t0: f.t, life: 0.8 + Math.random() * 1.2, r: 0.3 + Math.random() * 0.8 });
        }
      }
      for (let i = 0; i < NB; i++) {
        const b = bub[i];
        const k = (f.t - b.t0) / b.life;
        const s = k >= 0 && k < 1 ? b.r * Math.sin(k * Math.PI * 0.95) : 0;
        tmp.position.set(b.x, lvl - 0.05, b.z);
        tmp.scale.set(s, s * 0.8, s);
        tmp.updateMatrix();
        bubbles.setMatrixAt(i, tmp.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;
      for (const o of floaters) {
        o.position.y = lvl + 0.1 + Math.sin(f.t * 1.1 + o.userData.ph) * 0.25;
        o.rotation.y += o.userData.spin * f.dt;
      }
      stir.position.set(Math.sin(f.t * 0.25) * 40, lvl, Math.cos(f.t * 0.25) * 40);
      stir.rotation.y = -f.t * 0.25;
      for (const sp of steam) {
        const k = ((f.t - sp.userData.t0) % 4) / 4;
        sp.position.set(Math.sin(sp.userData.a + k) * sp.userData.r, lvl + k * 7, Math.cos(sp.userData.a + k) * sp.userData.r);
        sp.scale.setScalar(2 + k * 5);
        (sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.45;
      }
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.7;
      lights.forEach((b, i) => b.scale.setScalar(Math.sin(f.t * 6 + i * 0.8) > 0 ? 1.25 : 0.8));
      // chi è più in alto (per il cappello da chef)
      let best = -99;
      leader = null;
      if (f.view.stage === 'PLAY') {
        if (f.view.alive[f.myId] && f.me.y > best) {
          best = f.me.y;
          leader = f.myId;
        }
        for (const [id, o] of f.others) {
          if (f.view.alive[id] && o.y > best) {
            best = o.y;
            leader = id;
          }
        }
      }
    };
  },
  // le molle lanciano il mio personaggio subito (il server lancia solo i bot); un tic se il sugo è vicino
  local(f) {
    if (f.view.stage !== 'PLAY' || !f.view.alive[f.myId]) return;
    const me = f.me;
    if (me.ground) {
      const i = sugoPlatAt(me.x, me.z, f.playT, me.y);
      if (i >= 0 && SUGO_PLATS[i].k === 'molla') {
        me.vy = SUGO.springV;
        me.ground = false;
        me.airJumps = 0;
        squash[i] = 1;
        if (Date.now() - lastBoing > 300) {
          lastBoing = Date.now();
          soundManager.playJump();
        }
      }
    }
    const gap = me.y - sugoLevel(f.playT);
    if (gap < 2.5 && !f.view.finished.includes(f.myId) && Date.now() - lastTick > 700) {
      lastTick = Date.now();
      soundManager.playTick();
    }
  },
  // cappello da chef a chi è più in alto
  decorate(av, id) {
    const has = av.headDeco.getObjectByName('sugo-hat');
    const want = leader === id;
    if (want && !has) {
      const h = chefHat();
      h.position.y = 0.62;
      av.headDeco.add(h);
    } else if (!want && has) av.headDeco.remove(has);
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    if (h.finished) {
      const n = h.view.finished.indexOf(h.myId) + 1;
      return { text: `IN CIMA! ${n}°`, cls: 'sc-green' };
    }
    const playT = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const gap = h.me.y - sugoLevel(playT);
    if (gap < 3) return { text: 'IL SUGO TI SCOTTA I PIEDI! SALI!', cls: 'sc-red pulse-soft' };
    if (gap < 7) return { text: `IL SUGO SALE: ${Math.floor(gap)} m SOTTO DI TE`, cls: 'sc-yellow' };
    return { text: 'SALI FINO AL COPERCHIO', cls: 'sc-dark' };
  },
  // la barra dell'altezza: io, gli altri e il sugo che sale
  hud(h: HudCtx) {
    if (h.view.stage !== 'PLAY') return null;
    const playT = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const lo = SUGO.start;
    const span = SUGO.top - lo;
    const pct = (y: number) => Math.max(0, Math.min(100, ((y - lo) / span) * 100));
    const lvl = sugoLevel(playT);
    const dots: { id: string; y: number }[] = [];
    for (const [id, o] of h.others) if (h.view.alive[id] && !h.view.finished.includes(id)) dots.push({ id, y: o.y });
    const myY = h.finished ? SUGO.top : h.me.y;
    return (
      <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-stretch gap-1.5">
        <div className="relative h-[min(46vh,300px)] w-6 overflow-hidden rounded-full border-[3px] border-[#1d0f3d] bg-[#1d0f3d]/55">
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-red-800 via-red-600 to-orange-400 transition-[height] duration-300" style={{ height: `${pct(lvl)}%` }} />
          {[10, 20, 30].map((m) => (
            <div key={m} className="absolute inset-x-0 h-[2px] bg-white/35" style={{ bottom: `${pct(m)}%` }} />
          ))}
          {dots.map((d) => (
            <div key={d.id} className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[#1d0f3d]" style={{ bottom: `${pct(d.y)}%`, background: h.colorOf(d.id) }} />
          ))}
          <div className="absolute left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-[3px] border-white shadow" style={{ bottom: `${pct(myY)}%`, background: h.colorOf(h.myId) }} />
        </div>
        <div className="relative h-[min(46vh,300px)] w-12 text-[10px] font-black text-white">
          <span className="sc-stroke-sm absolute left-0 top-0 -translate-y-1/2">40 m</span>
          <span className="sc-chip absolute left-0 translate-y-1/2 whitespace-nowrap !px-1.5 !py-0" style={{ bottom: `${pct(myY)}%` }}>
            TU {Math.max(0, Math.floor(myY))}
          </span>
          <span className="sc-stroke-sm absolute left-0 translate-y-1/2 whitespace-nowrap text-orange-300" style={{ bottom: `${Math.min(92, pct(lvl))}%` }}>
            SUGO
          </span>
        </div>
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'sugo_top') {
      const at = c.where(p.id);
      if (at) {
        popText(c.world, at.x, at.y + 0.4, at.z, p.n === 1 ? 'PRIMO!' : `${p.n}°`, '#ffd60a', { scale: 1.4, life: 1.4 });
        burst(c.world, at.x, at.y + 1.5, at.z, ['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff', '#ffffff'], 60, 8);
      }
      if (p.id === c.myId) {
        soundManager.playSuccess();
        c.feed(`Sei in cima! Arrivato ${p.n}°`);
        c.shake(0.3);
      } else {
        soundManager.playPop();
        c.feed(`${c.nameOf(p.id)} è in cima (${p.n}°)`);
      }
    } else if (p.k === 'sugo_splash') {
      burst(c.world, p.x, p.y + 0.2, p.z, ['#c4231b', '#e63946', '#ff8a7a', '#7a0d0d'], 50, 7);
      ringPulse(c.world, p.x, p.y - 0.8, p.z, '#ff4d6d');
      if (p.id === c.myId) c.shake(0.7);
    } else if (p.k === 'sugo_boing') {
      if (p.i >= 0 && p.i < squash.length) squash[p.i] = 1;
      const q = SUGO_PLATS[p.i];
      if (q) {
        dust(c.world, q.cx, q.y, q.cz, 5);
        const d = Math.hypot(c.me.x - q.cx, c.me.y - q.y, c.me.z - q.cz);
        if (d < 10 && Date.now() - lastBoing > 300) {
          lastBoing = Date.now();
          soundManager.playJump();
        }
      }
    } else if (p.k === 'sugo_whack') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y, at.z, 'TUNK!', '#ffffff', { scale: 1.2 });
      if (p.id === c.myId) c.shake(0.5);
    } else if (p.k === 'out' && p.reason === 'sugo' && p.id === c.myId) {
      c.feed('Sei finito nel sugo!');
    }
  },
});

// il coperchio d'acciaio con i cerchi concentrici
function lidTex() {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = '#c9d1d9';
    c.fillRect(0, 0, 256, 256);
    for (let r = 120; r > 20; r -= 14) {
      c.strokeStyle = r % 28 ? 'rgba(255,255,255,0.55)' : 'rgba(90,100,110,0.35)';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(128, 128, r, 0, Math.PI * 2);
      c.stroke();
    }
  });
}

