// Schermate dei giochi flat a moduli: si caricano solo quando servono (lazy)
import { lazy, type ComponentType } from 'react';
import type { GameId } from '../../types/game';
import type { ModeProps } from '../ui';

export const FLAT_VIEWS: Partial<Record<GameId, ComponentType<ModeProps>>> = {
  PAROLAUNICA: lazy(() => import('./ParolaUnicaView')),
  INTRIGO: lazy(() => import('./IntrigoView')),
  CORTE: lazy(() => import('./CorteView')),
  ROSE: lazy(() => import('./RoseView')),
  BESTIE: lazy(() => import('./BestieView')),
  LUPI: lazy(() => import('./LupiView')),
  MISSIONE: lazy(() => import('./MissioneView')),
  INFILTRATO: lazy(() => import('./InfiltratoView')),
  NOMICOSE: lazy(() => import('./NomiCoseView')),
  DIZIONARIO: lazy(() => import('./DizionarioView')),
  MENTE: lazy(() => import('./MenteView')),
};
