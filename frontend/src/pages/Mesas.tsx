import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Grid, Plus, Circle, AlertCircle, ShoppingBag, DollarSign, ArrowLeft, Printer } from 'lucide-react';

interface Mesa {
  id: number;
  numero: number;
  status: 'LIVRE' | 'OCUPADA' | 'RESERVADA';
}

interface Produto {
  id: number;
  nome: string;
  preco_venda: string;
}

interface Cliente {
  id: number;
  nome: string;
}

export const Mesas: React.FC = () => {
  // Estados de dados do Banco
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  
  // Estados de Fluxo e Telas do Painel
  const [modoPagamento, setModoPagamento] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Estados de Formulários
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [clienteFiadoId, setClienteFiadoId] = useState('');
  const [numeroMesa, setNumeroMesa] = useState('');

  // Simulação local do consumo da comanda ativa
  const [consumoMesa, setConsumoMesa] = useState<{produto: string, qtd: number, precoUn: number, total: number}[]>([
    { produto: 'Cerveja Brahma 600ml', qtd: 2, precoUn: 10.00, total: 20.00 },
    { produto: 'Cerveja Heineken', qtd: 1, precoUn: 12.50, total: 12.50 }
  ]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // 1. Busca os Produtos
      const resProdutos = await api.get('/produtos');
      setProdutos(resProdutos.data);

      // 2. Busca os Clientes de Pendências
      try {
        const resClientes = await api.get('/clientes-fiado');
        setClientes(resClientes.data);
      } catch {
        setClientes([
          { id: 1, nome: 'Roberto Carlos da Silva' },
          { id: 2, nome: 'Cliente Teste Inadimplente' }
        ]);
      }
      
      // 3. Busca as Mesas Reais do Banco
      try {
        const resMesas = await api.get('/mesas');
        setMesas(resMesas.data);
      } catch {
        setMesas([
          { id: 1, numero: 1, status: 'OCUPADA' },
          { id: 2, numero: 2, status: 'LIVRE' },
          { id: 3, numero: 3, status: 'LIVRE' },
        ]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do salão:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleCriarMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.post('/mesas', { numero: Number(numeroMesa) });
      setNumeroMesa('');
      carregarDados();
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Apenas administradores (DONO) podem criar mesas.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAlterarStatus = async (mesaId: number, novoStatus: string) => {
    try {
      const response = await api.post('/mesas/status', { mesa_id: mesaId, status: novoStatus });
      setMesas(mesas.map(m => m.id === mesaId ? { ...m, status: response.data.mesa.status } : m));
      if (mesaSelecionada?.id === mesaId) {
        setMesaSelecionada({ ...mesaSelecionada, status: response.data.mesa.status });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao mudar status.');
    }
  };

  const handleLancarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mesaSelecionada) return;
    setErro(null);
    setSalvando(true);

    try {
      if (mesaSelecionada.status === 'LIVRE') {
        await handleAlterarStatus(mesaSelecionada.id, 'OCUPADA');
      }

      await api.post('/mesas/pedido', {
        mesa_id: mesaSelecionada.id,
        produto_id: Number(produtoId),
        quantidade: Number(quantidade)
      });

      const prod = produtos.find(p => p.id === Number(produtoId));
      if (prod) {
        setConsumoMesa([...consumoMesa, {
          produto: prod.nome,
          qtd: Number(quantidade),
          precoUn: Number(prod.preco_venda),
          total: Number(prod.preco_venda) * Number(quantidade)
        }]);
      }

      alert('Item lançado com sucesso!');
      setProdutoId('');
      setQuantidade('1');
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Estoque insuficiente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleFecharConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mesaSelecionada) return;
    setErro(null);
    setSalvando(true);

    try {
      const payload: any = {
        mesa_id: mesaSelecionada.id,
        forma_pagamento: formaPagamento
      };

      if (formaPagamento === 'FIADO') {
        payload.cliente_fiado_id = Number(clienteFiadoId);
      }

      const response = await api.post('/mesas/fechamento', payload);

      alert(response.data.message || 'Mesa encerrada com sucesso!');
      setMesaSelecionada(null);
      setModoPagamento(false);
      setConsumoMesa([]);
      setClienteFiadoId('');
      carregarDados();
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro interno no fechamento da mesa.');
    } finally {
      setSalvando(false);
    }
  };

  const valorTotalMesa = consumoMesa.reduce((acc, item) => acc + item.total, 0);

  if (loading) {
    return <div className="text-slate-400 p-8">Carregando estrutura do salão...</div>;
  }

  return (
    <>
      {/* 🟢 CONTEÚDO VISUAL COMPLETO DO APP (ESCONDIDO NO MOMENTO DO PRINT) */}
      <div className="space-y-8 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salão & Mesas</h1>
            <p className="text-slate-400 text-sm mt-1">Gerencie a ocupação e realize o fechamento ágil de contas.</p>
          </div>

          <form onSubmit={handleCriarMesa} className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
            <input
              type="number"
              required
              value={numeroMesa}
              onChange={(e) => setNumeroMesa(e.target.value)}
              placeholder="Nº da Mesa"
              className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
            <button type="submit" disabled={salvando} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
              + Add
            </button>
          </form>
        </div>

        {erro && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Grid de Mesas */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {mesas.map((mesa) => {
              const isSelecionada = mesaSelecionada?.id === mesa.id;
              return (
                <button
                  key={mesa.id}
                  onClick={() => { setMesaSelecionada(mesa); setModoPagamento(false); setErro(null); }}
                  className={`p-6 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all transform active:scale-95 ${
                    isSelecionada ? 'ring-2 ring-amber-500 border-transparent shadow-lg' : ''
                  } ${mesa.status === 'LIVRE' ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'}`}
                >
                  <div className={`p-3 rounded-xl ${mesa.status === 'LIVRE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    <Grid className="w-6 h-6" />
                  </div>
                  <span className="block font-bold text-lg text-slate-200">Mesa {mesa.numero}</span>
                  <span className={`text-xs font-semibold ${mesa.status === 'LIVRE' ? 'text-emerald-400' : 'text-red-400'}`}>{mesa.status}</span>
                </button>
              );
            })}
          </div>

          {/* Painel Lateral de Comandas */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm min-h-[400px]">
            {mesaSelecionada ? (
              !modoPagamento ? (
                /* MENU INTERNO: ADICIONAR PRODUTOS */
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <h2 className="text-xl font-bold text-slate-100">Mesa {mesaSelecionada.numero}</h2>
                    <span className="text-sm font-bold text-amber-500">Total: R$ {valorTotalMesa.toFixed(2)}</span>
                  </div>

                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {consumoMesa.map((c, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-400 bg-slate-900/40 p-2 rounded-lg">
                        <span>{c.qtd}x {c.produto}</span>
                        <span className="text-slate-300 font-medium">R$ {c.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleLancarPedido} className="space-y-4 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                      <ShoppingBag className="w-4 h-4 text-amber-500" /> Lançar Item
                    </div>
                    <select required value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500">
                      <option value="">-- Escolha o Produto --</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <input type="number" min="1" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500" />
                    <button type="submit" className="w-full py-2 bg-slate-700 hover:bg-slate-600 font-semibold rounded-xl text-sm transition-colors">Lançar na Conta</button>
                  </form>

                  <button onClick={() => setModoPagamento(true)} className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2">
                    <DollarSign className="w-4 h-4" /> Fechar e Pagar
                  </button>
                </div>
              ) : (
                /* MENU INTERNO: SELEÇÃO DE PAGAMENTO */
                <form onSubmit={handleFecharConta} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setModoPagamento(false)} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400"><ArrowLeft className="w-4 h-4" /></button>
                      <h2 className="text-base font-bold text-slate-100">Mesa {mesaSelecionada.numero}</h2>
                    </div>
                    <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-bold text-amber-500 rounded-lg transition-colors border border-slate-600">
                      <Printer className="w-3.5 h-3.5" /> Imprimir
                    </button>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl text-center border border-slate-700/50">
                    <p className="text-xs text-slate-400">Total a Pagar</p>
                    <p className="text-3xl font-black text-emerald-400 mt-1">R$ {valorTotalMesa.toFixed(2)}</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-400">Forma de Recebimento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['DINHEIRO', 'CARTAO', 'FIADO'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setFormaPagamento(m); setErro(null); }}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            formaPagamento === m ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {m === 'FIADO' ? 'Pendência' : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formaPagamento === 'FIADO' && (
                    <div className="space-y-2">
                      <select required value={clienteFiadoId} onChange={(e) => setClienteFiadoId(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500">
                        <option value="">-- Selecione o Cliente --</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                  )}

                  <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg transition-colors">
                    Concluir Encerramento
                  </button>
                </form>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 pt-24">
                <Grid className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-medium">Selecione uma mesa para gerenciar ou encerrar a conta.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔴 BLOCO TÉRMICO DE IMPRESSÃO ISOLADO (SÓ ENTRA EM AÇÃO NO PRINT DO NAVEGADOR) */}
      {/* ========================================================================= */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-4 font-mono text-sm z-50 overflow-auto">
        {mesaSelecionada && (
          <div className="max-w-[80mm] mx-auto bg-white p-2">
            <div className="text-center font-bold text-lg border-b-2 border-dashed border-black pb-2 mb-2">
              *** SAAS BAR ***
            </div>
            <div className="mb-4 text-xs space-y-0.5">
              <p><strong>CONFERÊNCIA DE MESA:</strong> MESA {mesaSelecionada.numero}</p>
              <p><strong>DATA:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
              <p>----------------------------------------</p>
            </div>
            
            <div className="space-y-1 text-xs border-b-2 border-dashed border-black pb-3 mb-3">
              <div className="flex justify-between font-bold">
                <span>ITEM</span>
                <span>QTD x VL</span>
                <span>TOTAL</span>
              </div>
              {consumoMesa.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="truncate max-w-[120px]">{item.produto}</span>
                  <span>{item.qtd} x R$ {item.precoUn.toFixed(2)}</span>
                  <span>R$ {item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="text-right text-base font-black space-y-1">
              <p>SUBTOTAL: R$ {valorTotalMesa.toFixed(2)}</p>
              <p className="text-xs font-normal text-center mt-6 border-t border-black pt-4">
                * ISSO NÃO É UM DOCUMENTO FISCAL *<br/>
                Obrigado pela preferência!
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
