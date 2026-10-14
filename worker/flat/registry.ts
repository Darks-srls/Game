// Registro dei giochi flat a moduli (server): ogni gioco chiama registerFlat() nel suo file
import type { GameId } from '../../src/types/game';
import type { FlatId } from '../../src/data/flatGames';
import type { Mode } from '../modes';

export const FLAT_MODES: Partial<Record<GameId, Mode<any>>> = {};
export function registerFlat(id: FlatId, mode: Mode<any>) {
  FLAT_MODES[id] = mode;
}
