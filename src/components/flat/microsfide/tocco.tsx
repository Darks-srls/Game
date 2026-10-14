// ⚡ Microsfide che si giocano a colpi di tocco: zanzara, frutta, numeri in ordine, candeline, palloncino,
// gatto alla finestra, partenza F1, non toccare niente, ruota
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { FRUTTI, RUOTA_ICONE, TENTAZIONI, gattoPlan, partenzaPlan, rng, scatter } from '../../../data/flat/microsfide';
import { Banner, Dots, FxLayer, clamp, rel, sfx, useBox, useFrame, useFx, type GameProps } from './kit';

type PE = RPointerEvent<HTMLElement>;

// ---------------------------------------------------------------- 🦟 schiaccia la zanzara (3 volte)

export function Zanzara({ seed, diff, clock, over, win }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    return { spots: Array.from({ length: 8 }, () => ({ x: r.range(0.18, 0.82), y: r.range(0.2, 0.8) })), ph: r.range(0, 6.28), k: r.range(0.85, 1.2) };
  }, [seed]);
  const need = 3;
  const [hits, setHits] = useState(0);
  const [splats, setSplats] = useState<{ x: number; y: number }[]>([]);
  const [ref, box] = useBox();
  const [fx, addFx] = useFx();
  const t = useFrame(clock, !over);
  const size = 78 - diff * 7;
  const amp = 0.05 + diff * 0.032;
  const sp = 0.0017 + diff * 0.0006;
  // la zanzara gira attorno al suo punto; dopo ogni colpo scappa al punto successivo (uguale per tutti)
  const at = (k: number, tt: number) => {
    const s = plan.spots[k % plan.spots.length];
    return {
      x: clamp(s.x + amp * Math.sin(tt * sp * plan.k + plan.ph + k * 2), 0.08, 0.92),
      y: clamp(s.y + amp * 1.4 * Math.sin(tt * sp * 1.37 + plan.ph * 1.7 + k), 0.1, 0.9),
    };
  };
  const p = at(hits, t);
  const tilt = Math.cos(t * sp * plan.k + plan.ph + hits * 2) * 18;
  const down = (e: PE) => {
    if (over || hits >= need) return;
    const q = rel(e, ref.current);
    const c = at(hits, clock());
    if (Math.hypot(q.x - c.x * box.w, q.y - c.y * box.h) < size * 0.8) {
      sfx.hit();
      addFx(q.x, q.y, <span className="ms-emoji text-6xl">💥</span>);
      setSplats((l) => [...l, { x: q.x, y: q.y }]);
      const h = hits + 1;
      setHits(h);
      if (h >= need) win();
    } else {
      sfx.tap();
      addFx(q.x, q.y, <span className="ms-emoji text-3xl">💨</span>);
    }
  };
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={down}>
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'linear-gradient(#fff 2px, transparent 2px), linear-gradient(90deg, #fff 2px, transparent 2px)', backgroundSize: '52px 52px' }}
      />
      <span className="ms-emoji pointer-events-none absolute left-1/2 top-[3%] -translate-x-1/2 text-5xl opacity-90">💡</span>
      {splats.map((s, i) => (
        <span key={i} className="pointer-events-none absolute h-7 w-9 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-rose-900/60" style={{ left: s.x, top: s.y }} />
      ))}
      <Dots done={hits} total={need} className="absolute inset-x-0 bottom-4" />
      {hits < need && box.w > 0 && (
        <span className="ms-emoji pointer-events-none absolute" style={{ left: p.x * box.w, top: p.y * box.h, fontSize: size, transform: `translate(-50%,-50%) rotate(${tilt}deg)` }}>
          <span className="ms-buzz inline-block drop-shadow-[0_10px_6px_rgba(0,0,0,0.35)]">🦟</span>
        </span>
      )}
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🍉 tocca tutta la frutta, non la bomba

