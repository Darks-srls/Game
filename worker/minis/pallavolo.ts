// 🏐 Beach volley (server): il pallone simulato qui (tocchi, schiacciate, rete, sabbia), battute a turno, punti,
// e i bot che prevedono dove scende il pallone, si dividono il campo, saltano al momento giusto e schiacciano
import { bindSide } from '../../src/data/minis/squadre';
import { VOLLEY, stepVolley, type VBall } from '../../src/data/minis/pallavolo';
import { gauss, mates, splitTeams, teamRank, trackHumans, velOf } from './squadre';
import { registerServerMini, type MiniApi, type MiniBot } from './types';

interface PvState {
  team: Record<string, number>;
  score: number[];
  pts: Record<string, number>; // punti fatti (ultimo tocco della squadra che segna)
  phase: 'SERVE' | 'RALLY' | 'POINT';
  until: number; // SERVE: battuta automatica; POINT: battuta successiva
  lock: number; // il pallone della battuta non si tocca fino a qui
  server: string | null;
  serveTeam: number;
  rot: number[]; // a chi tocca battere (per squadra)
  ball: VBall;
  touch: (string | null)[]; // ultimo tocco di ogni squadra
  hitAt: Record<string, number>;
  touches: number; // tocchi nello scambio (per la cronaca)
}
type Api = MiniApi<PvState>;

const R = VOLLEY.ballR;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const sideOf = (t: number) => (t ? 1 : -1); // la metà della squadra (segno di z)

// battuta: il pallone fermo a mezz'aria davanti a chi batte (a turno nella squadra), in fondo al campo
function setupServe(api: Api, team: number) {
  const E = api.ext;
  const list = mates(api, E.team, team).filter((id) => api.alive(id));
  const server = list.length ? list[E.rot[team]++ % list.length] : null;
  const s = sideOf(team);
  const sx = Math.round(api.rand(-2.5, 2.5) * 10) / 10;
  const sz = s * 8.6;
  E.phase = 'SERVE';
  E.server = server;
  E.serveTeam = team;
  E.lock = api.now + VOLLEY.serveLock;
  E.until = api.now + VOLLEY.serveWait;
  E.ball = { x: sx, y: 3.3, z: sz - s * 0.9, vx: 0, vy: 0, vz: 0 };
  E.touch = [null, null];
  E.touches = 0;
  if (server) api.teleport(server, { x: sx, y: 0, z: sz, r: team ? Math.PI : 0 });
  api.emit({ k: 'pv_serve', id: server, team });
}

// si può toccare il pallone adesso? (durante la battuta solo chi batte, dopo un attimo)
function canTouch(api: Api, id: string) {
  const E = api.ext;
  if (E.phase === 'POINT') return false;
  if (E.phase === 'SERVE') return api.now >= E.lock && E.team[id] === E.serveTeam;
  return true;
}

// tocco: chi ci corre o ci salta contro lo rimanda verso il campo avversario (più forte da lontano)
function bump(api: Api, id: string, p: { x: number; y: number; z: number }) {
  const E = api.ext;
  const B = E.ball;
  const t = E.team[id];
  const dirZ = -sideOf(t);
  const v = velOf(api, id);
  const jumping = p.y > 0.45;
  const depth = Math.abs(p.z);
  const cy = clamp(B.y, p.y + 0.5, p.y + 1.9);
  const dx = B.x - p.x;
  const dy = B.y - cy;
  const dz = B.z - p.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  if (B.y > p.y + 1.55) {
    // preso bene (da sotto, di testa o saltando): torna di là, alto
    B.vy = jumping ? VOLLEY.jumpUp : VOLLEY.bump;
    B.vz = dirZ * ((jumping ? VOLLEY.jumpFwd : VOLLEY.bumpFwd) + depth * 0.35 + Math.max(0, v.vz * dirZ) * 0.2);
    B.vx = clamp((B.x - p.x) * 1.3 + v.vx * 0.3 - B.x * 0.12, -3.5, 3.5);
  } else {
    // preso di petto o di pancia (troppo basso): rimbalza dove capita, piano
    const vn = B.vx * (dx / d) + B.vy * (dy / d) + B.vz * (dz / d);
    if (vn < 0) {
      B.vx -= 1.5 * vn * (dx / d);
      B.vy -= 1.5 * vn * (dy / d);
      B.vz -= 1.5 * vn * (dz / d);
    }
    B.vx = B.vx * 0.6 + v.vx * 0.3;
    B.vz = B.vz * 0.6 + v.vz * 0.3;
    B.vy = Math.max(B.vy * 0.5, 2.6);
  }
  // fuori dal corpo (niente doppio tocco)
  const min = R + VOLLEY.touchR + 0.05;
  B.x = p.x + (dx / d) * min;
  B.y = Math.max(R + 0.05, cy + (dy / d) * min);
  B.z = p.z + (dz / d) * min;
  hit(api, id, B.y > p.y + 1.55 ? (jumping ? 'j' : 'b') : 'm');
}

