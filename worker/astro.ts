// 🚀 Astro Impostori: un videogioco in tempo reale stile "tra di noi nello spazio".
// Le posizioni arrivano dai telefoni a ~10 aggiornamenti al secondo e restano in memoria nel Durable Object
// (vedi RT_MOVE in index.ts); qui ci sono le regole: compiti, eliminazioni, riunioni, voti e vittoria.
import type { AstroView, GameId } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import { shuffle } from './party';
import {
  BUTTON,
  BUTTON_COOLDOWN,
  BUTTON_RANGE,
  CAMERA_CONSOLE,
  CONSOLE_RANGE,
  DISCUSS_MS,
  DOORS,
  DOOR_COOLDOWN,
  DOOR_MS,
  FIX_POINTS,
  FIX_RANGE,
  KILL_RANGE,
  REPORT_RANGE,
  ROOMS,
  SABOTAGE_COOLDOWN,
  SABOTAGE_INFO,
  SABOTAGE_MS,
  STATIONS,
  TASK_RANGE,
  VENTS,
  VENT_RANGE,
  dist,
  spawnPoint,
  type SabotageKind,
} from '../src/data/astro';

interface AstroState {
  order: string[];
  colors: Record<string, number>;
  impostors: string[];
  alive: Record<string, boolean>;
  tasks: Record<string, { station: number; done: boolean }[]>;
  bodies: { id: string; x: number; y: number }[];
  killReadyAt: Record<string, number>;
  emergencies: Record<string, number>;
  stage: AstroView['stage'];
  stageEndsAt: number | null;
  meeting: { caller: string; body: string | null; votes: Record<string, string>; voteFrom: number } | null;
  ejected: AstroView['ejected'];
  warps: Record<string, { x: number; y: number; n: number }>; // botole: dove riappare l'impostore
  sabotage: { kind: SabotageKind; endsAt: number | null; fixed: string[]; holders: Record<string, string> } | null;
  doors: Record<string, number>; // stanze con le porte chiuse → quando si riaprono da sole
  sabotageReadyAt: number;
  doorsReadyAt: number;
  buttonReadyAt: number;
  shownProgress: number; // la barra che vedono tutti (in ritardo e irregolare rispetto a quella vera)
  barAt: number; // prossimo aggiornamento della barra
  watching: string[]; // chi sta guardando le telecamere
  confirmedDead: string[];
  killedBy: Record<string, string>;
  winner: AstroView['winner'];
  winReason: string | null;
  spawnNo: number;
  killMs: number;
  meetingMs: number;
}

const INTRO_MS = 6_000;
const EJECT_MS = 7_000;
const SLACK = 25; // tolleranza sulle distanze (le posizioni arrivano con un po' di ritardo)

const isImpostor = (s: AstroState, id: string) => s.impostors.includes(id);

// Tutti al tavolo della mensa (inizio partita e dopo ogni riunione)
function gather(s: AstroState, ctx: Ctx) {
  s.spawnNo += 1;
  ctx.teleport(Object.fromEntries(s.order.map((id, i) => [id, spawnPoint(i, s.order.length)])));
}

const crewTasks = (s: AstroState) => s.order.filter((id) => !isImpostor(s, id)).flatMap((id) => s.tasks[id] ?? []);
const realProgress = (s: AstroState) => {
  const tasks = crewTasks(s);
  return tasks.length ? tasks.filter((t) => t.done).length / tasks.length : 0;
};
// La barra dei compiti non si muove subito: si aggiorna a intervalli irregolari (e ogni tanto salta il giro),
// così nessuno capisce chi ha fatto davvero un compito guardando se la barra sale
const barGap = () => 10_000 + Math.random() * 20_000;

function checkWin(s: AstroState): boolean {
  const impAlive = s.impostors.filter((id) => s.alive[id]).length;
  const crewAlive = s.order.filter((id) => s.alive[id] && !isImpostor(s, id)).length;
  const tasks = crewTasks(s);
  if (impAlive === 0) {
    s.winner = 'CREW';
    s.winReason = 'Tutti gli impostori sono stati scoperti!';
  } else if (impAlive >= crewAlive) {
    s.winner = 'IMPOSTORS';
    s.winReason = 'Gli impostori sono in maggioranza…';
  } else if (tasks.length && tasks.every((t) => t.done)) {
    s.winner = 'CREW';
    s.winReason = 'L’equipaggio ha completato tutti i compiti!';
  } else return false;
  s.stage = 'END';
  s.stageEndsAt = null;
  return true;
}

