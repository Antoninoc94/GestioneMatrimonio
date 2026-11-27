// Colori delle pagine per gli invitati (/wedding, /tavolo), scelti in
// Impostazioni → Wedding (config.landing_tema).
export const TEMI = {
  rose:    { primary: '#be185d', light: '#fdf2f8', border: '#f9a8d4', text: '#9d174d', mid: '#ec4899', dark: '#831843' },
  lavanda: { primary: '#6d28d9', light: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6', mid: '#8b5cf6', dark: '#4c1d95' },
  salvia:  { primary: '#047857', light: '#ecfdf5', border: '#6ee7b7', text: '#065f46', mid: '#10b981', dark: '#064e3b' },
  cielo:   { primary: '#0369a1', light: '#f0f9ff', border: '#7dd3fc', text: '#075985', mid: '#0ea5e9', dark: '#0c4a6e' },
  oro:     { primary: '#b45309', light: '#fffbeb', border: '#fcd34d', text: '#92400e', mid: '#f59e0b', dark: '#78350f' },
  // Sfondo bianco pieno e scritte oro. Titoli e testi sono un oro scuro: quello
  // brillante (mid) sul bianco non si legge, quindi resta a ornamenti e icone.
  biancoro: { primary: '#9c7a1c', light: '#fdfaf3', border: '#e9d9ae', text: '#94731c', mid: '#c8a24a', dark: '#8b6914', bg: '#ffffff' },
};

// Biglietto di ringraziamento di "Trova il tuo tavolo", quando gli sposi non
// ne scrivono uno loro. `{nome}` diventa il nome dell'invitato.
export const GRAZIE_PREDEFINITO = 'Grazie di essere qui a festeggiare con noi questo giorno speciale. La tua presenza è il regalo più bello.';
