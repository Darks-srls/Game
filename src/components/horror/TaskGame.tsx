// I lavori di "Non lasciarmi solo" sono piccoli giochi veri, non pulsanti da tenere premuti:
// svitare un tappo, strofinare un filtro, tenere la lancetta nel verde, collegare i cavi, inserire un codice.
// Il pannello resta sopra al mondo (si vede cosa succede intorno) e si chiude con E, Esc o la X.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

export type TaskSfx = 'tick' | 'scrub' | 'click' | 'spark' | 'ok' | 'ko' | 'squeak' | 'hiss';
export type TaskSpec =
  | { kind: 'gira'; st: string; title: string; hint: string; dir: 1 | -1; turns: number; look: 'tappo' | 'valvola' }
  | { kind: 'strofina'; st: string; title: string; hint: string }
  | { kind: 'pressione'; st: string; title: string; hint: string; wide: boolean }
  | { kind: 'cavi'; st: string; title: string; hint: string }
  | { kind: 'inserisci'; st: string; title: string; hint: string }
  | { kind: 'quadrante'; st: string; title: string; hint: string }
  | { kind: 'tastierino'; st: string; title: string; hint: string; show: string; done: boolean }
  | { kind: 'lucchetto'; st: string; title: string; hint: string }
  | { kind: 'conta'; st: string; title: string; hint: string; n: number };

interface Props {
  spec: TaskSpec;
  start: number; // avanzamento già fatto (dal server)
  onProgress: (p: number) => void;
  onSubmit: (value: string) => void;
  onFail: () => void;
  onSay?: () => void;
  onClose: () => void;
  sfx: (what: TaskSfx) => void;
}

const card = 'pointer-events-auto w-[min(92vw,420px)] rounded-2xl border border-white/15 bg-[#0b0f14]/90 p-4 text-white shadow-2xl backdrop-blur';

export function TaskGame(props: Props) {
  const { spec, onClose } = props;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(18px,env(safe-area-inset-bottom))] z-20 flex justify-center px-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className={card}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-amber-200/80">Lavoro</p>
            <p className="text-base font-semibold leading-tight">{spec.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-white/65">{spec.hint}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/5 text-sm" aria-label="Chiudi">
            ✕
          </button>
        </div>
        {spec.kind === 'gira' && <Gira {...props} spec={spec} />}
        {spec.kind === 'strofina' && <Strofina {...props} />}
        {spec.kind === 'pressione' && <Pressione {...props} spec={spec} />}
        {spec.kind === 'cavi' && <Cavi {...props} />}
        {spec.kind === 'inserisci' && <Inserisci {...props} />}
        {spec.kind === 'quadrante' && <Quadrante {...props} />}
        {spec.kind === 'tastierino' && <Tastierino {...props} spec={spec} />}
        {spec.kind === 'lucchetto' && <Lucchetto {...props} />}
        {spec.kind === 'conta' && <Conta {...props} spec={spec} />}
        <p className="mt-2 text-center text-[10px] text-white/40">E o Esc per chiudere · intanto sei fermo: guardati intorno</p>
      </div>
    </div>
  );
}

