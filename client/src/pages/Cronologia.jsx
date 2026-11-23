import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Download, Sparkles, MapPin, Lock, AlertTriangle, MoveVertical, Phone, Users, ChevronDown } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIPI = ['cerimonia', 'ricevimento', 'foto', 'viaggio', 'preparativi', 'altro'];
const tipoColor = {
  cerimonia: 'bg-rose-100 text-rose-700 border-rose-200',
  ricevimento: 'bg-purple-100 text-purple-700 border-purple-200',
  foto: 'bg-blue-100 text-blue-700 border-blue-200',
  viaggio: 'bg-green-100 text-green-700 border-green-200',
  preparativi: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  altro: 'bg-gray-100 text-gray-600 border-gray-200',
};
const tipoLabel = {
  cerimonia: '💍 Cerimonia', ricevimento: '🥂 Ricevimento', foto: '📷 Foto',
  viaggio: '🚗 Viaggio', preparativi: '💄 Preparativi', altro: '📌 Altro',
};
const TIPI_CERIMONIA = ['Chiesa', 'Municipio', 'Cerimonia civile'];

const empty = { ora: '', titolo: '', descrizione: '', luogo: '', location_id: '', durata: '', tipo: 'altro', pubblico: 1, fornitori: [] };

// Minuti dalle 5:00, come l'ordinamento del server: la festa dopo mezzanotte
// resta in fondo alla giornata.
const minuti = ora => { const [h, m] = (ora || '00:00').split(':').map(Number); return h * 60 + m; };
const chiave = ora => (minuti(ora) - 300 + 1440) % 1440;
const hhmm = min => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const fine = ev => ev.durata ? hhmm(minuti(ev.ora) + ev.durata) : null;

const luogoDi = ev => ev.location_nome || ev.luogo || '';
// I fornitori di una lista di eventi, una volta sola, per categoria e nome.
const unici = eventi => [...new Map(eventi.flatMap(ev => ev.fornitori || []).map(f => [f.id, f])).values()]
  .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
const mapsUrl = (nome, indirizzo) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([nome, indirizzo].filter(Boolean).join(', '))}`;

// Avvisi tra un evento visibile agli invitati e il precedente visibile: gli
// invitati non possono essere in due posti insieme. Gli eventi "solo per voi"
// sono spesso in parallelo apposta (sposa e sposo si preparano ognuno a casa
// sua) e non si controllano. Senza durata un evento non ha una fine.
function avvisi(items) {
  const out = {};
  let prec = null;
  for (const ev of items) {
    if (!ev.pubblico) continue;
    if (prec) out[ev.id] = avvisoTra(prec, ev);
    prec = ev;
  }
  return out;
}

function avvisoTra(a, b) {
  if (!a.durata) return null;
  const gap = chiave(b.ora) - (chiave(a.ora) + a.durata);
  if (gap < 0) return `Si sovrappone all'evento precedente di ${-gap} min`;
  const la = luogoDi(a), lb = luogoDi(b);
  if (la && lb && la !== lb && gap < 15) {
    return gap === 0
      ? `Cambio di luogo (${la} → ${lb}) senza tempo per spostarsi`
      : `Solo ${gap} min per spostarsi da ${la} a ${lb}`;
  }
  return null;
}

