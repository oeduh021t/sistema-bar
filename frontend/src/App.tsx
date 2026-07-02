import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Produtos } from './pages/Produtos';
import { Fiado } from './pages/Fiado';
import { Mesas } from './pages/Mesas'; 
import Caixa from './pages/Caixa'; // 🔄 Ajustado o espaço e o import padrão

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
      {telaAtiva === 'mesas' && <Mesas />}
      {telaAtiva === 'produtos' && <Produtos />}
      {telaAtiva === 'fiado' && <Fiado />}
      {telaAtiva === 'caixa' && <Caixa />} {/* 🟢 Injetado para renderizar o painel do caixa */}
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