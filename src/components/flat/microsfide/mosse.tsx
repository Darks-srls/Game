// ⚡ Microsfide di movimento: spilla la birra, strofina il piatto, frecce, pizza al volo, schiva le ciabatte,
// affetta la frutta, canestro, arrotola gli spaghetti, para il rigore
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { CADUTE, FRUTTI, rigorePlan, rng } from '../../../data/flat/microsfide';
import { Avatar } from '../../ui';
import { Banner, FxLayer, clamp, lerp, rel, segDist, sfx, useBox, useFrame, useFx, type GameProps } from './kit';

type PE = RPointerEvent<HTMLElement>;
const capture = (e: PE) => {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // alcuni browser non lo permettono: pazienza
  }
};
const pressed = (e: PE) => e.pointerType === 'touch' || (e.buttons & 1) === 1;

// ---------------------------------------------------------------- 🍺 spilla la birra fino alla tacca

export function Birra({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    const zh = [0.17, 0.145, 0.125, 0.105, 0.09][diff] ?? 0.12;
    const zc = r.range(0.52, 0.8);
    return { z0: zc - zh / 2, z1: zc + zh / 2, base: [0.3, 0.35, 0.4, 0.45, 0.5][diff] ?? 0.4, acc: [0.3, 0.4, 0.5, 0.6, 0.7][diff] ?? 0.5 };
  }, [seed, diff]);
  const pour = useRef<{ from: number; to: number | null } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'pour' | 'done'>('idle');
  // livello (0-1): accelera più si tiene premuto
  const levelAt = (tt: number) => {
    const p = pour.current;
    if (!p) return 0;
    const s = Math.max(0, ((p.to ?? tt) - p.from) / 1000);
    return plan.base * (s + (plan.acc * s * s) / 2);
  };
  const t = useFrame(clock, !over && phase !== 'done', (tt) => {
    const p = pour.current;
    if (p && p.to === null && levelAt(tt) >= 1) {
      p.to = tt;
      setPhase('done');
      lose('Trabocca! 🫗');
    }
  });
  const level = Math.min(1, levelAt(t));
  const down = (e: PE) => {
    if (over || phase !== 'idle') return;
    capture(e);
    pour.current = { from: clock(), to: null };
    setPhase('pour');
    sfx.tap();
  };
  const up = () => {
    const p = pour.current;
    if (!p || p.to !== null || over) return;
    p.to = clock();
    setPhase('done');
    const L = levelAt(p.to);
    if (L >= plan.z0 && L <= plan.z1) {
      sfx.hit();
      win();
    } else lose(L < plan.z0 ? 'Troppo poca! 😩' : 'Troppa! Fuori dalla tacca 🫗');
  };
  return (
    <div className="absolute inset-0" onPointerDown={down} onPointerUp={up} onPointerCancel={up}>
      {/* spillatore */}
      <div className="pointer-events-none absolute left-1/2 top-[3%] flex -translate-x-1/2 flex-col items-center">
        <div className="h-10 w-5 rounded-t-lg bg-zinc-900" style={{ rotate: phase === 'pour' ? '-25deg' : '0deg', transformOrigin: 'bottom' }} />
        <div className="h-6 w-24 rounded-xl bg-linear-to-b from-zinc-200 to-zinc-500 shadow-[0_4px_0_rgba(0,0,0,0.3)]" />
        <div className="h-5 w-4 rounded-b bg-zinc-400" />
        {phase === 'pour' && <div className="h-[46vh] w-2.5 rounded-full bg-amber-300/90" />}
      </div>
      {/* bicchiere */}
      <div className="pointer-events-none absolute bottom-[12%] left-1/2 h-[58%] w-[46%] max-w-[210px] -translate-x-1/2">
        <div className="absolute inset-0 overflow-hidden rounded-b-[38px] rounded-t-md border-[6px] border-white/80 bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.25)]">
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-b from-amber-300 to-amber-600" style={{ height: `${level * 100}%` }}>
            <div className="absolute inset-x-0 top-0 h-[22px] -translate-y-1/2 rounded-full bg-white/95" />
            <div className="absolute bottom-3 left-[30%] h-2 w-2 rounded-full bg-white/60 ms-bob" />
            <div className="absolute bottom-8 left-[62%] h-1.5 w-1.5 rounded-full bg-white/60 ms-bob" />
          </div>
          {/* la tacca */}
          <div
            className="absolute inset-x-0 border-y-4 border-dashed border-emerald-300 bg-emerald-400/35"
            style={{ bottom: `${plan.z0 * 100}%`, height: `${(plan.z1 - plan.z0) * 100}%` }}
          />
        </div>
        <div className="absolute -right-12 top-[30%] h-[40%] w-9 rounded-r-3xl border-[6px] border-l-0 border-white/70" />
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-[3%] text-center font-display text-2xl text-white ms-stroke">
        {phase === 'idle' ? 'TIENI PREMUTO 👇' : phase === 'pour' ? 'LASCIA NEL VERDE!' : ''}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- 🧽 strofina il piatto della nonna

const SPORCO = ['rgba(150,60,20,0.95)', 'rgba(205,45,30,0.92)', 'rgba(125,90,30,0.92)', 'rgba(95,125,35,0.9)', 'rgba(110,50,25,0.96)'];

export function Piatto({ seed, diff, over, win }: GameProps) {
  const [ref, box] = useBox();
  const canvas = useRef<HTMLCanvasElement>(null);
  const cells = useRef<{ x: number; y: number; clean: boolean }[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);
  const lastSound = useRef(0);
  const [prog, setProg] = useState(0);
  const [sponge, setSponge] = useState<{ x: number; y: number } | null>(null);
  const R = Math.min(box.w, box.h) * 0.42;
  const cx = box.w / 2;
  const cy = box.h * 0.5;
  const brush = R * ([0.24, 0.22, 0.2, 0.18, 0.165][diff] ?? 0.2);
  // lo sporco si disegna una volta (dal seme) e si ricavano le zone da pulire
  useLayoutEffect(() => {
    const cv = canvas.current;
    if (!cv || !box.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(box.w * dpr);
    cv.height = Math.round(box.h * dpr);
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(seed);
    const blobs = 24 + diff * 5;
    for (let i = 0; i < blobs; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = Math.sqrt(r.next()) * R * 0.74;
      const bx = cx + Math.cos(a) * d;
      const by = cy + Math.sin(a) * d;
      const br = R * r.range(0.1, 0.22);
      g.fillStyle = r.pick(SPORCO);
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const ox = bx + r.range(-br * 0.6, br * 0.6);
        const oy = by + r.range(-br * 0.6, br * 0.6);
        const rr = br * r.range(0.4, 0.75);
        g.moveTo(ox + rr, oy);
        g.arc(ox, oy, rr, 0, Math.PI * 2);
      }
      g.fill();
    }
    // briciole
    g.fillStyle = 'rgba(80,40,10,0.9)';
    for (let i = 0; i < 40; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(0, R * 0.85);
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r.range(1.5, 4), 0, Math.PI * 2);
      g.fill();
    }
    const img = g.getImageData(0, 0, cv.width, cv.height).data;
    const G = 14;
    const list: { x: number; y: number; clean: boolean }[] = [];
    for (let gx = 0; gx < G; gx++)
      for (let gy = 0; gy < G; gy++) {
        const x = cx - R + ((gx + 0.5) * 2 * R) / G;
        const y = cy - R + ((gy + 0.5) * 2 * R) / G;
        if (Math.hypot(x - cx, y - cy) > R * 0.9) continue;
        const idx = (Math.round(y * dpr) * cv.width + Math.round(x * dpr)) * 4 + 3;
        if ((img[idx] ?? 0) > 40) list.push({ x, y, clean: false });
      }
    cells.current = list;
    done.current = false;
    setProg(0);
  }, [box.w, box.h, seed, diff]);
  const scrub = (p: { x: number; y: number }) => {
    const g = canvas.current?.getContext('2d');
    if (!g || !cells.current.length) return;
    const a = last.current ?? p;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineWidth = brush * 2;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(p.x + 0.01, p.y);
    g.stroke();
    g.restore();
    let n = 0;
    for (const c of cells.current) {
      if (!c.clean && segDist(c.x, c.y, a.x, a.y, p.x, p.y) < brush * 0.95) c.clean = true;
      if (c.clean) n++;
    }
    last.current = p;
    const k = n / cells.current.length;
    setProg(k);
    const now = performance.now();
    if (now - lastSound.current > 260) {
      lastSound.current = now;
      sfx.swoosh();
    }
    if (k >= 0.9 && !done.current) {
      done.current = true;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.current!.width, canvas.current!.height);
      g.restore();
      setProg(1);
      win();
    }
  };
  const down = (e: PE) => {
    if (over) return;
    capture(e);
    const p = rel(e, ref.current);
    last.current = null;
    setSponge(p);
    scrub(p);
  };
  const move = (e: PE) => {
    if (over || !pressed(e) || !last.current) return;
    const p = rel(e, ref.current);
    setSponge(p);
    scrub(p);
  };
  const up = () => {
    last.current = null;
    setSponge(null);
  };
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {box.w > 0 && (
        <div
          className="pointer-events-none absolute rounded-full shadow-[0_14px_0_rgba(0,0,0,0.25)]"
          style={{ left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, background: 'radial-gradient(circle, #ffffff 0 58%, #eef2ff 60% 66%, #ffffff 68% 92%, #c7d2fe 93%)' }}
        >
          <div className="absolute inset-[6%] rounded-full border-4 border-sky-300/50" />
        </div>
      )}
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      {prog >= 1 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="ms-emoji ms-pop text-8xl">✨</span>
        </div>
      )}
      {sponge && !over && (
        <span className="ms-emoji pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-6xl" style={{ left: sponge.x, top: sponge.y }}>
          🧽
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-8 bottom-[4%] h-5 overflow-hidden rounded-full border-2 border-white/80 bg-black/30">
        <div className="h-full rounded-full bg-linear-to-r from-cyan-300 to-white transition-[width] duration-100" style={{ width: `${Math.min(1, prog / 0.9) * 100}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ➡️ segui le frecce (rossa = al contrario)

const ROT = [0, 90, 180, 270]; // su, destra, giù, sinistra
const DIR_NAME = ['su', 'destra', 'giù', 'sinistra'];

export function Frecce({ seed, diff, over, win, lose }: GameProps) {
  const k = [3, 3, 4, 4, 5][diff] ?? 4;
  const seq = useMemo(() => {
    const r = rng(seed);
    let prev = -1;
    const list = Array.from({ length: k }, () => {
      let d = r.int(0, 3);
      if (d === prev) d = (d + r.int(1, 3)) % 4;
      prev = d;
      return { d, red: diff >= 2 && r.chance(0.4) };
    });
    if (diff >= 2 && !list.some((x) => x.red)) list[r.int(1, k - 1)].red = true;
    return list;
  }, [seed, diff, k]);
  const idx = useRef(0);
  const [i, setI] = useState(0);
  const [fly, setFly] = useState<{ n: number; d: number } | null>(null);
  const [wrong, setWrong] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const used = useRef(false);
  const overRef = useRef(over);
  overRef.current = over;
  const judge = (dir: number) => {
    if (overRef.current || idx.current >= k) return;
    const cur = seq[idx.current];
    const want = cur.red ? (cur.d + 2) % 4 : cur.d;
    if (dir !== want) {
      setWrong(true);
      lose(cur.red ? `Era ROSSA: dovevi andare ${DIR_NAME[want]}! 🔴` : `Dovevi andare ${DIR_NAME[want]}!`);
      return;
    }
    sfx.jump();
    setFly({ n: idx.current, d: dir });
    idx.current += 1;
    setI(idx.current);
    if (idx.current >= k) win();
  };
  const dirOf = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
  // sul computer vanno bene anche le frecce della tastiera
  useEffect(() => {
    const keys: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
    const onKey = (e: KeyboardEvent) => {
      if (e.key in keys) {
        e.preventDefault();
        judge(keys[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const down = (e: PE) => {
    capture(e);
    start.current = { x: e.clientX, y: e.clientY };
    used.current = false;
  };
  const move = (e: PE) => {
    const s = start.current;
    if (!s || used.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) > 38) {
      used.current = true;
      judge(dirOf(dx, dy));
    }
  };
  const up = (e: PE) => {
    const s = start.current;
    start.current = null;
    if (!s || used.current) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) > 20) judge(dirOf(dx, dy));
  };
  const cur = seq[Math.min(i, k - 1)];
  const arrow = (d: number, red: boolean, size: number) => (
    <svg viewBox="-50 -50 100 100" width={size} height={size} style={{ rotate: `${ROT[d]}deg` }}>
      <path d="M0 -44 L38 0 L14 0 L14 42 L-14 42 L-14 0 L-38 0 Z" fill={red ? '#ff3b4e' : '#fff'} stroke="#1a0b4d" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
  return (
    <div className="absolute inset-0" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (start.current = null)}>
      {/* la fila delle prossime */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center gap-2">
        {seq.map((s, n) => (
          <span key={n} className={`grid h-11 w-11 place-items-center rounded-xl ${n < i ? 'bg-emerald-400/80' : n === i ? 'bg-white/30 ring-2 ring-white' : 'bg-black/25'}`}>
            {arrow(s.d, s.red, 30)}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {i < k && (
          <div key={i} className={`ms-pop flex flex-col items-center ${wrong ? 'ms-shake' : ''}`}>
            {arrow(cur.d, cur.red, 210)}
            {cur.red && <p className="ms-blink mt-1 rounded-full bg-red-500 px-4 py-1 font-display text-2xl text-white">AL CONTRARIO!</p>}
          </div>
        )}
      </div>
      {fly && (
        <div key={fly.n} className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="ms-away" style={{ '--dx': `${[0, 170, 0, -170][fly.d]}px`, '--dy': `${[-170, 0, 170, 0][fly.d]}px` } as CSSProperties}>
            {arrow(seq[fly.n].d, seq[fly.n].red, 120)}
          </div>
        </div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-[4%] text-center font-display text-xl text-white/90">Scorri il dito! 👆</p>
    </div>
  );
}

// ---------------------------------------------------------------- 🍕 prendi la pizza al volo (l'ananas no!)

export function Pizza({ seed, diff, dur, clock, over, win, lose }: GameProps) {
  const need = 3;
  const plan = useMemo(() => {
    const r = rng(seed);
    const A = [0, 2, 3, 4, 5][diff] ?? 3;
    const F = [1700, 1500, 1350, 1200, 1050][diff] ?? 1300;
    const kinds = r.shuffle([...Array(5).fill('🍕'), ...Array(A).fill('🍍')] as string[]);
    const slot = (dur - 0.81 * F - 250) / kinds.length;
    let prev = { x: 0.5, t: -9999, kind: '' };
    const items = kinds.map((kind, i) => {
      const t = 100 + slot * i + r.range(0, slot * 0.5);
      let x = r.range(0.12, 0.88);
      // se arriva quasi insieme a un oggetto diverso, cade lontano (si può sempre scegliere)
      if (t - prev.t < 520 && kind !== prev.kind) x = prev.x < 0.5 ? r.range(0.64, 0.88) : r.range(0.12, 0.36);
      prev = { x, t, kind };
      return { kind, t, x, spin: r.range(-0.4, 0.4) };
    });
    return { items, F, half: ([0.15, 0.14, 0.13, 0.12, 0.11][diff] ?? 0.13) + 0.03 };
  }, [seed, diff, dur]);
  const LINE = 0.82;
  const [ref, box] = useBox();
  const boxX = useRef(0.5);
  const caught = useRef<number[]>([]);
  const lastT = useRef(clock());
  const [mood, setMood] = useState('😮');
  const [count, setCount] = useState(0);
  const yOf = (it: { t: number }, tt: number) => -0.08 + (1.16 * (tt - it.t)) / plan.F;
  const t = useFrame(clock, !over, (tt) => {
    const prev = lastT.current;
    lastT.current = tt;
    plan.items.forEach((it, i) => {
      if (caught.current.includes(i)) return;
      if (yOf(it, prev) < LINE && yOf(it, tt) >= LINE && Math.abs(it.x - boxX.current) < plan.half) {
        caught.current = [...caught.current, i];
        if (it.kind === '🍍') {
          setMood('🤢');
          sfx.bonk();
          lose('L’ananas sulla pizza?! 🤢');
          return;
        }
        const n = caught.current.filter((j) => plan.items[j].kind === '🍕').length;
        setCount(n);
        setMood('😋');
        setTimeout(() => setMood((m) => (m === '😋' ? '😮' : m)), 350);
        sfx.hit();
        if (n >= need) win();
      }
    });
  });
  const follow = (e: PE) => {
    if (over) return;
    const q = rel(e, ref.current);
    if (box.w) boxX.current = clamp(q.x / box.w, 0.08, 0.92);
  };
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={follow} onPointerMove={follow}>
      <Banner>
        🍕 {count}/{need}
      </Banner>
      {box.w > 0 &&
        plan.items.map((it, i) => {
          const y = yOf(it, t);
          if (y < -0.12 || y > 1.1 || caught.current.includes(i)) return null;
          return (
            <span
              key={i}
              className="ms-emoji pointer-events-none absolute text-[56px] drop-shadow-[0_6px_4px_rgba(0,0,0,0.3)]"
              style={{ left: it.x * box.w, top: y * box.h, transform: `translate(-50%,-50%) rotate(${(t - it.t) * it.spin}deg)` }}
            >
              {it.kind}
            </span>
          );
        })}
      {box.w > 0 && (
        <div className="pointer-events-none absolute flex flex-col items-center" style={{ left: boxX.current * box.w, top: LINE * box.h, transform: 'translate(-50%,-38%)' }}>
          <span className="ms-emoji text-[84px] drop-shadow-[0_8px_4px_rgba(0,0,0,0.3)]">{mood}</span>
          <span className="mt-1 h-3 w-24 rounded-full bg-black/25" />
        </div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-[2%] text-center font-display text-lg text-white/90">↔️ Trascina</p>
    </div>
  );
}

// ---------------------------------------------------------------- 🩴 schiva le ciabatte della nonna (si vince resistendo)

export function Schiva({ seed, diff, dur, clock, over, lose, me }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    const W = [820, 720, 640, 570, 510][diff] ?? 650;
    const F = [1100, 950, 850, 760, 680][diff] ?? 850;
    const blocked = [2, 2, 3, 3, 3][diff] ?? 3;
    const drops: { lane: number; t: number; emoji: string; spin: number }[] = [];
    let wave = 0;
    for (let t0 = 250; t0 + F * 0.85 < dur; t0 += W) {
      const lanes = r.shuffle([0, 1, 2, 3, 4]).slice(0, blocked);
      // la prima ondata colpisce il centro: chi sta fermo viene preso
      if (wave === 0 && !lanes.includes(2)) lanes[0] = 2;
      for (const lane of lanes) drops.push({ lane, t: t0 + r.range(0, 110), emoji: r.pick(CADUTE), spin: r.range(-0.5, 0.5) });
      wave++;
    }
    return { drops, F };
  }, [seed, diff, dur]);
  const LINE = 0.84;
  const [ref, box] = useBox();
  const px = useRef(0.5);
  const [hit, setHit] = useState(false);
  const yOf = (d: { t: number }, tt: number) => -0.1 + (1.2 * (tt - d.t)) / plan.F;
  const t = useFrame(clock, !over, (tt) => {
    for (const d of plan.drops) {
      const y = yOf(d, tt);
      if (y > LINE - 0.06 && y < LINE + 0.03 && Math.abs(0.1 + d.lane * 0.2 - px.current) < 0.12) {
        setHit(true);
        sfx.bonk();
        lose('Presa in pieno! 🩴');
        return;
      }
    }
  });
  const follow = (e: PE) => {
    if (over) return;
    const q = rel(e, ref.current);
    if (box.w) px.current = clamp(q.x / box.w, 0.06, 0.94);
  };
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={follow} onPointerMove={follow}>
      {/* balconi in alto */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-8 justify-around bg-black/20">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="mt-2 h-6 w-[14%] rounded-t-md border-x-4 border-t-4 border-zinc-900/50" />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] bg-zinc-500/60" />
      {box.w > 0 &&
        plan.drops.map((d, i) => {
          const y = yOf(d, t);
          if (y < -0.12 || y > 1.1) return null;
          return (
            <span
              key={i}
              className="ms-emoji pointer-events-none absolute text-[54px] drop-shadow-[0_6px_4px_rgba(0,0,0,0.35)]"
              style={{ left: (0.1 + d.lane * 0.2) * box.w, top: y * box.h, transform: `translate(-50%,-50%) rotate(${(t - d.t) * d.spin}deg)` }}
            >
              {d.emoji}
            </span>
          );
        })}
      {box.w > 0 && (
        <div className={`pointer-events-none absolute ${hit ? 'ms-shake' : ''}`} style={{ left: px.current * box.w, top: LINE * box.h, transform: 'translate(-50%,-50%)' }}>
          {me ? <Avatar avatar={me.avatar} color={me.color} size={62} /> : <span className="ms-emoji text-6xl">🏃</span>}
          {hit && <span className="ms-emoji absolute -top-7 left-1/2 -translate-x-1/2 text-4xl">💫</span>}
        </div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-[2%] text-center font-display text-lg text-white/90">↔️ Trascina per schivare</p>
    </div>
  );
}

// ---------------------------------------------------------------- 🔪 affetta la frutta con uno swipe (la bomba no!)

export function Taglia({ seed, diff, dur, clock, over, win, lose }: GameProps) {
  const need = diff >= 2 ? 4 : 3;
  const plan = useMemo(() => {
    const r = rng(seed);
    const T = [1500, 1400, 1300, 1200, 1100][diff] ?? 1300;
    const nB = [0, 1, 1, 2, 2][diff] ?? 1;
    const kinds = r.shuffle([...Array(need + 2).fill(false), ...Array(nB).fill(true)] as boolean[]);
    const span = dur - T * 0.55 - 200;
    const objs = kinds.map((bomb, i) => {
      const x0 = r.range(0.15, 0.85);
      return { bomb, emoji: bomb ? '💣' : r.pick(FRUTTI), t: 80 + (span * i) / kinds.length + r.range(0, (span / kinds.length) * 0.6), x0, vx: (0.5 - x0) * r.range(0.4, 0.9), H: r.range(0.55, 0.72), spin: r.range(-0.6, 0.6) };
    });
    return { T, objs };
  }, [seed, diff, dur, need]);
  const [ref, box] = useBox();
  const sliced = useRef<Record<number, number>>({});
  const trail = useRef<{ x: number; y: number; at: number }[]>([]);
  const prevPt = useRef<{ x: number; y: number } | null>(null);
  const [fx, addFx] = useFx();
  const [boom, setBoom] = useState(false);
  const [count, setCount] = useState(0);
  const pos = (i: number, tt: number) => {
    const o = plan.objs[i];
    const tau = (tt - o.t) / plan.T;
    if (tau < 0 || tau > 1) return null;
    return { x: (o.x0 + o.vx * tau) * box.w, y: (1.08 - 4 * o.H * tau * (1 - tau)) * box.h };
  };
  const t = useFrame(clock, !over);
  const cut = (p: { x: number; y: number }) => {
    const a = prevPt.current;
    prevPt.current = p;
    const now = clock();
    trail.current = [...trail.current.filter((q) => now - q.at < 140), { ...p, at: now }];
    if (!a || over) return;
    plan.objs.forEach((o, i) => {
      if (sliced.current[i] !== undefined) return;
      const c = pos(i, now);
      if (!c || segDist(c.x, c.y, a.x, a.y, p.x, p.y) > 36) return;
      sliced.current[i] = now;
      if (o.bomb) {
        setBoom(true);
        sfx.boom();
        lose('Hai tagliato la bomba! 💣');
        return;
      }
      sfx.swoosh();
      addFx(c.x, c.y, <span className="ms-emoji text-5xl">💦</span>);
      const n = plan.objs.filter((x, j) => !x.bomb && sliced.current[j] !== undefined).length;
      setCount(n);
      if (n >= need) win();
    });
  };
  const down = (e: PE) => {
    capture(e);
    prevPt.current = null;
    cut(rel(e, ref.current));
  };
  const move = (e: PE) => {
    if (!pressed(e)) return;
    cut(rel(e, ref.current));
  };
  const pts = trail.current.filter((q) => t - q.at < 140);
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => (prevPt.current = null)}
      onPointerCancel={() => (prevPt.current = null)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #a16207 0 46px, #854d0e 46px 50px)' }} />
      <Banner>
        🔪 {count}/{need}
      </Banner>
      {box.w > 0 &&
        plan.objs.map((o, i) => {
          const at = sliced.current[i];
          if (at !== undefined && !o.bomb) {
            // le due metà che volano via
            const dt = t - at;
            const c = pos(i, at);
            if (!c || dt > 700) return null;
            return [-1, 1].map((s) => (
              <span
                key={`${i}${s}`}
                className="ms-emoji pointer-events-none absolute text-[60px]"
                style={{
                  left: c.x + s * dt * 0.12,
                  top: c.y + dt * dt * 0.0006,
                  transform: `translate(-50%,-50%) rotate(${s * dt * 0.3}deg)`,
                  clipPath: s < 0 ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)',
                  opacity: 1 - dt / 700,
                }}
              >
                {o.emoji}
              </span>
            ));
          }
          const c = pos(i, t);
          if (!c) return null;
          return (
            <span
              key={i}
              className={`ms-emoji pointer-events-none absolute text-[60px] drop-shadow-[0_6px_4px_rgba(0,0,0,0.35)] ${o.bomb && boom ? 'ms-pulse' : ''}`}
              style={{ left: c.x, top: c.y, transform: `translate(-50%,-50%) rotate(${(t - o.t) * o.spin}deg)` }}
            >
              {o.emoji}
            </span>
          );
        })}
      {pts.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        </svg>
      )}
      {boom && <div className="ms-flash absolute inset-0 z-30 bg-white" />}
      <FxLayer list={fx} />
    </div>
  );
}

// ---------------------------------------------------------------- 🏀 fai canestro con uno swipe (il canestro si muove)

export function Canestro({ seed, diff, clock, over, win }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    return { A: [0, 0.14, 0.2, 0.25, 0.29][diff] ?? 0.2, w: [0, 0.0017, 0.0022, 0.0027, 0.0032][diff] ?? 0.002, ph: r.range(0, 6.28), rim: [0.15, 0.13, 0.12, 0.11, 0.1][diff] ?? 0.12 };
  }, [seed, diff]);
  const HOOP_Y = 0.24;
  const BALL_Y = 0.8;
  const FLIGHT = 560;
  const [ref, box] = useBox();
  const hoopX = (tt: number) => 0.5 + plan.A * Math.sin(tt * plan.w + plan.ph);
  const shot = useRef<{ at: number; x1: number; judged: boolean; ok: boolean } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useFrame(clock, !over, (tt) => {
    const s = shot.current;
    if (!s) return;
    if (!s.judged && tt >= s.at + FLIGHT) {
      s.judged = true;
      s.ok = Math.abs(s.x1 - hoopX(s.at + FLIGHT)) < plan.rim * 0.85;
      if (s.ok) {
        sfx.hit();
        setMsg('SWISH! 🔥');
        win();
      } else {
        sfx.bonk();
        setMsg('CLANG! Riprova');
      }
    }
    if (s.judged && !s.ok && tt >= s.at + FLIGHT + 450) {
      shot.current = null;
      setMsg(null);
    }
  });
  const shoot = (dx: number, dy: number) => {
    if (over || shot.current || dy > -25 || !box.w) return;
    const rise = (BALL_Y - HOOP_Y) * box.h;
    const x1 = 0.5 + (dx / -dy) * rise / box.w;
    shot.current = { at: clock(), x1, judged: false, ok: false };
    sfx.swoosh();
  };
  const down = (e: PE) => {
    capture(e);
    start.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: PE) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (dy < -70) {
      start.current = null;
      shoot(dx, dy);
    }
  };
  const up = (e: PE) => {
    const s = start.current;
    start.current = null;
    if (s) shoot(e.clientX - s.x, e.clientY - s.y);
  };
  // dove disegnare la palla
  const s = shot.current;
  let ball = { x: 0.5, y: BALL_Y, k: 1, o: 1 };
  if (s) {
    const dt = t - s.at;
    if (dt <= FLIGHT) {
      const tau = dt / FLIGHT;
      ball = { x: lerp(0.5, s.x1, tau), y: lerp(BALL_Y, HOOP_Y, tau) - 0.2 * Math.sin(Math.PI * tau), k: 1 - 0.45 * tau, o: 1 };
    } else if (s.ok) ball = { x: s.x1, y: HOOP_Y + Math.min(0.12, (dt - FLIGHT) / 2500), k: 0.55, o: 1 };
    else {
      const side = s.x1 < hoopX(s.at + FLIGHT) ? -1 : 1;
      const d = dt - FLIGHT;
      ball = { x: s.x1 + side * d * 0.0006, y: HOOP_Y + d * 0.0009 - 0.04 * Math.sin(Math.min(1, d / 200) * Math.PI), k: 0.55, o: 1 - d / 450 };
    }
  }
  const hx = hoopX(t) * box.w;
  const rimW = plan.rim * 2 * box.w;
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (start.current = null)}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-[#c2742f]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 2px, transparent 2px 40px)' }}>
        <div className="absolute left-1/2 top-[18%] h-[60%] w-[60%] -translate-x-1/2 rounded-t-full border-4 border-b-0 border-white/70" />
      </div>
      {box.w > 0 && (
        <>
          {/* tabellone e canestro */}
          <div className="pointer-events-none absolute" style={{ left: hx, top: HOOP_Y * box.h, transform: 'translate(-50%,-100%)' }}>
            <div className="relative mb-[-6px] h-[92px] rounded-lg border-4 border-white bg-white/25" style={{ width: Math.max(120, rimW * 1.5) }}>
              <div className="absolute bottom-2 left-1/2 h-9 w-14 -translate-x-1/2 border-4 border-red-500" />
            </div>
          </div>
          <span
            className="ms-emoji pointer-events-none absolute text-[64px]"
            style={{ left: ball.x * box.w, top: ball.y * box.h, opacity: ball.o, transform: `translate(-50%,-50%) scale(${ball.k}) rotate(${s ? (t - s.at) * 0.6 : 0}deg)` }}
          >
            🏀
          </span>
          {/* il ferro e la retina (davanti alla palla) */}
          <div className="pointer-events-none absolute" style={{ left: hx, top: HOOP_Y * box.h, transform: 'translate(-50%,-50%)', width: rimW }}>
            <div className="h-3 rounded-full bg-red-500 shadow-[0_3px_0_#7f1d1d]" />
            <div
              className="mx-auto h-12 w-[86%] opacity-90"
              style={{ clipPath: 'polygon(0 0, 100% 0, 82% 100%, 18% 100%)', backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, #fff 0 2px, transparent 2px 10px)' }}
            />
          </div>
        </>
      )}
      {msg && <p className="ms-pop pointer-events-none absolute inset-x-0 top-[42%] text-center font-display text-5xl text-white ms-stroke">{msg}</p>}
      {!s && <p className="pointer-events-none absolute inset-x-0 bottom-[4%] text-center font-display text-xl text-white/90">⬆️ Scorri verso l’alto per tirare</p>}
    </div>
  );
}

// ---------------------------------------------------------------- 🍝 arrotola gli spaghetti girando il dito

export function Spaghetti({ seed, diff, over, win }: GameProps) {
  const N = 3 + diff;
  const [ref, box] = useBox();
  const acc = useRef(0);
  const lastA = useRef<number | null>(null);
  const done = useRef(false);
  const [turns, setTurns] = useState(0);
  const strands = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 28 }, () => ({ a: r.range(0, 6.28), r1: r.range(0.1, 0.55), r2: r.range(0.45, 0.88), bend: r.range(-1.2, 1.2), w: r.range(4, 7) }));
  }, [seed]);
  const R = Math.min(box.w, box.h) * 0.42;
  const cx = box.w / 2;
  const cy = box.h * 0.52;
  const spin = (e: PE) => {
    if (over || done.current) return;
    const q = rel(e, ref.current);
    const dx = q.x - cx;
    const dy = q.y - cy;
    if (Math.hypot(dx, dy) < 22) {
      lastA.current = null;
      return;
    }
    const a = Math.atan2(dy, dx);
    if (lastA.current !== null) {
      let d = a - lastA.current;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      acc.current += d;
    }
    lastA.current = a;
    const k = Math.abs(acc.current) / (2 * Math.PI);
    if (Math.floor(k) > Math.floor(turns)) sfx.tap();
    setTurns(k);
    if (k >= N) {
      done.current = true;
      sfx.hit();
      win();
    }
  };
  const p = Math.min(1, turns / N);
  const left = Math.round(strands.length * (1 - p));
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onPointerDown={(e) => {
        capture(e);
        lastA.current = null;
        spin(e);
      }}
      onPointerMove={(e) => pressed(e) && spin(e)}
      onPointerUp={() => (lastA.current = null)}
    >
      <Banner>
        🍝 {Math.min(N, Math.floor(turns))}/{N} giri
      </Banner>
      {box.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <circle cx={cx} cy={cy + 10} r={R} fill="rgba(0,0,0,0.25)" />
          <circle cx={cx} cy={cy} r={R} fill="#fff" />
          <circle cx={cx} cy={cy} r={R * 0.72} fill="#f1f1f4" />
          <circle cx={cx} cy={cy} r={R * 1.06} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
          <circle
            cx={cx}
            cy={cy}
            r={R * 1.06}
            fill="none"
            stroke="#ffd02e"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * R * 1.06 * p} 9999`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {strands.slice(0, left).map((s, i) => {
            const pull = 1 - p * 0.5;
            const a1 = s.a;
            const a2 = s.a + s.bend;
            const x1 = cx + Math.cos(a1) * s.r1 * R * pull;
            const y1 = cy + Math.sin(a1) * s.r1 * R * pull;
            const x2 = cx + Math.cos(a2) * s.r2 * R * pull;
            const y2 = cy + Math.sin(a2) * s.r2 * R * pull;
            const mx = cx + Math.cos(a1 + s.bend * 0.5 + 0.6) * R * 0.6 * pull;
            const my = cy + Math.sin(a1 + s.bend * 0.5 + 0.6) * R * 0.6 * pull;
            return <path key={i} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} stroke={i % 3 ? '#f6d27a' : '#eec25a'} strokeWidth={s.w} strokeLinecap="round" fill="none" />;
          })}
          <circle cx={cx + R * 0.12} cy={cy - R * 0.08} r={R * 0.16 * (1 - p * 0.6)} fill="#d62828" opacity="0.9" />
          {/* il gomitolo sulla forchetta */}
          <circle cx={cx} cy={cy} r={R * (0.08 + 0.3 * p)} fill="#f2c94c" stroke="#d9a520" strokeWidth="4" strokeDasharray="10 6" transform={`rotate(${(acc.current * 180) / Math.PI} ${cx} ${cy})`} />
        </svg>
      )}
      {box.w > 0 && (
        <span
          className="ms-emoji pointer-events-none absolute text-[64px]"
          style={{ left: cx, top: cy, transform: `translate(-50%,-50%) rotate(${(acc.current * 180) / Math.PI}deg)` }}
        >
          🍴
        </span>
      )}
      {turns < 0.3 && <p className="pointer-events-none absolute inset-x-0 bottom-[4%] text-center font-display text-2xl text-white ms-stroke">🔄 Gira il dito in tondo!</p>}
    </div>
  );
}

