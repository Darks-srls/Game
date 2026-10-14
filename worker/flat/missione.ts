// 🕶️ Missione segreta: il capo propone la squadra, tutti votano in segreto (poi si svela), chi va in missione
// sceglie in segreto SUCCESSO o SABOTAGGIO. Gli agenti vedono gli stessi due pulsanti delle spie:
// se toccano SABOTAGGIO conta comunque come successo (così a tavola nessuno si tradisce).
import type { GameSettings } from '../../src/types/game';
import { flatOpt } from '../../src/data/flatGames';
import {
  MI_ROLES,
  MI_SPIES,
  MI_TEAMS,
  miFailsNeeded,
  type MissioneEnd,
  type MissioneProposal,
  type MissioneRole,
  type MissioneTeam,
  type MissioneView,
} from '../../src/data/flat/missione';
import type { Ctx, Mode } from '../modes';
import { shuffle } from '../party';
import { registerFlat } from './registry';

const ROLE_MS = 30_000;
const TEAM_MS = 90_000;
const VOTE_MS = 45_000;
const VOTE_RESULT_MS = 8_000;
const MISSION_MS = 30_000;
const MISSION_RESULT_MS = 9_000;
const ASSASSIN_MS = 60_000;
const MAX_REJECTS = 5;

interface MiState {
  order: string[];
  names: Record<string, string>;
  roles: Record<string, MissioneRole>;
  withSeer: boolean;
  sizes: number[];
  needs: number[];
  stage: MissioneView['stage'];
  stageEndsAt: number | null;
  stageMs: number;
  leaderIdx: number;
  mission: number;
  results: ({ ok: boolean; fails: number } | null)[];
  team: string[];
  ready: string[];
  votes: Record<string, boolean>;
  rejects: number;
  plays: Record<string, 'S' | 'F'>;
  cards: ('S' | 'F')[] | null;
  history: MissioneProposal[];
  aim: string | null;
  winner: MissioneTeam | null;
  endReason: MissioneEnd | null;
  scores: Record<string, number>;
}

const isSpy = (s: MiState, id: string) => MI_ROLES[s.roles[id]].team === 'SPIE';
const leader = (s: MiState) => s.order[s.leaderIdx];
const size = (s: MiState) => s.sizes[s.mission];

function setStage(s: MiState, stage: MissioneView['stage'], ms: number, ctx: Ctx) {
  s.stage = stage;
  s.stageMs = ms;
  s.stageEndsAt = ms ? ctx.now + ms : null;
}

// il comando passa al prossimo collegato
function nextLeader(s: MiState, ctx: Ctx) {
  for (let k = 0; k < s.order.length; k++) {
    s.leaderIdx = (s.leaderIdx + 1) % s.order.length;
    if (ctx.isOnline(leader(s))) return;
  }
}

function toTeam(s: MiState, ctx: Ctx) {
  if (!ctx.isOnline(leader(s))) nextLeader(s, ctx);
  s.team = [];
  s.cards = null;
  setStage(s, 'TEAM', TEAM_MS, ctx);
}

// tempo scaduto: la squadra si completa a caso (si tiene chi il capo aveva già scelto)
function proposeTeam(s: MiState, ctx: Ctx, auto: boolean) {
  if (s.team.length < size(s)) s.team = [...s.team, ...shuffle(s.order.filter((id) => !s.team.includes(id)))].slice(0, size(s));
  s.votes = {};
  s.history.push({ mission: s.mission, leader: s.leaderIdx, team: s.team.map((id) => s.order.indexOf(id)), yes: [], no: [], approved: false, auto: auto || undefined });
  setStage(s, 'VOTE', VOTE_MS, ctx);
}

// si svelano tutti i voti insieme: passa con la maggioranza dei voti (pari = bocciata)
function endVote(s: MiState, ctx: Ctx) {
  const p = s.history[s.history.length - 1];
  for (const [id, ok] of Object.entries(s.votes)) (ok ? p.yes : p.no).push(s.order.indexOf(id));
  p.approved = p.yes.length > p.no.length;
  s.rejects = p.approved ? 0 : s.rejects + 1;
  setStage(s, 'VOTE_RESULT', VOTE_RESULT_MS, ctx);
}

function afterVote(s: MiState, ctx: Ctx) {
  const p = s.history[s.history.length - 1];
  if (p.approved) {
    s.plays = {};
    setStage(s, 'MISSION', MISSION_MS, ctx);
    return;
  }
  if (s.rejects >= MAX_REJECTS) return finish(s, 'SPIE', 'BOCCIATE', ctx);
  nextLeader(s, ctx);
  toTeam(s, ctx);
}

