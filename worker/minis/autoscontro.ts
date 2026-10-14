// 🚗 Autoscontro (server): gli urti tra le auto (chi va più forte spinge di più), chi butta giù chi, i bot che speronano
import { AUTO, autoRadius } from '../../src/data/minis/autoscontro';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface AutoState {
  ko: Record<string, number>; // quanti ne hai buttati giù
  last: Record<string, { by: string; at: number }>; // l'ultimo che ti ha urtato (si prende il merito se cadi)
  pair: Record<string, number>; // ultimo urto di ogni coppia (così non si riurtano dieci volte di fila)
  vel: Record<string, { x: number; z: number; t: number; vx: number; vz: number }>; // velocità stimata dei giocatori veri
  outs: string[]; // ordine di uscita
}

interface BotMem {
  target?: string;
  until?: number;
  dodgeAt?: number;
  turboAt?: number;
  side?: number;
}

type Car = { id: string; x: number; y: number; z: number; vx: number; vz: number; bot?: MiniBot };

// velocità di un'auto: i bot la sanno, quella dei giocatori veri si stima dalle posizioni
function velOf(api: MiniApi<AutoState>, id: string) {
  if (api.bot(id)) return api.vel(id);
  const v = api.ext.vel[id];
  return v ? { vx: v.vx, vz: v.vz } : { vx: 0, vz: 0 };
}

function trackHumans(api: MiniApi<AutoState>) {
  const E = api.ext;
  for (const id of api.humans) {
    const p = api.pos(id);
    if (!p) continue;
    const v = E.vel[id];
    if (!v) E.vel[id] = { x: p.x, z: p.z, t: api.now, vx: 0, vz: 0 };
    else if (p.x !== v.x || p.z !== v.z || api.now - v.t > 300) {
      const h = Math.max(0.03, (api.now - v.t) / 1000);
      v.vx = v.vx * 0.35 + ((p.x - v.x) / h) * 0.65;
      v.vz = v.vz * 0.35 + ((p.z - v.z) / h) * 0.65;
      v.x = p.x;
      v.z = p.z;
      v.t = api.now;
    }
  }
}

// un bot perde lo slancio verso chi ha appena urtato (e il turbo si spegne)
function brake(b: MiniBot | undefined, nx: number, nz: number) {
  if (!b) return;
  const vn = b.body.vx * nx + b.body.vz * nz;
  if (vn > 0) {
    b.body.vx -= nx * vn * 0.85;
    b.body.vz -= nz * vn * 0.85;
  }
  b.body.dashT = 0;
}

function collisions(api: MiniApi<AutoState>) {
  const E = api.ext;
  const cars: Car[] = [];
  for (const id of api.inGame()) {
    const p = api.pos(id);
    if (!p || p.y < -0.8) continue;
    const v = velOf(api, id);
    cars.push({ id, x: p.x, y: p.y, z: p.z, vx: v.vx, vz: v.vz, bot: api.bot(id) });
  }
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const A = cars[i];
      const B = cars[j];
      if (Math.abs(A.y - B.y) > 1.0) continue; // uno è saltato sopra l'altro
      let dx = B.x - A.x;
      let dz = B.z - A.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > AUTO.hitR * AUTO.hitR) continue;
      const d = Math.sqrt(d2);
      if (d < 0.01) {
        dx = Math.random() - 0.5;
        dz = Math.random() - 0.5;
      }
      const dl = Math.hypot(dx, dz) || 1;
      const nx = dx / dl;
      const nz = dz / dl;
      const a = A.vx * nx + A.vz * nz; // A va verso B
      const b = -(B.vx * nx + B.vz * nz); // B va verso A
      const close = a + b;
      const key = A.id < B.id ? `${A.id}|${B.id}` : `${B.id}|${A.id}`;
      if (close < AUTO.minClose || api.now - (E.pair[key] ?? 0) < AUTO.pairMs) {
        // solo un contatto: i bot si scostano (i giocatori veri lo fanno sul loro telefono)
        const over = AUTO.hitR - 0.2 - d;
        if (over > 0) {
          const share = A.bot && B.bot ? 0.5 : 1;
          if (A.bot) {
            A.bot.body.x -= nx * over * share;
            A.bot.body.z -= nz * over * share;
          }
          if (B.bot) {
            B.bot.body.x += nx * over * share;
            B.bot.body.z += nz * over * share;
          }
        }
        continue;
      }
      E.pair[key] = api.now;
      // BONK: ognuno vola via con la spinta dell'altro (chi arriva più forte spinge di più)
      const toB = 0.85 * Math.max(0, a) + 0.25 * Math.max(0, b) + 1.8;
      const toA = 0.85 * Math.max(0, b) + 0.25 * Math.max(0, a) + 1.8;
      api.fling(B.id, { vx: nx * toB, vy: 2.2 + Math.min(3.5, toB * 0.18), vz: nz * toB });
      api.fling(A.id, { vx: -nx * toA, vy: 2.2 + Math.min(3.5, toA * 0.18), vz: -nz * toA });
      brake(A.bot, nx, nz);
      brake(B.bot, -nx, -nz);
      E.last[B.id] = { by: A.id, at: api.now };
      E.last[A.id] = { by: B.id, at: api.now };
      api.emit({ k: 'auto_bonk', a: A.id, b: B.id, x: Math.round((A.x + B.x) * 50) / 100, z: Math.round((A.z + B.z) * 50) / 100, p: Math.round(close * 10) / 10, w: a >= b ? A.id : B.id });
    }
  // via le coppie vecchie (lo stato resta piccolo)
  for (const k of Object.keys(E.pair)) if (api.now - E.pair[k] > 3000) delete E.pair[k];
}

