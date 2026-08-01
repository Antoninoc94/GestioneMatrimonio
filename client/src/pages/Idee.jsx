import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Lightbulb, CheckCircle } from 'lucide-react';
import api from '../api';

const CATEGORIE = ['Decorazioni', 'Fiori', 'Tableau', 'Bomboniere', 'Torta', 'Menu', 'Musica', 'Abito', 'Acconciatura', 'Viaggio di nozze', 'Foto', 'Altro'];
const PRIORITA = ['alta', 'media', 'bassa'];
const prioritaColor = { alta: 'bg-red-100 text-red-700', media: 'bg-yellow-100 text-yellow-700', bassa: 'bg-green-100 text-green-700' };
const categoriaEmoji = {
  'Decorazioni': '🌸', 'Fiori': '💐', 'Tableau': '🪑', 'Bomboniere': '🎁', 'Torta': '🎂',
  'Menu': '🍽️', 'Musica': '🎵', 'Abito': '👗', 'Acconciatura': '💇', 'Viaggio di nozze': '✈️', 'Foto': '📸', 'Altro': '💡'
};

const empty = { titolo: '', descrizione: '', categoria: 'Decorazioni', immagine_url: '', priorita: 'media', realizzata: false, note: '' };

export default function Idee() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [mostraRealizzate, setMostraRealizzate] = useState(false);

  const load = () => api.get('/idee').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = i => { setForm({ ...i, realizzata: !!i.realizzata }); setEditId(i.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (editId) await api.put(`/idee/${editId}`, form);
    else await api.post('/idee', form);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questa idea?')) return;
    await api.delete(`/idee/${id}`);
    load();
  };

  const toggleRealizzata = async item => {
    await api.put(`/idee/${item.id}`, { ...item, realizzata: !item.realizzata });
    load();
  };

  const pending = items.filter(i => !i.realizzata);
  const realizzate = items.filter(i => i.realizzata);
  const filtered = (filtroCategoria ? pending.filter(i => i.categoria === filtroCategoria) : pending);
  const categorie = [...new Set(pending.map(i => i.categoria))];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Idee & Ispirazioni</h1>
          <p className="page-subtitle">{pending.length} idee · {realizzate.length} realizzate</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuova Idea</button>
      </div>

      {categorie.length > 1 && (
        <div className="card mb-4">
          <div className="flex gap-2 flex-wrap">
            <button className={`badge cursor-pointer px-3 py-1.5 ${!filtroCategoria ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroCategoria('')}>Tutte</button>
            {categorie.map(c => (
              <button key={c} className={`badge cursor-pointer px-3 py-1.5 ${filtroCategoria === c ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroCategoria(c === filtroCategoria ? '' : c)}>
                {categoriaEmoji[c]} {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && !mostraRealizzate && (
        <div className="card text-center py-12 text-gray-400">
          <Lightbulb size={40} className="mx-auto mb-2 text-yellow-300" />
          <p>Nessuna idea ancora. Aggiungine una!</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {filtered.map(idea => (
          <div key={idea.id} className="card group">
            {idea.immagine_url && (
              <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100">
                <img src={idea.immagine_url} alt={idea.titolo} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{categoriaEmoji[idea.categoria] || '💡'}</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{idea.titolo}</h3>
                  <span className="text-xs text-gray-400">{idea.categoria}</span>
                </div>
              </div>
              <span className={`badge ${prioritaColor[idea.priorita]}`}>{idea.priorita}</span>
            </div>
            {idea.descrizione && <p className="text-sm text-gray-600 mt-1">{idea.descrizione}</p>}
            {idea.note && <p className="text-xs text-gray-400 mt-1 italic">{idea.note}</p>}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button className="btn-secondary text-xs py-1 px-2 flex-1 justify-center" onClick={() => toggleRealizzata(idea)}>
                <CheckCircle size={13} /> Realizzata
              </button>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => openEdit(idea)}><Pencil size={13} /></button>
              <button className="btn-danger text-xs py-1 px-2" onClick={() => del(idea.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {realizzate.length > 0 && (
        <div>
          <button className="text-sm text-gray-500 font-medium mb-3 hover:text-gray-700" onClick={() => setMostraRealizzate(v => !v)}>
            {mostraRealizzate ? '▲' : '▼'} Idee Realizzate ({realizzate.length})
          </button>
          {mostraRealizzate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
              {realizzate.map(idea => (
                <div key={idea.id} className="card border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-700 line-through">{idea.titolo}</span>
                    <CheckCircle size={16} className="text-green-500" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => toggleRealizzata(idea)}>Riapri</button>
                    <button className="text-xs text-red-400 hover:text-red-600" onClick={() => del(idea.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Idea' : 'Nuova Idea'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="form-label">Titolo *</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Priorità</label>
                  <select className="form-input" value={form.priorita} onChange={e => setForm({ ...form, priorita: e.target.value })}>
                    {PRIORITA.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <textarea className="form-input" rows={3} value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div>
                <label className="form-label">URL Immagine (opzionale)</label>
                <input type="url" className="form-input" value={form.immagine_url} onChange={e => setForm({ ...form, immagine_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
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
