import { useEffect, useState, Fragment } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Check, X, Clock, Globe, Heart, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LATO = ['sposo1', 'sposo2', 'comune'];
const RSVP = ['attesa', 'confermato', 'declinato'];
const rsvpColor = { confermato: 'bg-green-100 text-green-700', declinato: 'bg-red-100 text-red-600', attesa: 'bg-yellow-100 text-yellow-700' };
const rsvpLabel = { confermato: 'Confermato', declinato: 'Declinato', attesa: 'In attesa' };
const rsvpIcon = { confermato: Check, declinato: X, attesa: Clock };
const latoLabel = { sposo1: 'Sposo', sposo2: 'Sposa', comune: 'Comune' };

const empty = { nome: '', cognome: '', lato: 'comune', tipo: 'adulto', rsvp: 'attesa', tavolo_id: '', email: '', telefono: '', intolleranze: '', note: '' };

function SortTh({ label, col, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === col;
  return (
    <th
      className={`cursor-pointer select-none hover:bg-rose-50 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc'
            ? <ChevronUp size={12} className="text-rose-500" />
            : <ChevronDown size={12} className="text-rose-500" />
          : <ChevronsUpDown size={12} className="text-gray-300" />}
      </div>
    </th>
  );
}

export default function Ospiti() {
  const [items, setItems] = useState([]);
  const [tavoli, setTavoli] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroRsvp, setFiltroRsvp] = useState('');
  const [filtroLato, setFiltroLato] = useState('');
  const [filtroSito, setFiltroSito] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [conPartner, setConPartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ nome: '', cognome: '', rsvp: 'confermato', intolleranze: '' });
  const [conFigli, setConFigli] = useState(false);
  const [figli, setFigli] = useState([{ nome: '', eta: '', intolleranze: '' }]);

  // new state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('cognome');
  const [sortDir, setSortDir] = useState('asc');
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const load = () => {
    api.get('/ospiti').then(r => setItems(r.data));
    api.get('/tavoli').then(r => setTavoli(r.data));
  };
  useEffect(() => { load(); }, []);

  const resetExtra = () => {
    setConPartner(false);
    setPartnerForm({ id: null, nome: '', cognome: '', rsvp: 'attesa', intolleranze: '' });
    setConFigli(false);
    setFigli([{ id: null, nome: '', eta: '', intolleranze: '', rsvp: 'attesa' }]);
  };

  const openNew = () => { setForm(empty); setEditId(null); resetExtra(); setModal(true); };

  const openEdit = o => {
    setForm({ ...o, tavolo_id: o.tavolo_id || '' });
    setEditId(o.id);

    // Carica partner e figli esistenti (solo per ospiti master)
    const partner = items.find(i => i.parent_id === o.id && i.tipo !== 'bambino');
    const children = items.filter(i => i.parent_id === o.id && i.tipo === 'bambino');

    setConPartner(!!partner);
    setPartnerForm(partner
      ? { id: partner.id, nome: partner.nome || '', cognome: partner.cognome || '', rsvp: partner.rsvp, intolleranze: partner.intolleranze || '' }
      : { id: null, nome: '', cognome: '', rsvp: 'attesa', intolleranze: '' }
    );

    setConFigli(children.length > 0);
    setFigli(children.length > 0
      ? children.map(c => ({ id: c.id, nome: c.nome || '', eta: c.eta != null ? String(c.eta) : '', intolleranze: c.intolleranze || '', rsvp: c.rsvp || 'attesa' }))
      : [{ id: null, nome: '', eta: '', intolleranze: '', rsvp: 'attesa' }]
    );

    setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, tavolo_id: form.tavolo_id || null };

    if (editId) {
      await api.put(`/ospiti/${editId}`, payload);

      // Aggiorna o crea partner
      if (conPartner && partnerForm.nome.trim()) {
        const pp = { nome: partnerForm.nome.trim(), cognome: partnerForm.cognome?.trim() || null, rsvp: partnerForm.rsvp, intolleranze: partnerForm.intolleranze?.trim() || null, lato: form.lato, tipo: 'adulto', parent_id: editId };
        if (partnerForm.id) await api.put(`/ospiti/${partnerForm.id}`, pp);
        else await api.post('/ospiti', pp);
      }

      // Aggiorna o crea figli
      if (conFigli) {
        for (const f of figli) {
          if (!f.nome.trim()) continue;
          const fp = { nome: f.nome.trim(), tipo: 'bambino', rsvp: f.rsvp || 'attesa', eta: parseInt(f.eta) || null, intolleranze: f.intolleranze?.trim() || null, lato: form.lato, parent_id: editId };
          if (f.id) await api.put(`/ospiti/${f.id}`, fp);
          else await api.post('/ospiti', fp);
        }
      }
    } else {
      const r = await api.post('/ospiti', payload);
      const mainId = r.data.id;
      if (conPartner && partnerForm.nome.trim()) {
        await api.post('/ospiti', { nome: partnerForm.nome.trim(), cognome: partnerForm.cognome?.trim() || null, rsvp: partnerForm.rsvp, intolleranze: partnerForm.intolleranze?.trim() || null, lato: form.lato, tipo: 'adulto', parent_id: mainId });
      }
      if (conFigli) {
        for (const f of figli) {
          if (!f.nome.trim()) continue;
          await api.post('/ospiti', { nome: f.nome.trim(), tipo: 'bambino', rsvp: f.rsvp || 'attesa', eta: parseInt(f.eta) || null, intolleranze: f.intolleranze?.trim() || null, lato: form.lato, parent_id: mainId });
        }
      }
    }
    setModal(false);
    load();
  };

  const del = async id => {
    const deps = items.filter(i => i.parent_id === id);
    const msg = deps.length > 0
      ? `Eliminare questo ospite? Verranno eliminati anche ${deps.length} familiare/i collegati (partner/figli).`
      : 'Eliminare questo ospite?';
    if (!confirm(msg)) return;
    await api.delete(`/ospiti/${id}`);
    load();
  };

  const childrenOf = id => items.filter(i => i.parent_id === id);
  const countSito = items.filter(i => i.fonte === 'sito').length;

  const totale = items.length;
  const confermati = items.filter(i => i.rsvp === 'confermato').length;
  const declinati = items.filter(i => i.rsvp === 'declinato').length;
  const adulti = items.filter(i => i.tipo === 'adulto' && i.rsvp === 'confermato').length;
  const bambini = items.filter(i => i.tipo === 'bambino' && i.rsvp === 'confermato').length;

  // filtering + sort pipeline
  const mainGuests = items.filter(i => !i.parent_id);

  const afterFiltri = mainGuests.filter(o => {
    const rsvpMatch = !filtroRsvp || o.rsvp === filtroRsvp || childrenOf(o.id).some(c => c.rsvp === filtroRsvp);
    const sitoMatch = !filtroSito || o.fonte === 'sito' || childrenOf(o.id).some(c => c.fonte === 'sito');
    return rsvpMatch && sitoMatch && (!filtroLato || o.lato === filtroLato);
  });

  const q = search.toLowerCase().trim();
  const afterSearch = q
    ? afterFiltri.filter(o =>
        (o.nome || '').toLowerCase().includes(q) ||
        (o.cognome || '').toLowerCase().includes(q) ||
        (o.tavolo_nome || '').toLowerCase().includes(q) ||
        (o.intolleranze || '').toLowerCase().includes(q) ||
        childrenOf(o.id).some(c =>
          (c.nome || '').toLowerCase().includes(q) ||
          (c.cognome || '').toLowerCase().includes(q) ||
          (c.intolleranze || '').toLowerCase().includes(q)
        )
      )
    : afterFiltri;

  const onSort = col => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('asc'); }
    setPage(1);
  };

  const getSortVal = o => {
    if (sortKey === 'nome') return `${o.cognome || ''} ${o.nome || ''}`.trim().toLowerCase();
    if (sortKey === 'rsvp') return o.rsvp || '';
    if (sortKey === 'lato') return o.lato || '';
    if (sortKey === 'tavolo') return o.tavolo_nome || '';
    return `${o.cognome || ''} ${o.nome || ''}`.trim().toLowerCase();
  };

  const sorted = [...afterSearch].sort((a, b) => {
    const av = getSortVal(a), bv = getSortVal(b);
    return sortDir === 'asc' ? av.localeCompare(bv, 'it') : bv.localeCompare(av, 'it');
  });

  const totalPages = perPage > 0 ? Math.ceil(sorted.length / perPage) : 1;
  const paginated = perPage > 0 ? sorted.slice((page - 1) * perPage, page * perPage) : sorted;

  // bulk actions
  const toggleSelect = id => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () =>
    setSelected(selected.size === paginated.length && paginated.length > 0
      ? new Set()
      : new Set(paginated.map(o => o.id))
    );

  const bulkDelete = async () => {
    if (!confirm(`Eliminare ${selected.size} ospiti selezionati?`)) return;
    for (const id of selected) await api.delete(`/ospiti/${id}`);
    setSelected(new Set());
    load();
  };

  const bulkSetRsvp = async rsvp => {
    for (const id of selected) {
      const o = items.find(i => i.id === id);
      if (o) await api.put(`/ospiti/${id}`, { ...o, rsvp });
      for (const c of items.filter(i => i.parent_id === id)) {
        await api.put(`/ospiti/${c.id}`, { ...c, rsvp });
      }
    }
    setSelected(new Set());
    load();
  };

  const bulkSetTavolo = async val => {
    const tavolo_id = val === '' ? null : parseInt(val);
    for (const id of selected) {
      const o = items.find(i => i.id === id);
      if (o) await api.put(`/ospiti/${id}`, { ...o, tavolo_id: isNaN(tavolo_id) ? null : tavolo_id });
    }
    setSelected(new Set());
    load();
  };

  const exportPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Lista Ospiti', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const subtitle = `${totale} invitati · ${confermati} confermati · ${declinati} declinati · ${items.filter(i => i.rsvp === 'attesa').length} in attesa`;
      doc.text(subtitle, 14, 20);

      // Stats box
      const statsY = 34;
      [[`${adulti}`, 'Adulti conf.'], [`${bambini}`, 'Bambini conf.'], [`${items.filter(i => i.lato === 'sposo1').length}`, 'Lato Sposo'], [`${items.filter(i => i.lato === 'sposo2').length}`, 'Lato Sposa']].forEach(([val, lbl], i) => {
        const x = 14 + i * 47;
        doc.setFillColor(255, 245, 247);
        doc.roundedRect(x, statsY, 43, 14, 2, 2, 'F');
        doc.setTextColor(...rose);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(val, x + 21.5, statsY + 7, { align: 'center' });
        doc.setTextColor(...gray);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(lbl, x + 21.5, statsY + 12, { align: 'center' });
      });

      // Table — ospiti principali + figli/partner come sub-righe
      const rsvpText = { confermato: 'Confermato', declinato: 'Declinato', attesa: 'In attesa' };
      const mainGuestsPdf = items.filter(o => !o.parent_id);
      const rows = [];
      const childRowIndices = new Set();
      let rowIdx = 0;
      for (const o of mainGuestsPdf) {
        rows.push([
          o.cognome ? `${o.cognome} ${o.nome}` : o.nome,
          latoLabel[o.lato] || o.lato,
          'Adulto',
          rsvpText[o.rsvp] || o.rsvp,
          o.tavolo_nome || '-',
          o.intolleranze || '-',
          o.fonte === 'sito' ? 'Da sito' : 'Lista',
        ]);
        rowIdx++;
        for (const c of items.filter(c => c.parent_id === o.id)) {
          rows.push([
            `  > ${c.cognome ? `${c.cognome} ${c.nome}` : c.nome}`,
            latoLabel[c.lato] || '-',
            c.tipo === 'bambino' ? 'Bambino' : 'Partner',
            rsvpText[c.rsvp] || c.rsvp,
            c.tavolo_nome || '-',
            c.intolleranze || '-',
            c.fonte === 'sito' ? 'Da sito' : 'Lista',
          ]);
          childRowIndices.add(rowIdx);
          rowIdx++;
        }
      }

      autoTable(doc, {
        startY: statsY + 20,
        head: [['Nome', 'Lato', 'Tipo', 'RSVP', 'Tavolo', 'Intolleranze', 'Fonte']],
        body: rows,
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 20 },
          2: { cellWidth: 16 },
          3: { cellWidth: 28 },
          4: { cellWidth: 26 },
          5: { cellWidth: 'auto' },
          6: { cellWidth: 18, halign: 'center' },
        },
        didParseCell: data => {
          if (data.section === 'body') {
            if (childRowIndices.has(data.row.index)) {
              data.cell.styles.textColor = [120, 130, 140];
              data.cell.styles.fillColor = [248, 250, 252];
              data.cell.styles.fontSize = 8;
              data.cell.styles.fontStyle = 'italic';
            }
            if (data.column.index === 3) {
              const v = data.cell.raw;
              if (v === 'Confermato') data.cell.styles.textColor = childRowIndices.has(data.row.index) ? [134, 200, 155] : [22, 163, 74];
              else if (v === 'Declinato') data.cell.styles.textColor = childRowIndices.has(data.row.index) ? [220, 150, 150] : [220, 38, 38];
              else data.cell.styles.textColor = [161, 98, 7];
            }
            if (data.column.index === 6 && data.cell.raw === 'Da sito')
              data.cell.styles.textColor = [37, 99, 235];
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${i} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Lista Ospiti - ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('lista-ospiti.pdf');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Lista Ospiti</h1>
          <p className="page-subtitle">{totale} invitati · {confermati} confermati · {declinati} declinati</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi Ospite</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Totale invitati', value: totale, color: 'text-gray-700' },
          { label: 'Confermati', value: confermati, color: 'text-green-600' },
          { label: 'In attesa', value: items.filter(i => i.rsvp === 'attesa').length, color: 'text-yellow-600' },
          { label: 'Declinati', value: declinati, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtri + Ricerca */}
      <div className="card mb-4">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="form-input pl-9"
            placeholder="Cerca nome, cognome, tavolo, intolleranze…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`badge px-3 py-1.5 cursor-pointer ${!filtroRsvp ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => { setFiltroRsvp(''); setPage(1); setSelected(new Set()); }}>Tutti</button>
          {RSVP.map(r => (
            <button key={r} className={`badge px-3 py-1.5 cursor-pointer ${filtroRsvp === r ? 'bg-rose-500 text-white' : rsvpColor[r]}`}
              onClick={() => { setFiltroRsvp(r === filtroRsvp ? '' : r); setPage(1); setSelected(new Set()); }}>
              {rsvpLabel[r]}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {LATO.map(l => (
            <button key={l} className={`badge px-3 py-1.5 cursor-pointer ${filtroLato === l ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => { setFiltroLato(l === filtroLato ? '' : l); setPage(1); setSelected(new Set()); }}>
              {latoLabel[l]}
            </button>
          ))}
          {countSito > 0 && (
            <>
              <div className="w-px bg-gray-200 mx-1" />
              <button
                className={`badge px-3 py-1.5 cursor-pointer flex items-center gap-1 ${filtroSito ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'}`}
                onClick={() => { setFiltroSito(v => !v); setPage(1); setSelected(new Set()); }}>
                <Globe size={11} /> Da sito ({countSito})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 bg-rose-50 border-rose-200">
          <span className="text-sm font-semibold text-rose-700">{selected.size} selezionati</span>
          <select className="form-input w-auto text-sm py-1" defaultValue=""
            onChange={e => { if (e.target.value) { bulkSetRsvp(e.target.value); e.target.value = ''; } }}>
            <option value="" disabled>Cambia RSVP…</option>
            {RSVP.map(r => <option key={r} value={r}>{rsvpLabel[r]}</option>)}
          </select>
          <select className="form-input w-auto text-sm py-1" defaultValue="placeholder"
            onChange={e => { if (e.target.value !== 'placeholder') { bulkSetTavolo(e.target.value); e.target.value = 'placeholder'; } }}>
            <option value="placeholder" disabled>Assegna tavolo…</option>
            <option value="">— Nessun tavolo —</option>
            {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <button className="btn-danger text-sm py-1 px-3 inline-flex items-center gap-1" onClick={bulkDelete}>
            <Trash2 size={14} /> Elimina
          </button>
          <button className="text-sm text-gray-500 hover:text-gray-700 ml-auto" onClick={() => setSelected(new Set())}>
            Annulla selezione
          </button>
        </div>
      )}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {confermati > 0 && (
          <div className="text-xs text-gray-400 px-1">Confermati: {adulti} adulti + {bambini} bambini</div>
        )}
        {afterSearch.length === 0 && (
          <div className="card text-center py-10 text-gray-400">Nessun ospite</div>
        )}
        {afterSearch.map(o => {
          const Icon = rsvpIcon[o.rsvp];
          return (
            <Fragment key={o.id}>
              <div className="card p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className={`badge text-xs flex items-center gap-1 ${rsvpColor[o.rsvp]}`}><Icon size={11} />{rsvpLabel[o.rsvp]}</span>
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{latoLabel[o.lato]}</span>
                      {o.fonte === 'sito' && <span className="badge bg-blue-100 text-blue-600 text-xs flex items-center gap-1"><Globe size={10} />Da sito</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 mb-2">
                  {o.tavolo_nome && <div><span className="text-gray-400">Tavolo:</span> {o.tavolo_nome}</div>}
                  {o.intolleranze && <div className="truncate"><span className="text-gray-400">Intoll.:</span> {o.intolleranze}</div>}
                </div>
                {o.messaggio_ospite && (
                  <p className="text-xs text-gray-400 italic mb-2 truncate">"{o.messaggio_ospite}"</p>
                )}
                <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(o)}><Pencil size={14} /></button>
                  <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => del(o.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {childrenOf(o.id).map(c => {
                const isPartner = c.tipo !== 'bambino';
                return (
                  <div key={c.id} className={`ml-4 border-l-2 pl-3 ${isPartner ? 'border-rose-200' : 'border-purple-200'}`}>
                    <div className={`card p-2.5 ${isPartner ? 'border-rose-100' : 'border-purple-100'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 truncate">{c.cognome ? `${c.cognome} ${c.nome}` : c.nome}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {isPartner
                              ? <span className="badge bg-rose-100 text-rose-600 text-xs flex items-center gap-1"><Heart size={9} />Partner</span>
                              : <span className="badge bg-purple-100 text-purple-600 text-xs">Bambino{c.eta ? ` (${c.eta}a)` : ''}</span>}
                            {c.intolleranze && <span className="badge bg-orange-50 text-orange-600 text-xs truncate max-w-32">{c.intolleranze}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button className="p-1 rounded hover:bg-gray-100 text-gray-400" onClick={() => openEdit(c)}><Pencil size={12} /></button>
                          <button className="p-1 rounded hover:bg-red-50 text-red-300" onClick={() => del(c.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="card hidden sm:block">
        {confermati > 0 && (
          <div className="text-xs text-gray-400 mb-3">
            Confermati: {adulti} adulti + {bambini} bambini
          </div>
        )}
        <div className="table-wrapper">
          <table className="table-pin-first">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input type="checkbox"
                    checked={selected.size === paginated.length && paginated.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <SortTh label="Nome" col="nome" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Lato" col="lato" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Tipo</th>
                <SortTh label="RSVP" col="rsvp" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh label="Tavolo" col="tavolo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Intolleranze</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Nessun ospite</td></tr>
              )}
              {paginated.map(o => {
                const Icon = rsvpIcon[o.rsvp];
                return (
                  <Fragment key={o.id}>
                    <tr>
                      <td className="text-center">
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
                      </td>
                      <td className="font-medium text-gray-900">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</td>
                      <td className="text-gray-500 text-sm">{latoLabel[o.lato]}</td>
                      <td className="text-gray-500 text-sm capitalize">Adulto</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={`badge flex items-center gap-1 w-fit ${rsvpColor[o.rsvp]}`}>
                            <Icon size={11} />{rsvpLabel[o.rsvp]}
                          </span>
                          {o.fonte === 'sito' && (
                            <span className="badge bg-blue-100 text-blue-600 flex items-center gap-1 w-fit text-xs">
                              <Globe size={10} />Da sito
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-gray-500 text-sm">{o.tavolo_nome || '—'}</td>
                      <td className="text-gray-400 text-xs max-w-32">
                        <div className="truncate">{o.intolleranze || '—'}</div>
                        {o.messaggio_ospite && <div className="italic truncate text-gray-300 mt-0.5">"{o.messaggio_ospite}"</div>}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(o)}><Pencil size={14} /></button>
                          <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(o.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {childrenOf(o.id).map(c => {
                      const isPartner = c.tipo !== 'bambino';
                      return (
                        <tr key={c.id} className={isPartner ? 'bg-rose-50/40' : 'bg-purple-50/40'}>
                          <td />
                          <td className="text-gray-600 text-sm">
                            {isPartner
                              ? <Heart size={12} className="inline mr-1 text-rose-300" />
                              : <span className="inline-block w-4 text-purple-300 mr-1">↳</span>}
                            {c.cognome ? `${c.cognome} ${c.nome}` : c.nome}
                          </td>
                          <td className="text-gray-400 text-xs">—</td>
                          <td>
                            {isPartner
                              ? <span className="badge bg-rose-100 text-rose-600 text-xs flex items-center gap-1 w-fit"><Heart size={9} />Partner</span>
                              : <span className="badge bg-purple-100 text-purple-600 text-xs">Bambino{c.eta ? ` (${c.eta}a)` : ''}</span>}
                          </td>
                          <td>
                            <span className={`badge text-xs flex items-center gap-1 w-fit ${rsvpColor[c.rsvp] || 'bg-yellow-100 text-yellow-700'}`}>
                              {(() => { const I = rsvpIcon[c.rsvp] || Clock; return <I size={10} />; })()}
                              {rsvpLabel[c.rsvp] || 'In attesa'}
                            </span>
                          </td>
                          <td className="text-gray-400 text-xs">—</td>
                          <td className="text-gray-400 text-xs">{c.intolleranze || '—'}</td>
                          <td>
                            <div className="flex gap-1">
                              <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                              <button className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400" onClick={() => del(c.id)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginazione */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Righe per pagina:</span>
            <select className="form-input w-auto text-xs py-1" value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
              {[10, 25, 50, 0].map(n => <option key={n} value={n}>{n === 0 ? 'Tutti' : n}</option>)}
            </select>
            <span className="text-xs text-gray-400">{sorted.length} risultati</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(1)}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">«</button>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
              <span className="text-xs px-2 text-gray-600">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
              <button disabled={page === totalPages} onClick={() => setPage(totalPages)}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">»</button>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Ospite' : 'Nuovo Ospite'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Cognome</label>
                  <input className="form-input" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Lato</label>
                  <select className="form-input" value={form.lato} onChange={e => setForm({ ...form, lato: e.target.value })}>
                    {LATO.map(l => <option key={l} value={l}>{latoLabel[l]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="adulto">Adulto</option>
                    <option value="bambino">Bambino</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">RSVP</label>
                  <select className="form-input" value={form.rsvp} onChange={e => {
                    setForm({ ...form, rsvp: e.target.value });
                    if (conPartner) setPartnerForm(p => ({ ...p, rsvp: e.target.value }));
                  }}>
                    {RSVP.map(r => <option key={r} value={r}>{rsvpLabel[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Tavolo</label>
                <select className="form-input" value={form.tavolo_id} onChange={e => setForm({ ...form, tavolo_id: e.target.value })}>
                  <option value="">— Nessun tavolo —</option>
                  {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.ospiti?.length || 0}/{t.capienza})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Intolleranze alimentari</label>
                <input className="form-input" value={form.intolleranze} onChange={e => setForm({ ...form, intolleranze: e.target.value })} placeholder="Es. celiaco, vegano…" />
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              {form.messaggio_ospite && (
                <div>
                  <label className="form-label">Messaggio dall'ospite <span className="font-normal text-gray-400">(da sito)</span></label>
                  <textarea className="form-input text-gray-500 italic" rows={2} value={form.messaggio_ospite} onChange={e => setForm({ ...form, messaggio_ospite: e.target.value })} />
                </div>
              )}

              {/* Partner e figli — visibili anche in edit, solo per ospiti master */}
              {!form.parent_id && (
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  {/* Partner */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" className="rounded" checked={conPartner} onChange={e => {
                        setConPartner(e.target.checked);
                        if (e.target.checked) setPartnerForm(p => ({ ...p, rsvp: form.rsvp }));
                      }} />
                      <Heart size={14} className="text-rose-400" />
                      <span className="text-sm font-medium text-gray-700">Partner / coniuge</span>
                    </label>
                    {conPartner && (
                      <div className="mt-2 pl-4 border-l-2 border-rose-200 space-y-2">
                        {editId && partnerForm.id && (
                          <div className="flex justify-end">
                            <button type="button" className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1" onClick={async () => {
                              if (!confirm('Eliminare il partner?')) return;
                              await api.delete(`/ospiti/${partnerForm.id}`);
                              setConPartner(false);
                              setPartnerForm({ id: null, nome: '', cognome: '', rsvp: 'attesa', intolleranze: '' });
                              load();
                            }}>
                              <Trash2 size={12} /> Elimina partner
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="form-label">Nome *</label>
                            <input className="form-input" value={partnerForm.nome} onChange={e => setPartnerForm(p => ({ ...p, nome: e.target.value }))} />
                          </div>
                          <div>
                            <label className="form-label">Cognome</label>
                            <input className="form-input" value={partnerForm.cognome} onChange={e => setPartnerForm(p => ({ ...p, cognome: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className="form-label">RSVP</label>
                          <select className="form-input" value={partnerForm.rsvp} onChange={e => setPartnerForm(p => ({ ...p, rsvp: e.target.value }))}>
                            {RSVP.map(r => <option key={r} value={r}>{rsvpLabel[r]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Intolleranze</label>
                          <input className="form-input" value={partnerForm.intolleranze} onChange={e => setPartnerForm(p => ({ ...p, intolleranze: e.target.value }))} placeholder="Es. celiaco, vegano…" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Figli */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" className="rounded" checked={conFigli} onChange={e => setConFigli(e.target.checked)} />
                      <Users size={14} className="text-purple-400" />
                      <span className="text-sm font-medium text-gray-700">Figli</span>
                    </label>
                    {conFigli && (
                      <div className="mt-2 pl-4 border-l-2 border-purple-200 space-y-3">
                        {figli.map((f, i) => (
                          <div key={f.id ?? `new-${i}`} className="space-y-2">
                            {i > 0 && <div className="border-t border-purple-100" />}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <label className="form-label">Nome</label>
                                <input className="form-input" value={f.nome} onChange={e => setFigli(fs => fs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                              </div>
                              <div>
                                <label className="form-label">Età</label>
                                <input type="number" min="0" className="form-input" value={f.eta} onChange={e => setFigli(fs => fs.map((x, j) => j === i ? { ...x, eta: e.target.value } : x))} />
                              </div>
                            </div>
                            <div>
                              <label className="form-label">RSVP</label>
                              <select className="form-input" value={f.rsvp} onChange={e => setFigli(fs => fs.map((x, j) => j === i ? { ...x, rsvp: e.target.value } : x))}>
                                {RSVP.map(r => <option key={r} value={r}>{rsvpLabel[r]}</option>)}
                              </select>
                            </div>
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="form-label">Intolleranze</label>
                                <input className="form-input" value={f.intolleranze} onChange={e => setFigli(fs => fs.map((x, j) => j === i ? { ...x, intolleranze: e.target.value } : x))} />
                              </div>
                              {(figli.length > 1 || f.id) && (
                                <button type="button" className="p-2 rounded hover:bg-red-50 text-red-400 mb-0.5" onClick={async () => {
                                  if (f.id) {
                                    if (!confirm('Eliminare questo figlio?')) return;
                                    await api.delete(`/ospiti/${f.id}`);
                                    load();
                                  }
                                  setFigli(fs => {
                                    const next = fs.filter((_, j) => j !== i);
                                    if (next.length === 0) { setConFigli(false); return [{ id: null, nome: '', eta: '', intolleranze: '' }]; }
                                    return next;
                                  });
                                }}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button type="button" className="text-sm text-purple-600 font-medium flex items-center gap-1 hover:text-purple-800" onClick={() => setFigli(fs => [...fs, { id: null, nome: '', eta: '', intolleranze: '', rsvp: 'attesa' }])}>
                          <Plus size={13} /> Aggiungi figlio
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
