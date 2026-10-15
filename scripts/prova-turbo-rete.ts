// ⚽🚗 Axend Turbo — prova della rete: server e due telefoni finti con ritardo, sbalzi e pacchetti persi.
// Controlla che la previsione del telefono coincida col server (la mia macchina non "scatta") e che l'anticipo si regoli da solo.
// Uso: npx tsx scripts/prova-turbo-rete.ts
import { turbo } from '../worker/turbo';
import { TurboEngine, type FastSnapshot } from '../src/components/turbo/engine';
import { noControls, type Controls } from '../src/game/turbo/car';
import type { Ctx } from '../worker/modes';

interface Net {
  name: string;
  oneWay: number; // ms
  jitter: number; // ms (in più, a caso)
  loss: number; // 0…1
  fps: number;
}

function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function prova(net: Net, seconds = 20) {
  const r = rnd(42);
  let now = 1_000_000;
  const ctx = { now, isOnline: () => true, canLead: () => true, emit() {}, storeImage: () => null, pos: () => null, teleport() {}, p3get: () => null, p3set() {}, knock() {} } as unknown as Ctx;
  const players = [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
  ];
  const s = turbo.start({ game: 'TURBO', extra: { turboSize: 2, turboSkill: 1 } } as never, players as never, ctx);
  const fast = turbo.fast!;

  // posta: [quando arriva, cosa fare]
  const mail: { at: number; run: () => void }[] = [];
  const post = (delay: number, run: () => void) => {
    if (r() < net.loss) return;
    mail.push({ at: now + delay + r() * net.jitter, run });
  };

  const drive = (id: string) => (t: number): Controls => {
    const c = noControls();
    c.throttle = 1;
    c.steer = Math.sin(t * (id === 'A' ? 0.9 : 1.3));
    c.boost = Math.floor(t / 2) % 3 === 0;
    c.jump = t % 4 < 0.15 || (t % 4 > 0.4 && t % 4 < 0.45);
    c.pitch = t % 4 > 0.4 && t % 4 < 0.5 ? -1 : 0;
    return c;
  };

  const engines = players.map((p) => {
    const e: TurboEngine = new TurboEngine(p.id, (payload) => post(net.oneWay, () => fast.input(s, p.id, payload, ctx)));
    return e;
  });
  const stats = engines.map(() => ({ corr: [] as number[], margin: [] as number[], lead: [] as number[], jumps: 0 }));

  let nextServer = now;
  let nextFrame = now;
  const end = now + seconds * 1000;
  while (now < end) {
    // il prossimo evento: server, fotogramma dei telefoni o posta
    mail.sort((a, b) => a.at - b.at);
    const tMail = mail.length ? mail[0].at : Infinity;
    now = Math.min(nextServer, nextFrame, tMail);
    (ctx as { now: number }).now = now;
    if (now === tMail) {
      mail.shift()!.run();
      continue;
    }
    if (now === nextServer) {
      nextServer += 1000 / 60 + (r() - 0.5) * 4; // setInterval non è preciso
      const out = fast.tick(s, ctx, 1 / 60);
      if (out.send) {
        const payload = (JSON.parse(out.send) as { payload: FastSnapshot }).payload;
        for (const e of engines) post(net.oneWay, () => e.onSnapshot(JSON.parse(JSON.stringify(payload))));
      }
      continue;
    }
    // fotogramma
    nextFrame += 1000 / net.fps;
    engines.forEach((e, i) => {
      const t = (now - s.startAt) / 1000;
      const hadSnap = (e as unknown as { queue: unknown[] }).queue.length > 0;
      const before = e.world.car(e.myId)?.pos.clone();
      e.frame(now, () => drive(e.myId)(t));
      if (hadSnap && t > 4 && before) {
        // correzione visiva subita dalla mia macchina in questa foto
        const o = e.offsets.get(e.myId);
        stats[i].corr.push(o ? o.len() : 0);
        stats[i].margin.push(e.margin);
        stats[i].lead.push(e.lead);
      }
      e.decayOffsets(1 / net.fps);
    });
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] ?? 0;
  console.log(`\n${net.name}: ${net.oneWay} ms ±${net.jitter}, persi ${Math.round(net.loss * 100)}%, ${net.fps} fps`);
  let ok = true;
  stats.forEach((st, i) => {
    const id = players[i].id;
    const c50 = pct(st.corr, 0.5);
    const c95 = pct(st.corr, 0.95);
    const line = `  ${id}: correzione mediana ${c50.toFixed(1)} uu, 95% ${c95.toFixed(1)} uu · anticipo ${avg(st.lead).toFixed(1)} passi · margine medio ${avg(st.margin).toFixed(1)}`;
    const good = c50 < 2 && c95 < 40;
    if (!good) ok = false;
    console.log((good ? '✓' : '✗') + line);
  });
  const w = s.score;
  console.log(`  punteggio ${w[0]}-${w[1]} · tick server ${(engines[0].world.tick / 120).toFixed(1)} s`);
  return ok;
}

let tutti = true;
for (const net of [
  { name: 'wifi buono', oneWay: 20, jitter: 5, loss: 0, fps: 60 },
  { name: '4G', oneWay: 50, jitter: 25, loss: 0.02, fps: 60 },
  { name: 'telefono lento', oneWay: 70, jitter: 40, loss: 0.03, fps: 30 },
  { name: 'monitor 144 Hz', oneWay: 30, jitter: 10, loss: 0, fps: 144 },
] as Net[])
  if (!prova(net)) tutti = false;
console.log(tutti ? '\nTutto ok' : '\nDa sistemare');
process.exit(tutti ? 0 : 1);
