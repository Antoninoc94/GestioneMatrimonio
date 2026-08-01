import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import api from '../api';

export default function Impostazioni() {
  const [config, setConfig] = useState({ data_matrimonio: '', budget_totale: '', nome_sposo1: '', nome_sposo2: '' });
  const [pwd, setPwd] = useState({ vecchia: '', nuova: '', conferma: '' });
  const [saved, setSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    api.get('/config').then(r => setConfig({
      ...r.data,
      data_matrimonio: r.data.data_matrimonio || '',
      budget_totale: r.data.budget_totale?.toString() || ''
    }));
  }, []);

  const saveConfig = async e => {
    e.preventDefault();
    await api.put('/config', { ...config, budget_totale: parseFloat(config.budget_totale) || 0 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const savePwd = async e => {
    e.preventDefault();
    if (pwd.nuova !== pwd.conferma) { setPwdMsg('Le password non coincidono'); return; }
    try {
      await api.post('/auth/change-password', { vecchia_password: pwd.vecchia, nuova_password: pwd.nuova });
      setPwdMsg('Password aggiornata!');
      setPwd({ vecchia: '', nuova: '', conferma: '' });
    } catch {
      setPwdMsg('Vecchia password errata');
    }
    setTimeout(() => setPwdMsg(''), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Impostazioni</h1>
        <p className="page-subtitle">Configura i dettagli del tuo matrimonio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={18} className="text-rose-400" />
            <h2 className="font-bold text-gray-800">Dati Matrimonio</h2>
          </div>
          <form onSubmit={saveConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Nome Sposo/a 1</label>
                <input className="form-input" value={config.nome_sposo1} onChange={e => setConfig({ ...config, nome_sposo1: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Nome Sposo/a 2</label>
                <input className="form-input" value={config.nome_sposo2} onChange={e => setConfig({ ...config, nome_sposo2: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="form-label">Data del Matrimonio</label>
              <input type="date" className="form-input" value={config.data_matrimonio} onChange={e => setConfig({ ...config, data_matrimonio: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Budget Totale (€)</label>
              <input type="number" min="0" step="100" className="form-input" value={config.budget_totale} onChange={e => setConfig({ ...config, budget_totale: e.target.value })} placeholder="es. 25000" />
            </div>
            <button type="submit" className="btn-primary">
              <Save size={16} /> {saved ? 'Salvato!' : 'Salva'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-bold text-gray-800 mb-4">Cambia Password</h2>
          <form onSubmit={savePwd} className="space-y-3">
            <div>
              <label className="form-label">Password attuale</label>
              <input type="password" className="form-input" value={pwd.vecchia} onChange={e => setPwd({ ...pwd, vecchia: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Nuova password</label>
              <input type="password" className="form-input" value={pwd.nuova} onChange={e => setPwd({ ...pwd, nuova: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="form-label">Conferma nuova password</label>
              <input type="password" className="form-input" value={pwd.conferma} onChange={e => setPwd({ ...pwd, conferma: e.target.value })} required />
            </div>
            {pwdMsg && <p className={`text-sm ${pwdMsg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg}</p>}
            <button type="submit" className="btn-primary"><Save size={16} /> Aggiorna Password</button>
          </form>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-bold text-gray-800 mb-3">Accessi</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-rose-50 rounded-lg">
            <p className="font-semibold text-rose-700">Sposo</p>
            <p className="text-gray-500 mt-0.5">sposo@matrimonio.it</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg">
            <p className="font-semibold text-rose-700">Sposa</p>
            <p className="text-gray-500 mt-0.5">sposa@matrimonio.it</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Per cambiare email, modifica direttamente il database o contatta l'amministratore.</p>
      </div>
    </div>
  );
}
