import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, UserX, Download, Tag, LayoutGrid, List, Search, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import api from '../api';

const rsvpColor = { confermato: 'text-green-600', declinato: 'text-red-400', attesa: 'text-yellow-500' };
const empty = { nome: '', capienza: 8, note: '' };

export default function Tavoli() {
  const [tavoli, setTavoli] = useState([]);
  const [ospiti, setOspiti] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [assignModal, setAssignModal] = useState(null);

  const load = () => {
    api.get('/tavoli').then(r => setTavoli(r.data));
    api.get('/ospiti').then(r => setOspiti(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = t => { setForm({ nome: t.nome, capienza: t.capienza, note: t.note || '' }); setEditId(t.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (editId) await api.put(`/tavoli/${editId}`, form);
    else await api.post('/tavoli', form);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo tavolo? Gli ospiti assegnati verranno scollegati.')) return;
    await api.delete(`/tavoli/${id}`);
    load();
  };

  const assignGuest = async (ospitoId, tavoloId) => {
    await api.put(`/ospiti/${ospitoId}`, { ...ospiti.find(o => o.id === ospitoId), tavolo_id: tavoloId });
    load();
  };

  const senzaTavolo = ospiti.filter(o => !o.tavolo_id);
  const totaleAssegnati = ospiti.filter(o => o.tavolo_id).length;
  const parentName = parentId => {
    const p = ospiti.find(o => o.id === parentId);
    return p ? (p.cognome ? `${p.cognome} ${p.nome}` : p.nome) : null;
  };
  const guestLabel = o => {
    const base = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;
    if (!o.parent_id) return base;
    const pn = parentName(o.parent_id);
    const rel = o.tipo === 'bambino' ? 'figlio' : 'partner';
    return pn ? `${base} (${rel} di ${pn})` : base;
  };
  const [collapsedTavoli, setCollapsedTavoli] = useState(new Set());
  const toggleCollapse = id => setCollapsedTavoli(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const [exporting, setExporting] = useState(false);
  const [exportingCards, setExportingCards] = useState(false);
  const [vistaCompatta, setVistaCompatta] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [searchSenza, setSearchSenza] = useState('');

  const exportSegnaposti = () => {
    const assegnati = ospiti.filter(o => o.tavolo_id && o.rsvp === 'confermato' && !o.parent_id);
    // Include anche figli/partner confermati
    const tutti = ospiti.filter(o => o.tavolo_id && o.rsvp === 'confermato');
    if (tutti.length === 0) return alert('Nessun ospite confermato con tavolo assegnato.');
    setExportingCards(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];

      // 2 colonne × 4 righe = 8 card per pagina
      const COLS = 2, ROWS = 4;
      const MARGIN = 10;
      const PAGE_W = 210, PAGE_H = 297;
      const cardW = (PAGE_W - MARGIN * (COLS + 1)) / COLS;   // ~90mm
      const cardH = (PAGE_H - MARGIN * (ROWS + 1)) / ROWS;   // ~63mm

      const tavoloMap = {};
      tavoli.forEach(t => { tavoloMap[t.id] = t.nome; });

      tutti.forEach((o, idx) => {
        const page = Math.floor(idx / (COLS * ROWS));
        const pos  = idx % (COLS * ROWS);
        const col  = pos % COLS;
        const row  = Math.floor(pos / COLS);

        if (pos === 0 && idx > 0) doc.addPage();

        const cx = MARGIN + col * (cardW + MARGIN);
        const cy = MARGIN + row * (cardH + MARGIN);

        // Bordo card
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.4);
        doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'S');

        // Linea rose in alto
        doc.setFillColor(...rose);
        doc.roundedRect(cx, cy, cardW, 5, 3, 3, 'F');
        doc.setFillColor(...rose);
        doc.rect(cx, cy + 2, cardW, 3, 'F');

        // Nome ospite
        const nome = o.cognome ? `${o.nome} ${o.cognome}` : o.nome;
        doc.setFont('times', 'bold');
        doc.setFontSize(nome.length > 20 ? 14 : 17);
        doc.setTextColor(17, 24, 39);
        const nomeLines = doc.splitTextToSize(nome, cardW - 10);
        const nomeY = cy + cardH / 2 - (nomeLines.length - 1) * 4;
        doc.text(nomeLines, cx + cardW / 2, nomeY, { align: 'center', baseline: 'middle' });

        // Separatore
        doc.setDrawColor(...rose);
        doc.setLineWidth(0.3);
        doc.line(cx + 12, cy + cardH / 2 + 8, cx + cardW - 12, cy + cardH / 2 + 8);

        // Nome tavolo
        const tavolo = tavoloMap[o.tavolo_id] || '';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(tavolo, cx + cardW / 2, cy + cardH / 2 + 15, { align: 'center' });

        // Piccolo cuore decorativo
        doc.setTextColor(...rose);
        doc.setFontSize(8);
        doc.text('*', cx + cardW / 2, cy + cardH - 6, { align: 'center' });
      });

      doc.save('segnaposti.pdf');
    } finally {
      setExportingCards(false);
    }
  };

  const exportSeatingPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];
      const COL_W = 85;
      const GAP = 12;
      const LEFT = 14;
      const PAGE_H = 297;
      const FOOTER_H = 15;
      const CARD_PAD = 4;
      const CARD_HEAD = 16; // name + bar + spacing
      const GUEST_ROW = 5;
      const ROW_GAP = 4;

      // Build ordered guest lines per table (main guests + their children/partners indented)
      // tableOspiti = guests of this table; ospiti (closure) = all guests for parent lookup
      const buildGuestLines = tableOspiti => {
        const ospIds = new Set(tableOspiti.map(o => o.id));
        // Mains: no parent, OR parent is in another table (orphan)
        const mains = tableOspiti.filter(o => !o.parent_id || !ospIds.has(o.parent_id));
        const byParent = {};
        tableOspiti.filter(o => o.parent_id && ospIds.has(o.parent_id)).forEach(o => {
          (byParent[o.parent_id] = byParent[o.parent_id] || []).push(o);
        });
        const lines = [];
        for (const o of mains) {
          let parentNote = null;
          if (o.parent_id) {
            const p = ospiti.find(p => p.id === o.parent_id);
            if (p) parentNote = p.cognome ? `${p.cognome} ${p.nome}` : p.nome;
          }
          lines.push({ o, indent: false, parentNote });
          for (const c of byParent[o.id] || []) lines.push({ o: c, indent: true, parentNote: null });
        }
        return lines;
      };

      const cardHeight = t => {
        const lines = buildGuestLines(t.ospiti);
        const rows = Math.max(1, lines.length);
        return CARD_HEAD + rows * GUEST_ROW + CARD_PAD;
      };

      const drawCard = (t, cx, cy, height) => {
        const pieno = t.ospiti.length >= t.capienza;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...(pieno ? [253, 186, 116] : [229, 231, 235]));
        doc.setLineWidth(0.4);
        doc.roundedRect(cx, cy, COL_W, height, 3, 3, 'FD');

        // Name
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(t.nome, cx + CARD_PAD, cy + CARD_PAD + 4);

        // Capacity label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text(`${t.ospiti.length}/${t.capienza}`, cx + COL_W - CARD_PAD, cy + CARD_PAD + 4, { align: 'right' });

        // Capacity bar
        const barW = COL_W - 2 * CARD_PAD;
        const fillW = t.capienza > 0 ? Math.min((t.ospiti.length / t.capienza) * barW, barW) : 0;
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(cx + CARD_PAD, cy + CARD_PAD + 7, barW, 2, 1, 1, 'F');
        if (fillW > 0) {
          doc.setFillColor(...(pieno ? [249, 115, 22] : [52, 211, 153]));
          doc.roundedRect(cx + CARD_PAD, cy + CARD_PAD + 7, fillW, 2, 1, 1, 'F');
        }

        // Guests
        if (t.ospiti.length === 0) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(156, 163, 175);
          doc.text('Nessun ospite assegnato', cx + CARD_PAD, cy + CARD_HEAD + CARD_PAD);
        } else {
          const lines = buildGuestLines(t.ospiti);
          lines.forEach(({ o, indent, parentNote }, idx) => {
            const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;
            const prefix = indent ? '  > ' : '- ';
            const gy = cy + CARD_HEAD + idx * GUEST_ROW;
            if (indent) {
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(120, 130, 140);
            } else {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(55, 65, 81);
            }
            let label = `${prefix}${name}`;
            if (o.intolleranze) label += `  (${o.intolleranze})`;
            if (parentNote) label += `  [di ${parentNote}]`;
            doc.text(doc.splitTextToSize(label, COL_W - 2 * CARD_PAD)[0], cx + CARD_PAD, gy);
          });
        }
      };

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Disposizione Tavoli', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${tavoli.length} tavoli · ${totaleAssegnati}/${ospiti.length} ospiti · ${new Date().toLocaleDateString('it-IT')}`, 14, 20);

      // Cards — paired rows, 2 columns
      let y = 34;
      for (let i = 0; i < tavoli.length; i += 2) {
        const tL = tavoli[i];
        const tR = tavoli[i + 1];
        const rowH = Math.max(cardHeight(tL), tR ? cardHeight(tR) : 0);

        if (y + rowH > PAGE_H - FOOTER_H) {
          doc.addPage();
          y = 14;
        }

        drawCard(tL, LEFT, y, rowH);
        if (tR) drawCard(tR, LEFT + COL_W + GAP, y, rowH);

        y += rowH + ROW_GAP;
      }

      // Senza Tavolo — raggruppati per nucleo familiare
      if (senzaTavolo.length > 0) {
        const senzaLines = buildGuestLines(senzaTavolo);

        const LINE_H = 5.5;
        const HALF = Math.ceil(senzaLines.length / 2);
        const sectionH = 12 + HALF * LINE_H + 4;

        if (y + sectionH > PAGE_H - FOOTER_H) { doc.addPage(); y = 14; }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...rose);
        doc.text(`OSPITI SENZA TAVOLO (${senzaTavolo.length})`, LEFT, y + 6);
        y += 12;

        const COL2_X = LEFT + COL_W + GAP;  // 111
        const MAX_W = COL_W;

        senzaLines.forEach(({ o, indent, parentNote }, i) => {
          const isRight = i >= HALF;
          const row = isRight ? i - HALF : i;
          const cx = isRight ? COL2_X : LEFT;
          const cy = y + row * LINE_H;
          const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;

          if (indent) {
            const rel = o.tipo === 'bambino' ? 'figlio' : 'partner';
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(120, 130, 140);
            doc.text(doc.splitTextToSize(`  > ${name} [${rel}]`, MAX_W - 4)[0], cx + 4, cy);
          } else {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(55, 65, 81);
            let label = `- ${name}`;
            if (parentNote) label += ` [di ${parentNote}]`;
            doc.text(doc.splitTextToSize(label, MAX_W)[0], cx, cy);
          }
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Seating Chart - ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('seating-chart.pdf');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Disposizione Tavoli</h1>
          <p className="page-subtitle">{tavoli.length} tavoli · {totaleAssegnati}/{ospiti.length} ospiti assegnati</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportSegnaposti} disabled={exportingCards}>
            <Tag size={15} /> {exportingCards ? 'Esporto…' : 'Segnaposti'}
          </button>
          <button className="btn-secondary" onClick={exportSeatingPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo Tavolo</button>
        </div>
      </div>

      {senzaTavolo.length > 0 && (
        <div className="card mb-5 border-yellow-200 bg-yellow-50/40">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 mr-auto">
              <UserX size={16} className="text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-700">{senzaTavolo.length} ospiti senza tavolo</span>
            </div>
            {/* Toggle vista */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setVistaCompatta(false)}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${!vistaCompatta ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                <LayoutGrid size={13} /> Carte
              </button>
              <button
                onClick={() => setVistaCompatta(true)}
                className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${vistaCompatta ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                <List size={13} /> Lista
              </button>
            </div>
          </div>

          {/* Ricerca + filtro tipo */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="form-input pl-9 py-1.5 text-sm"
                placeholder="Cerca ospite…"
                value={searchSenza}
                onChange={e => setSearchSenza(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {[['', 'Tutti'], ['adulto', 'Adulti'], ['bambino', 'Bambini 👶']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFiltroTipo(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtroTipo === val ? 'bg-rose-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            // Filtro + ricerca
            const q = searchSenza.toLowerCase().trim();
            const senzaFiltrati = senzaTavolo.filter(o => {
              if (filtroTipo === 'bambino' && o.tipo !== 'bambino') return false;
              if (filtroTipo === 'adulto' && o.tipo === 'bambino') return false;
              if (q) return (o.nome || '').toLowerCase().includes(q) || (o.cognome || '').toLowerCase().includes(q);
              return true;
            });

            const nessunRisultato = senzaFiltrati.length === 0;

            const AssegnaSelect = ({ o }) => (
              <select
                className="text-xs border border-gray-200 rounded-md text-rose-600 font-semibold px-2 py-1.5 bg-white flex-shrink-0 cursor-pointer hover:border-rose-300"
                value=""
                onChange={e => e.target.value && assignGuest(o.id, parseInt(e.target.value))}
              >
                <option value="">Assegna…</option>
                {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            );

            if (nessunRisultato) {
              return <p className="text-sm text-gray-400 text-center py-4">Nessun ospite trovato</p>;
            }

            // ── Vista LISTA compatta ──────────────────────────────────
            if (vistaCompatta) {
              // Ordine: main guests con i propri figli/partner subito dopo
              const mains = senzaFiltrati.filter(o => !o.parent_id);
              const byParent = {};
              senzaTavolo.filter(o => o.parent_id).forEach(o => {
                (byParent[o.parent_id] = byParent[o.parent_id] || []).push(o);
              });
              const flat = [];
              for (const m of mains) {
                flat.push(m);
                for (const c of (byParent[m.id] || []).filter(c => senzaFiltrati.includes(c))) flat.push(c);
              }
              // Orfani filtrati (parent già assegnato)
              senzaFiltrati.filter(o => o.parent_id && !senzaTavolo.find(mg => mg.id === o.parent_id))
                .forEach(o => flat.push(o));

              return (
                <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                  {flat.map(o => {
                    const isChild = o.tipo === 'bambino';
                    const isPartner = !!o.parent_id && !isChild;
                    const parent = o.parent_id ? ospiti.find(p => p.id === o.parent_id) : null;
                    return (
                      <div key={o.id} className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors ${o.parent_id ? 'pl-7' : ''}`}>
                        {isChild   && <span className="text-purple-300 text-xs flex-shrink-0">↳</span>}
                        {isPartner && <span className="text-rose-300 text-xs flex-shrink-0">♥</span>}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm truncate ${isChild ? 'text-purple-700' : isPartner ? 'text-rose-600' : 'text-gray-800 font-medium'}`}>
                            {o.cognome ? `${o.cognome} ${o.nome}` : o.nome}
                            {isChild && o.eta ? <span className="ml-1 text-xs opacity-50">({o.eta}a)</span> : null}
                          </span>
                          {parent && (
                            <span className="text-xs text-gray-400 ml-1.5">
                              — {isChild ? 'figlio' : 'partner'} di {parent.cognome ? `${parent.cognome} ${parent.nome}` : parent.nome}
                            </span>
                          )}
                        </div>
                        <AssegnaSelect o={o} />
                      </div>
                    );
                  })}
                </div>
              );
            }

            // ── Vista CARTE (default) ─────────────────────────────────
            const mainGuests = senzaTavolo.filter(o => !o.parent_id)
              .filter(mg => senzaFiltrati.find(f => f.id === mg.id || f.parent_id === mg.id));
            const familyOf = id => senzaTavolo.filter(o => o.parent_id === id && senzaFiltrati.includes(o));
            const orphans = senzaFiltrati.filter(o => o.parent_id && !senzaTavolo.find(mg => mg.id === o.parent_id));

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                {mainGuests.map(mg => {
                  const family = familyOf(mg.id);
                  return (
                    <div key={mg.id} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">
                          {mg.cognome ? `${mg.cognome} ${mg.nome}` : mg.nome}
                        </span>
                        <AssegnaSelect o={mg} />
                      </div>
                      {family.length > 0 && (
                        <div className="border-t border-gray-50 divide-y divide-gray-50">
                          {family.map(f => {
                            const isChild = f.tipo === 'bambino';
                            return (
                              <div key={f.id} className={`flex items-center gap-3 pl-5 pr-3 py-2 ${isChild ? 'bg-purple-50/50' : 'bg-rose-50/50'}`}>
                                <span className={`text-xs flex-shrink-0 ${isChild ? 'text-purple-300' : 'text-rose-300'}`}>
                                  {isChild ? '↳' : '♥'}
                                </span>
                                <span className={`flex-1 text-xs truncate ${isChild ? 'text-purple-700' : 'text-rose-600'}`}>
                                  {f.cognome ? `${f.cognome} ${f.nome}` : f.nome}
                                  {isChild && f.eta ? <span className="ml-1 opacity-60">({f.eta}a)</span> : null}
                                </span>
                                <AssegnaSelect o={f} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {orphans.map(o => {
                  const isChild = o.tipo === 'bambino';
                  return (
                    <div key={o.id} className={`flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border ${isChild ? 'border-purple-100' : 'border-rose-100'}`}>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${isChild ? 'text-purple-700' : 'text-rose-600'}`}>
                          {o.cognome ? `${o.cognome} ${o.nome}` : o.nome}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          <span className={isChild ? 'text-purple-400' : 'text-rose-400'}>{isChild ? '↳ Bambino' : '♥ Partner'}</span>
                          {' '}di {parentName(o.parent_id)}
                        </div>
                      </div>
                      <AssegnaSelect o={o} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tavoli.map(t => {
          const pct = Math.round((t.ospiti.length / t.capienza) * 100);
          const pieno = t.ospiti.length >= t.capienza;
          const collapsed = collapsedTavoli.has(t.id);
          return (
            <div key={t.id} className={`card ${pieno ? 'border-orange-200' : ''}`}>
              {/* Header — cliccabile per collapse */}
              <div
                className="flex items-center gap-2 mb-2 cursor-pointer select-none"
                onClick={() => toggleCollapse(t.id)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
                    {t.nome}
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
                    />
                  </h3>
                  <div className="text-xs text-gray-400">Capienza: {t.capienza} posti</div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                  <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pieno ? '#f97316' : '#34d399' }} />
                </div>
                <span className={`text-xs font-bold ${pieno ? 'text-orange-500' : 'text-gray-500'}`}>{t.ospiti.length}/{t.capienza}</span>
              </div>

              {!collapsed && t.note && <p className="text-xs text-gray-400 mb-2 italic">{t.note}</p>}

              {!collapsed && <div className="space-y-1.5">
                {(() => {
                  const mainGuests = t.ospiti.filter(o => !o.parent_id);
                  const getFamily = id => t.ospiti.filter(o => o.parent_id === id);
                  const orphans = t.ospiti.filter(o => o.parent_id && !t.ospiti.find(mg => mg.id === o.parent_id));

                  const rowJsx = (o, showParentHint = false) => {
                    const isChild = o.tipo === 'bambino';
                    const isPartner = !!o.parent_id && !isChild;
                    const pName = showParentHint && o.parent_id ? parentName(o.parent_id) : null;
                    return (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {isPartner && <span className="text-rose-300 text-xs flex-shrink-0">♥</span>}
                          {isChild   && <span className="text-purple-300 text-xs flex-shrink-0">↳</span>}
                          <div className="min-w-0 flex-1">
                            <div className={`truncate ${isChild ? 'text-purple-700 text-xs' : isPartner ? 'text-rose-600 text-xs' : 'text-gray-800 font-medium'}`}>
                              {o.cognome ? `${o.cognome} ${o.nome}` : o.nome}
                              {isChild && o.eta ? <span className="ml-1 opacity-60">({o.eta}a)</span> : null}
                            </div>
                            {pName && (
                              <div className="text-gray-400 text-xs">{isChild ? 'figlio' : 'partner'} di {pName}</div>
                            )}
                          </div>
                        </div>
                        <button className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0 ml-2" onClick={() => assignGuest(o.id, null)}>✕</button>
                      </div>
                    );
                  };

                  return (
                    <>
                      {mainGuests.map(mg => {
                        const family = getFamily(mg.id);
                        return (
                          <div key={mg.id}>
                            {rowJsx(mg)}
                            {family.length > 0 && (
                              <div className="ml-2 mt-0.5 pl-2 border-l-2 border-gray-100 space-y-0.5">
                                {family.map(f => <div key={f.id}>{rowJsx(f)}</div>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {orphans.map(o => <div key={o.id}>{rowJsx(o, true)}</div>)}
                    </>
                  );
                })()}
                {!pieno && (
                  <select
                    className="text-xs text-rose-500 font-semibold border-0 bg-transparent mt-1"
                    value=""
                    onChange={e => e.target.value && assignGuest(parseInt(e.target.value), t.id)}
                  >
                    <option value="">+ Aggiungi ospite…</option>
                    {senzaTavolo.map(o => <option key={o.id} value={o.id}>{guestLabel(o)}</option>)}
                  </select>
                )}
              </div>}
            </div>
          );
        })}

        {tavoli.length === 0 && (
          <div className="col-span-full card text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nessun tavolo ancora. Creane uno!</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Tavolo' : 'Nuovo Tavolo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome tavolo *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Es. Tavolo degli Sposi" required />
                </div>
                <div>
                  <label className="form-label">Capienza</label>
                  <div className="flex items-center gap-2">
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: Math.max(1, (form.capienza || 1) - 1) })}>−</button>
                    <input type="number" min={1} inputMode="numeric" className="form-input text-center font-bold text-lg" value={form.capienza}
                      onChange={e => setForm({ ...form, capienza: parseInt(e.target.value) || 1 })} />
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: (form.capienza || 1) + 1 })}>+</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Note</label>
                <input className="form-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
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