function hit(api: Api, id: string, how: string) {
  const E = api.ext;
  E.touch[E.team[id]] = id;
  E.hitAt[id] = api.now;
  E.touches++;
  if (E.phase === 'SERVE') E.phase = 'RALLY';
  api.emit({ k: how === 's' ? 'pv_spike' : 'pv_hit', id, how, x: r2(E.ball.x), y: r2(E.ball.y), z: r2(E.ball.z) });
}

// SCHIACCIATA: se il pallone è a portata, parte forte verso il campo avversario (in diagonale dove miro);
// saltando va giù a picco, da terra è un tiro teso che passa comunque la rete
function spike(api: Api, by: string, aim?: number): boolean {
  const E = api.ext;
  const B = E.ball;
  const p = api.pos(by);
  const t = E.team[by];
  if (!p || t === undefined || !api.alive(by) || api.stage !== 'PLAY' || !canTouch(api, by)) return false;
  const hd = Math.hypot(B.x - p.x, B.z - p.z);
  if (hd > R + 1.3 || B.y < p.y + 0.5 || B.y > p.y + 2.3 + R + 0.6) return false;
  const dirZ = -sideOf(t);
  const a = Number.isFinite(aim) ? (aim as number) : p.r;
  const dx = clamp(Math.sin(a), -0.75, 0.75);
  const dz = dirZ * Math.sqrt(1 - dx * dx);
  let vy = p.y > 0.5 ? VOLLEY.spikeDown : 2.5;
  // dalla mia metà deve passare sopra la rete
  if (B.z * sideOf(t) > 0) {
    const tn = Math.abs(B.z) / (VOLLEY.spike * Math.abs(dz));
    vy = Math.max(vy, (VOLLEY.netH + R + 0.25 - B.y + 0.5 * VOLLEY.gravity * tn * tn) / tn);
  }
  B.vx = dx * VOLLEY.spike;
  B.vz = dz * VOLLEY.spike;
  B.vy = Math.min(vy, 14);
  const b = api.bot(by);
  if (b) b.pushAnimUntil = api.now + 350;
  hit(api, by, 's');
  return true;
}

// ---------------------------------------------------------------- bot

// dove scende il pallone: il primo punto in cui, scendendo, arriva all'altezza di un tocco (o la sabbia)
function predict(B0: VBall, hTouch: number) {
  const B = { ...B0 };
  for (let k = 0; k < 90; k++) {
    const ev = stepVolley(B, 0.05);
    if ((B.vy < 0 && B.y <= hTouch) || ev === 'floor') return { x: B.x, z: B.z, t: (k + 1) * 0.05 };
  }
  return { x: B.x, z: B.z, t: 4.5 };
}

// la zona di ognuno nella sua metà (in metri dalla rete): così si dividono il campo
const ZONES = [
  [0, 5.6],
  [-3.2, 3],
  [3.2, 3],
  [-3, 8],
  [3, 8],
  [0, 1.8],
  [0, 9.4],
];

