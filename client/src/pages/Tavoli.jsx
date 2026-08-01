import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, UserX, Download } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);

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

      const cardHeight = t => CARD_HEAD + Math.max(1, t.ospiti.length) * GUEST_ROW + CARD_PAD;

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
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (t.ospiti.length === 0) {
          doc.setTextColor(156, 163, 175);
          doc.text('Nessun ospite assegnato', cx + CARD_PAD, cy + CARD_HEAD + CARD_PAD);
        } else {
          doc.setTextColor(55, 65, 81);
          t.ospiti.forEach((o, idx) => {
            const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;
            doc.text(`• ${name}`, cx + CARD_PAD, cy + CARD_HEAD + idx * GUEST_ROW);
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

      // Senza Tavolo
      if (senzaTavolo.length > 0) {
        const sectionH = 14 + Math.ceil(senzaTavolo.length / 3) * 5;
        if (y + sectionH > PAGE_H - FOOTER_H) { doc.addPage(); y = 14; }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...rose);
        doc.text(`OSPITI SENZA TAVOLO (${senzaTavolo.length})`, 14, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        senzaTavolo.forEach((o, i) => {
          const name = o.cognome ? `${o.cognome} ${o.nome}` : o.nome;
          doc.text(`• ${name}`, 14 + (i % 3) * 61, y + 11 + Math.floor(i / 3) * 5);
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Seating Chart — ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
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
          <button className="btn-secondary" onClick={exportSeatingPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo Tavolo</button>
        </div>
      </div>

      {senzaTavolo.length > 0 && (
        <div className="card mb-5 border-yellow-200 bg-yellow-50/40">
          <div className="flex items-center gap-2 mb-3">
            <UserX size={16} className="text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-700">{senzaTavolo.length} ospiti senza tavolo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {senzaTavolo.map(o => (
              <div key={o.id} className="flex items-center gap-1 bg-white border border-yellow-200 rounded-lg px-2 py-1">
                <span className="text-sm text-gray-700">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</span>
                <select
                  className="text-xs border-0 bg-transparent text-rose-500 font-semibold"
                  value=""
                  onChange={e => e.target.value && assignGuest(o.id, parseInt(e.target.value))}
                >
                  <option value="">Assegna…</option>
                  {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tavoli.map(t => {
          const pct = Math.round((t.ospiti.length / t.capienza) * 100);
          const pieno = t.ospiti.length >= t.capienza;
          return (
            <div key={t.id} className={`card ${pieno ? 'border-orange-200' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{t.nome}</h3>
                  <div className="text-xs text-gray-400">Capienza: {t.capienza} posti</div>
                </div>
                <div className="flex gap-1">
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

              {t.note && <p className="text-xs text-gray-400 mb-2 italic">{t.note}</p>}

              <div className="space-y-1">
                {t.ospiti.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</span>
                    <button
                      className="text-xs text-gray-300 hover:text-red-400"
                      title="Rimuovi dal tavolo"
                      onClick={() => assignGuest(o.id, null)}
                    >✕</button>
                  </div>
                ))}
                {!pieno && (
                  <select
                    className="text-xs text-rose-500 font-semibold border-0 bg-transparent mt-1"
                    value=""
                    onChange={e => e.target.value && assignGuest(parseInt(e.target.value), t.id)}
                  >
                    <option value="">+ Aggiungi ospite…</option>
                    {senzaTavolo.map(o => <option key={o.id} value={o.id}>{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</option>)}
                  </select>
                )}
              </div>
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