// le carte si mescolano: nessuno sa chi ha sabotato (chi non ha scelto in tempo fa successo)
function endMission(s: MiState, ctx: Ctx) {
  const cards = s.team.map((id) => s.plays[id] ?? 'S');
  const fails = cards.filter((c) => c === 'F').length;
  s.cards = shuffle(cards);
  s.results[s.mission] = { ok: fails < s.needs[s.mission], fails };
  setStage(s, 'MISSION_RESULT', MISSION_RESULT_MS, ctx);
}

function afterMission(s: MiState, ctx: Ctx) {
  const ok = s.results.filter((r) => r?.ok).length;
  const ko = s.results.filter((r) => r && !r.ok).length;
  if (ko >= 3) return finish(s, 'SPIE', 'TRE_KO', ctx);
  if (ok >= 3) {
    if (!s.withSeer) return finish(s, 'AGENTI', 'TRE_OK', ctx);
    // ultima speranza delle spie: il Sicario cerca il Veggente
    s.aim = null;
    setStage(s, 'ASSASSIN', ASSASSIN_MS, ctx);
    return;
  }
  s.mission += 1;
  nextLeader(s, ctx);
  toTeam(s, ctx);
}

function shoot(s: MiState, ctx: Ctx) {
  const seer = s.order.find((id) => s.roles[id] === 'VEGGENTE');
  if (s.aim && s.aim === seer) finish(s, 'SPIE', 'VEGGENTE_PRESO', ctx);
  else finish(s, 'AGENTI', 'VEGGENTE_SALVO', ctx);
}

function finish(s: MiState, winner: MissioneTeam, reason: MissioneEnd, ctx: Ctx) {
  s.winner = winner;
  s.endReason = reason;
  for (const id of s.order) {
    if (MI_ROLES[s.roles[id]].team === winner) s.scores[id] += 3;
    if (reason === 'VEGGENTE_PRESO' && s.roles[id] === 'SICARIO') s.scores[id] += 1;
    if (reason === 'VEGGENTE_SALVO' && s.roles[id] === 'VEGGENTE') s.scores[id] += 1;
  }
  setStage(s, 'END', 0, ctx);
}

function advance(s: MiState, ctx: Ctx) {
  if (s.stage === 'ROLE') toTeam(s, ctx);
  else if (s.stage === 'TEAM') proposeTeam(s, ctx, true);
  else if (s.stage === 'VOTE') endVote(s, ctx);
  else if (s.stage === 'VOTE_RESULT') afterVote(s, ctx);
  else if (s.stage === 'MISSION') endMission(s, ctx);
  else if (s.stage === 'MISSION_RESULT') afterMission(s, ctx);
  else if (s.stage === 'ASSASSIN') shoot(s, ctx);
}

// le fasi che aspettano qualcuno vanno avanti appena hanno fatto tutti i collegati
function checkAllDone(s: MiState, ctx: Ctx) {
  const online = s.order.filter((id) => ctx.isOnline(id));
  if (!online.length) return;
  if (s.stage === 'ROLE' && online.every((id) => s.ready.includes(id))) toTeam(s, ctx);
  else if (s.stage === 'VOTE' && online.every((id) => id in s.votes)) endVote(s, ctx);
  else if (s.stage === 'MISSION' && s.team.filter((id) => ctx.isOnline(id)).every((id) => id in s.plays)) endMission(s, ctx);
}

