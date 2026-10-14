// Axend Party: il videogioco 3D a minigiochi.
// Il mio personaggio si muove subito sul telefono (fisica locale), gli altri e i bot arrivano dal server ~15 volte al secondo.
// Telecamera in terza persona che si gira trascinando (sensibilità regolabile), il cecchino gioca in prima persona.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import type { PartyView as PartyData } from '../types/game';
import {
  ANIM,
  CHAIRS,
  DENTE,
  DOOR_ROWS,
  FRUIT_NAMES,
  HEX_N,
  HEX_TILES,
  MARKET,
  MINIGAMES,
  MINIS,
  noDash,
  noDoubleJump,
  noPush,
  PHYS,
  PITCH,
  PLAZA,
  POINTS,
  RACE,
  RACE_CP,
  SLOPE,
  SNIPER,
  TEAM_COLORS,
  TEAM_NAMES,
  WAFER,
  YARD,
  doorX,
  newBody,
  setBrokenTiles,
  setFruitOpen,
  setHexState,
  setOpenDoors,
  sniperEye,
  stepBody,
  waferY,
  type BaseKind,
  type Body,
  type MiniKind,
  type NetPos,
} from '../data/party3d';
import { CLIENT_MINIS, type ClientMini, type FxCtx, type HudCtx, type MiniFrame } from './party3d/minis/types';
import './party3d/minis'; // registra i minigiochi a moduli
import { haptic, soundManager } from '../utils/audio';
import { animateAvatar, buildArena, burst, createWorld, dust, makeAvatar, makeBomb, makeGun, makeHen, makeSoccerBall, makeTomato, poof, popText, ringPulse, splat, tracer, updateFx, type Avatar, type World } from './party3d/scene';
import { FruitIcon, MiniIcon, Sticker, UiIcon, pickPhrase, type StickerMood } from './party3d/icons';
import { useGameFullscreen, EndBar, type ModeProps } from './ui';

// ---------------------------------------------------------------- preferenze (sensibilità, grafica)

