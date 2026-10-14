import React, { useState, useEffect } from 'react';
import { DEFAULT_LOCATIONS } from '../data/locations';
import { LocationItem } from '../types/game';
import {
  Smartphone,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  Play,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface PassAndPlayViewProps {
  onBackToOnline: () => void;
}

interface LocalPlayer {
  id: string;
  name: string;
  role: string;
  isSpy: boolean;
}

export const PassAndPlayView: React.FC<PassAndPlayViewProps> = ({ onBackToOnline }) => {
  const [stage, setStage] = useState<'SETUP' | 'PASSING' | 'PLAYING' | 'REVEAL'>('SETUP');
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Giocatore 1',
    'Giocatore 2',
    'Giocatore 3',
    'Giocatore 4'
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [roundSeconds, setRoundSeconds] = useState(360); // 6 minutes
  const [timeLeft, setTimeLeft] = useState(360);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Game state
  const [location, setLocation] = useState<LocationItem | null>(null);
  const [assignedPlayers, setAssignedPlayers] = useState<LocalPlayer[]>([]);
  const [currentPassIndex, setCurrentPassIndex] = useState(0);
  const [isCardRevealed, setIsCardRevealed] = useState(false);
  const [startingPlayerName, setStartingPlayerName] = useState('');

  // Scratchpad
  const [crossedOut, setCrossedOut] = useState<Set<string>>(new Set());

  // Setup helpers
  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    setPlayerNames([...playerNames, newPlayerName.trim()]);
    setNewPlayerName('');
    soundManager.playClick();
  };

  const removePlayer = (index: number) => {
    if (playerNames.length <= 3) return;
    setPlayerNames(playerNames.filter((_, i) => i !== index));
    soundManager.playClick();
  };

  const startLocalGame = () => {
    soundManager.playClick();
    if (playerNames.length < 3) return;

    // Pick location
    const chosenLoc = DEFAULT_LOCATIONS[Math.floor(Math.random() * DEFAULT_LOCATIONS.length)];
    setLocation(chosenLoc);

    // Pick 1 spy
    const spyIndex = Math.floor(Math.random() * playerNames.length);
    const shuffledRoles = [...chosenLoc.roles].sort(() => 0.5 - Math.random());
    let roleIdx = 0;

    const assigned: LocalPlayer[] = playerNames.map((name, idx) => {
      const isSpy = idx === spyIndex;
      return {
        id: `local_${idx}`,
        name,
        isSpy,
        role: isSpy ? 'La Spia' : shuffledRoles[roleIdx++ % shuffledRoles.length]
      };
    });

    setAssignedPlayers(assigned);
    setCurrentPassIndex(0);
    setIsCardRevealed(false);
    setTimeLeft(roundSeconds);
    setIsTimerRunning(false);
    setCrossedOut(new Set());
    setStartingPlayerName(playerNames[Math.floor(Math.random() * playerNames.length)]);
    setStage('PASSING');
  };

  const handleNextPlayerPass = () => {
    soundManager.playClick();
    setIsCardRevealed(false);
    if (currentPassIndex + 1 < assignedPlayers.length) {
      setCurrentPassIndex(currentPassIndex + 1);
    } else {
      // All players saw their cards! Move to timer!
      setStage('PLAYING');
      setIsTimerRunning(true);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (stage !== 'PLAYING' || !isTimerRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          soundManager.playAlarm();
          return 0;
        }
        if (prev <= 10) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage, isTimerRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToOnline}
          className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>← Torna al Gioco Online</span>
        </button>

        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          Modalità Offline: Passa il Telefono
        </span>
      </div>

      {/* Stage: SETUP */}
      {stage === 'SETUP' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-2xl text-amber-400 mb-2">
              <Smartphone className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wide">
              Gioca con un solo Smartphone
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Perfetto quando siete fisicamente allo stesso tavolo. Aggiungi i nomi dei giocatori!
            </p>
          </div>

          {/* Player list editor */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
              Partecipanti ({playerNames.length})
            </label>

            <div className="space-y-2">
              {playerNames.map((name, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                >
                  <span className="font-bold text-slate-200">
                    {idx + 1}. {name}
                  </span>
                  {playerNames.length > 3 && (
                    <button
                      onClick={() => removePlayer(idx)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add player row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                placeholder="Aggiungi nome..."
                maxLength={18}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={addPlayer}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi</span>
              </button>
            </div>
          </div>

          {/* Timer select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
              Tempo di Interrogatorio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[180, 300, 360, 480, 600].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setRoundSeconds(sec)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    roundSeconds === sec
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {sec / 60} minuti
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startLocalGame}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Distribuisci le Carte Segrete</span>
          </button>
        </div>
      )}

      {/* Stage: PASSING THE PHONE */}
      {stage === 'PASSING' && assignedPlayers[currentPassIndex] && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
            Passo {currentPassIndex + 1} di {assignedPlayers.length}
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400">Passa il telefono a:</span>
            <h3 className="text-3xl font-black text-white uppercase tracking-wide">
              {assignedPlayers[currentPassIndex].name}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Solo <strong className="text-white">{assignedPlayers[currentPassIndex].name}</strong> deve guardare lo schermo ora!
            </p>
          </div>

          {/* Card Box */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 min-h-[220px] flex flex-col items-center justify-center space-y-4">
            {!isCardRevealed ? (
              <>
                <div className="text-4xl">🔒</div>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setIsCardRevealed(true);
                  }}
                  className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  <span>Tocca per vedere la tua identità</span>
                </button>
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                {assignedPlayers[currentPassIndex].isSpy ? (
                  <div className="space-y-2">
                    <span className="text-5xl">🕵️‍♂️</span>
                    <h4 className="text-2xl font-black text-red-500 uppercase">
                      SEI LA SPIA!
                    </h4>
                    <p className="text-xs text-red-300 max-w-xs">
                      Non conosci il luogo segreto! Ascolta le domande e cerca di indovinarlo senza farti beccare.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-5xl">{location?.icon}</span>
                    <h4 className="text-2xl font-black text-white">
                      {location?.name}
                    </h4>
                    <div className="text-xs font-mono text-amber-400 font-bold">
                      Ruolo: {assignedPlayers[currentPassIndex].role}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsCardRevealed(false)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center gap-1.5 mx-auto"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Copri di nuovo</span>
                </button>
              </div>
            )}
          </div>

          {/* Action to proceed */}
          <button
            type="button"
            onClick={handleNextPlayerPass}
            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
          >
            <span>
              {currentPassIndex + 1 < assignedPlayers.length
                ? `Fatto! Passa a ${assignedPlayers[currentPassIndex + 1].name}`
                : 'Tutti hanno visto! Avvia Timer Partita'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stage: PLAYING */}
      {stage === 'PLAYING' && (
        <div className="space-y-5">
          {/* Timer Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl space-y-3">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-400 block">
              Tempo di Interrogatorio
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-white tracking-widest">
              {formatTime(timeLeft)}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 max-w-sm mx-auto">
              <strong className="text-amber-400">{startingPlayerName}</strong> fa la prima domanda ad alta voce a chiunque!
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                {isTimerRunning ? 'Pausa Timer' : 'Riprendi'}
              </button>
              <button
                type="button"
                onClick={() => setStage('REVEAL')}
                className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold uppercase tracking-wider text-white"
              >
                Concludi Round & Svela Tutto
              </button>
            </div>
          </div>

          {/* Shared Locations Board */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tutti i Luoghi Possibili
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {DEFAULT_LOCATIONS.map((loc) => {
                const isCrossed = crossedOut.has(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      soundManager.playClick();
                      setCrossedOut(prev => {
                        const next = new Set(prev);
                        if (next.has(loc.id)) next.delete(loc.id);
                        else next.add(loc.id);
                        return next;
                      });
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all select-none ${
                      isCrossed
                        ? 'bg-slate-950/40 border-slate-900 opacity-40 line-through'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{loc.icon}</span>
                      {isCrossed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-slate-600" />}
                    </div>
                    <div className="mt-2 text-xs font-bold text-white truncate">
                      {loc.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stage: REVEAL */}
      {stage === 'REVEAL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-4xl mb-2">
            🎉
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Il Luogo Segreto Era:
            </span>
            <h3 className="text-3xl font-black text-white">
              {location?.icon} {location?.name}
            </h3>
          </div>

          {/* Who was the spy */}
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/80 space-y-1">
            <span className="text-xs font-mono text-red-400 font-bold uppercase tracking-widest">
              L&apos;Infiltrato Segreto:
            </span>
            <div className="text-2xl font-black text-white">
              🕵️‍♂️ {assignedPlayers.find(p => p.isSpy)?.name}
            </div>
          </div>

          {/* List of roles */}
          <div className="space-y-2 text-left">
            <span className="text-xs font-semibold uppercase text-slate-400">
              Ruoli dei partecipanti:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {assignedPlayers.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center"
                >
                  <span className="font-bold text-white">{p.name}</span>
                  <span className={p.isSpy ? 'text-red-400 font-bold' : 'text-slate-400'}>
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={startLocalGame}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Nuovo Round Locale</span>
            </button>
            <button
              type="button"
              onClick={onBackToOnline}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Torna Online
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
