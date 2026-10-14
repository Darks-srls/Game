import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import type { TaskType } from '../data/astro';

// I compiti sono muti: dal vivo un suono rivelerebbe chi è dell'equipaggio
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

// 🔌 Collega i cavi: 6 colori, tocca un cavo a sinistra e poi lo stesso colore a destra
function Wires({ onDone }: { onDone: () => void }) {
  const colors = ['#ff3b3b', '#2f6bff', '#ffe21f', '#ff8cd0', '#2fd15a', '#9b4dff'];
  const [left] = useState(() => shuffle(colors));
  const [right] = useState(() => shuffle(colors));
  const [sel, setSel] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, number>>({});
  const [wrong, setWrong] = useState(false);
  const y = (i: number) => 26 + i * 40;
  useEffect(() => {
    if (Object.keys(links).length === colors.length) onDone();
  }, [links]);
  const pickRight = (j: number) => {
    if (sel === null || Object.values(links).includes(j)) return;
    if (right[j] === left[sel]) {
      setLinks((l) => ({ ...l, [sel]: j }));
      setSel(null);
    } else {
      setWrong(true);
      setSel(null);
      setTimeout(() => setWrong(false), 350);
    }
  };
  return (
    <svg viewBox="0 0 300 250" className={`w-full ${wrong ? 'animate-shake' : ''}`}>
      <rect x="0" y="0" width="300" height="250" rx="18" fill="#1b1340" />
      {Object.entries(links).map(([i, j]) => (
        <path key={i} d={`M 44 ${y(+i)} C 150 ${y(+i)}, 150 ${y(j)}, 256 ${y(j)}`} stroke={left[+i]} strokeWidth="10" fill="none" strokeLinecap="round" />
      ))}
      {left.map((c, i) => (
        <rect key={`l${i}`} x="6" y={y(i) - 12} width="44" height="24" rx="7" fill={c} stroke={sel === i ? '#fff' : 'transparent'} strokeWidth="4" className="cursor-pointer" onClick={() => !(i in links) && setSel(i)} />
      ))}
      {right.map((c, j) => (
        <rect key={`r${j}`} x="250" y={y(j) - 12} width="44" height="24" rx="7" fill={c} className="cursor-pointer" onClick={() => pickRight(j)} />
      ))}
    </svg>
  );
}

