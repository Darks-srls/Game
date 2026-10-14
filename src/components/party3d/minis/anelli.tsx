// 🧅 Anelli di cipolla (telefono): parco della sagra con i pancake e il tortellone che fanno rimbalzare,
// anelli di cipolla fritti giganti (quelli d'oro brillano), punti dal vivo e l'aureola d'oro a chi è primo
import * as THREE from 'three';
import { ANELLI, PADS, SPOTS, padAt, ringFace, throughRing } from '../../../data/minis/anelli';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, flagLine, glow, matte, outlined, popText, rbox, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { rings: [number, number, number][]; score: Record<string, number> } | null;

// punti dal vivo (arrivano come effetto ogni mezzo secondo) e anelli già presi da me (si nascondono subito)
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };
const mine = new Map<number, number>(); // anello → fino a quando resta nascosto (ms, orologio del telefono)
let prev: { x: number; y: number; z: number } | null = null;
let leader: string | null = null;
let lastBoing = 0;
const squash = new Float32Array(PADS.length);

const rnd = (seed: number) => {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
};

// pastella fritta: dorata a puntini (serve anche da rilievo)
const batterTex = () =>
  canvasTex(
    256,
    64,
    (c) => {
      c.fillStyle = '#e0a03a';
      c.fillRect(0, 0, 256, 64);
      const r = rnd(13);
      for (let i = 0; i < 420; i++) {
        const v = r();
        c.fillStyle = v < 0.4 ? '#b8701c' : v < 0.8 ? '#f6c766' : '#fff0b8';
        c.beginPath();
        c.arc(r() * 256, r() * 64, 1 + r() * 3.2, 0, Math.PI * 2);
        c.fill();
      }
    },
    [6, 1],
  );
const parkTex = () =>
  canvasTex(1024, 1024, (c) => {
    c.fillStyle = '#7bd389';
    c.fillRect(0, 0, 1024, 1024);
    const r = rnd(2);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(80,170,90,0.6)' : 'rgba(160,230,150,0.6)';
      c.fillRect(r() * 1024, r() * 1024, 3, 7);
    }
    // la tovaglia a quadri in mezzo
    c.save();
    c.beginPath();
    c.arc(512, 512, 300, 0, Math.PI * 2);
    c.clip();
    for (let i = 0; i < 20; i++)
      for (let j = 0; j < 20; j++) {
        c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
        c.fillRect(212 + i * 30, 212 + j * 30, 30, 30);
      }
    c.restore();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(512, 512, 300, 0, Math.PI * 2);
    c.stroke();
    // vialetto di sabbia intorno ai pancake
    c.strokeStyle = 'rgba(244,215,150,0.75)';
    c.lineWidth = 46;
    c.beginPath();
    c.arc(512, 512, 488 * (13.6 / ANELLI.r), 0, Math.PI * 2);
    c.stroke();
  });

