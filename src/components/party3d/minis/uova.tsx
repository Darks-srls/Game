// 🥚 Caccia alle uova (telefono): l'aia con lo steccato, la gallona sul covone che sforna uova, i nidi delle squadre
// con le bandiere, uova pastello (e d'oro) che volano, si portano in braccio e si ammucchiano nei nidi
import * as THREE from 'three';
import { TEAM_COL, TEAM_NAME } from '../../../data/minis/squadre';
import { UOVA, nestX } from '../../../data/minis/uova';
import { soundManager } from '../../../utils/audio';
import { Badge, INK, stroke } from '../icons';
import { balloon, burst, canvasTex, flagLine, glow, matte, outlined, popText, rbox, ringPulse, shadowy, toy, type Avatar } from '../scene';
import { TeamScore, teamPill, wearVest } from './squadre';
import { registerClientMini } from './types';

type EggRow = [number, number, number, number, number, number, number]; // id, x, z, d'oro, quando atterra, da x, da z
type Ext = {
  team: Record<string, number>;
  eggs: EggRow[];
  carry: Record<string, number>;
  nest: number[][]; // [quante, di cui d'oro]
  score: number[];
  brought: Record<string, number>;
  steal: number;
} | null;

const NEST_NAME = ['ROSSO', 'BLU'];
const FLAG_W = 2;
const PASTEL = ['#fff3e0', '#ffd1dc', '#c9ecff', '#d4f5c9', '#fff2a8', '#e5d9ff'].map((c) => new THREE.Color(c));
// la gallona fa l'uovo (animazione): quando e verso dove
let layAt = -9;
let layDir = 0;

// uova in braccio: una geometria e due materiali per tutti
let handGeo: THREE.BufferGeometry | null = null;
let handMats: THREE.Material[] | null = null;
const handEgg = () => {
  handGeo ??= new THREE.SphereGeometry(0.34, 18, 14).scale(1, 1.3, 1);
  handMats ??= [toy('#fff8ec', { clearcoat: 0.7, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.85, roughness: 0.2, emissive: '#8a5a00', emissiveIntensity: 0.45 })];
  return { geo: handGeo, mats: handMats };
};
type CarryDeco = { egg: THREE.Mesh; arrow: THREE.Group };
const CARRY = new WeakMap<Avatar, CarryDeco>();

function strawTex(repeat: [number, number]) {
  return canvasTex(
    128,
    128,
    (c) => {
      c.fillStyle = '#e9c46a';
      c.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 140; k++) {
        c.strokeStyle = k % 3 ? '#d4a237' : '#fff1a8';
        c.lineWidth = 2;
        c.beginPath();
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        const a = Math.random() * Math.PI;
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
        c.stroke();
      }
    },
    repeat,
  );
}

// il prato dell'aia: strisce, terra battuta al centro, paglia intorno ai nidi e un velo del colore delle squadre
function yardTexture() {
  const PX = 34;
  const W = UOVA.halfX * 2;
  const D = UOVA.halfZ * 2;
  return canvasTex(W * PX, D * PX, (c) => {
    for (let i = 0; i < W / 2; i++) {
      c.fillStyle = i % 2 ? '#7fcf6a' : '#74c35f';
      c.fillRect(i * 2 * PX, 0, 2 * PX, D * PX);
    }
    for (let k = 0; k < 900; k++) {
      c.fillStyle = 'rgba(40,110,50,0.22)';
      c.fillRect(Math.random() * W * PX, Math.random() * D * PX, 2, 6);
    }
    const blob = (x: number, z: number, r: number, inner: string, outer: string) => {
      const gx = (x + UOVA.halfX) * PX;
      const gz = (z + UOVA.halfZ) * PX;
      const gr = c.createRadialGradient(gx, gz, r * PX * 0.35, gx, gz, r * PX);
      gr.addColorStop(0, inner);
      gr.addColorStop(1, outer);
      c.fillStyle = gr;
      c.beginPath();
      c.arc(gx, gz, r * PX, 0, Math.PI * 2);
      c.fill();
    };
    blob(0, 0, 5.2, 'rgba(201,150,95,0.95)', 'rgba(201,150,95,0)');
    for (const t of [0, 1]) {
      blob(nestX(t), 0, 6.5, t ? 'rgba(58,134,255,0.28)' : 'rgba(255,59,92,0.28)', 'rgba(255,255,255,0)');
      blob(nestX(t), 0, 3.6, 'rgba(233,196,106,0.95)', 'rgba(233,196,106,0)');
    }
    // fili di paglia sparsi
    for (let k = 0; k < 260; k++) {
      c.strokeStyle = k % 2 ? 'rgba(242,201,76,0.8)' : 'rgba(255,241,168,0.7)';
      c.lineWidth = 2;
      const x = Math.random() * W * PX;
      const y = Math.random() * D * PX;
      const a = Math.random() * Math.PI;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      c.stroke();
    }
    // la linea di metà aia (tratteggiata)
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 6;
    c.setLineDash([22, 18]);
    c.beginPath();
    c.moveTo((W / 2) * PX, 0);
    c.lineTo((W / 2) * PX, D * PX);
    c.stroke();
  });
}

