// Banco di prova di Axend Party: fa giocare un minigioco ai bot (più un "giocatore vero" finto che gironzola),
// a tempo accelerato, e controlla che finisca, che dia i punti e che non vada in errore.
//   npx tsx scripts/prova-party.ts RE            → un minigioco
//   npx tsx scripts/prova-party.ts RE 3          → con 3 bot
//   npx tsx scripts/prova-party.ts tutti         → tutti i minigiochi a moduli
//   npx tsx scripts/prova-party.ts MURO 7 --mod src/data/minis/muro.ts --mod worker/minis/muro.ts   → un minigioco non ancora negli index
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { party3d } from '../worker/party3d';
import { MINIS, miniKinds, newBody, stepBody, type Body, type MiniKind, type NetPos } from '../src/data/party3d';
import type { Ctx } from '../worker/modes';
import type { GameSettings, Player } from '../src/types/game';

const argv = process.argv.slice(2);
const mods: string[] = [];
for (let i = argv.indexOf('--mod'); i >= 0; i = argv.indexOf('--mod')) mods.push(...argv.splice(i, 2).slice(1));
for (const m of mods) await import(pathToFileURL(resolve(m)).href);
const arg = argv[0] ?? 'tutti';
const nBots = Number(argv[1] ?? 7);
const kinds: MiniKind[] = arg === 'tutti' ? miniKinds().filter((k) => MINIS[k]) : [arg as MiniKind];
let failed = 0;

for (const kind of kinds) {
  if (!miniKinds().includes(kind)) {
    console.log(`✗ ${kind}: minigioco non registrato`);
    failed++;
    continue;
  }
  const positions = new Map<string, NetPos>();
  const fx: Record<string, number> = {};
  let now = 1_000_000;
  const human: Body = newBody(0, 0);
  let humanSet = 0;
  const ctx = (): Ctx => ({
    now,
    isOnline: () => true,
    canLead: () => true,
    emit: (type, payload: any) => {
      const k = type === 'P3_FX' ? String(payload?.k) : type;
      fx[k] = (fx[k] ?? 0) + 1;
      if (type === 'P3_FX' && payload?.k === 'respawn' && payload.id === 'h1') Object.assign(human, newBody(payload.x, payload.z, payload.r ?? 0, payload.y));
    },
    storeImage: () => null,
    pos: () => null,
    teleport: () => {},
    p3get: (id) => positions.get(id) ?? null,
    p3set: (id, p) => {
      positions.set(id, p);
      if (id === 'h1') humanSet++;
    },
    knock: (id, v) => {
      if (id !== 'h1') return;
      human.kx += v.vx;
      human.kz += v.vz;
      human.vy = Math.max(human.vy, v.vy);
      human.ground = false;
    },
  });
  const settings = { partyBots: nBots, partyRounds: 1, spicy: false } as GameSettings;
  const players: Player[] = [{ id: 'h1', name: 'Prova', avatar: 'av1', color: '#ff4d6d', isOnline: true }];
  const t0 = Date.now();
  try {
    const s: any = party3d.start(settings, players, ctx());
    party3d.action(s, 'h1', 'MG_PROVA', { kind }, ctx());
    let spawnNo = -1;
    let wander = { x: 0, z: 0, until: 0 };
    let ticks = 0;
    let playMs = 0;
    let viewBytes = 0;
    while (s.stage !== 'RESULT' && s.stage !== 'END' && ticks < 20_000) {
      now += 66;
      ticks++;
      // il giocatore finto: torna alla partenza quando cambia, poi gironzola e ogni tanto salta
      if (s.spawnNo !== spawnNo) {
        spawnNo = s.spawnNo;
        const sp = s.spawns.h1 ?? { x: 0, y: 0, z: 0, r: 0 };
        Object.assign(human, newBody(sp.x, sp.z, sp.r, sp.y));
      }
      if (s.stage === 'PLAY') {
        playMs += 66;
        if (now > wander.until) wander = { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1, until: now + 800 };
        const t = (now - s.playStart) / 1000;
        if (s.alive.h1 && human.y > -40) stepBody(human, { x: wander.x * 0.5, z: wander.z * 0.5, jump: Math.random() < 0.02 }, 0.066, kind, t);
        positions.set('h1', { x: human.x, y: human.y, z: human.z, r: human.r, a: 1 });
        if (Math.random() < 0.01) party3d.action(s, 'h1', 'MG_PUSH', {}, ctx());
      }
      party3d.p3Tick!(s, ctx(), 0.066);
      if (ticks % 30 === 0) viewBytes = Math.max(viewBytes, JSON.stringify(party3d.view(s, 'h1')).length);
    }
    const rp = s.roundPoints ?? {};
    const ok = s.stage === 'RESULT' && Object.keys(rp).length > 0;
    const pts = Object.entries(rp)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([id, p]) => `${id === 'h1' ? 'TU' : s.bots.find((b: any) => b.id === id)?.name ?? id}:${p}`)
      .join(' ');
    const top = Object.entries(fx)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, n]) => `${k}×${n}`)
      .join(' ');
    console.log(`${ok ? '✓' : '✗'} ${kind}: ${(playMs / 1000).toFixed(0)}s di gioco · fuori ${s.out.length} · arrivati ${s.finished.length} · stato max ${(viewBytes / 1024).toFixed(1)} KB · ${Date.now() - t0} ms`);
    console.log(`    punti: ${pts}`);
    console.log(`    effetti: ${top || '(nessuno)'}`);
    if (!ok) {
      failed++;
      console.log(`    ✗ non è finito (fase ${s.stage}, ${ticks} giri)`);
    }
  } catch (e) {
    failed++;
    console.log(`✗ ${kind}: ERRORE`, e);
  }
}
process.exit(failed ? 1 : 0);
