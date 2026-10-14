// 🟩 Cinque lettere: le parole segrete (comuni, 5 lettere, senza accenti) e quello che vede ogni telefono

// colore di ogni lettera: G verde (giusta al posto giusto), Y gialla (c'è ma altrove), X grigia (non c'è)
export type CqMark = 'G' | 'Y' | 'X';

export interface CinqueView {
  stage: 'READY' | 'PLAY' | 'REVEAL' | 'END';
  order: string[];
  scores: Record<string, number>;
  gained: Record<string, number>; // punti presi in questo round
  round: number;
  rounds: number;
  stageEndsAt: number | null;
  maxTries: number;
  myRows: { w: string; c: string }[]; // le mie righe: parola e colori ('GYXXG')
  // le righe di tutti: durante la partita solo i colori, le lettere arrivano alla rivelazione
  boards: { id: string; rows: { w: string | null; c: string }[]; solved: boolean; ms: number | null }[];
  solvedOrder: string[]; // chi l'ha trovata, in ordine di arrivo
  secret: string | null; // solo alla rivelazione
  history: { word: string; solvers: string[] }[]; // solo a fine partita
}

// I colori di un tentativo (le lettere doppie si contano: una lettera è gialla solo se ne avanza una nella parola)
export function cqMarks(guess: string, secret: string): string {
  const out: CqMark[] = ['X', 'X', 'X', 'X', 'X'];
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === secret[i]) out[i] = 'G';
    else left[secret[i]] = (left[secret[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === 'G') continue;
    const ch = guess[i];
    if (left[ch]) {
      out[i] = 'Y';
      left[ch] -= 1;
    }
  }
  return out.join('');
}

// parola scritta → solo lettere minuscole senza accenti (null se non sono 5 lettere)
export function cqClean(text: unknown): string | null {
  const w = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
  return w.length === 5 ? w : null;
}

const words = (s: string) => s.trim().split(/\s+/);

export const CQ_WORDS = words(`
abete abito acqua aereo agire aiuto alato album alice altro amaca amare amaro amico amica amore ampio anima ansia arena
arnia aroma asilo asino aspro astro audio avaro avena avere avido
bacio badia bagno balia balla ballo banca banco banda bando barba barca basso bassa bello bella belva benda bimbo bimba
birra bocca bolla borgo borsa bosco botte bravo breve brina brodo bruco buffo bugia buono burro busta
cacao caldo calma calmo calza campo canoa canto capra carne carta carte casco cassa causa cella cento cervo cesta
cesto chilo cielo cigno circo clima cobra cocco colla colle collo colpa colpo conca conte conto coppa corda corno corpo
corsa corso corte corto corvo costa costo cozza crema crudo cuoca cuoco cuore curva
danno dardo dente denso detto dieta disco ditta dolce donna dorso drago duomo
ebano edera elica epoca esame esito etica
falce falco falso fango fante farro fatto fauna felpa ferie fermo ferro festa fetta fiaba fiato fibra fieno fiera fiero
finto fiore fisco fiume flora folla folle fondo fonte forma forno forte forza fossa frana frase frate freno frigo fuoco
furbo furia furto
gallo gamba gambo gazza gemma genio gente gesso getto ghiro giada gioco gioia gnomo golfo gomma gonna grado grano grave
grido guaio guida gusto
icona idolo isola
lacca ladro lampo lardo largo latte legge legno lente lento lepre lesso letto libro lieto limbo linea lince lista litro
lotta lotto lungo luogo lusso lutto
madre magia magro mamma mango mania manto manzo mappa marca marea marmo marzo massa matto mazzo medio melma menta mente
mento merce merlo metro mezzo miele mille miope mondo monte morso mosca mosto mucca multa museo mutuo
nervo netto nonna nonno norma notte nulla nuoto nuovo
odore oliva ombra onore opera orata ovest
pacco padre paese palco palla palma palmo panca panda panna panno pappa parco parte passo pasta pasto patto paura pausa
pazzo pegno pelle penna perla pesca pesce pesto petto pezzo piano piede pieno pigro pinna pinza pista pizza poeta polpo
polso pollo pompa ponte porro porta porto posta posto pozzo prato prete prima primo prova pugno pulce punta punto
quasi quota
radio ragno razzo regno resto ricco ritmo rocca rombo rospo rosso rotta ruota ruspa
sacco saldo salsa salto salvo santo sarto sasso scala scena scopa scudo scusa secco sedia segno senso serio serpe
serra sesto sfida siepe sigla socio soldi solco sonno sopra sorte sosta spada spago spesa spina sport sposa sposo stato
stile stima stiva stufa suolo suono suora sushi svago
tacco talpa tango tappo targa tasca tassa tasto tazza tempo tenda terra testa tetto tigre tinta toast tondo tonno torre
torta torto tosse totem trama treno trono trota tuffo tuono turno tutto
umido umore unico uscio utile
valle vanga vanto vasca vasto verbo verde verme vespa veste vetro viale video vigna villa vinto viola virus visto
vizio volpe volto vuoto
zaino zampa zanna zappa zebra zecca zeppa zitto zolla zucca zuppa
aceto aglio leone rossa nuova
`);

// 🌶️ per adulti (solo con i contenuti piccanti)
export const CQ_WORDS_SPICY = words(`
sesso palle cazzo merda seghe pippa troia zozza porco porca porci orgia porno anale orale dildo vulva tette tetta poppe
zinne cosce tanga harem corna fallo fighe sfiga pirla fesso scemo tonto cesso fogna rogna puzza sputo cacca loffa rutto
bidet vodka alcol canna droga morto morta morte salma forca zombi ostia santi croce messa vacca panza rissa tanfo manza
`);