export const missione: Mode<MiState> = {
  start(settings: GameSettings, players, ctx) {
    const order = players.map((p) => p.id);
    const n = Math.max(5, Math.min(10, order.length));
    const spies = MI_SPIES[n];
    const withSeer = flatOpt(settings, 'MISSIONE', 'veggente') === 1;
    const mixed = shuffle(order);
    const roles: Record<string, MissioneRole> = {};
    mixed.forEach((id, i) => (roles[id] = i < spies ? (withSeer && i === 0 ? 'SICARIO' : 'SPIA') : withSeer && i === spies ? 'VEGGENTE' : 'AGENTE'));
    const s: MiState = {
      order,
      names: Object.fromEntries(players.map((p) => [p.id, p.name])),
      roles,
      withSeer,
      sizes: MI_TEAMS[n],
      needs: MI_TEAMS[n].map((_, i) => miFailsNeeded(n, i)),
      stage: 'ROLE',
      stageEndsAt: null,
      stageMs: 0,
      leaderIdx: Math.floor(Math.random() * order.length),
      mission: 0,
      results: [null, null, null, null, null],
      team: [],
      ready: [],
      votes: {},
      rejects: 0,
      plays: {},
      cards: null,
      history: [],
      aim: null,
      winner: null,
      endReason: null,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
    };
    setStage(s, 'ROLE', ROLE_MS, ctx);
    return s;
  },
  action(s, me, type, payload, ctx) {
    if (!s.order.includes(me)) return false;
    if (type === 'MG_READY') {
      if (s.stage !== 'ROLE') return false;
      s.ready = s.ready.includes(me) ? s.ready.filter((x) => x !== me) : [...s.ready, me];
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_TOGGLE') {
      // il capo tocca i giocatori da mandare in missione (anche se stesso)
      const id = String(payload?.id ?? '');
      if (s.stage !== 'TEAM' || me !== leader(s) || !s.order.includes(id)) return false;
      if (s.team.includes(id)) s.team = s.team.filter((x) => x !== id);
      else if (s.team.length < size(s)) s.team = [...s.team, id];
      else return false;
      return true;
    }
    if (type === 'MG_PROPOSE') {
      if (s.stage !== 'TEAM' || me !== leader(s) || s.team.length !== size(s)) return false;
      proposeTeam(s, ctx, false);
      return true;
    }
    if (type === 'MG_VOTE') {
      if (s.stage !== 'VOTE' || typeof payload?.ok !== 'boolean' || s.votes[me] === payload.ok) return false;
      s.votes[me] = payload.ok;
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_PLAY') {
      // una carta sola, coperta; l'agente che tocca SABOTAGGIO fa comunque successo
      if (s.stage !== 'MISSION' || !s.team.includes(me) || me in s.plays) return false;
      s.plays[me] = isSpy(s, me) && payload?.fail === true ? 'F' : 'S';
      checkAllDone(s, ctx);
      return true;
    }
    if (type === 'MG_AIM') {
      const id = String(payload?.id ?? '');
      if (s.stage !== 'ASSASSIN' || s.roles[me] !== 'SICARIO' || !s.order.includes(id) || isSpy(s, id) || s.aim === id) return false;
      s.aim = id;
      return true;
    }
    if (type === 'MG_SHOOT') {
      if (s.stage !== 'ASSASSIN' || s.roles[me] !== 'SICARIO' || !s.aim) return false;
      shoot(s, ctx);
      return true;
    }
    if (type === 'MG_FORCE' && ctx.canLead(me) && s.stage !== 'END') {
      advance(s, ctx);
      return true;
    }
    return false;
  },
  tick(s, ctx) {
    if (!s.stageEndsAt || ctx.now < s.stageEndsAt || s.stage === 'END') return false;
    advance(s, ctx);
    return true;
  },
  deadline: (s) => s.stageEndsAt,
  view(s, me): MissioneView {
    const inGame = s.order.includes(me);
    const myRole = inGame ? s.roles[me] : null;
    const open = s.stage === 'ASSASSIN' || s.stage === 'END'; // le spie si svelano
    const knowsSpies = open || (myRole !== null && myRole !== 'AGENTE');
    const sicario = s.order.find((id) => s.roles[id] === 'SICARIO') ?? null;
    const seer = s.order.find((id) => s.roles[id] === 'VEGGENTE') ?? null;
    const voting = s.stage === 'VOTE';
    return {
      stage: s.stage,
      order: s.order,
      names: s.names,
      stageEndsAt: s.stageEndsAt,
      stageMs: s.stageMs,
      myRole,
      spies: knowsSpies ? s.order.filter((id) => isSpy(s, id)) : [],
      sicario: open || (myRole && isSpy(s, me)) ? sicario : null,
      seer: s.stage === 'END' || myRole === 'VEGGENTE' ? seer : null,
      withSeer: s.withSeer,
      spyCount: s.order.filter((id) => isSpy(s, id)).length,
      sizes: s.sizes,
      needs: s.needs,
      results: s.results,
      mission: s.mission,
      leader: leader(s),
      team: s.team,
      ready: s.ready,
      voted: voting ? Object.keys(s.votes) : [],
      myVote: voting ? (s.votes[me] ?? null) : null,
      rejects: s.rejects,
      played: s.stage === 'MISSION' ? Object.keys(s.plays) : [],
      myPlayed: s.stage === 'MISSION' && me in s.plays,
      cards: s.stage === 'MISSION_RESULT' ? s.cards : null,
      // i voti si vedono solo dopo lo spoglio (durante il voto l'ultima proposta non ha ancora voti)
      last: s.history.length && s.stage !== 'TEAM' ? s.history[s.history.length - 1] : null,
      assassinPick: s.stage === 'ASSASSIN' || s.stage === 'END' ? s.aim : null,
      winner: s.winner,
      endReason: s.endReason,
      history: s.history,
      scores: s.scores,
    };
  },
  ids: (s) => s.order,
  finished: (s) => s.stage === 'END',
  leave(s, id, ctx) {
    if (s.stage === 'END' || !s.order.includes(id)) return false;
    // se esce il capo mentre sceglie, il comando passa al prossimo; se esce il Sicario, niente colpo
    if (s.stage === 'TEAM' && id === leader(s)) {
      nextLeader(s, ctx);
      toTeam(s, ctx);
      return true;
    }
    if (s.stage === 'ASSASSIN' && s.roles[id] === 'SICARIO') {
      shoot(s, ctx);
      return true;
    }
    checkAllDone(s, ctx);
    return true;
  },
};

registerFlat('MISSIONE', missione);
