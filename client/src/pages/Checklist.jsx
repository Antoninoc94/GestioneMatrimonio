import { useEffect, useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, CheckCheck } from 'lucide-react';
import api from '../api';

const FASI = [
  { key: '12mesi',    label: '12+ mesi prima',              emoji: '🗓️',  color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: '6mesi',     label: '6-12 mesi prima',             emoji: '📅',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: '3mesi',     label: '3-6 mesi prima',              emoji: '📋',  color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: '1mese',     label: '1-3 mesi prima',              emoji: '✅',  color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'settimana', label: 'Settimana del matrimonio',    emoji: '⏰',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'giorno',    label: 'Il grande giorno',            emoji: '💍',  color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export default function Checklist() {
  const [items, setItems] = useState([]);
  const [newTesto, setNewTesto] = useState('');
  const [newFase, setNewFase] = useState('12mesi');
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/checklist').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const toggle = async item => {
    const updated = { ...item, completata: item.completata ? 0 : 1 };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await api.put(`/checklist/${item.id}`, { completata: updated.completata });
  };

  const del = async id => {
    await api.delete(`/checklist/${id}`);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const add = async e => {
    e.preventDefault();
    if (!newTesto.trim()) return;
    setAdding(true);
    try {
      const r = await api.post('/checklist', { testo: newTesto.trim(), fase: newFase });
      setItems(prev => [...prev, r.data]);
      setNewTesto('');
    } finally {
      setAdding(false);
    }
  };

  const totale = items.length;
  const completati = items.filter(i => i.completata).length;
  const pct = totale > 0 ? Math.round((completati / totale) * 100) : 0;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Checklist</h1>
          <p className="page-subtitle">{completati} / {totale} completati · {pct}%</p>
        </div>
      </div>

      {/* Barra progresso globale */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progresso pianificazione</span>
          <span className="text-sm font-bold text-rose-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#e11d48' }}
          />
        </div>
        {pct === 100 && (
          <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
            <CheckCheck size={15} /> Tutto pronto! Buon matrimonio! 🎉
          </p>
        )}
      </div>

      {/* Aggiungi voce */}
      <form onSubmit={add} className="card mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Aggiungi attività personalizzata</h3>
        <div className="flex gap-2 flex-wrap">
          <select
            className="form-input flex-shrink-0 w-auto"
            value={newFase}
            onChange={e => setNewFase(e.target.value)}
          >
            {FASI.map(f => <option key={f.key} value={f.key}>{f.emoji} {f.label}</option>)}
          </select>
          <input
            className="form-input flex-1 min-w-48"
            placeholder="es. Prenotare l'officiant..."
            value={newTesto}
            onChange={e => setNewTesto(e.target.value)}
          />
          <button type="submit" className="btn-primary flex-shrink-0" disabled={adding || !newTesto.trim()}>
            <Plus size={15} /> Aggiungi
          </button>
        </div>
      </form>

      {/* Fasi */}
      <div className="space-y-6">
        {FASI.map(fase => {
          const faseItems = items.filter(i => i.fase === fase.key);
          if (faseItems.length === 0) return null;
          const faseCompletati = faseItems.filter(i => i.completata).length;
          const fasePct = Math.round((faseCompletati / faseItems.length) * 100);

          return (
            <div key={fase.key} className="card">
              {/* Header fase */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{fase.emoji}</span>
                  <div>
                    <span className={`badge text-xs border ${fase.color}`}>{fase.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${fasePct}%`, background: fasePct === 100 ? '#16a34a' : '#e11d48' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{faseCompletati}/{faseItems.length}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {faseItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group transition-colors ${
                      item.completata ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggle(item)}
                  >
                    {item.completata
                      ? <CheckSquare size={18} className="text-green-500 flex-shrink-0" />
                      : <Square size={18} className="text-gray-300 flex-shrink-0 group-hover:text-gray-400" />
                    }
                    <span className={`flex-1 text-sm leading-snug ${item.completata ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.testo}
                    </span>
                    {!item.predefinita && (
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                        onClick={e => { e.stopPropagation(); del(item.id); }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
