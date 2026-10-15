// ⚽🚗 Axend Turbo — dati pronti per le scritte a schermo (dal World ai valori semplici che ricevono i componenti).
import { TEAM_COLORS, TEAM_NAMES, type TurboEvent, type World } from '../contract';
import { TICK_RATE } from '../../../game/turbo/consts';

export { TEAM_COLORS, TEAM_NAMES };

export type Team = 0 | 1;

// una riga del tabellone
export interface PlayerLine {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  demos: number;
  points: number;
}

// tutte le macchine del mondo con le statistiche, ordinate per punti
export function playerLines(world: World, names: Record<string, string>, stats: World['stats'] = world.stats): PlayerLine[] {
  return world.cars
    .map((c) => {
      const s = stats[c.id];
      return {
        id: c.id,
        name: names[c.id] || (c.bot ? 'Bot' : 'Giocatore'),
        team: c.team,
        bot: c.bot,
        goals: s?.goals ?? 0,
        assists: s?.assists ?? 0,
        saves: s?.saves ?? 0,
        shots: s?.shots ?? 0,
        demos: s?.demos ?? 0,
        points: s?.points ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.goals - a.goals);
}

// orologio: m:ss (arrotondato in su come in Rocket League); nei supplementari i secondi passati con il +
export function formatClock(clock: number, overtime = false): string {
  const s = overtime ? Math.floor(Math.max(0, clock)) : Math.ceil(Math.max(0, clock));
  return `${overtime ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const winnerOf = (score: readonly [number, number]): Team | -1 => (score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1);

// MVP = più punti della squadra che ha vinto (a pari punti: più gol)
export function mvpOf(lines: PlayerLine[], winner: Team | -1): PlayerLine | null {
  const pool = winner === -1 ? lines : lines.filter((l) => l.team === winner);
  return pool.reduce<PlayerLine | null>((best, l) => (!best || l.points > best.points || (l.points === best.points && l.goals > best.goals) ? l : best), null);
}

// secondi alla fine della fase (conto alla rovescia, festa del gol)
export const phaseSecondsLeft = (world: World) => Math.max(0, (world.phaseEnd - world.tick) / TICK_RATE);

// ---------------------------------------------------------------- notizie della partita (demolizioni, parate, tiri…)
export type FeedKind = 'goal' | 'demo' | 'save' | 'shot' | 'flipreset';
export interface FeedName {
  name: string;
  team: Team | null;
  me: boolean;
}
export interface FeedItem {
  key: number;
  kind: FeedKind;
  a: FeedName; // chi ha fatto
  b?: FeedName; // a chi (demolizione) o chi ha fatto l'assist (gol)
  speed?: number; // km/h del gol
}

let feedKey = 1;
export function feedItems(events: readonly TurboEvent[], world: Pick<World, 'car'>, names: Record<string, string>, myId?: string): FeedItem[] {
  const who = (id: string): FeedName => ({ name: names[id] || 'Qualcuno', team: world.car(id)?.team ?? null, me: !!myId && id === myId });
  const out: FeedItem[] = [];
  for (const e of events) {
    if (e.k === 'demo') out.push({ key: feedKey++, kind: 'demo', a: who(e.by), b: who(e.victim) });
    else if (e.k === 'save') out.push({ key: feedKey++, kind: 'save', a: who(e.id) });
    else if (e.k === 'shot') out.push({ key: feedKey++, kind: 'shot', a: who(e.id) });
    else if (e.k === 'flipreset') out.push({ key: feedKey++, kind: 'flipreset', a: who(e.id) });
    else if (e.k === 'goal' && e.by) out.push({ key: feedKey++, kind: 'goal', a: who(e.by), b: e.assist ? who(e.assist) : undefined, speed: e.speed });
  }
  return out;
}

export type GoalEvent = Extract<TurboEvent, { k: 'goal' }>;
