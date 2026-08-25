# 💍 GestioneMatrimonio

App web self-hosted per organizzare un matrimonio: budget, fornitori, invitati, tavoli, timeline della giornata, checklist e una pagina pubblica di conferma presenza (RSVP) per gli invitati.

Progetto personale di Vale e Nino, pensato per essere installato ed eseguito sul proprio server (VPS/Raspberry/PC), senza dipendere da servizi terzi a pagamento.

## Funzionalità

### Ospiti & logistica
- **Lista ospiti** con nucleo familiare: ogni invitato principale può avere un partner e dei figli collegati, ciascuno con la propria risposta RSVP e le proprie intolleranze/allergie. Filtri, ricerca, azioni multiple (cambio RSVP, assegnazione tavolo, eliminazione), export PDF.
- **Tavoli**: gestione capienza/occupazione, assegnazione ospiti, vista "senza tavolo", export PDF del piano tavoli e dei segnaposti stampabili.
- **Inviti**: generatore di inviti stampabili con 4 temi grafici, esportati in PDF (formato A5), interamente lato client.

### Fornitori & budget
- **Fornitori**: rubrica per categoria (fotografo, catering, location, ecc.) con stato della trattativa.
- **Preventivi**: tracciamento preventivi ricevuti, stato (in attesa / accettato / rifiutato), scadenze.
- **Budget & Costi**: importo preventivato vs. effettivo, stato pagamento, grafico comparativo, export PDF con riepilogo per categoria.

### Organizzazione
- **Checklist**: lista di attività predefinita, raggruppata per fase temporale (da 12+ mesi al giorno del matrimonio), con evidenza della fase corrente in base al countdown.
- **Scadenze**: scadenze manuali unite automaticamente a quelle generate da preventivi in sospeso, viaggi da prenotare e pagamenti non saldati — un'unica vista aggiornata senza doppio inserimento.
- **Cronologia**: timeline oraria della giornata del matrimonio (cerimonia, ricevimento, foto, ecc.), esportabile in PDF.

### Altro
- **Location**: valutazione e confronto delle location.
- **Documenti**: archivio file (contratti, preventivi, ecc.) con anteprima e download.
- **Idee**: moodboard con embed automatico di link YouTube/Spotify/immagini.
- **Regali & Viaggio di nozze**: registro regali ricevuti (con promemoria ringraziamenti) e organizzazione del viaggio di nozze.
- **Dashboard**: riepilogo generale (budget rimasto, ospiti confermati, scadenze imminenti, prossimo step suggerito in base al countdown) e note veloci condivise tra gli sposi.

### Pagina pubblica per gli invitati
- **Conferma presenza (RSVP)**: pagina pubblica (`/conferma`) dove l'invitato cerca il proprio nome, conferma o declina la partecipazione — anche per partner e figli — e segnala allergie/intolleranze. Può essere disattivata dalle Impostazioni.
- **Landing page** (`/wedding`): pagina pubblica personalizzabile (5 temi colore) con countdown, informazioni su location, programma e dress code, editabile dalle Impostazioni con generazione di QR code pronti da stampare.

### Notifiche email (opzionali)
- Configurazione SMTP direttamente dall'app (Impostazioni → Email), nessun file di configurazione da modificare.
- Promemoria automatico delle scadenze imminenti, con frequenza e anticipo configurabili.
- Notifica via email quando viene aggiunta una nota veloce in Dashboard.

## Stack tecnologico

- **Frontend**: React 19, Vite, React Router, Tailwind CSS, Recharts (grafici), jsPDF/html2canvas (export PDF), Axios.
- **Backend**: Node.js, Express, SQLite (`better-sqlite3`), JWT per l'autenticazione, Nodemailer per le email.
- **Deploy**: Docker (build multi-stage, frontend + backend in un unico container).

## Avvio in locale (sviluppo)

Requisiti: Node.js 22+.

```bash
npm install               # dipendenze root (serve "concurrently" per npm run dev)
npm run install:all      # installa le dipendenze di server e client
```

Crea `server/.env` a partire da `.env.example` e imposta un `JWT_SECRET` (es. `openssl rand -hex 32`):

```bash
cp .env.example server/.env
```

> Il file va messo dentro `server/`, non nella root: gli script npm entrano nella cartella `server` prima di avviare il processo, quindi è lì che viene cercato il `.env`.

Avvia frontend e backend insieme:

```bash
npm run dev
```

- Client (Vite): http://localhost:5173
- API: http://localhost:3001 (proxata automaticamente dal client in dev)

Al primo avvio il database SQLite viene creato automaticamente con due utenti di default:

| Username | Password |
|---|---|
| `sposo` | `sposo1` |
| `sposa` | `sposa1` |

**Cambia queste credenziali dalle Impostazioni subito dopo il primo accesso.**

## Deploy in produzione (Docker)

Su una VPS Ubuntu con accesso root, installazione guidata in un comando:

```bash
sudo bash install.sh
```

Lo script installa Docker se necessario, configura il firewall, clona il repository, genera un `.env` con `JWT_SECRET` casuale, builda l'immagine e avvia il container. L'app sarà raggiungibile su `http://<ip-server>/`.

Per aggiornare un'installazione esistente:

```bash
cd /opt/matrimonio && sudo bash update.sh
```

In alternativa, con Docker Compose già disponibile:

```bash
cp .env.example .env   # imposta JWT_SECRET
docker compose build
docker compose up -d
```

I dati (database SQLite e file caricati) sono persistiti in volumi Docker (`matrimonio_db`, `matrimonio_uploads`) e sopravvivono a rebuild/aggiornamenti del container.

## Configurazione

Tutta la configurazione applicativa (nome app, emoji, data del matrimonio, budget, temi della landing page, SMTP, promemoria) si gestisce dall'interno dell'app, sezione **Impostazioni** — non richiede di toccare file o variabili d'ambiente oltre al `JWT_SECRET` iniziale.
