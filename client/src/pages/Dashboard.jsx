import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, CalendarDays, Euro, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const COLORS = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#f97316', '#fbbf24', '#34d399'];

const prioritaColor = { alta: 'text-red-600 bg-red-50', media: 'text-yellow-600 bg-yellow-50', bassa: 'text-green-600 bg-green-50' };

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(console.error);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Heart className="text-rose-300 mx-auto mb-2 animate-pulse" size={40} />
        <p className="text-gray-400">Caricamento...</p>
      </div>
    </div>
  );

  const { config, giorniAlMatrimonio, budget, scadenzeImminenti, scadenzeScadute, costiPerCategoria, preventiviPerStato } = data;

  const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);
  const budgetUsato = budget.totale > 0 ? Math.round((budget.effettivo / budget.totale) * 100) : 0;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      {/* Budget cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Budget Totale', value: formatEuro(budget.totale), icon: Euro, color: 'bg-rose-50 text-rose-600' },
          { label: 'Preventivato', value: formatEuro(budget.preventivato), icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
          { label: 'Speso', value: formatEuro(budget.effettivo), icon: Euro, color: 'bg-orange-50 text-orange-600' },
          { label: 'Pagato', value: formatEuro(budget.pagato), icon: CheckCircle, color: 'bg-green-50 text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
              </div>
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget progress */}
      {budget.totale > 0 && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Utilizzo Budget</span>
            <span className="text-sm font-bold" style={{ color: budgetUsato > 90 ? '#e11d48' : '#374151' }}>{budgetUsato}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${Math.min(budgetUsato, 100)}%`, background: budgetUsato > 90 ? '#e11d48' : '#34d399' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Speso: {formatEuro(budget.effettivo)}</span>
            <span>Rimanente: {formatEuro(Math.max(0, budget.totale - budget.effettivo))}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Costi per categoria */}
        {costiPerCategoria?.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Spese per Categoria</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={costiPerCategoria} dataKey="tot" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} label={({ categoria, percent }) => `${categoria} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {costiPerCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatEuro(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Preventivi per stato */}
        {preventiviPerStato?.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Stato Preventivi</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={preventiviPerStato} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="stato" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatEuro(v)} />
                <Bar dataKey="tot" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scadenze in ritardo */}
        {scadenzeScadute?.length > 0 && (
          <div className="card border-red-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-sm font-bold text-red-700">Scadenze Superate ({scadenzeScadute.length})</h2>
            </div>
            <div className="space-y-2">
              {scadenzeScadute.slice(0, 4).map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-800">{s.titolo}</span>
                  <span className="text-xs text-red-600 font-semibold">{format(parseISO(s.data_scadenza), 'd MMM', { locale: it })}</span>
                </div>
              ))}
            </div>
            <Link to="/scadenze" className="text-xs text-rose-500 font-semibold mt-3 block">Vedi tutte →</Link>
          </div>
        )}

        {/* Prossime scadenze */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-rose-500" />
            <h2 className="text-sm font-bold text-gray-700">Prossime Scadenze</h2>
          </div>
          {scadenzeImminenti?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nessuna scadenza imminente</p>
          ) : (
            <div className="space-y-2">
              {scadenzeImminenti.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.titolo}</p>
                    <span className={`badge text-xs mt-0.5 ${prioritaColor[s.priorita]}`}>{s.priorita}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-semibold">{format(parseISO(s.data_scadenza), 'd MMM', { locale: it })}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/scadenze" className="text-xs text-rose-500 font-semibold mt-3 block">Gestisci scadenze →</Link>
        </div>
      </div>
    </div>
  );
}
