import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';

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

  // Se não estiver logado, exibe apenas a tela de Login limpa
  if (!token) {
    return <Login />;
  }

  // Se estiver logado, exibe a estrutura interna com a Sidebar
  return (
    <Layout telaAtiva={telaAtiva} setTelaAtiva={setTelaAtiva}>
      {telaAtiva === 'dashboard' && <Dashboard />}
      {telaAtiva === 'produtos' && (
        <div className="text-slate-400 font-medium">
          🚧 Tela de Estoque e Produtos sendo preparada...
        </div>
      )}
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
