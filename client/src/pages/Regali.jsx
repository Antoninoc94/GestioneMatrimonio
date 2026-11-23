import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Gift, CheckCircle2, MessageCircle, Search, X, Users, PenLine, Undo2 } from 'lucide-react';
import api from '../api';
import { linkWhatsAppTesto } from '../publicUrl';

const TIPI = ['busta', 'bonifico', 'oggetto', 'lista_nozze', 'altro'];
const tipoLabel = { busta: '💰 Busta', bonifico: '🏦 Bonifico', oggetto: '🎁 Oggetto', lista_nozze: '📋 Lista nozze', altro: '🎀 Altro' };
const tipoColor = {
  busta: 'bg-green-100 text-green-700', bonifico: 'bg-emerald-100 text-emerald-700', oggetto: 'bg-blue-100 text-blue-700',
  lista_nozze: 'bg-purple-100 text-purple-700', altro: 'bg-gray-100 text-gray-600',
};
// Buste e bonifici sono soldi ricevuti; per il resto il valore è una stima.
const CONTANTI = ['busta', 'bonifico'];
// Quella che il server mette quando la descrizione resta vuota: non si ripete sulla scheda.
const DESCRIZIONE_DEFAULT = { busta: 'Busta', bonifico: 'Bonifico', oggetto: 'Regalo', lista_nozze: 'Lista nozze', altro: 'Regalo' };
const CANALI = ['whatsapp', 'biglietto', 'persona', 'telefono', 'email', 'altro'];
const canaleLabel = { whatsapp: 'WhatsApp', biglietto: 'Biglietto', persona: 'Di persona', telefono: 'Telefonata', email: 'Email', altro: 'Altro' };

// Niente emoji: passando dal link WhatsApp Web le può mostrare come "�".
const MESSAGGIO_RINGRAZIAMENTO_DEFAULT =
  'Ciao {nomi}! Grazie di cuore per il {tuo} regalo e per aver condiviso con noi questo giorno speciale.\n\n' +
  'Un abbraccio,\n{sposi}';

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) : '—';
const oggi = () => new Date().toLocaleDateString('sv-SE');
const dataBreve = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const nomeCompleto = o => [o.nome, o.cognome].filter(Boolean).join(' ');

// "Mario Rossi e Anna Bianchi · 2 figli", oppure il mittente libero.
function etichetta(r) {
  if (!r.membri?.length) return r.mittente || '—';
  const [capo, ...altri] = r.membri;
  const partner = altri.find(m => m.relazione === 'partner');
  const figli = altri.filter(m => m.relazione === 'figlio').length;
  let s = nomeCompleto(capo);
  if (partner) s += ` e ${partner.cognome && partner.cognome !== capo.cognome ? nomeCompleto(partner) : partner.nome}`;
  return figli ? `${s} · ${figli} ${figli === 1 ? 'figlio' : 'figli'}` : s;
}

// Per il saluto: i nomi degli adulti del nucleo ("Mario e Anna").
function nomiSaluto(r) {
  if (!r.membri?.length) return { nomi: r.mittente || '', plurale: false };
  const adulti = r.membri.filter((m, i) => i === 0 || m.relazione === 'partner').map(m => m.nome);
  const nomi = adulti.length > 1 ? `${adulti.slice(0, -1).join(', ')} e ${adulti.at(-1)}` : adulti[0];
  return { nomi, plurale: r.membri.length > 1 };
}

const empty = { ospite_id: '', mittente: '', descrizione: '', tipo: 'busta', valore_stimato: '', note: '', ringraziamento_inviato: false, canale_ringraziamento: '', data_ringraziamento: '' };

