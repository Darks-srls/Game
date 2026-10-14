// 🍝 Spaghetto (telefono): tovaglia a quadri chiusa dai grissini, le scie di spaghetti colorati (un InstancedMesh
// di pezzetti, leggero), la minimappa dall'alto e l'avviso "SALTA!" quando hai uno spaghetto davanti
import * as THREE from 'three';
import { SPAG, decodeTrail } from '../../../data/minis/spaghetto';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, matte, outlined, popText, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { ids: string[]; life: number; tr: string[] } | null;
const ids = (E: NonNullable<Ext>) => E.ids;

// le scie sul telefono: un pezzetto per ogni mezzo metro, in un anello di posti (i più vecchi spariscono per primi)
const MAX = 4096;
const segOwner = new Int16Array(MAX);
const segBorn = new Float64Array(MAX); // ms (orologio del telefono)
const segAX = new Float32Array(MAX);
const segAZ = new Float32Array(MAX);
const segBX = new Float32Array(MAX);
const segBZ = new Float32Array(MAX);
let head = 0; // prossimo posto libero
let tail = 0; // il più vecchio ancora vivo
const lastPt = new Map<number, { x: number; z: number }>();
let lastSp = 0; // quando sono arrivati gli ultimi pezzi
let dirty: number[] = []; // posti da ridisegnare
let life = SPAG.life;
let round = -1;

function clearTrails() {
  head = 0;
  tail = 0;
  lastPt.clear();
  dirty = [];
}
function addPoint(owner: number, x: number, z: number, born: number) {
  const L = lastPt.get(owner);
  lastPt.set(owner, { x, z });
  if (!L || Math.hypot(x - L.x, z - L.z) > 1.2) return;
  if (head - tail >= MAX) tail = head - MAX + 1;
  const k = head % MAX;
  segOwner[k] = owner;
  segBorn[k] = born;
  segAX[k] = L.x;
  segAZ[k] = L.z;
  segBX[k] = x;
  segBZ[k] = z;
  dirty.push(head);
  head++;
}
// chi si collega a metà (o si è perso dei pezzi): le scie dallo stato
function rebuild(E: NonNullable<Ext>) {
  clearTrails();
  const now = Date.now();
  E.tr.forEach((code, owner) => {
    if (!code) return;
    const parts = code.split(',');
    const a0 = Number(parts[3] ?? 0) * 100;
    const aN = Number(parts[4] ?? 0) * 100;
    const pts = decodeTrail(parts.slice(0, 3).join(','));
    pts.forEach((p, i) => addPoint(owner, p.x, p.z, now - (a0 + ((aN - a0) * i) / Math.max(1, pts.length - 1))));
  });
  // (i pezzi di giocatori diversi si mescolano: li rimetto in ordine di età, così i vecchi spariscono per primi)
  const n = head - tail;
  const order = Array.from({ length: n }, (_, i) => (tail + i) % MAX).sort((a, b) => segBorn[a] - segBorn[b]);
  const copy = order.map((k) => [segOwner[k], segBorn[k], segAX[k], segAZ[k], segBX[k], segBZ[k]] as const);
  copy.forEach((c, i) => {
    segOwner[i] = c[0];
    segBorn[i] = c[1];
    segAX[i] = c[2];
    segAZ[i] = c[3];
    segBX[i] = c[4];
    segBZ[i] = c[5];
  });
  head = n;
  tail = 0;
  dirty = Array.from({ length: n }, (_, i) => i);
  lastSp = Date.now();
}

const tableTex = () =>
  canvasTex(
    256,
    256,
    (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? '#fff7ec' : '#e63946';
          c.fillRect(i * 32, j * 32, 32, 32);
        }
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      c.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        c.beginPath();
        c.moveTo(i * 32, 0);
        c.lineTo(i * 32, 256);
        c.moveTo(0, i * 32);
        c.lineTo(256, i * 32);
        c.stroke();
      }
    },
    [SPAG.half / 2, SPAG.half / 2],
  );

