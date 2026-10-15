import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import AlbumView from './components/AlbumView';
import ArtistaView from './components/ArtistaView';
import AstroView from './components/AstroView';
import BattuteView from './components/BattuteView';
import BombaView from './components/BombaView';
import ChiSonoView from './components/ChiSonoView';
import DisegnaView from './components/DisegnaView';
import ConfirmSheet, { type ConfirmRequest } from './components/ConfirmSheet';
import GameView from './components/GameView';
import Header from './components/Header';
import HomeView from './components/HomeView';
import LobbyView from './components/LobbyView';
import { PassAndPlayView } from './components/PassAndPlayView';
import PreferirestiView from './components/PreferirestiView';
import RoundOverView from './components/RoundOverView';
import RulesModal from './components/RulesModal';
import SintoniaView from './components/SintoniaView';
import StartSplash from './components/StartSplash';
import TabuView from './components/TabuView';
import TelefonoView from './components/TelefonoView';
import { FLAT_VIEWS } from './components/flat';
import { Art, type ModeProps } from './components/ui';
import { clearSession, loadSession, useGameSocket } from './hooks/useGameSocket';
import type { GameId } from './types/game';
import { soundManager } from './utils/audio';

// Link d'invito (?room=1234): se ero rimasto in un'altra stanza, vale il nuovo invito
const URL_ROOM = (new URLSearchParams(window.location.search).get('room') || '').replace(/\D/g, '');
if (URL_ROOM && loadSession()?.roomCode !== URL_ROOM) clearSession();

// Il gioco 3D si scarica solo quando serve (Three.js è pesante)
const PartyView = lazy(() => import('./components/PartyView'));
const HorrorView = lazy(() => import('./components/HorrorView'));
const TurboView = lazy(() => import('./components/turbo/TurboView'));

// Schermate dei giochi "a moduli"
const MODE_VIEWS: Partial<Record<GameId, ComponentType<ModeProps>>> = {
  BOMBA: BombaView,
  DISEGNA: DisegnaView,
  ARTISTA: ArtistaView,
  BATTUTE: BattuteView,
  PREFERIRESTI: PreferirestiView,
  SINTONIA: SintoniaView,
  TABU: TabuView,
  CHISONO: ChiSonoView,
  ASTRO: AstroView,
  PARTY3D: PartyView as unknown as ComponentType<ModeProps>,
  HORROR1: HorrorView as unknown as ComponentType<ModeProps>,
  TURBO: TurboView as unknown as ComponentType<ModeProps>,
  ...FLAT_VIEWS, // giochi flat a moduli
};

// Scintille dello sfondo: posizioni fisse, così non saltano a ogni aggiornamento
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 5) % 100}%`,
  size: 3 + (i % 3) * 2,
  duration: 12 + ((i * 7) % 12),
  delay: -((i * 5) % 22),
  dx: `${((i % 5) - 2) * 22}px`,
}));

function Backdrop() {
  return (
    <div className="fx" aria-hidden="true">
      <div className="fx-orb o1" />
      <div className="fx-orb o2" />
      <div className="fx-orb o3" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="fx-spark"
          style={{ left: s.left, width: s.size, height: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`, '--dx': s.dx } as CSSProperties}
        />
      ))}
    </div>
  );
}

