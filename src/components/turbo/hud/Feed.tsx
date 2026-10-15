// ⚽🚗 Axend Turbo — le notizie della partita in alto a destra: demolizioni, parate, tiri, flip reset, gol.
// useFeed() tiene la lista (ogni voce sparisce da sola); il coordinatore a ogni fotogramma fa feed.push(eventiNuovi, world, nomi, mioId).
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiIcon } from '../../party3d/icons';
import { feedItems, type FeedItem, type FeedName } from './format';
import type { TurboEvent, World } from '../contract';

export interface FeedProps {
  items: FeedItem[];
}

export function Feed({ items }: FeedProps) {
  if (!items.length) return null;
  return (
    <div className="pointer-events-none absolute right-[max(12px,env(safe-area-inset-right))] top-[calc(max(10px,env(safe-area-inset-top))_+_64px)] z-20 flex w-[min(78vw,320px)] flex-col items-end gap-1.5">
      {items.map((f) => (
        <div key={f.key} className="feed-in sc-chip flex max-w-full items-center gap-1.5 py-1 pl-2 pr-3 text-[15px] font-black leading-tight text-white">
          <FeedLine f={f} />
        </div>
      ))}
    </div>
  );
}

function Name({ n }: { n: FeedName }) {
  return (
    <span className="truncate font-display tracking-wide" style={{ color: n.team === null ? '#ffffff' : n.team === 0 ? '#8cc4ff' : '#ffb366', textDecoration: n.me ? 'underline' : undefined }}>
      {n.name}
    </span>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span className="shrink-0 rounded-md border-2 border-[#1d0f3d] px-1.5 font-display text-[12px] leading-[18px] text-[#1d0f3d]" style={{ background: color }}>
      {text}
    </span>
  );
}

function FeedLine({ f }: { f: FeedItem }) {
  switch (f.kind) {
    case 'demo':
      return (
        <>
          <Name n={f.a} />
          <BoomIcon />
          {f.b && <Name n={f.b} />}
        </>
      );
    case 'save':
      return (
        <>
          <Tag text="PARATA" color="#7cf29a" />
          <Name n={f.a} />
        </>
      );
    case 'shot':
      return (
        <>
          <Tag text="TIRO" color="#ffe259" />
          <Name n={f.a} />
        </>
      );
    case 'flipreset':
      return (
        <>
          <Tag text="FLIP RESET" color="#b67bff" />
          <Name n={f.a} />
        </>
      );
    case 'goal':
      return (
        <>
          <UiIcon name="ball" size={18} />
          <Name n={f.a} />
          {f.b && (
            <span className="shrink-0 text-[12px] text-white/75">
              + <Name n={f.b} />
            </span>
          )}
          {f.speed !== undefined && <span className="shrink-0 text-[12px] text-white/75 tabular-nums">{f.speed} km/h</span>}
        </>
      );
  }
}

function BoomIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M16 2l3 8 8-4-4 8 7 3-8 3 3 9-8-5-6 7-1-9-8 1 6-6-5-6 8 1z" fill="#ff5a3c" stroke="#1d0f3d" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 11l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ffe259" />
    </svg>
  );
}

// ---------------------------------------------------------------- la lista che si svuota da sola
export interface FeedApi {
  items: FeedItem[];
  push: (events: readonly TurboEvent[], world: Pick<World, 'car'>, names: Record<string, string>, myId?: string) => void;
  clear: () => void;
}

export function useFeed(max = 5, ttlMs = 4500): FeedApi {
  const [items, setItems] = useState<FeedItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of t) clearTimeout(id);
      t.clear();
    };
  }, []);
  const push = useCallback<FeedApi['push']>(
    (events, world, names, myId) => {
      if (!events.length) return;
      const add = feedItems(events, world, names, myId);
      if (!add.length) return;
      setItems((prev) => [...prev, ...add].slice(-max));
      const keys = new Set(add.map((a) => a.key));
      const id = setTimeout(() => {
        timers.current.delete(id);
        setItems((prev) => prev.filter((p) => !keys.has(p.key)));
      }, ttlMs);
      timers.current.add(id);
    },
    [max, ttlMs],
  );
  const clear = useCallback(() => setItems([]), []);
  return { items, push, clear };
}
