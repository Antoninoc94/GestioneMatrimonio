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
    const giorni = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const dt = new Date(iso + 'T00:00:00');
    return `${giorni[dt.getDay()]} ${parseInt(d)} ${mesi[parseInt(m)]} ${y}`;
  } catch { return iso; }
};

// A5 at ~96 dpi in pixels (148 mm × 210 mm)
const INVITO_W = 560;
const INVITO_H = 794;

export default function Inviti() {
  const [tema, setTema] = useState('classico');
  const [campi, setCampi] = useState(defaultCampi);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef();          // full-size hidden element for capture
  const previewContainerRef = useRef();
  const [previewScale, setPreviewScale] = useState(0.62);

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

  // Compute preview scale from container width
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setPreviewScale(Math.min(0.7, Math.max(0.28, (w - 8) / INVITO_W)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const t = TEMI[tema];
  const campo = (k, v) => setCampi(prev => ({ ...prev, [k]: v }));

  const exportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 120));
    const canvas = await html2canvas(exportRef.current, {
      scale: 4,
      useCORS: true,
      backgroundColor: t.bg,
      logging: false,
      width: INVITO_W,
      height: INVITO_H,
    });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    pdf.addImage(img, 'PNG', 0, 0, 148, 210);
    pdf.save(`invito-${campi.sposo1}-${campi.sposo2}.pdf`.replace(/\s+/g, '-').toLowerCase());
    setExporting(false);
  };

  const doPrint = async () => {
    const canvas = await html2canvas(exportRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: t.bg,
      width: INVITO_W,
      height: INVITO_H,
    });
    const img = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <style>@page{size:A5;margin:0}body{margin:0;padding:0}img{width:148mm;height:auto;display:block}</style>
      </head><body><img src="${img}"/></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const reset = () => {
    setCampi(defaultCampi);
    setTema('classico');
  };

  // Render function (not a React component) to avoid remounting when called
  // from both the hidden export element and the visible preview.
  const renderInvito = (ref) => (
    <div
      ref={ref}
      style={{
        width: `${INVITO_W}px`,
        minHeight: `${INVITO_H}px`,
        background: t.bg,
        fontFamily: t.font,
        padding: '45px 38px',
        boxSizing: 'border-box',
        border: `2px solid ${t.border}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Decorative inner border — z-index 0, behind all text */}
      <div style={{
        position: 'absolute',
        inset: '14px',
        border: `1px solid ${t.border}`,
        opacity: 0.35,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* All content sits above the decorative border */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        flex: 1,
      }}>
        {/* Top ornament */}
        <div style={{ color: t.accent, fontSize: '22px', marginBottom: '16px', letterSpacing: '12px' }}>
          {t.ornament} {t.ornament} {t.ornament}
        </div>

        {/* Opening message */}
        {campi.messaggio_apertura && (
          <p style={{ color: t.body, fontSize: '13px', fontStyle: 'italic', margin: '0 0 22px', lineHeight: 1.65, maxWidth: '430px' }}>
            {campi.messaggio_apertura}
          </p>
        )}

        {/* Names */}
        <div style={{ color: t.title, fontSize: '38px', fontWeight: 'bold', lineHeight: 1.15, marginTop: '10px' }}>
          {campi.sposo1 || 'Sposo'}
        </div>
        <div style={{ color: t.accent, fontSize: '22px', margin: '8px 0' }}>&amp;</div>
        <div style={{ color: t.title, fontSize: '38px', fontWeight: 'bold', lineHeight: 1.15, marginBottom: '28px' }}>
          {campi.sposo2 || 'Sposa'}
        </div>

        {/* Divider */}
        <div style={{ width: '200px', height: '1px', background: t.border, marginBottom: '24px', opacity: 0.55 }} />

        {/* Date */}
        {campi.data && (
          <div style={{ marginBottom: '22px' }}>
            <div style={{ color: t.title, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {fmtDataItaliana(campi.data)}
            </div>
          </div>
        )}

        {/* Ceremony */}
        {(campi.luogo_cerimonia || campi.ora_cerimonia) && (
          <div style={{ marginBottom: '18px', width: '100%' }}>
            <div style={{ color: t.accent, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '7px', fontWeight: 'bold' }}>
              Cerimonia
            </div>
            {campi.ora_cerimonia && (
              <div style={{ color: t.title, fontSize: '17px', fontWeight: 'bold', marginBottom: '3px' }}>{campi.ora_cerimonia}</div>
            )}
            {campi.luogo_cerimonia && (
              <div style={{ color: t.body, fontSize: '14px', fontStyle: 'italic', marginBottom: '3px' }}>{campi.luogo_cerimonia}</div>
            )}
            {campi.indirizzo_cerimonia && (
              <div style={{ color: t.body, fontSize: '12px', opacity: 0.72 }}>{campi.indirizzo_cerimonia}</div>
            )}
          </div>
        )}

        {/* Reception */}
        {(campi.luogo_ricevimento || campi.ora_ricevimento) && (
          <div style={{ marginBottom: '18px', width: '100%' }}>
            <div style={{ color: t.accent, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '7px', fontWeight: 'bold' }}>
              Ricevimento
            </div>
            {campi.ora_ricevimento && (
              <div style={{ color: t.title, fontSize: '17px', fontWeight: 'bold', marginBottom: '3px' }}>{campi.ora_ricevimento}</div>
            )}
            {campi.luogo_ricevimento && (
              <div style={{ color: t.body, fontSize: '14px', fontStyle: 'italic', marginBottom: '3px' }}>{campi.luogo_ricevimento}</div>
            )}
            {campi.indirizzo_ricevimento && (
              <div style={{ color: t.body, fontSize: '12px', opacity: 0.72 }}>{campi.indirizzo_ricevimento}</div>
            )}
          </div>
        )}

        {/* RSVP box */}
        {(campi.rsvp_entro || campi.rsvp_telefono) && (
          <div style={{
            marginTop: '12px',
            padding: '11px 22px',
            border: `1px solid ${t.border}`,
            borderRadius: '4px',
            marginBottom: '18px',
            display: 'inline-block',
          }}>
            <div style={{ color: t.accent, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px', fontWeight: 'bold' }}>
              Conferma presenza
            </div>
            {campi.rsvp_entro && (
              <div style={{ color: t.body, fontSize: '12px', marginBottom: '2px' }}>Entro il {campi.rsvp_entro}</div>
            )}
            {campi.rsvp_telefono && (
              <div style={{ color: t.body, fontSize: '12px' }}>{campi.rsvp_telefono}</div>
            )}
          </div>
        )}

        {/* Bottom divider */}
        <div style={{ width: '200px', height: '1px', background: t.border, margin: 'auto 0 18px', opacity: 0.55 }} />

        {/* Closing message */}
        {campi.messaggio_chiusura && (
          <p style={{ color: t.body, fontSize: '13px', fontStyle: 'italic', margin: '0 0 14px', lineHeight: 1.65, maxWidth: '430px' }}>
            {campi.messaggio_chiusura}
          </p>
        )}

        {/* Bottom ornament */}
        <div style={{ color: t.accent, fontSize: '18px', letterSpacing: '12px' }}>
          {t.ornament} {t.ornament} {t.ornament}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Full-size hidden element used by html2canvas for export/print */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }} aria-hidden="true">
        {renderInvito(exportRef)}
      </div>

      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Generatore Inviti</h1>
          <p className="page-subtitle">Crea il tuo invito personalizzato — formato A5, pronto per la stampa</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={reset}><RefreshCw size={15} /> Reset</button>
          <button className="btn-secondary" onClick={doPrint}><Printer size={15} /> Stampa</button>
          <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'Scarica PDF'}
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Editor ── */}
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
              <label className="form-label">Nome Sposo</label>
              <input className="form-input" value={campi.sposo1} onChange={e => campo('sposo1', e.target.value)} placeholder="Antonino" />
            </div>
            <div>
              <label className="form-label">Nome Sposa</label>
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

        {/* ── Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-6">
            <div className="text-xs text-gray-400 mb-3 text-center">Anteprima — scala adattiva</div>
            <div ref={previewContainerRef} className="w-full">
              {/* Clipping wrapper sized to the scaled invitation */}
              <div style={{
                width: `${INVITO_W * previewScale}px`,
                height: `${INVITO_H * previewScale}px`,
                overflow: 'hidden',
                margin: '0 auto',
                boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
                borderRadius: '3px',
              }}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                  {renderInvito(null)}
                </div>
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
