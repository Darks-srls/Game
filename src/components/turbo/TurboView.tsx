// ⚽🚗 Axend Turbo — la schermata del gioco: motore (rete e previsione), grafica 3D, comandi (tastiera, controller, tocco),
// pulsante ASSISTITO (5 s di bot alla guida, poi 4 s di ricarica), orientamento automatico in aria sul telefono e tutte le scritte.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameFullscreen, type ModeProps } from '../ui';
import type { TurboRoomView } from '../../game/turbo/room';
import { noControls, type Car, type Controls } from '../../game/turbo/car';
import type { Phase, World } from '../../game/turbo/world';
import { airAssist, assistControls, newBotMemory } from '../../game/turbo/bot';
import { TurboEngine, type FastSnapshot } from './engine';
import { ASSIST, type AssistState } from './contract';
import { createTurboScene } from './render';
import { TurboInput } from './input/manager';
import { TouchControls, useLandscape } from './input/touch';
import { isCoarsePointer, type TurboPrefs } from './input/prefs';
import { TopBar } from './hud/TopBar';
import { BoostMeter } from './hud/BoostMeter';
import { Countdown } from './hud/Countdown';
import { GoalBanner } from './hud/GoalBanner';
import { Feed, useFeed } from './hud/Feed';
import { Scoreboard } from './hud/Scoreboard';
import { EndScreen } from './hud/EndScreen';
import { SettingsPanel } from './hud/SettingsPanel';
import { phaseSecondsLeft, playerLines, type GoalEvent, type PlayerLine, type Team } from './hud/format';

export default function TurboView(props: ModeProps) {
  const v = props.state.mg as unknown as TurboRoomView;
  if (v.stage === 'END') return <TurboEnd {...props} v={v} />;
  return <TurboGame {...props} v={v} />;
}

// nomi da scrivere: giocatori veri dalla stanza, bot dal server
function useNames(v: TurboRoomView, players: ModeProps['state']['players']) {
  return useMemo(() => {
    const n: Record<string, string> = { ...v.names };
    for (const p of players) n[p.id] = p.name;
    return n;
  }, [v.names, players]);
}

