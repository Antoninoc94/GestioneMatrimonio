import { useEffect, useState } from 'react';
import { Heart, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const formatData = d => {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  const mesi = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${parseInt(g)} ${mesi[parseInt(m)-1]} ${y}`;
};

export default function Conferma() {
  const [info, setInfo] = useState(null);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [errore, setErrore] = useState('');
  const [ospite, setOspite] = useState(null);
  const [rsvp, setRsvp] = useState(null);
  const [intolleranze, setIntolleranze] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [inviato, setInviato] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/conferma/info').then(r => setInfo(r.data)).catch(() => {});
  }, []);

  const trova = async e => {
    e.preventDefault();
    if (!nome.trim()) return;
    setErrore('');
    setLoading(true);
    try {
      const r = await api.get('/conferma/trova', { params: { nome: nome.trim(), cognome: cognome.trim() } });
      const o = r.data;
      setOspite(o);
      setRsvp(o.rsvp === 'confermato' || o.rsvp === 'declinato' ? o.rsvp : null);
      setIntolleranze(o.intolleranze || '');
      setMessaggio('');
    } catch {
      setErrore('Non abbiamo trovato il tuo nome nella lista. Controlla di aver scritto correttamente o contattaci direttamente.');
    } finally {
      setLoading(false);
    }
  };

  const invia = async () => {
    if (!rsvp) return;
    setLoading(true);
    try {
      await api.post(`/conferma/${ospite.id}`, { rsvp, intolleranze, messaggio_ospite: messaggio });
      setInviato(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOspite(null); setRsvp(null); setIntolleranze(''); setMessaggio('');
    setNome(''); setCognome(''); setErrore(''); setInviato(false);
  };

  const nomeSposi = info ? `${info.nome_sposo1 || ''} & ${info.nome_sposo2 || ''}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex flex-col">
      {/* Header */}
      <header className="text-center pt-10 pb-6 px-4">
        <div className="text-4xl mb-2">{info?.app_emoji || '💍'}</div>
        <h1 className="text-2xl font-bold text-gray-900">{nomeSposi || 'Il Nostro Matrimonio'}</h1>
        {info?.data_matrimonio && (
          <p className="text-rose-500 font-medium mt-1">{formatData(info.data_matrimonio)}</p>
        )}
        <p className="text-gray-500 text-sm mt-3">Conferma la tua presenza al nostro matrimonio</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-12">
        <div className="w-full max-w-md">

          {/* Step 3: Inviato */}
          {inviato && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: rsvp === 'confermato' ? '#dcfce7' : '#fee2e2' }}>
                {rsvp === 'confermato'
                  ? <CheckCircle size={40} className="text-green-500" />
                  : <XCircle size={40} className="text-red-400" />}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {rsvp === 'confermato' ? 'Ci vediamo al matrimonio!' : 'Risposta registrata'}
              </h2>
              <p className="text-gray-500 text-sm mb-1">
                {ospite.cognome ? `${ospite.cognome} ${ospite.nome}` : ospite.nome}
              </p>
              {rsvp === 'confermato'
                ? <p className="text-gray-500 text-sm">Non vediamo l'ora di festeggiare con te!</p>
                : <p className="text-gray-500 text-sm">Ci dispiace non poter festeggiare con te, grazie per averci avvisato.</p>
              }
              <button onClick={reset}
                className="mt-8 text-sm text-rose-500 underline underline-offset-2">
                Invia un'altra risposta
              </button>
            </div>
          )}

          {/* Step 2: Conferma */}
          {!inviato && ospite && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
              <button onClick={() => { setOspite(null); setRsvp(null); setErrore(''); }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
                <ArrowLeft size={14} /> Indietro
              </button>

              <h2 className="font-bold text-gray-900 text-lg mb-1">
                {ospite.cognome ? `${ospite.cognome} ${ospite.nome}` : ospite.nome}
              </h2>
              <p className="text-sm text-gray-500 mb-5">Seleziona la tua risposta</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button onClick={() => setRsvp('confermato')}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all flex flex-col items-center gap-1
                    ${rsvp === 'confermato'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
                  <CheckCircle size={22} />
                  Ci sono!
                </button>
                <button onClick={() => setRsvp('declinato')}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all flex flex-col items-center gap-1
                    ${rsvp === 'declinato'
                      ? 'border-red-400 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500 hover:border-red-300'}`}>
                  <XCircle size={22} />
                  Non posso
                </button>
              </div>

              {rsvp === 'confermato' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allergie o intolleranze alimentari
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    placeholder="Es: celiaco, lattosio, frutta a guscio... (lascia vuoto se nessuna)"
                    value={intolleranze}
                    onChange={e => setIntolleranze(e.target.value)}
                  />
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Un messaggio per gli sposi <span className="text-gray-400 font-normal">(opzionale)</span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                  rows={3}
                  placeholder="Scrivi un pensiero..."
                  value={messaggio}
                  onChange={e => setMessaggio(e.target.value)}
                />
              </div>

              <button
                onClick={invia}
                disabled={!rsvp || loading}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-40"
                style={{ background: !rsvp ? '#d1d5db' : rsvp === 'confermato' ? '#e11d48' : '#6b7280' }}>
                {loading ? 'Invio in corso...' : 'Invia risposta'}
              </button>
            </div>
          )}

          {/* Step 1: Inserisci nome */}
          {!inviato && !ospite && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-1">Inserisci il tuo nome</h2>
              <p className="text-xs text-gray-400 mb-4">Esattamente come appare sull'invito</p>
              <form onSubmit={trova} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    placeholder="Es: Mario"
                    value={nome}
                    onChange={e => { setNome(e.target.value); setErrore(''); }}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    placeholder="Es: Rossi"
                    value={cognome}
                    onChange={e => { setCognome(e.target.value); setErrore(''); }}
                  />
                </div>
                {errore && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errore}</p>
                )}
                <button type="submit" disabled={loading || !nome.trim()}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-40">
                  {loading ? 'Ricerca...' : 'Continua'}
                </button>
              </form>
            </div>
          )}

        </div>
      </main>

      <footer className="text-center pb-6 text-xs text-gray-300 flex items-center justify-center gap-1">
        <Heart size={10} fill="currentColor" /> fatto con amore
      </footer>
    </div>
  );
}
