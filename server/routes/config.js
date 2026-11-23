const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { aggiornaNomiSposi } = require('../sposi');

const normalizzaIban = v => String(v ?? '').replace(/\s+/g, '').toUpperCase();
// Controllo ISO 13616 (mod 97): le prime quattro cifre in coda, lettere → numeri.
function ibanValido(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const numerico = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
  let resto = 0;
  for (const ch of numerico) resto = (resto * 10 + Number(ch)) % 97;
  return resto === 1;
}

// Pubblico: solo dati estetici (per login page)
router.get('/public', (req, res) => {
  const cfg = db.prepare('SELECT app_name, app_emoji, login_subtitle FROM config LIMIT 1').get();
  res.json(cfg || { app_name: 'Il Nostro Matrimonio', app_emoji: '💍', login_subtitle: '' });
});

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

router.put('/', auth, (req, res) => {
  const b = req.body;
  // Un IBAN sbagliato di una cifra manda i bonifici degli invitati a vuoto:
  // si accetta solo se la cifra di controllo torna.
  if ('regalo_iban' in b) {
    b.regalo_iban = normalizzaIban(b.regalo_iban);
    if (b.regalo_iban && !ibanValido(b.regalo_iban)) {
      return res.status(400).json({ error: "L'IBAN non è valido: controlla di averlo copiato per intero" });
    }
  }
  if ('regalo_link' in b) {
    const l = String(b.regalo_link ?? '').trim();
    b.regalo_link = !l || /^https?:\/\//i.test(l) ? l : `https://${l}`;
  }
  // Ritorna il valore trasformato se la chiave è presente nel body,
  // altrimenti undefined → SQLite lo tratta come NULL → COALESCE preserva il valore esistente
  const p = (k, fn) => k in b ? fn(b[k]) : undefined;
  const toBool = v => (v === false || v === 0 ? 0 : 1);

  db.prepare(`UPDATE config SET
    data_matrimonio=COALESCE(?,data_matrimonio),
    budget_totale=COALESCE(?,budget_totale),
    nome_sposo1=COALESCE(?,nome_sposo1),
    nome_sposo2=COALESCE(?,nome_sposo2),
    app_name=COALESCE(?,app_name),
    app_emoji=COALESCE(?,app_emoji),
    login_subtitle=COALESCE(?,login_subtitle),
    conferma_abilitata=COALESCE(?,conferma_abilitata),
    landing_abilitata=COALESCE(?,landing_abilitata),
    landing_messaggio=COALESCE(?,landing_messaggio),
    landing_dress_code=COALESCE(?,landing_dress_code),
    landing_info_pratiche=COALESCE(?,landing_info_pratiche),
    landing_tema=COALESCE(?,landing_tema),
    landing_foto_posizione=COALESCE(?,landing_foto_posizione),
    soglia_eta_bambino=COALESCE(?,soglia_eta_bambino),
    url_pubblico=COALESCE(?,url_pubblico),
    messaggio_whatsapp=COALESCE(?,messaggio_whatsapp),
    messaggio_ringraziamento=COALESCE(?,messaggio_ringraziamento),
    viaggio_destinazione=COALESCE(?,viaggio_destinazione),
    viaggio_partenza=COALESCE(?,viaggio_partenza),
    viaggio_ritorno=COALESCE(?,viaggio_ritorno),
    viaggio_budget=COALESCE(?,viaggio_budget),
    regalo_abilitato=COALESCE(?,regalo_abilitato),
    regalo_titolo=COALESCE(?,regalo_titolo),
    regalo_messaggio=COALESCE(?,regalo_messaggio),
    regalo_iban=COALESCE(?,regalo_iban),
    regalo_intestatario=COALESCE(?,regalo_intestatario),
    regalo_banca=COALESCE(?,regalo_banca),
    regalo_causale=COALESCE(?,regalo_causale),
    regalo_link=COALESCE(?,regalo_link),
    regalo_link_testo=COALESCE(?,regalo_link_testo),
    conferma_scadenza=COALESCE(?,conferma_scadenza),
    invito_tema=COALESCE(?,invito_tema),
    invito_ora_cerimonia=COALESCE(?,invito_ora_cerimonia),
    invito_luogo_cerimonia=COALESCE(?,invito_luogo_cerimonia),
    invito_indirizzo_cerimonia=COALESCE(?,invito_indirizzo_cerimonia),
    invito_ora_ricevimento=COALESCE(?,invito_ora_ricevimento),
    invito_luogo_ricevimento=COALESCE(?,invito_luogo_ricevimento),
    invito_indirizzo_ricevimento=COALESCE(?,invito_indirizzo_ricevimento),
    invito_rsvp_entro=COALESCE(?,invito_rsvp_entro),
    invito_rsvp_telefono=COALESCE(?,invito_rsvp_telefono),
    invito_messaggio_apertura=COALESCE(?,invito_messaggio_apertura),
    invito_messaggio_chiusura=COALESCE(?,invito_messaggio_chiusura),
    updated_at=datetime('now')`)
    .run(
      p('data_matrimonio', v => v || null),
      p('budget_totale', v => parseFloat(v) || 0),
      p('nome_sposo1', v => v || null),
      p('nome_sposo2', v => v || null),
      p('app_name', v => v || 'Il Nostro Matrimonio'),
      p('app_emoji', v => v || '💍'),
      p('login_subtitle', v => v ?? ''),
      p('conferma_abilitata', toBool),
      p('landing_abilitata', toBool),
      p('landing_messaggio', v => v ?? ''),
      p('landing_dress_code', v => v ?? ''),
      p('landing_info_pratiche', v => v ?? ''),
      p('landing_tema', v => v || 'rose'),
      p('landing_foto_posizione', v => v || 'center top'),
      p('soglia_eta_bambino', v => parseInt(v) || 12),
      p('url_pubblico', v => (v ?? '').trim()),
      p('messaggio_whatsapp', v => v ?? ''),
      p('messaggio_ringraziamento', v => v ?? ''),
      p('viaggio_destinazione', v => (v ?? '').trim()),
      // '' e non NULL quando si toglie la data, altrimenti COALESCE la terrebbe.
      p('viaggio_partenza', v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '')),
      p('viaggio_ritorno', v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '')),
      // 0 = nessun budget (COALESCE non permetterebbe di tornare a NULL).
      p('viaggio_budget', v => Math.max(parseFloat(v) || 0, 0)),
      p('regalo_abilitato', v => (v === true || v === 1 ? 1 : 0)),
      p('regalo_titolo', v => v ?? ''),
      p('regalo_messaggio', v => v ?? ''),
      p('regalo_iban', v => v ?? ''),
      p('regalo_intestatario', v => v ?? ''),
      p('regalo_banca', v => v ?? ''),
      p('regalo_causale', v => v ?? ''),
      p('regalo_link', v => v ?? ''),
      p('regalo_link_testo', v => v ?? ''),
      // '' e non NULL quando si toglie la data, altrimenti COALESCE la terrebbe.
      p('conferma_scadenza', v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '')),
      p('invito_tema', v => v || 'classico'),
      // `?? ''` e non `|| ''`: un campo svuotato a mano deve restare vuoto,
      // altrimenti COALESCE lo riporterebbe al valore precedente.
      p('invito_ora_cerimonia', v => v ?? ''),
      p('invito_luogo_cerimonia', v => v ?? ''),
      p('invito_indirizzo_cerimonia', v => v ?? ''),
      p('invito_ora_ricevimento', v => v ?? ''),
      p('invito_luogo_ricevimento', v => v ?? ''),
      p('invito_indirizzo_ricevimento', v => v ?? ''),
      p('invito_rsvp_entro', v => v ?? ''),
      p('invito_rsvp_telefono', v => v ?? ''),
      p('invito_messaggio_apertura', v => v ?? ''),
      p('invito_messaggio_chiusura', v => v ?? '')
    );

  // Se la soglia è cambiata, riallinea subito il tipo dei figli già esistenti
  // (senza aspettare che vengano riaperti e risalvati a mano).
  if ('soglia_eta_bambino' in b) {
    db.prepare(`
      UPDATE ospiti SET tipo = CASE
        WHEN eta >= (SELECT soglia_eta_bambino FROM config LIMIT 1) THEN 'adulto'
        ELSE 'bambino'
      END
      WHERE relazione = 'figlio' AND eta IS NOT NULL
    `).run();
  }

  // Gli sposi seduti al tavolo sposi portano i nomi delle Impostazioni.
  if ('nome_sposo1' in b || 'nome_sposo2' in b) aggiornaNomiSposi();

  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

module.exports = router;
