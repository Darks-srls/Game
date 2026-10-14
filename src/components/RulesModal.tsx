import { X } from 'lucide-react';

export default function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="sheet max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-3xl text-white">Come si gioca</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-white">
            <X size={20} />
          </button>
        </div>
        <h3 className="mb-2 text-xl text-amber-300">🕵️ La Spia</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>
            <b className="text-amber-300">Crea una stanza</b> e manda il codice (o il link) agli amici. Giocate in videochiamata, ognuno dal suo telefono, da
            qualsiasi rete.
          </li>
          <li>
            Tutti vedono <b className="text-amber-300">lo stesso luogo</b> e un ruolo… tranne <b className="text-red-300">la spia</b>, che non sa dove siete.
          </li>
          <li>A voce, a turno, fate domande sul luogo a un altro giocatore (inizia chi indica il gioco). Restate vaghi: la spia vi ascolta!</li>
          <li>
            Quando pensate di aver capito chi è la spia, <b className="text-amber-300">votate a voce</b>. Se la spia crede di aver capito il luogo, può dirlo ad alta
            voce.
          </li>
          <li>
            Poi premete tutti <b className="text-emerald-300">Conferma</b>: il gioco svela il luogo e chi era la spia.
          </li>
        </ol>
        <p className="mt-4 rounded-2xl bg-slate-800 p-3 text-sm font-semibold text-slate-300">
          Se qualcuno chiude il telefono o resta bloccato, chi ha creato la stanza può usare <b className="text-red-300">Fine forzata</b>.
        </p>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🎭 L'Impostore</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Tutti ricevono la stessa parola segreta… tranne l'impostore, che ne riceve una simile (e non sa di essere l'impostore!) oppure nessuna.</li>
          <li>A turno, a voce, ognuno dice una parola che ricordi la sua, senza dirla.</li>
          <li>Poi votate a voce chi è l'impostore e premete tutti Conferma: si svelano le parole e chi era l'impostore.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🎨 Telefono senza fili</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Ognuno scrive una frase assurda (c'è anche il pulsante "Dammi un'idea").</li>
          <li>La frase passa al giocatore dopo, che deve disegnarla. Chi viene dopo vede solo il disegno e scrive cosa rappresenta… e così via.</li>
          <li>Alla fine si guardano insieme gli album, pagina per pagina: dalla frase iniziale all'ultimo disegno. Risate garantite.</li>
        </ol>
        <p className="mt-4 rounded-2xl bg-slate-800 p-3 text-sm font-semibold text-slate-300">
          Se qualcuno si blocca, chi ha creato la stanza può usare <b className="text-amber-300">Continua forzato</b>: il suo turno viene saltato.
        </p>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">✏️ Disegna e indovina</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>A turno uno sceglie una parola tra tre e la disegna: gli altri vedono il disegno in diretta.</li>
          <li>Chi indovina scrive la risposta: più sei veloce, più punti prendi. Anche chi disegna guadagna per ogni persona che indovina.</li>
          <li>Nella stanza potete aggiungere le vostre parole. Alla fine c'è la classifica.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">💣 Passa la bomba</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Esce una sfida: una sillaba, una categoria o una lettera.</li>
          <li>Chi ha la bomba dice ad alta voce una parola giusta e la passa al prossimo. Nessuno sa quando scoppia!</li>
          <li>A chi scoppia in mano perde una vita: l'ultimo che resta vince.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🖌️ Artista impostore</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Tutti conoscono la parola segreta, tranne l'impostore, che sa solo la categoria.</li>
          <li>A turno ognuno fa un solo tratto sullo stesso disegno, col suo colore. Due giri.</li>
          <li>Poi votate a voce chi bluffava e premete tutti Conferma.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">😂 Battute al volo</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Ognuno riceve due frasi da completare nel modo più divertente possibile. Le battute sono anonime.</li>
          <li>Poi sfide a due: stessa frase, due battute. Chi non le ha scritte vota la più divertente.</li>
          <li>100 punti per ogni voto, più un bonus se prendi tutti i voti: BATTUTONA!</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🤔 Preferiresti?</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Esce un dilemma impossibile: tutti scelgono A o B in segreto.</li>
          <li>Poi si vede come si è diviso il gruppo (e si litiga a voce 😄).</li>
          <li>Chi ha scelto come la maggioranza prende un punto.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">📡 Sintonia</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>A turno uno fa il sensitivo: vede un punto segreto su un quadrante tra due estremi (es. «Freddo ↔ Caldo»).</li>
          <li>Scrive un indizio che stia lì: gli altri girano la lancetta dove pensano che sia.</li>
          <li>Più vicino al centro del bersaglio, più punti (4, 3 o 2). Il sensitivo prende la media.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🤐 Parola proibita</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Due squadre, 🔴 Rossi e 🔵 Blu. A turno uno fa indovinare più parole possibili alla sua squadra, a voce.</li>
          <li>Non può dire le cinque parole vietate scritte sulla carta: la squadra avversaria le vede e preme BUZZ se sente una parola vietata (-1).</li>
          <li>Ogni parola indovinata vale un punto. Vince la squadra con più punti.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🦸 Chi sono?</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Ognuno riceve un personaggio famoso: lo vedono tutti, tranne lui.</li>
          <li>A turno fai domande sì/no a voce («Sono un cartone animato?»). Al primo «no» passa il turno.</li>
          <li>Quando indovini premi «Ho indovinato!». Vince chi ci arriva per primo.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🎉 Axend Party (videogioco 3D)</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Una serie di minigiochi 3D tutti contro tutti: a ogni minigioco si prendono punti in base alla posizione, alla fine c’è il podio.</li>
          <li>Sul telefono joystick + SALTA + SPINGI; sul PC WASD o frecce, spazio per saltare, E per spingere. Se siete in pochi aggiungete i bot nella stanza.</li>
          <li>🥊 Spingi giù: buttate gli altri giù dall’isola che si restringe. 🚦 Luce rossa, luce verde: correte quando la bambola è di spalle, fermi quando vi guarda. 🪑 Sedie musicali: quando la musica si ferma correte su una sedia libera.</li>
          <li>🎯 Cecchini: chi è sulla torre mira in prima persona e spara; gli altri corrono nel canale riparandosi dietro le casse fino al traguardo sotto la torre.</li>
          <li>🍝 Polpette rotolanti: arrivate in cima alla salita schivando le polpette giganti. 🥿 Il mestolo della nonna: saltate il mestolo e scappate dalla ciabatta. 🐔 La gallina d’oro: tenetela il più a lungo possibile, gli altri vi spingono per rubarla.</li>
          <li>Trascinate sullo schermo per girare la telecamera; dall’ingranaggio in alto a sinistra si regolano volume, sensibilità e grafica.</li>
        </ol>

        <h3 className="mb-2 mt-6 text-xl text-amber-300">🚀 Astro Impostori (videogioco)</h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Siete astronauti su una grande astronave (14 stanze): vi muovete col joystick (telefono) o con WASD e le frecce (PC). Vedete solo vicino a voi e i muri bloccano la vista.</li>
          <li>L’equipaggio fa i compiti nelle stanze (seguite le frecce gialle) e vince quando li finisce tutti. La barra si aggiorna a intervalli irregolari: guardandola non si capisce chi ha fatto davvero un compito.</li>
          <li>L’impostore finge di lavorare (può fare i compiti finti, che non contano), elimina gli altri quando nessuno guarda e si sposta di nascosto con le botole. Chi viene eliminato diventa un fantasma e può ancora fare i suoi compiti.</li>
          <li>Se trovate un corpo premete SEGNALA, oppure usate il pulsante rosso sul tavolo della mensa: si apre la riunione, 10 secondi di discussione a voce e poi si vota chi espellere. Il pulsante si sblocca 20 secondi dopo l’inizio e dopo ogni riunione (i corpi si segnalano sempre).</li>
          <li>L’impostore può anche SABOTARE: chiude le porte di una stanza (si riaprono da sole dopo 25 secondi o prima con un mini-gioco), spegne le luci (l’equipaggio vede pochissimo finché non le riparate in Elettricità) o rompe le comunicazioni (spariscono lista, frecce e barra dei compiti).</li>
          <li>📹 In Sicurezza c’è la console delle telecamere: guardi 4 corridoi in diretta (ma intanto non ti muovi). Quando qualcuno le sta guardando, le lucine rosse delle telecamere lampeggiano. Con le comunicazioni rotte si vede solo neve.</li>
          <li>☢️ Reattore e 💨 ossigeno sono allarmi: avete 45 secondi per riparare, altrimenti vincono gli impostori. Reattore: due persone tengono premuti INSIEME i due pannelli. Ossigeno: un codice in Ossigeno e uno in Amministrazione. Durante l’allarme il pulsante della riunione non funziona.</li>
          <li>L’equipaggio vince scoprendo tutti gli impostori; gli impostori vincono quando sono tanti quanti l’equipaggio.</li>
        </ol>






        <h3 className="mb-2 mt-6 text-xl text-amber-300">🌍 Stanze, 🌶️ e dal vivo</h3>
        <ul className="flex list-disc flex-col gap-3 pl-5 font-semibold text-slate-200">
          <li>Le stanze sono aperte: compaiono nella home e chiunque entra con un tocco. Chi crea la stanza può renderla privata (si entra solo col link).</li>
          <li>Con «Contenuti piccanti» parole, idee e luoghi diventano più sgravati: solo tra adulti!</li>
          <li>
            Giocate nella stessa stanza? Suoni e vibrazioni sono uguali per tutti i ruoli, quindi nessuno si tradisce. Con 🔇 in alto il telefono resta muto.
          </li>
        </ul>
      </div>
    </div>
  );
}
