// Mappatura valori DB → etichette leggibili in italiano

export const statoPreventivo = {
  in_attesa: 'In attesa',
  in_valutazione: 'In valutazione',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
};

export const statoFornitore = {
  da_contattare: 'Da contattare',
  contattato: 'Contattato',
  preventivo_ricevuto: 'Prev. ricevuto',
  confermato: 'Confermato',
  escluso: 'Escluso',
};

export const statoLocation = {
  in_valutazione: 'In valutazione',
  visitato: 'Visitato',
  confermato: 'Confermato',
  escluso: 'Escluso',
};

export const prioritaLabel = {
  alta: 'Alta',
  media: 'Media',
  bassa: 'Bassa',
};

export const categoriaScadenza = {
  burocratico: 'Burocratico',
  fornitore: 'Fornitore',
  location: 'Location',
  abito: 'Abito',
  viaggio: 'Viaggio',
  altro: 'Altro',
};

// Funzione generica: restituisce la label o il valore originale se non mappato
export function label(map, value) {
  return map[value] ?? value;
}
