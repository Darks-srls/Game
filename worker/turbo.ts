// ⚽🚗 Axend Turbo (server): la partita gira qui, 120 passi al secondo come Rocket League.
// I telefoni mandano i loro comandi per passo (FAST_IN), il server applica quelli arrivati in tempo (se no ripete l'ultimo)
// e manda a tutti lo stato del campo 30 volte al secondo (FAST). Lo stato della stanza (squadre, punteggio, fine) va col resto.
import type { GameId, GameSettings } from '../src/types/game';
import type { Ctx, Mode } from './modes';
import { World, decodeControls, packStats, type Snapshot, type TurboEvent } from '../src/game/turbo/world';
import { noControls, type Controls } from '../src/game/turbo/car';
import { TICK_RATE } from '../src/game/turbo/consts';
import { SKILL_LEVEL, TURBO_OPTIONS, type TurboRoomView } from '../src/game/turbo/room';
import { BOT_NAMES } from '../src/data/party3d';
import { botControls, newBotMemory, type BotMemory } from '../src/game/turbo/bot';
import { shuffle } from './party';

interface TurboState {
  humans: string[];
  teams: Record<string, 0 | 1>;
  names: Record<string, string>;
  bots: string[];
  skill: number;
  size: number;
  stage: TurboRoomView['stage'];
  score: [number, number];
  winner: 0 | 1 | -1 | null;
  stats: TurboRoomView['stats'];
  mvp: string | null;
  startAt: number;
}

// la simulazione vive solo in memoria (non si salva): se il server riparte, la partita finisce
interface Sim {
  world: World;
  inputs: Map<string, Map<number, Controls>>; // comandi per passo
  latest: Map<string, number>; // ultimo passo ricevuto da ogni telefono
  last: Map<string, Controls>; // ultimo comando usato
  botMem: Map<string, BotMemory>;
  lastSnapTick: number;
  snaps: number; // foto mandate
  pending: TurboEvent[]; // eventi da mandare con la prossima foto
}
const SIMS = new WeakMap<TurboState, Sim>();

const SNAP_EVERY = 4; // 120/4 = 30 foto al secondo
const MAX_CATCHUP = 24; // se il server resta indietro, al massimo 24 passi per giro (poi si salta avanti)
const STALE = 60; // passi senza comandi dopo i quali la macchina di un giocatore si ferma (0,5 s)
const IDLE = noControls();

function opt(settings: GameSettings, o: { key: string; values: number[]; def: number }) {
  const v = settings.extra?.[o.key];
  return typeof v === 'number' && o.values.includes(v) ? v : o.def;
}

