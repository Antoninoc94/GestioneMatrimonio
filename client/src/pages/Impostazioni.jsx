import { useEffect, useState } from 'react';
import { Save, Settings, User, Mail, Users, CheckCircle, XCircle, Palette, Eye, EyeOff, Globe, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useAppConfig } from '../AppConfigContext';

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
  const { user, updateUser, logout } = useAuth();
  const { updateAppConfig } = useAppConfig();

  // Config matrimonio + aspetto
  const [config, setConfig] = useState({ data_matrimonio: '', budget_totale: '', nome_sposo1: '', nome_sposo2: '', app_name: 'Il Nostro Matrimonio', app_emoji: '💍', login_subtitle: '', conferma_abilitata: true, soglia_eta_bambino: 12 });
  const [configSaved, setConfigSaved] = useState(false);
  const [aspettoSaved, setAspettoSaved] = useState(false);

  // Profilo
  const [profilo, setProfilo] = useState({ nome: '', username: '', email: '' });
  const [profiloSaved, setProfiloSaved] = useState(false);
  const [profiloError, setProfiloError] = useState('');

  // Password
  const [pwd, setPwd] = useState({ vecchia: '', nuova: '', conferma: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [showPwd, setShowPwd] = useState({ vecchia: false, nuova: false, conferma: false });

  // Email config
  const [emailCfg, setEmailCfg] = useState({ smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: '', smtp_password: '', from_name: 'Il Nostro Matrimonio', from_email: '', enabled: false, reminder_abilitato: false, reminder_frequenza: 'settimanale', reminder_giorni_anticipo: 14, reminder_ora: 8, ultimo_invio_auto: null });
  const [emailMsg, setEmailMsg] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    api.get('/config').then(r => setConfig({ ...r.data, data_matrimonio: r.data.data_matrimonio || '', budget_totale: r.data.budget_totale?.toString() || '', app_name: r.data.app_name || 'Il Nostro Matrimonio', app_emoji: r.data.app_emoji || '💍', login_subtitle: r.data.login_subtitle || '', conferma_abilitata: r.data.conferma_abilitata !== 0, soglia_eta_bambino: r.data.soglia_eta_bambino || 12 }));
    api.get('/profilo/me').then(r => setProfilo({ nome: r.data.nome || '', username: r.data.username || '', email: r.data.email || '' }));
    api.get('/email-config').then(r => setEmailCfg({ ...r.data, smtp_password: '', enabled: !!r.data.enabled, reminder_abilitato: !!r.data.reminder_abilitato }));
  }, []);

  const saveConfig = async e => {
    e.preventDefault();
    await api.put('/config', { ...config, budget_totale: parseFloat(config.budget_totale) || 0, soglia_eta_bambino: parseInt(config.soglia_eta_bambino) || 12 });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const toggleConferma = async (val) => {
    const updated = { ...config, conferma_abilitata: val, budget_totale: parseFloat(config.budget_totale) || 0 };
    setConfig(c => ({ ...c, conferma_abilitata: val }));
    await api.put('/config', updated);
  };

  const saveAspetto = async e => {
    e.preventDefault();
    await api.put('/config', { ...config, budget_totale: parseFloat(config.budget_totale) || 0 });
    updateAppConfig({ app_name: config.app_name, app_emoji: config.app_emoji, login_subtitle: config.login_subtitle });
    setAspettoSaved(true);
    setTimeout(() => setAspettoSaved(false), 2500);
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
      setPwdMsg('✓ Password aggiornata! Reindirizzamento al login...');
      setPwd({ vecchia: '', nuova: '', conferma: '' });
      setTimeout(() => logout(), 2000);
    } catch (err) {
      const status = err.response?.status;
      setPwdMsg(status === 400 ? '✗ Password attuale non corretta' : '✗ Errore, riprova');
      setTimeout(() => setPwdMsg(''), 3500);
    }
  };

  const saveEmail = async e => {
    e.preventDefault();
    setEmailMsg('');
    try {
      const { data } = await api.put('/email-config', { ...emailCfg, smtp_port: parseInt(emailCfg.smtp_port), reminder_ora: parseInt(emailCfg.reminder_ora), reminder_giorni_anticipo: parseInt(emailCfg.reminder_giorni_anticipo) });
      setEmailCfg(prev => ({ ...prev, ultimo_invio_auto: data.ultimo_invio_auto }));
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
      setEmailMsg('✗ ' + (err.response?.data?.error || 'Invio fallito'));
    } finally {
      setTestingEmail(false);
    }
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    setEmailMsg('');
    try {
      const { data } = await api.post('/email-config/remind-scadenze', { giorni: 14 });
      setEmailMsg('✓ ' + data.message);
    } catch (err) {
      setEmailMsg('✗ ' + (err.response?.data?.error || 'Invio fallito'));
    } finally {
      setSendingReminder(false);
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
              <input className="form-input" value={profilo.username} onChange={e => setProfilo({ ...profilo, username: e.target.value.toLowerCase() })} placeholder="es. antonino" required />
              <p className="text-xs text-gray-400 mt-1">Salvato in minuscolo — usa questo esatto username per accedere</p>
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
            {[
              { label: 'Password attuale', key: 'vecchia', extra: {} },
              { label: 'Nuova password', key: 'nuova', extra: { minLength: 6 } },
              { label: 'Conferma nuova password', key: 'conferma', extra: {} },
            ].map(({ label, key, extra }) => (
              <div key={key}>
                <label className="form-label">{label}</label>
                <div className="relative">
                  <input
                    type={showPwd[key] ? 'text' : 'password'}
                    className="form-input pr-10"
                    value={pwd[key]}
                    onChange={e => setPwd({ ...pwd, [key]: e.target.value })}
                    required
                    {...extra}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPwd(s => ({ ...s, [key]: !s[key] }))}
                    tabIndex={-1}
                  >
                    {showPwd[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            {pwdMsg && <p className={`text-sm font-medium ${pwdMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg}</p>}
            <button type="submit" className="btn-primary"><Save size={15} /> Aggiorna Password</button>
          </form>
        </Section>

        {/* Dati matrimonio */}
        <Section title="Dati Matrimonio" icon={Settings}>
          <form onSubmit={saveConfig} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Nome Sposo</label>
                <input className="form-input" value={config.nome_sposo1} onChange={e => setConfig({ ...config, nome_sposo1: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Nome Sposa</label>
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
            <div>
              <label className="form-label">Soglia età "bambino"</label>
              <input type="number" min="0" max="17" className="form-input" value={config.soglia_eta_bambino} onChange={e => setConfig({ ...config, soglia_eta_bambino: e.target.value })} placeholder="es. 12" />
              <p className="text-xs text-gray-400 mt-1">Un figlio con età pari o superiore conta come adulto (menu, conteggi) — resta comunque "figlio" nelle etichette di parentela</p>
            </div>
            <button type="submit" className="btn-primary">
              <Save size={15} /> {configSaved ? 'Salvato!' : 'Salva'}
            </button>
          </form>
        </Section>

        {/* Personalizzazione app */}
        <Section title="Personalizzazione App" icon={Palette}>
          <form onSubmit={saveAspetto} className="space-y-3">
            <div>
              <label className="form-label">Nome applicazione</label>
              <input className="form-input" value={config.app_name} onChange={e => setConfig({ ...config, app_name: e.target.value })} placeholder="Il Nostro Matrimonio" required />
              <p className="text-xs text-gray-400 mt-1">Appare nella barra del browser e nella sidebar</p>
            </div>
            <div>
              <label className="form-label">Emoji icona</label>
              <input className="form-input" value={config.app_emoji} onChange={e => setConfig({ ...config, app_emoji: e.target.value })} placeholder="💍" maxLength={4} style={{ fontSize: '1.4rem' }} />
              <p className="text-xs text-gray-400 mt-1">Un singolo emoji — diventa la favicon del browser e l'icona nella sidebar</p>
            </div>
            <div>
              <label className="form-label">Sottotitolo pagina di accesso</label>
              <input className="form-input" value={config.login_subtitle} onChange={e => setConfig({ ...config, login_subtitle: e.target.value })} placeholder="Accedi per gestire il tuo grande giorno" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg text-xs text-rose-700">
              <span className="text-lg">{config.app_emoji || '💍'}</span>
              <span>Anteprima: <strong>{config.app_name || 'Il Nostro Matrimonio'}</strong></span>
            </div>
            <button type="submit" className="btn-primary">
              <Save size={15} /> {aspettoSaved ? 'Salvato!' : 'Salva Aspetto'}
            </button>
          </form>
        </Section>

        {/* Pagina Wedding */}
        <Section title="Pagina Wedding Pubblica" icon={Globe}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Crea e personalizza la pagina pubblica del matrimonio con foto, programma, location e dress code.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/landing" className="btn-primary text-sm">
                <Globe size={14} /> Personalizza pagina
              </Link>
              <a href="/wedding" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                <ExternalLink size={14} /> Anteprima
              </a>
            </div>
            <p className="text-xs text-gray-400">La pagina è accessibile su <code className="bg-gray-100 px-1 rounded">/wedding</code></p>
          </div>
        </Section>

        {/* Pagina RSVP pubblica */}
        <Section title="Pagina RSVP Pubblica" icon={Globe}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Abilita pagina conferma</p>
                <p className="text-xs text-gray-400 mt-0.5">Gli ospiti possono confermare la presenza su <code className="bg-gray-100 px-1 rounded">/conferma</code></p>
              </div>
              <button
                type="button"
                onClick={() => toggleConferma(!config.conferma_abilitata)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${config.conferma_abilitata ? 'bg-rose-500' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${config.conferma_abilitata ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className={`rounded-lg p-3 text-xs ${config.conferma_abilitata ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
              {config.conferma_abilitata ? (
                <>
                  <p className="font-semibold mb-1">Pagina attiva</p>
                  <p>Gli ospiti possono accedere a <strong>/conferma</strong> e confermare la loro presenza. Condividi il link del sito con il percorso <code>/conferma</code>.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-1">Pagina disabilitata</p>
                  <p>Gli ospiti che visitano <strong>/conferma</strong> vedranno un messaggio di pagina non disponibile.</p>
                </>
              )}
            </div>
          </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
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

            {/* ── Promemoria automatico ── */}
            <div className="border-t border-gray-100 pt-3 mt-1">
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" id="reminder_abilitato" checked={emailCfg.reminder_abilitato} onChange={e => setEmailCfg({ ...emailCfg, reminder_abilitato: e.target.checked })} className="w-4 h-4 accent-rose-500" />
                <label htmlFor="reminder_abilitato" className="form-label mb-0 font-semibold">Promemoria automatico scadenze</label>
              </div>

              {emailCfg.reminder_abilitato && (
                <div className="space-y-3 pl-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label">Frequenza</label>
                      <select className="form-input" value={emailCfg.reminder_frequenza} onChange={e => setEmailCfg({ ...emailCfg, reminder_frequenza: e.target.value })}>
                        <option value="giornaliero">Ogni giorno</option>
                        <option value="settimanale">Ogni settimana</option>
                        <option value="bisettimanale">Ogni 2 settimane</option>
                        <option value="mensile">Ogni mese</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Anticipo scadenze</label>
                      <select className="form-input" value={emailCfg.reminder_giorni_anticipo} onChange={e => setEmailCfg({ ...emailCfg, reminder_giorni_anticipo: e.target.value })}>
                        <option value={7}>7 giorni</option>
                        <option value={14}>14 giorni</option>
                        <option value={30}>30 giorni</option>
                        <option value={60}>60 giorni</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Orario invio</label>
                      <select className="form-input" value={emailCfg.reminder_ora} onChange={e => setEmailCfg({ ...emailCfg, reminder_ora: e.target.value })}>
                        {[6,7,8,9,10,12,14,16,18,20].map(h => (
                          <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {emailCfg.ultimo_invio_auto && (
                    <p className="text-xs text-gray-400">Ultimo invio automatico: {new Date(emailCfg.ultimo_invio_auto).toLocaleString('it-IT')}</p>
                  )}
                </div>
              )}
            </div>

            {emailMsg && (
              <p className={`text-sm font-medium flex items-center gap-1.5 ${emailMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                {emailMsg.startsWith('✓') ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {emailMsg.replace(/^[✓✗] /, '')}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className="btn-primary"><Save size={15} /> Salva</button>
              <button type="button" className="btn-secondary" onClick={testEmail} disabled={testingEmail}>
                {testingEmail ? 'Invio...' : '📧 Email di test'}
              </button>
              <button type="button" className="btn-secondary" onClick={sendReminder} disabled={sendingReminder}>
                {sendingReminder ? 'Invio...' : '📅 Invia promemoria ora'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Il promemoria include tutte le scadenze (manuali + automatiche da preventivi, viaggi e pagamenti).</p>
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
