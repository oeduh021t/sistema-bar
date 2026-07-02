import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Produtos } from './pages/Produtos';
import { Fiado } from './pages/Fiado';
import { Mesas } from './pages/Mesas'; // 👈 1. Importa as Mesas aqui

const ConteudoApp: React.FC = () => {
  const { token, loading } = useAuth();
  const [telaAtiva, setTelaAtiva] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">
        Carregando credenciais salvas...
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <Layout telaAtiva={telaAtiva} setTelaAtiva={setTelaAtiva}>
      {telaAtiva === 'dashboard' && <Dashboard />}
      {telaAtiva === 'mesas' && <Mesas />} {/* 👈 2. Renderiza o salão aqui */}
      {telaAtiva === 'produtos' && <Produtos />}
      {telaAtiva === 'fiado' && <Fiado />}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <ConteudoApp />
    </AuthProvider>
  );
}

export default App;