// bandiera della squadra con l'uovo disegnato sopra
function flagTexture(t: number) {
  return canvasTex(256, 160, (c) => {
    c.fillStyle = TEAM_COL[t];
    c.fillRect(0, 0, 256, 160);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 256; i += 40) c.fillRect(i, 0, 20, 160);
    c.fillStyle = '#ffffff';
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.beginPath();
    c.ellipse(128, 70, 34, 44, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.font = '900 34px "Lilita One", "Baloo 2", sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 7;
    c.strokeText(TEAM_NAME[t], 128, 146);
    c.fillText(TEAM_NAME[t], 128, 146);
  });
}

// la gallona: grassa, bianca, sul covone (fa le uova sbattendo le ali)
function makeBigHen() {
  const g = new THREE.Group();
  const hay = strawTex([3, 1]);
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(UOVA.henR, UOVA.henR + 0.12, 1.1, 36), [toy('#ffffff', { map: hay, clearcoat: 0 }), toy('#f2c94c', { clearcoat: 0 }), toy('#d9a521')]);
  bale.position.y = 0.55;
  g.add(shadowy(bale));
  const body = new THREE.Group();
  body.position.y = 1.1;
  const white = toy('#fffaf0', { clearcoat: 0.3 });
  const red = toy('#e63946');
  const torso = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.3, 28, 20), white), 1.04);
  torso.scale.set(1, 0.86, 1.2);
  torso.position.y = 1.1;
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 18), white), 1.05);
  head.position.set(0, 2.35, 1.0);
  for (let i = 0; i < 3; i++) {
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), red);
    comb.position.set(0, 3.05 - Math.abs(i - 1) * 0.08, 0.75 + i * 0.25);
    body.add(comb);
  }
  const beak = outlined(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 12), toy('#ff9f1c')), 1.08);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.3, 1.82);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), red);
  wattle.scale.y = 1.5;
  wattle.position.set(0, 1.95, 1.6);
  for (const x of [-0.3, 0.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), toy('#ffffff'));
    eye.position.set(x, 2.52, 1.56);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toy('#1b1b2f'));
    pupil.position.set(x * 1.05, 2.53, 1.71);
    body.add(eye, pupil);
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.05, 1.55, -0.05);
    const w = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), white), 1.05);
    w.scale.set(0.32, 0.8, 1.1);
    w.position.set(s * 0.2, -0.4, 0);
    pivot.add(w);
    wings.push(pivot);
    body.add(pivot);
  }
  for (let i = 0; i < 3; i++) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 10), white);
    tail.position.set((i - 1) * 0.35, 1.9, -1.45);
    tail.rotation.set(-0.7, 0, (i - 1) * 0.35);
    body.add(tail);
  }
  body.add(torso, head, beak, wattle);
  g.add(shadowy(body));
  g.userData.body = body;
  g.userData.wings = wings;
  return g;
}

