// 👑 Il re della pizza (telefono): pizza gigante, cerchio d'oro con la colonna di luce, corona sulla testa del re
import * as THREE from 'three';
import { RE } from '../../../data/minis/re';
import { soundManager } from '../../../utils/audio';
import { Badge, stroke } from '../icons';
import { balloon, burst, canvasTex, glow, matte, outlined, poof, popText, ringPulse, shadowy, toy } from '../scene';
import { registerClientMini, type HudCtx } from './types';

type Ext = { zone: { x: number; z: number }; next: { x: number; z: number } | null; moveAt: number; king: string | null; score: Record<string, number> } | null;

// punti dal vivo (arrivano come effetto ogni mezzo secondo)
let live: { at: number; s: Record<string, number> } = { at: 0, s: {} };
let lastFeed = 0; // il re cambia spesso: in cronaca al massimo una riga ogni tanto

function pizzaTexture() {
  return canvasTex(1024, 1024, (c) => {
    const cx = 512;
    c.fillStyle = '#f0b866';
    c.fillRect(0, 0, 1024, 1024);
    // sugo
    const g = c.createRadialGradient(cx, cx, 100, cx, cx, 500);
    g.addColorStop(0, '#e2432f');
    g.addColorStop(1, '#c22f22');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cx, 492, 0, Math.PI * 2);
    c.fill();
    // mozzarella a chiazze
    const rnd = (() => {
      let x = 7;
      return () => ((x = (x * 16807) % 2147483647) / 2147483647);
    })();
    c.fillStyle = '#ffe9a8';
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 430;
      const x = cx + Math.cos(a) * r;
      const y = cx + Math.sin(a) * r;
      c.beginPath();
      for (let k = 0; k < 9; k++) {
        const aa = (k / 9) * Math.PI * 2;
        const rr = 30 + rnd() * 34;
        c.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
      }
      c.closePath();
      c.fill();
    }
    // salame
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 60 + Math.sqrt(rnd()) * 370;
      const x = cx + Math.cos(a) * r;
      const y = cx + Math.sin(a) * r;
      c.fillStyle = '#a3192a';
      c.beginPath();
      c.arc(x, y, 34, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d9485a';
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.arc(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40, 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    // basilico e olive
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 440;
      c.save();
      c.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
      c.rotate(rnd() * Math.PI);
      if (i % 2) {
        c.fillStyle = '#2d8a3e';
        c.beginPath();
        c.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#7bc96f';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-20, 0);
        c.lineTo(20, 0);
        c.stroke();
      } else {
        c.strokeStyle = '#221a1a';
        c.lineWidth = 9;
        c.beginPath();
        c.arc(0, 0, 11, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
  });
}

// tovaglia a quadretti (laggiù in fondo, dove si cade)
const clothTexture = () =>
  canvasTex(
    256,
    256,
    (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? '#ffffff' : '#e63946';
          c.fillRect(i * 32, j * 32, 32, 32);
        }
    },
    [14, 14],
  );

export function makeCrown(scale = 1) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd60a', metalness: 0.85, roughness: 0.22, emissive: '#7a5200', emissiveIntensity: 0.25 });
  const band = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 24, 1, true), gold), 1.06);
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8), gold);
    spike.position.set(Math.sin(a) * 0.4, 0.26, Math.cos(a) * 0.4);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(['#ff4d6d', '#3a86ff', '#06d6a0', '#ff70a6', '#8338ec'][i], 1.4));
    gem.position.set(Math.sin(a) * 0.43, 0, Math.cos(a) * 0.43);
    g.add(spike, gem);
  }
  g.scale.setScalar(scale);
  return g;
}

