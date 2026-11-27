# Stato del progetto e cose da fare

Questo file è la memoria condivisa del progetto: chi riprende il lavoro, da
qualunque computer, parte da qui. **Va aggiornato a ogni lavoro finito**
(cosa è stato fatto, cosa resta, decisioni prese) e committato su `main`.

Ultimo aggiornamento: 2026-11-27 (sera): galleria foto scritta e provata in locale, da mettere in produzione (vedi "Galleria foto: messa in produzione").

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

  Per la **galleria foto** vanno aggiunti anche `foto$` e `api/galleria/`:
  `...(?!wedding$|conferma$|tavolo$|foto$|assets/|...|api/tavolo/|api/galleria/)`.
  Una futura pagina pubblica nuova andrà aggiunta qui.
- La pagina `/tavolo` è spenta finché non si accende **"Ricerca attiva"** in
  Landing → sezione QR.

## Fatto

### "Trova il tuo tavolo" (QR all'ingresso della sala)
- Pagina pubblica `/tavolo`: l'invitato cerca il suo nome, vede tavolo e sedia
  illuminata, poi la pianta della sala a schermo intero con zoom sul suo posto.
  Grafica curata soprattutto per il telefono; in verticale chiede di ruotarlo
  ("Ho la rotazione bloccata" gira la sala). Il tasto indietro chiude la sala.
- La pagina **non ricorda nulla** tra una visita e l'altra (scelta esplicita:
  chi cerca dal telefono di un altro non deve lasciarci il suo nome). Anche
  "Non sei tu?" azzera la scelta del tutto (prima la teneva da parte: la pianta
  mostrava ancora la sedia di un'altra persona e c'era "Torna al tuo posto").
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
2. **Galleria foto degli invitati** — scritta e provata in locale; da mettere in produzione: vedi "Galleria foto: messa in produzione".

## Progetto: galleria foto degli invitati

### Decisioni dell'utente (2026-11-27)
- Le foto **compaiono subito**; gli sposi possono nasconderle o eliminarle.
- La vede **chiunque abbia il link o il QR** (pagina pubblica, niente codice).
- Si conserva **l'originale** (per gli sposi) **più una versione leggera** per
  la galleria.
- **Solo foto**, niente video.

### Come funziona
- **Pagina pubblica `/foto`**, stessa grafica di "Trova il tuo tavolo" (tema e
  foto della pagina Wedding): bottone grande "Carica le tue foto" (più foto
  insieme dalla galleria del telefono o dalla fotocamera), avanzamento per
  ogni foto, poi la galleria a mosaico con le più recenti in alto; toccando una
  foto si apre a schermo intero, si scorre col dito e si scarica.
- Nome di chi carica **facoltativo** ("Foto di Luca").
- **Due interruttori** in Landing → QR: "Galleria attiva" (la pagina si vede)
  e "Caricamenti aperti" (si possono aggiungere foto) — così dopo il matrimonio
  si chiudono i caricamenti e la galleria resta da guardare.
- **QR e cartello A4** per la sala, come per il tavolo; link dalla pagina
  Wedding e dal biglietto/pagina di "Trova il tuo tavolo".
- **Pagina "Galleria" per gli sposi** (nel menu): tutte le foto, nascondi /
  mostra / elimina, filtro per autore, **scarica tutti gli originali in ZIP**.

### Scelte tecniche
- **Riduzione nel browser dell'invitato**, non sul server: il telefono crea la
  versione grande (lato lungo ~2048 px, JPEG) e la miniatura (~480 px) e le
  carica insieme all'originale. Evita librerie di immagini sul server (l'immagine
  Docker è Alpine) e fa caricare meno dati col Wi-Fi della sala. Safari su
  iPhone decodifica anche le HEIC, quindi le versioni leggere sono sempre JPEG.
- **Privacy**: le versioni leggere, ricreate nel browser, **non hanno i dati
  EXIF** (niente posizione GPS). Gli originali li scaricano solo gli sposi,
  da route autenticata. Le foto nascoste non sono raggiungibili dal pubblico.