// ⏳ Tieni premuto 5 secondi: se molli, la barra torna indietro
function Hold({ label, onDone }: { label: string; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const holding = useRef(false);
  const done = useRef(false);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (!done.current)
        setProgress((p) => {
          const next = holding.current ? Math.min(1, p + dt / 5) : Math.max(0, p - dt / 2.5);
          if (next >= 1) {
            done.current = true;
            setTimeout(onDone, 150);
          }
          return next;
        });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const set = (v: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    holding.current = v;
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="h-7 overflow-hidden rounded-full bg-slate-950">
        <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-cyan-400" style={{ width: `${progress * 100}%` }} />
      </div>
      <button
        type="button"
        onPointerDown={set(true)}
        onPointerUp={set(false)}
        onPointerLeave={set(false)}
        onPointerCancel={set(false)}
        onContextMenu={(e) => e.preventDefault()}
        className="h-24 rounded-3xl bg-amber-400 px-3 text-xl font-black leading-tight text-slate-950 active:scale-95"
      >
        {progress >= 1 ? 'Fatto! ✓' : `Tieni premuto: ${label}`}
      </button>
      <p className="text-center text-xs font-bold text-slate-400">Se molli, la barra torna indietro!</p>
    </div>
  );
}

// 🎚️ Tre cursori: ognuno va portato nella sua zona verde (stretta) e lasciato lì
function Sliders({ onDone }: { onDone: () => void }) {
  const [targets] = useState(() => [0, 1, 2].map(() => 15 + Math.random() * 70));
  const [values, setValues] = useState<number[]>(() => targets.map((t) => (t > 50 ? 4 : 96)));
  const ok = values.map((v, i) => Math.abs(v - targets[i]) <= 3.5);
  const [miss, setMiss] = useState(-1);
  useEffect(() => {
    if (ok.every(Boolean)) onDone();
  }, [ok.join()]);
  return (
    <div className="flex flex-col gap-4">
      {targets.map((target, i) => (
        <div key={i} className={`flex flex-col gap-1 ${miss === i ? 'animate-shake' : ''}`}>
          <div className="relative h-9 rounded-xl bg-slate-950">
            <div className={`absolute inset-y-1 rounded-lg ${ok[i] ? 'bg-emerald-400' : 'bg-emerald-500/60'}`} style={{ left: `${target - 3.5}%`, width: '7%' }} />
            <div className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_#fff]" style={{ left: `${values[i]}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.25}
            value={values[i]}
            onChange={(e) => setValues((v) => v.map((x, k) => (k === i ? Number(e.target.value) : x)))}
            onPointerUp={() => {
              if (!ok[i]) {
                setMiss(i);
                setTimeout(() => setMiss(-1), 400);
              }
            }}
            className="w-full accent-amber-400"
            aria-label={`Cursore ${i + 1}`}
          />
        </div>
      ))}
      <p className="text-center text-sm font-bold text-slate-300">Allinea tutte e tre le linee bianche nelle zone verdi</p>
    </div>
  );
}

// 💥 Dodici bersagli che si muovono: prendili prima che scappino
function Taps({ icon, onDone }: { icon: string; onDone: () => void }) {
  const [left, setLeft] = useState(12);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const target = useRef({ x: 10, y: 50, vx: 30, vy: 10, born: 0 });
  const spawn = () => {
    const fromLeft = Math.random() < 0.5;
    target.current = {
      x: fromLeft ? 8 : 92,
      y: 15 + Math.random() * 70,
      vx: (fromLeft ? 1 : -1) * (28 + Math.random() * 22),
      vy: (Math.random() - 0.5) * 30,
      born: performance.now(),
    };
  };
  useEffect(() => {
    spawn();
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const p = target.current;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 8 || p.y > 92) p.vy *= -1;
      if (p.x < -5 || p.x > 105) spawn(); // è scappato: ne arriva un altro
      setPos({ x: p.x, y: p.y });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const hit = () => {
    if (left <= 1) return onDone();
    setLeft(left - 1);
    spawn();
  };
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl bg-[radial-gradient(circle,#2c1577,#0b0623)]">
      <p className="absolute left-3 top-2 font-display text-lg text-white">Mancano {left}</p>
      <button
        type="button"
        onPointerDown={hit}
        className="absolute grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-4xl"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      >
        {icon}
      </button>
    </div>
  );
}

// 🔢 Codice di 5 cifre: lo vedi per 3 secondi, poi devi ricordarlo (con `note` resta scritto su un biglietto)
function Code({ onDone, note = false }: { onDone: () => void; note?: boolean }) {
  const make = () => Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
  const [code, setCode] = useState(make);
  const [visible, setVisible] = useState(!note);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    if (note) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [code]);
  const press = (d: string) => {
    if (visible) return;
    const next = (typed + d).slice(0, 5);
    setTyped(next);
    if (next.length === 5) {
      if (next === code) onDone();
      else {
        setWrong(true);
        setTimeout(() => {
          setWrong(false);
          setTyped('');
          if (!note) setCode(make()); // sbagliato: nuovo codice da memorizzare
        }, 500);
      }
    }
  };
  return (
    <div className={`flex flex-col gap-3 ${wrong ? 'animate-shake' : ''}`}>
      {note ? (
        <div className="mx-auto -rotate-2 rounded-lg bg-amber-200 px-5 py-1.5 text-center shadow-[0_4px_0_rgba(0,0,0,0.3)]">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">Codice di emergenza</p>
          <p className="font-display text-3xl tracking-[0.25em] text-slate-900">{code}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-2">
          <span className="text-sm font-bold text-slate-400">{visible ? 'Memorizza!' : 'Codice'}</span>
          <span className="font-display text-3xl tracking-[0.3em] text-amber-300">{visible ? code : '• • • • •'}</span>
        </div>
      )}
      <div className="flex justify-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`grid h-11 w-11 place-items-center rounded-xl font-display text-2xl ${wrong ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}>
            {typed[i] ?? ''}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              disabled={visible}
              onClick={() => (d === '⌫' ? setTyped(typed.slice(0, -1)) : press(d))}
              className="h-12 rounded-2xl bg-slate-700 font-display text-2xl text-white disabled:opacity-40"
            >
              {d}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}

// 🟦 Simon: guarda la sequenza e ripetila (3, poi 4, poi 5 luci)
function Simon({ onDone }: { onDone: () => void }) {
  const [seq, setSeq] = useState(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 9)));
  const [round, setRound] = useState(3);
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    if (phase !== 'show') return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < round) {
        setLit(seq[i]);
        setTimeout(() => setLit(null), 380);
        i++;
      } else {
        clearInterval(timer);
        setStep(0);
        setPhase('input');
      }
    }, 620);
    return () => clearInterval(timer);
  }, [phase, round, seq]);
  const tap = (k: number) => {
    if (phase !== 'input') return;
    setLit(k);
    setTimeout(() => setLit(null), 150);
    if (k !== seq[step]) {
      setWrong(true);
      setTimeout(() => setWrong(false), 400);
      setSeq(Array.from({ length: 5 }, () => Math.floor(Math.random() * 9)));
      setPhase('show');
      return;
    }
    if (step + 1 < round) return setStep(step + 1);
    if (round === 5) return onDone();
    setRound(round + 1);
    setPhase('show');
  };
  return (
    <div className={`flex flex-col gap-3 ${wrong ? 'animate-shake' : ''}`}>
      <p className="text-center text-sm font-bold text-slate-300">
        {phase === 'show' ? 'Guarda la sequenza…' : 'Ripetila!'} (livello {round - 2}/3)
      </p>
      <div className="mx-auto grid w-60 grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, k) => (
          <button
            key={k}
            type="button"
            onPointerDown={() => tap(k)}
            className={`aspect-square rounded-xl transition-colors ${lit === k ? 'bg-cyan-300 shadow-[0_0_18px_#38cbff]' : 'bg-slate-800'}`}
          />
        ))}
      </div>
    </div>
  );
}