registerServerMini<AutoState>({
  kind: 'AUTOSCONTRO',
  ends: 'last',
  init: () => ({ ko: {}, last: {}, pair: {}, vel: {}, outs: [] }),
  spawn: (_api, _id, i, n) => {
    // in cerchio, girati di lato (si parte già a girare in tondo)
    const a = (i / n) * Math.PI * 2;
    const r = n > 8 ? 9.5 : 8.5;
    return { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, r: a + Math.PI };
  },
  tick(api) {
    const E = api.ext;
    let changed = false;
    trackHumans(api);
    collisions(api);
    // chi è caduto: merito a chi l'ha urtato per ultimo
    for (const id of api.ids()) {
      if (api.alive(id) || E.outs.includes(id)) continue;
      E.outs.push(id);
      const L = E.last[id];
      if (L && api.now - L.at < AUTO.koMs && L.by !== id) {
        E.ko[L.by] = (E.ko[L.by] ?? 0) + 1;
        api.emit({ k: 'auto_ko', id, by: L.by });
      }
      changed = true;
    }
    return changed;
  },
  bot(api, b) {
    const E = api.ext;
    const me = b.body;
    const now = api.now;
    const m = b.mem as BotMem;
    if (me.y < -0.4) return; // sta già cadendo
    const R = autoRadius(api.t + 1); // pensa un po' avanti: la pista si stringe
    const vx = me.vx + me.kx;
    const vz = me.vz + me.kz;
    const r = Math.hypot(me.x, me.z);
    m.side ??= Math.random() < 0.5 ? 1 : -1;
    // 1) mai troppo vicino al bordo: si scivola, bisogna correggere prima (i bravi guardano più avanti)
    const look = 0.35 + b.skill * 0.5;
    const fx = me.x + vx * look;
    const fz = me.z + vz * look;
    const margin = (1.1 + b.skill * 1.3) * (0.55 + (0.45 * R) / AUTO.r0);
    if (Math.hypot(fx, fz) > R - margin) {
      api.go(b, -me.x * 0.3 + m.side * me.z * 0.25, -me.z * 0.3 - m.side * me.x * 0.25);
      // salvataggio col turbo: chi è bravo scatta verso il centro quando sta per volare giù
      const outward = r > 0.01 ? (vx * me.x + vz * me.z) / r : 0;
      if (r > R - 1.8 && outward > 2.5 && Math.random() < b.skill * 0.45) {
        b.input = { x: -me.x / r, z: -me.z / r, jump: false };
        api.dash(b);
      }
      return;
    }
    // 2) schivata: qualcuno mi arriva addosso forte
    if (now > (m.dodgeAt ?? 0)) {
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!p || p.y < -0.5) continue;
        const rx = p.x - me.x;
        const rz = p.z - me.z;
        const d = Math.hypot(rx, rz);
        if (d > 6 || d < 0.1) continue;
        const ov = velOf(api, id);
        const c = ((ov.vx - vx) * -rx + (ov.vz - vz) * -rz) / d; // quanto si avvicina
        const ttc = (d - AUTO.hitR) / Math.max(0.1, c);
        if (c < 7 || ttc > 0.6) continue;
        m.dodgeAt = now + 900;
        if (Math.random() < b.skill * 0.8 - 0.15) {
          // di lato, dalla parte del centro
          let px = -rz / d;
          let pz = rx / d;
          if (px * me.x + pz * me.z > 0) {
            px = -px;
            pz = -pz;
          }
          if (b.skill > 0.6 && Math.random() < 0.35) b.input = { x: px, z: pz, jump: true };
          else {
            b.input = { x: px, z: pz, jump: false };
            api.dash(b);
          }
          return;
        }
        break;
      }
    }
    // 3) un bersaglio: vicino e (per i bravi) già verso il bordo
    if (!m.target || now > (m.until ?? 0) || !api.alive(m.target)) {
      let best: { id: string; s: number } | null = null;
      for (const id of api.inGame()) {
        if (id === b.id) continue;
        const p = api.pos(id);
        if (!p || p.y < -0.5) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        const s = -d * 0.6 + (Math.hypot(p.x, p.z) / R) * 6 * b.skill + Math.random() * 3;
        if (!best || s > best.s) best = { id, s };
      }
      m.target = best?.id;
      m.until = now + api.rand(1500, 3200);
    }
    const tp = m.target ? api.pos(m.target) : null;
    if (!tp) {
      // da solo: gira in tondo
      const a = api.t * 0.6 * m.side;
      api.go(b, Math.sin(a) * R * 0.4, Math.cos(a) * R * 0.4, 0.8);
      return;
    }
    const tv = velOf(api, m.target!);
    const d = Math.hypot(tp.x - me.x, tp.z - me.z);
    // mira con anticipo (dove sarà), i più bravi meglio
    const lead = Math.min(0.9, d / 10) * (0.3 + b.skill * 0.7);
    let gx = tp.x + tv.vx * lead;
    let gz = tp.z + tv.vz * lead;
    // i bravi passano prima dalla parte del centro, così lo spingono verso fuori
    const rt = Math.hypot(tp.x, tp.z);
    if (b.skill > 0.5 && rt < r - 1.2 && d > 2.5) {
      gx *= 0.45;
      gz *= 0.45;
    }
    const gr = Math.hypot(gx, gz);
    const lim = R - margin;
    if (gr > lim) {
      gx *= lim / gr;
      gz *= lim / gr;
    }
    const gd = api.go(b, gx, gz);
    // turbo quando è allineato e vicino (e, se è bravo, solo se non vola giù anche lui)
    if (d < 6.5 && d > 1.8 && gd > 0.5 && now > (m.turboAt ?? 0)) {
      const dx = (gx - me.x) / gd;
      const dz = (gz - me.z) / gd;
      const sp = Math.hypot(vx, vz);
      const along = sp > 0.5 ? (vx * dx + vz * dz) / sp : 1;
      const safe = Math.hypot(me.x + dx * 4.5, me.z + dz * 4.5) < R - 0.8 || b.skill < 0.45;
      if (along > 0.9 - (1 - b.skill) * 0.35 && safe && Math.random() < 0.18 + b.skill * 0.3) {
        api.dash(b);
        m.turboAt = now + api.rand(900, 1800);
      }
    }
    if (Math.random() < 0.002) b.input.jump = true;
  },
  rank: (api) => {
    const E = api.ext;
    // chi è ancora in pista (a pari merito, prima chi ne ha buttati giù di più), poi gli altri dall'ultimo caduto
    const alive = api.ids().filter((id) => api.alive(id));
    const byKo = new Map<number, string[]>();
    for (const id of alive) byKo.set(E.ko[id] ?? 0, [...(byKo.get(E.ko[id] ?? 0) ?? []), id]);
    const groups = [...byKo.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
    const outs = [...E.outs, ...api.ids().filter((id) => !api.alive(id) && !E.outs.includes(id))];
    for (const id of outs.reverse()) groups.push([id]);
    return groups;
  },
  view: (api) => ({ ko: api.ext.ko }),
});
