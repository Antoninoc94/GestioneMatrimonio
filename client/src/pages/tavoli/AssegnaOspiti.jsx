import { useState } from 'react';
import { Pencil, Trash2, Users, UserX, Search, ChevronDown, X, GripVertical, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { nomeOspite, tipoTavolo } from './util';

// Scheda "Assegna": ospiti senza tavolo in una colonna fissa a sinistra,
// tavoli a destra. Si trascina un ospite su un tavolo (o di nuovo nella
// colonna per toglierlo); i menu restano per il telefono, dove il drag & drop
// HTML5 non è affidabile.
export default function AssegnaOspiti({ tavoli, ospiti, assignWithFamily, openEdit, del }) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [trascinato, setTrascinato] = useState(null);
  const [sopra, setSopra] = useState(null); // id tavolo o 'senza'

  const senzaTavolo = ospiti.filter(o => !o.tavolo_id);
  const parentName = id => {
    const p = ospiti.find(o => o.id === id);
    return p ? nomeOspite(p) : null;
  };
  const tavoloLabel = t => `${t.nome} ${t.ospiti.length >= t.capienza ? '(pieno)' : `(${t.ospiti.length}/${t.capienza})`}`;
  const guestLabel = o => {
    if (!o.parent_id) return nomeOspite(o);
    const pn = parentName(o.parent_id);
    return pn ? `${nomeOspite(o)} (${o.relazione === 'figlio' ? 'figlio' : 'partner'} di ${pn})` : nomeOspite(o);
  };

  const toggleCollapse = id => setCollapsed(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const tuttiChiusi = tavoli.length > 0 && tavoli.every(t => collapsed.has(t.id));

  // ── Drag & drop ─────────────────────────────────────────────
  const sposta = (id, target) => {
    const o = ospiti.find(x => x.id === id);
    if (!o) return;
    const tavoloId = target === 'senza' ? null : target;
    if ((o.tavolo_id || null) === tavoloId) return;
    if (tavoloId) {
      const t = tavoli.find(x => x.id === tavoloId);
      if (t && t.ospiti.length >= t.capienza
        && !confirm(`${t.nome} è già pieno (${t.ospiti.length}/${t.capienza}). Aggiungere comunque?`)) return;
    }
    assignWithFamily(o, tavoloId);
  };
  const dragProps = o => ({
    draggable: true,
    onDragStart: e => {
      e.dataTransfer.setData('text/plain', String(o.id));
      e.dataTransfer.effectAllowed = 'move';
      setTrascinato(o.id);
    },
    onDragEnd: () => { setTrascinato(null); setSopra(null); },
  });
  const dropProps = target => ({
    onDragOver: e => {
      if (trascinato == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (sopra !== target) setSopra(target);
    },
    onDragLeave: e => {
      if (!e.currentTarget.contains(e.relatedTarget)) setSopra(s => (s === target ? null : s));
    },
    onDrop: e => {
      e.preventDefault();
      const id = parseInt(e.dataTransfer.getData('text/plain'));
      setSopra(null);
      setTrascinato(null);
      if (!Number.isNaN(id)) sposta(id, target);
    },
  });

  const nomeRiga = (o, { showParent = false, small = false } = {}) => {
    const isChild = o.relazione === 'figlio';
    const isPartner = !!o.parent_id && !isChild;
    const pName = showParent && o.parent_id ? parentName(o.parent_id) : null;
    return (
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <GripVertical size={12} className="text-gray-300 flex-shrink-0" />
        {isPartner && <span className="text-rose-300 text-xs flex-shrink-0">♥</span>}
        {isChild && <span className="text-purple-300 text-xs flex-shrink-0">↳</span>}
        <div className="min-w-0 flex-1">
          <div className={`truncate ${o.rsvp === 'declinato' ? 'line-through text-red-400' : isChild ? 'text-purple-700' : isPartner ? 'text-rose-600' : 'text-gray-800 font-medium'} ${small || o.parent_id ? 'text-xs' : 'text-sm'}`}>
            {nomeOspite(o)}
            {isChild && o.eta != null ? <span className="ml-1 opacity-60">({o.eta}a)</span> : null}
            {o.rsvp === 'declinato' && <span className="ml-1 no-underline text-[10px] font-semibold uppercase">declinato</span>}
          </div>
          {pName && <div className="text-gray-400 text-xs truncate">{isChild ? 'figlio' : 'partner'} di {pName}</div>}
        </div>
      </div>
    );
  };

  // ── Colonna ospiti senza tavolo ─────────────────────────────
  const q = search.toLowerCase().trim();
  const filtrati = senzaTavolo.filter(o => {
    if (filtroTipo === 'bambino' && o.tipo !== 'bambino') return false;
    if (filtroTipo === 'adulto' && o.tipo === 'bambino') return false;
    if (q) return (o.nome || '').toLowerCase().includes(q) || (o.cognome || '').toLowerCase().includes(q);
    return true;
  });
  // Invitato principale seguito dai suoi familiari; poi chi ha il principale già seduto.
  const flat = [];
  for (const m of filtrati.filter(o => !o.parent_id)) {
    flat.push(m);
    flat.push(...filtrati.filter(c => c.parent_id === m.id));
  }
  filtrati.filter(o => o.parent_id && !senzaTavolo.some(m => m.id === o.parent_id)).forEach(o => flat.push(o));

  const AssegnaSelect = ({ o }) => (
    <select
      draggable={false}
      className="w-24 text-xs border border-gray-200 rounded-md text-rose-600 font-semibold px-2 py-1 bg-white flex-shrink-0 cursor-pointer hover:border-rose-300"
      value=""
      onChange={e => e.target.value && assignWithFamily(o, parseInt(e.target.value))}
    >
      <option value="">Assegna…</option>
      {tavoli.map(t => <option key={t.id} value={t.id}>{tavoloLabel(t)}</option>)}
    </select>
  );

  const colonna = (
    <div
      {...dropProps('senza')}
      className={`card lg:sticky lg:top-0 flex flex-col lg:max-h-[calc(100vh-3rem)] transition-colors ${sopra === 'senza' ? 'ring-2 ring-yellow-300 bg-yellow-50' : senzaTavolo.length ? 'border-yellow-200 bg-yellow-50/40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <UserX size={16} className={senzaTavolo.length ? 'text-yellow-500' : 'text-gray-300'} />
        <span className={`text-sm font-semibold ${senzaTavolo.length ? 'text-yellow-700' : 'text-gray-500'}`}>
          {senzaTavolo.length ? `${senzaTavolo.length} senza tavolo` : 'Tutti hanno un tavolo 🎉'}
        </span>
      </div>
      {senzaTavolo.length > 0 && (
        <>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input className="form-input pl-9 py-1.5 text-sm" placeholder="Cerca ospite…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 mb-3">
            {[['', 'Tutti'], ['adulto', 'Adulti'], ['bambino', 'Bambini 👶']].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroTipo(val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${filtroTipo === val ? 'bg-rose-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="hidden lg:block text-[11px] text-gray-400 mb-2">Trascina un ospite su un tavolo. Riportalo qui per toglierlo.</p>
          <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50 overflow-y-auto max-h-[45vh] lg:max-h-none lg:flex-1 lg:min-h-0">
            {flat.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nessun ospite trovato</p>}
            {flat.map(o => {
              const indent = o.parent_id && senzaTavolo.some(m => m.id === o.parent_id);
              return (
                <div key={o.id} {...dragProps(o)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 ${indent ? 'pl-6' : ''} ${trascinato === o.id ? 'opacity-40' : ''}`}>
                  {nomeRiga(o, { showParent: !indent })}
                  <AssegnaSelect o={o} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // ── Card tavolo ─────────────────────────────────────────────
  const card = t => {
    const pct = Math.round((t.ospiti.length / Math.max(1, t.capienza)) * 100);
    const pieno = t.ospiti.length >= t.capienza;
    const oltre = t.ospiti.length > t.capienza;
    const chiuso = collapsed.has(t.id);
    const mains = t.ospiti.filter(o => !o.parent_id);
    const famiglia = id => t.ospiti.filter(o => o.parent_id === id);
    const orfani = t.ospiti.filter(o => o.parent_id && !t.ospiti.some(m => m.id === o.parent_id));
    const tipo = tipoTavolo[t.tipo] || tipoTavolo.normale;

    const riga = (o, showParent = false) => (
      <div {...dragProps(o)} className={`flex items-center justify-between rounded px-1 -mx-1 hover:bg-gray-50 ${trascinato === o.id ? 'opacity-40' : ''}`}>
        {nomeRiga(o, { showParent })}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {tavoli.length > 1 && (
            <select draggable={false}
              className="w-20 text-xs border border-gray-200 rounded-md text-gray-500 px-1.5 py-1 bg-white cursor-pointer hover:border-rose-300 hover:text-rose-600"
              value="" title="Sposta ad un altro tavolo"
              onChange={e => e.target.value && assignWithFamily(o, parseInt(e.target.value))}>
              <option value="">Sposta…</option>
              {tavoli.filter(x => x.id !== t.id).map(x => <option key={x.id} value={x.id}>{tavoloLabel(x)}</option>)}
            </select>
          )}
          <button className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500" title="Togli dal tavolo"
            aria-label={`Togli ${o.nome} dal tavolo`} onClick={() => assignWithFamily(o, null)}>
            <X size={14} />
          </button>
        </div>
      </div>
    );

    return (
      <div key={t.id} {...dropProps(t.id)}
        className={`card transition-shadow ${sopra === t.id ? 'ring-2 ring-rose-300 shadow-md' : ''} ${oltre ? 'border-red-300' : pieno ? 'border-orange-200' : ''} ${t.tipo === 'sposi' ? 'bg-rose-50/40' : ''}`}>
        <div className="flex items-center gap-2 mb-2 cursor-pointer select-none" onClick={() => toggleCollapse(t.id)}>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
              {tipo.emoji && <span title={`Tavolo ${tipo.label.toLowerCase()}`}>{tipo.emoji}</span>}
              <span className="truncate">{t.nome}</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${chiuso ? '-rotate-90' : ''}`} />
            </h3>
          </div>
          <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Modifica" onClick={() => openEdit(t)}><Pencil size={13} /></button>
            <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Elimina" onClick={() => del(t.id)}><Trash2 size={13} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: oltre ? '#ef4444' : pieno ? '#f97316' : '#34d399' }} />
          </div>
          <span className={`text-xs font-bold ${oltre ? 'text-red-500' : pieno ? 'text-orange-500' : 'text-gray-500'}`}>{t.ospiti.length}/{t.capienza}</span>
        </div>

        {!chiuso && t.note && <p className="text-xs text-gray-400 mb-2 italic">{t.note}</p>}

        {!chiuso && (
          <div className="space-y-1">
            {t.ospiti.length === 0 && (
              <p className="text-xs text-gray-300 text-center py-3 border border-dashed border-gray-200 rounded-lg">Trascina qui gli ospiti</p>
            )}
            {mains.map(m => (
              <div key={m.id}>
                {riga(m)}
                {famiglia(m.id).length > 0 && (
                  <div className="ml-2 mt-0.5 pl-2 border-l-2 border-gray-100 space-y-0.5">
                    {famiglia(m.id).map(f => <div key={f.id}>{riga(f)}</div>)}
                  </div>
                )}
              </div>
            ))}
            {orfani.map(o => <div key={o.id}>{riga(o, true)}</div>)}
            {!pieno && senzaTavolo.length > 0 && (
              <select className="text-xs text-rose-500 font-semibold border-0 bg-transparent mt-1" value=""
                onChange={e => {
                  const o = ospiti.find(x => x.id === parseInt(e.target.value));
                  if (o) assignWithFamily(o, t.id);
                }}>
                <option value="">+ Aggiungi ospite…</option>
                {senzaTavolo.map(o => <option key={o.id} value={o.id}>{guestLabel(o)}</option>)}
              </select>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr] items-start">
      {colonna}
      <div>
        {tavoli.length > 0 && (
          <div className="flex justify-end mb-2">
            <button className="text-xs text-gray-500 hover:text-rose-600 flex items-center gap-1"
              onClick={() => setCollapsed(tuttiChiusi ? new Set() : new Set(tavoli.map(t => t.id)))}>
              {tuttiChiusi ? <><ChevronsUpDown size={13} /> Espandi tutti</> : <><ChevronsDownUp size={13} /> Comprimi tutti</>}
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
          {tavoli.map(card)}
          {tavoli.length === 0 && (
            <div className="col-span-full card text-center py-12 text-gray-400">
              <Users size={40} className="mx-auto mb-2 opacity-30" />
              <p>Nessun tavolo ancora. Creane uno!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