registerClientMini({
  kind: 'RE',
  orbit: { c: [0, 0, 0], r: 28 },
  highCam: true,
  icon: (size) => (
    <Badge size={size} from="#ffd166" to="#f77f00">
      <path d="M22 78 L50 26 L78 78 Z" fill="#f4a259" {...stroke} />
      <path d="M28 72 L50 32 L72 72 Z" fill="#e63946" />
      <circle cx="44" cy="58" r="5" fill="#9d0208" />
      <circle cx="58" cy="64" r="5" fill="#9d0208" />
      <circle cx="51" cy="47" r="4" fill="#ffe9a8" />
      <path d="M34 22 L38 8 L46 16 L50 4 L54 16 L62 8 L66 22 Z" fill="#ffd60a" {...stroke} />
    </Badge>
  ),
  hint: 'WASD muovi · spazio salta · Shift scatto · E schiaffo · resta DA SOLO nel cerchio d’oro',
  build(world) {
    const g = world.arena;
    // la pizza
    const pizza = new THREE.Mesh(new THREE.CylinderGeometry(RE.r, RE.r * 0.97, 0.8, 96), [toy('#e9a35a'), toy('#ffffff', { map: pizzaTexture(), clearcoat: 0.25, roughness: 0.6 }), toy('#c98a4b')]);
    pizza.position.y = -0.4;
    const crust = new THREE.Mesh(new THREE.TorusGeometry(RE.r, 0.5, 16, 128), toy('#eeb46c', { roughness: 0.7 }));
    crust.rotation.x = Math.PI / 2;
    crust.position.y = -0.05;
    // la pala del pizzaiolo sotto
    const peel = new THREE.Mesh(new THREE.CylinderGeometry(RE.r + 1.2, RE.r + 1.2, 0.5, 64), matte('#b07a46'));
    peel.position.y = -1.05;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 16), matte('#9c6a3a'));
    handle.position.set(0, -1.05, -RE.r - 8);
    g.add(shadowy(pizza), crust, shadowy(peel), shadowy(handle));
    // tavolo con la tovaglia laggiù
    const cloth = new THREE.Mesh(new THREE.CircleGeometry(70, 64), matte('#ffffff', { map: clothTexture() }));
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = -16;
    cloth.receiveShadow = true;
    g.add(cloth);
    // pomodori e funghi giganti intorno, palloncini
    const deco: THREE.Object3D[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r = RE.r + 9 + (i % 3) * 3;
      let o: THREE.Object3D;
      if (i % 2) {
        o = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3, 16), toy('#fff1d6'));
        stem.position.y = 1.5;
        const cap = outlined(new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toy('#ff4d6d')), 1.04);
        cap.position.y = 2.8;
        o.add(stem, cap);
      } else {
        o = outlined(new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 18), toy('#e63946')), 1.04);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.6, 5), toy('#2d8a3e'));
        leaf.position.y = 2.2;
        o.add(leaf);
      }
      o.position.set(Math.sin(a) * r, -14 + (i % 3) * 1.5, Math.cos(a) * r);
      o.userData.phase = i;
      deco.push(o);
      g.add(shadowy(o));
    }
    const balloons: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const b = balloon(['#ffd60a', '#ff4d6d', '#06d6a0', '#3a86ff'][i % 4]);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.sin(a) * (RE.r + 7), 5 + (i % 3) * 2, Math.cos(a) * (RE.r + 7));
      b.userData.y0 = b.position.y;
      balloons.push(b);
      g.add(b);
    }

    // il cerchio d'oro: anello, disco luccicante, colonna di luce, corona che gira
    const zone = new THREE.Group();
    const ringM = glow('#ffd60a', 2.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RE.zoneR, 0.14, 12, 64), ringM);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    const discM = new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.28, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(RE.zoneR, 48), discM);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.04;
    const beamM = new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(RE.zoneR, RE.zoneR, 14, 32, 1, true), beamM);
    beam.position.y = 7;
    const crown = makeCrown(2.2);
    crown.position.y = 6;
    zone.add(ring, disc, beam, crown);
    g.add(zone);
    // dove andrà: anello tratteggiato che lampeggia
    const next = new THREE.Group();
    const dashM = glow('#ffffff', 1.6);
    for (let i = 0; i < 16; i++) {
      const seg = new THREE.Mesh(new THREE.TorusGeometry(RE.zoneR, 0.1, 6, 8, (Math.PI * 2) / 32), dashM);
      seg.rotation.set(Math.PI / 2, 0, (i / 16) * Math.PI * 2);
      seg.position.y = 0.06;
      next.add(seg);
    }
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), glow('#ffffff', 1.4));
    pin.rotation.x = Math.PI;
    pin.position.y = 3;
    next.add(pin);
    next.visible = false;
    g.add(next);
    let zx = 0;
    let zz = 0;

    return (f) => {
      const E = f.ext as Ext;
      if (E) {
        // il cerchio scivola verso il posto nuovo
        const k = Math.min(1, f.dt * 6);
        zx += (E.zone.x - zx) * k;
        zz += (E.zone.z - zz) * k;
        zone.position.set(zx, 0, zz);
        next.visible = !!E.next && Math.floor(f.t * 4) % 2 === 0;
        if (E.next) next.position.set(E.next.x, 0, E.next.z);
        pin.position.y = 3 + Math.sin(f.t * 6) * 0.4;
        // conteso (più di uno dentro): il cerchio diventa rosso e trema
        let inside = 0;
        const check = (p: { x: number; y: number; z: number }) => {
          if (p.y > -0.5 && p.y < 3 && Math.hypot(p.x - zx, p.z - zz) <= RE.zoneR) inside++;
        };
        if (f.view.alive[f.myId]) check(f.me);
        for (const [id, o] of f.others) if (f.view.alive[id] !== false) check(o);
        const contested = inside > 1;
        ringM.color.set(contested ? '#ff4d6d' : '#ffd60a');
        ringM.emissive.set(contested ? '#ff4d6d' : '#ffd60a');
        discM.color.set(contested ? '#ff4d6d' : '#ffd60a');
        discM.opacity = 0.2 + (inside === 1 ? 0.18 + Math.sin(f.t * 8) * 0.08 : 0);
        ring.scale.setScalar(contested ? 1 + Math.sin(f.t * 30) * 0.03 : 1);
      }
      crown.rotation.y = f.t * 1.4;
      crown.position.y = 6 + Math.sin(f.t * 2) * 0.35;
      beamM.opacity = 0.12 + Math.sin(f.t * 3) * 0.04;
      for (const o of deco) o.rotation.y = Math.sin(f.t * 0.4 + o.userData.phase) * 0.3;
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(f.t * 0.8 + b.userData.phase) * 0.6;
    };
  },
  // la corona sulla testa del re
  decorate(av, id, f) {
    const E = f.ext as Ext;
    const has = av.headDeco.getObjectByName('re-crown');
    const king = E?.king === id && f.view.stage === 'PLAY';
    if (king && !has) {
      const c = makeCrown(1.1);
      c.name = 're-crown';
      c.position.y = 0.72;
      av.headDeco.add(c);
    } else if (!king && has) av.headDeco.remove(has);
    if (king && has) has.rotation.y = f.t * 2;
  },
  status(h) {
    const E = h.ext as Ext;
    if (!E) return null;
    if (E.king === h.myId) return { text: 'SEI IL RE! RESTA NEL CERCHIO', cls: 'sc-yellow pulse-soft' };
    const inZone = Math.hypot(h.me.x - E.zone.x, h.me.z - E.zone.z) <= RE.zoneR && h.me.y > -0.5;
    if (inZone) return { text: 'NON SEI SOLO: SCHIAFFO!', cls: 'sc-red pulse-soft' };
    if (E.next) return { text: 'IL CERCHIO SI SPOSTA!', cls: 'sc-purple' };
    if (E.king) return { text: `RE: ${h.nameOf(E.king).toUpperCase()}`, cls: 'sc-dark' };
    return { text: 'CORRI NEL CERCHIO D’ORO', cls: 'sc-yellow' };
  },
  hud(h: HudCtx) {
    const E = h.ext as Ext;
    const scores = live.at && Date.now() - live.at < 3000 ? live.s : (E?.score ?? {});
    const top = Object.entries(scores)
      .filter(([, v]) => v >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (!top.length || h.view.stage !== 'PLAY') return null;
    return (
      <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
        {top.map(([id, sec], i) => (
          <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === h.myId ? '!bg-amber-500/80' : ''}`}>
            <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
            {h.nameOf(id)} · {Math.floor(sec)}s{id === E?.king ? ' 👑' : ''}
          </p>
        ))}
      </div>
    );
  },
  fx(p, c) {
    if (p.k === 're_score') live = { at: Date.now(), s: p.s };
    else if (p.k === 're_king') {
      if (!p.id) return;
      const at = c.where(p.id);
      if (at) {
        popText(c.world, at.x, at.y + 0.6, at.z, 'RE!', '#ffd60a', { scale: 1.3 });
        ringPulse(c.world, at.x, at.y, at.z, '#ffd60a');
      }
      if (p.id === c.myId) {
        soundManager.playSuccess();
        c.sticker('king', 'SEI IL RE');
      } else {
        soundManager.playPop();
        if (Date.now() - lastFeed > 4000) {
          lastFeed = Date.now();
          c.feed(`${c.nameOf(p.id)} è il re della pizza`);
        }
      }
    } else if (p.k === 're_move') {
      soundManager.playWhoosh();
      burst(c.world, p.x, 0.5, p.z, ['#ffd60a', '#ffffff', '#ff4d6d'], 40, 6);
      c.shake(0.2);
    } else if (p.k === 're_fall') {
      const at = c.where(p.id);
      if (at) poof(c.world, at.x, Math.max(at.y, -10), at.z);
      if (p.id === c.myId) {
        soundManager.playFall();
        c.sticker('lose', 'GIÙ DALLA PIZZA');
      } else c.feed(`${c.nameOf(p.id)} è caduto dalla pizza`);
    }
  },
});
