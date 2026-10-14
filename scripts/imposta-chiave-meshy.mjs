// Salva la tua chiave Meshy (modelli 3D) nel file .env.local, accanto a quella di Gemini.
// La chiave resta solo sul tuo PC e non viene pubblicata.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const key = (await rl.question('Incolla la tua chiave Meshy e premi Invio: ')).trim();
rl.close();

if (!/^msy_[\w-]{10,}$/.test(key)) {
  console.error('Non sembra una chiave Meshy valida (di solito inizia con "msy_"). Riprova.');
  process.exit(1);
}
// tiene le altre chiavi già salvate (Gemini) e sostituisce solo quella di Meshy
const old = existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('MESHY_API_KEY=')) : [];
writeFileSync('.env.local', [...old, `MESHY_API_KEY=${key}`].join('\n') + '\n');
console.log('Chiave Meshy salvata. Ora crea il mostro con:  npm run mostro');
