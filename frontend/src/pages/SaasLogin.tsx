import React, { useState } from 'react';
import axios from 'axios';
import { ShieldAlert, Mail, Lock } from 'lucide-react';

export function SaasLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const lidarComLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const { data } = await axios.post('http://192.168.100.50:3000/saas/login', { email, senha });
      
      // Salva em chaves separadas para não dar conflito com o login do bar
      localStorage.setItem('@SaaSBar:adminToken', data.token);
      localStorage.setItem('@SaaSBar:adminNome', data.admin.nome);
      
      // Redireciona para o painel de controle master
      window.location.href = '/saas-dashboard';
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Falha na autenticação master.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-amber-500/10 p-3 rounded-full mb-3">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SaaS Bar • Painel Master</h1>
          <p className="text-xs text-slate-500 mt-1 text-center">Área restrita para administração global do ecossistema.</p>
        </div>

        {erro && (
          <div className="bg-red-950/40 border border-red-800 text-red-400 p-3 rounded-xl mb-4 text-xs text-center font-medium">
            {erro}
          </div>
        )}

        <form onSubmit={lidarComLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">E-mail Master</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saasbar.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha de Autenticação</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 mt-2"
          >
            {carregando ? 'Autenticando na Rede...' : 'Entrar no Hub Principal'}
          </button>
        </form>
      </div>
    </div>
  );
}