- **Le foto stanno sulla NAS** (decisione dell'utente, 2026-11-27: TrueNAS
  sulla stessa rete, anch'essa virtualizzata). L'app non parla con la NAS: la
  cartella condivisa viene montata sulla VM del server (NFS o SMB, in
  `/etc/fstab`) e passata al container con un bind mount. In
  `docker-compose.yml` il percorso viene da una variabile del `.env` accanto
  (`GALLERIA_DIR`, come `APP_PORT`), così il file tracciato non si tocca; senza
  variabile si usa un volume locale.
- **NAS non raggiungibile**: se il mount salta, la cartella sulla VM resta vuota
  e le foto finirebbero sul disco della VM senza che nessuno se ne accorga.
  Per evitarlo l'app scrive solo se nella cartella c'è un file segnaposto
  (`.galleria-nas`) creato una volta sulla NAS; altrimenti i caricamenti si
  fermano con un messaggio chiaro e gli sposi vedono un avviso.
- Dentro la cartella: `originali/`, `grandi/`, `mini/`. I file sono serviti da
  route (`/api/galleria/...`) e **non** da una cartella statica, così una foto
  nascosta resta davvero nascosta.
- Controllo del tipo vero del file (non solo l'estensione), limite di peso per
  foto (~25 MB) e limite di caricamenti per IP (largo: in sala molti invitati
  condividono il Wi-Fi).
- Tabella `galleria_foto` (file, dimensioni, autore, nascosta, data) e colonne
  `config.galleria_abilitata` / `config.galleria_caricamenti`, aggiunte col
  solito `ALTER TABLE` protetto in `db.js`.
- ZIP degli originali generato in streaming (nuova dipendenza `archiver`), senza
  tenerlo tutto in memoria.
- Backup delle foto: li fa la NAS (snapshot/backup suoi); `backup.sh` resta
  solo per il database.
- Nginx Proxy Manager: aggiungere `foto$` e `api/galleria/` alla whitelist.

### Dove siamo arrivati (2026-11-27) — da riprendere da qui
**La galleria è scritta** (server, pagina `/foto`, pagina Galleria degli sposi, QR e interruttori in Landing → QR) e provata in locale con Playwright; la NAS è pronta e montata.

> Il repository è **pubblico**: qui niente IP, nomi di pool o altri dettagli
> della rete di casa. Chi riprende li chiede all'utente.

NAS **TrueNAS SCALE**, fatto:
- [x] dataset dedicato `matrimonio-foto` (quota 200 GiB, proprietario e gruppo
      `matrimonio`, permessi "Altro" a zero)
- [x] utente di servizio `matrimonio`: password disabilitata, non è utente SMB
      (nessun accesso SMB), nessun gruppo ausiliario, shell `nologin`. La home
      resta sul dataset: va bene, perché "Altro" non ha permessi. Non metterla
      in `/var/empty`: TrueNAS ne cambierebbe i permessi di sistema.
- [x] condivisione **NFS** del dataset, solo per l'IP della VM del server,
      Mapall User/Group = `matrimonio`; servizio NFS acceso e con avvio
      automatico
- [x] snapshot giornaliero (00:00, conservato 2 settimane): è il backup delle foto
- [x] accesso SMB di `matrimonio` dato per verificato (autenticazione Samba: No)

Sulla **VM del server**, fatto:
- [x] cartella montata in `/mnt/foto-matrimonio` via NFS, permanente in
      `/etc/fstab` (`_netdev,nofail,soft,timeo=150,retrans=2`); i file creati
      risultano di `matrimonio` (UID 3002), non di root
- [x] file di controllo `.galleria-nas` creato nella cartella

**Disco di sistema della VM pieno (risolto, da verificare)**: `/` era al 100%
per colpa della build cache di Docker (44 GB, creata da `docker compose build
--no-cache` a ogni aggiornamento). Svuotata con `docker builder prune -a -f`;
`update.sh` ora la pulisce da solo a fine aggiornamento. Mai `docker system prune
--volumes` né `docker volume prune`: il database sta in un volume. Controllare
con `df -h /` che lo spazio sia tornato libero.

### Galleria foto: messa in produzione
Provato in locale: caricamento da telefono (iPhone emulato), versioni grande/miniatura,
rifiuto di file non-foto, lightbox con "indietro", nome ricordato, nascondi/elimina,
ZIP, modalità NAS con e senza `.galleria-nas`. **Non provato dentro Docker** (qui non c'è).
1. Sulla VM, nel `.env` accanto a `docker-compose.yml`: `GALLERIA_DIR=/mnt/foto-matrimonio`.
2. `sudo bash update.sh` (ricostruisce l'immagine: nuova dipendenza `archiver`; se
   `npm ci` si lamenta del lockfile, rigenerarlo in Linux — è stato aggiornato da Windows).
3. Nginx Proxy Manager: aggiungere `foto$` e `api/galleria/` alla whitelist (sopra).
4. In Landing → QR accendere "Galleria attiva", stampare il cartello, provare un
   caricamento da telefono vero (HEIC su iPhone, foto scattata in verticale).
5. Dopo il matrimonio: spegnere "Caricamenti aperti" e scaricare lo ZIP dalla pagina Galleria.

### Decisioni sulla galleria prese in fase di scrittura
- Il nome di chi carica **si ricorda sul telefono** (`localStorage`), scelta dell'utente.
- La galleria è la pagina principale: foto a righe che mantengono la proporzione, dal più recente; il caricamento è un pannello aperto da un pulsante fisso (scelta dell'utente: meglio una sola pagina e un solo QR che due pagine).
- **Nome e cognome obbligatori** (sposi: serve per ringraziare). Non si può verificare che siano veri; nella pagina Galleria degli sposi ogni autore mostra quante foto ha caricato e se il nome è nella lista ospiti.
- La pagina si aggiorna ogni 30 secondi e quando si torna sulla scheda.
- Il pubblico scarica la versione grande (2048 px); l'originale solo gli sposi.

### Ancora da chiarire con l'utente
- Spazio: ~5 MB a foto con originale; 150 invitati × 20 foto ≈ 15 GB.

## Idee messe da parte (non richieste)
- Trascinare una persona sulla sedia (drag & drop): rimandato, il tocco basta.
- Pulizia dei branch vecchi su GitHub (`trova-tavolo`,
  `claude/wedding-management-app-szun2g`): sono già tutti dentro `main`,
  si possono cancellare con l'ok dell'utente.
