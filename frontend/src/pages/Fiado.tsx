import React, { useState } from 'react';
import api from '../services/api';
import { Users, UserPlus, AlertCircle } from 'lucide-react';

export const Fiado: React.FC = () => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleCadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      await api.post('/clientes-fiado', {
        nome,
        telefone: telefone || undefined,
        limite_credito: limiteCredito ? Number(limiteCredito) : undefined,
      });

      setNome('');
      setTelefone('');
      setLimiteCredito('');
      
      alert('Cliente autorizado com sucesso!');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        setErro(err.response.data.error);
      } else {
        setErro('Erro ao salvar o cliente no servidor.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Controle de Pendências</h1>
        <p className="text-slate-400 text-sm mt-1">Cadastre clientes e defina limites máximos de crédito para contas em aberto.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Painel Informativo Lateral */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm text-slate-300 space-y-4">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-100">Funcionamento do Limite</h2>
          </div>
          <p className="text-sm text-slate-400">
            Quando uma mesa for fechada escolhendo a opção de <span className="text-amber-500 font-semibold">CONTA EM ABERTO (PENDÊNCIA)</span>, o sistema irá validar se o valor total acumulado não ultrapassa o limite de crédito definido para o cliente.
          </p>
          <p className="text-sm text-slate-400">
            Caso o limite seja atingido, o encerramento da conta será bloqueado automaticamente para controle de risco, exigindo a baixa parcial dos débitos antes de novas vendas.
          </p>
        </div>

        {/* Formulário de Cadastro */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 mb-6">
            <UserPlus className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-100">Autorizar Cliente</h2>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleCadastrarCliente} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Roberto Carlos da Silva"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Telefone / WhatsApp (Opcional)</label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex: (21) 99999-9999"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Limite de Crédito Disponível (R$)</label>
              <input
                type="number"
                value={limiteCredito}
                onChange={(e) => setLimiteCredito(e.target.value)}
                placeholder="Padrão: R$ 200,00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full mt-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-semibold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {salvando ? 'Processando...' : 'Autorizar Crédito'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