// ---------------------------------------------------------------- fine partita
function TurboEnd({ state, v, canLead, onNewGame, onBackToLobby }: ModeProps & { v: TurboRoomView }) {
  const names = useNames(v, state.players);
  const lines: PlayerLine[] = Object.keys(v.teams)
    .map((id) => {
      const s = v.stats?.[id];
      return {
        id,
        name: names[id] || 'Bot',
        team: v.teams[id],
        bot: v.bots.includes(id),
        goals: s?.goals ?? 0,
        assists: s?.assists ?? 0,
        saves: s?.saves ?? 0,
        shots: s?.shots ?? 0,
        demos: s?.demos ?? 0,
        points: s?.points ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.goals - a.goals);
  return (
    <EndScreen
      score={v.score}
      players={lines}
      myId={state.myId}
      myTeam={v.teams[state.myId]}
      winner={v.winner ?? undefined}
      canLead={canLead}
      hostName={state.players.find((p) => p.id === state.hostId)?.name}
      onNewGame={onNewGame}
      onChangeGame={onBackToLobby}
    />
  );
}

// ---------------------------------------------------------------- la partita
interface Hud {
  phase: Phase;
  secs: number; // secondi alla fine della fase (conto alla rovescia)
  clock: number;
  overtime: boolean;
  score: [number, number];
  boost: number;
  supersonic: boolean;
  airborne: boolean;
  respawn: number; // secondi al rientro dopo una demolizione (0 = in campo)
  ready: boolean; // arrivato lo stato del campo
}
const HUD0: Hud = { phase: 'countdown', secs: 3, clock: 300, overtime: false, score: [0, 0], boost: 33, supersonic: false, airborne: false, respawn: 0, ready: false };
const sameHud = (a: Hud, b: Hud) =>
  a.phase === b.phase &&
  a.secs === b.secs &&
  a.clock === b.clock &&
  a.overtime === b.overtime &&
  a.score[0] === b.score[0] &&
  a.score[1] === b.score[1] &&
  a.boost === b.boost &&
  a.supersonic === b.supersonic &&
  a.airborne === b.airborne &&
  a.respawn === b.respawn &&
  a.ready === b.ready;

function TurboGame({ state, v, canLead, realtime, onLeave, onForce }: ModeProps & { v: TurboRoomView }) {
  const myId = state.myId;
  const myTeam = v.teams[myId] as Team | undefined;
  const playing = myTeam !== undefined;
  useGameFullscreen(true);
  const landscape = useLandscape();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const input = useMemo(() => new TurboInput(), []);
  const [prefs, setPrefs] = useState<TurboPrefs>(() => input.prefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const rt = useRef(realtime);
  rt.current = realtime;
  const engine = useMemo(() => new TurboEngine(myId, (p) => rt.current?.fastSend(p)), [myId]);
  const names = useNames(v, state.players);
  const namesRef = useRef(names);
  namesRef.current = names;

  const [hud, setHud] = useState<Hud>(HUD0);
  const [device, setDevice] = useState(input.device);
  const [ballCam, setBallCam] = useState(input.ballCam);
  const [menu, setMenu] = useState(false);
  input.paused = menu;
  const [boardOpen, setBoardOpen] = useState(false); // tabellone aperto col pulsante in alto (telefono)
  const [boardHeld, setBoardHeld] = useState(false); // tabellone tenuto (Tab / BACK)
  const [goal, setGoal] = useState<GoalEvent | null>(null);
  const [assist, setAssist] = useState<AssistState>({ active: false, endsAt: 0, readyAt: 0 });
  const assistRef = useRef(assist);
  const feed = useFeed();
  const feedPush = useRef(feed.push);
  feedPush.current = feed.push;
  const [lines, setLines] = useState<PlayerLine[]>([]);
  const showBoard = boardOpen || boardHeld;
  const showBoardRef = useRef(showBoard);
  showBoardRef.current = showBoard;

  // stato del campo dal server
  useEffect(() => {
    if (!realtime) return;
    const fastIn = realtime.fastIn;
    fastIn.current = (p: FastSnapshot) => engine.onSnapshot(p);
    return () => {
      fastIn.current = null;
    };
  }, [realtime, engine]);

  // comandi: tasti sulla finestra, clic del mouse solo sulla schermata del gioco
  useEffect(() => {
    input.attach(wrapRef.current ?? window);
    const off = input.subscribe(() => {
      setDevice(input.device);
      setBallCam(input.ballCam);
    });
    return () => {
      off();
      input.detach();
    };
  }, [input]);

  // sul telefono si gioca in orizzontale (dove si può: Android a tutto schermo)
  useEffect(() => {
    if (!isCoarsePointer()) return;
    const lock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (document.fullscreenElement && o?.lock) o.lock('landscape').catch(() => {});
    };
    document.addEventListener('fullscreenchange', lock);
    return () => document.removeEventListener('fullscreenchange', lock);
  }, []);

  // il giro principale: comandi → previsione → disegno → scritte
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const scene = createTurboScene(canvas, { lowPower: isCoarsePointer() });
    let quality = prefsRef.current.quality;
    scene.setQuality(quality);
    const fit = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    let assistMem = newBotMemory();
    let frameControls: Controls = noControls();
    const sample = (w: World, car: Car): Controls => {
      if (assistRef.current.active) return assistControls(w, car, assistMem);
      if (prefsRef.current.phone.autoAirOrient && !car.onGround) return airAssist(w, car, frameControls);
      return frameControls;
    };
    const setA = (a: AssistState) => {
      assistRef.current = a;
      setAssist(a);
      return a;
    };

    let raf = 0;
    let last = performance.now();
    const t0 = last;
    let lastHud = 0;
    let lastLines = 0;
    let held = false;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // l'orientamento in aria lo fa airAssist a ogni passo (più furbo: guarda anche la palla), non il centralino
      const f = input.poll(null);
      frameControls = f.controls;

      // ASSISTITO: 5 s di bot, poi 4 s di ricarica (ripremendo si riprende subito la guida)
      const wall = Date.now();
      let a = assistRef.current;
      if (a.active && wall >= a.endsAt) a = setA({ ...a, active: false });
      if (f.pressed.assist && playing) {
        if (a.active) a = setA({ active: false, endsAt: wall, readyAt: wall + ASSIST.cooldown * 1000 });
        else if (wall >= a.readyAt) {
          assistMem = newBotMemory();
          a = setA({ active: true, endsAt: wall + ASSIST.duration * 1000, readyAt: wall + (ASSIST.duration + ASSIST.cooldown) * 1000 });
        }
      }
      if (f.pressed.menu) setMenu((m) => !m);
      if (f.held.scoreboard !== held) {
        held = f.held.scoreboard;
        setBoardHeld(held);
      }
      if (prefsRef.current.quality !== quality) {
        quality = prefsRef.current.quality;
        scene.setQuality(quality);
      }

      engine.frame(now, sample);
      engine.decayOffsets(dt);
      const events = engine.takeEvents();
      const w = engine.world;
      const cam = { ...prefsRef.current.cam, ballCam: f.ballCam };
      const look = f.held.lookBack ? { x: 1, y: 0 } : f.look;
      scene.render({ world: w, myId, t: (now - t0) / 1000, dt, cam, look, offsets: engine.offsets, events, names: namesRef.current, quality });

      if (events.length) {
        feedPush.current(events, w, namesRef.current, myId);
        for (const e of events) if (e.k === 'goal') setGoal(e);
      }
      if (now - lastHud > 66 || events.length) {
        lastHud = now;
        const car = w.car(myId);
        const next: Hud = {
          phase: w.phase,
          secs: Math.round(phaseSecondsLeft(w) * 10) / 10,
          clock: Math.round(w.clock * 10) / 10,
          overtime: w.overtime,
          score: [engine.score[0], engine.score[1]],
          boost: car ? Math.round(car.boost) : 0,
          supersonic: !!car?.isSupersonic,
          airborne: !!car && !car.onGround,
          respawn: car?.demoed ? Math.ceil(car.respawnTimer) : 0,
          ready: engine.ready || w.tick > 0,
        };
        setHud((prev) => (sameHud(prev, next) ? prev : next));
      }
      if (showBoardRef.current && now - lastLines > 500) {
        lastLines = now;
        setLines(playerLines(w, namesRef.current, engine.stats));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.dispose();
    };
  }, [engine, input, myId, playing]);

  // tabellone appena aperto: subito aggiornato
  useEffect(() => {
    if (showBoard) setLines(playerLines(engine.world, namesRef.current, engine.stats));
  }, [showBoard, engine]);

  // la scritta del gol resta finché dura la festa
  useEffect(() => {
    if (hud.phase !== 'goal' && goal) {
      const t = setTimeout(() => setGoal(null), 400);
      return () => clearTimeout(t);
    }
  }, [hud.phase, goal]);

  const touch = device === 'tocco';

  return createPortal(
    <div
      ref={wrapRef}
      className="fixed inset-0 z-[45] select-none overflow-hidden bg-[#0b0623] [-webkit-touch-callout:none] touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <TopBar
        score={hud.score}
        clock={hud.clock}
        overtime={hud.overtime}
        myTeam={myTeam}
        onMenu={() => setMenu(true)}
        onScoreboard={() => setBoardOpen((b) => !b)}
        scoreboardOpen={showBoard}
      />
      <Feed items={feed.items} />
      <Countdown phase={hud.phase} secondsLeft={hud.secs} overtime={hud.overtime} />
      <GoalBanner goal={goal} names={names} myTeam={myTeam} />

      {!hud.ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="sc-chip px-4 py-2 font-display text-2xl text-white">Si entra in campo…</span>
        </div>
      )}
      {hud.respawn > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] grid place-items-center">
          <span className="sc-chip px-4 py-2 font-display text-2xl text-white">DEMOLITO! Rientri tra {hud.respawn}</span>
        </div>
      )}
      {assist.active && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+64px)] grid place-items-center">
          <span className="sc-chip animate-pulse px-3 py-1 font-display text-lg text-cyan-200">ASSISTITO</span>
        </div>
      )}
      {touch && !landscape && playing && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+64px)] grid place-items-center">
          <span className="sc-chip px-3 py-1 text-sm font-black text-white/90">Gira il telefono: si gioca meglio in orizzontale</span>
        </div>
      )}

      {playing && <BoostMeter boost={hud.boost} touch={touch} supersonic={hud.supersonic} />}
      {playing && touch && (
        <TouchControls state={input.touch} prefs={prefs.phone} assist={assist} ballCam={ballCam} boost={hud.boost} airborne={hud.airborne} disabled={menu} />
      )}

      {showBoard && <Scoreboard players={lines} score={hud.score} myId={myId} clock={hud.clock} overtime={hud.overtime} />}

      {menu && (
        <div className="absolute inset-0 z-50" data-turbo-ui>
          <SettingsPanel
            prefs={prefs}
            onChange={setPrefs}
            input={input}
            onClose={() => setMenu(false)}
            onLeave={onLeave}
            onEndMatch={
              canLead
                ? () => {
                    setMenu(false);
                    onForce();
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
