import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Euro, AlertTriangle, AlertCircle, Clock,
  Users, UserCheck, FileText, Plane, Gift, Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { statoPreventivo, statoFornitore, label } from '../labels';

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);
const toUtc = s => s && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;
const fmtDate = d => { try { return format(parseISO(toUtc(d)), 'd MMM', { locale: it }); } catch { return d; } };
const fmtDateTime = s => { try { return format(parseISO(toUtc(s)), "d MMM, HH:mm", { locale: it }); } catch { return s; } };

const getMilestone = giorni => {
  if (giorni > 365) return { emoji: '🏛️', title: 'Scegli la location', desc: 'Hai tempo — inizia dai luoghi prima che si prenotino' };
  if (giorni > 270) return { emoji: '📸', title: 'Prenota fotografo e catering', desc: 'I migliori si prenotano con mesi di anticipo' };
  if (giorni > 180) return { emoji: '💌', title: 'Invia i Save the Date', desc: '6 mesi al matrimonio: è il momento giusto' };
  if (giorni > 120) return { emoji: '👗', title: 'Conferma abito e look', desc: '4 mesi: abiti e accessori devono essere pronti' };
  if (giorni > 90)  return { emoji: '✅', title: 'Conferma tutti i fornitori', desc: '3 mesi: nessun dettaglio deve restare in sospeso' };
  if (giorni > 60)  return { emoji: '✈️', title: 'Prenota il viaggio di nozze', desc: 'Le offerte migliori stanno finendo' };
  if (giorni > 30)  return { emoji: '🪑', title: 'Definisci il seating chart', desc: 'Assegna i posti a tavola agli ospiti confermati' };
  if (giorni > 14)  return { emoji: '📋', title: 'Conferma ospiti definitivi', desc: 'Lista finale al catering entro questa settimana' };
  if (giorni > 7)   return { emoji: '📞', title: 'Chiama tutti i fornitori', desc: 'Settimana del matrimonio: ultimi controlli' };
  if (giorni > 1)   return { emoji: '🎊', title: 'Quasi ci siete!', desc: 'Ultimi ritocchi, poi rilassatevi' };
  return { emoji: '💍', title: 'Domani è il grande giorno!', desc: 'Dormite bene questa notte 💑' };
};

