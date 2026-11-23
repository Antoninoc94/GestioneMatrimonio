export const CATEGORIE = ['documenti', 'salute', 'soldi', 'bagaglio', 'casa', 'altro'];
export const categoriaLabel = {
  documenti: '🛂 Documenti', salute: '💊 Salute', soldi: '💳 Soldi', bagaglio: '🧳 Bagaglio', casa: '🏠 Casa', altro: '📌 Altro',
};

export const oggi = () => new Date().toLocaleDateString('sv-SE');
export const fmtData = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Sei mesi dopo il rientro: la validità residua che molti paesi chiedono al passaporto.
export const seiMesiDopo = d => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + 6);
  return x.toISOString().slice(0, 10);
};

// Documenti che scadono prima del rientro, o meno di sei mesi dopo.
export function documentiInScadenza(checklist, ritorno, nomi) {
  if (!ritorno) return [];
  return checklist
    .filter(c => c.categoria === 'documenti' && c.data && c.data < seiMesiDopo(ritorno))
    .map(c => {
      const chi = c.persona ? ` di ${nomi[c.persona]}` : '';
      return {
        key: `doc${c.id}`, item: c, grave: c.data <= ritorno,
        testo: c.data <= ritorno
          ? `${c.testo}${chi} scade il ${fmtData(c.data)}, prima del rientro`
          : `${c.testo}${chi} scade il ${fmtData(c.data)}: molti paesi chiedono 6 mesi di validità dopo il rientro`,
      };
    });
}
