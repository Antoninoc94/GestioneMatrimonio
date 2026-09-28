// Indirizzo con cui gli ospiti raggiungono /wedding e /conferma (config.url_pubblico).
// "antoninoevalentina.it/" → "https://antoninoevalentina.it". Vuoto: l'indirizzo
// da cui si sta usando l'app.
export const baseUrlPubblico = urlPubblico => {
  const v = (urlPubblico || '').trim().replace(/\/+$/, '');
  if (!v) return window.location.origin;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

export const MESSAGGIO_WHATSAPP_DEFAULT =
  'Ciao {nome}! 💍 Siamo felicissimi di invitarti al nostro matrimonio.\n\n' +
  'Qui trovi tutte le informazioni: {link_wedding}\n' +
  'E qui puoi confermare la tua presenza: {link_conferma}\n\n' +
  'Ti aspettiamo!';

// Link wa.me col messaggio già scritto. Numeri italiani senza prefisso
// (3xx…) ricevono +39; "00" iniziale vale come "+". null se il numero manca.
export const linkWhatsApp = (telefono, { nome, template, base }) => {
  let n = (telefono || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.length === 10 && n.startsWith('3')) n = `39${n}`;
  n = n.replace(/\D/g, '');
  if (n.length < 8) return null;
  const testo = (template || MESSAGGIO_WHATSAPP_DEFAULT)
    .replaceAll('{nome}', nome || '')
    .replaceAll('{link_wedding}', `${base}/wedding`)
    .replaceAll('{link_conferma}', `${base}/conferma`);
  return `https://wa.me/${n}?text=${encodeURIComponent(testo)}`;
};
