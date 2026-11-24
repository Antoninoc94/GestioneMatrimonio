import { useState } from 'react';
import { Pencil, Trash2, Users, UserX, Search, ChevronDown, X, GripVertical, ChevronsDownUp, ChevronsUpDown, ArrowRightLeft, Plus, CheckSquare, Square, CheckCircle2 } from 'lucide-react';
import { nomeOspite, tipoTavolo } from './util';

// Elenco dei tavoli tra cui scegliere, dal basso sul telefono e al centro su
// schermi grandi. Sostituisce i menu a tendina, illeggibili su un telefono.
function SceltaTavolo({ ospite, gruppo, tavoli, onScegli, onClose }) {
  // `ospite` per uno solo, `gruppo` (elenco di id) per più persone insieme.
  const n = gruppo ? gruppo.length : 1;
  const attualeId = gruppo ? null : ospite.tavolo_id;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">{attualeId ? 'Sposta' : 'Assegna'}</p>
            <p className="font-bold text-gray-900 truncate">
              {gruppo ? `${n} ospiti selezionati` : `${nomeOspite(ospite)}${ospite.tipo === 'bambino' ? ' 👶' : ''}`}
            </p>
          </div>
          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Chiudi" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          {tavoli.map(t => {
            const attuale = t.id === attualeId;
            const liberi = t.capienza - t.ospiti.length;
            const emoji = tipoTavolo[t.tipo]?.emoji;
            return (
              <button key={t.id} disabled={attuale} onClick={() => onScegli(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left ${attuale ? 'bg-rose-50 opacity-70' : 'hover:bg-gray-50 active:bg-gray-100'}`}>
                <span className="w-6 text-center">{emoji || '🍽️'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-800 truncate">{t.nome}</span>
                  {t.descrizione && <span className="block text-xs text-gray-500 truncate">{t.descrizione}</span>}
                  {attuale && <span className="block text-xs text-rose-500">Tavolo attuale</span>}
                </span>
                <span className={`text-sm font-bold text-right ${liberi < n ? 'text-orange-500' : 'text-gray-500'}`}>
                  {liberi <= 0 ? 'pieno' : liberi < n ? `solo ${liberi} liberi` : `${liberi} liberi`}
                </span>
              </button>
            );
          })}
          {tavoli.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nessun tavolo: creane uno.</p>}
        </div>
        {attualeId && (
          <div className="p-3 border-t border-gray-100">
            <button className="btn-secondary w-full justify-center text-red-600" onClick={() => onScegli(null)}>
              <X size={15} /> Togli dal tavolo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Scheda "Assegna": ospiti senza tavolo in una colonna fissa a sinistra,
// tavoli a destra. Si trascina un ospite su un tavolo (o di nuovo nella
// colonna per toglierlo); sul telefono, dove il drag & drop HTML5 non è
// affidabile, si tocca il pulsante e si sceglie il tavolo da un elenco.
export default function AssegnaOspiti({ tavoli, ospiti, assignWithFamily, assignGuests, openEdit, del }) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [trascinato, setTrascinato] = useState(null);
  const [sopra, setSopra] = useState(null); // id tavolo o 'senza'
  const [scelta, setScelta] = useState(null); // ospite per cui si sceglie il tavolo
  // Selezione multipla (utile sul telefono): più ospiti allo stesso tavolo in un colpo.
  const [selezionando, setSelezionando] = useState(false);
  const [selezione, setSelezione] = useState(new Set());
  const [sceltaGruppo, setSceltaGruppo] = useState(false);

  const senzaTavolo = ospiti.filter(o => !o.tavolo_id);
  const parentName = id => {
    const p = ospiti.find(o => o.id === id);
    return p ? nomeOspite(p) : null;
  };
  const guestLabel = o => {
    const base = `${nomeOspite(o)}${o.tipo === 'bambino' ? ' 👶' : ''}`;
    if (!o.parent_id) return base;
    const pn = parentName(o.parent_id);
    return pn ? `${base} (${o.relazione === 'figlio' ? 'figlio' : 'partner'} di ${pn})` : base;
  };

  const toggleCollapse = id => setCollapsed(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const tuttiChiusi = tavoli.length > 0 && tavoli.every(t => collapsed.has(t.id));

  // ── Assegnazione (drag & drop o elenco) ─────────────────────
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

  // 👶 segue l'età (`tipo`), come il filtro e la legenda; ♥ e ↳ la parentela,
  // per i familiari adulti.
  const nomeRiga = (o, { showParent = false } = {}) => {
    const isChild = o.relazione === 'figlio';
    const isPartner = !!o.parent_id && !isChild;
    const bambino = o.tipo === 'bambino';
    const pName = showParent && o.parent_id ? parentName(o.parent_id) : null;
    return (
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <GripVertical size={12} className="text-gray-300 flex-shrink-0 hidden lg:block" />
        {o.sposo
          ? <span className="text-xs flex-shrink-0" title={o.sposo === 1 ? 'Sposo' : 'Sposa'}>💍</span>
          : bambino
          ? <span className="text-xs flex-shrink-0" title="Bambino">👶</span>
          : isPartner ? <span className="text-rose-300 text-xs flex-shrink-0">♥</span>
          : isChild ? <span className="text-purple-300 text-xs flex-shrink-0">↳</span> : null}
        <div className="min-w-0 flex-1">
          <div className={`truncate ${o.rsvp === 'declinato' ? 'line-through text-red-400' : o.sposo ? 'text-rose-700 font-semibold' : bambino || isChild ? 'text-purple-700' : isPartner ? 'text-rose-600' : 'text-gray-800 font-medium'} ${o.parent_id ? 'text-xs' : 'text-sm'}`}>
            {nomeOspite(o)}
            {o.eta != null && (bambino || isChild) ? <span className="ml-1 opacity-60">({o.eta}a)</span> : null}
            {o.rsvp === 'declinato' && <span className="ml-1 text-[10px] font-semibold uppercase">declinato</span>}
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
  // Invitato principale seguito dai suoi familiari. Se il principale è escluso
  // dal filtro (es. "Bambini", o la ricerca di un figlio per nome) i familiari
  // restano comunque, da soli e con "figlio di …".
  const inFiltro = new Set(filtrati.map(o => o.id));
  const flat = [];
  for (const m of senzaTavolo.filter(o => !o.parent_id)) {
    const familiari = filtrati.filter(c => c.parent_id === m.id);
    if (inFiltro.has(m.id)) {
      flat.push({ o: m, indent: false });
      familiari.forEach(c => flat.push({ o: c, indent: true }));
    } else {
      familiari.forEach(c => flat.push({ o: c, indent: false }));
    }
  }
  filtrati.filter(o => o.parent_id && !senzaTavolo.some(m => m.id === o.parent_id))
    .forEach(o => flat.push({ o, indent: false }));

  const colonna = (
    <div
      {...dropProps('senza')}
      className={`card min-w-0 lg:sticky lg:top-0 flex flex-col lg:max-h-[calc(100vh-3rem)] transition-colors ${sopra === 'senza' ? 'ring-2 ring-yellow-300 bg-yellow-50' : senzaTavolo.length ? 'border-yellow-200 bg-yellow-50/40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <UserX size={16} className={senzaTavolo.length ? 'text-yellow-500' : 'text-gray-300'} />
        <span className={`text-sm font-semibold ${senzaTavolo.length ? 'text-yellow-700' : 'text-gray-500'}`}>
          {senzaTavolo.length ? `${senzaTavolo.length} senza tavolo` : 'Tutti hanno un tavolo 🎉'}
        </span>
      </div>
      {senzaTavolo.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button className={`text-xs font-semibold flex items-center gap-1 rounded-lg border px-2.5 py-2 lg:py-1 ${selezionando ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-600'}`}
              onClick={() => { setSelezionando(v => !v); setSelezione(new Set()); }}>
              <CheckSquare size={13} /> {selezionando ? 'Fine selezione' : 'Seleziona più ospiti'}
            </button>
            {selezionando && flat.length > 0 && (
              <button className="text-xs font-semibold text-rose-600 py-2 lg:py-1"
                onClick={() => setSelezione(sel => (flat.every(({ o }) => sel.has(o.id)) ? new Set() : new Set(flat.map(({ o }) => o.id))))}>
                {flat.every(({ o }) => selezione.has(o.id)) ? 'Deseleziona' : `Tutti (${flat.length})`}
              </button>
            )}
          </div>
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
            {flat.map(({ o, indent }) => (
              <div key={o.id} {...(selezionando ? {} : dragProps(o))}
                onClick={selezionando ? () => setSelezione(sel => { const n = new Set(sel); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; }) : undefined}
                className={`flex items-center gap-2 px-2.5 py-2 lg:py-1.5 hover:bg-gray-50 ${indent ? 'pl-6' : ''} ${trascinato === o.id ? 'opacity-40' : ''} ${selezionando ? 'cursor-pointer' : ''} ${selezione.has(o.id) ? 'bg-rose-50' : ''}`}>
                {selezionando && (selezione.has(o.id)
                  ? <CheckCircle2 size={20} className="text-rose-500 flex-shrink-0" />
                  : <Square size={20} className="text-gray-300 flex-shrink-0" />)}
                {nomeRiga(o, { showParent: !indent })}
                {!selezionando && (
                  <button draggable={false} onClick={() => setScelta(o)}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-600 border border-rose-200 bg-white rounded-md px-3 py-2 lg:px-2 lg:py-1 flex-shrink-0 hover:bg-rose-50">
                    <Plus size={12} /> Tavolo
                  </button>
                )}
              </div>
            ))}
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
    const bambini = t.ospiti.filter(o => o.tipo === 'bambino').length;

    const riga = (o, showParent = false) => (
      <div {...dragProps(o)} className={`flex items-center justify-between rounded px-1 -mx-1 py-0.5 hover:bg-gray-50 ${trascinato === o.id ? 'opacity-40' : ''}`}>
        {nomeRiga(o, { showParent })}
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          <button draggable={false} className="p-2.5 lg:p-1.5 rounded text-gray-400 hover:bg-gray-100 hover:text-rose-600" title="Sposta ad un altro tavolo"
            aria-label={`Sposta ${o.nome}`} onClick={() => setScelta(o)}>
            <ArrowRightLeft size={14} />
          </button>
          <button draggable={false} className="p-2.5 lg:p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500" title="Togli dal tavolo"
            aria-label={`Togli ${o.nome} dal tavolo`} onClick={() => assignWithFamily(o, null)}>
            <X size={14} />
          </button>
        </div>
      </div>
    );

    return (
      <div key={t.id} {...dropProps(t.id)}
        className={`card min-w-0 transition-shadow ${sopra === t.id ? 'ring-2 ring-rose-300 shadow-md' : ''} ${oltre ? 'border-red-300' : pieno ? 'border-orange-200' : ''} ${t.tipo === 'sposi' ? 'bg-rose-50/40' : ''}`}>
        <div className="flex items-center gap-2 mb-2 cursor-pointer select-none" onClick={() => toggleCollapse(t.id)}>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
              {tipo.emoji && <span title={`Tavolo ${tipo.label.toLowerCase()}`}>{tipo.emoji}</span>}
              <span className="truncate">{t.nome}</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${chiuso ? '-rotate-90' : ''}`} />
            </h3>
            {t.descrizione && <p className="text-xs text-gray-500 truncate">{t.descrizione}</p>}
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
          {bambini > 0 && <span className="text-xs text-purple-600" title="Bambini">👶 {bambini}</span>}
          <span className={`text-xs font-bold ${oltre ? 'text-red-500' : pieno ? 'text-orange-500' : 'text-gray-500'}`}>{t.ospiti.length}/{t.capienza}</span>
        </div>

        {!chiuso && t.note && <p className="text-xs text-gray-400 mb-2 italic">{t.note}</p>}

        {!chiuso && (
          <div className="space-y-0.5">
            {t.ospiti.length === 0 && (
              <p className="text-xs text-gray-300 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                <span className="hidden lg:inline">Trascina qui gli ospiti</span><span className="lg:hidden">Nessun ospite</span>
              </p>
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
              <select className="text-xs text-rose-500 font-semibold border-0 bg-transparent mt-1 max-w-full" value=""
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
    <div className={`grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr] items-start ${selezionando && selezione.size > 0 ? "pb-20" : ""}`}>
      {colonna}
      <div className="min-w-0">
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

      {selezionando && selezione.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 flex-1">{selezione.size} selezionat{selezione.size === 1 ? 'o' : 'i'}</span>
          <button className="btn-primary" onClick={() => setSceltaGruppo(true)}>Assegna a un tavolo…</button>
        </div>
      )}

      {sceltaGruppo && (
        <SceltaTavolo gruppo={[...selezione]} tavoli={tavoli} onClose={() => setSceltaGruppo(false)}
          onScegli={async id => {
            const t = tavoli.find(x => x.id === id);
            if (t && t.ospiti.length + selezione.size > t.capienza
              && !confirm(`${t.nome} ha ${Math.max(0, t.capienza - t.ospiti.length)} posti liberi e stai assegnando ${selezione.size} ospiti. Assegnare comunque?`)) return;
            setSceltaGruppo(false);
            await assignGuests([...selezione], id);
            setSelezione(new Set());
            setSelezionando(false);
          }} />
      )}

      {scelta && (
        <SceltaTavolo ospite={scelta} tavoli={tavoli} onClose={() => setScelta(null)}
          onScegli={id => { const o = scelta; setScelta(null); sposta(o.id, id === null ? 'senza' : id); }} />
      )}
    </div>
  );
}
