import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useAppConfig } from '../AppConfigContext';

export default function Login() {
  const { login } = useAuth();
  const { app_name, app_emoji, login_subtitle } = useAppConfig();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError('Username o password non corretti');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 mb-4 text-4xl">
            {app_emoji}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{app_name}</h1>
          <p className="text-gray-500 mt-2">{login_subtitle || 'Accedi per gestire il tuo grande giorno'}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="sposo"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <strong>Accesso predefinito:</strong><br />
            Username: <code>sposo</code> / Password: <code>sposo1</code><br />
            Username: <code>sposa</code> / Password: <code>sposa1</code>
          </div>
        </div>
      </div>
    </div>
  );
}
