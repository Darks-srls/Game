// 🔴🔵 Minigiochi a squadre di Axend Party (uova, rubabandiera, avvelenata, pallavolo): colori, nomi, punti
// e la "metà campo" per i giochi dove non si passa la linea o la rete (uguale per telefono e server).

export const TEAM_COL = ['#ff3b5c', '#3a86ff']; // come il calcetto
export const TEAM_DARK = ['#a8102c', '#1f4fb8'];
export const TEAM_NAME = ['ROSSI', 'BLU'];
// punti di squadra: vittoria, pareggio, sconfitta (più i bonus personali di ogni minigioco); chi esce prende 1
export const TEAM_POINTS = { win: 10, draw: 6, lose: 3, gone: 1 };

// La metà campo di ogni corpo: i rossi (0) stanno a z < 0, i blu (1) a z > 0.
// Sul server si muovono i bot: il loro corpo si "lega" alla squadra nel cervello del bot (bindSide).
// Sul telefono si muove solo il mio personaggio: la mia squadra arriva con sync (setMySide) dalla vista del server.
// Se non si sa niente (es. il banco di prova) vale il lato dove il corpo si trova adesso.
const SIDE = new WeakMap<object, number>();
let mySide: number | null = null;
export function bindSide(body: object, team: number | undefined) {
  if (team === 0 || team === 1) SIDE.set(body, team);
}
export function setMySide(team: unknown) {
  mySide = team === 0 || team === 1 ? team : null;
}
export const sideOf = (body: { z: number }) => SIDE.get(body) ?? mySide ?? (body.z < 0 ? 0 : 1);
// tiene il corpo nella sua metà: gap = metà spessore della linea/rete + raggio del personaggio
export function keepSide(p: { z: number }, gap: number) {
  if (sideOf(p) === 0) {
    if (p.z > -gap) p.z = -gap;
  } else if (p.z < gap) p.z = gap;
}
