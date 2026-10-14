import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { ArrowDownToLine, Cctv, DoorOpen, Hand, ListChecks, Map as MapIcon, Megaphone, Siren, Skull, Wrench, X, Zap } from 'lucide-react';
import type { AstroView as AstroData } from '../types/game';
import {
  ASTRO_COLORS,
  BUTTON,
  BUTTON_RANGE,
  CAMERAS,
  CAMERA_CONSOLE,
  CONSOLE_RANGE,
  CORRIDORS,
  DOORS,
  FIX_POINTS,
  FIX_RANGE,
  GHOST_SPEED,
  KILL_RANGE,
  LIGHTS_VISION,
  PLAYER_R,
  REPORT_RANGE,
  ROOMS,
  SABOTAGE_INFO,
  SPEED,
  STATIONS,
  TASK_RANGE,
  VENTS,
  VENT_RANGE,
  VISION,
  WORLD,
  dist,
  lineOfSight,
  moveWithCollision,
  roomAt,
  setClosedRooms,
  visionPolygon,
  type SabotageKind,
} from '../data/astro';
import { useCountdown } from '../hooks/useCountdown';
import { soundManager } from '../utils/audio';
import AstroTask, { type RepairType } from './AstroTask';
import { TimerRing } from './fx';
import { EndBar, type ModeProps } from './ui';

// ---------------------------------------------------------------- grafica (sprite creati con Nano Banana)

const PROP_NAMES = [...new Set([...ROOMS.flatMap((r) => r.props.map((p) => p.img)), 'vent'])];
const SPRITE_H = 82;
const ready = (img?: HTMLImageElement) => !!img && img.complete && img.naturalWidth > 0;

// L'astronauta è bianco: per ogni giocatore lo si "tinge" una volta sola
const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement, color: string) {
  let cv = tintCache.get(color);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  tintCache.set(color, cv);
  return cv;
}

// Miniature (per riunione, inizio e fine): una per colore
const thumbCache = new Map<string, string>();
function thumbFor(img: HTMLImageElement, color: string) {
  let url = thumbCache.get(color);
  if (!url) thumbCache.set(color, (url = tinted(img, color).toDataURL()));
  return url;
}

// La mappa fissa (muri, pavimenti, nomi, oggetti) si disegna una volta sola in un'immagine a parte
const MAP_PAD = 60;
function buildMap(imgs: Record<string, HTMLImageElement>) {
  const cv = document.createElement('canvas');
  cv.width = WORLD.w + MAP_PAD * 2;
  cv.height = WORLD.h + MAP_PAD * 2;
  const c = cv.getContext('2d')!;
  c.translate(MAP_PAD, MAP_PAD);
  drawMap(c, imgs);
  return cv;
}

// Stelle dello spazio attorno all'astronave (sempre uguali)
const STARS = Array.from({ length: 260 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return { x: (a - Math.floor(a)) * (WORLD.w + 1600) - 800, y: (b - Math.floor(b)) * (WORLD.h + 1400) - 700, r: 0.8 + ((i * 7) % 5) * 0.45 };
});

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawMap(c: CanvasRenderingContext2D, imgs: Record<string, HTMLImageElement>) {
  // muri: stanze e corridoi un po' più grandi, poi sopra i pavimenti (così le porte si aprono da sole)
  c.fillStyle = '#3a2a85';
  for (const r of ROOMS) {
    roundRect(c, r.x - 14, r.y - 14, r.w + 28, r.h + 28, 30);
    c.fill();
  }
  for (const k of CORRIDORS) c.fillRect(k.x - 14, k.y - 14, k.w + 28, k.h + 28);
  c.fillStyle = '#5a46b8';
  for (const r of ROOMS) {
    roundRect(c, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 24);
    c.fill();
  }
  for (const k of CORRIDORS) c.fillRect(k.x - 6, k.y - 6, k.w + 12, k.h + 12);
  // pavimenti
  for (const k of CORRIDORS) {
    c.fillStyle = '#b7aee3';
    c.fillRect(k.x, k.y, k.w, k.h);
  }
  for (const r of ROOMS) {
    const grad = c.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grad.addColorStop(0, '#e2dcff');
    grad.addColorStop(1, '#cbc2f2');
    c.fillStyle = grad;
    roundRect(c, r.x, r.y, r.w, r.h, 18);
    c.fill();
    // piastrelle
    c.save();
    roundRect(c, r.x, r.y, r.w, r.h, 18);
    c.clip();
    c.strokeStyle = 'rgba(105, 73, 200, 0.12)';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = r.x + 50; x < r.x + r.w; x += 50) {
      c.moveTo(x, r.y);
      c.lineTo(x, r.y + r.h);
    }
    for (let y = r.y + 50; y < r.y + r.h; y += 50) {
      c.moveTo(r.x, y);
      c.lineTo(r.x + r.w, y);
    }
    c.stroke();
    c.restore();
  }
  // i corridoi che entrano nelle stanze tornano del colore del corridoio solo fuori dalle stanze
  for (const r of ROOMS) {
    c.fillStyle = 'rgba(80, 55, 170, 0.32)';
    c.font = '700 22px "Baloo 2", sans-serif';
    c.fillText(r.name.toUpperCase(), r.x + 14, r.y + 30);
  }
  // botole (le vedono tutti, ma solo l'impostore ci entra)
  const vent = imgs.vent;
  for (const v of VENTS) {
    if (ready(vent)) c.drawImage(vent, v.x - 28, v.y - 28, 56, 56);
    else {
      c.fillStyle = '#6d6a80';
      c.fillRect(v.x - 23, v.y - 23, 46, 46);
    }
  }
  // oggetti
  for (const prop of ROOMS.flatMap((r) => r.props)) {
    const img = imgs[prop.img];
    if (!ready(img)) continue;
    const w = prop.s;
    const h = prop.s * (img.naturalHeight / img.naturalWidth);
    c.save();
    c.shadowColor = 'rgba(30, 10, 80, 0.35)';
    c.shadowBlur = 18;
    c.shadowOffsetY = 8;
    c.drawImage(img, prop.x - w / 2, prop.y - h / 2, w, h);
    c.restore();
  }
}

function drawStation(c: CanvasRenderingContext2D, x: number, y: number, mine: boolean, t: number) {
  c.save();
  if (mine) {
    const pulse = 0.5 + 0.5 * Math.sin(t / 220);
    c.strokeStyle = `rgba(255, 226, 31, ${0.5 + pulse * 0.5})`;
    c.lineWidth = 6;
    roundRect(c, x - 26, y - 22, 52, 44, 12);
    c.stroke();
  }
  c.fillStyle = '#2c1577';
  roundRect(c, x - 19, y - 15, 38, 30, 8);
  c.fill();
  c.fillStyle = mine ? '#38cbff' : '#5a46b8';
  roundRect(c, x - 13, y - 10, 26, 16, 4);
  c.fill();
  if (mine) {
    const bounce = Math.abs(Math.sin(t / 250)) * 8;
    c.fillStyle = '#ffe21f';
    c.strokeStyle = '#2c1577';
    c.lineWidth = 5;
    c.font = '900 34px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.strokeText('!', x, y - 26 - bounce);
    c.fillText('!', x, y - 26 - bounce);
  }
  c.restore();
}

