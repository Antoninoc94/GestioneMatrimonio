import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Heart } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Email o password non corrette');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 mb-4">
            <Heart className="text-rose-500" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Il Nostro Matrimonio</h1>
          <p className="text-gray-500 mt-2">Accedi per gestire il tuo grande giorno</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="sposo@matrimonio.it"
                required
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
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <strong>Accesso predefinito:</strong><br />
            Sposo: sposo@matrimonio.it / sposo1<br />
            Sposa: sposa@matrimonio.it / sposa1
          </div>
        </div>
      </div>
    </div>
  );
}
