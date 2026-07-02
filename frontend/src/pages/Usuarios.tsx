import React, { useState } from 'react';
import api from '../services/api';
import { UserPlus, Shield, User, Mail, Key } from 'lucide-react';

export function Usuarios() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [funcao, setFuncao] = useState('GARCOM');
  
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const lidarComCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!nome || !email || !senha || !funcao) {
      setErro('Por favor, preencha todos os campos do formulário.');
      return;
    }

    try {
      setCarregando(true);
      await api.post('/usuarios/cadastro', { nome, email, senha, funcao });
      
      setSucesso(`Usuário ${nome} cadastrado com sucesso como ${funcao}!`);
      setNome('');
      setEmail('');
      setSenha('');
      setFuncao('GARCOM');
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro interno ao processar o cadastro.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto text-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-8 h-8 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Gestão de Equipe</h1>
          <p className="text-sm text-slate-400">Cadastre novos funcionários e atribua níveis de acesso ao sistema.</p>
        </div>
      </div>

      {erro && (
        <div className="bg-red-950/40 border border-red-800 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-400 p-3 rounded-lg mb-6 text-sm">
          {sucesso}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <form onSubmit={lidarComCadastro} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" /> Nome Completo
            </label>
            <input
              type="text"
              placeholder="Ex: Maria da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-500" /> E-mail de Acesso (Login)
            </label>
            <input
              type="email"
              placeholder="exemplo@sistemabar.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-slate-500" /> Senha Inicial
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-slate-500" /> Função / Nível de Permissão
            </label>
            <select
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-sm transition-colors cursor-pointer"
            >
              <option value="GARCOM">Garçom (Acesso ao Salão e Estoque)</option>
              <option value="DONO">Dono / Administrador (Acesso Total)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-lg transition-colors text-sm mt-2 disabled:opacity-50"
          >
            {carregando ? 'Processando Registro...' : 'Salvar Novo Funcionário'}
          </button>
        </form>
      </div>
    </div>
  );
}