export function Frutta({ seed, diff, clock, over, win, lose }: GameProps) {
  const items = useMemo(() => {
    const r = rng(seed);
    const nF = 5 + diff;
    const nB = 1 + Math.floor(diff / 2);
    return scatter(r, nF + nB, 3, 5, 0.1, 0.14).map((p, i) => ({ ...p, bomb: i < nB, emoji: i < nB ? '💣' : r.pick(FRUTTI), ph: r.range(0, 6.28), amp: r.range(0.03, 0.06) }));
  }, [seed, diff]);
  const nFruit = items.filter((i) => !i.bomb).length;
  const [gone, setGone] = useState<number[]>([]);
  const [boom, setBoom] = useState<number | null>(null);
  const moving = diff >= 2;
  const t = useFrame(clock, moving && !over);
  const [ref, box] = useBox();
  const [fx, addFx] = useFx();
  const pos = (i: number) => {
    const it = items[i];
    return { x: (it.x + (moving ? it.amp * Math.sin(t * 0.0024 + it.ph) : 0)) * box.w, y: (it.y + (moving ? it.amp * 0.6 * Math.cos(t * 0.002 + it.ph) : 0)) * box.h };
  };
  const tap = (i: number, e: PE) => {
    if (over || gone.includes(i)) return;
    const q = rel(e, ref.current);
    if (items[i].bomb) {
      sfx.boom();
      setBoom(i);
      lose('Hai toccato la bomba! 💣');
      return;
    }
    sfx.hit();
    addFx(q.x, q.y, <span className="ms-emoji text-5xl">💦</span>);
    const g = [...gone, i];
    setGone(g);
    if (g.length >= nFruit) win();
  };
  return (
    <div ref={ref} className="absolute inset-0">
      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(#fff 3px, transparent 3px)', backgroundSize: '34px 34px' }} />
      <Banner>
        🍉 {gone.length}/{nFruit}
      </Banner>
      {box.w > 0 &&
        items.map((it, i) => {
          const p = pos(i);
          const isGone = gone.includes(i);
          return (
            <div
              key={i}
              onPointerDown={(e) => tap(i, e)}
              className={`absolute grid h-[76px] w-[76px] place-items-center rounded-full ${isGone ? 'ms-out' : ''} ${
                it.bomb ? 'bg-slate-950/80 shadow-[0_0_0_4px_#ff3b6e,0_0_24px_#ff3b6e]' : 'bg-white/90 shadow-[0_6px_0_rgba(0,0,0,0.25)]'
              }`}
              style={{ left: p.x - 38, top: p.y - 38 }}
            >
              <span className={`ms-emoji text-[46px] ${it.bomb ? 'ms-wiggle' : ''}`}>{it.emoji}</span>
            </div>
          );
        })}
      {boom !== null && box.w > 0 && (
        <>
          <div className="ms-flash absolute inset-0 z-30 bg-white" />
          <span className="ms-emoji ms-pop pointer-events-none absolute z-30 text-[140px]" style={{ left: pos(boom).x - 80, top: pos(boom).y - 80 }}>
            💥
          </span>
        </>
      )}
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🔢 tocca i numeri in ordine

const BOLLE = ['#ff3b6e', '#ff8c1a', '#ffd21f', '#2fd35f', '#12b5f5', '#7c5cff', '#ff7ad1', '#00c2a8', '#f43f5e'];

export function Ordine({ seed, diff, clock, over, win, lose }: GameProps) {
  const k = 5 + diff;
  const items = useMemo(() => {
    const r = rng(seed);
    const colors = r.shuffle(BOLLE);
    return scatter(r, k, 3, 4, 0.1, 0.18).map((p, i) => ({ ...p, n: i + 1, color: colors[i % colors.length], ph: r.range(0, 6.28) }));
  }, [seed, k]);
  const [next, setNext] = useState(1);
  const [wrong, setWrong] = useState<number | null>(null);
  const moving = diff >= 3;
  const t = useFrame(clock, moving && !over);
  const [ref, box] = useBox();
  const [fx, addFx] = useFx();
  const size = 80 - diff * 3;
  const tap = (n: number, e: PE) => {
    if (over || n < next) return;
    const q = rel(e, ref.current);
    if (n !== next) {
      setWrong(n);
      lose(`Dovevi toccare il ${next}!`);
      return;
    }
    sfx.hit();
    addFx(q.x, q.y, <span className="font-display text-4xl text-white ms-stroke">{n}!</span>, 'ms-rise');
    setNext(n + 1);
    if (n >= k) win();
  };
  return (
    <div ref={ref} className="absolute inset-0">
      <Banner>Il prossimo: {Math.min(next, k)}</Banner>
      {box.w > 0 &&
        items.map((it) => {
          const x = (it.x + (moving ? 0.045 * Math.sin(t * 0.0022 + it.ph) : 0)) * box.w;
          const y = (it.y + (moving ? 0.03 * Math.cos(t * 0.0019 + it.ph) : 0)) * box.h;
          const done = it.n < next;
          const hint = wrong !== null && it.n === next;
          return (
            <div
              key={it.n}
              onPointerDown={(e) => tap(it.n, e)}
              className={`absolute grid place-items-center rounded-full border-4 border-white font-display text-white shadow-[inset_0_-6px_0_rgba(0,0,0,0.2),0_6px_0_rgba(0,0,0,0.25)] ${
                done ? 'ms-out' : ''
              } ${wrong === it.n ? 'ms-shake' : ''} ${hint ? 'ms-pulse ring-8 ring-white/70' : ''}`}
              style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, background: it.color, fontSize: size * 0.5 }}
            >
              <span className="ms-stroke">{it.n}</span>
            </div>
          );
        })}
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🎂 spegni le candeline (le magiche si riaccendono)

export function Candeline({ seed, diff, clock, over, win }: GameProps) {
  const k = 5 + diff;
  const relight = diff >= 2 ? [0, 0, 1900, 1600, 1300][diff] : 0;
  const candles = useMemo(() => {
    const r = rng(seed);
    const colors = r.shuffle(['#ff7ad1', '#7dd3fc', '#fde047', '#86efac', '#c4b5fd', '#fca5a5']);
    const back = k > 6 ? Math.floor(k / 2) : 0;
    return Array.from({ length: k }, (_, i) => {
      const row = i < back ? 0 : 1;
      const idx = row === 0 ? i : i - back;
      const n = row === 0 ? back : k - back;
      return { x: 0.2 + (0.6 * (idx + (row === 0 ? 0.5 : 0))) / Math.max(1, n - (row === 0 ? 0 : 1)), row, color: colors[i % colors.length], h: r.range(0.9, 1.1) };
    });
  }, [seed, k]);
  const offAt = useRef<Record<number, number>>({});
  const [, setTick] = useState(0);
  const t = useFrame(clock, relight > 0 && !over);
  const [ref, box] = useBox();
  const [fx, addFx] = useFx(800);
  const lit = (i: number, tt: number) => offAt.current[i] === undefined || (relight > 0 && tt - offAt.current[i] >= relight);
  // la candela poggia sulla glassa: x al centro, top = dove inizia lo stoppino
  const place = (c: (typeof candles)[number]) => {
    const height = (c.row === 0 ? 54 : 70) * c.h;
    const bottom = (c.row === 0 ? 0.535 : 0.575) * box.h;
    return { x: c.x * box.w, top: bottom - height, height };
  };
  const blow = (e: PE) => {
    if (over) return;
    const q = rel(e, ref.current);
    const now = clock();
    let changed = false;
    candles.forEach((c, i) => {
      const p = place(c);
      if (!lit(i, now)) return;
      if (Math.abs(q.x - p.x) < 30 && q.y > p.top - 70 && q.y < p.top + 40) {
        offAt.current[i] = now;
        changed = true;
        addFx(p.x, p.top - 30, <span className="ms-emoji text-4xl">💨</span>, 'ms-smoke');
      }
    });
    if (!changed) return;
    sfx.swoosh();
    setTick((x) => x + 1);
    if (candles.every((_, i) => !lit(i, now))) {
      addFx(box.w / 2, box.h * 0.25, <span className="font-display text-4xl text-white ms-stroke">Tanti auguri! 🎉</span>, 'ms-rise');
      win();
    }
  };
  const tt = relight > 0 ? t : clock();
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onPointerDown={blow}
      onPointerMove={(e) => {
        if (e.buttons & 1 || e.pointerType === 'touch') blow(e);
      }}
    >
      <Banner>{relight ? '🪄 Candeline magiche!' : '🎂 Spegnile tutte!'}</Banner>
      {/* torta */}
      <div className="pointer-events-none absolute left-[7%] right-[7%] top-[50%] h-[34%]">
        <div className="absolute inset-x-[-4%] bottom-[-6%] h-[18%] rounded-[50%] bg-white/80 shadow-[0_8px_0_rgba(0,0,0,0.25)]" />
        <div className="absolute inset-x-0 bottom-0 top-[8%] rounded-[28px] bg-linear-to-b from-amber-200 to-amber-500 shadow-[inset_0_-10px_0_rgba(0,0,0,0.15)]" />
        <div className="absolute inset-x-0 top-[22%] h-[12%] bg-rose-400/80" />
        <div className="absolute inset-x-0 top-0 h-[22%] rounded-t-[28px] bg-pink-300 shadow-[0_6px_0_#f472b6]" />
        <div className="absolute inset-x-0 top-[55%] flex justify-around text-2xl">
          <span className="ms-emoji">🍓</span>
          <span className="ms-emoji">🍓</span>
          <span className="ms-emoji">🍓</span>
        </div>
      </div>
      {box.w > 0 &&
        candles.map((c, i) => {
          const p = place(c);
          const on = lit(i, tt);
          return (
            <div key={i} className="pointer-events-none absolute" style={{ left: p.x - 9, top: p.top }}>
              <div
                className="w-[18px] rounded-t-sm shadow-[inset_-4px_0_0_rgba(0,0,0,0.15)]"
                style={{ height: p.height, background: `repeating-linear-gradient(135deg, ${c.color} 0 7px, #fff 7px 12px)` }}
              />
              <div className="absolute left-1/2 top-[-6px] h-2 w-[2px] -translate-x-1/2 bg-slate-950" />
              {on && (
                <div className="absolute left-1/2 top-[-44px] -ml-[13px]">
                  <div className="absolute -inset-4 rounded-full bg-amber-300/30 blur-md" />
                  <div
                    className="ms-flicker relative h-[38px] w-[26px]"
                    style={{ borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: 'radial-gradient(circle at 50% 72%, #fff 0 18%, #ffe066 30%, #ff9f1a 62%, #ff4d2e 100%)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🎈 gonfia il palloncino finché scoppia

const PALLONCINI = ['#ff3b6e', '#3d8bff', '#ffd21f', '#2fd35f', '#a855f7', '#ff8c1a'];

export function Palloncino({ seed, diff, clock, over, win }: GameProps) {
  const N = 10 + 2 * diff;
  const deflate = [0, 0, 1, 1.6, 2.2][diff] ?? 0; // soffi persi al secondo
  const color = useMemo(() => rng(seed).pick(PALLONCINI), [seed]);
  const air = useRef({ v: 0, at: 0 });
  const pumpAt = useRef(-9999);
  const [popped, setPopped] = useState(false);
  const level = (tt: number) => Math.max(0, air.current.v - (deflate * (tt - air.current.at)) / 1000);
  const t = useFrame(clock, !over && !popped);
  const cur = popped ? N : level(t);
  const k = cur / N;
  const down = () => {
    if (over || popped) return;
    const now = clock();
    const v = level(now) + 1;
    air.current = { v, at: now };
    pumpAt.current = now;
    if (v >= N) {
      setPopped(true);
      sfx.boom();
      win();
    } else sfx.tap();
  };
  const press = t - pumpAt.current < 90;
  const s = 0.32 + 0.68 * k;
  const shake = k > 0.7 ? Math.sin(t / 22) * (k - 0.7) * 14 : 0;
  return (
    <div className="absolute inset-0" onPointerDown={down}>
      <Banner>{popped ? 'POP! 🎉' : `Soffi: ${Math.floor(cur)}/${N}`}</Banner>
      {/* sagoma: fin qui e scoppia */}
      <div className="pointer-events-none absolute left-1/2 top-[44%] h-[300px] w-[240px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-[6%] h-[230px] w-[200px] -translate-x-1/2 rounded-[50%] border-4 border-dashed border-white/50" />
        {!popped ? (
          <div className="absolute inset-0 origin-bottom transition-transform duration-75" style={{ transform: `scale(${s}) rotate(${shake}deg)` }}>
            <svg viewBox="0 0 240 300" className="h-full w-full overflow-visible">
              <ellipse cx="120" cy="125" rx="100" ry="115" fill={color} />
              <ellipse cx="80" cy="80" rx="22" ry="34" fill="#fff" opacity="0.45" transform="rotate(-25 80 80)" />
              <path d="M110 238 L130 238 L124 252 L116 252 Z" fill={color} />
              <path d="M120 252 C 108 270, 134 282, 120 300" stroke="#fff" strokeWidth="3" fill="none" />
            </svg>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="ms-emoji ms-pop text-[150px]">💥</span>
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="ms-fly absolute left-1/2 top-1/2 h-4 w-3 rounded-sm"
                style={{ background: i % 2 ? color : PALLONCINI[i % PALLONCINI.length], '--dx': `${Math.cos(i * 0.39) * 150}px`, '--dy': `${Math.sin(i * 0.39) * 150}px` } as CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
      {/* pompa */}
      <div className="pointer-events-none absolute bottom-[4%] left-1/2 flex -translate-x-1/2 flex-col items-center">
        <div className="h-3 w-24 rounded-full bg-slate-950/70 transition-transform duration-75" style={{ transform: `translateY(${press ? 22 : 0}px)` }} />
        <div className="h-8 w-3 bg-slate-950/60 transition-transform duration-75" style={{ transform: `translateY(${press ? 22 : 0}px)` }} />
        <div className="h-20 w-16 rounded-xl border-4 border-white/80 bg-linear-to-b from-sky-400 to-blue-700 shadow-[0_6px_0_rgba(0,0,0,0.3)]" />
        <p className="mt-2 rounded-full bg-black/40 px-3 py-1 font-display text-base text-white">TOCCA TOCCA TOCCA!</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 🐱 solo il gatto (alle finestre del palazzo)

const NOMI: Record<string, string> = { '🐶': 'un cane', '🐕': 'un cane', '🐩': 'un barboncino', '🐭': 'un topo', '🐰': 'un coniglio' };

export function Gatto({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => gattoPlan(seed, diff), [seed, diff]);
  const flowers = useMemo(() => {
    const r = rng(seed ^ 0x77);
    return Array.from({ length: 9 }, () => r.chance(0.45));
  }, [seed]);
  const caught = useRef<number[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const t = useFrame(clock, !over);
  const [ref] = useBox();
  const [fx, addFx] = useFx(800);
  // chi è affacciato a una finestra in questo momento
  const who = (cell: number, tt: number) => {
    let found = -1;
    plan.pops.forEach((p, i) => {
      if (p.cell === cell && tt >= p.t && tt <= p.t + plan.vis && !caught.current.includes(i)) found = i;
    });
    return found;
  };
  const tap = (cell: number, e: PE) => {
    if (over) return;
    const q = rel(e, ref.current);
    const i = who(cell, clock());
    if (i < 0) {
      sfx.tap();
      return;
    }
    const p = plan.pops[i];
    if (p.kind !== '🐱') {
      setBad(i);
      sfx.bonk();
      lose(`Era ${NOMI[p.kind] ?? 'un cane'}! 🐶`);
      return;
    }
    caught.current = [...caught.current, i];
    sfx.hit();
    addFx(q.x, q.y, <span className="ms-emoji text-6xl">😻</span>, 'ms-rise');
    if (caught.current.length >= plan.cats) win();
  };
  return (
    <div ref={ref} className="absolute inset-0">
      <div className="absolute inset-x-[4%] bottom-0 top-[9%] rounded-t-3xl bg-[#e9a85a] shadow-[inset_0_10px_0_rgba(255,255,255,0.25)]">
        <div className="absolute inset-x-0 top-0 h-5 rounded-t-3xl bg-[#b4532a]" />
      </div>
      <Banner>
        🐱 {caught.current.length}/{plan.cats}
      </Banner>
      <div className="absolute inset-x-[9%] bottom-[5%] top-[16%] grid grid-cols-3 grid-rows-3 gap-x-[6%] gap-y-[5%]">
        {Array.from({ length: 9 }, (_, cell) => {
          const i = who(cell, t);
          const p = i >= 0 ? plan.pops[i] : null;
          const prog = p ? (t - p.t) / plan.vis : 0;
          const up = p ? clamp(Math.min(prog / 0.14, (1 - prog) / 0.14), 0, 1) : 0;
          return (
            <div key={cell} onPointerDown={(e) => tap(cell, e)} className="relative flex flex-col">
              <div className="relative flex-1 overflow-hidden rounded-t-[40px] border-4 border-[#f6e7c8] bg-linear-to-b from-slate-950 to-slate-800">
                {p && (
                  <span
                    className={`ms-emoji absolute bottom-0 left-1/2 text-[52px] ${bad === i ? 'ms-shake' : ''}`}
                    style={{ transform: `translate(-50%, ${(1 - up) * 100}%)` }}
                  >
                    {p.kind}
                  </span>
                )}
                {/* persiane verdi */}
                <div className="absolute inset-y-0 -left-1 w-[18%] bg-[repeating-linear-gradient(0deg,#1f7a3a_0_6px,#2a9d4b_6px_10px)]" />
                <div className="absolute inset-y-0 -right-1 w-[18%] bg-[repeating-linear-gradient(0deg,#1f7a3a_0_6px,#2a9d4b_6px_10px)]" />
              </div>
              <div className="h-3 rounded-sm bg-[#f6e7c8]" />
              {flowers[cell] && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-base leading-none ms-emoji">🌸🌼🌸</div>}
            </div>
          );
        })}
      </div>
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🏎️ partenza: via quando si spengono le luci

export function Partenza({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => partenzaPlan(seed, diff), [seed, diff]);
  const lastOn = useRef(0);
  const [gone, setGone] = useState(false);
  const [early, setEarly] = useState(false);
  const t = useFrame(clock, !over, (tt) => {
    // un bip a ogni luce che si accende (uguale per tutti)
    const n = tt < plan.outAt ? plan.on.filter((x) => tt >= x).length : 0;
    if (n > lastOn.current) sfx.tap();
    lastOn.current = n;
  });
  const out = t >= plan.outAt;
  const down = () => {
    if (over) return;
    if (clock() < plan.outAt) {
      setEarly(true);
      lose('Partenza anticipata! 🚩');
      return;
    }
    setGone(true);
    sfx.swoosh();
    win();
  };
  return (
    <div className="absolute inset-0" onPointerDown={down}>
      {/* semaforo di partenza */}
      <div className="pointer-events-none absolute inset-x-[5%] top-[8%] flex justify-between rounded-2xl bg-slate-950 p-2.5 shadow-[0_8px_0_rgba(0,0,0,0.5)]">
        {plan.on.map((x, i) => {
          const on = t >= x && !out;
          return (
            <div key={i} className="flex flex-col gap-2 rounded-xl bg-zinc-800 p-1.5">
              {[0, 1].map((j) => (
                <span
                  key={j}
                  className="block h-11 w-11 rounded-full border-2 border-black transition-colors duration-75"
                  style={{ background: on ? 'radial-gradient(circle at 40% 35%, #ffb3b3, #ff1a1a 55%, #990000)' : '#2a2a2e', boxShadow: on ? '0 0 22px #ff2a2a' : 'none' }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p className="pointer-events-none absolute inset-x-0 top-[42%] text-center font-display text-5xl text-white ms-stroke">
        {early ? 'TROPPO PRESTO!' : out ? 'VIA!!!' : 'Aspetta…'}
      </p>
      {/* pista e macchina */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-zinc-700">
        <div className="absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(90deg,#fff_0_18px,#e11d48_18px_36px)]" />
        <div className="absolute left-1/2 top-4 bottom-0 w-2 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,#fff_0_22px,transparent_22px_44px)]" />
        <div className="absolute inset-x-0 top-[38%] h-6 bg-[repeating-conic-gradient(#fff_0_25%,#111_0_50%)] bg-[length:24px_24px] opacity-80" />
      </div>
      <div className={`pointer-events-none absolute bottom-[8%] left-1/2 -ml-[56px] ${gone ? 'ms-zoom' : ''}`}>
        <span className="ms-emoji block rotate-90 text-[112px] drop-shadow-[0_10px_8px_rgba(0,0,0,0.5)]">🏎️</span>
        {gone && <span className="ms-emoji absolute left-1/2 top-full -translate-x-1/2 text-6xl">💨</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 🙅 non toccare niente (resisti alle tentazioni)

export function NonToccare({ seed, diff, dur, clock, over, lose }: GameProps) {
  const pops = useMemo(() => {
    const r = rng(seed);
    const n = 4 + diff;
    const slot = (dur - 1000) / n;
    return r
      .shuffle(TENTAZIONI)
      .slice(0, n)
      .map((p, i) => ({ text: p.t, btn: p.b, at: 150 + slot * i + r.range(0, slot * 0.5), x: r.range(0.32, 0.68), y: r.range(0.14, 0.8), style: r.int(0, 2), tilt: r.range(-7, 7) }));
  }, [seed, diff, dur]);
  const shown = useRef(0);
  const [touched, setTouched] = useState(false);
  const t = useFrame(clock, !over, (tt) => {
    // "dlin!" a ogni tentazione nuova
    const n = pops.filter((p) => tt >= p.at).length;
    if (n > shown.current) sfx.hit();
    shown.current = n;
  });
  const down = () => {
    if (over) return;
    setTouched(true);
    sfx.bonk();
    lose('Hai toccato! 😈 Non dovevi');
  };
  const visible = pops.filter((p) => t >= p.at).slice(-3);
  return (
    <div className={`absolute inset-0 ${touched ? 'ms-shake' : ''}`} onPointerDown={down}>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <span className="ms-emoji ms-bob block text-[110px]">🙅</span>
          <p className="font-display text-4xl text-white ms-stroke">MANI A POSTO!</p>
        </div>
      </div>
      {visible.map((p) => (
        <div key={p.at} className="ms-popin pointer-events-none absolute w-[80%] max-w-[330px]" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, rotate: `${p.tilt}deg` }}>
          {p.style === 0 && (
            <div className="rounded-2xl bg-white/95 p-3 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
              <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-500 text-[11px]">💬</span> ADESSO
              </p>
              <p className="mt-1 text-lg font-black leading-tight text-zinc-900">{p.text}</p>
              <span className="mt-2 inline-block rounded-full bg-sky-500 px-4 py-1 font-black text-white">{p.btn}</span>
            </div>
          )}
          {p.style === 1 && (
            <div className="overflow-hidden rounded-2xl bg-zinc-100/95 text-center shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
              <p className="px-4 pt-3 text-lg font-black leading-tight text-zinc-900">{p.text}</p>
              <div className="mt-3 grid grid-cols-2 border-t border-zinc-300 text-base font-bold text-sky-600">
                <span className="border-r border-zinc-300 py-2">Dopo</span>
                <span className="py-2">{p.btn}</span>
              </div>
            </div>
          )}
          {p.style === 2 && (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="ms-pulse rounded-full bg-red-500 px-7 py-4 font-display text-3xl text-white shadow-[0_8px_0_#9c0d3a] ring-8 ring-red-300/60">{p.btn}</span>
              <p className="font-display text-xl leading-tight text-white ms-stroke">{p.text}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 🎡 ferma la ruota sul simbolo giusto

export function Ruota({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    const icons = r.shuffle(RUOTA_ICONE).slice(0, 8);
    const target = r.int(0, 7);
    const dir = r.chance(0.5) ? 1 : -1;
    // all'inizio sotto la freccia c'è il simbolo opposto
    const a0 = -(((target + 4) % 8) * 45 + 22.5);
    return { icons, target, dir, a0 };
  }, [seed]);
  const speed = [0.2, 0.25, 0.3, 0.35, 0.4][diff] ?? 0.3; // gradi al millisecondo
  const angle = (tt: number) => plan.a0 + plan.dir * speed * tt + (diff >= 3 ? 28 * Math.sin(tt * 0.004) : 0);
  const [stop, setStop] = useState<number | null>(null);
  const t = useFrame(clock, !over && stop === null);
  const a = stop ?? angle(t);
  const under = (deg: number) => Math.floor((((-deg % 360) + 360) % 360) / 45) % 8;
  const down = () => {
    if (over || stop !== null) return;
    const A = angle(clock());
    setStop(A);
    const idx = under(A);
    if (idx === plan.target) {
      sfx.hit();
      win();
    } else {
      sfx.bonk();
      lose(`Ti sei fermato su ${plan.icons[idx]}`);
    }
  };
  const COLORS = ['#ff3b6e', '#ffd21f', '#12b5f5', '#2fd35f', '#ff8c1a', '#a855f7', '#ff7ad1', '#00c2a8'];
  const seg = (i: number) => {
    const p = (deg: number) => `${100 * Math.sin((deg * Math.PI) / 180)} ${-100 * Math.cos((deg * Math.PI) / 180)}`;
    return `M0 0 L${p(i * 45)} A100 100 0 0 1 ${p((i + 1) * 45)} Z`;
  };
  const hit = stop !== null ? under(stop) : -1;
  return (
    <div className="absolute inset-0" onPointerDown={down}>
      <div className="pointer-events-none absolute inset-x-0 top-[4%] flex justify-center">
        <span className="flex items-center gap-2 rounded-3xl border-4 border-white bg-black/40 px-5 py-2 font-display text-3xl text-white">
          Ferma su <span className="ms-emoji text-5xl">{plan.icons[plan.target]}</span>
        </span>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[57%] aspect-square w-[min(88%,62vh)] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="-110 -110 220 220" className="h-full w-full overflow-visible drop-shadow-[0_10px_0_rgba(0,0,0,0.3)]">
          <circle r="108" fill="#fff" />
          <g transform={`rotate(${a})`}>
            {plan.icons.map((ic, i) => {
              const mid = ((i * 45 + 22.5) * Math.PI) / 180;
              return (
                <g key={i}>
                  <path d={seg(i)} fill={COLORS[i]} stroke="#fff" strokeWidth="2" opacity={hit >= 0 && hit !== i ? 0.45 : 1} />
                  <text x={66 * Math.sin(mid)} y={-66 * Math.cos(mid)} fontSize="26" textAnchor="middle" dominantBaseline="central" className="ms-emoji">
                    {ic}
                  </text>
                </g>
              );
            })}
          </g>
          <circle r="16" fill="#fff" stroke="#2c1577" strokeWidth="4" />
          <path d="M-14 -122 L14 -122 L0 -96 Z" fill="#fff" stroke="#2c1577" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-[4%] text-center font-display text-xl text-white/90">Tocca per fermarla!</p>
    </div>
  );
}