function botPlay(api: Api, b: MiniBot) {
  const E = api.ext;
  const me = b.body;
  const t = E.team[b.id];
  const s = sideOf(t);
  const dirZ = -s;
  const now = api.now;
  const B = E.ball;
  const team = mates(api, E.team, t).filter((id) => api.alive(id));
  const k = Math.max(0, team.indexOf(b.id));
  const zone = ZONES[k % ZONES.length];
  const home = { x: zone[0] + clamp(B.x * 0.3, -1.5, 1.5), z: s * zone[1] };
  if (E.phase === 'POINT') {
    api.go(b, home.x, home.z, 0.5);
    return;
  }
  if (E.phase === 'SERVE') {
    if (E.server !== b.id || now < E.lock) {
      api.go(b, home.x, home.z, 0.6);
      return;
    }
    b.mem.serveAt ||= now + api.rand(250, 1100);
    if (now < b.mem.serveAt) return;
    // battuta: schiacciata verso un punto a caso del campo avversario (se non arrivo, cammino sotto il pallone)
    const tx = api.rand(-4.5, 4.5);
    const tz = dirZ * api.rand(4, 9);
    if (!spike(api, b.id, Math.atan2(tx - me.x, tz - me.z))) api.go(b, B.x, B.z + s * 0.4);
    else b.mem.serveAt = 0;
    return;
  }
  // scambio: dopo ogni tocco ci vuole un attimo per capire dove va (i bravi capiscono prima), poi la previsione
  // si rifà spesso, con un errore che dipende dalla bravura
  if (b.mem.seen !== E.touches) {
    b.mem.seen = E.touches;
    // una schiacciata (pallone veloce) si legge peggio
    const fast = Math.hypot(B.vx, B.vz) > 9;
    b.mem.predAt = now + (fast ? 380 : 200) + (1 - b.skill) * (fast ? 650 : 480) + api.rand(0, 150);
    const e = (1.15 - b.skill) * (fast ? 2.4 : 1.6);
    b.mem.err = { x: gauss() * e, z: gauss() * e };
  }
  if (!b.mem.pred || now >= b.mem.predAt) {
    b.mem.predAt = now + 140;
    const p = predict(B, 2.5);
    b.mem.err ??= { x: 0, z: 0 };
    b.mem.pred = { x: p.x + b.mem.err.x, z: p.z + b.mem.err.z, t: p.t };
  }
  const pred = b.mem.pred as { x: number; z: number; t: number };
  const mine = pred.z * s > 0.2 && B.vz * dirZ < 3; // scende nella mia metà
  let go = false;
  if (mine) {
    // ci va il più vicino della squadra (i giocatori veri contano un po' meno: magari non ci vanno)
    const myD = Math.hypot(pred.x - me.x, pred.z - me.z);
    go = true;
    for (const id of team) {
      if (id === b.id) continue;
      const q = api.pos(id);
      if (!q) continue;
      const d = Math.hypot(pred.x - q.x, pred.z - q.z) + (api.bot(id) ? 0 : 1.5);
      if (d < myD - 0.2) go = false;
    }
  }
  if (go) {
    // sotto il pallone, un passo più indietro (così il tocco lo manda avanti)
    const tx = clamp(pred.x, -VOLLEY.halfX + 0.7, VOLLEY.halfX - 0.7);
    const tz = clamp(pred.z + s * 0.45, Math.min(s * 0.7, s * (VOLLEY.halfZ - 0.7)), Math.max(s * 0.7, s * (VOLLEY.halfZ - 0.7)));
    const d = api.go(b, tx, tz, 0.9);
    if (d > 4 && pred.t < d / 7 && Math.random() < 0.1 * b.skill) api.dash(b);
  } else {
    // a muro: se di là stanno per attaccare vicino alla rete, chi è davanti salta sotto la rete
    const front = zone[1] < 3.5;
    if (front && B.z * s < 0 && Math.abs(B.z) < 3 && B.y > 3) api.go(b, clamp(B.x, -VOLLEY.halfX + 1, VOLLEY.halfX - 1), s * 0.8);
    else api.go(b, home.x, home.z, 0.75);
  }
  // salto al momento giusto: il pallone arriva qui sopra all'altezza delle mani
  const hd = Math.hypot(B.x - me.x, B.z - me.z);
  if (me.ground && hd < 2.2 && B.y > 2.6 && B.y < 4.6 && B.vy < 1.5 && Math.random() < 0.15 + b.skill * 0.35) b.input.jump = true;
  // schiacciata: pallone alto e a portata, meglio se vicino alla rete
  if (now - (E.hitAt[b.id] ?? 0) > 400 && hd < R + 1.2 && B.y > me.y + 1.6 && B.y < me.y + 3.8) {
    // dal fondo si schiaccia poco (e male): si aspetta il pallone buono sotto rete, meglio se saltando
    const nearNet = Math.abs(me.z) < 4.5;
    if (Math.random() < (nearNet ? (me.y > 0.5 ? 0.3 + b.skill * 0.5 : 0.08 + b.skill * 0.15) : 0.012)) {
      // mira lontano dagli avversari
      let tx = api.rand(-4.5, 4.5);
      let best = -1;
      for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
        let far = 99;
        for (const id of api.inGame()) {
          if (E.team[id] === t) continue;
          const q = api.pos(id);
          if (q) far = Math.min(far, Math.abs(q.x - cx));
        }
        if (far > best) {
          best = far;
          tx = cx;
        }
      }
      spike(api, b.id, Math.atan2(tx - me.x, dirZ * api.rand(4, 8.5) - me.z));
    }
  }
}