function Bar({ p, tone = 'amber' }: { p: number; tone?: 'amber' | 'green' }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone === 'green' ? 'bg-emerald-400' : 'bg-amber-300'} transition-[width] duration-150`} style={{ width: `${Math.round(p * 100)}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- girare (tappo del filtro, valvola)
function Gira({ spec, start, onProgress, sfx }: Props & { spec: Extract<TaskSpec, { kind: 'gira' }> }) {
  const need = spec.turns * Math.PI * 2;
  const [acc, setAcc] = useState(start * need);
  const accRef = useRef(acc);
  const last = useRef<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const tickAt = useRef(0);
  const add = (d: number) => {
    // conta solo nel verso giusto (all'indietro non si perde, ma non si avanza)
    const v = Math.max(0, Math.min(need, accRef.current + d * spec.dir));
    if (Math.floor(v / 0.6) !== Math.floor(accRef.current / 0.6) && Date.now() > tickAt.current) {
      tickAt.current = Date.now() + 70;
      sfx(spec.look === 'valvola' ? 'squeak' : 'tick');
    }
    accRef.current = v;
    setAcc(v);
    onProgress(v / need);
  };
  const angleOf = (e: RPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  useEffect(() => {
    // da tastiera: frecce o A/D
    const held = new Set<string>();
    const dn = (e: KeyboardEvent) => held.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    let raf = 0;
    let t0 = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      const r = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
      if (r) add(r * dt * 4.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const rot = (acc * spec.dir * 180) / Math.PI;
  const p = acc / need;
  return (
    <div>
      <svg
        ref={box}
        viewBox="0 0 240 240"
        className="mx-auto block h-52 w-52 touch-none select-none"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          last.current = angleOf(e);
        }}
        onPointerMove={(e) => {
          if (last.current === null) return;
          const a = angleOf(e);
          let d = a - last.current;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          last.current = a;
          add(d);
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      >
        <circle cx="120" cy="120" r="112" fill="#11161c" stroke="#2a3440" strokeWidth="2" />
        <g transform={`rotate(${rot} 120 120)`}>
          {spec.look === 'valvola' ? (
            <>
              <circle cx="120" cy="120" r="84" fill="none" stroke="#b8322a" strokeWidth="16" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <line key={a} x1="120" y1="120" x2={120 + Math.cos((a * Math.PI) / 180) * 84} y2={120 + Math.sin((a * Math.PI) / 180) * 84} stroke="#8f2620" strokeWidth="10" />
              ))}
              <circle cx="120" cy="120" r="18" fill="#6f7a74" />
              <circle cx={120 + 84} cy="120" r="12" fill="#e9e2d0" />
            </>
          ) : (
            <>
              <circle cx="120" cy="120" r="80" fill="#2f5d8a" stroke="#1d3c5a" strokeWidth="6" />
              {Array.from({ length: 16 }, (_, i) => (
                <rect key={i} x="116" y="34" width="8" height="18" rx="3" fill="#1d3c5a" transform={`rotate(${i * 22.5} 120 120)`} />
              ))}
              <rect x="70" y="112" width="100" height="16" rx="8" fill="#8fa3b5" />
              <circle cx="120" cy="120" r="10" fill="#d5dde4" />
            </>
          )}
        </g>
        <path d={spec.dir < 0 ? 'M 205 70 A 100 100 0 0 0 120 18' : 'M 35 70 A 100 100 0 0 1 120 18'} fill="none" stroke="#ffd27a" strokeWidth="3" strokeDasharray="6 6" />
        <text x="120" y="232" textAnchor="middle" fill="#ffd27a" fontSize="13">
          {spec.dir < 0 ? '⟲ gira in senso antiorario' : '⟳ gira in senso orario'}
        </text>
      </svg>
      <p className="text-center text-[11px] text-white/55">Trascina in cerchio (o tieni premuto A / D)</p>
      <Bar p={p} />
    </div>
  );
}

// ---------------------------------------------------------------- strofinare (il filtro intasato)
function Strofina({ start, onProgress, sfx }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const scrubAt = useRef(0);
  const [p, setP] = useState(start);
  const base = useRef(1);
  useEffect(() => {
    const c = cv.current!.getContext('2d')!;
    const W = cv.current!.width;
    const H = cv.current!.height;
    // melma: tante macchie scure sovrapposte (meno se era già stato pulito in parte)
    const n = Math.round(260 * (1 - start * 0.8));
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 14 + Math.random() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const col = Math.random() < 0.5 ? '62,46,24' : '48,40,22';
      g.addColorStop(0, `rgba(${col},0.75)`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    base.current = Math.max(0.0001, coverage(c, W, H));
  }, []);
  const coverage = (c: CanvasRenderingContext2D, W: number, H: number) => {
    const d = c.getImageData(0, 0, W, H).data;
    let k = 0;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 9) {
      n++;
      if (d[i] > 95) k++;
    }
    return k / n;
  };
  const rub = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!down.current) return;
    const el = cv.current!;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * el.width;
    const y = ((e.clientY - r.top) / r.height) * el.height;
    const c = el.getContext('2d')!;
    c.globalCompositeOperation = 'destination-out';
    const from = last.current ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 8));
    for (let i = 1; i <= steps; i++) {
      const px = from.x + ((x - from.x) * i) / steps;
      const py = from.y + ((y - from.y) * i) / steps;
      const g = c.createRadialGradient(px, py, 0, px, py, 26);
      g.addColorStop(0, 'rgba(0,0,0,0.7)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(px - 26, py - 26, 52, 52);
    }
    c.globalCompositeOperation = 'source-over';
    last.current = { x, y };
    if (Date.now() > scrubAt.current) {
      scrubAt.current = Date.now() + 140;
      sfx('scrub');
      measure();
    }
  };
  const pRef = useRef(start);
  const measure = () => {
    const el = cv.current!;
    const c = el.getContext('2d')!;
    const left = coverage(c, el.width, el.height) / base.current;
    const pp = left < 0.12 ? 1 : Math.max(pRef.current, (1 - left) * (1 - start) + start);
    if (pp >= 1) c.clearRect(0, 0, el.width, el.height);
    pRef.current = pp;
    setP(pp);
    onProgress(pp);
  };
  return (
    <div>
      <div className="relative mx-auto h-40 w-full max-w-[340px] overflow-hidden rounded-xl border border-white/15" style={{ background: 'repeating-linear-gradient(90deg,#c9c3b2 0 6px,#a9a392 6px 9px), #bbb' }}>
        <canvas
          ref={cv}
          width={340}
          height={160}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(e) => {
            down.current = true;
            last.current = null;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            rub(e);
          }}
          onPointerMove={rub}
          onPointerUp={() => {
            down.current = false;
            measure();
          }}
          onPointerCancel={() => (down.current = false)}
        />
      </div>
      <p className="mt-1 text-center text-[11px] text-white/55">Strofina avanti e indietro tenendo premuto</p>
      <Bar p={p} />
    </div>
  );
}

