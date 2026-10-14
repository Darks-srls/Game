import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, ChevronRight, Smartphone, Sparkles } from 'lucide-react';
import type { GameId, RoomSummary } from '../types/game';
import { soundManager } from '../utils/audio';
import RoomList from './RoomList';
import { AVATARS, Art, Avatar, GAME_CATEGORIES, GAMES, NewBadge, type GameCategory } from './ui';

// Filtri dei giochi: tutti oppure una famiglia
const FILTERS: { id: 'all' | GameCategory; name: string; emoji: string }[] = [{ id: 'all', name: 'Tutti', emoji: '✨' }, ...GAME_CATEGORIES];

const COLORS = ['#ff3b6e', '#ffc20d', '#5dc928', '#12b5f5', '#9f6bff', '#ff8a1f', '#ff5fd2', '#1fd6b5'];

const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // memoria del browser non disponibile
  }
};

interface HomeViewProps {
  inviteCode: string;
  connected: boolean;
  rooms: RoomSummary[] | null;
  onCreateRoom: (name: string, avatar: string, color: string, game: GameId) => void;
  onJoinRoom: (roomCode: string, name: string, avatar: string, color: string) => void;
  onRules: () => void;
  onPassAndPlay: () => void;
}

// Home di Axend Games: profilo, stanze aperte in diretta e giochi per crearne una nuova
export default function HomeView({ inviteCode, connected, rooms, onCreateRoom, onJoinRoom, onRules, onPassAndPlay }: HomeViewProps) {
  const [name, setName] = useState(() => read('spyfall_last_player_name', ''));
  const [avatar, setAvatar] = useState(() => {
    const saved = read('spia_avatar', AVATARS[0].id);
    return AVATARS.some((a) => a.id === saved) ? saved : AVATARS[0].id;
  });
  const [color, setColor] = useState(() => read('spia_colore', COLORS[3]));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [filter, setFilter] = useState<'all' | GameCategory>('all');
  // In "Tutti" i giochi nuovi vanno in vetrina, in cima e larghi (uno o due, così la griglia resta pari)
  const featured = filter === 'all' ? GAMES.filter((g) => g.isNew) : [];
  const list = filter !== 'all' ? GAMES.filter((g) => g.cat === filter) : [...featured, ...GAMES.filter((g) => !featured.includes(g))];
  const wideCount = list.length % 2 === 1 ? 1 : filter === 'all' ? 2 : 0;
  const nameRef = useRef<HTMLInputElement>(null);
  // Android: "Installa l'app" (si apre a tutto schermo come un'app scaricata)
  const [installable, setInstallable] = useState(() => !!(window as unknown as { __installPrompt?: Event }).__installPrompt);
  useEffect(() => {
    const on = () => setInstallable(true);
    window.addEventListener('axend-installable', on);
    return () => window.removeEventListener('axend-installable', on);
  }, []);
  const install = async () => {
    const w = window as unknown as { __installPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } };
    const ev = w.__installPrompt;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice.catch(() => null);
    w.__installPrompt = undefined;
    setInstallable(false);
  };

  // Controlla il nome e ricorda le scelte per la prossima volta
  const checkName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Scrivi il tuo nome prima di entrare.');
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      setTimeout(() => setShaking(false), 450);
      soundManager.playError();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => nameRef.current?.focus(), 350);
      return null;
    }
    write('spyfall_last_player_name', trimmed);
    write('spia_avatar', avatar);
    write('spia_colore', color);
    setError('');
    setBusy(true);
    setTimeout(() => setBusy(false), 4000);
    return trimmed;
  };

  const create = (game: GameId) => {
    const player = checkName();
    if (player) onCreateRoom(player, avatar, color, game);
  };

  const join = (roomCode: string) => {
    if (roomCode.length < 4) {
      setError('Il codice della stanza ha 4 cifre.');
      return;
    }
    const player = checkName();
    if (player) onJoinRoom(roomCode, player, avatar, color);
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    join(code);
  };

  return (
    <div className="stagger flex flex-col gap-5">
      {/* Logo */}
      <div className="flex items-center justify-center gap-5 pt-1">
        <div className="hero-badge shrink-0">
          <span className="hero-ring" />
          <div className="grid h-full w-full place-items-center overflow-hidden rounded-full">
            <Art src="/art/logo.webp" fallback={<span className="text-[44px]">🎮</span>} className="h-full w-full object-cover" />
          </div>
        </div>
        <h1 className="text-left leading-none">
          <span className="hero-title text-[52px]">
            {'AXEND'.split('').map((ch, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          <span className="hero-sub block text-[34px] tracking-[0.18em]">GAMES</span>
        </h1>
      </div>

      {installable && (
        <button type="button" onClick={() => void install()} className="flex items-center gap-3 rounded-2xl border-2 border-white/15 bg-white/10 px-4 py-3 text-left">
          <Smartphone className="h-7 w-7 shrink-0 text-amber-300" />
          <span className="flex-1">
            <span className="block font-black text-white">Installa l’app</span>
            <span className="block text-xs font-semibold text-white/70">Axend si apre a tutto schermo, come un’app scaricata</span>
          </span>
          <ChevronRight className="h-5 w-5 text-white/60" />
        </button>
      )}

      {/* Profilo */}
      <section className={`flex flex-col gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-4 ${shaking ? 'animate-shake' : ''}`}>
        <div className="flex items-center gap-3">
          <span key={avatar + color} className="pop shrink-0 rounded-full p-1 shadow-[0_0_0_3px_rgba(255,255,255,0.9)]" style={{ background: color }}>
            <Avatar avatar={avatar} color={color} size={56} />
          </span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={18}
            placeholder="Il tuo nome"
            autoComplete="nickname"
            aria-label="Il tuo nome"
            className={`h-14 w-full min-w-0 rounded-2xl border-2 bg-slate-950 px-4 text-lg text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-amber-400 focus:shadow-[0_0_0_4px_rgba(255,208,46,0.25)] ${
              error && !name.trim() ? 'border-red-400' : 'border-slate-700'
            }`}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none]">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setAvatar(a.id);
                soundManager.playPop();
              }}
              aria-label="Scegli il personaggio"
              className={`shrink-0 rounded-full p-0.5 transition-transform ${a.id === avatar ? 'scale-110 bg-amber-400' : 'opacity-80'}`}
            >
              <Avatar avatar={a.id} color={a.id === avatar ? color : '#5433b2'} size={48} />
            </button>
          ))}
        </div>
        <div className="flex justify-between px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                soundManager.playClick();
              }}
              aria-label="Scegli colore"
              className={`h-8 w-8 rounded-full shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] transition-transform ${c === color ? 'scale-125 ring-4 ring-white' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </section>

      {error && <p className="pop rounded-2xl border-2 border-red-400/60 bg-red-500/20 px-4 py-3 text-center font-bold text-red-100">{error}</p>}

      {inviteCode && (
        <button type="button" onClick={() => join(inviteCode)} disabled={busy} className="shine h-16 rounded-2xl bg-emerald-500 text-xl font-black text-white">
          Entra nella stanza {inviteCode}
        </button>
      )}

      <RoomList rooms={connected ? rooms : null} disabled={busy} onJoin={join} />

      {/* Giochi: toccandone uno si crea una stanza nuova */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-2xl text-white">Crea una stanza</h2>
          <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-200">
            <Sparkles size={14} /> {GAMES.length} giochi
          </span>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {FILTERS.map((c) => {
            const on = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setFilter(c.id);
                  soundManager.playClick();
                }}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-black ${on ? 'text-slate-950' : 'bg-slate-900/80 text-white'}`}
              >
                {on && (
                  <motion.span layoutId="game-filter" className="absolute inset-0 rounded-full bg-amber-400" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
                )}
                <span className="relative">
                  {c.emoji} {c.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((g, i) => {
              // in vetrina, larghi: i giochi nuovi in "Tutti", oppure il primo se i giochi sono dispari
              const wide = i < wideCount;
              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className={wide ? 'col-span-2' : ''}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => create(g.id)}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-3xl border-2 border-white/10 bg-slate-900 text-left"
                  >
                    <span className="relative block overflow-hidden">
                      <Art
                        src={g.banner}
                        fallback={
                          <span className={`grid w-full place-items-center bg-linear-to-br from-cyan-400 to-slate-700 text-5xl ${wide ? 'aspect-[16/7]' : 'aspect-[16/10]'}`}>
                            {g.emoji}
                          </span>
                        }
                        className={`kenburns w-full object-cover ${wide ? 'aspect-[16/7]' : 'aspect-[16/10]'}`}
                      />
                      <span className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-slate-900 to-transparent" />
                      {g.isNew && <NewBadge className="absolute left-2 top-2" />}
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-2.5 pt-1">
                      <span className={`font-black leading-tight text-white ${wide ? 'text-xl' : 'text-base'}`}>{g.name}</span>
                      <span className="text-xs font-semibold leading-snug text-slate-300">{g.desc}</span>
                      <span
                        className="shine mt-auto flex items-center justify-center gap-0.5 rounded-full bg-amber-400 py-1 text-sm font-black text-slate-950 shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]"
                        style={{ '--d': `${i * 0.4}s` } as CSSProperties}
                      >
                        Crea <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {!inviteCode && (
        <form onSubmit={submitCode} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Stanza privata? Codice"
            aria-label="Codice stanza"
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-slate-700 bg-slate-950/80 text-center text-2xl font-black tracking-[0.3em] text-white outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400"
          />
          <button type="submit" disabled={busy} className="h-14 rounded-2xl bg-cyan-500 px-6 text-lg font-black text-white">
            Entra
          </button>
        </form>
      )}

      <div className="flex justify-center gap-6 text-sm font-bold text-slate-300">
        <button type="button" onClick={onRules} className="flex items-center gap-1.5">
          <BookOpen size={16} /> Come si gioca
        </button>
        <button type="button" onClick={onPassAndPlay} className="flex items-center gap-1.5">
          <Smartphone size={16} /> Un solo telefono
        </button>
      </div>
      {!connected && <p className="text-center text-xs font-semibold text-slate-400">Connessione al server…</p>}
    </div>
  );
}