// Porta chiusa: sbarra a strisce gialle e nere con una luce rossa che lampeggia
function drawDoor(c: CanvasRenderingContext2D, d: { x: number; y: number; w: number; h: number }, t: number) {
  c.save();
  c.fillStyle = '#2c1577';
  roundRect(c, d.x - 5, d.y - 5, d.w + 10, d.h + 10, 7);
  c.fill();
  roundRect(c, d.x, d.y, d.w, d.h, 4);
  c.clip();
  c.fillStyle = '#ffd21f';
  c.fillRect(d.x, d.y, d.w, d.h);
  c.strokeStyle = '#2c1577';
  c.lineWidth = 9;
  const L = d.w + d.h;
  c.beginPath();
  for (let k = -L; k < L; k += 26) {
    c.moveTo(d.x + k, d.y);
    c.lineTo(d.x + k + L, d.y + L);
  }
  c.stroke();
  c.restore();
  c.fillStyle = Math.sin(t / 160) > 0 ? '#ff3b3b' : '#7a1020';
  c.beginPath();
  c.arc(d.x + d.w / 2, d.y + d.h / 2, 8, 0, Math.PI * 2);
  c.fill();
}

// Etichetta scura con testo bianco (es. il conto alla rovescia del pulsante della riunione)
function drawPill(c: CanvasRenderingContext2D, x: number, y: number, text: string) {
  c.save();
  c.font = '700 22px "Baloo 2", sans-serif';
  const w = c.measureText(text).width + 26;
  c.fillStyle = 'rgba(20, 8, 60, 0.85)';
  roundRect(c, x - w / 2, y - 18, w, 36, 18);
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y + 1);
  c.restore();
}

// Telecamera sul muro: la lucina rossa lampeggia quando qualcuno la sta guardando
function drawCamera(c: CanvasRenderingContext2D, x: number, y: number, on: boolean, t: number) {
  c.save();
  c.fillStyle = '#2c1577';
  roundRect(c, x - 17, y - 10, 34, 20, 7);
  c.fill();
  c.fillStyle = '#7d6ad8';
  c.beginPath();
  c.arc(x + 5, y, 6.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = on && Math.sin(t / 140) > 0 ? '#ff3b3b' : '#5a2440';
  c.beginPath();
  c.arc(x - 9, y - 3, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// Console delle telecamere: quattro schermini
function drawConsole(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save();
  c.fillStyle = '#2c1577';
  roundRect(c, x - 28, y - 20, 56, 40, 10);
  c.fill();
  c.fillStyle = '#38cbff';
  for (const [dx, dy] of [[-21, -14], [2, -14], [-21, 2], [2, 2]]) {
    roundRect(c, x + dx, y + dy, 19, 12, 3);
    c.fill();
  }
  c.restore();
}

// Pannello da riparare (sabotaggio): lampeggia di rosso, verde se qualcuno ci tiene la mano
function drawFixPoint(c: CanvasRenderingContext2D, x: number, y: number, t: number, held: boolean) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 130);
  c.save();
  c.strokeStyle = held ? '#2fd15a' : `rgba(255, 59, 59, ${0.45 + pulse * 0.55})`;
  c.lineWidth = 7;
  roundRect(c, x - 30, y - 26, 60, 52, 12);
  c.stroke();
  c.fillStyle = '#3b0d1f';
  roundRect(c, x - 21, y - 17, 42, 34, 9);
  c.fill();
  c.fillStyle = held ? '#2fd15a' : '#ff3b3b';
  roundRect(c, x - 14, y - 10, 28, 17, 5);
  c.fill();
  const bounce = Math.abs(Math.sin(t / 200)) * 8;
  c.fillStyle = '#ff3b3b';
  c.strokeStyle = '#ffffff';
  c.lineWidth = 5;
  c.font = '900 34px "Lilita One", sans-serif';
  c.textAlign = 'center';
  c.strokeText('!', x, y - 32 - bounce);
  c.fillText('!', x, y - 32 - bounce);
  c.restore();
}

function drawCrew(c: CanvasRenderingContext2D, img: HTMLImageElement | undefined, color: string, x: number, y: number, f: number, moving: boolean, t: number, ghost: boolean) {
  const ground = y + PLAYER_R;
  if (!ghost) {
    c.fillStyle = 'rgba(30, 10, 80, 0.22)';
    c.beginPath();
    c.ellipse(x, ground, 26, 8, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (!ready(img)) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y - 18, 26, 0, Math.PI * 2);
    c.fill();
    return;
  }
  const h = SPRITE_H;
  const w = h * (img!.naturalWidth / img!.naturalHeight);
  const bob = moving ? Math.abs(Math.sin(t / 75)) * 7 : 0;
  const float = ghost ? Math.sin(t / 320) * 6 - 10 : 0;
  c.save();
  if (ghost) c.globalAlpha = 0.45;
  c.translate(x, ground - bob + float);
  if (f) c.scale(-1, 1);
  if (moving) c.rotate(Math.sin(t / 75) * 0.07);
  c.drawImage(tinted(img!, color), -w / 2, -h, w, h);
  c.restore();
}

function drawBody(c: CanvasRenderingContext2D, img: HTMLImageElement | undefined, color: string, x: number, y: number, t: number) {
  if (ready(img)) {
    const h = SPRITE_H * 0.92;
    const w = h * (img!.naturalWidth / img!.naturalHeight);
    c.save();
    c.translate(x, y + 8);
    c.rotate(-Math.PI / 2);
    c.drawImage(tinted(img!, color), -h / 2, -w / 2 - 4, w, h);
    c.restore();
  } else {
    c.fillStyle = color;
    c.fillRect(x - 30, y - 10, 60, 24);
  }
  c.save();
  c.font = '18px sans-serif';
  c.fillStyle = '#ffe21f';
  for (let i = 0; i < 3; i++) {
    const a = t / 380 + i * 2.1;
    c.fillText('★', x + Math.cos(a) * 30 - 7, y - 28 + Math.sin(a) * 8);
  }
  c.restore();
}

function drawName(c: CanvasRenderingContext2D, name: string, x: number, y: number, color: string) {
  c.save();
  c.font = '700 17px "Baloo 2", sans-serif';
  c.textAlign = 'center';
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(20, 8, 60, 0.85)';
  c.strokeText(name, x, y - SPRITE_H - 4);
  c.fillStyle = color;
  c.fillText(name, x, y - SPRITE_H - 4);
  c.restore();
}

// ---------------------------------------------------------------- comandi

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const update = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    const k = len / max < 0.15 ? 0 : 1; // zona morta al centro
    onMove((dx / max) * k, (dy / max) * k);
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={base}
      className="relative grid h-32 w-32 touch-none place-items-center rounded-full border-2 border-white/25 bg-white/10 backdrop-blur-sm"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="h-14 w-14 rounded-full bg-white/85 shadow-[0_4px_0_rgba(0,0,0,0.25)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function ActionButton({ label, icon, color, enabled, onPress, badge }: { label: string; icon: ReactNode; color: string; enabled: boolean; onPress: () => void; badge?: string | null }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (enabled) onPress();
      }}
      className={`relative flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border-4 border-white/80 font-display text-xs text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] transition-opacity ${enabled ? '' : 'opacity-35'}`}
      style={{ background: color }}
    >
      {icon}
      <span className="mt-0.5 leading-none">{label}</span>
      {badge && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 font-display text-3xl text-white">{badge}</span>}
    </button>
  );
}

