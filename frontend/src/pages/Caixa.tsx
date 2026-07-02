import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Wallet, ArrowUpCircle, Lock, Unlock, CreditCard, Banknote, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface CaixaInfo {
  id: number;
  status: 'ABERTO' | 'FECHADO';
  valor_abertura: number;
  total_dinheiro_sistema: number;
  total_pix_sistema: number;
  total_cartao_sistema: number;
}

interface Movimentacao {
  id: number;
  tipo: string;
  meio_pagto: string;
  valor: number;
  descricao: string;
  data: string;
}

export default function Caixa() {
  const [caixaAtivo, setCaixaAtivo] = useState<CaixaInfo | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [valorInput, setValorInput] = useState('');
  const [erro, setErro] = useState('');
  const [auditoriaResultado, setAuditoriaResultado] = useState<any>(null);

  const buscarStatusCaixa = async () => {
    try {
      setCarregando(true);
      const { data } = await api.get('/caixa/status');
      if (data.aberto) {
        setCaixaAtivo(data.caixa);
        setMovimentacoes(data.movimentacoes || []);
      } else {
        setCaixaAtivo(null);
      }
    } catch (err: any) {
      setErro('Erro ao carregar os dados consolidados do caixa.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarStatusCaixa(); }, []);

  const lidarComAbertura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorInput) return;
    try {
      setErro('');
      const { data } = await api.post('/caixa/abrir', { valor_abertura: valorInput });
      setCaixaAtivo(data.caixa);
      setValorInput('');
      buscarStatusCaixa();
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro ao abrir o caixa.');
    }
  };

  const lidarComFechamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorInput) return;
    try {
      setErro('');
      const { data } = await api.post('/caixa/fechar', { valor_fechamento: valorInput });
      setAuditoriaResultado(data.auditoria);
      setCaixaAtivo(null);
      setValorInput('');
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro ao fechar o caixa.');
    }
  };

  if (carregando) return <div className="p-6 text-slate-400">Processando auditoria...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Fluxo & Caixa Gerencial</h1>
            <p className="text-sm text-slate-400">Controle blindado de movimentações e quebras de caixa.</p>
          </div>
        </div>
        <button onClick={buscarStatusCaixa} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-sm px-4 py-2 rounded-xl transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar Valores
        </button>
      </div>

      {erro && <div className="bg-red-950/40 border border-red-800 text-red-400 p-3 rounded-lg mb-6 text-sm">{erro}</div>}

      {auditoriaResultado && (
        <div className="bg-slate-900 border border-slate-700 p-5 rounded-xl mb-6 flex flex-col gap-2">
          <h3 className="text-lg font-bold flex items-center gap-2 text-amber-500"><CheckCircle className="text-emerald-500"/> Relatório de Fechamento Emitido</h3>
          <p className="text-sm text-slate-400">Esperado no Sistema (Dinheiro): <span className="text-slate-100 font-semibold">R$ {auditoriaResultado.esperado_sistema.toFixed(2)}</span></p>
          <p className="text-sm text-slate-400">Informado na Gaveta: <span className="text-slate-100 font-semibold">R$ {auditoriaResultado.informado_operador.toFixed(2)}</span></p>
          <p className={`text-sm font-bold ${auditoriaResultado.resultado === 'Perfeito' ? 'text-emerald-400' : 'text-rose-400'}`}>Status Auditoria: {auditoriaResultado.resultado}</p>
        </div>
      )}

      {/* Grid Indicadores Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Status Turno</p>
            <h2 className={`text-lg font-bold mt-1 ${caixaAtivo ? 'text-emerald-400' : 'text-rose-400'}`}>{caixaAtivo ? 'OPEN' : 'FECHADO'}</h2>
          </div>
          {caixaAtivo ? <Unlock className="w-7 h-7 text-emerald-500" /> : <Lock className="w-7 h-7 text-rose-500" />}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Dinheiro em Caixa (Gaveta)</p>
            <h2 className="text-xl font-bold mt-1 text-emerald-400">R$ {caixaAtivo ? Number(caixaAtivo.total_dinheiro_sistema).toFixed(2) : '0.00'}</h2>
          </div>
          <Banknote className="w-7 h-7 text-emerald-500" />
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total via PIX</p>
            <h2 className="text-xl font-bold mt-1 text-cyan-400">R$ {caixaAtivo ? Number(caixaAtivo.total_pix_sistema).toFixed(2) : '0.00'}</h2>
          </div>
          <RefreshCw className="w-7 h-7 text-cyan-500" />
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Cartão</p>
            <h2 className="text-xl font-bold mt-1 text-purple-400">R$ {caixaAtivo ? Number(caixaAtivo.total_cartao_sistema).toFixed(2) : '0.00'}</h2>
          </div>
          <CreditCard className="w-7 h-7 text-purple-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel Operacional */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
          {!caixaAtivo ? (
            <form onSubmit={lidarComAbertura}>
              <h3 className="text-md font-bold mb-4 text-amber-500 uppercase">Abertura de Turno</h3>
              <label className="block text-xs text-slate-400 mb-2">Fundo de Troco Inicial:</label>
              <input type="number" step="0.01" placeholder="0,00" value={valorInput} onChange={(e) => setValorInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 mb-4 focus:outline-none focus:border-amber-500"/>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg transition-colors text-sm">Iniciar Caixa</button>
            </form>
          ) : (
            <form onSubmit={lidarComFechamento}>
              <h3 className="text-md font-bold mb-4 text-rose-500 uppercase">Conferência & Fechamento</h3>
              <label className="block text-xs text-slate-400 mb-2">Contagem Física de Dinheiro em Mãos:</label>
              <input type="number" step="0.01" placeholder="0,00" value={valorInput} onChange={(e) => setValorInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 mb-4 focus:outline-none focus:border-rose-500"/>
              <div className="bg-slate-950 p-3 border border-slate-800 rounded-lg mb-4 flex items-center gap-2 text-xs text-slate-400">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" /> O sistema confrontará esse valor com as vendas e gerará o relatório de quebra.
              </div>
              <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-slate-100 font-bold py-2 rounded-lg transition-colors text-sm">Fechar e Emitir Auditoria</button>
            </form>
          )}
        </div>

        {/* Histórico / Linha do Tempo das Movimentações */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:col-span-2">
          <h3 className="text-md font-bold mb-4 text-slate-300 uppercase tracking-wide">Trilha de Auditoria (Turno Atual)</h3>
          {movimentacoes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma transação financeira efetuada neste turno até o momento.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {movimentacoes.map((mov) => (
                <div key={mov.id} className="bg-slate-950 p-3 border border-slate-800 rounded-xl flex items-center justify-between text-sm">
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md mr-2 ${mov.tipo === 'ENTRADA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{mov.tipo}</span>
                    <span className="text-xs text-slate-500">via {mov.meio_pagto}</span>
                    <p className="text-xs text-slate-400 mt-1">{mov.descricao || 'Sem descrição cadastrada'}</p>
                  </div>
                  <span className={`font-mono font-bold ${mov.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-rose-400'}`}>{mov.tipo === 'ENTRADA' ? '+' : '-'} R$ {Number(mov.valor).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}