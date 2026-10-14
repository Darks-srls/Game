// Icone e sticker di Axend Party disegnati a mano in SVG (niente emoji): contorno scuro spesso,
// colori pieni e riflessi, nello stile dei giochi mobile "cartoon".
import type { ReactNode } from 'react';
import type { MiniKind } from '../../data/party3d';

const INK = '#1d0f3d';

function Badge({ size, from, to, children }: { size: number; from: string; to: string; children: ReactNode }) {
  const id = `g${from.slice(1)}${to.slice(1)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="5" y="9" width="90" height="88" rx="24" fill={INK} />
      <rect x="5" y="4" width="90" height="88" rx="24" fill={`url(#${id})`} stroke={INK} strokeWidth="5" />
      <path d="M17 18 Q50 8 83 18 L83 30 Q50 22 17 30 Z" fill="#ffffff" opacity="0.25" />
      {children}
    </svg>
  );
}

const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

// Icona di ogni minigioco
export function MiniIcon({ kind, size = 64 }: { kind: MiniKind; size?: number }) {
  switch (kind) {
    case 'SUMO':
      return (
        <Badge size={size} from="#ff7aa2" to="#c9184a">
          <ellipse cx="50" cy="74" rx="32" ry="9" fill="#ffd166" {...stroke} />
          <rect x="30" y="34" width="20" height="22" rx="5" fill="#3a86ff" {...stroke} transform="rotate(-18 40 45)" />
          <rect x="30" y="18" width="18" height="17" rx="5" fill="#ffd23f" {...stroke} transform="rotate(-18 39 26)" />
          <rect x="56" y="40" width="20" height="22" rx="5" fill="#06d6a0" {...stroke} transform="rotate(30 66 51)" />
          <rect x="60" y="24" width="18" height="17" rx="5" fill="#ffd23f" {...stroke} transform="rotate(30 69 32)" />
          <path d="M80 18 l6 -6 M84 28 l8 -2" {...stroke} fill="none" />
        </Badge>
      );
    case 'REDLIGHT':
      return (
        <Badge size={size} from="#ffb703" to="#fb5607">
          <rect x="34" y="14" width="32" height="72" rx="12" fill="#2b2d42" {...stroke} />
          <circle cx="50" cy="33" r="10" fill="#ff1744" {...stroke} />
          <circle cx="50" cy="60" r="10" fill="#2fd15a" {...stroke} />
          <circle cx="46" cy="29" r="3" fill="#ffffff" opacity="0.7" />
        </Badge>
      );
    case 'CHAIRS':
      return (
        <Badge size={size} from="#c77dff" to="#7b2cbf">
          <rect x="30" y="16" width="40" height="32" rx="8" fill="#ff4d6d" {...stroke} />
          <rect x="24" y="48" width="52" height="12" rx="5" fill="#ff8fab" {...stroke} />
          <path d="M30 60 L28 86 M70 60 L72 86" {...stroke} fill="none" strokeWidth="6" />
          <path d="M74 20 q8 -4 10 6 M80 12 l0 14" {...stroke} fill="none" />
        </Badge>
      );
    case 'SNIPER':
      return (
        <Badge size={size} from="#4cc9f0" to="#3a0ca3">
          <circle cx="50" cy="50" r="28" fill="#ffffff" {...stroke} />
          <circle cx="50" cy="50" r="18" fill="#ff4d6d" {...stroke} />
          <circle cx="50" cy="50" r="7" fill="#ffffff" {...stroke} />
          <path d="M50 12 V26 M50 74 V88 M12 50 H26 M74 50 H88" {...stroke} fill="none" strokeWidth="5" />
        </Badge>
      );
    case 'POLPETTE':
      return (
        <Badge size={size} from="#ffd166" to="#e76f51">
          <path d="M10 82 L90 46 L90 88 L10 88 Z" fill="#dca35a" {...stroke} />
          <circle cx="44" cy="44" r="20" fill="#8a4b2a" {...stroke} />
          <circle cx="38" cy="38" r="3" fill="#c0392b" />
          <circle cx="50" cy="48" r="3" fill="#6e3a1f" />
          <path d="M30 30 q14 -10 28 0" fill="#d62828" {...stroke} />
          <path d="M70 30 h14 M72 40 h12" {...stroke} fill="none" />
        </Badge>
      );
    case 'NONNA':
      return (
        <Badge size={size} from="#ff9ebb" to="#d6336c">
          <rect x="20" y="40" width="58" height="26" rx="12" fill="#ff8fab" {...stroke} transform="rotate(-20 49 53)" />
          <rect x="44" y="30" width="30" height="22" rx="10" fill="#ff4d6d" {...stroke} transform="rotate(-20 59 41)" />
          <circle cx="66" cy="28" r="7" fill="#ffffff" {...stroke} />
          <path d="M18 80 Q50 92 82 80" {...stroke} fill="none" />
          <path d="M14 22 l8 6 M24 12 l4 8" {...stroke} fill="none" />
        </Badge>
      );
    case 'PONTE':
      return (
        <Badge size={size} from="#90e0ef" to="#0077b6">
          <rect x="12" y="30" width="30" height="16" rx="4" fill="#f6d365" {...stroke} />
          <rect x="58" y="30" width="30" height="16" rx="4" fill="#f6d365" {...stroke} />
          <rect x="12" y="56" width="30" height="16" rx="4" fill="#f6d365" {...stroke} />
          <path d="M60 58 l8 6 l-6 8 M78 56 l6 10 l-8 6" fill="#f6d365" {...stroke} />
          <path d="M16 36 h22 M62 36 h22" stroke="#d62828" strokeWidth="4" strokeLinecap="round" />
        </Badge>
      );
    case 'BOTTO':
      return (
        <Badge size={size} from="#ffb3c1" to="#e63946">
          <rect x="34" y="34" width="24" height="46" rx="8" fill="#e63946" {...stroke} transform="rotate(-18 46 57)" />
          <path d="M30 44 l24 -8 M40 74 l22 -8" stroke="#ffd60a" strokeWidth="6" strokeLinecap="round" transform="rotate(-6 46 57)" />
          <path d="M52 30 q6 -10 14 -12" fill="none" {...stroke} />
          <circle cx="70" cy="16" r="7" fill="#fff3b0" {...stroke} />
          <path d="M78 10 l6 -4 M80 20 l7 2 M70 6 l1 -5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </Badge>
      );
    case 'GALLINA':
      return (
        <Badge size={size} from="#ffe066" to="#f4a261">
          <ellipse cx="48" cy="58" rx="26" ry="20" fill="#ffcf33" {...stroke} />
          <circle cx="66" cy="36" r="13" fill="#ffcf33" {...stroke} />
          <path d="M62 22 q4 -8 8 0 q4 -8 8 2" fill="#e63946" {...stroke} />
          <path d="M78 36 l10 4 l-10 4 Z" fill="#ff9f1c" {...stroke} />
          <circle cx="68" cy="34" r="2.5" fill={INK} />
          <path d="M24 50 l-10 -8 l2 14" fill="#ffcf33" {...stroke} />
          <path d="M20 16 l3 6 M84 70 l6 3" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
        </Badge>
      );
    case 'DENTE':
      return (
        <Badge size={size} from="#ffd6a5" to="#e76f51">
          <path d="M30 40 q4 -16 10 0 M44 38 q5 -18 10 0 M58 40 q4 -14 9 0" fill="none" stroke="#f6d365" strokeWidth="5" strokeLinecap="round" />
          <path d="M30 40 q4 -16 10 0 M44 38 q5 -18 10 0 M58 40 q4 -14 9 0" fill="none" {...stroke} strokeWidth="2" />
          <rect x="18" y="42" width="54" height="40" rx="9" fill="#d0d4dc" {...stroke} />
          <rect x="12" y="40" width="66" height="9" rx="4" fill="#adb5bd" {...stroke} />
          <path d="M26 58 h20" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          <circle cx="74" cy="30" r="15" fill="#e63946" {...stroke} />
          <path d="M74 21 v9 l6 4" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M70 13 q4 -6 8 0" fill="#2d9c4a" {...stroke} strokeWidth="3" />
        </Badge>
      );
    case 'WAFER':
      return (
        <Badge size={size} from="#ffe8b8" to="#c9844a">
          <path d="M50 14 l20 11 v22 l-20 11 l-20 -11 v-22 Z" fill="#ffd79a" {...stroke} />
          <path d="M28 46 l20 11 v22 l-20 11 l-20 -11 v-22 Z" fill="#ffaccb" {...stroke} transform="translate(2 -6)" />
          <path d="M72 46 l20 11 v22 l-20 11 l-20 -11 v-22 Z" fill="#bdeb94" {...stroke} transform="translate(-2 -6)" />
          <path d="M40 25 l20 22 M60 25 l-20 22 M50 14 v44" stroke="#b07a3a" strokeWidth="2.5" opacity="0.7" />
          <circle cx="82" cy="20" r="3" fill="#c9844a" stroke={INK} strokeWidth="2" />
          <circle cx="16" cy="28" r="2.5" fill="#c9844a" stroke={INK} strokeWidth="2" />
        </Badge>
      );
    case 'FRUTTA':
      return (
        <Badge size={size} from="#c7f9cc" to="#2d9c4a">
          <rect x="14" y="16" width="32" height="32" rx="7" fill="#ffe5ec" {...stroke} />
          <rect x="54" y="16" width="32" height="32" rx="7" fill="#7b2cbf" {...stroke} />
          <rect x="14" y="54" width="32" height="32" rx="7" fill="#7b2cbf" {...stroke} />
          <rect x="54" y="54" width="32" height="32" rx="7" fill="#fff3b0" {...stroke} />
          <path d="M30 26 c8 -6 14 2 10 10 c-2 6 -6 6 -10 4 c-4 2 -8 2 -10 -4 c-4 -8 2 -16 10 -10 Z" fill="#e63946" {...stroke} strokeWidth="3" />
          <path d="M58 72 q6 10 24 6 q-12 -2 -18 -14 Z" fill="#ffd60a" {...stroke} strokeWidth="3" />
          <text x="70" y="42" textAnchor="middle" fontSize="24" fontWeight="900" fill="#ffd60a" stroke={INK} strokeWidth="2">?</text>
          <text x="30" y="80" textAnchor="middle" fontSize="24" fontWeight="900" fill="#ffd60a" stroke={INK} strokeWidth="2">?</text>
        </Badge>
      );
    case 'CALCIO':
      return (
        <Badge size={size} from="#8fe388" to="#2b9348">
          <path d="M10 70 h20 M14 80 h14 M8 60 h16" {...stroke} fill="none" />
          <circle cx="56" cy="52" r="30" fill="#ffffff" {...stroke} />
          <path d="M56 40 l11 8 l-4 13 h-14 l-4 -13 Z" fill={INK} />
          <path d="M56 22 v18 M67 48 l16 -6 M63 61 l9 14 M49 61 l-9 14 M45 48 l-16 -6" stroke={INK} strokeWidth="3" />
          <path d="M40 30 q-6 6 -6 14" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6" />
        </Badge>
      );
    case 'POMODORI':
      return (
        <Badge size={size} from="#ffadad" to="#d62828">
          <circle cx="16" cy="70" r="5" fill="#e63946" stroke={INK} strokeWidth="2.5" />
          <circle cx="84" cy="22" r="4" fill="#e63946" stroke={INK} strokeWidth="2.5" />
          <path d="M14 30 l10 6 M18 18 l8 10" {...stroke} fill="none" />
          <ellipse cx="52" cy="56" rx="30" ry="26" fill="#e63946" {...stroke} />
          <path d="M52 30 l-12 -6 l6 10 l-12 4 l14 2 l4 10 l4 -10 l14 -2 l-12 -4 l6 -10 Z" fill="#2d9c4a" {...stroke} strokeWidth="3" />
          <ellipse cx="38" cy="50" rx="6" ry="9" fill="#ffffff" opacity="0.5" transform="rotate(25 38 50)" />
        </Badge>
      );
    case 'CORSA':
      return (
        <Badge size={size} from="#a0c4ff" to="#7b2cbf">
          <path d="M14 22 h72" {...stroke} strokeWidth="6" />
          <path d="M50 22 L34 62" {...stroke} strokeWidth="4" />
          <rect x="16" y="56" width="34" height="18" rx="7" fill="#ff9f1c" {...stroke} transform="rotate(22 33 65)" />
          <path d="M66 36 v52" {...stroke} />
          <rect x="66" y="36" width="22" height="16" fill="#ffffff" {...stroke} strokeWidth="3" />
          <rect x="66" y="36" width="7" height="8" fill={INK} />
          <rect x="80" y="36" width="8" height="8" fill={INK} />
          <rect x="73" y="44" width="7" height="8" fill={INK} />
          <path d="M8 82 q10 -6 18 0" {...stroke} fill="none" />
        </Badge>
      );
  }
}

