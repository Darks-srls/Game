// Giocatori finti per provare i giochi flat nel browser: entrano nella stanza locale e giocano da soli
// (con i giocatori finti di scripts/flat-bots). Serve il server locale acceso (npx wrangler dev, porta 8787).
//   npx tsx scripts/finti.ts 1234        → 3 giocatori finti nella stanza 1234
//   npx tsx scripts/finti.ts 1234 5      → 5 giocatori finti
import { FLAT_BOTS } from './flat-bots';

const room = process.argv[2];
const n = Number(process.argv[3] ?? 3);
const url = process.env.AXEND_WS ?? 'ws://127.0.0.1:8787/ws';
if (!room) {
  console.log('Uso: npx tsx scripts/finti.ts <codice stanza> [quanti]');
  process.exit(1);
}
const NAMES = ['Gino', 'Pina', 'Ugo', 'Rita', 'Tonio', 'Lella', 'Mirko', 'Sasà', 'Fefè', 'Nando'];
const COLORS = ['#ff4d6d', '#ffb703', '#2ec4b6', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0', '#ff70a6', '#70d6ff', '#9ef01a'];

for (let i = 0; i < n; i++) {
  const ws = new WebSocket(url);
  let myId = '';
  let last: any = null;
  let busyUntil = 0;
  ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomCode: room, name: `${NAMES[i % NAMES.length]} 🤖`, avatar: `av${(i % 12) + 1}`, color: COLORS[i % COLORS.length] } }));
  ws.onmessage = (ev) => {
    let data: any;
    try {
      data = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (data.type === 'JOINED') {
      myId = data.payload.playerId;
      console.log(`${NAMES[i % NAMES.length]} è entrato (${myId})`);
    }
    if (data.type === 'STATE_UPDATE') last = data.payload;
    if (data.type === 'ERROR') console.log(`${NAMES[i % NAMES.length]}: ${data.payload?.message ?? JSON.stringify(data.payload)}`);
  };
  ws.onclose = () => console.log(`${NAMES[i % NAMES.length]} è uscito`);
  ws.onerror = (e) => console.log(`${NAMES[i % NAMES.length]}: errore di connessione`, (e as any)?.message ?? '');
  // ogni tanto guarda il telefono e fa una mossa (come una persona)
  setInterval(() => {
    if (!last || last.phase !== 'PLAYING' || !last.mg || Date.now() < busyUntil) return;
    const bot = FLAT_BOTS[last.settings.game];
    if (!bot) return;
    const move = bot(last.mg, myId, { players: last.players.map((p: any) => p.id), step: 0, rand: Math.random });
    if (move) {
      ws.send(JSON.stringify({ type: move.type, payload: move.payload ?? {} }));
      busyUntil = Date.now() + 600 + Math.random() * 1400;
    }
  }, 500);
}
