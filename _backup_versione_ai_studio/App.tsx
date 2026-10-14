/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { LobbyView } from './components/LobbyView';
import { RevealView } from './components/RevealView';
import { PlayingView } from './components/PlayingView';
import { AccusationView } from './components/AccusationView';
import { SpyGuessView } from './components/SpyGuessView';
import { RoundOverView } from './components/RoundOverView';
import { PassAndPlayView } from './components/PassAndPlayView';
import { RulesModal } from './components/RulesModal';

export default function App() {
  const {
    connected,
    gameState,
    chatMessages,
    reactions,
    errorMessage,
    createRoom,
    joinRoom,
    toggleReady,
    updateSettings,
    startGame,
    startInterrogation,
    callAccusation,
    cancelAccusation,
    castVote,
    declareSpy,
    submitSpyGuess,
    nextRound,
    resetScores,
    sendReaction,
    sendChatMessage,
    leaveRoom
  } = useGameSocket();

  const [mode, setMode] = useState<'ONLINE' | 'LOCAL'>('ONLINE');
  const [showRules, setShowRules] = useState(false);
  const [urlRoomCode, setUrlRoomCode] = useState('');

  // Extract ?room=CODE from URL if present
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setUrlRoomCode(roomParam.trim().toUpperCase());
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* Top Header */}
      <Header
        roomCode={gameState?.roomCode}
        connected={connected}
        playerCount={gameState?.players?.filter((p) => p.isOnline)?.length}
        onOpenRules={() => setShowRules(true)}
        onLeaveRoom={gameState ? leaveRoom : undefined}
      />

      {/* Floating live reaction emojis container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-2xl animate-float-up pointer-events-none"
          >
            <span className="text-2xl animate-pulse">{r.emoji}</span>
            <span className="text-[11px] font-bold text-amber-400 font-mono">
              {r.playerName}
            </span>
          </div>
        ))}
      </div>

      {/* Main Content Router */}
      <main className="flex-1 flex flex-col justify-center py-4">
        {mode === 'LOCAL' ? (
          <PassAndPlayView onBackToOnline={() => setMode('ONLINE')} />
        ) : !gameState ? (
          <HomeView
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onStartPassAndPlay={() => setMode('LOCAL')}
            initialRoomCode={urlRoomCode}
            errorMessage={errorMessage}
          />
        ) : (
          <>
            {gameState.phase === 'LOBBY' && (
              <LobbyView
                gameState={gameState}
                onToggleReady={toggleReady}
                onUpdateSettings={updateSettings}
                onStartGame={startGame}
              />
            )}

            {gameState.phase === 'REVEAL' && (
              <RevealView
                gameState={gameState}
                onStartInterrogation={startInterrogation}
              />
            )}

            {gameState.phase === 'PLAYING' && (
              <PlayingView
                gameState={gameState}
                chatMessages={chatMessages}
                onCallAccusation={callAccusation}
                onDeclareSpy={declareSpy}
                onSendReaction={sendReaction}
                onSendChatMessage={sendChatMessage}
              />
            )}

            {gameState.phase === 'ACCUSATION' && (
              <AccusationView
                gameState={gameState}
                onCastVote={castVote}
                onCancelAccusation={cancelAccusation}
              />
            )}

            {gameState.phase === 'SPY_GUESS' && (
              <SpyGuessView
                gameState={gameState}
                onSubmitSpyGuess={submitSpyGuess}
              />
            )}

            {gameState.phase === 'ROUND_OVER' && (
              <RoundOverView
                gameState={gameState}
                onNextRound={nextRound}
                onResetScores={resetScores}
              />
            )}
          </>
        )}
      </main>

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Minimal Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>Spyfall Online (Il Gioco della Spia) · Gioca con amici su PC, tablet e smartphone</p>
      </footer>
    </div>
  );
}
