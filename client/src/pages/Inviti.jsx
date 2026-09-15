import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Download, Printer, RefreshCw, Save, Wand2 } from 'lucide-react';
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
const PADDING_V = 45;
const BORDO = 2;

export default function Inviti() {
  const [tema, setTema] = useState('classico');
  const [campi, setCampi] = useState(defaultCampi);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef();          // full-size hidden element for capture
  const contentRef = useRef();         // suo contenuto, per misurare se sfora l'A5
  const previewContainerRef = useRef();
  const [previewScale, setPreviewScale] = useState(0.62);
  const [fitScale, setFitScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/config').then(r => {
      const d = r.data;
      if (!d) return;
      // `??` e non `||`: una colonna NULL significa "mai compilato" e prende il
      // testo predefinito, mentre una stringa vuota è una scelta da rispettare.
      const salvato = (col, fallback = '') => d[col] ?? fallback;
      setCampi({
        sposo1: d.nome_sposo1 || '',
        sposo2: d.nome_sposo2 || '',
        data: d.data_matrimonio || '',
        ora_cerimonia: salvato('invito_ora_cerimonia'),
        luogo_cerimonia: salvato('invito_luogo_cerimonia'),
        indirizzo_cerimonia: salvato('invito_indirizzo_cerimonia'),
        ora_ricevimento: salvato('invito_ora_ricevimento'),
        luogo_ricevimento: salvato('invito_luogo_ricevimento'),
        indirizzo_ricevimento: salvato('invito_indirizzo_ricevimento'),
        rsvp_entro: salvato('invito_rsvp_entro'),
        rsvp_telefono: salvato('invito_rsvp_telefono'),
        messaggio_apertura: salvato('invito_messaggio_apertura', defaultCampi.messaggio_apertura),
        messaggio_chiusura: salvato('invito_messaggio_chiusura', defaultCampi.messaggio_chiusura),
      });
      setTema(d.invito_tema || 'classico');
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

  // Il cartoncino è fisso ad A5: se il contenuto lo supera viene rimpicciolito
  // quanto basta, invece di scendere fuori pagina e farsi tagliare dalla cattura.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const disponibile = INVITO_H - PADDING_V * 2 - BORDO * 2;
    const naturale = el.scrollHeight;
    setFitScale(naturale > disponibile ? disponibile / naturale : 1);
  }, [campi, tema]);

  const t = TEMI[tema];
  const campo = (k, v) => setCampi(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/config', {
        invito_tema: tema,
        invito_ora_cerimonia: campi.ora_cerimonia,
        invito_luogo_cerimonia: campi.luogo_cerimonia,
        invito_indirizzo_cerimonia: campi.indirizzo_cerimonia,
        invito_ora_ricevimento: campi.ora_ricevimento,
        invito_luogo_ricevimento: campi.luogo_ricevimento,
        invito_indirizzo_ricevimento: campi.indirizzo_ricevimento,
        invito_rsvp_entro: campi.rsvp_entro,
        invito_rsvp_telefono: campi.rsvp_telefono,
        invito_messaggio_apertura: campi.messaggio_apertura,
        invito_messaggio_chiusura: campi.messaggio_chiusura,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // Luoghi e orari sono già in Location & Chiesa e in Cronologia: riprenderli
  // da lì evita di riscriverli e di lasciarli indietro se cambiano.
  const TIPI_CERIMONIA = ['Chiesa', 'Municipio', 'Cerimonia civile'];
  const precompila = async () => {
    setMsg('');
    try {
      const [loc, cron] = await Promise.all([api.get('/location'), api.get('/cronologia')]);
      const confermate = loc.data.filter(l => l.stato === 'confermato');
      const cerimonia = confermate.find(l => TIPI_CERIMONIA.includes(l.tipo));
      const ricevimento = confermate.find(l => l.tipo === 'Ricevimento');
      const primaOra = tipo => cron.data.filter(e => e.tipo === tipo && e.ora).map(e => e.ora).sort()[0];

      const trovati = {
        luogo_cerimonia: cerimonia?.nome,
        indirizzo_cerimonia: cerimonia?.indirizzo,
        ora_cerimonia: primaOra('cerimonia'),
        luogo_ricevimento: ricevimento?.nome,
        indirizzo_ricevimento: ricevimento?.indirizzo,
        ora_ricevimento: primaOra('ricevimento'),
      };
      const nuovi = Object.entries(trovati).filter(([, v]) => v);
      if (!nuovi.length) {
        setMsg('Nessun dato da riprendere: servono una location con stato “confermato” oppure orari in Cronologia.');
        return;
      }
      const sovrascrive = nuovi.filter(([k, v]) => campi[k] && campi[k] !== v);
      if (sovrascrive.length && !confirm(
        `${sovrascrive.length === 1 ? 'Un campo già compilato verrà sostituito' : `${sovrascrive.length} campi già compilati verranno sostituiti`} con i dati del matrimonio. Procedere?`
      )) return;

      setCampi(prev => ({ ...prev, ...Object.fromEntries(nuovi) }));
      setMsg(`Ripresi ${nuovi.length} campi da Location e Cronologia. Ricorda di salvare.`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Errore nel recupero dei dati del matrimonio');
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    setMsg('');
    try {
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
    } catch {
      setMsg('Non è stato possibile generare il PDF. Riprova.');
    } finally {
      // senza finally un errore lascerebbe il pulsante bloccato su "Esporto…"
      setExporting(false);
    }
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
    // Con un popup blocker window.open torna null: senza questo controllo
    // la stampa falliva con un errore in console e nessun segnale a schermo.
    if (!win) {
      setMsg('La finestra di stampa è stata bloccata dal browser: consenti i popup per questo sito.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head>
      <style>@page{size:A5;margin:0}body{margin:0;padding:0}img{width:148mm;height:auto;display:block}</style>
      </head><body><img src="${img}"/></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const reset = () => {
    if (!confirm('Riportare tutti i campi ai valori predefiniti? Le modifiche non salvate andranno perse.')) return;
    setCampi(defaultCampi);
    setTema('classico');
    setMsg('');
  };

  // Render function (not a React component) to avoid remounting when called
  // from both the hidden export element and the visible preview.
  const renderInvito = (ref, innerRef) => (
    <div
      ref={ref}
      style={{
        width: `${INVITO_W}px`,
        height: `${INVITO_H}px`,
        background: t.bg,
        fontFamily: t.font,
        padding: `${PADDING_V}px 38px`,
        boxSizing: 'border-box',
        border: `${BORDO}px solid ${t.border}`,
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
      <div
        ref={innerRef}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          flex: 1,
          // scale uniforme: le righe restano quelle, solo più piccole
          transform: `scale(${fitScale})`,
          transformOrigin: 'top center',
        }}
      >
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
        {renderInvito(exportRef, contentRef)}
      </div>

      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Generatore Inviti</h1>
          <p className="page-subtitle">Crea il tuo invito personalizzato — formato A5, pronto per la stampa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={reset}><RefreshCw size={15} /> Reset</button>
          <button className="btn-secondary" onClick={doPrint}><Printer size={15} /> Stampa</button>
          <button className="btn-secondary" onClick={save} disabled={saving}>
            <Save size={15} /> {saved ? 'Salvato!' : saving ? 'Salvo…' : 'Salva'}
          </button>
          <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'Scarica PDF'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {msg}
        </div>
      )}

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

          {/* Dati già presenti nell'app */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-1">Dati del matrimonio</h3>
            <p className="text-xs text-gray-400 mb-3">
              Riprende luoghi e indirizzi dalle location confermate e gli orari dalla Cronologia, invece di riscriverli.
            </p>
            <button type="button" className="btn-secondary w-full justify-center" onClick={precompila}>
              <Wand2 size={15} /> Riprendi dai dati del matrimonio
            </button>
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
                  {renderInvito(null, null)}
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              {fitScale < 1 && (
                <p className="text-xs text-amber-600 mb-1">
                  Testo ridotto al {Math.round(fitScale * 100)}% per farlo entrare nell'A5 — accorcia i messaggi per tenerlo alla dimensione piena.
                </p>
              )}
              <p className="text-xs text-gray-400">PDF esportato in alta risoluzione (4×) per stampa professionale</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
