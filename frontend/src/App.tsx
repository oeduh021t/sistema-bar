import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Produtos } from './pages/Produtos';
import { Fiado } from './pages/Fiado';
import { Mesas } from './pages/Mesas'; 
import Caixa from './pages/Caixa'; 
import { Usuarios } from './pages/Usuarios';

// Imports do Novo Ecossistema SaaS
import { SaasLogin } from './pages/SaasLogin';
import { SaasDashboard } from './pages/SaasDashboard'; // Criaremos no próximo passo

const ConteudoApp: React.FC = () => {
  const { token, loading } = useAuth();
  const [telaAtiva, setTelaAtiva] = useState('dashboard');

  // 🛰️ ROTEADOR NATIVO (Captura o caminho da URL atual)
  const caminhoAtual = window.location.pathname;

  // 1. Rotas Isoladas do Super Admin (SaaS)
  if (caminhoAtual === '/saas-login') {
    return <SaasLogin />;
  }

  if (caminhoAtual === '/saas-dashboard') {
    // Bloqueio de segurança local: Se não houver token do SaaS, chuta para o login do SaaS
    const tokenAdmin = localStorage.getItem('@SaaSBar:adminToken');
    if (!tokenAdmin) {
      window.location.href = '/saas-login';
      return null;
    }
    return <SaasDashboard />;
  }

  // 2. Fluxo Tradicional do Cliente/Bar (Rotas normais)
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
      {telaAtiva === 'caixa' && <Caixa />} 
      {telaAtiva === 'usuarios' && <Usuarios />}
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