// ---------------------------------------------------------------- pressione (riavvio della pompa)
function Pressione({ spec, start, onProgress, onFail, sfx }: Props & { spec: Extract<TaskSpec, { kind: 'pressione' }> }) {
  const [v, setV] = useState(0.15);
  const [p, setP] = useState(start);
  const [danger, setDanger] = useState(0);
  const pumping = useRef(false);
  const st = useRef({ v: 0.15, p: start, red: 0, gust: 0, gustAt: 0, hissAt: 0 });
  const lo = spec.wide ? 0.46 : 0.55;
  const hi = spec.wide ? 0.82 : 0.74;
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'w') pumping.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'w') pumping.current = false;
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    let raf = 0;
    let t0 = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      const s = st.current;
      // la pompa vecchia ha i suoi capricci: ogni tanto un colpo di pressione
      if (t > s.gustAt) {
        s.gustAt = t + 1600 + Math.random() * 2400;
        s.gust = (Math.random() - 0.35) * 0.5;
      }
      s.gust *= 1 - dt * 1.4;
      s.v += ((pumping.current ? 0.42 : -0.3) + s.gust) * dt;
      s.v = Math.max(0, Math.min(1, s.v));
      if (s.v >= lo && s.v <= hi) s.p = Math.min(1, s.p + dt / 9);
      if (s.v > 0.9) {
        s.red += dt;
        if (t > s.hissAt) {
          s.hissAt = t + 500;
          sfx('hiss');
        }
        if (s.red > 0.7) {
          s.red = 0;
          s.v = 0.2;
          s.p = Math.max(0, s.p - 0.35);
          onFail();
        }
      } else s.red = Math.max(0, s.red - dt * 0.5);
      setV(s.v);
      setP(s.p);
      setDanger(s.red);
      onProgress(s.p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);
  // quadrante a semicerchio: 0 a sinistra, 1 a destra passando dall'alto
  const pt = (u: number, r = 90) => [120 + Math.cos(Math.PI + u * Math.PI) * r, 120 + Math.sin(Math.PI + u * Math.PI) * r];
  const arc = (u0: number, u1: number) => {
    const [x0, y0] = pt(u0);
    const [x1, y1] = pt(u1);
    return `M ${x0} ${y0} A 90 90 0 0 1 ${x1} ${y1}`;
  };
  const [nx, ny] = pt(v, 84);
  return (
    <div>
      <svg viewBox="0 0 240 140" className="mx-auto block h-36 w-64">
        <path d={arc(0, 1)} fill="none" stroke="#26303a" strokeWidth="18" />
        <path d={arc(lo, hi)} fill="none" stroke="#34c759" strokeWidth="18" />
        <path d={arc(0.9, 1)} fill="none" stroke="#ff3b30" strokeWidth="18" />
        <line x1="120" y1="120" x2={nx} y2={ny} stroke={danger > 0.05 ? '#ff6b5e' : '#f2f2f2'} strokeWidth="4" strokeLinecap="round" />
        <circle cx="120" cy="120" r="9" fill="#9aa6b1" />
      </svg>
      <button
        type="button"
        className={`mx-auto mt-1 block w-full max-w-[260px] select-none rounded-xl border px-4 py-3 text-sm font-bold tracking-wide ${pumping.current ? 'border-amber-200 bg-amber-300/30' : 'border-white/25 bg-white/10'}`}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pumping.current = true;
        }}
        onPointerUp={() => (pumping.current = false)}
        onPointerCancel={() => (pumping.current = false)}
      >
        TIENI PREMUTO PER DARE PRESSIONE (spazio)
      </button>
      <p className="mt-1 text-center text-[11px] text-white/55">{spec.wide ? 'Il compagno al livello ti guida: zona verde più ampia' : 'Tieni la lancetta nel verde. Nel rosso la pompa va in sovrapressione (rumore e danni)'}</p>
      <Bar p={p} tone="green" />
    </div>
  );
}

