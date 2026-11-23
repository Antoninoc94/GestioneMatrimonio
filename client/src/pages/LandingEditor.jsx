import { useEffect, useState, useRef } from 'react';
import { Save, Image, Trash2, ExternalLink, Globe, QrCode, Download, Crop, Gift } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import PhotoCropper from '../components/PhotoCropper';
import { baseUrlPubblico, MESSAGGIO_WHATSAPP_DEFAULT, ibanValido, normalizzaIban } from '../publicUrl';

const TEMI = [
  { key: 'rose',    label: 'Rosa',      primary: '#e11d48', light: '#fff1f2', border: '#fecdd3' },
  { key: 'lavanda', label: 'Lavanda',   primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe' },
  { key: 'salvia',  label: 'Salvia',    primary: '#059669', light: '#ecfdf5', border: '#a7f3d0' },
  { key: 'cielo',   label: 'Cielo',     primary: '#0284c7', light: '#f0f9ff', border: '#bae6fd' },
  { key: 'oro',     label: 'Champagne', primary: '#b45309', light: '#fffbeb', border: '#fde68a' },
  { key: 'biancoro', label: 'Bianco e oro', primary: '#9c7a1c', light: '#fdfaf3', border: '#e9d9ae' },
];

const empty = {
  landing_abilitata: true,
  landing_messaggio: '',
  landing_dress_code: '',
  landing_info_pratiche: '',
  landing_tema: 'rose',
  regalo_abilitato: false,
  regalo_titolo: '',
  regalo_messaggio: '',
  regalo_iban: '',
  regalo_intestatario: '',
  regalo_banca: '',
  regalo_causale: '',
  regalo_link: '',
  regalo_link_testo: '',
};
const CAMPI_REGALO = ['regalo_titolo', 'regalo_messaggio', 'regalo_iban', 'regalo_intestatario', 'regalo_banca', 'regalo_causale', 'regalo_link', 'regalo_link_testo'];

export default function LandingEditor() {
  const [form, setForm] = useState(empty);
  const [foto, setFoto] = useState(null);
  const [fotoOriginale, setFotoOriginale] = useState(null);
  const [fotoCrop, setFotoCrop] = useState(null);
  const [cropper, setCropper] = useState(null); // { imageSrc, isNewFile, file } oppure null se chiuso
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [urlPubblico, setUrlPubblico] = useState('');
  const [messaggioWa, setMessaggioWa] = useState('');
  const [urlSaved, setUrlSaved] = useState(false);
  const fileRef = useRef();
  const qrWeddingRef = useRef();
  const qrConfermaRef = useRef();

  // Il QR è disegnato in SVG: l'SVG si scarica così com'è (vettoriale, nitido
  // a qualsiasi dimensione di stampa), il PNG si ricava dallo stesso SVG a
  // 2048 px invece dei 160 px dell'anteprima.
  const scarica = (href, filename) => {
    const a = document.createElement('a');
    a.href = href; a.download = filename; a.click();
  };
  const svgQR = ref => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return null;
    const copia = svg.cloneNode(true);
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.removeAttribute('class');
    return new XMLSerializer().serializeToString(copia);
  };
  const downloadSVG = (ref, nome) => {
    const testo = svgQR(ref);
    if (!testo) return;
    const url = URL.createObjectURL(new Blob([testo], { type: 'image/svg+xml' }));
    scarica(url, `${nome}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadPNG = (ref, nome) => {
    const testo = svgQR(ref);
    if (!testo) return;
    const LATO = 2048;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = LATO;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, LATO, LATO);
      scarica(canvas.toDataURL('image/png'), `${nome}.png`);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(testo);
  };

  useEffect(() => {
    api.get('/config').then(r => {
      const d = r.data;
      setForm({
        landing_abilitata: d.landing_abilitata !== 0,
        landing_messaggio: d.landing_messaggio || '',
        landing_dress_code: d.landing_dress_code || '',
        landing_info_pratiche: d.landing_info_pratiche || '',
        landing_tema: d.landing_tema || 'rose',
        regalo_abilitato: d.regalo_abilitato === 1,
        ...Object.fromEntries(CAMPI_REGALO.map(k => [k, d[k] || ''])),
      });
      setUrlPubblico(d.url_pubblico || '');
      setMessaggioWa(d.messaggio_whatsapp || '');
      setFoto(d.landing_foto || null);
      setFotoOriginale(d.landing_foto_originale || null);
      setFotoCrop(d.landing_foto_crop ? JSON.parse(d.landing_foto_crop) : null);
    });
  }, []);

  const [erroreSave, setErroreSave] = useState('');
  const save = async e => {
    e.preventDefault();
    setErroreSave('');
    try {
      await api.put('/config', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setErroreSave(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };
  const ibanScritto = normalizzaIban(form.regalo_iban);
  const ibanSbagliato = ibanScritto.length > 0 && !ibanValido(ibanScritto);
  const campoRegalo = k => ({ value: form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) });

  const saveCondivisione = async () => {
    await api.put('/config', { url_pubblico: urlPubblico, messaggio_whatsapp: messaggioWa });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2500);
  };

  const baseQR = baseUrlPubblico(urlPubblico);

  const toggleAbilitata = async () => {
    const nuovoValore = !form.landing_abilitata;
    setForm(f => ({ ...f, landing_abilitata: nuovoValore }));
    await api.put('/config', { landing_abilitata: nuovoValore });
  };

  // Scelta di una foto nuova: si apre lo strumento di ritaglio, l'upload
  // vero e proprio parte solo alla conferma del ritaglio (vedi confirmCrop).
  const scegliFoto = file => {
    if (!file) return;
    setCropper({ imageSrc: URL.createObjectURL(file), isNewFile: true, file, initialCrop: null });
  };

  // "Modifica ritaglio": riapre lo strumento sulla foto originale già salvata
  // sul server, senza bisogno di ricaricarla.
  const modificaRitaglio = () => {
    if (!fotoOriginale) return;
    setCropper({ imageSrc: `/uploads/landing/${fotoOriginale}`, isNewFile: false, file: null, initialCrop: fotoCrop });
  };

  const chiudiCropper = () => {
    if (cropper?.isNewFile) URL.revokeObjectURL(cropper.imageSrc);
    setCropper(null);
  };

  // Copia piccola (1200px di lato, ~100-200 KB) per l'anteprima del link su
  // WhatsApp: il ritaglio intero di una foto del telefono pesa MB e non viene mostrato.
  const creaAnteprima = async blob => {
    const img = await createImageBitmap(blob);
    const scala = Math.min(1, 1200 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scala);
    canvas.height = Math.round(img.height * scala);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  };

  const confirmCrop = async (blob, cropMeta) => {
    setUploading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('foto', blob, 'foto.jpg');
      const anteprima = await creaAnteprima(blob).catch(() => null);
      if (anteprima) fd.append('anteprima', anteprima, 'anteprima.jpg');
      if (cropper.isNewFile) fd.append('originale', cropper.file);
      fd.append('crop', JSON.stringify(cropMeta));
      const { data } = await api.post('/landing/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFoto(data.landing_foto);
      setFotoOriginale(data.landing_foto_originale);
      setFotoCrop(cropMeta);
      setMsg('✓ Foto salvata');
    } catch {
      setMsg('✗ Errore upload');
    } finally {
      setUploading(false);
      chiudiCropper();
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const deleteFoto = async () => {
    if (!confirm('Rimuovere la foto?')) return;
    await api.delete('/landing/foto');
    setFoto(null);
    setFotoOriginale(null);
    setFotoCrop(null);
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
                {/* Anteprima fedele: stessa proporzione della pagina pubblica */}
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <img
                    src={`/uploads/landing/${foto}`}
                    alt="Foto copertina"
                    className="w-full h-auto block"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  {fotoOriginale && (
                    <button type="button" className="btn-secondary flex-1" onClick={modificaRitaglio} disabled={uploading}>
                      <Crop size={15} /> Modifica ritaglio
                    </button>
                  )}
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
                onDrop={e => { e.preventDefault(); scegliFoto(e.dataTransfer.files[0]); }}
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
              onChange={e => scegliFoto(e.target.files[0])}
            />
            {msg && (
              <p className={`text-sm mt-2 font-medium ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">Appare come sfondo nell'intestazione della pagina.</p>
          </div>

        </div>

        {cropper && (
          <PhotoCropper
            imageSrc={cropper.imageSrc}
            initialCrop={cropper.initialCrop}
            onCancel={chiudiCropper}
            onConfirm={confirmCrop}
          />
        )}

        {/* Regalo: IBAN e lista nozze */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Gift size={17} className="text-rose-500" /> Regalo: IBAN e lista nozze</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer shrink-0">
              <input type="checkbox" className="w-4 h-4 accent-rose-500" checked={form.regalo_abilitato}
                onChange={e => setForm(f => ({ ...f, regalo_abilitato: e.target.checked }))} />
              Mostra sulla pagina
            </label>
          </div>
          <p className="text-xs text-gray-400 mb-4">Discreta, dopo il programma: si vede solo il messaggio con "Vedi i dettagli", e IBAN e lista compaiono a chi lo apre. Serve almeno l'IBAN o il link.</p>
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${form.regalo_abilitato ? '' : 'opacity-60'}`}>
            <div className="space-y-3">
              <div>
                <label className="form-label">Titolo</label>
                <input className="form-input" placeholder="Facoltativo, es. Un pensiero per noi" {...campoRegalo('regalo_titolo')} />
              </div>
              <div>
                <label className="form-label">Messaggio</label>
                <textarea className="form-input" rows={4} placeholder="La vostra presenza è il regalo più bello. Se desiderate comunque farci un pensiero, qui trovate i dettagli."
                  {...campoRegalo('regalo_messaggio')} />
              </div>
              <div>
                <label className="form-label">Link lista nozze o viaggio</label>
                <input className="form-input" placeholder="www.listanozze.it/mario-e-anna" {...campoRegalo('regalo_link')} />
              </div>
              <div>
                <label className="form-label">Testo del pulsante</label>
                <input className="form-input" placeholder="Vai alla lista nozze" {...campoRegalo('regalo_link_testo')} />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">IBAN</label>
                <input className={`form-input font-mono ${ibanSbagliato ? 'border-red-300 focus:border-red-400' : ''}`} placeholder="IT60 X054 2811 1010 0000 0123 456"
                  {...campoRegalo('regalo_iban')} />
                {ibanSbagliato
                  ? <p className="text-xs text-red-600 mt-1">IBAN non valido: manca un carattere o ce n'è uno sbagliato.</p>
                  : ibanScritto && <p className="text-xs text-green-600 mt-1">IBAN valido.</p>}
              </div>
              <div>
                <label className="form-label">Intestatario</label>
                <input className="form-input" placeholder="Mario Rossi e Anna Bianchi" {...campoRegalo('regalo_intestatario')} />
              </div>
              <div>
                <label className="form-label">Banca</label>
                <input className="form-input" placeholder="Facoltativo" {...campoRegalo('regalo_banca')} />
              </div>
              <div>
                <label className="form-label">Causale suggerita</label>
                <input className="form-input" placeholder="Regalo di nozze" {...campoRegalo('regalo_causale')} />
              </div>
            </div>
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
          {erroreSave && <p className="text-sm text-red-600">{erroreSave}</p>}
        </div>

      </form>

      {/* QR Code */}
      <div className="card mt-6">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={18} className="text-rose-400" />
          <h2 className="font-bold text-gray-800">QR Code</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Stampa o condividi questi QR code sugli inviti per portare gli ospiti direttamente alle pagine.</p>
        <div className="mb-5">
          <label className="form-label">Indirizzo pubblico del sito</label>
          <input className="form-input" value={urlPubblico} onChange={e => setUrlPubblico(e.target.value)}
            placeholder={window.location.origin} />
          <p className="text-xs text-gray-400 mt-1">L'indirizzo che gli ospiti usano, es. https://antoninoevalentina.it. Se vuoto, i QR usano l'indirizzo da cui stai navigando ora.</p>
        </div>
        <div className="mb-5">
          <label className="form-label">Messaggio d'invito per WhatsApp</label>
          <textarea className="form-input" rows={5} value={messaggioWa} onChange={e => setMessaggioWa(e.target.value)}
            placeholder={MESSAGGIO_WHATSAPP_DEFAULT} />
          <p className="text-xs text-gray-400 mt-1">
            Si usa dal pulsante WhatsApp nella Lista Ospiti. Segnaposto: <code>{'{nome}'}</code>, <code>{'{link_wedding}'}</code>, <code>{'{link_conferma}'}</code>. Se vuoto, si usa il testo di esempio. Evita le emoji: su WhatsApp Web e desktop possono arrivare come "�".
          </p>
          <button type="button" className="btn-primary mt-2" onClick={saveCondivisione}>
            <Save size={15} /> {urlSaved ? 'Salvato!' : 'Salva indirizzo e messaggio'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { label: 'Pagina Wedding', path: '/wedding', ref: qrWeddingRef, file: 'qr-wedding' },
            { label: 'Conferma Presenza', path: '/conferma', ref: qrConfermaRef, file: 'qr-conferma' },
          ].map(({ label, path, ref, file }) => {
            const url = `${baseQR}${path}`;
            return (
              <div key={path} className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                {/* Il margine bianco (4 moduli) fa parte del file: senza, i telefoni
                    faticano a leggere un QR stampato a filo di un bordo colorato. */}
                <div ref={ref} className="p-1 bg-white rounded-xl shadow-sm">
                  <QRCodeSVG value={url} size={176} marginSize={4} fgColor="#1f2937" bgColor="#ffffff" level="M" />
                </div>
                <p className="text-xs text-gray-400 text-center break-all">{url}</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button type="button" className="btn-secondary text-sm justify-center" onClick={() => downloadSVG(ref, file)}
                    title="Vettoriale: ideale per la stampa e i programmi di grafica">
                    <Download size={13} /> SVG
                  </button>
                  <button type="button" className="btn-secondary text-sm justify-center" onClick={() => downloadPNG(ref, file)}
                    title="Immagine 2048×2048 pixel">
                    <Download size={13} /> PNG
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 text-center -mt-1">Per il biglietto stampato usa l'SVG: resta nitido a qualsiasi dimensione.</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
