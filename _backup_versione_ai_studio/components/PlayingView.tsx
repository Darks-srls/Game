import React, { useState } from 'react';
import { ClientGameState, LocationItem, ChatMessage } from '../types/game';
import {
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Flame,
  Search,
  MessageSquare,
  Send,
  HelpCircle,
  Check,
  X
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface PlayingViewProps {
  gameState: ClientGameState;
  chatMessages: ChatMessage[];
  onCallAccusation: (accusedId: string) => void;
  onDeclareSpy: () => void;
  onSendReaction: (emoji: string) => void;
  onSendChatMessage: (text: string) => void;
}

const EMOJI_REACTIONS = ['🤔', '🤥', '🤫', '🕵️', '😱', '🎯', '⏱️'];

export const PlayingView: React.FC<PlayingViewProps> = ({
  gameState,
  chatMessages,
  onCallAccusation,
  onDeclareSpy,
  onSendReaction,
  onSendChatMessage
}) => {
  const [peekRole, setPeekRole] = useState(false);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [selectedAccusedId, setSelectedAccusedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');

  // Local scratchpad for ruled-out locations
  const [crossedOutLocations, setCrossedOutLocations] = useState<Set<string>>(() => new Set());
  const [favoriteLocations, setFavoriteLocations] = useState<Set<string>>(() => new Set());

  const startingPlayer = gameState.players.find(p => p.id === gameState.startingPlayerId);
  const isSpy = gameState.isSpy;
  const isTimeCritical = gameState.timeRemaining <= 60;

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleCrossLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playClick();
    setCrossedOutLocations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // remove from favorites if crossed
        setFavoriteLocations(f => {
          const nf = new Set(f);
          nf.delete(id);
          return nf;
        });
      }
      return next;
    });
  };

  const toggleFavoriteLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playClick();
    setFavoriteLocations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // remove from crossed
        setCrossedOutLocations(c => {
          const nc = new Set(c);
          nc.delete(id);
          return nc;
        });
      }
      return next;
    });
  };

  const handleAccuseSubmit = () => {
    if (!selectedAccusedId) return;
    onCallAccusation(selectedAccusedId);
    setShowAccuseModal(false);
    setSelectedAccusedId(null);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChatMessage(chatText.trim());
    setChatText('');
  };

  // Filter locations
  const filteredLocations = gameState.availableLocations.filter(loc => {
    const matchesCategory = categoryFilter === 'ALL' || loc.category === categoryFilter;
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          loc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4 animate-in fade-in">
      {/* Top HUD: Countdown Timer + Role Peek + Action Buttons */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md sticky top-16 z-30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Clock */}
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center ${
                isTimeCritical
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-amber-400'
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block -mb-1">
                Tempo Rimasto
              </span>
              <span
                className={`text-2xl sm:text-3xl font-black font-mono tracking-wider ${
                  isTimeCritical ? 'text-red-400' : 'text-white'
                }`}
              >
                {formatTime(gameState.timeRemaining)}
              </span>
            </div>
          </div>

          {/* Role peek / reminder toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              setPeekRole(!peekRole);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
              peekRole
                ? isSpy
                  ? 'bg-red-950/60 border-red-600 text-red-300'
                  : 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            {peekRole ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-400" />}
            <span>{peekRole ? 'Nascondi Ruolo' : 'Vedi il Mio Ruolo'}</span>
          </button>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2">
            {/* Spy Declare Button (if spy) */}
            {isSpy && (
              <button
                onClick={() => {
                  if (confirm('Sei sicuro di volerti dichiarare come Spia per indovinare il luogo adesso?')) {
                    onDeclareSpy();
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 animate-pulse cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Sono la Spia!</span>
              </button>
            )}

            {/* Call Accusation button */}
            <button
              onClick={() => {
                soundManager.playClick();
                setShowAccuseModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Accusa Qualcuno!</span>
            </button>
          </div>
        </div>

        {/* Peek Role Drawer when open */}
        {peekRole && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in ${
              isSpy
                ? 'bg-red-950/40 border-red-800 text-red-200'
                : 'bg-cyan-950/30 border-cyan-800/80 text-cyan-200'
            }`}
          >
            {isSpy ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">🕵️‍♂️</span>
                <div>
                  <strong className="text-red-400 uppercase tracking-wider block font-bold">
                    SEI LA SPIA!
                  </strong>
                  <span className="text-[11px] text-slate-300">
                    Non conosci il luogo. Ascolta le domande e usa la griglia sottostante per indovinarlo!
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl">{gameState.location?.icon}</span>
                <div>
                  <span className="text-[10px] uppercase font-mono text-cyan-400 block">
                    Luogo Segreto:
                  </span>
                  <strong className="text-sm font-bold text-white">
                    {gameState.location?.name}
                  </strong>
                  {gameState.myRole && (
                    <span className="ml-2 text-amber-300 font-mono text-xs">
                      (Ruolo: {gameState.myRole})
                    </span>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => setPeekRole(false)}
              className="text-[11px] underline text-slate-400 hover:text-white"
            >
              Chiudi
            </button>
          </div>
        )}

        {/* Starting Interrogator Alert */}
        {startingPlayer && (
          <div className="flex items-center justify-between text-xs text-slate-300 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">Domanda Iniziale:</span>
              <span>
                <strong className="text-white">{startingPlayer.name}</strong> pone la prima domanda a un altro giocatore a voce!
              </span>
            </div>
            <div className="flex items-center gap-1">
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSendReaction(emoji)}
                  className="hover:scale-125 transition-transform p-1 text-sm cursor-pointer"
                  title="Invia reazione"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Section: Location Explorer / Scratchpad */}
      <div className="space-y-3">
        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>Elenco Luoghi Possibili ({filteredLocations.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              (Clicca sui luoghi per escluderli o evidenziarli nel tuo taccuino)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca luogo..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Category filter dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">Tutte le Categorie</option>
              {Array.from(new Set(gameState.availableLocations.map(l => l.category))).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {filteredLocations.map((loc) => {
            const isCrossed = crossedOutLocations.has(loc.id);
            const isFav = favoriteLocations.has(loc.id);

            return (
              <div
                key={loc.id}
                onClick={(e) => toggleCrossLocation(loc.id, e)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none relative flex flex-col justify-between min-h-[90px] ${
                  isCrossed
                    ? 'bg-slate-950/40 border-slate-900 opacity-40 grayscale line-through'
                    : isFav
                    ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top icon and favorite pin */}
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{loc.icon}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={isFav ? 'Rimuovi dai sospetti' : 'Segna come sospetto'}
                      onClick={(e) => toggleFavoriteLocation(loc.id, e)}
                      className={`p-1 rounded-md transition-colors ${
                        isFav ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      title={isCrossed ? 'Ripristina' : 'Escludi luogo'}
                      onClick={(e) => toggleCrossLocation(loc.id, e)}
                      className="p-1 rounded-md text-slate-600 hover:text-slate-400"
                    >
                      {isCrossed ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Name & category */}
                <div className="mt-2">
                  <h4 className="font-bold text-xs text-white leading-tight truncate">
                    {loc.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                    {loc.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Chat / Activity Toggle Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="relative p-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-2xl transition-transform active:scale-95 flex items-center justify-center"
          title="Apri Chat e Registro Missione"
        >
          <MessageSquare className="w-5 h-5 fill-current" />
          {chatMessages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-slate-950">
              {chatMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* Slide-over Chat and Mission Logs */}
      {chatOpen && (
        <div className="fixed bottom-18 right-4 w-80 max-w-[calc(100vw-2rem)] h-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Chat & Diario di Bordo
            </span>
            <button
              onClick={() => setChatOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages stream */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {gameState.logs.slice(-10).map((log) => (
              <div
                key={log.id}
                className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 font-mono"
              >
                {log.text}
              </div>
            ))}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-xl text-xs ${
                  msg.senderId === gameState.myId
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 ml-4'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 mr-4'
                }`}
              >
                <div className="font-semibold text-[10px] text-slate-400 mb-0.5">
                  {msg.senderName}
                </div>
                <div>{msg.text}</div>
              </div>
            ))}
          </div>

          {/* Input field */}
          <form onSubmit={handleChatSubmit} className="p-2 bg-slate-950 border-t border-slate-800 flex gap-1.5">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Scrivi un messaggio o indizio..."
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Accusation Modal */}
      {showAccuseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Lancia un&apos;Accusa Ufficiale</span>
              </div>
              <button
                onClick={() => setShowAccuseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Chi ritieni sia la Spia? Seleziona un giocatore. Il gioco andrà in pausa e tutti voteranno!
            </p>

            {/* List of players to accuse */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {gameState.players
                .filter((p) => p.isOnline && p.id !== gameState.myId)
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedAccusedId(player.id)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      selectedAccusedId === player.id
                        ? 'bg-red-950/60 border-red-500 text-white shadow-md'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{player.avatar}</span>
                      <span className="font-bold text-xs">{player.name}</span>
                    </div>
                    {selectedAccusedId === player.id && (
                      <span className="text-[10px] font-mono text-red-400 font-bold uppercase">
                        Accusato
                      </span>
                    )}
                  </button>
                ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAccuseModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!selectedAccusedId}
                onClick={handleAccuseSubmit}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg ${
                  selectedAccusedId
                    ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Conferma Accusa!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
