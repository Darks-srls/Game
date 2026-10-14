import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Settings } from 'lucide-react';
import type { ClientGameState, DrawOp, GameId } from '../types/game';
import type { Realtime } from '../hooks/useGameSocket';

// Personaggi per gli avatar: immagine creata con "npm run grafica", altrimenti l'emoji
export const AVATARS: { id: string; emoji: string }[] = [
  { id: 'av1', emoji: '🦊' },
  { id: 'av2', emoji: '🐼' },
  { id: 'av3', emoji: '🐸' },
  { id: 'av4', emoji: '🐯' },
  { id: 'av5', emoji: '🐙' },
  { id: 'av6', emoji: '🦄' },
  { id: 'av7', emoji: '👽' },
  { id: 'av8', emoji: '🤖' },
  { id: 'av9', emoji: '🐧' },
  { id: 'av10', emoji: '🦁' },
  { id: 'av11', emoji: '🐱' },
  { id: 'av12', emoji: '🦉' },
];
const AVATAR_EMOJI: Record<string, string> = Object.fromEntries(AVATARS.map((a) => [a.id, a.emoji]));

// Famiglie di giochi (filtri della home)
export const GAME_CATEGORIES = [
  { id: 'video', name: 'Videogiochi', emoji: '🎮' },
  { id: 'disegno', name: 'Matite in mano', emoji: '🎨' },
  { id: 'risate', name: 'Risate', emoji: '😂' },
  { id: 'voce', name: 'A voce', emoji: '🗣️' },
  { id: 'ruoli', name: 'Ruoli segreti', emoji: '🕵️' },
] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number]['id'];

// I giochi di Axend Games (le copertine si creano con "npm run grafica")
export const GAMES: { id: GameId; name: string; desc: string; emoji: string; banner: string; cat: GameCategory; isNew?: boolean }[] = [
  { id: 'HORROR1', name: 'Non lasciarmi solo', desc: 'Horror cooperativo in prima persona: riparate gli impianti di un condominio di notte, mentre il Custode ascolta ogni rumore. Voce di prossimità.', emoji: '🔦', banner: '/art/gioco-horror1.webp', cat: 'video', isNew: true },
  { id: 'PARTY3D', name: 'Axend Party', desc: 'Videogioco 3D a minigiochi: polpette giganti, la ciabatta della nonna, cecchini e tanto caos. Con i bot!', emoji: '🎉', banner: '/art/gioco-party.webp', cat: 'video', isNew: true },
  { id: 'ASTRO', name: 'Astro Impostori', desc: 'Il videogioco: fai i compiti sull’astronave e scopri chi elimina l’equipaggio', emoji: '🚀', banner: '/art/gioco-astro.webp', cat: 'video' },
  { id: 'TELEFONO', name: 'Telefono senza fili', desc: 'Scrivi, disegna, indovina: caos puro', emoji: '🎨', banner: '/art/gioco-telefono.webp', cat: 'disegno' },
  { id: 'DISEGNA', name: 'Disegna e indovina', desc: 'Uno disegna in diretta, gli altri indovinano', emoji: '✏️', banner: '/art/gioco-disegna.webp', cat: 'disegno' },
  { id: 'ARTISTA', name: 'Artista impostore', desc: 'Un tratto a testa: chi non sa cosa disegna?', emoji: '🖌️', banner: '/art/gioco-artista.webp', cat: 'disegno' },
  { id: 'BATTUTE', name: 'Battute al volo', desc: 'Completa frasi assurde: vince la più divertente', emoji: '😂', banner: '/art/gioco-battute.webp', cat: 'risate' },
  { id: 'PREFERIRESTI', name: 'Preferiresti?', desc: 'Dilemmi impossibili: pensi come il gruppo?', emoji: '🤔', banner: '/art/gioco-preferiresti.webp', cat: 'risate' },
  { id: 'BOMBA', name: 'Passa la bomba', desc: "Di' una parola e passala prima del BOOM", emoji: '💣', banner: '/art/gioco-bomba.webp', cat: 'risate' },
  { id: 'TABU', name: 'Parola proibita', desc: 'Fai indovinare senza dire le parole vietate', emoji: '🤐', banner: '/art/gioco-tabu.webp', cat: 'voce' },
  { id: 'SINTONIA', name: 'Sintonia', desc: 'Un indizio e una lancetta: leggete nel pensiero', emoji: '📡', banner: '/art/gioco-sintonia.webp', cat: 'voce' },
  { id: 'CHISONO', name: 'Chi sono?', desc: 'Tutti sanno chi sei, tranne te', emoji: '🦸', banner: '/art/gioco-chisono.webp', cat: 'voce' },
  { id: 'SPIA', name: 'La Spia', desc: 'Tutti conoscono il luogo, tranne la spia', emoji: '🕵️', banner: '/art/gioco-spia.webp', cat: 'ruoli' },
  { id: 'IMPOSTORE', name: "L'Impostore", desc: 'Una parola segreta e un impostore tra voi', emoji: '🎭', banner: '/art/gioco-impostore.webp', cat: 'ruoli' },
];

// Bollino "NUOVO" sui giochi appena arrivati
export function NewBadge({ className = '' }: { className?: string }) {
  return <span className={`new-badge rounded-full bg-red-500 px-2 py-0.5 font-display text-[11px] tracking-wide text-white shadow ${className}`}>NUOVO</span>;
}

