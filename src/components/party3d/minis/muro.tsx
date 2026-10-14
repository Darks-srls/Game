// 🧱 Il muro di lasagna (telefono): la teglia gratinata, i muri di lasagna a strati che salgono dal bordo e attraversano
// la teglia (porte a forma di omino), le corsie luminose per terra dove passano i buchi, il bordo da cui arriva il muro
// che lampeggia, la bussola "muro da…" e il conto alla rovescia
import * as THREE from 'three';
import { MURO, MURO_DIRS, muroCurrent, muroFirst, muroHeight, muroLife, muroPos, type MuroWall } from '../../../data/minis/muro';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, canvasTex, flagLine, glow, outlined, popText, rbox, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

const W = MURO.half * 2 + 2.4; // larghezza di un muro (sborda un po')
const LIM = MURO.th / 2 + 0.55;
const side = new Map<string, number>(); // da che parte di ogni muro sono (per il "PASSATO!")
let pushedBy = '';

// il prossimo muro che mi arriva addosso: quale, fra quanto, dove sono i buchi (coordinata laterale) e io dove sono
function threatFor(me: { x: number; z: number }, t: number, see: number) {
  const walls = muroCurrent();
  let best: { w: MuroWall; slab: number; tau: number; lat: number; along: number } | null = null;
  for (let k = muroFirst(t); k < walls.length; k++) {
    const w = walls[k];
    if (w.t0 > t + see) break;
    const D = MURO_DIRS[w.dir];
    const along = me.x * D.fx + me.z * D.fz;
    const lat = me.x * D.lx + me.z * D.lz;
    for (let slab = 0; slab < (w.type === 2 ? 2 : 1); slab++) {
      const s = muroPos(w, t) - slab * MURO.gap2;
      const d = along - s;
      if (d < -LIM + 0.05) continue;
      const tau = Math.max(0, d - LIM) / w.v;
      if (tau <= see && (!best || tau < best.tau)) best = { w, slab, tau, lat, along };
    }
  }
  return best;
}

// strati della lasagna (pasta, ragù, besciamella) per i muri e i fianchi della teglia
function layersTex() {
  return canvasTex(256, 256, (c) => {
    const bands: [string, number][] = [
      ['#f3cf6b', 34],
      ['#a63d2a', 38],
      ['#f8efd8', 22],
      ['#f3cf6b', 34],
      ['#b5482f', 40],
      ['#f8efd8', 24],
      ['#f3cf6b', 30],
      ['#a63d2a', 34],
    ];
    let y = 0;
    for (const [col, h] of bands) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, y + Math.sin(0) * 4);
      for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x / 20 + y) * 4);
      c.lineTo(256, y + h + 6);
      c.lineTo(0, y + h + 6);
      c.fill();
      if (col !== '#f8efd8' && col !== '#f3cf6b')
        for (let k = 0; k < 18; k++) {
          c.fillStyle = 'rgba(70,20,10,0.45)';
          c.beginPath();
          c.arc((k * 53) % 256, y + 8 + ((k * 17) % (h - 12)), 3 + (k % 3), 0, Math.PI * 2);
          c.fill();
        }
      y += h;
    }
  }, [0.25, 0.85]);
}

