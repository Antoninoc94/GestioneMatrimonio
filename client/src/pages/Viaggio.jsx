import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Plane, MapPin, ExternalLink, Phone, Mail, AlertTriangle, CalendarDays, LayoutList, LogOut } from 'lucide-react';
import api from '../api';

const TIPI = ['volo', 'hotel', 'escursione', 'trasporto', 'ristorante', 'altro'];
const STATI = ['da_prenotare', 'prenotato', 'pagato', 'completato'];
const tipoEmoji = { volo: '✈️', hotel: '🏨', escursione: '🗺️', trasporto: '🚗', ristorante: '🍽️', altro: '📌' };
const tipoLabel = { volo: 'Volo', hotel: 'Hotel', escursione: 'Escursione', trasporto: 'Trasporto', ristorante: 'Ristorante', altro: 'Altro' };
const statoColor = { da_prenotare: 'bg-amber-100 text-amber-700', prenotato: 'bg-blue-100 text-blue-700', pagato: 'bg-green-100 text-green-700', completato: 'bg-purple-100 text-purple-700' };
const statoLabel = { da_prenotare: 'Da prenotare', prenotato: 'Prenotato', pagato: 'Pagato', completato: 'Completato' };
// Le etichette delle date cambiano col tipo: per un volo sono partenza e arrivo.
const etichetteDate = {
  volo: ['Partenza', 'Arrivo'],
  hotel: ['Check-in', 'Check-out'],
  default: ['Inizio', 'Fine'],
};

// useGrouping 'always': in italiano Intl non separa le migliaia sotto le 10.000 ("6570 €").
const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' }).format(n) : null;

