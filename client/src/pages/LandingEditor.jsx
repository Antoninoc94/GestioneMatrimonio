import { useEffect, useState, useRef } from 'react';
import { Save, Image, Trash2, ExternalLink, Globe } from 'lucide-react';
import api from '../api';

const TEMI = [
  { key: 'rose',    label: 'Rosa',      primary: '#e11d48', light: '#fff1f2', border: '#fecdd3' },
  { key: 'lavanda', label: 'Lavanda',   primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
  { key: 'salvia',  label: 'Salvia',    primary: '#059669', light: '#ecfdf5', border: '#a7f3d0' },
  { key: 'cielo',   label: 'Cielo',     primary: '#0284c7', light: '#f0f9ff', border: '#bae6fd' },
  { key: 'oro',     label: 'Champagne', primary: '#b45309', light: '#fffbeb', border: '#fde68a' },
];

const POSIZIONI = [
  { label: 'Alto sinistra',  value: 'left top' },
  { label: 'Alto centro',    value: 'center top' },
  { label: 'Alto destra',    value: 'right top' },
  { label: 'Centro sinistra',value: 'left center' },
  { label: 'Centro',         value: 'center center' },
  { label: 'Centro destra',  value: 'right center' },
  { label: 'Basso sinistra', value: 'left bottom' },
  { label: 'Basso centro',   value: 'center bottom' },
  { label: 'Basso destra',   value: 'right bottom' },
];

const empty = {
  landing_abilitata: true,
  landing_messaggio: '',
  landing_dress_code: '',
  landing_info_pratiche: '',
  landing_tema: 'rose',
  landing_foto_posizione: 'center top',
};

export default function LandingEditor() {
  const [form, setForm] = useState(empty);
  const [foto, setFoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.get('/config').then(r => {
      const d = r.data;
      setForm({
        landing_abilitata: d.landing_abilitata !== 0,
        landing_messaggio: d.landing_messaggio || '',
        landing_dress_code: d.landing_dress_code || '',
        landing_info_pratiche: d.landing_info_pratiche || '',
        landing_tema: d.landing_tema || 'rose',
        landing_foto_posizione: d.landing_foto_posizione || 'center top',
      });
      setFoto(d.landing_foto || null);
    });
  }, []);

  const save = async e => {
    e.preventDefault();
    await api.put('/config', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleAbilitata = async () => {
    const nuovoValore = !form.landing_abilitata;
    setForm(f => ({ ...f, landing_abilitata: nuovoValore }));
    await api.put('/config', { landing_abilitata: nuovoValore });
  };

  const uploadFoto = async file => {
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const { data } = await api.post('/landing/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFoto(data.landing_foto);
      setMsg('✓ Foto caricata');
    } catch {
      setMsg('✗ Errore upload');
    } finally {
      setUploading(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const deleteFoto = async () => {
    if (!confirm('Rimuovere la foto?')) return;
    await api.delete('/landing/foto');
    setFoto(null);
  };

  const tema = TEMI.find(t => t.key === form.landing_tema) || TEMI[0];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Pagina Wedding</h1>
          <p className="page-subtitle">Personalizza la pagina pubblica del matrimonio</p>
        </div>
        <a
          href="/wedding"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2"
        >
          <ExternalLink size={15} /> Apri pagina
        </a>
      </div>

      <form onSubmit={save} className="space-y-6">

        {/* Attivazione */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-rose-400" />
            <h2 className="font-bold text-gray-800">Visibilità pagina</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Abilita pagina pubblica</p>
              <p className="text-xs text-gray-400 mt-0.5">Gli ospiti possono visitare la pagina su <code className="bg-gray-100 px-1 rounded">/wedding</code></p>
            </div>
            <button
              type="button"
              onClick={toggleAbilitata}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${form.landing_abilitata ? 'bg-rose-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${form.landing_abilitata ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className={`mt-3 rounded-lg p-3 text-xs ${form.landing_abilitata ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
            {form.landing_abilitata
              ? 'La pagina è visibile a chiunque abbia il link. Condividi /wedding con i tuoi ospiti.'
              : 'La pagina mostra un messaggio "in arrivo" agli ospiti.'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Testo benvenuto */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Messaggio di benvenuto</h2>
            <textarea
              className="form-input"
              rows={5}
              placeholder="Scrivi un messaggio personale per i vostri ospiti…"
              value={form.landing_messaggio}
              onChange={e => setForm(f => ({ ...f, landing_messaggio: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Appare in corsivo sotto l'intestazione principale.</p>
          </div>

          {/* Dress code */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Dress Code</h2>
            <textarea
              className="form-input"
              rows={5}
              placeholder="es. Elegante formale. Si prega di evitare il bianco."
              value={form.landing_dress_code}
              onChange={e => setForm(f => ({ ...f, landing_dress_code: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Lascia vuoto per non mostrare questa sezione.</p>
          </div>

          {/* Info pratiche */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Informazioni pratiche</h2>
            <textarea
              className="form-input"
              rows={5}
              placeholder="es. Parcheggio disponibile in Piazza Roma. Per chi viene da fuori…"
              value={form.landing_info_pratiche}
              onChange={e => setForm(f => ({ ...f, landing_info_pratiche: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Parcheggio, hotel, indicazioni stradali, ecc.</p>
          </div>

          {/* Foto */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Foto di copertina</h2>
            {foto ? (
              <div className="space-y-3">
                {/* Anteprima pulita */}
                <div className="rounded-xl overflow-hidden border border-gray-100" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={`/uploads/landing/${foto}`}
                    alt="Foto copertina"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: form.landing_foto_posizione }}
                  />
                </div>

                {/* Picker inquadratura */}
                <div className="flex items-center gap-4 py-1">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Inquadratura</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: '4px' }}>
                      {POSIZIONI.map(p => {
                        const active = form.landing_foto_posizione === p.value;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            title={p.label}
                            onClick={() => setForm(f => ({ ...f, landing_foto_posizione: p.value }))}
                            style={{
                              height: '40px', borderRadius: '8px',
                              border: active ? '2px solid #e11d48' : '1px solid #e5e7eb',
                              background: active ? '#fff1f2' : '#f9fafb',
                              cursor: 'pointer', transition: 'all 0.12s',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <div style={{
                              width: active ? '10px' : '6px',
                              height: active ? '10px' : '6px',
                              borderRadius: '50%',
                              background: active ? '#e11d48' : '#d1d5db',
                              transition: 'all 0.12s',
                            }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 pt-5">
                    <span className="block text-xs text-gray-400 mb-0.5">Zona selezionata</span>
                    <span className="font-semibold text-gray-700">
                      {POSIZIONI.find(p => p.value === form.landing_foto_posizione)?.label || 'Centro'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Scegli la zona della foto che deve rimanere visibile nell'intestazione.</p>

                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn-secondary flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Image size={15} /> Sostituisci foto
                  </button>
                  <button type="button" className="p-2 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors" onClick={deleteFoto}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-rose-300 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); uploadFoto(e.dataTransfer.files[0]); }}
              >
                <Image size={28} className="mx-auto text-gray-300 mb-2" />
                {uploading
                  ? <p className="text-sm text-gray-500">Caricamento...</p>
                  : <p className="text-sm text-gray-400">Clicca o trascina una foto<br /><span className="text-xs">JPG, PNG, WebP (max 10 MB)</span></p>
                }
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => uploadFoto(e.target.files[0])}
            />
            {msg && (
              <p className={`text-sm mt-2 font-medium ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">Appare come sfondo nell'intestazione della pagina.</p>
          </div>

        </div>

        {/* Tema colore */}
        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">Tema colore</h2>
          <div className="flex flex-wrap gap-3">
            {TEMI.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setForm(f => ({ ...f, landing_tema: t.key }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderRadius: '0.5rem',
                  border: form.landing_tema === t.key ? `2px solid ${t.primary}` : '2px solid #e5e7eb',
                  background: form.landing_tema === t.key ? t.light : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: t.primary, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: form.landing_tema === t.key ? 700 : 400, color: form.landing_tema === t.key ? t.primary : '#374151' }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: tema.light, border: `1px solid ${tema.border}`, color: tema.primary }}>
            Anteprima tema: <strong>{tema.label}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            <Save size={15} /> {saved ? 'Salvato!' : 'Salva modifiche'}
          </button>
          <a href="/wedding" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <ExternalLink size={15} /> Visualizza pagina
          </a>
        </div>

      </form>
    </div>
  );
}
