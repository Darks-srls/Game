// "Non lasciarmi solo": horror cooperativo in prima persona. Il mio personaggio si muove subito (fisica locale),
// i compagni e il Custode arrivano dal server ~15 volte al secondo. Pochi comandi, conseguenze lunghe.
// Telefono: pollice sinistro muove, destro guarda, un solo grande pulsante contestuale. PC: WASD, mouse, E.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import type { Horror1View } from '../types/game';
import {
  DOORS,
  DYN_PROPS,
  FLOOR_NAMES,
  GRIDS,
  H1,
  HIDES,
  ITEM_NAMES,
  MOVE,
  PROPS,
  ROOMS,
  STATIONS,
  USE_RANGE,
  VOICE,
  doorSeg,
  floorBase,
  groundAt,
  roomAt,
  stepHuman,
  wallsBetween,
  type HBody,
  type StationDef,
} from '../data/horror1';
import { animateDyn, buildDyn, buildExterior, createHorrorWorld, makeItem, updateRain, type HWorld } from './horror/world';
import { animateCustode, animateJumpscare, animateWorker, loadMonsterModel, makeCustode, makeFirstPerson, makeJumpscare, makeMonster, makeWorker, type Monster, type Worker } from './horror/actors';
import { HorrorAudio, type RoomSound, type StepMat } from './horror/sound';
import { ProximityVoice } from './horror/voice';
import { floorWord, objectives, progressOf, type Objective } from './horror/objectives';
import { TaskGame, type TaskSfx, type TaskSpec } from './horror/TaskGame';
import { useGameFullscreen, EndBar, type ModeProps } from './ui';

type V3 = { x: number; y: number; z: number };
const PINGS: { k: string; text: string; danger?: boolean }[] = [
  { k: 'qui', text: 'Sono qui' },
  { k: 'vieni', text: 'Vieni' },
  { k: 'aspetta', text: 'Aspetta' },
  { k: 'pericolo', text: 'Pericolo', danger: true },
  { k: 'aiuto', text: 'Serve aiuto', danger: true },
  { k: 'trovato', text: 'Ho trovato qualcosa' },
  { k: 'pronto', text: 'Pronto' },
];
const STABILITY = [
  { name: 'Operativo', color: '#7fb77e' },
  { name: 'In sovraccarico', color: '#e0b84a' },
  { name: 'Instabile', color: '#e07a3a' },
  { name: 'Evacuazione', color: '#e04a3a' },
];
const CHARGERS = [
  { id: 'carica-atrio', f: 1, x: 16.6, z: 1.5, name: 'Caricabatterie' },
  { id: 'carica-officina', f: 0, x: 6.4, z: 15.2, name: 'Caricabatterie' },
];
const PREFS_KEY = 'axend_horror_prefs';
type Prefs = { sens: number; quality: 'auto' | 'alta' | 'bassa'; toggleHold: boolean; captions: boolean; volume: number; markers: boolean };
function loadPrefs(): Prefs {
  try {
    return { sens: 1, quality: 'auto', toggleHold: false, captions: true, volume: 0.9, markers: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { sens: 1, quality: 'auto', toggleHold: false, captions: true, volume: 0.9, markers: true };
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // memoria del browser non disponibile
  }
}

const stepMat = (f: number, x: number, z: number, water: number): StepMat => {
  const rm = roomAt(f, x, z);
  if (!rm) return 'cemento';
  if (rm.id === 'U' && f === 0 && water > 0.15) return 'acqua';
  if (rm.floor === 'parquet') return 'legno';
  if (rm.floor === 'marmo') return 'marmo';
  if (rm.floor === 'terrazzo') return 'terrazzo';
  if (rm.floor === 'piastrelle' || rm.floor === 'cucina') return 'piastrelle';
  return 'cemento';
};
const roomSound = (f: number, x: number, z: number): RoomSound => {
  const rm = roomAt(f, x, z);
  if (!rm) return 'corridoio';
  if (rm.zone === 'scale' || rm.id === 'A' || rm.id === 'B' || rm.id === 'L') return 'scale';
  if (f === 0) return 'cantina';
  if (rm.zone === 'tecnico') return 'tecnico';
  if (rm.zone === 'casa') return 'piccola';
  return 'corridoio';
};
const doorCenter = (d: (typeof DOORS)[number]) => {
  const [x0, z0, x1, z1] = doorSeg(d);
  return { x: (x0 + x1) / 2, y: floorBase(d.f) + 1.2, z: (z0 + z1) / 2 };
};
const stationPos = (st: StationDef) => ({ x: st.x, y: floorBase(st.f) + st.y, z: st.z });
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Pulsante che resta premuto (per i lavori) o tocco (per porte e oggetti)
function TouchBtn({ label, onDown, onUp, big, active, children }: { label: string; onDown: () => void; onUp?: () => void; big?: boolean; active?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onUp?.();
      }}
      onPointerCancel={() => onUp?.()}
      className={`grid select-none place-items-center rounded-full border border-white/25 text-[11px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm ${big ? 'h-24 w-24 bg-white/15' : 'h-14 w-14 bg-black/40'} ${active ? '!bg-amber-200/30 !border-amber-200/70' : ''}`}
    >
      {children ?? label}
    </button>
  );
}