// Avviso del sabotaggio in corso (lo vedono tutti uguale)
function SabotageBanner({ sab, left }: { sab: NonNullable<AstroData['sabotage']>; left: number }) {
  const info = SABOTAGE_INFO[sab.kind];
  const progress = sab.kind === 'o2' ? ` · codici ${sab.fixed.length}/2` : sab.kind === 'reactor' ? ` · ✋ ${Object.keys(sab.holders).length}/2` : '';
  return (
    <div
      className={`pop pointer-events-none absolute inset-x-3 top-[82px] flex items-center gap-2 rounded-2xl border-2 px-3 py-2 ${info.critical ? 'alarm-blink border-red-200 bg-red-600/90' : 'border-amber-200 bg-amber-500/90'}`}
    >
      <span className="text-3xl">{info.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight text-white">{info.name}</p>
        <p className="text-xs font-bold leading-snug text-white/90">
          {info.how}
          {progress}
        </p>
      </div>
      {info.critical && <span className="font-display text-4xl tabular-nums text-white">{left}</span>}
    </div>
  );
}

const REPAIR_TYPE: Record<SabotageKind, RepairType> = { lights: 'LIGHTS', comms: 'COMMS', o2: 'O2', reactor: 'REACTOR' };
const SABOTAGE_SHORT: Record<SabotageKind, string> = { reactor: 'Reattore', o2: 'Ossigeno', lights: 'Luci', comms: 'Comunicazioni' };
const doorCenter = (d: { x: number; y: number; w: number; h: number }) => ({ x: d.x + d.w / 2, y: d.y + d.h / 2 });

// ---------------------------------------------------------------- il gioco

type Near = { task: number | null; button: boolean; body: string | null; target: string | null; vent: number | null; fix: string | null; door: string | null; cams: boolean };

export default function AstroView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onForce, realtime }: ModeProps) {
  const a = state.mg as AstroData;
  const myId = state.myId;
  const P = (id: string | null) => state.players.find((p) => p.id === id);
  const colorOf = (id: string) => ASTRO_COLORS[(a.colors[id] ?? 0) % ASTRO_COLORS.length];
  const ghost = !a.alive || a.role === 'SPECTATOR';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgs = useRef<Record<string, HTMLImageElement>>({});
  const [crewReady, setCrewReady] = useState(false);
  const me = useRef({ x: a.spawn.x, y: a.spawn.y, f: 0, m: 0 });
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const dataRef = useRef(a);
  dataRef.current = a;
  const rtLink = useRef(realtime);
  rtLink.current = realtime;
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const playersRef = useRef(state.players);
  playersRef.current = state.players;
  const busy = useRef(false);
  const smooth = useRef(new Map<string, { x: number; y: number; f: number; m: number }>());
  const [near, setNear] = useState<Near>({ task: null, button: false, body: null, target: null, vent: null, fix: null, door: null, cams: false });
  const [camsOpen, setCamsOpen] = useState(false);
  const camsRef = useRef(false);
  camsRef.current = camsOpen;
  const [ventOpen, setVentOpen] = useState<number | null>(null);
  const [sabOpen, setSabOpen] = useState(false);
  const [repair, setRepair] = useState<{ point: string | null; room: string | null } | null>(null);
  const nearRef = useRef(near);
  nearRef.current = near;
  const [taskOpen, setTaskOpen] = useState<number | null>(null);
  busy.current = taskOpen !== null || repair !== null || sabOpen || camsOpen;
  const [mapOpen, setMapOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [deathNote, setDeathNote] = useState<string | null>(null);
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  // sprite
  useEffect(() => {
    for (const name of ['crew', ...PROP_NAMES]) {
      const img = new Image();
      img.src = `/art/astro/${name}.webp`;
      if (name === 'crew') img.onload = () => setCrewReady(true);
      imgs.current[name] = img;
    }
  }, []);

  // niente scroll della pagina mentre si gioca
  useEffect(() => {
    if (a.stage === 'END') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [a.stage === 'END']);

  // riportati al tavolo (inizio e dopo le riunioni)
  const lastSpawn = useRef(0);
  useEffect(() => {
    if (a.spawnNo === lastSpawn.current) return;
    lastSpawn.current = a.spawnNo;
    me.current = { x: a.spawn.x, y: a.spawn.y, f: 0, m: 0 };
    rtLink.current?.send(a.spawn.x, a.spawn.y, 0, 0);
    setTaskOpen(null);
  }, [a.spawnNo]);

  const lastWarp = useRef(a.warp?.n ?? 0);
  useEffect(() => {
    if (!a.warp || a.warp.n === lastWarp.current) return;
    lastWarp.current = a.warp.n;
    me.current = { ...me.current, x: a.warp.x, y: a.warp.y, m: 0 };
    rtLink.current?.send(a.warp.x, a.warp.y, me.current.f, 0);
  }, [a.warp?.n]);

  // porte chiuse dall'impostore: bloccano passaggio e vista (stesso suono per tutti quando sbattono)
  const doorsKey = a.closedDoors.join(',');
  const prevDoors = useRef(a.closedDoors);
  useEffect(() => {
    setClosedRooms(a.closedDoors);
    if (a.closedDoors.some((r) => !prevDoors.current.includes(r))) soundManager.playDoor();
    prevDoors.current = a.closedDoors;
  }, [doorsKey]);
  useEffect(() => () => setClosedRooms([]), []);

  // sabotaggi: allarme uguale per tutti (impostore compreso); sirena continua per reattore e ossigeno
  const sabKind = a.stage === 'PLAY' ? a.sabotage?.kind ?? null : null;
  const prevSab = useRef(sabKind);
  useEffect(() => {
    const prev = prevSab.current;
    prevSab.current = sabKind;
    if (sabKind && !prev) soundManager.playAlarm();
    else if (!sabKind && prev && a.stage === 'PLAY') soundManager.playSuccess();
    if (!sabKind || !SABOTAGE_INFO[sabKind].critical) return;
    const timer = setInterval(() => soundManager.playAlarm(), 1500);
    return () => clearInterval(timer);
  }, [sabKind]);

  // la riparazione aperta non serve più (riparato da altri, porta riaperta, riunione…): si chiude
  useEffect(() => {
    if (!repair) return;
    const sab = a.sabotage;
    const gone = repair.point ? !sab || sab.kind !== FIX_POINTS[repair.point].kind || sab.fixed.includes(repair.point) : !a.closedDoors.includes(repair.room ?? '');
    if (gone || a.stage !== 'PLAY') setRepair(null);
  }, [a.sabotage, doorsKey, a.stage, repair]);

  // orologio leggero per la ricarica dell'eliminazione (senza ticchettii: non deve tradire l'impostore)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, []);

  // suoni uguali per tutti
  useEffect(() => {
    if (a.stage === 'INTRO') soundManager.playReveal();
    if (a.stage === 'MEETING') {
      soundManager.playAlarm();
      setTimeout(() => soundManager.playAlarm(), 450);
      setTaskOpen(null);
      setMapOpen(false);
      setSabOpen(false);
      setVentOpen(null);
      setCamsOpen(false); // la riunione spegne le telecamere (anche sul server)
    }
    if (a.stage === 'EJECT') soundManager.playWhoosh();
    if (a.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 170, spread: 95, origin: { y: 0.35 } });
    }
  }, [a.stage]);

  // eliminato: avviso (in silenzio)
  const wasAlive = useRef(a.alive);
  useEffect(() => {
    if (wasAlive.current && !a.alive && a.killedBy) {
      setDeathNote(P(a.killedBy)?.name ?? '???');
      setTaskOpen(null);
      setRepair(null);
      setVentOpen(null);
      setCamsOpen(false);
      setTimeout(() => setDeathNote(null), 3800);
    }
    wasAlive.current = a.alive;
  }, [a.alive]);

  // azioni (usate sia dai pulsanti sia dalla tastiera)
  const actions = useRef({ use: () => {}, report: () => {}, kill: () => {}, sabotage: () => {} });

  // tastiera (PC)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      keys.current.add(k);
      if (k === 'e' || k === ' ') actions.current.use();
      if (k === 'r') actions.current.report();
      if (k === 'q') actions.current.kill();
      if (k === 'f') actions.current.sabotage();
      if (k === 'm') setMapOpen((v) => !v);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ciclo di gioco: movimento, invio della posizione, disegno
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSend = 0;
    let lastNear = 0;
    let sentMoving = 0;
    let map: HTMLCanvasElement | null = null;
    let mapKey = '';
    let fontsReady = false;
    let visionNow = 0;
    document.fonts?.ready.then(() => (fontsReady = true));
    const frame = (t: number) => {
      const s = dataRef.current;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      raf = requestAnimationFrame(frame);
      if (!canvas || !wrap) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const isGhost = !s.alive || s.role === 'SPECTATOR';

      // movimento
      let vx = joy.current.x;
      let vy = joy.current.y;
      const k = keys.current;
      if (k.has('arrowleft') || k.has('a')) vx -= 1;
      if (k.has('arrowright') || k.has('d')) vx += 1;
      if (k.has('arrowup') || k.has('w')) vy -= 1;
      if (k.has('arrowdown') || k.has('s')) vy += 1;
      const len = Math.hypot(vx, vy);
      const canMove = s.stage === 'PLAY' && !busy.current;
      const pos = me.current;
      if (canMove && len > 0.05) {
        const power = Math.min(1, len);
        const speed = (isGhost ? GHOST_SPEED : SPEED) * power * dt;
        const dx = (vx / len) * speed;
        const dy = (vy / len) * speed;
        const next = isGhost
          ? { x: Math.max(0, Math.min(WORLD.w, pos.x + dx)), y: Math.max(0, Math.min(WORLD.h, pos.y + dy)) }
          : moveWithCollision(pos.x, pos.y, dx, dy);
        pos.x = next.x;
        pos.y = next.y;
        pos.m = 1;
        if (vx < -0.1) pos.f = 1;
        else if (vx > 0.1) pos.f = 0;
      } else pos.m = 0;
      if (s.role !== 'SPECTATOR' && t - lastSend > 90 && (pos.m || sentMoving)) {
        rtLink.current?.send(pos.x, pos.y, pos.f, pos.m);
        sentMoving = pos.m;
        lastSend = t;
      }

      // gli altri: inseguono dolcemente l'ultima posizione arrivata (salti grandi = teletrasporto)
      const latest = rtLink.current?.ref.current.p ?? new Map();
      for (const [id, p] of latest) {
        if (id === myId) continue;
        const v = smooth.current.get(id);
        if (!v || Math.hypot(v.x - p.x, v.y - p.y) > 320) smooth.current.set(id, { ...p });
        else {
          const f = Math.min(1, dt * 12);
          v.x += (p.x - v.x) * f;
          v.y += (p.y - v.y) * f;
          v.f = p.f;
          v.m = p.m;
        }
      }
      for (const id of smooth.current.keys()) if (!latest.has(id)) smooth.current.delete(id);

      // disegno
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const c = canvas.getContext('2d')!;
      const zoom = Math.max(0.5, Math.min(1.15, Math.min(W, H) / 640));
      const visionTarget = s.role === 'IMPOSTOR' ? VISION.impostor : s.sabotage?.kind === 'lights' ? LIGHTS_VISION : VISION.crew;
      visionNow = visionNow ? visionNow + (visionTarget - visionNow) * Math.min(1, dt * 3) : visionTarget;
      const vision = visionNow;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#0b0623';
      c.fillRect(0, 0, canvas.width, canvas.height);
      const key = `${Object.values(imgs.current).filter(ready).length}-${fontsReady}`;
      if (!map || key !== mapKey) {
        map = buildMap(imgs.current);
        mapKey = key;
      }
      const players = playersRef.current;
      const color = (id: string) => ASTRO_COLORS[(s.colors[id] ?? 0) % ASTRO_COLORS.length];

      // 📹 telecamere: 4 schermi (una colonna sul telefono in verticale, 2x2 sullo schermo largo)
      if (camsRef.current) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const top = 86;
        const bottom = 86;
        const gap = 8;
        const side = 10;
        const cols = W > H ? 2 : 1;
        const rows = Math.ceil(CAMERAS.length / cols);
        const vw = (W - side * 2 - gap * (cols - 1)) / cols;
        const vh = (H - top - bottom - gap * (rows - 1)) / rows;
        const z = Math.max(0.35, Math.min(1, vw / 620));
        const noSignal = s.sabotage?.kind === 'comms';
        CAMERAS.forEach((cam, i) => {
          const vx = side + (i % cols) * (vw + gap);
          const vy = top + Math.floor(i / cols) * (vh + gap);
          c.save();
          roundRect(c, vx, vy, vw, vh, 14);
          c.clip();
          c.fillStyle = '#0b0623';
          c.fillRect(vx, vy, vw, vh);
          if (noSignal) {
            // comunicazioni rotte: solo neve
            for (let k = 0; k < 160; k++) {
              c.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.4})`;
              c.fillRect(vx + Math.random() * vw, vy + Math.random() * vh, 3 + Math.random() * 12, 2);
            }
          } else {
            c.save();
            c.translate(vx + vw / 2, vy + vh / 2);
            c.scale(z, z);
            c.translate(-cam.x, -cam.y);
            c.drawImage(map!, -MAP_PAD, -MAP_PAD);
            for (const d of DOORS) if (s.closedDoors.includes(d.room)) drawDoor(c, d, t);
            for (const b of s.bodies) drawBody(c, imgs.current.crew, color(b.id), b.x, b.y, t);
            const people = [...smooth.current].map(([id, p]) => ({ id, ...p, dead: s.dead.includes(id) })).filter((p) => !p.dead);
            if (s.alive) people.push({ id: myId, ...pos, dead: false });
            people.sort((p, q) => p.y - q.y);
            for (const p of people) drawCrew(c, imgs.current.crew, color(p.id), p.x, p.y, p.f, !!p.m, t, false);
            c.restore();
            c.font = '700 12px "Baloo 2", sans-serif';
            c.textAlign = 'center';
            c.lineWidth = 3;
            c.strokeStyle = 'rgba(20, 8, 60, 0.9)';
            c.fillStyle = '#ffffff';
            for (const p of people) {
              const name = players.find((x) => x.id === p.id)?.name ?? '';
              const sx = vx + vw / 2 + (p.x - cam.x) * z;
              const sy = vy + vh / 2 + (p.y - cam.y + PLAYER_R - SPRITE_H) * z - 5;
              c.strokeText(name, sx, sy);
              c.fillText(name, sx, sy);
            }
          }
          // etichetta e "REC" che lampeggia
          c.font = '700 12px "Baloo 2", sans-serif';
          c.textAlign = 'left';
          const label = `CAM ${i + 1} · ${cam.name}`;
          c.fillStyle = 'rgba(20, 8, 60, 0.8)';
          roundRect(c, vx + 8, vy + 8, c.measureText(label).width + 16, 22, 11);
          c.fill();
          c.fillStyle = '#ffffff';
          c.fillText(label, vx + 16, vy + 23);
          if (Math.sin(t / 300) > 0) {
            c.fillStyle = '#ff3b3b';
            c.beginPath();
            c.arc(vx + vw - 44, vy + 19, 5, 0, Math.PI * 2);
            c.fill();
            c.fillText('REC', vx + vw - 35, vy + 23);
          }
          if (noSignal) {
            c.font = '700 15px "Baloo 2", sans-serif';
            c.textAlign = 'center';
            c.fillStyle = '#ffffff';
            c.fillText('📡 Nessun segnale', vx + vw / 2, vy + vh / 2 + 5);
          }
          c.restore();
          c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          c.lineWidth = 2;
          roundRect(c, vx, vy, vw, vh, 14);
          c.stroke();
        });
        return;
      }

      c.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (W / 2 - pos.x * zoom), dpr * (H / 2 - pos.y * zoom));
      c.fillStyle = '#ffffff';
      for (const st of STARS) {
        c.globalAlpha = 0.35 + 0.35 * Math.sin(t / 900 + st.x);
        c.fillRect(st.x, st.y, st.r * 2, st.r * 2);
      }
      c.globalAlpha = 1;
      c.drawImage(map, -MAP_PAD, -MAP_PAD);
      drawConsole(c, CAMERA_CONSOLE.x, CAMERA_CONSOLE.y);
      for (const cam of CAMERAS) drawCamera(c, cam.mx, cam.my, s.camsOn, t);
      const mine = new Set(s.tasks.filter((x) => !x.done).map((x) => x.station));
      STATIONS.forEach((st, i) => drawStation(c, st.x, st.y, mine.has(i), t));
      for (const d of DOORS) if (s.closedDoors.includes(d.room)) drawDoor(c, d, t);
      const sab = s.stage === 'PLAY' ? s.sabotage : null;
      const fixes = sab ? Object.entries(FIX_POINTS).filter(([k, fp]) => fp.kind === sab.kind && !sab.fixed.includes(k)) : [];
      for (const [k, fp] of fixes) drawFixPoint(c, fp.x, fp.y, t, !!sab?.holders[k]);
      const btnWait = Math.ceil((s.buttonReadyAt - (Date.now() + offsetRef.current)) / 1000);
      if (s.stage === 'PLAY' && btnWait > 0) drawPill(c, BUTTON.x, BUTTON.y - 96, `Riunione tra ${btnWait}s`);
      // si vede solo ciò che è entro il raggio E senza muri in mezzo
      const visible = (x: number, y: number) => isGhost || (Math.hypot(x - pos.x, y - pos.y) <= vision + 30 && lineOfSight(pos, { x, y }));
      for (const b of s.bodies) if (visible(b.x, b.y)) drawBody(c, imgs.current.crew, color(b.id), b.x, b.y, t);
      // dal più lontano al più vicino, così chi sta "davanti" copre chi sta dietro
      const crowd = [...smooth.current].filter(([, p]) => visible(p.x, p.y)).map(([id, p]) => ({ id, ...p, dead: s.dead.includes(id) }));
      if (s.role !== 'SPECTATOR') crowd.push({ id: myId, ...pos, dead: !s.alive });
      crowd.sort((x, y) => x.y - y.y);
      for (const p of crowd) drawCrew(c, imgs.current.crew, color(p.id), p.x, p.y, p.f, !!p.m, t, p.dead);
      for (const p of crowd) {
        const name = players.find((x) => x.id === p.id)?.name ?? '';
        const impostorMate = s.role === 'IMPOSTOR' && s.impostors?.includes(p.id);
        drawName(c, name, p.x, p.y, impostorMate ? '#ff5f88' : '#ffffff');
      }

      // buio fuori dal raggio visivo (i fantasmi vedono tutto)
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!isGhost) {
        const poly = visionPolygon(pos.x, pos.y, vision);
        const path = () => {
          c.beginPath();
          for (let i = 0; i < poly.length; i += 2) {
            const sx = W / 2 + (poly[i] - pos.x) * zoom;
            const sy = H / 2 + (poly[i + 1] - pos.y) * zoom;
            if (i) c.lineTo(sx, sy);
            else c.moveTo(sx, sy);
          }
          c.closePath();
        };
        // fuori dalla zona visibile: buio (resta solo un'ombra della mappa)
        c.save();
        path();
        c.rect(W, 0, -W, H);
        c.fillStyle = 'rgba(8, 4, 30, 0.9)';
        c.fill('evenodd');
        c.restore();
        // dentro: bordo sfumato verso il limite della vista
        c.save();
        path();
        c.clip();
        const r = vision * zoom;
        const g = c.createRadialGradient(W / 2, H / 2, r * 0.7, W / 2, H / 2, r);
        g.addColorStop(0, 'rgba(8, 4, 30, 0)');
        g.addColorStop(1, 'rgba(8, 4, 30, 0.9)');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        c.restore();
      }
      // frecce verso i compiti fuori schermo (gialle) e verso i guasti da riparare (rosse)
      const arrow = (x: number, y: number, fill: string) => {
        const sx = W / 2 + (x - pos.x) * zoom;
        const sy = H / 2 + (y - pos.y) * zoom;
        if (sx > 30 && sx < W - 30 && sy > 70 && sy < H - 150) return;
        const ang = Math.atan2(sy - H / 2, sx - W / 2);
        const ex = Math.max(28, Math.min(W - 28, W / 2 + Math.cos(ang) * (W / 2 - 34)));
        const ey = Math.max(84, Math.min(H - 170, H / 2 + Math.sin(ang) * (H / 2 - 34)));
        c.save();
        c.translate(ex, ey);
        c.rotate(ang);
        c.fillStyle = fill;
        c.strokeStyle = '#2c1577';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(14, 0);
        c.lineTo(-10, -11);
        c.lineTo(-4, 0);
        c.lineTo(-10, 11);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      };
      if (s.sabotage?.kind !== 'comms') for (const i of mine) arrow(STATIONS[i].x, STATIONS[i].y, '#ffe21f');
      if (s.alive) for (const [, fp] of fixes) arrow(fp.x, fp.y, t % 500 < 250 ? '#ff3b3b' : '#ffb0b0');

      // cosa ho vicino (per accendere i pulsanti)
      if (t - lastNear > 120) {
        lastNear = t;
        let task: number | null = null;
        if (s.stage === 'PLAY' && (s.role === 'CREW' || (s.role === 'IMPOSTOR' && s.alive)))
          s.tasks.forEach((x, i) => {
            if (!x.done && dist(pos, STATIONS[x.station]) <= TASK_RANGE) task = i;
          });
        const critical = !!s.sabotage && SABOTAGE_INFO[s.sabotage.kind].critical;
        const button = s.stage === 'PLAY' && s.alive && s.emergencies > 0 && !critical && dist(pos, BUTTON) <= BUTTON_RANGE;
        let fix: string | null = null;
        let door: string | null = null;
        if (s.stage === 'PLAY' && s.alive && s.role !== 'SPECTATOR') {
          for (const [k, fp] of fixes) if (dist(pos, fp) <= FIX_RANGE) fix = k;
          for (const d of DOORS) if (s.closedDoors.includes(d.room) && dist(pos, doorCenter(d)) <= 100) door = d.room;
        }
        const cams = s.stage === 'PLAY' && s.alive && s.role !== 'SPECTATOR' && dist(pos, CAMERA_CONSOLE) <= CONSOLE_RANGE;
        const body = s.stage === 'PLAY' && s.alive ? s.bodies.find((b) => dist(pos, b) <= REPORT_RANGE)?.id ?? null : null;
        let target: string | null = null;
        if (s.stage === 'PLAY' && s.role === 'IMPOSTOR' && s.alive) {
          let best = KILL_RANGE + 1;
          for (const [id, p] of smooth.current) {
            if (s.impostors?.includes(id) || s.dead.includes(id)) continue;
            const d = dist(pos, p);
            if (d < best) {
              best = d;
              target = id;
            }
          }
        }
        const vent = s.stage === 'PLAY' && s.role === 'IMPOSTOR' && s.alive ? VENTS.findIndex((v) => dist(pos, v) <= VENT_RANGE) : -1;
        const n = nearRef.current;
        const ventNear = vent >= 0 ? vent : null;
        if (n.task !== task || n.button !== button || n.body !== body || n.target !== target || n.vent !== ventNear || n.fix !== fix || n.door !== door || n.cams !== cams)
          setNear({ task, button, body, target, vent: ventNear, fix, door, cams });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  actions.current.use = () => {
    const n = nearRef.current;
    if (dataRef.current.stage !== 'PLAY' || busy.current) return;
    if (n.fix) setRepair({ point: n.fix, room: null });
    else if (n.door) setRepair({ point: null, room: n.door });
    else if (n.task !== null) setTaskOpen(n.task);
    else if (n.cams) {
      setCamsOpen(true);
      onAction('MG_CAMS', { on: true });
    } else if (n.button && Date.now() + clockOffset >= dataRef.current.buttonReadyAt) onAction('MG_BUTTON');
  };
  const closeCams = () => {
    setCamsOpen(false);
    onAction('MG_CAMS', { on: false });
  };
  actions.current.sabotage = () => {
    const s = dataRef.current;
    if (s.stage === 'PLAY' && s.role === 'IMPOSTOR' && !taskOpen && !repair) setSabOpen((v) => !v);
  };
  actions.current.report = () => {
    const n = nearRef.current;
    if (n.body) onAction('MG_REPORT', { body: n.body });
  };
  actions.current.kill = () => {
    const n = nearRef.current;
    const s = dataRef.current;
    if (n.target && s.killReadyAt && Date.now() + clockOffset >= s.killReadyAt) onAction('MG_KILL', { target: n.target });
  };

  const meetingLeft = useCountdown(a.stage === 'MEETING' ? a.stageEndsAt : null, clockOffset);
  const discussLeft = a.stage === 'MEETING' && a.meeting ? Math.max(0, Math.ceil((a.meeting.voteFrom - (Date.now() + clockOffset)) / 1000)) : 0;
  void tick;
  const killLeft = a.killReadyAt ? Math.max(0, Math.ceil((a.killReadyAt - (Date.now() + clockOffset)) / 1000)) : 0;
  const secsTo = (at: number | null | undefined) => (at ? Math.max(0, Math.ceil((at - (Date.now() + clockOffset)) / 1000)) : 0);
  const sabWait = secsTo(a.sabotageReadyAt);
  const doorWait = secsTo(a.doorsReadyAt);
  const sabNext = Math.min(a.sabotage ? Infinity : sabWait, doorWait);
  const sabLeft = secsTo(a.sabotage?.endsAt);
  const btnWait = secsTo(a.buttonReadyAt);
  // il pulsante USA cambia in base a cosa c'è vicino (stessa priorità di actions.use)
  const useMode = near.fix ? 'fix' : near.door ? 'door' : near.task !== null ? 'task' : near.cams ? 'cams' : near.button ? 'button' : 'none';
  const USE_LOOK = {
    fix: { label: 'RIPARA', icon: <Wrench size={26} />, color: '#e0262f' },
    door: { label: 'APRI', icon: <DoorOpen size={26} />, color: '#f0a500' },
    task: { label: 'USA', icon: <Hand size={26} />, color: '#f0a500' },
    cams: { label: 'CAMERE', icon: <Cctv size={26} />, color: '#2f6bff' },
    button: { label: 'RIUNIONE', icon: <Siren size={26} />, color: '#f0a500' },
    none: { label: 'USA', icon: <Hand size={26} />, color: '#f0a500' },
  }[useMode];
  const comms = a.stage === 'PLAY' && a.sabotage?.kind === 'comms';
  const critical = a.stage === 'PLAY' && !!a.sabotage && SABOTAGE_INFO[a.sabotage.kind].critical;
  const thumb = (id: string) => (crewReady && ready(imgs.current.crew) ? thumbFor(imgs.current.crew, colorOf(id)) : null);
  const room = roomAt(me.current.x, me.current.y);

  // ---------------- fine partita
  if (a.stage === 'END') {
    const crewWin = a.winner === 'CREW';
    return (
      <div className="stagger flex flex-col gap-4">
        <section className={`pop flex flex-col items-center gap-2 rounded-3xl border-4 border-white/90 p-6 text-center shadow-[0_8px_0_rgba(22,6,72,0.5)] ${crewWin ? 'bg-linear-to-br from-cyan-500 to-slate-800' : 'bg-linear-to-br from-red-500 to-slate-900'}`}>
          <p className="text-6xl">{crewWin ? '🧑‍🚀' : '😈'}</p>
          <p className="font-display text-4xl leading-tight text-white">{crewWin ? "Vince l'equipaggio!" : 'Vincono gli impostori!'}</p>
          <p className="font-bold text-white/90">{a.winReason}</p>
        </section>
        <section className="rounded-3xl border-2 border-white/10 bg-slate-900 p-4">
          <p className="mb-3 text-center text-sm font-black uppercase tracking-widest text-red-300">{(a.impostors?.length ?? 0) > 1 ? 'Gli impostori erano' : "L'impostore era"}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {(a.impostors ?? []).map((id) => (
              <div key={id} className="reveal-pop flex flex-col items-center gap-1">
                {thumb(id) ? <img src={thumb(id)!} alt="" className="h-24" /> : <span className="h-20 w-16 rounded-full" style={{ background: colorOf(id) }} />}
                <span className="font-display text-xl text-white">{P(id)?.name ?? '?'}</span>
              </div>
            ))}
          </div>
        </section>
        <EndBar canLead={canLead} hostName={P(state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const meetingPlayers = a.order.map((id) => ({ id, name: P(id)?.name ?? '?', dead: a.dead.includes(id) }));
  const ej = a.ejected;
  const tasksDone = a.tasks.filter((t) => t.done).length;

  return (
    <div ref={wrapRef} className="fixed inset-x-0 bottom-0 top-14 z-20 select-none overflow-hidden bg-[#0b0623] [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      {critical && <div className="alarm-vignette pointer-events-none absolute inset-0" />}

      {/* Barra dei compiti e pulsanti in alto */}
      <div className="absolute inset-x-3 top-3 flex items-start gap-2">
        <div className="min-w-0 flex-1 rounded-2xl bg-slate-950/75 p-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-200">
            <span>Compiti dell'equipaggio</span>
            <span>{comms ? '📡 ???' : `${Math.round(a.taskProgress * 100)}%`}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-lime-300 transition-[width] duration-1000" style={{ width: `${comms ? 0 : a.taskProgress * 100}%` }} />
          </div>
          <p className="mt-1 truncate text-xs font-bold text-white">
            {a.role === 'IMPOSTOR' ? '😈 Sei l’impostore: elimina senza farti scoprire' : ghost ? '👻 Sei un fantasma: puoi ancora fare i compiti' : `🧑‍🚀 ${room?.name ?? 'Corridoio'}`}
          </p>
        </div>
        <button type="button" onClick={() => setListOpen((v) => !v)} aria-label="I miei compiti" className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950/75 text-white backdrop-blur">
          <ListChecks size={22} />
        </button>
        <button type="button" onClick={() => setMapOpen(true)} aria-label="Mappa" className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950/75 text-white backdrop-blur">
          <MapIcon size={22} />
        </button>
      </div>

      {a.stage === 'PLAY' && a.sabotage && <SabotageBanner sab={a.sabotage} left={sabLeft} />}

      {listOpen && (
        <div className="pop absolute right-3 top-[76px] z-10 w-64 rounded-2xl bg-slate-950/90 p-3 text-sm font-bold text-white backdrop-blur">
          <p className="mb-1 font-display text-base text-amber-300">
            {a.role === 'IMPOSTOR' ? 'Compiti finti (per bluffare)' : `I miei compiti ${tasksDone}/${a.tasks.length}`}
          </p>
          {comms ? (
            <p className="text-slate-300">📡 Nessun segnale: la lista torna quando riparate le comunicazioni.</p>
          ) : (
          <ul className="flex flex-col gap-0.5">
            {a.tasks.map((t, i) => {
              const st = STATIONS[t.station];
              return (
                <li key={i} className={t.done ? 'text-emerald-300 line-through' : ''}>
                  {t.done ? '✓' : '•'} {ROOMS.find((r) => r.id === st.room)?.name}: {st.title}
                </li>
              );
            })}
          </ul>
          )}
        </div>
      )}

      {/* Comandi */}
      {/* Telecamere accese: niente comandi, solo il pulsante per chiudere */}
      {camsOpen && a.stage === 'PLAY' && (
        <div className="absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] flex justify-center">
          <button type="button" onClick={closeCams} className="flex h-14 items-center gap-2 rounded-2xl border-2 border-white/20 bg-slate-950/90 px-6 text-lg font-black text-white">
            <X size={20} /> Chiudi le telecamere
          </button>
        </div>
      )}

      {a.stage === 'PLAY' && a.role !== 'SPECTATOR' && !camsOpen && (
        <>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-4">
            <Joystick onMove={(x, y) => (joy.current = { x, y })} />
          </div>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-4 flex w-[162px] flex-wrap-reverse justify-end gap-2.5">
            {a.role === 'IMPOSTOR' && a.alive && (
              <ActionButton
                label="ELIMINA"
                icon={<Skull size={26} />}
                color="#c51246"
                enabled={!!near.target && killLeft === 0}
                onPress={() => actions.current.kill()}
                badge={killLeft > 0 ? String(killLeft) : null}
              />
            )}
            {a.role !== 'IMPOSTOR' && a.alive && <ActionButton label="SEGNALA" icon={<Megaphone size={26} />} color="#eb1f57" enabled={!!near.body} onPress={() => actions.current.report()} />}
            <ActionButton
              label={USE_LOOK.label}
              icon={USE_LOOK.icon}
              color={USE_LOOK.color}
              enabled={useMode !== 'none' && !(useMode === 'button' && btnWait > 0)}
              onPress={() => actions.current.use()}
              badge={useMode === 'button' && btnWait > 0 ? String(btnWait) : null}
            />
            {a.role === 'IMPOSTOR' && a.alive && <ActionButton label="SEGNALA" icon={<Megaphone size={26} />} color="#eb1f57" enabled={!!near.body} onPress={() => actions.current.report()} />}
            {a.role === 'IMPOSTOR' && a.alive && (
              <ActionButton label="BOTOLA" icon={<ArrowDownToLine size={26} />} color="#5a5770" enabled={near.vent !== null} onPress={() => near.vent !== null && setVentOpen(near.vent)} />
            )}
            {a.role === 'IMPOSTOR' && (
              <ActionButton label="SABOTA" icon={<Zap size={26} />} color="#7a1fd1" enabled onPress={() => actions.current.sabotage()} badge={sabNext > 0 ? String(sabNext) : null} />
            )}
          </div>
          {!coarse && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-bold text-slate-200">
              WASD / frecce · E usa · R segnala{a.role === 'IMPOSTOR' ? ' · Q elimina · F sabota' : ''} · M mappa
            </p>
          )}
        </>
      )}

      {/* Botola: dove sbucare */}
      {ventOpen !== null && a.stage === 'PLAY' && (
        <div className="sheet-backdrop absolute inset-0 z-40 flex items-end justify-center bg-black/50 p-4" onPointerDown={(e) => e.target === e.currentTarget && setVentOpen(null)}>
          <div className="sheet w-full max-w-sm rounded-3xl border-2 border-white/15 bg-slate-900 p-4">
            <p className="mb-3 text-center font-display text-2xl text-white">🕳️ Sbuca in…</p>
            <div className="flex flex-col gap-2">
              {VENTS[ventOpen].links.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    onAction('MG_VENT', { from: ventOpen, to });
                    setVentOpen(null);
                  }}
                  className="h-14 rounded-2xl bg-slate-700 text-lg font-black text-white"
                >
                  {ROOMS.find((r) => r.id === VENTS[to].room)?.name}
                </button>
              ))}
              <button type="button" onClick={() => setVentOpen(null)} className="h-11 rounded-2xl text-sm font-bold text-slate-300">
                Resta qui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sabotaggi (solo l'impostore) */}
      {sabOpen && a.stage === 'PLAY' && a.role === 'IMPOSTOR' && (
        <div className="sheet-backdrop absolute inset-0 z-40 flex items-end justify-center bg-black/55 p-3" onPointerDown={(e) => e.target === e.currentTarget && setSabOpen(false)}>
          <div className="sheet max-h-full w-full max-w-md overflow-y-auto rounded-3xl border-2 border-violet-400/40 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl text-white">⚡ Sabota</h3>
              <button type="button" onClick={() => setSabOpen(false)} aria-label="Chiudi" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-white">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['reactor', 'o2', 'lights', 'comms'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!!a.sabotage || sabWait > 0}
                  onClick={() => {
                    onAction('MG_SABOTAGE', { kind: k });
                    setSabOpen(false);
                  }}
                  className={`flex h-20 flex-col items-center justify-center rounded-2xl font-black text-white disabled:opacity-40 ${SABOTAGE_INFO[k].critical ? 'bg-red-600' : 'bg-violet-700'}`}
                >
                  <span className="text-3xl leading-none">{SABOTAGE_INFO[k].icon}</span>
                  <span className="mt-1 text-sm">{SABOTAGE_SHORT[k]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs font-bold text-slate-400">
              {a.sabotage ? 'C’è già un guasto in corso' : sabWait > 0 ? `Di nuovo pronto tra ${sabWait}s` : 'Reattore e ossigeno: se non riparano in 45 secondi, vincete voi!'}
            </p>
            <p className="mb-2 mt-4 font-display text-lg text-white">🚪 Chiudi le porte {doorWait > 0 ? `(tra ${doorWait}s)` : ''}</p>
            <div className="grid grid-cols-2 gap-2">
              {ROOMS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={doorWait > 0 || a.closedDoors.includes(r.id)}
                  onClick={() => {
                    onAction('MG_SABOTAGE', { kind: 'doors', room: r.id });
                    setSabOpen(false);
                  }}
                  className="h-11 rounded-xl bg-slate-700 text-sm font-black text-white disabled:opacity-40"
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Riparazione: guasto o porta bloccata */}
      {repair && a.stage === 'PLAY' && (
        <AstroTask
          type={repair.point ? REPAIR_TYPE[FIX_POINTS[repair.point].kind] : 'DOOR'}
          title={repair.point ? FIX_POINTS[repair.point].label : `Sblocca la porta (${ROOMS.find((r) => r.id === repair.room)?.name})`}
          reactor={
            repair.point && FIX_POINTS[repair.point].kind === 'reactor'
              ? { other: !!a.sabotage?.holders[repair.point === 'ra' ? 'rb' : 'ra'], onHold: (on) => onAction('MG_HOLD', { point: repair.point, on }) }
              : undefined
          }
          onClose={() => setRepair(null)}
          onDone={() => {
            if (repair.point) onAction('MG_FIX', { point: repair.point });
            else onAction('MG_DOOR', { room: repair.room });
            setRepair(null);
          }}
        />
      )}

      {/* Compito aperto */}
      {taskOpen !== null && a.tasks[taskOpen] && (
        <AstroTask
          type={STATIONS[a.tasks[taskOpen].station].type}
          title={STATIONS[a.tasks[taskOpen].station].title}
          onClose={() => setTaskOpen(null)}
          onDone={() => {
            onAction('MG_TASK', { i: taskOpen });
            setTaskOpen(null);
          }}
        />
      )}

      {/* Mappa */}
      {mapOpen && (
        <div className="sheet-backdrop absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3" onPointerDown={(e) => e.target === e.currentTarget && setMapOpen(false)}>
          <div className="sheet w-full max-w-lg rounded-3xl border-2 border-white/15 bg-slate-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xl text-white">🗺️ Mappa dell'astronave</h3>
              <button type="button" onClick={() => setMapOpen(false)} aria-label="Chiudi" className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-white">
                <X size={18} />
              </button>
            </div>
            <svg viewBox={`-40 -40 ${WORLD.w + 80} ${WORLD.h + 80}`} className="w-full">
              {CORRIDORS.map((k, i) => (
                <rect key={i} x={k.x} y={k.y} width={k.w} height={k.h} fill="#5a46b8" />
              ))}
              {ROOMS.map((r) => (
                <g key={r.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="22" fill="#8166e0" />
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2} fill="#f1ebff" fontSize="32" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                    {r.name}
                  </text>
                </g>
              ))}
              {DOORS.filter((d) => a.closedDoors.includes(d.room)).map((d, i) => (
                <rect key={`d${i}`} x={d.x - 8} y={d.y - 8} width={d.w + 16} height={d.h + 16} rx="6" fill="#ff3b3b" />
              ))}
              {a.sabotage &&
                Object.entries(FIX_POINTS)
                  .filter(([k, fp]) => fp.kind === a.sabotage!.kind && !a.sabotage!.fixed.includes(k))
                  .map(([k, fp]) => <circle key={k} cx={fp.x} cy={fp.y} r="34" fill="none" stroke="#ff3b3b" strokeWidth="12" />)}
              {a.tasks.map((t, i) =>
                comms || t.done ? null : (
                  <text key={i} x={STATIONS[t.station].x} y={STATIONS[t.station].y} fill="#ffe21f" fontSize="52" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                    !
                  </text>
                ),
              )}
              <circle cx={BUTTON.x} cy={BUTTON.y} r="17" fill="#ff3b3b" />
              <text x={CAMERA_CONSOLE.x} y={CAMERA_CONSOLE.y} fontSize="46" textAnchor="middle" dominantBaseline="middle">
                📹
              </text>
              {a.role === 'IMPOSTOR' && VENTS.map((v, i) => <rect key={i} x={v.x - 16} y={v.y - 16} width="32" height="32" rx="5" fill="#9a97b0" />)}
              <circle cx={me.current.x} cy={me.current.y} r="26" fill={colorOf(myId)} stroke="#fff" strokeWidth="10" />
            </svg>
          </div>
        </div>
      )}

      {/* Inizio: il ruolo (stesso sfondo e stesso suono per tutti) */}
      {a.stage === 'INTRO' && (
        <div className="sheet-backdrop absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,#2c1577,#0b0623)] p-6 text-center">
          <p className="pop font-display text-2xl text-slate-300">Shhh… 🤫</p>
          {thumb(myId) && <img src={thumb(myId)!} alt="" className="reveal-pop h-36" />}
          <p className="reveal-pop font-display text-4xl leading-tight text-white" style={{ animationDelay: '0.3s' }}>
            {a.role === 'IMPOSTOR' ? "Sei l'IMPOSTORE" : 'Sei dell’equipaggio'}
          </p>
          <p className="max-w-xs font-bold text-slate-200">
            {a.role === 'IMPOSTOR'
              ? (a.impostors?.length ?? 0) > 1
                ? `Insieme a ${a.impostors!.filter((id) => id !== myId).map((id) => P(id)?.name).join(', ')}. Eliminate l'equipaggio senza farvi scoprire.`
                : "Elimina l'equipaggio senza farti scoprire. Fingi di fare i compiti!"
              : `Fai i tuoi compiti e scopri ${a.impostorCount > 1 ? `i ${a.impostorCount} impostori` : "l'impostore"} tra voi.`}
          </p>
        </div>
      )}

      {/* Eliminato */}
      {deathNote && (
        <div className="sheet-backdrop absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center">
          <p className="reveal-pop text-7xl">💀</p>
          <p className="font-display text-3xl text-white">Sei stato eliminato!</p>
          <p className="font-bold text-slate-200">Ti ha preso {deathNote}. Ora sei un fantasma: non puoi parlare, ma puoi finire i tuoi compiti.</p>
        </div>
      )}

      {/* Riunione */}
      {a.stage === 'MEETING' && a.meeting && (
        <div className="sheet-backdrop absolute inset-0 z-30 overflow-y-auto bg-[radial-gradient(circle_at_top,#5a35e0,#1b0b4d)] p-4">
          <div className="mx-auto flex max-w-md flex-col gap-3 pb-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display text-3xl leading-tight text-white">{a.meeting.body ? '📢 Corpo trovato!' : '🚨 Riunione d’emergenza'}</p>
                <p className="text-sm font-bold text-slate-200">
                  {P(a.meeting.caller)?.name} {a.meeting.body ? `ha trovato ${P(a.meeting.body)?.name}` : 'ha premuto il pulsante'}. Discutete a voce e votate!
                </p>
              </div>
              <TimerRing left={meetingLeft} total={a.meetingSeconds + 10} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {meetingPlayers.map((p) => {
                const voted = a.meeting!.voted.includes(p.id);
                const mineVote = a.meeting!.myVote === p.id;
                const canVote = a.alive && !a.meeting!.myVote && !p.dead && discussLeft === 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!canVote}
                    onClick={() => onAction('MG_VOTE', { target: p.id })}
                    className={`relative flex items-center gap-2 rounded-2xl border-2 p-2 text-left disabled:opacity-100 ${mineVote ? 'border-amber-300 bg-amber-400/25' : 'border-white/10 bg-slate-900'} ${p.dead ? 'opacity-45' : ''}`}
                  >
                    {thumb(p.id) ? <img src={thumb(p.id)!} alt="" className="h-12 w-10 object-contain" /> : <span className="h-10 w-10 rounded-full" style={{ background: colorOf(p.id) }} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-white">{p.name}</span>
                      <span className="block text-[11px] font-bold text-slate-300">{p.dead ? '💀 eliminato' : voted ? '✅ ha votato' : 'sta pensando…'}</span>
                    </span>
                    {p.id === a.meeting!.caller && <span className="absolute -right-1 -top-2 text-xl">📢</span>}
                  </button>
                );
              })}
            </div>
            {discussLeft > 0 ? (
              <p className="pop rounded-2xl bg-amber-400 py-3 text-center font-display text-xl text-slate-950">🗣️ Discutete! Si vota tra {discussLeft}…</p>
            ) : a.alive && !a.meeting.myVote ? (
              <button type="button" onClick={() => onAction('MG_VOTE', { target: 'skip' })} className="h-14 rounded-2xl bg-slate-700 text-lg font-black text-white">
                Salta il voto
              </button>
            ) : (
              <p className="rounded-2xl bg-slate-950/60 py-3 text-center font-bold text-slate-200">
                {a.alive ? 'Voto inviato: aspettiamo gli altri…' : 'Sei un fantasma: guardi in silenzio 👻'}
              </p>
            )}
            {canLead && (
              <button type="button" onClick={onForce} className="mx-auto rounded-full bg-slate-950/60 px-4 py-2 text-sm font-bold text-amber-200">
                Chiudi la votazione
              </button>
            )}
          </div>
        </div>
      )}

      {/* Espulsione */}
      {a.stage === 'EJECT' && (
        <div className="sheet-backdrop absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-hidden bg-[#05020f] p-6 text-center">
          {STARS.slice(0, 60).map((st, i) => (
            <span key={i} className="absolute h-1 w-1 rounded-full bg-white/70" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }} />
          ))}
          {ej?.id && thumb(ej.id) && <img src={thumb(ej.id)!} alt="" className="eject-fly h-28" />}
          <p className="relative font-display text-3xl leading-tight text-white">
            {ej?.id ? `${P(ej.id)?.name} è stato espulso.` : ej?.reason === 'TIE' ? 'Pareggio: nessuno espulso.' : 'Nessuno è stato espulso.'}
          </p>
          {ej?.id && (
            <p className={`reveal-pop relative font-display text-2xl ${ej.wasImpostor ? 'text-red-300' : 'text-cyan-200'}`} style={{ animationDelay: '1.2s' }}>
              {ej.wasImpostor ? 'Era un impostore! 😈' : 'Non era un impostore… 😬'}
            </p>
          )}
          <p className="reveal-pop relative font-bold text-slate-300" style={{ animationDelay: '1.8s' }}>
            {a.impostorsLeft === 1 ? 'Resta 1 impostore.' : `Restano ${a.impostorsLeft} impostori.`}
          </p>
        </div>
      )}
    </div>
  );
}