export default function App() {
  const game = useGameSocket();
  const state = game.gameState;
  const [mode, setMode] = useState<'ONLINE' | 'LOCAL'>('ONLINE');
  const [inviteCode, setInviteCode] = useState(URL_ROOM);
  const [showRules, setShowRules] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [splash, setSplash] = useState<{ game: GameId; round: number } | null>(null);
  const roundRef = useRef<string | null>(null);
  const online = mode === 'ONLINE';
  const host = state?.players.find((p) => p.id === state.hostId);
  const canLead = !!state && (state.myId === state.hostId || !host?.isOnline);

  // La barra degli indirizzi mostra sempre il link della stanza (per ricaricare o condividere)
  useEffect(() => {
    const code = state?.roomCode || inviteCode;
    window.history.replaceState(null, '', code ? `?room=${code}` : window.location.pathname);
  }, [state?.roomCode, inviteCode]);

  // Nuova partita: schermata lampo e suono di partenza, uguali per tutti (anche per la spia)
  useEffect(() => {
    if (!state) {
      roundRef.current = null;
      return;
    }
    const key = `${state.roomCode}:${state.currentRound}`;
    if (state.phase === 'PLAYING' && roundRef.current !== null && roundRef.current !== key) {
      setSplash({ game: state.settings.game, round: state.currentRound });
      soundManager.playStart();
    }
    roundRef.current = key;
  }, [state?.roomCode, state?.currentRound, state?.phase]);
  const closeSplash = useCallback(() => setSplash(null), []);

  const leave = () =>
    setConfirm({
      title: 'Uscire dalla stanza?',
      text: 'Potrai rientrare dalla lista delle stanze aperte (o con il link).',
      confirmLabel: 'Esci',
      danger: true,
      onConfirm: () => {
        game.leaveRoom();
        setInviteCode('');
      },
    });

  const home = () =>
    setConfirm({
      title: 'Tornare alla stanza?',
      text: 'Il gioco in corso si interrompe per tutti, senza svelare niente. Tornate alla stanza con tutti i partecipanti e potete scegliere un altro gioco.',
      confirmLabel: 'Torna',
      onConfirm: game.backToLobby,
    });

  const forceEnd = () =>
    setConfirm({
      title: 'Fine forzata?',
      text: 'Il round si chiude subito e si svela tutto, anche se qualcuno non ha confermato.',
      confirmLabel: 'Svela ora',
      danger: true,
      onConfirm: game.forceEnd,
    });

  const forceNext = () =>
    setConfirm({
      title: 'Continuare senza aspettare?',
      text: 'Chi non ha ancora finito salta questo turno.',
      confirmLabel: 'Continua',
      danger: true,
      onConfirm: game.telForceNext,
    });

  const kick = (playerId: string, name: string) =>
    setConfirm({
      title: `Rimuovere ${name}?`,
      text: 'Uscirà dalla stanza. Potrà rientrare se la stanza è aperta o con il link.',
      confirmLabel: 'Rimuovi',
      danger: true,
      onConfirm: () => game.kickPlayer(playerId),
    });

  let view: ReactNode;
  let screen: string;
  if (!online) {
    screen = 'local';
    view = <PassAndPlayView onBackToOnline={() => setMode('ONLINE')} />;
  } else if (!state) {
    screen = game.restoring ? 'restore' : 'home';
    view = game.restoring ? (
      <div className="flex flex-col items-center gap-5 pt-24 text-center">
        <div className="hero-badge">
          <span className="hero-ring" />
          <div className="grid h-full w-full place-items-center overflow-hidden rounded-full">
            <Art src="/art/logo.webp" fallback={<span className="text-[44px]">🎮</span>} className="h-full w-full object-cover" />
          </div>
        </div>
        <p className="text-2xl font-black text-white">Rientro nella stanza…</p>
        <button type="button" onClick={game.cancelRestore} className="text-sm font-bold text-slate-300 underline">
          Annulla
        </button>
      </div>
    ) : (
      <HomeView
        inviteCode={inviteCode}
        connected={game.connected}
        rooms={game.rooms}
        onCreateRoom={game.createRoom}
        onJoinRoom={game.joinRoom}
        onRules={() => setShowRules(true)}
        onPassAndPlay={() => setMode('LOCAL')}
      />
    );
  } else if (state.phase === 'LOBBY') {
    screen = 'lobby';
    view = <LobbyView state={state} onUpdateSettings={game.updateSettings} onStart={game.startGame} onKick={kick} />;
  } else {
    screen = `${state.phase}-${state.currentRound}`;
    const Mode = state.mg ? MODE_VIEWS[state.settings.game] : undefined;
    if (Mode) {
      // Giochi a moduli: tutti tranne Spia, Impostore e Telefono
      const artista = state.settings.game === 'ARTISTA';
      view = (
        <Suspense fallback={<p className="py-20 text-center font-display text-2xl text-white">{state.settings.game === 'PARTY3D' || state.settings.game === 'HORROR1' || state.settings.game === 'TURBO' ? 'Carico il mondo 3D… 🎉' : 'Carico il gioco… 🎲'}</p>}>
        <Mode
          key={state.currentRound}
          state={state}
          board={game.board}
          boardVersion={game.boardVersion}
          clockOffset={game.clockOffset}
          canLead={canLead}
          onAction={game.mgAction}
          onDraw={game.drawOp}
          realtime={game.realtime}
          onLeave={leave}
          onNewGame={game.startGame}
          onBackToLobby={game.backToLobby}
          onForce={() =>
            setConfirm(
              artista
                ? {
                    title: 'Svelare subito?',
                    text: "Si scopre chi era l'impostore anche se qualcuno non ha ancora confermato.",
                    confirmLabel: 'Svela ora',
                    danger: true,
                    onConfirm: () => game.mgAction('MG_FORCE'),
                  }
                : state.settings.game === 'TURBO'
                  ? {
                      title: 'Terminare la partita?',
                      text: 'La partita finisce subito col punteggio di adesso.',
                      confirmLabel: 'Termina',
                      danger: true,
                      onConfirm: () => game.mgAction('MG_FORCE'),
                    }
                  : state.settings.game === 'CHISONO'
                  ? {
                      title: 'Finire la partita?',
                      text: 'Si svelano tutti i personaggi e si va alla classifica.',
                      confirmLabel: 'Fine',
                      danger: true,
                      onConfirm: () => game.mgAction('MG_FORCE'),
                    }
                  : {
                      title: 'Andare avanti?',
                      text: 'Si passa subito alla fase successiva, senza aspettare chi non ha ancora finito.',
                      confirmLabel: 'Avanti',
                      danger: true,
                      onConfirm: () => game.mgAction('MG_FORCE'),
                    },
            )
          }
        />
        </Suspense>
      );
    } else if (state.phase === 'PLAYING') {
      view = state.tel ? (
        <TelefonoView
          key={`${state.currentRound}-${state.tel.step}`}
          state={state}
          clockOffset={game.clockOffset}
          onSubmit={game.telSubmit}
          onForceNext={forceNext}
        />
      ) : (
        <GameView key={state.currentRound} state={state} clockOffset={game.clockOffset} onToggleConfirm={game.toggleConfirm} onForceEnd={forceEnd} />
      );
    } else {
      view = state.tel ? (
        <AlbumView key={state.currentRound} state={state} onNext={game.telRevealNext} onNewGame={game.startGame} onBackToLobby={game.backToLobby} />
      ) : (
        <RoundOverView key={state.currentRound} state={state} onNextRound={game.startGame} onBackToLobby={game.backToLobby} />
      );
    }
  }

  // Ogni schermata nuova parte dall'alto
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <Header
        roomCode={online ? state?.roomCode : undefined}
        game={online ? state?.settings.game : undefined}
        connected={game.connected}
        onRules={() => setShowRules(true)}
        onLeave={online && state ? leave : undefined}
        onHome={online && state && state.phase !== 'LOBBY' && canLead ? home : undefined}
      />
      <main className={`relative z-[1] mx-auto w-full max-w-md flex-1 px-4 pt-4 ${online && state ? 'pb-44' : 'pb-10'}`}>
        {/* Cambio schermata: quella vecchia scivola via, la nuova entra con un rimbalzo */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            {view}
          </motion.div>
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {game.errorMessage && (
          <motion.div
            key={game.errorMessage}
            role="alert"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="fixed inset-x-4 top-16 z-50 mx-auto max-w-sm rounded-2xl bg-red-500 px-4 py-3 text-center font-bold text-white shadow-[0_6px_0_rgba(22,6,72,0.45),0_16px_40px_rgba(0,0,0,0.35)]"
          >
            {game.errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
      {splash && <StartSplash game={splash.game} round={splash.round} onDone={closeSplash} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {confirm && <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