// pila di pancake con il burro e lo sciroppo
function pancakes(P: (typeof PADS)[number]) {
  const g = new THREE.Group();
  const cake = toy('#d9913f', { roughness: 0.55 });
  const edge = toy('#f3c27a', { roughness: 0.6 });
  const n = 3;
  const th = P.h / n;
  for (let i = 0; i < n; i++) {
    const m = outlined(new THREE.Mesh(new THREE.CylinderGeometry(P.r - i * 0.04, P.r - i * 0.04 + 0.03, th * 0.92, 32), [edge, cake, cake]), 1.02);
    m.position.y = th * (i + 0.5);
    g.add(m);
  }
  const syrup = new THREE.Mesh(new THREE.CylinderGeometry(P.r * 0.75, P.r * 0.8, 0.03, 28), toy('#8a4b12', { roughness: 0.1, clearcoat: 1 }));
  syrup.position.y = P.h + 0.005;
  const butter = new THREE.Mesh(rbox(0.6, 0.12, 0.6, 0.05), toy('#fff3a8'));
  butter.position.y = P.h + 0.05;
  butter.rotation.y = 0.5;
  g.add(syrup, butter);
  return g;
}
// il tortellone gigante
function tortellone(P: (typeof PADS)[number]) {
  const g = new THREE.Group();
  const pasta = toy('#ffd77a', { roughness: 0.5 });
  const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r + 0.15, P.h, 40), pasta), 1.02);
  body.position.y = P.h / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(P.r + 0.1, 0.22, 10, 48), toy('#f2b84b'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = P.h * 0.55;
  // pieghe del bordo
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const fold = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), pasta);
    fold.scale.set(1, 0.5, 0.6);
    fold.position.set(Math.sin(a) * (P.r + 0.2), P.h * 0.55, Math.cos(a) * (P.r + 0.2));
    g.add(fold);
  }
  const top = new THREE.Mesh(new THREE.CircleGeometry(P.r * 0.7, 32), toy('#ffe7a8', { roughness: 0.4 }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = P.h + 0.01;
  g.add(body, rim, top);
  return g;
}

function haloMesh() {
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 28), new THREE.MeshStandardMaterial({ color: '#ffd60a', metalness: 0.8, roughness: 0.2, emissive: '#a07000', emissiveIntensity: 0.5 }));
  h.rotation.x = Math.PI / 2;
  h.name = 'an-halo';
  return h;
}

