import { useState, useRef, useEffect } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TEMI = {
  classico: {
    label: 'Classico',
    bg: '#fffbf5',
    border: '#c9a84c',
    title: '#5c3d11',
    body: '#5c4a2a',
    accent: '#c9a84c',
    font: 'Georgia, "Times New Roman", serif',
    ornament: '✦',
  },
  romantico: {
    label: 'Romantico',
    bg: '#fff5f7',
    border: '#e11d48',
    title: '#9f1239',
    body: '#4c1d3a',
    accent: '#e11d48',
    font: '"Palatino Linotype", Palatino, serif',
    ornament: '♥',
  },
  moderno: {
    label: 'Moderno',
    bg: '#1a1a2e',
    border: '#c8a96e',
    title: '#f5e6c8',
    body: '#d4c5a9',
    accent: '#c8a96e',
    font: '"Helvetica Neue", Arial, sans-serif',
    ornament: '◆',
  },
  rustico: {
    label: 'Rustico',
    bg: '#fdf6ec',
    border: '#8b6914',
    title: '#5c4a2a',
    body: '#6b5c3e',
    accent: '#8b6914',
    font: '"Garamond", Georgia, serif',
    ornament: '❧',
  },
};

const defaultCampi = {
  sposo1: '',
  sposo2: '',
  data: '',
  ora_cerimonia: '',
  luogo_cerimonia: '',
  indirizzo_cerimonia: '',
  ora_ricevimento: '',
  luogo_ricevimento: '',
  indirizzo_ricevimento: '',
  rsvp_entro: '',
  rsvp_telefono: '',
  messaggio_apertura: 'Con immensa gioia vi invitiamo a celebrare con noi il giorno del nostro matrimonio',
  messaggio_chiusura: 'La vostra presenza sarà il dono più prezioso',
};

const fmtDataItaliana = iso => {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-');
    const mesi = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const giorni = ['', 'domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const dt = new Date(iso);
    return `${giorni[dt.getDay()]} ${parseInt(d)} ${mesi[parseInt(m)]} ${y}`;
  } catch { return iso; }
};

