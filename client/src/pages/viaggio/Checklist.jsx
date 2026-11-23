import { useState } from 'react';
import { Plus, Pencil, Trash2, Sparkles, CheckSquare, Square } from 'lucide-react';

import { CATEGORIE, categoriaLabel, oggi, fmtData as fmt, seiMesiDopo } from './util';

const empty = { testo: '', categoria: 'documenti', persona: '', data: '', fatto: false, note: '' };

export default function Checklist({ voci, nomi, ritorno, onSalva, onElimina, onSuggerita }) {
  const [form, setForm] = useState(null);
  const [errore, setErrore] = useState('');
  const fatte = voci.filter(v => v.fatto).length;

  const apri = v => { setErrore(''); setForm(v ? { ...empty, ...v, persona: v.persona || '', data: v.data || '', note: v.note || '', fatto: !!v.fatto } : { ...empty }); };
  const salva = async e => {
    e.preventDefault();
    try { await onSalva(form); setForm(null); } catch (err) { setErrore(err.response?.data?.error || 'Errore nel salvataggio'); }
  };
  const doc = form?.categoria === 'documenti';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm text-gray-600"><strong className="text-gray-900">{fatte}</strong> di {voci.length} fatte</p>
          <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden max-w-xs">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${voci.length ? (fatte / voci.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onSuggerita} title="Aggiunge le voci suggerite che mancano"><Sparkles size={14} /> Suggerite</button>
          <button className="btn-primary" onClick={() => apri(null)}><Plus size={15} /> Voce</button>
        </div>
      </div>

      {voci.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <CheckSquare size={36} className="mx-auto mb-2 text-rose-300" />
          <p className="font-medium text-gray-700">Cosa non dimenticare prima di partire</p>
          <p className="text-sm mt-1 mb-4">Parti dalla lista suggerita (passaporti, assicurazione, adattatore…) e togli quello che non serve.</p>
          <button className="btn-primary justify-center" onClick={onSuggerita}><Sparkles size={15} /> Usa la lista suggerita</button>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIE.filter(c => voci.some(v => v.categoria === c)).map(c => (
            <div key={c} className="card py-3">
              <h3 className="text-sm font-bold text-gray-600 mb-1">{categoriaLabel[c]}</h3>
              <div className="divide-y divide-gray-100">
                {voci.filter(v => v.categoria === c).map(v => {
                  const scaduta = v.data && !v.fatto && c !== 'documenti' && v.data < oggi();
                  const docCorto = c === 'documenti' && v.data && ritorno && v.data < seiMesiDopo(ritorno);
                  return (
                    <div key={v.id} className="flex items-start gap-2.5 py-2">
                      <button onClick={() => onSalva({ ...v, fatto: !v.fatto })} className="mt-0.5 shrink-0" title={v.fatto ? 'Segna da fare' : 'Segna fatto'}>
                        {v.fatto ? <CheckSquare size={18} className="text-green-500" /> : <Square size={18} className="text-gray-300 hover:text-rose-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${v.fatto ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {v.testo}
                          {v.persona && <span className="badge bg-rose-50 text-rose-600 text-xs ml-1.5">{nomi[v.persona]}</span>}
                        </p>
                        {(v.data || v.note) && (
                          <p className="text-xs mt-0.5">
                            {v.data && (
                              <span className={docCorto ? 'text-red-600 font-medium' : scaduta ? 'text-red-600' : 'text-gray-400'}>
                                {c === 'documenti' ? `scade il ${fmt(v.data)}` : `entro il ${fmt(v.data)}`}
                              </span>
                            )}
                            {v.data && v.note && <span className="text-gray-300"> · </span>}
                            {v.note && <span className="text-gray-400 italic">{v.note}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 -mr-1">
                        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => apri(v)} title="Modifica"><Pencil size={13} /></button>
                        <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => onElimina(v.id)} title="Elimina"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{form.id ? 'Modifica voce' : 'Nuova voce'}</h2>
            <form onSubmit={salva} className="space-y-3">
              <div>
                <label className="form-label">Cosa *</label>
                <input className="form-input" value={form.testo} autoFocus required placeholder="Es. Passaporto"
                  onChange={e => setForm({ ...form, testo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIE.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Di chi</label>
                  <select className="form-input" value={form.persona} onChange={e => setForm({ ...form, persona: e.target.value })}>
                    <option value="">Entrambi</option>
                    <option value="1">{nomi[1]}</option>
                    <option value="2">{nomi[2]}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">{doc ? 'Scade il' : 'Da fare entro'}</label>
                <input type="date" className="form-input" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">
                  {doc ? 'Ti avviso se scade prima del rientro o meno di 6 mesi dopo.' : 'Facoltativa: con una data finisce anche in Scadenze.'}
                </p>
              </div>
              <div>
                <label className="form-label">Note</label>
                <input className="form-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              {errore && <p className="text-sm text-red-600">{errore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