type Quality = 'auto' | 'alta' | 'bassa';
type CamMode = 'segue' | 'libera';
// sul telefono la telecamera segue da sola chi gira; sul PC si guarda col mouse
const CAM_DEFAULT: CamMode = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'segue' : 'libera';
type Prefs = { sens: number; quality: Quality; cam: CamMode };
const PREFS_KEY = 'axend_party_prefs';
function loadPrefs(): Prefs {
  try {
    return { sens: 1, quality: 'auto', cam: CAM_DEFAULT, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { sens: 1, quality: 'auto', cam: CAM_DEFAULT };
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // memoria del browser non disponibile
  }
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
    const k = len / max < 0.12 ? 0 : 1;
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
      className="relative grid h-32 w-32 touch-none place-items-center rounded-full border-4 border-[#1d0f3d]/70 bg-[#1d0f3d]/35 backdrop-blur-sm landscape:h-36 landscape:w-36"
      onPointerDown={(e) => {
        e.stopPropagation();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="sc-btn sc-yellow h-14 w-14 !rounded-full" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

const IS_PC = typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches;
function GameButton({ icon, label, cls, size = 84, onPress, disabled, children, keyHint }: { icon: ReactNode; label: string; cls: string; size?: number; onPress: () => void; disabled?: boolean; children?: ReactNode; keyHint?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onPress();
      }}
      className={`sc-btn ${cls} relative flex flex-col items-center justify-center !rounded-full ${disabled ? 'opacity-45' : ''}`}
      style={{ width: size, height: size }}
    >
      {icon}
      <span className="sc-stroke-sm mt-0.5 font-display text-[13px] leading-none text-white">{label}</span>
      {children}
      {IS_PC && keyHint && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-[#1d0f3d] bg-white px-1.5 font-display text-[11px] leading-[16px] text-[#1d0f3d] shadow">{keyHint}</span>
      )}
    </button>
  );
}

// Mini personaggio a blocchetti per classifiche e podio
function MiniAvatar({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <rect x="9" y="24" width="22" height="18" rx="5" fill={color} stroke="#1d0f3d" strokeWidth="3" />
      <rect x="7" y="3" width="26" height="23" rx="8" fill="#ffd23f" stroke="#1d0f3d" strokeWidth="3" />
      <ellipse cx="15" cy="14" rx="3" ry="4" fill="#1d0f3d" />
      <ellipse cx="25" cy="14" rx="3" ry="4" fill="#1d0f3d" />
      <path d="M15 20 Q20 24 25 20" stroke="#1d0f3d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Pill({ cls, children }: { cls: string; children: ReactNode }) {
  return <p className={`sc-btn pop px-5 py-1.5 font-display text-xl tracking-wide text-white ${cls}`}>{children}</p>;
}

const FEED: Record<string, string[]> = {
  caduto: ['{n} è volato giù', '{n} ha fatto il tuffo', '{n} saluta tutti dal basso'],
  mosso: ['la bambola ha beccato {n}', '{n} si è mosso col rosso'],
  'in piedi': ['niente sedia per {n}', '{n} è rimasto in piedi'],
  colpito: ['{n} centrato in pieno', 'headshot su {n}'],
  tempo: ['{n} troppo lento'],
  ciabatta: ['{n} schiacciato dalla ciabatta', 'la nonna ha punito {n}'],
  petardo: ['{n} è saltato in aria', 'BOOM: addio {n}', '{n} ha tenuto il petardo troppo'],
  offline: ['{n} è uscito'],
  uscito: ['{n} è uscito'],
  cioccolato: ['{n} è finito nel cioccolato', '{n} fa il bagno nella Nutella', 'niente più wafer per {n}'],
  frutta: ['{n} ha sbagliato frutto', '{n} non si ricordava', 'macedonia di {n}'],
};
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

// Musichette (sedie musicali, canzone della bambola)
const CHAIR_TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 988, 784, 659, 587];
const DOLL_TUNE = [392, 392, 440, 392, 523, 494, 0, 392, 392, 440, 392, 587, 523, 0];
const DENTE_TUNE = [196, 0, 247, 0, 196, 0, 262, 247];
const HIGH_CAM: MiniKind[] = ['SUMO', 'CHAIRS', 'NONNA', 'GALLINA', 'BOTTO', 'WAFER', 'FRUTTA', 'CALCIO'];
// minigiochi in cui la telecamera parte già girata come il personaggio (verso il centro dell'arena)
const FACE_SPAWN: MiniKind[] = ['DENTE', 'WAFER', 'CALCIO', 'POMODORI'];
const sec2 = (ms: number) => (ms / 1000).toFixed(2).replace('.', ',');
const ORBIT: Record<BaseKind, { c: [number, number, number]; r: number }> = {
  SUMO: { c: [0, 0, 0], r: 26 },
  REDLIGHT: { c: [0, 0, 2], r: 46 },
  CHAIRS: { c: [0, 0, 0], r: 23 },
  SNIPER: { c: [0, 0, -6], r: 44 },
  POLPETTE: { c: [0, 5, 2], r: 42 },
  NONNA: { c: [0, 0, 0], r: 25 },
  GALLINA: { c: [0, 0, 0], r: 27 },
  PONTE: { c: [0, 0, -6], r: 34 },
  BOTTO: { c: [0, 0, 0], r: 26 },
  DENTE: { c: [0, 6, 0], r: 25 },
  WAFER: { c: [0, -6, 0], r: 36 },
  FRUTTA: { c: [0, 0, 0], r: 29 },
  CALCIO: { c: [0, 0, 0], r: 34 },
  POMODORI: { c: [0, 0, 0], r: 28 },
  CORSA: { c: [0, 2, 50], r: 64 },
};

// minigiochi a moduli (null per quelli classici)
const cmOf = (kind: MiniKind): ClientMini | undefined => CLIENT_MINIS[kind as keyof typeof CLIENT_MINIS];
const orbitOf = (kind: MiniKind) => ORBIT[kind as BaseKind] ?? cmOf(kind)?.orbit ?? { c: [0, 0, 0] as [number, number, number], r: 30 };
const highCam = (kind: MiniKind) => HIGH_CAM.includes(kind) || !!cmOf(kind)?.highCam;
const faceSpawn = (kind: MiniKind) => FACE_SPAWN.includes(kind) || !!cmOf(kind)?.faceSpawn;

// telecamera che non passa dietro ai muri (minigiochi a moduli: world.camBlockers)
const camRay = new THREE.Raycaster();
const camFrom = new THREE.Vector3();
const camDir = new THREE.Vector3();

type Others = Map<string, { x: number; y: number; z: number; r: number; a: number; tx: number; ty: number; tz: number; tr: number; speed: number; vx?: number; vz?: number; lt?: number }>;

export default function PartyView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onLeave, realtime }: ModeProps) {
  const a = state.mg as PartyData;
  const myId = state.myId;
  const dataRef = useRef(a);
  dataRef.current = a;
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const rtLink = useRef(realtime);
  rtLink.current = realtime;
  const actRef = useRef(onAction);
  actRef.current = onAction;
  const now = () => Date.now() + offsetRef.current;

  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? a.roster.find((r) => r.id === id)?.name ?? '?';
  const colorOf = (id: string) => a.roster.find((r) => r.id === id)?.color ?? '#ffffff';
  const namesRef = useRef(nameOf);
  namesRef.current = nameOf;
  const colorsRef = useRef(colorOf);
  colorsRef.current = colorOf;

  const [prefs, setPrefs] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [volume, setVolume] = useState(Math.round(soundManager.volume * 100));
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [sticker, setSticker] = useState<{ mood: StickerMood; text: string; key: number } | null>(null);
  const [feed, setFeed] = useState<{ key: number; text: string; at: number }[]>([]);
  const [goFlash, setGoFlash] = useState(false);
  const [, setTick] = useState(0);
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);
  useGameFullscreen();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const me = useRef<Body>(newBody(a.spawn?.x ?? 0, a.spawn?.z ?? 0, a.spawn?.r ?? 0, a.spawn?.y ?? 0));
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const jumpQ = useRef(false);
  const pushAnimUntil = useRef(0);
  const pushReady = useRef(0);
  const reloadUntil = useRef(0);
  const dashQ = useRef(false);
  const dashReady = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);
  // alcuni browser (es. l'anteprima dentro altre app) non permettono di "catturare" il mouse
  const [noLock, setNoLock] = useState(() => {
    const fp = (document as unknown as { featurePolicy?: { allowsFeature: (f: string) => boolean } }).featurePolicy;
    return fp ? !fp.allowsFeature('pointer-lock') : false;
  });
  const cam = useRef({ yaw: 0, pitch: 0.4, fy: Math.PI, fp: -0.3, shake: 0, kick: 0 });
  const drag = useRef<{ id: number; x: number; y: number; t: number; moved: number } | null>(null);
  const edgeRef = useRef<{ x: number; y: number } | null>(null);
  const lookRef = useRef<(dx: number, dy: number) => void>(() => {});
  const lastLookAt = useRef(0);
  const blindReady = useRef(0);
  const avatars = useRef(new Map<string, Avatar>());
  const others = useRef<Others>(new Map());
  // wafer: lo stato delle mattonelle (dal server + le briciole arrivate subito come effetti)
  const hexRef = useRef<{ round: number; view: string; arr: string[]; str: string; dirty: boolean }>({ round: -1, view: '', arr: [], str: '', dirty: false });
  const ballRef = useRef({ x: 0, y: PITCH.ballR, z: 0, seen: false });
  const toms = useRef(new Map<number, { m: THREE.Object3D; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }>());
  const throwReady = useRef(0);
  const stoppedRef = useRef('');
  const raceBest = useRef(-99);
  const [splatAt, setSplatAt] = useState(0);

  const sniper = a.snipers.includes(myId);
  const alive = !!a.alive[myId];
  const seated = !!a.chairs?.list.some((c) => c.by === myId);
  const finished = a.finished.includes(myId);
  const info = MINIGAMES[a.kind];

  // l'adesivo grande al centro (faccina + scritta) è spento: copriva il gioco. Restano scritte in 3D, cronaca e suoni
  const showSticker = (mood: StickerMood, text?: string) => void [mood, text];
  const pushFeed = (text: string) => setFeed((f) => [...f.slice(-3), { key: Date.now() + Math.random(), text, at: Date.now() }]);

  // orologio per i conti alla rovescia e per pulire la lista delle eliminazioni
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      setFeed((f) => (f.length && Date.now() - f[0].at > 4500 ? f.filter((x) => Date.now() - x.at < 4500) : f));
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!sticker) return;
    const tm = setTimeout(() => setSticker(null), 2500);
    return () => clearTimeout(tm);
  }, [sticker]);

  // niente scroll della pagina mentre si gioca
  useEffect(() => {
    if (a.stage === 'END') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [a.stage === 'END']);

  // azioni
  const jump = () => {
    const s = dataRef.current;
    const b = me.current;
    // a terra o doppio salto in aria
    if ((b.ground || ((b.airJumps ?? 0) < 1 && !b.dive && !noDoubleJump(s.kind))) && s.alive[myId] && !s.snipers.includes(myId) && (s.stage === 'PLAY' || s.stage === 'RESULT')) {
      jumpQ.current = true;
      soundManager.playJump();
    }
  };
  // scatto (a terra) o tuffo (in aria): per un attimo schivi spinte, mestolo e polpette
  const dash = () => {
    const s = dataRef.current;
    if (s.stage !== 'PLAY' || noDash(s.kind) || !s.alive[myId] || s.snipers.includes(myId) || Date.now() < dashReady.current) return;
    dashReady.current = Date.now() + PHYS.dashCooldown;
    dashQ.current = true;
    actRef.current('MG_DASH');
    soundManager.playWhoosh();
    haptic(25);
  };
  const push = () => {
    const s = dataRef.current;
    if (s.stage !== 'PLAY' || noPush(s.kind) || !s.alive[myId] || s.snipers.includes(myId) || Date.now() < pushReady.current) return;
    pushReady.current = Date.now() + PHYS.pushCooldown;
    pushAnimUntil.current = Date.now() + 350;
    const b = me.current;
    if (s.kind === 'CALCIO' && Math.hypot(ballRef.current.x - b.x, ballRef.current.z - b.z) < PITCH.kickRange + 0.5) {
      // TIRA: si mira con la telecamera (la palla parte tra lì e dove sta rispetto a me)
      b.r = cam.current.yaw;
      rtLink.current?.p3send({ ...b, a: ANIM.push });
      actRef.current('MG_PUSH');
      soundManager.playWhoosh();
      return;
    }
    // mira automatica: mi giro verso l'avversario più vicino davanti a me (o vicinissimo) e do uno slancio
    let best: { x: number; z: number; d: number } | null = null;
    for (const [id, o] of others.current) {
      if (!s.alive[id] || s.snipers.includes(id) || Math.abs(o.y - b.y) > 2) continue;
      const dx = o.x - b.x;
      const dz = o.z - b.z;
      const d = Math.hypot(dx, dz);
      const front = (dx * Math.sin(b.r) + dz * Math.cos(b.r)) / (d || 1);
      if ((d < 3.4 && front > -0.2) || d < 2) if (!best || d < best.d) best = { x: o.x, z: o.z, d };
    }
    if (best) b.r = Math.atan2(best.x - b.x, best.z - b.z);
    b.kx += Math.sin(b.r) * 5;
    b.kz += Math.cos(b.r) * 5;
    rtLink.current?.p3send({ ...b, a: ANIM.push });
    actRef.current('MG_PUSH');
    soundManager.playWhoosh();
  };
  const fire = () => {
    const s = dataRef.current;
    const w = worldRef.current;
    if (!w || s.stage !== 'PLAY' || !s.snipers.includes(myId) || Date.now() < reloadUntil.current) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), w.camera);
    const targets: THREE.Object3D[] = [...w.pickables];
    for (const [id, av] of avatars.current) if (id !== myId && av.root.visible) targets.push(av.body);
    const hit = ray.intersectObjects(targets, true)[0];
    let point = hit ? hit.point : ray.ray.at(90, new THREE.Vector3());
    // mira assistita: chi è vicino al centro del mirino (di più sul telefono, di meno con lo zoom)
    let want: string | null = null;
    let bestAng = (coarse ? 0.07 : 0.035) * (zoomRef.current ? 0.5 : 1);
    for (const [id, av] of avatars.current) {
      if (id === myId || !av.root.visible || !s.alive[id] || s.snipers.includes(id)) continue;
      const c = new THREE.Vector3();
      av.body.getWorldPosition(c);
      c.y += 0.4;
      const to = c.clone().sub(ray.ray.origin);
      const ang = to.angleTo(ray.ray.direction);
      if (ang < bestAng) {
        bestAng = ang;
        want = id;
        point = c;
      }
    }
    if (hit && !want) for (const [id, av] of avatars.current) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o !== av.body) o = o.parent;
      if (o) want = id;
    }
    reloadUntil.current = Date.now() + SNIPER.reload;
    cam.current.kick = 1;
    haptic(40);
    actRef.current('MG_SHOOT', { x: point.x, y: point.y, z: point.z, id: want });
  };
  // pasta al dente: SCOLA! (manda il mio tempo, misurato qui con l'orologio del server)
  const stop = () => {
    const s = dataRef.current;
    const D = s.dente;
    if (s.stage !== 'PLAY' || s.kind !== 'DENTE' || !D || D.phase !== 'GO' || !s.alive[myId]) return;
    const key = `${s.round}:${D.manche}`;
    const ms = Date.now() + offsetRef.current - D.startAt;
    if (ms < 0 || stoppedRef.current === key || D.stopped.includes(myId)) return;
    stoppedRef.current = key;
    actRef.current('MG_STOP', { ms });
    pushAnimUntil.current = Date.now() + 450;
    soundManager.playPop();
    haptic(35);
    const w = worldRef.current;
    if (w) popText(w, me.current.x, me.current.y, me.current.z, 'SCOLA!', '#ffd60a');
  };
  // pomodorata: lancio verso dove guarda la telecamera (con un piccolo aiuto se c'è qualcuno vicino alla mira)
  const throwT = () => {
    const s = dataRef.current;
    if (s.stage !== 'PLAY' || s.kind !== 'POMODORI' || !s.alive[myId] || Date.now() < throwReady.current) return;
    throwReady.current = Date.now() + MARKET.reload;
    const b = me.current;
    let a = cam.current.yaw;
    let best = coarse ? 0.7 : MARKET.assist;
    for (const [id, o] of others.current) {
      if (!s.alive[id] || o.y < -1) continue;
      // dove sarà quando arriva il pomodoro (posizione più recente + velocità, ritardo della rete compreso)
      const d0 = Math.hypot(o.tx - b.x, o.tz - b.z);
      const ft = d0 / MARKET.speed + 0.12;
      const px = o.tx + (o.vx ?? 0) * ft;
      const pz = o.tz + (o.vz ?? 0) * ft;
      const d = Math.hypot(px - b.x, pz - b.z);
      if (d > 17 || d < 0.5) continue;
      let da = Math.atan2(px - b.x, pz - b.z) - cam.current.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < best) {
        best = Math.abs(da);
        a = Math.atan2(px - b.x, pz - b.z);
      }
    }
    b.r = a;
    pushAnimUntil.current = Date.now() + 300;
    rtLink.current?.p3send({ ...b, a: ANIM.push });
    actRef.current('MG_THROW', { a });
    soundManager.playWhoosh();
    haptic(20);
  };
  const blind = () => {
    const s = dataRef.current;
    if (s.stage !== 'PLAY' || s.kind !== 'SNIPER' || s.snipers.includes(myId) || !s.alive[myId] || Date.now() < blindReady.current) return;
    blindReady.current = Date.now() + 7000;
    pushAnimUntil.current = Date.now() + 300;
    actRef.current('MG_ACCECA');
    haptic(20);
  };
  // minigiochi a moduli: quello che serve alle loro scritte e ai loro pulsanti
  const hudCtx = (): HudCtx => {
    const s = dataRef.current;
    return {
      view: s,
      ext: s.ext,
      myId,
      me: me.current,
      now: Date.now() + offsetRef.current,
      coarse,
      alive: !!s.alive[myId],
      finished: s.finished.includes(myId),
      yaw: cam.current.yaw,
      others: others.current,
      nameOf: (id) => namesRef.current(id),
      colorOf: (id) => colorsRef.current(id),
      act: (type, payload) => actRef.current(type, payload),
    };
  };
  const miniButton = () => {
    const c = cmOf(dataRef.current.kind);
    return c?.button && dataRef.current.stage === 'PLAY' && dataRef.current.alive[myId] ? c.button(hudCtx()) : null;
  };
  const actions = useRef({ jump, push, fire, dash, stop, throwT, blind, miniButton });
  actions.current = { jump, push, fire, dash, stop, throwT, blind, miniButton };
  // per le prove dalla console (solo chi ha creato la stanza): __party.prova('GALLINA')
  (window as unknown as { __party?: unknown }).__party = { prova: (kind: string) => actRef.current('MG_PROVA', { kind }), body: me.current, stato: () => dataRef.current };

  // tastiera (PC)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      keys.current.add(k);
      if (e.repeat) return;
      const s = dataRef.current;
      if (k === ' ') {
        if (s.snipers.includes(myId)) actions.current.fire();
        else if (s.kind === 'DENTE') actions.current.stop();
        else actions.current.jump();
      }
      if (s.kind === 'DENTE' && (k === 'w' || k === 'arrowup')) actions.current.jump();
      if (k === 'e' || k === 'f') {
        const mb = actions.current.miniButton();
        if (mb) {
          if (!mb.disabled) mb.press();
        } else if (s.kind === 'DENTE') actions.current.stop();
        else if (s.kind === 'POMODORI') actions.current.throwT();
        else if (s.kind === 'SNIPER' && !s.snipers.includes(myId)) actions.current.blind();
        else actions.current.push();
      }
      if (k === 'shift' || k === 'c') actions.current.dash();
      if (k === 'z' || k === 'q') setZoom((v) => !v);
      if (k === 'escape') setMenu((v) => !v);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // eventi dal server: spinte ricevute, eliminazioni, spari, ciabattate, gallina
  useEffect(() => {
    const link = realtime;
    if (!link) return;
    link.p3events.current = (type, p) => {
      const w = worldRef.current;
      const s = dataRef.current;
      if (type === 'P3_KNOCK') {
        const b = me.current;
        b.kx += p.vx;
        b.kz += p.vz;
        b.vy = Math.max(b.vy, p.vy);
        b.ground = false;
        cam.current.shake = 0.6;
        const mine = avatars.current.get(myId);
        if (mine) mine.shockUntil = performance.now() + 900;
        soundManager.playBonk();
        haptic(60);
        return;
      }
      if (!w) return;
      const where = (id: string) => (id === myId ? me.current : others.current.get(id));
      if (p.k === 'respawn') {
        // il server mi rimette in un punto (es. dopo una caduta)
        if (p.id === myId) {
          me.current = newBody(p.x, p.z, p.r ?? 0, p.y);
          cam.current.shake = Math.max(cam.current.shake, 0.3);
        } else {
          const o = others.current.get(p.id);
          if (o) Object.assign(o, { x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z });
        }
        return;
      }
      const cmx = cmOf(s.kind);
      if (cmx?.fx) {
        const fc: FxCtx = {
          world: w,
          myId,
          me: me.current,
          view: s,
          where,
          avatar: (id) => avatars.current.get(id),
          nameOf: (id) => namesRef.current(id),
          feed: pushFeed,
          sticker: (mood, text) => showSticker(mood, text),
          shake: (k) => (cam.current.shake = Math.max(cam.current.shake, k)),
        };
        cmx.fx(p, fc);
      }
      if (p.k === 'push') {
        const at = where(p.by);
        if (at) ringPulse(w, at.x, at.y, at.z, '#ffffff');
        for (const id of p.hit ?? []) {
          const av = avatars.current.get(id);
          if (av) av.shockUntil = performance.now() + 900;
          const tp = where(id);
          if (tp) popText(w, tp.x, tp.y, tp.z, pick(['SBAM!', 'PAF!', 'SCIAFF!', 'BONK!']), '#ffd60a');
        }
        if (p.hit?.length) {
          soundManager.playBonk();
          if (p.by === myId) cam.current.shake = Math.max(cam.current.shake, 0.25);
        }
      } else if (p.k === 'dodge') {
        const at = where(p.id);
        if (at) popText(w, at.x, at.y, at.z, 'SCHIVATA!', '#70d6ff');
        if (p.id === myId) showSticker('win', pick(['SCHIVATA', 'TROPPO SKILL', 'NON MI PRENDI']));
      } else if (p.k === 'dash') {
        const at = where(p.id);
        if (at && p.id !== myId) dust(w, at.x, at.y, at.z, 6);
      } else if (p.k === 'crack') {
        soundManager.playBoom();
        pushFeed('Una lasagna è crollata!');
      } else if (p.k === 'pass') {
        pushFeed(`${namesRef.current(p.from)} ha passato il petardo a ${namesRef.current(p.to)}`);
        soundManager.playPop();
        const at = where(p.to);
        if (at) popText(w, at.x, at.y, at.z, 'TOCCA A TE!', '#ff4d6d');
        if (p.to === myId) haptic([40, 40, 40]);
      } else if (p.k === 'boom') {
        burst(w, p.x, 1, p.z, ['#ff4d6d', '#ffd60a', '#fb5607', '#ffffff'], 70, 9);
        soundManager.playBoom();
        const d = Math.hypot(me.current.x - p.x, me.current.z - p.z);
        cam.current.shake = Math.max(cam.current.shake, d < 6 ? 1.2 : 0.4);
      } else if (p.k === 'bonk') {
        const av = avatars.current.get(p.id);
        if (av) av.shockUntil = performance.now() + 900;
        const at = where(p.id);
        if (at) burst(w, at.x, at.y + 1.2, at.z, ['#ffffff', '#ffd166'], 14, 4);
      } else if (p.k === 'out') {
        const at = where(p.id);
        if (at && s.kind !== 'SUMO') poof(w, at.x, at.y, at.z);
        pushFeed(pick(cmOf(s.kind)?.feed?.[p.reason] ?? FEED[p.reason] ?? ['{n} è fuori']).replace('{n}', namesRef.current(p.id)));
        if (p.id === myId) {
          soundManager.playFall();
          showSticker('out');
          cam.current.shake = 0.8;
        } else soundManager.playPop();
      } else if (p.k === 'shot') {
        tracer(w, p.from, p.to);
        soundManager.playShot();
        if (p.hit) burst(w, p.to.x, p.to.y, p.to.z, ['#ff4d6d', '#ffd166', '#ffffff'], 30, 5);
        if (p.by === myId && p.hit) {
          // niente adesivo al centro: coprirebbe il mirino. Scritta sul bersaglio e in cronaca
          popText(w, p.to.x, p.to.y - 2, p.to.z, pick(['CENTRATO!', 'PRESO!', 'CHE MIRA!']), '#ffd60a', { scale: 1.4, life: 1.2 });
          pushFeed(`Hai preso ${namesRef.current(p.hit)}`);
          soundManager.playSuccess();
        }
      } else if (p.k === 'acceca') {
        soundManager.playWhoosh();
        if (p.by === myId) pushFeed('Pomodoro lanciato alla torre!');
        if (p.to === myId) {
          setTimeout(() => {
            setSplatAt(Date.now());
            soundManager.playPop();
            cam.current.shake = 0.5;
          }, 900);
        } else if (p.by !== myId && dataRef.current.snipers.includes(myId) === false) pushFeed(`${namesRef.current(p.by)} ha accecato ${namesRef.current(p.to)}`);
      } else if (p.k === 'slam') {
        burst(w, p.x, 0.3, p.z, ['#ffffff', '#ff8fab', '#ffd166'], 36, 6);
        soundManager.playBoom();
        const d = Math.hypot(me.current.x - p.x, me.current.z - p.z);
        cam.current.shake = Math.max(cam.current.shake, d < 8 ? 0.9 : 0.35);
      } else if (p.k === 'grab') {
        pushFeed(`${namesRef.current(p.id)} ha preso la gallina`);
        soundManager.playPop();
        if (p.id === myId) showSticker('win', pick(['È MIA', 'GALLINA MIA', 'SCAPPA!']));
      } else if (p.k === 'steal') {
        pushFeed(`${namesRef.current(p.by)} ha rubato la gallina a ${namesRef.current(p.from)}`);
        soundManager.playWhoosh();
        if (p.from === myId) showSticker('lose', pick(['NOOO', 'LADRO!', 'RIDAMMELA']));
      } else if (p.k === 'scola') {
        // chi scola prima di te non si vede (così nessuno copia il tempo degli altri)
      } else if (p.k === 'hex') {
        // briciole di wafer: subito nello stato (il server manda lo stato intero solo ogni tanto)
        const H = hexRef.current;
        const b = me.current;
        for (const [k, st] of p.c as [number, number][]) {
          const c = String(st);
          if (H.arr.length > k && c > H.arr[k]) {
            H.arr[k] = c;
            H.dirty = true;
          }
          if (st === 2) {
            const tl = HEX_TILES[k % HEX_N];
            const ly = waferY(Math.floor(k / HEX_N));
            if (Math.abs(ly - b.y) < 4 && Math.hypot(tl.x - b.x, tl.z - b.z) < 9) dust(w, tl.x, ly - 0.4, tl.z, 3);
          }
        }
      } else if (p.k === 'drop') {
        soundManager.playBoom();
        cam.current.shake = Math.max(cam.current.shake, 0.5);
      } else if (p.k === 'kick') {
        const at = where(p.by);
        if (at) ringPulse(w, p.x, p.y - PITCH.ballR, p.z, '#ffffff');
        burst(w, p.x, p.y, p.z, ['#ffffff', '#b7f5b0'], 12, 4);
        soundManager.playBonk();
        if (p.by === myId) cam.current.shake = Math.max(cam.current.shake, 0.3);
      } else if (p.k === 'goal') {
        const myTeam = s.soccer?.team[myId];
        burst(w, p.x, 2, p.z, [TEAM_COLORS[p.team], '#ffffff', '#ffd60a'], 90, 10);
        popText(w, p.x, 3, p.z, 'GOOOL!', '#ffd60a', { life: 1.6, scale: 1.6 });
        cam.current.shake = Math.max(cam.current.shake, 0.6);
        pushFeed(p.by ? `GOL di ${namesRef.current(p.by)}! (${TEAM_NAMES[p.team]})` : p.own ? `Autogol di ${namesRef.current(p.own)}!` : `GOL dei ${TEAM_NAMES[p.team]}!`);
        if (myTeam === p.team) {
          soundManager.playVictory();
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 }, colors: [TEAM_COLORS[p.team], '#ffffff'] });
          showSticker('win', p.by === myId ? pick(['GOLAZO', 'BOMBER', 'CHE TIRO']) : pick(['GOOOL', 'DAJE', 'SIUUU']));
        } else {
          soundManager.playFall();
          if (p.own === myId) showSticker('lose', 'AUTOGOL…');
        }
      } else if (p.k === 'throw') {
        // pomodoro in volo: lo stesso arco del server (recuperando il ritardo della rete)
        const m = makeTomato();
        w.scene.add(m);
        const late = Math.max(0, Math.min(0.25, (Date.now() + offsetRef.current - p.at) / 1000));
        const T = { m, x: p.x + p.vx * late, y: p.y + p.vy * late - 0.5 * MARKET.gravity * late * late, z: p.z + p.vz * late, vx: p.vx, vy: p.vy - MARKET.gravity * late, vz: p.vz, life: 3 };
        m.position.set(T.x, T.y, T.z);
        toms.current.set(p.id, T);
        if (p.by !== myId) {
          const d = Math.hypot(p.x - me.current.x, p.z - me.current.z);
          if (d < 14) soundManager.playWhoosh();
        }
      } else if (p.k === 'splat') {
        const T = toms.current.get(p.tid);
        if (T) {
          w.scene.remove(T.m);
          toms.current.delete(p.tid);
        }
        splat(w, p.x, p.y, p.z, !!(p.ground || p.crate));
        if (p.id) {
          const at = where(p.id);
          const av = avatars.current.get(p.id);
          if (av) av.shockUntil = performance.now() + 900;
          if (at) popText(w, at.x, at.y, at.z, pick(['SPLAT!', 'SPLASH!', 'PLOF!']), '#ff4d6d');
          if (p.id === myId) {
            setSplatAt(Date.now());
            soundManager.playBonk();
            haptic([50, 30, 50]);
          } else soundManager.playPop();
          if (p.by === myId && Math.random() < 0.35) showSticker('win', pick(['CENTRATO', 'SPLAT!', 'CHE MIRA']));
        }
      } else if (p.k === 'door') {
        burst(w, doorX(p.i), 1.8, DOOR_ROWS[p.row], ['#ffbe0b', '#d98e04', '#ffffff'], 40, 7);
        soundManager.playDoor();
        const d = Math.hypot(doorX(p.i) - me.current.x, DOOR_ROWS[p.row] - me.current.z);
        if (d < 8) cam.current.shake = Math.max(cam.current.shake, 0.35);
      } else if (p.k === 'fake') {
        const at = where(p.id);
        if (at) popText(w, at.x, at.y, at.z, 'FINTA!', '#ff9f1c');
        if (p.id === myId) {
          soundManager.playError();
          cam.current.shake = Math.max(cam.current.shake, 0.3);
        }
      }
    };
    return () => {
      link.p3events.current = null;
    };
  }, [realtime]);

  // il mondo 3D e il ciclo di gioco
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // sul podio finale non c'è il mondo 3D
    const world = createWorld(canvas, coarse);
    world.setQuality(prefsRef.current.quality);
    worldRef.current = world;
    world.scene.add(world.camera);
    const gun = makeGun();
    gun.position.set(0.34, -0.32, -0.72);
    world.camera.add(gun);
    const hen = makeHen();
    hen.visible = false;
    world.scene.add(hen);
    const bomb = makeBomb();
    bomb.visible = false;
    world.scene.add(bomb);
    const ball = makeSoccerBall();
    ball.visible = false;
    world.scene.add(ball);
    const ballSpin = new THREE.Quaternion();
    const ballAxis = new THREE.Vector3();
    let follow: THREE.Vector3 | null = null;
    let raf = 0;
    let last = performance.now();
    let builtKind: MiniKind | null = null;
    let spawnNo = -1;
    let lastSend = 0;
    let lastSit = 0;
    let sentKey = '';
    const camPos = new THREE.Vector3(0, 20, -30);
    const camLook = new THREE.Vector3();
    // calcetto: anello del colore della squadra sotto ognuno
    const teamRing = (av: Avatar, id: string) => {
      const t = dataRef.current.soccer?.team[id];
      const on = dataRef.current.kind === 'CALCIO' && t !== undefined;
      av.ring.visible = on;
      if (on) (av.ring.material as THREE.MeshBasicMaterial).color.set(TEAM_COLORS[t]);
    };
    const avatarFor = (id: string) => {
      let av = avatars.current.get(id);
      if (!av) {
        av = makeAvatar(id, colorsRef.current(id), namesRef.current(id), id === myId);
        avatars.current.set(id, av);
        world.scene.add(av.root);
      }
      return av;
    };

    const frame = (tms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (tms - last) / 1000);
      last = tms;
      const t = tms / 1000;
      const s = dataRef.current;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      const size = world.renderer.getSize(new THREE.Vector2());
      if (size.x !== W || size.y !== H) {
        world.setSize(W, H);
        world.camera.aspect = W / Math.max(1, H);
      }
      if (builtKind !== s.kind) {
        builtKind = s.kind;
        buildArena(world, s.kind);
        // via le decorazioni del minigioco di prima (code, macchinine…)
        for (const av of avatars.current.values()) {
          for (const g of [av.deco, av.headDeco]) for (const ch of [...g.children]) g.remove(ch);
          av.body.visible = true;
          av.label.visible = true;
        }
      }
      const c = cam.current;
      if (s.spawnNo !== spawnNo && s.spawn) {
        spawnNo = s.spawnNo;
        me.current = newBody(s.spawn.x, s.spawn.z, s.spawn.r, s.spawn.y);
        c.yaw = faceSpawn(s.kind) ? s.spawn.r : 0;
        raceBest.current = -99;
        c.pitch = highCam(s.kind) ? 0.62 : 0.34;
        c.fy = Math.PI;
        c.fp = -0.3;
      }
      const nowS = Date.now() + offsetRef.current;
      const playT = s.playStart ? (nowS - s.playStart) / 1000 : 0;
      const isSniper = s.snipers.includes(myId);
      const isAlive = !!s.alive[myId];
      const chairIdx = s.chairs?.list.findIndex((ch) => ch.by === myId) ?? -1;
      const holdingHen = s.henHolder === myId;
      const holdingBomb = s.bomb?.holder === myId;
      if (s.kind === 'PONTE') setBrokenTiles(s.broken ?? []);
      if (s.kind === 'FRUTTA') setFruitOpen(s.fruit?.open ?? []);
      if (s.kind === 'CORSA') setOpenDoors(s.doors ?? []);
      if (s.kind === 'WAFER') {
        // stato del server + briciole già arrivate (le mattonelle possono solo peggiorare dentro un giro)
        const H = hexRef.current;
        const view = s.hex ?? '';
        if (H.round !== s.round || H.arr.length !== view.length) {
          H.round = s.round;
          H.arr = view.split('');
          H.dirty = true;
        } else if (view !== H.view) {
          for (let k = 0; k < view.length; k++) if (view[k] > H.arr[k]) H.arr[k] = view[k];
          H.dirty = true;
        }
        H.view = view;
        if (H.dirty) {
          H.dirty = false;
          H.str = H.arr.join('');
        }
        setHexState(H.str);
      }
      const cm = cmOf(s.kind);
      MINIS[s.kind]?.sync?.(s.ext);

      // ---- il mio personaggio
      const body = me.current;
      if (isSniper && s.spawn) {
        Object.assign(body, { x: s.spawn.x, y: s.spawn.y, z: s.spawn.z, r: c.fy, vx: 0, vy: 0, vz: 0, ground: true });
      } else if (chairIdx >= 0 && s.chairs) {
        const ch = s.chairs.list[chairIdx];
        Object.assign(body, { x: ch.x, y: 0, z: ch.z, r: Math.atan2(-ch.x, -ch.z), vx: 0, vz: 0, vy: 0, kx: 0, kz: 0, ground: true });
      } else if (s.stage === 'PLAY' || s.stage === 'RESULT' || (!isAlive && s.kind === 'SUMO')) {
        const k = keys.current;
        const kx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
        const kz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
        // il movimento segue la telecamera: avanti = dove guarda la telecamera
        const jx = joy.current.x + kx;
        const jf = -joy.current.y + kz;
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        const input = isAlive && !menuRef.current ? { x: -fz * jx + fx * jf, z: fx * jx + fz * jf, jump: jumpQ.current, dash: dashQ.current } : { x: 0, z: 0, jump: false };
        jumpQ.current = false;
        dashQ.current = false;
        const cmSpeed = cm?.speed ? cm.speed({ t, dt, playT, now: nowS, view: s, ext: s.ext, myId, me: body, latest: rtLink.current?.p3.current.p ?? new Map(), others: others.current }) : 1;
        if (body.y > -40) stepBody(body, input, dt, s.kind, playT, (holdingHen ? YARD.holderSpeed : holdingBomb ? PLAZA.holderSpeed : 1) * cmSpeed);
        // telecamera "che segue": quando giri, la visuale ti viene dietro da sola (non se stai tornando indietro
        // e non mentre la stai girando tu col dito)
        if (prefsRef.current.cam === 'segue' && isAlive && Date.now() - lastLookAt.current > 700 && Math.hypot(input.x, input.z) > 0.25) {
          const head = Math.atan2(input.x, input.z);
          const dd = Math.atan2(Math.sin(head - c.yaw), Math.cos(head - c.yaw));
          if (Math.abs(dd) < 2.3) c.yaw += dd * Math.min(1, dt * 1.7);
        }
        // polpette: chi cade dai lati ricomincia da sotto
        if (s.kind === 'POLPETTE' && body.y < -8 && isAlive) Object.assign(body, newBody((Math.random() - 0.5) * 8, SLOPE.start));
        // corsa pazza: si riparte dall'ultima bandierina superata
        if (s.kind === 'CORSA' && isAlive) {
          if (body.y > -1 && body.z > raceBest.current) {
            const before = RACE_CP.filter((z) => z <= raceBest.current + 0.5).length;
            raceBest.current = body.z;
            const after = RACE_CP.filter((z) => z <= raceBest.current + 0.5).length;
            if (after > before && before > 0 && s.stage === 'PLAY') {
              popText(world, body.x, body.y, body.z, 'CHECKPOINT!', '#06d6a0');
              soundManager.playSuccess();
            }
          }
          if (body.y < -8) {
            const cp = RACE_CP.filter((z) => z <= raceBest.current + 0.5).pop() ?? RACE.start;
            Object.assign(body, newBody((Math.random() - 0.5) * 6, cp));
            cam.current.shake = 0.4;
            soundManager.playPop();
          }
        }
        // calcetto: il pallone è un ostacolo (lo sposta il server quando ci corro contro)
        if (s.kind === 'CALCIO' && isAlive) {
          const B = ballRef.current;
          const dx = body.x - B.x;
          const dz = body.z - B.z;
          const d = Math.hypot(dx, dz);
          const min = PITCH.ballR + PHYS.radius - 0.15;
          if (d > 0.001 && d < min && body.y < B.y + PITCH.ballR * 0.5) {
            body.x = B.x + (dx / d) * min;
            body.z = B.z + (dz / d) * min;
          }
        }
        // non si passa attraverso gli altri
        if (isAlive && (body.y > -1 || s.kind === 'WAFER')) {
          for (const [id, o] of others.current) {
            if (!s.alive[id] || s.snipers.includes(id) || Math.abs(o.y - body.y) > 1.5) continue;
            const dx = body.x - o.x;
            const dz = body.z - o.z;
            const d = Math.hypot(dx, dz);
            const min = PHYS.radius * 2;
            if (d > 0.001 && d < min) {
              body.x += (dx / d) * (min - d) * 0.5;
              body.z += (dz / d) * (min - d) * 0.5;
            }
          }
        }
      }
      let myAnim: number = ANIM.idle;
      if (!isAlive && s.stage === 'PLAY') myAnim = ANIM.fall;
      else if (chairIdx >= 0) myAnim = ANIM.sit;
      else if (s.stage === 'RESULT' && (s.roundPoints?.[myId] ?? 0) >= POINTS[0]) myAnim = ANIM.dance;
      else if (Date.now() < pushAnimUntil.current) myAnim = ANIM.push;
      else if ((body.dashT ?? 0) > 0) myAnim = ANIM.dash;
      else if (body.dive) myAnim = ANIM.dive;
      else if (!body.ground && !isSniper) myAnim = ANIM.air;
      else if (Math.hypot(body.vx, body.vz) > 0.5) myAnim = ANIM.walk;

      const key = `${body.x.toFixed(2)},${body.y.toFixed(2)},${body.z.toFixed(2)},${body.r.toFixed(2)},${myAnim}`;
      if (tms - lastSend > 66 && (key !== sentKey || tms - lastSend > 600)) {
        rtLink.current?.p3send({ x: body.x, y: body.y, z: body.z, r: body.r, a: myAnim });
        sentKey = key;
        lastSend = tms;
      }
      if (s.kind === 'CHAIRS' && s.chairs?.phase === 'STOP' && isAlive && chairIdx < 0 && tms - lastSit > 250) {
        const i = s.chairs.list.findIndex((ch) => !ch.by && Math.hypot(ch.x - body.x, ch.z - body.z) < CHAIRS.sitRange);
        if (i >= 0) {
          lastSit = tms;
          actRef.current('MG_SIT', { i });
        }
      }

      // ---- gli altri
      const latest = rtLink.current?.p3.current.p ?? new Map<string, NetPos>();
      const rosterIds = new Set(s.roster.map((r) => r.id));
      const mf: MiniFrame | null = cm ? { t, dt, playT, now: nowS, view: s, ext: s.ext, myId, me: body, latest, others: others.current } : null;
      for (const [id, p] of latest) {
        // solo i personaggi (la gallina e il pallone si disegnano a parte)
        if (id === myId || !rosterIds.has(id)) continue;
        let o = others.current.get(id);
        if (!o || Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) > 8) {
          o = { ...p, tx: p.x, ty: p.y, tz: p.z, tr: p.r, speed: 0 };
          others.current.set(id, o);
        }
        if (p.x !== o.tx || p.z !== o.tz) {
          // velocità stimata dagli aggiornamenti di rete (serve alla mira assistita)
          const nowv = performance.now();
          const dtu = (nowv - (o.lt ?? nowv)) / 1000;
          if (dtu > 0.02 && dtu < 0.5) {
            o.vx = (p.x - o.tx) / dtu;
            o.vz = (p.z - o.tz) / dtu;
          }
          o.lt = nowv;
        }
        o.tx = p.x;
        o.ty = p.y;
        o.tz = p.z;
        o.tr = p.r;
        o.a = p.a;
      }
      for (const [id, o] of others.current) {
        const f = Math.min(1, dt * 12);
        const ox = o.x;
        const oz = o.z;
        o.x += (o.tx - o.x) * f;
        o.y += (o.ty - o.y) * f;
        o.z += (o.tz - o.z) * f;
        let dr = o.tr - o.r;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        o.r += dr * f;
        o.speed = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 0.001);
        const av = avatarFor(id);
        const show = s.alive[id] !== false ? o.y > -40 : s.kind === 'SUMO' && o.y > -30 && s.stage === 'PLAY';
        av.root.visible = show && s.stage !== 'END';
        av.root.position.set(o.x, o.y, o.z);
        av.root.rotation.y = o.r;
        teamRing(av, id);
        if (av.root.visible && ((o.a === ANIM.walk && tms - av.dustAt > 160) || (av.wasAir && o.a !== ANIM.air && o.a !== ANIM.fall))) {
          av.dustAt = tms;
          dust(world, o.x, o.y, o.z, av.wasAir ? 6 : 2);
        }
        animateAvatar(av, o.a, o.speed, t, dt);
        if (mf && cm?.decorate) cm.decorate(av, id, mf);
      }
      if (mf && cm?.local && (s.stage === 'PLAY' || s.stage === 'RESULT')) cm.local(mf, world);
      const mine = avatarFor(myId);
      teamRing(mine, myId);
      const fps = isSniper && s.stage !== 'END';
      mine.root.visible = !fps && (isAlive || (s.kind === 'SUMO' && body.y > -30 && s.stage === 'PLAY')) && s.stage !== 'END';
      mine.root.position.set(body.x, body.y, body.z);
      let dr = body.r - mine.root.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      mine.root.rotation.y += dr * Math.min(1, dt * 15);
      if (mine.root.visible && ((myAnim === ANIM.walk && tms - mine.dustAt > 140) || (mine.wasAir && myAnim !== ANIM.air && myAnim !== ANIM.fall))) {
        mine.dustAt = tms;
        dust(world, body.x, body.y, body.z, mine.wasAir ? 7 : 2);
      }
      animateAvatar(mine, myAnim, Math.hypot(body.vx, body.vz), t, dt);
      if (mf && cm?.decorate) cm.decorate(mine, myId, mf);

      // ---- la gallina d'oro
      hen.visible = s.kind === 'GALLINA' && s.stage !== 'INTRO';
      if (hen.visible) {
        const hp = latest.get('hen');
        const holder = s.henHolder ? (s.henHolder === myId ? body : others.current.get(s.henHolder)) : null;
        if (holder) hen.position.set(holder.x, holder.y + 2.25, holder.z);
        else if (hp) {
          hen.position.lerp(new THREE.Vector3(hp.x, 0, hp.z), Math.min(1, dt * 10));
          hen.rotation.y = hp.r;
        }
        hen.userData.halo.visible = !holder;
        (hen.userData.wings as THREE.Mesh[]).forEach((wg, i) => (wg.rotation.z = Math.sin(t * (holder ? 22 : 14)) * 0.6 * (i ? 1 : -1)));
        hen.position.y += holder ? Math.abs(Math.sin(t * 10)) * 0.15 : Math.abs(Math.sin(t * 12)) * 0.12;
      }

      // ---- il petardo (in mano a chi ce l'ha, scintille sempre più forti)
      bomb.visible = s.kind === 'BOTTO' && !!s.bomb && s.stage === 'PLAY';
      if (bomb.visible && s.bomb) {
        const holder = s.bomb.holder === myId ? body : others.current.get(s.bomb.holder);
        if (holder) bomb.position.set(holder.x, holder.y + 2.75, holder.z);
        const hot = s.bomb.hot;
        bomb.rotation.z = Math.sin(t * (hot ? 30 : 8)) * (hot ? 0.35 : 0.12);
        const sp = bomb.userData.spark as THREE.Mesh;
        sp.scale.setScalar((hot ? 1.6 : 1) * (0.7 + Math.random() * 0.6));
        (sp.material as THREE.MeshBasicMaterial).color.set(Math.random() < 0.5 ? '#fff3b0' : hot ? '#ff4d6d' : '#ffd166');
        if (Math.random() < (hot ? 0.5 : 0.15)) dust(world, bomb.position.x, bomb.position.y + 0.4, bomb.position.z, 1);
      }

      // ---- il pallone del calcetto (posizione dal server, rotola da solo)
      ball.visible = s.kind === 'CALCIO';
      if (ball.visible) {
        const bp = latest.get('ball');
        const B = ballRef.current;
        if (bp) {
          if (!B.seen || Math.hypot(bp.x - B.x, bp.z - B.z) > 10) Object.assign(B, { x: bp.x, y: bp.y, z: bp.z, seen: true });
          const f = Math.min(1, dt * 14);
          const ox = B.x;
          const oz = B.z;
          B.x += (bp.x - B.x) * f;
          B.y += (bp.y - B.y) * f;
          B.z += (bp.z - B.z) * f;
          const mx = B.x - ox;
          const mz = B.z - oz;
          const dist = Math.hypot(mx, mz);
          if (dist > 0.0005) {
            ballAxis.set(mz, 0, -mx).normalize();
            ballSpin.setFromAxisAngle(ballAxis, dist / PITCH.ballR);
            ball.quaternion.premultiply(ballSpin);
          }
        }
        ball.position.set(B.x, B.y, B.z);
      } else ballRef.current.seen = false;

      // ---- pomodori in volo (stessa parabola del server)
      for (const [id, T] of toms.current) {
        T.vy -= MARKET.gravity * dt;
        T.x += T.vx * dt;
        T.y += T.vy * dt;
        T.z += T.vz * dt;
        T.life -= dt;
        T.m.position.set(T.x, T.y, T.z);
        T.m.rotation.x += dt * 9;
        if (T.y < -8 || T.life <= 0 || s.kind !== 'POMODORI') {
          world.scene.remove(T.m);
          toms.current.delete(id);
        }
      }

      const ed = edgeRef.current;
      if (ed && !coarse && !menuRef.current && document.pointerLockElement !== zoneRef.current && ed.y > 0.12 && ed.y < 0.7) {
        const dir = ed.x < 0.04 ? -1 : ed.x > 0.96 ? 1 : 0;
        if (dir) lookRef.current(dir * dt * 420, 0);
      }

      // ---- telecamera
      const shake = c.shake > 0.01 ? new THREE.Vector3((Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake, (Math.random() - 0.5) * c.shake) : new THREE.Vector3();
      c.shake *= Math.exp(-dt * 6);
      if (fps && s.spawn) {
        // prima persona dalla torre
        const eye = sniperEye(Math.max(0, s.snipers.indexOf(myId)), s.snipers.length);
        world.camera.position.set(eye.x, eye.y, eye.z).add(shake);
        const dir = new THREE.Vector3(Math.sin(c.fy) * Math.cos(c.fp), Math.sin(c.fp), Math.cos(c.fy) * Math.cos(c.fp));
        world.camera.lookAt(world.camera.position.clone().add(dir));
        const fov = zoomRef.current ? 20 : W < H ? 72 : 62;
        world.camera.fov += (fov - world.camera.fov) * Math.min(1, dt * 12);
        c.kick *= Math.exp(-dt * 10);
        gun.position.set(0.34, -0.32, -0.72 + c.kick * 0.18);
        gun.rotation.x = c.kick * 0.25;
        gun.visible = !zoomRef.current;
        gun.userData.flash.visible = c.kick > 0.6;
        camPos.copy(world.camera.position);
      } else {
        gun.visible = false;
        const fovWant = W < H ? 64 : 54;
        world.camera.fov += (fovWant - world.camera.fov) * Math.min(1, dt * 6);
        const wantPos = new THREE.Vector3();
        const wantLook = new THREE.Vector3();
        if (s.stage === 'INTRO' || (!isAlive && !(s.kind === 'SUMO' && body.y > -12))) {
          // giro panoramico (introduzione) o vista dall'alto per chi è fuori (si può girare trascinando)
          const o = orbitOf(s.kind);
          const yaw = s.stage === 'INTRO' ? t * 0.22 : c.yaw;
          const p = s.stage === 'INTRO' ? 0.5 : Math.max(0.35, c.pitch);
          wantPos.set(o.c[0] - Math.sin(yaw) * Math.cos(p) * o.r, o.c[1] + Math.sin(p) * o.r, o.c[2] - Math.cos(yaw) * Math.cos(p) * o.r);
          wantLook.set(o.c[0], o.c[1], o.c[2]);
        } else if (s.kind === 'DENTE') {
          // pasta al dente: alle mie spalle, guardando il pentolone e il timer (si può girare un po')
          // inquadratura fissa e centrata davanti al pentolone: si vedono sempre pentola e timer interi
          c.yaw = 0;
          const portrait = W < H;
          wantPos.set(0, portrait ? 8.5 : 7.5, portrait ? -25 : -19.5);
          wantLook.set(0, 8.9, 2);
          camPos.lerp(wantPos, Math.min(1, dt * 8));
          camLook.lerp(wantLook, Math.min(1, dt * 8));
        } else {
          const high = highCam(s.kind);
          const dist = high ? 12.5 : 9.5;
          const target = new THREE.Vector3(body.x, Math.max(s.kind === 'WAFER' ? -WAFER.gap * (WAFER.layers - 1) - 3 : -3, body.y), body.z);
          follow = follow ?? target.clone();
          follow.lerp(target, 1 - Math.exp(-dt * 22));
          wantPos.set(follow.x - Math.sin(c.yaw) * Math.cos(c.pitch) * dist, follow.y + 1.2 + Math.sin(c.pitch) * dist, follow.z - Math.cos(c.yaw) * Math.cos(c.pitch) * dist);
          wantLook.set(follow.x + Math.sin(c.yaw) * 3, follow.y + 1.6, follow.z + Math.cos(c.yaw) * 3);
          if (world.camBlockers.length) {
            // c'è un muro tra me e la telecamera? la telecamera si avvicina (mai sotto 1,5 m)
            camFrom.set(follow.x, follow.y + 1.6, follow.z);
            camDir.subVectors(wantPos, camFrom);
            const len = camDir.length();
            camDir.divideScalar(len || 1);
            camRay.set(camFrom, camDir);
            camRay.far = len;
            const hit = camRay.intersectObjects(world.camBlockers, true)[0];
            if (hit) wantPos.copy(camFrom).addScaledVector(camDir, Math.max(1.5, hit.distance - 0.5));
          }
          camPos.copy(wantPos);
          camLook.copy(wantLook);
        }
        if (s.stage === 'INTRO' || !isAlive) {
          const k = Math.min(1, dt * 6);
          camPos.lerp(wantPos, k);
          camLook.lerp(wantLook, k);
        }
        world.camera.position.copy(camPos).add(shake);
        world.camera.lookAt(camLook);
      }
      world.camera.updateProjectionMatrix();

      world.clouds.rotation.y += dt * 0.008;
      world.update(t, dt, {
        playT,
        light: s.light?.state ?? null,
        chairs: s.chairs?.list ?? [],
        music: s.chairs?.phase === 'MUSIC',
        now: nowS,
        balls: s.balls ?? [],
        slams: s.slams ?? [],
        broken: s.broken ?? [],
        dente: s.dente ?? null,
        hex: s.kind === 'WAFER' ? hexRef.current.str : '',
        fruit: s.fruit ?? null,
        score: s.soccer?.score ?? null,
        doors: s.doors ?? [],
        me: { x: body.x, y: body.y, z: body.z },
        view: s,
        myId,
        body,
        latest,
        others: others.current,
      });
      updateFx(world, dt);
      world.render(dt);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      world.dispose();
      avatars.current.clear();
      toms.current.clear();
      worldRef.current = null;
    };
  }, []);

  // trascinare sullo schermo gira la telecamera (o la mira del cecchino); un tocco veloce spara
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && !coarse) return; // il mouse lo gestisce l'effetto "PC" qui sotto
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved: 0 };
  };
  const look = (dx: number, dy: number) => {
    const c = cam.current;
    lastLookAt.current = Date.now();
    const sens = prefsRef.current.sens;
    if (dataRef.current.snipers.includes(myId)) {
      const k = sens * 0.0042 * (zoomRef.current ? 0.35 : 1);
      c.fy -= dx * k;
      c.fp = Math.max(-1.15, Math.min(0.35, c.fp - dy * k));
    } else {
      c.yaw -= dx * 0.006 * sens;
      c.pitch = Math.max(0.1, Math.min(1.25, c.pitch + dy * 0.004 * sens));
    }
  };
  lookRef.current = look;
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    look(dx, dy);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && d.id === e.pointerId && d.moved < 10 && Date.now() - d.t < 350 && dataRef.current.snipers.includes(myId)) actions.current.fire();
  };

  // ---------------- suoni, musichette, "VIA!" e sticker (uguali per tutti)
  const lightState = a.stage === 'PLAY' ? a.light?.state : undefined;
  const chairPhase = a.stage === 'PLAY' ? a.chairs?.phase : undefined;
  useEffect(() => {
    if (a.stage === 'INTRO') {
      soundManager.playReveal();
      setZoom(false);
    }
    if (a.stage === 'PLAY') {
      soundManager.playStart();
      setGoFlash(true);
      const tm = setTimeout(() => setGoFlash(false), 900);
      return () => clearTimeout(tm);
    }
    if (a.stage === 'RESULT') {
      soundManager.playSuccess();
      const rp = a.roundPoints ?? {};
      const mine = rp[myId] ?? 0;
      const best = Math.max(...Object.values(rp));
      if (mine === best && mine > 0) {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 } });
        showSticker('win');
      } else if (mine <= 2) showSticker('lose');
    }
    if (a.stage === 'END') {
      soundManager.playVictory();
      confetti({ particleCount: 180, spread: 100, origin: { y: 0.35 } });
      const top = Object.entries(a.points).sort((x, y) => y[1] - x[1])[0];
      if (top?.[0] === myId) showSticker('king');
    }
  }, [a.stage, a.round]);
  useEffect(() => {
    if (lightState === 'GREEN') return soundManager.startLoop(DOLL_TUNE, 0.2, 'square');
    if (lightState === 'TURN') soundManager.playTick();
    if (lightState === 'RED') soundManager.playAlarm();
  }, [lightState, a.light?.endsAt]);
  useEffect(() => {
    if (chairPhase === 'MUSIC') return soundManager.startLoop(CHAIR_TUNE, 0.16);
    if (chairPhase === 'STOP') soundManager.playAlarm();
  }, [chairPhase, a.chairs?.giro]);
  // pasta al dente: tic nei primi 3 secondi, musichetta di suspense, poi la rivelazione con i tempi sopra le teste
  const denteKey = a.stage === 'PLAY' && a.kind === 'DENTE' && a.dente ? `${a.round}:${a.dente.manche}:${a.dente.phase}` : '';
  const denteEl = a.stage === 'PLAY' && a.dente?.phase === 'GO' ? (now() - a.dente.startAt) / 1000 : -1;
  const denteTick = denteEl >= 0 && denteEl < DENTE.showFor + 0.1 ? Math.floor(denteEl) : -1;
  useEffect(() => {
    if (denteTick >= 0) soundManager.playTick();
  }, [denteTick, denteKey]);
  useEffect(() => {
    const D = dataRef.current.dente;
    if (!denteKey || !D) return;
    if (D.phase === 'GO') return soundManager.startLoop(DENTE_TUNE, 0.26, 'sine');
    if (!D.stops) return;
    soundManager.playDrumroll(1.1);
    const target = D.target;
    const errOf = (ms: number | null) => (ms === null ? 99 : Math.abs(ms / 1000 - target));
    // dal peggiore al migliore, uno alla volta
    const list = Object.entries(D.stops).sort((x, y) => errOf(y[1]) - errOf(x[1]));
    const timers = list.map(([id, ms], i) =>
      setTimeout(() => {
        const w = worldRef.current;
        const at = id === myId ? me.current : others.current.get(id);
        if (!w || !at) return;
        const e = ms === null ? null : ms / 1000 - target;
        const good = e !== null && Math.abs(e) <= DENTE.perfect;
        const label = e === null ? 'NON SCOLATA' : good ? 'AL DENTE!' : e < 0 ? 'CRUDA' : 'SCOTTA';
        const col = e === null ? '#adb5bd' : good ? '#06d6a0' : e < 0 ? '#ffd60a' : '#ff4d6d';
        popText(w, at.x, at.y + 0.85, at.z, ms === null ? '—' : `${sec2(ms)} s`, '#ffffff', { life: 3.4, scale: 0.68 });
        popText(w, at.x, at.y + 0.2, at.z, label, col, { life: 3.4, scale: 0.58 });
        if (good) burst(w, at.x, at.y + 2.2, at.z, ['#06d6a0', '#ffd60a', '#ffffff'], 34, 5);
        soundManager.playPop();
        if (id === myId) {
          if (good) {
            soundManager.playSuccess();
            showSticker('win', 'AL DENTE!');
          } else if (e === null || Math.abs(e) > 1) showSticker('lose', e === null ? 'DORMIVI?' : e < 0 ? 'CRUDA!' : 'SCOTTA!');
        }
      }, 1200 + i * 220),
    );
    return () => timers.forEach(clearTimeout);
  }, [denteKey]);
  // macedonia: suoni delle fasi e conto alla rovescia
  const fruitKey = a.stage === 'PLAY' && a.kind === 'FRUTTA' && a.fruit ? `${a.round}:${a.fruit.giro}:${a.fruit.phase}` : '';
  const fruitLeft = a.stage === 'PLAY' && a.fruit ? Math.max(0, Math.ceil((a.fruit.endsAt - now()) / 1000)) : 0;
  useEffect(() => {
    const F = dataRef.current.fruit;
    if (!fruitKey || !F) return;
    if (F.phase === 'SHOW') soundManager.playReveal();
    else if (F.phase === 'HIDE') soundManager.playAlarm();
    else if (F.phase === 'RISE') soundManager.playWhoosh();
  }, [fruitKey]);
  useEffect(() => {
    if (a.fruit?.phase === 'HIDE' && fruitLeft > 0 && fruitLeft <= 3) soundManager.playTick();
  }, [fruitLeft, a.fruit?.phase]);
  const introLeft = a.stage === 'INTRO' && a.stageEndsAt ? Math.ceil((a.stageEndsAt - now()) / 1000) : 0;
  useEffect(() => {
    if (introLeft > 0 && introLeft <= 3) soundManager.playTick();
  }, [introLeft]);
  useEffect(() => {
    if (finished && worldRef.current) {
      burst(worldRef.current, me.current.x, me.current.y + 1.5, me.current.z, ['#ffd166', '#06d6a0', '#ff70a6', '#3a86ff'], 60, 7);
      soundManager.playSuccess();
      showSticker('win', a.finished.indexOf(myId) === 0 ? 'PRIMO!' : pickPhrase('win'));
    }
  }, [finished]);
  useEffect(() => {
    worldRef.current?.setQuality(prefs.quality);
    savePrefs(prefs);
  }, [prefs]);
  // PC: la visuale segue il mouse senza cliccare niente. Se il browser lo permette il mouse resta anche
  // "agganciato" al gioco (come negli FPS) così puoi girare all'infinito; Esc lo libera.
  // Cecchino: tasto destro tenuto = mirino, sinistro = spara.
  useEffect(() => {
    const onLock = () => setLocked(document.pointerLockElement === zoneRef.current);
    const onLockErr = () => setNoLock(true);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('pointerlockerror', onLockErr);
    if (coarse)
      return () => {
        document.removeEventListener('pointerlockchange', onLock);
        document.removeEventListener('pointerlockerror', onLockErr);
      };
    let lx: number | null = null;
    let ly = 0;
    const isLocked = () => document.pointerLockElement === zoneRef.current;
    const tryLock = () => {
      if (isLocked() || menuRef.current || !zoneRef.current) return;
      try {
        const r = zoneRef.current.requestPointerLock() as unknown;
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
      } catch {
        // non si può: si gira comunque muovendo il mouse
      }
    };
    const mm = (e: MouseEvent) => {
      if (menuRef.current) {
        lx = null;
        edgeRef.current = null;
        return;
      }
      if (isLocked()) {
        edgeRef.current = null;
        lookRef.current(e.movementX * 0.55, e.movementY * 0.55);
        return;
      }
      if (lx !== null) lookRef.current((e.clientX - lx) * 0.8, (e.clientY - ly) * 0.8);
      lx = e.clientX;
      ly = e.clientY;
      edgeRef.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
    };
    const out = () => {
      lx = null;
      edgeRef.current = null;
    };
    const onGame = (e: MouseEvent) => isLocked() || e.target === zoneRef.current;
    const md = (e: MouseEvent) => {
      if (!onGame(e)) return;
      if (dataRef.current.stage === 'PLAY') tryLock();
      const sn = dataRef.current.snipers.includes(myId);
      const kd0 = dataRef.current.kind;
      // minigiochi a moduli col loro pulsante (lancia, prendi…): il clic sinistro fa quello
      const mb = e.button === 0 && !sn ? actions.current.miniButton() : null;
      if (mb) {
        if (!mb.disabled) mb.press();
      } else if (e.button === 0 && sn) actions.current.fire();
      else if (e.button === 0 && kd0 === 'DENTE') actions.current.stop();
      else if (e.button === 0 && kd0 === 'POMODORI') actions.current.throwT();
      else if (e.button === 0 && kd0 === 'CALCIO') actions.current.push();
      else if (e.button === 0 && isLocked() && dataRef.current.stage === 'PLAY') actions.current.push();
      if (e.button === 2 && sn) setZoom(true);
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 2) setZoom(false);
    };
    const kd = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && dataRef.current.stage === 'PLAY') tryLock();
    };
    const cm = (e: MouseEvent) => {
      if (onGame(e)) e.preventDefault();
    };
    document.addEventListener('mousemove', mm);
    document.documentElement.addEventListener('mouseleave', out);
    window.addEventListener('blur', out);
    document.addEventListener('mousedown', md);
    document.addEventListener('mouseup', mu);
    document.addEventListener('contextmenu', cm);
    window.addEventListener('keydown', kd);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('pointerlockerror', onLockErr);
      document.removeEventListener('mousemove', mm);
      document.documentElement.removeEventListener('mouseleave', out);
      window.removeEventListener('blur', out);
      document.removeEventListener('mousedown', md);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('contextmenu', cm);
      window.removeEventListener('keydown', kd);
      if (isLocked()) document.exitPointerLock();
    };
  }, []);
  // con il menu aperto, a fine giro e quando si è fuori il mouse torna libero
  useEffect(() => {
    if ((menu || a.stage !== 'PLAY' || !alive) && document.pointerLockElement) document.exitPointerLock();
  }, [menu, a.stage, alive]);

  const left = a.stageEndsAt ? Math.max(0, Math.ceil((a.stageEndsAt - now()) / 1000)) : null;
  const aliveCount = Object.values(a.alive).filter(Boolean).length;
  const ranking = [...a.roster].sort((x, y) => (a.points[y.id] ?? 0) - (a.points[x.id] ?? 0));
  const stickerView =
    sticker &&
    createPortal(
      <div key={sticker.key} className="pointer-events-none fixed inset-0 z-[55] grid place-items-center">
        <Sticker mood={sticker.mood} text={sticker.text} />
      </div>,
      document.body,
    );

  // ---------------- fine partita: podio
  if (a.stage === 'END') {
    const top = ranking.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    return (
      <div className="stagger flex flex-col gap-4">
        {stickerView}
        <section className="sc-panel pop p-5 text-center">
          <div className="mx-auto w-fit">
            <UiIcon name="trophy" size={64} />
          </div>
          <p className="sc-stroke font-display text-4xl leading-tight text-white">{nameOf(ranking[0].id)} vince l’Axend Party!</p>
          <div className="mt-5 flex items-end justify-center gap-3">
            {order.map((p) => {
              const place = ranking.indexOf(p) + 1;
              const h = place === 1 ? 130 : place === 2 ? 95 : 70;
              const tone = place === 1 ? 'sc-yellow' : place === 2 ? 'sc-blue' : 'sc-red';
              return (
                <div key={p.id} className="reveal-pop flex w-24 flex-col items-center gap-1" style={{ animationDelay: `${(3 - place) * 0.3}s` }}>
                  <MiniAvatar color={p.color} size={place === 1 ? 64 : 50} />
                  <span className="sc-stroke-sm max-w-full truncate font-display text-lg text-white">{nameOf(p.id)}</span>
                  <div className={`sc-btn ${tone} flex w-full flex-col items-center justify-start !rounded-b-none pt-2`} style={{ height: h }}>
                    <span className="sc-stroke-sm font-display text-4xl text-white">{place}</span>
                    <span className="text-sm font-black opacity-80">{a.points[p.id] ?? 0} pt</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="sc-panel p-3">
          {ranking.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3 rounded-2xl px-3 py-1.5 ${p.id === myId ? 'bg-amber-400/25' : ''}`}>
              <span className="sc-stroke-sm w-6 font-display text-xl text-white">{i + 1}</span>
              <MiniAvatar color={p.color} size={30} />
              <span className="min-w-0 flex-1 truncate font-black text-white">
                {nameOf(p.id)} {p.bot && <span className="ml-1 rounded-md bg-white/20 px-1.5 text-[10px] font-black">BOT</span>}
              </span>
              <span className="sc-stroke-sm font-display text-xl text-amber-300">{a.points[p.id] ?? 0}</span>
            </div>
          ))}
        </section>
        <EndBar canLead={canLead} hostName={state.players.find((p) => p.id === state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
      </div>
    );
  }

  const chairsLeft = a.chairs?.list.filter((c) => !c.by).length ?? 0;
  const myRank = a.finished.indexOf(myId);
  const reloadLeft = Math.max(0, reloadUntil.current - Date.now());
  const dashLeft = Math.max(0, dashReady.current - Date.now());
  const showControls = a.stage !== 'INTRO' && alive && !seated && !menu;
  const nextKind = a.queue[a.round + 1];
  const holdTop = Object.entries(a.hold ?? {})
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3);
  const climb =
    a.kind === 'POLPETTE'
      ? Math.max(0, Math.min(1, (me.current.z - SLOPE.start) / (SLOPE.finish - SLOPE.start)))
      : a.kind === 'CORSA'
        ? finished
          ? 1
          : Math.max(0, Math.min(1, (Math.max(raceBest.current, me.current.z) - RACE.start) / (RACE.finish - RACE.start)))
        : 0;
  const D = a.kind === 'DENTE' ? a.dente : null;
  const dStopped = !!D && (D.stopped.includes(myId) || stoppedRef.current === `${a.round}:${D.manche}`);
  const denteClock = !D ? '' : D.phase === 'REVEAL' ? sec2(D.target * 1000) : denteEl < 0 ? 'PRONTI…' : denteEl < DENTE.showFor ? sec2(denteEl * 1000) : '??,??';
  const myTeam = a.soccer?.team[myId];
  const throwLeft = Math.max(0, throwReady.current - Date.now());
  const myLayer = Math.max(0, Math.min(WAFER.layers - 1, Math.round(-me.current.y / WAFER.gap)));

  const cm = cmOf(a.kind);
  const hc = cm ? hudCtx() : null;
  const cmBtn = cm?.button && hc && a.stage === 'PLAY' && alive ? cm.button(hc) : null;
  let status: ReactNode = null;
  if (a.stage === 'PLAY') {
    if (!alive) status = <Pill cls="sc-dark">Sei fuori · stai guardando</Pill>;
    else if (cm?.status && hc) {
      const st = cm.status(hc);
      if (st) status = <Pill cls={st.cls}>{st.text}</Pill>;
    }
    else if (a.kind === 'REDLIGHT' && finished) status = <Pill cls="sc-green">{`ARRIVATO ${myRank + 1}°`}</Pill>;
    else if (a.kind === 'REDLIGHT' && a.light)
      status =
        a.light.state === 'GREEN' ? (
          <Pill cls="sc-green">VAI!</Pill>
        ) : a.light.state === 'TURN' ? (
          <Pill cls="sc-yellow">SI STA GIRANDO…</Pill>
        ) : (
          <Pill cls="sc-red pulse-soft">FERMO!</Pill>
        );
    else if (a.kind === 'CHAIRS' && a.chairs)
      status = a.chairs.phase === 'MUSIC' ? <Pill cls="sc-purple">{`MUSICA! GIRO ${a.chairs.giro}`}</Pill> : seated ? <Pill cls="sc-green">SEDUTO!</Pill> : <Pill cls="sc-red pulse-soft">{`SIEDITI! ${chairsLeft} LIBERE`}</Pill>;
    else if (a.kind === 'SNIPER') status = sniper ? <Pill cls="sc-red">{`COLPITI ${a.hits[myId] ?? 0}`}</Pill> : finished ? <Pill cls="sc-green">ARRIVATO!</Pill> : <Pill cls="sc-dark">CORRI SOTTO LA TORRE</Pill>;
    else if (a.kind === 'GALLINA')
      status =
        a.henHolder === myId ? (
          <Pill cls="sc-yellow pulse-soft">HAI LA GALLINA! SCAPPA</Pill>
        ) : a.henHolder ? (
          <Pill cls="sc-red">{`RUBALA: SCHIAFFO${coarse ? '' : ' (E o clic)'} A ${(a.roster.find((r) => r.id === a.henHolder)?.name ?? '').toUpperCase()}`}</Pill>
        ) : (
          <Pill cls="sc-yellow">PRENDI LA GALLINA: CORRICI SOPRA</Pill>
        );
    else if (a.kind === 'POLPETTE' && finished) status = <Pill cls="sc-green">{`IN CIMA ${myRank + 1}°`}</Pill>;
    else if (a.kind === 'PONTE' && finished) status = <Pill cls="sc-green">{`DALL’ALTRA PARTE ${myRank + 1}°`}</Pill>;
    else if (a.kind === 'BOTTO' && a.bomb)
      status = a.bomb.holder === myId ? <Pill cls="sc-red pulse-soft">HAI IL PETARDO! PASSALO</Pill> : <Pill cls={a.bomb.hot ? 'sc-red' : 'sc-dark'}>{`Scappa da ${nameOf(a.bomb.holder)}`}</Pill>;
    else if (a.kind === 'DENTE' && D)
      status =
        D.phase === 'REVEAL' ? (
          <Pill cls="sc-purple">{`MANCHE ${D.manche + 1}: ECCO I TEMPI`}</Pill>
        ) : denteEl < 0 ? (
          <Pill cls="sc-dark">PRONTI…</Pill>
        ) : dStopped ? (
          <Pill cls="sc-green">SCOLATA! ASPETTA GLI ALTRI</Pill>
        ) : (
          <Pill cls={denteEl >= DENTE.showFor ? 'sc-yellow pulse-soft' : 'sc-yellow'}>{`SCOLA A ${sec2(D.target * 1000)} s!`}</Pill>
        );
    else if (a.kind === 'WAFER') status = myLayer > 0 ? <Pill cls={myLayer === WAFER.layers - 1 ? 'sc-red' : 'sc-purple'}>{myLayer === WAFER.layers - 1 ? 'ULTIMO PIANO!' : `PIANO ${myLayer + 1} DI ${WAFER.layers}`}</Pill> : null;
    else if (a.kind === 'FRUTTA' && a.fruit)
      status =
        a.fruit.phase === 'SHOW' ? (
          <Pill cls="sc-purple">{`MEMORIZZA LA FRUTTA! ${fruitLeft}`}</Pill>
        ) : a.fruit.phase === 'DROP' ? (
          <Pill cls="sc-red">CROLLANO!</Pill>
        ) : a.fruit.phase === 'RISE' ? (
          <Pill cls="sc-dark">{`GIRO ${a.fruit.giro + 1} SUPERATO`}</Pill>
        ) : null;
    else if (a.kind === 'CALCIO' && myTeam !== undefined && a.playStart && now() - a.playStart < 4000)
      status = (
        <p className="sc-btn pop px-5 py-1.5 font-display text-xl tracking-wide text-white" style={{ background: TEAM_COLORS[myTeam] }}>
          {`SEI DEI ${TEAM_NAMES[myTeam]}! SEGNA DI LÀ`}
        </p>
      );
    else if (a.kind === 'CORSA' && finished) status = <Pill cls="sc-green">{`ARRIVATO ${myRank + 1}°`}</Pill>;
  }

  // a tutto schermo, fuori dalla pagina (così niente intestazione e niente animazioni della pagina in mezzo)
  return createPortal(
    <div ref={wrapRef} className="fixed inset-0 z-[45] select-none overflow-hidden bg-sky-300 [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* zona che gira la telecamera / mira */}
      <div ref={zoneRef} className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

      {/* in alto: impostazioni, timer, giocatori */}
      <div className="pointer-events-none absolute inset-x-3 top-[max(10px,env(safe-area-inset-top))] flex items-start justify-between gap-2">
        <button type="button" aria-label="Impostazioni" onClick={() => setMenu(true)} className="sc-btn sc-dark pointer-events-auto grid h-12 w-12 place-items-center">
          <UiIcon name="gear" size={28} />
        </button>
        <div className="sc-chip flex items-center gap-2 py-1 pl-1 pr-4">
          <MiniIcon kind={a.kind} size={36} />
          <span className={`sc-stroke-sm font-display text-2xl tabular-nums ${left !== null && left <= 10 && a.stage === 'PLAY' ? 'text-red-400' : 'text-white'}`}>
            {a.stage === 'PLAY' && left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${a.round + 1}/${a.rounds}`}
          </span>
        </div>
        <div className="sc-chip flex items-center gap-1.5 px-3 py-1.5">
          <UiIcon name="people" size={22} />
          <span className="sc-stroke-sm font-display text-xl text-white">{aliveCount}</span>
        </div>
      </div>

      {/* eliminazioni e fatti della partita */}
      <div className="pointer-events-none absolute right-3 top-[72px] flex w-60 flex-col items-end gap-1">
        {feed.map((f) => (
          <p key={f.key} className="feed-in sc-chip px-3 py-1 text-right text-xs font-black text-white">
            {f.text}
          </p>
        ))}
      </div>

      {/* gallina: classifica dal vivo / polpette: quanto sei salito */}
      {a.kind === 'GALLINA' && a.stage === 'PLAY' && holdTop.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-[72px] flex flex-col gap-1">
          {holdTop.map(([id, sec], i) => (
            <p key={id} className={`sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === myId ? '!bg-amber-500/80' : ''}`}>
              <span className="sc-stroke-sm font-display text-base">{i + 1}</span>
              {nameOf(id)} · {sec.toFixed(0)}s
            </p>
          ))}
        </div>
      )}
      {/* pasta al dente: il timer (si vede solo nei primi 3 secondi) e i tempi della manche */}
      {D && a.stage === 'PLAY' && (
        <div className="pointer-events-none absolute inset-x-0 top-[66px] flex flex-col items-center gap-1">
          <p className="sc-chip px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white">{`Manche ${D.manche + 1} di ${D.manches} · obiettivo ${sec2(D.target * 1000)} s`}</p>
          <p className={`sc-stroke font-display text-6xl tabular-nums leading-none ${denteEl >= DENTE.showFor && D.phase === 'GO' ? 'text-orange-300' : denteEl >= 0 || D.phase === 'REVEAL' ? 'text-lime-300' : 'text-yellow-300'}`}>{denteClock}</p>
        </div>
      )}
      {D && a.stage === 'PLAY' && D.phase === 'REVEAL' && D.stops && (
        <div className="pointer-events-none absolute left-3 top-[150px] flex max-h-[55vh] w-56 flex-col gap-1 overflow-hidden">
          {Object.entries(D.stops)
            .sort((x, y) => (x[1] === null ? 99 : Math.abs(x[1] / 1000 - D.target)) - (y[1] === null ? 99 : Math.abs(y[1] / 1000 - D.target)))
            .map(([id, ms], i) => {
              const e = ms === null ? null : ms / 1000 - D.target;
              const good = e !== null && Math.abs(e) <= DENTE.perfect;
              return (
                <p key={id} className={`feed-in sc-chip flex items-center gap-2 px-3 py-1 text-xs font-black text-white ${id === myId ? '!bg-amber-500/80' : ''}`} style={{ animationDelay: `${1.2 + i * 0.08}s` }}>
                  <span className="sc-stroke-sm w-4 font-display text-base">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                  <span className="tabular-nums">{ms === null ? '—' : `${sec2(ms)}s`}</span>
                  <span className={`w-12 text-right tabular-nums ${e === null ? 'text-white/60' : good ? 'text-emerald-300' : e < 0 ? 'text-yellow-300' : 'text-rose-300'}`}>{e === null ? '+5' : `${e >= 0 ? '+' : '−'}${Math.abs(e).toFixed(2).replace('.', ',')}`}</span>
                </p>
              );
            })}
        </div>
      )}
      {/* macedonia: il frutto da salvare */}
      {a.kind === 'FRUTTA' && a.stage === 'PLAY' && a.fruit && a.fruit.target !== null && (a.fruit.phase === 'HIDE' || a.fruit.phase === 'DROP') && (
        <div className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center">
          <div key={`${a.fruit.giro}`} className="pop sc-panel flex items-center gap-3 px-4 py-2">
            <FruitIcon fruit={a.fruit.target} size={coarse ? 64 : 76} />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-white/80">{a.fruit.phase === 'HIDE' ? 'Corri su' : 'Salvo chi è su'}</span>
              <span className="sc-stroke font-display text-3xl leading-none text-white">{FRUIT_NAMES[a.fruit.target]}</span>
            </div>
            {a.fruit.phase === 'HIDE' && <span className={`sc-stroke ml-1 font-display text-5xl tabular-nums ${fruitLeft <= 1 ? 'text-red-400' : 'text-yellow-300'}`}>{fruitLeft}</span>}
          </div>
        </div>
      )}
      {/* calcetto: il punteggio */}
      {a.kind === 'CALCIO' && a.soccer && a.stage !== 'INTRO' && (
        <div className="pointer-events-none absolute inset-x-0 top-[66px] flex justify-center">
          <div className="sc-chip flex items-center gap-2 overflow-hidden !p-0">
            {[0, 1].map((t) => (
              <span key={t} className={`flex items-center gap-2 px-3 py-1 font-display text-xl text-white ${t === 1 ? 'flex-row-reverse' : ''}`} style={{ background: TEAM_COLORS[t] }}>
                <span className="text-sm">{TEAM_NAMES[t]}{myTeam === t ? ' (tu)' : ''}</span>
                <span className="sc-stroke-sm text-3xl tabular-nums">{a.soccer!.score[t]}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* pomodorata: il mirino (si lancia dove guarda la telecamera) */}
      {a.kind === 'POMODORI' && a.stage === 'PLAY' && alive && (
        <svg className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="9" fill="none" stroke="#1d0f3d" strokeWidth="5" />
          <circle cx="17" cy="17" r="9" fill="none" stroke="#ff4d6d" strokeWidth="2.5" />
          <circle cx="17" cy="17" r="2" fill="#ffffff" />
        </svg>
      )}
      {(a.kind === 'POLPETTE' || a.kind === 'CORSA') && a.stage === 'PLAY' && alive && !finished && (
        <div className="pointer-events-none absolute left-3 top-1/2 h-48 w-5 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-[#1d0f3d] bg-[#1d0f3d]/60">
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-amber-500 to-yellow-300" style={{ height: `${climb * 100}%` }} />
        </div>
      )}

      {/* minigiochi a moduli: punteggi e pezzi in più */}
      {cm?.hud && hc && a.stage !== 'INTRO' && cm.hud(hc)}

      {/* stato del minigioco */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[160px] flex flex-col items-center gap-2 px-3 landscape:bottom-auto landscape:top-[70px]">{status}</div>

      {/* mirino del cecchino */}
      {sniper && a.stage === 'PLAY' && (
        <>
          {zoom && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 34%, rgba(10,4,30,0.92) 35%)' }} />}
          <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="14" fill="none" stroke="#1d0f3d" strokeWidth="6" />
            <circle cx="32" cy="32" r="14" fill="none" stroke="#ffffff" strokeWidth="3" />
            <path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="#1d0f3d" strokeWidth="6" strokeLinecap="round" />
            <path d="M32 4v14M32 46v14M4 32h14M46 32h14" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="32" r="2.5" fill="#ff4d6d" />
          </svg>
        </>
      )}

      {/* comandi */}
      {showControls && !sniper && a.kind === 'DENTE' && (
        <>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-[max(16px,env(safe-area-inset-left))]">
            <GameButton icon={<UiIcon name="jump" size={26} />} label="SALTA" cls="sc-blue" size={72} keyHint="W" onPress={() => actions.current.jump()} />
          </div>
          {a.stage === 'PLAY' && D && (
            <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))]">
              <GameButton
                icon={<UiIcon name="stop" size={48} />}
                label="SCOLA!"
                keyHint="SPAZIO / CLIC"
                cls={dStopped || D.phase !== 'GO' || denteEl < 0 ? 'sc-dark' : 'sc-yellow'}
                size={coarse ? 132 : 118}
                disabled={dStopped || D.phase !== 'GO' || denteEl < 0}
                onPress={() => actions.current.stop()}
              />
            </div>
          )}
        </>
      )}
      {showControls && !sniper && a.kind !== 'DENTE' && (
        <>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-[max(16px,env(safe-area-inset-left))]">
            <Joystick onMove={(x, y) => (joy.current = { x, y })} />
          </div>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] flex items-end gap-3">
            {a.stage === 'PLAY' && (
              <div className="flex flex-col items-center gap-3">
                {!noDash(a.kind) && (
                <GameButton icon={<UiIcon name="dash" size={26} />} label="SCATTO" cls="sc-yellow" size={64} keyHint="SHIFT" onPress={() => actions.current.dash()}>
                  {dashLeft > 0 && <span className="absolute inset-0 grid place-items-center rounded-full bg-[#1d0f3d]/60 font-display text-xl text-white">{Math.ceil(dashLeft / 1000)}</span>}
                </GameButton>
                )}
                {cmBtn ? (
                  <GameButton icon={cmBtn.icon} label={cmBtn.label} cls={cmBtn.cls} size={cmBtn.size ?? 78} keyHint={cmBtn.keyHint ?? 'E / CLIC'} disabled={cmBtn.disabled} onPress={() => cmBtn.press()}>
                    {cmBtn.cooldown && cmBtn.cooldown.until > Date.now() && (
                      <svg className="pointer-events-none absolute inset-[-6px]" viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd60a" strokeWidth="7" strokeDasharray={`${(1 - (cmBtn.cooldown.until - Date.now()) / cmBtn.cooldown.total) * 289} 289`} transform="rotate(-90 50 50)" strokeLinecap="round" />
                      </svg>
                    )}
                  </GameButton>
                ) : cm && noPush(a.kind) ? null : a.kind === 'POMODORI' ? (
                  <GameButton icon={<UiIcon name="tomato" size={32} />} label="LANCIA" cls="sc-red" size={80} keyHint="E / CLIC" onPress={() => actions.current.throwT()}>
                    {throwLeft > 0 && (
                      <svg className="pointer-events-none absolute inset-[-6px]" viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd60a" strokeWidth="7" strokeDasharray={`${(1 - throwLeft / MARKET.reload) * 289} 289`} transform="rotate(-90 50 50)" strokeLinecap="round" />
                      </svg>
                    )}
                  </GameButton>
                ) : a.kind === 'SNIPER' ? (
                  <GameButton icon={<UiIcon name="tomato" size={32} />} label="ALLA TORRE" cls="sc-red" size={80} keyHint="E" onPress={() => actions.current.blind()} />
                ) : a.kind === 'CALCIO' ? (
                  <GameButton icon={<UiIcon name="ball" size={30} />} label="TIRA" cls="sc-red" size={78} keyHint="E / CLIC" onPress={() => actions.current.push()} />
                ) : (
                  <GameButton icon={<UiIcon name="push" size={28} />} label="SCHIAFFO" cls="sc-red" size={72} keyHint="E / CLIC" onPress={() => actions.current.push()} />
                )}
              </div>
            )}
            <GameButton icon={<UiIcon name="jump" size={32} />} label="SALTA" cls="sc-blue" size={92} keyHint="SPAZIO" onPress={() => actions.current.jump()} />
          </div>
        </>
      )}
      {sniper && a.stage === 'PLAY' && !menu && (
        <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] flex items-end gap-3">
          <GameButton icon={<UiIcon name="scope" size={26} />} label={zoom ? 'NORMALE' : 'MIRINO'} cls="sc-dark" size={70} keyHint="CLIC DESTRO" onPress={() => setZoom((v) => !v)} />
          <GameButton icon={<UiIcon name="fire" size={34} />} label="SPARA" cls="sc-red" size={98} keyHint="CLIC" onPress={() => actions.current.fire()}>
            {reloadLeft > 0 && (
              <svg className="pointer-events-none absolute inset-[-6px]" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd60a" strokeWidth="7" strokeDasharray={`${(1 - reloadLeft / SNIPER.reload) * 289} 289`} transform="rotate(-90 50 50)" strokeLinecap="round" />
              </svg>
            )}
          </GameButton>
        </div>
      )}
      {a.stage === 'PLAY' && !coarse && noLock && !locked && (
        <p className="sc-chip pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1 text-center text-xs font-bold text-[#ffd60a]">
          Questo browser non lascia catturare il mouse: aprilo in Chrome o Edge per giocare come in un vero FPS
        </p>
      )}
      {showControls && a.stage === 'PLAY' && !coarse && (
        <p className="sc-chip pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold text-white">
          {cm?.hint
            ? cm.hint
            : sniper
            ? 'Muovi il mouse per mirare · tasto destro mirino · sinistro spara'
            : a.kind === 'PONTE'
              ? 'WASD muovi · spazio salta · E schiaffo · qui niente doppio salto!'
              : a.kind === 'DENTE'
                ? 'Spazio, E o clic sinistro = SCOLA! · W salta (per l’ansia)'
                : a.kind === 'POMODORI'
                  ? `WASD muovi · mouse mira · clic sinistro o E lancia · spazio salta · Shift scatto${locked ? ' · Esc libera il mouse' : ''}`
                  : a.kind === 'CALCIO'
                    ? `WASD muovi · mouse gira · clic sinistro o E tira · spazio salta · Shift scatto${locked ? ' · Esc libera il mouse' : ''}`
                    : `WASD muovi · mouse gira la visuale · spazio salta (2 volte = doppio) · Shift scatto/tuffo · E schiaffo${locked ? ' · Esc libera il mouse' : ''}`}
        </p>
      )}

      {/* pomodoro in faccia */}
      {splatAt > 0 && Date.now() - splatAt < 1700 && (
        <div key={splatAt} className="pointer-events-none absolute inset-0 z-20" style={{ animation: 'p3splat 1.6s ease-out forwards' }}>
          <style>{'@keyframes p3splat{0%{opacity:1;transform:scale(1.08)}12%{transform:scale(1)}70%{opacity:.9}100%{opacity:0;transform:translateY(14px)}}'}</style>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g fill="#d62828" opacity="0.88">
              <path d="M-6 -4 C12 2 22 -2 26 10 C30 22 18 26 22 36 C10 34 4 40 -6 34 Z" />
              <path d="M106 70 C92 66 80 72 76 84 C72 98 84 100 86 108 L106 108 Z" />
              <path d="M70 -6 C72 6 82 10 90 6 C98 2 104 8 106 -6 Z" />
              <circle cx="34" cy="20" r="3.4" />
              <circle cx="70" cy="86" r="2.6" />
              <circle cx="84" cy="22" r="2" />
              <circle cx="16" cy="48" r="2.4" />
              <path d="M18 34 q1 10 -1 16 q-2 2 -3 0 q0 -8 1 -16 Z" />
              <path d="M84 6 q1 8 0 12 q-2 2 -3 0 q0 -6 0 -12 Z" />
            </g>
            <g fill="#ff8f8f" opacity="0.55">
              <ellipse cx="10" cy="10" rx="5" ry="2.5" transform="rotate(-25 10 10)" />
              <ellipse cx="92" cy="88" rx="5" ry="2.4" transform="rotate(-20 92 88)" />
            </g>
            <g fill="#2d9c4a">
              <path d="M22 12 l-4 -3 l1 4 l-4 2 l5 0 l1 4 l2 -4 l5 -1 l-4 -2 l2 -4 Z" />
            </g>
          </svg>
        </div>
      )}

      {/* VIA! */}
      {goFlash && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="count-pop sc-stroke font-display text-8xl text-yellow-300">VIA!</p>
        </div>
      )}

      {/* introduzione del minigioco */}
      {a.stage === 'INTRO' && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-hidden bg-[#1d0f3d]/35 p-4">
          <div className="swoosh absolute inset-x-[-15%] top-1/2 h-[60%] -translate-y-1/2 border-y-[6px] border-[#1d0f3d] bg-linear-to-r from-fuchsia-500 via-violet-600 to-sky-500 landscape:h-[72%]" />
          <div className="relative flex max-w-xl flex-col items-center gap-2 text-center landscape:flex-row landscape:gap-6 landscape:text-left">
            <div className="swoosh-in shrink-0">
              <MiniIcon kind={a.kind} size={coarse ? 104 : 128} />
            </div>
            <div className="flex flex-col items-center gap-1.5 landscape:items-start">
              <p className="sc-chip px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                Minigioco {a.round + 1} di {a.rounds} · {info.tag}
              </p>
              <h2 className="sc-stroke font-display text-4xl leading-none text-white sm:text-5xl">{info.name}</h2>
              <p className="max-w-md text-sm font-bold leading-snug text-white drop-shadow-[0_2px_0_rgba(29,15,61,0.8)]">{info.rules}</p>
              {a.kind === 'SNIPER' && <p className={`sc-btn mt-1 px-4 py-1.5 font-display text-xl ${sniper ? 'sc-red' : 'sc-green'}`}>{sniper ? 'SEI UN CECCHINO' : 'SEI UN CORRIDORE'}</p>}
            </div>
          </div>
          {introLeft > 0 && introLeft <= 3 && (
            <p key={introLeft} className="count-pop sc-stroke pointer-events-none absolute bottom-[12%] font-display text-8xl text-yellow-300 landscape:bottom-[6%]">
              {introLeft}
            </p>
          )}
          {canLead && (
            <button type="button" onClick={() => onAction('MG_FORCE')} className="sc-btn sc-yellow absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-4 px-4 py-2 font-display text-base">
              Inizia subito
            </button>
          )}
        </div>
      )}

      {/* risultati del minigioco */}
      {a.stage === 'RESULT' && a.roundPoints && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-[#1d0f3d]/45 p-4">
          <div className="sc-panel pop flex w-full max-w-md flex-col gap-1.5 p-4">
            <div className="flex items-center justify-center gap-2">
              <MiniIcon kind={a.kind} size={44} />
              <p className="sc-stroke font-display text-3xl text-white">Fine!</p>
            </div>
            <div className="stagger flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto">
              {ranking.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-2xl border-[3px] border-[#1d0f3d] px-3 py-1 ${p.id === myId ? 'bg-amber-400/40' : 'bg-white/10'}`}>
                  <span className="sc-stroke-sm w-5 font-display text-lg text-white">{i + 1}</span>
                  <MiniAvatar color={p.color} size={26} />
                  <span className="min-w-0 flex-1 truncate font-black text-white">
                    {nameOf(p.id)} {p.bot && <span className="ml-1 rounded-md bg-white/20 px-1.5 text-[10px] font-black">BOT</span>}
                  </span>
                  {(a.roundPoints![p.id] ?? 0) > 0 && <span className="sc-btn sc-green shrink-0 px-2 text-sm font-black">+{a.roundPoints![p.id]}</span>}
                  <span className="sc-stroke-sm w-10 text-right font-display text-xl text-amber-300">{a.points[p.id] ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-sm font-black text-white">
              {nextKind ? (
                <>
                  Prossimo <MiniIcon kind={nextKind} size={28} /> {MINIGAMES[nextKind].name}
                </>
              ) : (
                'Ultimo minigioco: ecco il podio!'
              )}
            </div>
            {canLead && (
              <button type="button" onClick={() => onAction('MG_FORCE')} className="sc-btn sc-yellow mx-auto px-6 py-2 font-display text-lg">
                Avanti
              </button>
            )}
          </div>
        </div>
      )}

      {/* impostazioni (come su Roblox: si apre dall'ingranaggio) */}
      {menu && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[#0b0623]/70 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="sc-panel pop flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <h3 className="sc-stroke font-display text-3xl text-white">Impostazioni</h3>
              <button type="button" onClick={() => setMenu(false)} className="sc-btn sc-red grid h-10 w-10 place-items-center font-display text-xl" aria-label="Chiudi">
                ✕
              </button>
            </div>
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-black text-white">
                <UiIcon name="sound" size={24} /> Volume <span className="ml-auto font-display text-amber-300">{volume}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  soundManager.setVolume(v / 100);
                }}
                onPointerUp={() => soundManager.playPop()}
                className="sc-range w-full"
                style={{ ['--fill' as string]: `${volume}%` }}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-black text-white">
                <UiIcon name="aim" size={24} /> Sensibilità telecamera e mira <span className="ml-auto font-display text-amber-300">{prefs.sens.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={20}
                max={300}
                step={10}
                value={Math.round(prefs.sens * 100)}
                onChange={(e) => setPrefs((p) => ({ ...p, sens: Number(e.target.value) / 100 }))}
                className="sc-range w-full"
                style={{ ['--fill' as string]: `${((prefs.sens * 100 - 20) / 280) * 100}%` }}
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-black text-white">
                <UiIcon name="eye" size={24} /> Telecamera
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['segue', 'libera'] as CamMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setPrefs((p) => ({ ...p, cam: m }))} className={`sc-btn py-2 font-display text-base ${prefs.cam === m ? 'sc-yellow' : 'sc-dark'}`}>
                    {m === 'segue' ? 'Automatica' : 'Manuale'}
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-white/70">{prefs.cam === 'segue' ? 'Quando giri, la visuale ti segue da sola (puoi comunque girarla col dito).' : 'La visuale la giri solo tu, trascinando (o col mouse).'}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 font-black text-white">
                <UiIcon name="eye" size={24} /> Grafica
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['auto', 'alta', 'bassa'] as Quality[]).map((q) => (
                  <button key={q} type="button" onClick={() => setPrefs((p) => ({ ...p, quality: q }))} className={`sc-btn py-2 font-display text-base capitalize ${prefs.quality === q ? 'sc-yellow' : 'sc-dark'}`}>
                    {q === 'auto' ? 'Automatica' : q}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setRulesOpen((v) => !v)} className="sc-btn sc-blue flex items-center justify-center gap-2 py-2.5 font-display text-lg">
              <UiIcon name="book" size={22} /> Come si gioca
            </button>
            {rulesOpen && (
              <div className="rounded-2xl border-[3px] border-[#1d0f3d] bg-white/10 p-3 text-sm font-bold text-white">
                <p className="mb-1 flex items-center gap-2 font-display text-lg">
                  <MiniIcon kind={a.kind} size={30} /> {info.name}
                </p>
                {info.rules}
                <p className="mt-2 text-white/80">Trascina sullo schermo per girare la telecamera (o per mirare, se sei un cecchino).</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMenu(false)} className="sc-btn sc-green py-3 font-display text-lg">
                Riprendi
              </button>
              <button type="button" onClick={() => onLeave?.()} className="sc-btn sc-red flex items-center justify-center gap-1.5 py-3 font-display text-lg">
                <UiIcon name="exit" size={22} /> Esci
              </button>
            </div>
          </div>
        </div>
      )}
      {stickerView}
    </div>,
    document.body,
  );
}