export default function Cronologia() {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [errore, setErrore] = useState('');
  const [exporting, setExporting] = useState(false);
  const [bozza, setBozza] = useState(null);
  const [spostaId, setSpostaId] = useState(null);
  const [fornitori, setFornitori] = useState([]);
  const [menuPdf, setMenuPdf] = useState(false);

  const load = () => api.get('/cronologia').then(r => setItems(r.data));
  useEffect(() => {
    load();
    api.get('/location').then(r => setLocations(r.data.filter(l => l.stato !== 'escluso')));
    api.get('/fornitori').then(r => setFornitori(r.data));
  }, []);

  const confermate = locations.filter(l => l.stato === 'confermato');
  const altre = locations.filter(l => l.stato !== 'confermato');

  const openNew = () => { setForm(empty); setEditId(null); setErrore(''); setModal(true); };
  const openEdit = i => {
    setForm({
      ...empty, ...i, durata: i.durata?.toString() || '', location_id: i.location_id || '', luogo: i.luogo || '',
      descrizione: i.descrizione || '', fornitori: (i.fornitori || []).map(f => f.id),
    });
    setEditId(i.id); setErrore(''); setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      const payload = { ...form, durata: form.durata ? parseInt(form.durata) : null, location_id: form.location_id || null };
      if (editId) await api.put(`/cronologia/${editId}`, payload);
      else await api.post('/cronologia', payload);
      setModal(false);
      load();
    } catch (err) {
      setErrore(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const del = async id => {
    if (!confirm('Eliminare questo evento?')) return;
    await api.delete(`/cronologia/${id}`);
    load();
  };

  const sposta = async (id, m) => {
    try {
      const r = await api.post('/cronologia/sposta', { da: id, minuti: m });
      setItems(r.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Errore nello spostamento');
    }
  };

  const apriBozza = async () => {
    let oraCer = '11:00';
    try {
      const cfg = (await api.get('/config')).data;
      if (/^\d{2}:\d{2}/.test(cfg?.invito_ora_cerimonia || '')) oraCer = cfg.invito_ora_cerimonia.slice(0, 5);
    } catch { /* l'ora predefinita va bene lo stesso */ }
    setBozza({ ora_cerimonia: oraCer, spostamento: '30', errore: '' });
  };

  const creaBozza = async e => {
    e.preventDefault();
    try {
      const r = await api.post('/cronologia/bozza', { ora_cerimonia: bozza.ora_cerimonia, spostamento: parseInt(bozza.spostamento) || 0 });
      setItems(r.data);
      setBozza(null);
    } catch (err) {
      setBozza(b => ({ ...b, errore: err.response?.data?.error || 'Errore nella creazione della bozza' }));
    }
  };

  // Senza argomento: la scaletta completa per voi, testimoni e coordinatore,
  // con tutti gli eventi e i contatti dei fornitori. Con un fornitore: solo
  // gli eventi in cui serve, da mandargli perché sappia dove essere e quando.
  const exportPDF = fornitore => {
    setMenuPdf(false);
    const eventi = fornitore ? items.filter(ev => ev.fornitori?.some(f => f.id === fornitore.id)) : items;
    if (eventi.length === 0) return alert('Nessun evento da esportare.');
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];
      const titolo = fornitore ? `Programma per ${fornitore.nome}` : 'Scaletta del Giorno';
      const oggi = new Date().toLocaleDateString('it-IT');

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(titolo, 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${fornitore ? `${fornitore.categoria} · ` : ''}${eventi.length} ${eventi.length === 1 ? 'evento' : 'eventi'} · ${oggi}`, 14, 20);

      const stili = {
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        margin: { left: 14, right: 14 },
      };
      const orario = ev => fine(ev) ? `${ev.ora}\n${fine(ev)}` : (ev.ora || '-');
      const evento = ev => {
        const lines = [ev.titolo];
        const luogo = luogoDi(ev);
        if (luogo) lines.push(`Luogo: ${luogo}${ev.location_id && ev.location_indirizzo ? ` - ${ev.location_indirizzo}` : ''}`);
        if (ev.descrizione) lines.push(ev.descrizione);
        if (!fornitore && !ev.pubblico) lines.push('(solo per gli sposi)');
        return lines.join('\n');
      };

      autoTable(doc, fornitore ? {
        ...stili,
        startY: 34,
        head: [['Ora', 'Evento', 'Durata']],
        body: eventi.map(ev => [orario(ev), evento(ev), ev.durata ? `${ev.durata} min` : '-']),
        columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 24, halign: 'center' } },
      } : {
        ...stili,
        startY: 34,
        head: [['Ora', 'Evento', 'Fornitori']],
        body: eventi.map(ev => [
          orario(ev),
          evento(ev),
          (ev.fornitori || []).map(f => `${f.nome}${f.telefono ? ` · ${f.telefono}` : ''}`).join('\n') || '-',
        ]),
        columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 58 } },
      });

      // In coda alla scaletta, la rubrica dei fornitori coinvolti.
      const coinvolti = fornitore ? [] : unici(eventi);
      if (coinvolti.length) {
        autoTable(doc, {
          ...stili,
          startY: doc.lastAutoTable.finalY + 10,
          head: [['Fornitore', 'Categoria', 'Referente', 'Telefono', 'Email']],
          body: coinvolti.map(f => [f.nome, f.categoria, f.contatto || '-', f.telefono || '-', f.email || '-']),
          columnStyles: { 0: { fontStyle: 'bold' } },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`${titolo} - ${oggi}`, 14, 290);
      }

      const slug = fornitore?.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      doc.save(fornitore ? `programma-${slug || 'fornitore'}.pdf` : 'scaletta-matrimonio.pdf');
    } finally {
      setExporting(false);
    }
  };

  // Fornitori collegati ad almeno un evento: quelli per cui ha senso un PDF.
  const fornitoriInScaletta = unici(items);
  // Nel form: i confermati, più quelli già collegati all'evento anche se nel
  // frattempo hanno cambiato stato (altrimenti salvando sparirebbero).
  const fornitoriScelta = fornitori.filter(f => f.stato === 'confermato' || form.fornitori.includes(f.id));
  const toggleFornitore = id => setForm(f => ({
    ...f, fornitori: f.fornitori.includes(id) ? f.fornitori.filter(x => x !== id) : [...f.fornitori, id],
  }));

  const privati = items.filter(i => !i.pubblico).length;
  const elencoAvvisi = avvisi(items);
  const luogoCer = confermate.find(l => TIPI_CERIMONIA.includes(l.tipo));
  const luogoRic = confermate.find(l => l.tipo === 'Ricevimento');

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Cronologia del Giorno</h1>
          <p className="page-subtitle">
            {items.length} eventi in programma
            {items.length > 0 && ` · ${items.length - privati} visibili sulla pagina Wedding`}
          </p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <div className="relative">
            <button className="btn-secondary justify-center w-full" onClick={() => setMenuPdf(!menuPdf)} disabled={exporting}>
              <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'} <ChevronDown size={13} />
            </button>
            {menuPdf && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuPdf(false)} />
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 z-20 w-64 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-sm">
                  <button className="w-full text-left px-3 py-2 hover:bg-rose-50" onClick={() => exportPDF()}>
                    <span className="font-medium text-gray-800">Scaletta completa</span>
                    <span className="block text-xs text-gray-400">Tutti gli eventi e i contatti, per testimoni e coordinatore</span>
                  </button>
                  {fornitoriInScaletta.length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-gray-100 mt-1">Per un fornitore</p>
                      <div className="max-h-64 overflow-y-auto">
                        {fornitoriInScaletta.map(f => (
                          <button key={f.id} className="w-full text-left px-3 py-1.5 hover:bg-rose-50" onClick={() => exportPDF(f)}>
                            <span className="text-gray-800">{f.nome}</span> <span className="text-xs text-gray-400">· {f.categoria}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="btn-secondary justify-center" onClick={apriBozza}>
            <Sparkles size={15} /> Bozza
          </button>
          <button className="btn-primary justify-center" onClick={openNew}><Plus size={16} /> <span className="hidden sm:inline">Aggiungi</span> Evento</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Clock size={40} className="mx-auto mb-3 text-rose-300" />
          <p className="font-medium text-gray-700">Nessun evento ancora.</p>
          <p className="text-sm mt-1 mb-5">Parti dalla giornata tipo: orari calcolati dalla cerimonia e luoghi presi dalle location confermate.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button className="btn-primary justify-center" onClick={apriBozza}><Sparkles size={15} /> Genera la giornata tipo</button>
            <button className="btn-secondary justify-center" onClick={openNew}><Plus size={15} /> Evento vuoto</button>
          </div>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-rose-100" />
          <div className="space-y-3">
            {items.map(ev => {
              const avviso = elencoAvvisi[ev.id];
              const indirizzo = ev.location_id ? ev.location_indirizzo : null;
              return (
                <div key={ev.id}>
                  {avviso && (
                    <p className="ml-2 mb-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                      <AlertTriangle size={13} className="shrink-0" /> {avviso}
                    </p>
                  )}
                  <div className="relative">
                    <div className={`absolute -left-8 top-3 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${ev.pubblico ? 'bg-rose-500' : 'bg-gray-400'}`}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div className={`card border ${tipoColor[ev.tipo]} ml-2 ${ev.pubblico ? '' : 'opacity-80'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-lg font-bold text-gray-900 tabular-nums">
                              {ev.ora}{fine(ev) && <span className="text-sm font-medium text-gray-400"> – {fine(ev)}</span>}
                            </span>
                            {ev.durata && <span className="text-xs text-gray-400">({ev.durata} min)</span>}
                            <span className={`badge text-xs ${tipoColor[ev.tipo]}`}>{tipoLabel[ev.tipo]}</span>
                            {!ev.pubblico && (
                              <span className="badge text-xs bg-gray-100 text-gray-600 border border-gray-200" title="Non compare sulla pagina Wedding degli invitati">
                                <Lock size={10} className="inline -mt-0.5" /> Solo per voi
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-800">{ev.titolo}</h3>
                          {luogoDi(ev) && (
                            <p className="text-sm text-gray-500 mt-0.5 flex items-start gap-1">
                              <MapPin size={13} className="mt-0.5 shrink-0 text-rose-400" />
                              <span>
                                {ev.location_id ? (
                                  <a href={mapsUrl(ev.location_nome, indirizzo)} target="_blank" rel="noreferrer" className="hover:underline text-gray-700">
                                    {ev.location_nome}
                                  </a>
                                ) : ev.luogo}
                                {indirizzo && <span className="text-gray-400"> · {indirizzo}</span>}
                              </span>
                            </p>
                          )}
                          {ev.descrizione && <p className="text-sm text-gray-500 mt-1">{ev.descrizione}</p>}
                          {ev.fornitori?.length > 0 && (
                            <div className="mt-2 flex items-start gap-1.5">
                              <Users size={13} className="mt-1 shrink-0 text-gray-400" />
                              <div className="flex flex-wrap gap-1.5">
                                {ev.fornitori.map(f => (
                                  <span key={f.id} className="inline-flex flex-wrap items-center gap-x-1 text-xs bg-white/70 border border-gray-200 rounded-2xl px-2 py-0.5 text-gray-700 max-w-full">
                                    <span className="whitespace-nowrap">{f.nome}</span>
                                    <span className="text-gray-400 whitespace-nowrap">· {f.categoria}</span>
                                    {f.telefono && (
                                      <a href={`tel:${f.telefono.replace(/\s+/g, '')}`} className="inline-flex items-center gap-0.5 text-rose-600 hover:underline whitespace-nowrap" title={`Chiama ${f.nome}`}>
                                        <Phone size={10} /> {f.telefono}
                                      </a>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {spostaId === ev.id && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="text-gray-500">Sposta questo e i successivi:</span>
                              {[-15, -5, 5, 15].map(m => (
                                <button key={m} className="px-2 py-1 rounded-md bg-white border border-gray-200 hover:border-rose-300 font-medium tabular-nums"
                                  onClick={() => sposta(ev.id, m)}>
                                  {m > 0 ? `+${m}` : m} min
                                </button>
                              ))}
                              <button className="px-2 py-1 text-gray-400 hover:text-gray-600" onClick={() => setSpostaId(null)}>Fatto</button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <button className="p-1.5 rounded hover:bg-white/60" title="Sposta l'orario di questo evento e dei successivi"
                            onClick={() => setSpostaId(spostaId === ev.id ? null : ev.id)}>
                            <MoveVertical size={13} className="text-gray-400" />
                          </button>
                          <button className="p-1.5 rounded hover:bg-white/60" onClick={() => openEdit(ev)}><Pencil size={13} className="text-gray-400" /></button>
                          <button className="p-1.5 rounded hover:bg-white/60" onClick={() => del(ev.id)}><Trash2 size={13} className="text-red-400" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bozza && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setBozza(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Giornata tipo</h2>
            <p className="text-sm text-gray-500 mb-4">Crea gli eventi classici del giorno, con orari calcolati dalla cerimonia. Poi li modifichi come vuoi.</p>
            <form onSubmit={creaBozza} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ora della cerimonia *</label>
                  <input type="time" className="form-input" value={bozza.ora_cerimonia} required
                    onChange={e => setBozza({ ...bozza, ora_cerimonia: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Spostamento (minuti)</label>
                  <input type="number" min={0} max={240} className="form-input" value={bozza.spostamento}
                    onChange={e => setBozza({ ...bozza, spostamento: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Dalla cerimonia al ricevimento. 0 se è nello stesso posto.</p>
                </div>
              </div>
              <div className="text-sm rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                <p><span className="text-gray-500">Cerimonia:</span>{' '}
                  {luogoCer ? <strong>{luogoCer.nome}</strong> : <span className="text-amber-600">nessuna location confermata (Chiesa/Municipio)</span>}
                  {luogoCer && luogoCer.tipo !== 'Chiesa' && <span className="text-gray-400"> · rito civile</span>}
                </p>
                <p><span className="text-gray-500">Ricevimento:</span>{' '}
                  {luogoRic ? <strong>{luogoRic.nome}</strong> : <span className="text-amber-600">nessuna location confermata</span>}
                </p>
                <p className="text-xs text-gray-400">I preparativi restano "solo per voi": gli invitati vedono dalla cerimonia in poi.</p>
              </div>
              {items.length > 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Hai già {items.length} eventi: la bozza si aggiunge, non li sostituisce.
                </p>
              )}
              {bozza.errore && <p className="text-sm text-red-600">{bozza.errore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary"><Sparkles size={15} /> Crea eventi</button>
                <button type="button" className="btn-secondary" onClick={() => setBozza(null)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Evento' : 'Nuovo Evento'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ora *</label>
                  <input type="time" className="form-input" value={form.ora} onChange={e => setForm({ ...form, ora: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Durata (minuti)</label>
                  <input type="number" min={1} className="form-input" value={form.durata} onChange={e => setForm({ ...form, durata: e.target.value })} placeholder="60" />
                </div>
              </div>
              <div>
                <label className="form-label">Titolo *</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} required placeholder="Es. Cerimonia in chiesa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Luogo</label>
                  <select className="form-input" value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">Altro luogo (scrivilo sotto)</option>
                    {confermate.length > 0 && (
                      <optgroup label="Location confermate">
                        {confermate.map(l => <option key={l.id} value={l.id}>{l.nome} · {l.tipo}</option>)}
                      </optgroup>
                    )}
                    {altre.length > 0 && (
                      <optgroup label="Altre location">
                        {altre.map(l => <option key={l.id} value={l.id}>{l.nome} · {l.tipo}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
              {!form.location_id && (
                <input className="form-input" value={form.luogo} onChange={e => setForm({ ...form, luogo: e.target.value })} placeholder="Es. Casa della sposa" />
              )}
              <div>
                <label className="form-label">Descrizione</label>
                <textarea className="form-input" rows={2} value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Fornitori coinvolti</label>
                {fornitoriScelta.length === 0 ? (
                  <p className="text-xs text-gray-400">Nessun fornitore confermato: segnali come "Confermato" in Fornitori per collegarli qui.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {fornitoriScelta.map(f => {
                      const on = form.fornitori.includes(f.id);
                      return (
                        <button type="button" key={f.id} onClick={() => toggleFornitore(f.id)}
                          className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${on ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300'}`}>
                          {f.nome} <span className={on ? 'text-rose-100' : 'text-gray-400'}>· {f.categoria}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Restano interni: gli invitati non li vedono.</p>
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={!!form.pubblico} onChange={e => setForm({ ...form, pubblico: e.target.checked ? 1 : 0 })} />
                <span>Visibile agli invitati<span className="block text-xs text-gray-400">Compare nel programma della pagina Wedding.</span></span>
              </label>
              {errore && <p className="text-sm text-red-600">{errore}</p>}
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
