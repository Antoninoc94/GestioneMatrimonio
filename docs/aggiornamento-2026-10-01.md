# Aggiornamento del 1° ottobre 2026 — preventivi, budget, fasce bambini

Note per riprendere il lavoro da un altro PC.

## Cosa è stato fatto

Tre commit su `main` (`03b659b`, `2c0009f`, `a84d5a1`):

1. **Preventivi collegati alla location, con piano di pagamento**
   - Nel preventivo c'è il campo "Location" (oltre al fornitore); la scheda della location mostra i suoi preventivi e quanto resta da pagare.
   - L'anticipo singolo è sostituito da un elenco di **rate** (caparra, tranche, saldo): importo, scadenza, pagata sì/no con la data. Tabella `preventivi_rate`.
   - Gli anticipi già presenti diventano automaticamente la prima rata (pagata) al primo avvio.
   - Le rate non pagate dei preventivi **accettati** compaiono in Scadenze, in Dashboard e nelle email di promemoria.

2. **Budget collegato ai preventivi (opzione A)**
   - I preventivi accettati appaiono in Budget & Costi come voci automatiche in sola lettura: importo = impegnato, rate pagate = pagato. Non vengono copiati in `costi`.
   - In alto: Budget totale · Preventivato · Speso/impegnato · Pagato (con da pagare) · Rimasto dal budget.
   - La Dashboard conta come pagate anche le rate saldate.

3. **Fasce d'età dei bambini per location**
   - Ogni location ha un **prezzo a persona adulto** e le sue **fasce bambini** (da–a anni, in % del prezzo o € fissi). Tabella `location_fasce`.
   - Stima del costo sulla lista ospiti: **invitati** (esclusi quelli che hanno declinato) e **solo confermati**, con il dettaglio per fascia e quanto costerebbero i bambini se pagassero come adulti.
   - Bambini senza età: contati da adulto e segnalati.
   - Con almeno due location prezzate compare la tabella di confronto.
   - Endpoint: `GET /api/location/stime`.

## Deploy

`update.sh` sul server (fa il backup prima). Le migrazioni del database partono da sole al primo avvio.

## Decisioni prese

- Niente inserimento manuale delle voci di costo della location: il PDF del fornitore resta allegato al preventivo. Alla location si chiedono solo prezzo adulto e fasce.
- L'età è quella inserita in Lista Ospiti (meglio l'età al giorno del matrimonio); niente data di nascita.
- La soglia "bambino" nelle Impostazioni resta per i conteggi del menu, separata dalle fasce di prezzo.

## Da fare / da valutare

- Provare il tutto in produzione con i preventivi veri.
- Pulire eventuali voci manuali del Budget che duplicano un preventivo accettato.
- Eventuale idea futura: usare la stima della location come importo di partenza di un nuovo preventivo.
