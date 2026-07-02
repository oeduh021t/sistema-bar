import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Package, Users, LogOut, Beer, Grid, Banknote } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, telaAtiva, setTelaAtiva }) => {
  const { usuario, logout } = useAuth();

  const menus = [
    { id: 'dashboard', nome: 'Dashboard', icone: LayoutDashboard, acesso: ['DONO'] },
    { id: 'caixa', nome: 'Controle de Caixa', icone: Banknote, acesso: ['DONO'] }, // 🟢 Adicionado o Módulo de Caixa
    { id: 'mesas', nome: 'Salão & Mesas', icone: Grid, acesso: ['DONO', 'GARCOM'] },
    { id: 'produtos', nome: 'Estoque / Produtos', icone: Package, acesso: ['DONO', 'GARCOM'] },
    { id: 'fiado', nome: 'Controle de Pendências', icone: Users, acesso: ['DONO'] },
  ];

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 px-2 py-4 border-b border-slate-700 mb-6">
            <Beer className="w-8 h-8 text-amber-500" />
            <span className="text-xl font-bold tracking-tight text-amber-500">SaaS Bar</span>
          </div>

          <nav className="space-y-1">
            {menus.map((item) => {
              if (!item.acesso.includes(usuario?.funcao || '')) return null;
              
              const Icone = item.icone;
              const ativo = telaAtiva === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setTelaAtiva(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    ativo 
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  <Icone className="w-5 h-5" />
                  {item.nome}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <div className="px-2 mb-3">
            <p className="text-sm font-semibold truncate">{usuario?.nome}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{usuario?.funcao}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};