// ---------------------------------------------------------------- cavi (batteria di emergenza)
const WIRES = ['#e5483b', '#3a86ff', '#f4c430', '#34c759'];
function Cavi({ onProgress, sfx }: Props) {
  const order = useMemo(() => [0, 1, 2, 3].sort(() => Math.random() - 0.5), []);
  const [done, setDone] = useState<number[]>([]);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const yOf = (i: number) => 22 + i * 38;
  const local = (e: RPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 170 };
  };
  return (
    <div>
      <div
        ref={box}
        className="relative mx-auto h-[170px] w-full max-w-[300px] touch-none select-none rounded-xl border border-white/15 bg-[#1b2026]"
        onPointerMove={(e) => drag && setDrag({ ...drag, ...local(e) })}
        onPointerUp={(e) => {
          if (!drag) return;
          const { x, y } = local(e);
          const j = order.findIndex((_, k) => Math.abs(y - yOf(k)) < 18);
          if (x > 230 && j >= 0) {
            if (order[j] === drag.i) {
              const nd = [...done, drag.i];
              setDone(nd);
              sfx('spark');
              onProgress(nd.length / 4);
            } else sfx('ko');
          }
          setDrag(null);
        }}
      >
        <svg viewBox="0 0 300 170" className="absolute inset-0 h-full w-full">
          {done.map((i) => (
            <line key={i} x1="34" y1={yOf(i)} x2="266" y2={yOf(order.indexOf(i))} stroke={WIRES[i]} strokeWidth="8" strokeLinecap="round" />
          ))}
          {drag && <line x1="34" y1={yOf(drag.i)} x2={drag.x} y2={drag.y} stroke={WIRES[drag.i]} strokeWidth="8" strokeLinecap="round" />}
          {WIRES.map((c, i) => (
            <g key={i}>
              <rect x="6" y={yOf(i) - 9} width="28" height="18" rx="4" fill={c} />
              <rect x="266" y={yOf(order.indexOf(i)) - 9} width="28" height="18" rx="4" fill="#0e1114" stroke={c} strokeWidth="3" />
            </g>
          ))}
        </svg>
        {WIRES.map((_, i) =>
          done.includes(i) ? null : (
            <div
              key={i}
              className="absolute left-0 h-9 w-14 cursor-grab"
              style={{ top: `${((yOf(i) - 18) / 170) * 100}%` }}
              onPointerDown={(e) => {
                (e.currentTarget.parentElement as Element).setPointerCapture?.(e.pointerId);
                sfx('click');
                setDrag({ i, ...local(e) });
              }}
            />
          ),
        )}
      </div>
      <p className="mt-1 text-center text-[11px] text-white/55">Trascina ogni cavo sul morsetto dello stesso colore</p>
      <Bar p={done.length / 4} />
    </div>
  );
}

