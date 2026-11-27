# Stato del progetto e cose da fare

Questo file è la memoria condivisa del progetto: chi riprende il lavoro, da
qualunque computer, parte da qui. **Va aggiornato a ogni lavoro finito**
(cosa è stato fatto, cosa resta, decisioni prese) e committato su `main`.

Ultimo aggiornamento: 2026-11-27.

## Come si lavora

- **Solo sul branch `main`.** Niente branch di prova: commit e push direttamente
  su `main`, dopo aver verificato (build del client, oxlint, prova nel browser).
  Un branch di prova (`trova-tavolo`) ha già creato confusione: mentre il server
  era su quel branch, i preset arrivati su `main` nel frattempo "sparivano".
  Se una modifica è rischiosa e va provata prima di andare in produzione, se ne
  parla prima invece di aprire un branch.
- **Mai perdere lavoro.** Prima di chiudere, controllare che non restino branch
  remoti con commit non uniti a `main`:
  `git fetch && for b in $(git branch -r | grep -v HEAD); do echo "$b: $(git log --oneline origin/main..$b | wc -l)"; done`
- **Aggiornare il server**: da `/opt/matrimonio`, `sudo bash update.sh` (fa il
  backup, scarica `main`, ricostruisce il container). Il server deve stare su
  `main`: se `git status` dice altro, `sudo git checkout main` prima.
- `docs/VideoImplementazione_Tablout.mp4` (lo spot da cui è nata "Trova il tuo
  tavolo") resta volutamente fuori da git.

## Da ricordare sul server di produzione

- Nginx Proxy Manager rimanda a `/wedding` tutto ciò che non è nella whitelist
  dei percorsi pubblici. Per "Trova il tuo tavolo" la regex deve includere
  `tavolo$` e `api/tavolo/`:

  ```nginx
  location ~ ^/(?!wedding$|conferma$|tavolo$|assets/|favicon\.svg$|icon-192\.svg$|icon-512\.svg$|icons\.svg$|manifest\.json$|sw\.js$|uploads/landing/|api/config/public$|api/landing/info$|api/conferma/|api/tavolo/) {
      return 302 /wedding;
  }
  ```

  Una futura pagina pubblica nuova (es. galleria foto) andrà aggiunta qui.
- La pagina `/tavolo` è spenta finché non si accende **"Ricerca attiva"** in
  Landing → sezione QR.

## Fatto

### "Trova il tuo tavolo" (QR all'ingresso della sala)
- Pagina pubblica `/tavolo`: l'invitato cerca il suo nome, vede tavolo e sedia
  illuminata, poi la pianta della sala a schermo intero con zoom sul suo posto.
  Grafica curata soprattutto per il telefono; in verticale chiede di ruotarlo
  ("Ho la rotazione bloccata" gira la sala). Il tasto indietro chiude la sala.
- La pagina **non ricorda nulla** tra una visita e l'altra (scelta esplicita:
  chi cerca dal telefono di un altro non deve lasciarci il suo nome).
- QR e cartello A4 da stampare in Landing → QR.
- Sedie vere (`ospiti.posto`): automatiche (famiglie vicine, sposi al centro)
  finché gli sposi non ne spostano una; da lì il tavolo resta come l'hanno messo.
- Zoom che segue la forma del tavolo (tavoli lunghi, girati, a L).
- Tavolo sposi scritto "SPOSI" in maiuscolo grassetto.
- **Legenda**: sulla pianta i tavoli mostrano un numero (preso dal nome:
  "Tavolo 3" → 3; gli altri i primi liberi; sposi = cuore), con elenco
  numero/nome; toccando una riga si va a quel tavolo.
- **Biglietto di ringraziamento** dopo lo zoom sulla sedia ("Grazie, Luca" +
  messaggio + firma degli sposi). Testo modificabile in Landing → QR,
  `{nome}` = nome dell'invitato; si può spegnere.
- "Posto N" sotto la sedia illuminata, uguale al segnaposto.

### Tavoli (lato sposi)
- **Spostare una persona di sedia**: Tavoli → Pianta sala → tocca un tavolo →
  tocca la persona, poi la sedia (occupata = scambio). Iniziali sulle sedie,
  sedie libere in verde, ⇄ sulle occupate, lampeggio e messaggio con **Annulla**.
- Sul computer: **"Apri in grande"** apre il tavolo in una finestra grande con i
  nomi accanto alle sedie.
- Segnaposti PDF con "Tavolo X · Posto N", in ordine di tavolo e sedia.
- I **preset** ricordano anche le sedie scelte a mano (quelli salvati prima no:
  si riapplicano con sedie automatiche; "Aggiorna" li rifà completi).
- Tavoli a L: le sedie dell'angolo interno non si toccano più.

## Da fare (nell'ordine deciso)

1. **Menu del ricevimento** — da fare **solo quando arriva il menu ufficiale
   dal ristorante**. Idea: lo scrivono gli sposi nell'app, gli invitati lo
   vedono nella pagina del tavolo e/o nella pagina Wedding.
2. **Galleria foto degli invitati** — per ultima. Gli invitati caricano le foto
   della giornata da un QR. Da decidere prima di cominciare:
   - le foto compaiono subito o le approvano gli sposi una per una;
   - chi la vede (tutti con il link, o solo dal QR in sala);
   - spazio su disco del server e riduzione automatica delle foto;
   - quando è aperta (solo durante/dopo il matrimonio, o anche prima).
   - ricordarsi la whitelist di Nginx Proxy Manager (vedi sopra).

## Idee messe da parte (non richieste)
- Trascinare una persona sulla sedia (drag & drop): rimandato, il tocco basta.
- Pulizia dei branch vecchi su GitHub (`trova-tavolo`,
  `claude/wedding-management-app-szun2g`): sono già tutti dentro `main`,
  si possono cancellare con l'ok dell'utente.
