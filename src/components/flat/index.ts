// Schermate dei giochi flat a moduli: si caricano solo quando servono (lazy)
import { lazy, type ComponentType } from 'react';
import type { GameId } from '../../types/game';
import type { ModeProps } from '../ui';

export const FLAT_VIEWS: Partial<Record<GameId, ComponentType<ModeProps>>> = {
  PAROLAUNICA: lazy(() => import('./ParolaUnicaView')),
};
