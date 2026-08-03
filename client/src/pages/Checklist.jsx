import { useEffect, useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, CheckCheck, AlertTriangle, Clock, Calendar } from 'lucide-react';
import api from '../api';

const FASI = [
  { key: '12mesi',    label: '12+ mesi prima',           emoji: '🗓️', minGiorni: 365 },
  { key: '6mesi',     label: '6-12 mesi prima',          emoji: '📅', minGiorni: 180 },
  { key: '3mesi',     label: '3-6 mesi prima',           emoji: '📋', minGiorni: 90  },
  { key: '1mese',     label: '1-3 mesi prima',           emoji: '✅', minGiorni: 30  },
  { key: 'settimana', label: 'Settimana del matrimonio', emoji: '⏰', minGiorni: 0   },
  { key: 'giorno',    label: 'Il grande giorno',         emoji: '💍', minGiorni: -Infinity },
];

// Restituisce 'passata' | 'corrente' | 'futura' per ogni fase
function getFaseStato(faseKey, giorniAlMatrimonio) {
  if (giorniAlMatrimonio === null) return 'futura';
  const idx = FASI.findIndex(f => f.key === faseKey);
  // Fase corrente = la prima (dall'inizio) il cui minGiorni è <= giorniAlMatrimonio
  const correnteIdx = FASI.findIndex(f => giorniAlMatrimonio >= f.minGiorni);
  if (idx < correnteIdx) return 'passata';
  if (idx === correnteIdx) return 'corrente';
  return 'futura';
}

export default function Checklist() {
  const [items, setItems] = useState([]);
  const [dataMatrimonio, setDataMatrimonio] = useState(null);
  const [newTesto, setNewTesto] = useState('');
  const [newFase, setNewFase] = useState('12mesi');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get('/checklist').then(r => setItems(r.data));
    api.get('/config').then(r => {
      if (r.data.data_matrimonio) setDataMatrimonio(r.data.data_matrimonio);
    });
  }, []);

  // Giorni al matrimonio (negativo = già passato)
  const giorniAlMatrimonio = dataMatrimonio
    ? Math.floor((new Date(dataMatrimonio) - new Date()) / 86400000)
    : null;

  const faseCorrenteKey = giorniAlMatrimonio !== null
    ? (FASI.find(f => giorniAlMatrimonio >= f.minGiorni)?.key || 'giorno')
    : null;

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

  // Conta attività in scadenza (fase corrente non completate)
  const inScadenza = faseCorrenteKey
    ? items.filter(i => i.fase === faseCorrenteKey && !i.completata).length
    : 0;
  // Conta attività in ritardo (fasi passate non completate)
  const inRitardo = faseCorrenteKey
    ? items.filter(i => getFaseStato(i.fase, giorniAlMatrimonio) === 'passata' && !i.completata).length
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Checklist</h1>
        <p className="page-subtitle">{completati} / {totale} completati · {pct}%</p>
      </div>

      {/* Banner data matrimonio */}
      {giorniAlMatrimonio !== null && (
        <div className={`rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3 ${
          giorniAlMatrimonio <= 0
            ? 'bg-rose-50 border border-rose-200'
            : giorniAlMatrimonio <= 30
            ? 'bg-orange-50 border border-orange-200'
            : 'bg-blue-50 border border-blue-100'
        }`}>
          <Calendar size={18} className={giorniAlMatrimonio <= 30 ? 'text-orange-500' : 'text-blue-400'} />
          <span className="text-sm font-medium text-gray-700">
            {giorniAlMatrimonio <= 0
              ? 'Il grande giorno è arrivato! 🎉'
              : giorniAlMatrimonio === 1
              ? 'Domani è il grande giorno!'
              : `${giorniAlMatrimonio} giorni al matrimonio`}
          </span>
          {faseCorrenteKey && (
            <span className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-0.5 font-medium">
              Fase attuale: {FASI.find(f => f.key === faseCorrenteKey)?.emoji} {FASI.find(f => f.key === faseCorrenteKey)?.label}
            </span>
          )}
          {inRitardo > 0 && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-3 py-0.5 font-medium flex items-center gap-1">
              <AlertTriangle size={11} /> {inRitardo} in ritardo
            </span>
          )}
          {inScadenza > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-3 py-0.5 font-medium flex items-center gap-1">
              <Clock size={11} /> {inScadenza} da completare ora
            </span>
          )}
        </div>
      )}

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
          const stato = getFaseStato(fase.key, giorniAlMatrimonio);
          const incompleti = faseItems.filter(i => !i.completata).length;

          // Stile card in base allo stato
          const cardBorder =
            stato === 'corrente' ? 'border-2 border-orange-300 shadow-orange-100 shadow-md' :
            stato === 'passata' && incompleti > 0 ? 'border-2 border-red-200' :
            stato === 'passata' ? 'border border-green-100 opacity-75' :
            'border border-gray-100';

          return (
            <div key={fase.key} className={`card ${cardBorder}`}>
              {/* Header fase */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{fase.emoji}</span>
                  <span className="font-semibold text-sm text-gray-800">{fase.label}</span>

                  {stato === 'corrente' && (
                    <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 font-semibold flex items-center gap-1">
                      <Clock size={10} /> In corso
                    </span>
                  )}
                  {stato === 'passata' && incompleti > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> {incompleti} in ritardo
                    </span>
                  )}
                  {stato === 'passata' && incompleti === 0 && (
                    <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 font-semibold flex items-center gap-1">
                      <CheckCheck size={10} /> Completata
                    </span>
                  )}
                  {stato === 'futura' && giorniAlMatrimonio !== null && (
                    <span className="text-xs bg-gray-100 text-gray-400 border border-gray-200 rounded-full px-2.5 py-0.5">
                      Futura
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${fasePct}%`,
                        background: fasePct === 100 ? '#16a34a' : stato === 'passata' && incompleti > 0 ? '#ef4444' : stato === 'corrente' ? '#f97316' : '#e11d48'
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right">{faseCompletati}/{faseItems.length}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {faseItems.map(item => {
                  const isUrgente = stato !== 'futura' && !item.completata && stato === 'passata';
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer group transition-colors ${
                        item.completata
                          ? 'bg-green-50 hover:bg-green-100'
                          : isUrgente
                          ? 'bg-red-50 hover:bg-red-100'
                          : stato === 'corrente'
                          ? 'bg-orange-50/50 hover:bg-orange-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggle(item)}
                    >
                      {item.completata
                        ? <CheckSquare size={18} className="text-green-500 flex-shrink-0" />
                        : isUrgente
                        ? <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                        : <Square size={18} className="text-gray-300 flex-shrink-0 group-hover:text-gray-400" />
                      }
                      <span className={`flex-1 text-sm leading-snug ${
                        item.completata ? 'line-through text-gray-400' :
                        isUrgente ? 'text-red-700 font-medium' :
                        'text-gray-700'
                      }`}>
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
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
