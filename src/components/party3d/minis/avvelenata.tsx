// 🟤 Palla avvelenata (telefono): il campo è un tagliere gigante alla sagra della polpetta, la linea di metà è uno
// spaghettone, le palle sono polpette di gomma (in mano, in volo con la stessa parabola del server, a terra)
import * as THREE from 'three';
import { AVV, flyAt } from '../../../data/minis/avvelenata';
import { TEAM_COL, TEAM_NAME } from '../../../data/minis/squadre';
import { soundManager } from '../../../utils/audio';
import { Badge, INK, stroke } from '../icons';
import { burst, canvasTex, glow, matte, outlined, popText, rbox, ringPulse, shadowy, toy, type Avatar } from '../scene';
import { TeamScore, teamPill, wearVest } from './squadre';
import { registerClientMini, type HudCtx } from './types';

type Ext = { team: Record<string, number>; my?: number; balls: [number, string | null, number][]; outs: Record<string, number> } | null;

// lanci visti arrivare (per disegnare la parabola esatta) e chi ha appena lanciato (braccio)
const flights = new Map<number, { seq: number; at: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; team: number }>();
const throwAnim = new Map<string, number>();
let myReady = 0; // ricarica del mio lancio (orologio del telefono)
let danger = 0; // una polpetta avversaria mi sta arrivando addosso (per la scritta)

let meatTex: THREE.Texture | null = null;
const meatTexture = () =>
  (meatTex ??= canvasTex(128, 64, (c) => {
    c.fillStyle = '#8a4b2a';
    c.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = ['#6b3820', '#a35d36', '#5a2e19', '#b8693c'][i % 4];
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 64, 2 + Math.random() * 5, 0, Math.PI * 2);
      c.fill();
    }
    // sugo e prezzemolo
    for (let i = 0; i < 14; i++) {
      c.fillStyle = i % 3 ? 'rgba(214,40,40,0.75)' : '#2d9c4a';
      c.beginPath();
      c.arc(Math.random() * 128, Math.random() * 64, i % 3 ? 5 : 2, 0, Math.PI * 2);
      c.fill();
    }
  }));
let meatGeo: THREE.BufferGeometry | null = null;
let meatMat: THREE.Material | null = null;
const meatball = () => {
  meatGeo ??= new THREE.IcosahedronGeometry(AVV.ballR, 3);
  meatMat ??= toy('#ffffff', { map: meatTexture(), roughness: 0.55, clearcoat: 0.5 });
  return outlined(new THREE.Mesh(meatGeo, meatMat), 1.08);
};
const HAND = new WeakMap<Avatar, THREE.Mesh>();

const myTeamOf = (E: Ext, id: string) => E?.team[id];
const holding = (E: Ext, id: string) => !!E && E.balls.some(([st, h]) => st === 1 && h === id);

// LANCIA: verso dove guarda la telecamera, con un piccolo aiuto se c'è un avversario vicino alla mira (anche in corsa)
function throwNow(h: HudCtx) {
  const E = h.ext as Ext;
  if (!E || !holding(E, h.myId) || Date.now() < myReady) return;
  const t = E.team[h.myId];
  const b = h.me;
  let a = h.yaw;
  let best = h.coarse ? AVV.assistTouch : AVV.assist;
  for (const [id, o] of h.others) {
    if (!h.view.alive[id] || E.team[id] === t || o.y < -1) continue;
    const d0 = Math.hypot(o.x - b.x, o.z - b.z);
    const ft = d0 / AVV.speed + 0.12;
    const px = o.x + (o.vx ?? 0) * ft;
    const pz = o.z + (o.vz ?? 0) * ft;
    const d = Math.hypot(px - b.x, pz - b.z);
    if (d > 16 || d < 0.5) continue;
    let da = Math.atan2(px - b.x, pz - b.z) - h.yaw;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < best) {
      best = Math.abs(da);
      a = Math.atan2(px - b.x, pz - b.z);
    }
  }
  b.r = a;
  myReady = Date.now() + AVV.reload;
  throwAnim.set(h.myId, performance.now());
  h.act('MG_AVV_LANCIA', { a });
  soundManager.playWhoosh();
}