registerServerMini<PvState>({
  kind: 'PALLAVOLO',
  ends: 'time',
  falls: 'none',
  init: (api) => ({
    team: splitTeams(api),
    score: [0, 0],
    pts: {},
    phase: 'SERVE',
    until: 0,
    lock: 0,
    server: null,
    serveTeam: 0,
    rot: [0, 0],
    ball: { x: 0, y: 3.3, z: -7.7, vx: 0, vy: 0, vz: 0 },
    touch: [null, null],
    hitAt: {},
    touches: 0,
  }),
  spawn: (api, id) => {
    const E = api.ext;
    const t = E.team[id] ?? 0;
    const k = Math.max(0, mates(api, E.team, t).indexOf(id));
    const z = ZONES[k % ZONES.length];
    return { x: z[0], y: 0, z: sideOf(t) * z[1], r: t ? Math.PI : 0 };
  },
  play: (api) => setupServe(api, Math.random() < 0.5 ? 0 : 1),
  tick(api, dt) {
    const E = api.ext;
    const now = api.now;
    const B = E.ball;
    let changed = false;
    trackHumans(api);
    if (E.phase === 'POINT') {
      if (now >= E.until) {
        if (Math.max(...E.score) >= VOLLEY.target) {
          api.end();
          return true;
        }
        setupServe(api, E.serveTeam);
        changed = true;
      }
    } else if (E.phase === 'SERVE' && now >= E.until) {
      // nessuno ha battuto: parte da solo, a campanile verso gli altri
      const dirZ = -sideOf(E.serveTeam);
      Object.assign(B, { vx: api.rand(-1, 1), vy: 7.6, vz: dirZ * 6 });
      E.phase = 'RALLY';
      api.emit({ k: 'pv_hit', id: E.server, how: 'a', x: r2(B.x), y: r2(B.y), z: r2(B.z) });
      changed = true;
    }
    // tocchi: chi ha il corpo contro il pallone
    if (E.phase !== 'POINT') {
      for (const id of api.inGame()) {
        if (now - (E.hitAt[id] ?? 0) < 380 || !canTouch(api, id)) continue;
        const p = api.pos(id);
        if (!p) continue;
        const cy = clamp(B.y, p.y + 0.5, p.y + 1.9);
        if (Math.hypot(B.x - p.x, B.y - cy, B.z - p.z) > R + VOLLEY.touchR) continue;
        bump(api, id, p);
        changed = true;
        break;
      }
    }
    // il pallone (fermo durante la battuta)
    if (E.phase === 'RALLY') {
      let net = false;
      for (let k = 0; k < 4; k++) {
        const ev = stepVolley(B, dt / 4);
        if (ev === 'net') net = true;
        if (ev === 'floor') {
          // sulla sabbia: punto a chi sta dall'altra parte (all'ultimo che l'ha toccata di quella squadra il bonus)
          const team = B.z < 0 ? 1 : 0;
          const by = E.touch[team];
          E.score[team]++;
          if (by) E.pts[by] = (E.pts[by] ?? 0) + 1;
          E.phase = 'POINT';
          E.until = now + VOLLEY.pointMs;
          E.serveTeam = team;
          Object.assign(B, { vx: 0, vy: 0, vz: 0 });
          api.emit({ k: 'pv_point', team, by, x: r2(B.x), z: r2(B.z), n: E.touches });
          changed = true;
          break;
        }
      }
      if (net && now - (E.hitAt._net ?? 0) > 400) {
        E.hitAt._net = now;
        api.emit({ k: 'pv_net', x: r2(B.x) });
      }
    }
    api.setObj('pv_ball', { x: r2(B.x), y: r2(B.y), z: r2(B.z), r: 0, a: E.phase === 'SERVE' ? 1 : 0 });
    return changed;
  },
  // lo schiaffo (o il clic) vicino al pallone è una schiacciata; lontano non fa niente
  push: (api, by) => spike(api, by),
  actions: {
    MG_PV_SCHIACCIA: (api, me, payload) => spike(api, me, Number(payload?.a)),
  },
  bot(api, b) {
    const t = api.ext.team[b.id];
    if (t === undefined) return;
    bindSide(b.body, t);
    botPlay(api, b);
  },
  rank: (api) => {
    const E = api.ext;
    return teamRank(api, E.team, E.score, (id) => 2 * (E.pts[id] ?? 0), (id) => !api.alive(id));
  },
  view: (api, me) => {
    const E = api.ext;
    return {
      team: E.team,
      my: E.team[me],
      score: E.score,
      pts: E.pts,
      phase: E.phase,
      until: E.until,
      lock: E.lock,
      server: E.server,
      serveTeam: E.serveTeam,
    };
  },
});