function startMeeting(s: AstroState, caller: string, body: string | null, ctx: Ctx) {
  s.stage = 'MEETING';
  // prima 10 secondi di sola discussione, poi si vota
  s.meeting = { caller, body, votes: {}, voteFrom: ctx.now + DISCUSS_MS };
  s.stageEndsAt = s.meeting.voteFrom + s.meetingMs;
  s.confirmedDead = s.order.filter((id) => !s.alive[id]);
  s.bodies = [];
  s.ejected = null;
  s.sabotage = null;
  s.doors = {};
  s.shownProgress = Math.max(s.shownProgress, realProgress(s)); // in riunione la barra è aggiornata
  s.watching = [];
}

// Sabotaggio riparato: per un po' l'impostore non può farne un altro
function endSabotage(s: AstroState, ctx: Ctx) {
  s.sabotage = null;
  s.sabotageReadyAt = ctx.now + SABOTAGE_COOLDOWN;
}

// Fine votazione: chi prende più voti (senza pareggi e senza vittoria del "salta") viene espulso
function resolveMeeting(s: AstroState, ctx: Ctx) {
  const votes = s.meeting?.votes ?? {};
  const count: Record<string, number> = {};
  for (const [voter, target] of Object.entries(votes)) if (s.alive[voter]) count[target] = (count[target] ?? 0) + 1;
  const best = Math.max(0, ...Object.values(count));
  const top = Object.keys(count).filter((k) => count[k] === best);
  if (!best || top.length > 1 || top[0] === 'skip') {
    s.ejected = { id: null, wasImpostor: false, reason: !best || top[0] === 'skip' ? 'SKIP' : 'TIE' };
  } else {
    const out = top[0];
    s.alive[out] = false;
    s.confirmedDead = [...new Set([...s.confirmedDead, out])];
    s.ejected = { id: out, wasImpostor: isImpostor(s, out), reason: 'VOTE' };
  }
  s.stage = 'EJECT';
  s.stageEndsAt = ctx.now + EJECT_MS;
}

function afterEject(s: AstroState, ctx: Ctx) {
  if (checkWin(s)) return;
  s.stage = 'PLAY';
  s.stageEndsAt = null;
  s.meeting = null;
  for (const id of s.impostors) s.killReadyAt[id] = ctx.now + s.killMs;
  s.sabotageReadyAt = ctx.now + SABOTAGE_COOLDOWN;
  s.doorsReadyAt = ctx.now + DOOR_COOLDOWN;
  s.buttonReadyAt = ctx.now + BUTTON_COOLDOWN; // come nell'originale: niente riunione subito dopo un'altra
  s.barAt = ctx.now + barGap();
  gather(s, ctx);
}

const near = (ctx: Ctx, id: string, target: { x: number; y: number }, range: number) => {
  const p = ctx.pos(id);
  return !!p && dist(p, target) <= range + SLACK;
};