export const turbo: Mode<TurboState> = {
  start(settings, players, ctx) {
    const humans = shuffle(players.map((p) => p.id));
    const size = Math.max(opt(settings, TURBO_OPTIONS.size), Math.ceil(humans.length / 2));
    const skill = SKILL_LEVEL[opt(settings, TURBO_OPTIONS.skill)];
    const teams: Record<string, 0 | 1> = {};
    humans.forEach((id, i) => (teams[id] = (i % 2) as 0 | 1));
    const names: Record<string, string> = {};
    const bots: string[] = [];
    const botNames = shuffle(BOT_NAMES);
    for (const team of [0, 1] as const) {
      const have = humans.filter((id) => teams[id] === team).length;
      for (let i = have; i < size; i++) {
        const id = `bot${bots.length + 1}`;
        bots.push(id);
        teams[id] = team;
        names[id] = botNames[bots.length % botNames.length];
      }
    }
    const s: TurboState = { humans, teams, names, bots, skill, size, stage: 'PLAY', score: [0, 0], winner: null, stats: null, mvp: null, startAt: ctx.now + 1500 };
    const world = new World();
    for (const id of [...humans, ...bots]) world.addCar(id, teams[id], bots.includes(id));
    world.kickoff();
    SIMS.set(s, { world, inputs: new Map(), latest: new Map(), last: new Map(), botMem: new Map(bots.map((b) => [b, newBotMemory()])), lastSnapTick: -SNAP_EVERY, snaps: 0, pending: [] });
    return s;
  },
  action(s, me, type, _payload, ctx) {
    // chi guida la stanza può chiudere la partita in anticipo
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage === 'PLAY') {
      endMatch(s, SIMS.get(s)?.world ?? null);
      return true;
    }
    return false;
  },
  tick: () => false,
  deadline: () => null,
  view(s): TurboRoomView {
    return { stage: s.stage, size: s.size, teams: s.teams, names: s.names, bots: s.bots, score: s.score, winner: s.winner, stats: s.stats, mvp: s.mvp, startAt: s.startAt };
  },
  ids: (s) => s.humans,
  finished: (s) => s.stage === 'END',
  leave(s, id) {
    // chi esce viene sostituito da un bot (come in Rocket League)
    const sim = SIMS.get(s);
    const car = sim?.world.car(id);
    if (!sim || !car || s.stage !== 'PLAY') return false;
    car.bot = true;
    s.bots = [...s.bots, id];
    s.names[id] = s.names[id] ?? 'Bot';
    sim.botMem.set(id, newBotMemory());
    return true;
  },
  fast: {
    hz: 60,
    tick(s, ctx) {
      if (s.stage !== 'PLAY') return {};
      const sim = SIMS.get(s);
      if (!sim) {
        // il server è ripartito a metà: la partita non c'è più
        endMatch(s, null);
        return { changed: true };
      }
      const w = sim.world;
      const target = Math.floor(((ctx.now - s.startAt) * TICK_RATE) / 1000);
      if (target - w.tick > MAX_CATCHUP * 4) s.startAt += ((target - w.tick - MAX_CATCHUP) * 1000) / TICK_RATE; // troppo indietro: si salta avanti
      let steps = 0;
      let changed = false;
      const before = `${w.phase}:${w.score[0]}:${w.score[1]}`;
      while (w.tick < target && steps < MAX_CATCHUP) {
        const T = w.tick;
        for (const car of w.cars) if (car.bot && !car.demoed) sim.last.set(car.id, botControls(w, car, sim.botMem.get(car.id) ?? newBotMemory(), s.skill));
        w.step((id) => {
          const m = sim.inputs.get(id);
          const c = m?.get(T);
          if (c) {
            sim.last.set(id, c);
            m!.delete(T);
          } else if (!w.car(id)?.bot && (sim.latest.get(id) ?? -1e9) < T - STALE) sim.last.set(id, IDLE); // telefono muto (app in pausa, linea persa): macchina ferma
          return sim.last.get(id);
        });
        if (w.events.length) sim.pending.push(...w.events);
        steps++;
      }
      // via i comandi vecchi (arrivati tardi)
      for (const m of sim.inputs.values()) for (const t of m.keys()) if (t < w.tick - 4) m.delete(t);
      if (`${w.phase}:${w.score[0]}:${w.score[1]}` !== before) {
        s.score = [w.score[0], w.score[1]];
        changed = true;
      }
      if (w.phase === 'end') {
        endMatch(s, w);
        changed = true;
      }
      let send: string | undefined;
      if (w.tick - sim.lastSnapTick >= SNAP_EVERY || sim.pending.some((e) => e.k === 'goal' || e.k === 'demo')) {
        sim.lastSnapTick = w.tick;
        const margins: Record<string, number> = {};
        for (const id of s.humans) margins[id] = (sim.latest.get(id) ?? -1e6) - w.tick;
        const snap: Snapshot & { ev: TurboEvent[]; m: Record<string, number>; now: number } = { ...w.snapshot(), ev: sim.pending, m: margins, now: ctx.now };
        // statistiche: due volte al secondo, e subito dopo gol, parate, tiri e demolizioni
        if (++sim.snaps % 15 === 1 || sim.pending.some((e) => e.k === 'goal' || e.k === 'save' || e.k === 'shot' || e.k === 'demo')) snap.st = packStats(w.stats);
        send = JSON.stringify({ type: 'FAST', payload: snap });
        sim.pending = [];
      }
      return { send, changed };
    },
    input(s, me, payload) {
      const sim = SIMS.get(s);
      if (!sim || !s.humans.includes(me) || !payload || !Array.isArray(payload.c)) return;
      const t0 = Math.floor(Number(payload.t));
      if (!Number.isFinite(t0)) return;
      const w = sim.world;
      let m = sim.inputs.get(me);
      if (!m) sim.inputs.set(me, (m = new Map()));
      const list = payload.c.slice(0, 16);
      list.forEach((raw: unknown, k: number) => {
        const t = t0 + k;
        if (t < w.tick || t > w.tick + 3 * TICK_RATE || !Array.isArray(raw)) return;
        m!.set(t, decodeControls(raw as number[]));
      });
      const lastT = t0 + list.length - 1;
      if (lastT > (sim.latest.get(me) ?? -1e9)) sim.latest.set(me, lastT);
    },
  },
};

function endMatch(s: TurboState, w: World | null) {
  s.stage = 'END';
  if (w) {
    s.score = [w.score[0], w.score[1]];
    s.stats = w.stats;
  }
  s.winner = s.score[0] > s.score[1] ? 0 : s.score[1] > s.score[0] ? 1 : -1;
  // MVP: più punti nella squadra vincente (o tra tutti se pari)
  const pool = Object.keys(s.teams).filter((id) => s.winner === -1 || s.teams[id] === s.winner);
  s.mvp = s.stats ? (pool.sort((a, b) => (s.stats![b]?.points ?? 0) - (s.stats![a]?.points ?? 0))[0] ?? null) : null;
}

export const TURBO_MODES: Partial<Record<GameId, Mode<any>>> = { TURBO: turbo };