// Proprietà comuni delle schermate dei giochi a moduli
export interface ModeProps {
  state: ClientGameState;
  board: DrawOp[];
  boardVersion: number;
  clockOffset: number;
  canLead: boolean;
  onAction: (type: string, payload?: unknown) => void;
  onDraw: (op: DrawOp) => void;
  onNewGame: () => void;
  onBackToLobby: () => void;
  onForce: () => void;
  realtime?: Realtime; // solo per i videogiochi in tempo reale
  onLeave?: () => void; // uscire dalla stanza (i giochi a tutto schermo nascondono l'intestazione)
}

// Fine partita: nuova partita o cambio gioco (per chi guida la stanza)
export function EndBar({ canLead, hostName, onNewGame, onBackToLobby }: { canLead: boolean; hostName?: string; onNewGame: () => void; onBackToLobby: () => void }) {
  return (
    <BottomBar>
      {canLead ? (
        <div className="flex gap-2">
          <button type="button" onClick={onNewGame} className="shine h-16 flex-1 rounded-2xl bg-amber-400 text-xl font-black text-slate-950">
            Nuova partita
          </button>
          <button type="button" onClick={onBackToLobby} className="flex h-16 flex-col items-center justify-center rounded-2xl bg-slate-800 px-3 text-xs font-black leading-tight text-white">
            <Settings size={20} />
            Cambia gioco
          </button>
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-slate-700 bg-slate-900/95 py-4 text-center font-bold text-slate-200">In attesa che {hostName ?? 'il capo'} faccia ripartire…</p>
      )}
    </BottomBar>
  );
}

// Classifica con le medaglie
export function Ranking({ state, scores }: { state: ClientGameState; scores: Record<string, number> }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <ol className="flex flex-col gap-1.5">
      {Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([id, points], i) => {
          const p = state.players.find((x) => x.id === id);
          return (
            <li
              key={id}
              style={{ animationDelay: `${0.25 + i * 0.12}s` }}
              className={`pop flex items-center gap-2 rounded-2xl p-2 ${i === 0 ? 'bg-amber-400/25 ring-2 ring-amber-300/60' : 'bg-slate-800'}`}
            >
              <span className="w-8 text-center text-xl">{medals[i] ?? i + 1}</span>
              {p && <Avatar avatar={p.avatar} color={p.color} size={34} />}
              <span className="flex-1 truncate font-bold text-white">
                {p?.name ?? '?'}
                {id === state.myId ? ' (tu)' : ''}
              </span>
              <span className="font-black text-amber-300">{points}</span>
            </li>
          );
        })}
    </ol>
  );
}

// Illustrazione creata con Gemini; finché non esiste si vede il ripiego (di solito un'emoji)
export function Art({ src, fallback, className = '', alt = '' }: { src: string; fallback: ReactNode; className?: string; alt?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <>{fallback}</>;
  return <img src={src} alt={alt} draggable={false} onError={() => setFailed(src)} className={className} />;
}

// Barra fissa in basso: i pulsanti principali sono sempre a portata di pollice
export function BottomBar({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-slate-950 via-slate-950/90 to-transparent pb-[max(14px,env(safe-area-inset-bottom))] pt-10">
      <div className="bar-in pointer-events-auto mx-auto flex max-w-md flex-col gap-2 px-4">{children}</div>
    </div>,
    document.body,
  );
}

export function Avatar({ avatar, color, size = 40 }: { avatar: string; color: string; size?: number }) {
  const emoji = AVATAR_EMOJI[avatar];
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full p-[2px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.55 }}
    >
      {emoji ? <Art src={`/art/avatars/${avatar}.webp`} fallback={emoji} className="h-full w-full rounded-full object-cover" /> : avatar}
    </span>
  );
}

// Illustrazione del luogo (creata con "npm run immagini"); se non c'è, si usa l'emoji
export function LocationArt({ id, icon, className = '' }: { id: string; icon: string; className?: string }) {
  return (
    <Art
      src={`/luoghi/${id}.webp`}
      className={`bg-slate-800 object-cover ${className}`}
      fallback={
        <div className={`grid place-items-center bg-linear-to-br from-cyan-400 via-slate-600 to-slate-900 ${className}`}>
          <span className="text-8xl drop-shadow-lg">{icon}</span>
        </div>
      }
    />
  );
}

export function Segmented({
  options,
  value,
  disabled,
  onChange,
}: {
  options: [number, string][];
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const pill = useId(); // la pillola gialla scivola sull'opzione scelta
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-950 p-1">
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`relative h-10 flex-1 rounded-xl text-base font-black ${on ? 'text-slate-950' : 'text-slate-300'} ${disabled && !on ? 'opacity-40' : ''}`}
          >
            {on && (
              <motion.span
                layoutId={pill}
                className="absolute inset-0 rounded-xl bg-amber-400 shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]"
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export async function shareRoom(code: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = `${window.location.origin}/?room=${code}`;
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Axend Games', text: `Entra nella mia stanza di Axend Games! Codice ${code}`, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// Videogiochi sul telefono: schermo intero vero (Android e browser che lo permettono) al primo tocco.
// Su iPhone Safari non lo consente: lì serve "Aggiungi alla schermata Home" (si apre senza barre).
export function useGameFullscreen(active = true) {
  useEffect(() => {
    if (!active || !window.matchMedia('(pointer: coarse)').matches) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const go = () => {
      if (document.fullscreenElement) return;
      try {
        const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
      } catch {
        // non disponibile (iPhone): si gioca comunque a tutto schermo nella pagina
      }
    };
    window.addEventListener('pointerdown', go, { once: false });
    return () => {
      window.removeEventListener('pointerdown', go);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [active]);
}