export default function Inviti() {
  const [tema, setTema] = useState('classico');
  const [campi, setCampi] = useState(defaultCampi);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef();

  useEffect(() => {
    api.get('/config').then(r => {
      if (r.data) {
        setCampi(prev => ({
          ...prev,
          sposo1: r.data.nome_sposo1 || '',
          sposo2: r.data.nome_sposo2 || '',
          data: r.data.data_matrimonio || '',
        }));
      }
    }).catch(() => {});
  }, []);

  const t = TEMI[tema];
  const campo = (k, v) => setCampi(prev => ({ ...prev, [k]: v }));

  const exportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));
    const el = previewRef.current;
    const canvas = await html2canvas(el, {
      scale: 4,
      useCORS: true,
      backgroundColor: t.bg,
      logging: false,
    });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    pdf.addImage(img, 'PNG', 0, 0, 148, 210);
    pdf.save(`invito-${campi.sposo1}-${campi.sposo2}.pdf`.replace(/\s+/g, '-').toLowerCase());
    setExporting(false);
  };

  const print = () => {
    const el = previewRef.current;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <style>
        @page { size: A5; margin: 0; }
        body { margin: 0; padding: 0; }
        img { width: 148mm; height: 210mm; display: block; }
      </style>
      </head><body>
      <script>
        window.onload = function() {
          html2canvas(document.getElementById('inv'), {scale:4}).then(c => {
            document.body.innerHTML = '<img src="'+c.toDataURL()+'">';
            window.print();
          });
        }
      </script>
      </body></html>
    `);
    win.document.close();
    // Fallback: render via canvas export
    html2canvas(el, { scale: 4, backgroundColor: t.bg }).then(canvas => {
      const img = canvas.toDataURL('image/png');
      win.document.body.innerHTML = `<img src="${img}" style="width:148mm;height:auto;display:block;" />`;
      win.focus();
      setTimeout(() => win.print(), 500);
    });
  };

  const reset = () => {
    setCampi(defaultCampi);
    setTema('classico');
  };

  const InvitoPreview = () => (
    <div
      ref={previewRef}
      style={{
        width: '148mm',
        minHeight: '210mm',
        background: t.bg,
        fontFamily: t.font,
        padding: '12mm 10mm',
        boxSizing: 'border-box',
        border: `2px solid ${t.border}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Bordo decorativo */}
      <div style={{
        position: 'absolute', inset: '4mm', border: `1px solid ${t.border}`,
        opacity: 0.4, pointerEvents: 'none',
      }} />

      {/* Ornamento top */}
      <div style={{ color: t.accent, fontSize: '22px', marginBottom: '4mm', letterSpacing: '8px' }}>
        {t.ornament} {t.ornament} {t.ornament}
      </div>

      {/* Messaggio apertura */}
      {campi.messaggio_apertura && (
        <p style={{ color: t.body, fontSize: '10px', fontStyle: 'italic', marginBottom: '6mm', lineHeight: 1.5, maxWidth: '110mm' }}>
          {campi.messaggio_apertura}
        </p>
      )}

      {/* Nomi sposi */}
      <div style={{ color: t.title, fontSize: '28px', fontWeight: 'bold', lineHeight: 1.2, marginBottom: '3mm' }}>
        {campi.sposo1 || 'Nome 1'}
      </div>
      <div style={{ color: t.accent, fontSize: '16px', marginBottom: '3mm' }}>&</div>
      <div style={{ color: t.title, fontSize: '28px', fontWeight: 'bold', lineHeight: 1.2, marginBottom: '7mm' }}>
        {campi.sposo2 || 'Nome 2'}
      </div>

      {/* Divisore */}
      <div style={{ width: '60mm', height: '1px', background: t.border, marginBottom: '7mm', opacity: 0.5 }} />

      {/* Data */}
      {campi.data && (
        <div style={{ marginBottom: '6mm' }}>
          <div style={{ color: t.title, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {fmtDataItaliana(campi.data)}
          </div>
        </div>
      )}

      {/* Cerimonia */}
      {(campi.luogo_cerimonia || campi.ora_cerimonia) && (
        <div style={{ marginBottom: '5mm', width: '100%' }}>
          <div style={{ color: t.accent, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '2mm' }}>Cerimonia</div>
          {campi.ora_cerimonia && (
            <div style={{ color: t.title, fontSize: '13px', fontWeight: 'bold' }}>{campi.ora_cerimonia}</div>
          )}
          {campi.luogo_cerimonia && (
            <div style={{ color: t.body, fontSize: '11px', fontStyle: 'italic' }}>{campi.luogo_cerimonia}</div>
          )}
          {campi.indirizzo_cerimonia && (
            <div style={{ color: t.body, fontSize: '9px', opacity: 0.7 }}>{campi.indirizzo_cerimonia}</div>
          )}
        </div>
      )}

      {/* Ricevimento */}
      {(campi.luogo_ricevimento || campi.ora_ricevimento) && (
        <div style={{ marginBottom: '5mm', width: '100%' }}>
          <div style={{ color: t.accent, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '2mm' }}>Ricevimento</div>
          {campi.ora_ricevimento && (
            <div style={{ color: t.title, fontSize: '13px', fontWeight: 'bold' }}>{campi.ora_ricevimento}</div>
          )}
          {campi.luogo_ricevimento && (
            <div style={{ color: t.body, fontSize: '11px', fontStyle: 'italic' }}>{campi.luogo_ricevimento}</div>
          )}
          {campi.indirizzo_ricevimento && (
            <div style={{ color: t.body, fontSize: '9px', opacity: 0.7 }}>{campi.indirizzo_ricevimento}</div>
          )}
        </div>
      )}

      {/* RSVP */}
      {(campi.rsvp_entro || campi.rsvp_telefono) && (
        <div style={{ marginTop: '4mm', padding: '3mm 6mm', border: `1px solid ${t.border}`, borderRadius: '4px', marginBottom: '5mm' }}>
          <div style={{ color: t.accent, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '2mm' }}>Conferma presenza</div>
          {campi.rsvp_entro && (
            <div style={{ color: t.body, fontSize: '9px' }}>Entro il {campi.rsvp_entro}</div>
          )}
          {campi.rsvp_telefono && (
            <div style={{ color: t.body, fontSize: '9px' }}>{campi.rsvp_telefono}</div>
          )}
        </div>
      )}

      {/* Divisore */}
      <div style={{ width: '60mm', height: '1px', background: t.border, marginBottom: '5mm', marginTop: 'auto', opacity: 0.5 }} />

      {/* Messaggio chiusura */}
      {campi.messaggio_chiusura && (
        <p style={{ color: t.body, fontSize: '10px', fontStyle: 'italic', lineHeight: 1.5, maxWidth: '110mm' }}>
          {campi.messaggio_chiusura}
        </p>
      )}

      {/* Ornamento bottom */}
      <div style={{ color: t.accent, fontSize: '18px', marginTop: '4mm', letterSpacing: '8px' }}>
        {t.ornament} {t.ornament} {t.ornament}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Generatore Inviti</h1>
          <p className="page-subtitle">Crea il tuo invito personalizzato — formato A5, pronto per la stampa</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={reset}><RefreshCw size={15} /> Reset</button>
          <button className="btn-secondary" onClick={print}><Printer size={15} /> Stampa</button>
          <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'Scarica PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Editor */}
        <div className="xl:w-96 space-y-4">
          {/* Tema */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Tema</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TEMI).map(([key, th]) => (
                <button
                  key={key}
                  onClick={() => setTema(key)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${tema === key ? 'border-rose-500' : 'border-gray-200 hover:border-gray-300'}`}
                  style={{ background: th.bg }}
                >
                  <div className="text-lg" style={{ color: th.accent }}>{th.ornament}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: th.title, fontFamily: th.font }}>{th.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sposi */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Sposi & Data</h3>
            <div>
              <label className="form-label">Nome Sposo/a 1</label>
              <input className="form-input" value={campi.sposo1} onChange={e => campo('sposo1', e.target.value)} placeholder="Antonino" />
            </div>
            <div>
              <label className="form-label">Nome Sposo/a 2</label>
              <input className="form-input" value={campi.sposo2} onChange={e => campo('sposo2', e.target.value)} placeholder="Valentina" />
            </div>
            <div>
              <label className="form-label">Data matrimonio</label>
              <input type="date" className="form-input" value={campi.data} onChange={e => campo('data', e.target.value)} />
            </div>
          </div>

          {/* Cerimonia */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Cerimonia</h3>
            <div>
              <label className="form-label">Orario</label>
              <input type="time" className="form-input" value={campi.ora_cerimonia} onChange={e => campo('ora_cerimonia', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Luogo</label>
              <input className="form-input" value={campi.luogo_cerimonia} onChange={e => campo('luogo_cerimonia', e.target.value)} placeholder="Chiesa San Marco" />
            </div>
            <div>
              <label className="form-label">Indirizzo</label>
              <input className="form-input" value={campi.indirizzo_cerimonia} onChange={e => campo('indirizzo_cerimonia', e.target.value)} placeholder="Via Roma 1, Napoli" />
            </div>
          </div>

          {/* Ricevimento */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Ricevimento</h3>
            <div>
              <label className="form-label">Orario</label>
              <input type="time" className="form-input" value={campi.ora_ricevimento} onChange={e => campo('ora_ricevimento', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Luogo</label>
              <input className="form-input" value={campi.luogo_ricevimento} onChange={e => campo('luogo_ricevimento', e.target.value)} placeholder="Villa dei Fiori" />
            </div>
            <div>
              <label className="form-label">Indirizzo</label>
              <input className="form-input" value={campi.indirizzo_ricevimento} onChange={e => campo('indirizzo_ricevimento', e.target.value)} />
            </div>
          </div>

          {/* RSVP */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-gray-700">RSVP</h3>
            <div>
              <label className="form-label">Conferma entro</label>
              <input className="form-input" value={campi.rsvp_entro} onChange={e => campo('rsvp_entro', e.target.value)} placeholder="15 marzo 2026" />
            </div>
            <div>
              <label className="form-label">Contatto (telefono / email)</label>
              <input className="form-input" value={campi.rsvp_telefono} onChange={e => campo('rsvp_telefono', e.target.value)} />
            </div>
          </div>

          {/* Messaggi */}
          <div className="card space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Testi</h3>
            <div>
              <label className="form-label">Messaggio apertura</label>
              <textarea className="form-input" rows={3} value={campi.messaggio_apertura} onChange={e => campo('messaggio_apertura', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Messaggio chiusura</label>
              <textarea className="form-input" rows={2} value={campi.messaggio_chiusura} onChange={e => campo('messaggio_chiusura', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1">
          <div className="sticky top-6">
            <div className="text-xs text-gray-400 mb-3 text-center">Anteprima A5 — scala ridotta</div>
            <div className="flex justify-center overflow-x-auto">
              <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: '-60px' }}>
                <InvitoPreview />
              </div>
            </div>
            <div className="text-center mt-4">
              <p className="text-xs text-gray-400">PDF esportato in alta risoluzione (4×) per stampa professionale</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
