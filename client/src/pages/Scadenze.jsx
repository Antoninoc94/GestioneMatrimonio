import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Circle, AlertCircle, FileText, Plane, DollarSign, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { prioritaLabel } from '../labels';

const CATEGORIE = ['Documenti', 'Fornitori', 'Pagamenti', 'Abbigliamento', 'Location', 'Viaggio', 'Inviti', 'Altro'];
const PRIORITA = ['alta', 'media', 'bassa'];
const prioritaColor = { alta: 'bg-red-100 text-red-700', media: 'bg-yellow-100 text-yellow-700', bassa: 'bg-green-100 text-green-700' };

const sourceInfo = {
  preventivo: { label: 'Preventivo', icon: FileText, color: 'bg-blue-100 text-blue-700', link: '/preventivi' },
  viaggio:    { label: 'Viaggio',    icon: Plane,    color: 'bg-purple-100 text-purple-700', link: '/viaggio' },
  costo:      { label: 'Pagamento',  icon: DollarSign, color: 'bg-orange-100 text-orange-700', link: '/budget' },
};

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n) : null;

const empty = { titolo: '', descrizione: '', data_scadenza: '', categoria: 'Altro', priorita: 'media', completata: false };

export default function Scadenze() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [mostraCompletate, setMostraCompletate] = useState(false);
  const [filtroSource, setFiltroSource] = useState('');

  const load = () => api.get('/scadenze').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = s => { setForm({ ...s, data_scadenza: s.data_scadenza || '', completata: !!s.completata }); setEditId(s.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (editId) await api.put(`/scadenze/${editId}`, form);
    else await api.post('/scadenze', form);
    setModal(false);
    load();
  };

  const toggle = async item => {
    await api.put(`/scadenze/${item.id}`, { ...item, completata: !item.completata });
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questa scadenza?')) return;
    await api.delete(`/scadenze/${id}`);
    load();
  };

  const isManuale = s => s.source === 'manuale';

  const visibili = items.filter(i => {
    if (i.completata && !mostraCompletate) return false;
    if (filtroSource && i.source !== filtroSource) return false;
    return true;
  });

  const pendenti = items.filter(i => !i.completata);
  const completate = items.filter(i => i.completata && isManuale(i));
  const scadute = pendenti.filter(i => i.data_scadenza && isPast(parseISO(i.data_scadenza)) && !isToday(parseISO(i.data_scadenza)));
  const oggi = pendenti.filter(i => i.data_scadenza && isToday(parseISO(i.data_scadenza)));
  const future = pendenti.filter(i => !i.data_scadenza || (!isPast(parseISO(i.data_scadenza)) && !isToday(parseISO(i.data_scadenza))));

  const contaAuto = items.filter(i => i.source !== 'manuale' && !i.completata).length;

  const ScadenzaCard = ({ s }) => {
    const isScaduta = s.data_scadenza && isPast(parseISO(s.data_scadenza)) && !isToday(parseISO(s.data_scadenza));
    const isOggiFlag = s.data_scadenza && isToday(parseISO(s.data_scadenza));
    const manuale = isManuale(s);
    const src = sourceInfo[s.source];
    const SrcIcon = src?.icon;

    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${
        s.completata ? 'bg-gray-50 border-gray-100 opacity-60'
        : isScaduta  ? 'bg-red-50 border-red-200'
        : isOggiFlag ? 'bg-yellow-50 border-yellow-200'
        : 'bg-white border-gray-100'
      }`}>
        {/* Toggle — solo per manuali */}
        {manuale ? (
          <button onClick={() => toggle(s)} className="mt-0.5 flex-shrink-0">
            {s.completata
              ? <CheckCircle size={20} className="text-green-500" />
              : <Circle size={20} className="text-gray-300 hover:text-rose-400" />}
          </button>
        ) : (
          <div className="mt-0.5 flex-shrink-0">
            <Lock size={18} className="text-gray-300" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`font-semibold text-sm ${s.completata ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {s.titolo}
            </span>
            {/* Badge priorità */}
            <span className={`badge ${prioritaColor[s.priorita]}`}>{prioritaLabel[s.priorita] || s.priorita}</span>
            {/* Badge source */}
            {src && (
              <span className={`badge flex items-center gap-1 ${src.color}`}>
                <SrcIcon size={10} />{src.label}
              </span>
            )}
            {isScaduta && <span className="badge bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle size={11} /> Scaduta</span>}
            {isOggiFlag && <span className="badge bg-yellow-100 text-yellow-700">Oggi!</span>}
          </div>

          {s.descrizione && <p className="text-xs text-gray-500 mt-0.5">{s.descrizione}</p>}

          {/* Info aggiuntive per scadenze auto */}
          {s.source === 'preventivo' && s.importo && (
            <p className="text-xs text-gray-400 mt-0.5">{formatEuro(s.importo)} · Stato: {s.stato}</p>
          )}
          {s.source === 'costo' && s.importo && (
            <p className="text-xs text-gray-400 mt-0.5">Da pagare: {formatEuro(s.importo)}</p>
          )}

          {s.data_scadenza && (
            <p className="text-xs text-gray-400 mt-1">
              {format(parseISO(s.data_scadenza), "EEEE d MMMM yyyy", { locale: it })}
            </p>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {manuale ? (
            <>
              <button className="p-1.5 rounded hover:bg-gray-200" onClick={() => openEdit(s)}><Pencil size={13} /></button>
              <button className="p-1.5 rounded hover:bg-red-100 text-red-400" onClick={() => del(s.id)}><Trash2 size={13} /></button>
            </>
          ) : (
            src && (
              <Link to={src.link} className="text-xs text-rose-500 font-semibold px-2 py-1 rounded hover:bg-rose-50">
                Vai →
              </Link>
            )
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, items }) => items.length === 0 ? null : (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{title} ({items.length})</h2>
      <div className="space-y-2">{items.map(s => <ScadenzaCard key={s.id} s={s} />)}</div>
    </div>
  );

  const scaduteVis  = visibili.filter(i => !i.completata && i.data_scadenza && isPast(parseISO(i.data_scadenza)) && !isToday(parseISO(i.data_scadenza)));
  const oggiVis     = visibili.filter(i => !i.completata && i.data_scadenza && isToday(parseISO(i.data_scadenza)));
  const futureVis   = visibili.filter(i => !i.completata && (!i.data_scadenza || (!isPast(parseISO(i.data_scadenza)) && !isToday(parseISO(i.data_scadenza)))));
  const completateVis = visibili.filter(i => i.completata);

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Scadenze & To-Do</h1>
          <p className="page-subtitle">
            {pendenti.length} da fare · {completate.length} completate
            {contaAuto > 0 && ` · ${contaAuto} automatiche`}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuova Scadenza</button>
      </div>

      {/* Info banner scadenze automatiche */}
      {contaAuto > 0 && (
        <div className="card mb-4 bg-blue-50 border-blue-200 flex items-start gap-3">
          <Lock size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>{contaAuto} scadenze automatiche</strong> — generate da preventivi in scadenza, viaggi da prenotare e pagamenti in sospeso.
            Per modificarle vai nella sezione corrispondente.
          </p>
        </div>
      )}

      {/* Filtri */}
      <div className="card mb-4 flex flex-wrap gap-2">
        <button className={`badge px-3 py-1.5 cursor-pointer ${!filtroSource ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroSource('')}>
          Tutte ({pendenti.length})
        </button>
        <button className={`badge px-3 py-1.5 cursor-pointer ${filtroSource === 'manuale' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroSource(f => f === 'manuale' ? '' : 'manuale')}>
          ✏️ Manuali ({items.filter(i => i.source === 'manuale' && !i.completata).length})
        </button>
        {Object.entries(sourceInfo).map(([key, info]) => {
          const count = items.filter(i => i.source === key && !i.completata).length;
          if (count === 0) return null;
          return (
            <button key={key} className={`badge px-3 py-1.5 cursor-pointer ${filtroSource === key ? 'bg-rose-500 text-white' : info.color}`} onClick={() => setFiltroSource(f => f === key ? '' : key)}>
              {info.label} ({count})
            </button>
          );
        })}
      </div>

      <Section title="Scadute" items={scaduteVis} />
      <Section title="Oggi" items={oggiVis} />
      <Section title="Da fare" items={futureVis} />

      {pendenti.length === 0 && (
        <div className="text-center py-12 text-gray-400 card">
          <CheckCircle size={40} className="mx-auto mb-2 text-green-300" />
          <p className="font-medium">Tutto in ordine! Nessuna scadenza pendente.</p>
        </div>
      )}

      {completate.length > 0 && (
        <div>
          <button className="text-sm text-gray-500 font-medium mb-3 hover:text-gray-700" onClick={() => setMostraCompletate(v => !v)}>
            {mostraCompletate ? '▲' : '▼'} Completate ({completate.length})
          </button>
          {mostraCompletate && <div className="space-y-2">{completateVis.map(s => <ScadenzaCard key={s.id} s={s} />)}</div>}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Scadenza' : 'Nuova Scadenza'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="form-label">Titolo *</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <textarea className="form-input" rows={2} value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" className="form-input" value={form.data_scadenza} onChange={e => setForm({ ...form, data_scadenza: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Priorità</label>
                  <select className="form-input" value={form.priorita} onChange={e => setForm({ ...form, priorita: e.target.value })}>
                    {PRIORITA.map(p => <option key={p} value={p}>{prioritaLabel[p]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
