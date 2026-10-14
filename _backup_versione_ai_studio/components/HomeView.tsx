import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Smartphone, Sparkles, AlertCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

const AVATAR_OPTIONS = [
  '🕵️‍♂️', '🕵️‍♀️', '🕶️', '🎩', '💼', '🍸',
  '🔍', '📻', '🎯', '🚁', '⚡', '🗝️'
];

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6'  // Teal
];

interface HomeViewProps {
  onCreateRoom: (name: string, avatar: string, color: string) => void;
  onJoinRoom: (roomCode: string, name: string, avatar: string, color: string) => void;
  onStartPassAndPlay: () => void;
  initialRoomCode?: string;
  errorMessage?: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  onStartPassAndPlay,
  initialRoomCode = '',
  errorMessage
}) => {
  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>(initialRoomCode ? 'JOIN' : 'CREATE');
  const [name, setName] = useState(() => {
    return localStorage.getItem('spyfall_last_player_name') || '';
  });
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.toUpperCase());
      setActiveTab('JOIN');
    }
  }, [initialRoomCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Inserisci il tuo nome in codice prima di procedere.');
      return;
    }

    try {
      localStorage.setItem('spyfall_last_player_name', trimmedName);
    } catch {
      // ignore storage errors
    }

    if (activeTab === 'CREATE') {
      onCreateRoom(trimmedName, avatar, color);
    } else {
      const code = roomCode.trim().toUpperCase();
      if (!code || code.length < 3) {
        setValidationError('Inserisci un codice stanza valido (es. ALFA).');
        return;
      }
      onJoinRoom(code, trimmedName, avatar, color);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 animate-in fade-in">
      {/* Hero: logo in stile gioco mobile */}
      <div className="text-center mb-7">
        <div className="hero-badge mx-auto mb-5">
          <span className="text-6xl">🕵️‍♂️</span>
        </div>
        <h1 className="leading-none">
          <span className="block text-xl text-white/90 tracking-wide">IL GIOCO DELLA</span>
          <span className="hero-title block text-7xl">SPIA</span>
        </h1>
        <p className="text-sm text-slate-300 mt-3 max-w-xs mx-auto font-semibold">
          Scopri l&apos;infiltrato o inganna tutti i tuoi amici. Gioca in tempo reale su qualsiasi dispositivo!
        </p>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-900/90 border border-slate-800 rounded-xl mb-6 shadow-sm">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setActiveTab('CREATE');
          }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'CREATE'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Crea Stanza</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setActiveTab('JOIN');
          }}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'JOIN'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Entra con Codice</span>
        </button>
      </div>

      {/* Error message notification */}
      {(errorMessage || validationError) && (
        <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage || validationError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        {/* Name input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Il Tuo Nome / Nome in Codice
          </label>
          <input
            type="text"
            required
            maxLength={18}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Luca, Agente 007..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all font-medium"
          />
        </div>

        {/* Room code input (only for JOIN) */}
        {activeTab === 'JOIN' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Codice Stanza (4 Lettere)
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="es. ALFA"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl text-lg font-mono font-bold tracking-widest text-amber-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all uppercase text-center"
            />
          </div>
        )}

        {/* Avatar Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Scegli il Tuo Avatar
          </label>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_OPTIONS.map((av) => (
              <button
                key={av}
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setAvatar(av);
                }}
                className={`h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                  avatar === av
                    ? 'bg-amber-500/20 border-2 border-amber-400 scale-105 shadow-inner'
                    : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {/* Color Accent Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Colore Badge
          </label>
          <div className="flex items-center justify-between gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setColor(c);
                }}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          {activeTab === 'CREATE' ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Crea Stanza & Ottieni Codice</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Entra nella Partita</span>
            </>
          )}
        </button>
      </form>

      {/* Bonus Offline Pass & Play option */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400 mb-2.5">Siete insieme e avete un solo smartphone?</p>
        <button
          type="button"
          onClick={onStartPassAndPlay}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all active:scale-95"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Modalità &quot;Passa il Telefono&quot; (Locale)</span>
        </button>
      </div>
    </div>
  );
};
