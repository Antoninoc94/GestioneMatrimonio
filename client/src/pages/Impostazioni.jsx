import { useEffect, useState } from 'react';
import { Save, Settings, User, Mail, Users, CheckCircle, XCircle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} className="text-rose-400" />
        <h2 className="font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Impostazioni() {
  const { user, updateUser } = useAuth();

  // Config matrimonio
  const [config, setConfig] = useState({ data_matrimonio: '', budget_totale: '', nome_sposo1: '', nome_sposo2: '' });
  const [configSaved, setConfigSaved] = useState(false);

  // Profilo
  const [profilo, setProfilo] = useState({ nome: '', username: '', email: '' });
  const [profiloSaved, setProfiloSaved] = useState(false);
  const [profiloError, setProfiloError] = useState('');

  // Password
  const [pwd, setPwd] = useState({ vecchia: '', nuova: '', conferma: '' });
  const [pwdMsg, setPwdMsg] = useState('');

  // Email config
  const [emailCfg, setEmailCfg] = useState({ smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: '', smtp_password: '', from_name: 'Il Nostro Matrimonio', from_email: '', enabled: false });
  const [emailMsg, setEmailMsg] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    api.get('/config').then(r => setConfig({ ...r.data, data_matrimonio: r.data.data_matrimonio || '', budget_totale: r.data.budget_totale?.toString() || '' }));
    api.get('/profilo/me').then(r => setProfilo({ nome: r.data.nome || '', username: r.data.username || '', email: r.data.email || '' }));
    api.get('/email-config').then(r => setEmailCfg({ ...r.data, smtp_password: '', enabled: !!r.data.enabled }));
  }, []);

  const saveConfig = async e => {
    e.preventDefault();
    await api.put('/config', { ...config, budget_totale: parseFloat(config.budget_totale) || 0 });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const saveProfilo = async e => {
    e.preventDefault();
    setProfiloError('');
    try {
      const { data } = await api.put('/profilo/me', profilo);
      localStorage.setItem('token', data.token);
      updateUser(data.user);
      setProfiloSaved(true);
      setTimeout(() => setProfiloSaved(false), 2500);
    } catch (err) {
      setProfiloError(err.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const savePwd = async e => {
    e.preventDefault();
    if (pwd.nuova !== pwd.conferma) { setPwdMsg('Le password non coincidono'); return; }
    try {
      await api.post('/auth/change-password', { vecchia_password: pwd.vecchia, nuova_password: pwd.nuova });
      setPwdMsg('✓ Password aggiornata!');
      setPwd({ vecchia: '', nuova: '', conferma: '' });
    } catch {
      setPwdMsg('✗ Vecchia password errata');
    }
    setTimeout(() => setPwdMsg(''), 3000);
  };

  const saveEmail = async e => {
    e.preventDefault();
    setEmailMsg('');
    try {
      await api.put('/email-config', { ...emailCfg, smtp_port: parseInt(emailCfg.smtp_port) });
      setEmailMsg('✓ Configurazione salvata');
    } catch {
      setEmailMsg('✗ Errore nel salvataggio');
    }
    setTimeout(() => setEmailMsg(''), 3000);
  };

  const testEmail = async () => {
    setTestingEmail(true);
    setEmailMsg('');
    try {
      const { data } = await api.post('/email-config/test');
      setEmailMsg('✓ ' + data.message);
    } catch (err) {
      setEmailMsg('✗ ' + (err.response?.data?.error || 'Connessione fallita'));
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Impostazioni</h1>
        <p className="page-subtitle">Gestisci profilo, matrimonio e notifiche</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Profilo personale */}
        <Section title="Il Mio Profilo" icon={User}>
          <form onSubmit={saveProfilo} className="space-y-3">
            <div>
              <label className="form-label">Nome visualizzato *</label>
              <input className="form-input" value={profilo.nome} onChange={e => setProfilo({ ...profilo, nome: e.target.value })} placeholder="es. Antonino" required />
            </div>
            <div>
              <label className="form-label">Username (per il login) *</label>
              <input className="form-input" value={profilo.username} onChange={e => setProfilo({ ...profilo, username: e.target.value })} placeholder="es. antonino" required />
              <p className="text-xs text-gray-400 mt-1">Solo lettere minuscole, numeri e underscore</p>
            </div>
            <div>
              <label className="form-label">Email (per le notifiche)</label>
              <input type="email" className="form-input" value={profilo.email} onChange={e => setProfilo({ ...profilo, email: e.target.value })} placeholder="tua@email.it" />
            </div>
            {profiloError && <p className="text-sm text-red-500">{profiloError}</p>}
            <button type="submit" className="btn-primary">
              <Save size={15} /> {profiloSaved ? 'Salvato!' : 'Salva Profilo'}
            </button>
          </form>
        </Section>

        {/* Cambio password */}
        <Section title="Cambia Password" icon={Settings}>
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
            {pwdMsg && <p className={`text-sm font-medium ${pwdMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg}</p>}
            <button type="submit" className="btn-primary"><Save size={15} /> Aggiorna Password</button>
          </form>
        </Section>

        {/* Dati matrimonio */}
        <Section title="Dati Matrimonio" icon={Settings}>
          <form onSubmit={saveConfig} className="space-y-3">
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
              <Save size={15} /> {configSaved ? 'Salvato!' : 'Salva'}
            </button>
          </form>
        </Section>

        {/* Configurazione email */}
        <Section title="Notifiche Email" icon={Mail}>
          <form onSubmit={saveEmail} className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-2">
              <Mail size={14} className="flex-shrink-0" />
              <span>Usa Gmail con una <strong>password per le app</strong> (Account Google → Sicurezza → Password per le app)</span>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="enabled" checked={emailCfg.enabled} onChange={e => setEmailCfg({ ...emailCfg, enabled: e.target.checked })} className="w-4 h-4 accent-rose-500" />
              <label htmlFor="enabled" className="form-label mb-0">Abilita notifiche email</label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="form-label">Server SMTP</label>
                <input className="form-input" value={emailCfg.smtp_host} onChange={e => setEmailCfg({ ...emailCfg, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="form-label">Porta</label>
                <input type="number" className="form-input" value={emailCfg.smtp_port} onChange={e => setEmailCfg({ ...emailCfg, smtp_port: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="form-label">Account Gmail (indirizzo)</label>
              <input type="email" className="form-input" value={emailCfg.smtp_user} onChange={e => setEmailCfg({ ...emailCfg, smtp_user: e.target.value })} placeholder="tuo@gmail.com" />
            </div>
            <div>
              <label className="form-label">Password per le app Google</label>
              <input type="password" className="form-input" value={emailCfg.smtp_password} onChange={e => setEmailCfg({ ...emailCfg, smtp_password: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
              <p className="text-xs text-gray-400 mt-1">Lascia vuoto per mantenere la password salvata</p>
            </div>
            <div>
              <label className="form-label">Nome mittente</label>
              <input className="form-input" value={emailCfg.from_name} onChange={e => setEmailCfg({ ...emailCfg, from_name: e.target.value })} placeholder="Il Nostro Matrimonio" />
            </div>

            {emailMsg && (
              <p className={`text-sm font-medium flex items-center gap-1.5 ${emailMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                {emailMsg.startsWith('✓') ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {emailMsg.replace(/^[✓✗] /, '')}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary"><Save size={15} /> Salva</button>
              <button type="button" className="btn-secondary" onClick={testEmail} disabled={testingEmail}>
                {testingEmail ? 'Test...' : 'Testa Connessione'}
              </button>
            </div>
          </form>
        </Section>

      </div>

      {/* Utenti */}
      <div className="card mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-rose-400" />
          <h2 className="font-bold text-gray-800">Accessi</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-rose-50 rounded-lg">
            <p className="font-semibold text-rose-700">Account 1 — {user?.ruolo === 'sposo' ? user.nome : 'Sposo'}</p>
            <p className="text-gray-500 mt-0.5">Username: <code className="bg-white px-1 rounded">{user?.ruolo === 'sposo' ? user.username : 'sposo'}</code></p>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg">
            <p className="font-semibold text-rose-700">Account 2 — {user?.ruolo === 'sposa' ? user.nome : 'Sposa'}</p>
            <p className="text-gray-500 mt-0.5">Username: <code className="bg-white px-1 rounded">{user?.ruolo === 'sposa' ? user.username : 'sposa'}</code></p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Ogni utente può cambiare il proprio nome e username dalla sezione "Il Mio Profilo".</p>
      </div>
    </div>
  );
}
