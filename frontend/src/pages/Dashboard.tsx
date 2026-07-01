import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { DollarSign, Wallet, Store, AlertTriangle } from 'lucide-react';

interface ResumoFinanceiro {
  total_atualmente_pendurado: number;
  total_historico_fiado_recebido: number;
  faturamento_potencial_mesas_abertas: number;
}

interface ClienteInadimplente {
  nome: string;
  saldo_devedor: string;
  limite_credito: string;
}

export const Dashboard: React.FC = () => {
  const [financeiro, setFinanceiro] = useState<ResumoFinanceiro | null>(null);
  const [devedores, setDevedores] = useState<ClienteInadimplente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarDadosDashboard() {
      try {
        const response = await api.get('/relatorios/dashboard');
        setFinanceiro(response.data.resumo_financeiro);
        setDevedores(response.data.top_clientes_inadimplentes);
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDadosDashboard();
  }, []);

  if (loading) {
    return <div className="text-slate-400 font-medium">Buscando relatórios gerenciais...</div>;
  }

  // Formatação de Dinheiro em Real Brasileiro de forma simplificada
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Gerencial</h1>
        <p className="text-slate-400 text-sm mt-1">Visão financeira e controle de risco do estabelecimento.</p>
      </div>

      {/* Grid de Cards Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-400">Total Pendurado (Fiado)</p>
            <h3 className="text-2xl font-bold text-red-400 mt-1">
              {formatarMoeda(financeiro?.total_atualmente_pendurado || 0)}
            </h3>
          </div>
          <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-400">Total Recebido de Fiado</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {formatarMoeda(financeiro?.total_historico_fiado_recebido || 0)}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-400">Potencial em Mesas Abertas</p>
            <h3 className="text-2xl font-bold text-amber-500 mt-1">
              {formatarMoeda(financeiro?.faturamento_potencial_mesas_abertas || 0)}
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Store className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Seção Inferior: Top Clientes Devedores */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-slate-700 flex items-center gap-2 text-amber-500">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-lg font-bold text-slate-100">Top 5 Clientes Inadimplentes (Maior Dívida)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4">Cliente</th>
                <th className="p-4">Dívida Atual</th>
                <th className="p-4">Limite de Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 text-sm">
              {devedores.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-500">Nenhum cliente com fiado pendente no momento.</td>
                </tr>
              ) : (
                devedores.map((cliente, index) => (
                  <tr key={index} className="hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 font-medium text-slate-200">{cliente.nome}</td>
                    <td className="p-4 text-red-400 font-semibold">{formatarMoeda(Number(cliente.saldo_devedor))}</td>
                    <td className="p-4 text-slate-400">{formatarMoeda(Number(cliente.limite_credito))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