function Stick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const upd = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setK({ x: dx, y: dy });
    onMove(dx / max, dy / max);
  };
  const end = () => {
    id.current = null;
    setK({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={base}
      className="relative grid h-32 w-32 touch-none place-items-center rounded-full border border-white/20 bg-black/30"
      onPointerDown={(e) => {
        e.stopPropagation();
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        upd(e);
      }}
      onPointerMove={(e) => id.current === e.pointerId && upd(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="h-14 w-14 rounded-full border border-white/40 bg-white/20" style={{ transform: `translate(${k.x}px, ${k.y}px)` }} />
    </div>
  );
}

export default function HorrorView({ state, clockOffset, canLead, onAction, onNewGame, onBackToLobby, onLeave, realtime }: ModeProps) {
  const v = state.mg as Horror1View;
  const myId = state.myId;
  const dataRef = useRef(v);
  dataRef.current = v;
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const actRef = useRef(onAction);
  actRef.current = onAction;
  const rtLink = useRef(realtime);
  rtLink.current = realtime;
  const now = () => Date.now() + offsetRef.current;
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const namesRef = useRef(nameOf);
  namesRef.current = nameOf;
  const colorOf = (id: string) => state.players.find((p) => p.id === id)?.color ?? '#cccccc';
  const colorsRef = useRef(colorOf);
  colorsRef.current = colorOf;
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);
  useGameFullscreen();

  const [prefs, setPrefs] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [entered, setEntered] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const [tablet, setTablet] = useState<null | 'lavori' | 'pianta' | 'registro'>(null);
  const tabletRef = useRef(tablet);
  tabletRef.current = tablet;
  const [wheel, setWheel] = useState(false);
  const [radioMode, setRadioMode] = useState(false);
  const [mic, setMic] = useState<'off' | 'on' | 'no'>('off');
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState<{ key: number; text: string; at: number; danger?: boolean }[]>([]);
  const [prompt, setPrompt] = useState<{ text: string; sub?: string; prog: number; kind: string } | null>(null);
  const [torchUi, setTorchUi] = useState({ on: true, charge: 1 });
  const [planFloor, setPlanFloor] = useState(1);
  const [, setTick] = useState(0);
  const [locked, setLocked] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HorrorAudio | null>(null);
  const voiceRef = useRef<ProximityVoice | null>(null);
  const body = useRef<HBody>({ x: 11, y: 0, z: 2.6, f: 1, yaw: 0, pitch: 0, vy: 0, stamina: MOVE.stamina });
  const look = useRef({ yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());
  const joy = useRef({ x: 0, y: 0 });
  const crouch = useRef(false);
  const torch = useRef({ on: true, charge: 1 });
  const useDown = useRef<{ at: number; target: string | null; sent: number; kind: string } | null>(null);
  const target = useRef<{ kind: 'station' | 'door' | 'item' | 'rescue' | 'carica' | 'hide'; id: string; text: string; sub?: string } | null>(null);
  const shake = useRef(0);
  const hurtFlash = useRef(0);
  const doorGuess = useRef(new Map<string, { open: boolean; until: number }>());
  const charging = useRef<{ id: string; t: number } | null>(null);
  const radioDown = useRef(false);
  const pings = useRef<{ x: number; y: number; z: number; f: number; text: string; until: number; danger: boolean }[]>([]);
  const [pingTags, setPingTags] = useState<{ key: string; x: number; y: number; text: string; danger: boolean; far: number }[]>([]);
  const [marks, setMarks] = useState<{ key: string; x: number; y: number; label: string; far: number; floor: string; maybe: boolean; edge: boolean }[]>([]);
  const [banner, setBanner] = useState<{ title: string; text: string; key: number; tone: 'ok' | 'warn' | 'danger' } | null>(null);
  const [objOpen, setObjOpen] = useState(true);
  // su telefono lo spazio è poco: tempo dentro il pannello e solo le righe che servono adesso
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const objRef = useRef<Objective[]>([]);
  // lavoro interattivo aperto (minigioco)
  const [task, setTask] = useState<TaskSpec | null>(null);
  const taskRef = useRef<TaskSpec | null>(null);
  taskRef.current = task;
  const taskProg = useRef(0);
  // nascondiglio: fiato trattenuto
  const [breathUi, setBreathUi] = useState<{ need: boolean; bar: number; holding: boolean }>({ need: false, bar: 1, holding: false });
  const breath = useRef({ bar: 1, holding: false, lockUntil: 0, sentAt: 0 });
  const wasHidden = useRef<string | null>(null);
  // minaccia vicina (dal ciclo di gioco, aggiornata qualche volta al secondo)
  const [voiceLvl, setVoiceLvl] = useState(0);
  const voiceLoud = useRef({ since: 0, sentAt: 0 });
  const [tutorial, setTutorial] = useState(false);
  const tutorialSeen = useRef(false);
  const struggle = useRef({ last: '', n: 0 });
  const [struggleN, setStruggleN] = useState(0);
  const slowDoors = useRef(new Map<string, number>());
  const darkUntil = useRef(0);

  const me = v.players[myId];
  const myState = me?.state ?? 'uscito';
  const active = myState === 'ok' || myState === 'ferito';

  const caption = (text: string, danger = false) => {
    if (!prefsRef.current.captions && !danger) return;
    setCaptions((c) => [...c.filter((x) => x.text !== text).slice(-3), { key: Date.now() + Math.random(), text, at: Date.now(), danger }]);
  };
  const captionRef = useRef(caption);
  captionRef.current = caption;

  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      setCaptions((c) => (c.length && Date.now() - c[0].at > 5000 ? c.filter((x) => Date.now() - x.at < 5000) : c));
    }, 300);
    return () => clearInterval(t);
  }, []);
  useEffect(() => savePrefs(prefs), [prefs]);
  const milestones = `${v.luce === 'ok'}|${v.pompaOn}|${v.batteria}|${v.collaudo.done}|${v.stage}|${v.luce}|${!!v.leak}|${v.modulo}`;
  const lastMilestones = useRef('');
  useEffect(() => {
    const prev = lastMilestones.current.split('|');
    lastMilestones.current = milestones;
    if (!prev[0]) return;
    const n = progressOf(v);
    const show = (title: string, text: string, tone: 'ok' | 'warn' | 'danger' = 'ok') => {
      setBanner({ title, text, key: Date.now(), tone });
      setTimeout(() => setBanner((b) => (b && Date.now() - b.key > 3800 ? null : b)), 4000);
    };
    if (prev[0] === 'false' && v.luce === 'ok') show(`Impianto ripristinato · ${n}/4`, 'Luci del secondo piano accese');
    else if (prev[1] === 'false' && v.pompaOn) show(`Impianto ripristinato · ${n}/4`, 'Pompa riavviata: l’acqua scende');
    else if (prev[2] === 'false' && v.batteria) show(`Impianto ripristinato · ${n}/4`, 'Batteria di emergenza installata');
    else if (prev[3] === 'false' && v.collaudo.done) show('Collaudo riuscito', 'L’uscita di servizio è aperta: uscite tutti!');
    else if (prev[5] !== 'test' && v.luce === 'test') show('Test luci avviato', 'Correte alla lampada di prova del secondo piano (60 s)', 'warn');
    else if (prev[6] === 'false' && v.leak) show('Perdita di pressione', 'Chiudete la valvola prima che l’edificio peggiori', 'warn');
    else if (prev[7] === 'false' && v.modulo) show('Modulo montato', 'Ora avvia il test dal quadro luci', 'ok');
    else if (prev[4] !== 'EVAC' && v.stage === 'EVAC') show('Evacuazione', 'Uscite subito: porta di servizio se aperta, altrimenti il furgone', 'danger');
    if (v.luce === 'ok' && v.pompaOn && v.batteria && !v.collaudo.done && !(prev[0] === 'true' && prev[1] === 'true' && prev[2] === 'true'))
      setTimeout(() => show('Impianti pronti · 3/4', 'Ultimo passo: il collaudo dell’uscita, in due postazioni'), 4200);
  }, [milestones]);
  useEffect(() => audioRef.current?.setVolume(prefs.volume), [prefs.volume]);

  // ---------------------------------------------------------------- entrare (sblocca l'audio) e microfono
  const enter = async (withMic: boolean) => {
    if (!audioRef.current) {
      const a = new HorrorAudio();
      a.setVolume(prefsRef.current.volume);
      a.startAmbient();
      audioRef.current = a;
    }
    audioRef.current.resume();
    const link = rtLink.current;
    if (link && !voiceRef.current) {
      const voice = new ProximityVoice(myId, (buf) => rtLink.current?.voiceSend(buf), audioRef.current);
      voiceRef.current = voice;
      link.voiceIn.current = (from, flags, data) => voice.onVoice(from, flags, data);
      if (withMic) setMic((await voice.start()) ? 'on' : 'no');
      voice.setPeers(Object.keys(dataRef.current.players));
    } else if (withMic && voiceRef.current && !voiceRef.current.ready) setMic((await voiceRef.current.start()) ? 'on' : 'no');
    setEntered(true);
  };
  useEffect(
    () => () => {
      voiceRef.current?.stop();
      audioRef.current?.dispose();
      if (rtLink.current) rtLink.current.voiceIn.current = null;
    },
    [],
  );
  useEffect(() => {
    voiceRef.current?.setPeers(Object.keys(v.players));
  }, [Object.keys(v.players).join(',')]);

  // ---------------------------------------------------------------- azioni
  const sendPing = (k: string, radio: boolean) => {
    const b = body.current;
    const fx = Math.sin(b.yaw) * Math.cos(b.pitch);
    const fz = Math.cos(b.yaw) * Math.cos(b.pitch);
    // il ping va dove guardo (fino a 6 metri, se non c'è un muro prima)
    let d = 6;
    for (let s = 0.5; s <= 6; s += 0.25) if (wallsBetween(b.f, b.x, b.z, b.x + fx * s, b.z + fz * s, openDoors(), 1)) {
      d = s - 0.3;
      break;
    }
    actRef.current('MG_PING', { k, radio, x: b.x + fx * d, y: b.y + 1.4 + Math.sin(b.pitch) * d, z: b.z + fz * d });
    setWheel(false);
  };
  const openDoors = () => {
    const s = dataRef.current;
    const set = new Set<string>();
    for (const [id, d] of Object.entries(s.doors)) {
      const g = doorGuess.current.get(id);
      const open = g && Date.now() < g.until ? g.open : d.open;
      if (open) set.add(id);
    }
    return set;
  };
  const sfx = (w: TaskSfx) => audioRef.current?.task(w);
  const closeTask = () => {
    const u = useDown.current;
    if (u?.kind === 'task') {
      useDown.current = null;
      actRef.current('MG_RELEASE');
    }
    taskProg.current = 0;
    setTask(null);
  };
  const openTask = (spec: TaskSpec, hold: boolean) => {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      // niente blocco del mouse
    }
    taskProg.current = dataRef.current.prog[spec.st] ?? 0;
    if (hold) {
      useDown.current = { at: Date.now(), target: spec.st, sent: Date.now(), kind: 'task' };
      actRef.current('MG_HOLD', { st: spec.st });
    }
    audioRef.current?.task('click');
    setTask(spec);
  };
  const struggleKey = (k: 'a' | 'd') => {
    if (struggle.current.last === k) return;
    struggle.current.last = k;
    struggle.current.n++;
    setStruggleN(struggle.current.n);
    if (struggle.current.n >= 10) {
      struggle.current.n = 0;
      setStruggleN(0);
      actRef.current('MG_LOTTA');
    }
  };
  const useStart = () => {
    const t = target.current;
    const s = dataRef.current;
    // E chiude il lavoro aperto / fa uscire dal nascondiglio
    if (taskRef.current) {
      closeTask();
      return;
    }
    if (s.players[myId]?.hidden) {
      actRef.current('MG_HIDE', {});
      return;
    }
    if (t?.kind === 'hide') {
      actRef.current('MG_HIDE', { id: t.id });
      return;
    }
    if (t?.kind === 'rescue') {
      openTask({ kind: 'lucchetto', st: t.id, title: `Libera ${namesRef.current(t.id)}`, hint: 'La combinazione la vede solo chi è incatenato: fattela dire (voce, radio o registro). Ogni tentativo sbagliato fa rumore.' }, false);
      return;
    }
    if (t?.kind === 'station') {
      const st = STATIONS.find((x) => x.id === t.id);
      const spec = st ? taskFor(s, st, myId) : null;
      if (spec) {
        openTask(spec, PROGRESS_TASKS.includes(spec.kind));
        return;
      }
    }
    if (!t || !s.players[myId] || !['ok', 'ferito'].includes(s.players[myId].state)) {
      // niente davanti: con un oggetto in mano, lo si appoggia
      return;
    }
    audioRef.current?.resume();
    if (t.kind === 'door') {
      useDown.current = { at: Date.now(), target: t.id, sent: 0, kind: 'door' };
      return;
    }
    if (t.kind === 'item') {
      actRef.current('MG_PICK', { id: t.id });
      audioRef.current?.pickup();
      return;
    }
    if (t.kind === 'carica') {
      charging.current = { id: t.id, t: 0 };
      useDown.current = { at: Date.now(), target: t.id, sent: Date.now(), kind: 'carica' };
      return;
    }
    if (prefsRef.current.toggleHold && useDown.current?.target === t.id) {
      useEnd(true);
      return;
    }
    useDown.current = { at: Date.now(), target: t.id, sent: Date.now(), kind: t.kind };
    actRef.current('MG_HOLD', { st: t.id });
  };
  const useEnd = (force = false) => {
    const u = useDown.current;
    if (!u) return;
    if (u.kind === 'task') return;
    if (prefsRef.current.toggleHold && !force && (u.kind === 'station' || u.kind === 'rescue')) return;
    useDown.current = null;
    charging.current = null;
    if (u.kind === 'door') {
      const s = dataRef.current;
      const held = Date.now() - u.at;
      const d = s.doors[u.target!];
      if (held > 650 && d && !d.open && !d.blocked && s.fermi > 0) {
        // tenendo premuto su una porta chiusa: fermo
        actRef.current('MG_HOLD', { st: u.target, kind: 'blocca' });
        setTimeout(() => actRef.current('MG_HOLD', { st: u.target, kind: 'blocca' }), 900);
        setTimeout(() => actRef.current('MG_HOLD', { st: u.target, kind: 'blocca' }), 1800);
        setTimeout(() => actRef.current('MG_RELEASE'), 2600);
        captionRef.current('Metti il fermo alla porta…');
        return;
      }
      if (d && !d.lock) doorGuess.current.set(u.target!, { open: !d.open, until: Date.now() + 700 });
      actRef.current('MG_DOOR', { id: u.target });
      return;
    }
    if (u.kind === 'carica') return;
    actRef.current('MG_RELEASE');
  };
  const drop = () => {
    if (dataRef.current.players[myId]?.carrying) actRef.current('MG_DROP');
  };
  const toggleTorch = () => {
    torch.current.on = !torch.current.on;
    audioRef.current?.torch(torch.current.on);
    setTorchUi({ ...torch.current });
  };
  const radio = (on: boolean) => {
    radioDown.current = on;
    voiceRef.current?.setRadio(on);
    audioRef.current?.radioClick(on);
  };
  const acts = useRef({ useStart, useEnd, drop, toggleTorch, radio, sendPing, struggleKey, closeTask });
  acts.current = { useStart, useEnd, drop, toggleTorch, radio, sendPing, struggleKey, closeTask };

  // ---------------------------------------------------------------- tastiera e mouse (PC)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      keys.current.add(k);
      if (k === ' ') breath.current.holding = true;
      if (e.repeat) return;
      const me0 = dataRef.current.players[myId];
      if (me0?.state === 'intrappolato' && (k === 'a' || k === 'd' || k === 'arrowleft' || k === 'arrowright')) acts.current.struggleKey(k === 'a' || k === 'arrowleft' ? 'a' : 'd');
      if (k === 'e') acts.current.useStart();
      if (k === 'g') acts.current.drop();
      if (k === 'f') acts.current.toggleTorch();
      if (k === 'c' || k === 'control') crouch.current = !crouch.current;
      if (k === 'q') setWheel((w) => !w);
      if (k === 'v' || k === 'r') acts.current.radio(true);
      if (k === 'tab') setTablet((t) => (t ? null : 'lavori'));
      if (k === 'm') {
        const m = !voiceRef.current?.muted;
        voiceRef.current?.setMuted(m);
        setMuted(m);
      }
      if (k === 'escape') {
        if (taskRef.current) acts.current.closeTask();
        else if (tabletRef.current) setTablet(null);
        else setMenu((x) => !x);
      }
      if (/^[1-7]$/.test(k) && wheelRef.current) acts.current.sendPing(PINGS[Number(k) - 1].k, radioRef.current);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.delete(k);
      if (k === ' ') breath.current.holding = false;
      if (k === 'e') acts.current.useEnd();
      if (k === 'v' || k === 'r') acts.current.radio(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const wheelRef = useRef(wheel);
  wheelRef.current = wheel;
  const radioRef = useRef(radioMode);
  radioRef.current = radioMode;

  const lookBy = (dx: number, dy: number) => {
    const s = prefsRef.current.sens;
    look.current.yaw -= dx * 0.0032 * s;
    look.current.pitch = Math.max(-1.35, Math.min(1.35, look.current.pitch - dy * 0.0032 * s));
  };
  useEffect(() => {
    const onLock = () => setLocked(document.pointerLockElement === zoneRef.current);
    document.addEventListener('pointerlockchange', onLock);
    if (coarse) return () => document.removeEventListener('pointerlockchange', onLock);
    let lx: number | null = null;
    let ly = 0;
    const isLocked = () => document.pointerLockElement === zoneRef.current;
    const tryLock = () => {
      if (isLocked() || menuRef.current || tabletRef.current || taskRef.current || !zoneRef.current) return;
      try {
        const r = zoneRef.current.requestPointerLock() as unknown;
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
      } catch {
        // si gira comunque muovendo il mouse
      }
    };
    const mm = (e: MouseEvent) => {
      if (menuRef.current || tabletRef.current || taskRef.current) {
        lx = null;
        return;
      }
      if (isLocked()) return lookBy(e.movementX, e.movementY);
      if (lx !== null) lookBy((e.clientX - lx) * 1.4, (e.clientY - ly) * 1.4);
      lx = e.clientX;
      ly = e.clientY;
    };
    const md = (e: MouseEvent) => {
      if (!(isLocked() || e.target === zoneRef.current)) return;
      tryLock();
      if (e.button === 0) acts.current.useStart();
      if (e.button === 2) acts.current.toggleTorch();
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) acts.current.useEnd();
    };
    const cm = (e: MouseEvent) => {
      if (isLocked() || e.target === zoneRef.current) e.preventDefault();
    };
    const out = () => (lx = null);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mousedown', md);
    document.addEventListener('mouseup', mu);
    document.addEventListener('contextmenu', cm);
    document.documentElement.addEventListener('mouseleave', out);
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mousedown', md);
      document.removeEventListener('mouseup', mu);
      document.removeEventListener('contextmenu', cm);
      document.documentElement.removeEventListener('mouseleave', out);
      if (isLocked()) document.exitPointerLock();
    };
  }, []);
  useEffect(() => {
    if ((menu || tablet) && document.pointerLockElement) document.exitPointerLock();
  }, [menu, tablet]);
  // telefono: trascinare sulla metà destra gira la visuale
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && !coarse) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    lookBy((e.clientX - d.x) * 1.5, (e.clientY - d.y) * 1.5);
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = () => (drag.current = null);

  // ---------------------------------------------------------------- eventi dal server
  useEffect(() => {
    const link = realtime;
    if (!link) return;
    link.p3events.current = (type, p) => {
      if (type !== 'P3_FX') return;
      const a = audioRef.current;
      const s = dataRef.current;
      const doorPos = (id: string) => {
        const d = DOORS.find((x) => x.id === id);
        return d ? doorCenter(d) : null;
      };
      switch (p.k) {
        case 'log':
          if (p.kind !== 'info') captionRef.current(p.text, p.kind === 'danger');
          break;
        case 'colpi':
          a?.metalKnocks(p);
          captionRef.current(`Due colpi metallici · ${p.zone}`, true);
          break;
        case 'bussa': {
          const dp = doorPos(p.door);
          if (dp) a?.doorKnocks(dp);
          const d = DOORS.find((x) => x.id === p.door);
          captionRef.current(`Tre colpi su una porta · ${d ? FLOOR_NAMES[d.f] : ''}`, true);
          break;
        }
        case 'sfonda': {
          const dp = doorPos(p.door);
          if (dp) a?.doorBreak(dp);
          captionRef.current('Una porta si è spalancata', true);
          break;
        }
        case 'apparizione':
          a?.stinger(false);
          if (!tutorialSeen.current) {
            tutorialSeen.current = true;
            setTimeout(() => setTutorial(true), 5200);
          }
          if (p.to === myId) captionRef.current('C’è qualcuno in fondo… ti sta fissando', true);
          break;
        case 'scatto':
          a?.scream();
          shake.current = 0.6;
          break;
        case 'nascondiglio': {
          const h = HIDES.find((x) => x.id === p.hide);
          if (h && a) a.door({ x: h.ex, y: floorBase(h.f) + 1, z: h.ez }, p.in, 'legno');
          if (p.id === myId && p.in) {
            torch.current.on = false;
            setTorchUi({ ...torch.current });
            captionRef.current('Sei nascosto. Torcia spenta. Se si avvicina, trattieni il fiato (SPAZIO)');
          }
          break;
        }
        case 'scovato':
          if (p.id !== myId) captionRef.current(`Il Custode ha aperto l’armadio di ${namesRef.current(p.id)}`, true);
          break;
        case 'catena':
          a?.chain(p, !!p.ko);
          break;
        case 'codice':
          a?.code(p, !!p.ok);
          if (p.id === myId && !p.ok) captionRef.current('Codice sbagliato: l’allarme del quadro fa rumore', true);
          if (p.id === myId && p.ok) {
            a?.task('ok');
            setTask(null);
          }
          break;
        case 'guasto':
          a?.bang(p);
          captionRef.current('La pompa è andata in sovrapressione!', true);
          break;
        case 'medicato':
          if (p.id === myId) {
            a?.heal();
            captionRef.current('Ti sei medicato: di nuovo in forze');
          }
          break;
        case 'caccia':
          if (p.id === myId) {
            a?.stinger(true);
            captionRef.current('Ti ha visto. Allontanati o chiudi una porta', true);
          }
          break;
        case 'alza':
          a?.windup(rtLink.current?.p3.current.p.get('custode') ?? body.current);
          break;
        case 'colpo':
          if (p.id === myId) setTask(null);
          if (p.id === myId) {
            // il jumpscare: ti si lancia addosso urlando
            jumpAt.current = performance.now() / 1000;
            lockUntil.current = Date.now() + 1500;
            a?.scream();
            setTimeout(() => audioRef.current?.hit(p.grave), 900);
            shake.current = 1.6;
            hurtFlash.current = 1;
            setTimeout(() => setBlackout(true), 1150);
            setTimeout(() => setBlackout(false), 2300);
            setTimeout(() => captionRef.current(p.grave ? 'Sei incatenato: divincolati per leggere la combinazione' : 'Sei ferito: medicati al furgone', true), 2300);
          } else {
            a?.growl(p, true);
            captionRef.current(`${namesRef.current(p.id)} ${p.grave ? 'è intrappolato' : 'è ferito'}`, true);
          }
          break;
        case 'caccia_inizio':
          // l'avviso della caccia: luci impazzite, un ronzio che sale, i colpi metallici
          huntFx.current = { until: Date.now() + 5500, x: p.x, z: p.z, f: p.f };
          a?.dread();
          setTimeout(() => audioRef.current?.metalKnocks({ x: p.x + 6, y: p.y + 1, z: p.z + 4 }), 1200);
          captionRef.current('Le luci impazziscono… sta arrivando', true);
          break;
        case 'svanisce':
          a?.hiss(p, 0.7);
          break;
        case 'polter': {
          const d = DYN_PROPS.find((x) => x.id === p.id);
          if (!d || !a) break;
          const at = { x: d.x, y: floorBase(d.f) + d.y, z: d.z };
          const mat = d.kind === 'bottiglia' || d.kind === 'barattolo' ? 'vetro' : d.kind === 'tazza' ? 'ceramica' : d.kind === 'attrezzo' || d.kind === 'secchio' ? 'metallo' : d.kind === 'libro' ? 'carta' : 'legno';
          if (p.what === 'cade') setTimeout(() => audioRef.current?.objectFall(at, mat), d.kind === 'quadro' ? 400 : d.kind === 'scopa' ? 520 : 450);
          else if (p.what === 'squilla') a.phone(at);
          else if (p.what === 'suona') a.musicBox(at);
          else if (p.what === 'oscilla') a.swing(at);
          else if (p.what === 'gira' && d.kind === 'bambola') a.slide(at);
          else if (p.what === 'gira') a.slide(at);
          else if (p.what === 'apre') a.door(at, true, 'legno');
          else if (p.what === 'rotola') a.ballBounces(at);
          else if (d.kind === 'rubinetto') a.faucet(at, 6);
          else a.staticNoise(at, 7);
          if (body.current.f === d.f && Math.hypot(d.x - body.current.x, d.z - body.current.z) < 12)
            captionRef.current(
              p.what === 'cade'
                ? d.kind === 'barattolo' || d.kind === 'bottiglia'
                  ? 'Vetro che si frantuma, qui vicino'
                  : 'Qualcosa è caduto, qui vicino'
                : p.what === 'accende'
                  ? d.kind === 'rubinetto'
                    ? 'Un rubinetto si è aperto da solo'
                    : 'Qualcosa si è acceso da solo'
                  : p.what === 'apre'
                    ? 'Un’anta si è aperta'
                    : p.what === 'rotola'
                      ? 'Qualcosa rotola sul pavimento'
                      : p.what === 'squilla'
                        ? 'Un telefono squilla (le linee sono staccate)'
                        : p.what === 'suona'
                          ? 'Un carillon ha cominciato a suonare'
                          : p.what === 'oscilla'
                            ? 'Il lampadario oscilla da solo'
                            : d.kind === 'bambola'
                              ? 'La bambola si è girata verso di te'
                              : 'Una sedia si è spostata',
              p.what === 'cade' || d.kind === 'bambola',
            );
          break;
        }
        case 'sposta':
          if (p.id === myId) Object.assign(body.current, { x: p.x, y: p.y, z: p.z, f: p.f, vy: 0 });
          break;
        case 'porta': {
          const dp = doorPos(p.door);
          const d = DOORS.find((x) => x.id === p.door);
          if (p.slow && dp) {
            slowDoors.current.set(p.door, Date.now() + 3500);
            a?.slowCreak(dp);
            if (d && d.f === body.current.f && Math.hypot(dp.x - body.current.x, dp.z - body.current.z) < 12) captionRef.current('Una porta si apre da sola, piano', true);
          } else if (dp && d) a?.door(dp, p.open, d.kind, !!p.slam);
          if (p.slam) captionRef.current('Una porta sbatte', true);
          doorGuess.current.delete(p.door);
          break;
        }
        case 'testluci': {
          const st = STATIONS.find((x) => x.id === 'pannello')!;
          a?.work(stationPos(st), 'pannello');
          break;
        }
        case 'luci':
          a?.done(null);
          break;
        case 'pompa':
          a?.done(null);
          break;
        case 'deposito':
          a?.done(null);
          break;
        case 'uscita':
          a?.siren();
          break;
        case 'perdita':
          a?.pipe(p);
          setTimeout(() => audioRef.current?.hiss(p, 3), 1400);
          captionRef.current(`Colpo nel tubo, pressione in salita · ${FLOOR_NAMES[p.f]}`, true);
          break;
        case 'atmo':
          atmo(p);
          break;
        case 'ping': {
          const b = body.current;
          const far = Math.hypot(p.x - b.x, p.z - b.z);
          const heard = p.id === myId || p.radio || (p.f === b.f && far < 16 && wallsBetween(b.f, b.x, b.z, p.x, p.z, openDoors(), 3) < 2);
          if (!heard) break;
          const def = PINGS.find((x) => x.k === p.what);
          pings.current.push({ x: p.x, y: p.y, z: p.z, f: p.f, text: `${namesRef.current(p.id)}: ${def?.text ?? p.what}`, until: Date.now() + 6000, danger: !!def?.danger });
          a?.ping(p.radio || p.id === myId ? null : p, !!def?.danger);
          if (p.id !== myId) captionRef.current(`${p.radio ? 'Radio · ' : ''}${namesRef.current(p.id)}: ${def?.text ?? p.what}`, !!def?.danger);
          break;
        }
        case 'prende':
        case 'appoggia':
          break;
        case 'no':
          if (p.id === myId) {
            captionRef.current(p.why);
            a?.ui(false);
          }
          break;
        case 'liberato':
          a?.done(null);
          if (p.id === myId) captionRef.current(`${namesRef.current(p.by)} ti ha liberato`);
          break;
        case 'estratto':
          if (p.id !== myId) captionRef.current(`${namesRef.current(p.id)} è fuori`);
          break;
        case 'evacuazione':
          a?.siren();
          setTimeout(() => audioRef.current?.siren(), 2000);
          break;
        case 'stop':
          break;
        case 'fine':
          break;
      }
      void s;
    };
    return () => {
      link.p3events.current = null;
    };
  }, [realtime]);

  // Piccoli eventi del palazzo: mai pericolosi, ma fanno pensare
  const sagoma = useRef<{ until: number; x: number; z: number; y: number; keep?: boolean } | null>(null);
  const atmo = (p: { what: string; to: string | null; f: number; x: number; y: number; z: number }) => {
    const a = audioRef.current;
    const b = body.current;
    if (p.to && p.to !== myId) return;
    const off = (d: number) => ({ x: b.x + (Math.random() - 0.5) * d, y: b.y + 1, z: b.z + (Math.random() - 0.5) * d });
    switch (p.what) {
      case 'tubo':
        a?.pipe(off(10));
        captionRef.current('Un colpo nei tubi… e la risposta arriva in ritardo');
        break;
      case 'ascensore':
        a?.elevator({ x: 13, y: b.y + 4, z: 9 });
        captionRef.current('Un ascensore in movimento (il palazzo non ha l’ascensore)');
        break;
      case 'citofono':
        a?.intercom({ x: 12.5, y: 1.4, z: 1.4 });
        captionRef.current('Il citofono dell’ingresso suona');
        break;
      case 'passi':
        a?.phantomSteps({ x: b.x + 2, y: b.y + H1.floorH, z: b.z + 1 }, 5);
        captionRef.current('Passi al piano di sopra');
        break;
      case 'goccia':
        for (let i = 0; i < 4; i++) setTimeout(() => audioRef.current?.drip(off(6)), i * 700);
        break;
      case 'luce':
        flicker.current = Date.now() + 2500;
        break;
      case 'sedia':
        captionRef.current('Qualcosa si è spostato al primo piano');
        break;
      case 'sagoma': {
        // una sagoma senza corpo in fondo al corridoio: la vedo solo io, sparisce se la illumino
        const yaw = body.current.yaw + (Math.random() - 0.5) * 0.8;
        for (let d = 9; d > 5; d -= 0.5) {
          const x = b.x + Math.sin(yaw) * d;
          const z = b.z + Math.cos(yaw) * d;
          if (wallsBetween(b.f, b.x, b.z, x, z, openDoors(), 1) === 0 && groundAt(x, z, b.y)?.f === b.f) {
            sagoma.current = { until: Date.now() + 6000, x, z, y: b.y };
            break;
          }
        }
        break;
      }
      case 'passo':
        a?.footstep({ x: b.x - Math.sin(b.yaw) * 2, y: b.y, z: b.z - Math.cos(b.yaw) * 2 }, stepMat(b.f, b.x, b.z, dataRef.current.acqua), 0.8);
        break;
      case 'lampadina':
        bulbPop.current = { x: p.x, y: p.y + 2.5, z: p.z, f: p.f, at: Date.now() };
        break;
      case 'corsa': {
        // qualcosa corre veloce dall'altra parte del corridoio
        const side = { x: -Math.cos(b.yaw), z: Math.sin(b.yaw) };
        const cx = b.x + Math.sin(b.yaw) * 6;
        const cz = b.z + Math.cos(b.yaw) * 6;
        a?.runPast({ x: cx - side.x * 4, y: b.y, z: cz - side.z * 4 }, { x: cx + side.x * 4, y: b.y, z: cz + side.z * 4 });
        captionRef.current('Passi veloci, qualcosa ha corso là davanti', true);
        break;
      }
      case 'sussurro':
        a?.whisper({ x: b.x - Math.sin(b.yaw) * 0.5 + Math.cos(b.yaw) * 0.4, y: b.y + 1.6, z: b.z - Math.cos(b.yaw) * 0.5 - Math.sin(b.yaw) * 0.4 });
        captionRef.current('Un sussurro, dietro di te');
        break;
      case 'pianto': {
        const d = DOORS.filter((x) => x.f === b.f).sort((u, w) => Math.hypot(u.c - b.x, u.r - b.z) - Math.hypot(w.c - b.x, w.r - b.z))[0];
        if (d) a?.crying(doorCenter(d));
        captionRef.current('Qualcuno piange dietro una porta');
        break;
      }
      case 'graffi':
        a?.scratches({ x: b.x + Math.cos(b.yaw) * 1.5, y: b.y + 1.2, z: b.z - Math.sin(b.yaw) * 1.5 });
        captionRef.current('Graffi dentro il muro');
        break;
      case 'buio':
        // le luci intorno si spengono di colpo per qualche secondo
        darkUntil.current = Date.now() + 3800;
        a?.bulb({ x: b.x, y: b.y + 2.6, z: b.z });
        captionRef.current('Le luci si spengono tutte insieme', true);
        break;
      case 'armadio':
        if (p.f === b.f && Math.hypot(p.x - b.x, p.z - b.z) < 14) {
          a?.wardrobeKnock({ x: p.x, y: p.y + 1.2, z: p.z });
          captionRef.current('Qualcosa bussa da dentro un armadio', true);
        }
        break;
      case 'respiro':
        a?.custodeBreath({ x: b.x - Math.sin(b.yaw) * 0.9, y: b.y + 1.7, z: b.z - Math.cos(b.yaw) * 0.9 });
        captionRef.current('Un respiro, proprio dietro di te', true);
        break;
    }
  };
  const flicker = useRef(0);
  const bulbPop = useRef<{ x: number; y: number; z: number; f: number; at: number } | null>(null);
  const jumpAt = useRef(-10); // jumpscare (secondi del ciclo)
  const jumpSlow = useRef(1); // solo per le prove: rallenta lo spavento
  const lockUntil = useRef(0); // comandi fermi durante il jumpscare
  const huntFx = useRef<{ until: number; x: number; z: number; f: number } | null>(null);
  const [blackout, setBlackout] = useState(false);

  // ---------------------------------------------------------------- mondo 3D e ciclo di gioco
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const world: HWorld = createHorrorWorld(canvas, coarse);
    world.setQuality(prefsRef.current.quality);
    const fp = makeFirstPerson();
    world.camera.add(fp.root);
    // il Custode: subito quello fatto dal codice, poi (appena scaricato) il modello 3D vero fatto con Tripo
    const proc = makeCustode();
    const procGhost = makeCustode();
    let custode: Monster = { root: proc.root, animate: (a, sp, tt, d) => animateCustode(proc, a, sp, tt, d) };
    let ghost: Monster = { root: procGhost.root, animate: (a, sp, tt, d) => animateCustode(procGhost, a, sp, tt, d) };
    let jumpGlb: Monster | null = null;
    world.scene.add(custode.root, ghost.root);
    let alive3d = true;
    void loadMonsterModel().then((gltf) => {
      if (!gltf || !alive3d) return;
      world.scene.remove(custode.root, ghost.root);
      custode = makeMonster(gltf);
      ghost = makeMonster(gltf);
      custode.root.visible = false;
      ghost.root.visible = false;
      world.scene.add(custode.root, ghost.root);
      // la versione del jumpscare, agganciata alla telecamera, con la sua luce fredda sul volto
      jumpGlb = makeMonster(gltf);
      const key = new THREE.PointLight('#bcd6ff', 4, 3, 1.5);
      key.position.set(0.3, 2.1, 1.2);
      const rim = new THREE.PointLight('#ff5a3a', 2, 3, 1.5);
      rim.position.set(-0.6, 2.6, 0.2);
      jumpGlb.root.add(key, rim);
      jumpGlb.root.visible = false;
      world.camera.add(jumpGlb.root);
    });
    const outside = buildExterior(world.scene);
    const dyn = buildDyn(world.scene);
    const dynSeen = new Map<string, number>();
    const jump = makeJumpscare();
    world.camera.add(jump.root);
    let custVisible = true;
    let custFlickAt = 0;
    let scrapeAt = 0;
    let growlAt = 0;
    let lastMode = 9;
    const burstLamps = new Set<number>();
    let burstKey = '';
    const workers = new Map<string, Worker & { x: number; y: number; z: number; r: number; a: number; tx: number; ty: number; tz: number; tr: number; speed: number; dist: number }>();
    const items = new Map<string, THREE.Object3D>();
    // le torce dei compagni (luci vere solo per i 3 più vicini)
    const mates = Array.from({ length: 3 }, () => {
      const l = new THREE.SpotLight('#fff1d8', 0, 16, 0.42, 0.6, 1.6);
      world.scene.add(l, l.target);
      return l;
    });
    const cust = { x: 0, y: -50, z: 0, r: 0, a: 9, tx: 0, ty: -50, tz: 0, speed: 0, dist: 0, stepAt: 0, breathAt: 0, seen: false };
    let raf = 0;
    let last = performance.now();
    let lastSend = 0;
    let stepDist = 0;
    let lastPos = { x: body.current.x, z: body.current.z };
    let promptKey = '';
    let tagsAt = 0;
    let started = false;
    let nearAt = 0;
    let torchNear = 1;
    const nearRay = new THREE.Raycaster();
    const nearList: THREE.Mesh[] = [];
    let pumpOn = false;
    let dripAt = 0;
    const camPos = new THREE.Vector3();

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
      if (size.x !== W || size.y !== H) world.setSize(W, H);
      const nowS = Date.now() + offsetRef.current;
      const a = audioRef.current;
      const pl = s.players[myId];
      const alive = pl && (pl.state === 'ok' || pl.state === 'ferito');
      const b = body.current;
      const open = openDoors();
      // partenza: la posizione decisa dal server (non quella rimasta da un gioco precedente)
      // (dopo un rientro, invece, si riparte da dove si era)
      const mine = rtLink.current?.p3.current.p.get(myId);
      const resume = s.stage !== 'BRIEF' && mine && tms > 400;
      if (!started && (resume || (s.spawn && (s.stage === 'BRIEF' || tms > 1500)))) {
        const p0 = resume && mine ? mine : s.spawn;
        Object.assign(b, { x: p0.x, y: p0.y, z: p0.z, f: groundAt(p0.x, p0.z, p0.y + 0.1)?.f ?? 1 });
        started = true;
        (window as unknown as { __horror?: unknown }).__horror = { body: b, look: look.current, stato: () => dataRef.current, scena: world.scene, THREE, mostro: () => ({ x: custode.root.position.x, y: custode.root.position.y, z: custode.root.position.z, visible: custode.root.visible }), prova: (what: string) => actRef.current('MG_PROVA', { what }), vedi: (d = 3.2) => {
          const bb = body.current;
          const yw = look.current.yaw;
          sagoma.current = { until: Date.now() + 20000, x: bb.x + Math.sin(yw) * d, z: bb.z + Math.cos(yw) * d, y: bb.y, keep: true };
        }, spavento: (lento = 1) => {
          jumpSlow.current = lento;
          jumpAt.current = performance.now() / 1000;
        } };
      }

      // ---- il mio movimento
      b.yaw = look.current.yaw;
      b.pitch = look.current.pitch;
      let running = false;
      let speed = 0;
      // nel nascondiglio: fermo dentro l'armadio, si guarda fuori dall'anta
      const myHide = pl?.hidden ? HIDES.find((x) => x.id === pl.hidden) : null;
      if (myHide) {
        Object.assign(b, { x: myHide.x, z: myHide.z, y: floorBase(myHide.f), f: myHide.f, vy: 0 });
        let dy = look.current.yaw - myHide.ry;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        look.current.yaw = myHide.ry + Math.max(-0.75, Math.min(0.75, dy));
        look.current.pitch = Math.max(-0.5, Math.min(0.4, look.current.pitch));
        b.yaw = look.current.yaw;
        b.pitch = look.current.pitch;
        wasHidden.current = myHide.id;
      } else if (wasHidden.current) {
        // appena usciti: davanti all'anta
        const h = HIDES.find((x) => x.id === wasHidden.current);
        wasHidden.current = null;
        if (h && alive) Object.assign(b, { x: h.ex, z: h.ez, y: floorBase(h.f), f: h.f, vy: 0 });
      }
      if (alive && !myHide && !taskRef.current && !menuRef.current && !tabletRef.current && s.stage !== 'END' && Date.now() > lockUntil.current) {
        const k = keys.current;
        const kx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
        const kz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
        const jx = joy.current.x + kx;
        const jz = -joy.current.y + kz;
        const stickRun = Math.hypot(joy.current.x, joy.current.y) > 0.92;
        const carryBattery = pl.carrying === 'batteria';
        // muoversi interrompe un lavoro (se non è in modalità "tocco")
        if ((Math.abs(jx) > 0.2 || Math.abs(jz) > 0.2) && useDown.current && useDown.current.kind !== 'door' && !prefsRef.current.toggleHold && useDown.current.kind !== 'rescue') {
          /* si può lavorare camminando piano? no: il server lo ferma se ci si allontana */
        }
        running = stepHuman(b, { x: jx, z: jz, run: (k.has('shift') || stickRun) && !carryBattery, crouch: crouch.current }, dt, open, {
          mul: (carryBattery ? MOVE.carry : 1) * (pl.state === 'ferito' ? MOVE.wounded : 1),
          props: PROPS,
        });
        speed = Math.hypot(b.x - lastPos.x, b.z - lastPos.z) / Math.max(dt, 0.001);
      }
      stepDist += Math.hypot(b.x - lastPos.x, b.z - lastPos.z);
      lastPos = { x: b.x, z: b.z };
      if (stepDist > (running ? 0.85 : crouch.current ? 0.5 : 0.68)) {
        stepDist = 0;
        a?.footstep(null, stepMat(b.f, b.x, b.z, s.acqua), crouch.current ? 0.4 : running ? 1.3 : 0.9, true);
      }
      // invio della posizione (15 al secondo)
      if (tms - lastSend > 66) {
        lastSend = tms;
        const pitchQ = Math.round(((b.pitch + 1.4) / 2.8) * 31);
        const anim = speed > 0.3 ? (running ? 2 : 1) : 0;
        rtLink.current?.p3send({ x: b.x, y: b.y, z: b.z, r: b.yaw, a: anim | (running ? 16 : 0) | (crouch.current ? 32 : 0) | (torch.current.on && torch.current.charge > 0 ? 64 : 0) | (pitchQ << 7) });
      }
      // lavoro tenuto premuto: "sono ancora qui" ogni mezzo secondo
      const u = useDown.current;
      if (u && (u.kind === 'station' || u.kind === 'rescue' || u.kind === 'task') && Date.now() - u.sent > 450) {
        u.sent = Date.now();
        actRef.current('MG_HOLD', u.kind === 'rescue' ? { st: u.target, kind: 'soccorso', keep: 1 } : u.kind === 'task' ? { st: u.target, keep: 1, p: taskProg.current } : { st: u.target, keep: 1 });
      }
      // il lavoro aperto si chiude da solo quando è finito (o non ha più senso)
      const tk = taskRef.current;
      if (tk && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) {
        let still = alive;
        if (tk.kind === 'lucchetto') still = still && s.players[tk.st]?.state === 'intrappolato';
        else {
          const st = STATIONS.find((x) => x.id === tk.st);
          const now2 = st ? taskFor(s, st, myId) : null;
          still = still && !!now2 && now2.kind === tk.kind && (tk.kind !== 'gira' || (now2 as { dir: number }).dir === (tk as { dir: number }).dir);
        }
        if (!still) {
          if (alive && (tk.kind === 'lucchetto' || taskProg.current > 0.9 || tk.kind === 'tastierino' || tk.kind === 'quadrante')) a?.task('ok');
          useDown.current = useDown.current?.kind === 'task' ? null : useDown.current;
          taskProg.current = 0;
          setTask(null);
        }
      }
      if (charging.current) {
        charging.current.t += dt;
        if (charging.current.t > 3) {
          torch.current.charge = 1;
          charging.current = null;
          useDown.current = null;
          a?.done(null);
        }
      }
      // la torcia si scarica piano (resta sempre una lucina di riserva)
      if (torch.current.on) torch.current.charge = Math.max(0, torch.current.charge - dt / 720);
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) setTorchUi({ ...torch.current });

      // ---- porte
      for (const [id, dm] of world.doors) {
        const st = s.doors[id];
        if (!st) continue;
        dm.want = open.has(id) ? 1.45 : 0;
        dm.angle += (dm.want - dm.angle) * Math.min(1, dt * ((slowDoors.current.get(id) ?? 0) > Date.now() ? 0.6 : 5));
        dm.pivot.rotation.y = -dm.angle;
        if (dm.lockLight) {
          const m = dm.lockLight.material as THREE.MeshStandardMaterial;
          m.emissive.set(st.lock ? '#ff3b30' : '#34c759');
          m.color.copy(m.emissive);
        }
      }

      // ---- il Custode
      const cp = rtLink.current?.p3.current.p.get('custode');
      if (cp) {
        if (Math.hypot(cp.x - cust.x, cp.z - cust.z) > 6 || cust.a === 9) Object.assign(cust, { x: cp.x, y: cp.y, z: cp.z });
        cust.tx = cp.x;
        cust.ty = cp.y;
        cust.tz = cp.z;
        cust.a = cp.a;
        let dr = cp.r - cust.r;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        cust.r += dr * Math.min(1, dt * 8);
      }
      const ox = cust.x;
      const oz = cust.z;
      cust.x += (cust.tx - cust.x) * Math.min(1, dt * 8);
      cust.y += (cust.ty - cust.y) * Math.min(1, dt * 8);
      cust.z += (cust.tz - cust.z) * Math.min(1, dt * 8);
      cust.speed = Math.hypot(cust.x - ox, cust.z - oz) / Math.max(dt, 0.001);
      // quando caccia si vede a intermittenza (come un'immagine che salta)
      const hunting = cust.a === 2 || s.hunt?.phase === 'attiva';
      if (hunting && tms > custFlickAt) {
        custVisible = !custVisible || Math.random() < 0.6;
        custFlickAt = tms + (custVisible ? 90 + Math.random() * 260 : 50 + Math.random() * 140);
      } else if (!hunting) custVisible = true;
      custode.root.visible = cust.a !== 9 && custVisible;
      custode.root.position.set(cust.x, cust.y, cust.z);
      custode.root.rotation.y = cust.r;
      const flat = Math.hypot(cust.x - b.x, cust.z - b.z);
      const crawlFar = cust.a === 2 && flat < 6 ? 1 : cust.a;
      custode.setLean?.(Math.abs(cust.y - b.y) < 1 ? (3.4 - flat) / 1.8 : 0);
      if (custode.root.visible || cust.a !== 9) custode.animate(crawlFar, crawlFar === 1 ? Math.max(cust.speed, 2.6) : cust.speed, t, dt);
      const cd = Math.hypot(cust.x - b.x, cust.z - b.z) + Math.abs(cust.y - b.y) * 2;
      if (custode.root.visible && a) {
        cust.dist += cust.speed * dt;
        if (cust.dist > (cust.a === 2 ? 1.3 : 0.95)) {
          cust.dist = 0;
          a.custodeStep({ x: cust.x, y: cust.y, z: cust.z }, cust.a === 2);
        }
        if (cd < 9 && tms > cust.breathAt) {
          cust.breathAt = tms + 2600 + Math.random() * 1500;
          a.custodeBreath({ x: cust.x, y: cust.y + 2.1, z: cust.z });
        }
        // la chiave inglese che striscia sul pavimento: si sente prima di vederlo
        if (cust.speed > 0.3 && tms > scrapeAt) {
          scrapeAt = tms + 1500 + Math.random() * 1600;
          a.scrape({ x: cust.x, y: cust.y + 0.1, z: cust.z }, 0.5 + Math.random() * 0.6);
        }
        if (cd < 15 && tms > growlAt) {
          growlAt = tms + 5500 + Math.random() * 5000;
          a.growl({ x: cust.x, y: cust.y + 2.1, z: cust.z }, cust.a === 2);
        }
      }
      if (cust.a === 2 && lastMode !== 2 && a) a.growl({ x: cust.x, y: cust.y + 2.1, z: cust.z }, true);
      lastMode = cust.a;
      // nascondiglio: se è vicino bisogna trattenere il fiato (SPAZIO o il pulsante)
      {
        const br = breath.current;
        const need = !!myHide && cust.a !== 9 && cd < 7;
        const hold = br.holding && Date.now() > br.lockUntil;
        if (myHide) {
          if (hold) br.bar = Math.max(0, br.bar - dt / 6);
          else br.bar = Math.min(1, br.bar + dt / 4);
          if (hold && br.bar <= 0) {
            br.lockUntil = Date.now() + 1800;
            a?.gasp();
            actRef.current('MG_RESPIRO');
            captionRef.current('Hai ripreso fiato di colpo!', true);
          }
          if (need && !hold && Date.now() - br.sentAt > 2200) {
            br.sentAt = Date.now();
            actRef.current('MG_RESPIRO');
          }
          if (!hold) a?.hideBreath(need ? 1 : 0.2);
        } else br.bar = 1;
        if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) setBreathUi({ need, bar: br.bar, holding: hold });
      }
      // la voce: parlare forte lo attira (sussurrare no)
      if (voiceRef.current?.ready && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
        const lv = voiceRef.current.level();
        const vl = voiceLoud.current;
        if (lv > 0.06 && alive) {
          vl.since ||= Date.now();
          if (Date.now() - vl.since > 300 && Date.now() - vl.sentAt > 1000) {
            vl.sentAt = Date.now();
            actRef.current('MG_VOCE', { lvl: lv > 0.18 ? 2 : 1 });
          }
        } else vl.since = 0;
        setVoiceLvl(lv);
      }
      a?.chase(s.alert?.mode === 'caccia' && s.alert.victim === myId && alive);
      // paura: vicinanza e inseguimento
      const fear = custode.root.visible ? Math.max(0, 1 - cd / 14) * (cust.a === 2 ? 1 : 0.6) : 0;
      a?.heartbeat(fear);
      a?.breathing(pl?.state === 'ferito' || pl?.state === 'intrappolato', fear > 0.4);
      // la sagoma personale (sparisce se la illumino o mi avvicino)
      const sg = sagoma.current;
      ghost.root.visible = !!sg && Date.now() < sg.until;
      if (sg && ghost.root.visible) {
        ghost.root.position.set(sg.x, sg.y, sg.z);
        ghost.root.rotation.y = Math.atan2(b.x - sg.x, b.z - sg.z);
        ghost.setLean?.((3.4 - Math.hypot(sg.x - b.x, sg.z - b.z)) / 1.8);
        ghost.animate(0, 0, t, dt);
        const toG = Math.atan2(sg.x - b.x, sg.z - b.z) - b.yaw;
        const ang = Math.abs(Math.atan2(Math.sin(toG), Math.cos(toG)));
        if (!sg.keep && ((ang < 0.3 && torch.current.on) || Math.hypot(sg.x - b.x, sg.z - b.z) < 4)) sagoma.current = null;
      }

      // ---- i compagni
      const latest = rtLink.current?.p3.current.p ?? new Map();
      const camDir = new THREE.Vector3(Math.sin(b.yaw) * Math.cos(b.pitch), Math.sin(b.pitch), Math.cos(b.yaw) * Math.cos(b.pitch));
      // torcia vicino a un muro o a un quadro: si abbassa (niente bianco bruciato a mezzo metro)
      if (tms - nearAt > 120) {
        nearAt = tms;
        if (!nearList.length) world.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !(m as unknown as THREE.SkinnedMesh).isSkinnedMesh) nearList.push(m);
        });
        nearRay.set(new THREE.Vector3(b.x, b.y + (crouch.current ? MOVE.eyeCrouch : MOVE.eye), b.z), camDir);
        nearRay.far = 2.4;
        const hit = nearRay.intersectObjects(nearList, false).find((h) => h.object.visible && !fp.root.getObjectById(h.object.id));
        torchNear = hit ? Math.max(0.28, Math.min(1, (hit.distance - 0.25) / 2)) : 1;
      }
      const others: { id: string; x: number; y: number; z: number; f: number; torch: boolean; yaw: number; pitch: number }[] = [];
      for (const id of Object.keys(s.players)) {
        if (id === myId) continue;
        const p = latest.get(id);
        const st = s.players[id].state;
        let w = workers.get(id);
        if (!p || st === 'estratto' || st === 'evacuato' || st === 'uscito' || s.players[id].hidden) {
          if (w) w.root.visible = false;
          continue;
        }
        if (!w) {
          w = { ...makeWorker(id, namesRef.current(id), colorsRef.current(id)), x: p.x, y: p.y, z: p.z, r: p.r, a: p.a, tx: p.x, ty: p.y, tz: p.z, tr: p.r, speed: 0, dist: 0 };
          workers.set(id, w);
          world.scene.add(w.root);
        }
        if (Math.hypot(p.x - w.x, p.z - w.z) > 5) Object.assign(w, { x: p.x, y: p.y, z: p.z });
        w.tx = p.x;
        w.ty = p.y;
        w.tz = p.z;
        w.tr = p.r;
        w.a = p.a;
        const px = w.x;
        const pz = w.z;
        w.x += (w.tx - w.x) * Math.min(1, dt * 12);
        w.y += (w.ty - w.y) * Math.min(1, dt * 12);
        w.z += (w.tz - w.z) * Math.min(1, dt * 12);
        let dr = w.tr - w.r;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        w.r += dr * Math.min(1, dt * 10);
        w.speed = Math.hypot(w.x - px, w.z - pz) / Math.max(dt, 0.001);
        const flags = w.a | 0;
        const pitch = ((flags >> 7) & 31) / 31 * 2.8 - 1.4;
        const torchOn = !!(flags & 64);
        const f = groundAt(w.x, w.z, w.y + 0.15)?.f ?? 1;
        w.root.visible = true;
        w.root.position.set(w.x, w.y, w.z);
        w.root.rotation.y = w.r;
        animateWorker(w, { speed: w.speed, crouch: !!(flags & 32), pitch, torch: torchOn, down: st === 'intrappolato', carry: !!s.players[id].carrying, t, dt });
        // passi dei compagni (attutiti dai muri)
        w.dist += w.speed * dt;
        if (w.dist > (flags & 16 ? 0.85 : 0.7) && a) {
          w.dist = 0;
          a.footstep({ x: w.x, y: w.y, z: w.z }, stepMat(f, w.x, w.z, s.acqua), flags & 32 ? 0.35 : flags & 16 ? 1.2 : 0.8);
        }
        // il nome compare solo guardando un compagno vicino
        const to = new THREE.Vector3(w.x - b.x, w.y + 1.4 - (b.y + MOVE.eye), w.z - b.z);
        const dd = to.length();
        w.label.visible = dd < 7 && to.normalize().dot(camDir) > 0.96 && f === b.f;
        others.push({ id, x: w.x, y: w.y, z: w.z, f, torch: torchOn, yaw: w.r, pitch });
      }
      // luci delle torce dei compagni
      const lit = others.filter((o) => o.torch).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
      mates.forEach((l, i) => {
        const o = lit[i];
        if (!o || Math.hypot(o.x - b.x, o.z - b.z) > 22) {
          l.intensity = 0;
          return;
        }
        l.intensity = 14;
        l.position.set(o.x + Math.cos(o.yaw) * 0.3, o.y + 1.25, o.z - Math.sin(o.yaw) * 0.3);
        l.target.position.set(o.x + Math.sin(o.yaw) * Math.cos(o.pitch) * 6, o.y + 1.25 + Math.sin(o.pitch) * 6, o.z + Math.cos(o.yaw) * Math.cos(o.pitch) * 6);
      });

      // ---- voce di prossimità: distanza, muri e piani
      const voice = voiceRef.current;
      if (voice) {
        const meOut = !alive && pl?.state !== 'intrappolato';
        for (const id of Object.keys(s.players)) {
          if (id === myId) continue;
          const st = s.players[id].state;
          const theyOut = st === 'estratto' || st === 'evacuato' || st === 'uscito';
          const o = others.find((x) => x.id === id);
          let gain = 0;
          let muffle = 0;
          let pos: V3 | null = null;
          if (s.stage === 'BRIEF' || s.stage === 'END' || (meOut && theyOut)) gain = 1;
          else if (o && !theyOut && !meOut) {
            const d = Math.hypot(o.x - b.x, o.z - b.z, (o.y - b.y) * 1.5);
            pos = { x: o.x, y: o.y + 1.6, z: o.z };
            if (o.f === b.f) muffle = wallsBetween(b.f, b.x, b.z, o.x, o.z, open, 3);
            else muffle = roomAt(b.f, b.x, b.z)?.zone === 'scale' && roomAt(o.f, o.x, o.z)?.zone === 'scale' ? 1 : 3;
            gain = d < VOICE.clear ? 1 : d < VOICE.fade ? 1 - ((d - VOICE.clear) / (VOICE.fade - VOICE.clear)) * 0.7 : d < VOICE.max ? 0.3 * (1 - (d - VOICE.fade) / (VOICE.max - VOICE.fade)) : 0;
            gain *= muffle >= 3 ? 0.08 : muffle === 2 ? 0.35 : muffle === 1 ? 0.6 : 1;
          }
          voice.update(id, { pos, gain, muffle });
        }
      }

      // ---- oggetti da trasportare
      const seen = new Set<string>();
      for (const it of s.items) {
        seen.add(it.id);
        let m = items.get(it.id);
        if (!m) {
          m = makeItem(it.kind);
          items.set(it.id, m);
          world.scene.add(m);
        }
        if (it.kind === 'filtro') ((m.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(it.clean ? '#d8d4c8' : '#6b5a3a');
        if (it.by === myId) m.visible = false;
        else if (it.by) {
          const w = workers.get(it.by);
          m.visible = !!w?.root.visible;
          if (w) m.position.set(w.x + Math.sin(w.r) * 0.35, w.y + 1.0, w.z + Math.cos(w.r) * 0.35);
        } else {
          m.visible = true;
          // appoggiato dov'è, fermo (niente oggetti che girano a mezz'aria)
          m.position.set(it.x, it.y + (it.kind === 'batteria' ? 0.15 : it.kind === 'filtro' ? 0.16 : 0.06), it.z);
          m.rotation.y = (it.id.charCodeAt(0) * 1.7) % 6.28;
        }
      }
      for (const [id, m] of items)
        if (!seen.has(id)) {
          world.scene.remove(m);
          items.delete(id);
        }

      // ---- luci del palazzo: alcune si stabilizzano, una resta debole; il Custode le fa tremare
      for (const l of world.lamps) {
        let p = 0;
        const rm = l.room;
        if (rm.f === 3) p = s.luce === 'ok' ? (l.seed % 7 < 1 ? 0.3 : 0.85) : s.luce === 'test' ? (Math.sin(t * 23 + l.seed) > 0.2 ? 0.7 : 0.05) : 0;
        else if (rm.light === 'calda') p = 0.8;
        else if (rm.light === 'neon') p = 0.9;
        else if (rm.light === 'debole') p = 0.38;
        else p = 0;
        if (rm.f === 0 && rm.id === 'D' && s.pompaOn) p = 0.6;
        // tremolio normale dei neon vecchi e delle lampade deboli
        if (p > 0 && Math.sin(t * 1.3 + l.seed * 3) > 1 - l.flick * 0.12) p *= Math.random() < 0.5 ? 0.15 : 1;
        // vicino al Custode le luci tremano (avviso visivo, uguale per tutti)
        if (custode.root.visible && Math.hypot(l.x - cust.x, l.z - cust.z) < 7 && Math.abs(l.y - cust.y) < 3.5) p *= Math.random() < 0.35 ? 0.1 : 0.85;
        if (Date.now() < flicker.current && Math.hypot(l.x - b.x, l.z - b.z) < 10) p *= Math.random() < 0.4 ? 0.2 : 1;
        if (Date.now() < darkUntil.current && Math.hypot(l.x - b.x, l.z - b.z) < 14 && Math.abs(l.y - b.y) < 3.5) p = 0;
        const hf = huntFx.current;
        if (hf && Date.now() < hf.until && Math.hypot(l.x - hf.x, l.z - hf.z) < 20) p *= Math.random() < 0.55 ? 0.05 : 1.2;
        if (hunting && custode.root.parent && Math.hypot(l.x - cust.x, l.z - cust.z) < 12 && Math.abs(l.y - cust.y) < 3.5) p *= Math.random() < 0.5 ? 0 : 0.7;
        if (burstLamps.has(world.lamps.indexOf(l))) p = 0;
        if (s.stage === 'EVAC') {
          p *= 0.45;
          l.mat.emissive.set(Math.sin(t * 3) > 0 && (rm.zone === 'tecnico' || rm.zone === 'servizio' || rm.zone === 'scale') ? '#ff3020' : l.warm ? '#ffcf96' : '#d9ecff');
        }
        l.mat.emissiveIntensity += (p * 1.6 - l.mat.emissiveIntensity) * Math.min(1, dt * (p < l.mat.emissiveIntensity ? 30 : 8));
      }
      // postazioni: led, livello dell'acqua, lampada di prova, perdite
      for (const [id, g] of world.stations) {
        const leds = g.userData.leds as THREE.Mesh[] | undefined;
        const st = STATIONS.find((x) => x.id === id)!;
        const ok =
          (st.kind === 'pannello' && s.luce === 'ok') || (st.kind === 'pompa' && s.pompaOn) || (st.kind === 'alloggio' && s.batteria) || (st.kind === 'collaudo1' && s.collaudo.a) || (st.kind === 'collaudo2' && s.collaudo.b);
        const busy = Object.values(s.holds).some((h) => h.st === id);
        if (leds)
          leds.forEach((m, i) => {
            const mm = m.material as THREE.MeshStandardMaterial;
            const on = ok ? i === leds.length - 1 : busy ? Math.sin(t * 10 + i) > 0 : i === 0;
            mm.emissiveIntensity = on ? 2 : 0.05;
          });
        if (g.userData.fill) {
          const f = g.userData.fill as THREE.Mesh;
          f.scale.y = Math.max(0.02, s.acqua);
          f.position.y = -0.5 + s.acqua / 2;
        }
        if (g.userData.bulb) {
          let on = s.luce === 'ok' ? 2 : 0;
          if (s.luce === 'test' && s.blink) {
            const cyc = s.blink * 0.5 + 1.8;
            const ph = t % cyc;
            on = ph < s.blink * 0.5 && ph % 0.5 < 0.25 ? 3.2 : 0.02;
          }
          ((g.userData.bulb as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = on;
        }
        if (g.userData.wheel && busy) (g.userData.wheel as THREE.Mesh).rotation.z += dt * 3;
      }
      world.water.position.y = floorBase(0) + 0.02 + s.acqua * 0.75;
      world.water.visible = s.acqua > 0.02;
      // spruzzo della perdita
      const leakSt = s.leak ? STATIONS.find((x) => x.id === s.leak!.st) : null;
      world.leakFx.visible = !!leakSt;
      if (leakSt) {
        const pos = world.leakFx.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const k = (t * 1.7 + i / pos.count) % 1;
          pos.setXYZ(i, leakSt.x + Math.sin(i * 7.3) * k * 0.5, floorBase(leakSt.f) + leakSt.y - k * k * 1.2, leakSt.z + Math.cos(i * 3.1) * k * 0.5);
        }
        pos.needsUpdate = true;
      }
      // fuori piove (si sente anche dall'atrio)
      const outdoors = b.f === 1 && b.z < 1;
      (world.scene.fog as THREE.FogExp2).density += ((outdoors ? 0.035 : 0.07) - (world.scene.fog as THREE.FogExp2).density) * Math.min(1, dt * 2);
      world.moon.intensity += ((outdoors ? 0.9 : b.f === 1 && b.z < 5 ? 0.25 : 0) - world.moon.intensity) * Math.min(1, dt * 3);
      outside.rain.visible = b.f === 1 && b.z < 6;
      if (outside.rain.visible) updateRain(outside, dt);
      a?.setRain(outdoors ? 1 : b.f === 1 && b.z < 6 ? 0.35 : 0);
      (outside.screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + Math.sin(t * 2) * 0.05;
      // lampadine scoppiate (uguali per tutti: la lampada accesa più vicina al punto)
      const bk = (s.burst ?? []).join('|');
      if (bk !== burstKey) {
        burstKey = bk;
        for (const key of s.burst ?? []) {
          const [f, x, y, z] = key.split(':').map(Number);
          let bi = -1;
          let bd = Infinity;
          world.lamps.forEach((l, i) => {
            if (l.f !== f || burstLamps.has(i)) return;
            const d = Math.hypot(l.x - x, l.y - y, l.z - z);
            if (d < bd) {
              bd = d;
              bi = i;
            }
          });
          if (bi >= 0 && bd < 12) {
            if (!burstLamps.has(bi) && bulbPop.current && Date.now() - bulbPop.current.at < 3000) {
              const l = world.lamps[bi];
              a?.bulb({ x: l.x, y: l.y, z: l.z });
              captionRef.current('Una lampadina è scoppiata');
            }
            burstLamps.add(bi);
          }
        }
      }
      // oggetti spostati dal palazzo
      for (const [id, m] of Object.entries(s.moved ?? {})) {
        const o = dyn.get(id);
        if (!o) continue;
        if (dynSeen.get(id) !== m.at) {
          dynSeen.set(id, m.at);
          const ago = (nowS - m.at) / 1000;
          o.anim = { k: m.k, t: tms / 1000 - Math.max(0, ago), seed: m.seed };
          o.end = false;
          if (ago > 3 && m.k !== 'accende') animateDyn(o, 99, true);
        }
        if (o.anim && !o.end) animateDyn(o, tms / 1000 - o.anim.t);
      }
      // il jumpscare (agganciato alla telecamera)
      const jk = (t - jumpAt.current) / jumpSlow.current;
      let jumping = false;
      if (jumpGlb) {
        // il modello vero: balza addosso a braccia spalancate e si ferma a mezzo metro dal volto
        jumping = jk >= 0 && jk <= 1.35;
        jumpGlb.root.visible = jumping;
        if (jumping) {
          const lunge = Math.min(1, jk / 0.16);
          jumpGlb.root.position.set((Math.random() - 0.5) * 0.03 * lunge, -2.12 + Math.sin(t * 50) * 0.01, -2.6 + lunge * 1.8);
          jumpGlb.root.rotation.set(0.12, 0, (Math.random() - 0.5) * 0.06);
          jumpGlb.setLunge?.(jk / 1.35);
          jumpGlb.animate(4, 0, t, dt);
        }
      } else jumping = animateJumpscare(jump, jk, t);
      if (jumping) custode.root.visible = false;

      // pompa accesa: brontolio
      if (s.pompaOn !== pumpOn && a) {
        pumpOn = s.pompaOn;
        const ps = STATIONS.find((x) => x.id === 'filtro')!;
        a.setPump(pumpOn, stationPos(ps));
      }
      // gocce in cantina
      if (a && b.f === 0 && tms > dripAt) {
        dripAt = tms + 2500 + Math.random() * 5000;
        a.drip({ x: b.x + (Math.random() - 0.5) * 8, y: b.y + 2.5, z: b.z + (Math.random() - 0.5) * 8 });
      }

      // ---- cosa ho davanti (porte, postazioni, oggetti, compagni da liberare, caricabatterie)
      let best: { kind: 'station' | 'door' | 'item' | 'rescue' | 'carica' | 'hide'; id: string; text: string; sub?: string; score: number } | null = null;
      const eye = new THREE.Vector3(b.x, b.y + (crouch.current ? MOVE.eyeCrouch : MOVE.eye), b.z);
      const consider = (kind: 'station' | 'door' | 'item' | 'rescue' | 'carica' | 'hide', id: string, f: number, p: V3, text: string, sub?: string, range = USE_RANGE) => {
        if (f !== b.f) return;
        const to = new THREE.Vector3(p.x - eye.x, p.y - eye.y, p.z - eye.z);
        const d = to.length();
        if (d > range + 0.4) return;
        const dot = to.normalize().dot(camDir);
        if (dot < 0.55 && d > 1.1) return;
        if (wallsBetween(f, b.x, b.z, p.x, p.z, open, 1) > 0 && kind !== 'door') return;
        const score = dot * 2 - d * 0.35;
        if (!best || score > best.score) best = { kind, id, text, sub, score };
      };
      if (alive && myHide) best = { kind: 'hide', id: myHide.id, text: 'Esci dal nascondiglio', score: 9 };
      else if (alive && !taskRef.current) {
        for (const h of HIDES) consider('hide', h.id, h.f, { x: h.x, y: floorBase(h.f) + 1.1, z: h.z }, h.kind === 'armadio' ? 'Nasconditi nell’armadio' : 'Nasconditi nell’armadietto', 'Non ti vede, se non ti ha visto entrare', 1.6);
        for (const st of STATIONS) {
          if (st.kind === 'valvola' && s.leak?.st !== st.id) continue;
          consider('station', st.id, st.f, stationPos(st), stationText(s, st, myId), stationSub(s, st));
        }
        for (const d of DOORS) {
          const ds = s.doors[d.id];
          if (!ds) continue;
          consider('door', d.id, d.f, doorCenter(d), ds.lock ? (ds.lock === 'acqua' ? 'Porta bloccata dall’acqua' : 'Uscita di servizio (chiusa fino al collaudo)') : open.has(d.id) ? 'Chiudi la porta' : 'Apri la porta', ds.blocked ? 'Ha un fermo' : !open.has(d.id) && s.fermi > 0 && !ds.lock ? `Tieni premuto: metti un fermo (${s.fermi})` : undefined, 1.8);
        }
        for (const it of s.items) if (!it.by) consider('item', it.id, it.f, { x: it.x, y: it.y + 0.15, z: it.z }, `Prendi: ${ITEM_NAMES[it.kind]}${it.kind === 'filtro' ? (it.clean ? ' (pulito)' : ' (intasato)') : ''}`);
        for (const [id, ps] of Object.entries(s.players)) {
          if (id === myId || ps.state !== 'intrappolato') continue;
          const o = others.find((x) => x.id === id);
          if (o) consider('rescue', id, o.f, { x: o.x, y: o.y + 0.6, z: o.z }, `Libera ${namesRef.current(id)}`, 'Apri il lucchetto: fatti dire la combinazione');
        }
        for (const c of CHARGERS) consider('carica', c.id, c.f, { x: c.x, y: floorBase(c.f) + 1.1, z: c.z }, 'Ricarica la torcia', 'Tieni premuto (3 s)');
      }
      const tb = best as { kind: 'station' | 'door' | 'item' | 'rescue' | 'carica' | 'hide'; id: string; text: string; sub?: string } | null;
      target.current = tb;
      const key = tb ? `${tb.kind}:${tb.id}:${tb.text}:${tb.sub ?? ''}` : '';
      const prog = tb ? (tb.kind === 'rescue' || tb.kind === 'hide' ? 0 : tb.kind === 'carica' ? (charging.current?.t ?? 0) / 3 : (s.prog[tb.id] ?? 0)) : 0;
      if (key + prog.toFixed(2) !== promptKey) {
        promptKey = key + prog.toFixed(2);
        setPrompt(tb ? { text: tb.text, sub: tb.sub, prog, kind: tb.kind } : null);
      }

      // ---- i ping che vedo (etichette sullo schermo)
      if (tms - tagsAt > 100) {
        tagsAt = tms;
        pings.current = pings.current.filter((p) => Date.now() < p.until);
        const tags: typeof pingTags = [];
        pings.current.forEach((p, i) => {
          const v3 = new THREE.Vector3(p.x, p.y, p.z).project(world.camera);
          if (v3.z > 1) return;
          tags.push({ key: `${i}-${p.until}`, x: ((v3.x + 1) / 2) * W, y: ((1 - v3.y) / 2) * H, text: p.text, danger: p.danger, far: Math.round(Math.hypot(p.x - b.x, p.z - b.z)) });
        });
        setPingTags(tags);
        // dove andare: i punti dei lavori ancora da fare (entro 35 m; su un altro piano lo dice)
        const ms: typeof marks = [];
        if (prefsRef.current.markers && alive) {
          const seenKey = new Set<string>();
          for (const o of objRef.current) {
            if (o.done || o.blocked) continue;
            for (const tg of o.targets) {
              const k = `${tg.f}:${tg.x.toFixed(1)}:${tg.z.toFixed(1)}`;
              if (seenKey.has(k)) continue;
              seenKey.add(k);
              const d = Math.hypot(tg.x - b.x, tg.z - b.z, (tg.y - b.y - 1.5) * 0.5);
              if (d > 35 || (tg.maybe && (d > 14 || tg.f !== b.f))) continue;
              const v3 = new THREE.Vector3(tg.x, tg.y + (tg.f === b.f ? 0.2 : 0), tg.z).project(world.camera);
              const behind = v3.z > 1;
              let sx = ((v3.x + 1) / 2) * W;
              let sy = ((1 - v3.y) / 2) * H;
              let edge = false;
              if (behind || sx < 90 || sx > W - 90 || sy < 60 || sy > H - 60) {
                // fuori dallo schermo: freccia sul bordo
                if (behind) {
                  sx = W - sx;
                  sy = H - 70;
                }
                sx = Math.max(90, Math.min(W - 90, sx));
                sy = Math.max(70, Math.min(H - 70, sy));
                edge = true;
              }
              ms.push({ key: k, x: sx, y: sy, label: tg.label, far: Math.round(d), floor: floorWord(b.f, tg.f), maybe: !!tg.maybe, edge });
            }
          }
        }
        setMarks(ms);
      }

      // ---- telecamera in prima persona (con un filo di oscillazione dei passi)
      const eyeH = crouch.current ? MOVE.eyeCrouch : MOVE.eye;
      fp.bob += speed * dt * 1.9;
      const bobY = Math.sin(fp.bob * 2) * 0.025 * Math.min(1, speed / 2);
      const bobX = Math.cos(fp.bob) * 0.018 * Math.min(1, speed / 2);
      camPos.set(b.x, b.y + eyeH + bobY, b.z);
      if (pl?.state === 'intrappolato') camPos.y = b.y + 0.7;
      shake.current *= Math.exp(-dt * 4);
      world.camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake.current * 0.15, (Math.random() - 0.5) * shake.current * 0.15, 0));
      world.camera.rotation.order = 'YXZ';
      world.camera.rotation.set(b.pitch, b.yaw + Math.PI, 0);
      fp.torch.position.set(0.27 + bobX, -0.27 + bobY * 0.6, -0.5);
      const carrying = !!pl?.carrying;
      fp.carry.visible = carrying;
      fp.torch.visible = !carrying || pl?.carrying !== 'batteria';
      if (carrying) {
        fp.torch.position.set(0.3 + bobX, -0.3, -0.38);
        fp.torch.rotation.z = 0.5;
      } else fp.torch.rotation.z = 0;
      fp.root.visible = alive || pl?.state === 'intrappolato';
      // torcia: carica, tremolio quando è quasi scarica, lucina di riserva a zero
      const ch = torch.current.charge;
      const on = torch.current.on;
      let ti = (on ? (ch > 0 ? 14 : 4) : 0) * torchNear;
      if (on && ch < 0.15 && ch > 0 && Math.random() < 0.06) ti *= 0.2;
      const hfx = huntFx.current;
      if (jumping) ti = 1.5;
      if (on && ((hunting && cd < 10) || (hfx && Date.now() < hfx.until && Math.hypot(hfx.x - b.x, hfx.z - b.z) < 20)) && Math.random() < 0.35) ti *= Math.random() * 0.3;
      world.torch.intensity += (ti - world.torch.intensity) * Math.min(1, dt * 20);
      (fp.lens.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 * (world.torch.intensity / 14) : 0;
      fp.beam.visible = on;
      ((fp.beam.material as THREE.ShaderMaterial).uniforms.op as { value: number }).value = 0.045 * (world.torch.intensity / 14);
      // audio: chi ascolta, riverbero della stanza
      if (a) {
        a.occlude = (p) => {
          const g = groundAt(p.x, p.z, p.y + 0.1);
          if (!g) return 2;
          if (g.f !== b.f) return roomAt(b.f, b.x, b.z)?.zone === 'scale' && roomAt(g.f, p.x, p.z)?.zone === 'scale' ? 1 : 3;
          return wallsBetween(b.f, b.x, b.z, p.x, p.z, open, 3);
        };
        a.setListener(camPos, b.yaw, b.pitch);
        a.setRoom(roomSound(b.f, b.x, b.z));
      }
      hurtFlash.current = Math.max(pl?.state === 'ferito' ? 0.25 : pl?.state === 'intrappolato' ? 0.5 : 0, hurtFlash.current - dt * 0.8);
      world.render(dt, { hurt: hurtFlash.current, fear: jumping ? 1 : Math.max(fear, hunting ? 0.35 : 0), t });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive3d = false;
      cancelAnimationFrame(raf);
      world.dispose();
    };
  }, []);

  // ---------------------------------------------------------------- interfaccia
  const left = v.stage === 'BRIEF' ? v.briefEnds - now() : v.stage === 'EVAC' && v.evacEnds ? v.evacEnds - now() : null;
  const posOf = (id: string) => {
    const q = realtime?.p3.current.p.get(id);
    return q ? { f: groundAt(q.x, q.z, q.y + 0.15)?.f ?? 1, x: q.x, y: q.y, z: q.z } : null;
  };
  const objs = objectives(v, myId, nameOf, now(), posOf);
  objRef.current = objs;
  const progress = progressOf(v);
  const shiftLeft = v.stage === 'PLAY' && v.deadline ? v.deadline - now() : null;
  const stab = STABILITY[v.stability] ?? STABILITY[0];
  const carrying = me?.carrying;
  const team = Object.entries(v.players);

  if (v.stage === 'END' && v.result) return <Report v={v} nameOf={nameOf} canLead={canLead} state={state} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />;

  return createPortal(
    <div ref={wrapRef} className="fixed inset-0 z-[45] select-none overflow-clip bg-black text-white [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={zoneRef} className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

      {blackout && <div className="pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-700" />}
      {/* dentro l'armadio: si guarda fuori tra le feritoie (sotto tutta l'interfaccia) */}
      {me?.hidden && <div className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0 24px, rgba(0,0,0,0) 24px 40px)', boxShadow: 'inset 0 0 160px 60px #000' }} />}
      {/* il tempo del turno (in alto al centro) */}
      {!narrow && (shiftLeft !== null || v.stage === 'EVAC') && (
        <div className="pointer-events-none absolute left-1/2 top-[max(10px,env(safe-area-inset-top))] -translate-x-1/2 text-center">
          <div className={`rounded-lg border px-3 py-1 text-sm font-semibold tabular-nums ${v.stage === 'EVAC' ? 'animate-pulse border-red-400/60 bg-red-950/80 text-red-100' : shiftLeft! < 180000 ? 'border-red-400/40 bg-black/60 text-red-200' : 'border-white/15 bg-black/50 text-white'}`}>
            {v.stage === 'EVAC' ? `EVACUAZIONE ${fmt(left ?? 0)}` : `Fine turno ${fmt(shiftLeft!)}`}
          </div>
          <div className="mt-1 text-[11px] text-white/70">Impianti {progress}/4</div>
        </div>
      )}
      {/* dentro il nascondiglio: le feritoie e il fiato */}
      {me?.hidden && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-2">
            {breathUi.need ? (
              <p className="animate-pulse rounded bg-red-950/80 px-3 py-1 text-sm font-semibold text-red-100">È qui fuori · trattieni il fiato ({coarse ? 'tieni premuto il pulsante' : 'tieni premuto SPAZIO'})</p>
            ) : (
              <p className="rounded bg-black/60 px-3 py-1 text-xs text-white/80">Nascosto · E per uscire</p>
            )}
            <div className="h-2 w-48 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full ${breathUi.bar < 0.25 ? 'bg-red-400' : 'bg-sky-300'}`} style={{ width: `${breathUi.bar * 100}%` }} />
            </div>
          </div>
        </div>
      )}
      {me?.hidden && coarse && (
        <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] inset-x-0 z-20 flex justify-center gap-3">
          <TouchBtn label="Fiato" big active={breathUi.holding} onDown={() => (breath.current.holding = true)} onUp={() => (breath.current.holding = false)}>
            <span className="text-xs">Trattieni</span>
          </TouchBtn>
          <TouchBtn label="Esci" big onDown={() => acts.current.useStart()} />
        </div>
      )}
      {/* il lavoro aperto */}
      {task && active && (
        <TaskGame
          spec={task}
          start={v.prog[task.st] ?? 0}
          onProgress={(pp) => (taskProg.current = pp)}
          onSubmit={(val) => {
            if (task.kind === 'lucchetto') onAction('MG_LUCCHETTO', { id: task.st, code: val });
            else onAction('MG_CODICE', { st: task.st, code: val });
          }}
          onFail={() => onAction('MG_GUASTO', { st: task.st })}
          onSay={task.kind === 'conta' ? () => onAction('MG_NUMERO', { what: 'lampada' }) : task.kind === 'tastierino' ? () => onAction('MG_NUMERO', { what: task.st }) : undefined}
          onClose={closeTask}
          sfx={sfx}
        />
      )}
      {/* la prima volta che si vede il Custode: le regole, in breve */}
      {tutorial && (
        <div className="absolute inset-x-0 top-[16%] z-30 flex justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#140a0a]/92 p-4 text-sm shadow-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-red-300/80">Il Custode</p>
            <ul className="mt-2 space-y-1.5 text-white/85">
              <li>• Sente i rumori: lavori, corse, porte sbattute e <b>voci alte</b>. Sussurrare è sicuro.</li>
              <li>• Prima di arrivare: <b>due colpi metallici</b>. Davanti a una porta chiusa <b>bussa tre volte</b>.</li>
              <li>• Se ti vede ti insegue: chiudi le porte, spegni la torcia, <b>nasconditi in un armadio</b> (E).</li>
              <li>• Il primo colpo ti ferisce (medicati al furgone). Il secondo ti <b>incatena</b>: i compagni ti liberano con la combinazione che vedi solo tu.</li>
            </ul>
            <button type="button" onClick={() => setTutorial(false)} className="mt-3 w-full rounded-lg bg-red-300/90 py-2 font-semibold text-black">
              Ho capito
            </button>
          </div>
        </div>
      )}
      {/* gli obiettivi: cosa fare adesso, linea per linea */}
      {active && !tablet && v.stage !== 'BRIEF' && (
        <div className="absolute left-3 top-[62px] w-[min(19rem,58vw)] text-xs">
          <button type="button" onClick={() => setObjOpen((x) => !x)} className="mb-1 flex w-full items-center justify-between rounded-md bg-black/60 px-2.5 py-1 text-left font-semibold">
            <span>Lavori · {progress}/4</span>
            {narrow && (shiftLeft !== null || v.stage === 'EVAC') && (
              <span className={`tabular-nums ${v.stage === 'EVAC' ? 'animate-pulse text-red-300' : shiftLeft! < 180000 ? 'text-red-200' : 'text-white/85'}`}>
                {v.stage === 'EVAC' ? `EVAC ${fmt(left ?? 0)}` : `turno ${fmt(shiftLeft!)}`}
              </span>
            )}
            <span className="text-white/60">{objOpen ? 'nascondi' : 'mostra'}</span>
          </button>
          {objOpen && (
            <div className="space-y-1">
              {(narrow ? objs.filter((o) => !o.done && !o.blocked) : objs).map((o, i) => {
                // espanso solo ciò che conta adesso: imprevisti, uscita e le linee ancora aperte (le bloccate restano su una riga)
                const open = !o.done && !o.blocked;
                if (narrow) o = i === 0 ? o : { ...o, where: undefined };
                return (
                  <div key={o.id} className={`rounded-md px-2.5 ${open ? 'py-1.5' : 'py-1'} ${o.id === 'perdita' ? 'bg-red-950/75' : o.id === 'uscita' ? 'bg-emerald-950/80' : 'bg-black/55'} ${o.done ? 'opacity-55' : ''}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className={`grid h-3.5 w-3.5 place-items-center rounded-sm border text-[9px] ${o.done ? 'border-emerald-300 bg-emerald-400/30 text-emerald-100' : o.blocked ? 'border-white/25 text-white/40' : 'border-amber-200 text-amber-100'}`}>{o.done ? '✓' : ''}</span>
                      <span className={o.done ? 'line-through' : o.blocked ? 'text-white/55' : ''}>{o.title}</span>
                      {o.done && <span className="ml-auto text-[10px] text-emerald-200/80">fatto</span>}
                      {o.blocked && <span className="ml-auto text-[10px] text-white/40">dopo</span>}
                    </div>
                    {open && <p className="mt-0.5 leading-snug text-amber-100/95">{o.step}</p>}
                    {open && o.where && <p className="leading-snug text-white/55">{o.where}</p>}
                  </div>
                );
              })}
              {narrow && objs.some((o) => o.done || o.blocked) && (
                <div className="rounded-md bg-black/45 px-2.5 py-1 text-[11px] leading-snug text-white/55">
                  {objs.some((o) => o.done) && <span className="text-emerald-200/80">✓ {objs.filter((o) => o.done).map((o) => o.title).join(', ')}</span>}
                  {objs.some((o) => o.done) && objs.some((o) => o.blocked) && ' · '}
                  {objs.some((o) => o.blocked) && <span>dopo: {objs.filter((o) => o.blocked).map((o) => o.title).join(', ')}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* indicatori dei lavori nel mondo */}
      {active &&
        !tablet &&
        marks.map((m) => (
          <div key={m.key} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center text-[10px] ${m.maybe ? 'opacity-60' : ''}`} style={{ left: m.x, top: m.y }}>
            <div className="whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 font-semibold text-amber-100">
              {m.label} · {m.far} m {m.floor && <span className="text-sky-200">{m.floor}</span>}
            </div>
            <div className={`mx-auto mt-0.5 h-2.5 w-2.5 rotate-45 border border-amber-200 ${m.edge ? 'bg-amber-200/70' : 'bg-amber-200/25'}`} />
          </div>
        ))}
      {/* avviso grande al centro quando si completa qualcosa */}
      {banner && (
        <div key={banner.key} className="pointer-events-none absolute inset-x-0 top-[24%] flex justify-center px-4">
          <div className={`rounded-xl border px-6 py-3 text-center shadow-2xl ${banner.tone === 'ok' ? 'border-emerald-300/50 bg-emerald-950/85' : banner.tone === 'warn' ? 'border-amber-300/50 bg-amber-950/85' : 'border-red-400/50 bg-red-950/85'}`}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">{banner.title}</p>
            <p className="mt-0.5 text-lg font-semibold">{banner.text}</p>
          </div>
        </div>
      )}
      {/* in alto: impostazioni, stato dell'edificio, squadra */}
      <div className="pointer-events-none absolute inset-x-3 top-[max(10px,env(safe-area-inset-top))] flex items-start justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMenu(true)} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-black/50" aria-label="Impostazioni">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          <div className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-semibold tracking-wide">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: stab.color }} />
            {!narrow && 'Edificio: '}
            {stab.name}
            {left !== null && <span className="ml-2 tabular-nums text-amber-200">{fmt(left)}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {team.map(([id, p]) => (
            <div key={id} className="flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(id) }} />
              <span className={id === myId ? 'font-bold' : ''}>{nameOf(id)}</span>
              <span className="text-white/60">{p.state === 'ok' ? '' : p.state === 'ferito' ? 'ferito' : p.state === 'intrappolato' ? 'intrappolato' : p.state === 'estratto' ? 'fuori' : p.state === 'evacuato' ? 'evacuato' : 'uscito'}</span>
              {voiceRef.current?.speaking(id) && <span className="text-amber-200">{voiceRef.current.radioOf(id) ? 'radio' : 'parla'}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* mirino e cosa posso fare */}
      {active && !tablet && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`h-1.5 w-1.5 rounded-full ${prompt ? 'bg-amber-200' : 'bg-white/50'}`} />
        </div>
      )}
      {active && prompt && !tablet && (
        <div className="pointer-events-none absolute left-1/2 top-[56%] flex -translate-x-1/2 flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 rounded-md bg-black/55 px-3 py-1.5 text-sm font-semibold">
            {!coarse && <span className="rounded border border-white/40 px-1.5 text-xs">E</span>}
            {prompt.text}
          </div>
          {prompt.sub && <div className="rounded bg-black/40 px-2 py-0.5 text-xs text-white/70">{prompt.sub}</div>}
          {prompt.prog > 0 && (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-amber-200" style={{ width: `${Math.round(prompt.prog * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* ping visibili */}
      {pingTags.map((p) => (
        <div key={p.key} className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center text-xs" style={{ left: p.x, top: p.y }}>
          <div className={`rounded px-2 py-0.5 font-semibold ${p.danger ? 'bg-red-900/70' : 'bg-black/60'}`}>{p.text}</div>
          <div className="text-white/60">{p.far} m</div>
          <div className={`mx-auto mt-0.5 h-2 w-2 rotate-45 ${p.danger ? 'bg-red-400' : 'bg-amber-200'}`} />
        </div>
      ))}

      {/* sottotitoli e avvisi */}
      <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 px-4 text-center ${narrow ? 'bottom-[max(300px,38%)] text-xs' : 'bottom-[max(150px,18%)]'}`}>
        {captions.map((c) => (
          <p key={c.key} className={`rounded px-3 py-1 text-sm ${c.danger ? 'bg-red-950/70 text-red-100' : 'bg-black/55 text-white/90'}`}>
            {c.text}
          </p>
        ))}
      </div>

      {/* in basso a sinistra: cosa porto e la torcia */}
      <div className="pointer-events-none absolute bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-2 text-xs">
        {carrying && <div className="rounded-md bg-black/55 px-3 py-1">In mano: {ITEM_NAMES[carrying]}{!coarse && ' · G per appoggiare'}</div>}
        <div className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1">
          <span className="text-white/70">Torcia</span>
          <div className="h-1.5 w-12 overflow-hidden rounded bg-white/15">
            <div className={`h-full ${torchUi.charge < 0.15 ? 'bg-red-400' : 'bg-amber-200'}`} style={{ width: `${torchUi.charge * 100}%` }} />
          </div>
          {!torchUi.on && <span className="text-white/50">spenta</span>}
        </div>
        {mic === 'on' && (
          <div className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1">
            <span className="text-white/70">{muted ? 'Muto' : 'Voce'}</span>
            {!muted && (
              <div className="relative h-1.5 w-16 overflow-hidden rounded bg-white/15">
                <div className={`h-full ${voiceLvl > 0.18 ? 'bg-red-400' : voiceLvl > 0.06 ? 'bg-amber-300' : 'bg-emerald-300'}`} style={{ width: `${Math.min(100, (voiceLvl / 0.25) * 100)}%` }} />
                <div className="absolute inset-y-0 left-[24%] w-px bg-white/50" />
              </div>
            )}
            {!muted && <span className={voiceLvl > 0.06 ? 'text-amber-200' : 'text-white/50'}>{voiceLvl > 0.18 ? 'alta!' : voiceLvl > 0.06 ? 'si sente' : 'sussurro'}</span>}
          </div>
        )}
      </div>

      {/* comandi del telefono */}
      {coarse && active && !tablet && !menu && (
        <>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-[max(16px,env(safe-area-inset-left))]">
            <Stick onMove={(x, y) => (joy.current = { x, y })} />
          </div>
          <div className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] grid grid-cols-3 items-end gap-2">
            <TouchBtn label="Torcia" onDown={() => acts.current.toggleTorch()} active={torchUi.on} />
            <TouchBtn label="Giù" onDown={() => (crouch.current = !crouch.current)} active={crouch.current} />
            <TouchBtn label="Radio" onDown={() => acts.current.radio(true)} onUp={() => acts.current.radio(false)} />
            <TouchBtn label="Ping" onDown={() => setWheel((w) => !w)} />
            <TouchBtn label="Tablet" onDown={() => setTablet('lavori')} />
            {carrying ? <TouchBtn label="Lascia" onDown={() => acts.current.drop()} /> : <span />}
            <div className="col-span-3 flex justify-end">
              <TouchBtn label="Usa" big active={!!prompt} onDown={() => acts.current.useStart()} onUp={() => acts.current.useEnd()}>
                <span className="text-sm">Usa</span>
              </TouchBtn>
            </div>
          </div>
        </>
      )}
      {!coarse && active && !tablet && !menu && entered && (
        <p className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[11px] text-white/45">
          WASD · Shift corri · C abbassati · E usa · F torcia · Q messaggi · V radio · Tab tablet{locked ? ' · Esc libera il mouse' : ''}
        </p>
      )}

      {/* messaggi rapidi */}
      {wheel && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/30" onPointerDown={(e) => e.target === e.currentTarget && setWheel(false)}>
          <div className="w-72 rounded-xl border border-white/15 bg-[#0d1013]/95 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">Messaggi rapidi</span>
              <button type="button" onClick={() => setRadioMode((r) => !r)} className={`rounded px-2 py-0.5 text-xs ${radioMode ? 'bg-amber-200/30 text-amber-100' : 'bg-white/10'}`}>
                {radioMode ? 'Via radio (tutti)' : 'Vicino (chi è qui)'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PINGS.map((p, i) => (
                <button key={p.k} type="button" onClick={() => sendPing(p.k, radioMode)} className={`rounded-lg px-2 py-2 text-left ${p.danger ? 'bg-red-900/50' : 'bg-white/10'}`}>
                  {!coarse && <span className="mr-1 text-white/50">{i + 1}</span>}
                  {p.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* intrappolato / fuori */}
      {myState === 'intrappolato' && !menu && (() => {
        const tr = me?.trap;
        const helpers = Object.entries(v.players).some(([id, q]) => id !== myId && (q.state === 'ok' || q.state === 'ferito'));
        const all = (tr?.revealed ?? 0) >= 3;
        return (
        <div className="absolute inset-x-0 top-[14%] z-20 flex flex-col items-center gap-2 px-4 text-center">
          <p className="rounded bg-red-950/80 px-4 py-2 text-base font-semibold">Sei incatenato · {roomAt(body.current.f, body.current.x, body.current.z)?.name ?? FLOOR_NAMES[body.current.f]}</p>
          <p className="max-w-md rounded bg-black/65 px-3 py-1.5 text-sm text-white/85">
            {all
              ? helpers
                ? 'Hai letto tutta la combinazione: dettala ai compagni (a voce, radio o pulsante). Sono loro ad aprire il lucchetto.'
                : 'Sei da solo: continua a divincolarti per forzare il lucchetto (fa rumore).'
              : 'Un lucchetto a combinazione ti tiene fermo. Divincolati per leggere le cifre incise sulla catena: attento, le catene fanno rumore.'}
          </p>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`grid h-14 w-11 place-items-center rounded-md border-2 font-mono text-3xl font-bold ${i < (tr?.revealed ?? 0) ? 'border-amber-200 bg-[#d8d2c0] text-black' : 'border-white/25 bg-black/50 text-white/40'}`}>
                {tr?.digits[i] ?? '?'}
              </div>
            ))}
          </div>
          {(!all || !helpers) && (
            <div className="flex flex-col items-center gap-1">
              <div className="h-2 w-52 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-amber-300" style={{ width: `${(struggleN / 10) * 100}%` }} />
              </div>
              {all && !helpers && <p className="text-xs text-white/60">Lucchetto: {tr?.self ?? 0}/5</p>}
              {coarse ? (
                <div className="mt-1 flex gap-3">
                  <button type="button" onPointerDown={() => acts.current.struggleKey('a')} className="h-14 w-20 rounded-xl border border-white/25 bg-white/10 text-2xl">
                    ◀
                  </button>
                  <button type="button" onPointerDown={() => acts.current.struggleKey('d')} className="h-14 w-20 rounded-xl border border-white/25 bg-white/10 text-2xl">
                    ▶
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/60">Premi A e D alternati per divincolarti</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {(tr?.revealed ?? 0) > 0 && helpers && (
              <button type="button" onClick={() => onAction('MG_NUMERO', { what: 'codice' })} className="rounded-lg bg-amber-200/90 px-4 py-2 text-sm font-semibold text-black">
                Scrivi le cifre alla squadra
              </button>
            )}
            <button type="button" onClick={() => sendPing('aiuto', true)} className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold">
              Chiedi aiuto via radio
            </button>
            <button type="button" disabled={!!me?.evacAt} onClick={() => onAction('MG_EVAC')} className="rounded-lg bg-white/10 px-4 py-2 text-sm disabled:opacity-50">
              {me?.evacAt ? `Evacuazione tra ${fmt(me.evacAt - now())}` : 'Arrenditi: evacuazione'}
            </button>
          </div>
        </div>
        );
      })()}
      {(myState === 'estratto' || myState === 'evacuato' || myState === 'uscito') && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 p-6 text-center">
          <div className="max-w-md">
            <p className="text-2xl font-semibold">{myState === 'estratto' ? 'Sei fuori dal palazzo' : myState === 'evacuato' ? 'Sei stato evacuato' : 'Sei uscito dalla partita'}</p>
            <p className="mt-2 text-sm text-white/70">Aspetta la squadra. Puoi parlare con chi è già fuori; i compagni dentro non ti sentono.</p>
            {myState === 'estratto' && (v.stage === 'PLAY' || v.stage === 'EVAC') && (
              <div className="mt-4">
                {canLead ? (
                  <button type="button" onClick={() => onAction('MG_PROVA', { what: 'ferito' })} className="rounded-xl bg-amber-200 px-5 py-3 font-semibold text-black">
                    Rientra nella missione
                  </button>
                ) : (
                  <p className="text-xs text-white/60">Uscito per sbaglio? Può rientrare solo il capo della stanza: se il capo chiude un attimo l’app, qui compare il pulsante «Rientra nella missione».</p>
                )}
              </div>
            )}
            <div className="mt-4 space-y-1 text-left text-sm">
              {v.log.slice(-6).map((l, i) => (
                <p key={i} className={l.kind === 'danger' ? 'text-red-300' : l.kind === 'ok' ? 'text-emerald-200' : 'text-white/80'}>
                  {l.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* il tablet di manutenzione */}
      {tablet && <Tablet v={v} objs={objs} tab={tablet} setTab={setTablet} floor={planFloor} setFloor={setPlanFloor} me={body.current} nameOf={nameOf} />}

      {/* briefing / ingresso */}
      {(v.stage === 'BRIEF' || !entered) && (
        <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e1114]/95 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Contratto · Il piano spento</p>
            <h2 className="mt-1 text-3xl font-semibold">Non lasciarmi solo</h2>
            <p className="mt-2 text-sm text-white/75">
              Condominio evacuato, di notte. Il secondo piano è al buio e la pompa della cantina non riparte. Ripristinate gli impianti, collaudate l’uscita di servizio e uscite tutti insieme.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-white/85">
              <li>1. Luci: inserisci il modulo nel quadro (piano terra), avvia il test, conta i lampeggi della lampada al secondo piano e imposta il numero sul quadro.</li>
              <li>2. Pompa: svita il filtro, strofinalo al lavello dell’officina, riavvitalo e riavvia la pompa tenendo la pressione nel verde.</li>
              <li>3. Batteria: quando l’acqua scende prendila nel deposito, portala all’uscita di servizio e collega i cavi.</li>
              <li>4. Collaudo: ogni display mostra il codice per l’altra postazione. Leggetelo, inseritelo e uscite dalla porta di servizio.</li>
            </ul>
            <p className="mt-3 rounded-lg bg-white/5 p-2 text-xs text-white/75">
              In alto a sinistra trovi sempre i lavori e il prossimo passo; i rombi gialli indicano dove andare. In alto al centro c’è il tempo del turno ({[30, 25, 20][v.pressure]} minuti): poi si evacua. Il tablet (Tab) ha la pianta dei piani.
            </p>
            <p className="mt-2 rounded-lg bg-white/5 p-2 text-xs text-white/65">
              Qualcosa occupa gli spazi di lavoro. Sente i rumori degli impianti, le corse e le voci alte: vicino a lui si parla sottovoce. Due colpi metallici annunciano che si avvicina. Porte chiuse e fermi lo rallentano; negli armadi ci si nasconde. Al furgone nel cortile ci si medica (lui non esce dal palazzo).
            </p>
            {!entered ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => void enter(true)} className="rounded-xl bg-amber-200 py-3 font-semibold text-black">
                  Entra con il microfono
                </button>
                <button type="button" onClick={() => void enter(false)} className="rounded-xl bg-white/10 py-3 font-semibold">
                  Entra senza microfono
                </button>
                <p className="text-xs text-white/50 sm:col-span-2">La voce va direttamente da telefono a telefono e non viene registrata. Senza microfono si gioca con i messaggi rapidi.</p>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-white/70">{mic === 'no' ? 'Microfono non disponibile: usa i messaggi rapidi.' : 'Si parte tra'} {left !== null && <span className="tabular-nums text-amber-200">{fmt(left)}</span>}</p>
                {canLead && (
                  <button type="button" onClick={() => onAction('MG_FORCE')} className="rounded-xl bg-amber-200 px-5 py-2.5 font-semibold text-black">
                    Siamo pronti
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* impostazioni */}
      {menu && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4" onPointerDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#0e1114] p-5 text-sm">
            <h3 className="text-xl font-semibold">Impostazioni</h3>
            <label className="flex flex-col gap-1">
              Volume <input type="range" min={0} max={150} value={Math.round(prefs.volume * 100)} onChange={(e) => setPrefs((p) => ({ ...p, volume: Number(e.target.value) / 100 }))} />
            </label>
            <label className="flex flex-col gap-1">
              Sensibilità della visuale <input type="range" min={20} max={300} value={Math.round(prefs.sens * 100)} onChange={(e) => setPrefs((p) => ({ ...p, sens: Number(e.target.value) / 100 }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Azioni continue con un tocco (invece di tenere premuto)
              <input type="checkbox" checked={prefs.toggleHold} onChange={(e) => setPrefs((p) => ({ ...p, toggleHold: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Indicatori dei lavori sullo schermo
              <input type="checkbox" checked={prefs.markers} onChange={(e) => setPrefs((p) => ({ ...p, markers: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-2">
              Sottotitoli dei suoni
              <input type="checkbox" checked={prefs.captions} onChange={(e) => setPrefs((p) => ({ ...p, captions: e.target.checked }))} />
            </label>
            {mic === 'on' && (
              <button
                type="button"
                onClick={() => {
                  const m = !muted;
                  voiceRef.current?.setMuted(m);
                  setMuted(m);
                }}
                className="rounded-lg bg-white/10 py-2"
              >
                {muted ? 'Riattiva il microfono' : 'Silenzia il microfono'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMenu(false)} className="rounded-lg bg-amber-200 py-2.5 font-semibold text-black">
                Riprendi
              </button>
              <button type="button" onClick={() => onLeave?.()} className="rounded-lg bg-red-900/70 py-2.5 font-semibold">
                Esci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- testi delle postazioni

// Il minigioco di una postazione adesso (null = si tiene premuto come prima, o non si può)
const PROGRESS_TASKS: TaskSpec['kind'][] = ['gira', 'strofina', 'pressione', 'cavi', 'inserisci'];
function taskFor(s: Horror1View, st: StationDef, me: string): TaskSpec | null {
  const carry = s.players[me]?.carrying;
  const filtro = s.items.find((i) => i.kind === 'filtro' && i.by === me);
  switch (st.kind) {
    case 'pannello':
      if (s.luce === 'ok') return null;
      if (!s.modulo) return carry === 'modulo' ? { kind: 'inserisci', st: st.id, title: 'Quadro luci · modulo', hint: 'Infila il modulo nuovo nel suo alloggiamento.' } : null;
      if (s.luce === 'test') return { kind: 'quadrante', st: st.id, title: 'Quadro luci · test', hint: 'Imposta quante volte lampeggia la lampada di prova (secondo piano, fondo del corridoio). Numero sbagliato: allarme e sequenza nuova.' };
      return null;
    case 'lampada':
      return s.luce === 'test' && s.blink ? { kind: 'conta', st: st.id, title: 'Lampada di prova', hint: 'Lampeggia sempre lo stesso numero di volte, poi fa una pausa.', n: s.blink } : null;
    case 'filtro':
      if (s.pompaOn) return null;
      if (s.filtro === 'sporco') return { kind: 'gira', st: st.id, title: 'Filtro della pompa', hint: 'Svita il tappo del filtro (fa un po’ di rumore).', dir: -1, turns: 3, look: 'tappo' };
      if (s.filtro === 'fuori' && filtro?.clean) return { kind: 'gira', st: st.id, title: 'Filtro della pompa', hint: 'Riavvita il filtro pulito fino in fondo.', dir: 1, turns: 3, look: 'tappo' };
      return null;
    case 'lavello':
      return filtro && !filtro.clean ? { kind: 'strofina', st: st.id, title: 'Lavello dell’officina', hint: 'Strofina via la melma dal filtro.' } : null;
    case 'pompa':
      if (s.pompaOn || s.filtro !== 'montato') return null;
      return { kind: 'pressione', st: st.id, title: 'Riavvio della pompa', hint: 'Molto rumoroso. Se un compagno guarda il livello in lavanderia, la zona verde è più ampia.', wide: Object.values(s.holds).some((h) => h.st === 'livello') };
    case 'alloggio':
      return !s.batteria && carry === 'batteria' ? { kind: 'cavi', st: st.id, title: 'Batteria di emergenza', hint: 'Collega i cavi ai morsetti giusti.' } : null;
    case 'collaudo1':
    case 'collaudo2': {
      if (s.collaudo.done || s.luce !== 'ok' || !s.pompaOn || !s.batteria) return null;
      const mine = st.kind === 'collaudo1' ? s.collaudo.a : s.collaudo.b;
      return {
        kind: 'tastierino',
        st: st.id,
        title: st.kind === 'collaudo1' ? 'Quadro dell’uscita' : 'Centralina del primo piano',
        hint: `Sul display c’è il codice per ${st.kind === 'collaudo1' ? 'la centralina (primo piano)' : 'il quadro dell’uscita (piano terra)'}; qui va inserito quello che compare là.`,
        show: s.codes?.[st.id as 'collaudo1' | 'collaudo2'] ?? '----',
        done: mine,
      };
    }
    case 'valvola':
      return s.leak?.st === st.id ? { kind: 'gira', st: st.id, title: 'Valvola della perdita', hint: 'Chiudi la valvola girando la ruota.', dir: 1, turns: 2, look: 'valvola' } : null;
  }
  return null;
}

function stationText(s: Horror1View, st: StationDef, me: string): string {
  const carry = s.players[me]?.carrying;
  switch (st.kind) {
    case 'pannello':
      return s.luce === 'ok' ? 'Quadro luci: tutto a posto' : !s.modulo ? (carry === 'modulo' ? 'Inserisci il modulo luci' : 'Quadro luci: manca il modulo') : s.luce === 'test' ? 'Imposta i lampeggi della lampada' : 'Tieni giù la leva: avvia il test';
    case 'lampada':
      return s.luce === 'test' ? 'Conta i lampeggi' : 'Lampada di prova';
    case 'filtro':
      return s.filtro === 'sporco' ? 'Svita il filtro della pompa' : s.filtro === 'fuori' ? 'Riavvita il filtro pulito' : 'Filtro montato';
    case 'lavello':
      return carry === 'filtro' ? 'Strofina il filtro' : 'Lavello';
    case 'pompa':
      return s.pompaOn ? 'Pompa in funzione' : 'Riavvia la pompa';
    case 'livello':
      return `Osserva il livello dell’acqua (${Math.round(s.acqua * 100)}%)`;
    case 'alloggio':
      return s.batteria ? 'Batteria installata' : carry === 'batteria' ? 'Installa la batteria' : 'Alloggiamento della batteria';
    case 'collaudo1':
    case 'collaudo2':
      return s.collaudo.done ? 'Collaudo riuscito' : 'Collaudo: display e tastierino';
    case 'valvola':
      return 'Chiudi la valvola della perdita';
    case 'portone':
      return s.players[me]?.state === 'ferito' ? 'Medicati nel furgone' : 'Ritirati nel furgone';
  }
  return st.name;
}
function stationSub(s: Horror1View, st: StationDef): string | undefined {
  if (st.kind === 'pompa' && !s.pompaOn) return 'Lancetta nel verde · molto rumoroso · in due è più facile';
  if (st.kind === 'pannello' && s.modulo && s.luce === 'spenta') return 'Tieni premuto 3 s · fa rumore';
  if (st.kind === 'livello') return 'Mentre osservi, a chi riavvia la pompa si allarga la zona verde';
  if ((st.kind === 'collaudo1' || st.kind === 'collaudo2') && !s.collaudo.done) return 'Qui leggi il codice per l’altra postazione e inserisci il suo';
  if (st.kind === 'portone') return 'Tieni premuto · da ferito ti medichi, altrimenti esci dalla missione';
  return undefined;
}

// ---------------------------------------------------------------- tablet: lavori, pianta, registro

function Tablet({ v, objs, tab, setTab, floor, setFloor, me, nameOf }: { v: Horror1View; objs: Objective[]; tab: 'lavori' | 'pianta' | 'registro'; setTab: (t: null | 'lavori' | 'pianta' | 'registro') => void; floor: number; setFloor: (f: number) => void; me: HBody; nameOf: (id: string) => string }) {
  const jobs: { text: string; done: boolean; note?: string }[] = [
    { text: 'Modulo luci nel quadro (piano terra)', done: v.modulo },
    { text: 'Test luci: lampeggi impostati sul quadro', done: v.luce === 'ok', note: v.luce === 'test' ? 'contate i lampeggi della lampada al secondo piano' : undefined },
    { text: 'Filtro estratto e pulito (officina)', done: v.filtro === 'montato' || v.pompaOn },
    { text: 'Pompa riavviata', done: v.pompaOn, note: v.pompaOn ? `acqua ${Math.round(v.acqua * 100)}%` : undefined },
    { text: 'Batteria installata all’uscita di servizio', done: v.batteria, note: v.doors['c-deposito']?.lock ? 'il deposito è bloccato dall’acqua' : undefined },
    { text: 'Collaudo: quadro dell’uscita', done: v.collaudo.a },
    { text: 'Collaudo: centralina del primo piano', done: v.collaudo.b },
  ];
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-3" onPointerDown={(e) => e.target === e.currentTarget && setTab(null)}>
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border-[6px] border-[#1b1f22] bg-[#0b0f0d] p-3 text-sm shadow-2xl">
        <div className="mb-2 flex items-center gap-1">
          {(['lavori', 'pianta', 'registro'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1 capitalize ${tab === t ? 'bg-emerald-300/20 text-emerald-100' : 'text-white/60'}`}>
              {t}
            </button>
          ))}
          <button type="button" onClick={() => setTab(null)} className="ml-auto rounded-md bg-white/10 px-3 py-1">
            Chiudi
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto font-mono text-[13px] text-emerald-50/90">
          {tab === 'lavori' && (
            <div className="space-y-2">
              {objs.map((o) => (
                <div key={o.id} className="rounded-md border border-emerald-300/10 p-2">
                  <div className="flex items-center gap-2">
                    <span className={o.done ? 'text-emerald-300' : o.blocked ? 'text-white/40' : 'text-amber-200'}>{o.done ? '[x]' : o.blocked ? '[-]' : '[ ]'}</span>
                    <span className={o.done ? 'text-white/50 line-through' : 'font-semibold'}>{o.title}</span>
                  </div>
                  {!o.done && <p className="ml-7 text-amber-100/90">{o.step}</p>}
                  {!o.done && o.where && <p className="ml-7 text-white/55">{o.where}</p>}
                </div>
              ))}
              <p className="text-white/60">Fermi per le porte: {v.fermi} · Stabilità: {['operativo', 'in sovraccarico', 'instabile', 'evacuazione'][v.stability]}</p>
              <div className="mt-2 space-y-0.5 text-white/70">
                {Object.entries(v.players).map(([id, p]) => (
                  <p key={id}>
                    {nameOf(id)}: {p.state}
                    {p.carrying ? ` · porta ${ITEM_NAMES[p.carrying].toLowerCase()}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
          {tab === 'pianta' && <Plan v={v} objs={objs} floor={floor} setFloor={setFloor} me={me} />}
          {tab === 'registro' && (
            <div className="space-y-1">
              {[...v.log].reverse().map((l, i) => (
                <p key={i} className={l.kind === 'danger' ? 'text-red-300' : l.kind === 'ok' ? 'text-emerald-300' : l.kind === 'warn' ? 'text-amber-200' : 'text-white/80'}>
                  {fmt(l.t - v.startAt)} · {l.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Planimetria del piano: stanze principali, scale, postazioni. Si vede solo dove sono io (niente radar dei compagni)
function Plan({ v, objs, floor, setFloor, me }: { v: Horror1View; objs: Objective[]; floor: number; setFloor: (f: number) => void; me: HBody }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const S = 18;
    cv.width = H1.cols * S;
    cv.height = H1.rows * S;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#070a08';
    c.fillRect(0, 0, cv.width, cv.height);
    const g = GRIDS[floor];
    for (let r = 0; r < H1.rows; r++)
      for (let col = 0; col < H1.cols; col++) {
        const id = g.room(col, r);
        if (id === '#') continue;
        const stair = id === 'A' || id === 'B' || id === 'L';
        c.fillStyle = stair ? '#24302a' : '#16201b';
        c.fillRect(col * S, r * S, S, S);
      }
    c.strokeStyle = '#6fbf8f';
    c.lineWidth = 2;
    // muri: dove cambia la stanza
    for (let r = 0; r < H1.rows; r++)
      for (let col = 0; col < H1.cols; col++) {
        const a = g.room(col, r);
        const right = g.room(col + 1, r);
        const down = g.room(col, r + 1);
        const open = (x: string, y: string) => [x, y].sort().join('') in { AP: 1, BP: 1, AL: 1, BL: 1, CP: 1 } || x === y;
        if (!open(a, right)) {
          c.beginPath();
          c.moveTo((col + 1) * S, r * S);
          c.lineTo((col + 1) * S, (r + 1) * S);
          c.stroke();
        }
        if (!open(a, down)) {
          c.beginPath();
          c.moveTo(col * S, (r + 1) * S);
          c.lineTo((col + 1) * S, (r + 1) * S);
          c.stroke();
        }
      }
    // porte
    for (const d of DOORS.filter((x) => x.f === floor)) {
      const [x0, z0, x1, z1] = doorSeg(d);
      const st = v.doors[d.id];
      c.strokeStyle = st?.lock ? '#e0574a' : st?.open ? '#0b0f0d' : '#d9c58a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x0 * S + (x0 === x1 ? 0 : 3), z0 * S + (z0 === z1 ? 0 : 3));
      c.lineTo(x1 * S - (x0 === x1 ? 0 : 3), z1 * S - (z0 === z1 ? 0 : 3));
      c.stroke();
    }
    // nomi delle stanze e postazioni
    c.fillStyle = '#9fd8b5';
    c.font = '10px monospace';
    c.textAlign = 'center';
    for (const rm of ROOMS.filter((x) => x.f === floor && !['A', 'B', 'L', 'C'].includes(x.id))) {
      const [c0, r0, c1, r1] = rm.rects[0];
      c.fillText(rm.name.length > 18 ? rm.name.slice(0, 17) + '…' : rm.name, ((c0 + c1 + 1) / 2) * S, ((r0 + r1 + 1) / 2) * S);
    }
    for (const st of STATIONS.filter((x) => x.f === floor && (x.kind !== 'valvola' || v.leak?.st === x.id))) {
      c.fillStyle = st.kind === 'valvola' ? '#e0574a' : '#e5c46a';
      c.fillRect(st.x * S - 4, st.z * S - 4, 8, 8);
    }
    // dove andare (rombi gialli) e dove potrebbero essere gli oggetti (punti di domanda)
    for (const o of objs) {
      if (o.done || o.blocked) continue;
      for (const t of o.targets) {
        if (t.f !== floor) continue;
        c.save();
        c.translate(t.x * S, t.z * S);
        if (t.maybe) {
          c.fillStyle = '#e5c46a';
          c.font = 'bold 13px monospace';
          c.fillText('?', 0, 4);
        } else {
          c.rotate(Math.PI / 4);
          c.strokeStyle = '#ffd36a';
          c.lineWidth = 2;
          c.strokeRect(-6, -6, 12, 12);
        }
        c.restore();
      }
    }
    if (me.f === floor) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(me.x * S, me.z * S, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.beginPath();
      c.moveTo(me.x * S, me.z * S);
      c.lineTo((me.x + Math.sin(me.yaw) * 1.2) * S, (me.z + Math.cos(me.yaw) * 1.2) * S);
      c.stroke();
    }
  }, [floor, v.doors, v.leak, me.x, me.z, me.f, objs.map((o) => o.step).join('|')]);
  return (
    <div>
      <div className="mb-2 flex gap-1">
        {FLOOR_NAMES.map((n, f) => (
          <button key={n} type="button" onClick={() => setFloor(f)} className={`rounded px-2 py-0.5 text-xs ${floor === f ? 'bg-emerald-300/20 text-emerald-100' : 'bg-white/5 text-white/60'}`}>
            {n}
          </button>
        ))}
      </div>
      <canvas ref={ref} className="w-full rounded-lg" style={{ imageRendering: 'pixelated' }} />
      <p className="mt-1 text-xs text-white/50">Rombi gialli: dove andare adesso · ?: dove può essere un oggetto · quadratini: postazioni · rosso: perdita o porta bloccata · punto bianco: tu</p>
    </div>
  );
}

// ---------------------------------------------------------------- resoconto finale

function Report({ v, nameOf, canLead, state, onNewGame, onBackToLobby }: { v: Horror1View; nameOf: (id: string) => string; canLead: boolean; state: ModeProps['state']; onNewGame: () => void; onBackToLobby: () => void }) {
  const r = v.result!;
  const title = r.outcome === 'completo' ? 'Missione completata' : r.outcome === 'parziale' ? 'Uscita parziale' : 'Missione fallita';
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-white/10 bg-[#0e1114] p-5 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Resoconto · Il piano spento</p>
        <h2 className="mt-1 text-3xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{r.minutes} minuti nel palazzo</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-semibold">Lavori</p>
            {r.done.length ? r.done.map((d) => <p key={d} className="text-sm text-emerald-200">· {d}</p>) : <p className="text-sm text-white/50">Nessun impianto ripristinato</p>}
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">La squadra</p>
            {r.people.map((p) => (
              <p key={p.id} className="text-sm text-white/80">
                {nameOf(p.id)} {p.how}
                {p.helped ? ` · ha liberato ${p.helped === 1 ? 'un compagno' : `${p.helped} compagni`}` : ''}
              </p>
            ))}
          </div>
        </div>
        {r.causes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-sm font-semibold">Cosa è successo</p>
            {r.causes.map((c) => (
              <p key={c} className="text-sm text-white/70">
                · {c}
              </p>
            ))}
          </div>
        )}
      </section>
      <EndBar canLead={canLead} hostName={state.players.find((p) => p.id === state.hostId)?.name} onNewGame={onNewGame} onBackToLobby={onBackToLobby} />
    </div>
  );
}