registerClientMini({
  kind: 'ANELLI',
  orbit: { c: [0, 4, 0], r: 32 },
  faceSpawn: true,
  icon: (size) => (
    <Badge size={size} from="#ffe08a" to="#f4a261">
      <ellipse cx="50" cy="80" rx="30" ry="7" fill="#d9913f" {...stroke} />
      <ellipse cx="50" cy="74" rx="30" ry="7" fill="#f3c27a" {...stroke} />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#1d0f3d" strokeWidth={17} />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#e0a03a" strokeWidth={11} />
      <circle cx="42" cy="22" r="2.5" fill="#fff0b8" />
      <circle cx="68" cy="36" r="2.5" fill="#b8701c" />
      <circle cx="34" cy="50" r="2" fill="#b8701c" />
      <path d="M78 14 l4 -6 M84 22 l7 -2" {...stroke} fill="none" />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta (2 volte = doppio) · salta sui pancake e sul tortellone · passa DENTRO gli anelli · E schiaffo',
  build(world) {
    const g = world.arena;
    mine.clear();
    prev = null;
    live = { at: 0, s: {} };
    const sh = world.sun.shadow.camera;
    sh.left = sh.bottom = -23;
    sh.right = sh.top = 23;
    // il prato con la tovaglia
    const ground = new THREE.Mesh(new THREE.CircleGeometry(ANELLI.r + 1.5, 80), matte('#ffffff', { map: parkTex() }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(ANELLI.r + 1.5, ANELLI.r - 2, 6, 64, 1, true), matte('#c08457'));
    dirt.position.y = -3;
    g.add(ground, dirt);
    // lo steccato di grissini
    const N = 96;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 6), toy('#e8b46a', { roughness: 0.7 }), N);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      tmp.position.set(Math.sin(a) * (ANELLI.r + 0.2), 0.65, Math.cos(a) * (ANELLI.r + 0.2));
      tmp.rotation.set(0, 0, (i % 2 ? 1 : -1) * 0.06);
      tmp.updateMatrix();
      posts.setMatrixAt(i, tmp.matrix);
    }
    posts.castShadow = true;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(ANELLI.r + 0.2, 0.12, 6, 120), toy('#d99a4e'));
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 1.15;
    g.add(posts, rail);
    // trampolini
    const pads: THREE.Group[] = [];
    PADS.forEach((P) => {
      const o = P.big ? tortellone(P) : pancakes(P);
      o.position.set(P.x, 0, P.z);
      g.add(shadowy(o));
      pads.push(o);
    });
    // festoni di lucine e bandierine tra i pali (lontani dal prato: la telecamera non ci finisce dietro)
    const POLE_R = ANELLI.r + 13;
    const poleM = toy('#8338ec');
    const bulbs: THREE.Mesh[] = [];
    const bulbM = [glow('#fff3b0', 1.2), glow('#ff70a6', 1.2), glow('#70d6ff', 1.2)];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 10, 10), poleM), 1.05);
      pole.position.set(Math.sin(a) * POLE_R, 5, Math.cos(a) * POLE_R);
      g.add(shadowy(pole));
      world.camBlockers.push(pole);
      const b = (((k + 1) % 6) / 6) * Math.PI * 2;
      const from = new THREE.Vector3(Math.sin(a) * POLE_R, 9.6, Math.cos(a) * POLE_R);
      const to = new THREE.Vector3(Math.sin(b) * POLE_R, 9.6, Math.cos(b) * POLE_R);
      g.add(flagLine(from, to, 12));
      for (let i = 1; i < 9; i++) {
        const p = from.clone().lerp(to, i / 9);
        p.y -= Math.sin((i / 9) * Math.PI) * 1.6 + 0.4;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), bulbM[(i + k) % 3]);
        bulb.position.copy(p);
        bulbs.push(bulb);
        g.add(bulb);
      }
    }
    // laggiù: la cipolla gigante (con la faccia), il ketchup e la senape, palloncini
    const onion = new THREE.Group();
    const bulbBody = outlined(new THREE.Mesh(new THREE.SphereGeometry(5, 32, 24), toy('#f1e3c6', { roughness: 0.45 })), 1.03);
    bulbBody.scale.y = 0.95;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 16), toy('#f1e3c6'));
    tip.position.y = 6;
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 8), toy('#52b788'));
    sprout.position.y = 9;
    for (const x of [-1.6, 1.6]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), toy('#1d0f3d'));
      eye.position.set(x, 1.2, 4.6);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toy('#ffffff'));
      shine.position.set(x + 0.2, 1.5, 5.2);
      onion.add(eye, shine);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.22, 8, 24, Math.PI), toy('#1d0f3d'));
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.6, 4.75);
    onion.add(bulbBody, tip, sprout, smile);
    onion.position.set(0, 4, -38);
    g.add(shadowy(onion));
    const bottle = (color: string, x: number, z: number) => {
      const b = new THREE.Group();
      const body = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 10, 24), toy(color)), 1.03);
      body.position.y = 5;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 18), toy('#ffffff'));
      cap.position.y = 11.5;
      b.add(body, cap);
      b.position.set(x, 0, z);
      return shadowy(b);
    };
    g.add(bottle('#e63946', 32, -22), bottle('#ffd60a', -33, -18));
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 10; i++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff', '#ff70a6'][i % 5]);
      const a = (i / 10) * Math.PI * 2 + 0.2;
      b.position.set(Math.sin(a) * (ANELLI.r + 11), 9 + (i % 3) * 2.5, Math.cos(a) * (ANELLI.r + 11));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }

    // gli anelli (al massimo 10): fritti, quelli d'oro brillano; quando stanno per comparire si vede un'ombra
    const batter = batterTex();
    const ringGeo = new THREE.TorusGeometry(ANELLI.ringR, ANELLI.tube, 14, 48);
    const fried = toy('#ffffff', { map: batter, bumpMap: batter, bumpScale: 2.5, roughness: 0.55 });
    const golden = new THREE.MeshStandardMaterial({ color: '#ffd60a', metalness: 0.85, roughness: 0.22, emissive: '#b07800', emissiveIntensity: 0.45, bumpMap: batter, bumpScale: 1.5 });
    const ghostM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false });
    const rings = Array.from({ length: 10 }, () => {
      const grp = new THREE.Group();
      const m = outlined(new THREE.Mesh(ringGeo, fried), 1.04);
      const ghost = new THREE.Mesh(ringGeo, ghostM);
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow('#fff3b0', 1.4));
      grp.add(m, ghost, sparkle);
      grp.visible = false;
      g.add(grp);
      return { grp, m, ghost, sparkle, shown: false, s: -1, pop: 0 };
    });
    const sunOff = new THREE.Vector3(20, 34, 26);
    world.sun.position.copy(world.sun.target.position).add(sunOff);

    return (f) => {
      const E = f.ext as Ext;
      const t = f.playT;
      const now = Date.now();
      // trampolini che si schiacciano quando qualcuno ci rimbalza
      PADS.forEach((P, i) => {
        let on = false;
        const test = (o: { x: number; y: number; z: number }) => {
          if (Math.abs(o.y - P.h) < 0.3 && (o.x - P.x) ** 2 + (o.z - P.z) ** 2 < P.r * P.r) on = true;
        };
        test(f.me);
        for (const o of f.others.values()) test(o);
        if (on) squash[i] = 1;
        squash[i] = Math.max(0, squash[i] - f.dt * 4);
        const k = Math.sin(squash[i] * Math.PI);
        pads[i].scale.set(1 + k * 0.12, 1 - k * 0.35, 1 + k * 0.12);
      });
      // gli anelli
      const list = E?.rings ?? [];
      rings.forEach((R, i) => {
        const r = list[i];
        if (!r || f.view.stage === 'INTRO') {
          R.grp.visible = false;
          return;
        }
        const [s, gold, at] = r;
        const S = SPOTS[s];
        if (R.s !== s) {
          R.s = s;
          R.pop = 0;
        }
        const active = f.now >= at && !(mine.get(i)! > now && R.s === s);
        const soon = !active && at - f.now < ANELLI.warn && f.now < at;
        R.grp.visible = active || soon;
        if (!R.grp.visible) return;
        R.grp.position.set(S.x, S.y + (active ? Math.sin(f.t * 1.6 + i) * 0.08 : 0), S.z);
        if (S.flat) R.grp.rotation.set(Math.PI / 2, 0, f.t * 0.5);
        else R.grp.rotation.set(0, ringFace(S.ph, t), 0);
        R.m.visible = active;
        R.ghost.visible = soon;
        ghostM.opacity = 0.18 + Math.sin(f.t * 10) * 0.1;
        R.m.material = gold ? golden : fried;
        // comparsa con un rimbalzo
        if (active) {
          R.pop = Math.min(1, R.pop + f.dt * 3);
          const k = R.pop < 1 ? 1 + Math.sin(R.pop * Math.PI) * 0.35 : 1;
          R.m.scale.setScalar(Math.min(1, R.pop * 1.6) * k);
        }
        R.sparkle.visible = active && gold === 1;
        if (R.sparkle.visible) {
          const a = f.t * 3 + i;
          R.sparkle.position.set(Math.cos(a) * ANELLI.ringR, Math.sin(a) * ANELLI.ringR, 0);
          R.sparkle.rotation.y = f.t * 4;
        }
      });
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
      bulbs.forEach((b, i) => b.scale.setScalar(Math.sin(f.t * 4 + i * 1.3) > 0 ? 1.2 : 0.8));
      onion.rotation.y = Math.sin(f.t * 0.5) * 0.25;
      onion.position.y = 4 + Math.abs(Math.sin(f.t * 1.2)) * 0.6;
      // chi è primo (aureola d'oro)
      const sc = live.at && now - live.at < 3000 ? live.s : (E?.score ?? {});
      let best = 0;
      leader = null;
      for (const [id, v] of Object.entries(sc))
        if (v > best) {
          best = v;
          leader = id;
        }
    };
  },
  // il trampolino lancia il mio personaggio subito (il server lancia i bot) e l'anello che attraverso sparisce subito
  local(f, world) {
    if (f.view.stage !== 'PLAY' || !f.view.alive[f.myId]) {
      prev = null;
      return;
    }
    const me = f.me;
    if (me.ground) {
      const i = padAt(me.x, me.z, me.y);
      if (i >= 0 && Math.abs(me.y - PADS[i].h) < 0.05) {
        me.vy = PADS[i].v;
        me.ground = false;
        me.airJumps = 0;
        squash[i] = 1;
        if (Date.now() - lastBoing > 250) {
          lastBoing = Date.now();
          soundManager.playJump();
        }
      }
    }
    const c = { x: me.x, y: me.y + ANELLI.body, z: me.z };
    const E = f.ext as Ext;
    if (prev && E && Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z) < 4) {
      E.rings.forEach(([s, gold, at], i) => {
        if (f.now < at || (mine.get(i) ?? 0) > Date.now()) return;
        if (!throughRing(SPOTS[s], f.playT, prev!.x, prev!.y, prev!.z, c.x, c.y, c.z, ANELLI.passLocal)) return;
        mine.set(i, Date.now() + 1500);
        const S = SPOTS[s];
        popText(world, S.x, S.y - 1, S.z, gold ? '+3' : '+1', gold ? '#ffd60a' : '#ffffff', { scale: gold ? 1.5 : 1.1 });
        if (gold) soundManager.playSuccess();
        else soundManager.playPop();
      });
    }
    prev = c;
  },
  decorate(av, id) {
    const has = av.headDeco.getObjectByName('an-halo');
    const want = leader === id;
    if (want && !has) {
      const h = haloMesh();
      h.position.y = 0.95;
      av.headDeco.add(h);
    } else if (!want && has) av.headDeco.remove(has);
  },
  status(h) {
    if (h.view.stage !== 'PLAY') return null;
    const sc = live.at && Date.now() - live.at < 3000 ? live.s : ((h.ext as Ext)?.score ?? {});
    const mineN = sc[h.myId] ?? 0;
    if (!mineN) return { text: 'SALTA SUI PANCAKE E PASSA NEGLI ANELLI!', cls: 'sc-yellow' };
    return { text: `${mineN} ${mineN === 1 ? 'PUNTO' : 'PUNTI'} · L’ORO NE VALE 3`, cls: leader === h.myId ? 'sc-green' : 'sc-dark' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    const scores = live.at && Date.now() - live.at < 3000 ? live.s : (E?.score ?? {});
    const top = Object.entries(scores)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (!top.length || h.view.stage !== 'PLAY') return null;
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {top.map(([id, pts], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
            {h.nameOf(id)} · {pts}
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 'an_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 'an_take') {
      burst(c.world, p.x, p.y, p.z, p.g ? ['#ffd60a', '#fff3b0', '#ffffff'] : ['#e0a03a', '#b8701c', '#fff0b8'], p.g ? 50 : 28, p.g ? 7 : 5);
      ringPulse(c.world, p.x, p.y - 0.9, p.z, p.g ? '#ffd60a' : '#ffffff');
      if (p.id === c.myId) {
        // (il +1 l'ho già visto quando ci sono passato; se non l'avevo visto, lo mostro ora)
        if (!(mine.get(p.i)! > Date.now())) {
          popText(c.world, p.x, p.y - 1, p.z, p.g ? '+3' : '+1', p.g ? '#ffd60a' : '#ffffff', { scale: p.g ? 1.5 : 1.1 });
          if (p.g) soundManager.playSuccess();
          else soundManager.playPop();
        }
        if (p.g) c.feed('Anello d’oro! +3');
      } else {
        mine.delete(p.i);
        const at = c.where(p.id);
        if (at) popText(c.world, at.x, at.y, at.z, p.g ? '+3' : '+1', p.g ? '#ffd60a' : '#ffffff', { scale: 0.9 });
        if (p.g) c.feed(`${c.nameOf(p.id)} ha preso l’anello d’oro`);
      }
    }
  },
});