export default function Regali() {
  const [items, setItems] = useState([]);
  const [ospiti, setOspiti] = useState([]);
  const [cfg, setCfg] = useState({});
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [errore, setErrore] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [cerca, setCerca] = useState('');
  const [msgModal, setMsgModal] = useState(null);

  const load = () => api.get('/regali').then(r => setItems(r.data));
  useEffect(() => {
    load();
    api.get('/ospiti').then(r => setOspiti(r.data.filter(o => !o.sposo)));
    api.get('/config').then(r => setCfg(r.data || {}));
  }, []);

  const template = cfg.messaggio_ringraziamento || MESSAGGIO_RINGRAZIAMENTO_DEFAULT;
  const sposi = [cfg.nome_sposo1, cfg.nome_sposo2].filter(Boolean).join(' e ');
  const testoRingraziamento = (r, tpl = template) => {
    const { nomi, plurale } = nomiSaluto(r);
    return tpl.replaceAll('{nomi}', nomi).replaceAll('{tuo}', plurale ? 'vostro' : 'tuo')
      .replaceAll('{regalo}', r.descrizione?.toLowerCase() || 'regalo').replaceAll('{sposi}', sposi);
  };

  const openNew = () => { setForm(empty); setEditId(null); setErrore(''); setModal(true); };
  const openEdit = r => {
    setForm({
      ...empty, ...r, ospite_id: r.ospite_id || '', mittente: r.mittente || '', note: r.note || '',
      descrizione: r.descrizione === DESCRIZIONE_DEFAULT[r.tipo] ? '' : r.descrizione,
      valore_stimato: r.valore_stimato?.toString() || '', ringraziamento_inviato: !!r.ringraziamento_inviato,
      canale_ringraziamento: r.canale_ringraziamento || '', data_ringraziamento: r.data_ringraziamento || '',
    });
    setEditId(r.id); setErrore(''); setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/regali/${editId}`, form);
      else await api.post('/regali', form);
      setModal(false);
      load();
    } catch (err) {
      setErrore(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const del = async id => {
    if (!confirm('Eliminare questo regalo?')) return;
    await api.delete(`/regali/${id}`);
    load();
  };

  const segna = async (r, inviato, canale = null) => {
    const res = await api.post(`/regali/${r.id}/ringraziamento`, { ringraziamento_inviato: inviato, canale_ringraziamento: canale });
    setItems(list => list.map(x => x.id === r.id ? res.data : x));
  };

  // Apre WhatsApp col messaggio pronto; se poi l'ha inviato davvero non lo
  // sappiamo, quindi lo si chiede (come per gli inviti in Lista Ospiti).
  const ringraziaWhatsApp = r => {
    window.open(linkWhatsAppTesto(r.telefono, testoRingraziamento(r)), '_blank', 'noopener');
    if (confirm(`Hai inviato il ringraziamento a ${nomiSaluto(r).nomi} su WhatsApp? Lo segno come fatto.`)) segna(r, true, 'whatsapp');
  };

  const salvaMessaggio = async e => {
    e.preventDefault();
    // Uguale al predefinito: si salva vuoto, così segue eventuali modifiche future al testo predefinito.
    const valore = msgModal.trim() === MESSAGGIO_RINGRAZIAMENTO_DEFAULT ? '' : msgModal;
    await api.put('/config', { messaggio_ringraziamento: valore });
    setCfg(c => ({ ...c, messaggio_ringraziamento: valore }));
    setMsgModal(null);
  };

  const q = cerca.trim().toLowerCase();
  const filtered = items.filter(r =>
    (!filtroTipo || r.tipo === filtroTipo) &&
    (!filtroStato || (filtroStato === 'da' ? !r.ringraziamento_inviato : !!r.ringraziamento_inviato)) &&
    (!q || [etichetta(r), r.descrizione, r.note, ...(r.membri || []).map(nomeCompleto)].join(' ').toLowerCase().includes(q)));

  const contanti = items.filter(r => CONTANTI.includes(r.tipo));
  const oggetti = items.filter(r => !CONTANTI.includes(r.tipo));
  const totContanti = contanti.reduce((s, r) => s + (r.valore_stimato || 0), 0);
  const totOggetti = oggetti.reduce((s, r) => s + (r.valore_stimato || 0), 0);
  const ringraziati = items.filter(r => r.ringraziamento_inviato).length;
  const daRingraziare = items.length - ringraziati;

  const chip = (attivo, extra = 'bg-gray-100 text-gray-600') =>
    `badge px-3 py-1.5 cursor-pointer whitespace-nowrap ${attivo ? 'bg-rose-500 text-white' : extra}`;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Regali Ricevuti</h1>
          <p className="page-subtitle">{items.length} {items.length === 1 ? 'regalo' : 'regali'} · {daRingraziare === 0 ? 'nessun ringraziamento da fare' : `${daRingraziare} ${daRingraziare === 1 ? 'ringraziamento' : 'ringraziamenti'} da fare`}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button className="btn-secondary justify-center" onClick={() => setMsgModal(template)}><PenLine size={15} /> Messaggio</button>
          <button className="btn-primary justify-center" onClick={openNew}><Plus size={16} /> Regalo</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card py-3">
          <div className="text-xs text-gray-400">Regali</div>
          <div className="text-xl font-bold text-gray-800">{items.length}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-400">Ricevuti in denaro</div>
          <div className="text-xl font-bold text-green-700">{formatEuro(totContanti)}</div>
          <div className="text-xs text-gray-400">{contanti.length} tra buste e bonifici</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-400">Oggetti e lista</div>
          <div className="text-xl font-bold text-gray-800">{oggetti.length}</div>
          <div className="text-xs text-gray-400">{totOggetti ? `valore stimato ${formatEuro(totOggetti)}` : 'nessun valore stimato'}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-gray-400">Ringraziamenti</div>
          <div className="text-xl font-bold text-gray-800">{ringraziati}<span className="text-sm font-medium text-gray-400"> / {items.length}</span></div>
          <div className="h-1.5 rounded-full bg-gray-100 mt-1.5 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${items.length ? (ringraziati / items.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="card mb-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="form-input pl-9" placeholder="Cerca per nome, regalo, note…" value={cerca} onChange={e => setCerca(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          <button className={chip(!filtroStato)} onClick={() => setFiltroStato('')}>Tutti ({items.length})</button>
          <button className={chip(filtroStato === 'da', 'bg-amber-50 text-amber-700')} onClick={() => setFiltroStato(filtroStato === 'da' ? '' : 'da')}>Da ringraziare ({daRingraziare})</button>
          <button className={chip(filtroStato === 'fatto', 'bg-green-50 text-green-700')} onClick={() => setFiltroStato(filtroStato === 'fatto' ? '' : 'fatto')}>Ringraziati ({ringraziati})</button>
          <span className="border-l border-gray-200 mx-1" />
          {TIPI.filter(t => items.some(r => r.tipo === t)).map(t => (
            <button key={t} className={chip(filtroTipo === t, tipoColor[t])} onClick={() => setFiltroTipo(t === filtroTipo ? '' : t)}>{tipoLabel[t]}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Gift size={40} className="mx-auto mb-2 opacity-30" />
          <p>{items.length ? 'Nessun regalo corrisponde ai filtri.' : 'Nessun regalo registrato.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(r => {
            const wa = r.telefono ? linkWhatsAppTesto(r.telefono, '') : null;
            return (
              <div key={r.id} className={`card flex flex-col gap-2 ${r.ringraziamento_inviato ? '' : 'border-l-4 border-l-amber-300'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 leading-snug">{etichetta(r)}</h3>
                    {r.membri?.length > 1 ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Users size={11} /> {r.membri.map(m => m.nome).join(', ')}</p>
                    ) : !r.membri?.length && <p className="text-xs text-gray-400 mt-0.5">Non in lista ospiti</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => openEdit(r)} title="Modifica"><Pencil size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(r.id)} title="Elimina"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${tipoColor[r.tipo] || tipoColor.altro}`}>{tipoLabel[r.tipo] || r.tipo}</span>
                  {r.valore_stimato > 0 && (
                    <span className="font-semibold text-gray-800">
                      {formatEuro(r.valore_stimato)}{!CONTANTI.includes(r.tipo) && <span className="text-xs font-normal text-gray-400"> stimati</span>}
                    </span>
                  )}
                  {r.descrizione && r.descrizione !== DESCRIZIONE_DEFAULT[r.tipo] && <span className="text-sm text-gray-600">{r.descrizione}</span>}
                </div>
                {r.note && <p className="text-xs text-gray-500 italic">{r.note}</p>}

                <div className="pt-2 mt-auto border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  {r.ringraziamento_inviato ? (
                    <>
                      <span className="text-sm text-green-700 flex items-center gap-1.5">
                        <CheckCircle2 size={15} /> Ringraziati
                        {(r.data_ringraziamento || r.canale_ringraziamento) && (
                          <span className="text-green-600/80">
                            {r.data_ringraziamento && ` il ${dataBreve(r.data_ringraziamento)}`}
                            {r.canale_ringraziamento && ` · ${canaleLabel[r.canale_ringraziamento]}`}
                          </span>
                        )}
                      </span>
                      <button className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        onClick={() => confirm('Segnare di nuovo come da ringraziare?') && segna(r, false)}>
                        <Undo2 size={12} /> Annulla
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-amber-700 mr-auto">Da ringraziare</span>
                      {wa && (
                        <button className="text-sm px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1"
                          onClick={() => ringraziaWhatsApp(r)}>
                          <MessageCircle size={14} /> WhatsApp
                        </button>
                      )}
                      <select className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600" value=""
                        onChange={e => e.target.value && segna(r, true, e.target.value)}>
                        <option value="">Segna fatto…</option>
                        {CANALI.map(c => <option key={c} value={c}>{canaleLabel[c]}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Regalo' : 'Nuovo Regalo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <SceltaMittente form={form} setForm={setForm} ospiti={ospiti} regali={items} editId={editId} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">{CONTANTI.includes(form.tipo) ? 'Importo (€)' : 'Valore stimato (€)'}</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.valore_stimato} onChange={e => setForm({ ...form, valore_stimato: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <input className="form-input" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })}
                  placeholder={CONTANTI.includes(form.tipo) ? 'Facoltativa' : 'Es. Set di pentole, Quadro…'} />
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={form.ringraziamento_inviato}
                    onChange={e => setForm({ ...form, ringraziamento_inviato: e.target.checked, data_ringraziamento: e.target.checked ? (form.data_ringraziamento || oggi()) : '' })} />
                  Ringraziamento già fatto
                </label>
                {form.ringraziamento_inviato && (
                  <div className="grid grid-cols-2 gap-3">
                    <select className="form-input" value={form.canale_ringraziamento} onChange={e => setForm({ ...form, canale_ringraziamento: e.target.value })}>
                      <option value="">Come?</option>
                      {CANALI.map(c => <option key={c} value={c}>{canaleLabel[c]}</option>)}
                    </select>
                    <input type="date" className="form-input" value={form.data_ringraziamento} onChange={e => setForm({ ...form, data_ringraziamento: e.target.value })} />
                  </div>
                )}
              </div>
              {errore && <p className="text-sm text-red-600">{errore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {msgModal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMsgModal(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Messaggio di ringraziamento</h2>
            <p className="text-sm text-gray-500 mb-3">Il testo che si apre su WhatsApp. Prima di inviarlo puoi sempre ritoccarlo.</p>
            <form onSubmit={salvaMessaggio} className="space-y-3">
              <textarea className="form-input font-mono text-sm" rows={6} value={msgModal} onChange={e => setMsgModal(e.target.value)} />
              <p className="text-xs text-gray-400 leading-relaxed">
                <code>{'{nomi}'}</code> i nomi (es. "Mario e Anna") · <code>{'{tuo}'}</code> diventa "tuo" o "vostro" ·{' '}
                <code>{'{regalo}'}</code> la descrizione del regalo · <code>{'{sposi}'}</code> i vostri nomi
              </p>
              <div className="text-sm rounded-lg bg-green-50 border border-green-100 p-3 whitespace-pre-wrap text-gray-700">
                {testoRingraziamento({ membri: [{ nome: 'Mario', relazione: null }, { nome: 'Anna', relazione: 'partner' }], descrizione: 'Set di pentole' }, msgModal)}
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setMsgModal(MESSAGGIO_RINGRAZIAMENTO_DEFAULT)}>Testo predefinito</button>
                <button type="button" className="btn-secondary" onClick={() => setMsgModal(null)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Chi ha fatto il regalo: si cerca un ospite per nome e il regalo va a tutto
// il suo nucleo (il server salva il principale); oppure un nome libero.
function SceltaMittente({ form, setForm, ospiti, regali, editId }) {
  const [testo, setTesto] = useState('');
  const [libero, setLibero] = useState(!form.ospite_id && !!form.mittente);
  const byId = useMemo(() => new Map(ospiti.map(o => [o.id, o])), [ospiti]);
  const capoDi = o => (o?.parent_id && byId.get(o.parent_id)) || o;
  const conRegalo = useMemo(() => new Set(regali.filter(r => r.id !== editId && r.ospite_id).map(r => r.ospite_id)), [regali, editId]);

  const scelto = form.ospite_id ? capoDi(byId.get(Number(form.ospite_id))) : null;
  // Prima il partner, poi i figli: come nelle schede.
  const membri = scelto ? [scelto, ...ospiti.filter(o => o.parent_id === scelto.id)
    .sort((a, b) => (b.relazione === 'partner') - (a.relazione === 'partner') || a.id - b.id)] : [];

  const q = testo.trim().toLowerCase();
  const risultati = q.length < 2 ? [] : ospiti.filter(o =>
    `${o.nome} ${o.cognome || ''}`.toLowerCase().includes(q) || `${o.cognome || ''} ${o.nome}`.toLowerCase().includes(q)).slice(0, 8);

  if (libero) {
    return (
      <div>
        <label className="form-label">Da chi *</label>
        <input className="form-input" value={form.mittente} autoFocus placeholder="Es. I colleghi dell'ufficio"
          onChange={e => setForm({ ...form, mittente: e.target.value, ospite_id: '' })} />
        <button type="button" className="text-xs text-rose-600 mt-1 hover:underline" onClick={() => { setLibero(false); setForm({ ...form, mittente: '' }); }}>
          Cerca nella lista ospiti
        </button>
      </div>
    );
  }

  if (scelto) {
    return (
      <div>
        <label className="form-label">Da chi *</label>
        <div className="flex items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2">
          <div className="min-w-0">
            <p className="font-medium text-gray-800">{nomeCompleto(scelto)}</p>
            {membri.length > 1 && <p className="text-xs text-gray-500">Regalo di tutto il nucleo: {membri.map(m => m.nome).join(', ')}</p>}
          </div>
          <button type="button" className="p-1 text-gray-400 hover:text-gray-600" onClick={() => setForm({ ...form, ospite_id: '' })} title="Cambia"><X size={15} /></button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="form-label">Da chi *</label>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="form-input pl-9" value={testo} autoFocus placeholder="Scrivi un nome o un cognome…" onChange={e => setTesto(e.target.value)} />
      </div>
      {risultati.length > 0 && (
        <div className="mt-1 rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {risultati.map(o => {
            const capo = capoDi(o);
            return (
              <button type="button" key={o.id} className="w-full text-left px-3 py-2 hover:bg-rose-50 text-sm"
                onClick={() => { setForm({ ...form, ospite_id: capo.id, mittente: '' }); setTesto(''); }}>
                <span className="text-gray-800">{nomeCompleto(o)}</span>
                {capo !== o && <span className="text-xs text-gray-400"> · {o.relazione === 'partner' ? 'partner' : 'figlio'} di {nomeCompleto(capo)}</span>}
                {conRegalo.has(capo.id) && <span className="text-xs text-amber-600"> · 🎁 regalo già registrato</span>}
              </button>
            );
          })}
        </div>
      )}
      {q.length >= 2 && risultati.length === 0 && <p className="text-xs text-gray-400 mt-1">Nessun ospite con questo nome.</p>}
      <button type="button" className="text-xs text-rose-600 mt-1 hover:underline" onClick={() => { setLibero(true); setForm({ ...form, mittente: testo, ospite_id: '' }); }}>
        Non è in lista: scrivi il nome
      </button>
    </div>
  );
}
