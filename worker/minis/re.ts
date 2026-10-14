// 👑 Il re della pizza (server): il cerchio d'oro, chi è il re, i punti, i bot
import { RE } from '../../src/data/minis/re';
import { PHYS } from '../../src/data/party3d';
import { registerServerMini, type MiniApi } from './types';

interface ReState {
  zone: { x: number; z: number };
  next: { x: number; z: number } | null; // dove andrà il cerchio (si vede qualche secondo prima)
  moveAt: number;
  gap: number;
  king: string | null;
  score: Record<string, number>; // secondi da re
  sentAt: number;
}

// un posto nuovo per il cerchio: dentro la pizza e lontano da quello di prima
function spot(api: MiniApi<ReState>, from: { x: number; z: number } | null) {
  let best = { x: 0, z: 0 };
  for (let i = 0; i < 40; i++) {
    const a = api.rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * (RE.r - RE.zoneR - 1.5);
    best = { x: Math.sin(a) * r, z: Math.cos(a) * r };
    if (!from || Math.hypot(best.x - from.x, best.z - from.z) > 7) break;
  }
  return best;
}

const inZone = (api: MiniApi<ReState>, id: string, zone: { x: number; z: number }) => {
  const p = api.pos(id);
  return !!p && p.y > -0.5 && p.y < 3 && Math.hypot(p.x - zone.x, p.z - zone.z) <= RE.zoneR;
};

registerServerMini<ReState>({
  kind: 'RE',
  ends: 'time',
  falls: 'none', // chi cade riparte dal bordo
  init: () => ({ zone: { x: 0, z: 0 }, next: null, moveAt: 0, gap: RE.every, king: null, score: {}, sentAt: 0 }),
  spawn: (_api, _id, i, n) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.sin(a) * 9.5, y: 0, z: Math.cos(a) * 9.5, r: a + Math.PI };
  },
  play: (api) => {
    api.ext.moveAt = api.now + RE.every;
  },
  tick(api, dt) {
    const E = api.ext;
    let changed = false;
    // chi cade riparte dal bordo, girato verso il centro
    for (const id of api.ids()) {
      const p = api.pos(id);
      if (p && p.y < PHYS.fallOut) {
        const a = api.rand(0, Math.PI * 2);
        api.teleport(id, { x: Math.sin(a) * RE.respawnR, y: 0, z: Math.cos(a) * RE.respawnR, r: a + Math.PI });
        api.emit({ k: 're_fall', id });
      }
    }
    // il cerchio: prima si vede dove andrà, poi si sposta (sempre più spesso)
    if (!E.next && api.now >= E.moveAt - RE.warn) {
      E.next = spot(api, E.zone);
      changed = true;
    }
    if (E.next && api.now >= E.moveAt) {
      E.zone = E.next;
      E.next = null;
      E.gap = Math.max(RE.minEvery, E.gap - 700);
      E.moveAt = api.now + E.gap;
      api.emit({ k: 're_move', x: E.zone.x, z: E.zone.z });
      changed = true;
    }
    // il re: uno solo dentro il cerchio
    const inside = api.ids().filter((id) => inZone(api, id, E.zone));
    const king = inside.length === 1 ? inside[0] : null;
    if (king !== E.king) {
      E.king = king;
      api.emit({ k: 're_king', id: king, contested: inside.length > 1 });
      changed = true;
    }
    if (king) E.score[king] = (E.score[king] ?? 0) + dt;
    // i punti dal vivo viaggiano come effetto (leggero), lo stato intero solo quando cambia qualcosa
    if (api.now - E.sentAt > 500) {
      E.sentAt = api.now;
      api.emit({ k: 're_score', s: Object.fromEntries(Object.entries(E.score).map(([id, v]) => [id, Math.round(v * 10) / 10])) });
    }
    return changed;
  },
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    // mai troppo vicino al bordo
    if (Math.hypot(me.x, me.z) > RE.r - 1.3) {
      api.go(b, 0, 0);
      return;
    }
    // i più svegli vanno verso il cerchio nuovo appena compare
    const early = E.next && api.now > E.moveAt - RE.warn * (0.2 + b.skill * 0.8);
    const target = early && E.next ? E.next : E.zone;
    // ognuno punta un punto un po' diverso del cerchio (così non si ammucchiano tutti al centro)
    if (!b.mem.off || api.now >= b.thinkAt) {
      b.thinkAt = api.now + api.rand(900, 2200);
      const a = api.rand(0, Math.PI * 2);
      b.mem.off = { x: Math.sin(a) * RE.zoneR * 0.45, z: Math.cos(a) * RE.zoneR * 0.45 };
    }
    const d = api.go(b, target.x + b.mem.off.x, target.z + b.mem.off.z, 0.8 + b.skill * 0.2);
    if (d > 9 && Math.random() < 0.01 * b.skill) api.dash(b);
    // nel cerchio con qualcun altro: schiaffo al più vicino (verso fuori)
    if (Math.hypot(me.x - E.zone.x, me.z - E.zone.z) < RE.zoneR + 1.5) {
      let rival: { x: number; z: number; d: number } | null = null;
      for (const id of api.ids()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!p || Math.abs(p.y - me.y) > 1.5) continue;
        const dd = Math.hypot(p.x - me.x, p.z - me.z);
        if (dd < PHYS.pushRange - 0.3 && (!rival || dd < rival.d)) rival = { x: p.x, z: p.z, d: dd };
      }
      if (rival && Math.random() < 0.06 + b.skill * 0.12) api.push(b, rival.x, rival.z);
    }
    if (Math.random() < 0.003) b.input.jump = true;
  },
  rank: (api) => {
    // più secondi da re = più punti (pari merito nello stesso gruppo)
    const sec = (id: string) => Math.round((api.ext.score[id] ?? 0) * 10);
    const groups = new Map<number, string[]>();
    for (const id of api.ids()) groups.set(sec(id), [...(groups.get(sec(id)) ?? []), id]);
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
  },
  view: (api) => ({
    zone: api.ext.zone,
    next: api.ext.next,
    moveAt: api.ext.moveAt,
    king: api.ext.king,
    score: Object.fromEntries(Object.entries(api.ext.score).map(([id, v]) => [id, Math.round(v)])),
  }),
});