registerClientMini({
  kind: 'SPAGHETTO',
  orbit: { c: [0, 0, 0], r: 34 },
  highCam: true,
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffe08a" to="#e76f51">
      <path d="M18 74 C 30 40, 46 86, 56 54 S 76 30, 84 50" fill="none" stroke="#1d0f3d" strokeWidth={13} strokeLinecap="round" />
      <path d="M18 74 C 30 40, 46 86, 56 54 S 76 30, 84 50" fill="none" stroke="#ffd166" strokeWidth={7} strokeLinecap="round" />
      <circle cx="84" cy="50" r="9" fill="#9c4a1a" {...stroke} />
      <circle cx="26" cy="30" r="5" fill="#e63946" {...stroke} />
      <circle cx="44" cy="22" r="4" fill="#e63946" {...stroke} />
    </Badge>
  ),
  hint: 'Corri sempre: WASD o mouse per girare · spazio salta sopra gli spaghetti · Shift scatto · non toccare scie e grissini!',
  feed: {
    spaghetto: ['{n} si è aggrovigliato', '{n} è finito nello spaghetto', '{n} si è fatto la forchettata'],
    suo: ['{n} si è mangiato da solo', '{n} è inciampato nel suo spaghetto'],
    muro: ['{n} ha sbattuto nei grissini', '{n} ha rotto un grissino'],
  },
  build(world) {
    const g = world.arena;
    clearTrails();
    round = -1;
    const H = SPAG.half;
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -H - 3;
    sh.right = sh.top = H + 3;
    // la tavola: tovaglia a quadri sopra un grande tagliere di legno
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), matte('#ffffff', { map: tableTex() }));
    cloth.rotation.x = -Math.PI / 2;
    cloth.receiveShadow = true;
    const board = outlined(new THREE.Mesh(new THREE.BoxGeometry(H * 2 + 6, 1.4, H * 2 + 6), toy('#c98b4e', { roughness: 0.7 })), 1.01);
    board.position.y = -0.72;
    g.add(cloth, shadowy(board));
    // i bordi di grissini (due file, con i pali)
    const stick = new THREE.CylinderGeometry(0.16, 0.16, H * 2 + 0.6, 10);
    stick.rotateZ(Math.PI / 2);
    const stickM = toy('#e8b46a', { roughness: 0.75 });
    for (let side = 0; side < 4; side++) {
      for (const y of [0.35, 0.8]) {
        const m = new THREE.Mesh(stick, stickM);
        const along = side < 2;
        m.position.set(along ? 0 : (side === 2 ? 1 : -1) * (H + 0.15), y, along ? (side === 0 ? 1 : -1) * (H + 0.15) : 0);
        if (!along) m.rotation.y = Math.PI / 2;
        m.castShadow = true;
        g.add(m);
      }
    }
    const N = 40;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), toy('#d99a4e', { roughness: 0.7 }), N);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const side = i % 4;
      const k = Math.floor(i / 4) / (N / 4 - 1);
      const u = -H + k * H * 2;
      tmp.position.set(side < 2 ? u : (side === 2 ? 1 : -1) * (H + 0.15), 0.65, side < 2 ? (side === 0 ? 1 : -1) * (H + 0.15) : u);
      tmp.updateMatrix();
      posts.setMatrixAt(i, tmp.matrix);
    }
    g.add(posts);
    // decorazioni intorno (basse o lontane): forchettoni piantati, polpette, palloncini
    const fork = (x: number, z: number, r: number) => {
      const f = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.8, roughness: 0.25 });
      const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 0.5), steel);
      handle.position.y = 7;
      f.add(handle);
      for (let i = 0; i < 4; i++) {
        const tine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), steel);
        tine.position.set(-1.2 + i * 0.8, 16, 0);
        f.add(tine);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.4), steel);
      bridge.position.y = 14;
      f.add(bridge);
      f.position.set(x, 0, z);
      f.rotation.set(0, r, 0.15);
      return shadowy(f);
    };
    g.add(fork(-H - 9, -H + 4, 0.4), fork(H + 10, H - 6, -0.6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const ball = outlined(new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), toy('#8a4422', { roughness: 0.85 })), 1.04);
      ball.position.set(Math.sin(a) * (H + 7), 1.6, Math.cos(a) * (H + 7));
      g.add(shadowy(ball));
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff'][i % 4]);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.sin(a) * (H + 5), 6 + (i % 3) * 2, Math.cos(a) * (H + 5));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }

    // gli spaghetti: tutti i pezzetti in un solo InstancedMesh (colorato pezzo per pezzo)
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 1, 7, 1);
    geo.rotateX(Math.PI / 2); // lungo z
    const mat = toy('#ffffff', { roughness: 0.35, clearcoat: 0.6 });
    const segs = new THREE.InstancedMesh(geo, mat, MAX);
    segs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    segs.frustumCulled = false;
    segs.castShadow = false;
    segs.receiveShadow = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) segs.setMatrixAt(i, zero);
    segs.setColorAt(0, new THREE.Color('#ffffff'));
    g.add(segs);
    const col = new THREE.Color();
    const sauce = new THREE.Color('#c4231b');
    const colors = new Map<number, THREE.Color>();
    const colorOf = (owner: number, ids: string[], f: { view: { roster: { id: string; color: string }[] } }) => {
      let c = colors.get(owner);
      if (!c) {
        const r = f.view.roster.find((x) => x.id === ids[owner]);
        c = new THREE.Color(r?.color ?? '#ffd166').lerp(sauce, 0.18);
        colors.set(owner, c);
      }
      return c;
    };
    const place = (k: number, scale: number) => {
      const ax = segAX[k];
      const az = segAZ[k];
      const bx = segBX[k];
      const bz = segBZ[k];
      const len = Math.hypot(bx - ax, bz - az) + 0.12;
      tmp.position.set((ax + bx) / 2, 0.17 * scale, (az + bz) / 2);
      tmp.rotation.set(0, Math.atan2(bx - ax, bz - az), 0);
      tmp.scale.set(scale, scale, len);
      tmp.updateMatrix();
      segs.setMatrixAt(k, tmp.matrix);
    };

    return (f) => {
      const E = f.ext as Ext;
      if (E) life = E.life || SPAG.life;
      // giro nuovo: si ricomincia pulito
      if (f.view.round !== round) {
        round = f.view.round;
        clearTrails();
        colors.clear();
        for (let i = 0; i < MAX; i++) segs.setMatrixAt(i, zero);
        segs.instanceMatrix.needsUpdate = true;
      }
      // mi mancano dei pezzi (mi sono appena collegato o la rete ha perso qualcosa): li prendo dallo stato
      if (E && f.view.stage === 'PLAY' && Date.now() - lastSp > 1500 && E.tr.some((x) => x)) {
        for (let i = 0; i < MAX; i++) segs.setMatrixAt(i, zero);
        rebuild(E);
      }
      const ids = E?.ids ?? [];
      const now = Date.now();
      let changed = false;
      // i pezzi nuovi
      if (dirty.length) {
        for (const n of dirty) {
          const k = n % MAX;
          place(k, 1);
          segs.setColorAt(k, col.copy(colorOf(segOwner[k], ids, f)));
        }
        dirty = [];
        changed = true;
        if (segs.instanceColor) segs.instanceColor.needsUpdate = true;
      }
      // quelli vecchi si assottigliano e spariscono
      while (tail < head && now - segBorn[tail % MAX] > life) {
        segs.setMatrixAt(tail % MAX, zero);
        tail++;
        changed = true;
      }
      for (let n = tail; n < head; n++) {
        const k = n % MAX;
        const left = life - (now - segBorn[k]);
        if (left > 900) break;
        place(k, Math.max(0.05, left / 900));
        changed = true;
      }
      if (changed) segs.instanceMatrix.needsUpdate = true;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  // l'anello colorato per terra: si capisce di chi è ogni spaghetto
  decorate(av, id, f) {
    if (f.view.stage === 'END') return;
    av.ring.visible = f.view.alive[id] !== false;
    const r = f.view.roster.find((x) => x.id === id);
    if (r) (av.ring.material as THREE.MeshBasicMaterial).color.set(r.color);
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    // c'è uno spaghetto qui davanti? (e sono per terra)
    if (h.me.y < SPAG.safeY) {
      const a = h.me.r;
      const fx = Math.sin(a);
      const fz = Math.cos(a);
      const now = Date.now();
      const E = h.ext as Ext;
      const me = E ? E.ids.indexOf(h.myId) : -1;
      let near = false;
      for (let n = Math.max(tail, head - 3000); n < head && !near; n++) {
        const k = n % MAX;
        if (segOwner[k] === me && head - n < 8) continue;
        if (now - segBorn[k] > life) continue;
        const dx = segBX[k] - h.me.x;
        const dz = segBZ[k] - h.me.z;
        const along = dx * fx + dz * fz;
        if (along < 0.4 || along > 2.6) continue;
        if (Math.abs(dx * fz - dz * fx) < 0.6) near = true;
      }
      if (near) return { text: 'SALTA! SPAGHETTO DAVANTI', cls: 'sc-red pulse-soft' };
    }
    const wall = SPAG.half - Math.max(Math.abs(h.me.x), Math.abs(h.me.z));
    if (wall < 3) return { text: 'GIRA! I GRISSINI!', cls: 'sc-yellow pulse-soft' };
    const left = Object.values(h.view.alive).filter(Boolean).length;
    return { text: left <= 2 ? 'ULTIMO DUELLO!' : 'NON TOCCARE GLI SPAGHETTI', cls: left <= 2 ? 'sc-purple' : 'sc-dark' };
  },
  // minimappa dall'alto: scie e teste di tutti
  hud(h: HudCtx) {
    if (h.view.stage !== 'PLAY') return null;
    const E = h.ext as Ext;
    if (!E) return null;
    const S = 116;
    const k = S / (SPAG.half * 2);
    const px = (x: number) => (x + SPAG.half) * k;
    const pz = (z: number) => (SPAG.half - z) * k;
    const now = Date.now();
    const lines = new Map<number, string>();
    const lastN = new Map<number, number>();
    for (let n = tail; n < head; n++) {
      const i = n % MAX;
      if (now - segBorn[i] > life) continue;
      const o = segOwner[i];
      const ln = lastN.get(o);
      // (un punto ogni due basta; si riparte se c'è un buco)
      if (ln !== undefined && n - ln < 2 * ids(E).length) continue;
      const pt = `${px(segBX[i]).toFixed(1)},${pz(segBZ[i]).toFixed(1)}`;
      lines.set(o, (lines.get(o) ?? '') + (ln !== undefined && n - ln <= 40 ? ' L' : ' M') + pt);
      lastN.set(o, n);
    }
    const heads: { id: string; x: number; z: number }[] = [];
    for (const [id, o] of h.others) if (h.view.alive[id]) heads.push({ id, x: o.x, z: o.z });
    if (h.alive) heads.push({ id: h.myId, x: h.me.x, z: h.me.z });
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] rounded-xl border-[3px] border-[#1d0f3d] bg-[#fff7ec]/80 p-0.5 shadow">
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
          <rect x="0" y="0" width={S} height={S} rx="6" fill="none" stroke="#d99a4e" strokeWidth="3" />
          {[...lines.entries()].map(([o, d]) => (
            <path key={o} d={d} fill="none" stroke={h.colorOf(E.ids[o] ?? '')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          ))}
          {heads.map((p) => (
            <circle key={p.id} cx={px(p.x)} cy={pz(p.z)} r={p.id === h.myId ? 4.2 : 3} fill={h.colorOf(p.id)} stroke={p.id === h.myId ? '#ffffff' : '#1d0f3d'} strokeWidth="1.6" />
          ))}
        </svg>
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'sp') {
      const d: number[] = p.d ?? [];
      const now = Date.now();
      for (let i = 0; i + 2 < d.length; i += 3) addPoint(d[i], d[i + 1] / 10, d[i + 2] / 10, now);
      lastSp = now;
    } else if (p.k === 'sp_hit') {
      burst(c.world, p.x, 0.4, p.z, ['#c4231b', '#ffd166', '#ff8a7a', '#ffffff'], 40, 6);
      popText(c.world, p.x, 0, p.z, p.id === p.by ? 'OPS!' : 'SPLAT!', '#ff4d6d', { scale: 1.2 });
      if (p.id === c.myId) c.shake(0.6);
      else if (p.by === c.myId) {
        soundManager.playSuccess();
        c.feed(`${c.nameOf(p.id)} è finito nel tuo spaghetto!`);
      }
    }
  },
});
