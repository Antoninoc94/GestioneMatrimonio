import { useEffect, useState } from 'react';
import { Heart, CheckCircle, XCircle, ArrowLeft, Plus, Trash2, Users, User } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

const formatData = d => {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  const mesi = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${parseInt(g)} ${mesi[parseInt(m)-1]} ${y}`;
};

const emptyFiglio = () => ({ nome: '', eta: '', intolleranze: '' });

const BtnRsvp = ({ value, current, onChange }) => (
  <button type="button" onClick={() => onChange(value)}
    className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all flex flex-col items-center gap-1
      ${current === value
        ? value === 'confermato' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-600'
        : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
  {value === 'confermato' ? <><CheckCircle size={20} />Ci sono!</> : <><XCircle size={20} />Non posso</>}
  </button>
);

export default function Conferma() {
  const [info, setInfo] = useState(null);

  // Step 1
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [errore, setErrore] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2
  const [ospite, setOspite] = useState(null);
  const [rsvp, setRsvp] = useState(null);
  const [intolleranze, setIntolleranze] = useState('');
  const [messaggio, setMessaggio] = useState('');

  // Partner
  const [conPartner, setConPartner] = useState(false);
  const [partnerNome, setPartnerNome] = useState('');
  const [partnerCognome, setPartnerCognome] = useState('');

  // Figli
  const [conFigli, setConFigli] = useState(false);
  const [figli, setFigli] = useState([emptyFiglio()]);

  // Step 3
  const [inviato, setInviato] = useState(false);
  const [disabilitata, setDisabilitata] = useState(false);

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
      setConPartner(false); setPartnerNome(''); setPartnerCognome('');
      setConFigli(false); setFigli([emptyFiglio()]);
    } catch (err) {
      if (err.response?.data?.disabilitata) {
        setDisabilitata(true);
      } else {
        setErrore('Errore di connessione. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  const aggFiglio = () => setFigli(f => [...f, emptyFiglio()]);
  const rimuoviFiglio = i => setFigli(f => f.filter((_, idx) => idx !== i));
  const updateFiglio = (i, field, val) => setFigli(f => f.map((fig, idx) => idx === i ? { ...fig, [field]: val } : fig));

  const canSubmit = rsvp && (!conFigli || figli.every(f => f.nome.trim()));

  const invia = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.post('/conferma/rispondi', {
        id: ospite.id || null,
        nome: ospite.nome,
        cognome: ospite.cognome,
        rsvp,
        intolleranze,
        messaggio_ospite: messaggio,
        partner: conPartner ? { nome: partnerNome, cognome: partnerCognome, rsvp: 'confermato' } : null,
        figli: conFigli ? figli.filter(f => f.nome.trim()) : [],
      });
      setInviato(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOspite(null); setRsvp(null); setIntolleranze(''); setMessaggio('');
    setNome(''); setCognome(''); setErrore(''); setInviato(false);
    setConPartner(false); setPartnerNome(''); setPartnerCognome('');
    setConFigli(false); setFigli([emptyFiglio()]);
  };

  const nomeSposi = info ? `${info.nome_sposo1 || ''} & ${info.nome_sposo2 || ''}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex flex-col">
      <header className="text-center pt-10 pb-6 px-4">
        <div className="text-4xl mb-2">{info?.app_emoji || '💍'}</div>
        <h1 className="text-2xl font-bold text-gray-900">{nomeSposi || 'Il Nostro Matrimonio'}</h1>
        {info?.data_matrimonio && <p className="text-rose-500 font-medium mt-1">{formatData(info.data_matrimonio)}</p>}
        <p className="text-gray-500 text-sm mt-3">Conferma la tua presenza al nostro matrimonio</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-12">
        <div className="w-full max-w-md space-y-3">

          {/* ── Pagina disabilitata ── */}
          {disabilitata && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🔒</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Pagina non disponibile</h2>
              <p className="text-gray-400 text-sm">La conferma presenze è momentaneamente chiusa. Contatta gli sposi per maggiori informazioni.</p>
            </div>
          )}

          {/* ── Step 3: Inviato ── */}
          {inviato && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: rsvp === 'confermato' ? '#dcfce7' : '#fee2e2' }}>
                {rsvp === 'confermato' ? <CheckCircle size={40} className="text-green-500" /> : <XCircle size={40} className="text-red-400" />}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {rsvp === 'confermato' ? 'Ci vediamo al matrimonio!' : 'Risposta registrata'}
              </h2>
              <p className="text-gray-500 text-sm mb-1">{ospite.cognome ? `${ospite.cognome} ${ospite.nome}` : ospite.nome}</p>
              {conPartner && partnerNome && (
                <p className="text-gray-400 text-xs mt-1">
                  {partnerNome} {partnerCognome}: presente
                </p>
              )}
              {conFigli && figli.filter(f => f.nome).length > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  {figli.filter(f => f.nome).length} {figli.filter(f => f.nome).length === 1 ? 'figlio' : 'figli'} registrati
                </p>
              )}
              {rsvp === 'confermato'
                ? <p className="text-gray-500 text-sm mt-3">Non vediamo l'ora di festeggiare con te!</p>
                : <p className="text-gray-500 text-sm mt-3">Ci dispiace non poter festeggiare con te, grazie per averci avvisato.</p>}
              <button onClick={reset} className="mt-8 text-sm text-rose-500 underline underline-offset-2">
                Invia un'altra risposta
              </button>
            </div>
          )}

          {/* ── Step 2: Form conferma ── */}
          {!inviato && ospite && (
            <>
              {/* Risposta principale */}
              <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
                <button onClick={() => { setOspite(null); setErrore(''); }}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
                  <ArrowLeft size={14} /> Indietro
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <User size={16} className="text-rose-400" />
                  <h2 className="font-bold text-gray-900 text-lg">
                    {ospite.cognome ? `${ospite.cognome} ${ospite.nome}` : ospite.nome}
                  </h2>
                </div>
                <p className="text-sm text-gray-400 mb-4">La tua risposta</p>
                <div className="flex gap-3 mb-4">
                  <BtnRsvp value="confermato" current={rsvp} onChange={setRsvp} />
                  <BtnRsvp value="declinato" current={rsvp} onChange={setRsvp} />
                </div>
                {rsvp === 'confermato' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Allergie o intolleranze</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                      placeholder="Es: celiaco, lattosio... (lascia vuoto se nessuna)"
                      value={intolleranze} onChange={e => setIntolleranze(e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Messaggio per gli sposi <span className="text-gray-400 font-normal">(opzionale)</span>
                  </label>
                  <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                    rows={2} placeholder="Scrivi un pensiero..."
                    value={messaggio} onChange={e => setMessaggio(e.target.value)} />
                </div>
              </div>

              {/* Sezione partner */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <button type="button" onClick={() => setConPartner(v => !v)}
                  className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-rose-400" />
                    <span className="font-medium text-gray-700 text-sm">Viene anche il/la tuo/a partner?</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${conPartner ? 'bg-rose-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${conPartner ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>
                {conPartner && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                          placeholder="Es: Laura"
                          value={partnerNome} onChange={e => setPartnerNome(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cognome</label>
                        <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                          placeholder="Es: Bianchi"
                          value={partnerCognome} onChange={e => setPartnerCognome(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sezione figli */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <button type="button" onClick={() => setConFigli(v => !v)}
                  className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart size={16} className="text-rose-400" />
                    <span className="font-medium text-gray-700 text-sm">Vieni con figli?</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${conFigli ? 'bg-rose-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${conFigli ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>
                {conFigli && (
                  <div className="mt-4 space-y-3">
                    {figli.map((f, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-500">Figlio {i + 1}</span>
                          {figli.length > 1 && (
                            <button type="button" onClick={() => rimuoviFiglio(i)}
                              className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                            <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
                              placeholder="Nome"
                              value={f.nome} onChange={e => updateFiglio(i, 'nome', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Eta</label>
                            <input type="number" min="0" max="17"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
                              placeholder="anni"
                              value={f.eta} onChange={e => updateFiglio(i, 'eta', e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Allergie o intolleranze</label>
                          <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
                            placeholder="Es: lattosio (lascia vuoto se nessuna)"
                            value={f.intolleranze} onChange={e => updateFiglio(i, 'intolleranze', e.target.value)} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={aggFiglio}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-rose-300 hover:text-rose-400 transition-colors flex items-center justify-center gap-1">
                      <Plus size={14} /> Aggiungi figlio
                    </button>
                  </div>
                )}
              </div>

              {/* Bottone invio */}
              <button onClick={invia} disabled={!canSubmit || loading}
                className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-40 bg-rose-500 hover:bg-rose-600">
                {loading ? 'Invio in corso...' : 'Invia risposta'}
              </button>
            </>
          )}

          {/* ── Step 1: Inserisci nome ── */}
          {!inviato && !ospite && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-1">Inserisci il tuo nome</h2>
              <p className="text-xs text-gray-400 mb-4">Esattamente come appare sull'invito</p>
              <form onSubmit={trova} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    placeholder="Es: Mario"
                    value={nome} onChange={e => { setNome(e.target.value); setErrore(''); }}
                    autoFocus required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    placeholder="Es: Rossi"
                    value={cognome} onChange={e => { setCognome(e.target.value); setErrore(''); }} />
                </div>
                {errore && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errore}</p>}
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
