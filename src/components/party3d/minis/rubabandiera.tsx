// 🧺 Rubabandiera (telefono): il cortile di paese col selciato, le case coi panni stesi, il campanile, la nonna
// col braccio teso e lo strofinaccio a quadretti, le casacche coi numeri e il numero chiamato in grande
import * as THREE from 'three';
import { NUM_WORDS, RUBA, rubaSlot } from '../../../data/minis/rubabandiera';
import { TEAM_COL, TEAM_NAME } from '../../../data/minis/squadre';
import { soundManager } from '../../../utils/audio';
import { Badge, INK, stroke } from '../icons';
import { burst, canvasTex, flagLine, makeNonna, matte, outlined, popText, rbox, ringPulse, shadowy, toy, type Avatar } from '../scene';
import { TeamScore, teamPill, wearVest } from './squadre';
import { registerClientMini, type MiniFrame } from './types';

type Ext = {
  team: Record<string, number>;
  nums: Record<string, number[]>;
  n: number;
  phase: 'WAIT' | 'CALL' | 'CARRY' | 'POINT';
  at: number;
  until: number;
  called: number[];
  carrier: string | null;
  chasers: string[];
  score: number[];
  pts: Record<string, number>;
  last: { team: number; by: string | null; how: string } | null;
} | null;

const isRunner = (E: NonNullable<Ext>, id: string) => (E.phase === 'CALL' || E.phase === 'CARRY') && (E.nums[id] ?? []).some((k) => E.called.includes(k));
const callWords = (nums: number[]) => nums.map((k) => NUM_WORDS[k] ?? String(k)).join(' E ');

// la nonna (per le scritte: dove sta la sua testa)
const NONNA_TOP = { x: RUBA.nonnaX, y: 3.4, z: 0 };
let bellAt = -9; // il campanile suona quando la nonna chiama

// strofinaccio a quadretti rossi e bianchi (con la frangia)
let clothTex: THREE.Texture | null = null;
const clothTexture = () =>
  (clothTex ??= canvasTex(128, 192, (c) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 6; j++) {
        c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
        c.fillRect(i * 32, j * 30, 32, 30);
      }
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 4; i++) c.fillRect(i * 32 + 14, 0, 4, 180);
    c.fillStyle = '#ffffff';
    for (let x = 4; x < 128; x += 10) c.fillRect(x, 180, 4, 12);
  }));

