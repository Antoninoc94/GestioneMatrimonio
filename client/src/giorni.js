// Giorni di calendario da oggi a una data "YYYY-MM-DD" (0 = oggi, 1 = domani,
// negativo = passata). Unico calcolo per tutte le pagine: prima la Dashboard
// arrotondava per eccesso e la pagina Wedding per difetto, e segnavano un
// giorno di differenza. "Oggi" è la data locale del dispositivo, non quella
// UTC (che fra mezzanotte e le due di notte in Italia è ancora ieri); i conti
// si fanno a mezzogiorno UTC per non inciampare nell'ora legale.
export const oggiLocale = () => new Date().toLocaleDateString('sv-SE');

export const giorniA = data => {
  if (!data) return null;
  const t = Date.parse(`${String(data).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.parse(`${oggiLocale()}T12:00:00Z`)) / 86400000);
};
