import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowDownAZ } from 'lucide-react';
import { tipoTavolo, formaTavolo, ellePosti } from './util';

// Campo di testo che salva quando si esce (o con Invio), e solo se è cambiato.
function TestoInline({ valore, onSalva, obbligatorio = false, className = '', placeholder = '' }) {
  const [v, setV] = useState(valore || '');
  useEffect(() => { setV(valore || ''); }, [valore]);
  const commit = () => {
    const n = v.trim();
    if (obbligatorio && !n) return setV(valore || '');
    if (n !== (valore || '')) onSalva(n);
  };
  return (
    <input className={`form-input py-1.5 text-sm ${className}`} value={v} placeholder={placeholder}
      onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setV(valore || '');
      }} />
  );
}

function Capienza({ t, onSalva }) {
  const [v, setV] = useState(t.capienza);
  useEffect(() => { setV(t.capienza); }, [t.capienza]);
  const imposta = n => { const c = Math.max(1, n || 1); setV(c); if (c !== t.capienza) onSalva(c); };
  const btn = 'w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0';
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} aria-label="Un posto in meno" onClick={() => imposta(t.capienza - 1)}>−</button>
      <input type="number" min={1} inputMode="numeric" aria-label="Posti"
        className="form-input w-14 py-1 text-center font-bold" value={v}
        onChange={e => setV(e.target.value)} onBlur={() => imposta(parseInt(v))}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
      <button type="button" className={btn} aria-label="Un posto in più" onClick={() => imposta(t.capienza + 1)}>+</button>
    </div>
  );
}

// Scheda "Gestisci": tutti i tavoli in un elenco compatto, modificabili sul
// posto, senza scorrere oltre la lista degli ospiti.
export default function GestioneTavoli({ tavoli, ospiti, salvaTavolo, del, riordina, openNew }) {
  const sposta = (i, delta) => {
    const ids = tavoli.map(t => t.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    riordina(ids);
  };
  // Sposi in testa, poi per nome con i numeri in ordine naturale (2 prima di 10).
  const ordinaAZ = () => {
    const ord = [...tavoli].sort((a, b) =>
      (b.tipo === 'sposi') - (a.tipo === 'sposi') || a.nome.localeCompare(b.nome, 'it', { numeric: true, sensitivity: 'base' }));
    riordina(ord.map(t => t.id));
  };

  const posti = tavoli.reduce((s, t) => s + t.capienza, 0);
  const attivi = ospiti.filter(o => o.rsvp !== 'declinato').length;
  const differenza = posti - attivi;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="mr-auto">
          <p className="text-sm text-gray-700">
            <span className="font-bold">{posti}</span> posti su {tavoli.length} tavoli · <span className="font-bold">{attivi}</span> ospiti (esclusi i declinati)
          </p>
          <p className={`text-xs ${differenza < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
            {differenza < 0 ? `Mancano ${-differenza} posti` : `${differenza} posti liberi`}
          </p>
        </div>
        <button className="btn-secondary text-sm" onClick={ordinaAZ} disabled={tavoli.length < 2} title="Sposi in testa, poi in ordine di nome">
          <ArrowDownAZ size={15} /> Ordina A→Z
        </button>
        <button className="btn-primary text-sm" onClick={openNew}><Plus size={15} /> Nuovo tavolo</button>
      </div>

      {tavoli.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nessun tavolo ancora.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          <div className="hidden md:grid md:grid-cols-[64px_minmax(160px,1.4fr)_120px_130px_130px_70px_minmax(120px,1fr)_36px] gap-2 pb-2 text-[11px] font-semibold uppercase text-gray-400">
            <span>Ordine</span><span>Nome</span><span>Tipo</span><span>Forma</span><span>Posti</span><span>Seduti</span><span>Note</span><span />
          </div>
          {tavoli.map((t, i) => {
            const oltre = t.ospiti.length > t.capienza;
            return (
              <div key={t.id}
                className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[64px_minmax(160px,1.4fr)_120px_130px_130px_70px_minmax(120px,1fr)_36px] gap-2 py-2 items-center">
                <div className="flex md:flex-row flex-col gap-0.5 row-span-3 md:row-span-1">
                  <button className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Sposta su" disabled={i === 0} onClick={() => sposta(i, -1)}><ArrowUp size={14} /></button>
                  <button className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30" aria-label="Sposta giù" disabled={i === tavoli.length - 1} onClick={() => sposta(i, 1)}><ArrowDown size={14} /></button>
                </div>
                <TestoInline valore={t.nome} obbligatorio className="font-semibold" onSalva={nome => salvaTavolo(t.id, { nome })} />
                <button className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 md:hidden" aria-label={`Elimina ${t.nome}`} onClick={() => del(t.id)}><Trash2 size={14} /></button>

                <div className="col-span-2 md:col-span-1 flex md:contents gap-2">
                  <select className="form-input py-1.5 text-sm" value={t.tipo || 'normale'} onChange={e => salvaTavolo(t.id, { tipo: e.target.value })}>
                    {Object.entries(tipoTavolo).map(([k, v]) => <option key={k} value={k}>{v.emoji ? `${v.emoji} ` : ''}{v.label}</option>)}
                  </select>
                  <div className="flex flex-col gap-1">
                    <select className="form-input py-1.5 text-sm" aria-label="Forma" value={t.forma || 'tondo'} onChange={e => salvaTavolo(t.id, { forma: e.target.value })}>
                      {Object.entries(formaTavolo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {t.forma === 'elle' && t.tipo !== 'sposi' && (
                      <select className="form-input py-1.5 text-xs" aria-label="Posti del tavolo a L" value={t.elle_posti || 'entrambi'} onChange={e => salvaTavolo(t.id, { elle_posti: e.target.value })}>
                        {Object.entries(ellePosti).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1 flex md:contents items-center gap-3">
                  <Capienza t={t} onSalva={capienza => salvaTavolo(t.id, { capienza })} />
                  <span className={`text-sm font-bold ${oltre ? 'text-red-500' : t.ospiti.length === t.capienza ? 'text-orange-500' : 'text-gray-500'}`}>
                    {t.ospiti.length}/{t.capienza}
                  </span>
                  <TestoInline valore={t.note} placeholder="Note" className="flex-1" onSalva={note => salvaTavolo(t.id, { note })} />
                </div>
                <button className="hidden md:block p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label={`Elimina ${t.nome}`} onClick={() => del(t.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