// numero sopra la testa: cerchio del colore della squadra
const badgeTex = new Map<string, THREE.Texture>();
function badgeTexture(team: number, label: string) {
  const key = `${team}:${label}`;
  let t = badgeTex.get(key);
  if (!t) {
    t = canvasTex(128, 128, (c) => {
      c.fillStyle = INK;
      c.beginPath();
      c.arc(64, 66, 58, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = TEAM_COL[team];
      c.beginPath();
      c.arc(64, 62, 52, 0, Math.PI * 2);
      c.fill();
      c.font = `900 ${label.length > 2 ? 46 : 70}px "Lilita One", "Baloo 2", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 10;
      c.strokeStyle = INK;
      c.strokeText(label, 64, 66);
      c.fillStyle = '#ffffff';
      c.fillText(label, 64, 66);
    });
    badgeTex.set(key, t);
  }
  return t;
}

type Deco = { badge: THREE.Sprite; key: string; cloth: THREE.Mesh };
const DECO = new WeakMap<Avatar, Deco>();
let handClothGeo: THREE.PlaneGeometry | null = null;

// selciato del cortile con le linee di casa (del colore delle squadre) e il cerchio della nonna
function cobbleTexture() {
  const PX = 40;
  const W = RUBA.halfX * 2;
  const D = RUBA.halfZ * 2;
  return canvasTex(W * PX, D * PX, (c) => {
    c.fillStyle = '#8f8374';
    c.fillRect(0, 0, W * PX, D * PX);
    const cols = ['#cdbfa8', '#bfae94', '#d8c9b0', '#c2a689', '#b8a58c', '#d1b79b'];
    let k = 0;
    for (let y = 0; y < D * PX; y += 22) {
      const off = (y / 22) % 2 ? 0 : 13;
      for (let x = -off; x < W * PX; x += 26) {
        c.fillStyle = cols[(k++ * 7 + Math.floor(y / 22)) % cols.length];
        c.beginPath();
        c.roundRect(x + 2, y + 2, 22, 18, 7);
        c.fill();
      }
    }
    // linee di casa
    for (const t of [0, 1]) {
      const y = (RUBA.halfZ + (t ? RUBA.lineZ : -RUBA.lineZ)) * PX;
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(0, y - 9, W * PX, 18);
      c.fillStyle = TEAM_COL[t];
      c.fillRect(0, y - 6, W * PX, 12);
    }
    // il cerchio dello strofinaccio
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 8;
    c.beginPath();
    c.arc((W / 2) * PX, (D / 2) * PX, RUBA.grabR * PX * 1.4, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([16, 14]);
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, (D / 2) * PX);
    c.lineTo(W * PX, (D / 2) * PX);
    c.stroke();
  });
}

// facciata di una casa di paese: intonaco, finestre con le persiane verdi, balconcino coi gerani
function facadeTexture(wall: string) {
  return canvasTex(256, 384, (c) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, 256, 384);
    c.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 40; i++) c.fillRect(Math.random() * 256, Math.random() * 384, 18, 10);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 2; col++) {
        const x = 40 + col * 120;
        const y = 40 + row * 116;
        c.fillStyle = '#2e5d4b';
        c.fillRect(x - 22, y, 20, 70);
        c.fillRect(x + 56, y, 20, 70);
        c.fillStyle = '#ffffff';
        c.fillRect(x - 4, y - 4, 62, 78);
        c.fillStyle = '#26415c';
        c.fillRect(x, y, 54, 70);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(x + 4, y + 4, 14, 30);
        if (row > 0) {
          c.fillStyle = '#5b4636';
          c.fillRect(x - 10, y + 70, 74, 8);
          for (let f = 0; f < 5; f++) {
            c.fillStyle = f % 2 ? '#e63946' : '#ff70a6';
            c.beginPath();
            c.arc(x - 4 + f * 15, y + 66, 6, 0, Math.PI * 2);
            c.fill();
          }
        }
      }
    c.fillStyle = '#6b4f3a';
    c.fillRect(96, 330, 64, 54);
  });
}

// un lenzuolo o uno strofinaccio steso (si muove col vento)
function laundry(color: string, w: number, h: number, checked: boolean) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), checked ? toy('#ffffff', { map: clothTexture(), side: THREE.DoubleSide }) : toy(color, { side: THREE.DoubleSide, clearcoat: 0 }));
  const pivot = new THREE.Group();
  m.position.y = -h / 2;
  pivot.add(m);
  return pivot;
}

registerClientMini({
  kind: 'RUBABANDIERA',
  orbit: { c: [0, 0, 0], r: 24 },
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffd6a5" to="#f77f00">
      <path d="M16 30 q20 -12 40 0" {...stroke} fill="none" />
      <rect x="22" y="30" width="30" height="38" rx="3" fill="#ffffff" {...stroke} transform="rotate(-8 37 49)" />
      <path d="M24 38 h26 M23 48 h28 M22 58 h28 M30 31 v36 M40 30 v36" stroke="#e63946" strokeWidth="5" transform="rotate(-8 37 49)" />
      <rect x="54" y="38" width="34" height="42" rx="9" fill="#3a86ff" {...stroke} />
      <text x="71" y="70" textAnchor="middle" fontSize="30" fontWeight="900" fill="#ffffff" stroke={INK} strokeWidth="2.5" fontFamily="sans-serif">
        3
      </text>
    </Badge>
  ),
  hint: 'Ti muovi solo quando chiamano il tuo numero · spazio salta · Shift scatto · prendi lo strofinaccio e torna oltre la tua linea',
  build(world) {
    const g = world.arena;
    bellAt = -9;
    const W = RUBA.halfX * 2;
    const D = RUBA.halfZ * 2;
    // il cortile: selciato, marciapiede di pietra e strada intorno
    const street = new THREE.Mesh(new THREE.CircleGeometry(120, 40), matte('#a39686'));
    street.rotation.x = -Math.PI / 2;
    street.position.y = -0.32;
    street.receiveShadow = true;
    const curb = new THREE.Mesh(rbox(W + 2.4, 0.5, D + 2.4, 0.15), toy('#e8dcc4', { clearcoat: 0.1 }));
    curb.position.y = -0.26;
    curb.receiveShadow = true;
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matte('#ffffff', { map: cobbleTexture() }));
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0.002;
    yard.receiveShadow = true;
    g.add(street, curb, yard);
    // le case tutto intorno (tre colori di intonaco), coi tetti di coppi
    const walls = ['#f2c48d', '#e8907a', '#f6dfa4', '#f3b5a8'].map((c) => matte('#ffffff', { map: facadeTexture(c) }));
    const roofM = toy('#b5523b', { clearcoat: 0.15 });
    const houses: [number, number, number, number, number][] = []; // x, z, larghezza, altezza, verso
    // (lontane dal selciato: la telecamera di chi è in fila deve starci davanti)
    for (let i = 0; i < 6; i++) houses.push([-15 + i * 6, -D / 2 - 12, 5.8, 8 + ((i * 5) % 4), 0]);
    for (let i = 0; i < 6; i++) houses.push([-15 + i * 6, D / 2 + 12, 5.8, 8 + ((i * 3) % 4), Math.PI]);
    for (let i = 0; i < 3; i++) houses.push([-W / 2 - 8, -6 + i * 6, 5.8, 9 + (i % 2) * 2, Math.PI / 2]);
    for (let i = 0; i < 3; i++) houses.push([W / 2 + 8, -6 + i * 6, 5.8, 8 + (i % 2) * 3, -Math.PI / 2]);
    houses.forEach(([x, z, w, h, r], i) => {
      const hg = new THREE.Group();
      const body = new THREE.Mesh(rbox(w, h, 6, 0.12), walls[i % walls.length]);
      body.position.y = h / 2;
      const roof = new THREE.Mesh(rbox(w + 0.6, 0.5, 6.8, 0.15), roofM);
      roof.position.y = h + 0.2;
      hg.add(body, roof);
      hg.position.set(x, 0, z);
      hg.rotation.y = r;
      g.add(shadowy(hg));
      world.camBlockers.push(hg);
    });
    // il campanile con la campana
    const tower = new THREE.Group();
    const shaft = outlined(new THREE.Mesh(rbox(4, 20, 4, 0.2), toy('#e9c9a0')), 1.01);
    shaft.position.y = 10;
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4, 4), toy('#b5523b'));
    top.position.y = 22;
    top.rotation.y = Math.PI / 4;
    const bellPivot = new THREE.Group();
    bellPivot.position.set(0, 18.6, 2.05);
    const bell = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 1.4, 20, 1, true), toy('#d4a017', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })), 1.05);
    bell.position.y = -0.8;
    bellPivot.add(bell);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), toy('#ffffff'));
    clock.position.set(0, 14, 2.02);
    tower.add(shaft, top, bellPivot, clock);
    tower.position.set(8, 0, -D / 2 - 24);
    g.add(shadowy(tower));
    // panni stesi tra le case (con gli strofinacci a quadretti, ovviamente)
    const lines: { pivot: THREE.Group; ph: number }[] = [];
    const lineM = matte('#ffffff');
    for (const [z, y] of [
      [-D / 2 - 8.6, 8.4],
      [D / 2 + 8.6, 8.2],
    ]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 4, 4), lineM);
      wire.rotation.z = Math.PI / 2;
      wire.position.set(0, y, z);
      g.add(wire);
      for (let i = 0; i < 9; i++) {
        const checked = i % 3 === 1;
        const p = laundry(['#ffffff', '#ffd60a', '#70d6ff', '#ff70a6', '#ffffff', '#9ef01a'][i % 6], checked ? 0.9 : 1.4, checked ? 1.3 : 1.8, checked);
        p.position.set(-W / 2 + 1.5 + i * 3, y, z);
        lines.push({ pivot: p, ph: i * 0.7 });
        g.add(p);
      }
    }
    // alberi di limoni nei vasi agli angoli
    for (const [x, z] of [
      [-W / 2 - 0.2, -D / 2 - 0.2],
      [W / 2 + 0.2, -D / 2 - 0.2],
      [-W / 2 - 0.2, D / 2 + 0.2],
      [W / 2 + 0.2, D / 2 + 0.2],
    ]) {
      const tree = new THREE.Group();
      const pot = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 1.1, 16), toy('#c8553d')), 1.05);
      pot.position.y = 0.55;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), toy('#7a4a1e'));
      trunk.position.y = 1.7;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), toy('#2d9c4a'));
      crown.position.y = 3;
      tree.add(pot, trunk, crown);
      for (let k = 0; k < 6; k++) {
        const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toy('#ffe14d'));
        const a = k * 1.1;
        lemon.position.set(Math.sin(a) * 1.15, 2.7 + (k % 3) * 0.35, Math.cos(a) * 1.15);
        lemon.scale.set(1, 1.25, 1);
        tree.add(lemon);
      }
      tree.position.set(x, 0, z);
      g.add(shadowy(tree));
      world.camBlockers.push(tree);
    }
    // bandierine alte, sopra il marciapiede (non in mezzo al cortile dove passa la telecamera)
    for (const sz of [-1, 1]) {
      g.add(flagLine(new THREE.Vector3(-W / 2 - 0.2, 7.6, sz * (D / 2 + 5)), new THREE.Vector3(W / 2 + 0.2, 7.6, sz * (D / 2 + 5)), 24));
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 7.8, 8), toy('#2e5d4b'));
        pole.position.set(sx * (W / 2 + 0.2), 3.9, sz * (D / 2 + 5));
        g.add(pole);
      }
    }
    // la nonna: braccio teso con lo strofinaccio (la ciabatta oggi resta in tasca)
    const nonna = makeNonna();
    nonna.position.set(RUBA.nonnaX, 0, 0);
    (nonna.userData.arm as THREE.Group).visible = false;
    g.add(nonna);
    world.camBlockers.push(nonna);
    const sleeve = outlined(new THREE.Mesh(rbox(1.25, 0.34, 0.34, 0.14), toy('#6a4c93')), 1.05);
    sleeve.position.set(RUBA.nonnaX - 0.72, 2.12, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), toy('#ffd8b1'));
    hand.position.set(0.05, 2.08, 0);
    g.add(shadowy(sleeve), hand);
    const clothPivot = new THREE.Group();
    clothPivot.position.set(0, 2.0, 0);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.95), toy('#ffffff', { map: clothTexture(), side: THREE.DoubleSide, clearcoat: 0 }));
    cloth.position.y = -0.5;
    cloth.castShadow = true;
    clothPivot.add(cloth);
    g.add(clothPivot);
    // anello che brilla intorno allo strofinaccio quando chiamano
    const callRingM = new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    const callRing = new THREE.Mesh(new THREE.RingGeometry(RUBA.grabR * 1.25, RUBA.grabR * 1.55, 48), callRingM);
    callRing.rotation.x = -Math.PI / 2;
    callRing.position.y = 0.03;
    g.add(callRing);
    // i numeri dipinti per terra davanti a ogni posto (si fanno quando arriva la squadra)
    const marks = new THREE.Group();
    g.add(marks);
    let marksN = 0;
    const markGeo = new THREE.CircleGeometry(0.42, 24);

    return (f: MiniFrame) => {
      const E = f.ext as Ext;
      const t = f.t;
      if (E && E.n !== marksN) {
        marksN = E.n;
        for (const c of [...marks.children]) marks.remove(c);
        for (const tm of [0, 1])
          for (let k = 1; k <= E.n; k++) {
            const s = rubaSlot(tm, k, E.n);
            const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: badgeTexture(tm, String(k)), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
            m.rotation.set(-Math.PI / 2, 0, tm ? 0 : Math.PI);
            m.position.set(s.x, 0.02, s.z + (tm ? -1 : 1) * 0.95);
            marks.add(m);
          }
      }
      const carried = !!E && E.phase === 'CARRY' && !!E.carrier;
      clothPivot.visible = !carried;
      clothPivot.rotation.z = Math.sin(t * 2.3) * 0.12;
      clothPivot.rotation.x = Math.sin(t * 1.7) * 0.1;
      // la nonna guarda la mia squadra, dondola un po'
      const myTeam = E?.team[f.myId];
      const face = myTeam === 1 ? 0 : Math.PI;
      let dr = face - nonna.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      nonna.rotation.y += dr * Math.min(1, f.dt * 3);
      nonna.position.y = Math.abs(Math.sin(t * 2)) * 0.04;
      const calling = !!E && E.phase === 'CALL';
      callRingM.opacity = calling ? 0.55 + Math.sin(t * 10) * 0.3 : 0;
      callRing.scale.setScalar(calling ? 1 + Math.sin(t * 6) * 0.06 : 1);
      // panni al vento, campana che suona
      for (const l of lines) l.pivot.rotation.x = Math.sin(t * 1.6 + l.ph) * 0.18 + 0.1;
      const ring = t - bellAt;
      bellPivot.rotation.x = ring >= 0 && ring < 2.5 ? Math.sin(ring * 9) * 0.5 * (1 - ring / 2.5) : 0;
    };
  },
  // fermo al tuo posto finché non chiamano il tuo numero
  speed: (f) => {
    const E = f.ext as Ext;
    return !E || f.view.stage !== 'PLAY' || isRunner(E, f.myId) ? 1 : 0;
  },
  local(f) {
    const E = f.ext as Ext;
    if (!E || f.view.stage !== 'PLAY' || !f.view.alive[f.myId] || isRunner(E, f.myId)) return;
    const t = E.team[f.myId];
    const k = E.nums[f.myId]?.[0];
    if (t === undefined || k === undefined) return;
    const s = rubaSlot(t, k, E.n);
    const b = f.me;
    b.x = s.x;
    b.z = s.z;
    b.vx = b.vz = b.kx = b.kz = 0;
    b.dashT = 0;
    b.r = s.r;
  },
  decorate(av, id, f) {
    const E = f.ext as Ext;
    const team = E?.team[id];
    const nums = E?.nums[id] ?? [];
    const label = nums.join('·');
    wearVest(av, team, label);
    let st = DECO.get(av);
    if (!st || st.badge.parent !== av.deco) {
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      badge.position.y = 3.2;
      badge.scale.setScalar(0.7);
      badge.renderOrder = 11;
      handClothGeo ??= new THREE.PlaneGeometry(0.5, 0.75).translate(0, -0.38, 0);
      const cloth = new THREE.Mesh(handClothGeo, toy('#ffffff', { map: clothTexture(), side: THREE.DoubleSide, clearcoat: 0 }));
      cloth.visible = false;
      av.deco.add(badge, cloth);
      st = { badge, key: '', cloth };
      DECO.set(av, st);
    }
    if (!E || team === undefined || !label) {
      st.badge.visible = false;
      st.cloth.visible = false;
      return;
    }
    const key = `${team}:${label}`;
    if (st.key !== key) {
      st.key = key;
      st.badge.material.map = badgeTexture(team, label);
      st.badge.material.needsUpdate = true;
    }
    const run = f.view.stage === 'PLAY' && isRunner(E, id);
    st.badge.visible = av.body.visible;
    st.badge.scale.setScalar(run ? 0.95 + Math.sin(f.t * 9) * 0.12 : 0.62);
    st.badge.position.y = run ? 3.35 : 3.15;
    // chi corre ha l'anello che lampeggia
    if (run) av.ring.scale.setScalar(1 + Math.abs(Math.sin(f.t * 6)) * 0.35);
    else av.ring.scale.setScalar(1);
    // chi ha lo strofinaccio lo sventola sopra la testa
    const has = E.phase === 'CARRY' && E.carrier === id && f.view.stage === 'PLAY';
    st.cloth.visible = has && av.body.visible;
    if (has) {
      av.armR.rotation.x = -2.9;
      av.armR.rotation.z = 0.15;
      st.cloth.position.set(0.6, 2.05 + av.body.position.y, -0.05);
      st.cloth.rotation.set(Math.sin(f.t * 14) * 0.35 + 0.5, 0, 0);
    }
  },
  status(h) {
    const E = h.ext as Ext;
    const t = E?.team[h.myId];
    if (!E || t === undefined) return null;
    const mine = E.nums[h.myId] ?? [];
    if (E.phase === 'POINT' && E.last) return teamPill(E.last.team, `PUNTO AI ${TEAM_NAME[E.last.team]}!`);
    if (E.phase === 'CARRY' && E.carrier === h.myId) return { text: 'SCAPPA OLTRE LA TUA LINEA!', cls: 'sc-green pulse-soft' };
    if (E.phase === 'CARRY' && E.chasers.includes(h.myId) && E.carrier) return { text: `TOCCA ${h.nameOf(E.carrier).toUpperCase()}!`, cls: 'sc-red pulse-soft' };
    if (E.phase === 'CALL' && isRunner(E, h.myId)) return { text: 'TOCCA A TE! PRENDI LO STROFINACCIO', cls: 'sc-yellow pulse-soft' };
    if (h.view.playStart && h.now - h.view.playStart < 4000) return teamPill(t, `SEI DEI ${TEAM_NAME[t]}! IL TUO NUMERO: ${mine.join(' E ')}`);
    return { text: `IL TUO NUMERO: ${mine.join(' E ')} · ASPETTA`, cls: 'sc-dark' };
  },
  hud(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage === 'INTRO') return null;
    const mine = E.nums[h.myId] ?? [];
    const showCall = (E.phase === 'CALL' || E.phase === 'CARRY') && E.called.length > 0;
    const me = mine.some((k) => E.called.includes(k));
    return (
      <TeamScore score={E.score} myTeam={E.team[h.myId]} sub={`Si vince a ${RUBA.target} · tu sei il ${mine.join(' e ')}`}>
        {showCall && (
          <div key={E.called.join('-') + E.at} className="pop sc-chip flex items-center gap-2 px-4 py-1">
            <span className="text-xs font-black uppercase tracking-widest text-white/80">La nonna chiama</span>
            <span className={`sc-stroke font-display text-5xl leading-none tabular-nums ${me ? 'text-lime-300' : 'text-yellow-300'}`}>{E.called.join(' e ')}</span>
          </div>
        )}
      </TeamScore>
    );
  },
  fx(p, c) {
    const E = c.view.ext as Ext;
    const myTeam = E?.team[c.myId];
    if (p.k === 'ruba_call') {
      bellAt = performance.now() / 1000;
      popText(c.world, NONNA_TOP.x, NONNA_TOP.y - 1.2, NONNA_TOP.z, `${callWords(p.nums)}!`, '#ffd60a', { scale: 1.5, life: 1.6 });
      soundManager.playTick();
      const mine = (E?.nums[c.myId] ?? []).some((k) => p.nums.includes(k));
      if (mine) {
        soundManager.playWhoosh();
        c.shake(0.18);
      }
    } else if (p.k === 'ruba_grab') {
      const at = c.where(p.id);
      if (at) {
        popText(c.world, at.x, at.y, at.z, 'PRESO!', '#ffffff');
        ringPulse(c.world, at.x, at.y, at.z, '#ffd60a');
      }
      soundManager.playWhoosh();
      c.feed(`${c.nameOf(p.id)} ha lo strofinaccio!`);
    } else if (p.k === 'ruba_point') {
      burst(c.world, p.x, 1.2, p.z, [TEAM_COL[p.team], '#ffffff', '#ffd60a'], 50, 7);
      const at = c.where(p.how === 'casa' ? p.by : p.victim) ?? { x: p.x, y: 0, z: p.z };
      const word = p.how === 'casa' ? 'SALVO!' : p.how === 'preso' ? 'TOCCATO!' : p.how === 'lento' ? 'TROPPO LENTO!' : 'PUNTO!';
      popText(c.world, at.x, at.y, at.z, word, TEAM_COL[p.team], { scale: 1.4, life: 1.4 });
      if (p.team === myTeam) soundManager.playSuccess();
      else soundManager.playFall();
      c.shake(p.by === c.myId || p.victim === c.myId ? 0.45 : 0.2);
      const n = (id: string | null) => (id ? c.nameOf(id) : '');
      c.feed(
        p.how === 'casa'
          ? `${n(p.by)} torna a casa: punto ai ${TEAM_NAME[p.team]}!`
          : p.how === 'preso'
            ? `${n(p.by)} tocca ${n(p.victim)}: punto ai ${TEAM_NAME[p.team]}!`
            : `${n(p.victim)} non ce la fa: punto ai ${TEAM_NAME[p.team]}`,
      );
    } else if (p.k === 'ruba_none') {
      popText(c.world, NONNA_TOP.x, NONNA_TOP.y - 1.2, NONNA_TOP.z, 'NESSUNO?!', '#ff9f1c', { scale: 1.2 });
      soundManager.playError();
      c.feed('Nessuno ha preso lo strofinaccio: si ricomincia');
    }
  },
});