const sourceColor = { preventivo: 'text-blue-600 bg-blue-50', viaggio: 'text-purple-600 bg-purple-50', costo: 'text-orange-600 bg-orange-50', manuale: 'text-gray-600 bg-gray-50' };
const sourceLabel = { preventivo: 'Preventivo', viaggio: 'Viaggio', costo: 'Pagamento', manuale: 'Manuale' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [noteList, setNoteList] = useState([]);
  const [newNota, setNewNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(console.error);
    api.get('/note').then(r => setNoteList(r.data)).catch(() => {});
  }, []);

  const salvaNote = async () => {
    if (!newNota.trim()) return;
    setSavingNota(true);
    try {
      const r = await api.post('/note', { testo: newNota.trim() });
      setNoteList(prev => [r.data, ...prev]);
      setNewNota('');
    } catch {}
    setSavingNota(false);
  };

  const eliminaNota = async (id) => {
    await api.delete(`/note/${id}`);
    setNoteList(prev => prev.filter(n => n.id !== id));
  };

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Heart className="text-rose-300 mx-auto mb-2 animate-pulse" size={40} />
        <p className="text-gray-400">Caricamento...</p>
      </div>
    </div>
  );

  const {
    config, giorniAlMatrimonio, budget, ospiti, fornitori, preventivi,
    costi, scadenzeImminenti, scadenzeScadute, cronologia, tavoli, viaggio, regali
  } = data;

  const milestone = giorniAlMatrimonio > 0 ? getMilestone(giorniAlMatrimonio) : null;
  const budgetImpegnato = (budget.preventiviAccettati || 0) + (budget.effettivo || 0);
  const budgetUsato = budget.totale > 0 ? Math.round((budgetImpegnato / budget.totale) * 100) : 0;
  const budgetRimanente = Math.max(0, budget.totale - budgetImpegnato);

  const ospitiChartData = ospiti?.totale > 0 ? [
    { name: 'Confermati', value: ospiti.confermati || 0 },
    { name: 'In attesa',  value: ospiti.attesa || 0 },
    { name: 'Declinati',  value: ospiti.declinati || 0 },
  ].filter(d => d.value > 0) : [];

  const alertCount = scadenzeScadute.length + (preventivi.inScadenza?.length || 0);

  return (
    <div className="space-y-5">

      {/* ── HERO ── */}
      <div className="card border-rose-100 bg-gradient-to-br from-rose-50/60 via-white to-pink-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">

          {/* Countdown */}
          <div className="flex items-center gap-4 sm:pr-6 sm:border-r sm:border-rose-100 flex-shrink-0">
            <Heart size={26} className="text-rose-400 flex-shrink-0" />
            <div>
              {giorniAlMatrimonio > 0 ? (
                <>
                  <div className="flex items-baseline gap-1.5 leading-none">
                    <span className="text-5xl font-black text-rose-500">{giorniAlMatrimonio}</span>
                    <span className="text-base text-gray-500 font-medium">giorni</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">al matrimonio</p>
                </>
              ) : (
                <>
                  <div className="text-4xl">🎉</div>
                  <p className="text-sm text-green-600 font-semibold mt-1">Oggi è il grande giorno!</p>
                </>
              )}
            </div>
          </div>

          {/* Sposi + data + milestone */}
          <div className="flex-1 min-w-0">
            {config?.data_matrimonio && (
              <div className="mb-3">
                <h1 className="text-xl font-bold text-gray-900">{config.nome_sposo1} & {config.nome_sposo2}</h1>
                <p className="text-sm text-rose-400 font-medium mt-0.5">
                  {format(parseISO(config.data_matrimonio), "d MMMM yyyy", { locale: it })}
                </p>
              </div>
            )}
            {milestone && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                <span className="text-lg leading-none flex-shrink-0">{milestone.emoji}</span>
                <div>
                  <p className="text-xs font-bold text-rose-600 leading-tight">{milestone.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{milestone.desc}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ALERT URGENZE ── */}
      {(scadenzeScadute.length > 0 || preventivi.inScadenza?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scadenzeScadute.length > 0 && (
            <div className="card border-red-200 bg-red-50/50 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-red-500" />
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                  Scadenze superate ({scadenzeScadute.length})
                </span>
              </div>
              <div className="space-y-1">
                {scadenzeScadute.slice(0, 3).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{s.titolo}</span>
                    <span className="text-red-500 font-semibold ml-3 flex-shrink-0">{fmtDate(s.data_scadenza)}</span>
                  </div>
                ))}
              </div>
              <Link to="/scadenze" className="text-xs text-rose-500 font-semibold mt-2 block">Risolvi →</Link>
            </div>
          )}
          {preventivi.inScadenza?.length > 0 && (
            <div className="card border-orange-200 bg-orange-50/50 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={13} className="text-orange-500" />
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                  Preventivi in scadenza ({preventivi.inScadenza.length})
                </span>
              </div>
              <div className="space-y-1">
                {preventivi.inScadenza.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{p.fornitore_nome || p.categoria}</span>
                    <span className="text-orange-500 font-semibold ml-3 flex-shrink-0">{fmtDate(p.data_scadenza)}</span>
                  </div>
                ))}
              </div>
              <Link to="/preventivi" className="text-xs text-rose-500 font-semibold mt-2 block">Gestisci →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── 4 KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            to: '/budget', label: 'Budget rimasto', icon: Euro,
            value: formatEuro(budgetRimanente), sub: `${budgetUsato}% impegnato`,
            alert: budgetUsato > 90, iconBg: budgetUsato > 90 ? 'bg-red-100 text-red-500' : 'bg-rose-50 text-rose-500',
          },
          {
            to: '/ospiti', label: 'Ospiti confermati', icon: Users,
            value: `${ospiti?.confermati || 0} / ${ospiti?.totale || 0}`, sub: `${ospiti?.attesa || 0} in attesa`,
            alert: false, iconBg: 'bg-blue-50 text-blue-500',
          },
          {
            to: '/fornitori', label: 'Fornitori ok', icon: UserCheck,
            value: `${fornitori?.confermati || 0} / ${fornitori?.totale || 0}`,
            sub: `${preventivi.perStato?.find(p => p.stato === 'accettato')?.count || 0} prev. accettati`,
            alert: false, iconBg: 'bg-green-50 text-green-500',
          },
          {
            to: '/scadenze', label: 'Urgenze', icon: Clock,
            value: alertCount, sub: `${scadenzeImminenti.length} nei prossimi giorni`,
            alert: scadenzeScadute.length > 0, iconBg: scadenzeScadute.length > 0 ? 'bg-red-100 text-red-500' : 'bg-yellow-50 text-yellow-500',
          },
        ].map(k => (
          <Link key={k.label} to={k.to}
            className={`card hover:border-rose-200 transition-colors ${k.alert ? 'border-red-200 bg-red-50/30' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-gray-500 mb-1">{k.label}</div>
                <div className={`text-xl font-black leading-none ${k.alert ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
                <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
              </div>
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${k.iconBg}`}><k.icon size={14} /></div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── MAIN 2-COLONNE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COLONNA SX (2/3) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Budget compatto */}
          {budget.totale > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Euro size={14} className="text-rose-400" /> Budget
                </h3>
                <Link to="/budget" className="text-xs text-rose-500 font-semibold">Dettaglio →</Link>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Impegnato: <strong className="text-gray-800">{formatEuro(budgetImpegnato)}</strong></span>
                <span className="font-bold" style={{ color: budgetUsato > 90 ? '#e11d48' : '#374151' }}>{budgetUsato}%</span>
                <span>Rimasto: <strong className={budgetUsato > 90 ? 'text-red-600' : 'text-gray-800'}>{formatEuro(budgetRimanente)}</strong></span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
                <div className="h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(budgetUsato, 100)}%`, background: budgetUsato > 90 ? '#e11d48' : '#34d399' }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Budget totale', value: formatEuro(budget.totale), color: 'text-gray-700' },
                  { label: 'Prev. accettati', value: formatEuro(budget.preventiviAccettati), color: 'text-blue-600' },
                  { label: 'Pagato', value: formatEuro(budget.pagato), color: 'text-green-600' },
                ].map(c => (
                  <div key={c.label} className="bg-gray-50 rounded-lg px-2 py-2.5">
                    <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>
              {costi.nonPagati?.count > 0 && (
                <div className="mt-3 text-xs text-orange-600 font-semibold bg-orange-50 rounded-lg px-3 py-2">
                  ⚠ {costi.nonPagati.count} costi non pagati — {formatEuro(costi.nonPagati.tot)}
                </div>
              )}
            </div>
          )}

          {/* Prossime scadenze */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Clock size={14} className="text-rose-400" /> Prossime scadenze
              </h3>
              <Link to="/scadenze" className="text-xs text-rose-500 font-semibold">Tutte →</Link>
            </div>
            {scadenzeImminenti.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nessuna scadenza imminente 🎉</p>
            ) : (
              <div className="space-y-1.5">
                {scadenzeImminenti.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.titolo}</p>
                      {s.source !== 'manuale' && (
                        <span className={`badge text-xs ${sourceColor[s.source]}`}>{sourceLabel[s.source]}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-semibold flex-shrink-0">{fmtDate(s.data_scadenza)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preventivi + Fornitori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">Preventivi</h3>
                <Link to="/preventivi" className="text-xs text-rose-500 font-semibold">Tutti →</Link>
              </div>
              {preventivi.perStato?.length > 0 ? (
                <div className="space-y-1.5">
                  {preventivi.perStato.map(p => {
                    const bg = { in_attesa: 'bg-gray-100', in_valutazione: 'bg-yellow-100', accettato: 'bg-green-100', rifiutato: 'bg-red-100' };
                    const tc = { in_attesa: 'text-gray-600', in_valutazione: 'text-yellow-700', accettato: 'text-green-700', rifiutato: 'text-red-600' };
                    return (
                      <div key={p.stato} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${bg[p.stato] || 'bg-gray-50'}`}>
                        <span className={`text-xs font-medium ${tc[p.stato] || 'text-gray-700'}`}>{label(statoPreventivo, p.stato)}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs ${tc[p.stato]}`}>{p.count}</span>
                          <span className={`text-xs font-bold ${tc[p.stato]}`}>{formatEuro(p.tot)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">Nessun preventivo</p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">Fornitori</h3>
                <Link to="/fornitori" className="text-xs text-rose-500 font-semibold">Tutti →</Link>
              </div>
              {fornitori.perStato?.length > 0 ? (
                <div className="space-y-1.5">
                  {fornitori.perStato.map(f => {
                    const bg = { da_contattare: 'bg-gray-100', contattato: 'bg-blue-100', preventivo_ricevuto: 'bg-yellow-100', confermato: 'bg-green-100', escluso: 'bg-red-100' };
                    const tc = { da_contattare: 'text-gray-600', contattato: 'text-blue-700', preventivo_ricevuto: 'text-yellow-700', confermato: 'text-green-700', escluso: 'text-red-600' };
                    return (
                      <div key={f.stato} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${bg[f.stato] || 'bg-gray-50'}`}>
                        <span className={`text-xs font-medium ${tc[f.stato] || 'text-gray-700'}`}>{label(statoFornitore, f.stato)}</span>
                        <span className={`text-xs font-bold ${tc[f.stato]}`}>{f.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">Nessun fornitore</p>
              )}
            </div>
          </div>
        </div>

        {/* ── COLONNA DX (1/3) ── */}
        <div className="space-y-5">

          {/* Ospiti donut */}
          {ospitiChartData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Users size={14} className="text-rose-400" /> Ospiti
                </h3>
                <Link to="/ospiti" className="text-xs text-rose-500 font-semibold">Lista →</Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 h-28 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ospitiChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={52} innerRadius={28}>
                        {ospitiChartData.map(entry => {
                          const c = { Confermati: '#34d399', 'In attesa': '#fbbf24', Declinati: '#f43f5e' };
                          return <Cell key={entry.name} fill={c[entry.name] || '#e5e7eb'} />;
                        })}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { label: 'Confermati', value: ospiti?.confermati || 0, color: 'text-green-600', bar: '#34d399' },
                    { label: 'In attesa',  value: ospiti?.attesa || 0,     color: 'text-yellow-600', bar: '#fbbf24' },
                    { label: 'Declinati',  value: ospiti?.declinati || 0,  color: 'text-red-500',   bar: '#f43f5e' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600">{r.label}</span>
                        <span className={`font-bold ${r.color}`}>{r.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full"
                          style={{ width: `${ospiti?.totale ? Math.round(r.value / ospiti.totale * 100) : 0}%`, background: r.bar }} />
                      </div>
                    </div>
                  ))}
                  {(ospiti?.adulti > 0 || ospiti?.bambini > 0) && (
                    <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                      {ospiti.adulti} adulti + {ospiti.bambini} bambini
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Riepilogo rapido: tavoli, viaggio, regali, cronologia */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Riepilogo</h3>
            <div className="space-y-1.5">
              <Link to="/tavoli"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-rose-50 transition-colors">
                <div className="flex items-center gap-2">
                  <UserCheck size={13} className="text-rose-400" />
                  <span className="text-sm text-gray-700">Tavoli</span>
                </div>
                {tavoli?.totale > 0 ? (
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{tavoli.assegnati}</span>
                    <span className="text-xs text-gray-400 ml-1">/ {ospiti?.totale || 0} ospiti</span>
                  </div>
                ) : <span className="text-xs text-gray-400">Nessun tavolo</span>}
              </Link>

              <Link to="/viaggio"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-rose-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Plane size={13} className="text-rose-400" />
                  <span className="text-sm text-gray-700">Viaggio di nozze</span>
                </div>
                {viaggio?.length > 0 ? (
                  <span className="text-sm font-bold text-gray-900">
                    {viaggio.reduce((s, v) => s + v.count, 0)} elem.
                  </span>
                ) : <span className="text-xs text-gray-400">Da pianificare</span>}
              </Link>

              <Link to="/regali"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-rose-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Gift size={13} className="text-rose-400" />
                  <span className="text-sm text-gray-700">Regali</span>
                </div>
                <div className="text-right">
                  {regali?.totale > 0 ? (
                    <>
                      <span className="text-sm font-bold text-gray-900">{regali.totale}</span>
                      {regali.da_ringraziare > 0 && (
                        <div className="text-xs text-orange-500 font-semibold">{regali.da_ringraziare} da ringr.</div>
                      )}
                    </>
                  ) : <span className="text-xs text-gray-400">Nessuno</span>}
                </div>
              </Link>

              {cronologia?.length > 0 && (
                <Link to="/cronologia"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-rose-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-rose-400" />
                    <span className="text-sm text-gray-700">Programma</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-rose-500">{cronologia[0].ora}</span>
                    <p className="text-xs text-gray-500 truncate max-w-28">{cronologia[0].titolo}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Note veloci */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-rose-400" />
              <h3 className="text-sm font-bold text-gray-700">Note veloci</h3>
            </div>
            <div className="flex gap-2">
              <textarea
                className="flex-1 text-sm text-gray-700 resize-none bg-gray-50 rounded-lg p-2.5 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder-gray-300"
                rows={2}
                placeholder="Scrivi una nota… (Ctrl+Invio)"
                value={newNota}
                onChange={e => setNewNota(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) salvaNote(); }}
              />
              <button className="btn-primary flex-shrink-0 self-end" onClick={salvaNote}
                disabled={savingNota || !newNota.trim()}>
                {savingNota ? '…' : 'Salva'}
              </button>
            </div>
            {noteList.length > 0 && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {noteList.map(n => (
                  <div key={n.id} className="flex items-start gap-2 bg-rose-50/40 border border-rose-100 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-relaxed">{n.testo}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {n.autore && <span className="font-medium text-rose-400 mr-1">{n.autore}</span>}
                        {fmtDateTime(n.created_at)}
                      </p>
                    </div>
                    <button onClick={() => eliminaNota(n.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none mt-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
