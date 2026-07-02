import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Package, Plus, Loader2, AlertCircle, Trash2, Scale, X, Check } from 'lucide-react';

interface Produto {
  id: number;
  nome: string;
  preco_venda: string;
  quantidade_estoque: number;
  codigo_barras?: string;
}

export const Produtos: React.FC = () => {
  const { usuario } = useAuth(); // 🟢 Captura o cargo do usuário para travas visuais
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados do Formulário
  const [nome, setNome] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  
  // Estados de Gerenciamento / Balanço
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [tipoBalanco, setTipoBalanco] = useState<'SOMAR' | 'SUBTRAIR' | 'DEFINIR'>('SOMAR');
  const [valorBalanco, setValorBalanco] = useState('');

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarProdutos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/produtos');
      setProdutos(response.data);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      await api.post('/produtos', {
        nome,
        preco_venda: Number(precoVenda),
        quantidade_estoque: Number(quantidade),
        codigo_barras: codigoBarras || undefined
      });

      setNome('');
      setPrecoVenda('');
      setQuantidade('');
      setCodigoBarras('');
      
      carregarProdutos();
    } catch (err: any) {
      setErro(err.response?.data?.error || 'Erro ao salvar o produto no servidor.');
    } finally {
      setSalvando(false);
    }
  };

  // 🟢 NOVA FUNÇÃO: DELETAR ITEM (EXCLUSIVO DONO)
  const handleDeletar = async (id: number, nomeProduto: string) => {
    if (!window.confirm(`Tem certeza absoluta que deseja remover "${nomeProduto}" do sistema?`)) return;
    
    try {
      await api.delete(`/produtos/${id}`);
      carregarProdutos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao deletar produto. Pode haver comandas atreladas a ele.');
    }
  };

  // 🟢 NOVA FUNÇÃO: AJUSTE / BALANÇO DE ESTOQUE AVANÇADO
  const handleExecutarBalanco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoSelecionado || !valorBalanco) return;

    const qtdInformada = Number(valorBalanco);
    let novaQuantidade = produtoSelecionado.quantidade_estoque;

    if (tipoBalanco === 'SOMAR') novaQuantidade += qtdInformada;
    if (tipoBalanco === 'SUBTRAIR') novaQuantidade -= qtdInformada;
    if (tipoBalanco === 'DEFINIR') novaQuantidade = qtdInformada;

    if (novaQuantidade < 0) {
      alert('Erro: A quantidade final em estoque não pode ser menor que zero.');
      return;
    }

    try {
      // Reutiliza a rota de edição ou uma rota PATCH específica que você possua no backend
      await api.patch(`/produtos/${produtoSelecionado.id}/estoque`, {
        quantidade_estoque: novaQuantidade
      });

      setProdutoSelecionado(null);
      setValorBalanco('');
      carregarProdutos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar balanço de estoque.');
    }
  };

  const formatarMoeda = (valor: string | number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estoque & Produtos</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie os itens disponíveis, faça balanço de inventário e delete produtos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Tabela de Listagem */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-700 flex items-center gap-2 text-amber-500">
            <Package className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-100">Itens em Estoque</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              Buscando produtos...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4">Produto</th>
                    <th className="p-4">Preço Venda</th>
                    <th className="p-4 text-center">Estoque Atual</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-sm">
                  {produtos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Nenhum produto cadastrado ainda.</td>
                    </tr>
                  ) : (
                    produtos.map((produto) => (
                      <tr key={produto.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-200">{produto.nome}</p>
                          <p className="text-xs font-mono text-slate-500">{produto.codigo_barras || 'Sem código'}</p>
                        </td>
                        <td className="p-4 text-emerald-400 font-semibold">{formatarMoeda(produto.preco_venda)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            produto.quantidade_estoque <= 0 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-950' 
                              : produto.quantidade_estoque <= 5 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-950'
                              : 'bg-slate-900 text-slate-300'
                          }`}>
                            {produto.quantidade_estoque} un
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          {/* Botão Balanço (Acessível para equipe controlar) */}
                          <button 
                            onClick={() => setProdutoSelecionado(produto)}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-2 rounded-xl transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                            title="Ajustar Estoque / Balanço"
                          >
                            <Scale className="w-4 h-4" /> <span className="hidden sm:inline">Balanço</span>
                          </button>

                          {/* Botão Deletar (Visível apenas para DONO) */}
                          {usuario?.funcao === 'DONO' && (
                            <button 
                              onClick={() => handleDeletar(produto.id, produto.nome)}
                              className="bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/40 text-rose-400 p-2 rounded-xl transition-colors"
                              title="Remover Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulário de Cadastro */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 mb-6">
            <Plus className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-100">Novo Produto</h2>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleCadastrar} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Item</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cerveja Duplo Malte 600ml"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Preço Venda (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value)}
                  placeholder="12.50"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Qtd. Inicial</label>
                <input
                  type="number"
                  required
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="24"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Código de Barras (Opcional)</label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="7891234567890"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full mt-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-semibold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {salvando ? 'Salvando...' : 'Cadastrar Item'}
            </button>
          </form>
        </div>
      </div>

      {/* 🟢 MODAL FLUTUANTE: DIÁLOGO DE BALANÇO DE ESTOQUE (INVENTÁRIO) */}
      {produtoSelecionado && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setProdutoSelecionado(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Scale className="w-5 h-5"/>
              <h3 className="text-md font-bold text-slate-100">Ajuste de Inventário</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Gerencie as entradas e quebras do produto: <span className="text-slate-200 font-semibold block mt-0.5">{produtoSelecionado.nome}</span></p>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-xs mb-4 text-center">
              <span className="text-slate-500 block">Estoque Atual em Sistema</span>
              <span className="text-lg font-bold text-amber-400 font-mono">{produtoSelecionado.quantidade_estoque} unidades</span>
            </div>

            <form onSubmit={handleExecutarBalanco} className="space-y-4">
              {/* Seleção do Tipo de Operação */}
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setTipoBalanco('SOMAR')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${tipoBalanco === 'SOMAR' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                >
                  + Entrada
                </button>
                <button 
                  type="button"
                  onClick={() => setTipoBalanco('SUBTRAIR')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${tipoBalanco === 'SUBTRAIR' ? 'bg-rose-500/10 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                >
                  - Saída/Perda
                </button>
                <button 
                  type="button"
                  onClick={() => setTipoBalanco('DEFINIR')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${tipoBalanco === 'DEFINIR' ? 'bg-blue-500/10 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                >
                  Substituir
                </button>
              </div>

              {/* Quantidade Ajustada */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Quantidade da Movimentação:</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  placeholder="Ex: 12"
                  value={valorBalanco} 
                  onChange={(e) => setValorBalanco(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-mono"
                />
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setProdutoSelecionado(null)} 
                  className="flex-1 bg-slate-900 hover:bg-slate-700/60 text-slate-400 py-2 rounded-xl text-sm transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4"/> Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};