// ---------------------------------------------------------------- inserire il modulo nel quadro
function Inserisci({ onProgress, sfx }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ok, setOk] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const local = (e: RPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return (
    <div
      ref={box}
      className="relative mx-auto h-40 w-full max-w-[320px] touch-none select-none rounded-xl border border-white/15 bg-[#b9bdb6]"
      onPointerMove={(e) => pos && setPos(local(e))}
      onPointerUp={(e) => {
        if (!pos) return;
        const r = box.current!.getBoundingClientRect();
        const p = local(e);
        if (p.x > r.width * 0.55 && Math.abs(p.y - r.height / 2) < 40) {
          setOk(true);
          sfx('click');
          onProgress(1);
        }
        setPos(null);
      }}
    >
      <div className="absolute right-[12%] top-1/2 h-16 w-24 -translate-y-1/2 rounded-md border-4 border-[#3a3d40] bg-[#222]">{ok && <div className="h-full w-full rounded-sm bg-[#1f6b3a]" />}</div>
      {!ok && (
        <div
          className="absolute h-14 w-20 cursor-grab rounded-md border border-[#0c3a1e] bg-[#1f6b3a] shadow-lg"
          style={pos ? { left: pos.x - 40, top: pos.y - 28 } : { left: '10%', top: 'calc(50% - 28px)' }}
          onPointerDown={(e) => {
            (e.currentTarget.parentElement as Element).setPointerCapture?.(e.pointerId);
            setPos(local(e));
          }}
        >
          <div className="m-2 h-2 rounded bg-[#d4af37]" />
          <div className="mx-2 h-2 rounded bg-[#d4af37]" />
        </div>
      )}
      <p className="absolute inset-x-0 bottom-1 text-center text-[11px] text-[#2a2a2a]">Trascina il modulo nell’alloggiamento</p>
    </div>
  );
}