export const astro: Mode<AstroState> = {
  start(settings, players, ctx) {
    const order = shuffle(players.map((p) => p.id));
    const n = order.length;
    const impostors = shuffle(order).slice(0, Math.max(1, Math.min(settings.spiesCount, Math.floor((n - 1) / 3))));
    const perPlayer = Math.min(STATIONS.length, settings.astroTasks);
    const s: AstroState = {
      order,
      colors: Object.fromEntries(order.map((id, i) => [id, i])),
      impostors,
      alive: Object.fromEntries(order.map((id) => [id, true])),
      // anche gli impostori hanno una lista (finta), così possono far finta di lavorare
      tasks: Object.fromEntries(order.map((id) => [id, shuffle(STATIONS.map((_, i) => i)).slice(0, perPlayer).map((station) => ({ station, done: false }))])),
      bodies: [],
      killReadyAt: Object.fromEntries(impostors.map((id) => [id, ctx.now + INTRO_MS + 12_000])),
      emergencies: Object.fromEntries(order.map((id) => [id, 1])),
      stage: 'INTRO',
      stageEndsAt: ctx.now + INTRO_MS,
      meeting: null,
      ejected: null,
      warps: {},
      sabotage: null,
      doors: {},
      sabotageReadyAt: ctx.now + INTRO_MS + 20_000,
      doorsReadyAt: ctx.now + INTRO_MS + 10_000,
      buttonReadyAt: ctx.now + INTRO_MS + BUTTON_COOLDOWN,
      shownProgress: 0,
      barAt: ctx.now + INTRO_MS + barGap(),
      watching: [],
      confirmedDead: [],
      killedBy: {},
      winner: null,
      winReason: null,
      spawnNo: 0,
      killMs: settings.astroKill * 1000,
      meetingMs: settings.astroMeeting * 1000,
    };
    gather(s, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    const playing = s.stage === 'PLAY' && s.order.includes(me);
    switch (type) {
      case 'MG_TASK': {
        const task = s.tasks[me]?.[Number(payload.i)];
        // anche i fantasmi dell'equipaggio possono finire i loro compiti; l'impostore (vivo) fa quelli finti, che non contano
        if (!playing || !task || task.done || (isImpostor(s, me) && !s.alive[me]) || !near(ctx, me, STATIONS[task.station], TASK_RANGE)) return false;
        task.done = true;
        checkWin(s);
        return true;
      }
      case 'MG_KILL': {
        const target = String(payload.target ?? '');
        if (!playing || !isImpostor(s, me) || !s.alive[me] || !s.alive[target] || isImpostor(s, target)) return false;
        if (ctx.now < (s.killReadyAt[me] ?? 0)) return false;
        const where = ctx.pos(target);
        if (!where || !near(ctx, me, where, KILL_RANGE)) return false;
        s.alive[target] = false;
        s.killedBy[target] = me;
        s.watching = s.watching.filter((id) => id !== target);
        s.bodies.push({ id: target, x: Math.round(where.x), y: Math.round(where.y) });
        s.killReadyAt[me] = ctx.now + s.killMs;
        checkWin(s);
        return true;
      }
      case 'MG_REPORT': {
        const body = s.bodies.find((b) => b.id === payload.body);
        if (!playing || !s.alive[me] || !body || !near(ctx, me, body, REPORT_RANGE)) return false;
        startMeeting(s, me, body.id, ctx);
        return true;
      }
      case 'MG_BUTTON':
        if (!playing || !s.alive[me] || (s.emergencies[me] ?? 0) <= 0 || !near(ctx, me, BUTTON, BUTTON_RANGE)) return false;
        if (s.sabotage && SABOTAGE_INFO[s.sabotage.kind].critical) return false;
        if (ctx.now < s.buttonReadyAt) return false; // pulsante ancora in ricarica
        s.emergencies[me] -= 1;
        startMeeting(s, me, null, ctx);
        return true;
      case 'MG_VENT': {
        // l'impostore entra in una botola e sbuca in una di quelle collegate
        const from = VENTS[Number(payload.from)];
        const to = Number(payload.to);
        if (!playing || !isImpostor(s, me) || !s.alive[me] || !from || !from.links.includes(to) || !near(ctx, me, from, VENT_RANGE)) return false;
        const dest = VENTS[to];
        ctx.teleport({ [me]: { x: dest.x, y: dest.y } });
        s.warps[me] = { x: dest.x, y: dest.y, n: (s.warps[me]?.n ?? 0) + 1 };
        return true;
      }
      case 'MG_SABOTAGE': {
        if (!playing || !isImpostor(s, me)) return false; // anche da fantasma
        if (payload.kind === 'doors') {
          const room = String(payload.room ?? '');
          if (!ROOMS.some((r) => r.id === room) || ctx.now < s.doorsReadyAt || s.doors[room]) return false;
          s.doors[room] = ctx.now + DOOR_MS;
          s.doorsReadyAt = ctx.now + DOOR_COOLDOWN;
          return true;
        }
        const kind = payload.kind as SabotageKind;
        if (!(kind in SABOTAGE_INFO) || s.sabotage || ctx.now < s.sabotageReadyAt) return false;
        s.sabotage = { kind, endsAt: SABOTAGE_INFO[kind].critical ? ctx.now + SABOTAGE_MS : null, fixed: [], holders: {} };
        return true;
      }
      case 'MG_FIX': {
        // luci, comunicazioni e i due codici dell'ossigeno (anche l'impostore può riparare, per mimetizzarsi)
        const point = String(payload.point ?? '');
        const fp = FIX_POINTS[point];
        if (!playing || !s.alive[me] || !s.sabotage || !fp || fp.kind !== s.sabotage.kind || fp.kind === 'reactor' || !near(ctx, me, fp, FIX_RANGE)) return false;
        if (!s.sabotage.fixed.includes(point)) s.sabotage.fixed.push(point);
        const needed = Object.keys(FIX_POINTS).filter((k) => FIX_POINTS[k].kind === s.sabotage!.kind);
        if (needed.every((k) => s.sabotage!.fixed.includes(k))) endSabotage(s, ctx);
        return true;
      }
      case 'MG_HOLD': {
        // reattore: due persone diverse devono tenere premuti i due pannelli nello stesso momento
        const point = String(payload.point ?? '');
        const fp = FIX_POINTS[point];
        if (!playing || !s.alive[me] || s.sabotage?.kind !== 'reactor' || !fp || fp.kind !== 'reactor') return false;
        const holders = s.sabotage.holders;
        if (payload.on) {
          if (!near(ctx, me, fp, FIX_RANGE)) return false;
          for (const k of Object.keys(holders)) if (holders[k] === me) delete holders[k];
          holders[point] = me;
        } else if (holders[point] === me) delete holders[point];
        else return false;
        const holding = (k: string) => !!holders[k] && s.alive[holders[k]] && ctx.isOnline(holders[k]) && near(ctx, holders[k], FIX_POINTS[k], FIX_RANGE);
        if (holding('ra') && holding('rb') && holders.ra !== holders.rb) endSabotage(s, ctx);
        return true;
      }
      case 'MG_DOOR': {
        const room = String(payload.room ?? '');
        if (!playing || !s.alive[me] || !s.doors[room]) return false;
        if (!DOORS.some((d) => d.room === room && near(ctx, me, { x: d.x + d.w / 2, y: d.y + d.h / 2 }, 110))) return false;
        delete s.doors[room];
        return true;
      }
      case 'MG_CAMS': {
        // telecamere: si accendono dalla console in Sicurezza (vivi, equipaggio o impostore: uguale)
        if (payload.on) {
          if (!playing || !s.alive[me] || s.watching.includes(me) || !near(ctx, me, CAMERA_CONSOLE, CONSOLE_RANGE)) return false;
          s.watching.push(me);
          return true;
        }
        if (!s.watching.includes(me)) return false;
        s.watching = s.watching.filter((id) => id !== me);
        return true;
      }
      case 'MG_VOTE': {
        const target = String(payload.target ?? '');
        if (s.stage !== 'MEETING' || !s.meeting || !s.alive[me] || me in s.meeting.votes || ctx.now < s.meeting.voteFrom) return false;
        if (target !== 'skip' && !s.alive[target]) return false;
        s.meeting.votes[me] = target;
        if (s.order.every((id) => !s.alive[id] || !ctx.isOnline(id) || id in s.meeting!.votes)) resolveMeeting(s, ctx);
        return true;
      }
      case 'MG_FORCE':
        if (!ctx.canLead(me)) return false;
        if (s.stage === 'INTRO') {
          s.stage = 'PLAY';
          s.stageEndsAt = null;
        } else if (s.stage === 'MEETING') resolveMeeting(s, ctx);
        else if (s.stage === 'EJECT') afterEject(s, ctx);
        else return false;
        return true;
      default:
        return false;
    }
  },
  tick(s, ctx) {
    if (s.stage === 'PLAY') {
      if (s.sabotage?.endsAt && ctx.now >= s.sabotage.endsAt) {
        s.winner = 'IMPOSTORS';
        s.winReason = s.sabotage.kind === 'reactor' ? 'Il reattore è esploso! 💥' : 'L’ossigeno è finito! 💨';
        s.stage = 'END';
        s.stageEndsAt = null;
        return true;
      }
      const reopened = Object.keys(s.doors).filter((room) => ctx.now >= s.doors[room]);
      for (const room of reopened) delete s.doors[room];
      let changed = reopened.length > 0;
      if (ctx.now >= s.barAt) {
        s.barAt = ctx.now + barGap();
        const real = realProgress(s);
        if (real > s.shownProgress && Math.random() < 0.7) {
          s.shownProgress = real;
          changed = true;
        }
      }
      return changed;
    }
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt) return false;
    if (s.stage === 'INTRO') {
      s.stage = 'PLAY';
      s.stageEndsAt = null;
    } else if (s.stage === 'MEETING') resolveMeeting(s, ctx);
    else if (s.stage === 'EJECT') afterEject(s, ctx);
    return true;
  },
  deadline(s) {
    if (s.stage !== 'PLAY') return s.stageEndsAt;
    const times = [s.sabotage?.endsAt ?? Infinity, ...Object.values(s.doors), s.barAt];
    const next = Math.min(...times);
    return next === Infinity ? null : next;
  },
  view(s, me) {
    const end = s.stage === 'END';
    const ghost = s.order.includes(me) && !s.alive[me];
    const open = ghost || end || s.stage === 'MEETING' || s.stage === 'EJECT' || !s.order.includes(me);
    const i = s.order.indexOf(me);
    return {
      stage: s.stage,
      order: s.order,
      colors: s.colors,
      role: isImpostor(s, me) ? 'IMPOSTOR' : i >= 0 ? 'CREW' : 'SPECTATOR',
      impostors: isImpostor(s, me) || end ? s.impostors : null,
      impostorCount: s.impostors.length,
      alive: !!s.alive[me],
      dead: open ? s.order.filter((id) => !s.alive[id]) : s.confirmedDead,
      tasks: s.tasks[me] ?? [],
      taskProgress: end ? realProgress(s) : s.shownProgress,
      bodies: s.bodies,
      killReadyAt: isImpostor(s, me) ? s.killReadyAt[me] ?? null : null,
      emergencies: s.emergencies[me] ?? 0,
      meeting: s.meeting
        ? {
            caller: s.meeting.caller,
            body: s.meeting.body,
            voted: Object.keys(s.meeting.votes),
            myVote: s.meeting.votes[me] ?? null,
            votes: s.stage === 'EJECT' || end ? s.meeting.votes : null,
            voteFrom: s.meeting.voteFrom,
          }
        : null,
      warp: s.warps[me] ?? null,
      sabotage: s.sabotage && s.stage === 'PLAY' ? { kind: s.sabotage.kind, endsAt: s.sabotage.endsAt, fixed: s.sabotage.fixed, holders: s.sabotage.holders } : null,
      closedDoors: s.stage === 'PLAY' ? Object.keys(s.doors) : [],
      sabotageReadyAt: isImpostor(s, me) ? s.sabotageReadyAt : null,
      doorsReadyAt: isImpostor(s, me) ? s.doorsReadyAt : null,
      buttonReadyAt: s.buttonReadyAt,
      camsOn: s.stage === 'PLAY' && s.watching.length > 0,
      ejected: s.ejected,
      impostorsLeft: s.impostors.filter((id) => s.alive[id]).length,
      winner: s.winner,
      winReason: s.winReason,
      killedBy: s.killedBy[me] ?? null,
      spawn: i >= 0 ? spawnPoint(i, s.order.length) : spawnPoint(0, 1),
      spawnNo: s.spawnNo,
      stageEndsAt: s.stageEndsAt,
      killCooldown: s.killMs / 1000,
      meetingSeconds: s.meetingMs / 1000,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  upgrade(s) {
    s.warps ??= {};
    s.sabotage ??= null;
    s.doors ??= {};
    s.sabotageReadyAt ??= 0;
    s.doorsReadyAt ??= 0;
    s.buttonReadyAt ??= 0;
    s.barAt ??= 0;
    s.shownProgress ??= realProgress(s);
    s.watching ??= [];
    s.spawnNo ??= 0;
    s.killMs ??= 30_000;
    s.meetingMs ??= 90_000;
    if (s.meeting) s.meeting.voteFrom ??= 0;
  },
  leave(s, id, ctx) {
    if (!s.order.includes(id) || s.stage === 'END' || !s.alive[id]) return false;
    s.alive[id] = false; // chi esce dalla stanza è fuori dal gioco (senza cadavere)
    s.watching = s.watching.filter((x) => x !== id);
    s.confirmedDead = [...new Set([...s.confirmedDead, id])];
    if (checkWin(s)) return true;
    if (s.stage === 'MEETING' && s.order.every((p) => !s.alive[p] || !ctx.isOnline(p) || p in s.meeting!.votes)) resolveMeeting(s, ctx);
    return true;
  },
};

export const ASTRO_MODES: Partial<Record<GameId, Mode<any>>> = { ASTRO: astro };