// Date come stringhe YYYY-MM-DD, calcoli a mezzogiorno UTC per non inciampare nell'ora legale.
const d2t = d => Date.parse(`${d}T12:00:00Z`);
const t2d = t => new Date(t).toISOString().slice(0, 10);
const piuGiorni = (d, n) => t2d(d2t(d) + n * 86400000);
const giorniTra = (a, b) => Math.round((d2t(b) - d2t(a)) / 86400000);
const oggi = () => new Date().toLocaleDateString('sv-SE');
const fmt = (d, opz = { day: 'numeric', month: 'short' }) => d ? new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', opz) : '';
// "Domenica 13 giugno": maiuscola solo all'inizio.
const fmtGiorno = d => { const s = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const intervalli = giorni => giorni.reduce((acc, d) => {
  const ultimo = acc.at(-1);
  if (ultimo && giorniTra(ultimo.a, d) === 1) ultimo.a = d; else acc.push({ da: d, a: d });
  return acc;
}, []);

// Le notti coperte da un hotel vanno dal check-in al giorno prima del check-out.
const notteFine = h => (h.data_fine && h.data_fine > h.data_inizio ? h.data_fine : piuGiorni(h.data_inizio, 1));

// Notti del viaggio senza un posto dove dormire (un volo notturno conta) e
// hotel che si sovrappongono, cioè due prenotazioni per la stessa notte.
function controlli(items, partenza, ritorno) {
  const out = { scoperte: [], sovrapposti: [] };
  const hotel = items.filter(i => i.tipo === 'hotel' && i.data_inizio);
  if (partenza && ritorno && ritorno > partenza) {
    const scoperte = [];
    for (let d = partenza; d < ritorno; d = piuGiorni(d, 1)) {
      const inHotel = hotel.some(h => h.data_inizio <= d && d < notteFine(h));
      const inVolo = items.some(v => v.tipo === 'volo' && v.data_inizio === d && v.data_fine && v.data_fine > d);
      if (!inHotel && !inVolo) scoperte.push(d);
    }
    out.scoperte = intervalli(scoperte);
  }
  for (let i = 0; i < hotel.length; i++) {
    for (let j = i + 1; j < hotel.length; j++) {
      const a = hotel[i], b = hotel[j];
      const da = a.data_inizio > b.data_inizio ? a.data_inizio : b.data_inizio;
      const fine = notteFine(a) < notteFine(b) ? notteFine(a) : notteFine(b);
      if (da < fine) out.sovrapposti.push({ a, b, da, a_: piuGiorni(fine, -1) });
    }
  }
  return out;
}

const empty = {
  tipo: 'volo', titolo: '', luogo: '', data_inizio: '', ora_inizio: '', data_fine: '', ora_fine: '',
  compagnia: '', numero_volo: '', luogo_partenza: '', luogo_arrivo: '',
  costo: '', numero_prenotazione: '', link: '', contatto: '', stato: 'da_prenotare', note: '',
};

export default function Viaggio() {
  const [items, setItems] = useState([]);
  const [viaggio, setViaggio] = useState({ destinazione: '', partenza: '', ritorno: '', budget: '' });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [errore, setErrore] = useState('');
  const [modViaggio, setModViaggio] = useState(null);
  const [vista, setVista] = useState(() => {
    try { return localStorage.getItem('viaggio_vista') || 'giorni'; } catch { return 'giorni'; }
  });

  const load = () => api.get('/viaggio').then(r => setItems(r.data));
  useEffect(() => {
    load();
    api.get('/config').then(r => setViaggio({
      destinazione: r.data.viaggio_destinazione || '', partenza: r.data.viaggio_partenza || '',
      ritorno: r.data.viaggio_ritorno || '', budget: r.data.viaggio_budget || '',
    }));
  }, []);
  const cambiaVista = v => { setVista(v); try { localStorage.setItem('viaggio_vista', v); } catch { /* solo comodità */ } };

  const openNew = (preset = {}) => { setForm({ ...empty, ...preset }); setEditId(null); setErrore(''); setModal(true); };
  const openEdit = i => {
    setForm(Object.fromEntries(Object.keys(empty).map(k => [k, i[k] == null ? '' : String(i[k])])));
    setEditId(i.id); setErrore(''); setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/viaggio/${editId}`, form);
      else await api.post('/viaggio', form);
      setModal(false);
      load();
    } catch (err) {
      setErrore(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const del = async id => {
    if (!confirm('Eliminare questo elemento?')) return;
    await api.delete(`/viaggio/${id}`);
    load();
  };

  const salvaViaggio = async e => {
    e.preventDefault();
    if (modViaggio.partenza && modViaggio.ritorno && modViaggio.ritorno < modViaggio.partenza) {
      return setModViaggio(m => ({ ...m, errore: 'Il ritorno è prima della partenza' }));
    }
    await api.put('/config', {
      viaggio_destinazione: modViaggio.destinazione, viaggio_partenza: modViaggio.partenza,
      viaggio_ritorno: modViaggio.ritorno, viaggio_budget: modViaggio.budget || 0,
    });
    setViaggio({ destinazione: modViaggio.destinazione, partenza: modViaggio.partenza, ritorno: modViaggio.ritorno, budget: modViaggio.budget });
    setModViaggio(null);
  };

  const { partenza, ritorno } = viaggio;
  const totaleCosto = items.reduce((s, i) => s + (i.costo || 0), 0);
  const budget = parseFloat(viaggio.budget) || 0;
  const notti = partenza && ritorno ? giorniTra(partenza, ritorno) : null;
  const { scoperte, sovrapposti } = controlli(items, partenza, ritorno);
  const daPrenotare = items.filter(i => i.stato === 'da_prenotare').length;

  let quando = null;
  if (partenza) {
    const g = giorniTra(oggi(), partenza);
    if (g > 1) quando = `Si parte tra ${g} giorni`;
    else if (g === 1) quando = 'Si parte domani!';
    else if (g === 0) quando = 'Si parte oggi!';
    else if (ritorno && oggi() <= ritorno) quando = `In viaggio: giorno ${-g + 1} di ${notti + 1}`;
    else quando = 'Bentornati!';
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Viaggio di Nozze</h1>
          <p className="page-subtitle">{items.length} prenotazioni{daPrenotare > 0 && ` · ${daPrenotare} da prenotare`}</p>
        </div>
        <button className="btn-primary justify-center" onClick={() => openNew()}><Plus size={16} /> Aggiungi</button>
      </div>

      {/* Il viaggio */}
      <div className="card mb-4 bg-gradient-to-br from-rose-50 to-white border-rose-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Il viaggio</p>
            <h2 className="text-2xl font-bold text-gray-900 truncate">{viaggio.destinazione || 'Dove andate?'}</h2>
            {partenza ? (
              <p className="text-sm text-gray-600 mt-0.5">
                {fmt(partenza, { day: 'numeric', month: 'long' })}
                {ritorno && ` → ${fmt(ritorno, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                {notti > 0 && <span className="text-gray-400"> · {notti} {notti === 1 ? 'notte' : 'notti'}</span>}
              </p>
            ) : <p className="text-sm text-gray-400 mt-0.5">Imposta destinazione e date per vedere il viaggio giorno per giorno.</p>}
            {quando && <p className="text-sm font-medium text-rose-600 mt-1">{quando}</p>}
          </div>
          <button className="btn-secondary shrink-0" onClick={() => setModViaggio({ ...viaggio, errore: '' })}><Pencil size={14} /> <span className="hidden sm:inline">Modifica</span></button>
        </div>
        {(budget > 0 || totaleCosto > 0) && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Prenotato <strong className="text-gray-900">{formatEuro(totaleCosto) || '0 €'}</strong></span>
              {budget > 0 && <span className="text-gray-400">su {formatEuro(budget)} previsti</span>}
            </div>
            {budget > 0 && (
              <div className="h-2 rounded-full bg-white border border-rose-100 mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${totaleCosto > budget ? 'bg-red-500' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, (totaleCosto / budget) * 100)}%` }} />
              </div>
            )}
            {budget > 0 && totaleCosto > budget && <p className="text-xs text-red-600 mt-1">Oltre il budget di {formatEuro(totaleCosto - budget)}</p>}
          </div>
        )}
      </div>

      {/* Avvisi */}
      {(scoperte.length > 0 || sovrapposti.length > 0) && (
        <div className="card mb-4 border-amber-200 bg-amber-50/60 space-y-2">
          {scoperte.map(n => (
            <div key={n.da} className="flex items-center gap-2 text-sm text-amber-800 flex-wrap">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="flex-1 min-w-0">
                {n.da === n.a ? `Notte del ${fmt(n.da, { day: 'numeric', month: 'long' })} senza hotel` : `Notti dal ${fmt(n.da)} al ${fmt(n.a)} senza hotel`}
              </span>
              <button className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-200 hover:border-amber-400"
                onClick={() => openNew({ tipo: 'hotel', data_inizio: n.da, data_fine: piuGiorni(n.a, 1) })}>
                <Plus size={11} className="inline -mt-0.5" /> Hotel
              </button>
            </div>
          ))}
          {sovrapposti.map(s => (
            <div key={`${s.a.id}-${s.b.id}`} className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{s.a.titolo} e {s.b.titolo} si sovrappongono {s.da === s.a_ ? `la notte del ${fmt(s.da)}` : `dal ${fmt(s.da)} al ${fmt(s.a_)}`}</span>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Plane size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nessuna prenotazione. Inizia dal volo!</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {[['giorni', CalendarDays, 'Giorno per giorno'], ['tipo', LayoutList, 'Per tipo']].map(([k, Icona, label]) => (
              <button key={k} onClick={() => cambiaVista(k)}
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${vista === k ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500'}`}>
                <Icona size={14} /> {label}
              </button>
            ))}
          </div>
          {vista === 'giorni'
            ? <GiornoPerGiorno items={items} partenza={partenza} ritorno={ritorno} onEdit={openEdit} onDel={del} />
            : <PerTipo items={items} onEdit={openEdit} onDel={del} />}
        </>
      )}

      {modViaggio && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModViaggio(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Il viaggio</h2>
            <form onSubmit={salvaViaggio} className="space-y-3">
              <div>
                <label className="form-label">Destinazione</label>
                <input className="form-input" value={modViaggio.destinazione} placeholder="Es. Giappone" autoFocus
                  onChange={e => setModViaggio({ ...modViaggio, destinazione: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Partenza</label>
                  <input type="date" className="form-input" value={modViaggio.partenza} onChange={e => setModViaggio({ ...modViaggio, partenza: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Ritorno</label>
                  <input type="date" className="form-input" value={modViaggio.ritorno} min={modViaggio.partenza || undefined}
                    onChange={e => setModViaggio({ ...modViaggio, ritorno: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Budget previsto (€)</label>
                <input type="number" min="0" step="50" className="form-input" value={modViaggio.budget || ''} placeholder="Facoltativo"
                  onChange={e => setModViaggio({ ...modViaggio, budget: e.target.value })} />
              </div>
              {modViaggio.errore && <p className="text-sm text-red-600">{modViaggio.errore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModViaggio(null)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && <FormPrenotazione form={form} setForm={setForm} editId={editId} errore={errore} onSave={save} onClose={() => setModal(false)} />}
    </div>
  );
}

// I giorni del viaggio (più quelli con prenotazioni fuori dalle date), e in
// ciascuno quello che inizia quel giorno; gli hotel compaiono anche il giorno
// del check-out. Le prenotazioni senza data stanno in fondo.
function GiornoPerGiorno({ items, partenza, ritorno, onEdit, onDel }) {
  const eventi = {};
  const aggiungi = (d, ev) => (eventi[d] ||= []).push(ev);
  for (const i of items) {
    if (!i.data_inizio) continue;
    aggiungi(i.data_inizio, { item: i, ora: i.ora_inizio });
    if (i.tipo === 'hotel' && i.data_fine && i.data_fine > i.data_inizio) aggiungi(i.data_fine, { item: i, ora: i.ora_fine, checkout: true });
  }
  const giorni = new Set(Object.keys(eventi));
  if (partenza && ritorno && ritorno >= partenza) {
    for (let d = partenza; d <= ritorno; d = piuGiorni(d, 1)) giorni.add(d);
  }
  const senzaData = items.filter(i => !i.data_inizio);

  return (
    <div className="space-y-5">
      {[...giorni].sort().map(d => {
        const lista = (eventi[d] || []).sort((a, b) =>
          (a.checkout ? 0 : 1) - (b.checkout ? 0 : 1) || (a.ora || '99').localeCompare(b.ora || '99'));
        const nelViaggio = partenza && ritorno && d >= partenza && d <= ritorno;
        return (
          <div key={d}>
            <div className="flex items-baseline gap-2 mb-2">
              {nelViaggio && <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">Giorno {giorniTra(partenza, d) + 1}</span>}
              <h3 className="text-sm font-semibold text-gray-700">{fmtGiorno(d)}</h3>
              {d === partenza && <span className="badge bg-rose-100 text-rose-600">Partenza</span>}
              {d === ritorno && <span className="badge bg-rose-100 text-rose-600">Ritorno</span>}
            </div>
            {lista.length === 0 ? (
              <p className="text-sm text-gray-400 italic pl-3 border-l-2 border-gray-100">Giornata libera</p>
            ) : (
              <div className="space-y-2">
                {lista.map(ev => ev.checkout ? (
                  <div key={`co-${ev.item.id}`} className="flex items-center gap-2 text-sm text-gray-500 pl-3 border-l-2 border-gray-100">
                    <LogOut size={14} className="text-gray-400" />
                    <span className="tabular-nums w-11">{ev.ora || ''}</span>
                    Check-out da <span className="font-medium text-gray-700">{ev.item.titolo}</span>
                  </div>
                ) : (
                  <Scheda key={ev.item.id} item={ev.item} onEdit={onEdit} onDel={onDel} conOra />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {senzaData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Senza data</h3>
          <div className="space-y-2">
            {senzaData.map(i => <Scheda key={i.id} item={i} onEdit={onEdit} onDel={onDel} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function PerTipo({ items, onEdit, onDel }) {
  return (
    <div className="space-y-6">
      {TIPI.map(tipo => {
        const gruppo = items.filter(i => i.tipo === tipo);
        if (!gruppo.length) return null;
        return (
          <div key={tipo}>
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{tipoEmoji[tipo]} {tipoLabel[tipo]}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {gruppo.map(i => <Scheda key={i.id} item={i} onEdit={onEdit} onDel={onDel} conData />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Scheda({ item: i, onEdit, onDel, conOra, conData }) {
  const mail = i.contatto?.includes('@');
  const giorni = i.data_inizio && i.data_fine && i.data_fine > i.data_inizio ? giorniTra(i.data_inizio, i.data_fine) : 0;
  let dettaglio = null;
  if (i.tipo === 'volo') {
    // Il percorso è già nel titolo quando il titolo è quello automatico: qui solo gli orari.
    const percorso = [i.luogo_partenza, i.luogo_arrivo].filter(Boolean).join(' → ');
    const orari = i.ora_inizio || i.ora_fine
      ? `${i.ora_inizio || '?'} → ${i.ora_fine || '?'}${giorni ? ` (+${giorni})` : ''}`
      : null;
    dettaglio = [
      [i.numero_volo, i.compagnia].filter(Boolean).join(' · '),
      percorso && percorso !== i.titolo ? percorso : null,
      orari,
    ].filter(Boolean).join(' · ');
  } else if (i.tipo === 'hotel' && giorni) {
    dettaglio = `${giorni} ${giorni === 1 ? 'notte' : 'notti'} · check-out ${fmt(i.data_fine)}${i.ora_fine ? ` ore ${i.ora_fine}` : ''}`;
  } else if (i.data_fine && i.data_fine !== i.data_inizio) {
    dettaglio = `fino al ${fmt(i.data_fine)}${i.ora_fine ? ` ore ${i.ora_fine}` : ''}`;
  } else if (i.ora_fine) {
    dettaglio = `fino alle ${i.ora_fine}`;
  }

  return (
    <div className="card py-3 flex gap-3">
      {conOra && <div className="w-11 shrink-0 text-sm font-semibold text-gray-800 tabular-nums pt-0.5">{i.ora_inizio || ''}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 leading-snug">
              <span className="mr-1">{tipoEmoji[i.tipo]}</span>{i.titolo}
            </h4>
            {conData && i.data_inizio && (
              <p className="text-xs text-gray-500 mt-0.5">{fmt(i.data_inizio, { weekday: 'short', day: 'numeric', month: 'short' })}{i.ora_inizio && ` · ${i.ora_inizio}`}</p>
            )}
            {dettaglio && <p className="text-sm text-gray-600 mt-0.5">{dettaglio}</p>}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
            <span className={`badge text-xs mr-1 ${statoColor[i.stato]}`}>{statoLabel[i.stato]}</span>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => onEdit(i)} title="Modifica"><Pencil size={13} /></button>
            <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => onDel(i.id)} title="Elimina"><Trash2 size={13} /></button>
          </div>
        </div>
        {i.luogo && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.luogo)}`} target="_blank" rel="noreferrer"
            className="text-sm text-gray-500 hover:text-rose-600 flex items-start gap-1 mt-1">
            <MapPin size={13} className="mt-0.5 shrink-0 text-rose-400" /> <span className="min-w-0">{i.luogo}</span>
          </a>
        )}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-xs">
          {i.costo > 0 && <span className="font-semibold text-gray-700 text-sm">{formatEuro(i.costo)}</span>}
          {i.numero_prenotazione && <span className="font-mono bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-600">#{i.numero_prenotazione}</span>}
          {i.link && (
            <a href={i.link} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline flex items-center gap-1">
              <ExternalLink size={12} /> Prenotazione
            </a>
          )}
          {i.contatto && (
            <a href={mail ? `mailto:${i.contatto}` : `tel:${i.contatto.replace(/\s+/g, '')}`} className="text-rose-600 hover:underline flex items-center gap-1">
              {mail ? <Mail size={12} /> : <Phone size={12} />} {i.contatto}
            </a>
          )}
        </div>
        {i.note && <p className="text-xs text-gray-400 italic mt-1.5">{i.note}</p>}
      </div>
    </div>
  );
}

function FormPrenotazione({ form, setForm, editId, errore, onSave, onClose }) {
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const [lInizio, lFine] = etichetteDate[form.tipo] || etichetteDate.default;
  const volo = form.tipo === 'volo';
  const hotel = form.tipo === 'hotel';
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica prenotazione' : 'Nuova prenotazione'}</h2>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.tipo} onChange={set('tipo')}>
                {TIPI.map(t => <option key={t} value={t}>{tipoEmoji[t]} {tipoLabel[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Stato</label>
              <select className="form-input" value={form.stato} onChange={set('stato')}>
                {STATI.map(s => <option key={s} value={s}>{statoLabel[s]}</option>)}
              </select>
            </div>
          </div>

          {volo && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Da</label>
                  <input className="form-input" value={form.luogo_partenza} onChange={set('luogo_partenza')} placeholder="Roma FCO" />
                </div>
                <div>
                  <label className="form-label">A</label>
                  <input className="form-input" value={form.luogo_arrivo} onChange={set('luogo_arrivo')} placeholder="Tokyo HND" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Compagnia</label>
                  <input className="form-input" value={form.compagnia} onChange={set('compagnia')} placeholder="ITA Airways" />
                </div>
                <div>
                  <label className="form-label">Numero volo</label>
                  <input className="form-input uppercase" value={form.numero_volo} onChange={set('numero_volo')} placeholder="AZ 784" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="form-label">{volo ? 'Titolo (facoltativo)' : hotel ? 'Nome hotel *' : 'Titolo *'}</label>
            <input className="form-input" value={form.titolo} onChange={set('titolo')} required={!volo}
              placeholder={volo ? 'Se vuoto: "Roma FCO → Tokyo HND"' : hotel ? 'Es. Park Hyatt Tokyo' : 'Es. Tour del monte Fuji'} />
          </div>
          {!volo && (
            <div>
              <label className="form-label">{hotel ? 'Indirizzo' : 'Luogo'}</label>
              <input className="form-input" value={form.luogo} onChange={set('luogo')} placeholder={hotel ? 'Per aprirlo su Maps' : 'Facoltativo'} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">{lInizio}</label>
              <div className="flex gap-1.5">
                <input type="date" className="form-input min-w-0" value={form.data_inizio} onChange={set('data_inizio')} />
                <input type="time" className="form-input w-[6.5rem] shrink-0" value={form.ora_inizio} onChange={set('ora_inizio')} />
              </div>
            </div>
            <div>
              <label className="form-label">{lFine}</label>
              <div className="flex gap-1.5">
                <input type="date" className="form-input min-w-0" value={form.data_fine} min={form.data_inizio || undefined} onChange={set('data_fine')} />
                <input type="time" className="form-input w-[6.5rem] shrink-0" value={form.ora_fine} onChange={set('ora_fine')} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Costo (€)</label>
              <input type="number" step="0.01" min="0" className="form-input" value={form.costo} onChange={set('costo')} />
            </div>
            <div>
              <label className="form-label">N. prenotazione</label>
              <input className="form-input font-mono" value={form.numero_prenotazione} onChange={set('numero_prenotazione')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Link prenotazione</label>
              <input className="form-input" value={form.link} onChange={set('link')} placeholder="booking.com/…" />
            </div>
            <div>
              <label className="form-label">Contatto</label>
              <input className="form-input" value={form.contatto} onChange={set('contatto')} placeholder="Telefono o email" />
            </div>
          </div>
          <div>
            <label className="form-label">Note</label>
            <textarea className="form-input" rows={2} value={form.note} onChange={set('note')} />
          </div>
          {errore && <p className="text-sm text-red-600">{errore}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary">Salva</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
          </div>
        </form>
      </div>
    </div>
  );
}