// mulino a vento (le pale girano sempre)
function windmill() {
  const g = new THREE.Group();
  const tower = outlined(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 11, 8), toy('#fff1d6')), 1.02);
  tower.position.y = 5.5;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 8), toy('#d62828'));
  cap.position.y = 12.2;
  const hub = new THREE.Group();
  hub.position.set(0, 10.6, 1.6);
  for (let i = 0; i < 4; i++) {
    const blade = outlined(new THREE.Mesh(rbox(1.2, 6, 0.15, 0.06), toy(i % 2 ? '#ffffff' : '#ffd60a')), 1.04);
    blade.position.y = 3.2;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    arm.add(blade);
    hub.add(arm);
  }
  g.add(tower, cap, hub);
  g.userData.hub = hub;
  return shadowy(g);
}

registerClientMini({
  kind: 'UOVA',
  orbit: { c: [0, 0, 0], r: 30 },
  highCam: true,
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#b7efc5" to="#2d9c4a">
      <path d="M70 14 v44" {...stroke} />
      <path d="M70 15 h18 l-5 7 l5 7 h-18 Z" fill="#ff3b5c" {...stroke} strokeWidth="3" />
      <ellipse cx="48" cy="74" rx="36" ry="12" fill="#c98a4b" {...stroke} />
      <path d="M18 72 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0" stroke="#7a4a1e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="36" cy="56" rx="13" ry="17" fill="#fff8ec" {...stroke} />
      <ellipse cx="60" cy="59" rx="12" ry="15" fill="#ffd60a" {...stroke} />
      <path d="M54 52 q3 -5 8 -4" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M30 48 q2 -5 7 -6" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto · E schiaffo (fa cadere l’uovo) · porta le uova al nido della tua squadra',
  build(world) {
    const g = world.arena;
    layAt = -9;
    const W = UOVA.halfX * 2;
    const D = UOVA.halfZ * 2;
    // prato intorno e l'aia rialzata
    const field = new THREE.Mesh(new THREE.CircleGeometry(130, 48), matte('#6cc57c'));
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.62;
    field.receiveShadow = true;
    g.add(field);
    const base = new THREE.Mesh(rbox(W + 1.4, 0.6, D + 1.4, 0.25), toy('#8d5524', { clearcoat: 0.1 }));
    base.position.y = -0.31;
    base.receiveShadow = true;
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matte('#ffffff', { map: yardTexture() }));
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0.002;
    yard.receiveShadow = true;
    g.add(base, yard);
    // steccato bianco (pali tutti uguali: uno solo disegno)
    const posts: THREE.Vector3[] = [];
    for (let x = -UOVA.halfX; x <= UOVA.halfX + 0.01; x += 1.5) for (const z of [-UOVA.halfZ - 0.3, UOVA.halfZ + 0.3]) posts.push(new THREE.Vector3(x, 0.65, z));
    for (let z = -UOVA.halfZ + 1.5; z <= UOVA.halfZ - 1.49; z += 1.5) for (const x of [-UOVA.halfX - 0.3, UOVA.halfX + 0.3]) posts.push(new THREE.Vector3(x, 0.65, z));
    const postMesh = new THREE.InstancedMesh(rbox(0.24, 1.3, 0.24, 0.06), toy('#ffffff'), posts.length);
    const dummy = new THREE.Object3D();
    posts.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    });
    postMesh.castShadow = true;
    g.add(postMesh);
    const railM = toy('#ffffff');
    for (const y of [0.45, 1.05]) {
      for (const z of [-UOVA.halfZ - 0.3, UOVA.halfZ + 0.3]) {
        const r = new THREE.Mesh(rbox(W + 0.6, 0.14, 0.1, 0.04), railM);
        r.position.set(0, y, z);
        g.add(r);
      }
      for (const x of [-UOVA.halfX - 0.3, UOVA.halfX + 0.3]) {
        const r = new THREE.Mesh(rbox(0.1, 0.14, D + 0.6, 0.04), railM);
        r.position.set(x, y, 0);
        g.add(r);
      }
    }
    // i nidi: anello di paglia intrecciata, letto di paglia, alone del colore della squadra e bandiera che sventola
    const halos: THREE.MeshBasicMaterial[] = [];
    const flags: { mesh: THREE.Mesh; base: Float32Array }[] = [];
    for (const t of [0, 1]) {
      const nx = nestX(t);
      const out = t ? 1 : -1;
      const ring = outlined(new THREE.Mesh(new THREE.TorusGeometry(UOVA.nestR, 0.42, 10, 48), toy('#ffffff', { map: strawTex([6, 1]), roughness: 0.8, clearcoat: 0 })), 1.03);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(nx, 0.22, 0);
      const bed = new THREE.Mesh(new THREE.CylinderGeometry(UOVA.nestR - 0.05, UOVA.nestR - 0.05, 0.16, 40), matte('#ffffff', { map: strawTex([2, 2]) }));
      bed.position.set(nx, 0.08, 0);
      const haloM = new THREE.MeshBasicMaterial({ color: TEAM_COL[t], transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
      const halo = new THREE.Mesh(new THREE.RingGeometry(UOVA.nestR + 0.5, UOVA.nestR + 0.85, 56), haloM);
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(nx, 0.03, 0);
      halos.push(haloM);
      // bandiera bassa e di lato al nido (non davanti alla telecamera di chi ci arriva)
      const fz = -(UOVA.nestR + 1.3);
      const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 4.3, 10), toy('#ffffff')), 1.08);
      pole.position.set(nx + out * 0.6, 2.15, fz);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), glow('#ffd60a', 1.4));
      knob.position.set(nx + out * 0.6, 4.35, fz);
      const flagGeo = new THREE.PlaneGeometry(FLAG_W, 1.25, 10, 1);
      flagGeo.translate(FLAG_W / 2, 0, 0);
      const flag = new THREE.Mesh(flagGeo, toy('#ffffff', { map: flagTexture(t), side: THREE.DoubleSide, clearcoat: 0.1 }));
      flag.position.set(nx + out * 0.6, 3.55, fz);
      flag.rotation.y = Math.PI / 2;
      flags.push({ mesh: flag, base: Float32Array.from(flagGeo.attributes.position.array as ArrayLike<number>) });
      world.camBlockers.push(pole, flag);
      g.add(shadowy(ring), bed, halo, shadowy(pole), knob, shadowy(flag));
    }
    // la gallona al centro
    const hen = makeBigHen();
    g.add(hen);
    world.camBlockers.push(hen);
    const henBody = hen.userData.body as THREE.Group;
    const wings = hen.userData.wings as THREE.Group[];
    // le uova: tutte uguali (pastello e d'oro), disegnate in blocco
    const eggGeo = new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.32, 1);
    const eggsN = new THREE.InstancedMesh(eggGeo, toy('#ffffff', { roughness: 0.32, clearcoat: 0.7 }), 150);
    const eggsG = new THREE.InstancedMesh(eggGeo, new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.85, roughness: 0.2, emissive: '#8a5a00', emissiveIntensity: 0.5 }), 50);
    for (const m of [eggsN, eggsG]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.count = 0;
      g.add(m);
    }
    eggsN.setColorAt(0, PASTEL[0]);
    // luccichio sotto le uova d'oro a terra
    const sparkM = new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    const sparkGeo = new THREE.RingGeometry(0.45, 0.62, 5);
    const sparks = Array.from({ length: 4 }, () => {
      const s = new THREE.Mesh(sparkGeo, sparkM);
      s.rotation.x = -Math.PI / 2;
      s.visible = false;
      g.add(s);
      return s;
    });
    // fattoria intorno: fienile, silo, mulino, covoni, girasoli, pulcini e palloncini
    const barn = new THREE.Group();
    const walls = outlined(new THREE.Mesh(rbox(13, 7.5, 9, 0.3), toy('#d62828')), 1.01);
    walls.position.y = 3.75;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 13.6, 3, 1), toy('#5c3d2e'));
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 8.9;
    const door = new THREE.Mesh(rbox(4.2, 5, 0.2, 0.1), toy('#ffffff'));
    door.position.set(0, 2.5, 4.55);
    const cross = new THREE.Mesh(rbox(5.4, 0.35, 0.15, 0.05), toy('#d62828'));
    cross.position.set(0, 2.5, 4.68);
    cross.rotation.z = 0.85;
    barn.add(walls, roof, door, cross);
    barn.position.set(-3, 0, -UOVA.halfZ - 16);
    g.add(shadowy(barn));
    world.camBlockers.push(barn);
    const silo = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 12, 28), toy('#e5e5e5'));
    tube.position.y = 6;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), toy('#d62828'));
    dome.position.y = 12;
    silo.add(tube, dome);
    silo.position.set(11, 0, -UOVA.halfZ - 15);
    g.add(shadowy(silo));
    world.camBlockers.push(silo);
    const mill = windmill();
    mill.position.set(-UOVA.halfX - 9, 0, UOVA.halfZ + 7);
    mill.rotation.y = 2.4;
    g.add(mill);
    world.camBlockers.push(mill);
    const hub = mill.userData.hub as THREE.Group;
    const hayM = toy('#ffffff', { map: strawTex([3, 1]), clearcoat: 0 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.9, 22), hayM);
      hay.rotation.set(0, a, Math.PI / 2);
      hay.position.set(Math.sin(a) * (UOVA.halfX + 5.5), 0.5, Math.cos(a) * (UOVA.halfZ + 5));
      g.add(shadowy(hay));
      world.camBlockers.push(hay);
    }
    // girasoli lungo i lati lunghi
    const flowers: THREE.Vector3[] = [];
    for (let i = 0; i < 26; i++) flowers.push(new THREE.Vector3(-UOVA.halfX + 1 + (i % 13) * 2.3, 0, (i < 13 ? -1 : 1) * (UOVA.halfZ + 4.2 + (i % 2) * 0.8)));
    const stemM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), toy('#2d9c4a'), flowers.length);
    const headM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 14), toy('#ffd60a'), flowers.length);
    const coreM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12), toy('#6b3e1f'), flowers.length);
    flowers.forEach((p, i) => {
      dummy.position.set(p.x, 1.2, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stemM.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 2.45, p.z + (p.z < 0 ? 0.08 : -0.08));
      dummy.rotation.set((p.z < 0 ? 1 : -1) * 1.2, 0, 0);
      dummy.updateMatrix();
      headM.setMatrixAt(i, dummy.matrix);
      dummy.position.z += p.z < 0 ? 0.05 : -0.05;
      dummy.updateMatrix();
      coreM.setMatrixAt(i, dummy.matrix);
    });
    g.add(stemM, headM, coreM);
    // pulcini che girano intorno allo steccato saltellando
    const chickN = 14;
    const chicks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 12, 10), toy('#ffe14d'), chickN);
    const beaks = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.2, 6), toy('#ff9f1c'), chickN);
    chicks.castShadow = true;
    g.add(chicks, beaks);
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const b = balloon([TEAM_COL[0], '#ffd60a', TEAM_COL[1], '#ffffff'][i % 4]);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.sin(a) * (UOVA.halfX + 13), 9 + (i % 3) * 1.8, Math.cos(a) * (UOVA.halfZ + 12));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    g.add(flagLine(new THREE.Vector3(-UOVA.halfX - 0.3, 3.4, -UOVA.halfZ - 0.3), new THREE.Vector3(UOVA.halfX + 0.3, 3.4, -UOVA.halfZ - 0.3), 22));
    g.add(flagLine(new THREE.Vector3(-UOVA.halfX - 0.3, 3.4, UOVA.halfZ + 0.3), new THREE.Vector3(UOVA.halfX + 0.3, 3.4, UOVA.halfZ + 0.3), 22));
    for (const x of [-UOVA.halfX - 0.3, UOVA.halfX + 0.3])
      for (const z of [-UOVA.halfZ - 0.3, UOVA.halfZ + 0.3]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4, 8), toy('#ffffff'));
        pole.position.set(x, 2, z);
        g.add(pole);
      }

    const put = (m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rx: number, rz: number, s: number) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, 0, rz);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };

    return (f) => {
      const E = f.ext as Ext;
      const t = f.t;
      // la gallona: si guarda intorno; quando fa l'uovo si accuccia, sbatte le ali e si gira verso dove vola
      const lay = t - layAt;
      const laying = lay >= 0 && lay < 0.8;
      const look = laying ? layDir : Math.sin(t * 0.5) * 0.9;
      let dr = look - henBody.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      henBody.rotation.y += dr * Math.min(1, f.dt * (laying ? 10 : 2));
      const squat = laying ? Math.sin((lay / 0.8) * Math.PI) : 0;
      henBody.scale.set(1 + squat * 0.12, 1 - squat * 0.18 + Math.sin(t * 3) * 0.015, 1 + squat * 0.12);
      wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (laying ? 0.35 + Math.abs(Math.sin(t * 28)) * 0.9 : 0.1 + Math.sin(t * 2.2) * 0.05)));
      // le uova
      let n = 0;
      let ng = 0;
      let sp = 0;
      if (E) {
        for (const [id, x, z, gold, at, fx, fz] of E.eggs) {
          const left = (at - f.now) / UOVA.flyMs;
          let px = x;
          let pz = z;
          let py = 0.38;
          let rx = Math.sin(t * 2 + id) * 0.08;
          if (left > 0) {
            // ancora in volo: arco dalla gallona (o da chi l'ha perso) fino a terra
            const k = 1 - Math.min(1, left);
            const fromY = fx === 0 && fz === 0 ? 3.4 : 1.3;
            px = fx + (x - fx) * k;
            pz = fz + (z - fz) * k;
            py = fromY + (0.38 - fromY) * k + Math.sin(k * Math.PI) * 2.2;
            rx = k * 9;
          } else {
            const since = (f.now - at) / 1000;
            if (since < 0.45) py += Math.abs(Math.sin(since * 14)) * 0.35 * (1 - since / 0.45);
          }
          if (gold) {
            if (ng < 50) put(eggsG, ng++, px, py, pz, rx, 0, 1.2);
            if (sp < sparks.length && left <= 0) {
              const s = sparks[sp++];
              s.visible = true;
              s.position.set(px, 0.05, pz);
              s.rotation.z = t * 2;
              s.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
            }
          } else if (n < 150) {
            put(eggsN, n, px, py, pz, rx, 0, 1);
            eggsN.setColorAt(n++, PASTEL[id % PASTEL.length]);
          }
        }
        // i nidi: un mucchio che cresce a spirale (le d'oro in cima)
        for (const tm of [0, 1]) {
          const [cnt, gold] = E.nest[tm] ?? [0, 0];
          const show = Math.min(cnt, 64);
          for (let k = 0; k < show; k++) {
            const a = k * 2.39996;
            const ring = Math.sqrt(k + 0.5) * 0.36;
            const rr = Math.min(UOVA.nestR - 0.5, ring);
            const px = nestX(tm) + Math.cos(a) * rr;
            const pz = Math.sin(a) * rr;
            const py = 0.32 + Math.max(0, ring - rr) * 0.55;
            const isGold = k >= show - Math.min(gold, show);
            if (isGold) {
              if (ng < 50) put(eggsG, ng++, px, py, pz, 0.5, a, 1.05);
            } else if (n < 150) {
              put(eggsN, n, px, py, pz, 0.5, a, 0.95);
              eggsN.setColorAt(n++, PASTEL[(k * 7 + tm) % PASTEL.length]);
            }
          }
        }
      }
      for (let i = sp; i < sparks.length; i++) sparks[i].visible = false;
      eggsN.count = n;
      eggsG.count = ng;
      eggsN.instanceMatrix.needsUpdate = true;
      eggsG.instanceMatrix.needsUpdate = true;
      if (eggsN.instanceColor) eggsN.instanceColor.needsUpdate = true;
      // bandiere che sventolano, aloni dei nidi che pulsano (quello della mia squadra di più)
      const myTeam = E?.team[f.myId];
      halos.forEach((m, i) => (m.opacity = 0.45 + (myTeam === i ? 0.35 : 0.15) * (0.5 + Math.sin(t * 4) * 0.5)));
      for (const fl of flags) {
        const pos = fl.mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const u = fl.base[i * 3] / FLAG_W;
          pos.setZ(i, Math.sin(t * 5 - u * 4) * 0.22 * u);
        }
        pos.needsUpdate = true;
      }
      // il mulino, i pulcini, i palloncini
      hub.rotation.z = t * 0.8;
      for (let i = 0; i < chickN; i++) {
        const a = t * 0.18 + (i / chickN) * Math.PI * 2;
        const hop = Math.abs(Math.sin(t * 7 + i * 1.7)) * 0.35;
        const x = Math.sin(a) * (UOVA.halfX + 1.6);
        const z = Math.cos(a) * (UOVA.halfZ + 1.4);
        put(chicks, i, x, 0.3 + hop, z, 0, 0, 1);
        dummy.position.set(x + Math.cos(a) * 0.3, 0.35 + hop, z - Math.sin(a) * 0.3);
        dummy.rotation.set(0, 0, -Math.PI / 2);
        dummy.lookAt(x + Math.cos(a) * 2, 0.35 + hop, z - Math.sin(a) * 2);
        dummy.rotateX(Math.PI / 2);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        beaks.setMatrixAt(i, dummy.matrix);
      }
      chicks.instanceMatrix.needsUpdate = true;
      beaks.instanceMatrix.needsUpdate = true;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  // casacca della squadra, l'uovo in braccio (con le braccia avanti) e, se è il mio, la freccia verso il nido
  decorate(av, id, f) {
    const E = f.ext as Ext;
    const team = E?.team[id];
    wearVest(av, team);
    let st = CARRY.get(av);
    if (!st || st.egg.parent !== av.deco) {
      const h = handEgg();
      const egg = new THREE.Mesh(h.geo, h.mats[0]);
      egg.castShadow = true;
      egg.visible = false;
      const arrow = new THREE.Group();
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 12), glow('#ffd60a', 1.3));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.45;
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), glow('#ffd60a', 1.3));
      tail.rotation.x = Math.PI / 2;
      arrow.add(head, tail);
      arrow.visible = false;
      av.deco.add(egg, arrow);
      st = { egg, arrow };
      CARRY.set(av, st);
    }
    const g = E && (f.view.stage === 'PLAY' || f.view.stage === 'RESULT') ? E.carry[id] : undefined;
    st.egg.visible = g !== undefined && av.body.visible;
    if (g !== undefined) {
      st.egg.material = handEgg().mats[g ? 1 : 0];
      st.egg.position.set(0, 1.0 + av.body.position.y, 0.66);
      st.egg.rotation.z = Math.sin(f.t * 8) * 0.12;
      av.armL.rotation.x = -1.2;
      av.armR.rotation.x = -1.2;
      av.armL.rotation.z = 0.5;
      av.armR.rotation.z = -0.5;
    }
    const mine = id === f.myId && g !== undefined && team !== undefined;
    st.arrow.visible = mine;
    if (mine) {
      const yaw = Math.atan2(nestX(team) - av.root.position.x, -av.root.position.z);
      st.arrow.rotation.y = yaw - av.root.rotation.y;
      st.arrow.position.set(0, 3.25 + Math.sin(f.t * 5) * 0.12, 0);
    }
  },
  status(h) {
    const E = h.ext as Ext;
    const t = E?.team[h.myId];
    if (!E || t === undefined) return null;
    const g = E.carry[h.myId];
    if (g !== undefined) return { text: g ? 'UOVO D’ORO! PORTALO AL TUO NIDO' : `PORTALO AL NIDO ${NEST_NAME[t]}!`, cls: 'sc-yellow pulse-soft' };
    if (h.view.playStart && h.now - h.view.playStart < 4500) return teamPill(t, `SEI DEI ${TEAM_NAME[t]}! NIDO ${NEST_NAME[t]}`);
    if (E.steal > h.now) return { text: 'UOVO RUBATO! PAUSA…', cls: 'sc-dark' };
    if (E.nest[1 - t]?.[0] && Math.hypot(h.me.x - nestX(1 - t), h.me.z) < UOVA.nestR + 3) return { text: 'TOCCA IL LORO NIDO: RUBA!', cls: 'sc-purple' };
    return null;
  },
  hud(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage === 'INTRO') return null;
    const mine = E.brought[h.myId] ?? 0;
    return <TeamScore score={E.score} myTeam={E.team[h.myId]} sub={mine ? `Le tue uova portate: ${mine}` : 'Uova nel nido · d’oro = 3'} />;
  },
  fx(p, c) {
    const E = c.view.ext as Ext;
    const myTeam = E?.team[c.myId];
    if (p.k === 'uova_lay') {
      layAt = performance.now() / 1000;
      layDir = Math.atan2(p.x, p.z);
      const d = Math.hypot(c.me.x, c.me.z);
      if (d < 16) soundManager.playPop();
      if (p.g) {
        popText(c.world, 0, 2.6, 0, 'UOVO D’ORO!', '#ffd60a', { scale: 1.3, life: 1.3 });
        burst(c.world, 0, 4, 0, ['#ffd60a', '#ffffff', '#fff3b0'], 30, 6);
        c.feed('La gallona ha fatto un uovo d’oro!');
      } else burst(c.world, 0, 3.6, 0, ['#ffffff', '#fffaf0'], 8, 3);
    } else if (p.k === 'uova_pick') {
      const at = c.where(p.id);
      if (p.id === c.myId) {
        soundManager.playPop();
        if (at) popText(c.world, at.x, at.y, at.z, p.g ? 'ORO!' : 'PRESO!', p.g ? '#ffd60a' : '#ffffff', { scale: 0.8 });
      } else if (p.g) c.feed(`${c.nameOf(p.id)} ha l’uovo d’oro`);
    } else if (p.k === 'uova_dep') {
      const nx = nestX(p.team);
      popText(c.world, nx, 1, 0, p.g ? '+3' : '+1', TEAM_COL[p.team], { scale: p.g ? 1.5 : 1.1 });
      burst(c.world, nx, 1, 0, [TEAM_COL[p.team], '#ffffff', '#ffd60a'], p.g ? 40 : 16, 5);
      if (p.id === c.myId) {
        soundManager.playSuccess();
        c.shake(0.2);
      } else if (p.team === myTeam) soundManager.playPop();
      if (p.g) c.feed(`${c.nameOf(p.id)} porta l’uovo d’oro ai ${TEAM_NAME[p.team]}!`);
    } else if (p.k === 'uova_steal') {
      const at = c.where(p.id);
      if (at) popText(c.world, at.x, at.y, at.z, 'LADRO!', '#b67bff');
      ringPulse(c.world, nestX(p.team), 0, 0, TEAM_COL[p.team]);
      if (p.team === myTeam) soundManager.playError();
      else soundManager.playWhoosh();
      c.feed(`${c.nameOf(p.id)} ruba un uovo${p.g ? ' D’ORO' : ''} ai ${TEAM_NAME[p.team]}!`);
    } else if (p.k === 'uova_drop') {
      const at = c.where(p.id);
      if (at) {
        popText(c.world, at.x, at.y, at.z, 'PERSO!', '#ff9f1c');
        burst(c.world, at.x, at.y + 1.2, at.z, p.g ? ['#ffd60a', '#ffffff'] : ['#fff3e0', '#ffd1dc', '#c9ecff'], 14, 4);
      }
      soundManager.playBonk();
      if (p.id === c.myId) c.shake(0.35);
      if (p.by && (p.g || p.by === c.myId)) c.feed(`${c.nameOf(p.by)} fa cadere l’uovo${p.g ? ' d’oro' : ''} a ${c.nameOf(p.id)}`);
    }
  },
});
