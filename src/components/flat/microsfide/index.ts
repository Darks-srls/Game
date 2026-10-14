// ⚡ Microsfide: quale schermata per ogni sfida
import type { ComponentType } from 'react';
import type { SfidaId } from '../../../data/flat/microsfide';
import type { GameProps } from './kit';
import { Birra, Canestro, Frecce, Piatto, Pizza, Rigore, Schiva, Spaghetti, Taglia } from './mosse';
import { Calcolo, Intruso, Maggiore, Memoria, Parola, Pecore, Sfumatura, Stroop } from './testa';
import { Candeline, Frutta, Gatto, NonToccare, Ordine, Palloncino, Partenza, Ruota, Zanzara } from './tocco';

export const GIOCHI: Record<SfidaId, ComponentType<GameProps>> = {
  ZANZARA: Zanzara,
  FRUTTA: Frutta,
  PECORE: Pecore,
  INTRUSO: Intruso,
  SFUMATURA: Sfumatura,
  STROOP: Stroop,
  MAGGIORE: Maggiore,
  BIRRA: Birra,
  PIATTO: Piatto,
  PALLONCINO: Palloncino,
  FRECCE: Frecce,
  PIZZA: Pizza,
  ORDINE: Ordine,
  MEMORIA: Memoria,
  SCHIVA: Schiva,
  TAGLIA: Taglia,
  GATTO: Gatto,
  CALCOLO: Calcolo,
  CANDELINE: Candeline,
  PAROLA: Parola,
  CANESTRO: Canestro,
  RUOTA: Ruota,
  SPAGHETTI: Spaghetti,
  RIGORE: Rigore,
  PARTENZA: Partenza,
  NONTOCCARE: NonToccare,
};