// 🔟 Tocca i numeri da 1 a 10 in ordine (se sbagli, si ricomincia); la porta bloccata: da 1 a 6
function Numbers({ onDone, count = 10 }: { onDone: () => void; count?: number }) {
  const [cells, setCells] = useState(() => shuffle([...Array.from({ length: count }, (_, i) => i + 1), 0, 0]));
  const [next, setNext] = useState(1);
  const [wrong, setWrong] = useState(false);
  const tap = (n: number) => {
    if (!n) return;
    if (n === next) {
      if (n === count) return onDone();
      return setNext(n + 1);
    }
    setWrong(true);
    setTimeout(() => setWrong(false), 400);
    setNext(1);
    setCells(shuffle(cells));
  };
  return (
    <div className={`grid grid-cols-4 gap-2 ${wrong ? 'animate-shake' : ''}`}>
      {cells.map((n, i) => (
        <button
          key={i}
          type="button"
          onClick={() => tap(n)}
          className={`aspect-square rounded-2xl font-display text-3xl ${!n ? 'invisible' : n < next ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'}`}
        >
          {n || ''}
        </button>
      ))}
    </div>
  );
}

// 💳 Passa il badge: trascinalo fino in fondo, né troppo veloce né troppo lento
function Swipe({ onDone }: { onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; t: number } | null>(null);
  const [x, setX] = useState(0);
  const [msg, setMsg] = useState('Trascina il badge fino in fondo');
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, t: performance.now() };
  };
  const move = (e: ReactPointerEvent) => {
    if (!start.current || !track.current) return;
    const max = track.current.clientWidth - 90;
    setX(Math.max(0, Math.min(max, e.clientX - start.current.x)));
  };
  const up = () => {
    if (!start.current || !track.current) return;
    const max = track.current.clientWidth - 90;
    const secs = (performance.now() - start.current.t) / 1000;
    start.current = null;
    if (x < max - 4) setMsg('Fino in fondo! Riprova');
    else if (secs < 0.7) setMsg('Troppo veloce! Riprova');
    else if (secs > 1.4) setMsg('Troppo lento! Riprova');
    else {
      setMsg('Accettato ✓');
      return onDone();
    }
    setX(0);
  };
  return (
    <div className="flex flex-col gap-3">
      <div ref={track} className="relative h-24 overflow-hidden rounded-2xl bg-slate-950">
        <div className="absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-700" />
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="absolute top-3 grid h-[72px] w-[84px] cursor-grab touch-none place-items-center rounded-xl bg-linear-to-br from-cyan-300 to-cyan-600 font-display text-white shadow-[0_4px_0_rgba(0,0,0,0.3)]"
          style={{ left: 6 + x }}
        >
          💳 ID
        </div>
      </div>
      <p className="text-center text-sm font-bold text-slate-200">{msg}</p>
    </div>
  );
}

