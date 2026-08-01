import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Euro, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Users, UserCheck, FileText, MapPin, Plane, Gift, Calendar,
  DollarSign, ChevronRight, AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { statoPreventivo, statoFornitore, label } from '../labels';

const COLORS = ['#e11d48','#f43f5e','#fb7185','#fda4af','#f97316','#fbbf24','#34d399','#60a5fa'];
const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = d => { try { return format(parseISO(d), 'd MMM', { locale: it }); } catch { return d; } };

const rsvpColors = { confermati: '#34d399', declinati: '#f43f5e', attesa: '#fbbf24' };
const sourceColor = { preventivo: 'text-blue-600 bg-blue-50', viaggio: 'text-purple-600 bg-purple-50', costo: 'text-orange-600 bg-orange-50', manuale: 'text-gray-600 bg-gray-50' };
const sourceLabel = { preventivo: 'Preventivo', viaggio: 'Viaggio', costo: 'Pagamento', manuale: 'Manuale' };

function StatCard({ label, value, sub, icon: Icon, color, to, alert }) {
  const inner = (
    <div className={`card h-full flex flex-col justify-between gap-2 ${alert ? 'border-red-200 bg-red-50/40' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
          <div className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
      </div>
      {to && <div className="text-xs text-rose-500 font-semibold">Vai alla sezione →</div>}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{children}</h2>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [nota, setNota] = useState(() => localStorage.getItem('matrimonio_nota') || '');

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(console.error);
  }, []);

  const salvaNote = v => {
    setNota(v);
    localStorage.setItem('matrimonio_nota', v);
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

  // Impegnato = preventivi accettati + costi effettivi (le due sezioni sono separate)
  const budgetImpegnato = (budget.preventiviAccettati || 0) + (budget.effettivo || 0);
  const budgetUsato = budget.totale > 0 ? Math.round((budgetImpegnato / budget.totale) * 100) : 0;
  const budgetRimanente = Math.max(0, budget.totale - budgetImpegnato);

  const preventiviChart = preventivi.perStato?.map(r => ({ ...r, stato: label(statoPreventivo, r.stato) }));
  const ospitiChartData = ospiti?.totale > 0 ? [
    { name: 'Confermati', value: ospiti.confermati || 0 },
    { name: 'In attesa',  value: ospiti.attesa || 0 },
    { name: 'Declinati',  value: ospiti.declinati || 0 },
  ].filter(d => d.value > 0) : [];

  const viaggioConfermati = viaggio?.find(v => v.stato === 'prenotato' || v.stato === 'pagato')
    ? (viaggio.find(v => v.stato === 'prenotato')?.count || 0) + (viaggio.find(v => v.stato === 'pagato')?.count || 0)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          {config?.data_matrimonio && (
            <p className="page-subtitle">
              {config.nome_sposo1} & {config.nome_sposo2} — {format(parseISO(config.data_matrimonio), "d MMMM yyyy", { locale: it })}
            </p>
          )}
        </div>
        {giorniAlMatrimonio !== null && (
          <div className={`card flex items-center gap-3 py-3 px-5 ${giorniAlMatrimonio > 0 ? 'border-rose-200' : 'border-green-200 bg-green-50'}`}>
            <Heart size={22} className={giorniAlMatrimonio > 0 ? 'text-rose-500' : 'text-green-500'} />
            <div>
              <div className="text-2xl font-bold" style={{ color: giorniAlMatrimonio > 0 ? '#e11d48' : '#16a34a' }}>
                {giorniAlMatrimonio > 0 ? giorniAlMatrimonio : '🎉'}
              </div>
              <div className="text-xs text-gray-500">{giorniAlMatrimonio > 0 ? 'giorni al matrimonio' : 'Oggi è il grande giorno!'}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── ALERT: SCADENZE SCADUTE + PREVENTIVI IN SCADENZA ── */}
      {(scadenzeScadute.length > 0 || preventivi.inScadenza?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scadenzeScadute.length > 0 && (
            <div className="card border-red-200 bg-red-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-700">Scadenze superate ({scadenzeScadute.length})</span>
              </div>
              <div className="space-y-1.5">
                {scadenzeScadute.slice(0, 4).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium truncate flex-1">{s.titolo}</span>
                    <span className="text-red-600 text-xs font-semibold ml-2 flex-shrink-0">{fmtDate(s.data_scadenza)}</span>
                  </div>
                ))}
              </div>
              <Link to="/scadenze" className="text-xs text-rose-500 font-semibold mt-3 block">Gestisci →</Link>
            </div>
          )}
          {preventivi.inScadenza?.length > 0 && (
            <div className="card border-orange-200 bg-orange-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-orange-500" />
                <span className="text-sm font-bold text-orange-700">Preventivi in scadenza ({preventivi.inScadenza.length})</span>
              </div>
              <div className="space-y-1.5">
                {preventivi.inScadenza.slice(0, 4).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800 font-medium truncate flex-1">{p.fornitore_nome || p.categoria}</span>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-gray-500 text-xs">{formatEuro(p.importo)}</span>
                      <span className="text-orange-600 text-xs font-semibold">{fmtDate(p.data_scadenza)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/preventivi" className="text-xs text-rose-500 font-semibold mt-3 block">Gestisci →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── STATS PRINCIPALI ── */}
      <div>
        <SectionTitle>Panoramica</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Budget rimasto" value={formatEuro(budgetRimanente)}
            sub={`${budgetUsato}% impegnato`} icon={Euro}
            color={budgetUsato > 90 ? 'bg-red-100 text-red-600' : 'bg-rose-50 text-rose-600'}
            alert={budgetUsato > 90} to="/budget"
          />
          <StatCard
            label="Ospiti confermati" value={`${ospiti?.confermati || 0} / ${ospiti?.totale || 0}`}
            sub={`${ospiti?.attesa || 0} in attesa · ${ospiti?.declinati || 0} declinati`}
            icon={Users} color="bg-blue-50 text-blue-600" to="/ospiti"
          />
          <StatCard
            label="Fornitori confermati" value={`${fornitori?.confermati || 0} / ${fornitori?.totale || 0}`}
            sub={`${preventivi.perStato?.find(p => p.stato === 'accettato')?.count || 0} prev. accettati`}
            icon={UserCheck} color="bg-green-50 text-green-600" to="/fornitori"
          />
          <StatCard
            label="Scadenze urgenti" value={scadenzeScadute.length + (preventivi.inScadenza?.length || 0)}
            sub={`${scadenzeImminenti.length} nei prossimi giorni`}
            icon={Clock}
            color={scadenzeScadute.length > 0 ? 'bg-red-100 text-red-600' : 'bg-yellow-50 text-yellow-600'}
            alert={scadenzeScadute.length > 0} to="/scadenze"
          />
        </div>
      </div>

      {/* ── BUDGET ── */}
      <div>
        <SectionTitle>Budget</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Budget totale',     value: formatEuro(budget.totale),              icon: Euro,        color: 'bg-rose-50 text-rose-600' },
            { label: 'Prev. accettati',   value: formatEuro(budget.preventiviAccettati), icon: TrendingUp,  color: 'bg-blue-50 text-blue-600' },
            { label: 'Speso (costi)',      value: formatEuro(budget.effettivo),           icon: Euro,        color: 'bg-orange-50 text-orange-600' },
            { label: 'Pagato',            value: formatEuro(budget.pagato),              icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          ].map(c => (
            <div key={c.label} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">{c.label}</div>
                  <div className="text-xl font-bold text-gray-900">{c.value}</div>
                </div>
                <div className={`p-2 rounded-lg ${c.color}`}><c.icon size={18} /></div>
              </div>
            </div>
          ))}
        </div>

        {budget.totale > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Utilizzo budget</span>
              <span className="text-sm font-bold" style={{ color: budgetUsato > 90 ? '#e11d48' : '#374151' }}>{budgetUsato}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
              <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(budgetUsato, 100)}%`, background: budgetUsato > 90 ? '#e11d48' : '#34d399' }} />
            </div>
            <div className="flex flex-wrap justify-between gap-y-1 text-xs text-gray-400">
              <span>Impegnato: {formatEuro(budgetImpegnato)}</span>
              {costi.nonPagati?.count > 0 && <span className="text-orange-500 font-semibold">⚠ {costi.nonPagati.count} in sospeso: {formatEuro(costi.nonPagati.tot)}</span>}
              <span>Rimasto: {formatEuro(budgetRimanente)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── GRAFICI: SPESE + OSPITI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {costi.perCategoria?.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Spese per categoria</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-40 h-40 flex-shrink-0 mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costi.perCategoria} dataKey="tot" nameKey="categoria" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {costi.perCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatEuro(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-1.5">
                {costi.perCategoria.slice(0, 6).map((c, i) => (
                  <div key={c.categoria} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600">{c.categoria}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{formatEuro(c.tot)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {ospitiChartData.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Risposte ospiti</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-40 h-40 flex-shrink-0 mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ospitiChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {ospitiChartData.map(entry => {
                        const c = { Confermati: '#34d399', 'In attesa': '#fbbf24', Declinati: '#f43f5e' };
                        return <Cell key={entry.name} fill={c[entry.name] || '#e5e7eb'} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-3">
                {[
                  { label: 'Confermati', value: ospiti?.confermati || 0, color: 'text-green-600', bar: '#34d399' },
                  { label: 'In attesa',  value: ospiti?.attesa || 0,     color: 'text-yellow-600', bar: '#fbbf24' },
                  { label: 'Declinati', value: ospiti?.declinati || 0,  color: 'text-red-500',   bar: '#f43f5e' },
                ].map(r => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600">{r.label}</span>
                      <span className={`font-bold ${r.color}`}>{r.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${ospiti?.totale ? Math.round(r.value / ospiti.totale * 100) : 0}%`, background: r.bar }} />
                    </div>
                  </div>
                ))}
                {(ospiti?.adulti > 0 || ospiti?.bambini > 0) && (
                  <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                    Confermati: {ospiti.adulti} adulti + {ospiti.bambini} bambini
                  </div>
                )}
              </div>
            </div>
            <Link to="/ospiti" className="text-xs text-rose-500 font-semibold mt-3 block">Lista ospiti →</Link>
          </div>
        )}
      </div>

      {/* ── PREVENTIVI + FORNITORI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Stato preventivi</h3>
            <Link to="/preventivi" className="text-xs text-rose-500 font-semibold">Tutti →</Link>
          </div>
          {preventivi.perStato?.length > 0 ? (
            <div className="space-y-2">
              {preventivi.perStato.map(p => {
                const colors = { in_attesa: 'bg-gray-100', in_valutazione: 'bg-yellow-100', accettato: 'bg-green-100', rifiutato: 'bg-red-100' };
                const textColors = { in_attesa: 'text-gray-600', in_valutazione: 'text-yellow-700', accettato: 'text-green-700', rifiutato: 'text-red-600' };
                return (
                  <div key={p.stato} className={`flex items-center justify-between rounded-lg px-3 py-2 ${colors[p.stato] || 'bg-gray-50'}`}>
                    <span className={`text-sm font-medium ${textColors[p.stato] || 'text-gray-700'}`}>{label(statoPreventivo, p.stato)}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${textColors[p.stato] || 'text-gray-500'}`}>{p.count} prev.</span>
                      <span className={`text-sm font-bold ${textColors[p.stato] || 'text-gray-700'}`}>{formatEuro(p.tot)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Nessun preventivo</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700">Stato fornitori</h3>
            <Link to="/fornitori" className="text-xs text-rose-500 font-semibold">Tutti →</Link>
          </div>
          {fornitori.perStato?.length > 0 ? (
            <div className="space-y-2">
              {fornitori.perStato.map(f => {
                const colors = { da_contattare: 'bg-gray-100', contattato: 'bg-blue-100', preventivo_ricevuto: 'bg-yellow-100', confermato: 'bg-green-100', escluso: 'bg-red-100' };
                const textColors = { da_contattare: 'text-gray-600', contattato: 'text-blue-700', preventivo_ricevuto: 'text-yellow-700', confermato: 'text-green-700', escluso: 'text-red-600' };
                return (
                  <div key={f.stato} className={`flex items-center justify-between rounded-lg px-3 py-2 ${colors[f.stato] || 'bg-gray-50'}`}>
                    <span className={`text-sm font-medium ${textColors[f.stato] || 'text-gray-700'}`}>{label(statoFornitore, f.stato)}</span>
                    <span className={`text-sm font-bold ${textColors[f.stato] || 'text-gray-700'}`}>{f.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Nessun fornitore</p>
          )}
        </div>
      </div>

      {/* ── PROSSIME SCADENZE + CRONOLOGIA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-rose-500" />
              <h3 className="text-sm font-bold text-gray-700">Prossime scadenze</h3>
            </div>
            <Link to="/scadenze" className="text-xs text-rose-500 font-semibold">Tutte →</Link>
          </div>
          {scadenzeImminenti.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nessuna scadenza imminente</p>
          ) : (
            <div className="space-y-2">
              {scadenzeImminenti.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.titolo}</p>
                    {s.source !== 'manuale' && (
                      <span className={`badge text-xs ${sourceColor[s.source]}`}>{sourceLabel[s.source]}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-semibold ml-2 flex-shrink-0">{fmtDate(s.data_scadenza)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {cronologia?.length > 0 ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-rose-500" />
                <h3 className="text-sm font-bold text-gray-700">Programma del giorno</h3>
              </div>
              <Link to="/cronologia" className="text-xs text-rose-500 font-semibold">Tutto →</Link>
            </div>
            <div className="space-y-2">
              {cronologia.slice(0, 5).map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-bold text-rose-500 w-10 flex-shrink-0">{ev.ora}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.titolo}</p>
                    {ev.luogo && <p className="text-xs text-gray-400 truncate">📍 {ev.luogo}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-rose-500" />
                <h3 className="text-sm font-bold text-gray-700">Programma del giorno</h3>
              </div>
            </div>
            <div className="text-center py-6 text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nessun evento pianificato</p>
              <Link to="/cronologia" className="text-xs text-rose-500 font-semibold mt-2 block">Crea cronologia →</Link>
            </div>
          </div>
        )}
      </div>

      {/* ── NOTE VELOCI ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-rose-400" />
          <h3 className="text-sm font-bold text-gray-700">Note veloci</h3>
          <span className="ml-auto text-xs text-gray-400">salvato in locale</span>
        </div>
        <textarea
          className="w-full text-sm text-gray-700 resize-none bg-gray-50 rounded-lg p-3 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-transparent placeholder-gray-300"
          rows={3}
          placeholder="Appunti veloci, idee, cose da fare…"
          value={nota}
          onChange={e => salvaNote(e.target.value)}
        />
      </div>

      {/* ── TAVOLI + VIAGGIO + REGALI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/tavoli" className="card hover:border-rose-200 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-rose-400" />
            <h3 className="text-sm font-bold text-gray-700">Tavoli</h3>
          </div>
          {tavoli?.totale > 0 ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{tavoli.assegnati} <span className="text-base font-normal text-gray-400">/ {ospiti?.totale || 0}</span></div>
              <div className="text-xs text-gray-400 mt-0.5">ospiti assegnati a tavolo</div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${ospiti?.totale ? Math.min(100, Math.round(tavoli.assegnati / ospiti.totale * 100)) : 0}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Nessun tavolo creato</p>
          )}
        </Link>

        <Link to="/viaggio" className="card hover:border-rose-200 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Plane size={16} className="text-rose-400" />
            <h3 className="text-sm font-bold text-gray-700">Viaggio di nozze</h3>
          </div>
          {viaggio?.length > 0 ? (
            <div className="space-y-1">
              {viaggio.map(v => {
                const stColors = { da_prenotare: 'text-gray-400', prenotato: 'text-blue-500', pagato: 'text-green-500', completato: 'text-purple-500' };
                const stLabels = { da_prenotare: 'Da prenotare', prenotato: 'Prenotato', pagato: 'Pagato', completato: 'Completato' };
                return (
                  <div key={v.stato} className="flex justify-between text-sm">
                    <span className={`text-xs ${stColors[v.stato]}`}>{stLabels[v.stato]}</span>
                    <span className="font-bold text-gray-700">{v.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessun elemento</p>
          )}
        </Link>

        <Link to="/regali" className="card hover:border-rose-200 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-rose-400" />
            <h3 className="text-sm font-bold text-gray-700">Regali</h3>
          </div>
          {regali?.totale > 0 ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{regali.totale}</div>
              <div className="text-xs text-gray-400 mt-0.5">regali ricevuti</div>
              {regali.da_ringraziare > 0 && (
                <div className="mt-2 text-xs font-semibold text-orange-500">
                  ⚠ {regali.da_ringraziare} ringraziamenti da inviare
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Nessun regalo registrato</p>
          )}
        </Link>
      </div>

    </div>
  );
}