// la superficie gratinata della teglia
function gratinTex() {
  return canvasTex(1024, 1024, (c) => {
    c.fillStyle = '#f6e3b4';
    c.fillRect(0, 0, 1024, 1024);
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 160; k++) {
      const x = rnd() * 1024;
      const y = rnd() * 1024;
      const r = 14 + rnd() * 40;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(160,80,20,0.55)');
      g.addColorStop(1, 'rgba(160,80,20,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 90; k++) {
      c.fillStyle = k % 4 ? 'rgba(190,40,30,0.75)' : '#2f6b2f';
      c.beginPath();
      c.ellipse(rnd() * 1024, rnd() * 1024, 6 + rnd() * 9, 4 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // la griglia del "taglio a porzioni" (si capisce dove si è)
    c.strokeStyle = 'rgba(120,60,20,0.25)';
    c.lineWidth = 4;
    for (let k = 1; k < 5; k++) {
      c.beginPath();
      c.moveTo((k * 1024) / 5, 0);
      c.lineTo((k * 1024) / 5, 1024);
      c.moveTo(0, (k * 1024) / 5);
      c.lineTo(1024, (k * 1024) / 5);
      c.stroke();
    }
  });
}

// la sagoma di un muro: rettangolo col bordo "riccio" in alto e le porte a forma di omino (testa compresa)
function wallShape(h: number, holes: number[]) {
  const s = new THREE.Shape();
  const hw = MURO.holeW;
  const sorted = [...holes].sort((a, b) => a - b);
  s.moveTo(-W / 2, 0);
  for (const c of sorted) {
    s.lineTo(c - hw, 0);
    s.lineTo(c - hw, MURO.holeH - hw);
    s.absarc(c, MURO.holeH - hw, hw, Math.PI, 0, true);
    s.lineTo(c + hw, 0);
  }
  s.lineTo(W / 2, 0);
  // bordo riccio
  const n = Math.round(W / 0.35);
  for (let k = 0; k <= n; k++) {
    const x = W / 2 - (k / n) * W;
    s.lineTo(x, h + Math.sin(k * 1.8) * 0.1);
  }
  s.lineTo(-W / 2, 0);
  // la testa dell'omino sopra ogni porta (se ci sta)
  if (h > MURO.holeH + 0.9)
    for (const c of sorted) {
      const head = new THREE.Path();
      head.absarc(c, MURO.holeH + 0.5, 0.34, 0, Math.PI * 2, false);
      s.holes.push(head);
    }
  return s;
}

registerClientMini({
  kind: 'MURO',
  orbit: { c: [0, 0, 0], r: 30 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ffb703" to="#d00000">
      <rect x="14" y="22" width="72" height="60" rx="6" fill="#f3cf6b" {...stroke} />
      <path d="M14 42 H86 M14 62 H86" stroke="#a63d2a" strokeWidth={8} />
      <path d="M42 82 V56 a8 8 0 0 1 16 0 V82 Z" fill="#1d0f3d" />
      <circle cx="50" cy="42" r="5" fill="#1d0f3d" />
      <path d="M14 22 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0" fill="none" {...stroke} />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto · E schiaffo · infilati nel buco prima che arrivi il muro',
  feed: {
    caduto: ['{n} è stato spinto giù dalla lasagna', '{n} non ha trovato il buco', '{n} è finito sotto la besciamella'],
  },
  build(world) {
    const g = world.arena;
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -15;
    sh.right = sh.top = 15;
    const H = MURO.half * 2;
    // ---- la teglia: una lasagna gigante (sopra gratinata, ai lati gli strati)
    const layers = layersTex();
    const sideMat = toy('#ffffff', { map: layers, roughness: 0.55, clearcoat: 0.3 });
    const topMat = toy('#ffffff', { map: gratinTex(), roughness: 0.6, clearcoat: 0.25 });
    const slab = new THREE.Mesh(rbox(H, 2.4, H, 0.3), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    slab.position.y = -1.2;
    g.add(shadowy(slab));
    const panMat = new THREE.MeshStandardMaterial({ color: '#4a4e57', metalness: 0.8, roughness: 0.35 });
    const pan = new THREE.Mesh(rbox(H + 1.2, 1.2, H + 1.2, 0.4), panMat);
    pan.position.y = -2.7;
    g.add(pan);
    // i bordi: lampeggiano rossi da dove arriva il muro
    const edgeMats: THREE.MeshStandardMaterial[] = [];
    const edges: THREE.Mesh[] = [];
    for (let d = 0; d < 4; d++) {
      const D = MURO_DIRS[d];
      const m = glow('#ff1744', 0);
      const e = new THREE.Mesh(rbox(H + 0.6, 0.18, 0.5, 0.08), m);
      // il bordo da cui parte il muro: dietro, rispetto alla sua direzione
      e.position.set(-D.fx * (MURO.half + 0.05), 0.05, -D.fz * (MURO.half + 0.05));
      e.rotation.y = D.yaw; // lungo il bordo (asse x locale = laterale del muro)
      g.add(e);
      edgeMats.push(m);
      edges.push(e);
    }
    // corsie luminose per terra: dove passano i buchi del muro che arriva
    const laneMat = new THREE.MeshBasicMaterial({ color: '#ffe66d', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const lanes: THREE.Mesh[] = [];
    for (let k = 0; k < 4; k++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(MURO.holeW * 2 - 0.2, H), laneMat);
      l.rotation.x = -Math.PI / 2;
      l.position.y = 0.03;
      l.visible = false;
      g.add(l);
      lanes.push(l);
    }
    // ---- intorno: tovaglia laggiù, forno, ingredienti giganti, palloncini, bandierine
    const cloth = canvasTex(256, 256, (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
          c.fillRect(i * 32, j * 32, 32, 32);
        }
    }, [16, 16]);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -24;
    floor.receiveShadow = true;
    g.add(floor);
    const oven = new THREE.Group();
    const ovenBody = outlined(new THREE.Mesh(rbox(26, 18, 10, 2), toy('#8d99ae')), 1.01);
    ovenBody.position.y = 9;
    const mouth = new THREE.Mesh(rbox(18, 9, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: '#1b1b2f', roughness: 0.9 }));
    mouth.position.set(0, 8, 5.1);
    oven.add(ovenBody, mouth);
    const coils: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(7, 0.25, 8, 40, Math.PI), glow('#ff5400', 2));
      coil.position.set(0, 4.5 + k * 2.5, 5.2);
      coil.scale.y = 0.15;
      oven.add(coil);
      coils.push(coil);
    }
    oven.position.set(0, -24, -46);
    g.add(shadowy(oven));
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 3, 1, false, 0, Math.PI / 2.5), toy('#ffd166'));
    cheese.position.set(-34, -21, 6);
    const tomatoes: THREE.Mesh[] = [];
    for (let k = 0; k < 4; k++) {
      const tm = outlined(new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), toy('#e63946')), 1.03);
      tm.position.set(30 + (k % 2) * 6, -20.8, -10 + k * 7);
      tm.userData.ph = k;
      tomatoes.push(tm);
      g.add(shadowy(tm));
    }
    g.add(shadowy(cheese));
    for (const sz of [-1, 1]) g.add(flagLine(new THREE.Vector3(-16, 7, sz * 17), new THREE.Vector3(16, 7, sz * 17), 18));
    const balloons: THREE.Group[] = [];
    for (let k = 0; k < 8; k++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff'][k % 4]);
      const a = (k / 8) * Math.PI * 2 + 0.3;
      b.position.set(Math.sin(a) * 19, 3 + (k % 3) * 2, Math.cos(a) * 19);
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }
    // ---- i muri (creati quando arrivano, tolti quando spariscono); geometrie riusate per forma uguale
    const geoCache = new Map<string, THREE.ExtrudeGeometry>();
    const geoFor = (h: number, holes: number[]) => {
      const key = `${h}:${holes.join(',')}`;
      let geo = geoCache.get(key);
      if (!geo) {
        geo = new THREE.ExtrudeGeometry(wallShape(h, holes), { depth: MURO.th, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
        geo.translate(0, 0, -MURO.th / 2);
        geoCache.set(key, geo);
      }
      return geo;
    };
    const wallFace = toy('#ffffff', { map: layers, roughness: 0.5, clearcoat: 0.35 });
    const wallEdge = toy('#f6c445', { roughness: 0.45, clearcoat: 0.5, emissive: '#5a3a00', emissiveIntensity: 0.25 });
    const live = new Map<number, { root: THREE.Group; slabs: THREE.Mesh[] }>();

    return (f) => {
      const t = f.playT;
      const walls = muroCurrent();
      const seen = new Set<number>();
      const first = muroFirst(t);
      let soonDir = -1;
      let soonIn = Infinity;
      for (let k = first; k < walls.length && walls[k].t0 < t + 2.5; k++) {
        const w = walls[k];
        const s = muroPos(w, t);
        if (t > w.t0 + muroLife(w) + 0.5) continue;
        // il bordo da cui sta per entrare lampeggia
        const enter = (-MURO.half - LIM - s) / w.v;
        if (enter > -0.2 && enter < soonIn) {
          soonIn = enter;
          soonDir = w.dir;
        }
        if (w.t0 > t) continue;
        seen.add(k);
        let o = live.get(k);
        if (!o) {
          const root = new THREE.Group();
          const slabs: THREE.Mesh[] = [];
          for (let sl = 0; sl < (w.type === 2 ? 2 : 1); sl++) {
            const m = new THREE.Mesh(geoFor(muroHeight(w), w.type === 1 ? [] : sl ? w.holes2 : w.holes), [wallFace, wallEdge]);
            m.position.z = -sl * MURO.gap2;
            m.castShadow = true;
            m.receiveShadow = true;
            root.add(m);
            slabs.push(m);
          }
          root.rotation.y = MURO_DIRS[w.dir].yaw;
          g.add(root);
          // la telecamera non finisce dietro al muro: si avvicina
          world.camBlockers.push(...slabs);
          o = { root, slabs };
          live.set(k, o);
        }
        const D = MURO_DIRS[w.dir];
        o.root.position.set(D.fx * s, 0, D.fz * s);
        // sale da sotto il bordo quando arriva, riscende dall'altra parte
        const h = muroHeight(w) + 1.2;
        for (let sl = 0; sl < o.slabs.length; sl++) {
          const ss = s - sl * MURO.gap2;
          const rise = Math.min(1, Math.max(0, (ss - MURO.start) / 4.5));
          const sink = Math.min(1, Math.max(0, (ss - MURO.half - 0.8) / 3));
          const e = rise * rise * (3 - 2 * rise);
          o.slabs[sl].position.y = -h * (1 - e) - h * sink;
        }
      }
      for (const [k, o] of live)
        if (!seen.has(k)) {
          g.remove(o.root);
          live.delete(k);
          world.camBlockers = world.camBlockers.filter((b) => !o.slabs.includes(b as THREE.Mesh));
        }
      // bordi che lampeggiano e corsie dei buchi del muro che arriva per primo su di me
      for (let d = 0; d < 4; d++) edgeMats[d].emissiveIntensity = d === soonDir && soonIn < 2 && f.view.stage === 'PLAY' ? 1.4 + Math.sin(f.t * 18) * 1.2 : 0.15;
      const th = f.view.stage === 'PLAY' ? threatFor(f.me, t, 2.2) : null;
      for (let k = 0; k < lanes.length; k++) lanes[k].visible = false;
      if (th && th.w.type !== 1) {
        const D = MURO_DIRS[th.w.dir];
        const holes = th.slab ? th.w.holes2 : th.w.holes;
        holes.forEach((c, k) => {
          if (k >= lanes.length) return;
          const l = lanes[k];
          l.visible = true;
          l.position.set(D.lx * c, 0.03, D.lz * c);
          l.rotation.z = D.fx !== 0 ? Math.PI / 2 : 0;
        });
        laneMat.opacity = 0.18 + (1 - Math.min(1, th.tau / 2.2)) * 0.3 + Math.sin(f.t * 10) * 0.05;
      }
      for (const c of coils) (c.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(f.t * 3 + c.position.y) * 0.5;
      for (const tm of tomatoes) tm.rotation.y = Math.sin(f.t * 0.5 + tm.userData.ph) * 0.4;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.5;
    };
  },
  // sul telefono: "PASSATO!" quando un muro mi passa (dal buco o sopra), un colpo quando mi prende
  local(f, world) {
    const me = f.me;
    if (f.view.stage !== 'PLAY' || !f.view.alive[f.myId] || me.y < -1) return;
    const t = f.playT;
    const walls = muroCurrent();
    let pushed = '';
    for (let k = muroFirst(t); k < walls.length && walls[k].t0 <= t; k++) {
      const w = walls[k];
      const D = MURO_DIRS[w.dir];
      const along = me.x * D.fx + me.z * D.fz;
      for (let sl = 0; sl < (w.type === 2 ? 2 : 1); sl++) {
        const d = along - (muroPos(w, t) - sl * MURO.gap2);
        const key = `${k}:${sl}`;
        const before = side.get(key);
        const now = d > 0 ? 1 : -1;
        side.set(key, now);
        if (Math.abs(d) < LIM + 0.02 && me.y < muroHeight(w) - 0.05) pushed = key;
        if (before === 1 && now === -1 && Math.abs(d) < 2) {
          popText(world, me.x, me.y, me.z, w.type === 1 ? 'SOPRA!' : 'PASSATO!', '#06d6a0', { scale: 0.9 });
          soundManager.playPop();
        }
      }
    }
    if (pushed && pushed !== pushedBy) soundManager.playBonk();
    pushedBy = pushed;
    if (side.size > 60) side.clear();
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const th = threatFor(h.me, t, 2.2);
    if (!th) return { text: 'TIENITI AL CENTRO E GUARDATI INTORNO', cls: 'sc-dark' };
    if (th.w.type === 1) return { text: th.tau < 0.8 ? 'MURO BASSO: SALTA!' : 'MURO BASSO IN ARRIVO', cls: th.tau < 0.8 ? 'sc-red pulse-soft' : 'sc-yellow' };
    const holes = th.slab ? th.w.holes2 : th.w.holes;
    const c = holes.reduce((a, b) => (Math.abs(b - th.lat) < Math.abs(a - th.lat) ? b : a), holes[0]);
    if (Math.abs(c - th.lat) < MURO.holeW - 0.2) return { text: 'SEI NEL BUCO: STAI LÌ!', cls: 'sc-green' };
    // da che parte è il buco, rispetto alla telecamera
    const D = MURO_DIRS[th.w.dir];
    const wx = (c - th.lat) * D.lx;
    const wz = (c - th.lat) * D.lz;
    const right = wx * -Math.cos(h.yaw) + wz * Math.sin(h.yaw);
    const dirTxt = right > 0 ? 'A DESTRA ▶' : '◀ A SINISTRA';
    const dbl = th.w.type === 2 ? 'MURO DOPPIO! ' : '';
    if (th.tau < 0.05) return { text: `SCIVOLA AL BUCO ${dirTxt}`, cls: 'sc-red pulse-soft' };
    return { text: `${dbl}IL BUCO È ${dirTxt}`, cls: th.tau < 1 ? 'sc-red pulse-soft' : 'sc-yellow' };
  },
  // bussola: da dove arriva il prossimo muro (girata come la telecamera) e fra quanto
  hud(h: HudCtx) {
    if (h.view.stage !== 'PLAY') return null;
    const t = h.view.playStart ? (h.now - h.view.playStart) / 1000 : 0;
    const walls = muroCurrent();
    let next: MuroWall | null = null;
    let inS = 0;
    for (let k = muroFirst(t); k < walls.length; k++) {
      const w = walls[k];
      const enter = (-MURO.half - LIM - muroPos(w, t)) / w.v;
      if (enter > 0) {
        next = w;
        inS = enter;
        break;
      }
    }
    if (!next) return null;
    const D = MURO_DIRS[next.dir];
    // il muro arriva da -f: angolo sullo schermo (0 = in alto, avanti)
    const ox = -D.fx;
    const oz = -D.fz;
    const sx = ox * -Math.cos(h.yaw) + oz * Math.sin(h.yaw);
    const sy = ox * Math.sin(h.yaw) + oz * Math.cos(h.yaw);
    const ang = (Math.atan2(sx, sy) * 180) / Math.PI;
    const kind = next.type === 1 ? 'BASSO' : next.type === 2 ? 'DOPPIO' : next.holes.length > 1 ? '2 BUCHI' : '1 BUCO';
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex items-center gap-2">
        <svg width="56" height="56" viewBox="-28 -28 56 56" aria-hidden="true">
          <circle r="26" fill="#1d0f3d" opacity="0.6" />
          <circle r="24" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />
          <g transform={`rotate(${ang})`}>
            <rect x="-13" y="-25" width="26" height="8" rx="3" fill="#f3cf6b" stroke="#1d0f3d" strokeWidth="2.5" />
            <path d="M0 -12 L7 -2 H-7 Z" fill="#ff4d6d" stroke="#1d0f3d" strokeWidth="2" transform="rotate(180 0 -7)" />
          </g>
          <circle r="5" fill="#ffd60a" stroke="#1d0f3d" strokeWidth="2.5" />
        </svg>
        <p className="sc-chip px-2.5 py-1 text-xs font-black leading-tight text-white">
          MURO {kind}
          <br />
          <span className={inS < 1.5 ? 'text-red-300' : 'text-amber-200'}>tra {Math.max(0, inS).toFixed(1)} s</span>
        </p>
      </div>
    );
  },
});
