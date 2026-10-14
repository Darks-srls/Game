// Banco di prova dei giochi flat: giocatori finti fanno mosse (a caso ma sensate) finché la partita finisce.
// Ogni gioco ha il suo "giocatore finto" in scripts/flat-bots/<id>.ts.
//   npx tsx scripts/prova-flat.ts PAROLAUNICA        → una partita da 5
//   npx tsx scripts/prova-flat.ts PAROLAUNICA 8 3    → 8 giocatori, 3 partite
//   npx tsx scripts/prova-flat.ts tutti
//   npx tsx scripts/prova-flat.ts LUPI --mod worker/flat/lupi.ts --mod scripts/flat-bots/lupi.ts   → un gioco non ancora registrato negli index
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { FLAT_MODES } from '../worker/flat';
import { FLAT_GAMES, type FlatId } from '../src/data/flatGames';
import type { Ctx } from '../worker/modes';
import type { GameSettings, Player } from '../src/types/game';
import { FLAT_BOTS } from './flat-bots';

// file in più da caricare (si registrano da soli)
const argv = process.argv.slice(2);
const mods: string[] = [];
for (let i = argv.indexOf('--mod'); i >= 0; i = argv.indexOf('--mod')) mods.push(...argv.splice(i, 2).slice(1));
for (const m of mods) await import(pathToFileURL(resolve(m)).href);
const arg = argv[0] ?? 'tutti';
const nPlayers = Number(argv[1] ?? 0);
const runs = Number(argv[2] ?? 2);
const ids: FlatId[] = arg === 'tutti' ? (FLAT_GAMES.map((g) => g.id).filter((id) => FLAT_MODES[id]) as FlatId[]) : [arg as FlatId];
let failed = 0;

for (const id of ids) {
  const mode = FLAT_MODES[id];
  const info = FLAT_GAMES.find((g) => g.id === id)!;
  const bot = FLAT_BOTS[id];
  if (!mode) {
    console.log(`✗ ${id}: server non registrato in worker/flat/index.ts`);
    failed++;
    continue;
  }
  if (!bot) console.log(`  (nessun giocatore finto per ${id}: provo solo i tempi scaduti)`);
  for (let run = 0; run < runs; run++) {
    const n = nPlayers || Math.max(info.min, Math.min(info.max ?? 8, 5 + run));
    const players: Player[] = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Gioc${i + 1}`, avatar: 'av1', color: '#ffffff', isOnline: true }));
    const settings = { game: id, spicy: run % 2 === 1, extra: {} } as unknown as GameSettings;
    let now = 1_000_000;
    const emitted: Record<string, number> = {};
    const ctx = (): Ctx => ({
      now,
      isOnline: () => true,
      canLead: (pid) => pid === 'p1',
      emit: (type) => (emitted[type] = (emitted[type] ?? 0) + 1),
      storeImage: () => null,
      pos: () => null,
      teleport: () => {},
      p3get: () => null,
      p3set: () => {},
      knock: () => {},
    });
    const stages = new Map<string, number>();
    let steps = 0;
    let actions = 0;
    let maxView = 0;
    try {
      const s = mode.start(settings, players, ctx());
      while (!mode.finished(s) && steps < 6000) {
        steps++;
        now += 400;
        // ogni giocatore guarda il suo telefono e (forse) fa una mossa
        for (const p of players) {
          const v: any = mode.view(s, p.id);
          stages.set(v.stage, (stages.get(v.stage) ?? 0) + 1);
          if (steps % 50 === 0) maxView = Math.max(maxView, JSON.stringify(v).length);
          const move = bot?.(v, p.id, { players: players.map((x) => x.id), step: steps, rand: Math.random });
          if (move && mode.action(s, p.id, move.type, move.payload ?? {}, ctx())) actions++;
        }
        const dl = mode.deadline(s);
        if (dl !== null && now >= dl) mode.tick(s, ctx());
        else mode.tick(s, ctx());
      }
      const ok = mode.finished(s);
      if (!ok) failed++;
      const last: any = mode.view(s, 'p1');
      console.log(
        `${ok ? '✓' : '✗'} ${id} (${n} giocatori${settings.spicy ? ', 🌶️' : ''}): ${ok ? 'finita' : 'NON finita'} in ${Math.round((now - 1_000_000) / 1000)}s simulati · ${actions} mosse · fasi ${[...stages.keys()].join(' → ')} · stato max ${(maxView / 1024).toFixed(1)} KB`,
      );
      if (!ok) console.log(`    bloccata in fase ${last.stage}`);
      if (last.scores) console.log(`    punti: ${JSON.stringify(last.scores)}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${id}: ERRORE`, e);
    }
  }
}
process.exit(failed ? 1 : 0);
