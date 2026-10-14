import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';
import { Circle, Eraser, PaintBucket, Pencil, Slash, Square, Trash2, Undo2 } from 'lucide-react';
import type { DrawOp } from '../types/game';

const SIZE = 512; // risoluzione del foglio
const COLORS = [
  '#1b1b1f', '#7a7a7a', '#ffffff', '#e53935', '#ff8a1f', '#ffd31a', '#43a047', '#1e88e5',
  '#8e24aa', '#ff5fb0', '#8b5a2b', '#f6c7a1', '#9be15d', '#4dd0e1', '#1a237e', '#7f1d1d',
];
const SIZES = [4, 10, 22, 40];
type Tool = 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse';
const TOOLS: { id: Tool; label: string; Icon: typeof Pencil }[] = [
  { id: 'pen', label: 'Matita', Icon: Pencil },
  { id: 'fill', label: 'Secchiello', Icon: PaintBucket },
  { id: 'line', label: 'Linea', Icon: Slash },
  { id: 'rect', label: 'Rettangolo', Icon: Square },
  { id: 'ellipse', label: 'Cerchio', Icon: Circle },
  { id: 'eraser', label: 'Gomma', Icon: Eraser },
];

type Gesture = { g: number; t: Tool; c: string; w: number; pts: number[]; sent: number; last: number };

export interface DrawBoardHandle {
  toDataURL: () => string | null; // null se il foglio è vuoto
}

interface DrawBoardProps {
  ops: DrawOp[];
  version?: number; // cambia quando arrivano tratti nuovi (lista aggiornata sul posto)
  onOp?: (op: DrawOp) => void; // senza: il foglio è solo da guardare
  penOnly?: boolean;
  fixedColor?: string;
  fixedSize?: number;
  onStrokeEnd?: () => void;
}

