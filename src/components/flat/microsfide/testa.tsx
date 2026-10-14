// ⚡ Microsfide di testa e di occhio: pecore, intruso, sfumatura, colore dell'inchiostro, numero più grande,
// memoria lampo, calcolo, parola giusta
import { useMemo, useState } from 'react';
import { INTRUSI, STROOP_COLORI, memoriaPlan, parolaPlan, pecorePlan, rng, scatter, type Rng } from '../../../data/flat/microsfide';
import { Dots, clamp, sfx, useBox, useFrame, type GameProps } from './kit';

// ---------------------------------------------------------------- 🐑 conta le pecore che saltano lo steccato

export function Pecore({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => pecorePlan(seed, diff), [seed, diff]);
  const [picked, setPicked] = useState<number | null>(null);
  const t = useFrame(clock, !over);
  const ask = t >= plan.askAt || picked !== null;
  const choose = (n: number) => {
    if (over || picked !== null || clock() < plan.askAt) return;
    setPicked(n);
    if (n === plan.count) {
      sfx.hit();
      win();
    } else lose(`Erano ${plan.count}! 🐑`);
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* cielo, sole, prato */}
      <span className="ms-emoji pointer-events-none absolute right-[8%] top-[6%] text-6xl">☀️</span>
      <span className="ms-emoji pointer-events-none absolute left-[8%] top-[12%] text-5xl opacity-90">☁️</span>
      <div className="absolute inset-x-0 bottom-0 top-[58%] bg-linear-to-b from-emerald-400 to-emerald-700" />
      {/* steccato */}
      <div className="pointer-events-none absolute left-1/2 top-[50%] h-[14%] w-[22px] -translate-x-1/2">
        <div className="absolute left-0 top-0 h-full w-[8px] rounded-t bg-amber-800" />
        <div className="absolute right-0 top-0 h-full w-[8px] rounded-t bg-amber-800" />
        <div className="absolute -inset-x-6 top-[20%] h-[10px] rounded bg-amber-600" />
        <div className="absolute -inset-x-6 top-[58%] h-[10px] rounded bg-amber-600" />
      </div>
      {plan.animals.map((a, i) => {
        const prog = (t - a.t) / plan.cross;
        if (prog < 0 || prog > 1) return null;
        const x = 1.12 - 1.24 * prog;
        const near = (x - 0.5) / 0.14;
        const jump = Math.abs(near) < 1 ? 0.15 * (1 - near * near) : 0;
        const hop = Math.abs(Math.sin(prog * Math.PI * 7)) * 0.015;
        const y = 0.6 + a.lane * 0.035 - jump - hop;
        return (
          <span
            key={i}
            className="ms-emoji pointer-events-none absolute text-[58px] drop-shadow-[0_6px_3px_rgba(0,0,0,0.25)]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%,-100%) rotate(${jump > 0.02 ? -near * 14 : 0}deg)` }}
          >
            {a.kind}
          </span>
        );
      })}
      {!ask ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-[8%] text-center font-display text-3xl text-white ms-stroke">Conta… 🤔</p>
      ) : (
        <div className="absolute inset-x-4 bottom-[5%] grid grid-cols-2 gap-3">
          {plan.choices.map((n, i) => (
            <button
              key={n}
              type="button"
              onPointerDown={() => choose(n)}
              style={{ animationDelay: `${i * 0.05}s` }}
              className={`ms-pop h-20 rounded-3xl border-4 border-white font-display text-5xl shadow-[0_6px_0_rgba(0,0,0,0.3)] ${
                picked === n ? (n === plan.count ? 'bg-emerald-500 text-white' : 'ms-shake bg-red-500 text-white') : 'bg-white text-slate-950'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- griglia comune (intruso, sfumatura)

function useGrid(cols: number, rows: number) {
  const [ref, box] = useBox();
  const cell = Math.floor(Math.min((box.w * 0.94) / cols, (box.h * 0.84) / rows));
  return { ref, cell, ready: box.w > 0 };
}

// ---------------------------------------------------------------- 🔍 trova l'intruso tra le emoji

export function Intruso({ seed, diff, over, win, lose }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    const [a, b] = r.pick(INTRUSI);
    const swap = r.chance(0.5);
    const cols = [4, 4, 5, 5, 6][diff] ?? 5;
    const rows = cols + 1;
    return { main: swap ? b : a, odd: swap ? a : b, cols, rows, at: r.int(0, cols * rows - 1), tilt: Array.from({ length: cols * rows }, () => (diff >= 3 ? r.range(-25, 25) : 0)) };
  }, [seed, diff]);
  const { ref, cell, ready } = useGrid(plan.cols, plan.rows);
  const [wrong, setWrong] = useState<number | null>(null);
  const tap = (i: number) => {
    if (over) return;
    if (i === plan.at) {
      sfx.hit();
      win();
    } else {
      setWrong(i);
      lose('Era un altro! 🔍');
    }
  };
  return (
    <div ref={ref} className="absolute inset-0 grid place-items-center pt-6">
      {ready && (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${plan.cols}, ${cell - 4}px)` }}>
          {Array.from({ length: plan.cols * plan.rows }, (_, i) => (
            <div
              key={i}
              onPointerDown={() => tap(i)}
              className={`grid place-items-center rounded-2xl ${wrong === i ? 'ms-shake bg-red-500' : wrong !== null && i === plan.at ? 'ms-pulse bg-emerald-400' : 'bg-white/15'}`}
              style={{ width: cell - 4, height: cell - 4 }}
            >
              <span className="ms-emoji" style={{ fontSize: cell * 0.62, rotate: `${plan.tilt[i]}deg` }}>
                {i === plan.at ? plan.odd : plan.main}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 🎨 trova la casella di colore diverso

export function Sfumatura({ seed, diff, over, win, lose }: GameProps) {
  const plan = useMemo(() => {
    const r = rng(seed);
    const cols = 3 + diff;
    const rows = cols + 1;
    const hue = r.int(0, 359);
    const light = r.int(42, 58);
    const delta = ([17, 13, 10, 8, 6.5][diff] ?? 9) * (r.chance(0.5) ? 1 : -1);
    return { cols, rows, base: `hsl(${hue} 75% ${light}%)`, odd: `hsl(${hue} 75% ${light + delta}%)`, at: r.int(0, cols * rows - 1) };
  }, [seed, diff]);
  const { ref, cell, ready } = useGrid(plan.cols, plan.rows);
  const [wrong, setWrong] = useState<number | null>(null);
  const tap = (i: number) => {
    if (over) return;
    if (i === plan.at) {
      sfx.hit();
      win();
    } else {
      setWrong(i);
      lose('Non era quella! 👀');
    }
  };
  return (
    <div ref={ref} className="absolute inset-0 grid place-items-center pt-6">
      {ready && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${plan.cols}, ${cell - 6}px)` }}>
          {Array.from({ length: plan.cols * plan.rows }, (_, i) => (
            <div
              key={i}
              onPointerDown={() => tap(i)}
              className={`rounded-xl shadow-[inset_0_-4px_0_rgba(0,0,0,0.15)] ${wrong === i ? 'ms-shake ring-4 ring-red-400' : ''} ${
                wrong !== null && i === plan.at ? 'ms-pulse ring-4 ring-white' : ''
              }`}
              style={{ width: cell - 6, height: cell - 6, background: i === plan.at ? plan.odd : plan.base }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 🖍️ di che colore è l'inchiostro? (Stroop)

const C = STROOP_COLORI;

export function Stroop({ seed, diff, over, win, lose }: GameProps) {
  const R = diff >= 3 ? 4 : 3;
  const rounds = useMemo(() => {
    const r = rng(seed);
    const all = C.map((_, i) => i);
    return Array.from({ length: R }, () => {
      const word = r.int(0, C.length - 1);
      let ink = r.int(0, C.length - 1);
      // quasi sempre parola e inchiostro diversi (ogni tanto uguali, per non dare punti di riferimento)
      if (!r.chance(0.18)) while (ink === word) ink = r.int(0, C.length - 1);
      const others = r.shuffle(all.filter((i) => i !== ink && i !== word)).slice(0, word === ink ? 3 : 2);
      const opts = r.shuffle([ink, ...(word === ink ? [] : [word]), ...others]);
      const optInk = opts.map((o) => (diff >= 1 ? r.pick(all.filter((i) => i !== o)) : -1));
      return { word, ink, opts, optInk };
    });
  }, [seed, diff, R]);
  const [k, setK] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const cur = rounds[Math.min(k, R - 1)];
  const tap = (o: number) => {
    if (over || k >= R) return;
    if (o !== cur.ink) {
      setWrong(o);
      lose(`L’inchiostro era ${C[cur.ink].name}`);
      return;
    }
    sfx.hit();
    setK(k + 1);
    if (k + 1 >= R) win();
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 pt-4">
      <Dots done={k} total={R} />
      <p className="pointer-events-none text-center text-sm font-black uppercase tracking-widest text-white/70">Il colore dell’inchiostro!</p>
      <div key={k} className="ms-pop grid h-40 w-full place-items-center rounded-3xl border-4 border-white/80 bg-[#170b40] shadow-[0_8px_0_rgba(0,0,0,0.35)]">
        <span className="font-display text-7xl tracking-wide" style={{ color: C[cur.ink].hex }}>
          {C[cur.word].name}
        </span>
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        {cur.opts.map((o, i) => (
          <button
            key={`${k}-${o}`}
            type="button"
            onPointerDown={() => tap(o)}
            className={`h-20 rounded-3xl border-4 font-display text-3xl shadow-[0_6px_0_rgba(0,0,0,0.35)] ${
              wrong === o ? 'ms-shake border-red-400 bg-red-950' : wrong !== null && o === cur.ink ? 'ms-pulse border-emerald-300 bg-emerald-900' : 'border-white/70 bg-[#241255]'
            }`}
            style={{ color: cur.optInk[i] >= 0 ? C[cur.optInk[i]].hex : '#fff' }}
          >
            {C[o].name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 🔢 tocca il numero più grande (2 volte)

const VIVACI = ['#fff', '#ffd21f', '#7dd3fc', '#86efac', '#fda4af', '#c4b5fd'];

function numeri(r: Rng, diff: number, k: number): number[] {
  const set = new Set<number>();
  if (diff >= 4) {
    // le stesse tre cifre rimescolate (869, 896, 698…) più qualche vicino
    const d = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) set.add(d[a] * 100 + d[b] * 10 + d[c]);
    const perms = [...set];
    while (set.size < k) set.add(r.pick(perms) + r.pick([-2, -1, 1, 2, 9, -9]));
  } else if (diff === 3) {
    const base = r.int(25, 85);
    while (set.size < k) set.add(base + r.int(-9, 9));
  } else {
    const [lo, hi] = diff === 0 ? [1, 60] : diff === 1 ? [10, 99] : [100, 999];
    while (set.size < k) set.add(r.int(lo, hi));
  }
  return r.shuffle([...set]).slice(0, k);
}

export function Maggiore({ seed, diff, over, win, lose }: GameProps) {
  const R = 2;
  const k = 4 + diff;
  const rounds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: R }, () => {
      const vals = numeri(r, diff, k);
      const sorted = [...vals].sort((a, b) => a - b);
      const pts = scatter(r, k, diff >= 2 ? 2 : 3, 4, 0.12, 0.15); // i numeri lunghi stanno su due colonne
      return vals.map((v, i) => {
        // trucco: i numeri piccoli scritti più grossi
        const rank = sorted.indexOf(v) / Math.max(1, k - 1);
        const size = diff === 0 ? r.range(34, 50) : 56 - rank * 24 + r.range(-3, 3);
        return { v, ...pts[i], size, color: r.pick(VIVACI), tilt: r.range(-12, 12) };
      });
    });
  }, [seed, diff, k]);
  const [round, setRound] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const cur = rounds[Math.min(round, R - 1)];
  const max = Math.max(...cur.map((c) => c.v));
  const tap = (v: number) => {
    if (over || round >= R) return;
    if (v !== max) {
      setWrong(v);
      lose(`Il più grande era ${max}`);
      return;
    }
    sfx.hit();
    setRound(round + 1);
    if (round + 1 >= R) win();
  };
  return (
    <div className="absolute inset-0">
      <Dots done={round} total={R} className="absolute inset-x-0 top-3" />
      <div key={round} className="absolute inset-0">
        {cur.map((c) => (
          <div
            key={c.v}
            onPointerDown={() => tap(c.v)}
            className={`ms-pop absolute grid min-h-[76px] min-w-[96px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl px-2 ${
              wrong === c.v ? 'ms-shake bg-red-500/80' : wrong !== null && c.v === max ? 'ms-pulse bg-emerald-500/80' : 'bg-black/20'
            }`}
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
          >
            <span className="font-display leading-none ms-stroke" style={{ fontSize: c.size, color: c.color, rotate: `${c.tilt}deg` }}>
              {c.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 🧠 memoria lampo

export function Memoria({ seed, diff, clock, over, win, lose }: GameProps) {
  const plan = useMemo(() => memoriaPlan(seed, diff), [seed, diff]);
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const t = useFrame(clock, !over && clock() < plan.showMs + 50);
  const showing = !over && clock() < plan.showMs;
  const tap = (e: string) => {
    if (over || clock() < plan.showMs || found.includes(e)) return;
    if (!plan.show.includes(e)) {
      setWrong(e);
      lose('Quello non c’era! 🙈');
      return;
    }
    sfx.hit();
    const f = [...found, e];
    setFound(f);
    if (f.length >= plan.k) win();
  };
  if (showing)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-4">
        <p className="font-display text-3xl text-white ms-stroke">Memorizza! 👀</p>
        <div className="flex flex-wrap justify-center gap-3">
          {plan.show.map((e, i) => (
            <span key={e} className="ms-pop grid h-24 w-24 place-items-center rounded-3xl bg-white shadow-[0_6px_0_rgba(0,0,0,0.3)]" style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="ms-emoji text-6xl">{e}</span>
            </span>
          ))}
        </div>
        <div className="h-3 w-2/3 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-white" style={{ width: `${clamp(1 - t / plan.showMs, 0, 1) * 100}%` }} />
        </div>
      </div>
    );
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
      <p className="font-display text-2xl text-white ms-stroke">
        Quali c’erano? {found.length}/{plan.k}
      </p>
      <div className="grid w-full max-w-[360px] grid-cols-3 gap-3">
        {plan.options.map((e, i) => {
          const ok = found.includes(e);
          const reveal = wrong !== null && plan.show.includes(e) && !ok;
          return (
            <div
              key={e}
              onPointerDown={() => tap(e)}
              style={{ animationDelay: `${i * 0.03}s` }}
              className={`ms-pop grid aspect-square place-items-center rounded-3xl shadow-[0_6px_0_rgba(0,0,0,0.3)] ${
                ok ? 'bg-emerald-400' : wrong === e ? 'ms-shake bg-red-500' : reveal ? 'ms-pulse bg-amber-300' : 'bg-white'
              }`}
            >
              <span className="ms-emoji text-5xl">{e}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ➗ calcolo lampo (2 conti)

function conto(r: Rng, diff: number): { text: string; ans: number } {
  if (diff <= 0) {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return { text: `${a} + ${b}`, ans: a + b };
  }
  if (diff === 1) {
    if (r.chance(0.5)) {
      const a = r.int(11, 29);
      const b = r.int(3, 9);
      return { text: `${a} + ${b}`, ans: a + b };
    }
    const a = r.int(12, 30);
    const b = r.int(3, 9);
    return { text: `${a} − ${b}`, ans: a - b };
  }
  if (diff === 2) {
    const a = r.int(3, 9);
    const b = r.int(3, 9);
    return { text: `${a} × ${b}`, ans: a * b };
  }
  if (diff === 3) {
    const a = r.int(3, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    return r.chance(0.5) ? { text: `${a} × ${b} + ${c}`, ans: a * b + c } : { text: `${a} × ${b} − ${c}`, ans: a * b - c };
  }
  if (r.chance(0.5)) {
    const a = r.int(15, 69);
    const b = r.int(15, 69);
    return { text: `${a} + ${b}`, ans: a + b };
  }
  const a = r.int(12, 19);
  const b = r.int(3, 6);
  return { text: `${a} × ${b}`, ans: a * b };
}

export function Calcolo({ seed, diff, over, win, lose }: GameProps) {
  const R = 2;
  const rounds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: R }, () => {
      const c = conto(r, diff);
      const near = [c.ans + 1, c.ans - 1, c.ans + 2, c.ans - 2, c.ans + 10, c.ans - 10, c.ans + 3].filter((x) => x >= 0 && x !== c.ans);
      const wrongs = r.shuffle([...new Set(near)]).slice(0, 3);
      return { ...c, opts: r.shuffle([c.ans, ...wrongs]) };
    });
  }, [seed, diff]);
  const [k, setK] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const cur = rounds[Math.min(k, R - 1)];
  const tap = (v: number) => {
    if (over || k >= R) return;
    if (v !== cur.ans) {
      setWrong(v);
      lose(`${cur.text} = ${cur.ans}`);
      return;
    }
    sfx.hit();
    setK(k + 1);
    if (k + 1 >= R) win();
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-4">
      <Dots done={k} total={R} />
      <div key={k} className="ms-pop w-full rounded-3xl border-4 border-white/80 bg-[#fdf6e3] px-3 py-6 text-center shadow-[0_8px_0_rgba(0,0,0,0.35)]">
        <p className="font-display text-6xl leading-none text-slate-950">{cur.text}</p>
        <p className="mt-2 font-display text-3xl text-slate-950/40">= ?</p>
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        {cur.opts.map((v) => (
          <button
            key={`${k}-${v}`}
            type="button"
            onPointerDown={() => tap(v)}
            className={`h-20 rounded-3xl border-4 border-white font-display text-5xl text-white shadow-[0_6px_0_rgba(0,0,0,0.35)] ${
              wrong === v ? 'ms-shake bg-red-500' : wrong !== null && v === cur.ans ? 'ms-pulse bg-emerald-500' : 'bg-emerald-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 🔤 trova la parola giusta tra quelle quasi uguali

export function Parola({ seed, diff, over, win, lose }: GameProps) {
  const plan = useMemo(() => parolaPlan(seed, diff), [seed, diff]);
  const [wrong, setWrong] = useState<string | null>(null);
  const long = Math.max(...plan.words.map((w) => w.length)) > 9;
  const tap = (w: string) => {
    if (over) return;
    if (w === plan.target) {
      sfx.hit();
      win();
    } else {
      setWrong(w);
      lose(`Hai toccato «${w}»`);
    }
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-3">
      <span className="pointer-events-none rounded-full bg-black/55 px-5 py-2 font-display text-3xl text-white shadow-[0_4px_0_rgba(0,0,0,0.3)]">
        Trova: <span className="text-amber-300">{plan.target}</span>
      </span>
      <div className="grid w-full grid-cols-2 gap-2.5">
        {plan.words.map((w, i) => (
          <div
            key={w}
            onPointerDown={() => tap(w)}
            style={{ animationDelay: `${i * 0.025}s` }}
            className={`ms-pop grid h-16 place-items-center rounded-2xl border-4 font-display tracking-wide shadow-[0_5px_0_rgba(0,0,0,0.25)] ${long ? 'text-xl' : 'text-2xl'} ${
              wrong === w ? 'ms-shake border-red-300 bg-red-500 text-white' : wrong !== null && w === plan.target ? 'ms-pulse border-emerald-200 bg-emerald-500 text-white' : 'border-white bg-white/90 text-slate-950'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}
