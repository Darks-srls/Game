// 🦢 Gioco dell'Oca pazza: 40 caselle, quelle speciali e cosa fanno
export type OcaSquare = 'OCA' | 'PONTE' | 'OSTERIA' | 'POZZO' | 'LABIRINTO' | 'SCHELETRO' | 'SFIDA' | 'SCAMBIO' | 'RAZZO' | 'BUCCIA';

export const OCA_END = 40;
export const OCA_BRIDGE_TO = 12;

export const OCA_BOARD: Record<number, OcaSquare> = {
  3: 'SFIDA',
  5: 'OCA',
  6: 'PONTE',
  8: 'BUCCIA',
  11: 'SFIDA',
  14: 'OCA',
  16: 'SCAMBIO',
  19: 'OSTERIA',
  21: 'SFIDA',
  23: 'OCA',
  25: 'RAZZO',
  27: 'BUCCIA',
  29: 'SFIDA',
  31: 'POZZO',
  32: 'OCA',
  34: 'SFIDA',
  36: 'LABIRINTO',
  37: 'SCHELETRO',
  39: 'SFIDA',
};

export const OCA_INFO: Record<OcaSquare, { icon: string; label: string; color: string }> = {
  OCA: { icon: '🦢', label: 'Oca: avanti di nuovo', color: '#ffffff' },
  PONTE: { icon: '🌉', label: 'Ponte: vola alla 12', color: '#a3eaff' },
  OSTERIA: { icon: '🍺', label: 'Osteria: fermo un giro', color: '#ffe88a' },
  POZZO: { icon: '🕳️', label: 'Pozzo: fermo due giri', color: '#b8a6fd' },
  LABIRINTO: { icon: '🌀', label: 'Labirinto: indietro di 6', color: '#cfc1ff' },
  SCHELETRO: { icon: '💀', label: 'Scheletro: torna al via!', color: '#ff8aa8' },
  SFIDA: { icon: '🎭', label: 'Sfida: il gruppo vota', color: '#ffb3c8' },
  SCAMBIO: { icon: '🔄', label: 'Scambio con chi è primo', color: '#9de86b' },
  RAZZO: { icon: '🚀', label: 'Razzo: avanti di 4', color: '#6fdcff' },
  BUCCIA: { icon: '🍌', label: 'Buccia: indietro di 3', color: '#ffdc57' },
};