// ---------------------------------------------------------------- 🧤 para il rigore

export function Rigore({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => rigorePlan(seed, diff), [seed, diff]);
  const arrive = plan.kickAt + plan.flight;
  const dive = useRef<number | null>(null);
  const [shown, setShown] = useState<{ zone: number; res: 'parata' | 'gol' | 'presto' } | null>(null);
  const [ref, box] = useBox();
  const t = useFrame(clock, !over, (tt) => {
    if (tt >= arrive && dive.current === null) {
      dive.current = -1;
      setShown({ zone: -1, res: 'gol' });
      sfx.bonk();
      lose('GOL! Sei rimasto fermo 🧍');
    }
  });
  const tap = (e: PE) => {
    if (over || dive.current !== null || !box.w) return;
    const q = rel(e, ref.current);
    const zone = q.x < box.w / 3 ? 0 : q.x < (2 * box.w) / 3 ? 1 : 2;
    const now = clock();
    dive.current = zone;
    if (now < plan.kickAt) {
      setShown({ zone, res: 'presto' });
      lose('Ti sei tuffato troppo presto! 🤡');
      return;
    }
    if (zone === plan.zone) {
      setShown({ zone, res: 'parata' });
      sfx.hit();
      win();
    } else {
      setShown({ zone, res: 'gol' });
      sfx.bonk();
      lose('GOL! Dalla parte sbagliata ⚽');
    }
  };
  // rincorsa (con la pausa della "paradinha" più avanti)
  const runStart = plan.kickAt - 900;
  let run = clamp((t - runStart) / 900, 0, 1);
  if (plan.feint && t > plan.kickAt - 480 && t < plan.kickAt - 200) run = clamp((plan.kickAt - 480 - runStart) / 900, 0, 1);
  const kicker = { x: lerp(0.3, 0.45, run), y: lerp(0.24, 0.31, run) };
  // il pallone
  const TX = [0.17, 0.5, 0.83];
  let ball = { x: 0.5, y: 0.35, k: 0.4 };
  if (t >= plan.kickAt) {
    const tau = clamp((t - plan.kickAt) / plan.flight, 0, 1);
    const saved = shown?.res === 'parata';
    const tx = TX[plan.zone];
    const xk = plan.curve ? Math.pow(tau, 2.2) : tau;
    ball = { x: lerp(0.5, tx, xk), y: lerp(0.35, 0.62, tau) - 0.08 * Math.sin(Math.PI * tau), k: lerp(0.4, saved ? 1.3 : 1.7, tau) };
  }
  const glove = shown && shown.zone >= 0 ? TX[shown.zone] : null;
  return (
    <div ref={ref} className="absolute inset-0" onPointerDown={tap}>
      {/* campo visto dalla porta */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0 40px, transparent 40px 80px)' }} />
      <div className="pointer-events-none absolute left-[12%] right-[12%] top-[22%] h-[30%] border-x-4 border-t-4 border-white/60" />
      <span className="pointer-events-none absolute left-1/2 top-[35%] h-2 w-2 -translate-x-1/2 rounded-full bg-white/80" />
      {/* pali e traversa (sei tu il portiere) */}
      <div className="pointer-events-none absolute inset-x-[2%] top-[8%] h-3 rounded-full bg-white shadow-[0_3px_0_rgba(0,0,0,0.25)]" />
      <div className="pointer-events-none absolute bottom-0 left-[2%] top-[8%] w-3 rounded-full bg-white" />
      <div className="pointer-events-none absolute bottom-0 right-[2%] top-[8%] w-3 rounded-full bg-white" />
      {/* zone dove tuffarsi */}
      <div className="pointer-events-none absolute inset-x-[3%] bottom-[3%] grid h-[30%] grid-cols-3 gap-2">
        {['⬅️', '⬆️', '➡️'].map((a, i) => (
          <div key={i} className={`grid place-items-center rounded-2xl border-4 border-dashed ${shown?.zone === i ? 'border-white bg-white/30' : 'border-white/40 bg-white/10'}`}>
            <span className="ms-emoji text-3xl opacity-80">{a}</span>
          </div>
        ))}
      </div>
      {box.w > 0 && (
        <>
          <span
            className="ms-emoji pointer-events-none absolute text-[52px]"
            style={{ left: kicker.x * box.w, top: kicker.y * box.h, transform: `translate(-50%,-100%) scaleX(-1) rotate(${t >= plan.kickAt && t < plan.kickAt + 300 ? -20 : 0}deg)` }}
          >
            🏃
          </span>
          <span className="ms-emoji pointer-events-none absolute text-[44px]" style={{ left: ball.x * box.w, top: ball.y * box.h, transform: `translate(-50%,-50%) scale(${ball.k}) rotate(${t * 0.8}deg)` }}>
            ⚽
          </span>
          {glove !== null && (
            <span
              className="ms-emoji ms-pop pointer-events-none absolute text-[90px]"
              style={{ left: glove * box.w, top: 0.62 * box.h, transform: `translate(-50%,-50%) rotate(${(shown!.zone - 1) * 35}deg)` }}
            >
              🧤
            </span>
          )}
        </>
      )}
      {shown && (
        <p className="ms-pop pointer-events-none absolute inset-x-0 top-[40%] text-center font-display text-5xl text-white ms-stroke">
          {shown.res === 'parata' ? 'PARATA! 🧤' : shown.res === 'presto' ? 'TROPPO PRESTO!' : 'GOOOL! ⚽'}
        </p>
      )}
    </div>
  );
}