// 💡 Luci: rimetti su tutti gli interruttori
function Switches({ onDone }: { onDone: () => void }) {
  const [on, setOn] = useState(() => {
    const v = Array.from({ length: 6 }, () => Math.random() < 0.35);
    if (v.every(Boolean)) v[Math.floor(Math.random() * 6)] = false;
    return v;
  });
  useEffect(() => {
    if (on.every(Boolean)) onDone();
  }, [on.join()]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-2 rounded-2xl bg-slate-950 p-3">
        {on.map((v, i) => (
          <button key={i} type="button" onClick={() => setOn(on.map((x, k) => (k === i ? !x : x)))} aria-label={`Interruttore ${i + 1}`} className="flex flex-col items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${v ? 'bg-lime-300 shadow-[0_0_12px_#bef264]' : 'bg-slate-700'}`} />
            <span className="relative h-24 w-full rounded-xl bg-slate-800">
              <span className={`absolute inset-x-1 h-10 rounded-lg transition-all duration-150 ${v ? 'top-1 bg-lime-400' : 'top-[52px] bg-slate-500'}`} />
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-bold text-slate-300">Accendi tutti gli interruttori (su = acceso)</p>
    </div>
  );
}

// 📡 Comunicazioni: gira la manopola finché l'onda non è pulita, e tienila lì un attimo
function Frequency({ onDone }: { onDone: () => void }) {
  const [target] = useState(() => 12 + Math.random() * 76);
  const [value, setValue] = useState(() => (target > 50 ? 4 : 96));
  const valueRef = useRef(value);
  valueRef.current = value;
  const [lock, setLock] = useState(0);
  const [t, setT] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT(now);
      const ok = Math.abs(valueRef.current - target) <= 2.5;
      setLock((l) => {
        const next = ok ? Math.min(1, l + dt / 1.2) : Math.max(0, l - dt);
        if (next >= 1 && !done.current) {
          done.current = true;
          setTimeout(onDone, 120);
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const noise = Math.min(1, Math.abs(value - target) / 25);
  const wave = Array.from({ length: 61 }, (_, i) => `${i * 5},${(50 + Math.sin(i * 0.5 + t / 160) * 22 + (Math.random() - 0.5) * 75 * noise).toFixed(1)}`).join(' ');
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 300 100" className="w-full rounded-2xl bg-slate-950">
        <polyline points={wave} fill="none" stroke={noise < 0.11 ? '#4ade80' : '#38cbff'} strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${lock * 100}%` }} />
      </div>
      <input type="range" min={0} max={100} step={0.25} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-cyan-400" aria-label="Frequenza" />
      <p className="text-center text-sm font-bold text-slate-300">Trova la frequenza: quando l'onda è pulita tieni fermo il cursore</p>
    </div>
  );
}

// ☢️ Reattore: tieni la mano sullo scanner; si ripara solo se qualcuno tiene ANCHE l'altro pannello
function ReactorHold({ other, onHold }: { other: boolean; onHold: (on: boolean) => void }) {
  const [holding, setHolding] = useState(false);
  const held = useRef(false);
  const send = useRef(onHold);
  send.current = onHold;
  const set = (v: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (v) e.currentTarget.setPointerCapture(e.pointerId);
    if (held.current === v) return;
    held.current = v;
    setHolding(v);
    send.current(v);
  };
  // chiudendo la finestra la mano si stacca
  useEffect(() => () => void (held.current && send.current(false)), []);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onPointerDown={set(true)}
        onPointerUp={set(false)}
        onPointerCancel={set(false)}
        onContextMenu={(e) => e.preventDefault()}
        className={`grid h-44 touch-none place-items-center rounded-3xl border-4 text-7xl transition-colors ${holding ? 'border-cyan-200 bg-cyan-500/40 shadow-[0_0_30px_#38cbff]' : 'border-white/20 bg-slate-800'}`}
      >
        ✋
      </button>
      <div className="grid grid-cols-2 gap-2 text-center text-sm font-black">
        <span className={`rounded-xl py-2 ${holding ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Questo pannello {holding ? '✓' : '…'}</span>
        <span className={`rounded-xl py-2 ${other ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Altro pannello {other ? '✓' : '…'}</span>
      </div>
      <p className="text-center text-sm font-bold text-slate-300">Tieni premuto: serve qualcuno anche sull’altro pannello, nello stesso momento!</p>
    </div>
  );
}

const TAP_ICONS: Record<string, string> = { 'Svuota la spazzatura': '🗑️', 'Distruggi gli asteroidi': '☄️', 'Pulisci il filtro': '🍂', 'Accendi gli scudi': '🛡️' };

export type RepairType = 'LIGHTS' | 'COMMS' | 'O2' | 'REACTOR' | 'DOOR';

// Finestra del compito (o della riparazione di un sabotaggio): si chiude da sola quando è fatto
export default function AstroTask({
  type,
  title,
  onDone,
  onClose,
  reactor,
}: {
  type: TaskType | RepairType;
  title: string;
  onDone: () => void;
  onClose: () => void;
  reactor?: { other: boolean; onHold: (on: boolean) => void };
}) {
  const [finished, setFinished] = useState(false);
  const finish = () => {
    if (finished) return;
    setFinished(true);
    setTimeout(onDone, 550);
  };
  const repair = ['LIGHTS', 'COMMS', 'O2', 'REACTOR', 'DOOR'].includes(type);
  return (
    <div className="sheet-backdrop absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet w-full max-w-sm rounded-3xl border-2 bg-slate-900 p-4 shadow-[0_10px_0_rgba(0,0,0,0.35)] ${repair ? 'border-red-400/80' : 'border-white/15'}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-2xl leading-tight text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white">
            <X size={20} />
          </button>
        </div>
        {finished ? (
          <p className="reveal-pop py-10 text-center font-display text-5xl text-emerald-300">✓ Fatto!</p>
        ) : type === 'WIRES' ? (
          <Wires onDone={finish} />
        ) : type === 'HOLD' ? (
          <Hold label={title.toLowerCase()} onDone={finish} />
        ) : type === 'SLIDER' ? (
          <Sliders onDone={finish} />
        ) : type === 'TAPS' ? (
          <Taps icon={TAP_ICONS[title] ?? '💥'} onDone={finish} />
        ) : type === 'SIMON' ? (
          <Simon onDone={finish} />
        ) : type === 'NUMBERS' ? (
          <Numbers onDone={finish} />
        ) : type === 'SWIPE' ? (
          <Swipe onDone={finish} />
        ) : type === 'LIGHTS' ? (
          <Switches onDone={finish} />
        ) : type === 'COMMS' ? (
          <Frequency onDone={finish} />
        ) : type === 'O2' ? (
          <Code note onDone={finish} />
        ) : type === 'REACTOR' ? (
          <ReactorHold other={!!reactor?.other} onHold={(on) => reactor?.onHold(on)} />
        ) : type === 'DOOR' ? (
          <Numbers count={6} onDone={finish} />
        ) : (
          <Code onDone={finish} />
        )}
      </div>
    </div>
  );
}
