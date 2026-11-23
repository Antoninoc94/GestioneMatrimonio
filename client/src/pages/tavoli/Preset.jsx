import { useEffect, useState } from 'react';
import { Save, Play, RefreshCw, Pencil, Trash2, X } from 'lucide-react';
import api from '../../api';

const quando = iso => {
  // SQLite datetime('now') è in UTC senza fuso: lo si dichiara per evitare lo sfasamento.
  const d = new Date(`${String(iso).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Disposizioni salvate: fotografia dei tavoli e di chi siede dove, da
// riapplicare senza rifare tutto.
export default function Preset({ tavoli, onClose, onApplicato }) {
  const [elenco, setElenco] = useState([]);
  const [nome, setNome] = useState('');
  const [occupato, setOccupato] = useState(false);

  const carica = () => api.get('/tavoli/preset').then(r => setElenco(r.data)).catch(() => {});
  useEffect(() => { carica(); }, []);

  // Una sola operazione alla volta: sono tutte scritture sull'intera sala.
  const esegui = async (fn, errore) => {
    setOccupato(true);
    try {
      return await fn();
    } catch (err) {
      alert(err.response?.data?.error || errore);
    } finally {
      setOccupato(false);
    }
  };

  const salva = async e => {
    e.preventDefault();
    if (!nome.trim()) return;
    const r = await esegui(() => api.post('/tavoli/preset', { nome }), 'Salvataggio del preset non riuscito');
    if (r) setNome('');
    carica();
  };

  const applica = async p => {
    if (!confirm(`Applicare "${p.nome}"?\n\nI ${tavoli.length} tavoli attuali e chi siede dove verranno sostituiti. Se vuoi tenere la disposizione di adesso, salvala prima come preset.`)) return;
    const r = await esegui(() => api.post(`/tavoli/preset/${p.id}/applica`), 'Il preset non è stato applicato');
    if (!r) return;
    if (r.data.saltati > 0) {
      alert(`Preset applicato. ${r.data.saltati === 1 ? '1 ospite non esiste più' : `${r.data.saltati} ospiti non esistono più`} nella lista e non è stato rimesso a sedere.`);
    }
    onApplicato();
    onClose();
  };

  const aggiorna = async p => {
    if (!confirm(`Sovrascrivere "${p.nome}" con la disposizione di adesso (${tavoli.length} tavoli)?`)) return;
    await esegui(() => api.post(`/tavoli/preset/${p.id}/aggiorna`), 'Aggiornamento del preset non riuscito');
    carica();
  };

  const rinomina = async p => {
    const n = prompt('Nuovo nome del preset', p.nome);
    if (n === null || !n.trim() || n.trim() === p.nome) return;
    await esegui(() => api.put(`/tavoli/preset/${p.id}`, { nome: n }), 'Rinomina non riuscita');
    carica();
  };

  const elimina = async p => {
    if (!confirm(`Eliminare il preset "${p.nome}"? I tavoli attuali non cambiano.`)) return;
    await esegui(() => api.delete(`/tavoli/preset/${p.id}`), 'Eliminazione non riuscita');
    carica();
  };

  const btn = 'p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex items-start gap-2 mb-1">
          <h2 className="text-lg font-bold text-gray-900 mr-auto">Disposizioni salvate</h2>
          <button className={btn} aria-label="Chiudi" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Un preset ricorda i tavoli (forma, posizione, ordine) e chi siede dove. Applicarlo sostituisce i tavoli attuali.
        </p>

        <form onSubmit={salva} className="flex gap-2 mb-4">
          <input className="form-input flex-1" value={nome} maxLength={80} onChange={e => setNome(e.target.value)}
            placeholder="Nome, es. Sala grande 120 ospiti" aria-label="Nome del preset" />
          <button type="submit" className="btn-primary" disabled={occupato || !nome.trim() || tavoli.length === 0}>
            <Save size={15} /> Salva
          </button>
        </form>
        {tavoli.length === 0 && <p className="text-xs text-gray-400 -mt-2 mb-4">Crea almeno un tavolo per poterne salvare la disposizione.</p>}

        {elenco.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nessun preset salvato.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
            {elenco.map(p => (
              <li key={p.id} className="py-2.5">
                <p className="font-semibold text-gray-900 truncate">{p.nome}</p>
                <p className="text-xs text-gray-500 mb-1.5">
                  {p.n_tavoli} tavoli · {p.posti} posti · {p.n_ospiti} ospiti seduti · {quando(p.updated_at)}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <button className="btn-secondary text-xs py-2 sm:py-1" disabled={occupato} onClick={() => applica(p)}>
                    <Play size={13} /> Applica
                  </button>
                  <button className="btn-secondary text-xs py-2 sm:py-1" title="Sovrascrive il preset con la disposizione di adesso" disabled={occupato || tavoli.length === 0} onClick={() => aggiorna(p)}>
                    <RefreshCw size={13} /> Aggiorna
                  </button>
                  <span className="flex-1" />
                  <button className={btn} aria-label={`Rinomina ${p.nome}`} disabled={occupato} onClick={() => rinomina(p)}><Pencil size={14} /></button>
                  <button className={`${btn} hover:text-red-500 hover:bg-red-50`} aria-label={`Elimina ${p.nome}`} disabled={occupato} onClick={() => elimina(p)}><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
