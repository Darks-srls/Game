import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Lock, Users } from 'lucide-react';
import type { RoomSummary } from '../types/game';
import { soundManager } from '../utils/audio';
import { Art, Avatar, GAMES } from './ui';

interface RoomListProps {
  rooms: RoomSummary[] | null;
  disabled: boolean;
  onJoin: (code: string) => void;
}

// Stanze aperte in diretta: un tocco e sei dentro, senza codici
export default function RoomList({ rooms, disabled, onJoin }: RoomListProps) {
  // "pop" quando compare una stanza nuova (non al primo caricamento)
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!rooms) return;
    const codes = new Set(rooms.map((r) => r.code));
    if (known.current && [...codes].some((c) => !known.current!.has(c))) soundManager.playPop();
    known.current = codes;
  }, [rooms]);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl text-white">Stanze aperte</h2>
        <span className="flex items-center gap-2 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-200">
          <span className="live-dot" /> In diretta
        </span>
      </div>

      {rooms === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[84px] rounded-3xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-white/20 bg-slate-950/40 p-4">
          <div className="radar shrink-0" />
          <div>
            <p className="text-lg font-black leading-tight text-white">Nessuna stanza aperta</p>
            <p className="text-sm font-semibold leading-snug text-slate-300">Creane una qui sotto: comparirà qui per tutti i tuoi amici 👇</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rooms.map((room) => (
              <motion.li
                key={room.code}
                layout
                initial={{ opacity: 0, scale: 0.85, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -40 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <RoomCard room={room} disabled={disabled} onJoin={onJoin} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function RoomCard({ room, disabled, onJoin }: { room: RoomSummary; disabled: boolean; onJoin: (code: string) => void }) {
  const g = GAMES.find((x) => x.id === room.game) ?? GAMES[0];
  const waiting = room.phase === 'LOBBY';
  return (
    <button
      type="button"
      disabled={disabled || room.full}
      onClick={() => onJoin(room.code)}
      className="group flex w-full items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900 p-2 pr-3 text-left disabled:opacity-60"
    >
      <span className="relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-2xl">
        <Art
          src={g.banner}
          fallback={<span className="grid h-full w-full place-items-center bg-linear-to-br from-cyan-400 to-slate-700 text-3xl">{g.emoji}</span>}
          className="kenburns h-full w-full object-cover"
        />
        {room.spicy && <span className="absolute left-1 top-1 rounded-full bg-red-500 px-1.5 text-xs shadow">🌶️</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg leading-tight text-white">{g.name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm font-bold text-slate-200">
          <Avatar avatar={room.host.avatar} color={room.host.color} size={22} />
          <span className="truncate">{room.host.name}</span>
        </span>
        <span className="mt-1 flex items-center gap-3 text-xs font-black">
          <span className={`flex items-center gap-1.5 ${waiting ? 'text-emerald-300' : 'text-amber-300'}`}>
            <span className={`live-dot ${waiting ? '' : 'amber'} !h-2 !w-2`} />
            {waiting ? 'In attesa' : room.full ? 'Piena' : 'In partita'}
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <Users size={13} /> {room.players}
          </span>
        </span>
      </span>
      <span
        aria-label={room.full ? 'Stanza piena' : 'Entra'}
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full shadow-[inset_0_-4px_0_rgba(0,0,0,0.2),0_4px_0_rgba(22,6,72,0.45)] ${
          room.full ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500 text-white'
        }`}
      >
        {room.full ? <Lock size={20} /> : <ChevronRight size={28} strokeWidth={3} className="transition-transform group-hover:translate-x-0.5" />}
      </span>
    </button>
  );
}
