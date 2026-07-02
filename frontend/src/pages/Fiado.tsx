import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, UserPlus, AlertCircle, Banknote, ShieldCheck } from 'lucide-react';

interface ClienteFiado {
  id: number;
  nome: string;
  telefone: string | null;
  limite_credito: number;
  saldo_devedor: number;
}

export const Fiado: React.FC = () => {
  const [clientes, setClientes] = useState<ClienteFiado[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Estados do Modal de Pagamento
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteFiado | null>(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [meioPagto, setMeioPagto] = useState('DINHEIRO');

  const buscarClientes = async () => {
    try {
      const { data } = await api.get('/clientes-fiado');
      setClientes(data);
    } catch (err) {
      console.error('Erro ao buscar devedores:', err);
    }
  };

  useEffect(() => {
    buscarClientes();
  }, []);

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
      buscarClientes();
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

  const lidarComPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorPagamento || !clienteSelecionado) return;

    try {
      await api.post('/fiado/pagamento', {
        cliente_id: clienteSelecionado.id,
        valor: valorPagamento,
        meio_pagto: meioPagto
      });

      alert('Pagamento abatido e injetado no caixa com sucesso!');
      setClienteSelecionado(null);
      setValorPagamento('');
      buscarClientes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao processar baixa.');
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Controle de Pendências</h1>
        <p className="text-slate-400 text-sm mt-1">Cadastre clientes e dê baixas em débitos acumulados com fluxo direto de caixa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Painel de Listagem de Clientes e Saldos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-500 mb-4">
              <Users className="w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-100">Clientes Autorizados / Devedores</h2>
            </div>
            
            {clientes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum cliente cadastrado no fiado até o momento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs uppercase text-slate-400">
                      <th className="py-3 px-2">Cliente</th>
                      <th className="py-3 px-2">Contato</th>
                      <th className="py-3 px-2">Uso Limite</th>
                      <th className="py-3 px-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cli) => {
                      const totalDevedor = Number(cli.saldo_devedor || 0);
                      const limite = Number(cli.limite_credito || 200);
                      return (
                        <tr key={cli.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="py-3 px-2 font-medium text-slate-200">{cli.nome}</td>
                          <td className="py-3 px-2 text-xs text-slate-400">{cli.telefone || 'Sem telefone'}</td>
                          <td className="py-3 px-2">
                            <span className={`font-bold ${totalDevedor > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              R$ {totalDevedor.toFixed(2)}
                            </span>
                            <span className="text-xs text-slate-500"> / R$ {limite.toFixed(2)}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <button
                              onClick={() => setClienteSelecionado(cli)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Banknote className="w-3.5 h-3.5" /> Receber
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                onChange={(e) => setTelefone(e.target.value)}
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

      {/* Modal de Pagamento / Baixa */}
      {clienteSelecionado && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-emerald-400 mb-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5"/> Baixar Ficha de Débito
            </h3>
            <p className="text-xs text-slate-400 mb-4">O valor recebido entrará instantaneamente como faturamento do caixa diário ativo.</p>
            
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm space-y-1 mb-4">
              <p className="text-slate-400">Cliente: <span className="text-slate-100 font-semibold">{clienteSelecionado.nome}</span></p>
              <p className="text-slate-400">Dívida Ativa: <span className="text-rose-400 font-bold">R$ {Number(clienteSelecionado.saldo_devedor).toFixed(2)}</span></p>
            </div>
            
            <form onSubmit={lidarComPagamento} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Valor Pago pelo Cliente (R$):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required
                  autoFocus
                  placeholder="0,00"
                  value={valorPagamento} 
                  onChange={(e) => setValorPagamento(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Canal de Recebimento:</label>
                <select 
                  value={meioPagto} 
                  onChange={(e) => setMeioPagto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm cursor-pointer"
                >
                  <option value="DINHEIRO">Dinheiro Físico (Entra na Gaveta)</option>
                  <option value="PIX">PIX Direto</option>
                  <option value="CARTAO">Cartão de Crédito / Débito</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setClienteSelecionado(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm transition-colors font-medium">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded-xl text-sm transition-colors">Confirmar Baixa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};