// Le operazioni rimaste dopo gli "annulla": ogni annulla toglie l'ultimo gesto intero
export function effectiveOps(ops: DrawOp[]): DrawOp[] {
  const gestures: DrawOp[][] = [];
  for (const op of ops) {
    if (op.t === 'undo') {
      gestures.pop();
      continue;
    }
    const last = gestures[gestures.length - 1];
    if (last && last[0].g === op.g) last.push(op);
    else gestures.push([op]);
  }
  return gestures.flat();
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Secchiello: riempie l'area del colore toccato (con un po' di tolleranza sui bordi sfumati)
function floodFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, hex: string) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  const start = (y * SIZE + x) * 4;
  const [tr, tg, tb] = [d[start], d[start + 1], d[start + 2]];
  const [r, g, b] = rgb(hex);
  if (Math.abs(tr - r) + Math.abs(tg - g) + Math.abs(tb - b) < 10) return;
  const same = (i: number) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= 90;
  const seen = new Uint8Array(SIZE * SIZE);
  const stack = [x, y];
  while (stack.length) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (seen[py * SIZE + px]) continue;
    let lx = px;
    while (lx > 0 && !seen[py * SIZE + lx - 1] && same((py * SIZE + lx - 1) * 4)) lx--;
    let rx = px;
    while (rx < SIZE - 1 && !seen[py * SIZE + rx + 1] && same((py * SIZE + rx + 1) * 4)) rx++;
    for (let ix = lx; ix <= rx; ix++) {
      const k = py * SIZE + ix;
      seen[k] = 1;
      const i = k * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      if (py > 0 && !seen[k - SIZE] && same(i - SIZE * 4)) stack.push(ix, py - 1);
      if (py < SIZE - 1 && !seen[k + SIZE] && same(i + SIZE * 4)) stack.push(ix, py + 1);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Disegna una singola operazione sul foglio
export function applyOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
  const p = op.p ?? [];
  const c = op.c ?? '#1b1b1f';
  const w = op.w ?? 10;
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (op.t === 'clear') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else if (op.t === 'fill' && p.length >= 2) {
    floodFill(ctx, p[0], p[1], c);
  } else if (op.t === 'pen' && p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (op.t === 'pen' && p.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  } else if (p.length >= 4) {
    const [x1, y1, x2, y2] = p;
    ctx.beginPath();
    if (op.t === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else if (op.t === 'rect') {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (op.t === 'ellipse') {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
}

// Foglio da disegno: usato dal Telefono senza fili (in locale) e dai giochi con disegno condiviso
const DrawBoard = forwardRef<DrawBoardHandle, DrawBoardProps>(function DrawBoard(
  { ops, version, onOp, penOnly, fixedColor, fixedSize, onStrokeEnd },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const opsRef = useRef(ops);
  const drawn = useRef(0);
  const local = useRef(new WeakSet<DrawOp>()); // tratti già disegnati qui mentre il dito si muoveva
  const gesture = useRef<Gesture | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [sizeIndex, setSizeIndex] = useState(1);
  opsRef.current = ops;
  const editable = !!onOp;
  const size = fixedSize ?? SIZES[sizeIndex];

  const paper = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

  // Ridisegna solo le operazioni nuove, oppure tutto da capo (all'inizio o dopo un "annulla")
  useEffect(() => {
    const ctx = paper();
    if (!ctx) return;
    const fresh = ops.slice(drawn.current);
    if (drawn.current === 0 || ops.length < drawn.current || fresh.some((op) => op.t === 'undo')) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (const op of effectiveOps(ops)) applyOp(ctx, op);
    } else {
      for (const op of fresh) if (!local.current.has(op)) applyOp(ctx, op);
    }
    drawn.current = ops.length;
  }, [ops, version]);

  useImperativeHandle(ref, () => ({
    toDataURL: () => (effectiveOps(opsRef.current).length && canvasRef.current ? canvasRef.current.toDataURL('image/png') : null),
  }));

  const emit = (op: DrawOp, drawnHere = false) => {
    if (drawnHere) local.current.add(op);
    onOp?.(op);
  };

  // Coordinate nel foglio (512x512), senza contare il bordo
  const toPoint = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    return [
      Math.round(((e.clientX - r.left - el.clientLeft) / el.clientWidth) * SIZE),
      Math.round(((e.clientY - r.top - el.clientTop) / el.clientHeight) * SIZE),
    ];
  };

  // Manda il pezzo di tratto non ancora inviato: gli altri vedono il disegno quasi in diretta
  const flush = (s: Gesture) => {
    if (s.pts.length <= s.sent) return;
    const from = Math.max(0, s.sent - 2); // riparte dall'ultimo punto inviato, così il tratto resta unito
    emit({ g: s.g, t: 'pen', c: s.c, w: s.w, p: s.pts.slice(from) }, true);
    s.sent = s.pts.length;
    s.last = Date.now();
  };

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!editable || gesture.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toPoint(e);
    const t: Tool = penOnly ? 'pen' : tool;
    const c = fixedColor ?? (t === 'eraser' ? '#ffffff' : color);
    const w = t === 'eraser' ? Math.max(size * 2, 18) : size;
    if (t === 'fill') {
      emit({ g: Date.now(), t: 'fill', c, p: [x, y] });
      return;
    }
    gesture.current = { g: Date.now(), t, c, w, pts: [x, y], sent: 0, last: Date.now() };
    if (t === 'pen' || t === 'eraser') {
      const ctx = paper();
      if (ctx) applyOp(ctx, { g: 0, t: 'pen', c, w, p: [x, y] });
    }
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = gesture.current;
    if (!s) return;
    const [x, y] = toPoint(e);
    if (s.t === 'pen' || s.t === 'eraser') {
      const n = s.pts.length;
      if (Math.abs(x - s.pts[n - 2]) + Math.abs(y - s.pts[n - 1]) < 3) return;
      const ctx = paper();
      if (ctx) applyOp(ctx, { g: 0, t: 'pen', c: s.c, w: s.w, p: [s.pts[n - 2], s.pts[n - 1], x, y] });
      s.pts.push(x, y);
      if (Date.now() - s.last > 60) flush(s);
    } else {
      // anteprima della forma sul foglio trasparente sopra
      s.pts = [s.pts[0], s.pts[1], x, y];
      const o = overlayRef.current?.getContext('2d');
      if (o) {
        o.clearRect(0, 0, SIZE, SIZE);
        applyOp(o, { g: 0, t: s.t as DrawOp['t'], c: s.c, w: s.w, p: s.pts });
      }
    }
  };

  const up = () => {
    const s = gesture.current;
    if (!s) return;
    gesture.current = null;
    if (s.t === 'pen' || s.t === 'eraser') flush(s);
    else {
      overlayRef.current?.getContext('2d')?.clearRect(0, 0, SIZE, SIZE);
      if (s.pts.length === 4) emit({ g: s.g, t: s.t as DrawOp['t'], c: s.c, w: s.w, p: s.pts });
    }
    onStrokeEnd?.();
  };

  const undo = () => {
    if (effectiveOps(opsRef.current).length) emit({ g: Date.now(), t: 'undo' });
  };

  const clear = () => {
    if (effectiveOps(opsRef.current).length) emit({ g: Date.now(), t: 'clear' });
  };

  return (
    // niente menu "copia/salva" o selezione tenendo premuto col dito
    <div className="flex select-none flex-col gap-2 [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={`block aspect-square w-full touch-none rounded-2xl border-4 border-white/80 bg-white shadow-[0_6px_0_rgba(22,6,72,0.5)] ${editable ? 'cursor-crosshair' : ''}`}
        />
        <canvas ref={overlayRef} width={SIZE} height={SIZE} className="pointer-events-none absolute inset-[4px] h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-xl" />
      </div>
      {editable && !penOnly && (
        <>
          <div className="grid grid-cols-8 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label="Colore"
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
                className={`h-7 rounded-full border-2 ${c === color && tool !== 'eraser' ? 'border-amber-400 ring-2 ring-white' : 'border-black/25'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="grid grid-cols-9 gap-1">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => setTool(id)}
                className={`grid h-10 place-items-center rounded-xl ${tool === id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-white'}`}
              >
                <Icon size={18} />
              </button>
            ))}
            <button
              type="button"
              aria-label="Spessore"
              title="Spessore"
              onClick={() => setSizeIndex((i) => (i + 1) % SIZES.length)}
              className="grid h-10 place-items-center rounded-xl bg-slate-800"
            >
              <span className="rounded-full bg-white" style={{ width: 4 + SIZES[sizeIndex] / 2.2, height: 4 + SIZES[sizeIndex] / 2.2 }} />
            </button>
            <button type="button" aria-label="Annulla" title="Annulla" onClick={undo} className="grid h-10 place-items-center rounded-xl bg-slate-800 text-white">
              <Undo2 size={18} />
            </button>
            <button type="button" aria-label="Cancella tutto" title="Cancella tutto" onClick={clear} className="grid h-10 place-items-center rounded-xl bg-slate-800 text-white">
              <Trash2 size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default DrawBoard;