// il tagliere: venature del legno, metà campo velate del colore delle squadre, righe bianche
function boardTexture() {
  const PX = 32;
  const W = AVV.halfX * 2;
  const D = AVV.halfZ * 2;
  return canvasTex(W * PX, D * PX, (c) => {
    c.fillStyle = '#e4b781';
    c.fillRect(0, 0, W * PX, D * PX);
    for (let i = 0; i < W * PX; i += 64) {
      c.fillStyle = (i / 64) % 2 ? 'rgba(160,100,50,0.10)' : 'rgba(255,255,255,0.06)';
      c.fillRect(i, 0, 64, D * PX);
    }
    c.strokeStyle = 'rgba(140,85,40,0.35)';
    c.lineWidth = 2;
    for (let k = 0; k < 70; k++) {
      const x = Math.random() * W * PX;
      c.beginPath();
      c.moveTo(x, 0);
      for (let y = 0; y <= D * PX; y += 40) c.lineTo(x + Math.sin(y / 60 + k) * 6, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(255,59,92,0.16)';
    c.fillRect(0, 0, W * PX, (D / 2) * PX);
    c.fillStyle = 'rgba(58,134,255,0.16)';
    c.fillRect(0, (D / 2) * PX, W * PX, (D / 2) * PX);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 10;
    c.strokeRect(10, 10, W * PX - 20, D * PX - 20);
    // linee d'attacco (a 3 metri dalla metà) tratteggiate
    c.setLineDash([24, 18]);
    c.lineWidth = 6;
    for (const z of [-3, 3]) {
      const y = (z + AVV.halfZ) * PX;
      c.beginPath();
      c.moveTo(10, y);
      c.lineTo(W * PX - 10, y);
      c.stroke();
    }
  });
}

registerClientMini({
  kind: 'AVVELENATA',
  orbit: { c: [0, 0, 0], r: 26 },
  highCam: true,
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffadad" to="#9d0208">
      <path d="M12 50 h76" stroke="#ffd166" strokeWidth="7" strokeLinecap="round" />
      <path d="M12 50 h76" stroke={INK} strokeWidth="2" strokeDasharray="6 6" />
      <path d="M22 78 q14 -40 40 -46" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="2 8" />
      <circle cx="66" cy="30" r="15" fill="#8a4b2a" {...stroke} />
      <circle cx="61" cy="25" r="4" fill="#d62828" />
      <circle cx="71" cy="34" r="3" fill="#2d9c4a" />
      <rect x="18" y="62" width="16" height="22" rx="5" fill="#ff3b5c" {...stroke} strokeWidth="3" />
      <rect x="70" y="56" width="16" height="22" rx="5" fill="#3a86ff" {...stroke} strokeWidth="3" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift SCATTO (se arriva la palla la prendi al volo!) · E o clic LANCIA verso il mirino',
  build(world) {
    const g = world.arena;
    flights.clear();
    throwAnim.clear();
    myReady = 0;
    danger = 0;
    const W = AVV.halfX * 2;
    const D = AVV.halfZ * 2;
    // la piazza della sagra intorno
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(120, 48), matte('#c9b48f'));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = -0.62;
    plaza.receiveShadow = true;
    g.add(plaza);
    // il tagliere gigante (campo) col bordo scuro
    const board = new THREE.Mesh(rbox(W + 1.6, 0.6, D + 1.6, 0.3), toy('#b07a46', { clearcoat: 0.2 }));
    board.position.y = -0.31;
    board.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), matte('#ffffff', { map: boardTexture() }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.002;
    top.receiveShadow = true;
    g.add(board, top);
    // sponde imbottite (del colore della squadra della metà)
    for (const t of [0, 1]) {
      const sz = t ? 1 : -1;
      const m = toy(TEAM_COL[t], { clearcoat: 0.3 });
      for (const sx of [-1, 1]) {
        const w = outlined(new THREE.Mesh(rbox(0.5, 1, AVV.halfZ, 0.2), m), 1.03);
        w.position.set(sx * (AVV.halfX + 0.25), 0.5, sz * (AVV.halfZ / 2));
        g.add(shadowy(w));
      }
      const back = outlined(new THREE.Mesh(rbox(W + 1, 1, 0.5, 0.2), m), 1.02);
      back.position.set(0, 0.5, sz * (AVV.halfZ + 0.25));
      g.add(shadowy(back));
    }
    // lo spaghettone sulla linea di metà (non si passa) con le bandierine
    const spaghetto = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, W, 12), toy('#ffd166', { clearcoat: 0.6 }));
    spaghetto.rotation.z = Math.PI / 2;
    spaghetto.position.y = 0.12;
    g.add(spaghetto);
    const lineGlowM = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.4, toneMapped: false, depthWrite: false });
    const lineGlow = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.7), lineGlowM);
    lineGlow.rotation.x = -Math.PI / 2;
    lineGlow.position.y = 0.01;
    g.add(lineGlow);
    for (const sx of [-1, 1]) {
      const fork = new THREE.Group();
      const handle = outlined(new THREE.Mesh(rbox(0.35, 4.2, 0.2, 0.08), toy('#d9d9d9', { metalness: 0.7, roughness: 0.25 })), 1.05);
      handle.position.y = 4.6;
      fork.add(handle);
      for (let k = 0; k < 4; k++) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), toy('#d9d9d9', { metalness: 0.7, roughness: 0.25 }));
        tine.position.set(-0.36 + k * 0.24, 1.3, 0);
        fork.add(tine);
      }
      const neck = new THREE.Mesh(rbox(1, 0.4, 0.2, 0.08), toy('#d9d9d9', { metalness: 0.7, roughness: 0.25 }));
      neck.position.y = 2.5;
      fork.add(neck);
      fork.position.set(sx * (AVV.halfX + 1.6), 0, 0);
      fork.rotation.z = sx * 0.12;
      g.add(shadowy(fork));
      world.camBlockers.push(fork);
    }
    // il pentolone del sugo che fuma (da lì vengono le polpette)
    const pot = new THREE.Group();
    const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.8, 4, 32, 1, true), toy('#9aa5b1', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })), 1.02);
    body.position.y = 2;
    const sauce = new THREE.Mesh(new THREE.CircleGeometry(3.1, 32), toy('#c1121f', { clearcoat: 0.9, roughness: 0.15 }));
    sauce.rotation.x = -Math.PI / 2;
    sauce.position.y = 3.6;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 10, 40), toy('#6c757d', { metalness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 4;
    pot.add(body, sauce, rim);
    for (let k = 0; k < 5; k++) {
      const mb = meatball();
      mb.scale.setScalar(3);
      mb.position.set(Math.sin(k * 1.3) * 1.6, 3.8, Math.cos(k * 1.3) * 1.6);
      pot.add(mb);
    }
    const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), toy('#6c757d', { metalness: 0.6 }));
    ladle.position.set(1.2, 5, 0.6);
    ladle.rotation.z = -0.45;
    pot.add(ladle);
    pot.position.set(-AVV.halfX - 10, 0, -4);
    g.add(shadowy(pot));
    world.camBlockers.push(pot);
    const steamM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 1 });
    const steamGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const steam = Array.from({ length: 7 }, (_, i) => {
      const s = new THREE.Mesh(steamGeo, steamM);
      s.userData.ph = i / 7;
      g.add(s);
      return s;
    });
    // tribuna col pubblico della sagra (che salta quando qualcuno va fuori)
    const crowdN = 90;
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), toy('#ffffff'), crowdN);
    const base: { x: number; y: number; z: number; ph: number }[] = [];
    for (let row = 0; row < 3; row++) {
      const step = outlined(new THREE.Mesh(rbox(2, 1 + row * 1.1, D + 2, 0.15), toy(row % 2 ? '#ffbe0b' : '#fb8500')), 1.01);
      step.position.set(AVV.halfX + 4 + row * 2, (1 + row * 1.1) / 2 - 0.2, 0);
      g.add(shadowy(step));
      world.camBlockers.push(step);
      for (let k = 0; k < 30; k++) {
        const i = base.length;
        base.push({ x: AVV.halfX + 4 + row * 2 + (Math.random() - 0.5) * 0.5, y: 1 + row * 1.1 + 0.35, z: -D / 2 + 0.8 + k * ((D - 1.6) / 29), ph: Math.random() * 6 });
        crowd.setColorAt(i, new THREE.Color(k % 3 === 0 ? TEAM_COL[k % 2] : ['#ffd60a', '#ffffff', '#06d6a0', '#ff70a6'][(k + row) % 4]));
      }
    }
    crowd.castShadow = true;
    g.add(crowd);
    // lucine della sagra appese sopra il campo
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), glow('#fff3b0', 2.6), 4 * 18);
    const dummy = new THREE.Object3D();
    let nb = 0;
    for (const z of [-9, -3, 3, 9])
      for (let k = 0; k < 18; k++) {
        const u = k / 17;
        dummy.position.set(-AVV.halfX - 1.5 + u * (W + 3), 7.2 - Math.sin(u * Math.PI) * 1.4, z);
        dummy.updateMatrix();
        bulbs.setMatrixAt(nb++, dummy.matrix);
      }
    g.add(bulbs);
    for (const z of [-9, -3, 3, 9])
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7.4, 8), toy('#5c3d2e'));
        pole.position.set(sx * (AVV.halfX + 1.5), 3.7, z);
        g.add(pole);
      }
    // lo striscione
    const banner = new THREE.Mesh(
      rbox(12, 1.6, 0.2, 0.1),
      toy('#ffffff', {
        map: canvasTex(512, 72, (c) => {
          c.fillStyle = '#c1121f';
          c.fillRect(0, 0, 512, 72);
          c.font = '900 44px "Lilita One", "Baloo 2", sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillStyle = '#fff3b0';
          c.fillText('SAGRA DELLA POLPETTA', 256, 38);
        }),
      }),
    );
    banner.position.set(0, 9.6, -AVV.halfZ - 3);
    g.add(shadowy(banner));
    world.camBlockers.push(banner);
    // le 4 polpette di gioco (con l'alone del colore di chi l'ha lanciata, quando volano)
    const balls = Array.from({ length: AVV.balls }, () => {
      const m = meatball();
      m.castShadow = true;
      const haloM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(AVV.ballR * 1.7, 16, 12), haloM);
      halo.visible = false;
      m.add(halo);
      m.userData.halo = halo;
      m.userData.haloM = haloM;
      g.add(m);
      return m;
    });
    const spin = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    let cheer = 0;
    let outsSeen = -1;

    return (f) => {
      const E = f.ext as Ext;
      const t = f.t;
      const myTeam = myTeamOf(E, f.myId);
      let near = 0;
      E?.balls.forEach(([st, , seq], i) => {
        const m = balls[i];
        m.visible = st !== 1;
        const halo = m.userData.halo as THREE.Mesh;
        halo.visible = false;
        if (st === 1) return;
        const fl = flights.get(i);
        const ox = m.position.x;
        const oz = m.position.z;
        if (st === 2 && fl && fl.seq === seq) {
          // in volo: la stessa parabola del server
          const tau = Math.max(0, (f.now - fl.at) / 1000);
          const p = flyAt(fl, tau);
          m.position.set(p.x, Math.max(AVV.ballR, p.y), p.z);
          halo.visible = true;
          (m.userData.haloM as THREE.MeshBasicMaterial).color.set(TEAM_COL[fl.team] ?? '#ffffff');
          // mi sta arrivando addosso?
          if (fl.team !== myTeam && f.view.alive[f.myId]) {
            const rx = f.me.x - p.x;
            const rz = f.me.z - p.z;
            const v2 = fl.vx * fl.vx + fl.vz * fl.vz || 1;
            const tca = (rx * fl.vx + rz * fl.vz) / v2;
            if (tca > 0 && tca < 0.8 && Math.hypot(rx - fl.vx * tca, rz - fl.vz * tca) < 1.6) near = 1;
          }
        } else {
          const p = f.latest.get(`avv_b${i}`);
          if (p) {
            if (Math.hypot(p.x - m.position.x, p.z - m.position.z) > 8) m.position.set(p.x, p.y, p.z);
            const k = Math.min(1, f.dt * 14);
            m.position.x += (p.x - m.position.x) * k;
            m.position.y += (p.y - m.position.y) * k;
            m.position.z += (p.z - m.position.z) * k;
          }
        }
        // rotola
        const mx = m.position.x - ox;
        const mz = m.position.z - oz;
        const dist = Math.hypot(mx, mz);
        if (dist > 0.0005 && dist < 3) {
          axis.set(mz, 0, -mx).normalize();
          spin.setFromAxisAngle(axis, dist / AVV.ballR);
          m.quaternion.premultiply(spin);
        }
      });
      danger = near;
      lineGlowM.opacity = 0.3 + Math.sin(t * 3) * 0.12;
      for (const s of steam) {
        const k = (t * 0.25 + s.userData.ph) % 1;
        s.position.set(pot.position.x + Math.sin(k * 6 + s.userData.ph * 9) * 0.8, 4.2 + k * 6, pot.position.z + Math.cos(k * 5) * 0.6);
        s.scale.setScalar(0.6 + k * 1.6);
      }
      steamM.opacity = 0.45;
      // il pubblico salta quando qualcuno va fuori
      const outs = f.view.out.length;
      if (outs !== outsSeen) {
        if (outsSeen >= 0) cheer = 2;
        outsSeen = outs;
      }
      cheer = Math.max(0, cheer - f.dt);
      base.forEach((b, i) => {
        const j = Math.abs(Math.sin(t * (cheer > 0 ? 9 : 3) + b.ph)) * (cheer > 0 ? 0.7 : 0.12);
        dummy.position.set(b.x, b.y + j, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
      });
      crowd.instanceMatrix.needsUpdate = true;
    };
  },
  decorate(av, id, f) {
    const E = f.ext as Ext;
    wearVest(av, E?.team[id]);
    let m = HAND.get(av);
    if (!m || m.parent !== av.deco) {
      m = meatball();
      m.visible = false;
      av.deco.add(m);
      HAND.set(av, m);
    }
    const has = holding(E, id) && f.view.stage === 'PLAY';
    m.visible = has && av.body.visible;
    if (has) {
      av.armR.rotation.x = -0.9;
      m.position.set(0.55, 0.95 + av.body.position.y, 0.42);
    }
    // braccio del lancio
    const ta = throwAnim.get(id);
    if (ta && performance.now() - ta < 260) {
      const k = (performance.now() - ta) / 260;
      av.armR.rotation.x = -2.8 + k * 2.4;
    }
  },
  status(h) {
    const E = h.ext as Ext;
    const t = E?.team[h.myId];
    if (!E || t === undefined) return null;
    if (danger) return { text: 'ARRIVA! SCATTO = PRENDILA AL VOLO', cls: 'sc-red pulse-soft' };
    if (holding(E, h.myId)) return { text: 'MIRA E LANCIA!', cls: 'sc-yellow' };
    if (h.view.playStart && h.now - h.view.playStart < 5000) return teamPill(t, `SEI DEI ${TEAM_NAME[t]}! PRENDI LE POLPETTE`);
    return null;
  },
  button(h) {
    const E = h.ext as Ext;
    const has = holding(E, h.myId);
    return {
      icon: (
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="12" fill="#8a4b2a" stroke={INK} strokeWidth="3" />
          <circle cx="13" cy="13" r="3" fill="#d62828" />
          <circle cx="21" cy="20" r="2" fill="#2d9c4a" />
        </svg>
      ),
      label: 'LANCIA',
      cls: has ? 'sc-red' : 'sc-dark',
      size: 82,
      keyHint: 'E / CLIC',
      disabled: !has,
      cooldown: myReady > Date.now() ? { until: myReady, total: AVV.reload } : undefined,
      press: () => throwNow(h),
    };
  },
  hud(h) {
    const E = h.ext as Ext;
    if (!E || h.view.stage === 'INTRO') return null;
    const alive = [0, 0];
    for (const [id, t] of Object.entries(E.team)) if (h.view.alive[id]) alive[t]++;
    const mine = E.outs[h.myId] ?? 0;
    return (
      <>
        <TeamScore score={alive} myTeam={E.team[h.myId]} sub={mine ? `Ne hai eliminati ${mine}` : 'Giocatori in piedi'} />
        {h.alive && holding(E, h.myId) && h.view.stage === 'PLAY' && (
          <svg className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
            <circle cx="19" cy="19" r="11" fill="none" stroke={INK} strokeWidth="5" />
            <circle cx="19" cy="19" r="11" fill="none" stroke="#ffd166" strokeWidth="2.5" />
            <path d="M19 2v8M19 28v8M2 19h8M28 19h8" stroke="#ffd166" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </>
    );
  },
  fx(p, c) {
    const E = c.view.ext as Ext;
    const myTeam = myTeamOf(E, c.myId);
    if (p.k === 'avv_throw') {
      flights.set(p.i, { seq: p.seq, at: p.at, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, team: E?.team[p.by] ?? -1 });
      throwAnim.set(p.by, performance.now());
      if (p.by !== c.myId) {
        const d = Math.hypot(p.x - c.me.x, p.z - c.me.z);
        if (d < 18) soundManager.playWhoosh();
      }
    } else if (p.k === 'avv_pick') {
      if (p.id === c.myId) {
        soundManager.playPop();
        const at = c.where(p.id);
        if (at) popText(c.world, at.x, at.y, at.z, 'PRESA!', '#ffd166', { scale: 0.8 });
      }
    } else if (p.k === 'avv_hit') {
      burst(c.world, p.x, p.y, p.z, ['#8a4b2a', '#d62828', '#ffffff'], 30, 6);
      popText(c.world, p.x, p.y - 1, p.z, 'COLPITO!', '#ff4d6d', { scale: 1.2 });
      soundManager.playBonk();
      c.shake(p.id === c.myId ? 0.8 : 0.25);
      if (p.by === c.myId) c.feed(`Hai colpito ${c.nameOf(p.id)}!`);
    } else if (p.k === 'avv_catch') {
      burst(c.world, p.x, p.y, p.z, [TEAM_COL[E?.team[p.id] ?? 0], '#ffd60a', '#ffffff'], 46, 7);
      popText(c.world, p.x, p.y - 1, p.z, 'PRESA AL VOLO!', '#ffd60a', { scale: 1.4, life: 1.3 });
      ringPulse(c.world, p.x, p.y - 1, p.z, '#ffd60a');
      if (E?.team[p.id] === myTeam) soundManager.playSuccess();
      else soundManager.playError();
      c.shake(0.35);
      c.feed(`${c.nameOf(p.id)} la prende al volo: fuori ${p.by ? c.nameOf(p.by) : ''}!`);
    } else if (p.k === 'avv_land') {
      if (Math.hypot(p.x - c.me.x, p.z - c.me.z) < 12) soundManager.playPop();
    }
  },
  feed: {
    colpito: ['{n} si è preso una polpetta in faccia', '{n} è avvelenato', 'polpettata su {n}'],
    preso: ['{n} se l’è fatta prendere al volo', 'tiro di {n} preso al volo: fuori'],
  },
});
