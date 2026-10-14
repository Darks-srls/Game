import { useEffect, useState } from 'react';
import { soundManager } from '../utils/audio';

// Conto alla rovescia calcolato sul telefono a partire dall'ora di fine decisa dal server
export function useCountdown(endsAt: number | null, offset: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    let last = -1;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000));
      if (secs === last) return;
      if (last !== -1 && secs <= 10 && secs > 0) soundManager.playTick();
      if (last > 0 && secs === 0) soundManager.playAlarm();
      last = secs;
      setLeft(secs);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [endsAt, offset]);
  return left;
}
