// Un giocatore finto per il banco di prova: guarda la sua vista e decide una mossa (o null = aspetta)
export type FlatBot = (view: any, me: string, info: { players: string[]; step: number; rand: () => number }) => { type: string; payload?: unknown } | null;

export const FLAT_BOTS: Record<string, FlatBot> = {};
export function registerBot(id: string, bot: FlatBot) {
  FLAT_BOTS[id] = bot;
}
