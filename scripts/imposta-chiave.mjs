// Salva la tua chiave Gemini nel file .env.local (resta solo sul tuo PC, non viene pubblicata)
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const key = (await rl.question('Incolla la tua chiave Gemini e premi Invio: ')).trim();
rl.close();

if (!/^AIza[\w-]{20,}$/.test(key)) {
  console.error('Non sembra una chiave Gemini valida (di solito inizia con "AIza"). Riprova.');
  process.exit(1);
}
writeFileSync('.env.local', `GEMINI_API_KEY=${key}\n`);
console.log('Chiave salvata. Ora crea la grafica con:  npm run grafica');
