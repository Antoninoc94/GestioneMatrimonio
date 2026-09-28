import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Rete di sicurezza: una chiamata al server fallita che nessuna pagina gestisce
// (molti salvataggi non hanno un catch) altrimenti non mostrerebbe nulla, e il
// click sembrerebbe semplicemente non funzionare. Le pagine che gestiscono
// l'errore da sé non arrivano qui. I 401 li gestisce già api.js col redirect.
// Solo scritture: un caricamento (GET) fallito non deve aprire un popup per
// ogni richiesta della pagina.
window.addEventListener('unhandledrejection', e => {
  const err = e.reason;
  if (!err?.isAxiosError || err.response?.status === 401) return;
  if ((err.config?.method || 'get').toLowerCase() === 'get') return;
  alert(err.response?.data?.error || 'Operazione non riuscita: il server non ha risposto. Controlla la connessione e riprova.');
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