// ---------------------------------------------------------------- quadrante (numero dei lampeggi)
function Quadrante({ onSubmit, sfx }: Props) {
  const [n, setN] = useState(1);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) setN(Number(e.key));
      if (e.key === 'Enter') onSubmit(String(nRef.current));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const nRef = useRef(n);
  nRef.current = n;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <button type="button" className="h-12 w-12 rounded-full border border-white/25 bg-white/10 text-2xl" onClick={() => (sfx('tick'), setN((x) => Math.max(1, x - 1)))}>
          −
        </button>
        <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#3a3d40] bg-[#14181c] text-4xl font-bold tabular-nums text-amber-200">{n}</div>
        <button type="button" className="h-12 w-12 rounded-full border border-white/25 bg-white/10 text-2xl" onClick={() => (sfx('tick'), setN((x) => Math.min(9, x + 1)))}>
          +
        </button>
      </div>
      <button type="button" className="w-full max-w-[240px] rounded-xl bg-amber-300 px-4 py-2.5 font-bold text-black" onClick={() => onSubmit(String(n))}>
        Conferma {n} lampeggi
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- tastierino (collaudo)
function Tastierino({ spec, onSubmit, onSay, sfx }: Props & { spec: Extract<TaskSpec, { kind: 'tastierino' }> }) {
  const [code, setCode] = useState('');
  const codeRef = useRef(code);
  codeRef.current = code;
  const press = (k: string) => {
    sfx('tick');
    if (k === '⌫') setCode((c) => c.slice(0, -1));
    else if (k === 'OK') {
      if (codeRef.current.length === 4) onSubmit(codeRef.current);
      setCode('');
    } else setCode((c) => (c.length < 4 ? c + k : c));
  };
  useEffect(() => {
    if (spec.done) return;
    const k = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') press('⌫');
      if (e.key === 'Enter') press('OK');
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [spec.done]);
  return (
    <div>
      <div className="mb-3 rounded-lg border border-emerald-400/30 bg-[#06140c] px-3 py-2 text-center">
        <p className="text-[10px] uppercase tracking-widest text-emerald-300/70">Codice per l’altra postazione</p>
        <p className="font-mono text-2xl font-bold tracking-[0.4em] text-emerald-300">{spec.show}</p>
        {onSay && (
          <button type="button" className="mt-1 text-[11px] text-emerald-200/80 underline" onClick={onSay}>
            Scrivilo alla squadra (se non avete il microfono)
          </button>
        )}
      </div>
      {spec.done ? (
        <p className="text-center text-sm text-emerald-200">Questa postazione è pronta: ora serve l’altra.</p>
      ) : (
        <>
          <div className="mx-auto mb-2 flex w-44 justify-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid h-11 w-9 place-items-center rounded-md border border-white/20 bg-black/50 font-mono text-xl">
                {code[i] ?? ''}
              </div>
            ))}
          </div>
          <div className="mx-auto grid w-52 grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((k) => (
              <button key={k} type="button" onClick={() => press(k)} className={`h-10 rounded-lg border text-lg font-semibold ${k === 'OK' ? 'border-amber-200 bg-amber-300 text-black' : 'border-white/15 bg-white/10'}`}>
                {k}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- lucchetto (liberare un compagno)
function Lucchetto({ onSubmit, sfx }: Props) {
  const [d, setD] = useState([0, 0, 0]);
  const [cur, setCur] = useState(0);
  const turn = (i: number, k: number) => {
    sfx('tick');
    setD((x) => x.map((v, j) => (j === i ? (v + k + 10) % 10 : v)));
  };
  const dRef = useRef(d);
  dRef.current = d;
  const curRef = useRef(cur);
  curRef.current = cur;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        const i = curRef.current;
        sfx('tick');
        setD((x) => x.map((v, j) => (j === i ? Number(e.key) : v)));
        setCur((c) => (c + 1) % 3);
      }
      if (e.key === 'Enter') onSubmit(dRef.current.join(''));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3 rounded-xl border-4 border-[#6b6f72] bg-[#2b2f33] px-4 py-3">
        {d.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <button type="button" className="h-8 w-12 rounded-t-lg bg-white/10 text-lg" onClick={() => turn(i, 1)}>
              ▲
            </button>
            <div className={`grid h-14 w-12 place-items-center bg-[#d8d2c0] font-mono text-3xl font-bold text-black ${cur === i ? 'ring-2 ring-amber-300' : ''}`} onClick={() => setCur(i)}>
              {v}
            </div>
            <button type="button" className="h-8 w-12 rounded-b-lg bg-white/10 text-lg" onClick={() => turn(i, -1)}>
              ▼
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="w-full max-w-[240px] rounded-xl bg-amber-300 px-4 py-2.5 font-bold text-black" onClick={() => onSubmit(d.join(''))}>
        Apri il lucchetto
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- contare i lampeggi
function Conta({ spec, onSay }: Props & { spec: Extract<TaskSpec, { kind: 'conta' }> }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const loop = (x: number) => {
      setT((x - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const cycle = spec.n * 0.5 + 1.8;
  const ph = t % cycle;
  const on = ph < spec.n * 0.5 && ph % 0.5 < 0.25;
  const seen = t > cycle * 1.6;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-20 w-20 rounded-full border-4 border-[#444] transition-colors duration-75 ${on ? 'bg-[#ffd9a0] shadow-[0_0_40px_10px_rgba(255,200,120,0.7)]' : 'bg-[#2a2620]'}`} />
      {seen ? (
        <>
          <p className="text-lg font-semibold text-amber-200">Lampeggia {spec.n} volte</p>
          <p className="text-center text-xs text-white/60">Dillo a chi è al quadro luci (piano terra), oppure scendi tu a impostarlo.</p>
          {onSay && (
            <button type="button" className="rounded-lg border border-amber-200/50 px-3 py-1.5 text-xs text-amber-100" onClick={onSay}>
              Scrivilo alla squadra
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-white/70">Conta i lampeggi…</p>
      )}
    </div>
  );
}
