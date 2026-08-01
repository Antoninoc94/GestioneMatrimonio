import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fornitori from './pages/Fornitori';
import Preventivi from './pages/Preventivi';
import Budget from './pages/Budget';
import Scadenze from './pages/Scadenze';
import Location from './pages/Location';
import Documenti from './pages/Documenti';
import Idee from './pages/Idee';
import Impostazioni from './pages/Impostazioni';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="fornitori" element={<Fornitori />} />
        <Route path="preventivi" element={<Preventivi />} />
        <Route path="budget" element={<Budget />} />
        <Route path="scadenze" element={<Scadenze />} />
        <Route path="location" element={<Location />} />
        <Route path="documenti" element={<Documenti />} />
        <Route path="idee" element={<Idee />} />
        <Route path="impostazioni" element={<Impostazioni />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
