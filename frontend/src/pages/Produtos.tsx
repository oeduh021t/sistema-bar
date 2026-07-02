import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Package, Plus, Loader2, AlertCircle } from 'lucide-react';

interface Produto {
  id: number;
  nome: string;
  preco_venda: string;
  quantidade_estoque: number;
  codigo_barras?: string;
}

export const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados do Formulário
  const [nome, setNome] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Carrega os produtos do backend
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

  // Envia o novo produto para o Backend
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

      // Limpa o formulário após o sucesso
      setNome('');
      setPrecoVenda('');
      setQuantidade('');
      setCodigoBarras('');
      
      // Atualiza a tabela automaticamente
      carregarProdutos();
      alert('Produto cadastrado com sucesso!');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        setErro(err.response.data.error);
      } else {
        setErro('Erro ao salvar o produto no servidor.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: string | number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estoque & Produtos</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie os itens disponíveis para venda no estabelecimento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Tabela de Listagem (Ocupa 2/3 da tela em monitores grandes) */}
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
                    <th className="p-4">Preço de Venda</th>
                    <th className="p-4 text-center">Qtd. Estoque</th>
                    <th className="p-4">Código</th>
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
                        <td className="p-4 font-medium text-slate-200">{produto.nome}</td>
                        <td className="p-4 text-emerald-400 font-semibold">{formatarMoeda(produto.preco_venda)}</td>
                        <td className={`p-4 text-center font-bold ${produto.quantidade_estoque <= 5 ? 'text-red-400' : 'text-slate-300'}`}>
                          {produto.quantidade_estoque} un
                        </td>
                        <td className="p-4 text-xs font-mono text-slate-500">{produto.codigo_barras || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulário de Cadastro (Ocupa 1/3 da tela) */}
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
    </div>
  );
};
