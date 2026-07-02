import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  LogOut, 
  Beer, 
  Grid, 
  Banknote, 
  UserPlus,
  Menu, // 🟢 Ícone para abrir o menu
  X     // 🟢 Ícone para fechar o menu
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, telaAtiva, setTelaAtiva }) => {
  const { usuario, logout } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false); // 🟢 Estado que controla o menu no celular

  const menus = [
    { id: 'dashboard', nome: 'Dashboard', icone: LayoutDashboard, acesso: ['DONO'] },
    { id: 'caixa', nome: 'Controle de Caixa', icone: Banknote, acesso: ['DONO'] },
    { id: 'usuarios', nome: 'Gestão de Equipe', icone: UserPlus, acesso: ['DONO'] },
    { id: 'mesas', nome: 'Salão & Mesas', icone: Grid, acesso: ['DONO', 'GARCOM'] },
    { id: 'produtos', nome: 'Estoque / Produtos', icone: Package, acesso: ['DONO', 'GARCOM'] },
    { id: 'fiado', nome: 'Controle de Pendências', icone: Users, acesso: ['DONO'] },
  ];

  // 🟢 Função auxiliar para mudar a tela e fechar a barra lateral no mobile
  const trocarTela = (id: string) => {
    setTelaAtiva(id);
    setMenuAberto(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-900 text-slate-100">
      
      {/* 🟢 1. TOPBAR DO MOBILE (Aparece apenas em telas pequenas) */}
      <header className="md:hidden bg-slate-800 border-b border-slate-700 px-5 py-3.5 flex items-center justify-between w-full sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Beer className="w-7 h-7 text-amber-500" />
          <span className="text-lg font-bold tracking-tight text-amber-500">SaaS Bar</span>
        </div>
        <button 
          onClick={() => setMenuAberto(!menuAberto)} 
          className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors focus:outline-none"
        >
          {menuAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* 🟢 2. ESCUDO DE FUNDO (Fecha a barra se o garçom clicar fora dela no celular) */}
      {menuAberto && (
        <div 
          onClick={() => setMenuAberto(false)} 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
        />
      )}

      {/* 🟢 3. SIDEBAR DINÂMICA E RESPONSIVA */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 flex flex-col justify-between p-4
        transition-transform duration-300 ease-in-out
        ${menuAberto ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:z-auto shrink-0
      `}>
        <div>
          {/* Logo da Sidebar (Fica escondido no Mobile para não duplicar com o topo) */}
          <div className="hidden md:flex items-center gap-2 px-2 py-4 border-b border-slate-700 mb-6">
            <Beer className="w-8 h-8 text-amber-500" />
            <span className="text-xl font-bold tracking-tight text-amber-500">SaaS Bar</span>
          </div>

          {/* Links de navegação */}
          <nav className="space-y-1">
            {menus.map((item) => {
              if (!item.acesso.includes(usuario?.funcao || '')) return null;
              
              const Icone = item.icone;
              const ativo = telaAtiva === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => trocarTela(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    ativo 
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10 font-bold' 
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

        {/* Informações do usuário logado e botão Sair */}
        <div className="border-t border-slate-700 pt-4">
          <div className="px-2 mb-3">
            <p className="text-sm font-semibold truncate text-slate-200">{usuario?.nome}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-0.5">{usuario?.funcao}</p>
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

      {/* 🟢 4. ÁREA DO CONTEÚDO PRINCIPAL (Agora se adapta dinamicamente sem quebrar cards) */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        {children}
      </main>

    </div>
  );
};