// La frutta della Macedonia (per il cartello in alto: il frutto da salvare)
export function FruitIcon({ fruit, size = 64 }: { fruit: number; size?: number }) {
  const s = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {fruit === 0 && (
        <g>
          <path d="M50 30 C74 12 98 42 86 66 C78 88 60 90 50 82 C40 90 22 88 14 66 C2 42 26 12 50 30 Z" fill="#e63946" {...s} />
          <path d="M50 30 q2 -14 10 -20" fill="none" {...s} strokeWidth="6" />
          <ellipse cx="68" cy="14" rx="12" ry="6" fill="#2d9c4a" {...s} transform="rotate(-25 68 14)" />
          <ellipse cx="32" cy="46" rx="7" ry="11" fill="#ffffff" opacity="0.5" transform="rotate(-25 32 46)" />
        </g>
      )}
      {fruit === 1 && (
        <g>
          <path d="M14 18 Q16 86 90 76 Q96 70 88 64 Q38 66 26 16 Z" fill="#ffd60a" {...s} />
          <rect x="12" y="10" width="12" height="9" fill="#6b3e1f" {...s} strokeWidth="3" />
          <path d="M32 42 q10 26 40 28" fill="none" stroke="#c99a00" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {fruit === 2 && (
        <g>
          {[
            [30, 38],
            [50, 38],
            [70, 38],
            [40, 56],
            [60, 56],
            [50, 74],
            [30, 56],
            [70, 56],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="11" fill="#8e44ad" {...s} strokeWidth="3.5" />
          ))}
          <path d="M50 28 l4 -16" fill="none" {...s} strokeWidth="6" />
          <ellipse cx="68" cy="16" rx="13" ry="6" fill="#2d9c4a" {...s} transform="rotate(-20 68 16)" />
        </g>
      )}
      {fruit === 3 && (
        <g>
          <path d="M6 36 H94 A44 44 0 0 1 6 36 Z" fill="#2d9c4a" {...s} />
          <path d="M14 36 H86 A36 36 0 0 1 14 36 Z" fill="#ffffff" {...s} strokeWidth="3" />
          <path d="M19 36 H81 A31 31 0 0 1 19 36 Z" fill="#ff4d6d" {...s} strokeWidth="3" />
          {[
            [36, 48],
            [50, 56],
            [64, 48],
            [44, 42],
            [57, 42],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="2.5" ry="4" fill={INK} />
          ))}
        </g>
      )}
      {fruit === 4 && (
        <g>
          <path d="M6 54 Q10 18 50 20 Q90 18 94 54 Q90 86 50 84 Q10 86 6 54 Z" fill="#fff04d" {...s} />
          <ellipse cx="70" cy="18" rx="13" ry="6" fill="#2d9c4a" {...s} transform="rotate(-20 70 18)" />
          <ellipse cx="34" cy="40" rx="12" ry="7" fill="#ffffff" opacity="0.55" transform="rotate(-20 34 40)" />
        </g>
      )}
      {fruit === 5 && (
        <g>
          <path d="M32 62 Q40 30 56 12 M68 66 Q62 34 56 12" fill="none" stroke="#2d6a4f" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="70" r="17" fill="#d90429" {...s} />
          <circle cx="68" cy="74" r="17" fill="#d90429" {...s} />
          <ellipse cx="70" cy="14" rx="14" ry="6" fill="#2d9c4a" {...s} transform="rotate(-20 70 14)" />
          <circle cx="26" cy="64" r="4" fill="#ffffff" opacity="0.6" />
          <circle cx="62" cy="68" r="4" fill="#ffffff" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

// Icone dell'interfaccia
export function UiIcon({
  name,
  size = 26,
  color = '#ffffff',
}: {
  name: 'gear' | 'people' | 'clock' | 'trophy' | 'sound' | 'aim' | 'exit' | 'book' | 'jump' | 'push' | 'fire' | 'scope' | 'eye' | 'dash' | 'stop' | 'tomato' | 'ball';
  size?: number;
  color?: string;
}) {
  const s = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {name === 'gear' && (
        <g>
          <path
            d="M16 3l2.6 2.8 3.8-.9.9 3.8 3.6 1.4-1 3.7 2.8 2.6-2.8 2.6 1 3.7-3.6 1.4-.9 3.8-3.8-.9L16 29l-2.6-2.8-3.8.9-.9-3.8-3.6-1.4 1-3.7L3.3 16l2.8-2.6-1-3.7 3.6-1.4.9-3.8 3.8.9z"
            fill={color}
            {...s}
          />
          <circle cx="16" cy="16" r="4.5" fill="#7b2cbf" {...s} />
        </g>
      )}
      {name === 'people' && (
        <g>
          <rect x="4" y="12" width="11" height="13" rx="3" fill="#70d6ff" {...s} />
          <rect x="5.5" y="4" width="8" height="8" rx="2.5" fill="#ffd23f" {...s} />
          <rect x="17" y="12" width="11" height="13" rx="3" fill="#ff70a6" {...s} />
          <rect x="18.5" y="4" width="8" height="8" rx="2.5" fill="#ffd23f" {...s} />
        </g>
      )}
      {name === 'clock' && (
        <g>
          <circle cx="16" cy="17" r="12" fill={color} {...s} />
          <path d="M16 10v7l5 3" {...s} fill="none" />
          <path d="M12 3h8" {...s} />
        </g>
      )}
      {name === 'trophy' && (
        <g>
          <path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="#ffd60a" {...s} />
          <path d="M9 7H4c0 5 3 7 6 7M23 7h5c0 5-3 7-6 7" fill="none" {...s} />
          <path d="M13 20h6v4h3v4H10v-4h3z" fill="#ffd60a" {...s} />
        </g>
      )}
      {name === 'sound' && (
        <g>
          <path d="M4 12h6l7-6v20l-7-6H4z" fill={color} {...s} />
          <path d="M21 11c2 2 2 8 0 10M24.5 8c4 4 4 12 0 16" fill="none" {...s} />
        </g>
      )}
      {name === 'aim' && (
        <g>
          <circle cx="16" cy="16" r="11" fill={color} {...s} />
          <circle cx="16" cy="16" r="4" fill="#ff4d6d" {...s} />
          <path d="M16 1v7M16 24v7M1 16h7M24 16h7" {...s} />
        </g>
      )}
      {name === 'exit' && (
        <g>
          <rect x="4" y="4" width="14" height="24" rx="2" fill={color} {...s} />
          <path d="M14 16h15M24 11l5 5-5 5" fill="none" {...s} />
        </g>
      )}
      {name === 'book' && (
        <g>
          <path d="M4 6c4-2 8-2 12 1 4-3 8-3 12-1v20c-4-2-8-2-12 1-4-3-8-3-12-1z" fill={color} {...s} />
          <path d="M16 7v20" {...s} />
        </g>
      )}
      {name === 'jump' && (
        <g>
          <path d="M16 3l11 12h-6v13H11V15H5z" fill={color} {...s} />
        </g>
      )}
      {name === 'push' && (
        <g>
          <path d="M5 13h8V8l12 8-12 8v-5H5z" fill={color} {...s} />
        </g>
      )}
      {name === 'dash' && (
        <g>
          <path d="M18 3L7 18h8l-3 11 13-16h-8z" fill={color} {...s} />
        </g>
      )}
      {name === 'fire' && (
        <g>
          <circle cx="16" cy="16" r="12" fill={color} {...s} />
          <circle cx="16" cy="16" r="5" fill="#ff1744" {...s} />
        </g>
      )}
      {name === 'scope' && (
        <g>
          <circle cx="14" cy="14" r="10" fill={color} {...s} />
          <path d="M14 8v12M8 14h12" {...s} />
          <path d="M21.5 21.5L29 29" {...s} strokeWidth="5" />
        </g>
      )}
      {name === 'eye' && (
        <g>
          <path d="M2 16c4-7 9-10 14-10s10 3 14 10c-4 7-9 10-14 10S6 23 2 16z" fill={color} {...s} />
          <circle cx="16" cy="16" r="5" fill="#3a86ff" {...s} />
        </g>
      )}
      {name === 'stop' && (
        <g>
          {/* lo scolapasta */}
          <path d="M3 12h26c0 9-6 15-13 15S3 21 3 12z" fill={color} {...s} />
          <path d="M1 12h30" {...s} />
          <circle cx="11" cy="17" r="1.6" fill="#1d0f3d" />
          <circle cx="16" cy="20" r="1.6" fill="#1d0f3d" />
          <circle cx="21" cy="17" r="1.6" fill="#1d0f3d" />
          <path d="M10 8q2-5 4 0M17 8q2-5 4 0" fill="none" stroke="#f6d365" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {name === 'tomato' && (
        <g>
          <ellipse cx="16" cy="18" rx="12" ry="10" fill="#e63946" {...s} />
          <path d="M16 8l-5-3 2 4-5 2 6 1 2 4 2-4 6-1-5-2 2-4z" fill="#2d9c4a" {...s} strokeWidth="2" />
        </g>
      )}
      {name === 'ball' && (
        <g>
          <circle cx="16" cy="16" r="12" fill={color} {...s} />
          <path d="M16 11l4.5 3.2-1.7 5.3h-5.6l-1.7-5.3z" fill="#1d0f3d" />
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- sticker-meme originali (frasi da TikTok, facce disegnate)

export type StickerMood = 'win' | 'lose' | 'out' | 'king';
const PHRASES: Record<StickerMood, string[]> = {
  win: ['SEI IL GOAT', 'EZ', 'ARATI TUTTI', 'SKILLATO', 'BESTIA', 'TOP G', 'CHE CLIP', 'LEGGENDA'],
  lose: ['SKILL ISSUE', 'NEXT', 'CI HAI PROVATO', 'BRO…', 'MA PERCHÉ', 'RITENTA'],
  out: ['F', 'È ANDATO', 'NOOO BRO', 'CHE FIGURA', 'TI HANNO ARATO', 'MAMMA MIA', 'RAGE QUIT?', 'CHE FAIL'],
  king: ['IL RE DEL PARTY', 'GG EZ', 'MVP', 'IMBATTIBILE'],
};
export const pickPhrase = (mood: StickerMood) => PHRASES[mood][Math.floor(Math.random() * PHRASES[mood].length)];

function StickerFace({ mood }: { mood: StickerMood }) {
  const happy = mood === 'win' || mood === 'king';
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="14" width="76" height="72" rx="20" fill="#ffd23f" stroke={INK} strokeWidth="5" />
      {happy ? (
        <>
          {/* occhiali da sole pixelati */}
          <path d="M18 38 H82 V44 H76 V54 H58 V44 H52 V48 H48 V44 H42 V54 H24 V44 H18 Z" fill={INK} />
          <rect x="28" y="44" width="6" height="4" fill="#ffffff" opacity="0.8" />
          <rect x="62" y="44" width="6" height="4" fill="#ffffff" opacity="0.8" />
          <path d="M34 66 Q50 80 66 66" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          {mood === 'king' && <path d="M26 16 L34 2 L42 14 L50 0 L58 14 L66 2 L74 16 Z" fill="#ffd60a" stroke={INK} strokeWidth="4" strokeLinejoin="round" />}
        </>
      ) : mood === 'out' ? (
        <>
          <path d="M28 38 l12 12 M40 38 l-12 12 M60 38 l12 12 M72 38 l-12 12" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="50" cy="70" rx="9" ry="11" fill="#3d0c1a" stroke={INK} strokeWidth="3" />
        </>
      ) : (
        <>
          <circle cx="34" cy="44" r="7" fill={INK} />
          <circle cx="66" cy="44" r="7" fill={INK} />
          <path d="M28 54 q-4 14 2 22 M72 54 q4 14 -2 22" fill="#7fd3ff" stroke="#3a86ff" strokeWidth="3" />
          <path d="M36 74 Q50 62 64 74" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function Sticker({ mood, text }: { mood: StickerMood; text: string }) {
  const tilt = mood === 'win' || mood === 'king' ? -8 : 7;
  return (
    <div className="sticker-pop pointer-events-none flex flex-col items-center" style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <div className="rounded-[28px] border-[5px] border-[#1d0f3d] bg-white p-2 shadow-[0_8px_0_#1d0f3d]">
        <StickerFace mood={mood} />
      </div>
      <p className="sc-stroke -mt-4 max-w-[80vw] rotate-[-4deg] text-center font-display text-5xl leading-none text-white" style={{ color: mood === 'win' || mood === 'king' ? '#ffd60a' : mood === 'out' ? '#ff4d6d' : '#70d6ff' }}>
        {text}
      </p>
    </div>
  );
}
