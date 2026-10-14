// 🔴🔵 Minigiochi a squadre (server): squadre equilibrate, punti di squadra, velocità stimata dei giocatori veri
import { TEAM_POINTS } from '../../src/data/minis/squadre';
import type { MiniApi, MiniBot } from './types';

const mix = <T>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// rossi (0) e blu (1): prima i giocatori veri divisi a metà, poi i bot (continuando ad alternare: squadre pari)
export function splitTeams(api: MiniApi): Record<string, number> {
  const first = Math.random() < 0.5 ? 0 : 1;
  const list = [...mix(api.humans), ...mix(api.bots.map((b) => b.id))];
  return Object.fromEntries(list.map((id, i) => [id, (i + first) % 2]));
}

// i compagni di squadra in ordine fisso (per i posti di partenza e le zone dei bot)
export const mates = (api: MiniApi, team: Record<string, number>, t: number) => api.ids().filter((id) => team[id] === t);

// punti del giro: vittoria 10, pareggio 6, sconfitta 3, più il bonus personale; chi è uscito dalla partita prende 1
export function teamRank(api: MiniApi, team: Record<string, number>, score: number[], bonus: (id: string) => number, gone: (id: string) => boolean) {
  const out: Record<string, number> = {};
  for (const id of api.ids()) {
    const t = team[id];
    if (t === undefined) continue;
    if (gone(id)) {
      out[id] = TEAM_POINTS.gone;
      continue;
    }
    const mine = score[t];
    const theirs = score[1 - t];
    out[id] = (mine > theirs ? TEAM_POINTS.win : mine === theirs ? TEAM_POINTS.draw : TEAM_POINTS.lose) + bonus(id);
  }
  return out;
}

// velocità dei giocatori veri stimata dalle posizioni (serve alla mira dei bot e ai palloni).
// Si tiene fuori dallo stato salvato: una mappa per ogni giro (la chiave è l'oggetto ext del giro)
type Track = { x: number; z: number; t: number; vx: number; vz: number };
const TRACKS = new WeakMap<object, Map<string, Track>>();
export function trackHumans(api: MiniApi) {
  let m = TRACKS.get(api.ext);
  if (!m) TRACKS.set(api.ext, (m = new Map()));
  for (const id of api.humans) {
    const p = api.pos(id);
    if (!p) continue;
    const v = m.get(id);
    if (!v) m.set(id, { x: p.x, z: p.z, t: api.now, vx: 0, vz: 0 });
    else if (p.x !== v.x || p.z !== v.z || api.now - v.t > 300) {
      const h = Math.max(0.03, (api.now - v.t) / 1000);
      const vx = (p.x - v.x) / h;
      const vz = (p.z - v.z) / h;
      // un salto enorme (ripartenza) non è una velocità
      const ok = Math.hypot(vx, vz) < 30;
      v.vx = ok ? v.vx * 0.4 + vx * 0.6 : 0;
      v.vz = ok ? v.vz * 0.4 + vz * 0.6 : 0;
      v.x = p.x;
      v.z = p.z;
      v.t = api.now;
    }
  }
}
export function velOf(api: MiniApi, id: string): { vx: number; vz: number } {
  const b = api.bot(id);
  if (b) return api.vel(id);
  const v = TRACKS.get(api.ext)?.get(id);
  return v ? { vx: v.vx, vz: v.vz } : { vx: 0, vz: 0 };
}

// rumore "gaussiano" per gli errori dei bot
export const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

// il bot guarda verso (x, z) (serve prima di uno schiaffo o di un lancio)
export function face(b: MiniBot, x: number, z: number) {
  b.body.r = Math.atan2(x - b.body.x, z - b.body.z);
}
